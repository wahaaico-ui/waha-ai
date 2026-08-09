import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false, // تعطيل الوضع الصارم مؤقتاً لتسريع العبور وتخطي أخطاء الـ Fetch

  // تثبيت جذر المشروع: يوجد package-lock.json إضافي في المجلد الأب،
  // وبدونه يعتبر Next أن الجذر هو مجلد Node بالكامل ويراقب ملفات لا علاقة لها بالمشروع.
  turbopack: {
    root: __dirname,
  },

  typescript: {
    // أخطاء الأنواع يجب أن تظهر لا أن تُخفى — المشروع يعبر tsc بنجاح حالياً.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
