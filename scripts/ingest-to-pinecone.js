/**
 * データ投入スクリプト（Lark Base連携版）
 *
 * ファイル読み込み → チャンク分割 → Lark Base にレコード作成 (sync_status: pending)
 * → Gemini Embedding → Pinecone にアップサート → Lark Base ステータス更新 (synced)
 *
 * 使用方法:
 *   node scripts/ingest-to-pinecone.js                          # デフォルトファイル使用
 *   node scripts/ingest-to-pinecone.js --file path/to/file.txt --type custom_type
 *   node scripts/ingest-to-pinecone.js --sync-only              # Lark Baseのpendingレコードのみ同期
 */
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

const LARK_API_BASE = 'https://open.larksuite.com/open-apis';
const EMBEDDING_MODEL = 'gemini-embedding-001';

// --- Lark API helpers ---

async function getAccessToken() {
    const response = await axios.post(
        `${LARK_API_BASE}/auth/v3/tenant_access_token/internal`,
        {
            app_id: process.env.LARK_APP_ID,
            app_secret: process.env.LARK_APP_SECRET,
        }
    );
    return response.data.tenant_access_token;
}

async function createLarkRecord(token, fields) {
    const baseId = process.env.LARK_BASE_ID;
    const tableId = process.env.LARK_KNOWLEDGE_TABLE_ID;

    const response = await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records`,
        { fields },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );

    if (response.data.code !== 0) {
        throw new Error(`Lark API Error: ${response.data.msg}`);
    }

    return response.data.data.record.record_id;
}

async function updateLarkRecord(token, recordId, fields) {
    const baseId = process.env.LARK_BASE_ID;
    const tableId = process.env.LARK_KNOWLEDGE_TABLE_ID;

    await axios.put(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/${recordId}`,
        { fields },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );
}

// --- チャンク分割 ---

function splitMindColumns(text) {
    const sections = text.split(/\n(?=\d+\.\s)/);
    const chunks = [];

    for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed || trimmed.length < 50) continue;

        if (trimmed.length > 2000) {
            const paragraphs = trimmed.split(/\n\n+/);
            let current = '';
            for (const para of paragraphs) {
                if ((current + '\n\n' + para).length > 2000 && current.length > 100) {
                    chunks.push(current.trim());
                    current = para;
                } else {
                    current = current ? current + '\n\n' + para : para;
                }
            }
            if (current.trim().length > 50) {
                chunks.push(current.trim());
            }
        } else {
            chunks.push(trimmed);
        }
    }
    return chunks;
}

function splitToneCorpus(text) {
    const lines = text.split('\n');
    const chunks = [];
    let current = '';

    for (const line of lines) {
        if (/^[A-Za-z0-9_-]{8,20}$/.test(line.trim())) {
            if (current.trim().length > 30) {
                chunks.push(current.trim());
            }
            current = '';
            continue;
        }
        if (/^(No|Post ID|Date|Text|Media Description)$/.test(line.trim())) continue;
        if (/^https?:\/\//.test(line.trim())) continue;

        if (line.trim() === '' && current.trim().length > 30) {
            if (current.trim().length > 50) {
                chunks.push(current.trim());
            }
            current = '';
        } else {
            current += (current ? '\n' : '') + line;
        }
    }
    if (current.trim().length > 50) {
        chunks.push(current.trim());
    }
    return chunks;
}

function splitGenericText(text, maxChunkSize = 2000) {
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let current = '';

    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        if ((current + '\n\n' + trimmed).length > maxChunkSize && current.length > 100) {
            chunks.push(current.trim());
            current = trimmed;
        } else {
            current = current ? current + '\n\n' + trimmed : trimmed;
        }
    }
    if (current.trim().length > 50) {
        chunks.push(current.trim());
    }
    return chunks;
}

// --- エンベディング + アップサート ---

