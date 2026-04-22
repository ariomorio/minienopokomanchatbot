import { NextResponse } from 'next/server';
import { getSetting, updateSetting } from '@/lib/supabase';

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const secret = authHeader?.replace('Bearer ', '');
    if (secret !== (process.env.CRON_SECRET || '').trim()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const inviteCode = await getSetting('invite_code');
        return NextResponse.json({
            success: true,
            settings: { inviteCode: inviteCode || '' },
        });
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
        const { key, value } = await request.json();

        if (key === 'inviteCode') {
            if (!value || !value.trim()) {
                return NextResponse.json({ error: '招待コードを入力してください' }, { status: 400 });
            }
            await updateSetting('invite_code', value.trim());
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Unknown setting key' }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
