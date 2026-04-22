// Lark API関連の型定義

// Better Auth用の型定義
export interface User {
  id: string;
  email: string;
  emailVerified?: number | null;
  name?: string | null;
  image?: string | null;
  password?: string; // ハッシュ化されたパスワード
  status?: 'pending' | 'approved' | 'rejected';
  createdAt: number;
  updatedAt: number;
}


export interface Session {
  id: string;
  userId: string;
  expiresAt: number;
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChatSession {
  session_id: string;
  user_id: string;
  mode: 'concept' | 'analysis' | 'strategy';
  title: string;
  created_at: number;
  updated_at: number;
}

// 既存の型定義
export interface KnowledgeSource {
  record_id: string;
  title: string;
  content: string;
  source_type: string;
  url?: string;
  status: 'active' | 'archived';
  created_at: number;
  updated_at?: number;
  // Pinecone同期用フィールド
  pinecone_id?: string;
  sync_status?: 'pending' | 'synced' | 'error';
  last_synced_at?: number;
  chunk_index?: number;
  embedding_model?: string;
  source_file?: string;
}

export interface ChatLog {
  log_id?: string;
  session_id: string;
  user_id: string;
  mode: string;
  user_input: string;
  ai_response: string;
  timestamp: number;
  evaluation?: 'good' | 'bad';
}

export interface LarkResponse<T> {
  code: number;
  msg: string;
  data?: T;
}

export interface LarkAccessTokenResponse {
  tenant_access_token: string;
  expire: number;
}

// Account型（Better Auth用）
export interface Account {
  id: string;
  userId: string;
  accountId: string;
  providerId: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
  createdAt: number;
  updatedAt: number;
}
