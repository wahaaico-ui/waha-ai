import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { analysis } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'مفتاح Gemini API غير متوفر' }, { status: 500 });
    }

    if (!analysis) {
      return NextResponse.json({ success: false, error: 'بيانات التحليل مفقودة' }, { status: 400 });
    }

    const prompt = `أنت مدقق الجاهزية البحثية الأكاديمية (Readiness Checker). مهمتك هي تقييم بيانات التحليل المستخرجة لفكرة بحثية وتحديد ما إذا كانت جاهزة تماماً للانتقال إلى مرحلة جمع الأدبيات والمصادر (Evidence Collection).
    بيانات التحليل المستخرجة:
    ${JSON.stringify(analysis, null, 2)}

    قواعد التقييم الصارمة:
    1. هل الفكرة تمتلك العناصر الأساسية الكافية للبحث (مثل: موضوع/متغيرات واضحة، مجتمع دراسة، أو مشكلة بحثية صريحة)؟
    2. حدد بوضوح هل الفكرة جاهزة (isReady: true/false). إذا كان هناك نقص في عناصر جوهرية (مثل المجتمع، المتغير التابع، أو المشكلة)، يجب أن تكون isReady = false.
    3. ضع قائمة بالعناصر الناقصة الحرجة (missingCritical).
    4. اكتب رسالة توجيهية صارمة وواضحة باللغة العربية للباهت (feedback) تنص على ما إذا كان يمكن الانتقال للبحث أو ما يجب إكماله أولاً.

    يجب عليك إرجاع النتيجة ككائن JSON صالح حصراً (بدون أي نصوص خارج الـ JSON) بالشكل التالي:
    {
      "isReady": boolean,
      "readinessScore": number (من 0 إلى 100 يعبر عن مدى اكتمال الفكرة),
      "missingCritical": ["قائمة العناصر الناقصة الحرجة التي تمنع الانتقال للبحث، إن وجدت"],
      "feedback": "رسالة توجيهية صارمة وواضحة للمستخدم"
    }`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json"
        }
      }),
    });

    const data = await response.json();

    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const rawJson = data.candidates[0].content.parts[0].text;
      const parsedData = JSON.parse(rawJson);
      return NextResponse.json({ success: true, readiness: parsedData });
    } else {
      return NextResponse.json({ success: false, error: 'فشل فحص الجاهزية عبر نموذج Gemini' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'خطأ في الاتصال' }, { status: 500 });
  }
}
