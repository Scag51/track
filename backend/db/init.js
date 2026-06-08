import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(80) UNIQUE NOT NULL,
      name VARCHAR(200) NOT NULL,
      logo_url TEXT,
      primary_color VARCHAR(10) DEFAULT '#3CE65F',
      dashboard_pin VARCHAR(10),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS locations (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sources (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      label VARCHAR(200) NOT NULL,
      icon VARCHAR(10) DEFAULT '📢',
      color VARCHAR(10) DEFAULT '#888888',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      email VARCHAR(200) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'staff',
      name VARCHAR(200),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS entries (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
      location_id INTEGER REFERENCES locations(id),
      source_id INTEGER REFERENCES sources(id),
      montant DECIMAL(10,2),
      code_postal VARCHAR(10),
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );

    -- Migration: ajouter dashboard_pin si manquant
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='dashboard_pin') THEN
        ALTER TABLE clients ADD COLUMN dashboard_pin VARCHAR(10);
      END IF;
    END $$;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='logo_url') THEN
        ALTER TABLE clients ADD COLUMN logo_url TEXT;
      END IF;
    END $$;
  `);

  const { rows } = await pool.query(`SELECT id FROM users WHERE role='superadmin' LIMIT 1`);
  if (rows.length === 0) {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash(process.env.SUPERADMIN_PASSWORD || 'equinoxes2024', 12);
    await pool.query(
      `INSERT INTO users (client_id, email, password_hash, role, name) VALUES (NULL,$1,$2,'superadmin','Equinoxes Admin')`,
      [process.env.SUPERADMIN_EMAIL || 'admin@equinoxes.fr', hash]
    );
    console.log('✅ Superadmin créé');
  }
  console.log('✅ DB initialisée');
}

export default pool;
