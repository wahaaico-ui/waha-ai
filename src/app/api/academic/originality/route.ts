import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

const MAX_TEXT_LENGTH = 50_000;
const UNAVAILABLE_MESSAGE = 'فحص التشابه مع قواعد بيانات النشر غير متاح حالياً. لن تعرض الواحة نسبة أصالة تخمينية أو تدّعي كشف الانتحال دون مقارنة موثقة بمصادر فعلية.';

function response(payload: Record<string, unknown>, status: number) {
  return NextResponse.json(payload, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function POST(request: Request) {
  const access = await requireAuthenticatedUser();
  if (!access) return response({ error: 'Unauthorized' }, 401);

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return response({ error: 'طلب المراجعة غير صالح.' }, 400);
  }

  const value = (body as Record<string, unknown>).textToCheck;
  const textToCheck = typeof value === 'string' ? value.trim() : '';
  if (!textToCheck) return response({ error: 'النص المراد مراجعته مفقود.' }, 400);
  if (textToCheck.length > MAX_TEXT_LENGTH) {
    return response({ error: 'النص يتجاوز الحد المسموح للمراجعة.' }, 413);
  }

  return response({
    success: false,
    available: false,
    capability: 'source-backed-similarity-check',
    error: UNAVAILABLE_MESSAGE,
    limitations: [
      'لم يُقارن النص بمستودعات جامعية أو قواعد بيانات ناشرين.',
      'لا تُحسب نسبة أصالة أو تشابه بواسطة نموذج لغوي.',
      'راجع متطلبات جامعتك واستخدم خدمة تشابه مرخصة عند الحاجة إلى تقرير رسمي.',
    ],
  }, 501);
}
