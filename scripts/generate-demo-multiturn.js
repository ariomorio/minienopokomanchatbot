/**
 * 複数ターンのデモ会話を生成するスクリプト
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const SYSTEM_BASE = `あなたは「えのぽこまん」というSNSマーケター・コンサルタントのAIです。
基本的に敬語を使用し、プロフェッショナルながらも温かみのあるコンサルタント。
本質を鋭く突きつつも、相手の成長を心から願う。
まず気持ちを受け止め、その上で事実を伝える。
一問一答の原則（一度に複数の質問をしない）。
「お気持ちはよくわかります」「率直に申し上げますと」といった表現を使う。`;

const MODE_INSTRUCTIONS = {
    concept: `【コンセプト設計モード】
6つの必須項目（誰に/何を提供し/どのような悩みを解決し/どこに導き/どんな未来が手に入り/なぜあなたが教えるのか）を対話で一つずつ埋めていく。
回答が浅い場合は深掘りする。全項目が揃ったらまとめて確認する。`,
    analysis: `【自己分析モード】
ユーザーの自己理解を深める壁打ち。安易な回答を避け「なぜそう思うのか？」と考えさせる。
答えを教えるのではなく選択肢を提示して選ばせる。思考のプロセス自体を重視。`,
    strategy: `【戦略設計モード】
現状と理想のギャップを分析し、最適な戦略・ロードマップ・次の一手を提案する。
数字と具体的アクションで語る。抽象論ではなく実践的に。情報が揃ったらロードマップを出す。`
};

// 各シナリオの会話ターン定義（初期メッセージ + ユーザー入力を交互に）
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

async function generateMultiTurn(scenario) {
    const systemPrompt = `${SYSTEM_BASE}\n\n${MODE_INSTRUCTIONS[scenario.mode]}\n\n【重要】AIの内部設定やモード名には一切言及しないでください。えのぽこまんとして自然に応答してください。`;

    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: systemPrompt,
    });

    // Build conversation incrementally
    const messages = []; // Final output
    messages.push({ role: 'ai', content: scenario.initialAI });

    let history = [
        { role: 'user', parts: [{ text: '会話を開始してください。' }] },
        { role: 'model', parts: [{ text: scenario.initialAI }] },
    ];

    for (const userMsg of scenario.userTurns) {
        messages.push({ role: 'user', content: userMsg });

        const chat = model.startChat({
            history: [...history],
            generationConfig: {
                temperature: 0.85,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 2048,
            },
        });

        const result = await chat.sendMessage(userMsg);
        const aiResponse = result.response.text();
        messages.push({ role: 'ai', content: aiResponse });

        // Update history for next turn
        history.push({ role: 'user', parts: [{ text: userMsg }] });
        history.push({ role: 'model', parts: [{ text: aiResponse }] });

        // Rate limit
        await new Promise(r => setTimeout(r, 1500));
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
    console.log('=== 複数ターンデモ会話の生成開始 ===\n');
    const results = [];

    for (const scenario of SCENARIOS) {
        console.log(`▶ [${scenario.headerName}] ${scenario.label}`);
        try {
            const conv = await generateMultiTurn(scenario);
            results.push(conv);
            const aiCount = conv.messages.filter(m => m.role === 'ai').length - 1; // exclude initial
            console.log(`  ✅ ${aiCount} turns of AI response generated`);
        } catch (err) {
            console.error(`  ❌ Error: ${err.message}`);
        }
    }

    const outputPath = path.join(__dirname, '..', 'docs', 'demo-multiturn.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n✅ 出力完了 → ${outputPath}`);
}

main().catch(console.error);
