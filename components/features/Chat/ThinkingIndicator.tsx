// Thinking indicator component
export default function ThinkingIndicator() {
    return (
        <div className="flex justify-start mb-4">
            <div className="bg-white shadow-md rounded-2xl px-6 py-4">
                <div className="flex gap-2 items-center">
                    <div className="flex gap-1">
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-gray-600 ml-2">思考中...</span>
                </div>
            </div>
        </div>
    );
}
