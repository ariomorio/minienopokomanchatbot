// ログアウトAPI - 認証Cookieをクリア
import { getClearCookieHeader } from '@/lib/auth-token';

export async function POST() {
    return new Response(
        JSON.stringify({ success: true }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Set-Cookie': getClearCookieHeader(),
            },
        }
    );
}
