import { NextResponse } from 'next/server';
import { getAllUsers, updateUser, sendEmailNotification } from '@/lib/supabase';
import { hashPassword, generateTemporaryPassword } from '@/lib/password';

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const secret = authHeader?.replace('Bearer ', '');
    if (secret !== (process.env.CRON_SECRET || '').trim()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const users = await getAllUsers();
        const target = users.find((u) => u.id === userId);
        if (!target) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const temporaryPassword = generateTemporaryPassword(10);
        const hashed = await hashPassword(temporaryPassword);
        await updateUser(userId, { password: hashed, mustChangePassword: true });

        sendEmailNotification(
            `🔑 パスワードリセット: ${target.name || target.email}`,
            `管理者がユーザー「${target.name || target.email}」のパスワードをリセットしました。\nメール: ${target.email}`
        ).catch(() => {});

        return NextResponse.json({
            success: true,
            email: target.email,
            name: target.name || null,
            temporaryPassword,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
