const axios = require('axios');

const CLIENT_TOKEN = 't-g20749eCMEN7KPLXPJ7SM4YYCCU6NPTKNWYZU555';
const CLIENT_BASE = 'Ts6jbfV9zan27Fs1s6ojim38ppl';
const API = 'https://open.larksuite.com/open-apis/bitable/v1/apps';

async function createTable(name, fields) {
  const res = await axios.post(
    `${API}/${CLIENT_BASE}/tables`,
    { table: { name, fields } },
    { headers: { Authorization: `Bearer ${CLIENT_TOKEN}`, 'Content-Type': 'application/json' } }
  );
  if (res.data.code !== 0) throw new Error(`${name}: ${res.data.msg}`);
  console.log(`${name}: ${res.data.data.table_id}`);
  return res.data.data.table_id;
}

async function main() {
  // 1. ナレッジ管理
  const knowledgeId = await createTable('ナレッジ管理', [
    { field_name: 'タイトル', type: 1 },
    { field_name: '内容', type: 1 },
    { field_name: 'ソース種別', type: 3, property: { options: [
      { name: 'mind_column' }, { name: 'x_post' }, { name: 'video_transcript' }, { name: 'custom' }
    ]}},
    { field_name: '参照リンク', type: 1 },
    { field_name: '学習ステータス', type: 3, property: { options: [
      { name: '学習対象' }, { name: '除外' }
    ]}},
    { field_name: 'ベクトルID', type: 1 },
    { field_name: '同期ステータス', type: 3, property: { options: [
      { name: 'pending' }, { name: 'synced' }, { name: 'error' }
    ]}},
    { field_name: '最終同期日時', type: 5, property: { date_formatter: 'yyyy/MM/dd HH:mm' } },
    { field_name: 'チャンク番号', type: 2 },
    { field_name: '埋め込みモデル', type: 1 },
    { field_name: 'ソースファイル', type: 1 },
  ]);

  await new Promise(r => setTimeout(r, 500));

  // 2. チャットログ
  const chatlogId = await createTable('チャットログ', [
    { field_name: 'ログID', type: 1 },
    { field_name: 'セッションID', type: 1 },
    { field_name: 'ユーザーID', type: 1 },
    { field_name: 'モード', type: 3, property: { options: [
      { name: 'concept' }, { name: 'analysis' }, { name: 'strategy' }
    ]}},
    { field_name: 'ユーザー入力', type: 1 },
    { field_name: 'AI回答', type: 1 },
    { field_name: '日時', type: 5, property: { date_formatter: 'yyyy/MM/dd HH:mm' } },
    { field_name: '評価', type: 3, property: { options: [
      { name: 'good' }, { name: 'bad' }
    ]}},
  ]);

  await new Promise(r => setTimeout(r, 500));

  // 3. ユーザー
  const usersId = await createTable('ユーザー', [
    { field_name: 'ユーザーID', type: 1 },
    { field_name: 'メールアドレス', type: 1 },
    { field_name: 'メール認証日', type: 5, property: { date_formatter: 'yyyy/MM/dd HH:mm' } },
    { field_name: '名前', type: 1 },
    { field_name: 'パスワード', type: 1 },
    { field_name: 'アイコン画像', type: 1 },
  ]);

  await new Promise(r => setTimeout(r, 500));

  // 4. セッション
  const sessionsId = await createTable('セッション', [
    { field_name: 'セッションID', type: 1 },
    { field_name: '有効期限', type: 5, property: { date_formatter: 'yyyy/MM/dd HH:mm' } },
    { field_name: 'トークン', type: 1 },
    { field_name: 'IPアドレス', type: 1 },
    { field_name: 'ユーザーエージェント', type: 1 },
  ]);

  await new Promise(r => setTimeout(r, 500));

  // 5. チャットセッション
  const chatSessionsId = await createTable('チャットセッション', [
    { field_name: 'セッションID', type: 1 },
    { field_name: 'ユーザーID', type: 1 },
    { field_name: 'モード', type: 3, property: { options: [
      { name: 'concept' }, { name: 'analysis' }, { name: 'strategy' }
    ]}},
    { field_name: 'タイトル', type: 1 },
  ]);

  console.log('\n=== テーブルID一覧 ===');
  console.log(`LARK_BASE_ID=${CLIENT_BASE}`);
  console.log(`LARK_KNOWLEDGE_TABLE_ID=${knowledgeId}`);
  console.log(`LARK_CHATLOG_TABLE_ID=${chatlogId}`);
  console.log(`LARK_USERS_TABLE_ID=${usersId}`);
  console.log(`LARK_SESSIONS_TABLE_ID=${sessionsId}`);
  console.log(`LARK_CHAT_SESSIONS_TABLE_ID=${chatSessionsId}`);
}

main().catch(console.error);
