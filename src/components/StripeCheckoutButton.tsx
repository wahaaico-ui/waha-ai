'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StripeCheckoutButton({ label, className }: { label: string; className: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function checkout() {
    setLoading(true);
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await response.json() as { url?: string; error?: string };
    setLoading(false);
    if (response.status === 401) return router.push('/signup?next=/pricing');
    if (data.url) window.location.assign(data.url);
    else window.alert(data.error || 'تعذر بدء الدفع');
  }

  return <button type="button" onClick={checkout} disabled={loading} className={`${className} disabled:opacity-60`}>{loading ? 'جاري فتح الدفع...' : label}</button>;
}
