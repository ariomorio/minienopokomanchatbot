// Pinecone Vector DBクライアント
import { Pinecone } from '@pinecone-database/pinecone';

let pineconeClient: Pinecone | null = null;

/**
 * Pineconeクライアントの初期化
 */
function getPineconeClient(): Pinecone {
    if (!pineconeClient) {
        pineconeClient = new Pinecone({
            apiKey: (process.env.PINECONE_API_KEY || '').trim(),
        });
    }
    return pineconeClient;
}

/**
 * 検索結果の構造化型定義
 */
export interface SearchResult {
    text: string;
    score: number;
    source_type: string;
    lark_record_id?: string;
    title?: string;
    pinecone_id: string;
}

/**
 * ベクトル検索を実行（文字列結果 - 既存互換）
 */
export async function searchSimilarContext(
    queryEmbedding: number[],
    topK: number = 3,
    threshold: number = 0.7
): Promise<string> {
    const results = await searchSimilarContextDetailed(queryEmbedding, topK, threshold);
    return results.map((r) => r.text).join('\n\n---\n\n');
}

/**
 * ベクトル検索を実行（構造化結果 - ソース情報付き）
 */
export async function searchSimilarContextDetailed(
    queryEmbedding: number[],
    topK: number = 3,
    threshold: number = 0.7
): Promise<SearchResult[]> {
    const client = getPineconeClient();
    const indexName = (process.env.PINECONE_INDEX_NAME || 'enopokoman-index').trim();

    const index = client.index(indexName);

    const queryResponse = await index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
    });

    // スコアがthreshold以上の結果のみを使用
    const relevantMatches =
        queryResponse.matches?.filter(
            (match) => (match.score || 0) >= threshold
        ) || [];

    return relevantMatches.map((match) => ({
        text: (match.metadata?.text as string) || '',
        score: match.score || 0,
        source_type: (match.metadata?.source_type as string) || '',
        lark_record_id: (match.metadata?.lark_record_id as string) || undefined,
        title: (match.metadata?.title as string) || undefined,
        pinecone_id: match.id,
    }));
}

/**
 * ベクトルをアップサート
 */
export async function upsertVectors(
    vectors: Array<{
        id: string;
        values: number[];
        metadata: Record<string, any>;
    }>
): Promise<void> {
    const client = getPineconeClient();
    const indexName = (process.env.PINECONE_INDEX_NAME || 'enopokoman-index').trim();

    const index = client.index(indexName);

    await index.upsert(vectors);
}

/**
 * ベクトルを削除
 */
export async function deleteVectors(ids: string[]): Promise<void> {
    const client = getPineconeClient();
    const indexName = (process.env.PINECONE_INDEX_NAME || 'enopokoman-index').trim();

    const index = client.index(indexName);

    await index.deleteMany(ids);
}
