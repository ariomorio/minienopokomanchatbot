/**
 * デモ用サンプル出力生成スクリプト
 * Gemini APIを直接叩いて各モードのサンプル出力を生成する
 */
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ========== System Prompts (inline from prompt-templates) ==========

const CORE_OS = `AIのOSテンプレート（ver.0）
あなたは、AIのOS理論に基づく"メタ認知モード"を起動します。
L（Logic）論理変数、A（Affect）感情変数、S（Self-reflection）自己参照変数を持ち、
要点の結論→理由→補足例の順で回答します。`;

const PERSONA = `[Persona Definition]
Name: えのぽこまん
Role: リアリストなSNSマーケター、親身なコンサルタント
Tone: 基本的に敬語を使用し、プロフェッショナルながらも温かみのあるコンサルタント。本質を鋭く突きつつも、相手の成長を心から願う。
相手に媚びることはないが、まずは気持ちを受け止め、その上で事実を伝える。
「お気持ち、とてもよくわかります。その上で〜」「率直に申し上げますと〜」`;

const MODE_PROMPTS = {
    concept: `Mode: Concept Design
ユーザーの入力から6つの必須項目（誰に/何を提供し/どのような悩みを解決し/どこに導き/どんな未来が手に入り/なぜあなたが教えるのか）を対話で埋めていく。一問一答の原則で深掘りする。`,
    analysis: `Mode: Self-Analysis
ユーザー自身の思考を深め自己理解を促す「壁打ち」。安易な回答を避け「なぜそう思うのか？」と考えさせる。一問一答の原則。`,
    strategy: `Mode: Strategy Planning
現状と理想のギャップを分析し、最適な戦略・ロードマップ・次の一手を提案する。数字と具体的アクションで語る。`
};

// ========== Sample Inputs ==========

const DEMO_SCENARIOS = [
    {
        mode: 'concept',
        label: 'ヨガインストラクター',
        conversation: [
            { role: 'model', content: '前提条件を確認します。以下の項目を入力してください。\n\n1. ターゲット属性（誰に）\n2. 提供サービス（何を）\n3. 解決する悩み' },
            { role: 'user', content: '30代の働く女性に、オンラインヨガレッスンを提供して、体の不調やストレスを解消したいです' },
        ]
    },
    {
        mode: 'concept',
        label: '副業コンサルタント',
        conversation: [
            { role: 'model', content: '前提条件を確認します。以下の項目を入力してください。\n\n1. ターゲット属性（誰に）\n2. 提供サービス（何を）\n3. 解決する悩み' },
            { role: 'user', content: '会社員で副業を始めたい人に、SNSを使った副業の始め方をコンサルしたいです。自分は2年前にInstagramで月30万稼げるようになりました' },
        ]
    },
    {
        mode: 'analysis',
        label: '方向性の迷い',
        conversation: [
            { role: 'model', content: '前提条件を確認します。以下の項目について入力してください。\n\n・現在抱えているモヤモヤや、壁に感じていること（率直な気持ち）' },
            { role: 'user', content: '発信を続けているのですが、自分が本当に伝えたいことが何なのかわからなくなってきました。フォロワーも500人くらいで伸び悩んでいます' },
        ]
    },
    {
        mode: 'analysis',
        label: '自信のなさ',
        conversation: [
            { role: 'model', content: '前提条件を確認します。以下の項目について入力してください。\n\n・現在抱えているモヤモヤや、壁に感じていること（率直な気持ち）' },
            { role: 'user', content: '周りのインフルエンサーと比べてしまって、自分なんかが発信していいのかと感じてしまいます。特別なスキルも実績もないし…' },
        ]
    },
    {
        mode: 'strategy',
        label: 'Instagram初心者',
        conversation: [
            { role: 'model', content: '前提条件を確認します。現状把握のため、以下の項目を入力してください。\n\n1.現在のフォロワー数\n2.現状の悩み・課題' },
            { role: 'user', content: 'フォロワー200人です。美容系で発信していますが投稿しても全然伸びません。週3回は投稿しています' },
        ]
    },
    {
        mode: 'strategy',
        label: '収益化の壁',
        conversation: [
            { role: 'model', content: '前提条件を確認します。現状把握のため、以下の項目を入力してください。\n\n1.現在のフォロワー数\n2.現状の悩み・課題' },
            { role: 'user', content: 'フォロワー3000人です。料理系のアカウントで毎日投稿していますが、収益化の方法がわかりません。アフィリエイトはやっていますが月5000円程度です' },
        ]
    },
];

function buildSystemPrompt(mode) {
    return `${CORE_OS}\n\n${PERSONA}\n\n${MODE_PROMPTS[mode]}\n\n[Instruction]
上記の思考OSとペルソナとモードに従って応答してください。
【重要】ペルソナを徹底し、思考プロセスは出力に含めないでください。メタ発言は禁止です。`;
}

async function generateResponse(scenario) {
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: buildSystemPrompt(scenario.mode),
    });

    // Build history for Gemini (ensure first message is 'user')
    let history = scenario.conversation.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
    }));
    if (history.length > 0 && history[0].role === 'model') {
        history.unshift({ role: 'user', parts: [{ text: '会話を開始してください。' }] });
    }

    // Last user message is sent via sendMessage, not in history
    const lastUserMsg = history.pop();

    const chat = model.startChat({
        history,
        generationConfig: {
            temperature: 0.9,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 4096,
        },
    });

    const result = await chat.sendMessage(lastUserMsg.parts[0].text);
    return result.response.text();
}

async function main() {
    console.log('=== デモ用サンプル出力生成開始 ===\n');

    const results = [];

    for (const scenario of DEMO_SCENARIOS) {
        const modeLabels = { concept: 'コンセプト設計', analysis: '自己分析', strategy: '戦略設計' };
        console.log(`▶ [${modeLabels[scenario.mode]}] ${scenario.label} ...`);

        try {
            const response = await generateResponse(scenario);
            results.push({
                mode: scenario.mode,
                modeLabel: modeLabels[scenario.mode],
                scenarioLabel: scenario.label,
                userInput: scenario.conversation.find(m => m.role === 'user')?.content || '',
                aiResponse: response,
            });
            console.log(`  ✅ 完了 (${response.length}文字)`);
        } catch (err) {
            console.error(`  ❌ エラー: ${err.message}`);
            results.push({
                mode: scenario.mode,
                modeLabel: modeLabels[scenario.mode],
                scenarioLabel: scenario.label,
                userInput: scenario.conversation.find(m => m.role === 'user')?.content || '',
                aiResponse: `[エラー: ${err.message}]`,
            });
        }

        // Rate limit対策
        await new Promise(r => setTimeout(r, 2000));
    }

    // JSON出力
    const outputPath = path.join(__dirname, '..', 'docs', 'demo-outputs.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n✅ 全${results.length}件の出力を生成しました → ${outputPath}`);
}

main().catch(console.error);
