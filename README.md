# ミニえのぽこまん チャットボット

AIコンサルタント「えのぽこまん」の思考プロセスを再現するWebアプリケーションです。

## 技術スタック

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: Google Gemini API
- **Vector DB**: Pinecone
- **Database**: Lark Base
- **Deploy**: Vercel (推奨)

## 機能

### 1. モード選択
- **コンセプト設計モード**: 「誰に、何を、どう発信するか」を明確化
- **自己分析モード**: コーチング的な深掘りで内面を引き出す
- **戦略設計モード**: 具体的なアクションプランの作成

### 2. RAG (Retrieval-Augmented Generation)
- Lark Baseに蓄積された「えのぽこまん」の思考データを活用
- Vector DBで類似コンテキストを検索
- S-ICL (Self-reflection In-Context Learning) テンプレートで思考プロセスを再現

### 3. データ管理
- Lark Base: 学習ソースと会話ログの管理
- Pinecone: ベクトル検索用インデックス
- 自動同期: Cronジョブで定期的にLark→Pineconeへ同期

## セットアップ

### 1. 依存関係のインストール

\`\`\`bash
npm install
\`\`\`

### 2. 環境変数の設定

\`.env.local\` ファイルを作成し、以下の環境変数を設定してください:

\`\`\`env
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Lark API
LARK_APP_ID=your_lark_app_id_here
LARK_APP_SECRET=your_lark_app_secret_here
LARK_BASE_ID=your_lark_base_id_here
LARK_KNOWLEDGE_TABLE_ID=your_knowledge_table_id_here
LARK_CHATLOG_TABLE_ID=your_chatlog_table_id_here

# Pinecone Vector DB
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_ENVIRONMENT=your_pinecone_environment_here
PINECONE_INDEX_NAME=enopokoman-index

# Sync Cron Secret
CRON_SECRET=your_random_secret_here
\`\`\`

### 3. Lark Baseのセットアップ

要件定義書に従って、以下のテーブルを作成してください:

1. **Knowledge_Source** (学習ソース管理)
2. **Chat_Logs** (会話ログ)

### 4. Pinecone Indexの作成

\`\`\`bash
# Pinecone Index作成 (dimension: 768, metric: cosine)
# Pinecone Consoleから作成するか、CLIを使用
\`\`\`

### 5. 開発サーバーの起動

\`\`\`bash
npm run dev
\`\`\`

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## API エンドポイント

### POST /api/chat
チャットメッセージを送信し、ストリーミングレスポンスを受け取ります。

**Request Body:**
\`\`\`json
{
  "message": "ユーザーの入力",
  "mode": "concept" | "analysis" | "strategy",
  "history": [{ "role": "user", "content": "..." }],
  "sessionId": "uuid"
}
\`\`\`

### POST /api/sync
Lark BaseからPineconeへデータを同期します（Cron Secret必須）。

**Headers:**
\`\`\`
Authorization: Bearer YOUR_CRON_SECRET
\`\`\`

## デプロイ

### Vercelへのデプロイ

\`\`\`bash
# Vercel CLIのインストール
npm install -g vercel

# デプロイ
vercel
\`\`\`

環境変数をVercelダッシュボードで設定してください。

### Cronジョブの設定

Vercel Cron Jobsまたは外部サービス（GitHub Actions, Upstash等）を使用して、
\`/api/sync\` エンドポイントを定期的に呼び出してください。

## プロジェクト構造

\`\`\`
├── app/
│   ├── api/
│   │   ├── chat/          # チャットAPI
│   │   └── sync/          # 同期API
│   ├── chat/              # チャット画面
│   └── page.tsx           # LP/モード選択
├── components/
│   ├── features/
│   │   ├── Chat/          # チャット関連コンポーネント
│   │   └── ModeSelect/    # モード選択コンポーネント
│   └── ui/                # 汎用UIコンポーネント
├── lib/
│   ├── gemini.ts          # Gemini APIクライアント
│   ├── lark.ts            # Lark APIクライアント
│   ├── vectordb.ts        # Pineconeクライアント
│   └── prompt-templates/  # S-ICLテンプレート
└── types/                 # TypeScript型定義
\`\`\`

## ライセンス

MIT

## 作成者

Tech Lead - ミニえのぽこまんプロジェクト
\`\`\`
