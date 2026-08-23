import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { requireAuthenticatedUser } from '@/lib/supabase/authorization';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key', {
  apiVersion: '2025-02-28.acacia' as Stripe.LatestApiVersion,
});

export async function POST(request: Request) {
  try {
    const access = await requireAuthenticatedUser();
    if (!access) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json() as { priceId?: string };
    const priceId = body.priceId || process.env.STRIPE_RESEARCHER_PRICE_ID;
    const email = access.user.email;
    const allowedPrices = (process.env.STRIPE_ALLOWED_PRICE_IDS || '').split(',').map((value) => value.trim()).filter(Boolean);
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });

    if (!email || !priceId || (allowedPrices.length > 0 && !allowedPrices.includes(priceId))) {
      return NextResponse.json({ error: 'بيانات المستخدم غير موجودة' }, { status: 400 });
    }

    // إنشاء جلسة دفع حقيقية عبر Stripe
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
    return NextResponse.json({ error: error instanceof Error ? error.message : 'فشل إنشاء جلسة الدفع' }, { status: 500 });
  }
}
