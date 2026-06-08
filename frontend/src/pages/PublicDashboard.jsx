import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { api } from '../api.js';
import './PublicDashboard.css';

export default function PublicDashboard({ slug, client }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [metric, setMetric] = useState('count');
  const [locations, setLocations] = useState([]);
  const color = client.primary_color || '#3CE65F';

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (locationId) params.location_id = locationId;
      if (from) params.from = from;
      if (to) params.to = to;
      const data = await api.publicStats(slug, params);
      setStats(data);
      if (data.byLocation?.length) setLocations(data.byLocation);
    } catch {}
    setLoading(false);
  }, [slug, locationId, from, to]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const COLORS = [color, '#7ab8e8', '#e87a9a', '#a87ae8', '#e8c97a', '#888'];

  const sourceData = (stats?.bySource||[]).map(r => ({ name: r.label, icon: r.icon, count: +r.count, ca: +r.ca, fill: r.color }));
  const locData    = (stats?.byLocation||[]).map((r,i) => ({ name: r.name, count: +r.count, ca: +r.ca, fill: COLORS[i%COLORS.length] }));
  const timeline   = (stats?.timeline||[]).map(r => ({ date: new Date(r.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}), Clients: +r.count, 'CA': +r.ca }));
  const total = +( stats?.totals?.total_entries||0);
  const totalCA = +(stats?.totals?.total_ca||0);

  const Tip = ({ active, payload, label }) => active && payload?.length ? (
    <div className="pdash-tip">
      {label && <p className="pdash-tip-label">{label}</p>}
      {payload.map((p,i) => <p key={i} style={{color:p.color||color}}>{p.name}: <strong>{p.value}</strong></p>)}
    </div>
  ) : null;

  return (
    <div className="pdash fade-up">
      {/* Filtres */}
      <div className="pdash-filters card">
        <div className="pdash-filter-row">
          <div className="pdash-filter-group">
            <label className="field-label">Magasin</label>
            <select className="field-input" value={locationId} onChange={e => setLocationId(e.target.value)}>
              <option value="">Tous</option>
              {locations.map(l => <option key={l.location_id} value={l.location_id}>{l.name}</option>)}
            </select>
          </div>
          <div className="pdash-filter-group">
            <label className="field-label">Du</label>
            <input className="field-input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="pdash-filter-group">
            <label className="field-label">Au</label>
            <input className="field-input" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button className="btn btn-primary pdash-refresh" onClick={fetchStats} disabled={loading}
            style={{ background: color }}>
            {loading ? <span className="spinner" /> : '↻'}
          </button>
          <a className="btn btn-ghost pdash-export" href={api.publicExportUrl(slug, { location_id: locationId, from, to })} target="_blank" rel="noopener noreferrer">
            ↓ CSV
          </a>
        </div>
      </div>

      {stats && (
        <>
          {/* KPIs */}
          <div className="pdash-kpis">
            {[
              { label: 'Clients enregistrés', value: total.toLocaleString('fr-FR'), color },
              { label: 'CA tracké', value: totalCA > 0 ? totalCA.toLocaleString('fr-FR',{maximumFractionDigits:0})+' €' : '—', color: '#2563eb' },
              { label: 'Top source', value: sourceData[0] ? `${sourceData[0].icon} ${sourceData[0].name}` : '—', color: sourceData[0]?.fill || color },
              { label: 'Top magasin', value: locData[0]?.name || '—', color: locData[0]?.fill || color },
            ].map((k, i) => (
              <div key={i} className="pdash-kpi card" style={{ borderTopColor: k.color }}>
                <div className="pdash-kpi-val" style={{ color: k.color }}>{k.value}</div>
                <div className="pdash-kpi-label">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Toggle */}
          <div className="pdash-toggle">
            <button className={metric==='count'?'active':''} onClick={() => setMetric('count')}>Clients</button>
            <button className={metric==='ca'?'active':''} onClick={() => setMetric('ca')}>CA €</button>
          </div>

          {/* Donut sources */}
          {sourceData.length > 0 && (
            <div className="pdash-chart card">
              <div className="pdash-chart-title">Origine des clients</div>
              <div style={{ height: 280 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={70} outerRadius={105}
                      paddingAngle={3} dataKey={metric==='count'?'count':'ca'}>
                      {sourceData.map((e,i) => <Cell key={i} fill={e.fill} stroke="#f8f9fc" strokeWidth={3} />)}
                    </Pie>
                    <Tooltip formatter={(v,n,p) => [metric==='ca'?v.toFixed(0)+' €':v, p.payload.name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="pdash-legend">
                {sourceData.map((s,i) => (
                  <div key={i} className="pdash-legend-item">
                    <span className="pdash-dot" style={{ background: s.fill }} />
                    <span>{s.icon} {s.name}</span>
                    <strong>{metric==='count' ? s.count : s.ca.toFixed(0)+' €'}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barres sources */}
          {sourceData.length > 0 && (
            <div className="pdash-chart card">
              <div className="pdash-chart-title">Détail par source</div>
              <div style={{ height: 240 }}>
                <ResponsiveContainer>
                  <BarChart data={sourceData} margin={{top:5,right:10,left:0,bottom:40}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                    <XAxis dataKey="name" tick={{fill:'#7b7e9e',fontSize:10}} tickLine={false} angle={-25} textAnchor="end" />
                    <YAxis tick={{fill:'#7b7e9e',fontSize:10}} tickLine={false} axisLine={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey={metric==='count'?'count':'ca'} radius={[6,6,0,0]}>
                      {sourceData.map((e,i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Barres magasins */}
          {locData.length > 1 && (
            <div className="pdash-chart card">
              <div className="pdash-chart-title">Comparaison magasins</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={locData} margin={{top:5,right:10,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                    <XAxis dataKey="name" tick={{fill:'#7b7e9e',fontSize:10}} tickLine={false} />
                    <YAxis tick={{fill:'#7b7e9e',fontSize:10}} tickLine={false} axisLine={false} />
                    <Tooltip content={<Tip />} />
                    <Bar dataKey={metric==='count'?'count':'ca'} radius={[6,6,0,0]}>
                      {locData.map((e,i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 1 && (
            <div className="pdash-chart card">
              <div className="pdash-chart-title">Évolution dans le temps</div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer>
                  <LineChart data={timeline} margin={{top:5,right:10,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f8" />
                    <XAxis dataKey="date" tick={{fill:'#7b7e9e',fontSize:10}} tickLine={false} />
                    <YAxis tick={{fill:'#7b7e9e',fontSize:10}} tickLine={false} axisLine={false} />
                    <Tooltip content={<Tip />} />
                    <Line type="monotone" dataKey={metric==='count'?'Clients':'CA'}
                      stroke={color} strokeWidth={2.5} dot={{fill:color,r:4,strokeWidth:2,stroke:'#fff'}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top CP */}
          {stats.topCP?.length > 0 && (
            <div className="pdash-chart card">
              <div className="pdash-chart-title">Top codes postaux</div>
              <div className="pdash-cp-list">
                {stats.topCP.map((cp,i) => (
                  <div key={i} className="pdash-cp-row">
                    <span className="pdash-cp-rank">{i+1}</span>
                    <span className="pdash-cp-code">{cp.code_postal}</span>
                    <div className="pdash-cp-track">
                      <div className="pdash-cp-bar" style={{ width:`${(cp.count/stats.topCP[0].count)*100}%`, background: color }} />
                    </div>
                    <span className="pdash-cp-n">{cp.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Récents */}
          {stats.recent?.length > 0 && (
            <div className="pdash-chart card">
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
        </>
      )}
    </div>
  );
}
