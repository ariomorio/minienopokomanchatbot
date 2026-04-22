#!/bin/bash
# 動画文字起こしファイルを一括でPinecone + Lark Baseに投入するスクリプト
set -euo pipefail

TRANSCRIPT_DIR="/Users/ariomorio/Downloads/みにえのぽこまん動画/transcripts"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DONE_LOG="$SCRIPT_DIR/transcripts-done.log"

cd "$PROJECT_DIR"

total=0
success=0
fail=0
skipped=0

for dir in "$TRANSCRIPT_DIR"/artifact-*/; do
  file="$dir/transcript.txt"
  if [[ ! -f "$file" ]]; then
    continue
  fi

  # ディレクトリ名からタイトルを抽出 (artifact-<title>-<token>)
  dirname="$(basename "$dir")"
  # "artifact-" を除去し、末尾の "-objpxe..." を除去してタイトルを取得
  title="${dirname#artifact-}"
  title="${title%-obj*}"

  # 完了済みはスキップ
  if [[ -f "$DONE_LOG" ]] && grep -qxF "$title" "$DONE_LOG"; then
    ((skipped++))
    echo "[SKIP] $title"
    continue
  fi

  ((total++))
  echo "[$total] Processing: $title"

  if node scripts/ingest-to-pinecone.js --file "$file" --type "video_transcript" --title "$title" 2>&1; then
    ((success++))
    echo "  -> OK"
    # 完了済みリストに追記
    echo "$title" >> "$DONE_LOG"
  else
    ((fail++))
    echo "  -> FAILED"
  fi

  # Rate limit対策
  sleep 2
done

echo "スキップ: $skipped件"

echo ""
echo "=== 完了 ==="
echo "合計: $total / 成功: $success / 失敗: $fail"
