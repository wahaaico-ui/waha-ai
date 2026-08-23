import { createClient } from '@/lib/supabase/server';

export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { supabase, user };
}

export async function ownsProject(projectId: string, userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from('projects').select('id').eq('id', projectId).eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

export async function ownedDocument(documentId: string, userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from('documents').select('id, project_id, content, type, version').eq('id', documentId).maybeSingle();
  if (!data || !(await ownsProject(data.project_id, userId, supabase))) return null;
  return data;
}

export async function ownedSource(sourceId: string, userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from('sources').select('id, project_id').eq('id', sourceId).maybeSingle();
  if (!data || !(await ownsProject(data.project_id, userId, supabase))) return null;
  return data;
}
