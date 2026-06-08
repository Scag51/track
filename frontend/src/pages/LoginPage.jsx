import { useState } from 'react';
import { api } from '../api.js';
import './LoginPage.css';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) { setError('Email et mot de passe requis'); return; }
    setLoading(true); setError('');
    try {
      const { token, user } = await api.login(email, password);
      onLogin(token, user);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-bg-shape shape1" />
      <div className="login-bg-shape shape2" />
      <div className="login-card card fade-up">
        <div className="login-logo">
          <div className="login-logo-mark">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="3.5" fill="#1a1b2e"/>
              <circle cx="11" cy="2.5" r="2" fill="#1a1b2e"/>
              <circle cx="11" cy="19.5" r="2" fill="#1a1b2e"/>
              <circle cx="2.5" cy="11" r="2" fill="#1a1b2e"/>
              <circle cx="19.5" cy="11" r="2" fill="#1a1b2e"/>
              <circle cx="4.7" cy="4.7" r="1.4" fill="#1a1b2e"/>
              <circle cx="17.3" cy="4.7" r="1.4" fill="#1a1b2e"/>
              <circle cx="4.7" cy="17.3" r="1.4" fill="#1a1b2e"/>
              <circle cx="17.3" cy="17.3" r="1.4" fill="#1a1b2e"/>
            </svg>
          </div>
          <div>
            <div className="login-brand">Equinoxes</div>
            <div className="login-product">Trackr</div>
          </div>
        </div>

        <h1 className="login-title">Connexion</h1>
        <p className="login-sub">Accès administration</p>

        <div className="login-fields">
          <div>
            <label className="field-label">Email</label>
            <input className="field-input" type="email" placeholder="admin@equinoxes.fr"
              value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter'&&submit()} />
          </div>
          <div>
            <label className="field-label">Mot de passe</label>
            <input className="field-input" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==='Enter'&&submit()} />
          </div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <button className="btn btn-primary login-btn" onClick={submit} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Se connecter →'}
        </button>

        <div className="login-footer">
          Propulsé par <a href="https://equinoxes.fr" target="_blank" rel="noopener noreferrer">Equinoxes</a>
        </div>
      </div>
    </div>
  );
}
