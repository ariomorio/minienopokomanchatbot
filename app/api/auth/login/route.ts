// カスタムログインAPI
import { NextRequest } from 'next/server';
import { getUserByEmail } from '@/lib/supabase';
import { verifyPassword } from '@/lib/password';
import { createAuthToken, getSetCookieHeader } from '@/lib/auth-token';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password } = body;

        // 入力検証
        if (!email || !password) {
            return Response.json(
                { error: 'メールアドレスとパスワードは必須です' },
                { status: 400 }
            );
        }

        // ユーザーを取得
        const user = await getUserByEmail(email);

        if (!user) {
            return Response.json(
                { error: 'メールアドレスまたはパスワードが正しくありません' },
                { status: 401 }
            );
        }

        // パスワードを検証
        if (!user.password) {
            return Response.json(
                { error: 'パスワードが設定されていません' },
                { status: 401 }
            );
        }

        const isValidPassword = await verifyPassword(password, user.password);

        if (!isValidPassword) {
            return Response.json(
                { error: 'メールアドレスまたはパスワードが正しくありません' },
                { status: 401 }
            );
        }

        // 承認ステータスチェック（approved以外はブロック）
        if (user.status !== 'approved') {
            if (user.status === 'rejected') {
                return Response.json(
                    { error: 'このアカウントは利用が許可されていません。' },
                    { status: 403 }
                );
            }
            // pending, 未設定, その他すべて
            return Response.json(
                { error: 'アカウントは現在承認待ちです。管理者の承認をお待ちください。' },
                { status: 403 }
            );
        }

        // 認証トークンを生成
        const token = createAuthToken(user.id, email);

        // ログイン成功 - セッション情報を返す + httpOnly Cookieを設定
        return new Response(
            JSON.stringify({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                },
            }),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Set-Cookie': getSetCookieHeader(token),
                },
            }
        );
    } catch (error: any) {
        console.error('Login error:', error.message);
        return Response.json(
            { error: 'ログインに失敗しました' },
            { status: 500 }
        );
    }
}
