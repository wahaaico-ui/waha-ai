import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isProjectEmailConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { completeOperationalRequest, operationalHeaders, startOperationalRequest } from '@/lib/observability';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CATEGORIES = new Set(['technical', 'research', 'suggestion', 'partnership', 'billing', 'other']);
const QUEUES: Record<string, 'support' | 'followup' | 'partnerships' | 'billing'> = {
  suggestion: 'followup',
  partnership: 'partnerships',
  billing: 'billing',
};

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLength)
    : '';
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function pagePath(value: unknown) {
  const raw = clean(value, 1000);
  if (!raw) return null;
  try {
    const url = new URL(raw, 'https://waha.systems');
    if (!['waha.systems', 'www.waha.systems', 'waha-ai.vercel.app', 'localhost'].includes(url.hostname)) return null;
    return `${url.pathname}${url.search}`.slice(0, 500);
  } catch {
    return null;
  }
}

function ticketNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `WH-${date}-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
}

export async function POST(request: Request) {
  const operation = startOperationalRequest(request, '/api/support/tickets', 'api.support.ticket.started');
  const respond = (payload: Record<string, unknown>, status: number, errorCode?: string) => {
    completeOperationalRequest(operation, 'api.support.ticket.completed', status, status < 400 ? 'success' : status < 500 ? 'rejected' : 'failed', errorCode);
    return NextResponse.json(status >= 400 ? { ...payload, requestId: operation.requestId } : payload, {
      status,
      headers: { ...operationalHeaders(operation), 'Cache-Control': 'no-store' },
    });
  };

  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return respond({ error: 'بيانات البلاغ غير صالحة' }, 400, 'invalid_body');
    const input = body as Record<string, unknown>;
    if (clean(input.website, 200)) return respond({ success: true }, 202);

    const requesterName = clean(input.name, 120);
    const requesterEmail = clean(input.email, 320).toLowerCase();
    const category = clean(input.category, 40);
    const subject = clean(input.subject, 160);
    const message = clean(input.message, 4000);
    if (requesterName.length < 2 || !EMAIL_PATTERN.test(requesterEmail) || !CATEGORIES.has(category) || subject.length < 5 || message.length < 20) {
      return respond({ error: 'أكمل الاسم والبريد والتصنيف والعنوان ووصف المشكلة بدقة' }, 422, 'validation_failed');
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const number = ticketNumber();
    const assignedQueue = QUEUES[category] || 'support';
    const service = createServiceClient();
    const { data, error } = await service
      .from('support_requests')
      .insert({
        ticket_number: number,
        user_id: user?.id || null,
        requester_name: requesterName,
        requester_email: requesterEmail,
        category,
        subject,
        message,
        page_path: pagePath(input.pageUrl),
        assigned_queue: assignedQueue,
      })
      .select('ticket_number, status, assigned_queue, review_due_at')
      .single();
    if (error || !data) throw new Error('SUPPORT_TICKET_INSERT_FAILED');

    if (isProjectEmailConfigured()) {
      const safeMessage = escapeHtml(message).replaceAll('\n', '<br />');
      try {
        await sendTransactionalEmail({
          to: 'support@waha.systems',
          replyTo: requesterEmail,
          subject: `[${data.ticket_number}] ${subject}`,
          text: `بلاغ دعم جديد\nالرقم: ${data.ticket_number}\nالاسم: ${requesterName}\nالبريد: ${requesterEmail}\nالتصنيف: ${category}\nالمسار: ${pagePath(input.pageUrl) || 'غير محدد'}\n\n${message}`,
          html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.8"><h1>بلاغ دعم جديد</h1><p><strong>الرقم:</strong> ${escapeHtml(data.ticket_number)}</p><p><strong>الاسم:</strong> ${escapeHtml(requesterName)}</p><p><strong>البريد:</strong> ${escapeHtml(requesterEmail)}</p><p><strong>التصنيف:</strong> ${escapeHtml(category)}</p><p><strong>المسار:</strong> ${escapeHtml(pagePath(input.pageUrl) || 'غير محدد')}</p><hr /><p>${safeMessage}</p></div>`,
          idempotencyKey: `support-ticket-${data.ticket_number}`,
        });
      } catch {
        // The ticket is durable in the database; an email provider outage must
        // not make the reporter resubmit and create a duplicate request.
      }
    }

    return respond({
      success: true,
      ticket: {
        number: data.ticket_number,
        status: data.status,
        queue: data.assigned_queue,
        reviewDueAt: data.review_due_at,
      },
    }, 201);
  } catch {
    return respond({ error: 'تعذر تسجيل البلاغ الآن. استخدم support@waha.systems مؤقتاً.' }, 500, 'support_ticket_failed');
  }
}
