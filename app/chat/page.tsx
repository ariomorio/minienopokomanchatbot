'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ChatMessage from '@/components/features/Chat/ChatMessage';
import ChatInput from '@/components/features/Chat/ChatInput';
import ThinkingIndicator from '@/components/features/Chat/ThinkingIndicator';
import ConnectionStatus from '@/components/features/Chat/ConnectionStatus';
import Sidebar from '@/components/layout/Sidebar';
import { Message, ChatMode } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';

// モード別テーマ設定
const MODE_THEMES = {
    concept: {
        name: 'コンセプト設計',
        icon: '✨',
        description: '独自のコンセプトを創り出す',
        mainColor: 'purple-600',
        borderColor: 'border-purple-500/50',
        bgGlow: 'from-purple-900/20 via-transparent to-transparent',
        headerBg: 'bg-purple-900/30',
        accentRing: 'ring-purple-500/30',
    },
    analysis: {
        name: '自己分析',
        icon: '🔍',
        description: '内面を深く掘り下げる',
        mainColor: 'cyan-600',
        borderColor: 'border-cyan-500/50',
        bgGlow: 'from-cyan-900/20 via-transparent to-transparent',
        headerBg: 'bg-cyan-900/30',
        accentRing: 'ring-cyan-500/30',
    },
    strategy: {
        name: '戦略設計',
        icon: '🚀',
        description: '成長戦略を設計する',
        mainColor: 'amber-600',
        borderColor: 'border-amber-500/50',
        bgGlow: 'from-amber-900/20 via-transparent to-transparent',
        headerBg: 'bg-amber-900/30',
        accentRing: 'ring-amber-500/30',
    },
} as const;

function ChatContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const mode = (searchParams.get('mode') as ChatMode) || 'concept';
    const theme = MODE_THEMES[mode] || MODE_THEMES.concept;

    const [messages, setMessages] = useState<Message[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [debugLog, setDebugLog] = useState<string | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars

    // URLのパラメータからセッションIDを取得
    const urlSessionId = searchParams.get('session');

    // 現在のセッションID（URLパラメータがあればそれを使用、なければ常に新規セッション）
    const [sessionId, setSessionId] = useState<string>(() => {
        if (urlSessionId) return urlSessionId;
        return uuidv4();
    });

    // 初期メッセージ定義
    const INITIAL_MESSAGES: Record<ChatMode, string> = {
        concept:
            '前提条件を確認します。以下の項目を入力してください。\n\n1. ターゲット属性（誰に）\n\n2. 提供サービス（何を）\n\n3. 解決する悩み',
        analysis:
            '前提条件を確認します。以下の項目について入力してください。\n\n・現在抱えているモヤモヤや、壁に感じていること（率直な気持ち）',
        strategy:
            '前提条件を確認します。現状把握のため、以下の項目を入力してください。\n\n1.現在のフォロワー数\n\n2.現状の悩み・課題',
    };

    const loadChatHistory = async (sid: string) => {
        console.log('Fetching history for session:', sid);
        try {
            // ユーザーIDを取得してAPIに渡す（セキュリティ強化：他ユーザーの履歴にアクセスさせない）
            const userStr = localStorage.getItem('user');
            let userId = '';
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    if (typeof user.id === 'string') {
                        userId = user.id;
                    } else if (Array.isArray(user.id) && user.id.length > 0) {
                        userId = user.id[0].text;
                    }
                } catch (e) {
                    console.error('Failed to parse user for history fetch:', e);
                }
            }

            const response = await fetch(`/api/chat/history?sessionId=${sid}`);
            if (response.ok) {
                const logs = await response.json();
                console.log('Fetched logs:', logs.length);
                if (logs.length > 0) {
                    console.log('First log sample:', logs[0]);
                }

                // ログをメッセージ形式に変換
                const historyMessages: Message[] = logs.flatMap((log: any) => {
                    const messages = [];
                    // ユーザー入力があれば追加（文字列化を確実に行う）
                    if (log.user_input) {
                        messages.push({ role: 'user', content: String(log.user_input) });
                    }
                    // AI回答があれば追加（文字列化を確実に行う）
                    if (log.ai_response) {
                        messages.push({ role: 'model', content: String(log.ai_response) });
                    }
                    return messages;
                });

                console.log('Converted messages:', historyMessages.length);

                // 初期メッセージ（AIの最初の質問）を先頭に追加してから履歴を表示
                const initialMsg: Message = { role: 'model', content: INITIAL_MESSAGES[mode] };
                if (historyMessages.length > 0) {
                    setMessages([initialMsg, ...historyMessages]);
                } else {
                    setMessages([initialMsg]);
                }
            } else {
                console.error('Failed to load history, status:', response.status);
                setMessages([{ role: 'model', content: INITIAL_MESSAGES[mode] }]);
            }
        } catch (error) {
            console.error('Error loading history:', error);
            setMessages([{ role: 'model', content: INITIAL_MESSAGES[mode] }]);
        }
    };

    // URLが変わったらセッションIDを更新し、履歴をロード
    useEffect(() => {
        if (urlSessionId) {
            // セッションIDの状態を更新（必要な場合）
            if (urlSessionId !== sessionId) {
                setSessionId(urlSessionId);
            }
            // 履歴をロード（マウント時もここを通るようにする）
            loadChatHistory(urlSessionId);
        }
    }, [urlSessionId]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 認証チェック（localStorage + サーバー側status確認）
    useEffect(() => {
        const user = localStorage.getItem('user');
        if (!user) {
            router.push('/login');
            return;
        }
        // サーバー側で承認状態を確認（セッション一覧APIを利用）
        fetch('/api/sessions').then(res => {
            if (res.status === 401) {
                localStorage.removeItem('user');
                router.push('/login');
            }
        }).catch(() => {});
    }, [router]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking, isConnecting]);

    // モード変更時は常に新規チャットで開始
    useEffect(() => {
        // URLパラメータからセッションIDが指定されている場合は履歴ロードが優先
        if (urlSessionId) return;

        // 新規セッションIDを生成して初期メッセージを表示
        const newSessionId = uuidv4();
        setSessionId(newSessionId);
        setMessages([
            {
                role: 'model',
                content: INITIAL_MESSAGES[mode] || INITIAL_MESSAGES.concept,
            },
        ]);
        setIsConnecting(false);
    }, [mode]);

    // メッセージのlocalStorage保存は不要（履歴はLark Baseサーバー側に保存済み）
    // 過去セッションはサイドバーから ?session=xxx で開くことで復元される

    const handleSendMessage = async (content: string) => {
        // 初期状態（システムメッセージのみ）からのユーザー入力か判定
        // messagesが1件（初期メッセージ）のみの場合、これが最初の回答となる
        const isFirstResponse = messages.length === 1;

        const userMessage: Message = { role: 'user', content };
        setMessages((prev) => [...prev, userMessage]);

        // 思考中フラグの設定
        // 初回応答時は「接続中」を表示、それ以外は通常の「思考中」を表示
        if (isFirstResponse) {
            setIsConnecting(true);
            // 接続演出のために少し待つ（UX向上）
            await new Promise((resolve) => setTimeout(resolve, 2000));
            setIsConnecting(false);
            setIsThinking(true);
        } else {
            setIsThinking(true);
        }

        try {
            // ユーザー情報を取得
            const userStr = localStorage.getItem('user');
            let userId = 'anonymous';

            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    // ユーザーIDを文字列として取得（配列形式にも対応）
                    if (typeof user.id === 'string') {
                        userId = user.id;
                    } else if (Array.isArray(user.id) && user.id.length > 0) {
                        userId = user.id[0].text;
                    } else {
                        console.warn('User ID format not recognized:', user.id);
                        userId = 'anonymous';
                    }
                    console.log('Using userId:', userId); // デバッグログ
                } catch (error) {
                    console.error('Failed to parse user:', error);
                }
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: content,
                    mode,
                    history: messages,
                    sessionId,
                    userId, // ユーザーIDを文字列として送信
                }),
            });

            if (response.status === 401) {
                localStorage.removeItem("user");
                router.push("/login");
                return;
            }
            if (!response.ok) {
                throw new Error('API request failed');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let aiResponse = '';
            let isFirstChunk = true;

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    // 初回応答時、接続演出からの切り替わり直後の処理
                    if (isFirstChunk) {
                        isFirstChunk = false;
                        setIsThinking(false); // レスポンスが来たら思考中を消す
                    }

                    const chunk = decoder.decode(value);
                    aiResponse += chunk;

                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];

                        if (lastMessage?.role === 'model') {
                            lastMessage.content = aiResponse;
                            return newMessages;
                        } else {
                            return [...newMessages, { role: 'model', content: aiResponse }];
                        }
                    });
                }

                // ストリーム完了後、チャットログを保存（別APIで確実に実行）
                if (aiResponse) {
                    fetch('/api/chat/save-log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            sessionId,
                            mode,
                            userMessage: content,
                            aiResponse,
                        }),
                    }).catch((logErr) => console.error('Log save failed:', logErr));
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'model',
                    content: '申し訳ございません。エラーが発生しました。もう一度お試しください。',
                },
            ]);
        } finally {
            setIsThinking(false);
            setIsConnecting(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#0a0a0a] text-neutral-100 font-sans overflow-hidden">
            {/* Sidebar (Left) */}
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main Chat Area (Right) */}
            <div className="flex-1 flex flex-col h-full relative">
                {/* Background Glow Effect */}
                <div className={`absolute inset-0 bg-gradient-to-b ${theme.bgGlow} pointer-events-none`} />

                {/* Mode Header */}
                <div className={`relative z-10 px-4 md:px-6 py-3 md:py-4 border-b border-neutral-800 ${theme.headerBg} backdrop-blur-sm`}>
                    <div className="flex items-center gap-3">
                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="md:hidden p-2 -ml-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/50 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                        </button>
                        <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-lg md:text-xl ring-2 ${theme.accentRing} bg-neutral-800/50 flex-shrink-0`}>
                            {theme.icon}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-base md:text-lg font-semibold text-white truncate">{theme.name}</h1>
                            <p className="text-[11px] md:text-xs text-neutral-400 truncate">{theme.description}</p>
                        </div>
                    </div>
                </div>

                {/* Chat Scroll Area */}
                <div className="relative flex-1 overflow-y-auto px-3 py-4 md:p-6 space-y-4 md:space-y-6 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-500 opacity-60">
                            <div className={`w-16 h-16 rounded-3xl bg-neutral-800 mb-6 flex items-center justify-center shadow-2xl border ${theme.borderColor}`}>
                                <span className="text-2xl">{theme.icon}</span>
                            </div>
                            <p className="text-lg font-medium mb-2 tracking-wide text-neutral-400">ミニえのぽこまん</p>
                            <p className="text-sm font-light">会話を始めて、あなたの可能性を広げましょう。</p>
                        </div>
                    )}

                    {messages.map((message, index) => (
                        <ChatMessage key={index} message={message} mode={mode} />
                    ))}

                    {isConnecting && <ConnectionStatus />}
                    {isThinking && <ThinkingIndicator />}
                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Input Area (Fixed at bottom) */}
                <div className="relative z-10">
                    <ChatInput onSendMessage={handleSendMessage} disabled={isThinking} />
                </div>
            </div>
        </div>
    );
}

export default function ChatPage() {
    return (
        <Suspense
            fallback={
                <div className="flex h-screen items-center justify-center">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">読み込み中...</p>
                    </div>
                </div>
            }
        >
            <ChatContentWrapper />
        </Suspense>
    );
}

function ChatContentWrapper() {
    return <ChatContent />;
}
