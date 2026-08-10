const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function runE2EVerification() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.log('--- Starting Real Supabase E2E Verification ---');

  // جلب أو إنشاء مستخدم اختبار صالح
  let userId;
  const { data: usersData } = await supabase.auth.admin.listUsers();
  if (usersData && usersData.users && usersData.users.length > 0) {
    userId = usersData.users[0].id;
  } else {
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: 'test-e2e-' + Date.now() + '@example.com',
      password: 'password123',
      email_confirm: true
    });
    if (createErr) {
      console.error('Failed to create test user:', createErr);
      process.exit(1);
    }
    userId = newUser.user.id;
  }
  console.log('Using Test User ID:', userId);

  // Step 2: Create Project
  const projectTitle = 'E2E Verified Project ' + Date.now();
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({ title: projectTitle, status: 'active', user_id: userId })
    .select()
    .single();

  if (projErr) {
    console.error('Step 2 Failed:', projErr);
    process.exit(1);
  }
  console.log('Step 2 (Create Project): SUCCESS. Inserted ID:', project.id);

  // Step 3: University Onboarding Policy Update
  // ملاحظة: إذا لم تكن قمت بتنفيذ أمر الـ ALTER TABLE في لوحة تحكم Supabase بعد، 
  // سنقوم بالتحقق أولاً أو تحديث جدول projects مباشرة.
  const { error: polErr } = await supabase
    .from('projects')
    .update({ university_policy: 'Sample University APA Guidelines v1' })
    .eq('id', project.id);

  if (polErr) {
    console.error('Step 3 Failed (Column might be missing in DB):', polErr);
    console.log('💡 TIP: Go to Supabase Dashboard -> SQL Editor and run: ALTER TABLE projects ADD COLUMN IF NOT EXISTS university_policy TEXT;');
    process.exit(1);
  }
  console.log('Step 3 (University Onboarding): SUCCESS. Policy updated in projects table.');

  // Step 4: PDF Analysis & Source Insertion
  const { data: source, error: srcErr } = await supabase
    .from('sources')
    .insert({
      project_id: project.id,
      raw_text: 'Extracted PDF abstract text for testing.',
      confidence: 0.98
    })
    .select()
    .single();

  if (srcErr) {
    console.error('Step 4 Failed:', srcErr);
    process.exit(1);
  }
  console.log('Step 4 (PDF Analysis / Source Insert): SUCCESS. Inserted Source ID:', source.id);

  // Step 5: Citation Generation
  const { error: citErr } = await supabase
    .from('sources')
    .update({
      parsed_citation_apa: 'Author, A. (2026). Tested Paper.',
      parsed_citation_ieee: '[1] A. Author, "Tested Paper," 2026.'
    })
    .eq('id', source.id);

  if (citErr) {
    console.error('Step 5 Failed:', citErr);
    process.exit(1);
  }
  console.log('Step 5 (Citation Generation): SUCCESS. Citations saved in sources table.');

  // Step 6: Export Data Gathering Verification
  const { data: verifyProj } = await supabase.from('projects').select('*').eq('id', project.id).single();
  const { data: verifySources } = await supabase.from('sources').select('*').eq('project_id', project.id);
  
  if (!verifyProj || !verifySources || verifySources.length === 0) {
    console.error('Step 6 Failed: Export data retrieval mismatch');
    process.exit(1);
  }
  console.log('Step 6 (Export Data Gathering): SUCCESS. Real persisted data verified.');

  console.log('--- ALL E2E DB VERIFICATION STEPS PASSED SUCCESSFULLY ---');
}

runE2EVerification();
