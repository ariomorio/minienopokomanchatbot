// Admin Status API - Knowledge_Source テーブルの同期状態を取得
import { NextRequest } from 'next/server';
import { getAccessToken } from '@/lib/lark';
import axios from 'axios';

const LARK_API_BASE = 'https://open.larksuite.com/open-apis';

export async function GET(request: NextRequest) {
    try {
        // 認証チェック
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return new Response(
                JSON.stringify({ success: false, error: 'Unauthorized' }),
                { status: 401 }
            );
        }

        const token = await getAccessToken();
        const baseId = (process.env.LARK_BASE_ID || '').trim();
        const tableId = (process.env.LARK_KNOWLEDGE_TABLE_ID || '').trim();

        // 全レコードを取得してステータスを集計
        const response = await axios.post(
            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
            {
                field_names: [
                    'タイトル',
                    'ソース種別',
                    '同期ステータス',
                    'ソースファイル',
                    '最終同期日時',
                ],
                automatic_fields: true,
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data.code !== 0) {
            throw new Error(`Lark API Error: ${response.data.msg}`);
        }

        const items = response.data.data?.items || [];

        // 集計
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
            const syncStatus = item.fields['同期ステータス'];
            if (syncStatus === 'synced') stats.synced++;
            else if (syncStatus === 'pending') stats.pending++;
            else if (syncStatus === 'error') stats.error++;
            else stats.no_status++;

            const sourceType = item.fields['ソース種別'] || 'unknown';
            stats.by_source_type[sourceType] =
                (stats.by_source_type[sourceType] || 0) + 1;

            const sourceFile = item.fields['ソースファイル'];
            if (sourceFile) {
                stats.by_source_file[sourceFile] =
                    (stats.by_source_file[sourceFile] || 0) + 1;
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                data: stats,
            }),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Status API Error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Status check failed',
            }),
            { status: 500 }
        );
    }
}
