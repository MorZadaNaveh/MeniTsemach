'use strict';

/* ═════ STORE API — Netlify Blobs persistence ═════ */
const STORE_URL = '/.netlify/functions/store';
const STORE_RETRIES = 2;
const STORE_RETRY_DELAY = 2000;

async function storeCall(action, storeName, key, data) {
  for (let attempt = 0; attempt <= STORE_RETRIES; attempt++) {
    try {
      const payload = { action, store: storeName };
      if (key) payload.key = key;
      if (data !== undefined) payload.data = data;

      const response = await fetch(STORE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) return await response.json();

      if ((response.status === 429 || response.status === 503) && attempt < STORE_RETRIES) {
        await new Promise(r => setTimeout(r, STORE_RETRY_DELAY * (attempt + 1)));
        continue;
      }

      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Store error: ' + response.status);
    } catch (e) {
      if (attempt < STORE_RETRIES && e.name === 'TypeError') {
        // Network error — retry
        await new Promise(r => setTimeout(r, STORE_RETRY_DELAY));
        continue;
      }
      throw e;
    }
  }
}

/* ── Convenience wrappers ── */
async function storeGetAll(storeName) {
  const result = await storeCall('get', storeName);
  return result?.data || {};
}

async function storeGet(storeName, key) {
  const result = await storeCall('get', storeName, key);
  return result?.data || null;
}

async function storeSet(storeName, key, data) {
  return storeCall('set', storeName, key, data);
}

async function storeDelete(storeName, key) {
  return storeCall('delete', storeName, key);
}

/* ═════ LOAD ALL DATA ON INIT ═════ */
let dataLoaded = false;

async function loadAllData() {
  if (dataLoaded) return;

  try {
    const [tendersData, teamData, vaultData, companyData] = await Promise.all([
      storeGetAll('tenders'),
      storeGetAll('team'),
      storeGetAll('vault'),
      storeGet('company', 'profile')
    ]);

    // Tenders
    const storedTenders = Object.values(tendersData);
    if (storedTenders.length > 0) {
      TENDERS.length = 0;
      storedTenders.sort((a, b) => a.id - b.id);
      storedTenders.forEach(t => TENDERS.push(t));
    }

    // Team
    const storedTeam = Object.values(teamData);
    if (storedTeam.length > 0) {
      teamMembers.length = 0;
      storedTeam.forEach(m => teamMembers.push(m));
    }

    // Vault
    const storedVault = Object.values(vaultData);
    if (storedVault.length > 0) {
      vaultDocs.length = 0;
      storedVault.forEach(d => vaultDocs.push(d));
    }

    // Company
    if (companyData) {
      Object.assign(BIDDER, companyData);
    }

    dataLoaded = true;
  } catch (e) {
    console.error('Failed to load data from store, using defaults:', e);
    dataLoaded = true; // graceful degradation — use in-memory demo data
  }
}

/* ═════ SAVE HELPERS ═════ */
function saveTender(tender) {
  tender.updatedAt = new Date().toISOString();
  if (!tender.createdAt) tender.createdAt = tender.updatedAt;
  storeSet('tenders', 'tender_' + tender.id, tender).catch(e => console.error('Save tender error:', e));
}

function saveTeamMemberToStore(member, index) {
  storeSet('team', 'member_' + index, member).catch(e => console.error('Save team error:', e));
}

function saveAllTeam() {
  Promise.all(teamMembers.map((m, i) => storeSet('team', 'member_' + i, m)))
    .catch(e => console.error('Save all team error:', e));
}

function saveVaultDoc(doc) {
  storeSet('vault', 'doc_' + doc.id, doc).catch(e => console.error('Save vault error:', e));
}

function saveCompany() {
  storeSet('company', 'profile', BIDDER).catch(e => console.error('Save company error:', e));
}

function saveAppendices(tenderId, appendices) {
  storeSet('appendices', 'tender_' + tenderId, appendices).catch(e => console.error('Save appendices error:', e));
}

async function loadAppendices(tenderId) {
  try {
    return await storeGet('appendices', 'tender_' + tenderId);
  } catch (e) {
    console.error('Load appendices error:', e);
    return null;
  }
}
