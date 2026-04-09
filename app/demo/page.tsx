'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import Link from 'next/link';
import demoData from '@/docs/demo-multiturn.json';

// モード別テーマ（チャットページと統一）
const MODE_THEMES = {
    concept: {
        name: 'コンセプト設計',
        icon: '\u2728',
        sub: '独自のコンセプトを創り出す',
        userBg: 'bg-gradient-to-br from-purple-600 to-indigo-600',
        userShadow: 'shadow-purple-900/20',
        aiBorder: 'border-purple-500/30',
        headerBg: 'bg-purple-900/30',
        accentRing: 'ring-purple-500/30',
        tabActive: 'bg-purple-600 text-white',
        tabHover: 'hover:bg-purple-900/40',
        bgGlow: 'from-purple-900/20 via-transparent to-transparent',
        pillBg: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    },
    analysis: {
        name: '自己分析',
        icon: '\uD83D\uDD0D',
        sub: '内面を深く掘り下げる',
        userBg: 'bg-gradient-to-br from-cyan-600 to-teal-600',
        userShadow: 'shadow-cyan-900/20',
        aiBorder: 'border-cyan-500/30',
        headerBg: 'bg-cyan-900/30',
        accentRing: 'ring-cyan-500/30',
        tabActive: 'bg-cyan-600 text-white',
        tabHover: 'hover:bg-cyan-900/40',
        bgGlow: 'from-cyan-900/20 via-transparent to-transparent',
        pillBg: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    },
    strategy: {
        name: '戦略設計',
        icon: '\uD83D\uDE80',
        sub: '成長戦略を設計する',
        userBg: 'bg-gradient-to-br from-amber-600 to-orange-600',
        userShadow: 'shadow-amber-900/20',
        aiBorder: 'border-amber-500/30',
        headerBg: 'bg-amber-900/30',
        accentRing: 'ring-amber-500/30',
        tabActive: 'bg-amber-600 text-white',
        tabHover: 'hover:bg-amber-900/40',
        bgGlow: 'from-amber-900/20 via-transparent to-transparent',
        pillBg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    },
} as const;

type ModeKey = keyof typeof MODE_THEMES;

interface DemoMessage {
    role: 'ai' | 'user';
    content: string;
}

interface DemoScenario {
    mode: string;
    label: string;
    icon: string;
    headerName: string;
    headerSub: string;
    messages: DemoMessage[];
}

export default function DemoPage() {
    const scenarios = demoData as DemoScenario[];
    const [activeTab, setActiveTab] = useState(0);
    const current = scenarios[activeTab];
    const mode = (current?.mode || 'concept') as ModeKey;
    const theme = MODE_THEMES[mode] || MODE_THEMES.concept;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-neutral-100">
            {/* Hero Header */}
            <header className="relative overflow-hidden border-b border-neutral-800">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-cyan-900/10 pointer-events-none" />
                <div className="relative max-w-4xl mx-auto px-4 py-8 md:py-12">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden">
                            <Image src="/images/enopokoman-icon.jpg" alt="EP" width={40} height={40} className="object-cover" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                                ミニえのぽこまん
                                <span className="text-neutral-500 font-normal text-sm ml-2">Demo</span>
                            </h1>
                        </div>
                    </div>
                    <p className="text-neutral-400 text-sm md:text-base leading-relaxed max-w-2xl">
                        3つのモードで、あなたのビジネスの課題を深く掘り下げます。
                        以下は実際のAIとの会話例です。
                    </p>
                </div>
            </header>

            {/* Scenario Tabs */}
            <div className="sticky top-0 z-30 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-neutral-800">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="flex gap-1 py-2 overflow-x-auto scrollbar-none">
                        {scenarios.map((sc, i) => {
                            const m = (sc.mode || 'concept') as ModeKey;
                            const t = MODE_THEMES[m] || MODE_THEMES.concept;
                            const isActive = i === activeTab;
                            return (
                                <button
                                    key={i}
                                    onClick={() => setActiveTab(i)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                                        isActive
                                            ? `${t.tabActive} shadow-lg`
                                            : `text-neutral-400 ${t.tabHover}`
                                    }`}
                                >
                                    <span className="text-base">{sc.icon}</span>
                                    <span className="hidden sm:inline">{sc.headerName}:</span>
                                    <span>{sc.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Chat Frame */}
            <main className="max-w-4xl mx-auto px-4 py-6">
                {/* Mode Header (mimics chat page) */}
                <div className={`rounded-t-2xl border border-neutral-800 ${theme.headerBg} backdrop-blur-sm px-4 py-3 md:px-6 md:py-4`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-lg md:text-xl ring-2 ${theme.accentRing} bg-neutral-800/50 flex-shrink-0`}>
                            {current?.icon}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base md:text-lg font-semibold text-white truncate">{current?.headerName}</h2>
                            <p className="text-[11px] md:text-xs text-neutral-400 truncate">{current?.headerSub}</p>
                        </div>
                        <div className="ml-auto">
                            <span className={`text-[10px] md:text-xs px-2.5 py-1 rounded-full border ${theme.pillBg}`}>
                                {current?.label}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Messages Area */}
                <div className={`relative border-x border-neutral-800 bg-[#0a0a0a] overflow-hidden`}>
                    <div className={`absolute inset-0 bg-gradient-to-b ${theme.bgGlow} pointer-events-none`} />
                    <div className="relative px-3 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6">
                        {current?.messages.map((msg, idx) => {
                            const isUser = msg.role === 'user';
                            return (
                                <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                    {/* AI Avatar */}
                                    {!isUser && (
                                        <div className="relative w-7 h-7 md:w-8 md:h-8 rounded-full overflow-hidden mr-2 md:mr-3 mt-1 flex-shrink-0 shadow-lg border border-neutral-700">
                                            <Image src="/images/enopokoman-icon.jpg" alt="EP" fill className="object-cover" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[88%] md:max-w-[85%] rounded-2xl px-4 py-3 md:px-6 md:py-4 ${
                                            isUser
                                                ? `${theme.userBg} text-white shadow-lg ${theme.userShadow}`
                                                : `bg-neutral-800 text-neutral-100 shadow-md border ${theme.aiBorder}`
                                        }`}
                                    >
                                        {isUser ? (
                                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                                        ) : (
                                            <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
                                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom Bar (mimics input area) */}
                <div className="rounded-b-2xl border border-t-0 border-neutral-800 bg-[#111111] px-4 py-4 md:px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 px-4 py-3 bg-neutral-800 rounded-2xl border border-neutral-700 text-neutral-500 text-sm select-none">
                            ミニえのぽこまんと話す
                        </div>
                        <div className="p-2 bg-purple-600/40 text-white/40 rounded-full w-10 h-10 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 ml-0.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* CTA */}
                <div className="mt-8 text-center">
                    <p className="text-neutral-500 text-sm mb-4">
                        実際にミニえのぽこまんと会話してみませんか？
                    </p>
                    <Link
                        href="/register"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-medium text-sm hover:from-purple-500 hover:to-indigo-500 transition-all shadow-lg shadow-purple-900/30"
                    >
                        無料で試してみる
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                    </Link>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-neutral-800 mt-12 py-6 text-center text-neutral-600 text-xs">
                <p>Mini Enopokoman &mdash; AI-Powered SNS Consulting</p>
            </footer>
        </div>
    );
}
