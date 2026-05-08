// パスワードリセット申請API (ログイン前ユーザー向け)
// セキュリティ: 該当アドレスが存在しない場合も成功レスポンスを返す (アカウント列挙対策)
import { NextRequest } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import {
    getUserByEmail,
    createPasswordResetToken,
    invalidateUserResetTokens,
    sendUserEmail,
    sendEmailNotification,
} from '@/lib/supabase';

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1時間

function getOrigin(req: NextRequest): string {
    const fromEnv = (process.env.BETTER_AUTH_URL || '').trim();
    if (fromEnv) return fromEnv.replace(/\/$/, '');
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { email } = body || {};

        if (!email || typeof email !== 'string') {
            return Response.json(
                { error: 'メールアドレスを入力してください' },
                { status: 400 }
            );
        }

        // ユーザーが存在しなくても成功扱い (アカウント存在の列挙防止)
        const user = await getUserByEmail(email);
        const successResponse = Response.json({ success: true });

        if (!user || !user.id) {
            return successResponse;
        }
        // 未承認/拒否済みも sketchy だが、メールリーク回避のため成功扱い
        if (user.status !== 'approved') {
            return successResponse;
        }

        // 同一ユーザーの旧未使用トークンを無効化
        await invalidateUserResetTokens(user.id);

        // 生トークン (URL用) と DB保存用ハッシュ
        const rawToken = randomBytes(32).toString('hex');
        const tokenHash = createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = Date.now() + TOKEN_TTL_MS;

        await createPasswordResetToken(user.id, tokenHash, expiresAt);

        const origin = getOrigin(req);
        const resetUrl = `${origin}/reset-password?token=${rawToken}`;

        const subject = '【ミニえのぽこまん】パスワード再設定のご案内';
        const text = [
            `${user.name || 'ユーザー'} 様`,
            '',
            'パスワード再設定のリクエストを受け付けました。',
            '以下のリンクから1時間以内に新しいパスワードを設定してください。',
            '',
            resetUrl,
            '',
            '※このリクエストに心当たりがない場合は、このメールを破棄してください。',
            '※このリンクは1回のみ使用可能で、1時間後に無効になります。',
            '',
            '— ミニえのぽこまん',
        ].join('\n');
        const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1a1a1a;">
  <p>${user.name || 'ユーザー'} 様</p>
  <p>パスワード再設定のリクエストを受け付けました。<br/>下のボタンから <strong>1時間以内</strong>に新しいパスワードを設定してください。</p>
  <p style="margin: 24px 0;">
    <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">パスワードを再設定する</a>
  </p>
  <p style="font-size: 13px; color: #555;">ボタンが開かない場合は以下のURLをコピーしてブラウザで開いてください:<br/><code style="word-break:break-all;">${resetUrl}</code></p>
  <hr style="border:none;border-top:1px solid #ddd;margin:24px 0;"/>
  <p style="font-size: 12px; color: #777;">
    ※このリクエストに心当たりがない場合は、このメールを破棄してください。<br/>
    ※このリンクは1回のみ使用可能で、1時間後に無効になります。
  </p>
  <p style="font-size: 12px; color: #777;">— ミニえのぽこまん</p>
</div>`.trim();

        try {
            await sendUserEmail(user.email, subject, html, text);
        } catch (mailErr) {
            // メール送信失敗時もユーザーには成功扱い (内部ログのみ)
            const m = mailErr instanceof Error ? mailErr.message : String(mailErr);
            console.error('Password reset email failed:', m);
        }

        // 管理者通知 (招待コード発行と同じ NOTIFY_EMAIL = fineo.backoffice@gmail.com 宛)
        try {
            await sendEmailNotification(
                '【ミニえのぽこまん】パスワードリセット申請',
                [
                    'パスワードリセットの申請がありました。',
                    '',
                    `ユーザー名: ${user.name || '(未設定)'}`,
                    `メール: ${user.email}`,
                    `申請日時: ${new Date().toISOString()}`,
                    '',
                    '※リセットリンクはユーザー本人にのみ送付されています (1時間有効・1回のみ)。',
                ].join('\n')
            );
        } catch (notifyErr) {
            const m = notifyErr instanceof Error ? notifyErr.message : String(notifyErr);
            console.error('Admin notification failed:', m);
        }

        return successResponse;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('request-password-reset error:', message);
        // 内部エラーも 200 success を返す (列挙防止)
        return Response.json({ success: true });
    }
}
