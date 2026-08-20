import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ items: [] });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase
      .from('idea_verifications')
      .select('id, topic, acceptance_score, decision, total_papers, created_at')
      .eq('user_ip', ip)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) return NextResponse.json({ items: [] });
    return NextResponse.json({ items: data || [] });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
