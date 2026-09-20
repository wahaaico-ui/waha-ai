import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

export async function POST() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) return NextResponse.json({ error: 'تعذر تسجيل الخروج.' }, { status: 500, headers });
  return NextResponse.json({ signedOut: true }, { status: 200, headers });
}
