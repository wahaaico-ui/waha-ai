import { NextResponse } from 'next/server';
import { ResearchIntentEngine } from '@/lib/ai/geminiClient/core/intent/ResearchIntentEngine';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const engine = new ResearchIntentEngine();
    const result = engine.analyze(text);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

