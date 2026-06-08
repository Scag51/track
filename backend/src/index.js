import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pool, { initDB } from '../db/init.js';
import { signToken, requireAuth, requireRole } from './auth.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;

await initDB();

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  const { rows } = await pool.query(
    `SELECT u.*, c.name as client_name, c.slug as client_slug, c.primary_color, c.logo_url
     FROM users u LEFT JOIN clients c ON u.client_id = c.id WHERE u.email = $1`, [email]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Identifiants incorrects' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Identifiants incorrects' });
  const token = signToken({
    id: user.id, email: user.email, role: user.role, name: user.name,
    client_id: user.client_id, client_name: user.client_name,
    client_slug: user.client_slug, primary_color: user.primary_color, logo_url: user.logo_url,
  });
  res.json({ token, user: {
    id: user.id, email: user.email, role: user.role, name: user.name,
    client_id: user.client_id, client_name: user.client_name,
    client_slug: user.client_slug, primary_color: user.primary_color, logo_url: user.logo_url,
  }});
});

app.get('/api/me', requireAuth, async (req, res) => res.json({ user: req.user }));

// ═══════════════════════════════════════════════════════════════
// PUBLIC — accès par slug (sans auth)
// ═══════════════════════════════════════════════════════════════

// Config publique client
app.get('/api/public/:slug/config', async (req, res) => {
  const { rows: [client] } = await pool.query(
    `SELECT id, name, slug, primary_color, logo_url, dashboard_pin FROM clients WHERE slug=$1`, [req.params.slug]
  );
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  const { rows: locations } = await pool.query(`SELECT * FROM locations WHERE client_id=$1 ORDER BY name`, [client.id]);
  const { rows: sources } = await pool.query(`SELECT * FROM sources WHERE client_id=$1 ORDER BY sort_order`, [client.id]);
  res.json({ client, locations, sources });
});

