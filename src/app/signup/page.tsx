'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });

    if (error) {
      setError(error.message);
    } else {
      setMsg('Registration successful! Check your email or login.');
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: 'system-ui' }}>
      <form onSubmit={handleSignup} style={{ background: '#1e293b', padding: '40px', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #334155' }}>
        <h2 style={{ marginBottom: '24px', fontSize: '1.8rem', textAlign: 'center' }}>Create WAHA AI Account</h2>
        {error && <p style={{ color: '#f87171', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</p>}
        {msg && <p style={{ color: '#4ade80', marginBottom: '16px', fontSize: '0.9rem' }}>{msg}</p>}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Full Name</label>
          <input type='text' value={fullName} onChange={(e) => setFullName(e.target.value)} required style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #475569', color: 'white', borderRadius: '6px' }} />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Email</label>
          <input type='email' value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #475569', color: 'white', borderRadius: '6px' }} />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#94a3b8' }}>Password</label>
          <input type='password' value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #475569', color: 'white', borderRadius: '6px' }} />
        </div>
        <button type='submit' disabled={loading} style={{ width: '100%', padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>
        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.9rem' }}>
          <a href='/login' style={{ color: '#60a5fa', textDecoration: 'none' }}>Already have an account? Sign In</a>
        </div>
      </form>
    </div>
  );
}
