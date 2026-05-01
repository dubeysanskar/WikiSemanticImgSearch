'use client';
import { signIn } from 'next-auth/react';

export default function AuthModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>🔐 Login to WikiSearch</h2>
        <div className="auth-form">
          <p className="auth-desc">
            Login with your Wikimedia account to save search history across devices
            and attribute your API requests.
          </p>
          <div style={{display:'flex',alignItems:'center',gap:12,background:'var(--info-bg)',padding:'12px 16px',borderRadius:'var(--radius)',marginBottom:16}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m12 16v-4M12 8h.01"/></svg>
            <span style={{fontSize:'0.8rem',color:'var(--info)'}}>Your identity is verified by Wikimedia. We never see your password.</span>
          </div>
          <button
            className="btn btn-primary auth-submit"
            style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'12px 20px',fontSize:'0.95rem'}}
            onClick={() => signIn('wikimedia')}
          >
            <img src="/commons-logo.svg" alt="" width="20" height="20" style={{filter:'brightness(10)'}} />
            Login with Wikimedia
          </button>
          <p style={{textAlign:'center',fontSize:'0.72rem',color:'var(--text-muted)',marginTop:12}}>
            You&apos;ll be redirected to meta.wikimedia.org to authenticate.
          </p>
        </div>
      </div>
    </div>
  );
}
