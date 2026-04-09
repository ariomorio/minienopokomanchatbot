// ユーザー登録API
import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createUser, getUserByEmail } from '@/lib/lark';
import { hashPassword, validatePassword } from '@/lib/password';
import { User } from '@/types/lark';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password, name } = body;

        // 入力検証
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

        // ユーザーを作成
        const newUser: User = {
            id: uuidv4(),
            email,
            password: hashedPassword,
            name: name || null,
            emailVerified: null,
            image: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        await createUser(newUser);

        // パスワードを除いて返す
        const { password: _, ...userWithoutPassword } = newUser;

        return Response.json({
            success: true,
            user: userWithoutPassword,
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
