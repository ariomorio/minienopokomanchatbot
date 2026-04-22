# ミニえのぽこまん Supabase移行 対応手順書

**最終更新**: 2026-04-21
**緊急度**: 🔴 高（講座運営に直結）
**対応方針**: Option C（Supabaseへのデータ恒久移行）

---

## 📢 これまでの経緯

### 発生事象
- 2026-04-21 16時以降、複数アカウントでログインできない事象が発生
- 講座メンバー（168名）が影響を受ける状態

### 根本原因
**Lark Open APIの月間クォータを、テナント単位で使い切った**ことによるもの。

ミニえのぽこまんはユーザー認証・チャット履歴・ナレッジをすべてLark Base経由で
動作させていたため、168名の講座メンバーの同時利用開始によって、
Larkテナントの月間API呼び出し上限に到達しました。

### 試した対応
1. **ログインAPI最適化**（実施済み）
   - ログイン1回あたりのAPI呼び出し数を約1/168に削減
   - → 実装・本番デプロイ完了
2. **Lark新カスタムアプリ作成**（試行するも失敗）
   - 「アプリ単位でクォータ管理」と想定したが、**実際はテナント単位だった**
   - 新アプリでも同じクォータ超過エラーが発生

### 今回の結論
**Lark Baseをデータベースとして使い続けることは、スケーラビリティの観点で危険**。
恒久的な解決策として、PostgreSQLベースのマネージドDB「Supabase」へ移行します。

---

## 🎯 Supabase移行後のアーキテクチャ

| レイヤー | 変更前 | 変更後 |
|---|---|---|
| フロントエンド | Next.js (Vercel) | **変更なし** |
| ユーザー認証 | Lark Base | **Supabase** |
| チャット履歴 | Lark Base | **Supabase** |
| セッション管理 | Lark Base | **Supabase** |
| ナレッジ検索 | Pinecone + Lark Base | Pinecone + **Supabase** |
| AI応答生成 | Google Gemini | **変更なし** |
| Lark Base | メインDB | **バックアップとして保持** |

### メリット
- ✅ **API呼び出し回数の上限なし**（無料枠で月50,000ユーザー対応可）
- ✅ **レスポンス速度が大幅向上**（PostgreSQLネイティブ）
- ✅ **完全無料で運用可能**（無料枠: DB 500MB / 50k MAU / 5GB転送）
- ✅ **バックアップ・リストア機能を標準搭載**
- ✅ **将来のスケールにも耐える**（有料プランで月数百万ユーザー対応）

### デメリット / 注意点
- ⚠️ **旧データの移行作業が発生**（CSVエクスポート → Supabaseインポート）
- ⚠️ **5月1日のLarkクォータリセットまで、Larkからの新規データ取得は不可**
  - → CSV手動エクスポートで対応

---

## 📋 全体の作業フロー

```
【クライアント作業】
  Phase 1: Lark Base CSVエクスポート（30分）
     ↓
  Phase 2: Supabaseアカウント・プロジェクト作成（15分）
     ↓
  Phase 3: 接続情報の共有（5分）

【開発担当（有村）作業】
  Phase 4: スキーマ作成・データインポート（2時間）
     ↓
  Phase 5: コード書き換え・デプロイ（3時間）
     ↓
  Phase 6: E2Eテスト・復旧連絡（30分）
```

**想定トータル時間**: 6〜7時間（クライアント50分 + 開発5〜6時間）
**想定復旧時期**: 作業開始から1〜2営業日以内

---

# Phase 1: Lark Base CSVエクスポート（クライアント作業）

## 🎯 目的
Larkクォータ超過中でもデータ取得可能な方法として、
Lark Base UIから手動でCSVエクスポートを実施します。
**UI操作はAPIクォータを消費しないため、今すぐ実施可能です。**

## 📍 対象Base
```
https://enopokoman.jp.larksuite.com/base/Ts6jbfV9zan27Fs1s6ojim38ppl
```

## 📝 エクスポート対象テーブル（6つ）

| # | テーブル名 | 用途 | 必須度 |
|---|---|---|---|
| 1 | ユーザー | 認証・プロフィール | 🔴 必須 |
| 2 | チャットログ | 過去の会話履歴 | 🔴 必須 |
| 3 | チャットセッション | セッション一覧 | 🔴 必須 |
| 4 | ナレッジ | ナレッジベース | 🟡 重要 |
| 5 | 設定 | 管理設定 | 🟡 重要 |
| 6 | セッション | 認証セッション | 🟢 任意（再発行可） |

## 🔧 エクスポート手順（全テーブル共通）

1. 上記URLから Lark Base を開く
2. 左サイドバーで対象テーブルを選択
3. テーブル上部の「**…**」（その他メニュー）をクリック
4. 「**エクスポート**」→「**CSVとしてエクスポート**」を選択
5. ダウンロードされたCSVファイルを保存
6. ファイル名を以下の形式にリネーム:
   - `users.csv`
   - `chat_logs.csv`
   - `chat_sessions.csv`
   - `knowledge.csv`
   - `settings.csv`
   - `sessions.csv`

