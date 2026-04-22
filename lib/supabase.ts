// Supabase クライアント — lib/lark.ts の置き換え
// 同じ関数シグネチャを維持するため、API ルート側の import を書き換えるだけで済む。
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import axios from 'axios';
import {
    KnowledgeSource,
    ChatLog,
    User,
    Session,
    ChatSession,
} from '@/types/lark';

function env(key: string): string {
    return (process.env[key] || '').trim();
}

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
    if (_client) return _client;
    const url = env('SUPABASE_URL') || env('NEXT_PUBLIC_SUPABASE_URL');
    const key = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
        throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です');
    }
    _client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return _client;
}

/**
 * Lark 時代の no-op スタブ。疎通チェックで使われている呼び出しの後方互換用。
 * 常に 'supabase' を返す（使う側は空でないことだけを見ている）。
 */
export async function getAccessToken(): Promise<string> {
    // Supabase への接続確認を兼ねる軽量クエリ
    const { error } = await getClient().from('settings').select('key').limit(1);
    if (error) throw new Error(`Supabase Error: ${error.message}`);
    return 'supabase';
}

// ========== knowledge_sources ==========

export async function fetchKnowledgeRecords(updatedSince?: Date): Promise<KnowledgeSource[]> {
    const client = getClient();
    let query = client.from('knowledge_sources').select('*').eq('status', 'active');
    if (updatedSince) {
        query = query.gt('updated_at', updatedSince.getTime());
    }
    const { data, error } = await query;
    if (error) throw new Error(`Supabase Error: ${error.message}`);
    return (data || []).map(rowToKnowledge);
}

export async function fetchPendingKnowledgeRecords(): Promise<KnowledgeSource[]> {
    const client = getClient();
    const { data, error } = await client
        .from('knowledge_sources')
        .select('*')
        .or('sync_status.is.null,sync_status.eq.pending');
    if (error) throw new Error(`Supabase Error: ${error.message}`);
    return (data || []).map(rowToKnowledge);
}

export async function updateKnowledgeRecord(
    recordId: string,
    updates: Record<string, any>
): Promise<void> {
    const client = getClient();
    // lib/lark.ts は Lark の日本語フィールド名を渡す呼び出し元もあったため、
    // 代表的なキーをマッピング。
    const mapped: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) {
        switch (k) {
            case 'ベクトルID': mapped.pinecone_id = v; break;
            case '同期ステータス': mapped.sync_status = v; break;
            case '最終同期日時': mapped.last_synced_at = v; break;
            case 'チャンク番号': mapped.chunk_index = v; break;
            case '埋め込みモデル': mapped.embedding_model = v; break;
            case 'ソースファイル': mapped.source_file = v; break;
            case '学習ステータス': mapped.status = v === '学習対象' ? 'active' : 'archived'; break;
            case 'タイトル': mapped.title = v; break;
            case '内容': mapped.content = v; break;
            case 'ソース種別': mapped.source_type = v; break;
            case '参照リンク': mapped.url = v; break;
            default: mapped[k] = v; // すでに snake_case で渡された場合
        }
    }
    mapped.updated_at = Date.now();
    const { error } = await client.from('knowledge_sources').update(mapped).eq('record_id', recordId);
    if (error) throw new Error(`Supabase Error: ${error.message}`);
}

export async function createKnowledgeRecord(fields: Record<string, any>): Promise<string> {
    const client = getClient();
    const now = Date.now();
    const row: Record<string, any> = {
        record_id: fields.record_id || cryptoRandomId(),
        title: fields['タイトル'] ?? fields.title ?? '',
        content: fields['内容'] ?? fields.content ?? '',
        source_type: fields['ソース種別'] ?? fields.source_type ?? null,
        url: fields['参照リンク'] ?? fields.url ?? null,
        status: fields.status ?? 'active',
        created_at: fields.created_at ?? now,
        updated_at: fields.updated_at ?? now,
        pinecone_id: fields['ベクトルID'] ?? fields.pinecone_id ?? null,
        sync_status: fields['同期ステータス'] ?? fields.sync_status ?? 'pending',
        last_synced_at: fields['最終同期日時'] ?? fields.last_synced_at ?? null,
        chunk_index: fields['チャンク番号'] ?? fields.chunk_index ?? null,
        embedding_model: fields['埋め込みモデル'] ?? fields.embedding_model ?? null,
        source_file: fields['ソースファイル'] ?? fields.source_file ?? null,
    };
    const { data, error } = await client.from('knowledge_sources').insert(row).select('record_id').single();
    if (error) throw new Error(`Supabase Error: ${error.message}`);
    return data!.record_id as string;
}

