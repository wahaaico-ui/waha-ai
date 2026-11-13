import { NextResponse } from 'next/server';
import { availableStripePlans } from '@/lib/billing/stripe-plans';

/** Which plans can be bought online now; empty until the owner switches billing on with Stripe keys and prices. */
export async function GET() {
  return NextResponse.json({ plans: availableStripePlans() }, { headers: { 'Cache-Control': 'no-store' } });
}
