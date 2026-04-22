"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const navItems = [
    { href: "/admin", label: "ダッシュボード", icon: "📊" },
    { href: "/admin/users", label: "ユーザー管理", icon: "👥" },
    { href: "/admin/conversations", label: "会話履歴", icon: "💬" },
    { href: "/admin/knowledge", label: "ナレッジベース", icon: "📚" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [cronSecret, setCronSecret] = useState("");
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [secretInput, setSecretInput] = useState("");
    const [authError, setAuthError] = useState("");
    const [isChecking, setIsChecking] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem("admin_cron_secret");
        if (saved) {
            setCronSecret(saved);
            verifySecret(saved);
        } else {
            setIsChecking(false);
        }
    }, []);

    // ページ遷移時にサイドバーを閉じる
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    const verifySecret = async (secret: string) => {
        setIsChecking(true);
        try {
            const res = await fetch("/api/admin/dashboard", {
                headers: { Authorization: "Bearer " + secret },
            });
            if (res.ok) {
                setIsAuthenticated(true);
                setCronSecret(secret);
                localStorage.setItem("admin_cron_secret", secret);
            } else {
                setIsAuthenticated(false);
                localStorage.removeItem("admin_cron_secret");
                setAuthError("シークレットが正しくありません");
            }
        } catch {
            setAuthError("接続エラーが発生しました");
        }
        setIsChecking(false);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError("");
        if (!secretInput.trim()) {
            setAuthError("シークレットを入力してください");
            return;
        }
        await verifySecret(secretInput.trim());
    };

    const handleLogout = () => {
        localStorage.removeItem("admin_cron_secret");
        setCronSecret("");
        setIsAuthenticated(false);
        setSecretInput("");
    };

    if (isChecking) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-neutral-400 text-sm">認証確認中...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
                <div className="w-full max-w-sm">
                    <div className="text-center mb-8">
                        <div className="text-4xl mb-4">🔐</div>
                        <h1 className="text-2xl font-bold text-white mb-2">管理画面</h1>
                        <p className="text-neutral-400 text-sm">アクセスするにはシークレットを入力してください</p>
                    </div>
                    <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-2xl p-6">
                        <form onSubmit={handleLogin} className="space-y-4">
                            {authError && (
                                <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
                                    {authError}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-2">
                                    管理者シークレット
                                </label>
                                <input
                                    type="password"
                                    value={secretInput}
                                    onChange={(e) => setSecretInput(e.target.value)}
                                    placeholder="シークレットを入力"
                                    className="w-full px-4 py-3 bg-neutral-800 text-white placeholder-neutral-500 rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-900/30"
                            >
                                ログイン
                            </button>
                        </form>
                    </div>
                    <div className="text-center mt-6">
                        <Link href="/login" className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
                            ← ユーザーログインに戻る
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 flex flex-col md:flex-row">
            {/* Mobile Top Bar */}
            <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-sm sticky top-0 z-30">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 -ml-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/50 transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                </button>
                <h1 className="text-sm font-semibold text-white">管理画面</h1>
                <div className="w-9" /> {/* spacer for centering */}
            </div>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-neutral-900/95 backdrop-blur-md border-r border-neutral-800 flex flex-col
                transform transition-transform duration-300 ease-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                md:relative md:translate-x-0 md:z-auto md:bg-neutral-900/50
            `}>
                <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-white">管理画面</h1>
                        <p className="text-neutral-500 text-xs mt-1">Mini Enopokoman Admin</p>
                    </div>
                    {/* Mobile close button */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="md:hidden p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <nav className="flex-1 p-3 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                    isActive
                                        ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                                        : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                                }`}
                            >
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-4 border-t border-neutral-800">
                    <button
                        onClick={handleLogout}
                        className="w-full text-xs text-neutral-500 hover:text-red-400 py-2 px-3 rounded-lg hover:bg-neutral-800/50 transition-colors"
                    >
                        管理画面からログアウト
                    </button>
                </div>
                <div className="p-4 border-t border-neutral-800">
                    <Link
                        href="/"
                        onClick={() => setSidebarOpen(false)}
                        className="block text-xs text-center text-neutral-500 hover:text-white py-2 px-3 rounded-lg hover:bg-neutral-800 transition-colors"
                    >
                        ← トップに戻る
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto min-w-0">
                {children}
            </main>
        </div>
    );
}
