"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface UserStat {
    id: string;
    name: string;
    email: string;
    createdAt: number;
    sessionCount: number;
    messageCount: number;
    modes: string[];
    lastActive: number | null;
}

interface RecentSession {
    session_id: string;
    user_id: string;
    mode: string;
    title: string;
    updated_at: number;
}

interface DashboardData {
    totalUsers: number;
    totalSessions: number;
    totalMessages: number;
    users: UserStat[];
    recentSessions: RecentSession[];
}

export default function AdminDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadDashboard = async () => {
        const secret = localStorage.getItem("admin_cron_secret");
        if (!secret) {
            setError("左メニューでCRON SECRETを入力してください");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/dashboard", {
                headers: { Authorization: `Bearer ${secret}` },
            });
            const json = await res.json();
            if (json.success) setData(json.data);
            else setError(json.error || "データ取得失敗");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const secret = localStorage.getItem("admin_cron_secret");
        if (secret) loadDashboard();
    }, []);

    const formatDate = (ts: number | null) => {
        if (!ts) return "-";
        return new Date(ts).toLocaleDateString("ja-JP", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });
    };

    return (
        <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-white">ダッシュボード</h1>
                    <p className="text-neutral-400 text-xs md:text-sm mt-1">ユーザー利用状況の概要</p>
                </div>
                <button onClick={loadDashboard} disabled={loading}
                    className="px-3 py-2 md:px-4 bg-purple-600 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors">
                    {loading ? "読込中..." : "更新"}
                </button>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {data && (
                <>
                    <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6 md:mb-8">
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-3 md:p-6">
                            <div className="text-xl md:text-3xl font-bold text-white">{data.totalUsers}</div>
                            <div className="text-[10px] md:text-sm text-neutral-400 mt-1">登録ユーザー</div>
                        </div>
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-3 md:p-6">
                            <div className="text-xl md:text-3xl font-bold text-purple-400">{data.totalSessions}</div>
                            <div className="text-[10px] md:text-sm text-neutral-400 mt-1">セッション</div>
                        </div>
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-3 md:p-6">
                            <div className="text-xl md:text-3xl font-bold text-cyan-400">{data.totalMessages}</div>
                            <div className="text-[10px] md:text-sm text-neutral-400 mt-1">メッセージ</div>
                        </div>
                    </div>

                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 md:p-6 mb-8">
                        <h2 className="text-base md:text-lg font-semibold text-white mb-4">ユーザー利用状況</h2>
                        {/* Desktop: Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-neutral-700">
                                        <th className="text-left py-3 px-4 text-neutral-400 font-medium">ユーザー</th>
                                        <th className="text-left py-3 px-4 text-neutral-400 font-medium">メール</th>
                                        <th className="text-center py-3 px-4 text-neutral-400 font-medium">セッション数</th>
                                        <th className="text-center py-3 px-4 text-neutral-400 font-medium">メッセージ数</th>
                                        <th className="text-left py-3 px-4 text-neutral-400 font-medium">利用モード</th>
                                        <th className="text-left py-3 px-4 text-neutral-400 font-medium">最終アクティブ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.users.map((user) => (
                                        <tr key={user.id} className="border-b border-neutral-800 hover:bg-neutral-800/30">
                                            <td className="py-3 px-4 text-white">{user.name || "-"}</td>
                                            <td className="py-3 px-4 text-neutral-300">{user.email}</td>
                                            <td className="py-3 px-4 text-center text-white">{user.sessionCount}</td>
                                            <td className="py-3 px-4 text-center text-white">{user.messageCount}</td>
                                            <td className="py-3 px-4">
                                                <div className="flex gap-1 flex-wrap">
                                                    {user.modes.map((mode) => (
                                                        <span key={mode} className="bg-purple-900/30 border border-purple-700/30 text-purple-300 text-xs px-2 py-0.5 rounded-full">{mode}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-neutral-400">{formatDate(user.lastActive)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {/* Mobile: Cards */}
                        <div className="md:hidden space-y-3">
                            {data.users.map((user) => (
                                <div key={user.id} className="bg-neutral-800/30 rounded-lg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-white text-sm font-medium">{user.name || "-"}</span>
                                        <span className="text-neutral-500 text-xs">{formatDate(user.lastActive)}</span>
                                    </div>
                                    <div className="text-neutral-400 text-xs mb-2 truncate">{user.email}</div>
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="text-neutral-300">セッション <span className="text-white font-medium">{user.sessionCount}</span></span>
                                        <span className="text-neutral-300">メッセージ <span className="text-white font-medium">{user.messageCount}</span></span>
                                    </div>
                                    <div className="flex gap-1 flex-wrap mt-2">
                                        {user.modes.map((mode) => (
                                            <span key={mode} className="bg-purple-900/30 border border-purple-700/30 text-purple-300 text-xs px-2 py-0.5 rounded-full">{mode}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 md:p-6">
                        <h2 className="text-base md:text-lg font-semibold text-white mb-4">最近のセッション</h2>
                        <div className="space-y-2">
                            {data.recentSessions.map((session) => (
                                <Link key={session.session_id}
                                    href={`/admin/conversations?session=${session.session_id}`}
                                    className="block bg-neutral-800/30 hover:bg-neutral-800/60 rounded-lg p-3 md:p-4 transition-colors">
                                    <div className="text-white text-sm font-medium truncate">{session.title}</div>
                                    <div className="flex items-center justify-between mt-1">
                                        <div className="text-neutral-500 text-xs truncate mr-2">
                                            モード: {session.mode}
                                        </div>
                                        <div className="text-neutral-500 text-xs flex-shrink-0">{formatDate(session.updated_at)}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {!data && !loading && !error && (
                <div className="text-center py-20">
                    <div className="text-4xl mb-4">📊</div>
                    <p className="text-neutral-400">左メニューでCRON SECRETを入力後、「更新」ボタンを押してください</p>
                </div>
            )}
        </div>
    );
}
