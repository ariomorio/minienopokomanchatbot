"use client";

import { useState, useEffect } from "react";

interface UserItem {
    recordId: string;
    id: string;
    email: string;
    name: string | null;
    status: string;
    createdAt: number;
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);
    const [inviteCode, setInviteCode] = useState("");
    const [newInviteCode, setNewInviteCode] = useState("");
    const [savingCode, setSavingCode] = useState(false);
    const [codeMessage, setCodeMessage] = useState<string | null>(null);

    const loadUsers = async () => {
        const secret = localStorage.getItem("admin_cron_secret");
        if (!secret) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/users", {
                headers: { Authorization: `Bearer ${secret}` },
            });
            const json = await res.json();
            if (json.success) setUsers(json.users);
            else setError(json.error);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        const secret = localStorage.getItem("admin_cron_secret");
        if (!secret) return;
        try {
            const res = await fetch("/api/admin/settings", {
                headers: { Authorization: `Bearer ${secret}` },
            });
            const json = await res.json();
            if (json.success) {
                setInviteCode(json.settings.inviteCode);
                setNewInviteCode(json.settings.inviteCode);
            }
        } catch {}
    };

    const saveInviteCode = async () => {
        const secret = localStorage.getItem("admin_cron_secret");
        if (!secret) return;
        setSavingCode(true);
        setCodeMessage(null);
        try {
            const res = await fetch("/api/admin/settings", {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${secret}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ key: "inviteCode", value: newInviteCode }),
            });
            const json = await res.json();
            if (json.success) {
                setInviteCode(newInviteCode);
                setCodeMessage("招待コードを更新しました");
                setTimeout(() => setCodeMessage(null), 3000);
            } else {
                setCodeMessage(`エラー: ${json.error}`);
            }
        } catch (e: any) {
            setCodeMessage(`エラー: ${e.message}`);
        } finally {
            setSavingCode(false);
        }
    };

    useEffect(() => {
        loadUsers();
        loadSettings();
    }, []);

    const handleStatusChange = async (userId: string, status: "approved" | "rejected", userName: string) => {
        const secret = localStorage.getItem("admin_cron_secret");
        if (!secret) return;
        const action = status === "approved" ? "承認" : "拒否";
        if (!confirm(`${userName || userId} を${action}しますか？`)) return;

        setUpdating(userId);
        try {
            const res = await fetch("/api/admin/users", {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${secret}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId, status, userName }),
            });
            const json = await res.json();
            if (json.success) {
                await loadUsers();
            } else {
                alert(`エラー: ${json.error}`);
            }
        } catch (e: any) {
            alert(`エラー: ${e.message}`);
        } finally {
            setUpdating(null);
        }
    };

    const formatDate = (ts: number | null) => {
        if (!ts) return "-";
        return new Date(ts).toLocaleDateString("ja-JP", {
            year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });
    };

    const statusLabel = (status: string) => {
        switch (status) {
            case "approved": return { text: "承認済み", color: "bg-green-900/30 border-green-700/30 text-green-300" };
            case "rejected": return { text: "拒否", color: "bg-red-900/30 border-red-700/30 text-red-300" };
            default: return { text: "承認待ち", color: "bg-yellow-900/30 border-yellow-700/30 text-yellow-300" };
        }
    };

    const pendingUsers = users.filter(u => u.status === "pending");
    const otherUsers = users.filter(u => u.status !== "pending");

    return (
        <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-white">ユーザー管理</h1>
                    <p className="text-neutral-400 text-xs md:text-sm mt-1">登録ユーザーの承認・管理</p>
                </div>
                <button onClick={loadUsers} disabled={loading}
                    className="px-3 py-2 md:px-4 bg-purple-600 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors">
                    {loading ? "読込中..." : "更新"}
                </button>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* 招待コード管理 */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 md:p-6 mb-6">
                <h2 className="text-base md:text-lg font-semibold text-white mb-3">招待コード</h2>
                <p className="text-neutral-400 text-xs mb-3">新規登録時に必要な招待コードを管理します</p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={newInviteCode}
                        onChange={(e) => setNewInviteCode(e.target.value)}
                        className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                        placeholder="招待コードを入力"
                    />
                    <button
                        onClick={saveInviteCode}
                        disabled={savingCode || newInviteCode === inviteCode || !newInviteCode.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                        {savingCode ? "保存中..." : "変更"}
                    </button>
                </div>
                {codeMessage && (
                    <p className={`text-xs mt-2 ${codeMessage.startsWith("エラー") ? "text-red-400" : "text-green-400"}`}>
                        {codeMessage}
                    </p>
                )}
            </div>

            {/* 承認待ちユーザー */}
            {pendingUsers.length > 0 && (
                <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-xl p-4 md:p-6 mb-6">
                    <h2 className="text-base md:text-lg font-semibold text-yellow-300 mb-4">
                        承認待ち ({pendingUsers.length}件)
                    </h2>
                    <div className="space-y-3">
                        {pendingUsers.map((user) => (
                            <div key={user.id} className="bg-neutral-900/50 rounded-lg p-4 flex flex-col md:flex-row md:items-center gap-3">
                                <div className="flex-1">
                                    <div className="text-white font-medium">{user.name || "-"}</div>
                                    <div className="text-neutral-400 text-sm">{user.email}</div>
                                    <div className="text-neutral-500 text-xs mt-1">登録: {formatDate(user.createdAt)}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleStatusChange(user.id, "approved", user.name || "")}
                                        disabled={updating === user.id}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-500 disabled:opacity-50 transition-colors"
                                    >
                                        {updating === user.id ? "処理中..." : "承認"}
                                    </button>
                                    <button
                                        onClick={() => handleStatusChange(user.id, "rejected", user.name || "")}
                                        disabled={updating === user.id}
                                        className="px-4 py-2 bg-red-600/80 text-white rounded-lg text-sm font-medium hover:bg-red-500 disabled:opacity-50 transition-colors"
                                    >
                                        拒否
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 全ユーザー一覧 */}
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 md:p-6">
                <h2 className="text-base md:text-lg font-semibold text-white mb-4">
                    ユーザー一覧 ({users.length}件)
                </h2>
                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-neutral-700">
                                <th className="text-left py-3 px-4 text-neutral-400 font-medium">名前</th>
                                <th className="text-left py-3 px-4 text-neutral-400 font-medium">メール</th>
                                <th className="text-center py-3 px-4 text-neutral-400 font-medium">ステータス</th>
                                <th className="text-left py-3 px-4 text-neutral-400 font-medium">登録日</th>
                                <th className="text-center py-3 px-4 text-neutral-400 font-medium">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...pendingUsers, ...otherUsers].map((user) => {
                                const s = statusLabel(user.status);
                                return (
                                    <tr key={user.id} className="border-b border-neutral-800 hover:bg-neutral-800/30">
                                        <td className="py-3 px-4 text-white">{user.name || "-"}</td>
                                        <td className="py-3 px-4 text-neutral-300">{user.email}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`${s.color} text-xs px-2 py-1 rounded-full border`}>{s.text}</span>
                                        </td>
                                        <td className="py-3 px-4 text-neutral-400">{formatDate(user.createdAt)}</td>
                                        <td className="py-3 px-4 text-center">
                                            {user.status !== "approved" && (
                                                <button
                                                    onClick={() => handleStatusChange(user.id, "approved", user.name || "")}
                                                    disabled={updating === user.id}
                                                    className="px-3 py-1 bg-green-600/80 text-white rounded text-xs hover:bg-green-500 disabled:opacity-50 mr-1"
                                                >
                                                    承認
                                                </button>
                                            )}
                                            {user.status !== "rejected" && (
                                                <button
                                                    onClick={() => handleStatusChange(user.id, "rejected", user.name || "")}
                                                    disabled={updating === user.id}
                                                    className="px-3 py-1 bg-red-600/80 text-white rounded text-xs hover:bg-red-500 disabled:opacity-50"
                                                >
                                                    拒否
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                {/* Mobile */}
                <div className="md:hidden space-y-3">
                    {[...pendingUsers, ...otherUsers].map((user) => {
                        const s = statusLabel(user.status);
                        return (
                            <div key={user.id} className="bg-neutral-800/30 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white text-sm font-medium">{user.name || "-"}</span>
                                    <span className={`${s.color} text-xs px-2 py-0.5 rounded-full border`}>{s.text}</span>
                                </div>
                                <div className="text-neutral-400 text-xs mb-1 truncate">{user.email}</div>
                                <div className="text-neutral-500 text-xs mb-2">登録: {formatDate(user.createdAt)}</div>
                                <div className="flex gap-2">
                                    {user.status !== "approved" && (
                                        <button
                                            onClick={() => handleStatusChange(user.id, "approved", user.name || "")}
                                            disabled={updating === user.id}
                                            className="px-3 py-1 bg-green-600/80 text-white rounded text-xs hover:bg-green-500 disabled:opacity-50"
                                        >
                                            承認
                                        </button>
                                    )}
                                    {user.status !== "rejected" && (
                                        <button
                                            onClick={() => handleStatusChange(user.id, "rejected", user.name || "")}
                                            disabled={updating === user.id}
                                            className="px-3 py-1 bg-red-600/80 text-white rounded text-xs hover:bg-red-500 disabled:opacity-50"
                                        >
                                            拒否
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
