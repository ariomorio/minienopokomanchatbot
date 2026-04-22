// ユーザー登録API
import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createUser, getUserByEmail, sendEmailNotification, getSetting } from '@/lib/supabase';
import { hashPassword, validatePassword } from '@/lib/password';
import { User } from '@/types/lark';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password, name, inviteCode } = body;

        // 招待コード検証（Lark Base優先、フォールバックで環境変数）
        const larkInviteCode = await getSetting('invite_code');
        const validInviteCode = larkInviteCode || (process.env.INVITE_CODE || '').trim();
        if (!validInviteCode || !inviteCode || inviteCode.trim() !== validInviteCode) {
            return Response.json(
                { error: '招待コードが正しくありません' },
                { status: 403 }
            );
        }

        // 入力検証
        if (!name || !name.trim()) {
            return Response.json(
                { error: '名前（フルネーム）は必須です' },
                { status: 400 }
            );
        }

        if (!email || !password) {
            return Response.json(
                { error: 'メールアドレスとパスワードは必須です' },
                { status: 400 }
            );
        }

        // メールアドレス形式チェック
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return Response.json(
                { error: '有効なメールアドレスを入力してください' },
                { status: 400 }
            );
        }

        // パスワード強度チェック
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return Response.json(
                { error: passwordValidation.message },
                { status: 400 }
            );
        }

        // メールアドレスの重複チェック
        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            return Response.json(
                { error: 'このメールアドレスは既に登録されています' },
                { status: 409 }
            );
        }

        // パスワードをハッシュ化
        const hashedPassword = await hashPassword(password);

        // ユーザーを作成（承認待ちステータス）
        const newUser: User = {
            id: uuidv4(),
            email,
            password: hashedPassword,
            name: name.trim(),
            emailVerified: null,
            image: null,
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        await createUser(newUser);

        // Lark通知（非同期、失敗しても登録は成功させる）
        sendEmailNotification(
            `🆕 新規ユーザー登録（承認待ち）: ${newUser.name}`,
            `名前: ${newUser.name}\nメール: ${newUser.email}\n\n管理画面で承認してください。`
        ).catch(() => {});

        // パスワードを除いて返す
        const { password: _, ...userWithoutPassword } = newUser;

        return Response.json({
            success: true,
            user: userWithoutPassword,
            message: '登録が完了しました。管理者の承認後にご利用いただけます。',
        });
    } catch (error: any) {
        console.error('Registration error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data,
        });
        return Response.json(
            {
                error: 'ユーザー登録に失敗しました',
                details: error.message
            },
            { status: 500 }
        );
    }
}
