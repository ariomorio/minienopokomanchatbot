"use client";

import { useState, useEffect, useRef } from "react";

interface IngestResult {
    filename: string;
    chunks: number;
    synced: number;
    errors: string[];
}

interface StatusData {
    total: number;
    synced: number;
    pending: number;
    error: number;
    no_status: number;
    by_source_type: Record<string, number>;
    by_source_file: Record<string, number>;
}

type InputTab = "file" | "text";

export default function KnowledgePage() {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [status, setStatus] = useState<StatusData | null>(null);
    const [isLoadingStatus, setIsLoadingStatus] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [sourceType, setSourceType] = useState("video_transcript");
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResults, setUploadResults] = useState<IngestResult[] | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [inputTab, setInputTab] = useState<InputTab>("text");
    const [textTitle, setTextTitle] = useState("");
    const [textContent, setTextContent] = useState("");

    const getSecret = () => localStorage.getItem("admin_cron_secret") || "";

    const loadStatus = async () => {
        const secret = getSecret();
        if (!secret) { setError("CRON SECRETを左メニューで入力してください"); return; }
        setIsLoadingStatus(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/status", {
                headers: { Authorization: `Bearer ${secret}` },
            });
            const data = await res.json();
            if (data.success) setStatus(data.data);
            else setError(data.error || "ステータス取得失敗");
        } catch (e: any) { setError(e.message); }
        finally { setIsLoadingStatus(false); }
    };

    useEffect(() => {
        const secret = getSecret();
        if (secret) loadStatus();
    }, []);

    const handleUpload = async () => {
        const secret = getSecret();
        if (!secret || selectedFiles.length === 0) return;
        setIsUploading(true);
        setError(null);
        setUploadResults(null);
        try {
            const formData = new FormData();
            selectedFiles.forEach((file) => formData.append("files", file));
            formData.append("source_type", sourceType);
            const res = await fetch("/api/admin/ingest", {
                method: "POST",
                headers: { Authorization: `Bearer ${secret}` },
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                setUploadResults(data.data.details);
                setSelectedFiles([]);
                if (fileInputRef.current) fileInputRef.current.value = "";
                loadStatus();
            } else setError(data.error || "アップロード失敗");
        } catch (e: any) { setError(e.message); }
        finally { setIsUploading(false); }
    };

    const handleTextSubmit = async () => {
        const secret = getSecret();
        if (!secret || !textContent.trim()) return;
        setIsUploading(true);
        setError(null);
        setUploadResults(null);
        try {
            const formData = new FormData();
            formData.append("text", textContent.trim());
            formData.append("title", textTitle.trim() || `${sourceType}_${new Date().toLocaleDateString("ja-JP")}`);
            formData.append("source_type", sourceType);
            const res = await fetch("/api/admin/ingest", {
                method: "POST",
                headers: { Authorization: `Bearer ${secret}` },
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                setUploadResults(data.data.details);
                setTextTitle("");
                setTextContent("");
                loadStatus();
            } else setError(data.error || "投入失敗");
        } catch (e: any) { setError(e.message); }
        finally { setIsUploading(false); }
    };

    const handleSync = async () => {
        const secret = getSecret();
        if (!secret) return;
        setIsSyncing(true);
        setError(null);
        setSyncResult(null);
        try {
            const res = await fetch("/api/sync", { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
            const data = await res.json();
            if (data.success) {
                setSyncResult(`同期完了: ${data.data.synced}件 同期, ${data.data.errors || 0}件 エラー`);
                loadStatus();
            } else setError(data.error?.message || "同期失敗");
        } catch (e: any) { setError(e.message); }
        finally { setIsSyncing(false); }
    };

    return (
        <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold text-white">ナレッジベース管理</h1>
                    <p className="text-neutral-400 text-xs md:text-sm mt-1">コンテンツの投入・同期管理</p>
                </div>
                <button onClick={loadStatus} disabled={isLoadingStatus}
                    className="px-3 py-2 md:px-4 bg-purple-600 text-white rounded-lg text-xs md:text-sm font-medium hover:bg-purple-500 disabled:opacity-50 transition-colors">
                    {isLoadingStatus ? "取得中..." : "ステータス確認"}
                </button>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-6">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {status && (
                <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 md:p-6 mb-6">
                    <h2 className="text-base md:text-lg font-semibold text-white mb-4">ステータス</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 mb-6">
                        <div className="bg-neutral-800/50 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-white">{status.total}</div>
                            <div className="text-xs text-neutral-400 mt-1">合計</div>
                        </div>
                        <div className="bg-green-900/20 border border-green-800/30 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-green-400">{status.synced}</div>
                            <div className="text-xs text-neutral-400 mt-1">同期済み</div>
                        </div>
                        <div className="bg-yellow-900/20 border border-yellow-800/30 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-yellow-400">{status.pending}</div>
                            <div className="text-xs text-neutral-400 mt-1">同期待ち</div>
                        </div>
                        <div className="bg-red-900/20 border border-red-800/30 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-red-400">{status.error}</div>
                            <div className="text-xs text-neutral-400 mt-1">エラー</div>
                        </div>
                    </div>
                    <h3 className="text-sm font-medium text-neutral-300 mb-2">ソース種別</h3>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(status.by_source_type).map(([type, count]) => (
                            <span key={type} className="bg-neutral-800 border border-neutral-700 rounded-full px-3 py-1 text-xs text-neutral-300">
                                {type}: <span className="text-white font-medium">{count}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 md:p-6 mb-6">
                <h2 className="text-base md:text-lg font-semibold text-white mb-4">コンテンツ投入</h2>

                {/* Tab Switcher */}
                <div className="flex mb-4 bg-neutral-800/50 rounded-lg p-1">
                    <button onClick={() => setInputTab("text")}
                        className={`flex-1 py-2 px-3 rounded-md text-xs md:text-sm font-medium transition-all ${inputTab === "text" ? "bg-purple-600 text-white shadow-lg" : "text-neutral-400 hover:text-white"}`}>
                        テキスト入力
                    </button>
                    <button onClick={() => setInputTab("file")}
                        className={`flex-1 py-2 px-3 rounded-md text-xs md:text-sm font-medium transition-all ${inputTab === "file" ? "bg-purple-600 text-white shadow-lg" : "text-neutral-400 hover:text-white"}`}>
                        ファイルアップロード
                    </button>
                </div>

                {/* Source Type Selector (shared) */}
                <div className="mb-4">
                    <label className="block text-sm text-neutral-300 mb-2">ソース種別</label>
                    <select value={sourceType} onChange={(e) => setSourceType(e.target.value)}
                        className="w-full md:w-auto bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50">
                        <option value="x_post">X投稿</option>
                        <option value="mind_column">マインドコラム</option>
                        <option value="coaching">壁打ち / コーチング</option>
                        <option value="video_transcript">動画文字起こし</option>
                        <option value="group_lecture">グループ講義</option>
                        <option value="meeting_transcript">会議文字起こし</option>
                        <option value="other">その他</option>
                    </select>
                </div>

                {/* Text Input Tab */}
                {inputTab === "text" && (
                    <div>
                        <div className="mb-3">
                            <label className="block text-sm text-neutral-300 mb-1.5">タイトル（任意）</label>
                            <input type="text" value={textTitle} onChange={(e) => setTextTitle(e.target.value)}
                                placeholder="例: 2026/3/3 X投稿まとめ"
                                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50" />
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm text-neutral-300 mb-1.5">テキスト内容</label>
                            <textarea value={textContent} onChange={(e) => setTextContent(e.target.value)}
                                placeholder="X投稿のテキスト、会議メモ、コラムなどを自由に貼り付けてください..."
                                rows={12}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-4 py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y" />
                            {textContent.length > 0 && (
                                <div className="text-xs text-neutral-500 mt-1.5">{textContent.length.toLocaleString()} 文字</div>
                            )}
                        </div>
                        <button onClick={handleTextSubmit} disabled={isUploading || !textContent.trim()}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/30">
                            {isUploading ? "処理中..." : !textContent.trim() ? "テキストを入力してください" : "AIに読み込ませる"}
                        </button>
                        <p className="text-xs text-neutral-500 mt-2 text-center">テキストはAI前処理 → Lark Base保存 → Pinecone同期まで自動で実行されます</p>
                    </div>
                )}

                {/* File Upload Tab */}
                {inputTab === "file" && (
                    <div>
                        <div className={`mb-4 border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${isDragging ? "border-purple-500 bg-purple-900/20" : "border-neutral-700 hover:border-neutral-500"}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); setSelectedFiles(Array.from(e.dataTransfer.files)); }}
                            onClick={() => fileInputRef.current?.click()}>
                            <input ref={fileInputRef} type="file" accept=".txt,.md,.csv" multiple
                                onChange={(e) => e.target.files && setSelectedFiles(Array.from(e.target.files))} className="hidden" />
                            {selectedFiles.length > 0 ? (
                                <div>
                                    <p className="text-sm text-green-400 font-medium mb-2">{selectedFiles.length}件選択済み</p>
                                    {selectedFiles.map((f, i) => (
                                        <div key={i} className="text-xs text-neutral-400">{f.name} ({(f.size / 1024).toFixed(1)} KB)</div>
                                    ))}
                                </div>
                            ) : (
                                <div>
                                    <p className="text-sm text-neutral-300 mb-1">クリックまたはドラッグ&ドロップ</p>
                                    <p className="text-xs text-neutral-500">.txt / .md / .csv</p>
                                </div>
                            )}
                        </div>
                        <button onClick={handleUpload} disabled={isUploading || selectedFiles.length === 0}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-900/30">
                            {isUploading ? "アップロード中..." : selectedFiles.length === 0 ? "ファイルを選択してください" : `${selectedFiles.length}件をアップロード`}
                        </button>
                        <p className="text-xs text-neutral-500 mt-2 text-center">ファイルはAI前処理 → Lark Base保存 → Pinecone同期まで自動で実行されます</p>
                    </div>
                )}
            </div>

            {uploadResults && (
                <div className="bg-green-900/20 border border-green-800 rounded-xl p-6 mb-6">
                    <h3 className="text-lg font-semibold text-green-400 mb-3">アップロード完了</h3>
                    {uploadResults.map((r, i) => (
                        <div key={i} className="bg-neutral-800/50 rounded-lg p-3 mb-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-white font-medium">{r.filename}</span>
                                <span className="text-xs text-green-400">{r.synced}/{r.chunks} チャンク同期済</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 md:p-6">
                <h2 className="text-base md:text-lg font-semibold text-white mb-3">手動同期</h2>
                <p className="text-neutral-400 text-xs md:text-sm mb-4">pendingレコードをPineconeに同期します。</p>
                <button onClick={handleSync} disabled={isSyncing}
                    className="px-6 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-500 disabled:opacity-50 transition-colors">
                    {isSyncing ? "同期中..." : "Pending レコードを同期"}
                </button>
                {syncResult && <p className="mt-3 text-sm text-cyan-400">{syncResult}</p>}
            </div>
        </div>
    );
}
