# Storage Architecture

## Overview

All persistence in Mazkir goes through a **storageService** abstraction layer. UI components never access the storage backend directly. This makes it possible to swap the underlying provider (currently Netlify Blobs) without changing any application code.

## Layers

```
┌─────────────────────────────────────────────────┐
│  UI Components (analysis.js, settings.js, etc.) │
│  Call: saveTender(), loadAppendices(), etc.      │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│  Convenience Wrappers (fire-and-forget)          │
│  saveTender(), saveCompany(), loadAppendices()   │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│  storageService (public API — js/store.js)       │
│  .saveTenderAnalysis()  .getOfficeProfile()      │
│  .listTenderAnalyses()  .saveOfficeDocument()    │
│  .deleteTenderAnalysis() .getAppendices()  etc.  │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│  Transport Layer (_transport, _get, _set, _del)  │
│  Currently: Netlify Functions → Netlify Blobs    │
└─────────────────────────────────────────────────┘
```

### 1. UI Components
Files like `analysis.js`, `settings.js`, `team.js`, `vault.js` call **convenience wrappers** such as `saveTender(tender)` or `saveCompany()`. These are fire-and-forget (no `await`) so the UI is never blocked by storage writes.

### 2. Convenience Wrappers
Thin functions at the bottom of `js/store.js`. They call `storageService` methods and swallow errors with `console.error`. They exist so UI code doesn't need try/catch or `.catch()` everywhere.

### 3. storageService (Public API)
The main abstraction. A plain object with async methods grouped by domain:

| Domain | Methods |
|--------|---------|
| **Tender Analyses** | `saveTenderAnalysis(tender)`, `getTenderAnalysis(id)`, `listTenderAnalyses()`, `deleteTenderAnalysis(id)` |
| **Office Profile** | `saveOfficeProfile(profile)`, `getOfficeProfile()` |
| **Office Documents** | `saveOfficeDocument(doc)`, `getOfficeDocuments()`, `deleteOfficeDocument(id)` |
| **Team Members** | `saveTeamMember(member, index)`, `saveAllTeamMembers(members)`, `getTeamMembers()`, `deleteTeamMember(index)` |
| **Appendices** | `saveAppendices(tenderId, appendices)`, `getAppendices(tenderId)`, `deleteAppendices(tenderId)` |

### 4. Transport Layer
Private functions (`_transport`, `_get`, `_getAll`, `_set`, `_del`) that handle HTTP communication with the backend. Includes retry logic (2 retries with exponential backoff for 429/503 errors and network failures).

Currently sends POST requests to `/.netlify/functions/store` with `{ action, store, key, data }`.

## Current Backend: Netlify Blobs

**Server function:** `netlify/functions/store.js`

Uses `@netlify/blobs` `getStore()` to create key-value stores. Five stores are used:

| Store | Key Pattern | Value |
|-------|-------------|-------|
| `tenders` | `tender_<id>` | Tender analysis object |
| `company` | `profile` | Office profile (BIDDER) |
| `vault` | `doc_<id>` | Vault document object |
| `team` | `member_<index>` | Team member object |
| `appendices` | `tender_<tenderId>` | Array of appendix objects |

## Swapping the Backend

To replace Netlify Blobs with another provider (Firebase, Supabase, S3, etc.):

1. **Replace the transport layer** in `js/store.js` — rewrite `_transport()` to call your new backend
2. **Replace the server function** `netlify/functions/store.js` — or remove it entirely if the new provider has a client SDK
3. **Do not change** `storageService` methods, convenience wrappers, or any UI code

## App State Initialization

`loadAllData()` is called once on app startup (from `js/app.js`). It:

1. Calls `storageService` in parallel to fetch all stores
2. Hydrates the global arrays (`TENDERS`, `teamMembers`, `vaultDocs`, `BIDDER`)
3. Fails gracefully — if storage is unavailable, the app works with empty in-memory data

## File Map

| File | Role |
|------|------|
| `js/store.js` | storageService API + transport + convenience wrappers |
| `netlify/functions/store.js` | Server-side CRUD (Netlify Blobs) |
| `package.json` | `@netlify/blobs` dependency |
