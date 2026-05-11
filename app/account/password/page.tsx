'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (newPassword !== confirmPassword) {
            setError('新しいパスワードと確認用パスワードが一致しません');
            return;
        }
        if (newPassword.length < 8) {
            setError('パスワードは8文字以上である必要があります');
            return;
        }
        if (!/[0-9]/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
            setError('パスワードは英字と数字を含む必要があります');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'パスワードの変更に失敗しました');
                setIsLoading(false);
                if (response.status === 401 && data.error === 'ログインが必要です') {
                    setTimeout(() => router.push('/login'), 1500);
                }
                return;
            }

            setSuccess(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setIsLoading(false);
        } catch {
            setError('パスワードの変更に失敗しました。もう一度お試しください。');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-white mb-2">パスワード変更</h1>
                    <p className="text-neutral-400 text-sm">新しいパスワードを設定してください</p>
                </div>

                <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-3xl p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error ? (
                            <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        ) : null}
                        {success ? (
                            <div className="bg-green-900/20 border border-green-800 text-green-400 px-4 py-3 rounded-lg text-sm">
                                パスワードを変更しました。次回のログインから新しいパスワードを使ってください。
                            </div>
                        ) : null}

                        <div>
                            <label htmlFor="currentPassword" className="block text-sm font-medium text-neutral-300 mb-2">
                                現在のパスワード
                            </label>
                            <input
                                id="currentPassword"
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                className="w-full px-4 py-3 bg-neutral-800 text-white placeholder-neutral-500 rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                                placeholder="現在のパスワード（または管理者発行の一時パスワード）"
                            />
                        </div>

                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-neutral-300 mb-2">
                                新しいパスワード
                            </label>
                            <input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                                minLength={8}
                                className="w-full px-4 py-3 bg-neutral-800 text-white placeholder-neutral-500 rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                                placeholder="8文字以上、英字と数字を含む"
                            />
                            <p className="text-xs text-neutral-500 mt-1">
                                8文字以上 / 英字と数字を必ず含めてください
                            </p>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-300 mb-2">
                                新しいパスワード（確認）
                            </label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                autoComplete="new-password"
                                minLength={8}
                                className="w-full px-4 py-3 bg-neutral-800 text-white placeholder-neutral-500 rounded-lg border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                                placeholder="同じパスワードをもう一度"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/30"
                        >
                            {isLoading ? '変更中...' : 'パスワードを変更'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link
                            href="/"
                            className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                        >
                            ← トップに戻る
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
