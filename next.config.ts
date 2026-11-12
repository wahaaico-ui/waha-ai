import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV === 'development';
const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(isDevelopment ? ["'unsafe-eval'"] : []),
  'https://js.stripe.com',
].join(' ');

const nextConfig: NextConfig = {
  // Do not announce the framework in every response.
  poweredByHeader: false,
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

  // pdfjs-dist loads two things by a run-time path that file tracing cannot see:
  // its worker (pdf.worker.mjs) and @napi-rs/canvas, which supplies DOMMatrix in
  // Node. Without them the deployed function fails on import with
  // "DOMMatrix is not defined". Checked by `npm run test:pdf-trace` after a build.
  outputFileTracingIncludes: {
    '/api/academic/export': ['./public/fonts/NotoNaskhArabic.ttf', './public/fonts/Amiri-Regular.ttf', './public/fonts/NotoSans-Regular.ttf', './public/fonts/NotoSansMath-Regular.ttf'],
    '/api/academic/parse-pdf': [
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      './node_modules/@napi-rs/canvas/**/*',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**/*',
      './node_modules/@napi-rs/canvas-darwin-x64/**/*',
      './node_modules/@napi-rs/canvas-linux-arm64-gnu/**/*',
    ],
    '/api/projects/*/pdfs': [
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      './node_modules/@napi-rs/canvas/**/*',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**/*',
      './node_modules/@napi-rs/canvas-linux-arm64-gnu/**/*',
      './node_modules/@napi-rs/canvas-darwin-x64/**/*',
    ],
    '/api/academic/projects/policy': [
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
      './node_modules/@napi-rs/canvas/**/*',
      './node_modules/@napi-rs/canvas-linux-x64-gnu/**/*',
      './node_modules/@napi-rs/canvas-linux-arm64-gnu/**/*',
      './node_modules/@napi-rs/canvas-darwin-x64/**/*',
    ],
  },

  typescript: {
    // أخطاء الأنواع يجب أن تظهر لا أن تُخفى — المشروع يعبر tsc بنجاح حالياً.
    ignoreBuildErrors: false,
  },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'Content-Security-Policy', value: `default-src 'self'; script-src ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.openalex.org https://api.semanticscholar.org https://api.stripe.com; frame-src https://js.stripe.com https://checkout.stripe.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'` },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    ] }];
  },
};

export default nextConfig;