// Saisie publique
app.post('/api/public/:slug/entries', async (req, res) => {
  const { rows: [client] } = await pool.query(`SELECT id FROM clients WHERE slug=$1`, [req.params.slug]);
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  const { location_id, source_id, montant, code_postal } = req.body;
  if (!location_id || !source_id) return res.status(400).json({ error: 'location_id et source_id requis' });
  const { rows } = await pool.query(
    `INSERT INTO entries (client_id, location_id, source_id, montant, code_postal) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [client.id, location_id, source_id, montant || null, code_postal || null]
  );
  res.status(201).json(rows[0]);
});

// Vérification PIN dashboard
app.post('/api/public/:slug/pin', async (req, res) => {
  const { pin } = req.body;
  const { rows: [client] } = await pool.query(`SELECT id, dashboard_pin FROM clients WHERE slug=$1`, [req.params.slug]);
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  if (!client.dashboard_pin || client.dashboard_pin !== pin) {
    return res.status(401).json({ error: 'PIN incorrect' });
  }
  res.json({ ok: true });
});

// Stats publiques (après vérification PIN côté client)
app.get('/api/public/:slug/stats', async (req, res) => {
  const { rows: [client] } = await pool.query(`SELECT id FROM clients WHERE slug=$1`, [req.params.slug]);
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  const { from, to, location_id } = req.query;
  const { where, params } = buildWhere(client.id, from, to, location_id);
  const data = await getStats(where, params);
  res.json(data);
});

// Export public CSV
app.get('/api/public/:slug/export', async (req, res) => {
  const { rows: [client] } = await pool.query(`SELECT id, name FROM clients WHERE slug=$1`, [req.params.slug]);
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  const { from, to, location_id } = req.query;
  const { where, params } = buildWhere(client.id, from, to, location_id);
  await exportCSV(res, where, params, client.name);
});

// ═══════════════════════════════════════════════════════════════
// SUPERADMIN
// ═══════════════════════════════════════════════════════════════

app.get('/api/admin/clients', requireAuth, requireRole('superadmin'), async (req, res) => {
  const { rows } = await pool.query(`
    SELECT c.*,
      (SELECT COUNT(*) FROM entries e WHERE e.client_id = c.id) as total_entries,
      (SELECT COUNT(*) FROM users u WHERE u.client_id = c.id) as total_users,
      (SELECT COUNT(*) FROM locations l WHERE l.client_id = c.id) as total_locations
    FROM clients c ORDER BY c.created_at DESC
  `);
  res.json(rows);
});

app.post('/api/admin/clients', requireAuth, requireRole('superadmin'), async (req, res) => {
  const { name, slug, primary_color, logo_url, dashboard_pin, locations, sources, admin_email, admin_password, admin_name } = req.body;
  if (!name || !slug || !admin_email || !admin_password) {
    return res.status(400).json({ error: 'name, slug, admin_email, admin_password requis' });
  }
  const client = await pool.query(
    `INSERT INTO clients (name, slug, primary_color, logo_url, dashboard_pin) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, slug, primary_color || '#3CE65F', logo_url || null, dashboard_pin || null]
  );
  const clientId = client.rows[0].id;
  if (locations?.length) {
    for (const loc of locations) {
      await pool.query(`INSERT INTO locations (client_id, name) VALUES ($1,$2)`, [clientId, loc]);
    }
  }
  if (sources?.length) {
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      await pool.query(
        `INSERT INTO sources (client_id, label, icon, color, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [clientId, s.label, s.icon || '📢', s.color || '#888888', i]
      );
    }
  }
  const hash = await bcrypt.hash(admin_password, 12);
  await pool.query(
    `INSERT INTO users (client_id, email, password_hash, role, name) VALUES ($1,$2,$3,'admin',$4)`,
    [clientId, admin_email, hash, admin_name || name]
  );
  res.status(201).json(client.rows[0]);
});

// Détail client
app.get('/api/admin/clients/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  const { rows: [client] } = await pool.query(`SELECT * FROM clients WHERE id=$1`, [req.params.id]);
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  const { rows: locations } = await pool.query(`SELECT * FROM locations WHERE client_id=$1 ORDER BY name`, [client.id]);
  const { rows: sources } = await pool.query(`SELECT * FROM sources WHERE client_id=$1 ORDER BY sort_order`, [client.id]);
  const { rows: users } = await pool.query(`SELECT id,email,role,name,created_at FROM users WHERE client_id=$1`, [client.id]);
  res.json({ ...client, locations, sources, users });
});

// Modifier un client
app.put('/api/admin/clients/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  const { name, slug, primary_color, logo_url, dashboard_pin, locations, sources } = req.body;
  const clientId = req.params.id;

  await pool.query(
    `UPDATE clients SET name=$1, slug=$2, primary_color=$3, logo_url=$4, dashboard_pin=$5 WHERE id=$6`,
    [name, slug, primary_color, logo_url || null, dashboard_pin || null, clientId]
  );

  // Remplacer magasins
  if (locations !== undefined) {
    await pool.query(`DELETE FROM locations WHERE client_id=$1`, [clientId]);
    for (const loc of locations) {
      await pool.query(`INSERT INTO locations (client_id, name) VALUES ($1,$2)`, [clientId, typeof loc === 'string' ? loc : loc.name]);
    }
  }

  // Remplacer sources
  if (sources !== undefined) {
    await pool.query(`DELETE FROM sources WHERE client_id=$1`, [clientId]);
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      await pool.query(
        `INSERT INTO sources (client_id, label, icon, color, sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [clientId, s.label, s.icon || '📢', s.color || '#888888', i]
      );
    }
  }

  const { rows: [updated] } = await pool.query(`SELECT * FROM clients WHERE id=$1`, [clientId]);
  res.json(updated);
});