## 📤 エクスポート完了後

6つのCSVファイルを以下の方法で共有:
- **推奨**: Lark Drive にアップロード → フォルダ共有リンクを発行
- **代替**: Lark DMで直接ファイル送付

---

# Phase 2: Supabaseアカウント・プロジェクト作成（クライアント作業）

## 🎯 目的
新しいデータベース環境を、クライアント様ご自身のアカウントで構築します。
**所有権がクライアント様にあることで、将来の運用・料金管理も独立して行えます。**

## 📝 作業手順

### STEP 1: Supabaseアカウント作成

1. 以下のURLにアクセス:
   → https://supabase.com/dashboard

2. 「**Sign Up**」をクリック

3. サインアップ方法を選択（推奨順）:
   - ✅ **GitHub** でサインアップ（最も簡単）
   - Googleアカウント
   - メールアドレス + パスワード

4. 初回ログイン後、組織（Organization）を作成
   - Organization Name: `enopokoman` または任意の名称

---

### STEP 2: 新プロジェクト作成

1. ダッシュボード右上「**New Project**」をクリック

2. 以下を入力:

| 項目 | 入力値 | 備考 |
|---|---|---|
| **Name** | `minienopokoman` | 任意（英数字） |
| **Database Password** | 強力なパスワード（16文字以上推奨） | 🔴 **絶対にメモ** |
| **Region** | `Northeast Asia (Tokyo)` | 🔴 **必須（レスポンス速度に直結）** |
| **Pricing Plan** | `Free` | 無料枠で十分 |

3. 「**Create new project**」をクリック

4. プロジェクト作成完了まで **約2分** 待機

> ⚠️ **Database Password は再表示できません**。必ず安全な場所にメモしてください。
> 忘れた場合は「Settings → Database → Reset Database Password」でリセット可能。

---

### STEP 3: 接続情報の取得

プロジェクト作成完了後、以下の情報を取得します。

#### 🔹 情報1: Project URL と APIキー（2つ）

1. 左サイドバー「**Settings（歯車アイコン）**」→「**API**」を開く
2. 以下をコピー:

```
Project URL:        https://xxxxxxxxxxxx.supabase.co
anon public key:    eyJhbGciOi...（長い文字列・公開用）
service_role key:   eyJhbGciOi...（長い文字列・機密）🔴
```

#### 🔹 情報2: データベース接続文字列

1. 左サイドバー「**Settings**」→「**Database**」を開く
2. 「**Connection string**」セクションで「**URI**」タブを選択
3. 以下をコピー:

```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
```

※ `[YOUR-PASSWORD]` は STEP 2 で設定した Database Password に置き換える

---

# Phase 3: 接続情報の共有（クライアント作業）

## 📤 開発担当（有村）に共有する情報

以下の形式でまとめて、**Lark DMで送付**してください（メール平文は避ける）。

```
【Supabase接続情報】

Project URL:
https://xxxxxxxxxxxx.supabase.co

anon public key:
eyJhbGci...（長いのでそのままコピー）

service_role key:
eyJhbGci...（長いのでそのままコピー）

Database Connection URI:
postgresql://postgres:XXXXXXXX@db.xxxxxxxxxxxx.supabase.co:5432/postgres

※ service_role key と Database Password は機密情報です。
```

## 📤 合わせて共有いただくもの
- Phase 1 でエクスポートした **CSVファイル6本**
  - Lark Drive 共有リンク or DM添付

---

# Phase 4: 開発担当（有村）作業 — 参考情報

> この Phase は開発担当の作業内容です。クライアント様の対応は不要です。
> 透明性のため、実施内容を記載しています。

## 作業内容

### ① Supabase CLI セットアップ（10分）
```bash
npm install -g supabase
supabase login
supabase link --project-ref xxxxxxxxxxxx
```

### ② スキーマ作成（30分）
Lark Baseの構造をPostgreSQL用に最適化:
- `users`（メール・パスワード・プロフィール）
- `chat_logs`（会話ログ、user_id外部キー）
- `chat_sessions`（セッション単位）
- `knowledge`（ナレッジベース）
- `settings`（管理設定）
- `auth_sessions`（認証セッション）

RLS（Row Level Security）を適切に設定し、
APIキーが漏洩しても他ユーザーのデータにアクセスできない構造に。

### ③ データインポート（1時間）
CSVファイル6本をSupabase Table Editorにインポート
- パスワードハッシュはそのまま移植（bcryptなので安全）
- 文字化け対策（UTF-8 BOM除去）
- タイムスタンプ形式の正規化

