jest.mock('@/lib/supabase/authorization', () => ({ requireAuthenticatedUser: jest.fn(), ownsProject: jest.fn() }));
jest.mock('@/lib/supabase/service', () => ({ createServiceClient: jest.fn() }));

import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { GET, PATCH, POST } from '@/app/api/projects/[projectId]/journey/route';
import { POST as exportProject } from '@/app/api/academic/export/route';
import { requireAuthenticatedUser, ownsProject } from '@/lib/supabase/authorization';
import { createServiceClient } from '@/lib/supabase/service';
import { createTableFake } from '@/lib/test-support/table-fake';
import { appendSampleSizeNote, calculateSampleSize } from '@/lib/sample-size';
import { calculateHypothesis, sampleMethodology, type SamplePlan } from '@/lib/sample-size-planning';
import { loadJourney, saveJourneyDraft, saveJourneyStage } from '@/lib/research-journey';
import { evaluateGate } from '@/lib/research-workflow';

const projectId = '6c17af17-5c9d-472c-a9ea-e6a6ce710001';
const context = { params: Promise.resolve({ projectId }) };
const db = createTableFake({ strictQuery: true });
const prior = 'Supervisor note: retain the sampling frame and eligibility criteria.';
const prereqs = {
  verify: { decision: 'proceed', searchCoverage: { uniqueStudies: 3 }, researchPaths: [{ id:'a' },{ id:'b' },{ id:'c' }], selectedResearchPath: { id:'a' } },
  title: { title: 'أثر الذكاء الاصطناعي التوليدي على تعلم طلبة الدراسات العليا' },
  problem: { problemStatement: 'لا يزال أثر استخدام الذكاء الاصطناعي التوليدي على تعلم طلبة الدراسات العليا غير واضح في السياق المحلي.', researchGap: 'توجد ندرة في الدراسات التي تربط الاستخدام الفعلي للذكاء الاصطناعي بتحسن مهارات التعلم لدى طلبة الدراسات العليا.', researcherNote: 'اخترت المشكلة لأنها تمس تجربة الباحثين اليومية وتحتاج فهماً مرتبطاً ببيئتهم.' },
  objectives: { objectives: ['قياس أثر الاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين', 'تحديد العوامل التي تؤثر في تبني الذكاء الاصطناعي'] },
  questions: { questions: ['ما أثر الاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين؟', 'ما العوامل التي تؤثر في تبني الذكاء الاصطناعي؟'] },
  hypotheses: { mode: 'required', hypotheses: ['يوجد أثر للاستخدام الفعلي للذكاء الاصطناعي على تعلم الباحثين', 'توجد علاقة بين العوامل المؤثرة وتبني الذكاء الاصطناعي لدى الباحثين'] },
  methodology: { approach: 'quantitative', population: 'جميع طلبة الدراسات العليا المسجلين في الجامعة', sample: 'عينة عشوائية بسيطة من طلبة الكليات المختلفة', instrument: 'استبانة أكاديمية محكمة تقيس المتغيرات المحددة' },
};
function design(note: string) {
  return { variables: [
    { name: 'استخدام الذكاء الاصطناعي', role: 'independent', operationalDefinition: 'درجة الاستخدام الفعلي لأدوات الذكاء الاصطناعي خلال الفصل الدراسي.' },
    { name: 'جودة التعلم', role: 'dependent', operationalDefinition: 'الدرجة الكلية لمؤشرات التحصيل والمشاركة الأكاديمية لدى الطلبة.' },
  ], population: { description: 'جميع طلبة الدراسات العليا المسجلين في الجامعة خلال الفصل الحالي.', location:'Synthetic institution', timeframe:'Synthetic study period' }, sample: { strategy: 'عينة عشوائية بسيطة من المجتمع المحدد للدراسة.', inclusionCriteria: 'طلبة دراسات عليا مسجلون واستخدموا أدوات الذكاء الاصطناعي أكاديمياً.', sizeRationale: appendSampleSizeNote(prior,note) } };
}
const survey = calculateSampleSize({ population:1000,confidence:95,marginPercent:5,proportionPercent:50,responsePercent:70 });
const plans: Array<{ name: string; plan: SamplePlan }> = [];
if (!survey.ok) throw new Error('Invalid test input');
plans.push({ name:'survey',plan:{kind:'survey',result:survey.result} });
for (const method of ['t-test','correlation','green'] as const) {
  const result = calculateHypothesis(method === 'green' ? { method,predictors:4,target:'both',population:1000,responsePercent:70 } : { method,effect:method==='t-test'?.5:.3,alpha:.05,power:80,population:1000,responsePercent:70 });
  if (!result.ok) throw new Error('Invalid test input');
  plans.push({name:method,plan:{kind:'hypothesis',result:result.result}});
}
const originalFetch = global.fetch;
beforeEach(() => {
  jest.clearAllMocks(); db.reset();
  db.seed('projects',{id:projectId,user_id:'owner',title:'SYNTHETIC calculator persistence fixture',university_policy:null});
  for (const [stage,content] of Object.entries(prereqs)) db.seed('documents',{project_id:projectId,type:`journey:${stage}`,content:JSON.stringify(content),version:1});
  const rpc = jest.fn(async (_name: string, args: { p_content: unknown; p_client_updated_at: string }) => {
    const row = db.rows('research_stage_drafts').find(row => row.project_id===projectId && row.stage==='design');
    if (row && String(row.client_updated_at)>args.p_client_updated_at) return {data:[],error:null};
    const value = { project_id:projectId,stage:'design',content:args.p_content,client_updated_at:args.p_client_updated_at,updated_at:new Date().toISOString() };
    if (row) Object.assign(row,value); else db.seed('research_stage_drafts',value);
    return {data:[value],error:null};
  });
  (requireAuthenticatedUser as jest.Mock).mockResolvedValue({user:{id:'owner',email:'fixture@example.test',user_metadata:{}},supabase:{...db.session,rpc}});
  (ownsProject as jest.Mock).mockResolvedValue(true);
  (createServiceClient as jest.Mock).mockReturnValue(db.service);
  global.fetch = jest.fn(async (url,init) => {
    const endpoint = new URL(String(url),'http://isolated.test');
    if (endpoint.pathname!==`/api/projects/${projectId}/journey`) throw new Error('External or unexpected request');
    const request = new Request(endpoint,init);
    return request.method==='POST'?POST(request,context):request.method==='PATCH'?PATCH(request,context):GET(request,context);
  });
});
afterEach(() => { global.fetch=originalFetch; expect(db.writes.filter(row=>row.table==='documents'&&row.client==='session')).toHaveLength(0); });

