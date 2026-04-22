import { NextResponse } from 'next/server';
import { createKnowledgeRecord } from '@/lib/supabase';
import { preprocessMeetingTranscript } from '@/lib/ai-preprocess';

export async function POST(request: Request) {
    const authHeader = request.headers.get('Authorization');
    const secret = authHeader?.replace('Bearer ', '');
    if (secret !== (process.env.CRON_SECRET || '').trim()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { title, content, date } = body;

        if (!title || !content) {
            return NextResponse.json(
                { error: '\u30bf\u30a4\u30c8\u30eb\u3068\u5185\u5bb9\u306f\u5fc5\u9808\u3067\u3059' },
                { status: 400 }
            );
        }

        const recordId = await createKnowledgeRecord({
            '\u30bf\u30a4\u30c8\u30eb': title,
            '\u5185\u5bb9': content,
            '\u30bd\u30fc\u30b9\u7a2e\u5225': 'meeting_transcript',
            '\u5b66\u7fd2\u30b9\u30c6\u30fc\u30bf\u30b9': '\u5b66\u7fd2\u5bfe\u8c61',
            '\u767b\u9332\u65e5': date || Date.now(),
            '\u66f4\u65b0\u65e5\u6642': Date.now(),
            '同期ステータス': 'pending',
        });

        return NextResponse.json({
            success: true,
            data: {
                record_id: recordId,
                message: '\u4f1a\u8b70\u6587\u5b57\u8d77\u3053\u3057\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002Pinecone\u3078\u306e\u540c\u671f\u306f\u300c\u624b\u52d5\u540c\u671f\u300d\u304b\u3089\u5b9f\u884c\u3057\u3066\u304f\u3060\u3055\u3044\u3002',
            },
        });
    } catch (error: any) {
        console.error('Meetings API error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
