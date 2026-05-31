const { getStore } = require('@netlify/blobs');

const ALLOWED_STORES = ['tenders', 'team', 'vault', 'company', 'appendices'];

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type'
};

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

  const store = getStore(storeName);

  try {
    if (action === 'get') {
      if (key) {
        const val = await store.get(key, { type: 'json' });
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: val }) };
      }
      // Get all: list keys then fetch each in parallel
      const { blobs } = await store.list();
      const entries = await Promise.all(
        blobs.map(async (blob) => {
          const val = await store.get(blob.key, { type: 'json' });
          return [blob.key, val];
        })
      );
      const all = Object.fromEntries(entries);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: all }) };
    }

    if (action === 'set') {
      if (!key) {
        return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Key required for set' }) };
      }
      await store.setJSON(key, data);
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
      const { blobs } = await store.list();
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, data: blobs.map(b => b.key) }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid action: ' + action }) };
  } catch (err) {
    console.error('Store error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
