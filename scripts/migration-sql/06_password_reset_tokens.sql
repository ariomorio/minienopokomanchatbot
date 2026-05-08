-- Phase 2: ユーザーセルフサービスのパスワードリセット用トークン保存テーブル
--
-- 運用フロー:
--   1. ユーザーが /forgot-password にメール入力
--   2. サーバーが生のトークン (URL用) を生成 → SHA-256 ハッシュを token_hash に保存
--   3. メール本文に「生トークン」を含む URL (/reset-password?token=xxx) を送信
--   4. ユーザーが URL アクセス + 新パスワード入力
--   5. サーバーは生トークンをハッシュ化して token_hash で照合 + expires_at/used_at チェック
--   6. 成功時 used_at を更新 (使い回し防止)
--
-- 注意: トークン本体は DB には保存しない (リーク時影響を最小化)

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  used_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
  ON public.password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
  ON public.password_reset_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
  ON public.password_reset_tokens(expires_at);
