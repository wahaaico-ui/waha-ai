import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';
import {
  completeOperationalRequest,
  operationalHeaders,
  startOperationalRequest,
} from '@/lib/observability';

export async function GET(request: Request) {
  const operation = startOperationalRequest(request, '/api/verify-idea/history', 'api.verify_idea_history.started');
  const respond = (payload: Record<string, unknown>, status: number, errorCode?: string) => {
    completeOperationalRequest(operation, 'api.verify_idea_history.completed', status, status < 400 ? 'success' : status < 500 ? 'rejected' : 'failed', errorCode);
    return NextResponse.json(status >= 400 ? { ...payload, requestId: operation.requestId } : payload, {
      status,
      headers: {
        ...operationalHeaders(operation),
        'Cache-Control': 'private, no-store',
      },
    });
  };

  try {
    const access = await requireAuthenticatedUser();
    if (!access) return respond({ error: 'Unauthorized' }, 401, 'unauthorized');

    const { data, error } = await access.supabase
      .from('idea_verifications')
      .select('id, topic, acceptance_score, decision, total_papers, created_at')
      .eq('user_id', access.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) return respond({ error: 'Unable to load verification history' }, 500, 'history_query_failed');
    return respond({ items: data || [] }, 200);
  } catch {
    return respond({ error: 'Unable to load verification history' }, 500, 'history_unavailable');
  }
}
