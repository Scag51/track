const BASE = '/api';

function getToken() { return localStorage.getItem('trackr_token'); }

function headers() {
  const t = getToken();
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method, headers: headers(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(err.error || 'Erreur serveur');
  }
  return res.json();
}

export const api = {
  login: (email, password) => req('POST', '/login', { email, password }),
  me: () => req('GET', '/me'),

  // Public (par slug)
  publicConfig: (slug) => req('GET', `/public/${slug}/config`),
  publicEntry: (slug, data) => req('POST', `/public/${slug}/entries`, data),
  publicPin: (slug, pin) => req('POST', `/public/${slug}/pin`, { pin }),
  publicStats: (slug, params={}) => req('GET', `/public/${slug}/stats?` + new URLSearchParams(params)),
  publicExportUrl: (slug, params={}) => BASE + `/public/${slug}/export?` + new URLSearchParams(params),

  // Admin
  adminStats: () => req('GET', '/admin/stats'),
  adminClients: () => req('GET', '/admin/clients'),
  adminClientDetail: (id) => req('GET', `/admin/clients/${id}`),
  adminCreateClient: (data) => req('POST', '/admin/clients', data),
  adminUpdateClient: (id, data) => req('PUT', `/admin/clients/${id}`, data),
  adminDeleteClient: (id) => req('DELETE', `/admin/clients/${id}`),
  adminAddUser: (clientId, data) => req('POST', `/admin/clients/${clientId}/users`, data),
  adminDeleteUser: (userId) => req('DELETE', `/admin/users/${userId}`),

  stats: (params={}) => req('GET', '/stats?' + new URLSearchParams(params)),
  exportUrl: (params={}) => BASE + '/export?' + new URLSearchParams(params) + '&_t=' + getToken(),
};

export function saveAuth(token, user) {
  localStorage.setItem('trackr_token', token);
  localStorage.setItem('trackr_user', JSON.stringify(user));
}
export function getUser() {
  try { return JSON.parse(localStorage.getItem('trackr_user')); } catch { return null; }
}
export function logout() {
  localStorage.removeItem('trackr_token');
  localStorage.removeItem('trackr_user');
}
