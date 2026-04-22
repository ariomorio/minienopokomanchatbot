// Admin Dashboard API - Supabase版
// users / chat_sessions / chat_logs を集計してダッシュボードに返す
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

    try {
        const supabase = getClient();

        const [usersRes, sessionsRes, logsRes] = await Promise.all([
            supabase.from('users').select('id,name,email,created_at'),
            supabase.from('chat_sessions').select('session_id,user_id,mode,title,updated_at'),
            supabase.from('chat_logs').select('user_id,timestamp'),
        ]);

        if (usersRes.error) throw new Error(`users: ${usersRes.error.message}`);
        if (sessionsRes.error) throw new Error(`chat_sessions: ${sessionsRes.error.message}`);
        if (logsRes.error) throw new Error(`chat_logs: ${logsRes.error.message}`);

        const users = usersRes.data || [];
        const sessions = sessionsRes.data || [];
        const logs = logsRes.data || [];

        const sessionsByUser: Record<string, number> = {};
        const modesByUser: Record<string, Set<string>> = {};
        for (const s of sessions) {
            sessionsByUser[s.user_id] = (sessionsByUser[s.user_id] || 0) + 1;
            if (!modesByUser[s.user_id]) modesByUser[s.user_id] = new Set();
            if (s.mode) modesByUser[s.user_id].add(s.mode);
        }

        const messagesByUser: Record<string, number> = {};
        const lastActiveByUser: Record<string, number> = {};
        for (const l of logs) {
            messagesByUser[l.user_id] = (messagesByUser[l.user_id] || 0) + 1;
            if (l.timestamp && (!lastActiveByUser[l.user_id] || l.timestamp > lastActiveByUser[l.user_id])) {
                lastActiveByUser[l.user_id] = l.timestamp;
            }
        }

        const userStats = users.map((u: any) => ({
            id: u.id,
            name: u.name || '',
            email: u.email,
            createdAt: u.created_at,
            sessionCount: sessionsByUser[u.id] || 0,
            messageCount: messagesByUser[u.id] || 0,
            modes: modesByUser[u.id] ? Array.from(modesByUser[u.id]) : [],
            lastActive: lastActiveByUser[u.id] || null,
        }));

        const recentSessions = [...sessions]
            .sort((a: any, b: any) => (b.updated_at || 0) - (a.updated_at || 0))
            .slice(0, 20)
            .map((s: any) => ({
                session_id: s.session_id,
                user_id: s.user_id,
                mode: s.mode,
                title: s.title || '無題の会話',
                updated_at: s.updated_at,
            }));

        return NextResponse.json({
            success: true,
            data: {
                totalUsers: users.length,
                totalSessions: sessions.length,
                totalMessages: logs.length,
                users: userStats,
                recentSessions,
            },
        });
    } catch (error: any) {
        console.error('Dashboard API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
