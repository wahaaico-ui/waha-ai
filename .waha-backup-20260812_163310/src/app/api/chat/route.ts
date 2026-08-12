import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'غير مصرح لك بالوصول' }, { status: 401 });
    }

    const { projectId, message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'الرسالة مطلوبة' }, { status: 400 });
    }

    const aiResponse = `بناءً على مشروعك البحثي، استجابةً لسؤالك: أنصح بالتركيز على توثيق المصادر الحديثة، وتقسيم المنهجية إلى مراحل تجريبية واضحة لضمان دقة النتائج.`;

    return NextResponse.json({ success: true, reply: aiResponse });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'حدث خطأ غير متوقع' }, { status: 500 });
  }
}
