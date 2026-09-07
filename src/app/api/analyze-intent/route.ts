import { NextResponse } from 'next/server';

function detectIntent(text: string): string {
  const normalizedText = text.trim().toLowerCase();

  const nonAcademicKeywords = ['مرحبا', 'السلام عليكم', 'كيفك', 'بدي اسافر', 'hi', 'hello', 'شلونك', 'اخبارك'];
  const isNonAcademic = nonAcademicKeywords.some(keyword => normalizedText.includes(keyword));
  if (isNonAcademic || normalizedText.length < 5) {
    return 'نص غير أكاديمي';
  }

  const titleKeywords = ['أثر', 'دور', 'علاقة', 'فاعلية', 'مدى', 'تقييم'];
  const hasTitleKeyword = titleKeywords.some(keyword => normalizedText.includes(keyword));
  if (hasTitleKeyword && normalizedText.split(' ').length >= 5) {
    return 'عنوان بحث';
  }

  return 'فكرة أولية';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userInput = body.text || '';

    if (!userInput.trim()) {
      return NextResponse.json({
        success: false,
        stage: 1,
        message: 'لم يتم إدخال أي نص.'
      }, { status: 400 });
    }

    const intent = detectIntent(userInput);

    if (intent === 'نص غير أكاديمي') {
      return NextResponse.json({
        success: false,
        stage: 3,
        intent: intent,
        decision: 'STOP',
        message: 'هذا ليس مدخلاً بحثياً. انتهى.'
      }, { status: 200 });
    }

    return NextResponse.json({
      success: true,
      stage: 3,
      intent: intent,
      decision: 'PROCEED',
      message: 'تم اجتياز المرحلتين 2 و 3 بنجاح. النص أكاديمي. بانتظار الانتقال للمرحلة 4.'
    }, { status: 200 });

  } catch {
    return NextResponse.json({
      success: false,
      error: 'حدث خطأ في النظام.'
    }, { status: 500 });
  }
}
