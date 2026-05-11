// ログイン中ユーザーのパスワード変更API
import { NextRequest } from 'next/server';
import { getUserById, updateUser } from '@/lib/supabase';
import { hashPassword, verifyPassword, validatePassword } from '@/lib/password';
import { getAuthenticatedUser } from '@/lib/auth-token';

export async function POST(req: NextRequest) {
    try {
        const auth = await getAuthenticatedUser(req);
        if (!auth) {
            return Response.json(
                { error: 'ログインが必要です' },
                { status: 401 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const { currentPassword, newPassword } = body || {};

        if (!currentPassword || !newPassword) {
            return Response.json(
                { error: '現在のパスワードと新しいパスワードを入力してください' },
                { status: 400 }
            );
        }

        const user = await getUserById(auth.userId);
        if (!user || !user.password) {
            return Response.json(
                { error: 'ユーザーが見つかりません' },
                { status: 404 }
            );
        }

        const isCurrentValid = await verifyPassword(currentPassword, user.password);
        if (!isCurrentValid) {
            return Response.json(
                { error: '現在のパスワードが正しくありません' },
                { status: 401 }
            );
        }

        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            return Response.json(
                { error: validation.message || 'パスワードの形式が正しくありません' },
                { status: 400 }
            );
        }

        if (currentPassword === newPassword) {
            return Response.json(
                { error: '新しいパスワードは現在のパスワードと異なる必要があります' },
                { status: 400 }
            );
        }

        const hashed = await hashPassword(newPassword);
        await updateUser(auth.userId, { password: hashed });

        return Response.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Change password error:', message);
        return Response.json(
            { error: 'パスワードの変更に失敗しました' },
            { status: 500 }
        );
    }
}