test.each(plans.flatMap(value=>(['ar','en'] as const).map(language=>({...value,language}))))('$name $language: calculator → draft API → reopen → approved save → project export', async ({name,plan,language}) => {
  const note=sampleMethodology(plan,language), candidate=design(note);
  expect(evaluateGate('design',{...prereqs,design:candidate}).status).toBe('open');
  await saveJourneyDraft(projectId,'design',candidate);
  const draft = (await loadJourney(projectId)).drafts.design?.content;
  expect(draft).toEqual(candidate);
  expect(appendSampleSizeNote((draft!.sample as {sizeRationale:string}).sizeRationale,note)).toBe(candidate.sample.sizeRationale);
  const saved=await saveJourneyStage(projectId,'design',draft!);
  expect(saved.success).toBe(true);
  expect((await loadJourney(projectId)).outputs.design).toEqual(candidate);
  expect((await loadJourney(projectId)).drafts.design).toBeUndefined();
  const request=(format:string)=>new Request('http://isolated.test/api/academic/export',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,format,language})});
  const markdown=await exportProject(request('markdown'));
  expect(markdown.status).toBe(200);expect(markdown.headers.get('cache-control')).toContain('private, no-store');
  const text=(await markdown.text()).replace(/\\/g,'');
  expect(text).toContain(prior);expect(text).toContain(String(plan.result.contacts));
  for(const citation of note.match(/https:\/\/doi\.org\/\S+/g)||[]) expect(text).toContain(citation);
  if (process.env.WAHA_SAMPLE_QA_DIR) {
    const dir=process.env.WAHA_SAMPLE_QA_DIR;mkdirSync(dir,{recursive:true});
    writeFileSync(join(dir,`${name}-${language}.md`),text);
    writeFileSync(join(dir,`${name}-${language}-design.json`),JSON.stringify(candidate,null,2));
    writeFileSync(join(dir,`${name}-${language}-expected.txt`),candidate.sample.sizeRationale);
    for (const format of ['docx','pdf']) {
      const response=await exportProject(request(format));expect(response.status).toBe(200);
      const bytes=Buffer.from(await response.arrayBuffer());writeFileSync(join(dir,`${name}-${language}.${format}`),bytes);
      expect(bytes.subarray(0,format==='pdf'?4:2).toString()).toBe(format==='pdf'?'%PDF':'PK');
      if(format==='docx') {
        const xml=execFileSync('unzip',['-p',join(dir,`${name}-${language}.docx`),'word/document.xml'],{encoding:'utf8'});
        const plain=xml.replace(/<[^>]+>/g,'').replace(/[\u200e\u200f]/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
        for(const line of candidate.sample.sizeRationale.split('\n').filter(Boolean)) expect(plain).toContain(line);
      }
    }
  }
},30000);

