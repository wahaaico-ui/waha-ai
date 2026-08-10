require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verify() {
  console.log('--- Starting PDF E2E DB Verification ---');
  try {
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error || !data) {
      console.log('No sources found yet. Please open localhost:3000, upload a real PDF, then run this again!');
      return;
    }

    console.log('Latest Source ID:', data.id);
    console.log('Raw Text (truncated):', data.raw_text ? data.raw_text.substring(0, 50).replace(/\n/g, ' ') + '...' : 'NULL');
    
    const apa = data.parsed_citation_apa;
    const ieee = data.parsed_citation_ieee;
    
    console.log('APA Citation:', apa);
    console.log('IEEE Citation:', ieee);

    // التحقق من أن القيم لم تعد ثابتة
    if (apa === 'APA' || ieee === 'IEEE' || apa === 'Author, A. (2026). Generated Citation.') {
      console.error('❌ FAILURE: Citations are STILL using hardcoded placeholders!');
    } else if (!apa || !ieee) {
      console.error('⚠️ WARNING: Citations are empty. Was Gemini able to process them?');
    } else {
      console.log('✅ SUCCESS: Dynamic citations generated from PDF without hardcoded values!');
    }
  } catch (err) {
    console.error('Error during verification:', err.message);
  }
}
verify();
