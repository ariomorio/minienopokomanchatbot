#!/usr/bin/env node
/**
 * rebuild-video-transcripts.js
 *
 * 既存のvideo_transcriptデータを削除し、
 * セクション(###)ベースのチャンキングで再投入するスクリプト
 *
 * 使用方法:
 *   node scripts/rebuild-video-transcripts.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

// .env.local読み込み
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const LARK_API_BASE = 'https://open.larksuite.com/open-apis';
const EMBEDDING_MODEL = 'gemini-embedding-001';
const TRANSCRIPT_DIR = path.join(
    process.env.USERPROFILE || process.env.HOME,
    'Downloads',
    'ミニえのぽこまんチャットボット',
    '動画コンテンツ文字起こし'
);

// ===== Lark API =====

let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }
    const res = await axios.post(
        `${LARK_API_BASE}/auth/v3/tenant_access_token/internal`,
        {
            app_id: process.env.LARK_APP_ID,
            app_secret: process.env.LARK_APP_SECRET,
        }
    );
    cachedToken = res.data.tenant_access_token;
    tokenExpiry = Date.now() + res.data.expire * 1000 - 60000;
    return cachedToken;
}

async function searchRecords(filter) {
    const token = await getAccessToken();
    const baseId = process.env.LARK_BASE_ID;
    const tableId = process.env.LARK_KNOWLEDGE_TABLE_ID;

    const allItems = [];
    let pageToken = undefined;

    while (true) {
        const body = {
            field_names: ['タイトル', 'ソース種別', '同期ステータス', 'ベクトルID', 'ソースファイル'],
            automatic_fields: true,
        };
        if (pageToken) body.page_token = pageToken;

        const res = await axios.post(
            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
            body,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (res.data.code !== 0) {
            throw new Error(`Lark API Error: ${res.data.msg}`);
        }

        const items = res.data.data?.items || [];
        allItems.push(...items);

        if (!res.data.data?.has_more) break;
        pageToken = res.data.data.page_token;
    }

    // クライアント側でフィルタリング
    if (filter) {
        return allItems.filter(filter);
    }
    return allItems;
}

async function batchDeleteRecords(recordIds) {
    const token = await getAccessToken();
    const baseId = process.env.LARK_BASE_ID;
    const tableId = process.env.LARK_KNOWLEDGE_TABLE_ID;

    // 500件ずつバッチ削除
    for (let i = 0; i < recordIds.length; i += 500) {
        const batch = recordIds.slice(i, i + 500);
        const res = await axios.post(
            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/batch_delete`,
            { records: batch },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        if (res.data.code !== 0) {
            console.error(`Batch delete error:`, res.data.msg);
        }
        console.log(`  Lark Base: ${batch.length}件削除`);
    }
}

async function createRecord(fields) {
    const token = await getAccessToken();
    const baseId = process.env.LARK_BASE_ID;
    const tableId = process.env.LARK_KNOWLEDGE_TABLE_ID;

    const res = await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records`,
        { fields },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );

    if (res.data.code !== 0) {
        throw new Error(`Lark Create Error: ${res.data.msg}`);
    }
    return res.data.data.record.record_id;
}

async function updateRecord(recordId, updates) {
    const token = await getAccessToken();
    const baseId = process.env.LARK_BASE_ID;
    const tableId = process.env.LARK_KNOWLEDGE_TABLE_ID;

    await axios.put(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/${recordId}`,
        { fields: updates },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );
}

// ===== Pinecone SDK =====

const { Pinecone } = require('@pinecone-database/pinecone');
let pineconeIndex = null;

function getPineconeIndex() {
    if (!pineconeIndex) {
        const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
        pineconeIndex = pc.index(process.env.PINECONE_INDEX_NAME || 'enopokoman-index');
    }
    return pineconeIndex;
}

async function deletePineconeVectors(ids) {
    if (ids.length === 0) return;
    const index = getPineconeIndex();
    await index.deleteMany(ids);
    console.log(`  Pinecone: ${ids.length}件削除`);
}

async function upsertPineconeVector(id, values, metadata) {
    const index = getPineconeIndex();
    await index.upsert([{ id, values, metadata }]);
}

// ===== Gemini Embedding =====

const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function embed768(text) {
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
    const result = await model.embedContent({
        content: { role: 'user', parts: [{ text }] },
        outputDimensionality: 768,
    });
    return result.embedding.values;
}

// ===== セクションベースチャンキング =====

/**
 * セクション(###)ベースのチャンク分割
 *
 * ルール:
 * 1. ### 見出しで分割（意味的な単位を保持）
 * 2. 各チャンクの先頭に講義タイトルを自動付加
 * 3. 短いセクション（300文字未満）は次のセクションと結合
 * 4. 長すぎるセクション（2000文字超）は段落単位で再分割
 */
