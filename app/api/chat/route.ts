// Chat API Route Handler - ストリーミング応答のみ（ログ保存はクライアント→/api/chat/save-log）
import { NextRequest } from 'next/server';
import { generateResponseStream } from '@/lib/gemini';
import { searchSimilarContext } from '@/lib/vectordb';
import { ChatRequest } from '@/types/chat';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAuthenticatedUser } from '@/lib/auth-token';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        // 認証チェック
        const authUser = getAuthenticatedUser(request);
        if (!authUser) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: {
                        code: 'UNAUTHORIZED',
                        message: '認証が必要です。ログインしてください。',
                    },
                }),
                { status: 401 }
            );
        }

        const body: ChatRequest = await request.json();
        const { message, mode, history } = body;

        // 入力検証
        if (!message || message.length > 2000) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'メッセージは1〜2000文字で入力してください。',
                    },
                }),
                { status: 400 }
            );
        }

        // Vector DBから関連コンテキストを検索
        let context = '';
        try {
            const embeddingModel = genAI.getGenerativeModel({
                model: 'gemini-embedding-001',
            });
            const embeddingResult = await embeddingModel.embedContent({
                content: { role: 'user', parts: [{ text: message }] },
                outputDimensionality: 768,
            } as any);
            const embedding = embeddingResult.embedding.values;
            context = await searchSimilarContext(embedding, 3, 0.7);
        } catch (e) {
            console.error('Embedding Skipped:', e);
        }

        // AI応答をストリーミングで返す（ログ保存なし）
        const stream = await generateResponseStream(message, history, context, mode);
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        });
    } catch (error: any) {
        console.error('Chat API Error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: {
                    code: 'AI_SERVICE_UNAVAILABLE',
                    message: `エラー詳細: ${error.message || 'Unknown error'}`,
                },
            }),
            { status: 500 }
        );
    }
}
