// Temporary test endpoint - detailed debugging of chat log save path
import { NextRequest } from 'next/server';
import { createChatLog, createChatSession, getAccessToken } from '@/lib/supabase';
import axios from 'axios';

const LARK_API_BASE = 'https://open.larksuite.com/open-apis';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    const secret = authHeader?.replace('Bearer ', '');
    if (secret !== (process.env.CRON_SECRET || '').trim()) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const results: string[] = [];

    try {
        // Test 1: Create a chat log
        results.push('Step 1: Creating chat log...');
        await createChatLog({
            session_id: 'test-session-verify',
            user_id: 'test-user-verify',
            mode: 'concept',
            user_input: 'テスト入力（検証用）',
            ai_response: 'テスト回答（検証用）',
            timestamp: Date.now(),
        });
        results.push('Step 1: OK');
    } catch (e: any) {
        results.push(`Step 1: FAILED - ${e.message}`);
        if (e.response?.data) results.push(`  Detail: ${JSON.stringify(e.response.data)}`);
    }

    try {
        // Test 2: Create session
        results.push('Step 2: Creating session...');
        await createChatSession({
            session_id: 'test-session-verify',
            user_id: 'test-user-verify',
            mode: 'concept',
            title: 'テスト（検証用）',
            created_at: Date.now(),
            updated_at: Date.now(),
        });
        results.push('Step 2: OK');
    } catch (e: any) {
        results.push(`Step 2: FAILED - ${e.message}`);
        if (e.response?.data) results.push(`  Detail: ${JSON.stringify(e.response.data)}`);
    }

    try {
        // Test 3: Manually debug updateChatSession
        results.push('Step 3: Debugging updateChatSession...');
        const token = await getAccessToken();
        const baseId = (process.env.LARK_BASE_ID || '').trim();
        const tableId = (process.env.LARK_CHAT_SESSIONS_TABLE_ID || '').trim();
        results.push(`  baseId=${baseId}, tableId=${tableId}`);

        // Search
        const searchResponse = await axios.post(
            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
            { field_names: ['セッションID'] },
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        results.push(`  Search code=${searchResponse.data.code}, total=${searchResponse.data.data?.total}`);

        const items = searchResponse.data.data?.items || [];
        results.push(`  Items returned: ${items.length}`);

        // Show first 3 items raw field values
        for (let i = 0; i < Math.min(3, items.length); i++) {
            const field = items[i].fields['セッションID'];
            results.push(`  Item[${i}]: type=${typeof field}, isArray=${Array.isArray(field)}, raw=${JSON.stringify(field).substring(0, 100)}`);
        }

        // Try to find the test session
        const matchedItem = items.find((item: any) => {
            const field = item.fields['セッションID'];
            const value = Array.isArray(field) && field.length > 0 ? field[0].text : field;
            return value === 'test-session-verify';
        });

        if (matchedItem) {
            results.push(`  Found: record_id=${matchedItem.record_id}`);

            // Try to update
            try {
                await axios.put(
                    `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/${matchedItem.record_id}`,
                    { fields: { 'タイトル': 'テスト（更新済み）' } },
                    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
                );
                results.push('  Update: OK');
            } catch (e: any) {
                results.push(`  Update FAILED: ${e.message}`);
                if (e.response?.data) results.push(`  Detail: ${JSON.stringify(e.response.data)}`);
            }
        } else {
            results.push('  NOT FOUND among search results');
            // Check if it's a pagination issue
            const hasMore = searchResponse.data.data?.has_more;
            const pageToken = searchResponse.data.data?.page_token;
            results.push(`  has_more=${hasMore}, page_token=${pageToken ? 'yes' : 'no'}`);
        }
    } catch (e: any) {
        results.push(`Step 3: ERROR - ${e.message}`);
    }

    // Cleanup: Delete test records
    try {
        const token = await getAccessToken();
        const baseId = (process.env.LARK_BASE_ID || '').trim();

        // Delete test session records
        const sessResp = await axios.post(
            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${(process.env.LARK_CHAT_SESSIONS_TABLE_ID || '').trim()}/records/search`,
            { field_names: ['セッションID'] },
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        for (const item of (sessResp.data.data?.items || [])) {
            const field = item.fields['セッションID'];
            const value = Array.isArray(field) ? field[0]?.text : field;
            if (value === 'test-session-verify') {
                await axios.delete(
                    `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${(process.env.LARK_CHAT_SESSIONS_TABLE_ID || '').trim()}/records/${item.record_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
        }

        // Delete test chatlog records
        const logResp = await axios.post(
            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${(process.env.LARK_CHATLOG_TABLE_ID || '').trim()}/records/search`,
            { field_names: ['セッションID'] },
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        for (const item of (logResp.data.data?.items || [])) {
            const field = item.fields['セッションID'];
            const value = Array.isArray(field) ? field[0]?.text : field;
            if (value === 'test-session-verify') {
                await axios.delete(
                    `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${(process.env.LARK_CHATLOG_TABLE_ID || '').trim()}/records/${item.record_id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
        }
        results.push('Cleanup: OK');
    } catch (e: any) {
        results.push(`Cleanup: ${e.message}`);
    }

    return new Response(JSON.stringify({ success: true, results }, null, 2), {
        headers: { 'Content-Type': 'application/json' },
    });
}
