import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { idea } = await request.json();
    if (!idea) return NextResponse.json({ error: 'الفكرة مطلوبة' }, { status: 400 });

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return NextResponse.json({ error: 'مفتاح API غير موجود' }, { status: 500 });

    // gemini-2.0-flash / gemini-2.5-flash are retired for this key (404 from Google);
    // gemini-3.6-flash is the current working model.
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `أنت خبير أكاديمي. حلل هذه الفكرة البحثية وأجب بـ JSON فقط بدون أي نص إضافي أو markdown:
{"clarityScore": 75, "feasibilityScore": 80, "applicabilityScore": 70, "diagnosis": "التحليل هنا"}

الفكرة: "${idea}"`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            // gemini-3.6-flash spends ~300-800 tokens on internal thinking before
            // the visible reply, so a low budget (e.g. 300) truncates before any JSON is written.
            maxOutputTokens: 2000
          }
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini error:', response.status, err);
      return NextResponse.json({ error: 'فشل التحليل الأكاديمي' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const analysisData = JSON.parse(clean);

    const reportScore = Math.round(
      ((analysisData.clarityScore || 0) +
       (analysisData.feasibilityScore || 0) +
       (analysisData.applicabilityScore || 0)) / 3
    );

    const sessionClient = await createSessionClient();
    const { data: { user } } = await sessionClient.auth.getUser();

    let saved = false;
    if (user) {
      const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await serviceClient.from('users_usage').insert({
        user_id: user.id,
        idea_text: idea,
        report_score: reportScore,
      });
      saved = true;
    }

    return NextResponse.json({
      success: true,
      data: { ...analysisData, reportScore },
      provider: 'gemini',
      saved,
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'فشل التحليل الأكاديمي' }, { status: 500 });
  }
}
