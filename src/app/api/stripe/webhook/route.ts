import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key', {
  apiVersion: '2025-02-28.acacia' as Stripe.LatestApiVersion,
});

function planForPrice(priceId?: string | null) {
  if (!priceId) return 'researcher';
  const institutional = (process.env.STRIPE_INSTITUTIONAL_PRICE_IDS || '').split(',').map((value) => value.trim());
  return institutional.includes(priceId) ? 'institutional' : 'researcher';
}

async function saveSubscription(subscription: Stripe.Subscription, fallbackUserId?: string | null) {
  const userId = subscription.metadata.userId || fallbackUserId;
  if (!userId) return;
  const item = subscription.items.data[0];
  const supabase = createServiceClient();
  const periodEnd = item?.current_period_end;
  await supabase.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    stripe_price_id: item?.price.id || null,
    plan: planForPrice(item?.price.id),
    status: subscription.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get('stripe-signature');
  if (!webhookSecret || !signature) return Response.json({ error: 'Webhook is not configured' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (typeof session.subscription === 'string') {
      await saveSubscription(await stripe.subscriptions.retrieve(session.subscription), session.metadata?.userId);
    }
  } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    await saveSubscription(event.data.object);
  }

  return Response.json({ received: true });
}
