-- 一時パスワードでログインしたユーザーに、初回ログイン時のパスワード変更を強制する仕組み。
-- 管理者がパスワードリセットすると true がセットされ、本人がパスワードを変更すると false に戻る。

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
