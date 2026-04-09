'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChatMode } from '@/types/chat';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { ChatSession } from '@/types/lark';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
    const searchParams = useSearchParams();
    const currentMode = (searchParams.get('mode') as ChatMode) || 'concept';
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [userInfo, setUserInfo] = useState<{ name: string; email: string } | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const menuItems: { id: ChatMode; label: string }[] = [
        { id: 'concept', label: 'コンセプト設計' },
        { id: 'analysis', label: '自己分析' },
        { id: 'strategy', label: '戦略設計' },
    ];

    // 初期化処理（履歴とユーザー情報の取得）
    useEffect(() => {
        loadChatHistory();
        loadUserInfo();
    }, []);

    const loadUserInfo = () => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                // ユーザー名フィールドの形式チェック（LarkBaseの配列形式か文字列か）
                let name = 'ユーザー';
                if (typeof user.name === 'string') {
                    name = user.name;
                } else if (Array.isArray(user.name) && user.name.length > 0) {
                    name = typeof user.name[0] === 'string' ? user.name[0] : (user.name[0].text || 'ユーザー');
                }

                // メールも同様にチェック
                let email = '';
                if (typeof user.email === 'string') {
                    email = user.email;
                } else if (Array.isArray(user.email) && user.email.length > 0) {
                    email = typeof user.email[0] === 'string' ? user.email[0] : (user.email[0].text || '');
                }

                setUserInfo({ name, email });
            } catch (error) {
                console.error('Failed to load user info:', error);
            }
        }
    };

    // URLのmodeパラメータを監視して履歴を再ロード
    useEffect(() => {
        if (isMounted && currentMode) {
            loadChatHistory();
        }
    }, [currentMode]);

    const loadChatHistory = async () => {
        setIsLoadingHistory(true);
        try {
            // localStorageからユーザー情報を取得
            const userStr = localStorage.getItem('user');
            if (!userStr) {
                setIsLoadingHistory(false);
                return;
            }

            const user = JSON.parse(userStr);
            // ユーザーIDを文字列として抽出
            let userId: string;
            if (typeof user.id === 'string') {
                userId = user.id;
            } else if (Array.isArray(user.id) && user.id.length > 0) {
                userId = user.id[0].text;
            } else {
                console.error('Invalid user ID format:', user.id);
                setIsLoadingHistory(false);
                return;
            }

            console.log('Loading chat history for user:', userId, 'mode:', currentMode);
            const response = await fetch(`/api/sessions?mode=${encodeURIComponent(currentMode)}`);
            if (response.ok) {
                const data = await response.json();
                console.log('Loaded sessions:', data.length);
                // タイトルなどがオブジェクトでないか確認して修正
                const safeData = data.map((session: any) => ({
                    ...session,
                    session_id: typeof session.session_id === 'string' ? session.session_id : (Array.isArray(session.session_id) ? session.session_id[0]?.text : String(session.session_id)),
                    title: typeof session.title === 'string' ? session.title : (Array.isArray(session.title) ? session.title[0]?.text : '無題の会話'),
                }));
                // 重複排除（念のため）
                const uniqueData = Array.from(new Map(safeData.map((item: any) => [item.session_id, item])).values()) as ChatSession[];
                setChatSessions(uniqueData);
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleLogout = async () => {
        // サーバー側の認証Cookieをクリア
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch (e) {
            // ログアウトAPI失敗してもクライアント側はクリアする
        }
        // localStorageをクリア
        localStorage.clear();
        window.location.href = '/login';
    };

    const handleNewChat = () => {
        const searchParams = new URLSearchParams(window.location.search);
        const mode = searchParams.get('mode') || 'concept';

        // 現在のモードのlocalStorageをクリア（履歴はLarkBaseに保存済み）
        localStorage.removeItem(`chat_session_${mode}`);
        localStorage.removeItem(`chat_messages_${mode}`);

        // sessionパラメータなしのURLに遷移して新しいチャットを開始
        window.location.href = `/chat?mode=${mode}`;
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return '今日';
        if (days === 1) return '昨日';
        if (days < 7) return `${days}日前`;
        return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    };

    if (!isMounted) {
        return null;
    }

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={onClose}
                />
            )}

            <div className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-neutral-900/95 backdrop-blur-md border-r border-neutral-800 flex flex-col h-screen
                transform transition-transform duration-300 ease-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                md:relative md:translate-x-0 md:z-auto
            `}>
            {/* Header */}
            <div className="p-4 border-b border-neutral-800">
                <div className="flex items-center gap-3 mb-4">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-purple-500/50 flex-shrink-0">
                        <Image
                            src="/images/enopokoman-icon.jpg"
                            alt="えのぽこまん"
                            fill
                            sizes="40px"
                            className="object-cover"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-white font-semibold text-sm">ミニえのぽこまん</h2>
                        <p className="text-neutral-400 text-xs">AIチャットボット</p>
                    </div>
                    {/* Mobile close button */}
                    <button
                        onClick={onClose}
                        className="md:hidden p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <button
                    onClick={handleNewChat}
                    className="w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-900/30 text-sm"
                >
                    + 新規チャット
                </button>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 overflow-y-auto px-2 py-2">
                <div className="mb-4">
                    <Link
                        href="/"
                        onClick={onClose}
                        className="block px-3 py-2 rounded-lg text-xs text-center border border-neutral-700 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
                    >
                        ← モード選択に戻る
                    </Link>
                </div>

                {/* Chat History */}
                <div className="space-y-1">
                    <p className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        チャット履歴
                    </p>
                    {isLoadingHistory ? (
                        <div className="px-3 py-2 text-xs text-neutral-600">読み込み中...</div>
                    ) : chatSessions.length > 0 ? (
                        chatSessions.slice(0, 10).map((chatSession) => (
                            <Link
                                key={chatSession.session_id}
                                href={`/chat?mode=${chatSession.mode}&session=${chatSession.session_id}`}
                                onClick={onClose}
                                className="block px-3 py-2 rounded-lg text-sm hover:bg-neutral-800/50 text-neutral-400 hover:text-neutral-200 transition-colors"
                            >
                                <div className="truncate">{chatSession.title}</div>
                                <div className="text-xs text-neutral-600 mt-1">
                                    {formatDate(chatSession.updated_at)}
                                </div>
                            </Link>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-xs text-neutral-600">履歴がありません</div>
                    )}
                </div>
            </nav>

            {/* User Profile Area */}
            <div className="p-4 border-t border-neutral-800">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                        {userInfo?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-xs text-neutral-400 truncate">
                            {userInfo?.name || 'ユーザー'}
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full text-xs text-neutral-500 hover:text-neutral-300 py-2 px-3 rounded-lg hover:bg-neutral-800/50 transition-colors text-left"
                >
                    ログアウト
                </button>
            </div>
        </div>
        </>
    );
}
