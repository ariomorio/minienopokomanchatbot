# ミニえのぽこまん - セットアップガイド

## 🚀 クイックスタート

### 1. 環境変数の設定

`.env.local` ファイルを作成し、以下を設定してください:

```env
GEMINI_API_KEY=your_key_here
LARK_APP_ID=your_app_id_here
LARK_APP_SECRET=your_secret_here
LARK_BASE_ID=your_base_id_here
LARK_KNOWLEDGE_TABLE_ID=your_table_id_here
LARK_CHATLOG_TABLE_ID=your_table_id_here
PINECONE_API_KEY=your_pinecone_key_here
PINECONE_ENVIRONMENT=your_environment_here
PINECONE_INDEX_NAME=enopokoman-index
CRON_SECRET=your_random_secret_here
```

### 2. Pinecone Indexの作成

1. [Pinecone Console](https://app.pinecone.io/)にログイン
2. 新しいIndexを作成:
   - Name: `enopokoman-index`
   - Dimension: `768`
   - Metric: `cosine`

### 3. Lark Baseのセットアップ

#### Knowledge_Source テーブル

| フィールド名 | タイプ | 説明 |
|------------|--------|------|
| タイトル | テキスト | データのタイトル |
| 内容 | 長文テキスト | 学習させるテキスト内容 |
| ソース種別 | 単一選択 | 動画/X/会議など |
| 参照リンク | URL | 元データへのリンク |
| 学習ステータス | 単一選択 | 学習対象/学習除外 |
| 登録日 | 日時 | 自動設定 |
| 更新日時 | 日時 | 自動設定 |

#### Chat_Logs テーブル

| フィールド名 | タイプ | 説明 |
|------------|--------|------|
| セッションID | テキスト | セッション識別子 |
| ユーザーID | テキスト | ユーザー識別子 |
| モード | 単一選択 | concept/analysis/strategy |
| ユーザー入力 | 長文テキスト | ユーザーのメッセージ |
| AI回答 | 長文テキスト | AIの応答 |
| 日時 | 日時 | 会話日時 |
| 評価 | 単一選択 | good/bad (オプション) |

### 4. 開発サーバーの起動

```bash
npm run dev
```

### 5. 初回データ同期

データをVector DBに同期するため、以下を実行:

```bash
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 📋 次のステップ

1. Lark BaseにサンプルデータをKnowledge_Sourceに追加
2. `/api/sync` を実行してVector DBに同期
3. アプリを開いてモードを選択
4. チャットを開始

## 🎯 本番デプロイ

Vercelにデプロイする場合:

```bash
vercel
```

環境変数をVercelダッシュボードで設定し、Cron Jobsで `/api/sync` を定期実行するように設定してください。
