// Chat Log Save API - 各ステップの詳細エラーを返すデバッグ版
import { NextRequest } from 'next/server';
import { createChatLog, createChatSession, updateChatSession } from '@/lib/lark';
import { getAuthenticatedUser } from '@/lib/auth-token';

export async function POST(request: NextRequest) {
    const steps: string[] = [];

    try {
        // Step 0: 認証チェック
        const authUser = getAuthenticatedUser(request);
        if (!authUser) {
            return Response.json({ success: false, error: 'UNAUTHORIZED', steps: ['auth: failed'] }, { status: 401 });
        }
        steps.push(`auth: ok (userId=${authUser.userId.substring(0, 8)}...)`);

        const body = await request.json();
        const { sessionId, mode, userMessage, aiResponse } = body;
        const userId = authUser.userId;
        steps.push(`input: sid=${(sessionId || '').substring(0, 8)}... mode=${mode} msgLen=${(userMessage || '').length} resLen=${(aiResponse || '').length}`);

        if (!sessionId || !userMessage || !aiResponse) {
            return Response.json({ success: false, error: 'MISSING_FIELDS', steps }, { status: 400 });
        }

        // Step 1: チャットログを保存
        try {
            await createChatLog({
                session_id: sessionId,
                user_id: userId,
                mode: mode || 'concept',
                user_input: userMessage,
                ai_response: aiResponse,
                timestamp: Date.now(),
            });
            steps.push('createChatLog: ok');
        } catch (e: any) {
            steps.push(`createChatLog: FAILED - ${e.message}`);
            return Response.json({ success: false, error: `Log save failed: ${e.message}`, steps }, { status: 500 });
        }

        // Step 2: セッション情報を更新 or 作成
        try {
            await updateChatSession(sessionId, {
                title: userMessage.substring(0, 50),
            });
            steps.push('updateChatSession: ok');
        } catch (updateErr: any) {
            steps.push(`updateChatSession: failed (${updateErr.message}) - trying create...`);
            try {
                await createChatSession({
                    session_id: sessionId,
                    user_id: userId,
                    mode: mode || 'concept',
                    title: userMessage.substring(0, 50),
                    created_at: Date.now(),
                    updated_at: Date.now(),
                });
                steps.push('createChatSession: ok');
            } catch (createErr: any) {
                steps.push(`createChatSession: FAILED - ${createErr.message}`);
                // セッション作成失敗でもチャットログは保存済みなのでsuccessにする
            }
        }

        return Response.json({ success: true, steps });
    } catch (error: any) {
        steps.push(`unexpected: ${error.message}`);
        return Response.json(
            { success: false, error: error.message || 'Unknown error', steps },
            { status: 500 }
        );
    }
}
