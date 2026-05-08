'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/request-password-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'リクエストに失敗しました');
                setIsLoading(false);
                return;
            }
            setSubmitted(true);
            setIsLoading(false);
        } catch {
            setError('リクエストに失敗しました。もう一度お試しください。');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-white mb-2">パスワードをお忘れの方</h1>
                    <p className="text-neutral-400 text-sm">登録済みのメールアドレスにリセット用のリンクをお送りします</p>
                </div>

                <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-3xl p-8 shadow-2xl">
                    {submitted ? (
                        <div className="space-y-4">
                            <div className="bg-green-900/20 border border-green-800 text-green-400 px-4 py-3 rounded-lg text-sm">
                                リセット用リンクをメールでお送りしました。<br />
                                メールが届かない場合は、迷惑メールフォルダもご確認ください。
                            </div>
                            <p className="text-xs text-neutral-500 text-center">
                                ※ 該当アドレスが登録されていない場合もこの画面が表示されます
                            </p>
                            <div className="text-center">
                                <Link
                                    href="/login"
                                    className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                                >
                                    ← ログイン画面に戻る
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error ? (
                                <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            ) : null}

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
                                    autoComplete="email"
                                    className="w-full px-4 py-3 bg-neutral-800 text-white placeholder-neutral-500 rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                                    placeholder="your@email.com"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/30"
                            >
                                {isLoading ? '送信中...' : 'リセットリンクを送信'}
                            </button>

                            <div className="text-center">
                                <Link
                                    href="/login"
                                    className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                                >
                                    ← ログイン画面に戻る
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
