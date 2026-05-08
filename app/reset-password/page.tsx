'use client';

import { useState, FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') || '';

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    if (!token) {
        return (
            <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
                リセットリンクが正しくありません。メールから再度アクセスしてください。
            </div>
        );
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

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
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword }),
            });
            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'パスワードのリセットに失敗しました');
                setIsLoading(false);
                return;
            }
            setSuccess(true);
            setIsLoading(false);
            setTimeout(() => router.push('/login'), 2000);
        } catch {
            setError('パスワードのリセットに失敗しました。もう一度お試しください。');
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="space-y-4">
                <div className="bg-green-900/20 border border-green-800 text-green-400 px-4 py-3 rounded-lg text-sm">
                    パスワードを変更しました。ログイン画面に移動します...
                </div>
                <div className="text-center">
                    <Link href="/login" className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors">
                        ログイン画面へ
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
                <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            ) : null}

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
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-white mb-2">新しいパスワードを設定</h1>
                    <p className="text-neutral-400 text-sm">メールから受け取ったリンクから設定してください</p>
                </div>

                <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-3xl p-8 shadow-2xl">
                    <Suspense fallback={<div className="text-neutral-500 text-sm">読み込み中...</div>}>
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
