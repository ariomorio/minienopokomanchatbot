// チャット履歴API - セッションIDに紐づくメッセージを取得（認証付き）
import { NextRequest } from 'next/server';
import { getChatLogsBySession } from '@/lib/lark';
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

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            return Response.json(
                { error: 'Session ID is required' },
                { status: 400 }
            );
        }

        // 認証済みユーザーIDでフィルタリング（他人の履歴にはアクセスできない）
        const logs = await getChatLogsBySession(sessionId, authUser.userId);

        return Response.json(logs);
    } catch (error) {
        console.error('Failed to get chat logs:', error);
        return Response.json(
            { error: 'Failed to get chat logs' },
            { status: 500 }
        );
    }
}
