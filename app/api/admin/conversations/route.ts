import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/lark';
import axios from 'axios';

const LARK_API_BASE = 'https://open.larksuite.com/open-apis';

function extractText(field: any): string {
    if (!field) return '';
    if (typeof field === 'string') return field;
    if (Array.isArray(field) && field.length > 0) return field[0].text || String(field[0]);
    if (typeof field === 'object') return field.text || String(field);
    return String(field);
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const secret = authHeader?.replace('Bearer ', '');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');

    try {
        const token = await getAccessToken();
        const baseId = (process.env.LARK_BASE_ID || '').trim();

        if (sessionId) {
            const response = await axios.post(
                `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${(process.env.LARK_CHATLOG_TABLE_ID || '').trim()}/records/search`,
                {
                    field_names: ['\u30bb\u30c3\u30b7\u30e7\u30f3ID', '\u30e6\u30fc\u30b6\u30fcID', '\u30e2\u30fc\u30c9', '\u30e6\u30fc\u30b6\u30fc\u5165\u529b', 'AI\u56de\u7b54', '\u65e5\u6642', '\u8a55\u4fa1'],
                    sort: [{ field_name: '\u65e5\u6642', desc: false }],
                },
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
            );

            if (response.data.code !== 0) {
                return NextResponse.json({ error: response.data.msg }, { status: 500 });
            }

            const items = response.data.data?.items || [];
            const logs = items
                .filter((item: any) => extractText(item.fields['\u30bb\u30c3\u30b7\u30e7\u30f3ID']) === sessionId)
                .map((item: any) => ({
                    log_id: item.record_id,
                    session_id: extractText(item.fields['\u30bb\u30c3\u30b7\u30e7\u30f3ID']),
                    user_id: extractText(item.fields['\u30e6\u30fc\u30b6\u30fcID']),
                    mode: extractText(item.fields['\u30e2\u30fc\u30c9']),
                    user_input: extractText(item.fields['\u30e6\u30fc\u30b6\u30fc\u5165\u529b']),
                    ai_response: extractText(item.fields['AI\u56de\u7b54']),
                    timestamp: item.fields['\u65e5\u6642'],
                    evaluation: item.fields['\u8a55\u4fa1'] || null,
                }));

            return NextResponse.json({ success: true, data: logs });
        }

        const response = await axios.post(
            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${(process.env.LARK_CHAT_SESSIONS_TABLE_ID || '').trim()}/records/search`,
            {
                field_names: ['セッションID', 'ユーザーID', 'モード', 'タイトル', '作成日', '更新日'],
                sort: [{ field_name: '更新日', desc: true }],
            },
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );

        if (response.data.code !== 0) {
            return NextResponse.json({ error: response.data.msg }, { status: 500 });
        }

        const sessions = (response.data.data?.items || []).map((item: any) => ({
            session_id: extractText(item.fields['セッションID']),
            user_id: extractText(item.fields['ユーザーID']),
            mode: extractText(item.fields['モード']),
            title: extractText(item.fields['タイトル']) || '\u7121\u984c\u306e\u4f1a\u8a71',
            created_at: item.fields['作成日'],
            updated_at: item.fields['更新日'],
        }));

        return NextResponse.json({ success: true, data: sessions });
    } catch (error: any) {
        console.error('Conversations API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
