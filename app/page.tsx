'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ModeSelector from '@/components/features/ModeSelect/ModeSelector';
import { ChatMode } from '@/types/chat';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    // localStorageからユーザー情報を確認
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/login');
    } else {
      setIsAuthenticated(true);
      try {
        const user = JSON.parse(userStr);
        // Lark Baseのリッチテキスト形式に対応: [{ text: "...", type: "text" }]
        const extractText = (field: unknown): string => {
          if (!field) return '';
          if (typeof field === 'string') return field;
          if (Array.isArray(field) && field.length > 0) return field[0].text || '';
          if (typeof field === 'object' && field !== null && 'text' in field) return (field as { text: string }).text;
          return String(field);
        };
        setUserName(extractText(user.name) || extractText(user.email) || '');
      } catch {
        setUserName('');
      }
    }
    setIsLoading(false);
  }, [router]);

  const handleSelectMode = (mode: ChatMode) => {
    // モードをクエリパラメータとして渡してチャットページへ遷移
    router.push(`/chat?mode=${mode}`);
  };

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem("user");
    router.push("/login");
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-neutral-400">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <ModeSelector
      onSelectMode={handleSelectMode}
      userName={userName}
      onLogout={handleLogout}
    />
  );
}
