"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface ChatSessionItem {
    session_id: string;
    user_id: string;
    mode: string;
    title: string;
    created_at: number;
    updated_at: number;
}

interface ChatLog {
    log_id: string;
    session_id: string;
    user_id: string;
    mode: string;
    user_input: string;
    ai_response: string;
    timestamp: number;
    evaluation: string | null;
}

function ConversationsPageInner() {
    const searchParams = useSearchParams();
    const selectedSessionId = searchParams.get("session");

    const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
    const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getSecret = () => localStorage.getItem("admin_cron_secret") || "";

    const loadSessions = async () => {
        const secret = getSecret();
        if (!secret) { setError("CRON SECRETを入力してください"); return; }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/conversations", {
                headers: { Authorization: `Bearer ${secret}` },
            });
            const json = await res.json();
            if (json.success) setSessions(json.data);
            else setError(json.error);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const loadChatLogs = async (sessionId: string) => {
        const secret = getSecret();
        if (!secret) return;
        setLoadingLogs(true);
        try {
            const res = await fetch(`/api/admin/conversations?session_id=${sessionId}`, {
                headers: { Authorization: `Bearer ${secret}` },
            });
            const json = await res.json();
            if (json.success) setChatLogs(json.data);
        } catch (e: any) { console.error(e); }
        finally { setLoadingLogs(false); }
    };

    useEffect(() => { loadSessions(); }, []);

    useEffect(() => {
        if (selectedSessionId) loadChatLogs(selectedSessionId);
    }, [selectedSessionId]);

    const formatDate = (ts: number) => {
        if (!ts) return "-";
        return new Date(ts).toLocaleDateString("ja-JP", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });
    };

    if (selectedSessionId) {
        const session = sessions.find(s => s.session_id === selectedSessionId);
        return (
            <div className="p-4 md:p-6">
                <div className="flex items-center gap-3 mb-4 md:mb-6">
                    <Link href="/admin/conversations"
                        className="text-neutral-400 hover:text-white text-xs md:text-sm border border-neutral-700 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors flex-shrink-0">
                        ← 戻る
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-base md:text-xl font-bold text-white truncate">{session?.title || "会話詳細"}</h1>
                        <p className="text-neutral-500 text-xs truncate">モード: {session?.mode}</p>
                    </div>
                </div>

                {loadingLogs ? (
                    <div className="text-neutral-400 text-center py-10">読み込み中...</div>
                ) : chatLogs.length === 0 ? (
                    <div className="text-neutral-500 text-center py-10">メッセージがありません</div>
                ) : (
                    <div className="space-y-3 md:space-y-4 max-w-3xl">
                        {chatLogs.map((log) => (
                            <div key={log.log_id}>
                                <div className="flex justify-end mb-2">
                                    <div className="bg-purple-600/20 border border-purple-500/30 rounded-2xl rounded-tr-md px-3 py-2.5 md:px-4 md:py-3 max-w-[85%] md:max-w-[80%]">
                                        <div className="text-[10px] md:text-xs text-purple-400 mb-1">ユーザー</div>
                                        <div className="text-white text-xs md:text-sm whitespace-pre-wrap">{log.user_input}</div>
                                        <div className="text-[10px] md:text-xs text-neutral-500 mt-1.5">{formatDate(log.timestamp)}</div>
                                    </div>
                                </div>
                                <div className="flex justify-start mb-2">
                                    <div className="bg-neutral-800/50 border border-neutral-700 rounded-2xl rounded-tl-md px-3 py-2.5 md:px-4 md:py-3 max-w-[85%] md:max-w-[80%]">
                                        <div className="text-[10px] md:text-xs text-cyan-400 mb-1">AI</div>
                                        <div className="text-neutral-200 text-xs md:text-sm whitespace-pre-wrap">{log.ai_response}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-white">会話履歴</h1>
                    <p className="text-neutral-400 text-xs md:text-sm mt-1">チャットセッション一覧</p>
                </div>
                <button onClick={loadSessions} disabled={loading}
                    className="px-3 py-2 md:px-4 bg-purple-600 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors">
                    {loading ? "読込中..." : "更新"}
                </button>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            <div className="space-y-2">
                {sessions.map((session) => (
                    <Link key={session.session_id}
                        href={`/admin/conversations?session=${session.session_id}`}
                        className="block bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 rounded-xl p-3 md:p-4 transition-colors">
                        <div className="text-white text-sm font-medium truncate">{session.title}</div>
                        <div className="flex items-center justify-between mt-1.5">
                            <span className="bg-purple-900/30 border border-purple-700/30 text-purple-300 text-xs px-2 py-0.5 rounded-full">{session.mode}</span>
                            <span className="text-neutral-500 text-xs">{formatDate(session.updated_at)}</span>
                        </div>
                    </Link>
                ))}
                {sessions.length === 0 && !loading && (
                    <div className="text-center py-20">
                        <div className="text-4xl mb-4">💬</div>
                        <p className="text-neutral-400">セッションがありません</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ConversationsPage() {
    return (
        <Suspense fallback={<div className="p-6 text-neutral-400">読み込み中...</div>}>
            <ConversationsPageInner />
        </Suspense>
    );
}
