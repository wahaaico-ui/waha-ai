import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- Starting Export E2E Verification ---');

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError || !usersData.users.length) throw new Error('لا يوجد مستخدم مسجّل.');
  const testUserId = usersData.users[0].id;

  const uniqueTitle = 'Verify Export Test ' + Date.now();
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({ title: uniqueTitle, status: 'active', user_id: testUserId })
    .select()
    .single();
  if (projErr) throw projErr;
  console.log('Step 1 (Create test project): SUCCESS. Project ID:', project.id);

  const { error: docErr } = await supabase
    .from('documents')
    .insert({ project_id: project.id, type: 'draft', content: 'This is the real saved document content for export testing.', version: 1 });
  if (docErr) throw docErr;
  console.log('Step 2 (Create document): SUCCESS.');

  const { error: srcErr } = await supabase
    .from('sources')
    .insert({ project_id: project.id, raw_text: 'Sample source text', parsed_citation_apa: 'Author, A. (2026). Sample Paper.', confidence: 'high' });
  if (srcErr) throw srcErr;
  console.log('Step 3 (Create source): SUCCESS.');

  const res = await fetch('http://localhost:3000/api/academic/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: project.id }),
  });
  if (!res.ok) throw new Error('API call failed with status ' + res.status);
  const fileContent = await res.text();
  console.log('Step 4 (Call export API): SUCCESS. Response length:', fileContent.length, 'chars');

  fs.writeFileSync('/tmp/verify-export-output.md', fileContent);
  console.log('   Saved actual output to /tmp/verify-export-output.md for manual inspection');

  if (!fileContent.includes(uniqueTitle)) {
    throw new Error('FAIL: عنوان المشروع الحقيقي غير موجود بالملف الناتج!');
  }
  if (!fileContent.includes('This is the real saved document content for export testing.')) {
    throw new Error('FAIL: محتوى المستند الحقيقي غير موجود بالملف الناتج!');
  }
  if (!fileContent.includes('Author, A. (2026)')) {
    throw new Error('FAIL: بيانات المصدر الحقيقية غير موجودة بالملف الناتج!');
  }
  console.log('--- ALL EXPORT VERIFICATION STEPS PASSED SUCCESSFULLY ---');
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err.message);
  process.exit(1);
});
