// Sync API Route Handler - Supabase ↔ Pinecone 差分同期
import { NextRequest } from 'next/server';
import {
    fetchPendingKnowledgeRecords,
    updateKnowledgeRecord,
} from '@/lib/supabase';
import { upsertVectors } from '@/lib/vectordb';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 300;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const EMBEDDING_MODEL = 'gemini-embedding-001';

/** Gemini Embedding (768次元固定) */
async function embed768(model: any, text: string): Promise<number[]> {
    const result = await model.embedContent({
        content: { role: 'user', parts: [{ text }] },
        outputDimensionality: 768,
    } as any);
    return result.embedding.values;
}

export async function POST(request: NextRequest) {
    try {
        // Cron Secretによる認証
        const authHeader = request.headers.get('authorization');
        const cronSecret = (process.env.CRON_SECRET || '').trim();

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Unauthorized' },
                }),
                { status: 401 }
            );
        }

        // ?limit=N で1リクエストあたりの処理件数を制限（デフォ 100）
        const { searchParams } = new URL(request.url);
        const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit')) || 100));

        // sync_status が pending または未設定のレコードのみ取得（差分同期）
        const allPending = await fetchPendingKnowledgeRecords();
        const pendingRecords = allPending.slice(0, limit);

        if (pendingRecords.length === 0) {
            return new Response(
                JSON.stringify({
                    success: true,
                    data: {
                        synced: 0,
                        skipped: 0,
                        errors: 0,
                        message: 'No pending records to sync',
                        timestamp: new Date().toISOString(),
                    },
                }),
                { status: 200 }
            );
        }

        const embeddingModel = genAI.getGenerativeModel({
            model: EMBEDDING_MODEL,
        });

        let syncedCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        // 各レコードを順次処理（Rate limit対策）
        for (const record of pendingRecords) {
            try {
                // コンテンツが空の場合はスキップ
                if (!record.content || record.content.trim().length === 0) {
                    await updateKnowledgeRecord(record.record_id, {
                        '同期ステータス': 'error',
                    });
                    errors.push(`${record.record_id}: empty content`);
                    errorCount++;
                    continue;
                }

                // Gemini でエンベディング生成 (768次元)
                const embeddingValues = await embed768(embeddingModel, record.content);

                // Pinecone用のベクトルID生成
                const pineconeId =
                    record.pinecone_id ||
                    `lark_${record.source_type || 'unknown'}_${record.record_id}`;

                // Pinecone にアップサート（metadata に lark_record_id を含める）
                await upsertVectors([
                    {
                        id: pineconeId,
                        values: embeddingValues,
                        metadata: {
                            text: record.content.substring(0, 8000),
                            title: record.title || '',
                            source_type: record.source_type || '',
                            lark_record_id: record.record_id,
                            created_at: record.created_at
                                ? new Date(record.created_at).toISOString()
                                : new Date().toISOString(),
                        },
                    },
                ]);

                // Lark Base の同期ステータスを synced に更新
                await updateKnowledgeRecord(record.record_id, {
                    'ベクトルID': pineconeId,
                    '同期ステータス': 'synced',
                    '最終同期日時': Date.now(),
                    '埋め込みモデル': EMBEDDING_MODEL,
                });

                syncedCount++;

                // Rate limit対策: 200ms待機
                await new Promise((r) => setTimeout(r, 200));
            } catch (recordError: any) {
                console.error(
                    `Sync failed for record ${record.record_id}:`,
                    recordError
                );
                errors.push(
                    `${record.record_id}: ${recordError.message || 'unknown error'}`
                );
                errorCount++;

                // エラーステータスをLark Baseに記録
                try {
                    await updateKnowledgeRecord(record.record_id, {
                        '同期ステータス': 'error',
                    });
                } catch {
                    // ステータス更新失敗は無視
                }

                // Rate limit エラーの場合は長めに待機
                if (
                    recordError.message?.includes('429') ||
                    recordError.message?.includes('rate')
                ) {
                    await new Promise((r) => setTimeout(r, 10000));
                }
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    synced: syncedCount,
                    errors: errorCount,
                    processed: pendingRecords.length,
                    total_pending_before: allPending.length,
                    remaining_estimate: Math.max(0, allPending.length - syncedCount),
                    error_details:
                        errors.length > 0 ? errors.slice(0, 10) : undefined,
                    timestamp: new Date().toISOString(),
                },
            }),
            { status: 200 }
        );
    } catch (error) {
        console.error('Sync API Error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: {
                    code: 'SYNC_FAILED',
                    message: 'Data synchronization failed',
                },
            }),
            { status: 500 }
        );
    }
}
