'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'ログインに失敗しました');
                setIsLoading(false);
                return;
            }

            // ログイン成功 - セッション情報を保存
            if (typeof window !== 'undefined') {
                localStorage.setItem('user', JSON.stringify(data.user));
            }

            // トップページへリダイレクト
            router.push('/');
            router.refresh();
        } catch (err) {
            setError('ログインに失敗しました。もう一度お試しください。');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-block p-1 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mb-6 shadow-2xl shadow-purple-900/50">
                        <div className="relative w-20 h-20 rounded-full overflow-hidden border-4 border-[#0a0a0a]">
                            <Image
                                src="/images/enopokoman-icon.jpg"
                                alt="えのぽこまん"
                                fill
                                className="object-cover"
                            />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Mini Enopokoman</h1>
                    <p className="text-neutral-400">ログインして会話を始めましょう</p>
                </div>

                {/* Login Form */}
                <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-3xl p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-2">
                                メールアドレス
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="w-full px-4 py-3 bg-neutral-800 text-white placeholder-neutral-500 rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                                placeholder="your@email.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-neutral-300 mb-2">
                                パスワード
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 bg-neutral-800 text-white placeholder-neutral-500 rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/30"
                        >
                            {isLoading ? 'ログイン中...' : 'ログイン'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link
                            href="/register"
                            className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                        >
                            アカウントをお持ちでない方はこちら
                        </Link>
                    </div>
                </div>

                <p className="text-center text-neutral-600 text-sm mt-6">
                    ログインできない場合は、管理者にお問い合わせください
                </p>

                <div className="text-center mt-4">
                    <Link
                        href="/admin"
                        className="text-sm text-neutral-500 hover:text-purple-400 transition-colors"
                    >
                        管理画面はこちら
                    </Link>
                </div>
            </div>
        </div>
    );
}
