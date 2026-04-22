// Admin Status API - Supabase版
// knowledge_sources の同期状態を集計。
// Supabase の select は暗黙の 1000 行上限があるため、
// 行取得ではなく count クエリを組み合わせて正確な総数を出す。
import { NextRequest } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

async function countAll(supabase: SupabaseClient): Promise<number> {
    const { count, error } = await supabase
        .from('knowledge_sources')
        .select('*', { count: 'exact', head: true });
    if (error) throw new Error(error.message);
    return count ?? 0;
}

async function countBySyncStatus(
    supabase: SupabaseClient,
    status: string | null
): Promise<number> {
    let q = supabase.from('knowledge_sources').select('*', { count: 'exact', head: true });
    q = status === null ? q.is('sync_status', null) : q.eq('sync_status', status);
    const { count, error } = await q;
    if (error) throw new Error(error.message);
    return count ?? 0;
}

// グルーピング集計は range ページングで全件走査（1000 行ずつ）
async function groupCounts(
    supabase: SupabaseClient
): Promise<{
    by_source_type: Record<string, number>;
    by_source_file: Record<string, number>;
}> {
    const by_source_type: Record<string, number> = {};
    const by_source_file: Record<string, number> = {};
    const pageSize = 1000;
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('knowledge_sources')
            .select('source_type,source_file')
            .range(from, from + pageSize - 1);
        if (error) throw new Error(error.message);
        const rows = data || [];
        for (const r of rows) {
            const st = (r as any).source_type || 'unknown';
            by_source_type[st] = (by_source_type[st] || 0) + 1;
            const sf = (r as any).source_file;
            if (sf) by_source_file[sf] = (by_source_file[sf] || 0) + 1;
        }
        if (rows.length < pageSize) break;
        from += pageSize;
    }
    return { by_source_type, by_source_file };
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
        const [total, synced, pending, errorCount, noStatus, groups] = await Promise.all([
            countAll(supabase),
            countBySyncStatus(supabase, 'synced'),
            countBySyncStatus(supabase, 'pending'),
            countBySyncStatus(supabase, 'error'),
            countBySyncStatus(supabase, null),
            groupCounts(supabase),
        ]);

        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    total,
                    synced,
                    pending,
                    error: errorCount,
                    no_status: noStatus,
                    by_source_type: groups.by_source_type,
                    by_source_file: groups.by_source_file,
                },
            }),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Status API Error:', error);
        return new Response(
            JSON.stringify({ success: false, error: error.message || 'Status check failed' }),
            { status: 500 }
        );
    }
}
