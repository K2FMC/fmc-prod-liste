const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Route principale — sert l'app
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour obtenir un token Shopify
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

// Route pour appeler l'API Shopify (GraphQL)
app.post('/api/shopify', async (req, res) => {
  const { store, token, query } = req.body;
  try {
    const response = await fetch(`https://${store}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      },
      body: JSON.stringify({ query })
    });
    const data = await response.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FMC Prod Liste — serveur démarré sur port ${PORT}`));