function rowToKnowledge(r: any): KnowledgeSource {
    return {
        record_id: r.record_id,
        title: r.title || '',
        content: r.content || '',
        source_type: r.source_type || '',
        url: r.url || undefined,
        status: (r.status === 'archived' ? 'archived' : 'active') as 'active' | 'archived',
        created_at: r.created_at,
        updated_at: r.updated_at ?? undefined,
        pinecone_id: r.pinecone_id || undefined,
        sync_status: r.sync_status || undefined,
        last_synced_at: r.last_synced_at ?? undefined,
        chunk_index: r.chunk_index ?? undefined,
        embedding_model: r.embedding_model || undefined,
        source_file: r.source_file || undefined,
    };
}

// ========== chat_logs ==========

export async function createChatLog(log: ChatLog): Promise<void> {
    const client = getClient();
    const row = {
        log_id: log.log_id || cryptoRandomId(),
        session_id: log.session_id,
        user_id: log.user_id,
        mode: log.mode,
        user_input: log.user_input,
        ai_response: log.ai_response,
        timestamp: log.timestamp,
        evaluation: log.evaluation || null,
    };
    const { error } = await client.from('chat_logs').insert(row);
    if (error) {
        console.error('Failed to create chat log:', error);
        throw new Error(`Supabase Error: ${error.message}`);
    }
}

