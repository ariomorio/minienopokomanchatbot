// AI Preprocessing for Knowledge Base
// Gemini を使ってテキストをベクトル検索に最適な形に整理する

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface PreprocessResult {
    cleanedContent: string;
    summary: string;
    keywords: string[];
    embeddingText: string;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
    video_transcript: '動画文字起こし',
    group_lecture: 'グループ講義',
    coaching: '壁打ち / コーチング',
    meeting_transcript: '会議文字起こし',
    mind_column: 'マインドコラム',
    x_post: 'X投稿',
    other: 'その他',
};

/**
 * テキストをベクトル検索に最適な形にAIで整理する
 *
 * 処理内容:
 * 1. フィラーワード・口語表現の除去
 * 2. 内容を構造化（要点整理）
 * 3. 要約の自動生成（50-100文字）
 * 4. キーワード抽出（5-10個）
 * 5. 検索用テキスト生成（要約+キーワード+整形済み本文）
 */
export async function preprocessForKnowledge(
    rawText: string,
    sourceType: string,
    title?: string,
): Promise<PreprocessResult> {
    const sourceLabel = SOURCE_TYPE_LABELS[sourceType] || sourceType;

    // 短すぎるテキストはAI処理をスキップ
    if (rawText.length < 100) {
        return {
            cleanedContent: rawText.trim(),
            summary: rawText.trim().substring(0, 100),
            keywords: [],
            embeddingText: rawText.trim(),
        };
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        const prompt = `あなたはナレッジベース最適化の専門家です。
以下のテキストをベクトル検索エンジン（Pinecone）で検索されやすい形に整理してください。

## 入力情報
- ソース種別: ${sourceLabel}
${title ? `- タイトル: ${title}` : ''}

## 入力テキスト
${rawText.substring(0, 15000)}

## 指示
以下のJSON形式で出力してください。必ず有効なJSONで返してください。

{
  "cleaned_content": "【整形済み本文】フィラーワード（えーっと、あのー、まあ、ね、なんか等）を除去し、口語を書き言葉に変換。要点を箇条書きや段落で構造化。重複する内容は統合。元の意味やニュアンスは保持する。",
  "summary": "【要約】50〜100文字で内容を要約。このテキストが何について書かれているか一目で分かるように。",
  "keywords": ["キーワード1", "キーワード2", "...（5〜10個。テーマ、人名、手法、概念など検索で使われそうな単語）"]
}

重要な注意:
- cleaned_contentは元テキストの情報を省略しすぎないこと（検索に必要）
- 専門用語や固有名詞はそのまま残すこと
- JSONのみを出力し、それ以外のテキストは含めないこと`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        // JSONをパース（```json ... ``` で囲まれている場合も対応）
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('AI preprocess: JSON not found in response');
            return fallbackResult(rawText, title);
        }

        const parsed = JSON.parse(jsonMatch[0]);

        const cleanedContent = parsed.cleaned_content || rawText.trim();
        const summary = parsed.summary || '';
        const keywords: string[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];

        // ベクトル検索用テキスト: 要約 + キーワード + 整形済み本文を結合
        // この形式にすることでembeddingが意味的に豊かになる
        const embeddingText = [
            summary ? `【要約】${summary}` : '',
            keywords.length > 0 ? `【キーワード】${keywords.join('、')}` : '',
            `【本文】${cleanedContent}`,
        ].filter(Boolean).join('\n\n');

        return {
            cleanedContent,
            summary,
            keywords,
            embeddingText,
        };
    } catch (error) {
        console.error('AI preprocess error:', error);
        return fallbackResult(rawText, title);
    }
}

/**
 * 会議文字起こし専用の前処理
 * 通常の前処理に加え、決定事項・アクションアイテムも抽出
 */
export async function preprocessMeetingTranscript(
    rawText: string,
    title: string,
): Promise<PreprocessResult & { decisions: string; actionItems: string }> {
    // 短すぎるテキストはスキップ
    if (rawText.length < 100) {
        return {
            cleanedContent: rawText.trim(),
            summary: rawText.trim().substring(0, 100),
            keywords: [],
            embeddingText: rawText.trim(),
            decisions: '',
            actionItems: '',
        };
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        const prompt = `あなたは会議議事録の整理とナレッジベース最適化の専門家です。
以下の会議文字起こしをベクトル検索エンジン（Pinecone）で検索されやすい形に整理してください。

## 会議タイトル
${title}

## 会議文字起こし（生テキスト）
${rawText.substring(0, 15000)}

## 指示
以下のJSON形式で出力してください。必ず有効なJSONで返してください。

{
  "cleaned_content": "【整形済み議事録】フィラーワード除去、口語→書き言葉変換。話題ごとにセクション分け。発言者が分かる場合は明記。重複・脱線部分は統合・除去。",
  "summary": "【要約】50〜100文字で会議の概要を要約。",
  "keywords": ["キーワード1", "キーワード2", "...（5〜10個。議題、参加者名、プロジェクト名、技術用語など）"],
  "decisions": "【決定事項】会議で決まったことを箇条書きで列挙。決定事項がない場合は空文字。",
  "action_items": "【アクションアイテム】次にやるべきことを箇条書きで列挙。担当者が分かれば明記。なければ空文字。"
}

重要な注意:
- 会議の具体的な内容・数字・固有名詞は必ず残すこと
- 推測で情報を追加しないこと
- JSONのみを出力し、それ以外のテキストは含めないこと`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('AI meeting preprocess: JSON not found in response');
            const base = fallbackResult(rawText, title);
            return { ...base, decisions: '', actionItems: '' };
        }

        const parsed = JSON.parse(jsonMatch[0]);

        const cleanedContent = parsed.cleaned_content || rawText.trim();
        const summary = parsed.summary || '';
        const keywords: string[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];
        const decisions = parsed.decisions || '';
        const actionItems = parsed.action_items || '';

        // ベクトル検索用テキスト: 全ての構造化情報を結合
        const embeddingText = [
            `【会議】${title}`,
            summary ? `【要約】${summary}` : '',
            keywords.length > 0 ? `【キーワード】${keywords.join('、')}` : '',
            decisions ? `【決定事項】${decisions}` : '',
            actionItems ? `【アクションアイテム】${actionItems}` : '',
            `【議事録】${cleanedContent}`,
        ].filter(Boolean).join('\n\n');

        return {
            cleanedContent,
            summary,
            keywords,
            embeddingText,
            decisions,
            actionItems,
        };
    } catch (error) {
        console.error('AI meeting preprocess error:', error);
        const base = fallbackResult(rawText, title);
        return { ...base, decisions: '', actionItems: '' };
    }
}

/** AI処理失敗時のフォールバック（最低限の整形のみ） */
function fallbackResult(rawText: string, title?: string): PreprocessResult {
    // 最低限の口語フィラー除去
    const cleaned = rawText
        .replace(/えーっと[、。]?/g, '')
        .replace(/あのー[、。]?/g, '')
        .replace(/まあ[、。]/g, '')
        .replace(/なんか[、。]/g, '')
        .replace(/えっと[、。]?/g, '')
        .replace(/うーん[、。]?/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    return {
        cleanedContent: cleaned,
        summary: title || cleaned.substring(0, 100),
        keywords: [],
        embeddingText: cleaned,
    };
}
