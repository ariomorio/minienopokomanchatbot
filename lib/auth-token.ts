// サーバーサイド認証トークンユーティリティ
// httpOnly Cookie に署名付きトークンを保存し、APIルートで検証する
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';

const SECRET = process.env.BETTER_AUTH_SECRET || process.env.CRON_SECRET || 'fallback-secret-change-me';
const TOKEN_COOKIE_NAME = 'auth_token';
const TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7日間（秒）

interface TokenPayload {
    userId: string;
    email: string;
    exp: number;
}

/**
 * トークンを生成（HMAC署名付き）
 */
export function createAuthToken(userId: string, email: string): string {
    const payload: TokenPayload = {
        userId,
        email,
        exp: Date.now() + TOKEN_MAX_AGE * 1000,
    };
    const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', SECRET).update(payloadStr).digest('base64url');
    return `${payloadStr}.${signature}`;
}

/**
 * トークンを検証してペイロードを返す
 */
export function verifyAuthToken(token: string): TokenPayload | null {
    try {
        const [payloadStr, signature] = token.split('.');
        if (!payloadStr || !signature) return null;

        // 署名検証
        const expectedSig = createHmac('sha256', SECRET).update(payloadStr).digest('base64url');
        if (signature !== expectedSig) return null;

        // ペイロードをデコード
        const payload: TokenPayload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString());

        // 有効期限チェック
        if (payload.exp < Date.now()) return null;

        return payload;
    } catch {
        return null;
    }
}

/**
 * Set-Cookie ヘッダー文字列を生成
 */
export function getSetCookieHeader(token: string): string {
    return `${TOKEN_COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${TOKEN_MAX_AGE}; SameSite=Lax; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}`;
}

/**
 * Cookie削除用のSet-Cookieヘッダー文字列
 */
export function getClearCookieHeader(): string {
    return `${TOKEN_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax;`;
}

/**
 * リクエストから認証済みユーザーIDを取得
 * トークン検証のみ（DB確認なし）— 内部用
 */
export function getAuthenticatedUserFromToken(request: NextRequest): TokenPayload | null {
    const cookie = request.cookies.get(TOKEN_COOKIE_NAME);
    if (!cookie?.value) return null;
    return verifyAuthToken(cookie.value);
}

/**
 * リクエストから認証済み＋承認済みユーザーを取得
 * トークン検証 + DBのstatus確認
 * 認証されていない or 未承認の場合は null を返す
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<TokenPayload | null> {
    const tokenPayload = getAuthenticatedUserFromToken(request);
    if (!tokenPayload) return null;

    // DBからユーザーのstatusを確認
    const { getUserById } = await import('@/lib/supabase');
    const user = await getUserById(tokenPayload.userId);
    if (!user || user.status !== 'approved') {
        return null;
    }

    return tokenPayload;
}
