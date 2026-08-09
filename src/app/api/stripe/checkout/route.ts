import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'dummy_key', {
  apiVersion: '2025-02-28.acacia' as any,
});

export async function POST(request: Request) {
  try {
    const { priceId, userId, email } = await request.json();

    if (!userId || !email) {
      return NextResponse.json({ error: 'بيانات المستخدم غير موجودة' }, { status: 400 });
    }

    // إنشاء جلسة دفع حقيقية عبر Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: priceId || 'price_1M_academic_sub', // معرف السعر التجريبي أو الفعلي
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${request.headers.get('origin')}/dashboard?success=true`,
      cancel_url: `${request.headers.get('origin')}/dashboard?canceled=true`,
      metadata: {
        userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'فشل إنشاء جلسة الدفع' }, { status: 500 });
  }
}
