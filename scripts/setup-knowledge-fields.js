/**
 * Knowledge_Source テーブルにPinecone同期用フィールドを追加するスクリプト
 *
 * 追加フィールド:
 *   - pinecone_id (Text): Pinecone vector ID
 *   - sync_status (SingleSelect): pending / synced / error
 *   - last_synced_at (DateTime): 最終同期日時
 *   - chunk_index (Number): チャンク番号
 *   - embedding_model (Text): 使用モデル名
 *   - source_file (Text): 元ファイル名
 *
 * 使用方法: node scripts/setup-knowledge-fields.js
 */
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const axios = require('axios');

const LARK_API_BASE = 'https://open.larksuite.com/open-apis';

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

async function addField(token, fieldName, fieldType, extraProps = {}) {
    const baseId = process.env.LARK_BASE_ID;
    const tableId = process.env.LARK_KNOWLEDGE_TABLE_ID;

    const body = {
        field_name: fieldName,
        type: fieldType,
        ...extraProps,
    };

    try {
        const response = await axios.post(
            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/fields`,
            body,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data.code === 0) {
            console.log(`  ✅ フィールド追加成功: ${fieldName}`);
            return true;
        } else {
            console.log(`  ⚠️ フィールド追加スキップ (既存?): ${fieldName} - ${response.data.msg}`);
            return false;
        }
    } catch (error) {
        if (error.response?.data?.code === 1254007) {
            console.log(`  ⏭️ 既存フィールド: ${fieldName}`);
            return false;
        }
        console.error(`  ❌ フィールド追加失敗: ${fieldName}`, error.response?.data || error.message);
        return false;
    }
}

async function main() {
    console.log('=== Knowledge_Source テーブル フィールド追加 ===\n');
    console.log(`Base ID: ${process.env.LARK_BASE_ID}`);
    console.log(`Table ID: ${process.env.LARK_KNOWLEDGE_TABLE_ID}\n`);

    const token = await getAccessToken();
    console.log('アクセストークン取得完了\n');

    // Lark Bitable field types:
    // 1: Text, 2: Number, 3: SingleSelect, 5: DateTime

    // 1. pinecone_id (Text)
    await addField(token, 'pinecone_id', 1);

    // 2. sync_status (SingleSelect)
    await addField(token, 'sync_status', 3, {
        property: {
            options: [
                { name: 'pending', color: 0 },
                { name: 'synced', color: 1 },
                { name: 'error', color: 2 },
            ],
        },
    });

    // 3. last_synced_at (DateTime)
    await addField(token, 'last_synced_at', 5, {
        property: {
            date_formatter: 'yyyy/MM/dd HH:mm',
            auto_fill: false,
        },
    });

    // 4. chunk_index (Number)
    await addField(token, 'chunk_index', 2, {
        property: {
            formatter: '0',
        },
    });

    // 5. embedding_model (Text)
    await addField(token, 'embedding_model', 1);

    // 6. source_file (Text)
    await addField(token, 'source_file', 1);

    console.log('\n=== 完了 ===');
}

main().catch(console.error);
