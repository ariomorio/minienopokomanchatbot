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

async function fetchAllRecords(token: string, tableId: string) {
    const baseId = (process.env.LARK_BASE_ID || '').trim();
    let allItems: any[] = [];
    let pageToken: string | undefined;

    do {
        const body: any = { automatic_fields: true };
        if (pageToken) body.page_token = pageToken;

        const response = await axios.post(
            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
            body,
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );

        if (response.data.code !== 0) break;
        allItems = allItems.concat(response.data.data?.items || []);
        pageToken = response.data.data?.page_token;
    } while (pageToken);

    return allItems;
}

export async function GET(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const secret = authHeader?.replace('Bearer ', '');
    if (secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const token = await getAccessToken();

        const [users, sessions, chatLogs] = await Promise.all([
            fetchAllRecords(token, (process.env.LARK_USERS_TABLE_ID || '').trim()),
            fetchAllRecords(token, (process.env.LARK_CHAT_SESSIONS_TABLE_ID || '').trim()),
            fetchAllRecords(token, (process.env.LARK_CHATLOG_TABLE_ID || '').trim()),
        ]);

        const userList = users.map((item: any) => ({
            id: extractText(item.fields['ユーザーID']),
            name: extractText(item.fields['名前']),
            email: extractText(item.fields['メールアドレス']),
            createdAt: item.fields['作成日'],
        }));

        const sessionsByUser: Record<string, number> = {};
        const modesByUser: Record<string, Set<string>> = {};
        sessions.forEach((item: any) => {
            const uid = extractText(item.fields['ユーザーID']);
            sessionsByUser[uid] = (sessionsByUser[uid] || 0) + 1;
            if (!modesByUser[uid]) modesByUser[uid] = new Set();
            modesByUser[uid].add(extractText(item.fields['モード']));
        });

        const messagesByUser: Record<string, number> = {};
        const lastActiveByUser: Record<string, number> = {};
        chatLogs.forEach((item: any) => {
            const uid = extractText(item.fields['\u30e6\u30fc\u30b6\u30fcID']);
            messagesByUser[uid] = (messagesByUser[uid] || 0) + 1;
            const ts = item.fields['\u65e5\u6642'];
            if (ts && (!lastActiveByUser[uid] || ts > lastActiveByUser[uid])) {
                lastActiveByUser[uid] = ts;
            }
        });

        const userStats = userList.map((u: any) => ({
            ...u,
            sessionCount: sessionsByUser[u.id] || 0,
            messageCount: messagesByUser[u.id] || 0,
            modes: modesByUser[u.id] ? Array.from(modesByUser[u.id]) : [],
            lastActive: lastActiveByUser[u.id] || null,
        }));

        const recentSessions = sessions
            .map((item: any) => ({
                session_id: extractText(item.fields['セッションID']),
                user_id: extractText(item.fields['ユーザーID']),
                mode: extractText(item.fields['モード']),
                title: extractText(item.fields['タイトル']) || '\u7121\u984c\u306e\u4f1a\u8a71',
                updated_at: item.fields['更新日'],
            }))
            .sort((a: any, b: any) => (b.updated_at || 0) - (a.updated_at || 0))
            .slice(0, 20);

        return NextResponse.json({
            success: true,
            data: {
                totalUsers: userList.length,
                totalSessions: sessions.length,
                totalMessages: chatLogs.length,
                users: userStats,
                recentSessions,
            },
        });
    } catch (error: any) {
        console.error('Dashboard API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
