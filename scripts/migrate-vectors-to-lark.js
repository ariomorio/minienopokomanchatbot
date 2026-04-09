/**
 * 既存Pineconeベクトル → Lark Base移行スクリプト
 *
 * Pineconeから全ベクトルのメタデータを取得し、
 * Lark Base Knowledge_Sourceテーブルに書き込む。
 *
 * - mind_column_* (71件) → source_type: mind_column
 * - x_post_* (190件) → source_type: x_post
 *
 * 使用方法: node scripts/migrate-vectors-to-lark.js
 */
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const axios = require('axios');
const { Pinecone } = require('@pinecone-database/pinecone');

const LARK_API_BASE = 'https://open.larksuite.com/open-apis';
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

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

/**
 * Pineconeから全ベクトルIDを取得
 */
async function fetchAllVectorIds() {
    const index = pc.index('enopokoman-index');

    // list APIで全ID取得
    const ids = [];
    let paginationToken = undefined;

    do {
        const listParams = { limit: 100 };
        if (paginationToken) {
            listParams.paginationToken = paginationToken;
        }

        const response = await index.listPaginated(listParams);
        if (response.vectors) {
            ids.push(...response.vectors.map(v => v.id));
        }
        paginationToken = response.pagination?.next;
    } while (paginationToken);

    return ids;
}

/**
 * PineconeからベクトルのメタデータをバッチFetch
 */
async function fetchVectorMetadata(ids) {
    const index = pc.index('enopokoman-index');
    const batchSize = 100;
    const results = [];

    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const response = await index.fetch(batch);

        for (const [id, record] of Object.entries(response.records || {})) {
            results.push({
                id,
                metadata: record.metadata || {},
            });
        }

        console.log(`  Fetched metadata: ${results.length}/${ids.length}`);
    }

    return results;
}

/**
 * Lark Baseにレコードをバッチ作成
 */
async function createLarkRecords(token, records) {
    const baseId = process.env.LARK_BASE_ID;
    const tableId = process.env.LARK_KNOWLEDGE_TABLE_ID;
    const batchSize = 10; // Lark APIバッチ上限
    let created = 0;

    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        try {
            const response = await axios.post(
                `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/batch_create`,
                {
                    records: batch.map(r => ({ fields: r })),
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.data.code === 0) {
                created += batch.length;
                console.log(`  Created: ${created}/${records.length}`);
            } else {
                console.error(`  Batch error: ${response.data.msg}`);
                // 個別に作成を試みる
                for (const record of batch) {
                    try {
                        await axios.post(
                            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records`,
                            { fields: record },
                            {
                                headers: {
                                    Authorization: `Bearer ${token}`,
                                    'Content-Type': 'application/json',
                                },
                            }
                        );
                        created++;
                    } catch (e) {
                        console.error(`  Individual create failed:`, e.response?.data?.msg || e.message);
                    }
                }
                console.log(`  Created (with retries): ${created}/${records.length}`);
            }
        } catch (error) {
            console.error(`  Batch request failed:`, error.response?.data || error.message);
        }

        // Rate limit対策
        await new Promise(r => setTimeout(r, 300));
    }

    return created;
}

async function main() {
    console.log('=== Pinecone → Lark Base 移行 ===\n');

    // 1. Pineconeから全ベクトルID取得
    console.log('[Step 1] Pineconeから全ベクトルID取得...');
    const allIds = await fetchAllVectorIds();
    console.log(`  合計: ${allIds.length} vectors\n`);

    if (allIds.length === 0) {
        console.log('ベクトルが見つかりません。終了します。');
        return;
    }

    // 2. メタデータ取得
    console.log('[Step 2] メタデータ取得...');
    const vectors = await fetchVectorMetadata(allIds);
    console.log(`  取得完了: ${vectors.length} vectors\n`);

    // 3. ソースタイプ別に集計
    const mindColumns = vectors.filter(v => v.id.startsWith('mind_column'));
    const xPosts = vectors.filter(v => v.id.startsWith('x_post'));
    const others = vectors.filter(v => !v.id.startsWith('mind_column') && !v.id.startsWith('x_post'));

    console.log(`  mind_column: ${mindColumns.length}`);
    console.log(`  x_post: ${xPosts.length}`);
    if (others.length > 0) {
        console.log(`  other: ${others.length}`);
    }
    console.log();

    // 4. Lark Baseにアクセストークン取得
    console.log('[Step 3] Lark Baseアクセストークン取得...');
    const token = await getAccessToken();
    console.log('  取得完了\n');

    // 5. レコード作成
    console.log('[Step 4] Lark Baseにレコード作成...');
    const records = vectors.map(v => {
        const sourceType = v.id.startsWith('mind_column')
            ? 'mind_column'
            : v.id.startsWith('x_post')
                ? 'x_post'
                : 'other';

        // チャンクインデックスをIDから抽出 (例: mind_column_5 → 5)
        const parts = v.id.split('_');
        const chunkIdx = parseInt(parts[parts.length - 1], 10) || 0;

        // タイトル生成: テキストの先頭30文字を使用
        const text = v.metadata.text || '';
        const title = text.substring(0, 50).replace(/\n/g, ' ').trim() || v.id;

        return {
            'タイトル': title,
            '内容': text.substring(0, 60000), // Lark Base制限対策
            'ソース種別': sourceType,
            '学習ステータス': '学習対象',
            'ベクトルID': v.id,
            '同期ステータス': 'synced',
            '最終同期日時': Date.now(),
            'チャンク番号': chunkIdx,
            '埋め込みモデル': 'gemini-embedding-001',
        };
    });

    const created = await createLarkRecords(token, records);
    console.log(`\n=== 移行完了 ===`);
    console.log(`作成: ${created}/${vectors.length} レコード`);
}

main().catch(console.error);