test('failed save retains the full autosaved rationale for retry',async()=>{
  const candidate=design(sampleMethodology(plans[0].plan,'en'));
  await saveJourneyDraft(projectId,'design',candidate);
  db.constraints.set('documents',()=> 'XX000');
  await expect(saveJourneyStage(projectId,'design',candidate)).rejects.toThrow();
  expect((await loadJourney(projectId)).drafts.design?.content).toEqual(candidate);
  db.constraints.clear();await saveJourneyStage(projectId,'design',candidate);
  expect((await loadJourney(projectId)).outputs.design).toEqual(candidate);
});
test('expired session and foreign project cannot save or export the rationale',async()=>{
  const candidate=design(sampleMethodology(plans[0].plan,'ar'));
  (requireAuthenticatedUser as jest.Mock).mockResolvedValueOnce(null);
  await expect(saveJourneyStage(projectId,'design',candidate)).rejects.toThrow('انتهت');
  (ownsProject as jest.Mock).mockResolvedValue(false);
  await expect(saveJourneyDraft(projectId,'design',candidate)).rejects.toThrow('المشروع');
  expect((await exportProject(new Request('http://isolated.test',{method:'POST',body:JSON.stringify({projectId,format:'markdown'})}))).status).toBe(404);
  expect(db.writes).toHaveLength(0);
});
test('older client draft cannot overwrite the current methodology',async()=>{
  const candidate=design(sampleMethodology(plans[0].plan,'en'));
  await saveJourneyDraft(projectId,'design',candidate,'2026-10-19T08:00:00.000Z');
  const stale=await saveJourneyDraft(projectId,'design',design('A stale second-client note.'),'2026-10-18T08:00:00.000Z');
  expect(stale.success).toBe(false);
  expect((await loadJourney(projectId)).drafts.design?.content).toEqual(candidate);
});
test('legacy conflict response is normalized during a mixed-version rollout',async()=>{
  global.fetch=jest.fn().mockResolvedValue(new Response(JSON.stringify({error:'A newer draft is already saved',draft:null}),{status:409,headers:{'Content-Type':'application/json'}}));
  expect(await saveJourneyDraft(projectId,'design',design('Retain the latest methodology plan.'))).toEqual({success:false,draft:null});
});
