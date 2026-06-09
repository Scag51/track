import { useState, useEffect } from 'react';
import { api } from '../api.js';
import PublicDashboard from './PublicDashboard.jsx';
import './ClientPublicApp.css';

export default function ClientPublicApp({ slug }) {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('saisie');
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [form, setForm] = useState({ location_id: '', source_id: '', montant: '', code_postal: '' });
  const [submitStatus, setSubmitStatus] = useState(null);

  useEffect(() => {
    api.publicConfig(slug)
      .then(data => {
        setConfig(data);
        const c = data.client.primary_color || '#3CE65F';
        document.documentElement.style.setProperty('--client', c);
        document.documentElement.style.setProperty('--client-dk', shadeColor(c, -20));
        document.documentElement.style.setProperty('--client-bg', hexToRgba(c, 0.08));
        document.title = `${data.client.name} — Trackr`;
      })
      .catch(() => setError('Client introuvable'));
  }, [slug]);

  const unlockPin = async () => {
    setPinLoading(true); setPinError('');
    try {
      await api.publicPin(slug, pin);
      setPinUnlocked(true);
    } catch { setPinError('PIN incorrect'); }
    setPinLoading(false);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.location_id || !form.source_id) { setSubmitStatus('missing'); return; }
    setSubmitStatus('loading');
    try {
      await api.publicEntry(slug, {
        location_id: parseInt(form.location_id),
        source_id: parseInt(form.source_id),
        montant: form.montant ? parseFloat(form.montant) : undefined,
        code_postal: form.code_postal || undefined,
      });
      setSubmitStatus('ok');
      setForm({ location_id: '', source_id: '', montant: '', code_postal: '' });
      setTimeout(() => setSubmitStatus(null), 3000);
    } catch { setSubmitStatus('err'); setTimeout(() => setSubmitStatus(null), 2500); }
  };

  if (error) return (
    <div className="pub-error">
      <div className="pub-error-icon">◆</div>
      <p>Ce lien est invalide ou a expiré.</p>
    </div>
  );

  if (!config) return <div className="full-center"><span className="spinner spinner-dark" /></div>;

  const { client, locations, sources } = config;
  const selLoc = locations.find(l => l.id === parseInt(form.location_id));
  const selSrc = sources.find(s => s.id === parseInt(form.source_id));
  const hasDash = !!client.dashboard_pin;

  return (
    <div className="pub-shell">
      {/* Bandeau démo */}
      {config.client.is_demo && (
        <div className="pub-demo-banner">
          <div className="pub-demo-inner">
            <span className="pub-demo-badge">DÉMO</span>
            <span className="pub-demo-text">Vous consultez une démonstration de Trackr by Equinoxes</span>
            <a
              href="https://axonaut.com/public/cms/21696_M6MNFPWEPE9KCSNH/product/GNQV1ANJ69RVE81AJQDG7KSAVLB1VW5B"
              target="_blank" rel="noopener noreferrer"
              className="pub-demo-cta">
              Démarrer — 29 € HT/mois →
            </a>
          </div>
        </div>
      )}

      {/* Header client */}
      <header className="pub-header" style={{ borderBottomColor: `color-mix(in srgb, var(--client) 30%, transparent)` }}>
        <div className="pub-header-inner">
          <div className="pub-brand">
            {client.logo_url
              ? <img src={client.logo_url} alt={client.name} className="pub-logo" />
              : <div className="pub-logo-text">{client.name.charAt(0)}</div>
            }
            <span className="pub-client-name">{client.name}</span>
          </div>
          {hasDash && (
            <div className="pub-tabs">
              <button className={`pub-tab ${tab==='saisie'?'active':''}`} onClick={() => setTab('saisie')}>Saisie</button>
              <button className={`pub-tab ${tab==='dashboard'?'active':''}`} onClick={() => setTab('dashboard')}>Stats</button>
            </div>
          )}
          <div className="pub-powered">
            <span>by</span>
            <a href="https://equinoxes.fr" target="_blank" rel="noopener noreferrer">Equinoxes</a>
          </div>
        </div>
      </header>

      <main className="pub-main">

        {/* ── SAISIE ── */}
        {tab === 'saisie' && (
          <div className="pub-saisie fade-up">
            <div className="pub-saisie-intro">
              <h1>Comment nous avez-vous connus ?</h1>
              <p>Aidez-nous à mieux vous servir en indiquant comment vous avez découvert {client.name}.</p>
            </div>

            {/* Magasin */}
            <div className="pub-section">
              <div className="pub-section-label">Votre magasin</div>
              <div className="pub-loc-grid">
                {locations.map(loc => (
                  <button key={loc.id}
                    className={`pub-loc-btn ${form.location_id===loc.id?'active':''}`}
                    onClick={() => set('location_id', loc.id)}>
                    <span className="pub-loc-icon">◆</span>
                    {loc.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Source */}
            <div className="pub-section">
              <div className="pub-section-label">Source de découverte</div>
              <div className="pub-src-grid">
                {sources.map(src => (
                  <button key={src.id}
                    className={`pub-src-btn ${form.source_id===src.id?'active':''}`}
                    style={{ '--sc': src.color }}
                    onClick={() => set('source_id', src.id)}>
                    <span className="pub-src-icon">{src.icon}</span>
                    <span className="pub-src-label">{src.label}</span>
                    {form.source_id===src.id && <span className="pub-src-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Infos optionnelles */}
            <div className="pub-section">
              <div className="pub-section-label">Informations complémentaires <span className="pub-optional">(facultatif)</span></div>
              <div className="pub-fields-row">
                <div>
                  <label className="field-label">Montant de la commande</label>
                  <div className="pub-input-wrap">
                    <input className="field-input" type="number" inputMode="decimal" placeholder="0.00"
                      value={form.montant} onChange={e => set('montant', e.target.value)} />
                    <span className="pub-input-suffix">€</span>
                  </div>
                </div>
                <div>
                  <label className="field-label">Code postal</label>
                  <input className="field-input" type="text" inputMode="numeric" placeholder="02000" maxLength={5}
                    value={form.code_postal} onChange={e => set('code_postal', e.target.value)} />
                </div>
              </div>
            </div>

            {/* Récap */}
            {(selLoc || selSrc) && (
              <div className="pub-recap">
                {selLoc && <span className="pub-tag pub-tag-loc">◆ {selLoc.name}</span>}
                {selSrc && <span className="pub-tag" style={{ borderColor: selSrc.color, color: selSrc.color }}>{selSrc.icon} {selSrc.label}</span>}
                {form.montant && <span className="pub-tag">{parseFloat(form.montant).toFixed(2)} €</span>}
                {form.code_postal && <span className="pub-tag">{form.code_postal}</span>}
              </div>
            )}

            {/* Submit */}
            <button className={`pub-submit ${submitStatus}`} onClick={submit} disabled={submitStatus==='loading'||submitStatus==='ok'}>
              {submitStatus==='loading' ? <span className="spinner" /> :
               submitStatus==='ok'      ? <><span>✓</span> Merci, c'est enregistré !</> :
               submitStatus==='err'     ? '✗ Erreur — réessayer' :
               submitStatus==='missing' ? '⚠ Sélectionnez un magasin et une source' :
               'Enregistrer →'}
            </button>

            {submitStatus === 'ok' && (
              <div className="pub-success fade-in">
                <div className="pub-success-icon">✓</div>
                <p>Merci pour votre retour !</p>
                <span>Votre réponse a bien été prise en compte.</span>
              </div>
            )}
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && !pinUnlocked && (
          <div className="pub-pin-wall fade-up">
            <div className="pub-pin-card card">
              <div className="pub-pin-icon">🔒</div>
              <h2>Accès statistiques</h2>
              <p>Entrez le code PIN pour accéder au tableau de bord.</p>
              <div className="pub-pin-inputs">
                {[0,1,2,3].map(i => (
                  <input key={i} className="pub-pin-input field-input"
                    type="password" inputMode="numeric" maxLength={1}
                    value={pin[i] || ''}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/,'');
                      const arr = pin.split('');
                      arr[i] = v;
                      const next = arr.join('').slice(0,4);
                      setPin(next);
                      if (v && i < 3) document.getElementById(`pin-${i+1}`)?.focus();
                    }}
                    id={`pin-${i}`}
                    onKeyDown={e => { if(e.key==='Enter' && pin.length===4) unlockPin(); }}
                  />
                ))}
              </div>
              {pinError && <div className="pub-pin-error">{pinError}</div>}
              <button className="btn btn-primary" style={{ width:'100%', height:44, justifyContent:'center' }}
                onClick={unlockPin} disabled={pinLoading || pin.length < 4}>
                {pinLoading ? <span className="spinner" /> : 'Accéder →'}
              </button>
            </div>
          </div>
        )}

        {tab === 'dashboard' && pinUnlocked && (
          <PublicDashboard slug={slug} client={client} />
        )}
      </main>
    </div>
  );
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.replace('#',''), 16);
  const r = Math.min(255, Math.max(0, (num>>16) + percent));
  const g = Math.min(255, Math.max(0, ((num>>8)&0xff) + percent));
  const b = Math.min(255, Math.max(0, (num&0xff) + percent));
  return '#' + ((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}
function hexToRgba(hex, alpha) {
  const num = parseInt(hex.replace('#',''), 16);
  return `rgba(${num>>16},${(num>>8)&0xff},${num&0xff},${alpha})`;
}
