// チャットメッセージコンポーネント
import { Message, ChatMode } from '@/types/chat';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';

// モード別のスタイル設定
const MODE_STYLES = {
    concept: {
        userBg: 'bg-gradient-to-br from-purple-600 to-indigo-600',
        userShadow: 'shadow-purple-900/20',
        aiBorder: 'border-purple-500/30',
        avatarShadow: 'shadow-purple-900/20',
    },
    analysis: {
        userBg: 'bg-gradient-to-br from-cyan-600 to-teal-600',
        userShadow: 'shadow-cyan-900/20',
        aiBorder: 'border-cyan-500/30',
        avatarShadow: 'shadow-cyan-900/20',
    },
    strategy: {
        userBg: 'bg-gradient-to-br from-amber-600 to-orange-600',
        userShadow: 'shadow-amber-900/20',
        aiBorder: 'border-amber-500/30',
        avatarShadow: 'shadow-amber-900/20',
    },
} as const;

interface ChatMessageProps {
    message: Message;
    mode?: ChatMode;
}

export default function ChatMessage({ message, mode = 'concept' }: ChatMessageProps) {
    const isUser = message.role === 'user';
    const styles = MODE_STYLES[mode] || MODE_STYLES.concept;

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
            {/* Avatar for AI */}
            {!isUser && (
                <div className={`relative w-8 h-8 rounded-full overflow-hidden mr-3 mt-1 flex-shrink-0 shadow-lg ${styles.avatarShadow} border border-neutral-700`}>
                    <Image src="/images/enopokoman-icon.jpg" alt="EP" fill className="object-cover" />
                </div>
            )}

            <div
                className={`max-w-[88%] md:max-w-[85%] rounded-2xl px-4 py-3 md:px-6 md:py-4 ${isUser
                    ? `${styles.userBg} text-white shadow-lg ${styles.userShadow}`
                    : `bg-neutral-800 text-neutral-100 shadow-md border ${styles.aiBorder}`
                    }`}
            >
                {isUser ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                ) : (
                    <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed">
                        {/* prose-invert is crucial for dark mode markdown */}
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                )}
            </div>
        </div>
    );
}
