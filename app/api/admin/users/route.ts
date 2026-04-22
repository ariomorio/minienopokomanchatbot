import { NextResponse } from 'next/server';
import { getAllUsers, updateUserStatus, sendEmailNotification } from '@/lib/supabase';

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const secret = authHeader?.replace('Bearer ', '');
    if (secret !== (process.env.CRON_SECRET || '').trim()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const users = await getAllUsers();
        return NextResponse.json({ success: true, users });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const secret = authHeader?.replace('Bearer ', '');
    if (secret !== (process.env.CRON_SECRET || '').trim()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { userId, status, userName } = await request.json();

        if (!userId || !['approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        await updateUserStatus(userId, status);

        // 承認/拒否の通知
        const action = status === 'approved' ? '承認' : '拒否';
        sendEmailNotification(
            `✅ ユーザー${action}: ${userName || userId}`,
            `ユーザー「${userName || userId}」を${action}しました。`
        ).catch(() => {});

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
