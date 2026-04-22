#!/bin/bash
# クライアント環境: 動画文字起こしファイルを一括でPinecone + Lark Baseに投入
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

  dirname="$(basename "$dir")"
  title="${dirname#artifact-}"
  title="${title%-obj*}"

  ((total++))
  echo "[$total] Processing: $title"

  if DOTENV_CONFIG_PATH=.env.client node -r dotenv/config scripts/ingest-to-pinecone.js --file "$file" --type "video_transcript" 2>&1; then
    ((success++))
    echo "  -> OK"
  else
    ((fail++))
    echo "  -> FAILED"
  fi

  sleep 2
done

echo ""
echo "=== 完了 ==="
echo "合計: $total / 成功: $success / 失敗: $fail"
