'use strict';

/* ═════════════════════════════════════════════════════════════════════════════
   STORAGE SERVICE — Abstract persistence layer

   All UI code reads/writes through this service.
   The underlying implementation (currently Netlify Blobs) can be swapped
   by replacing the transport functions below without changing any callers.
   ═════════════════════════════════════════════════════════════════════════════ */

/* ── Transport Layer (Netlify Blobs via Netlify Function) ── */
const _STORE_URL = '/.netlify/functions/store';
const _RETRIES = 2;
const _RETRY_DELAY = 2000;

async function _transport(action, storeName, key, data) {
  for (let attempt = 0; attempt <= _RETRIES; attempt++) {
    try {
      const payload = { action, store: storeName };
      if (key) payload.key = key;
      if (data !== undefined) payload.data = data;

      const response = await fetch(_STORE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) return await response.json();

      if ((response.status === 429 || response.status === 503) && attempt < _RETRIES) {
        await new Promise(r => setTimeout(r, _RETRY_DELAY * (attempt + 1)));
        continue;
      }

      const err = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || 'Store error: ' + response.status);
    } catch (e) {
      if (attempt < _RETRIES && e.name === 'TypeError') {
        await new Promise(r => setTimeout(r, _RETRY_DELAY));
        continue;
      }
      throw e;
    }
  }
}

async function _get(store, key) {
  const result = await _transport('get', store, key);
  return result?.data || null;
}

async function _getAll(store) {
  const result = await _transport('get', store);
  return result?.data || {};
}

async function _set(store, key, data) {
  return _transport('set', store, key, data);
}

async function _del(store, key) {
  return _transport('delete', store, key);
}

/* ═════════════════════════════════════════════════════════════════════════════
   PUBLIC STORAGE SERVICE API

   These are the only functions that UI code should call.
   If you swap Netlify Blobs for another provider, rewrite the transport
   layer above — these function signatures stay the same.
   ═════════════════════════════════════════════════════════════════════════════ */

const storageService = {

  /* ── Tender Analyses ── */

  async saveTenderAnalysis(tender) {
    tender.updatedAt = new Date().toISOString();
    if (!tender.createdAt) tender.createdAt = tender.updatedAt;
    return _set('tenders', 'tender_' + tender.id, tender);
  },

  async getTenderAnalysis(tenderId) {
    return _get('tenders', 'tender_' + tenderId);
  },

  async listTenderAnalyses() {
    const data = await _getAll('tenders');
    return Object.values(data).sort((a, b) => a.id - b.id);
  },

  async deleteTenderAnalysis(tenderId) {
    return _del('tenders', 'tender_' + tenderId);
  },

  /* ── Office Profile ── */

  async saveOfficeProfile(profile) {
    return _set('company', 'profile', profile);
  },

  async getOfficeProfile() {
    return _get('company', 'profile');
  },

  /* ── Office Documents (Vault) ── */

  async saveOfficeDocument(doc) {
    return _set('vault', 'doc_' + doc.id, doc);
  },

  async getOfficeDocuments() {
    const data = await _getAll('vault');
    return Object.values(data);
  },

  async deleteOfficeDocument(docId) {
    return _del('vault', 'doc_' + docId);
  },

  /* ── Team Members ── */

  async saveTeamMember(member, index) {
    return _set('team', 'member_' + index, member);
  },

  async saveAllTeamMembers(members) {
    return Promise.all(members.map((m, i) => _set('team', 'member_' + i, m)));
  },

  async getTeamMembers() {
    const data = await _getAll('team');
    return Object.values(data);
  },

  async deleteTeamMember(index) {
    return _del('team', 'member_' + index);
  },

  /* ── Appendices (per tender) ── */

  async saveAppendices(tenderId, appendices) {
    return _set('appendices', 'tender_' + tenderId, appendices);
  },

  async getAppendices(tenderId) {
    return _get('appendices', 'tender_' + tenderId);
  },

  async deleteAppendices(tenderId) {
    return _del('appendices', 'tender_' + tenderId);
  }
};

/* ═════════════════════════════════════════════════════════════════════════════
   APP STATE LOADER

   Called once on init. Hydrates global arrays from persistent storage.
   Fails gracefully — app works with empty data if storage is unavailable.
   ═════════════════════════════════════════════════════════════════════════════ */

let _dataLoaded = false;

async function loadAllData() {
  if (_dataLoaded) return;

  try {
    const [tenders, team, vault, profile] = await Promise.all([
      storageService.listTenderAnalyses(),
      storageService.getTeamMembers(),
      storageService.getOfficeDocuments(),
      storageService.getOfficeProfile()
    ]);

    if (tenders.length > 0) {
      TENDERS.length = 0;
      tenders.forEach(t => TENDERS.push(t));
    }

    if (team.length > 0) {
      teamMembers.length = 0;
      team.forEach(m => teamMembers.push(m));
    }

    if (vault.length > 0) {
      vaultDocs.length = 0;
      vault.forEach(d => vaultDocs.push(d));
    }

    if (profile) {
      Object.assign(BIDDER, profile);
    }

    _dataLoaded = true;
  } catch (e) {
    console.error('Storage unavailable, using in-memory defaults:', e.message);
    _dataLoaded = true;
  }
}

/* ═════════════════════════════════════════════════════════════════════════════
   CONVENIENCE WRAPPERS (fire-and-forget)

   Thin wrappers used by UI mutation handlers. They update in-memory state
   AND persist asynchronously without blocking the UI.
   ═════════════════════════════════════════════════════════════════════════════ */

function saveTender(tender) {
  storageService.saveTenderAnalysis(tender)
    .catch(e => console.error('Save tender failed:', e.message));
}

function saveCompany() {
  storageService.saveOfficeProfile(BIDDER)
    .catch(e => console.error('Save company failed:', e.message));
}

function saveVaultDoc(doc) {
  storageService.saveOfficeDocument(doc)
    .catch(e => console.error('Save vault doc failed:', e.message));
}

function saveTeamMemberToStore(member, index) {
  storageService.saveTeamMember(member, index)
    .catch(e => console.error('Save team member failed:', e.message));
}

function saveAllTeam() {
  storageService.saveAllTeamMembers(teamMembers)
    .catch(e => console.error('Save all team failed:', e.message));
}

function saveAppendices(tenderId, appendices) {
  storageService.saveAppendices(tenderId, appendices)
    .catch(e => console.error('Save appendices failed:', e.message));
}

async function loadAppendices(tenderId) {
  try {
    return await storageService.getAppendices(tenderId);
  } catch (e) {
    console.error('Load appendices failed:', e.message);
    return null;
  }
}
