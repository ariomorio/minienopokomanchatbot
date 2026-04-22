// Admin Status API - Supabase版
// knowledge_sources の同期状態を集計
import { NextRequest } from 'next/server';
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

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        const cronSecret = env('CRON_SECRET');
        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return new Response(
                JSON.stringify({ success: false, error: 'Unauthorized' }),
                { status: 401 }
            );
        }

        const supabase = getClient();
        const { data, error } = await supabase
            .from('knowledge_sources')
            .select('title,source_type,sync_status,source_file,last_synced_at');
        if (error) throw new Error(error.message);

        const items = data || [];
        const stats = {
            total: items.length,
            synced: 0,
            pending: 0,
            error: 0,
            no_status: 0,
            by_source_type: {} as Record<string, number>,
            by_source_file: {} as Record<string, number>,
        };

        for (const item of items) {
            const syncStatus = item.sync_status;
            if (syncStatus === 'synced') stats.synced++;
            else if (syncStatus === 'pending') stats.pending++;
            else if (syncStatus === 'error') stats.error++;
            else stats.no_status++;

            const sourceType = item.source_type || 'unknown';
            stats.by_source_type[sourceType] = (stats.by_source_type[sourceType] || 0) + 1;

            const sourceFile = item.source_file;
            if (sourceFile) {
                stats.by_source_file[sourceFile] = (stats.by_source_file[sourceFile] || 0) + 1;
            }
        }

        return new Response(JSON.stringify({ success: true, data: stats }), { status: 200 });
    } catch (error: any) {
        console.error('Status API Error:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message || 'Status check failed' }),
            { status: 500 }
        );
    }
}
