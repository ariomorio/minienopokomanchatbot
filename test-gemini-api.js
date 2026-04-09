// Gemini API接続テスト
require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiAPI() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY が設定されていません');
        console.log('📝 .env.local ファイルに GEMINI_API_KEY=your_api_key を追加してください');
        return;
    }

    console.log('🔑 APIキーが見つかりました:', apiKey.substring(0, 10) + '...');
    console.log('🔄 Gemini APIに接続中...\n');

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const result = await model.generateContent('こんにちは');
        const response = await result.response;
        const text = response.text();

        console.log('✅ 接続成功！');
        console.log('📨 テストレスポンス:', text);
        console.log('\n✨ Gemini APIは正常に動作しています');

    } catch (error) {
        console.error('❌ エラーが発生しました:');
        console.error('エラーメッセージ:', error.message);
        console.error('ステータス:', error.status);
        console.error('詳細:', error);

        console.log('\n🔧 対処方法:');
        if (error.status === 400) {
            console.log('- APIキーの形式が正しいか確認してください');
            console.log('- モデル名が正しいか確認してください');
        } else if (error.status === 403) {
            console.log('- APIキーの権限を確認してください');
            console.log('- Google AI Studioで新しいAPIキーを作成してください');
        } else if (error.status === 503) {
            console.log('- Gemini APIが一時的に利用できない可能性があります');
            console.log('- 数分待ってから再度お試しください');
            console.log('- Google Cloud Consoleでサービスの状態を確認してください');
        } else {
            console.log('- APIキーが有効か確認してください');
            console.log('- https://aistudio.google.com/app/apikey でAPIキーを確認してください');
        }
    }
}

testGeminiAPI();
