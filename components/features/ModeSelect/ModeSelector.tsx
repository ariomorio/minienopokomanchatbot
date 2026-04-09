// モード選択カードコンポーネント
import { ChatMode } from '@/types/chat';
import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';

interface ModeSelectorProps {
    onSelectMode: (mode: ChatMode) => void;
    userName?: string;
    onLogout?: () => void;
}

const MODE_OPTIONS: Array<{
    mode: ChatMode;
    title: string;
    description: string;
    icon: ReactNode;
}> = [
        {
            mode: 'concept',
            title: 'コンセプト設計',
            description: '「誰に、何を、どう発信するか」を明確にします',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-yellow-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-4.5 6.01 6.01 0 00-1.5-4.5 6.01 6.01 0 00-1.5 4.5 6.01 6.01 0 001.5 4.5zM13.5 18v1.5a1.5 1.5 0 01-1.5 1.5h-3a1.5 1.5 0 01-1.5-1.5V18" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 18H8.25" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l.01-1.5a3 3 0 016 0L15 9" />
                    <defs>
                        <linearGradient id="gradient-bulb" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#d97706" />
                        </linearGradient>
                    </defs>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-3.18 0-5.75 2.57-5.75 5.75 0 2.2 1.25 4.14 3.1 5.08A2.25 2.25 0 0011.25 15h1.5a2.25 2.25 0 001.9-1.92c1.85-.94 3.1-2.88 3.1-5.08 0-3.18-2.57-5.75-5.75-5.75z" fill="url(#gradient-bulb)" className="opacity-20" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-3.18 0-5.75 2.57-5.75 5.75 0 2.2 1.25 4.14 3.1 5.08A2.25 2.25 0 0011.25 15h1.5a2.25 2.25 0 001.9-1.92c1.85-.94 3.1-2.88 3.1-5.08 0-3.18-2.57-5.75-5.75-5.75z" />
                </svg>
            ),
        },
        {
            mode: 'analysis',
            title: '自己分析',
            description: 'コーチング的な深掘りで内面を引き出します',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    <defs>
                        <linearGradient id="gradient-search" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#60a5fa" />
                            <stop offset="100%" stopColor="#2563eb" />
                        </linearGradient>
                    </defs>
                    <circle cx="10.5" cy="10.5" r="7.5" fill="url(#gradient-search)" className="opacity-20" />
                </svg>
            ),
        },
        {
            mode: 'strategy',
            title: '戦略設計',
            description: '具体的なアクションプランを作成します',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-purple-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
                    <defs>
                        <linearGradient id="gradient-target" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#a855f7" />
                            <stop offset="100%" stopColor="#7c3aed" />
                        </linearGradient>
                    </defs>
                    <path d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" fill="url(#gradient-target)" className="opacity-10" />
                </svg>
            ),
        },
    ];

export default function ModeSelect({ onSelectMode, userName, onLogout }: ModeSelectorProps) {
    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col relative overflow-hidden">
            {/* Background Ambient Glow */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>

            {/* Header Bar */}
            {userName && (
                <header className="sticky top-0 z-20 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800">
                    <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto w-full">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                {typeof userName === 'string' && userName.length > 0 ? userName.charAt(0).toUpperCase() : '?'}
                            </div>
                            <span className="text-sm text-neutral-300 truncate max-w-[120px] md:max-w-none">{userName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link
                                href="/admin"
                                className="border border-neutral-800 rounded-full px-3 py-1.5 text-xs md:text-sm text-neutral-400 hover:text-purple-400 hover:border-purple-700 transition-all whitespace-nowrap"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 md:w-4 md:h-4 inline-block mr-0.5 md:mr-1">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                管理画面
                            </Link>
                            {onLogout && (
                                <button
                                    onClick={onLogout}
                                    className="border border-neutral-800 rounded-full px-3 py-1.5 text-xs md:text-sm text-neutral-400 hover:text-red-400 hover:border-red-700 transition-all whitespace-nowrap"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5 md:w-4 md:h-4 inline-block mr-0.5 md:mr-1">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                                    </svg>
                                    ログアウト
                                </button>
                            )}
                        </div>
                    </div>
                </header>
            )}

            <div className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-5xl w-full relative z-10">
                <div className="text-center mb-16">
                    <div className="inline-block p-1 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mb-6 shadow-2xl shadow-purple-900/50">
                        <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-[#0a0a0a]">
                            <Image
                                src="/images/enopokoman-icon.jpg"
                                alt="えのぽこまん"
                                fill
                                className="object-cover"
                            />
                        </div>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
                        ミニえのぽこまん
                    </h1>
                    <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
                        あなたの思考を拡張する、パーソナルAIパートナー
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {MODE_OPTIONS.map((option) => (
                        <button
                            key={option.mode}
                            onClick={() => onSelectMode(option.mode)}
                            className="group relative bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-3xl p-8 hover:bg-neutral-800 transition-all duration-300 hover:-translate-y-2 text-left"
                        >
                            <div className="w-12 h-12 bg-neutral-800 rounded-2xl flex items-center justify-center text-2xl mb-6 group-hover:scale-110 transition-transform duration-300 border border-neutral-700">
                                {option.icon}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3 group-hover:text-purple-400 transition-colors">
                                {option.title}
                            </h3>
                            <p className="text-neutral-400 text-sm leading-relaxed">
                                {option.description}
                            </p>

                            {/* Hover Border Gradient */}
                            <div className="absolute inset-0 rounded-3xl border-2 border-transparent group-hover:border-purple-500/30 transition-colors duration-300 pointer-events-none" />
                        </button>
                    ))}
                </div>
            </div>
            </div>
        </div>
    );
}
