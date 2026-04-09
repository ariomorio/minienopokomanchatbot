# Google Gemini API セットアップガイド

このプロジェクトで `gemini-1.5-pro` (および `2.5-pro` など) を使用するためのAPIキー取得・設定手順です。
通常、**Google AI Studio** を使用するのが最も簡単です。

## 1. Google AI Studio にアクセス

1. [Google AI Studio](https://aistudio.google.com/) にアクセスします。
2. Googleアカウントでログインします。

## 2. APIキーの取得

1. 左上の **"Get API key"** ボタンをクリックします。
2. **"Create API key"** をクリックします。
3. **"Create API key in new project"** を選択します（既存のGoogle Cloudプロジェクトがある場合はそちらを選択しても構いません）。
4. しばらく待つとAPIキーが生成されるので、コピーします。

> [!NOTE]
> Google Cloud Console (GCP) から操作する場合、**"Google AI Studio"** へのリンクへ誘導されることがありますが、基本的には上記の AI Studio 画面で完結します。

## 3. 課金設定（必要な場合）

無料枠（Free Tier）で利用する場合は設定不要ですが、制限を超えて利用する場合（Pay-as-you-go）は、Google Cloud Consoleでの請求先アカウントの紐付けが必要です。

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセスします。
2. Google AI Studioで作成したプロジェクトを選択します（プロジェクト名は自動生成されている場合があります）。
3. 左メニューの **"お支払い" (Billing)** から、請求先アカウントを紐付けます。

## 4. APIの有効化確認（トラブルシューティング）

もし APIキーを設定してもエラーが出る場合、以下のAPIが有効になっているか Google Cloud Console で確認してください。

1. [Google Cloud Console APIライブラリ](https://console.cloud.google.com/apis/library) にアクセスします。
2. 以下のAPIを検索し、有効化されているか確認します：
   - **Generative Language API** (これがGemini APIの本体です)

## 5. 環境変数の設定

取得したAPIキーを、プロジェクトの `.env.local` ファイルに設定します。

```env
# Google Gemini API
GEMINI_API_KEY=ここにコピーしたAPIキーを貼り付け
```

## 補足: Vertex AI API との違い

このプロジェクトでは `GoogleGenerativeAI` SDK (Google AI Studio版) を使用しています。
Vertex AI (GCPの企業向けAI基盤) のAPIキーや認証方式とは異なりますので、**Google AI Studio** で発行したAPIキーを使用することをお勧めします。
