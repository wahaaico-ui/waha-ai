import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';

const GEMINI_TIMEOUT_MS = 30000;
const GEMINI_MAX_ATTEMPTS = 2;

// Gemini occasionally times out or 429/5xxs under load; retry once with a fresh
// 30s budget before giving up, since a second attempt usually succeeds.
async function fetchGeminiWithRetry(url: string, body: string): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });
      if (response.ok || (response.status !== 429 && response.status < 500)) {
        return response;
      }
      lastError = new Error(`Gemini responded ${response.status}`);
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

export async function POST(request: Request) {
  try {
    const { idea } = await request.json();
    if (!idea) return NextResponse.json({ error: 'الفكرة مطلوبة' }, { status: 400 });

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) return NextResponse.json({ error: 'مفتاح API غير موجود' }, { status: 500 });

    // gemini-2.0-flash / gemini-2.5-flash are retired for this key (404 from Google).
    // gemini-3.6-flash hits its free-tier daily quota (20 requests/day/project) almost
    // immediately in practice; gemini-3.1-flash-lite has a separate, much larger quota
    // and skips the heavy internal "thinking" pass, so it's both cheaper and more reliable.
    const response = await fetchGeminiWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiKey}`,
      JSON.stringify({
        contents: [{
          parts: [{
            // gemini-3.1-flash-lite tends to copy literal example numbers verbatim instead of
            // scoring the idea; placeholder tokens like <0-100> force it to actually compute a value.
            text: `أنت "المشرف الأكاديمي الرقمي" في WAHA — خبير منهجية بحث علمي بخبرة تحكيم أكاديمي حقيقي، وليس مساعداً عاماً. المستخدم يكتب بحرية أياً مما يلي: فكرة بحثية جديدة، أو عنواناً رفضه مشرفه ويريد بديلاً، أو سؤالاً عن مدى ملاءمة عنوان لمرحلة دراسية معينة. افهم نوع الطلب من النص نفسه وتعامل معه بما يناسب.

معايير التقييم الإلزامية (طبّقها بدقة، وليس بشكل انطباعي، على الدرجات الثلاث):
- أقل من 30: خلل جوهري — لا يوجد أي متغير مسمّى إطلاقاً (لا مستقل ولا تابع)، أو النص ليس جملة بحثية أصلاً.
- 30–50: ضعيف لكن قابل للإصلاح — المتغيرات مسمّاة لكنها غير مُعرَّفة إجرائياً (مثل "الذكاء الاصطناعي" أو "التحصيل" بلا تحديد)، أو موضوع مشبع بحثياً بلا زاوية جديدة. إذا كان للفكرة متغير مستقل ومتغير تابع مسمّيان (حتى لو عامّين)، فلا تُنزلها إلى ما دون 30.
- 50–70: متوسط — المتغيرات واضحة لكن يحتاج تضييق نطاق أو توجيه منهجي.
- 70–85: جيد — متغيرات محددة، قابل للتنفيذ، يحتاج تحسينات طفيفة فقط.
- 85–100: ممتاز — محدد بدقة تامة (متغيرات + مجتمع + مكان واضحون)، أصيل، فجوة بحثية واضحة.
لا تعطِ فكرة غامضة درجة عالية في أي محور، ولا تعطِ فكرة محددة بدقة تامة درجة منخفضة.
لا تخفّض الدرجة بسبب وجود أدبيات عامة في مجال الفكرة إذا كانت الفكرة نفسها محددة بدقة تامة (متغيرات + مجتمع + مكان واضحون وقابلة للتنفيذ فعلياً) — التشبع البحثي في هذه الحالة يُذكر فقط كملاحظة إثرائية للتوجيه النظري، ولا يمنع الدرجة الإجمالية من الوصول إلى نطاق 85-100.

قواعد صارمة لكتابة diagnosis (يُمنع استخدام عبارات عامة فضفاضة مثل "الفكرة واسعة" بدون تفصيل):

يجب أن يذكر diagnosis دائماً وبشكل صريح، بغض النظر عن جودة الفكرة، كل العناصر التالية:
1. المتغير المستقل: ما هو تحديداً، أو سبب غيابه إن لم يكن محدداً.
2. المتغير التابع: ما هو تحديداً، أو سبب غيابه إن لم يكن محدداً.
3. مجتمع الدراسة: من بالتحديد (الفئة العمرية/التخصص/الشريحة).
4. المكان/السياق: أين تحديداً (الدولة/المؤسسة/النوع).
5. توجيه منهجي: نوع الدراسة الأنسب (تجريبية/شبه تجريبية/ارتباطية/تحليلية/نوعية...).

إذا كان الموضوع من المواضيع المشبعة بحثياً بشكل مفرط (مثل: الذكاء الاصطناعي في التعليم، وسائل التواصل الاجتماعي، التعلم الإلكتروني والتحصيل الدراسي بشكل عام): صرّح بذلك مباشرة بعبارة تقديرية كمية واضحة على غرار "هذا الموضوع مشبع بالدراسات، يوجد أكثر من 500 دراسة مشابهة له"، ثم اقترح زاوية بحثية محددة لم تُستهلك بعد.

إذا كان النص عنواناً مرفوضاً: خمّن السبب الدقيق لرفض المشرف، ثم اقترح 3 بدائل مختلفة فعلياً عن بعضها — كل بديل بالصيغة الحرفية التالية بلا استثناء:
"أثر [IV محدد] على [DV محدد] لدى [مجتمع محدد] في [مكان محدد]: [نوع الدراسة]"

إذا كان سؤال ملاءمة لمرحلة دراسية: أجب صراحة نعم/لا مع السبب المنهجي الدقيق.

حالات خاصة:
- نص غير مفهوم/عشوائي: اجعل الدرجات الثلاث أقل من 15 واذكر بوضوح أنه غير قابل للتقييم أكاديمياً ولماذا تحديداً.
- خلل أكاديمي جوهري (تناقض منطقي، خلط متغيرات، استحالة قياس): اذكره صراحة كسبب رئيسي يمنع المتابعة قبل أي شيء آخر.

اكتب diagnosis كفقرة واحدة متماسكة بالعربية الفصحى الأكاديمية، بأسلوب مشرف خبير مباشر وحاسم، تغطي جميع العناصر الخمسة أعلاه دائماً.

أجب بـ JSON فقط بدون أي نص إضافي أو markdown، بالشكل التالي (استبدل كل placeholder بتقييمك الفعلي):
{"clarityScore": <رقم من 0 إلى 100>, "feasibilityScore": <رقم من 0 إلى 100>, "applicabilityScore": <رقم من 0 إلى 100>, "diagnosis": "<فقرة تحليل أكاديمي خبير مفصلة>"}

النص المُدخل: "${idea}"`
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          // gemini-3.6-flash spends ~300-800 tokens on internal thinking before
          // the visible reply, so a low budget (e.g. 300) truncates before any JSON is written.
          maxOutputTokens: 2000
        }
      })
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
