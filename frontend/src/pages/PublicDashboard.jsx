import { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line, Legend
} from 'recharts';
import { api } from '../api.js';
import './PublicDashboard.css';

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const JOURS_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const LOC_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6'];

function fmt(n, suffix = '') {
  if (!n || n === 0) return '—';
  return parseFloat(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + suffix;
}

function pct(val, total) {
  if (!total || total === 0) return 0;
  return Math.round((val / total) * 100);
}

// Génère les insights automatiquement depuis les données
function generateInsights(stats, analytics, locations) {
  const insights = [];
  if (!stats || !analytics) return insights;

  const { byDow, sourceRoi, locationStats, sourceByLocation } = analytics;
  const totalEntries = parseInt(stats.totals?.total_entries || 0);

  if (!totalEntries) return [{ type: 'info', text: 'Pas encore assez de données pour générer des insights. Commencez à saisir des données !' }];

  // Meilleur jour de la semaine
  if (byDow?.length > 0) {
    const sorted = [...byDow].sort((a,b) => parseInt(b.count) - parseInt(a.count));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const pctBest = pct(parseInt(best.count), totalEntries);
    insights.push({
      type: 'success',
      icon: '📅',
      title: `${JOURS_FULL[best.dow]} — jour de pointe`,
      text: `${parseInt(best.count)} client${best.count>1?'s':''} (${pctBest}% du total)${parseFloat(best.avg_ca) > 0 ? ` · panier moy. ${fmt(best.avg_ca,' €')}` : ''}`,
    });
    if (parseInt(worst.count) > 0 && worst.dow !== best.dow) {
      insights.push({
        type: 'warning',
        icon: '📉',
        title: `${JOURS_FULL[worst.dow]} — jour creux`,
        text: `Seulement ${worst.count} saisie${worst.count>1?'s':''}. Opportunité d'action marketing ciblée.`,
      });
    }
  }

  // Meilleur canal ROI
  if (sourceRoi?.length > 0) {
    const withCA = sourceRoi.filter(s => parseFloat(s.total_ca) > 0);
    if (withCA.length > 0) {
      const bestCA = [...withCA].sort((a,b) => parseFloat(b.total_ca) - parseFloat(a.total_ca))[0];
      const bestAvg = [...withCA].sort((a,b) => parseFloat(b.avg_ca) - parseFloat(a.avg_ca))[0];
      insights.push({
        type: 'success',
        icon: bestCA.icon || '💰',
        title: `${bestCA.label} — meilleur CA total`,
        text: `${fmt(bestCA.total_ca,' €')} de CA généré pour ${bestCA.count} client${bestCA.count>1?'s':''}. Panier moyen : ${fmt(bestCA.avg_ca,' €')}.`,
      });
      if (bestAvg.source_id !== bestCA.source_id) {
        insights.push({
          type: 'info',
          icon: bestAvg.icon || '🎯',
          title: `${bestAvg.label} — meilleur panier moyen`,
          text: `Panier moyen de ${fmt(bestAvg.avg_ca,' €')} par client. Canal à fort potentiel qualitatif.`,
        });
      }
    }

    // Canal le plus fréquent
    const bestCount = [...sourceRoi].sort((a,b) => parseInt(b.count) - parseInt(a.count))[0];
    const pctTop = pct(parseInt(bestCount.count), totalEntries);
    insights.push({
      type: 'info',
      icon: bestCount.icon || '📊',
      title: `${bestCount.label} — source principale`,
      text: `${bestCount.count} client${bestCount.count>1?'s':''} soit ${pctTop}% de la fréquentation totale.`,
    });
  }

  // Analyse par magasin
  if (locationStats?.length > 1) {
    const bestLoc = [...locationStats].sort((a,b) => parseInt(b.count) - parseInt(a.count))[0];
    const bestLocCA = [...locationStats].filter(l => parseFloat(l.avg_ca) > 0).sort((a,b) => parseFloat(b.avg_ca) - parseFloat(a.avg_ca))[0];
    insights.push({
      type: 'success',
      icon: '🏪',
      title: `${bestLoc.name} — magasin le plus actif`,
      text: `${bestLoc.count} saisie${bestLoc.count>1?'s':''}${parseFloat(bestLoc.total_ca) > 0 ? ` · ${fmt(bestLoc.total_ca,' €')} de CA tracké` : ''}`,
    });
    if (bestLocCA && bestLocCA.location_id !== bestLoc.location_id) {
      insights.push({
        type: 'info',
        icon: '💎',
        title: `${bestLocCA.name} — meilleur panier moyen`,
        text: `Panier moyen de ${fmt(bestLocCA.avg_ca,' €')}. Clientèle à plus fort pouvoir d'achat.`,
      });
    }
  }

  // Source × magasin — combinaison gagnante
  if (sourceByLocation?.length > 0) {
    const withCA = sourceByLocation.filter(s => parseFloat(s.total_ca) > 0);
    if (withCA.length > 0) {
      const best = [...withCA].sort((a,b) => parseFloat(b.total_ca) - parseFloat(a.total_ca))[0];
      insights.push({
        type: 'success',
        icon: '🏆',
        title: `Combo gagnant : ${best.source} × ${best.location}`,
        text: `${fmt(best.total_ca,' €')} de CA · ${best.count} client${best.count>1?'s':''} · panier moy. ${fmt(best.avg_ca,' €')}. Investissement prioritaire.`,
      });
    }
  }

  return insights;
}

const Tip = ({ active, payload, label, color }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="pdash-tip">
      {label && <p className="pdash-tip-label">{label}</p>}
      {payload.map((p,i) => (
        <p key={i} style={{ color: p.color || color || '#222' }}>
          {p.name}: <strong>{typeof p.value === 'number' && p.value > 100 ? fmt(p.value,' €') : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function PublicDashboard({ slug, client, isAdmin = false, clientId = null }) {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [metric, setMetric] = useState('count');
  const [activeTab, setActiveTab] = useState('overview');
  const [locations, setLocations] = useState([]);
  const color = client?.primary_color || '#6366f1';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (locationId) params.location_id = locationId;
      if (from) params.from = from;
      if (to) params.to = to;
      if (isAdmin && clientId) params.client_id = clientId;

      const [statsData, analyticsData] = await Promise.all([
        slug ? api.publicStats(slug, params) : api.stats(params),
        slug ? api.publicAnalytics(slug, params) : api.analytics(params),
      ]);
      setStats(statsData);
      setAnalytics(analyticsData);
      if (statsData.byLocation?.length) setLocations(statsData.byLocation);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [slug, locationId, from, to, isAdmin, clientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const insights = generateInsights(stats, analytics, locations);
  const total = parseInt(stats?.totals?.total_entries || 0);
  const totalCA = parseFloat(stats?.totals?.total_ca || 0);
  const sourceData = (stats?.bySource || []).map(r => ({ name: r.label, icon: r.icon, count: +r.count, ca: +r.ca, fill: r.color }));
  const locData = (stats?.byLocation || []).map((r,i) => ({ name: r.name, count: +r.count, ca: +r.ca, fill: LOC_COLORS[i % LOC_COLORS.length] }));

  // Données jour de semaine
  const dowData = JOURS.map((j, i) => {
    const found = analytics?.byDow?.find(d => parseInt(d.dow) === i);
    return { day: j, count: found ? parseInt(found.count) : 0, avg_ca: found ? parseFloat(found.avg_ca) : 0 };
  });

  // ROI sources
  const roiData = (analytics?.sourceRoi || []).map(s => ({
    name: s.label, icon: s.icon, color: s.color,
    count: parseInt(s.count), total_ca: parseFloat(s.total_ca), avg_ca: parseFloat(s.avg_ca),
  }));

  // Stats magasins enrichies
  const locStats = (analytics?.locationStats || []).map((l, i) => ({
    ...l, fill: LOC_COLORS[i % LOC_COLORS.length],
    count: parseInt(l.count), total_ca: parseFloat(l.total_ca), avg_ca: parseFloat(l.avg_ca),
  }));

  // Source × magasin
  const crossRoi = analytics?.sourceByLocation || [];

  // Tendance hebdo
  const weeklyData = (analytics?.weeklyTrend || []).map(w => ({
    week: new Date(w.week).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
    Clients: parseInt(w.count), 'CA €': parseFloat(w.ca),
  }));

  const DASH_TABS = [
    { id: 'overview',  label: '📊 Synthèse' },
    { id: 'canaux',    label: '📡 Canaux' },
    { id: 'magasins',  label: '🏪 Magasins' },
    { id: 'tendances', label: '📈 Tendances' },
    { id: 'insights',  label: `💡 Insights (${insights.length})` },
  ];

  return (
    <div className="pdash">
      {/* Filtres */}
      <div className="pdash-filters card">
        <div className="pdash-filter-row">
          {locations.length > 0 && (
            <div className="pdash-filter-group">
              <label className="field-label">Magasin</label>
              <select className="field-input" value={locationId} onChange={e => setLocationId(e.target.value)}>
                <option value="">Tous</option>
                {locations.map(l => <option key={l.location_id} value={l.location_id}>{l.name}</option>)}
              </select>
            </div>
          )}
          <div className="pdash-filter-group">
            <label className="field-label">Du</label>
            <input className="field-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="pdash-filter-group">
            <label className="field-label">Au</label>
            <input className="field-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button className="pdash-refresh-btn" onClick={fetchAll} disabled={loading}
            style={{ background: color }}>
            {loading ? <span className="spinner" /> : '↻'}
          </button>
          {slug && (
            <a className="btn btn-ghost pdash-export"
              href={api.publicExportUrl(slug, { location_id: locationId, from, to })}
              target="_blank" rel="noopener noreferrer">
              ↓ CSV
            </a>
          )}
        </div>
      </div>

      {/* KPIs top */}
      <div className="pdash-kpis">
        <div className="pdash-kpi card" style={{ borderTopColor: color }}>
          <div className="pdash-kpi-val" style={{ color }}>{total.toLocaleString('fr-FR')}</div>
          <div className="pdash-kpi-label">Clients enregistrés</div>
        </div>
        <div className="pdash-kpi card" style={{ borderTopColor: '#2563eb' }}>
          <div className="pdash-kpi-val" style={{ color: '#2563eb' }}>{totalCA > 0 ? fmt(totalCA,' €') : '—'}</div>
          <div className="pdash-kpi-label">CA tracké</div>
          {totalCA > 0 && total > 0 && <div className="pdash-kpi-sub">Panier moy. {fmt(totalCA/total,' €')}</div>}
        </div>
        <div className="pdash-kpi card" style={{ borderTopColor: roiData[0]?.color || color }}>
          <div className="pdash-kpi-val" style={{ color: roiData[0]?.color || color }}>
            {roiData[0] ? `${roiData[0].icon} ${roiData[0].name}` : '—'}
          </div>
          <div className="pdash-kpi-label">Canal n°1 (volume)</div>
          {roiData[0] && <div className="pdash-kpi-sub">{roiData[0].count} client{roiData[0].count>1?'s':''}</div>}
        </div>
        <div className="pdash-kpi card" style={{ borderTopColor: '#f59e0b' }}>
          <div className="pdash-kpi-val" style={{ color: '#f59e0b' }}>
            {dowData.reduce((best, d) => d.count > best.count ? d : best, { count: 0 }).day || '—'}
          </div>
          <div className="pdash-kpi-label">Jour de pointe</div>
          {dowData.reduce((best, d) => d.count > best.count ? d : best, { count: 0 }).count > 0 && (
            <div className="pdash-kpi-sub">{dowData.reduce((best, d) => d.count > best.count ? d : best, { count: 0 }).count} visites</div>
          )}
        </div>
      </div>

      {/* Tabs dashboard */}
      <div className="pdash-tabs">
        {DASH_TABS.map(t => (
          <button key={t.id} className={`pdash-tab ${activeTab===t.id?'active':''}`}
            style={activeTab===t.id ? { borderBottomColor: color, color } : {}}
            onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SYNTHÈSE ── */}
      {activeTab === 'overview' && (
        <div className="pdash-tab-content fade-in">
          <div className="pdash-two-col">
            {/* Donut sources */}
            <div className="card pdash-chart">
              <div className="pdash-chart-title">Origine des clients</div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={95}
                      paddingAngle={3} dataKey="count">
                      {sourceData.map((e,i) => <Cell key={i} fill={e.fill} stroke="#fff" strokeWidth={2} />)}
                    </Pie>
                    <Tooltip formatter={(v,n,p) => [v, p.payload.name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="pdash-legend">
                {sourceData.map((s,i) => (
                  <div key={i} className="pdash-legend-item">
                    <span className="pdash-dot" style={{ background: s.fill }} />
                    <span>{s.icon} {s.name}</span>
                    <strong>{s.count} <span className="pdash-pct">({pct(s.count,total)}%)</span></strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap jours */}
            <div className="card pdash-chart">
              <div className="pdash-chart-title">Affluence par jour de la semaine</div>
              <div className="pdash-dow-grid">
                {dowData.map((d,i) => {
                  const max = Math.max(...dowData.map(x => x.count), 1);
                  const intensity = max > 0 ? d.count / max : 0;
                  return (
                    <div key={i} className="pdash-dow-cell" title={`${d.count} client${d.count>1?'s':''}`}>
                      <div className="pdash-dow-bar-wrap">
                        <div className="pdash-dow-bar"
                          style={{ height: `${Math.max(intensity * 100, 4)}%`, background: color, opacity: 0.3 + intensity * 0.7 }} />
                      </div>
                      <div className="pdash-dow-label">{d.day}</div>
                      <div className="pdash-dow-count" style={{ color: d.count > 0 ? color : 'var(--text-muted)' }}>{d.count || '—'}</div>
                    </div>
                  );
                })}
              </div>
              {dowData.some(d => d.avg_ca > 0) && (
                <div className="pdash-dow-ca-row">
                  {dowData.map((d,i) => (
                    <div key={i} className="pdash-dow-ca-cell">
                      {d.avg_ca > 0 ? <span className="pdash-dow-ca">{fmt(d.avg_ca,'€')}</span> : <span>—</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="pdash-dow-hint">Panier moyen par jour ↑</div>
            </div>
          </div>

          {/* Top CP */}
          {stats?.topCP?.length > 0 && (
            <div className="card pdash-chart">
              <div className="pdash-chart-title">Zone de chalandise — Top codes postaux</div>
              <div className="pdash-cp-grid">
                {stats.topCP.map((cp,i) => (
                  <div key={i} className="pdash-cp-item">
                    <div className="pdash-cp-rank" style={{ background: color, opacity: 1 - i*0.08 }}>{i+1}</div>
                    <div className="pdash-cp-code">{cp.code_postal}</div>
                    <div className="pdash-cp-bar-wrap">
                      <div className="pdash-cp-bar" style={{ width: `${pct(cp.count, stats.topCP[0].count)}%`, background: color }} />
                    </div>
                    <div className="pdash-cp-count">{cp.count} client{cp.count>1?'s':''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CANAUX ── */}
      {activeTab === 'canaux' && (
        <div className="pdash-tab-content fade-in">
          {/* Toggle metric */}
          <div className="pdash-toggle">
            <button className={metric==='count'?'active':''} onClick={() => setMetric('count')}>Nb clients</button>
            <button className={metric==='ca'?'active':''} onClick={() => setMetric('ca')}>CA total</button>
            <button className={metric==='avg'?'active':''} onClick={() => setMetric('avg')}>Panier moyen</button>
          </div>

          {/* Tableau ROI canaux */}
          <div className="card pdash-chart">
            <div className="pdash-chart-title">Performance ROI par canal</div>
            <div className="pdash-roi-table">
              <div className="pdash-roi-header">
                <span>Canal</span><span>Clients</span><span>CA total</span><span>Panier moy.</span><span>Part</span>
              </div>
              {roiData.map((s,i) => (
                <div key={i} className="pdash-roi-row" style={{ borderLeftColor: s.color }}>
                  <div className="pdash-roi-name"><span className="pdash-roi-icon">{s.icon}</span>{s.name}</div>
                  <div className="pdash-roi-val"><strong>{s.count}</strong></div>
                  <div className="pdash-roi-val" style={{ color: s.total_ca > 0 ? '#16a34a' : 'var(--text-muted)' }}>
                    <strong>{fmt(s.total_ca,' €')}</strong>
                  </div>
                  <div className="pdash-roi-val" style={{ color: s.avg_ca > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                    <strong>{fmt(s.avg_ca,' €')}</strong>
                  </div>
                  <div className="pdash-roi-bar-cell">
                    <div className="pdash-roi-bar-wrap">
                      <div className="pdash-roi-bar" style={{
                        width: `${pct(metric==='count' ? s.count : metric==='ca' ? s.total_ca : s.avg_ca,
                          Math.max(...roiData.map(x => metric==='count' ? x.count : metric==='ca' ? x.total_ca : x.avg_ca)))}%`,
                        background: s.color
                      }} />
                    </div>
                    <span className="pdash-roi-pct">{pct(s.count, total)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Source × magasin */}
          {locStats.length > 1 && (
            <div className="card pdash-chart">
              <div className="pdash-chart-title">Canaux par magasin — analyse croisée</div>
              {locStats.map(loc => {
                const locSources = crossRoi.filter(s => s.location_id === loc.location_id);
                if (!locSources.length) return null;
                const maxCA = Math.max(...locSources.map(s => parseFloat(s.total_ca)), 1);
                return (
                  <div key={loc.location_id} className="pdash-cross-block">
                    <div className="pdash-cross-loc" style={{ color: loc.fill }}>
                      ◆ {loc.name}
                      <span className="pdash-cross-total">{loc.count} clients · {fmt(loc.total_ca,' €')} CA · panier moy. {fmt(loc.avg_ca,' €')}</span>
                    </div>
                    <div className="pdash-cross-sources">
                      {locSources.map((s,i) => (
                        <div key={i} className="pdash-cross-src">
                          <span className="pdash-cross-icon">{s.icon}</span>
                          <span className="pdash-cross-name">{s.source}</span>
                          <div className="pdash-cross-bar-wrap">
                            <div className="pdash-cross-bar"
                              style={{ width: `${pct(parseFloat(s.total_ca), maxCA)}%`, background: s.color }} />
                          </div>
                          <span className="pdash-cross-stats">
                            {s.count} cli. · {fmt(s.total_ca,' €')} · {fmt(s.avg_ca,'€/cli')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Radar canaux */}
          {roiData.length >= 3 && (
            <div className="card pdash-chart">
              <div className="pdash-chart-title">Vue radar — canaux</div>
              <div style={{ height: 280 }}>
                <ResponsiveContainer>
                  <RadarChart data={roiData.map(s => ({ subject: s.name, Clients: s.count, CA: Math.round(s.avg_ca) }))}>
                    <PolarGrid stroke="#e2e5f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#7b7e9e', fontSize: 11 }} />
                    <Radar name="Clients" dataKey="Clients" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MAGASINS ── */}
      {activeTab === 'magasins' && (
        <div className="pdash-tab-content fade-in">
          {locStats.length === 0 ? (
            <div className="pdash-empty">Aucune donnée par magasin disponible.</div>
          ) : (
            <>
              {/* Cards magasins */}
              <div className="pdash-loc-cards">
                {locStats.map((loc,i) => {
                  const locCP = (analytics?.cpByLocation || []).filter(c => c.location === loc.name).slice(0,5);
                  const locSources = crossRoi.filter(s => s.location_id === loc.location_id);
                  const topSource = locSources.length > 0 ? [...locSources].sort((a,b) => parseInt(b.count)-parseInt(a.count))[0] : null;
                  return (
                    <div key={i} className="card pdash-loc-card">
                      <div className="pdash-loc-header" style={{ borderLeftColor: loc.fill }}>
                        <span className="pdash-loc-name">{loc.name}</span>
                        <span className="pdash-loc-count" style={{ color: loc.fill }}>{loc.count} clients</span>
                      </div>
                      <div className="pdash-loc-stats">
                        <div className="pdash-loc-stat">
                          <div className="pdash-loc-stat-val" style={{ color: '#2563eb' }}>{fmt(loc.total_ca,' €')}</div>
                          <div className="pdash-loc-stat-lbl">CA tracké</div>
                        </div>
                        <div className="pdash-loc-stat">
                          <div className="pdash-loc-stat-val" style={{ color: '#16a34a' }}>{fmt(loc.avg_ca,' €')}</div>
                          <div className="pdash-loc-stat-lbl">Panier moyen</div>
                        </div>
                        <div className="pdash-loc-stat">
                          <div className="pdash-loc-stat-val" style={{ color: '#f59e0b' }}>{pct(loc.count, total)}%</div>
                          <div className="pdash-loc-stat-lbl">Part du trafic</div>
                        </div>
                      </div>
                      {topSource && (
                        <div className="pdash-loc-top-src">
                          <span className="pdash-loc-src-label">Canal principal :</span>
                          <span style={{ color: topSource.color }}>{topSource.icon} {topSource.source}</span>
                          <span className="pdash-loc-src-stats">{topSource.count} cli. · {fmt(topSource.avg_ca,'€ moy.')}</span>
                        </div>
                      )}
                      {locCP.length > 0 && (
                        <div className="pdash-loc-cp">
                          <div className="pdash-loc-cp-title">Zone de chalandise</div>
                          <div className="pdash-loc-cp-list">
                            {locCP.map((cp,j) => (
                              <span key={j} className="pdash-loc-cp-chip" style={{ borderColor: loc.fill, color: loc.fill }}>
                                {cp.code_postal} <strong>×{cp.count}</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Barres comparatives */}
              <div className="card pdash-chart">
                <div className="pdash-chart-title">Comparaison magasins</div>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer>
                    <BarChart data={locStats} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                      <XAxis dataKey="name" tick={{ fill: '#7b7e9e', fontSize: 11 }} tickLine={false} />
                      <YAxis tick={{ fill: '#7b7e9e', fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip content={<Tip color={color} />} />
                      <Bar dataKey="count" name="Clients" radius={[6,6,0,0]}>
                        {locStats.map((e,i) => <Cell key={i} fill={e.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TENDANCES ── */}
      {activeTab === 'tendances' && (
        <div className="pdash-tab-content fade-in">
          {weeklyData.length > 1 ? (
            <div className="card pdash-chart">
              <div className="pdash-chart-title">Évolution hebdomadaire</div>
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <LineChart data={weeklyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                    <XAxis dataKey="week" tick={{ fill: '#7b7e9e', fontSize: 10 }} tickLine={false} />
                    <YAxis tick={{ fill: '#7b7e9e', fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<Tip color={color} />} />
                    <Legend />
                    <Line type="monotone" dataKey="Clients" stroke={color} strokeWidth={2.5} dot={{ fill: color, r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="pdash-empty">Pas encore assez de données hebdomadaires.</div>
          )}

          {/* Dernières saisies */}
          {stats?.recent?.length > 0 && (
            <div className="card pdash-chart">
              <div className="pdash-chart-title">Dernières saisies</div>
              <div className="pdash-recent">
                {stats.recent.map((r,i) => (
                  <div key={i} className="pdash-recent-row">
                    <span className="pdash-recent-loc" style={{ color }}>◆ {r.location_name}</span>
                    <span className="pdash-recent-src" style={{ color: r.source_color }}>{r.source_icon} {r.source_label}</span>
                    {r.code_postal && <span className="pdash-chip">{r.code_postal}</span>}
                    {r.montant && <span className="pdash-recent-ca" style={{ color }}>{parseFloat(r.montant).toFixed(0)} €</span>}
                    <span className="pdash-recent-date">{new Date(r.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── INSIGHTS ── */}
      {activeTab === 'insights' && (
        <div className="pdash-tab-content fade-in">
          <div className="pdash-insights-header">
            <h2>Insights automatiques</h2>
            <p>Analyse générée depuis vos données — mise à jour en temps réel</p>
          </div>
          {insights.length === 0 ? (
            <div className="pdash-empty">Pas encore assez de données pour générer des insights.</div>
          ) : (
            <div className="pdash-insights-list">
              {insights.map((ins,i) => (
                <div key={i} className={`pdash-insight card pdash-insight-${ins.type}`}>
                  <div className="pdash-insight-icon">{ins.icon || (ins.type==='success'?'✅':ins.type==='warning'?'⚠️':'ℹ️')}</div>
                  <div className="pdash-insight-body">
                    <div className="pdash-insight-title">{ins.title}</div>
                    <div className="pdash-insight-text">{ins.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recommandations budget */}
          {roiData.filter(s => parseFloat(s.total_ca) > 0).length > 1 && (
            <div className="card pdash-chart pdash-budget-reco">
              <div className="pdash-chart-title">💰 Recommandations budget campagne</div>
              <div className="pdash-reco-list">
                {[...roiData].filter(s => s.count > 0).sort((a,b) => parseFloat(b.avg_ca) - parseFloat(a.avg_ca)).map((s,i) => {
                  const rank = i === 0 ? '🥇 Priorité haute' : i === 1 ? '🥈 Priorité moyenne' : '🥉 À surveiller';
                  const reco = i === 0
                    ? `Augmenter le budget — meilleur ROI qualitatif (${fmt(s.avg_ca,'€')} / client)`
                    : i === 1
                    ? `Maintenir le budget actuel — bon équilibre volume/qualité`
                    : `Optimiser ou redistribuer — panier moyen inférieur à la moyenne`;
                  return (
                    <div key={i} className="pdash-reco-item">
                      <div className="pdash-reco-rank">{rank}</div>
                      <div className="pdash-reco-src" style={{ color: s.color }}>{s.icon} {s.name}</div>
                      <div className="pdash-reco-text">{reco}</div>
                      <div className="pdash-reco-stats">
                        <span>{s.count} clients</span>
                        <span>{fmt(s.total_ca,' € CA')}</span>
                        <span>{fmt(s.avg_ca,' € /client')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
