"use client";

import { useState } from "react";

export default function MeetingsPage() {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        const secret = localStorage.getItem("admin_cron_secret");
        if (!secret) { setError("CRON SECRETを入力してください"); return; }
        if (!title.trim() || !content.trim()) { setError("タイトルと内容を入力してください"); return; }

        setSaving(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch("/api/admin/meetings", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
                body: JSON.stringify({ title: title.trim(), content: content.trim(), date: new Date(date).getTime() }),
            });
            const json = await res.json();
            if (json.success) {
                setResult(json.data.message);
                setTitle("");
                setContent("");
            } else {
                setError(json.error || "保存に失敗しました");
            }
        } catch (e: any) { setError(e.message); }
        finally { setSaving(false); }
    };

    return (
        <div className="p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-white">会議文字起こし</h1>
                <p className="text-neutral-400 text-sm mt-1">
                    会議の文字起こしをLark Baseに保存します。保存後、「ナレッジベース」から同期するとAIの学習データに反映されます。
                </p>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {result && (
                <div className="bg-green-900/20 border border-green-800 rounded-xl p-4 mb-6">
                    <p className="text-green-400 text-sm">{result}</p>
                </div>
            )}

            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 max-w-3xl">
                <div className="mb-4">
                    <label className="block text-sm text-neutral-300 mb-2">タイトル</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                        placeholder="例: 2026年2月 定例ミーティング"
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>

                <div className="mb-4">
                    <label className="block text-sm text-neutral-300 mb-2">日付</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                        className="bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                </div>

                <div className="mb-6">
                    <label className="block text-sm text-neutral-300 mb-2">文字起こし内容</label>
                    <textarea value={content} onChange={(e) => setContent(e.target.value)}
                        placeholder="会議の文字起こしテキストをここに貼り付けてください..."
                        rows={20}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y" />
                    <div className="text-xs text-neutral-500 mt-2">
                        {content.length > 0 ? `${content.length.toLocaleString()} 文字` : ""}
                    </div>
                </div>

                <button onClick={handleSave} disabled={saving || !title.trim() || !content.trim()}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/30">
                    {saving ? "保存中..." : "Lark Baseに保存"}
                </button>

                <p className="text-xs text-neutral-500 mt-4 text-center">
                    保存されたデータはsync_status=pendingで登録されます。「ナレッジベース」ページから手動同期を実行するとPineconeに反映されます。
                </p>
            </div>
        </div>
    );
}
