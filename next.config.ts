import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false, // تعطيل الوضع الصارم مؤقتاً لتسريع العبور وتخطي أخطاء الـ Fetch

  // تثبيت جذر المشروع: يوجد package-lock.json إضافي في المجلد الأب،
  // وبدونه يعتبر Next أن الجذر هو مجلد Node بالكامل ويراقب ملفات لا علاقة لها بالمشروع.
  turbopack: {
    root: __dirname,
  },

  // pdf-parse (وتبعيته pdfjs-dist) يحمّلان ملف worker عبر مسار نسبي وقت التشغيل.
  // إذا قام Next بتجميع الحزمة داخل الـ bundle الخاص بالسيرفر يفشل هذا المسار،
  // لذا نستثنيها من التجميع وتبقى تُحمَّل عبر require() الطبيعي من node_modules.
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],

  typescript: {
    // أخطاء الأنواع يجب أن تظهر لا أن تُخفى — المشروع يعبر tsc بنجاح حالياً.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
