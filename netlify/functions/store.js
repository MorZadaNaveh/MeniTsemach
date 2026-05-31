const fs = require('fs');
const path = require('path');

const ALLOWED_STORES = ['tenders', 'team', 'vault', 'company', 'appendices'];

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};

/* ── Storage backends ── */

// Netlify Blobs (production)
function getBlobsStore(storeName) {
  const { getStore } = require('@netlify/blobs');
  const store = getStore(storeName);
  return {
    async get(key) { return store.get(key, { type: 'json' }); },
    async list() { const { blobs } = await store.list(); return blobs.map(b => b.key); },
    async set(key, data) { await store.setJSON(key, data); },
    async delete(key) { await store.delete(key); }
  };
}

// Local JSON file fallback (dev)
const LOCAL_DIR = path.resolve(__dirname, '../../.local-store');

function getLocalStore(storeName) {
  const dir = path.join(LOCAL_DIR, storeName);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return {
    async get(key) {
      const file = path.join(dir, key + '.json');
      if (!fs.existsSync(file)) return null;
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    },
    async list() {
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    },
    async set(key, data) {
      fs.writeFileSync(path.join(dir, key + '.json'), JSON.stringify(data, null, 2));
    },
    async delete(key) {
      const file = path.join(dir, key + '.json');
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  };
}

function getStoreForEnv(storeName) {
  // Try Netlify Blobs first; fall back to local files in dev
  try {
    const { getStore } = require('@netlify/blobs');
    // This will throw if Blobs environment isn't configured
    getStore(storeName);
    return getBlobsStore(storeName);
  } catch {
    return getLocalStore(storeName);
  }
}

/* ── Handler ── */

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  let body;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;
    body = JSON.parse(raw);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  const { action, store: storeName, key, data } = body;

  if (!ALLOWED_STORES.includes(storeName)) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid store: ' + storeName }) };
  }

  const store = getStoreForEnv(storeName);

  try {
    if (action === 'get') {
      if (key) {
        const val = await store.get(key);
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: val }) };
      }
      // Get all: list keys then fetch each
      const keys = await store.list();
      const entries = await Promise.all(
        keys.map(async (k) => {
          const val = await store.get(k);
          return [k, val];
        })
      );
      const all = Object.fromEntries(entries);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: all }) };
    }

    if (action === 'set') {
      if (!key) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Key required for set' }) };
      }
      await store.set(key, data);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'delete') {
      if (!key) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Key required for delete' }) };
      }
      await store.delete(key);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'list') {
      const keys = await store.list();
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: keys }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid action: ' + action }) };
  } catch (err) {
    console.error('Store error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
