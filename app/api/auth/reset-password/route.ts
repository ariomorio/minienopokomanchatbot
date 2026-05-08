// パスワードリセット実行API (request-password-reset で発行されたトークンを消費)
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import {
    getPasswordResetTokenByHash,
    markPasswordResetTokenUsed,
    getUserById,
    updateUser,
} from '@/lib/supabase';
import { hashPassword, validatePassword } from '@/lib/password';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { token, newPassword } = body || {};

        if (!token || typeof token !== 'string') {
            return Response.json(
                { error: 'リセットリンクが正しくありません' },
                { status: 400 }
            );
        }
        if (!newPassword || typeof newPassword !== 'string') {
            return Response.json(
                { error: '新しいパスワードを入力してください' },
                { status: 400 }
            );
        }

        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            return Response.json(
                { error: validation.message || 'パスワードの形式が正しくありません' },
                { status: 400 }
            );
        }

        const tokenHash = createHash('sha256').update(token).digest('hex');
        const record = await getPasswordResetTokenByHash(tokenHash);

        if (!record) {
            return Response.json(
                { error: 'リセットリンクが無効です。再度パスワードリセットを申請してください。' },
                { status: 400 }
            );
        }
        if (record.used_at) {
            return Response.json(
                { error: 'このリセットリンクは既に使用済みです。' },
                { status: 400 }
            );
        }
        if (record.expires_at < Date.now()) {
            return Response.json(
                { error: 'リセットリンクの有効期限が切れています。再度パスワードリセットを申請してください。' },
                { status: 400 }
            );
        }

        const user = await getUserById(record.user_id);
        if (!user) {
            return Response.json(
                { error: 'ユーザーが見つかりません' },
                { status: 404 }
            );
        }
        if (user.status !== 'approved') {
            return Response.json(
                { error: 'このアカウントは現在ご利用いただけません。管理者にお問い合わせください。' },
                { status: 403 }
            );
        }

        const hashed = await hashPassword(newPassword);
        await updateUser(user.id, { password: hashed });
        await markPasswordResetTokenUsed(record.id);

        return Response.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('reset-password error:', message);
        return Response.json(
            { error: 'パスワードのリセットに失敗しました' },
            { status: 500 }
        );
    }
}
