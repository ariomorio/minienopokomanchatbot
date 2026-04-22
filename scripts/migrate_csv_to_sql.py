#!/usr/bin/env python3
"""Generate SQL INSERT statements from Lark Base CSV exports.

Outputs batched SQL files to scripts/migration-sql/ for execution via Supabase MCP.
- Handles UTF-8 BOM
- Converts YYYY/MM/DD HH:MM to Unix epoch ms (Asia/Tokyo)
- Generates UUIDs for missing log_id / record_id
- SQL-escapes strings (doubles single quotes)
- Batches 500 rows per INSERT
"""
import csv
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

JST = timezone(timedelta(hours=9))
NOW_MS = int(datetime.now(tz=JST).timestamp() * 1000)

CSV_DIR = Path(__file__).resolve().parent.parent / ".migration-csv"
OUT_DIR = Path(__file__).resolve().parent / "migration-sql"
OUT_DIR.mkdir(exist_ok=True)

BATCH_SIZE = 500


def parse_datetime_ms(s: str) -> int | None:
    """Parse 'YYYY/MM/DD HH:MM' or 'YYYY/MM/DD HH:MM:SS' to epoch ms (JST)."""
    if not s or not s.strip():
        return None
    s = s.strip()
    for fmt in ("%Y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            dt = datetime.strptime(s, fmt).replace(tzinfo=JST)
            return int(dt.timestamp() * 1000)
        except ValueError:
            continue
    return None


def q(v) -> str:
    """SQL string literal with proper escaping."""
    if v is None or v == "":
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def qnum(v) -> str:
    """SQL numeric or NULL."""
    if v is None or v == "":
        return "NULL"
    return str(v)


def read_csv(name: str):
    path = CSV_DIR / name
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        rows = list(reader)
    return rows[0], rows[1:]


def write_sql(filename: str, statements: list[str]):
    path = OUT_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        f.write("BEGIN;\n\n")
        for stmt in statements:
            f.write(stmt)
            f.write("\n\n")
        f.write("COMMIT;\n")
    size_kb = path.stat().st_size / 1024
    print(f"  wrote {path.name} ({size_kb:.1f}KB, {len(statements)} stmts)")


def batched_insert(table: str, cols: list[str], values: list[list[str]]) -> list[str]:
    """Split values into batches of BATCH_SIZE and generate INSERT statements."""
    out = []
    col_str = ", ".join(cols)
    for i in range(0, len(values), BATCH_SIZE):
        chunk = values[i : i + BATCH_SIZE]
        rows_sql = ",\n  ".join("(" + ", ".join(row) + ")" for row in chunk)
        out.append(f"INSERT INTO public.{table} ({col_str}) VALUES\n  {rows_sql};")
    return out


def migrate_settings():
    print("[settings]")
    header, rows = read_csv("settings.csv")
    values = []
    for row in rows:
        if len(row) < 2 or not row[0]:
            continue
        key, val = row[0], row[1]
        values.append([q(key), q(val), str(NOW_MS)])
    stmts = batched_insert("settings", ["key", "value", "updated_at"], values)
    write_sql("01_settings.sql", stmts)
    return len(values)


def migrate_users():
    print("[users]")
    header, rows = read_csv("users.csv")
    # ユーザーID,メールアドレス,メール認証日,名前,パスワード,アイコン画像,作成日,更新日,ステータス
    values = []
    for row in rows:
        if len(row) < 9 or not row[0]:
            continue
        uid, email, email_verified_raw, name, password, image, created_raw, updated_raw, status = row[:9]
        email_verified_ms = parse_datetime_ms(email_verified_raw)
        created_ms = parse_datetime_ms(created_raw) or NOW_MS
        updated_ms = parse_datetime_ms(updated_raw) or created_ms
        status = status if status in ("pending", "approved", "rejected") else "approved"
        values.append([
            q(uid), q(email), qnum(email_verified_ms), q(name),
            q(password), q(image), q(status),
            str(created_ms), str(updated_ms),
        ])
    stmts = batched_insert(
        "users",
        ["id", "email", "email_verified", "name", "password", "image", "status", "created_at", "updated_at"],
        values,
    )
    write_sql("02_users.sql", stmts)
    return len(values)


def migrate_chat_sessions(valid_user_ids: set):
    print("[chat_sessions]")
    header, rows = read_csv("chat_sessions.csv")
    # セッションID,ユーザーID,モード,タイトル
    values = []
    skipped = 0
    for row in rows:
        if len(row) < 4 or not row[0]:
            continue
        session_id, user_id, mode, title = row[:4]
        if user_id not in valid_user_ids:
            skipped += 1
            continue
        if mode not in ("concept", "analysis", "strategy"):
            mode = "concept"
        values.append([
            q(session_id), q(user_id), q(mode), q(title),
            str(NOW_MS), str(NOW_MS),
        ])
    if skipped:
        print(f"  skipped {skipped} rows with orphan user_id")
    stmts = batched_insert(
        "chat_sessions",
        ["session_id", "user_id", "mode", "title", "created_at", "updated_at"],
        values,
    )
    write_sql("03_chat_sessions.sql", stmts)
    return len(values)


def migrate_chat_logs(valid_session_ids: set, valid_user_ids: set):
    print("[chat_logs]")
    header, rows = read_csv("chat_logs.csv")
    # ログID,セッションID,ユーザーID,モード,ユーザー入力,AI回答,日時,評価
    values = []
    skipped_fk = 0
    for row in rows:
        if len(row) < 8:
            continue
        log_id, session_id, user_id, mode, user_input, ai_response, timestamp_raw, evaluation = row[:8]
        if not log_id:
            log_id = str(uuid.uuid4())
        if not session_id or not user_id:
            skipped_fk += 1
            continue
        if session_id not in valid_session_ids or user_id not in valid_user_ids:
            skipped_fk += 1
            continue
        ts_ms = parse_datetime_ms(timestamp_raw) or NOW_MS
        if evaluation not in ("good", "bad"):
            evaluation = ""
        values.append([
            q(log_id), q(session_id), q(user_id), q(mode),
            q(user_input), q(ai_response), str(ts_ms), q(evaluation),
        ])
    if skipped_fk:
        print(f"  skipped {skipped_fk} rows with missing/invalid FK")
    stmts = batched_insert(
        "chat_logs",
        ["log_id", "session_id", "user_id", "mode", "user_input", "ai_response", "timestamp", "evaluation"],
        values,
    )
    write_sql("04_chat_logs.sql", stmts)
    return len(values)


def migrate_knowledge():
    print("[knowledge_sources]")
    header, rows = read_csv("knowledge.csv")
    # タイトル,内容,ソース種別,参照リンク,学習ステータス,ベクトルID,同期ステータス,最終同期日時,チャンク番号,埋め込みモデル,ソースファイル
    values = []
    for row in rows:
        # pad to 11
        while len(row) < 11:
            row.append("")
        title, content, source_type, url, learn_status, vector_id, sync_status, last_synced, chunk_idx, emb_model, source_file = row[:11]
        if not title and not content:
            continue
        record_id = str(uuid.uuid4())
        status = "active" if learn_status != "archived" else "archived"
        sync_status_val = sync_status if sync_status in ("pending", "synced", "error") else "synced"
        last_synced_ms = parse_datetime_ms(last_synced)
        try:
            chunk_idx_val = int(chunk_idx) if chunk_idx else None
        except ValueError:
            chunk_idx_val = None
        values.append([
            q(record_id), q(title), q(content), q(source_type), q(url),
            q(status), str(NOW_MS), qnum(None),
            q(vector_id), q(sync_status_val), qnum(last_synced_ms),
            qnum(chunk_idx_val), q(emb_model), q(source_file),
        ])
    # Split knowledge into multiple files due to size
    cols = ["record_id", "title", "content", "source_type", "url",
            "status", "created_at", "updated_at",
            "pinecone_id", "sync_status", "last_synced_at",
            "chunk_index", "embedding_model", "source_file"]
    # Smaller batches for knowledge due to potentially huge content
    global BATCH_SIZE
    saved = BATCH_SIZE
    BATCH_SIZE = 100
    stmts = batched_insert("knowledge_sources", cols, values)
    BATCH_SIZE = saved
    # Chunk into multiple files (max ~500KB each for MCP execute_sql limits)
    chunks = []
    current = []
    current_size = 0
    MAX_SIZE = 400_000  # bytes
    for s in stmts:
        s_size = len(s.encode("utf-8"))
        if current_size + s_size > MAX_SIZE and current:
            chunks.append(current)
            current = []
            current_size = 0
        current.append(s)
        current_size += s_size
    if current:
        chunks.append(current)
    for i, chunk in enumerate(chunks, 1):
        write_sql(f"05_knowledge_part{i:03d}.sql", chunk)
    return len(values)


def _get_imported_session_ids() -> set:
    """Re-read chat_sessions filtering by valid user_ids to match what was inserted."""
    user_ids = get_ids_from_users_csv()
    _, rows = read_csv("chat_sessions.csv")
    return {r[0] for r in rows if r and len(r) >= 2 and r[0] and r[1] in user_ids}


def get_ids_from_users_csv() -> set:
    _, rows = read_csv("users.csv")
    return {r[0] for r in rows if r and r[0]}


def get_ids_from_chat_sessions_csv() -> set:
    _, rows = read_csv("chat_sessions.csv")
    return {r[0] for r in rows if r and r[0]}


def main():
    print(f"CSV dir: {CSV_DIR}")
    print(f"Output dir: {OUT_DIR}")
    print()
    # Clean old output
    for f in OUT_DIR.glob("*.sql"):
        f.unlink()

    counts = {}
    counts["settings"] = migrate_settings()
    counts["users"] = migrate_users()
    valid_user_ids = get_ids_from_users_csv()
    counts["chat_sessions"] = migrate_chat_sessions(valid_user_ids)

    valid_session_ids = get_ids_from_chat_sessions_csv()
    # Filter session IDs to only those we just inserted (user_id was valid)
    valid_session_ids = valid_session_ids & _get_imported_session_ids()
    counts["chat_logs"] = migrate_chat_logs(valid_session_ids, valid_user_ids)

    counts["knowledge_sources"] = migrate_knowledge()

    print()
    print("=== Summary ===")
    for table, n in counts.items():
        print(f"  {table}: {n} rows")
    print()
    print(f"SQL files in: {OUT_DIR}")


if __name__ == "__main__":
    main()
