// 一時パスワード(must_change_password)状態のユーザーを /account/password に強制誘導する
// auth_token Cookie の HMAC を Web Crypto で検証し、ペイロードの mustChangePassword を確認する
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SECRET =
    process.env.BETTER_AUTH_SECRET ||
    process.env.CRON_SECRET ||
    'fallback-secret-change-me';

const ALLOWED_PATHS = new Set<string>([
    '/account/password',
    '/login',
    '/logout',
    '/register',
]);

function base64urlToUint8(input: string): Uint8Array {
    const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
    const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function uint8ToBase64url(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifyToken(token: string): Promise<{ mustChangePassword?: boolean; exp?: number } | null> {
    const [payloadStr, signature] = token.split('.');
    if (!payloadStr || !signature) return null;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payloadStr));
    const expected = uint8ToBase64url(sigBuf);
    if (expected !== signature) return null;

    try {
        const json = new TextDecoder().decode(base64urlToUint8(payloadStr));
        const payload = JSON.parse(json);
        if (typeof payload.exp === 'number' && payload.exp < Date.now()) return null;
        return payload;
    } catch {
        return null;
    }
}

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (ALLOWED_PATHS.has(pathname)) return NextResponse.next();

    const cookie = req.cookies.get('auth_token')?.value;
    if (!cookie) return NextResponse.next();

    const payload = await verifyToken(cookie);
    if (!payload?.mustChangePassword) return NextResponse.next();

    const url = req.nextUrl.clone();
    url.pathname = '/account/password';
    url.searchParams.set('required', '1');
    return NextResponse.redirect(url);
}

export const proxyConfig = {
    // page routes only — exclude /api, /_next, static assets
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon-192.png|apple-touch-icon.png|images|.*\\..*).*)'],
};