export async function getChatLogsBySession(sessionId: string, userId?: string): Promise<ChatLog[]> {
    const client = getClient();
    let q = client.from('chat_logs').select('*').eq('session_id', sessionId).order('timestamp', { ascending: true });
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase Error: ${error.message}`);
    return (data || []).map(r => ({
        log_id: r.log_id,
        session_id: r.session_id,
        user_id: r.user_id,
        mode: r.mode,
        user_input: r.user_input || '',
        ai_response: r.ai_response || '',
        timestamp: r.timestamp,
        evaluation: r.evaluation || undefined,
    }));
}

// ========== chat_sessions ==========

export async function getChatSessions(userId: string, mode?: string): Promise<ChatSession[]> {
    const client = getClient();
    let q = client.from('chat_sessions').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    if (mode) q = q.eq('mode', mode);
    const { data, error } = await q;
    if (error) {
        console.error('getChatSessions error:', error);
        return [];
    }
    return (data || []).map(r => ({
        session_id: r.session_id,
        user_id: r.user_id,
        mode: r.mode,
        title: r.title || '無題の会話',
        created_at: r.created_at,
        updated_at: r.updated_at,
    }));
}

export async function createChatSession(session: ChatSession): Promise<string> {
    const client = getClient();
    const now = Date.now();
    const row = {
        session_id: session.session_id,
        user_id: session.user_id,
        mode: session.mode,
        title: session.title,
        created_at: session.created_at || now,
        updated_at: session.updated_at || now,
    };
    const { error } = await client.from('chat_sessions').insert(row);
    if (error) {
        console.error('Error creating chat session:', error);
        throw new Error(`Supabase Error: ${error.message}`);
    }
    return session.session_id;
}

export async function updateChatSession(
    sessionId: string,
    updates: Partial<ChatSession>
): Promise<void> {
    const client = getClient();
    const patch: Record<string, any> = { updated_at: Date.now() };
    if (updates.title !== undefined) patch.title = updates.title;
    if (updates.mode !== undefined) patch.mode = updates.mode;
    const { data, error } = await client
        .from('chat_sessions')
        .update(patch)
        .eq('session_id', sessionId)
        .select('session_id');
    if (error) throw new Error(`Supabase Error: ${error.message}`);
    if (!data || data.length === 0) throw new Error('Chat session not found');
}

// ========== users ==========

function rowToUser(r: any): User {
    return {
        id: r.id,
        email: r.email,
        password: r.password || undefined,
        emailVerified: r.email_verified ?? null,
        name: r.name ?? null,
        image: r.image ?? null,
        status: (r.status as 'pending' | 'approved' | 'rejected') || 'pending',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

export async function getUserByEmail(email: string): Promise<User | null> {
    const client = getClient();
    const { data, error } = await client.from('users').select('*').eq('email', email).maybeSingle();
    if (error) {
        console.error('getUserByEmail error:', error);
        return null;
    }
    return data ? rowToUser(data) : null;
}

export async function getUserById(id: string): Promise<User | null> {
    const client = getClient();
    const { data, error } = await client.from('users').select('*').eq('id', id).maybeSingle();
    if (error) {
        console.error('getUserById error:', error);
        return null;
    }
    return data ? rowToUser(data) : null;
}

export async function createUser(user: User): Promise<void> {
    const client = getClient();
    const row = {
        id: user.id,
        email: user.email,
        password: user.password || null,
        email_verified: user.emailVerified ?? null,
        name: user.name || null,
        image: user.image || null,
        status: user.status || 'pending',
        created_at: user.createdAt,
        updated_at: user.updatedAt,
    };
    const { error } = await client.from('users').insert(row);
    if (error) throw new Error(`Supabase Error: ${error.message}`);
}

export async function getAllUsers(): Promise<(User & { recordId: string })[]> {
    const client = getClient();
    const { data, error } = await client
        .from('users')
        .select('id,email,name,status,created_at,updated_at')
        .order('created_at', { ascending: false });
    if (error) return [];
    return (data || []).map(r => ({
        recordId: r.id,
        id: r.id,
        email: r.email,
        name: r.name || null,
        status: (r.status as 'pending' | 'approved' | 'rejected') || 'pending',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }));
}

export async function updateUserStatus(userId: string, status: 'approved' | 'rejected'): Promise<void> {
    const client = getClient();
    const { error } = await client
        .from('users')
        .update({ status, updated_at: Date.now() })
        .eq('id', userId);
    if (error) throw new Error(`Supabase Error: ${error.message}`);
}

export async function updateUser(userId: string, data: Partial<User>): Promise<void> {
    const client = getClient();
    const patch: Record<string, any> = { updated_at: Date.now() };
    if (data.name !== undefined) patch.name = data.name;
    if (data.email !== undefined) patch.email = data.email;
    if (data.emailVerified !== undefined) patch.email_verified = data.emailVerified;
    if (data.image !== undefined) patch.image = data.image;
    if (data.password !== undefined) patch.password = data.password;
    if (data.status !== undefined) patch.status = data.status;
    const { error } = await client.from('users').update(patch).eq('id', userId);
    if (error) throw new Error(`Supabase Error: ${error.message}`);
}

// ========== settings ==========

export async function getSetting(key: string): Promise<string | null> {
    const client = getClient();
    const { data, error } = await client.from('settings').select('value').eq('key', key).maybeSingle();
    if (error) {
        console.error('getSetting error:', error);
        return null;
    }
    return data?.value ?? null;
}

export async function updateSetting(key: string, value: string): Promise<void> {
    const client = getClient();
    const { error } = await client
        .from('settings')
        .upsert({ key, value, updated_at: Date.now() }, { onConflict: 'key' });
    if (error) throw new Error(`Supabase Error: ${error.message}`);
}

// ========== sessions ==========

export async function createSession(session: Session): Promise<void> {
    const client = getClient();
    const row = {
        id: session.id,
        user_id: session.userId,
        expires_at: session.expiresAt,
        token: session.token,
        ip_address: session.ipAddress || null,
        user_agent: session.userAgent || null,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
    };
    const { error } = await client.from('sessions').insert(row);
    if (error) throw new Error(`Supabase Error: ${error.message}`);
}

export async function getSessionByToken(sessionToken: string): Promise<Session | null> {
    const client = getClient();
    const { data, error } = await client.from('sessions').select('*').eq('token', sessionToken).maybeSingle();
    if (error || !data) return null;
    return {
        id: data.id,
        userId: data.user_id,
        expiresAt: data.expires_at,
        token: data.token,
        ipAddress: data.ip_address ?? null,
        userAgent: data.user_agent ?? null,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
    };
}

export async function deleteSession(sessionToken: string): Promise<void> {
    const client = getClient();
    await client.from('sessions').delete().eq('token', sessionToken);
}

// ========== メール通知 (Resend — 変更なし) ==========

export async function sendEmailNotification(subject: string, message: string): Promise<void> {
    const apiKey = env('RESEND_API_KEY');
    const notifyEmail = env('NOTIFY_EMAIL');
    if (!apiKey || !notifyEmail) {
        console.log('Email notification not configured, skipping');
        return;
    }
    try {
        await axios.post(
            'https://api.resend.com/emails',
            {
                from: 'ミニえのぽこまん <onboarding@resend.dev>',
                to: [notifyEmail],
                subject,
                text: message,
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            }
        );
    } catch (error: any) {
        console.error('Email notification failed:', error.response?.data || error.message);
    }
}

// ========== helpers ==========

function cryptoRandomId(): string {
    // Node 18+ / Edge 両対応
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g: any = globalThis as any;
    if (g.crypto?.randomUUID) return g.crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
