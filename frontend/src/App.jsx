import { useState, useEffect } from 'react';
import { getUser, saveAuth, logout } from './api.js';
import LoginPage from './pages/LoginPage.jsx';
import SuperAdminApp from './pages/SuperAdminApp.jsx';
import ClientPublicApp from './pages/ClientPublicApp.jsx';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Détection URL publique /c/slug
  const path = window.location.pathname;
  const publicMatch = path.match(/^\/c\/([a-z0-9-]+)/);

  useEffect(() => {
    if (!publicMatch) {
      const u = getUser();
      if (u) setUser(u);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user?.primary_color) {
      document.documentElement.style.setProperty('--client', user.primary_color);
    }
  }, [user]);

  if (loading) return <div className="full-center"><span className="spinner spinner-dark" /></div>;

  // Route publique
  if (publicMatch) return <ClientPublicApp slug={publicMatch[1]} />;

  if (!user) return <LoginPage onLogin={(token, u) => { saveAuth(token, u); setUser(u); }} />;
  if (user.role === 'superadmin') return <SuperAdminApp user={user} onLogout={() => { logout(); setUser(null); }} />;

  // Admin/staff → rediriger vers URL publique si slug connu
  if (user.client_slug) {
    window.location.href = `/c/${user.client_slug}`;
    return null;
  }
  return <LoginPage onLogin={(token, u) => { saveAuth(token, u); setUser(u); }} />;
}
