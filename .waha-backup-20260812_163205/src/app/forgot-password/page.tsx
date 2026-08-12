'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMsg('');

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMsg('Password reset link sent to your email.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'system-ui' }}>
      <form onSubmit={handleReset} style={{ background: '#1e293b', padding: '40px', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #334155' }}>
        <h2 style={{ marginBottom: '24px', fontSize: '1.6rem', textAlign: 'center' }}>Reset Password</h2>
        {error && <p style={{ color: '#f87171', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</p>}
        {msg && <p style={{ color: '#4ade80', marginBottom: '16px', fontSize: '0.9rem' }}>{msg}</p>}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Email Address</label>
          <input type='email' value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #475569', color: 'white', borderRadius: '6px' }} />
        </div>
        <button type='submit' disabled={loading} style={{ width: '100%', padding: '12px', background: '#f59e0b', color: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.9rem' }}>
          <a href='/login' style={{ color: '#60a5fa', textDecoration: 'none' }}>Back to Sign In</a>
        </div>
      </form>
    </div>
  );
}
