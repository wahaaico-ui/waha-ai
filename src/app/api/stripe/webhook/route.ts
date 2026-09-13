import Stripe from 'stripe';
import { getStripePlanForPrice } from '@/lib/billing/stripe-plans';
import { createServiceClient } from '@/lib/supabase/service';

async function saveSubscription(subscription: Stripe.Subscription, fallbackUserId?: string | null) {
  const userId = subscription.metadata.userId || fallbackUserId;
  if (!userId) return false;
  const item = subscription.items.data[0];
  const priceId = item?.price.id;
  const plan = getStripePlanForPrice(priceId);
  if (!plan) {
    console.warn('Ignoring Stripe subscription with an unknown price', {
      subscriptionId: subscription.id,
      priceId: priceId ?? null,
    });
    return false;
  }
  const supabase = createServiceClient();
  const periodEnd = item?.current_period_end;
  const { error } = await supabase.from('subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    plan,
    status: subscription.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw new Error(`Failed to persist Stripe subscription: ${error.message}`);
  return true;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const signature = request.headers.get('stripe-signature');
  if (!webhookSecret || !stripeSecret) return Response.json({ error: 'Webhook is not configured' }, { status: 503 });
  if (!signature) return Response.json({ error: 'Missing webhook signature' }, { status: 400 });
  const stripe = new Stripe(stripeSecret);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (typeof session.subscription === 'string') {
        await saveSubscription(await stripe.subscriptions.retrieve(session.subscription), session.metadata?.userId);
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      await saveSubscription(event.data.object);
    }
  } catch (error) {
    console.error('Stripe webhook processing failed', error);
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  return Response.json({ received: true });
}
