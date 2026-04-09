export default function ConnectionStatus() {
    return (
        <div className="flex justify-start mb-6">
            <div className="bg-neutral-800 shadow-lg border border-neutral-700/50 rounded-2xl px-6 py-4 flex items-center gap-3">
                <div className="relative">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
                    <div className="absolute top-0 left-0 h-5 w-5 rounded-full border-2 border-purple-500/30 opacity-50"></div>
                </div>
                <span className="text-neutral-300 font-medium animate-pulse text-sm">
                    ミニえのぽこまんが接続中...
                </span>
            </div>
        </div>
    );
}
