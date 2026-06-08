import { useState, useEffect, useRef } from 'react';
import { api } from '../api.js';
import PublicDashboard from './PublicDashboard.jsx';
import './SuperAdminApp.css';

const TABS = [
  { id: 'overview', label: '🏠 Clients' },
  { id: 'nouveau',  label: '＋ Nouveau client' },
];

const DEFAULT_SOURCES = [
  { label: 'Radio locale',     icon: '📻', color: '#e8834a' },
  { label: 'Presse locale',    icon: '📰', color: '#7ab8e8' },
  { label: 'Affichage public', icon: '🪧', color: '#a87ae8' },
  { label: 'Internet',         icon: '🌐', color: '#7ae8a8' },
  { label: 'Bouche à oreille', icon: '💬', color: '#e8c97a' },
  { label: 'Fidèle / Autre',   icon: '⭐', color: '#888888' },
];

const EMOJI_OPTIONS = [
  '📻','📰','🪧','🌐','💬','⭐','📱','🎯','🏪','🎪','📺','📡',
  '🤝','👥','💼','🎁','📮','✉️','🔍','💡','🗺️','📍','🏠','🚗',
];

function EmojiPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sa-emoji-wrap">
      <button type="button" className="sa-emoji-btn field-input" onClick={() => setOpen(o => !o)}>
        {value || '📢'} <span className="sa-emoji-arrow">▾</span>
      </button>
      {open && (
        <div className="sa-emoji-dropdown">
          {EMOJI_OPTIONS.map(e => (
            <button key={e} type="button" className={`sa-emoji-opt ${value===e?'active':''}`}
              onClick={() => { onChange(e); setOpen(false); }}>
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuperAdminApp({ user, onLogout }) {
  const [tab, setTab] = useState('overview');
  const [globalStats, setGlobalStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);

  useEffect(() => {
    api.adminStats().then(setGlobalStats).catch(console.error);
    api.adminClients().then(setClients).catch(console.error);
  }, []);

  const refreshClients = () => api.adminClients().then(setClients);

  const openClient = async (client) => {
    const detail = await api.adminClientDetail(client.id);
    setSelectedClient(detail);
    setTab('client-detail');
  };

  return (
    <div className="sa-shell">
      <header className="sa-header">
        <div className="sa-header-inner">
          <div className="sa-logo">
            <div className="sa-logo-mark">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="3" fill="#fff"/>
                <circle cx="9" cy="2" r="1.8" fill="#fff"/>
                <circle cx="9" cy="16" r="1.8" fill="#fff"/>
                <circle cx="2" cy="9" r="1.8" fill="#fff"/>
                <circle cx="16" cy="9" r="1.8" fill="#fff"/>
                <circle cx="3.8" cy="3.8" r="1.3" fill="#fff"/>
                <circle cx="14.2" cy="3.8" r="1.3" fill="#fff"/>
                <circle cx="3.8" cy="14.2" r="1.3" fill="#fff"/>
                <circle cx="14.2" cy="14.2" r="1.3" fill="#fff"/>
              </svg>
            </div>
            <div>
              <div className="sa-logo-name">Equinoxes</div>
              <div className="sa-logo-sub">Trackr — Administration</div>
            </div>
          </div>

          {tab !== 'client-detail' && (
            <nav className="sa-tabs">
              {TABS.map(t => (
                <button key={t.id} className={`sa-tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </nav>
          )}

          {tab === 'client-detail' && (
            <button className="btn btn-ghost sa-back" onClick={() => { setTab('clients'); setSelectedClient(null); }}>
              ← Retour aux clients
            </button>
          )}

          <div className="sa-header-right">
            <div className="sa-user-badge"><div className="sa-user-dot" />{user.name || user.email}</div>
            <button className="btn btn-ghost sa-logout" onClick={onLogout}>Déconnexion</button>
          </div>
        </div>
      </header>

      <main className="sa-main">
        {tab === 'overview'      && <OverviewTab stats={globalStats} clients={clients} onOpenClient={openClient} />}
        {tab === 'nouveau'       && <NewClientTab onCreated={() => { refreshClients(); setTab('overview'); }} />}
        {tab === 'client-detail' && selectedClient && (
          <ClientDetailTab
            client={selectedClient}
            onRefresh={async () => { const d = await api.adminClientDetail(selectedClient.id); setSelectedClient(d); }}
            onDelete={() => { refreshClients(); setTab('overview'); setSelectedClient(null); }}
          />
        )}
      </main>
    </div>
  );
}

// ── Vue globale ───────────────────────────────────────────────

function OverviewTab({ stats, clients }) {
  const [activeClientId, setActiveClientId] = useState(null);
  const activeClient = clients.find(c => c.id === activeClientId);
  const statsByClient = stats?.by_client || [];

  const toggleClient = (id) => setActiveClientId(prev => prev === id ? null : id);

  return (
    <div className="sa-section">
      <div className="sa-page-header">
        <h1>Clients</h1>
        <p>Cliquez sur un client pour afficher son dashboard</p>
      </div>

      {clients.length === 0 && (
        <div className="sa-empty card"><p>Aucun client. Créez votre premier client !</p></div>
      )}

      {/* Grid cards clients */}
      <div className="sa-client-cards-grid">
        {clients.map(c => {
          const cStats = statsByClient.find(s => s.id === c.id) || {};
          const isActive = activeClientId === c.id;
          return (
            <div key={c.id}
              className={`sa-client-card card ${isActive ? 'active' : ''}`}
              style={{ '--c-accent': c.primary_color }}
              onClick={() => toggleClient(c.id)}>

              {/* Top bande couleur */}
              <div className="sa-cc-bar" style={{ background: c.primary_color }} />

              {/* Logo + nom */}
              <div className="sa-cc-header">
                {c.logo_url
                  ? <img src={c.logo_url} alt={c.name} className="sa-cc-logo" />
                  : <div className="sa-cc-initial" style={{ background: c.primary_color }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                }
                <div className="sa-cc-info">
                  <div className="sa-cc-name">{c.name}</div>
                  <code className="sa-cc-url">…/c/{c.slug}</code>
                </div>
                <div className={`sa-cc-chevron ${isActive ? 'open' : ''}`}>▾</div>
              </div>

              {/* KPIs mini */}
              <div className="sa-cc-kpis">
                <div className="sa-cc-kpi">
                  <div className="sa-cc-kpi-val" style={{ color: c.primary_color }}>
                    {parseInt(cStats.entries || 0).toLocaleString('fr-FR')}
                  </div>
                  <div className="sa-cc-kpi-lbl">saisies</div>
                </div>
                <div className="sa-cc-kpi">
                  <div className="sa-cc-kpi-val" style={{ color: '#2563eb' }}>
                    {parseFloat(cStats.ca || 0) > 0
                      ? parseFloat(cStats.ca).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
                      : '—'}
                  </div>
                  <div className="sa-cc-kpi-lbl">CA tracké</div>
                </div>
                <div className="sa-cc-kpi">
                  <div className="sa-cc-kpi-val">{c.total_locations || 0}</div>
                  <div className="sa-cc-kpi-lbl">magasin{c.total_locations > 1 ? 's' : ''}</div>
                </div>
              </div>

              {/* Footer */}
              <div className="sa-cc-footer">
                <span className={`badge ${c.dashboard_pin ? 'badge-green' : 'badge-gray'}`}>
                  {c.dashboard_pin ? '🔒 PIN actif' : '🔓 Sans PIN'}
                </span>
                <a href={`/c/${c.slug}`} target="_blank" rel="noopener noreferrer"
                  className="sa-cc-link" onClick={e => e.stopPropagation()}>
                  Ouvrir ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dashboard client sélectionné */}
      {activeClient && (
        <div className="sa-client-dash fade-up">
          <div className="sa-client-dash-header">
            <div className="sa-cc-dot" style={{ background: activeClient.primary_color }} />
            <h2>{activeClient.name}</h2>
            <a href={`/c/${activeClient.slug}`} target="_blank" rel="noopener noreferrer" className="sa-detail-url">
              track.qoma.fr/c/{activeClient.slug} ↗
            </a>
            <button className="btn btn-ghost sa-dash-close" onClick={() => setActiveClientId(null)}>✕ Fermer</button>
          </div>
          <PublicDashboard
            slug={null}
            client={activeClient}
            isAdmin={true}
            clientId={activeClient.id}
          />
        </div>
      )}
    </div>
  );
}

// ── Liste clients ─────────────────────────────────────────────

function ClientsTab({ clients, onOpenClient }) {
  return (
    <div className="sa-section">
      <div className="sa-page-header">
        <h1>Clients</h1>
        <p>{clients.length} client{clients.length!==1?'s':''} configuré{clients.length!==1?'s':''}</p>
      </div>
      <div className="sa-clients-list">
        {clients.length === 0 && <div className="sa-empty card"><p>Aucun client. Créez votre premier client !</p></div>}
        {clients.map(c => (
          <div key={c.id} className="sa-client-row card" onClick={() => onOpenClient(c)}>
            <div className="sa-cr-left">
              <div className="sa-cr-dot" style={{ background: c.primary_color }} />
              <div>
                <div className="sa-cr-name">{c.name}</div>
                <div className="sa-cr-meta">
                  <code className="sa-cr-url">track.qoma.fr/c/{c.slug}</code>
                  <span>·</span>
                  <span>{c.total_locations} magasin{c.total_locations!==1?'s':''}</span>
                  <span>·</span>
                  <span className={`badge ${c.dashboard_pin ? 'badge-green' : 'badge-gray'}`}>
                    {c.dashboard_pin ? '🔒 PIN actif' : '🔓 Sans PIN'}
                  </span>
                </div>
              </div>
            </div>
            <div className="sa-cr-right">
              <span className="badge badge-blue">{c.total_entries} saisies</span>
              <span className="sa-cr-arrow">→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Détail + édition client ────────────────────────────────────

function ClientDetailTab({ client, onRefresh, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: client.name, slug: client.slug,
    primary_color: client.primary_color || '#3CE65F',
    logo_url: client.logo_url || '',
    dashboard_pin: client.dashboard_pin || '',
  });
  const [locations, setLocations] = useState(client.locations.map(l => l.name));
  const [sources, setSources] = useState(client.sources.map(s => ({ ...s })));
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  const setF = (k,v) => setForm(f => ({ ...f, [k]: v }));
  const updateSource = (i,k,v) => setSources(ss => ss.map((s,j) => j===i ? {...s,[k]:v} : s));
  const addSource = () => setSources(ss => [...ss, { label:'', icon:'📢', color:'#888888' }]);
  const removeSource = i => setSources(ss => ss.filter((_,j) => j!==i));

  const onDragStart = i => { dragItem.current = i; };
  const onDragEnter = i => { dragOver.current = i; };
  const onDragEnd = () => {
    const arr = [...sources];
    const dragged = arr.splice(dragItem.current, 1)[0];
    arr.splice(dragOver.current, 0, dragged);
    setSources(arr);
    dragItem.current = null; dragOver.current = null;
  };

  const save = async () => {
    setSaving(true); setSaveStatus(null);
    try {
      await api.adminUpdateClient(client.id, {
        ...form,
        locations: locations.filter(l => l.trim()),
        sources: sources.filter(s => s.label.trim()),
      });
      setSaveStatus('ok');
      setEditing(false);
      onRefresh();
    } catch { setSaveStatus('err'); }
    setSaving(false);
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const deleteClient = async () => {
    if (!confirm(`Supprimer définitivement "${client.name}" et toutes ses données ?`)) return;
    await api.adminDeleteClient(client.id);
    onDelete();
  };

  return (
    <div className="sa-section">
      <div className="sa-detail-topbar">
        <div className="sa-detail-title">
          <div className="sa-detail-dot" style={{ background: form.primary_color }} />
          <h1>{client.name}</h1>
          <a href={`/c/${client.slug}`} target="_blank" rel="noopener noreferrer" className="sa-detail-url">
            track.qoma.fr/c/{client.slug} ↗
          </a>
        </div>
        <div className="sa-detail-actions">
          {!editing ? (
            <button className="btn btn-primary" onClick={() => setEditing(true)}>✏️ Modifier</button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => { setEditing(false); setSaveStatus(null); }}>Annuler</button>
              <button className="btn btn-green" onClick={save} disabled={saving}>
                {saving ? <span className="spinner" /> : saveStatus==='ok' ? '✓ Sauvegardé' : 'Sauvegarder'}
              </button>
            </>
          )}
        </div>
      </div>

      {saveStatus==='err' && <div className="sa-alert sa-alert-err">Erreur lors de la sauvegarde</div>}
      {saveStatus==='ok' && !editing && <div className="sa-alert sa-alert-ok">✓ Modifications sauvegardées</div>}

      <div className="sa-detail-grid">
        {/* Infos générales */}
        <div className="card sa-detail-card">
          <div className="sa-dc-title">Informations générales</div>
          {!editing ? (
            <div className="sa-info-list">
              <div className="sa-info-row"><span>Nom</span><strong>{client.name}</strong></div>
              <div className="sa-info-row"><span>Slug</span><code>{client.slug}</code></div>
              <div className="sa-info-row"><span>Couleur</span>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:18,height:18,borderRadius:4,background:client.primary_color}} />
                  <code>{client.primary_color}</code>
                </div>
              </div>
              <div className="sa-info-row"><span>Logo</span>
                {client.logo_url
                  ? <img src={client.logo_url} alt="" style={{height:32,borderRadius:4}} />
                  : <span className="sa-info-muted">—</span>}
              </div>
              <div className="sa-info-row"><span>PIN Dashboard</span>
                <span className={`badge ${client.dashboard_pin ? 'badge-green' : 'badge-gray'}`}>
                  {client.dashboard_pin ? '🔒 Actif (••••)' : '🔓 Non configuré'}
                </span>
              </div>
            </div>
          ) : (
            <div className="sa-edit-fields">
              <div><label className="field-label">Nom du client</label>
                <input className="field-input" value={form.name} onChange={e => setF('name',e.target.value)} /></div>
              <div><label className="field-label">Slug (URL)</label>
                <input className="field-input" value={form.slug} onChange={e => setF('slug',e.target.value)} /></div>
              <div><label className="field-label">Couleur principale</label>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <input type="color" className="sa-color-input" value={form.primary_color} onChange={e => setF('primary_color',e.target.value)} />
                  <input className="field-input" value={form.primary_color} onChange={e => setF('primary_color',e.target.value)} />
                </div>
              </div>
              <div><label className="field-label">URL Logo</label>
                <input className="field-input" placeholder="https://..." value={form.logo_url} onChange={e => setF('logo_url',e.target.value)} /></div>
              <div><label className="field-label">PIN Dashboard <span className="sa-optional">(4 chiffres — protège l'accès aux stats)</span></label>
                <input className="field-input" type="text" inputMode="numeric" maxLength={4} placeholder="1234"
                  value={form.dashboard_pin} onChange={e => setF('dashboard_pin',e.target.value.replace(/\D/,''))} /></div>
            </div>
          )}
        </div>

        {/* Magasins */}
        <div className="card sa-detail-card">
          <div className="sa-dc-title">Points de vente</div>
          {!editing ? (
            <div className="sa-list-items">
              {client.locations.map(l => <div key={l.id} className="sa-list-item">◆ {l.name}</div>)}
            </div>
          ) : (
            <div className="sa-edit-locs">
              {locations.map((loc,i) => (
                <div key={i} className="sa-loc-row">
                  <input className="field-input" value={loc}
                    onChange={e => { const a=[...locations]; a[i]=e.target.value; setLocations(a); }} />
                  <button className="btn btn-danger sa-del-btn" onClick={() => setLocations(ls => ls.filter((_,j)=>j!==i))}>✕</button>
                </div>
              ))}
              <button className="btn btn-ghost sa-add-btn" onClick={() => setLocations(ls => [...ls,''])}>+ Ajouter</button>
            </div>
          )}
        </div>

        {/* Sources */}
        <div className="card sa-detail-card sa-detail-card-full">
          <div className="sa-dc-title">
            Sources média
            {editing && <span className="sa-dc-hint">Glisser pour réordonner</span>}
          </div>
          {!editing ? (
            <div className="sa-sources-display">
              {client.sources.map(s => (
                <div key={s.id} className="sa-source-chip" style={{ borderColor: s.color, color: s.color }}>
                  {s.icon} {s.label}
                </div>
              ))}
            </div>
          ) : (
            <div className="sa-sources-edit">
              {sources.map((s,i) => (
                <div key={i} className="sa-source-row"
                  draggable onDragStart={() => onDragStart(i)} onDragEnter={() => onDragEnter(i)}
                  onDragEnd={onDragEnd} onDragOver={e => e.preventDefault()}>
                  <span className="sa-drag-handle">⠿</span>
                  <EmojiPicker value={s.icon} onChange={v => updateSource(i,'icon',v)} />
                  <input className="field-input sa-src-label" value={s.label} placeholder="Nom de la source"
                    onChange={e => updateSource(i,'label',e.target.value)} />
                  <input type="color" className="sa-color-input" value={s.color}
                    onChange={e => updateSource(i,'color',e.target.value)} />
                  <button className="btn btn-danger sa-del-btn" onClick={() => removeSource(i)}>✕</button>
                </div>
              ))}
              <button className="btn btn-ghost sa-add-btn" onClick={addSource}>+ Ajouter une source</button>
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="card sa-detail-card sa-detail-card-full sa-danger-zone">
          <div className="sa-dc-title sa-danger-title">⚠ Zone dangereuse</div>
          <div className="sa-danger-row">
            <div>
              <strong>Supprimer ce client</strong>
              <p>Supprime définitivement le client, ses magasins, sources et toutes les saisies.</p>
            </div>
            <button className="btn btn-danger" onClick={deleteClient}>Supprimer le client</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Nouveau client ────────────────────────────────────────────

function NewClientTab({ onCreated }) {
  const [form, setForm] = useState({
    name:'', slug:'', primary_color:'#3CE65F', logo_url:'', dashboard_pin:'',
    admin_email:'equinoxes-internal@equinoxes.fr', admin_password:'trackr-internal-2024', admin_name:'Admin',
  });
  const [locationsRaw, setLocationsRaw] = useState('');
  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  const setF = (k,v) => setForm(f => ({...f,[k]:v}));
  const autoSlug = name => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const updateSource = (i,k,v) => setSources(ss => ss.map((s,j) => j===i?{...s,[k]:v}:s));
  const addSource = () => setSources(ss => [...ss, { label:'', icon:'📢', color:'#888888' }]);
  const removeSource = i => setSources(ss => ss.filter((_,j) => j!==i));

  const onDragStart = i => { dragItem.current = i; };
  const onDragEnter = i => { dragOver.current = i; };
  const onDragEnd = () => {
    const arr = [...sources];
    const dragged = arr.splice(dragItem.current,1)[0];
    arr.splice(dragOver.current,0,dragged);
    setSources(arr);
    dragItem.current = null; dragOver.current = null;
  };

  const submit = async () => {
    if (!form.name || !form.slug) { setError('Le nom et le slug sont requis'); return; }
    setLoading(true); setError('');
    try {
      const locations = locationsRaw.split('\n').map(s=>s.trim()).filter(Boolean);
      // Génère un email/password interne unique pour éviter les conflits
      const internalEmail = `client-${form.slug}-${Date.now()}@trackr.internal`;
      const internalPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const result = await api.adminCreateClient({
        ...form,
        locations,
        sources: sources.filter(s=>s.label),
        admin_email: internalEmail,
        admin_password: internalPassword,
        admin_name: form.name,
      });
      onCreated(result);
    } catch(e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="sa-section">
      <div className="sa-page-header">
        <h1>Nouveau client</h1>
        <p>Accès par URL publique + PIN dashboard — aucun compte utilisateur requis</p>
      </div>

      <div className="sa-new-form">
        <div className="card sa-nc-card">
          <div className="sa-dc-title">Informations client</div>
          <div className="sa-nc-fields">
            <div>
              <label className="field-label">Nom du client *</label>
              <input className="field-input" placeholder="Bijouterie Feuillâtre"
                value={form.name} onChange={e => { setF('name',e.target.value); setF('slug',autoSlug(e.target.value)); }} />
            </div>
            <div>
              <label className="field-label">Slug URL *</label>
              <div className="sa-slug-wrap">
                <span className="sa-slug-prefix">…/c/</span>
                <input className="field-input sa-slug-input" placeholder="feuillatre"
                  value={form.slug} onChange={e => setF('slug',e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label">Couleur principale</label>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input type="color" className="sa-color-input" value={form.primary_color} onChange={e => setF('primary_color',e.target.value)} />
                <input className="field-input" value={form.primary_color} onChange={e => setF('primary_color',e.target.value)} />
              </div>
            </div>
            <div>
              <label className="field-label">URL Logo <span className="sa-optional">(facultatif)</span></label>
              <input className="field-input" placeholder="https://client.fr/logo.png" value={form.logo_url} onChange={e => setF('logo_url',e.target.value)} />
            </div>
            <div>
              <label className="field-label">PIN Dashboard <span className="sa-optional">(4 chiffres — protège les stats)</span></label>
              <input className="field-input" type="text" inputMode="numeric" maxLength={4} placeholder="1234"
                value={form.dashboard_pin} onChange={e => setF('dashboard_pin',e.target.value.replace(/\D/,''))} />
            </div>
          </div>
        </div>

        <div className="card sa-nc-card">
          <div className="sa-dc-title">Points de vente <span className="sa-optional">(un par ligne)</span></div>
          <textarea className="field-input sa-textarea" rows={4}
            placeholder={"Soissons\nVillers-Cotterêts\nCrépy-en-Valois"}
            value={locationsRaw} onChange={e => setLocationsRaw(e.target.value)} />
        </div>

        <div className="card sa-nc-card">
          <div className="sa-dc-title">Sources média <span className="sa-optional">(glisser pour réordonner)</span></div>
          <div className="sa-sources-edit">
            {sources.map((s,i) => (
              <div key={i} className="sa-source-row"
                draggable onDragStart={() => onDragStart(i)} onDragEnter={() => onDragEnter(i)}
                onDragEnd={onDragEnd} onDragOver={e => e.preventDefault()}>
                <span className="sa-drag-handle">⠿</span>
                <EmojiPicker value={s.icon} onChange={v => updateSource(i,'icon',v)} />
                <input className="field-input sa-src-label" value={s.label} placeholder="Nom de la source"
                  onChange={e => updateSource(i,'label',e.target.value)} />
                <input type="color" className="sa-color-input" value={s.color}
                  onChange={e => updateSource(i,'color',e.target.value)} />
                <button className="btn btn-danger sa-del-btn" onClick={() => removeSource(i)}>✕</button>
              </div>
            ))}
            <button className="btn btn-ghost sa-add-btn" onClick={addSource}>+ Ajouter une source</button>
          </div>
        </div>

        {error && <div className="sa-alert sa-alert-err">{error}</div>}

        <button className="btn btn-primary sa-nc-submit" onClick={submit} disabled={loading}>
          {loading ? <span className="spinner" /> : '✓ Créer le client →'}
        </button>
      </div>
    </div>
  );
}
