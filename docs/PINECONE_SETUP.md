# Pinecone セットアップガイド

Google Gemini API (`text-embedding-004`) と連携するための Pinecone Index 作成手順の詳細です。

## 1. アカウント作成・ログイン

1. [Pinecone公式サイト](https://www.pinecone.io/) にアクセスします。
2. 右上の **"Sign Up"** (または "Login") ボタンをクリックします。
3. Googleアカウント、GitHubアカウント、またはメールアドレスで登録・ログインします。
   - ※ 無料プラン（Starter Plan）で十分に動作します。

## 2. Index (インデックス) の作成

ログイン後、ダッシュボード画面から以下の手順でIndexを作成します。

1. ダッシュボードの **"Indexes"** タブを開きます。
2. **"Create Index"** ボタンをクリックします。
3. 以下の設定を入力します：

| 項目 | 設定値 | 説明 |
|------|--------|------|
| **Index Name** | `enopokoman-index` | 任意の名前でOKですが、環境変数と合わせる必要があります。 |
| **Dimensions** | `768` | Geminiの `text-embedding-004` モデルの出力次元数です。**必ず `768` に設定してください**。これ以外だとエラーになります。 |
| **Metric** | `cosine` | ベクトル間の類似度を測る計算方法です。Cosign Similarity (コサイン類似度) を選択します。 |
| **Cloud** | `aws` (推奨) | 以前はGoogle Cloudもありましたが、Starter PlanではAWSの特定リージョンのみ選択可能な場合があります。 |
| **Region** | `us-east-1` (推奨) | 運用しやすいリージョンを選択してください。Starter Planで選べるものを選びます。 |

4. **"Create Index"** ボタンをクリックして作成完了を待ちます（数十秒〜数分かかります）。

> [!IMPORTANT]
> **Dimensions** の設定を間違えると、AIの検索機能が正しく動作しません。必ず **768** に設定してください。

## 3. 接続情報の取得

`.env.local` に設定するための情報を取得します。

### Host (Environment)
1. 作成した Index (`enopokoman-index`) の詳細画面を開きます。
2. **"Host"** という項目を探します。
   - 例: `enopokoman-index-abcdefg.svc.aped-4627-b74a.pinecone.io`
   - これが環境変数の `PINECONE_ENVIRONMENT` (またはHost) にあたりますが、最新のPinecone SDKではAPI Keyがあれば自動解決してくれる場合もあります。ただし、念のためHost全体を控えておいてください。
   - `.env.local` のコメントには `PINECONE_ENVIRONMENT` とありますが、サーバーレスインデックスの場合は特に指定が不要なことが多いです。古いライブラリ互換のためにHost URLを求められる場合があります。

### API Key
1. 左サイドメニューの **"API Keys"** をクリックします。
2. デフォルトの Key、または **"Create API Key"** で新規作成します。
3. 表示された **Key** をコピーします。

## 4. 環境変数の設定

プロジェクトの `.env.local` ファイルを開き、取得した値を設定します。

```env
# Pinecone Vector DB
PINECONE_API_KEY=ここにコピーしたAPI Keyを貼り付け
PINECONE_ENVIRONMENT=ここにHost情報を貼り付け (例: us-east-1 または Host URL)
PINECONE_INDEX_NAME=enopokoman-index
```

※ `PINECONE_ENVIRONMENT` は、PineconeのバージョンによってはAPI Keyのみで動作するため不要な場合もありますが、リージョンID（例：`us-east-1`）を入れておくのが無難です。

## 5. 疎通確認

設定が完了したら、以下のコマンドでセットアップが正しく行われたか確認できます。

```bash
# 初回データ同期（空データを送って接続テスト）
# 注意: CRON_SECRETが必要です
curl -X POST http://localhost:3000/api/sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

エラーが出なければ接続成功です。
