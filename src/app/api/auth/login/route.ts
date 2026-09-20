import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type LoginPayload = { email?: unknown; password?: unknown };

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

export async function POST(request: Request) {
  let body: LoginPayload;
  try {
    body = await request.json() as LoginPayload;
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح.' }, { status: 400, headers });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320 || password.length < 1 || password.length > 1_024) {
    return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' }, { status: 400, headers });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' }, { status: 401, headers });
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return NextResponse.json({
    authenticated: true,
    needsMfa: assurance?.currentLevel === 'aal1' && assurance.nextLevel === 'aal2',
  }, { status: 200, headers });
}
