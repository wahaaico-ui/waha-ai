import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripePricePlanMap, isStripeCheckoutEnabled } from '@/lib/billing/stripe-plans';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json() as { priceId?: string };
    const priceId = body.priceId || process.env.STRIPE_PRO_PRICE_ID || process.env.STRIPE_RESEARCHER_PRICE_ID;
    const email = access.user.email;
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });

    if (!isStripeCheckoutEnabled()) {
      return NextResponse.json({ error: 'الدفع غير متاح حالياً' }, { status: 503 });
    }
    const configuredPrices = getStripePricePlanMap();

    if (!email || !priceId || !configuredPrices.has(priceId)) {
      return NextResponse.json({ error: 'خطة الدفع المطلوبة غير متاحة' }, { status: 400 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${new URL(request.url).origin}/dashboard?success=true`,
      cancel_url: `${new URL(request.url).origin}/dashboard?canceled=true`,
      metadata: {
        userId: access.user.id,
      },
      subscription_data: {
        metadata: {
          userId: access.user.id,
        },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('Stripe checkout failed', error);
    return NextResponse.json({ error: 'فشل إنشاء جلسة الدفع' }, { status: 500 });
  }
}
