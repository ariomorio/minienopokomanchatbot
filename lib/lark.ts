// Lark Open APIクライアント
import axios from 'axios';
import {
    LarkAccessTokenResponse,
    LarkResponse,
    KnowledgeSource,
    ChatLog,
    User,
    Session,
    ChatSession,
} from '@/types/lark';

const LARK_API_BASE = 'https://open.larksuite.com/open-apis';

// 環境変数ヘルパー（末尾の改行・空白を除去）
function env(key: string): string {
    return (process.env[key] || '').trim();
}

// アクセストークンのキャッシュ
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

/**
 * Lark Tenant Access Tokenの取得
 */
export async function getAccessToken(): Promise<string> {
    // キャッシュされたトークンが有効なら返す
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    const response = await axios.post<LarkResponse<LarkAccessTokenResponse>>(
        `${LARK_API_BASE}/auth/v3/tenant_access_token/internal`,
        {
            app_id: env('LARK_APP_ID'),
            app_secret: env('LARK_APP_SECRET'),
        }
    );

    if (response.data.code !== 0) {
        throw new Error(`Lark API Error: ${response.data.msg}`);
    }

    // Larkのトークン取得APIのレスポンスは { code, msg, tenant_access_token, expire } のフラット構造
    const data = response.data as any;
    cachedToken = data.tenant_access_token;
    tokenExpiry = Date.now() + data.expire * 1000 - 60000; // 1分前に期限切れとする

    return cachedToken!;
}

/**
 * 学習ソースレコードの取得
 */
export async function fetchKnowledgeRecords(
    updatedSince?: Date
): Promise<KnowledgeSource[]> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_KNOWLEDGE_TABLE_ID');

    // フィルター条件の構築（更新日時によるフィルタリング）
    let filter = 'CurrentValue.[学習ステータス] = "学習対象"';
    if (updatedSince) {
        const timestamp = Math.floor(updatedSince.getTime() / 1000);
        filter += ` AND CurrentValue.[更新日時] > ${timestamp}`;
    }

    const response = await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
        {
            filter,
            automatic_fields: true,
        },
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

    // レスポンスの型変換（実際のフィールド名に合わせて調整が必要）
    return response.data.data.items.map((item: any) => ({
        record_id: item.record_id,
        title: item.fields['タイトル'],
        content: item.fields['内容'],
        source_type: item.fields['ソース種別'],
        url: item.fields['参照リンク'],
        status: item.fields['学習ステータス'] === '学習対象' ? 'active' : 'archived',
        created_at: item.fields['登録日'],
        updated_at: item.fields['更新日時'],
        pinecone_id: item.fields['ベクトルID'] || undefined,
        sync_status: item.fields['同期ステータス'] || undefined,
        last_synced_at: item.fields['最終同期日時'] || undefined,
        chunk_index: item.fields['チャンク番号'] || undefined,
        embedding_model: item.fields['埋め込みモデル'] || undefined,
        source_file: item.fields['ソースファイル'] || undefined,
    }));
}

/**
 * sync_statusがpendingまたは未設定のレコードを取得
 */
export async function fetchPendingKnowledgeRecords(): Promise<KnowledgeSource[]> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_KNOWLEDGE_TABLE_ID');

    // sync_statusがpendingまたは未設定のレコードを検索
    const response = await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
        {
            automatic_fields: true,
        },
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

    const items = response.data.data?.items || [];

    // クライアント側でsync_statusフィルタリング
    return items
        .filter((item: any) => {
            const syncStatus = item.fields['同期ステータス'];
            return !syncStatus || syncStatus === 'pending';
        })
        .map((item: any) => ({
            record_id: item.record_id,
            title: item.fields['タイトル'] || '',
            content: item.fields['内容'] || '',
            source_type: item.fields['ソース種別'] || '',
            url: item.fields['参照リンク'] || undefined,
            status: item.fields['学習ステータス'] === '学習対象' ? 'active' as const : 'archived' as const,
            created_at: item.fields['登録日'],
            updated_at: item.fields['更新日時'],
            pinecone_id: item.fields['ベクトルID'] || undefined,
            sync_status: item.fields['同期ステータス'] || undefined,
            last_synced_at: item.fields['最終同期日時'] || undefined,
            chunk_index: item.fields['チャンク番号'] || undefined,
            embedding_model: item.fields['埋め込みモデル'] || undefined,
            source_file: item.fields['ソースファイル'] || undefined,
        }));
}

/**
 * Knowledge_Sourceレコードを更新（同期ステータス等）
 */
