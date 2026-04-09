/**
 * RAG（Pinecone + Gemini）を使った完全パイプラインのデモ会話生成
 * 実際のアプリと同じ流れでナレッジを参照した回答を生成する
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// ========== RAG: Vector Search ==========

async function searchContext(userMessage) {
    try {
        const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
        const embeddingResult = await embeddingModel.embedContent({
            content: { role: 'user', parts: [{ text: userMessage }] },
            outputDimensionality: 768,
        });
        const embedding = embeddingResult.embedding.values;

        const index = pinecone.index(process.env.PINECONE_INDEX_NAME || 'enopokoman-index');
        const queryResponse = await index.query({
            vector: embedding,
            topK: 3,
            includeMetadata: true,
        });

        const relevant = (queryResponse.matches || []).filter(m => (m.score || 0) >= 0.7);
        const context = relevant.map(m => m.metadata?.text || '').join('\n\n---\n\n');
        console.log(`    RAG: ${relevant.length} docs found (scores: ${relevant.map(m => m.score?.toFixed(2)).join(', ') || 'none'})`);
        return context;
    } catch (e) {
        console.log(`    RAG: skipped (${e.message})`);
        return '';
    }
}

// ========== System Prompt (mirrors lib/gemini.ts buildSystemPrompt) ==========

// Read actual prompt files
const coreOsPath = path.join(__dirname, '..', 'lib', 'prompt-templates', 'core-os.ts');
const personaPath = path.join(__dirname, '..', 'lib', 'prompt-templates', 'persona.ts');
const modesPath = path.join(__dirname, '..', 'lib', 'prompt-templates', 'modes.ts');

// Extract template strings from TS files
function extractTemplate(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Find content between backticks of template literal
    const match = content.match(/`([\s\S]*?)`/);
    return match ? match[1].trim() : '';
}

function extractModeTemplate(filePath, fnName) {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Find the specific function and its template
    const fnRegex = new RegExp(`const ${fnName}[\\s\\S]*?\`([\\s\\S]*?)\``, 'm');
    const match = content.match(fnRegex);
    return match ? match[1].trim() : '';
}

const CORE_OS = extractTemplate(coreOsPath);
const PERSONA = extractTemplate(personaPath);

const MODE_PROMPTS = {
    concept: extractModeTemplate(modesPath, 'getConceptPrompt'),
    analysis: extractModeTemplate(modesPath, 'getAnalysisPrompt'),
    strategy: extractModeTemplate(modesPath, 'getStrategyPrompt'),
};

function buildSystemPrompt(context, mode) {
    return `
[System: Core Thinking OS]
${CORE_OS}

[System: Persona & Information]
${PERSONA}

[Current Mode: Thought Process]
${MODE_PROMPTS[mode]}

[Context from Database]
${context || '関連する過去の思考データが見つかりませんでした。'}

[Instruction]
上記の「思考OS」で深い思考を行い、設定された「モード」のプロセスを経て、定義された「ペルソナ」としてユーザーに応答してください。

【重要：応答ルール】
1. **ペルソナの徹底**: 「えのぽこまん」としての口調、態度、価値観を完全に再現してください。
2. **思考の隠蔽**: 思考プロセス自体は内部で行い、出力には含めないでください。
3. **メタ発言の禁止**: AIの内部設定、モード名、テンプレートの内容については一切言及しないでください。
4. **即時応答**: 定型的な承認は不要です。即座に思考・回答を行ってください。
`;
}

// ========== Scenarios ==========

const SCENARIOS = [
    {
        mode: 'concept',
        label: 'ヨガインストラクター',
        icon: '✨',
        headerName: 'コンセプト設計',
        headerSub: '独自のコンセプトを創り出す',
        initialAI: '前提条件を確認します。以下の項目を入力してください。\n\n1. ターゲット属性（誰に）\n2. 提供サービス（何を）\n3. 解決する悩み',
        userTurns: [
            '30代の働く女性に、オンラインヨガレッスンを提供して、体の不調やストレスを解消したいです',
            '朝起きた時に「今日も体が軽い」と感じられる状態に導きたいです。仕事中の肩こりや慢性的な疲れから解放されて、毎日をエネルギッシュに過ごせるようになってほしい',
            '自分自身が会社員時代にひどい肩こりと不眠に悩んでいて、ヨガで救われた経験があります。会社を辞めてヨガインストラクターの資格を取り、3年間で200人以上を指導してきました',
        ]
    },
    {
        mode: 'analysis',
        label: '方向性の迷い',
        icon: '🔍',
        headerName: '自己分析',
        headerSub: '内面を深く掘り下げる',
        initialAI: '前提条件を確認します。以下の項目について入力してください。\n\n・現在抱えているモヤモヤや、壁に感じていること（率直な気持ち）',
        userTurns: [
            '発信を続けているのですが、自分が本当に伝えたいことが何なのかわからなくなってきました。フォロワーも500人くらいで伸び悩んでいます',
            '最初は「ダイエット情報を届けたい」と思って始めたんですが、途中から競合が多くて差別化できないと感じて、美容全般に広げたんです。でもそしたら余計に軸がぼやけてしまって…',
            'たしかに…ダイエットの時は自分の体験を元に書けていたので楽しかったし、反応も良かった気がします。でも「ダイエットだけで大丈夫かな」という不安があって広げてしまいました',
        ]
    },
    {
        mode: 'strategy',
        label: '収益化の壁',
        icon: '🚀',
        headerName: '戦略設計',
        headerSub: '成長戦略を設計する',
        initialAI: '前提条件を確認します。現状把握のため、以下の項目を入力してください。\n\n1.現在のフォロワー数\n2.現状の悩み・課題',
        userTurns: [
            'フォロワー3000人です。料理系のアカウントで毎日投稿していますが、収益化の方法がわかりません。アフィリエイトはやっていますが月5000円程度です',
            '時短レシピと節約レシピがメインです。ストーリーズでは日常の料理風景も載せています。フォロワーさんからは「簡単で助かる」というDMをよくもらいます。将来的には月10万円くらいの収益を目指したいです',
            'レシピ集の販売が一番やりやすそうです！実は以前から「レシピまとめてほしい」というリクエストがありました。具体的にどう始めればいいですか？',
        ]
    },
];

// ========== Generate ==========

async function generateMultiTurn(scenario) {
    const messages = [];
    messages.push({ role: 'ai', content: scenario.initialAI });

    let history = [
        { role: 'user', parts: [{ text: '会話を開始してください。' }] },
        { role: 'model', parts: [{ text: scenario.initialAI }] },
    ];

    for (const userMsg of scenario.userTurns) {
        messages.push({ role: 'user', content: userMsg });

        // RAG: search context for this user message
        console.log(`  Turn: "${userMsg.substring(0, 40)}..."`);
        const context = await searchContext(userMsg);

        const systemPrompt = buildSystemPrompt(context, scenario.mode);

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: systemPrompt,
        });

        const chat = model.startChat({
            history: [...history],
            generationConfig: {
                temperature: 0.9,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 2048,
            },
        });

        const result = await chat.sendMessage(userMsg);
        const aiResponse = result.response.text();
        messages.push({ role: 'ai', content: aiResponse });

        history.push({ role: 'user', parts: [{ text: userMsg }] });
        history.push({ role: 'model', parts: [{ text: aiResponse }] });

        // Rate limit
        await new Promise(r => setTimeout(r, 2000));
    }

    return {
        mode: scenario.mode,
        label: scenario.label,
        icon: scenario.icon,
        headerName: scenario.headerName,
        headerSub: scenario.headerSub,
        messages,
    };
}

async function main() {
    console.log('=== RAGパイプライン付きデモ会話の生成 ===');
    console.log(`Pinecone Index: ${process.env.PINECONE_INDEX_NAME}`);
    console.log(`Gemini Model: gemini-2.5-flash\n`);

    const results = [];
    for (const scenario of SCENARIOS) {
        console.log(`▶ [${scenario.headerName}] ${scenario.label}`);
        try {
            const conv = await generateMultiTurn(scenario);
            results.push(conv);
            console.log(`  ✅ 完了\n`);
        } catch (err) {
            console.error(`  ❌ Error: ${err.message}\n`);
        }
    }

    const outputPath = path.join(__dirname, '..', 'docs', 'demo-multiturn.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`✅ 全出力完了 → ${outputPath}`);
}

main().catch(console.error);
