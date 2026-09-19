import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import { buildAccountArchive } from '@/lib/account-privacy';

const secureHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET() {
  const access = await requireAuthenticatedUser();
  if (!access) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: secureHeaders });

  try {
    const archive = await buildAccountArchive(access.user);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(archive, null, 2), {
      status: 200,
      headers: {
        ...secureHeaders,
        'Content-Disposition': `attachment; filename="waha-account-data-${date}.json"`,
      },
    });
  } catch {
    return Response.json({ error: 'تعذر تجهيز نسخة بياناتك كاملة. لم يتم تنزيل ملف ناقص.' }, { status: 500, headers: secureHeaders });
  }
}