// Supprimer un client
app.delete('/api/admin/clients/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  await pool.query(`DELETE FROM clients WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// Ajouter user
app.post('/api/admin/clients/:id/users', requireAuth, requireRole('superadmin'), async (req, res) => {
  const { email, password, role, name } = req.body;
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (client_id, email, password_hash, role, name) VALUES ($1,$2,$3,$4,$5) RETURNING id,email,role,name`,
    [req.params.id, email, hash, role || 'staff', name]
  );
  res.status(201).json(rows[0]);
});

// Supprimer user
app.delete('/api/admin/users/:id', requireAuth, requireRole('superadmin'), async (req, res) => {
  await pool.query(`DELETE FROM users WHERE id=$1 AND role != 'superadmin'`, [req.params.id]);
  res.json({ ok: true });
});

// Stats globales
app.get('/api/admin/stats', requireAuth, requireRole('superadmin'), async (req, res) => {
  const totals = await pool.query(`SELECT COUNT(*) as clients FROM clients`);
  const entries = await pool.query(`SELECT COUNT(*) as entries, COALESCE(SUM(montant),0) as ca FROM entries`);
  const byClient = await pool.query(`
    SELECT c.id, c.name, c.slug, c.primary_color,
      COUNT(e.id) as entries, COALESCE(SUM(e.montant),0) as ca
    FROM clients c LEFT JOIN entries e ON e.client_id=c.id
    GROUP BY c.id ORDER BY entries DESC
  `);
  res.json({
    total_clients: parseInt(totals.rows[0].clients),
    total_entries: parseInt(entries.rows[0].entries),
    total_ca: parseFloat(entries.rows[0].ca),
    by_client: byClient.rows,
  });
});

// ═══════════════════════════════════════════════════════════════
// STATS & EXPORT (auth)
// ═══════════════════════════════════════════════════════════════

function buildWhere(clientId, from, to, locationId) {
  const conditions = [`e.client_id = $1`];
  const params = [clientId];
  let idx = 2;
  if (from)       { conditions.push(`e.created_at >= $${idx++}`); params.push(from); }
  if (to)         { conditions.push(`e.created_at <= $${idx++}`); params.push(to + 'T23:59:59'); }
  if (locationId) { conditions.push(`e.location_id = $${idx++}`); params.push(locationId); }
  return { where: 'WHERE ' + conditions.join(' AND '), params };
}

async function getStats(where, params) {
  const totals   = await pool.query(`SELECT COUNT(*) as total_entries, COALESCE(SUM(e.montant),0) as total_ca FROM entries e ${where}`, params);
  const bySource = await pool.query(`SELECT s.label, s.icon, s.color, s.id as source_id, COUNT(e.id) as count, COALESCE(SUM(e.montant),0) as ca FROM entries e JOIN sources s ON e.source_id=s.id ${where} GROUP BY s.id ORDER BY count DESC`, params);
  const byLocation = await pool.query(`SELECT l.name, l.id as location_id, COUNT(e.id) as count, COALESCE(SUM(e.montant),0) as ca FROM entries e JOIN locations l ON e.location_id=l.id ${where} GROUP BY l.id ORDER BY count DESC`, params);
  const crossData = await pool.query(`SELECT l.name as location, s.label as source, s.color, s.icon, COUNT(e.id) as count, COALESCE(SUM(e.montant),0) as ca FROM entries e JOIN locations l ON e.location_id=l.id JOIN sources s ON e.source_id=s.id ${where} GROUP BY l.name, s.label, s.color, s.icon ORDER BY l.name, count DESC`, params);
  const topCP = await pool.query(`SELECT e.code_postal, COUNT(*) as count FROM entries e ${where} AND e.code_postal IS NOT NULL GROUP BY e.code_postal ORDER BY count DESC LIMIT 10`, params);
  const timeline = await pool.query(`SELECT DATE(e.created_at) as date, COUNT(*) as count, COALESCE(SUM(e.montant),0) as ca FROM entries e ${where} GROUP BY DATE(e.created_at) ORDER BY date ASC`, params);
  const recent = await pool.query(`SELECT e.*, l.name as location_name, s.label as source_label, s.color as source_color, s.icon as source_icon FROM entries e JOIN locations l ON e.location_id=l.id JOIN sources s ON e.source_id=s.id ${where} ORDER BY e.created_at DESC LIMIT 20`, params);
  return { totals: totals.rows[0], bySource: bySource.rows, byLocation: byLocation.rows, crossData: crossData.rows, topCP: topCP.rows, timeline: timeline.rows, recent: recent.rows };
}

async function exportCSV(res, where, params, clientName) {
  const { rows } = await pool.query(`SELECT e.id, l.name as magasin, s.label as source, e.montant, e.code_postal, e.created_at FROM entries e JOIN locations l ON e.location_id=l.id JOIN sources s ON e.source_id=s.id ${where} ORDER BY e.created_at DESC`, params);
  const csv = ['ID,Magasin,Source,Montant,Code Postal,Date', ...rows.map(r => `${r.id},"${r.magasin}","${r.source}",${r.montant || ''},${r.code_postal || ''},${new Date(r.created_at).toLocaleString('fr-FR')}`)].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="trackr-${clientName}.csv"`);
  res.send('\uFEFF' + csv);
}

app.get('/api/stats', requireAuth, async (req, res) => {
  const clientId = req.user.role === 'superadmin' ? req.query.client_id : req.user.client_id;
  if (!clientId) return res.status(400).json({ error: 'client_id requis' });
  const { from, to, location_id } = req.query;
  const { where, params } = buildWhere(clientId, from, to, location_id);
  res.json(await getStats(where, params));
});

app.get('/api/export', requireAuth, async (req, res) => {
  const clientId = req.user.role === 'superadmin' ? req.query.client_id : req.user.client_id;
  if (!clientId) return res.status(400).json({ error: 'client_id requis' });
  const { from, to, location_id } = req.query;
  const { where, params } = buildWhere(clientId, from, to, location_id);
  await exportCSV(res, where, params, req.user.client_name || 'export');
});

// ═══════════════════════════════════════════════════════════════
// ANALYTICS ENRICHIS
// ═══════════════════════════════════════════════════════════════

async function getAnalytics(clientId, from, to, locationId) {
  const { where, params } = buildWhere(clientId, from, to, locationId);

  // Jours de la semaine (0=dim, 1=lun, ..., 6=sam)
  const byDow = await pool.query(`
    SELECT EXTRACT(DOW FROM e.created_at) as dow,
           COUNT(*) as count,
           COALESCE(AVG(e.montant) FILTER (WHERE e.montant IS NOT NULL), 0) as avg_ca,
           COALESCE(SUM(e.montant), 0) as total_ca
    FROM entries e ${where}
    GROUP BY dow ORDER BY dow ASC`, params);

  // Heure de la journée
  const byHour = await pool.query(`
    SELECT EXTRACT(HOUR FROM e.created_at) as hour,
           COUNT(*) as count
    FROM entries e ${where}
    GROUP BY hour ORDER BY hour ASC`, params);

  // ROI par source (panier moyen, nb clients, CA total)
  const sourceRoi = await pool.query(`
    SELECT s.label, s.icon, s.color, s.id as source_id,
           COUNT(e.id) as count,
           COALESCE(SUM(e.montant), 0) as total_ca,
           COALESCE(AVG(e.montant) FILTER (WHERE e.montant IS NOT NULL), 0) as avg_ca
    FROM entries e JOIN sources s ON e.source_id=s.id ${where}
    GROUP BY s.id ORDER BY total_ca DESC`, params);

  // ROI croisé source × magasin
  const sourceByLocation = await pool.query(`
    SELECT l.name as location, l.id as location_id,
           s.label as source, s.icon, s.color, s.id as source_id,
           COUNT(e.id) as count,
           COALESCE(SUM(e.montant), 0) as total_ca,
           COALESCE(AVG(e.montant) FILTER (WHERE e.montant IS NOT NULL), 0) as avg_ca
    FROM entries e
    JOIN locations l ON e.location_id=l.id
    JOIN sources s ON e.source_id=s.id
    ${where} GROUP BY l.id, l.name, s.id, s.label, s.icon, s.color
    ORDER BY l.name, total_ca DESC`, params);

  // Panier moyen par magasin
  const locationStats = await pool.query(`
    SELECT l.name, l.id as location_id,
           COUNT(e.id) as count,
           COALESCE(SUM(e.montant), 0) as total_ca,
           COALESCE(AVG(e.montant) FILTER (WHERE e.montant IS NOT NULL), 0) as avg_ca
    FROM entries e JOIN locations l ON e.location_id=l.id ${where}
    GROUP BY l.id ORDER BY count DESC`, params);

  // Top CP par magasin
  const cpByLocation = await pool.query(`
    SELECT l.name as location, e.code_postal, COUNT(*) as count
    FROM entries e JOIN locations l ON e.location_id=l.id
    ${where} AND e.code_postal IS NOT NULL
    GROUP BY l.name, e.code_postal ORDER BY l.name, count DESC`, params);

  // Evolution semaine sur semaine
  const weeklyTrend = await pool.query(`
    SELECT DATE_TRUNC('week', e.created_at) as week,
           COUNT(*) as count,
           COALESCE(SUM(e.montant), 0) as ca
    FROM entries e ${where}
    GROUP BY week ORDER BY week ASC`, params);

  return {
    byDow: byDow.rows,
    byHour: byHour.rows,
    sourceRoi: sourceRoi.rows,
    sourceByLocation: sourceByLocation.rows,
    locationStats: locationStats.rows,
    cpByLocation: cpByLocation.rows,
    weeklyTrend: weeklyTrend.rows,
  };
}

// Route analytics publique
app.get('/api/public/:slug/analytics', async (req, res) => {
  const { rows: [client] } = await pool.query(`SELECT id FROM clients WHERE slug=$1`, [req.params.slug]);
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  const { from, to, location_id } = req.query;
  res.json(await getAnalytics(client.id, from, to, location_id));
});

// Route analytics admin
app.get('/api/analytics', requireAuth, async (req, res) => {
  const clientId = req.user.role === 'superadmin' ? req.query.client_id : req.user.client_id;
  if (!clientId) return res.status(400).json({ error: 'client_id requis' });
  const { from, to, location_id } = req.query;
  res.json(await getAnalytics(clientId, from, to, location_id));
});

app.listen(PORT, () => console.log(`🚀 Trackr by Equinoxes — port ${PORT}`));