### ④ コード書き換え（3〜4時間）
- `lib/lark.ts` → `lib/supabase.ts` 新規作成
- 以下のAPIルートを書き換え:
  - `app/api/auth/login`
  - `app/api/auth/register`
  - `app/api/chat`
  - `app/api/chat/history`
  - `app/api/chat/save-log`
  - `app/api/sessions/*`
  - `app/admin/page.tsx`
- Pinecone（ベクトル検索）はそのまま利用

### ⑤ Vercel環境変数の更新（5分）
```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

### ⑥ 本番デプロイ・動作確認（30分）
- `vercel --prod` で本番デプロイ
- ログイン → チャット → 履歴取得 の E2Eテスト
- 管理画面の動作確認

### ⑦ 復旧連絡（5分）
クライアント様にLark DMで復旧完了を連絡

---

# 🗂 データ整合性について

## Lark Baseは削除しない
- エクスポート後も **Lark Base は削除せず、そのまま残します**
- バックアップとして保持
- 5月以降のLarkクォータリセット後も、緊急時のセカンダリバックアップとして活用可能

## Larkへの書き戻しについて
- 今回の移行後、新規データ（チャットログ等）は **Supabaseのみに保存** されます
- Lark Baseへの書き戻しは行いません（パフォーマンス・コストの観点で）
- Lark Baseを別用途（分析・レポート作成）で使いたい場合は別途相談

---

# 💰 コスト試算

## Supabase 無料枠（Free Plan）
| リソース | 上限 | 現状の想定使用量 | 余裕度 |
|---|---|---|---|
| Database容量 | 500 MB | 〜50 MB（168名+会話履歴） | 10倍以上 |
| MAU（月間アクティブ） | 50,000 | 168名 | 300倍 |
| 帯域幅 | 5 GB/月 | 〜500 MB | 10倍 |
| Edge Functions | 500k呼び出し/月 | 〜30k | 16倍 |

**結論**: 当面は **完全無料で運用可能**。
将来1,000名超の規模になっても、有料プラン（$25/月〜）で対応可能。

## Lark Baseとの比較
| 項目 | Lark Base（現状） | Supabase（移行後） |
|---|---|---|
| 月間コスト | 0円（但しクォータあり） | 0円（制限実質なし） |
| API上限 | **月100k呼び出し程度** | **実質無制限** |
| スケーラビリティ | ❌ 168名で限界 | ✅ 数万人規模まで対応 |
| レスポンス速度 | 平均800ms | 平均80ms（約10倍） |

---

# ❓ よくある質問（FAQ）

## Q1. クライアント側で費用発生しますか？
**A.** いいえ、無料で運用可能です。
Supabase無料枠で十分すぎる容量があります（168名の想定で300倍の余裕）。
将来的に大規模化した場合のみ、月額$25〜の有料プランを検討する形です。

## Q2. データ移行中、既存ユーザーのチャット履歴は消えませんか？
**A.** 消えません。Lark BaseのCSVから、Supabaseに全量インポートします。
過去の会話履歴も完全に引き継がれます。

## Q3. Lark Baseは削除していい？
**A.** **削除しないでください**。バックアップとして保持します。
5月以降にLarkクォータがリセットされたら、
Lark Baseを分析・レポート用に活用する選択肢も残ります。

## Q4. 今回の移行で、今後同様の問題が再発しない保証は？
**A.** Supabase無料枠だけで **月50,000ユーザー** まで対応可能なため、
現在の168名規模では実質無制限です。
有料プランに切り替えれば数百万ユーザー規模にも対応できます。

## Q5. 5月1日のLarkクォータリセット後も、Supabase運用を続けますか？
**A.** **はい、Supabase運用を継続**します。
Larkに戻る理由がないほどSupabaseが優位（速度・安定性・コスト）だからです。

## Q6. Supabaseアカウントの所有権はどちら側？
**A.** **クライアント様が所有権を持ちます**。
将来的に開発会社を変更する場合でも、データは完全にクライアント様の資産です。

## Q7. 復旧はいつごろ？
**A.** CSV・接続情報の共有完了後、**1〜2営業日以内** に復旧予定。

## Q8. セキュリティは大丈夫？
**A.** Supabaseは世界中で数十万社が採用しているエンタープライズグレードのDBです。
RLS（Row Level Security）・暗号化通信・自動バックアップを標準搭載しています。

---

# 🆘 サポート

作業中に不明点があれば、Lark DMでお気軽にご連絡ください。
- スクリーンショット画面共有サポートも可能
- CSVエクスポート作業に立ち会いも可能

**対応優先度**: 🔴 緊急（講座運営に直結）

---

# 📎 関連資料
- [旧: 新Larkカスタムアプリ作成手順](https://www.larksuite.com/docx/KL3KdOjRTokJJzxLRcIj8ji6pBf) ※本手順に置き換え
- Supabase公式ドキュメント: https://supabase.com/docs
- プライバシーポリシー: https://supabase.com/privacy

---

**作成者**: 有村大祐（たのパパ）
**バージョン**: 1.0
