import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // التحقق من المصادقة
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'غير مصرح لك بالوصول' }, { status: 401 });
    }

    const { projectId, researchText } = await request.json();

    if (!researchText) {
      return NextResponse.json({ error: 'النص البحثي مطلوب' }, { status: 400 });
    }

    // هنا يتم معالجة التحليل (يمكنك ربطه بـ Gemini API أو OpenAI مستقبلاً)
    const analysisResult = {
      gaps: [
        "قصور في تكامل النماذج الذكية مع البيانات الحية في الأبحاث السابقة.",
        "نقص في معايير الأمان المطبقة ضمن الإطارات المقترحة.",
        "محدودية النطاق الجغرافي المشمول في الدراسات المرجعية."
      ],
      recommendations: [
        "تطوير خوارزميات هجينة لتحسين كفاءة المعالجة بنسبة 20%.",
        "توسيع نطاق المراجعة الأدبية لتشمل آخر إصدارات عام 2026."
      ],
      methodologyNotes: "المنهجية تحليلية تجريبية؛ يُفضل تعزيزها بمدخلات كمية."
    };

    // حفظ التقرير في قاعدة البيانات (جدول project_analyses إن وجد)
    await supabase.from('project_analyses').insert([
      {
        project_id: projectId,
        summary_text: researchText,
        gaps: analysisResult.gaps,
        user_id: user.id
      }
    ]);

    return NextResponse.json({ success: true, data: analysisResult });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}
