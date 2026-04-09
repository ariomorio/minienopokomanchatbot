// チャット関連の型定義
export type ChatMode = 'concept' | 'analysis' | 'strategy';

export interface Message {
    role: 'user' | 'model';
    content: string;
}

export interface ChatRequest {
    message: string;
    mode: ChatMode;
    history: Message[];
    sessionId: string;
    userId?: string;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}
