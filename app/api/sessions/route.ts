// チャットセッション一覧取得API（認証付き）
import { NextRequest } from 'next/server';
import { getChatSessions } from '@/lib/lark';
import { getAuthenticatedUser } from '@/lib/auth-token';

export async function GET(request: NextRequest) {
    try {
        // 認証チェック
        const authUser = getAuthenticatedUser(request);
        if (!authUser) {
            return Response.json(
                { error: '認証が必要です' },
                { status: 401 }
            );
        }

        // 認証済みユーザーIDを使用（クエリパラメータのuserIdは無視）
        const userId = authUser.userId;
        const { searchParams } = new URL(request.url);
        const mode = searchParams.get('mode') || undefined;

        const sessions = await getChatSessions(userId, mode);

        return Response.json(sessions);
    } catch (error) {
        console.error('Failed to get chat sessions:', error);
        return Response.json(
            { error: 'Failed to get chat sessions' },
            { status: 500 }
        );
    }
}
