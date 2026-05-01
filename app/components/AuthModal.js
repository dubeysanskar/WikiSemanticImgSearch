'use client';
import { useState } from 'react';

export default function AuthModal({ onClose, onLogin }) {
  const [step, setStep] = useState('form');
  const [email, setEmail] = useState('');
  const [globalWikiUsername, setGlobalWikiUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    if (!email || !globalWikiUsername) { setError('All fields are required'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, wikiUsername: globalWikiUsername, globalWikiUsername }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send OTP'); return; }
      setStep('otp');
    } catch (err) { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!otp) { setError('Enter OTP'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Invalid OTP'); return; }
      onLogin(data.token, data.user);
    } catch (err) { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>🔐 {step === 'form' ? 'Login to WikiSearch' : 'Enter OTP'}</h2>
        {step === 'form' ? (
          <form onSubmit={handleSendOTP} className="auth-form">
            <p className="auth-desc">Login with your Wikimedia account to save search history.</p>
            <div className="auth-field"><label>Global Wikimedia Username</label><input value={globalWikiUsername} onChange={(e) => setGlobalWikiUsername(e.target.value)} placeholder="Your global username" /></div>
            <div className="auth-field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
            {error && <p className="auth-error">{error}</p>}
            <button className="btn btn-primary auth-submit" disabled={loading}>{loading ? 'Sending OTP...' : 'Send OTP'}</button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="auth-form">
            <p className="auth-desc">We sent a 6-digit OTP to <strong>{email}</strong></p>
            <div className="auth-field"><label>One-Time Password</label><input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" maxLength={6} className="otp-input" autoFocus /></div>
            {error && <p className="auth-error">{error}</p>}
            <button className="btn btn-primary auth-submit" disabled={loading}>{loading ? 'Verifying...' : 'Verify & Login'}</button>
            <button type="button" className="btn btn-outline" style={{width:'100%',marginTop:8}} onClick={() => {setStep('form');setError('');}}>Back</button>
          </form>
        )}
      </div>
    </div>
  );
}
