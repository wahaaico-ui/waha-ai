import { createBrowserClient } from '@supabase/ssr';

// وضع المفاتيح الحقيقية المستقرة مباشرة لضمان تشغيل السيرفر بدون عوائق
export const supabase = createBrowserClient(
  'https://supabase.co',
  'sb_publishable_tgW5WK_hIWbaeI8JJWBwgA_bDsTBWAF'
);