export async function updateKnowledgeRecord(
    recordId: string,
    updates: Record<string, any>
): Promise<void> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_KNOWLEDGE_TABLE_ID');

    await axios.put(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/${recordId}`,
        {
            fields: updates,
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );
}

/**
 * Knowledge_Sourceテーブルにレコードを作成
 */
export async function createKnowledgeRecord(
    fields: Record<string, any>
): Promise<string> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_KNOWLEDGE_TABLE_ID');

    const response = await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records`,
        {
            fields,
        },
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

/**
 * 会話ログの作成
 */
export async function createChatLog(log: ChatLog): Promise<void> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_CHATLOG_TABLE_ID');

    console.log('Creating chat log:', {
        session_id: log.session_id,
        user_id: log.user_id,
        mode: log.mode,
        timestamp: log.timestamp,
    });

    try {
        const response = await axios.post(
            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records`,
            {
                fields: {
                    'セッションID': log.session_id,
                    'ユーザーID': log.user_id,
                    'モード': log.mode,
                    'ユーザー入力': log.user_input,
                    'AI回答': log.ai_response,
                    '日時': log.timestamp,
                    '評価': log.evaluation || '',
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('Chat log created successfully:', response.data);
    } catch (error: any) {
        console.error('Failed to create chat log:', error);
        console.error('Error response:', error.response?.data);
        throw error;
    }
}

/**
 * ユーザー管理関数
 */

// ユーザーのチャットセッション一覧を取得
export async function getChatSessions(userId: string, mode?: string): Promise<ChatSession[]> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_CHAT_SESSIONS_TABLE_ID');

    console.log('Getting chat sessions for user:', userId, 'mode:', mode);

    try {
        const response = await axios.post(
            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
            {
                field_names: ['セッションID', 'ユーザーID', 'モード', 'タイトル', '作成日', '更新日'],
                sort: [{ field_name: '更新日', desc: true }],
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data.code !== 0) {
            console.error('API error:', response.data.msg);
            return [];
        }

        const items = response.data.data.items || [];

        // フィルタリング
        const filteredSessions = items.filter((item: any) => {
            // ユーザーIDチェック
            const userIdField = item.fields['ユーザーID'];
            let itemUserId = userIdField;
            if (Array.isArray(userIdField) && userIdField.length > 0) {
                itemUserId = userIdField[0].text;
            } else if (typeof userIdField === 'object' && userIdField !== null) {
                itemUserId = userIdField.text;
            }
            const userMatch = itemUserId === userId;

            console.log(`Checking user: DB='${itemUserId}' vs Query='${userId}' => ${userMatch}`);

            // モードチェック（指定があれば）
            let modeMatch = true;
            if (mode) {
                const modeField = item.fields['モード'];
                let itemMode = modeField;
                if (Array.isArray(modeField) && modeField.length > 0) {
                    itemMode = modeField[0].text;
                } else if (typeof modeField === 'object' && modeField !== null) {
                    itemMode = modeField.text;
                }

                // 英語IDから日本語ラベルへのマッピング（後方互換性のため）
                const modeLabels: { [key: string]: string } = {
                    'concept': 'コンセプト設計',
                    'analysis': '自己分析',
                    'strategy': '戦略設計'
                };
                const japaneseMode = modeLabels[mode];

                // IDまたは日本語ラベルのどちらかに一致すればOK
                modeMatch = (itemMode === mode) || (!!japaneseMode && itemMode === japaneseMode);

                console.log(`Checking mode: DB='${itemMode}' vs Query='${mode}' (Label='${japaneseMode}') => ${modeMatch}`);
            }

            return userMatch && modeMatch;
        });

        console.log('Sessions found after filter:', filteredSessions.length);

        // ChatSession形式に変換
        return filteredSessions.map((item: any) => ({
            session_id: item.fields['セッションID'],
            user_id: Array.isArray(item.fields['ユーザーID']) ? item.fields['ユーザーID'][0].text : item.fields['ユーザーID'],
            mode: Array.isArray(item.fields['モード']) ? item.fields['モード'][0].text : item.fields['モード'],
            title: Array.isArray(item.fields['タイトル']) ? item.fields['タイトル'][0].text : (item.fields['タイトル'] || '無題の会話'),
            created_at: item.fields['作成日'],
            updated_at: item.fields['更新日'],
        }));
    } catch (error: any) {
        console.error('Failed to get chat sessions:', error);
        return [];
    }
}

// メールアドレスでユーザーを取得
export async function getUserByEmail(email: string): Promise<User | null> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_USERS_TABLE_ID');

    console.log('getUserByEmail - Searching for:', email);
    console.log('getUserByEmail - Table ID:', tableId);

    const response = await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
        {
            field_names: ['ユーザーID', 'メールアドレス', 'パスワード', '名前', 'メール認証日', 'アイコン画像', '作成日', '更新日'],
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );

    console.log('getUserByEmail - Response code:', response.data.code);
    console.log('getUserByEmail - Total items:', response.data.data?.items?.length || 0);

    if (response.data.code !== 0) {
        console.log('getUserByEmail - API error:', response.data.msg);
        return null;
    }

    // クライアント側でメールアドレスでフィルタリング
    const items = response.data.data.items || [];

    // デバッグ: 全ユーザーのメールアドレスを表示
    console.log('getUserByEmail - All emails in DB:', items.map((item: any) => item.fields['メールアドレス']));

    const matchedItem = items.find((item: any) => {
        const emailField = item.fields['メールアドレス'];
        // 配列形式の場合: [{ text: 'email@example.com', type: 'text' }]
        if (Array.isArray(emailField) && emailField.length > 0) {
            return emailField[0].text === email;
        }
        // 文字列形式の場合（後方互換性）
        return emailField === email;
    });

    console.log('getUserByEmail - Match found:', matchedItem ? 'Yes' : 'No');

    if (!matchedItem) {
        return null;
    }

    // メールアドレスを正規化
    const emailValue = Array.isArray(matchedItem.fields['メールアドレス'])
        ? matchedItem.fields['メールアドレス'][0].text
        : matchedItem.fields['メールアドレス'];

    // パスワードを正規化（配列形式の場合）
    const passwordField = matchedItem.fields['パスワード'];
    const passwordValue = Array.isArray(passwordField) && passwordField.length > 0
        ? passwordField[0].text
        : passwordField;

    // Lark Bitableのテキストフィールドは配列形式 [{text: 'value', type: 'text'}] で返る
    const userIdField = matchedItem.fields['ユーザーID'];
    const userIdValue = Array.isArray(userIdField) && userIdField.length > 0
        ? userIdField[0].text
        : userIdField;

    const nameField = matchedItem.fields['名前'];
    const nameValue = Array.isArray(nameField) && nameField.length > 0
        ? nameField[0].text
        : nameField;

    return {
        id: userIdValue,
        email: emailValue,
        password: passwordValue || undefined,
        emailVerified: matchedItem.fields['メール認証日'] || null,
        name: nameValue || null,
        image: matchedItem.fields['アイコン画像'] || null,
        createdAt: matchedItem.fields['作成日'],
        updatedAt: matchedItem.fields['更新日'],
    };
}

// IDでユーザーを取得
export async function getUserById(id: string): Promise<User | null> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_USERS_TABLE_ID');

    const response = await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
        {
            field_names: ['ユーザーID', 'メールアドレス', 'パスワード', '名前', 'メール認証日', 'アイコン画像', '作成日', '更新日'],
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );

    if (response.data.code !== 0) {
        return null;
    }

    // クライアント側でIDでフィルタリング（Lark配列形式に対応）
    const items = response.data.data.items || [];
    const matchedItem = items.find((item: any) => {
        const field = item.fields['ユーザーID'];
        const value = Array.isArray(field) && field.length > 0 ? field[0].text : field;
        return value === id;
    });

    if (!matchedItem) {
        return null;
    }

    const userIdField = matchedItem.fields['ユーザーID'];
    const userIdValue = Array.isArray(userIdField) && userIdField.length > 0
        ? userIdField[0].text : userIdField;
    const emailField = matchedItem.fields['メールアドレス'];
    const emailValue = Array.isArray(emailField) && emailField.length > 0
        ? emailField[0].text : emailField;
    const passwordField = matchedItem.fields['パスワード'];
    const passwordValue = Array.isArray(passwordField) && passwordField.length > 0
        ? passwordField[0].text : passwordField;
    const nameField = matchedItem.fields['名前'];
    const nameValue = Array.isArray(nameField) && nameField.length > 0
        ? nameField[0].text : nameField;

    return {
        id: userIdValue,
        email: emailValue,
        password: passwordValue || undefined,
        emailVerified: matchedItem.fields['メール認証日'] || null,
        name: nameValue || null,
        image: matchedItem.fields['アイコン画像'] || null,
        createdAt: matchedItem.fields['作成日'],
        updatedAt: matchedItem.fields['更新日'],
    };
}

// ユーザーを作成
export async function createUser(user: User): Promise<void> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_USERS_TABLE_ID');

    await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records`,
        {
            fields: {
                'ユーザーID': user.id,
                'メールアドレス': user.email,
                'パスワード': user.password || '', // ハッシュ化されたパスワード
                'メール認証日': user.emailVerified || null,
                '名前': user.name || '',
                'アイコン画像': user.image || '',
                '作成日': user.createdAt,
                '更新日': user.updatedAt,
            },
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );
}

// ユーザー情報を更新
export async function updateUser(userId: string, data: Partial<User>): Promise<void> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_USERS_TABLE_ID');

    // まずレコードIDを取得（クライアント側でフィルタリング）
    const searchResponse = await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
        {
            field_names: ['ユーザーID'],
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );

    if (searchResponse.data.code !== 0) {
        throw new Error('User not found');
    }

    const items = searchResponse.data.data.items || [];
    const matchedItem = items.find((item: any) => item.fields['ユーザーID'] === userId);

    if (!matchedItem) {
        throw new Error('User not found');
    }

    const recordId = matchedItem.record_id;

    // レコードを更新
    const updateFields: any = {};
    if (data.name !== undefined) updateFields['名前'] = data.name;
    if (data.email !== undefined) updateFields['メールアドレス'] = data.email;
    if (data.emailVerified !== undefined) updateFields['メール認証日'] = data.emailVerified;
    if (data.image !== undefined) updateFields['アイコン画像'] = data.image;
    if (data.password !== undefined) updateFields['パスワード'] = data.password;
    updateFields['更新日'] = Date.now();

    await axios.put(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/${recordId}`,
        {
            fields: updateFields,
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );
}

/**
 * セッション管理関数
 */

// セッションを作成
export async function createSession(session: Session): Promise<void> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_SESSIONS_TABLE_ID');

    await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records`,
        {
            fields: {
                'セッションID': session.id,
                'userId': session.userId,
                '有効期限': session.expiresAt,
                'トークン': session.token,
                'IPアドレス': session.ipAddress || '',
                'ユーザーエージェント': session.userAgent || '',
                '作成日': session.createdAt,
                '更新日': session.updatedAt,
            },
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );
}

// トークンでセッションを取得
export async function getSessionByToken(sessionToken: string): Promise<Session | null> {
    const accessToken = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_SESSIONS_TABLE_ID');

    const response = await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
        {
            field_names: ['セッションID', 'userId', '有効期限', 'トークン', 'IPアドレス', 'ユーザーエージェント', '作成日', '更新日'],
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    );

    if (response.data.code !== 0) {
        return null;
    }

    // クライアント側でトークンでフィルタリング
    const items = response.data.data.items || [];
    const matchedItem = items.find((item: any) => item.fields['トークン'] === sessionToken);

    if (!matchedItem) {
        return null;
    }

    return {
        id: matchedItem.fields['セッションID'],
        userId: matchedItem.fields['userId'],
        expiresAt: matchedItem.fields['有効期限'],
        token: matchedItem.fields['トークン'],
        ipAddress: matchedItem.fields['IPアドレス'] || null,
        userAgent: matchedItem.fields['ユーザーエージェント'] || null,
        createdAt: matchedItem.fields['作成日'],
        updatedAt: matchedItem.fields['更新日'],
    };
}

// セッションを削除
export async function deleteSession(sessionToken: string): Promise<void> {
    const accessToken = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_SESSIONS_TABLE_ID');

    // まずレコードIDを取得（クライアント側でフィルタリング）
    const searchResponse = await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
        {
            field_names: ['トークン'],
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    );

    if (searchResponse.data.code !== 0) {
        return; // セッションが見つからない場合は何もしない
    }

    const items = searchResponse.data.data.items || [];
    const matchedItem = items.find((item: any) => item.fields['トークン'] === sessionToken);

    if (!matchedItem) {
        return;
    }

    const recordId = matchedItem.record_id;

    // レコードを削除
    await axios.delete(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/${recordId}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    );
}

/**
 * チャット履歴管理関数
 */


// セッションIDでチャットログを取得（ユーザーID検証付き）
export async function getChatLogsBySession(sessionId: string, userId?: string): Promise<ChatLog[]> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_CHATLOG_TABLE_ID');

    const response = await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
        {
            field_names: ['セッションID', 'ユーザーID', 'モード', 'ユーザー入力', 'AI回答', '日時', '評価'],
            sort: [{ field_name: '日時', desc: false }],
        },
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

    // クライアント側でセッションIDでフィルタリング
    const items = response.data.data.items || [];
    console.log(`Found ${items.length} chat logs. Filtering for session: ${sessionId}, userId: ${userId || 'not specified'}`);

    // テキストフィールドから値を抽出するヘルパー関数
    const extractText = (field: any): string => {
        if (!field) return '';
        if (typeof field === 'string') return field;
        if (Array.isArray(field) && field.length > 0) {
            return field[0].text || String(field[0]);
        }
        if (typeof field === 'object') {
            return field.text || String(field);
        }
        return String(field);
    };

    return items
        .filter((item: any) => {
            const rawSessionId = item.fields['セッションID'];
            // セッションIDが配列やオブジェクトの場合も考慮し、文字列化して比較
            let itemSessionId = rawSessionId;
            if (Array.isArray(rawSessionId) && rawSessionId.length > 0) {
                itemSessionId = rawSessionId[0].text || rawSessionId[0];
            } else if (typeof rawSessionId === 'object' && rawSessionId !== null) {
                itemSessionId = rawSessionId.text || String(rawSessionId);
            }

            const sessionMatch = String(itemSessionId) === String(sessionId);
            if (!sessionMatch && items.length < 5) {
                // デバッグ用：マッチしなかった最初の数件のIDをログ出力
                console.log(`Mismatch: DB=${JSON.stringify(rawSessionId)} (parsed: ${itemSessionId}) vs Target=${sessionId}`);
            }

            // ユーザーIDが指定されている場合は、ユーザーIDも一致するか確認
            if (userId && sessionMatch) {
                const itemUserId = extractText(item.fields['ユーザーID']);
                const userMatch = itemUserId === userId;
                if (!userMatch) {
                    console.log(`User ID mismatch: DB='${itemUserId}' vs Request='${userId}' - Access denied`);
                }
                return userMatch;
            }

            return sessionMatch;
        })
        .map((item: any) => {
            return {
                log_id: item.record_id,
                session_id: extractText(item.fields['セッションID']),
                user_id: extractText(item.fields['ユーザーID']),
                mode: extractText(item.fields['モード']),
                user_input: extractText(item.fields['ユーザー入力']),
                ai_response: extractText(item.fields['AI回答']),
                timestamp: item.fields['日時'],
                evaluation: item.fields['評価'] || undefined,
            };
        });
}

// チャットセッションを作成
export async function createChatSession(session: ChatSession): Promise<string> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_CHAT_SESSIONS_TABLE_ID');

    console.log('Creating chat session:', session.session_id);

    try {
        const response = await axios.post(
            `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records`,
            {
                fields: {
                    'セッションID': session.session_id,
                    'ユーザーID': session.user_id,
                    'モード': session.mode,
                    'タイトル': session.title,
                },
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('Chat session created:', response.data);

        if (response.data.code === 0 && response.data.data?.record?.record_id) {
            return response.data.data.record.record_id;
        } else {
            console.error('Failed to create chat session:', response.data);
            throw new Error('Failed to create chat session');
        }
    } catch (error: any) {
        console.error('Error creating chat session:', error);
        console.error('Error response:', error.response?.data);
        throw error;
    }
}

// チャットセッションを更新
export async function updateChatSession(
    sessionId: string,
    updates: Partial<ChatSession>
): Promise<void> {
    const token = await getAccessToken();
    const baseId = env('LARK_BASE_ID');
    const tableId = env('LARK_CHAT_SESSIONS_TABLE_ID');

    // まずレコードIDを取得（クライアント側でフィルタリング）
    const searchResponse = await axios.post(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/search`,
        {
            field_names: ['セッションID'],
        },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );

    if (searchResponse.data.code !== 0) {
        throw new Error('Chat session not found');
    }

    const items = searchResponse.data.data.items || [];
    const matchedItem = items.find((item: any) => {
        const field = item.fields['セッションID'];
        const value = Array.isArray(field) && field.length > 0 ? field[0].text : field;
        return value === sessionId;
    });

    if (!matchedItem) {
        throw new Error('Chat session not found');
    }

    const recordId = matchedItem.record_id;

    // レコードを更新（作成日・更新日は自動フィールドなので書き込まない）
    const updateFields: any = {};
    if (updates.title !== undefined) updateFields['タイトル'] = updates.title;
    if (updates.mode !== undefined) updateFields['モード'] = updates.mode;

    await axios.put(
        `${LARK_API_BASE}/bitable/v1/apps/${baseId}/tables/${tableId}/records/${recordId}`,
        { fields: updateFields },
        {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        }
    );
}
