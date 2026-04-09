#!/bin/bash
# 動画文字起こしファイルを一括でPinecone + Lark Baseに投入するスクリプト
set -euo pipefail

TRANSCRIPT_DIR="/Users/ariomorio/Downloads/みにえのぽこまん動画/transcripts"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

total=0
success=0
fail=0

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

  ((total++))
  echo "[$total] Processing: $title"

  if node scripts/ingest-to-pinecone.js --file "$file" --type "video_transcript" 2>&1; then
    ((success++))
    echo "  -> OK"
  else
    ((fail++))
    echo "  -> FAILED"
  fi

  # Rate limit対策
  sleep 2
done

echo ""
echo "=== 完了 ==="
echo "合計: $total / 成功: $success / 失敗: $fail"
