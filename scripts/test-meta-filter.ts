// Meta-leak フィルタの単体検証スクリプト
// 実行: npx tsx scripts/test-meta-filter.ts

// gemini.ts からエクスポートしていない内部関数を再現テストするため、
// 本ファイル内に同じロジックをコピーして、挙動を確認する。
// （gemini.ts 側の export 追加を避けて本番コードを汚さない）

const META_HEAD_PATTERNS: RegExp[] = [
    /^思考プロセス\s*[：:]/,
    /^\[?思考の基盤\]?/,
    /^\[?キャラクター定義\]?/,
    /^\[?対話モード\]?/,
    /^\[?応答ルール\]?/,
    /^\[?応答の構成\]?/,
    /^\[?応答生成\]?/,
    /^\[?具体的な応答生成\]?/,
    /^\[Persona Definition\]/i,
    /^Core Values & Beliefs/i,
    /^ペルソナ定義\s*[：:]/,
    /^対話モード（S-ICL）/,
    /^S-ICL Template/i,
    /^【思考プロセス】/,
    /^【基本方針】/,
];

const END_MARKERS: RegExp[] = [
    /\[具体的な応答生成\]\s*\n?/,
    /\[応答生成\]\s*\n?/,
    /\[具体応答\]\s*\n?/,
    /【具体的な応答生成】\s*\n?/,
];

function detectMetaLeak(text: string): boolean {
    const head = text.replace(/^\s+/, '').slice(0, 200);
    return META_HEAD_PATTERNS.some((rx) => rx.test(head));
}

function extractAfterEndMarker(text: string): string | null {
    for (const rx of END_MARKERS) {
        const m = text.match(rx);
        if (m && m.index !== undefined) {
            return text.slice(m.index + m[0].length).replace(/^\s+/, '');
        }
    }
    return null;
}

function stripMetaBlock(text: string): string {
    const patterns: RegExp[] = [
        ...META_HEAD_PATTERNS,
        /^\[思考/, /^\[キャラクター/, /^\[対話/, /^\[応答/, /^\[参考/, /^\[Persona/i,
        /^共感\s*[：:]/,
        /^本質への問いかけ\s*[：:]/,
        /^一問一答の原則\s*[：:]/,
        /^えのぽこまんらしいトーン\s*[：:]/,
        /^\{?[LAS]\/[LAS]\/[LAS]\}?[:\s]/,
    ];
    const out = text.split('\n').filter((line) => {
        const t = line.trim();
        if (!t) return true;
        return !patterns.some((rx) => rx.test(t));
    }).join('\n');
    return out.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '');
}

function stripInternalThinking(text: string): string {
    let cleaned = text.replace(/\{(?:Thought|思考|Analysis|分析)\}[:\s][^\n]*/g, '');
    cleaned = cleaned.replace(/\{?[LAS]\/[LAS]\/[LAS]\}?[:\s].*?(?=\n|\n*$)/g, '');
    cleaned = cleaned.replace(/\{?L\/A\/S\}?[:\s].*?(?=\n|\n*$)/gi, '');
    cleaned = cleaned.replace(/\((?:Thought|思考|Analysis)\)[:\s].*?(?=\n|\n*$)/gi, '');
    cleaned = cleaned.replace(/^(?:The user is |Connect .* to .*:|Recommendation and Action-Oriented Advice:|Emphasize that |Guide them ).*$/gm, '');
    cleaned = cleaned.replace(/^(?:思考プロセス|ペルソナ定義|共感|本質への問いかけ|一問一答の原則|えのぽこまんらしいトーン)\s*[：:].*$/gm, '');
    cleaned = cleaned.replace(/^\[(?:思考の基盤|キャラクター定義|対話モード|参考情報|応答ルール|応答の構成|応答生成|具体的な応答生成)\].*$/gm, '');
    cleaned = cleaned.replace(/^\n+/, '');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    return cleaned;
}

// ========== テストケース ==========

// Case 1: 今回クライアントから報告された実リーク（スクショ再現）
const case1 = `思考プロセス： ユーザーは「インスタの投稿作成が進まない」という具体的な悩みを提示しました。これは「行動が止まってしまう、不安に感じることが多い」という、より大きな悩みの一部であると捉えられます。
「えのぽこまん」のペルソナとして、まずはユーザーの気持ちを受け止め、共感を示します。

[思考の基盤]
ペルソナ定義：リアリストなSNSマーケター、親身なコンサルタント。丁寧語で、本質を鋭く突きつつ、相手の成長を願う。
Core Values & Beliefs：小手先より本質。自責思考。アウトプット至上主義。
対話モード（S-ICL）：安易な回答の抑制。過去データの活用（今回は該当なし）。選択肢の提示。一問一答の原則。壁打ち。

[応答の構成]
共感: 「インスタの投稿作成が進まない」という状況への共感を示す。「お気持ち、とてもよくわかります」といったフレーズを使用。
本質への問いかけ: なぜ進まないのか、その背景にある「不安」や「止まってしまう」原因を探るための質問をする。
一問一答の原則: 一度に複数の質問をしない。
えのぽこまんらしいトーン: 丁寧でありながら、本質を突くような問いかけ。

[具体的な応答生成] 「インスタの投稿作成が進まない」という状況は、多くの人が経験することかもしれませんね。「行動が止まってしまう」「不安に感じる」というお話とも繋がっているかと思います。
ずばり、投稿を作成する上で、どのような点に不安を感じて、手が止まってしまうのでしょうか？`;

// Case 2: クリーンな応答（通常パス）
const case2 = `お気持ち、とてもよくわかります。投稿作成が進まないというのは、多くの方が経験することですよね。
差し支えなければ、投稿を作成する上で、どのような点に一番不安を感じて、手が止まってしまうのでしょうか？`;

// Case 3: 先頭だけ meta でその後本文（マーカー検知テスト）
const case3 = `[応答の構成]
共感を示してから問いかけ。

[具体的な応答生成]
おっしゃる通りですね。一緒に考えていきましょう。`;

// Case 4: meta 検知はしたが End Marker が見つからない fallback
const case4 = `思考プロセス：ユーザーは不安を感じている。
[応答ルール]
ルール1をまず適用する。
本文ではなく段取りを出してしまった文章。`;

function runTest(name: string, input: string) {
    console.log(`\n========== ${name} ==========`);
    console.log(`[INPUT (${input.length} chars)]:`);
    console.log(input.slice(0, 200) + (input.length > 200 ? '...' : ''));

    const detected = detectMetaLeak(input);
    console.log(`\n[detectMetaLeak]: ${detected}`);

    if (detected) {
        const after = extractAfterEndMarker(input);
        if (after !== null) {
            console.log(`[extractAfterEndMarker]: 見つかった → 出力長=${after.length}`);
            console.log(`[出力]:\n${after}`);
        } else {
            console.log(`[extractAfterEndMarker]: null → stripMetaBlock で fallback`);
            const fb = stripMetaBlock(input);
            console.log(`[出力]:\n${fb}`);
        }
    } else {
        const cleaned = stripInternalThinking(input);
        console.log(`[stripInternalThinking 出力]:\n${cleaned}`);
    }
}

runTest('Case1: クライアント報告の実リーク', case1);
runTest('Case2: 通常応答（リークなし）', case2);
runTest('Case3: 先頭meta + End Markerあり', case3);
runTest('Case4: meta検知するがEnd Markerなし（fallback）', case4);