function splitBySection(text, filename) {
    // 講義タイトルを抽出（### 1. 講義タイトル のセクション内容）
    const titleMatch = text.match(/### 1\. 講義タイトル[（(]?推定[）)]?\s*\n(.+?)(?=\n###|\n##|$)/s);
    const lectureTitle = titleMatch
        ? titleMatch[1].trim()
        : filename.replace(/_transcript\.txt$/, '').replace(/\.txt$/, '');

    // ### で分割
    const sections = text.split(/(?=^### \d+\.)/m);
    const chunks = [];

    for (let i = 0; i < sections.length; i++) {
        let section = sections[i].trim();
        if (!section) continue;

        // "## 📚 講義サマリー" のヘッダー行はスキップ
        if (section.startsWith('## ') && !section.startsWith('### ')) {
            continue;
        }

        // セクションの見出しを取得
        const headingMatch = section.match(/^### \d+\.\s*(.+)/);
        const sectionTitle = headingMatch ? headingMatch[1].trim() : '';

        // 講義タイトルセクション自体はスキップ（タイトルは各チャンクに付加するため）
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
            // 通常サイズ: そのまま1チャンク
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
function splitLongSection(text, maxSize) {
    const paragraphs = text.split(/\n\n+/);
    const subChunks = [];
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
    if (current.trim().length > 50) {
        subChunks.push(current.trim());
    }
    return subChunks;
}

// ===== メイン処理 =====

async function main() {
    console.log('=== 動画文字起こしデータ再構築 ===\n');

    // Step 1: 既存の video_transcript レコードを検索
    console.log('Step 1: 既存のvideo_transcriptレコードを検索...');
    const existingRecords = await searchRecords((item) => {
        const sourceType = item.fields['ソース種別'];
        return sourceType === 'video_transcript';
    });
    console.log(`  ${existingRecords.length}件のvideo_transcriptレコードを発見\n`);

    // Step 2: Pinecone からベクトル削除
    if (existingRecords.length > 0) {
        console.log('Step 2: Pinecone からベクトルを削除...');

        // Lark Bitable のテキストフィールドはリッチテキスト形式の場合がある
        // [{ text: "value", type: "text" }] → "value" に変換
        function extractText(field) {
            if (!field) return null;
            if (typeof field === 'string') return field;
            if (Array.isArray(field) && field.length > 0) {
                return field[0].text || String(field[0]);
            }
            if (typeof field === 'object' && field.text) {
                return field.text;
            }
            return String(field);
        }

        const pineconeIds = existingRecords
            .map((r) => extractText(r.fields['ベクトルID']))
            .filter(Boolean);

        if (pineconeIds.length > 0) {
            console.log(`  Pinecone IDs found: ${pineconeIds.join(', ')}`);
            await deletePineconeVectors(pineconeIds);
        }

        // 推定IDでも削除を試行（フィールドが空の場合のフォールバック）
        console.log('  推定IDで追加削除を試行...');
        const estimatedIds = [];
        const transcriptFiles = fs.readdirSync(TRANSCRIPT_DIR);
        for (const file of transcriptFiles) {
            const fileHash = crypto.createHash('md5').update(file).digest('hex').substring(0, 8);
            for (let i = 0; i < 5; i++) {
                estimatedIds.push(`video_tran_${fileHash}_${i}`);
                estimatedIds.push(`vt_${fileHash}_${i}`);
            }
        }
        if (estimatedIds.length > 0) {
            await deletePineconeVectors(estimatedIds);
        }

        // Step 3: Lark Base からレコード削除
        console.log('\nStep 3: Lark Base からレコードを削除...');
        const recordIds = existingRecords.map((r) => r.record_id);
        await batchDeleteRecords(recordIds);
    } else {
        console.log('Step 2-3: 削除対象なし\n');
    }

    // Step 4: ファイルを読み込み、セクションベースでチャンク分割
    console.log('\nStep 4: ファイルを読み込み、セクションベースでチャンク分割...');

    if (!fs.existsSync(TRANSCRIPT_DIR)) {
        console.error(`エラー: ディレクトリが見つかりません: ${TRANSCRIPT_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(TRANSCRIPT_DIR).filter((f) => f.endsWith('.txt'));
    console.log(`  ${files.length}ファイルを検出\n`);

    let totalChunks = 0;
    let totalSynced = 0;
    const allResults = [];

    for (const filename of files) {
        const filePath = path.join(TRANSCRIPT_DIR, filename);
        const text = fs.readFileSync(filePath, 'utf-8');

        const { lectureTitle, chunks } = splitBySection(text, filename);

        console.log(`📄 ${filename}`);
        console.log(`   講義タイトル: ${lectureTitle}`);
        console.log(`   チャンク数: ${chunks.length}`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            console.log(`   [${i + 1}/${chunks.length}] ${chunk.title} (${chunk.content.length}文字)`);
        }

        let fileSynced = 0;
        const fileErrors = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            try {
                // 1. Lark Base にレコード作成
                const recordId = await createRecord({
                    'タイトル': chunk.title,
                    '内容': chunk.content.substring(0, 60000),
                    'ソース種別': 'video_transcript',
                    '学習ステータス': '学習対象',
                    '同期ステータス': 'pending',
                    'チャンク番号': i,
                    'ソースファイル': filename,
                    '埋め込みモデル': EMBEDDING_MODEL,
                });

                // 2. Gemini でエンベディング生成 (768次元)
                const embeddingValues = await embed768(chunk.content);

                // 3. Pinecone ID生成（ASCII only）
                const fileHash = crypto.createHash('md5').update(filename).digest('hex').substring(0, 8);
                const pineconeId = `vt_${fileHash}_${i}`;

                // 4. Pinecone にアップサート
                await upsertPineconeVector(pineconeId, embeddingValues, {
                    text: chunk.content.substring(0, 8000),
                    title: chunk.title,
                    source_type: 'video_transcript',
                    lark_record_id: recordId,
                    source_file: filename,
                    section: chunk.sectionTitle,
                });

                // 5. Lark Base ステータス更新
                await updateRecord(recordId, {
                    'ベクトルID': pineconeId,
                    '同期ステータス': 'synced',
                    '最終同期日時': Date.now(),
                });

                fileSynced++;
                process.stdout.write(`   ✅ Chunk ${i + 1}/${chunks.length} synced\n`);

                // Rate limit 対策
                await new Promise((r) => setTimeout(r, 500));
            } catch (err) {
                const errMsg = `Chunk ${i}: ${err.message || 'unknown'}`;
                fileErrors.push(errMsg);
                console.error(`   ❌ ${errMsg}`);

                // Rate limit の場合は長めに待機
                if (err.message?.includes('429') || err.message?.includes('rate')) {
                    console.log('   ⏳ Rate limit hit. Waiting 15s...');
                    await new Promise((r) => setTimeout(r, 15000));
                }
            }
        }

        totalChunks += chunks.length;
        totalSynced += fileSynced;
        allResults.push({
            filename,
            lectureTitle,
            chunks: chunks.length,
            synced: fileSynced,
            errors: fileErrors,
        });

        console.log(`   → ${fileSynced}/${chunks.length} synced\n`);
    }

    // 結果サマリー
    console.log('\n=== 再構築完了 ===');
    console.log(`ファイル数: ${files.length}`);
    console.log(`総チャンク数: ${totalChunks}`);
    console.log(`同期完了: ${totalSynced}`);
    console.log(`エラー: ${totalChunks - totalSynced}`);

    console.log('\n--- 詳細 ---');
    for (const r of allResults) {
        const status = r.synced === r.chunks ? '✅' : '⚠️';
        console.log(`${status} ${r.lectureTitle}: ${r.synced}/${r.chunks}チャンク`);
        if (r.errors.length > 0) {
            for (const e of r.errors) {
                console.log(`   ❌ ${e}`);
            }
        }
    }
}

main().catch((err) => {
    console.error('致命的エラー:', err);
    process.exit(1);
});
