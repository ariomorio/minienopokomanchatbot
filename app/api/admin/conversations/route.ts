// Admin Conversations API - Supabase版
// ?session_id=X → そのセッションの chat_logs を timestamp ASC で返す
// なし          → 全 chat_sessions を updated_at DESC で返す
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function env(key: string): string {
    return (process.env[key] || '').trim();
}

function getClient() {
    return createClient(
        env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL'),
        env('SUPABASE_SERVICE_ROLE_KEY'),
        { auth: { persistSession: false, autoRefreshToken: false } }
    );
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const secret = authHeader?.replace('Bearer ', '');
    if (secret !== env('CRON_SECRET')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    try {
        const supabase = getClient();

        if (sessionId) {
            const { data, error } = await supabase
                .from('chat_logs')
                .select('log_id,session_id,user_id,mode,user_input,ai_response,timestamp,evaluation')
                .eq('session_id', sessionId)
                .order('timestamp', { ascending: true });
            if (error) throw new Error(error.message);

            const logs = (data || []).map((r: any) => ({
                log_id: r.log_id,
                session_id: r.session_id,
                user_id: r.user_id,
                mode: r.mode,
                user_input: r.user_input || '',
                ai_response: r.ai_response || '',
                timestamp: r.timestamp,
                evaluation: r.evaluation || null,
            }));
            return NextResponse.json({ success: true, data: logs });
        }

        const { data, error } = await supabase
            .from('chat_sessions')
            .select('session_id,user_id,mode,title,created_at,updated_at')
            .order('updated_at', { ascending: false });
        if (error) throw new Error(error.message);

        const sessions = (data || []).map((r: any) => ({
            session_id: r.session_id,
            user_id: r.user_id,
            mode: r.mode,
            title: r.title || '無題の会話',
            created_at: r.created_at,
            updated_at: r.updated_at,
        }));
        return NextResponse.json({ success: true, data: sessions });
    } catch (error: any) {
        console.error('Conversations API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