async function embedAndUpsertWithLark(chunks, sourceType, sourceFile, token) {
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const index = pc.index('enopokoman-index');

    const batchSize = 10;
    let totalUpserted = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const vectors = [];

        for (let j = 0; j < batch.length; j++) {
            const chunkText = batch[j];
            const chunkIndex = i + j;
            const title = chunkText.substring(0, 50).replace(/\n/g, ' ').trim();

            try {
                // 1. Lark Baseにレコード作成 (sync_status: pending)
                const recordId = await createLarkRecord(token, {
                    'タイトル': title,
                    '内容': chunkText.substring(0, 60000),
                    'ソース種別': sourceType,
                    '学習ステータス': '学習対象',
                    '同期ステータス': 'pending',
                    'チャンク番号': chunkIndex,
                    'ソースファイル': sourceFile,
                    '埋め込みモデル': EMBEDDING_MODEL,
                });

                // Rate limit対策
                if (j > 0) await new Promise(r => setTimeout(r, 200));

                // 2. Gemini でエンベディング生成
                const result = await embeddingModel.embedContent({
                    content: { parts: [{ text: chunkText }] },
                    outputDimensionality: 768,
                });

                const fileSlug = sourceFile.replace(/[^a-zA-Z0-9\u3000-\u9FFF]/g, '_').substring(0, 80);
                const pineconeId = `${sourceType}_${fileSlug}_${chunkIndex}`;

                vectors.push({
                    id: pineconeId,
                    values: result.embedding.values,
                    metadata: {
                        text: chunkText.substring(0, 8000),
                        source_type: sourceType,
                        chunk_index: chunkIndex,
                        lark_record_id: recordId,
                        source_file: sourceFile,
                    },
                });

                // 3. Lark Baseのステータスを synced に更新
                await updateLarkRecord(token, recordId, {
                    'ベクトルID': pineconeId,
                    '同期ステータス': 'synced',
                    '最終同期日時': Date.now(),
                });

            } catch (e) {
                console.error(`  Chunk ${chunkIndex} failed:`, e.message);
                if (e.message.includes('429') || e.message.includes('rate')) {
                    console.log('  Rate limited. Waiting 10s...');
                    await new Promise(r => setTimeout(r, 10000));
                    j--; // リトライ
                }
            }
        }

        if (vectors.length > 0) {
            await index.upsert(vectors);
            totalUpserted += vectors.length;
            console.log(`  Upserted batch: ${totalUpserted}/${chunks.length} chunks`);
        }

        await new Promise(r => setTimeout(r, 500));
    }

    return totalUpserted;
}

// --- メイン ---

async function main() {
    const args = process.argv.slice(2);
    const syncOnly = args.includes('--sync-only');
    const fileIdx = args.indexOf('--file');
    const typeIdx = args.indexOf('--type');

    console.log('=== Pinecone Data Ingestion (Lark Base連携版) ===\n');

    const token = await getAccessToken();
    console.log('Lark アクセストークン取得完了\n');

    if (syncOnly) {
        // Lark BaseのpendingレコードをSync APIで同期
        console.log('sync-onlyモード: Lark BaseのpendingレコードをSync API経由で同期します');
        console.log('curl -X POST http://localhost:3000/api/sync -H "Authorization: Bearer <CRON_SECRET>" を実行してください');
        return;
    }

    if (fileIdx !== -1 && args[fileIdx + 1]) {
        // カスタムファイル投入
        const filePath = args[fileIdx + 1];
        const sourceType = typeIdx !== -1 && args[typeIdx + 1] ? args[typeIdx + 1] : 'custom';

        console.log(`[Custom] Processing: ${filePath}`);
        console.log(`  Source type: ${sourceType}`);

        const text = fs.readFileSync(filePath, 'utf-8');
        const chunks = splitGenericText(text);
        console.log(`  Chunks created: ${chunks.length}`);

        const count = await embedAndUpsertWithLark(chunks, sourceType, path.basename(filePath), token);
        console.log(`  Done: ${count} vectors upserted\n`);
    } else {
        // デフォルト: マインドコラム + X投稿
        // 1. マインドコラム
        const mindPath = path.join(__dirname, '..', 'extracted_mind_columns.txt');
        if (fs.existsSync(mindPath)) {
            console.log('[1/2] Processing: extracted_mind_columns.txt');
            const mindText = fs.readFileSync(mindPath, 'utf-8');
            const mindChunks = splitMindColumns(mindText);
            console.log(`  Chunks created: ${mindChunks.length}`);
            const mindCount = await embedAndUpsertWithLark(mindChunks, 'mind_column', 'extracted_mind_columns.txt', token);
            console.log(`  Done: ${mindCount} vectors upserted\n`);
        } else {
            console.log('[1/2] Skipped: extracted_mind_columns.txt not found\n');
        }

        // 2. X投稿
        const tonePath = path.join(__dirname, '..', 'extracted_tone_corpus.txt');
        if (fs.existsSync(tonePath)) {
            console.log('[2/2] Processing: extracted_tone_corpus.txt');
            const toneText = fs.readFileSync(tonePath, 'utf-8');
            const toneChunks = splitToneCorpus(toneText);
            console.log(`  Chunks created: ${toneChunks.length}`);
            const toneCount = await embedAndUpsertWithLark(toneChunks, 'x_post', 'extracted_tone_corpus.txt', token);
            console.log(`  Done: ${toneCount} vectors upserted\n`);
        } else {
            console.log('[2/2] Skipped: extracted_tone_corpus.txt not found\n');
        }
    }

    // 最終確認
    const index = pc.index('enopokoman-index');
    const stats = await index.describeIndexStats();
    console.log('=== Final Stats ===');
    console.log(`Total vectors: ${stats.totalRecordCount}`);
    console.log('Done!');
}

main().catch(console.error);
