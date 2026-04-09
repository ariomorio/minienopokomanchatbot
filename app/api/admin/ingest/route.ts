// Admin Ingest API - テキストファイルアップロード → Lark Base + Pinecone 投入
import { NextRequest } from 'next/server';
import {
    createKnowledgeRecord,
    updateKnowledgeRecord,
    getAccessToken,
} from '@/lib/lark';
import { preprocessForKnowledge, preprocessMeetingTranscript } from '@/lib/ai-preprocess';
import { upsertVectors } from '@/lib/vectordb';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash } from 'crypto';

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

interface ChunkResult {
    title: string;
    content: string;
    sectionTitle: string;
}

/**
 * セクション(###)ベースのチャンク分割
 *
 * ルール:
 * 1. ### 見出しで分割（意味的な単位を保持）
 * 2. 各チャンクの先頭に講義タイトルを自動付加（コンテキスト維持）
 * 3. 短いセクション（300文字未満）は次のセクションと結合
 * 4. 長すぎるセクション（2000文字超）は段落単位で再分割
 */
function splitBySection(text: string, filename: string): { lectureTitle: string; chunks: ChunkResult[] } {
    // 講義タイトルを抽出
    const titleMatch = text.match(/### 1\. 講義タイトル[（(]?推定[）)]?\s*\n([^\n]+)/);
    const lectureTitle = titleMatch
        ? titleMatch[1].trim()
        : filename.replace(/_transcript\.txt$/, '').replace(/\.txt$/, '');

    // ### で分割
    const sections = text.split(/(?=^### \d+\.)/m);
    const chunks: ChunkResult[] = [];

    for (let i = 0; i < sections.length; i++) {
        const section = sections[i].trim();
        if (!section) continue;

        // "## 📚 講義サマリー" 等のヘッダー行はスキップ
        if (section.startsWith('## ') && !section.startsWith('### ')) {
            continue;
        }

        // セクションの見出しを取得
        const headingMatch = section.match(/^### \d+\.\s*(.+)/);
        const sectionTitle = headingMatch ? headingMatch[1].trim() : '';

        // 講義タイトルセクション自体はスキップ
        if (sectionTitle.includes('講義タイトル')) {
            continue;
        }

        // 短すぎるセクションは次のセクションと結合
        if (section.length < 300 && i + 1 < sections.length) {
            sections[i + 1] = section + '\n\n' + sections[i + 1];
            continue;
        }

        // 長すぎるセクション（2000文字超）は段落単位で再分割
        if (section.length > 2000) {
            const subChunks = splitLongSection(section, 1500);
            for (let j = 0; j < subChunks.length; j++) {
                const chunkText = `【講義】${lectureTitle}\n\n${subChunks[j]}`;
                chunks.push({
                    title: subChunks.length > 1
                        ? `${lectureTitle} - ${sectionTitle} (${j + 1}/${subChunks.length})`
                        : `${lectureTitle} - ${sectionTitle}`,
                    content: chunkText,
                    sectionTitle,
                });
            }
        } else {
            const chunkText = `【講義】${lectureTitle}\n\n${section}`;
            chunks.push({
                title: `${lectureTitle} - ${sectionTitle}`,
                content: chunkText,
                sectionTitle,
            });
        }
    }

    return { lectureTitle, chunks };
}

/**
 * 長いセクションを段落単位で再分割
 */
function splitLongSection(text: string, maxSize = 1500): string[] {
    const paragraphs = text.split(/\n\n+/);
    const subChunks: string[] = [];
    let current = '';

    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        if ((current + '\n\n' + trimmed).length > maxSize && current.length > 200) {
            subChunks.push(current.trim());
            current = trimmed;
        } else {
            current = current ? current + '\n\n' + trimmed : trimmed;
        }
    }
    if (current.trim().length > 0) {
        subChunks.push(current.trim());
    }
    return subChunks;
}

/**
 * 汎用テキストのチャンク分割（###セクションがない場合のフォールバック）
 */
function splitIntoChunks(text: string, maxChunkSize = 1500): string[] {
    const paragraphs = text.split(/\n\n+/);
    const chunks: string[] = [];
    let current = '';

    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        if (
            (current + '\n\n' + trimmed).length > maxChunkSize &&
            current.length > 100
        ) {
            chunks.push(current.trim());
            current = trimmed;
        } else {
            current = current ? current + '\n\n' + trimmed : trimmed;
        }
    }
    if (current.trim().length > 0) {
        chunks.push(current.trim());
    }

    return chunks;
}

export async function POST(request: NextRequest) {
    try {
        // 認証チェック（CRON_SECRET）
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Unauthorized',
                }),
                { status: 401 }
            );
        }

        // multipart/form-data からファイルとメタデータを取得
        const formData = await request.formData();
        const files = formData.getAll('files') as File[];
        const sourceType =
            (formData.get('source_type') as string) || 'video_transcript';

        // テキスト直接入力対応
        const directText = formData.get('text') as string | null;
        const directTitle = formData.get('title') as string | null;

        if ((!files || files.length === 0) && !directText?.trim()) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'No files or text provided',
                }),
                { status: 400 }
            );
        }

        // テキスト入力とファイルを統一的に処理するための入力リストを構築
        const inputs: Array<{ name: string; text: string }> = [];

        // テキスト直接入力がある場合
        if (directText?.trim()) {
            const title = directTitle?.trim() || `テキスト入力_${new Date().toISOString().slice(0, 16)}`;
            inputs.push({ name: title, text: directText.trim() });
        }

        // ファイルがある場合
        for (const file of files) {
            inputs.push({ name: file.name, text: await file.text() });
        }

        if (inputs.length === 0) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'No content to process',
                }),
                { status: 400 }
            );
        }

        const embeddingModel = genAI.getGenerativeModel({
            model: EMBEDDING_MODEL,
        });

        const results: Array<{
            filename: string;
            chunks: number;
            synced: number;
            errors: string[];
        }> = [];

        for (const input of inputs) {
            const filename = input.name;
            const text = input.text;
            const fileErrors: string[] = [];

            // セクション(###)が含まれるかで分割方式を自動選択
            const hasSection = /^### \d+\./m.test(text);

            let chunkList: Array<{ title: string; content: string; sectionTitle?: string }>;

            if (hasSection) {
                // セクションベース分割（動画文字起こし等の構造化テキスト向け）
                const { lectureTitle, chunks: sectionChunks } = splitBySection(text, filename);
                chunkList = sectionChunks;
                console.log(`[${filename}] セクションベース分割: ${sectionChunks.length}チャンク (講義: ${lectureTitle})`);
            } else {
                // 汎用段落ベース分割（フォールバック）
                const baseTitle = filename
                    .replace(/_transcript\.txt$/, '')
                    .replace(/\.txt$/, '');
                const plainChunks = splitIntoChunks(text);
                chunkList = plainChunks.map((chunk, idx) => ({
                    title: plainChunks.length === 1
                        ? baseTitle
                        : `${baseTitle} (${idx + 1}/${plainChunks.length})`,
                    content: chunk,
                }));
                console.log(`[${filename}] 段落ベース分割: ${plainChunks.length}チャンク`);
            }

            let syncedCount = 0;

            for (let i = 0; i < chunkList.length; i++) {
                const chunk = chunkList[i];

                try {
                    // 0. AI前処理: テキストをベクトル検索に最適な形に整理
                    // 会議文字起こしの場合は専用AI処理（決定事項・アクション抽出あり）
                    let preprocessed;
                    if (sourceType === 'meeting_transcript') {
                        const meetingResult = await preprocessMeetingTranscript(chunk.content, chunk.title);
                        const parts: string[] = [];
                        if (meetingResult.summary) parts.push("【要約】" + meetingResult.summary);
                        if (meetingResult.keywords.length > 0) parts.push("【キーワード】" + meetingResult.keywords.join("、"));
                        if (meetingResult.decisions) parts.push("【決定事項】" + meetingResult.decisions);
                        if (meetingResult.actionItems) parts.push("【アクションアイテム】" + meetingResult.actionItems);
                        parts.push("【議事録】" + meetingResult.cleanedContent);
                        const structuredContent = parts.join(String.fromCharCode(10, 10));
                        preprocessed = {
                            cleanedContent: structuredContent,
                            summary: meetingResult.summary,
                            keywords: meetingResult.keywords,
                            embeddingText: meetingResult.embeddingText,
                        };
                    } else {
                        preprocessed = await preprocessForKnowledge(chunk.content, sourceType, chunk.title);
                    }

                    // 1. Lark Base にレコード作成（同期ステータス: pending）
                    const recordId = await createKnowledgeRecord({
                        'タイトル': chunk.title,
                        '内容': preprocessed.cleanedContent.substring(0, 60000),
                        'ソース種別': sourceType,
                        '学習ステータス': '学習対象',
                        '同期ステータス': 'pending',
                        'チャンク番号': i,
                        'ソースファイル': filename,
                        '埋め込みモデル': EMBEDDING_MODEL,
                    });

                    // 2. Gemini でエンベディング生成 (768次元)
                    const embeddingValues = await embed768(embeddingModel, preprocessed.embeddingText);

                    // Pinecone IDはASCIIのみ対応 → ファイル名をハッシュ化
                    const fileHash = createHash('md5').update(filename).digest('hex').substring(0, 8);
                    const pineconeId = `${sourceType.substring(0, 10)}_${fileHash}_${i}`;

                    // 3. Pinecone にアップサート
                    await upsertVectors([
                        {
                            id: pineconeId,
                            values: embeddingValues,
                            metadata: {
                                text: preprocessed.embeddingText.substring(0, 8000),
                                title: chunk.title,
                                source_type: sourceType,
                                lark_record_id: recordId,
                                source_file: filename,
                                section: chunk.sectionTitle || '',
                                summary: preprocessed.summary,
                                keywords: preprocessed.keywords.join(', '),
                            },
                        },
                    ]);

                    // 4. Lark Base ステータス更新
                    await updateKnowledgeRecord(recordId, {
                        'ベクトルID': pineconeId,
                        '同期ステータス': 'synced',
                        '最終同期日時': Date.now(),
                    });

                    syncedCount++;

                    // Rate limit 対策
                    await new Promise((r) => setTimeout(r, 500));
                } catch (err: any) {
                    const errMsg = `Chunk ${i}: ${err.message || 'unknown error'}`;
                    fileErrors.push(errMsg);
                    console.error(`[${filename}] ${errMsg}`);

                    // Rate limit の場合は長めに待機
                    if (
                        err.message?.includes('429') ||
                        err.message?.includes('rate')
                    ) {
                        await new Promise((r) => setTimeout(r, 10000));
                    }
                }
            }

            results.push({
                filename,
                chunks: chunkList.length,
                synced: syncedCount,
                errors: fileErrors,
            });
        }

        const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
        const totalChunks = results.reduce((sum, r) => sum + r.chunks, 0);

        return new Response(
            JSON.stringify({
                success: true,
                data: {
                    files_processed: results.length,
                    total_chunks: totalChunks,
                    total_synced: totalSynced,
                    details: results,
                    timestamp: new Date().toISOString(),
                },
            }),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Ingest API Error:', error);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message || 'Ingest failed',
            }),
            { status: 500 }
        );
    }
}
