// チャット入力コンポーネント（複数行対応）
'use client';

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';

interface ChatInputProps {
    onSendMessage: (message: string) => void;
    disabled?: boolean;
}

export default function ChatInput({ onSendMessage, disabled }: ChatInputProps) {
    const [input, setInput] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // モバイル判定（タッチデバイスかつ画面幅が小さい場合）
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile('ontouchstart' in window && window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // テキストエリアの高さを自動調整（最大5行分）
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.style.height = 'auto';
        const maxHeight = 160; // 約5行分
        textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }, [input]);

    const handleSubmit = (e?: FormEvent) => {
        e?.preventDefault();
        if (input.trim() && !disabled) {
            onSendMessage(input.trim());
            setInput('');
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        // IME変換中（日本語入力など）はEnterで変換確定のみ、送信しない
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;

        // モバイル: Enterは改行（送信はボタンのみ）
        // PC: Enter で送信、Shift+Enter で改行
        if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="p-4 bg-[#111111] border-t border-neutral-800">
            <div className="max-w-3xl mx-auto">
                <form onSubmit={handleSubmit} className="relative">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                        placeholder="ミニえのぽこまんと話す"
                        maxLength={2000}
                        rows={1}
                        className="w-full px-6 py-4 pr-14 bg-neutral-800 text-white placeholder-neutral-500 rounded-2xl border border-neutral-700 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 disabled:bg-neutral-900 disabled:cursor-not-allowed text-sm transition-all shadow-lg resize-none overflow-y-auto"
                        style={{ maxHeight: '160px' }}
                    />
                    <button
                        type="submit"
                        disabled={disabled || !input.trim()}
                        className="absolute right-3 bottom-3 p-2 bg-purple-600 text-white rounded-full hover:bg-purple-500 disabled:opacity-30 disabled:hover:bg-purple-600 transition-all flex items-center justify-center w-10 h-10 shadow-md"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 ml-0.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                    </button>
                </form>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-neutral-600">
                        {isMobile ? '送信ボタンで送信 / Enterで改行' : 'Shift+Enterで改行 / Enterで送信'}
                    </p>
                </div>
            </div>
        </div>
    );
}
