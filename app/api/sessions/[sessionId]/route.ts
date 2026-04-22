// セッション詳細API - 特定セッションのメッセージ履歴を取得（認証付き）
import { getChatLogsBySession } from "@/lib/supabase";
import { getAuthenticatedUser } from "@/lib/auth-token";
import { NextRequest } from "next/server";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    // 認証チェック
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
        return new Response(
            JSON.stringify({ error: '認証が必要です' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        const { sessionId } = await params;
        // 認証済みユーザーのログのみ返す
        const chatLogs = await getChatLogsBySession(sessionId, authUser.userId);
        return Response.json(chatLogs);
    } catch (error) {
        console.error('Error fetching chat logs:', error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
