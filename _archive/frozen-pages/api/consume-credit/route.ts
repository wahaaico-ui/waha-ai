import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: 'Unauthorized. Please login.' }, { status: 401 });
    }

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('free_credits')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([{ id: user.id, free_credits: 5 }])
        .select('free_credits')
        .single();

      if (createError) {
        return NextResponse.json({ message: 'Database error: ' + createError.message }, { status: 500 });
      }
      profile = newProfile;
    }

    const currentCredits = profile?.free_credits ?? 0;

    if (currentCredits <= 0) {
      return NextResponse.json({ message: 'No credits left. Please upgrade.', remainingCredits: 0 }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ free_credits: currentCredits - 1 })
      .eq('id', user.id);

    if (updateError) {
      return NextResponse.json({ message: 'Update error: ' + updateError.message }, { status: 500 });
    }

    return NextResponse.json({ remainingCredits: currentCredits - 1, message: 'Success: Credit consumed!' });
  } catch (err: any) {
    return NextResponse.json({ message: 'Server error: ' + (err.message || 'Unknown') }, { status: 500 });
  }
}
