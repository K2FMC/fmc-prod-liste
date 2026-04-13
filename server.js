const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Créer la table surplus au démarrage si elle n'existe pas
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS surplus (
      id SERIAL PRIMARY KEY,
      sku TEXT NOT NULL,
      size TEXT NOT NULL,
      qty INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('Base de données prête.');
}
initDB();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Token Shopify
app.post('/api/token', async (req, res) => {
  const { store, clientId, clientSecret } = req.body;
  try {
    const response = await fetch(`https://${store}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' })
    });
    const data = await response.json();
    if (data.errors) return res.status(401).json({ error: data.errors });
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Shopify GraphQL
app.post('/api/shopify', async (req, res) => {
  const { store, token, query } = req.body;
  try {
    const response = await fetch(`https://${store}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query })
    });
    const data = await response.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// GET surplus
app.get('/api/surplus', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM surplus ORDER BY sku, size');
    res.json(result.rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// POST surplus — ajouter ou incrémenter
app.post('/api/surplus', async (req, res) => {
  const { sku, size, qty } = req.body;
  try {
    const existing = await pool.query('SELECT * FROM surplus WHERE sku = $1 AND size = $2', [sku, size]);
    if (existing.rows.length > 0) {
      const result = await pool.query('UPDATE surplus SET qty = qty + $1 WHERE sku = $2 AND size = $3 RETURNING *', [qty, sku, size]);
      res.json(result.rows[0]);
    } else {
      const result = await pool.query('INSERT INTO surplus (sku, size, qty) VALUES ($1, $2, $3) RETURNING *', [sku, size, qty]);
      res.json(result.rows[0]);
    }
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE surplus
app.delete('/api/surplus/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM surplus WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH surplus — mettre à jour la quantité consommée
app.patch('/api/surplus/:id', async (req, res) => {
  const { used } = req.body;
  try {
    const result = await pool.query('UPDATE surplus SET qty = qty - $1 WHERE id = $2 AND qty - $1 >= 0 RETURNING *', [used, req.params.id]);
    res.json(result.rows[0] || { error: 'Stock insuffisant' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FMC Prod Liste — port ${PORT}`));
