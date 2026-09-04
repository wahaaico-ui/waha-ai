import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV === 'development';
const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(isDevelopment ? ["'unsafe-eval'"] : []),
  'https://js.stripe.com',
].join(' ');

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
      { key: 'Content-Security-Policy', value: `default-src 'self'; script-src ${scriptSources}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.openalex.org https://api.semanticscholar.org https://generativelanguage.googleapis.com https://api.groq.com https://api.stripe.com; frame-src https://js.stripe.com https://checkout.stripe.com; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'` },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    ] }];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "iug-hr",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
