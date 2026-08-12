import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- Starting Language Engine E2E Verification ---');

  // 0. جيب أول مستخدم حقيقي مسجّل عندك
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError || !usersData.users.length) {
    throw new Error('لا يوجد أي مستخدم مسجّل بعد. سجّل دخول مرة واحدة من الموقع أولاً.');
  }
  const testUserId = usersData.users[0].id;
  console.log('Step 0 (Fetch real user): SUCCESS. User ID:', testUserId);

  // 1. إنشاء مشروع تجريبي مرتبط بمستخدم حقيقي
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .insert({ title: 'Verify Language Engine Test', status: 'active', user_id: testUserId })
    .select()
    .single();
  if (projErr) throw projErr;
  console.log('Step 1 (Create test project): SUCCESS. Project ID:', project.id);

  // 2. إنشاء مستند أصلي فيه أخطاء واضحة عمدًا
  const originalText = 'this text have many grammer mistake and need fixing badly for sure yes.';
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({ project_id: project.id, type: 'draft', content: originalText, version: 1 })
    .select()
    .single();
  if (docErr) throw docErr;
  console.log('Step 2 (Create original document): SUCCESS. Document ID:', doc.id);
  console.log('   Original text:', originalText);

  // 3. استدعاء راوت التدقيق فعليًا
  const res = await fetch('http://localhost:3000/api/academic/paraphrase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: doc.id }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error('API call failed: ' + JSON.stringify(result));
  console.log('Step 3 (Call paraphrase API): SUCCESS.');
  console.log('   New document ID:', result.document.id);
  console.log('   New version:', result.document.version);
  console.log('   New text:', result.document.content);
  console.log('   Confidence:', result.confidenceLabel);

  // 4. التحقق الحاسم
  if (result.document.content === originalText) {
    throw new Error('FAIL: النص الجديد نفس الأصلي، ما صار تدقيق فعلي!');
  }
  if (result.document.version !== 2) {
    throw new Error('FAIL: رقم النسخة لم يزد بشكل صحيح!');
  }
  console.log('--- ALL LANGUAGE ENGINE VERIFICATION STEPS PASSED SUCCESSFULLY ---');
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err.message);
  process.exit(1);
});