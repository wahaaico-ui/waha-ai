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
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.openalex.org https://api.semanticscholar.org https://generativelanguage.googleapis.com https://api.groq.com https://api.stripe.com; frame-src https://js.stripe.com https://checkout.stripe.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'" },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    ] }];
  },
};

export default nextConfig;
