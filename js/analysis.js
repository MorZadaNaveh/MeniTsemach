'use strict';

/* ═════ AI ANALYSIS ═════ */
if(typeof pdfjsLib!=='undefined'){
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let uploadedFiles = [];

/* ── IndexedDB helpers for PDF blob persistence ── */
const _PDF_DB_NAME = 'MazkirPdfStore';
const _PDF_DB_VERSION = 1;
const _PDF_STORE_NAME = 'pdfs';

function _openPdfDb(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_PDF_DB_NAME, _PDF_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(_PDF_STORE_NAME)) {
        db.createObjectStore(_PDF_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePdfBlob(tenderId, blob){
  try {
    const db = await _openPdfDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(_PDF_STORE_NAME, 'readwrite');
      tx.objectStore(_PDF_STORE_NAME).put(blob, 'tender_' + tenderId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch(e) { console.warn('savePdfBlob failed:', e.message); }
}

async function loadPdfBlob(tenderId){
  try {
    const db = await _openPdfDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(_PDF_STORE_NAME, 'readonly');
      const req = tx.objectStore(_PDF_STORE_NAME).get('tender_' + tenderId);
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch(e) { console.warn('loadPdfBlob failed:', e.message); return null; }
}

async function getPdfBlobUrl(tenderId){
  const blob = await loadPdfBlob(tenderId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

function formatScoreDisplay(item){
  const raw = Number(item?.m);
  const hasRaw = Number.isFinite(raw) && raw > 0;
  if (hasRaw) return `${raw} נק'`;
  return '—';
}

function buildAnalysisFitTab(analysisResult){
  if (typeof renderTeamFitList !== 'function') {
    return '<div class="alert ab2" style="font-size:12px">רכיב התאמת הצוות עדיין לא זמין במסך זה.</div>';
  }
  const tenderLike = {
    type: analysisResult?.type || '',
    thresholds: [
      ...(analysisResult?.adminThresholds || []),
      ...((analysisResult?.professionalThresholds || []).map(p=>`${p.field}: ${p.detail}`))
    ],
    highlights: analysisResult?.highlights || [],
    qualityScoring: analysisResult?.qualityScoring || []
  };
  return `
    <div class="alert ag2" style="margin-bottom:10px">התאמה מחושבת לפי ותק, תפקיד/תואר, הסמכות וחפיפה לתחומי המכרז.</div>
    ${renderTeamFitList(tenderLike)}
  `;
}

function extractSection132Scoring(fullText){
  const normalized = String(fullText || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ');
  const start = normalized.search(/13\.2[\s\S]{0,40}(בדיקת איכות|איכות)/);
  if (start < 0) return [];
  const after = normalized.slice(start);
  const endMatch = after.match(/13\.3[\s\S]{0,30}(שלב|הכרזה|זוכים)/);
  const section = endMatch ? after.slice(0, endMatch.index) : after.slice(0, 16000);

  const rows = [];
  const re = /(13\.2\.\d+\.\d+)\s*\.?\s*([\s\S]*?)(?=13\.2\.\d+\.\d+|13\.3|$)/g;
  let m;
  while ((m = re.exec(section)) !== null) {
    const id = m[1];
    const body = String(m[2] || '').trim();
    if (!body) continue;

    const firstLine = body
      .split('\n')
      .map(x => x.trim())
      .filter(Boolean)
      .find(x => x.length > 1) || '';

    const title = firstLine.replace(/^[-–•\s]+/, '').slice(0, 90);
    const scoreMatch =
      body.match(/(?:עד|מקסימאלי|מקסימום|סה"כ)[^0-9]{0,20}(\d{1,3}(?:\.\d+)?)/) ||
      body.match(/(\d{1,3}(?:\.\d+)?)\s*נק[\'"]?/);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;

    rows.push({
      l: `סעיף ${id}${title ? ` — ${title}` : ''}`,
      detail: body.replace(/\s*\n\s*/g, ' ').replace(/[ ]{2,}/g, ' ').trim(),
      w: Number.isFinite(score) ? `${score}%` : '',
      m: Number.isFinite(score) ? score : 0
    });
  }
  return rows;
}

function classifyScoringPayload(raw){
  const q = raw?.qualityScoring;
  const p = raw?.priceScoring;
  const hasAltQuality = Array.isArray(raw?.qualityCriteria) && raw.qualityCriteria.length > 0;
  const hasAltPrice = Array.isArray(raw?.priceCriteria) && raw.priceCriteria.length > 0;

  const qualityType = Array.isArray(q) ? 'array' : (q === null ? 'null' : typeof q);
  const priceType = Array.isArray(p) ? 'array' : (p === null ? 'null' : typeof p);

  const qualityLen = Array.isArray(q) ? q.length : 0;
  const priceLen = Array.isArray(p) ? p.length : 0;

  if (qualityLen > 0 || priceLen > 0) {
    return {
      status: 'ok',
      reason: 'Scoring arrays present',
      qualityType, priceType, qualityLen, priceLen, hasAltQuality, hasAltPrice
    };
  }

  if (hasAltQuality || hasAltPrice) {
    return {
      status: 'shape_mismatch',
      reason: 'Alternative scoring keys present',
      qualityType, priceType, qualityLen, priceLen, hasAltQuality, hasAltPrice
    };
  }

  if ((q && !Array.isArray(q)) || (p && !Array.isArray(p))) {
    return {
      status: 'type_mismatch',
      reason: 'Scoring keys exist but wrong type',
      qualityType, priceType, qualityLen, priceLen, hasAltQuality, hasAltPrice
    };
  }

  return {
    status: 'missing',
    reason: 'No scoring data returned by AI',
    qualityType, priceType, qualityLen, priceLen, hasAltQuality, hasAltPrice
  };
}

function normalizeScoringItems(result){
  const rawQuality = Array.isArray(result.qualityScoring)
    ? result.qualityScoring
    : Array.isArray(result.qualityCriteria)
      ? result.qualityCriteria
      : [];

  const qualityScoring = rawQuality
    .map((q, idx) => {
      const label = q?.l || q?.label || q?.name || `קריטריון ${idx + 1}`;
      const detail = q?.detail || q?.description || '';
      const wRaw = q?.w ?? q?.weight ?? '';
      const wNum = parseInt(String(wRaw).replace('%', ''), 10);
      const mRaw = q?.m ?? q?.max ?? q?.maxScore ?? '';
      const mNum = parseInt(String(mRaw), 10);
      return {
        l: String(label).trim(),
        detail: String(detail || '').trim(),
        w: Number.isFinite(wNum) ? `${wNum}%` : String(wRaw || '').trim(),
        m: Number.isFinite(mNum) ? mNum : (Number.isFinite(wNum) ? wNum : 0)
      };
    })
    .filter(q => q.l);

  const rawPrice = Array.isArray(result.priceScoring)
    ? result.priceScoring
    : Array.isArray(result.priceCriteria)
      ? result.priceCriteria
      : [];

  const priceScoring = rawPrice
    .map((p, idx) => {
      const label = p?.l || p?.label || p?.name || `קטגוריה ${idx + 1}`;
      const wRaw = p?.w ?? p?.weight ?? '';
      const wNum = parseInt(String(wRaw).replace('%', ''), 10);
      return {
        l: String(label).trim(),
        w: Number.isFinite(wNum) ? `${wNum}%` : String(wRaw || '').trim()
      };
    })
    .filter(p => p.l);

  return { qualityScoring, priceScoring };
}

function handleFileDrop(e){
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag');
  handleFileSelect(e.dataTransfer.files);
}
function handleFileSelect(files){
  if(!files.length) return;
  uploadedFiles = Array.from(files);
  const listEl = document.getElementById('uploadedFileList');
  listEl.innerHTML = uploadedFiles.map(f=>`
    <div style="background:var(--grn-light);border:1px solid var(--grn-border);border-radius:7px;padding:5px 10px;font-size:12px;font-weight:600;color:var(--grn)">
      📄 ${f.name} (${(f.size/1024).toFixed(0)}KB)
    </div>`).join('');
  document.getElementById('uploadActions').style.display='flex';
}

function resetUpload(){
  uploadedFiles=[];
  document.getElementById('uploadedFileList').innerHTML='';
  document.getElementById('uploadActions').style.display='none';
}

/* ── Extract text from uploaded file ── */
const MAX_TEXT_LENGTH = 30000;
const TAIL_LENGTH = 5000; // also grab last 5K chars for contact/deadline info at end

function smartTruncate(text){
  if(text.length <= MAX_TEXT_LENGTH) return { text, truncated: false };
  // Keep beginning + end of document (contact/deadlines often at end)
  const head = text.slice(0, MAX_TEXT_LENGTH - TAIL_LENGTH);
  const tail = text.slice(-TAIL_LENGTH);
  return { text: head + '\n\n[...חלק אמצעי הושמט...]\n\n' + tail, truncated: true };
}

async function extractFileText(file){
  const name = file.name.toLowerCase();

  // TXT / CSV
  if(file.type.includes('text') || name.endsWith('.txt') || name.endsWith('.csv')){
    const text = await file.text();
    return { fullText: text, ...smartTruncate(text) };
  }

  // PDF — extract ALL pages first, then truncate smartly
  if(name.endsWith('.pdf')){
    if(typeof pdfjsLib==='undefined') throw new Error('PDF.js לא נטען — רענן את הדף');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: buf}).promise;
    let fullText = '';
    for(let i=1; i<=pdf.numPages; i++){
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const pageText = tc.items.map(it=>it.str).join(' ');
      fullText += pageText + '\n';
    }
    // Normalize apostrophe-like characters for consistent downstream matching
    fullText = fullText.replace(/[\u2019\u05F3\u02BC\u2018\u00B4]/g, "'");
    const truncated = smartTruncate(fullText);
    return { fullText, ...truncated };
  }

  // DOCX
  if(name.endsWith('.docx')){
    if(typeof mammoth==='undefined') throw new Error('Mammoth.js לא נטען — רענן את הדף');
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({arrayBuffer: buf});
    const truncated = smartTruncate(result.value);
    return { fullText: result.value, ...truncated };
  }

  // Unsupported
  if(name.endsWith('.doc')) throw new Error('פורמט .doc ישן — שמור כ-.docx ונסה שוב');
  if(name.endsWith('.xls') || name.endsWith('.xlsx')) throw new Error('קבצי Excel לא נתמכים — שמור כ-.pdf או .txt');
  throw new Error('סוג קובץ לא נתמך: ' + file.name.split('.').pop());
}

/* ── Call Netlify Function → Gemini AI (with client-side retries) ── */
async function callAIForAnalysis(content, fileName, wasTruncated){
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [3000, 6000, 10000];

  for(let attempt = 0; attempt < MAX_RETRIES; attempt++){
    const response = await fetch('/.netlify/functions/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content, fileName, truncated: wasTruncated })
    });

    if(response.ok) return await response.json();

    const err = await response.json().catch(()=>({error:'Unknown'}));
    const retryable = response.status === 429 || response.status === 503;

    if(retryable && attempt < MAX_RETRIES - 1){
      console.log(`Retry ${attempt+1}/${MAX_RETRIES} after ${response.status}, waiting ${RETRY_DELAYS[attempt]}ms...`);
      await new Promise(r=>setTimeout(r, RETRY_DELAYS[attempt]));
      continue;
    }

    throw new Error(err.error || 'API error: ' + response.status);
  }
}

/* ── Default fields by appendix type (generated client-side) ── */
const APPENDIX_TYPE_FIELDS = {
  declarations: [
    {key:'signer_name',label:'שם המצהיר',type:'text',required:true},
    {key:'signer_role',label:'תפקיד',type:'text',required:true},
    {key:'id_number',label:'ת.ז.',type:'text',required:true},
    {key:'date',label:'תאריך',type:'date',required:true},
    {key:'signature',label:'חתימה',type:'signature',required:true}
  ],
  experience: [
    {key:'project_name',label:'שם הפרויקט',type:'text',required:true},
    {key:'client',label:'שם הלקוח',type:'text',required:true},
    {key:'year',label:'שנה',type:'number',required:true},
    {key:'scope',label:'היקף (₪)',type:'number',required:false},
    {key:'description',label:'תיאור',type:'textarea',required:false}
  ],
  team: [
    {key:'name',label:'שם',type:'text',required:true},
    {key:'role',label:'תפקיד מוצע',type:'text',required:true},
    {key:'education',label:'השכלה',type:'text',required:false},
    {key:'experience_years',label:'שנות ניסיון',type:'number',required:true},
    {key:'description',label:'ניסיון רלוונטי',type:'textarea',required:false}
  ],
  financial: [
    {key:'item',label:'סעיף',type:'text',required:true},
    {key:'amount',label:'סכום (₪)',type:'number',required:true},
    {key:'notes',label:'הערות',type:'text',required:false}
  ],
  methodology: [
    {key:'section',label:'נושא',type:'text',required:true},
    {key:'content',label:'תוכן',type:'textarea',required:true}
  ],
  pricing: [
    {key:'item',label:'פריט/שירות',type:'text',required:true},
    {key:'unit_price',label:'מחיר ליחידה',type:'number',required:true},
    {key:'quantity',label:'כמות',type:'number',required:false},
    {key:'total',label:'סה"כ',type:'number',required:true}
  ],
  references: [
    {key:'company',label:'שם הארגון',type:'text',required:true},
    {key:'contact',label:'איש קשר',type:'text',required:true},
    {key:'phone',label:'טלפון',type:'text',required:true},
    {key:'project',label:'פרויקט',type:'text',required:false}
  ],
  confidentiality: [
    {key:'signer_name',label:'שם החותם',type:'text',required:true},
    {key:'company',label:'שם החברה',type:'text',required:true},
    {key:'date',label:'תאריך',type:'date',required:true},
    {key:'signature',label:'חתימה',type:'signature',required:true}
  ],
  conflict: [
    {key:'signer_name',label:'שם המצהיר',type:'text',required:true},
    {key:'details',label:'פירוט',type:'textarea',required:false},
    {key:'date',label:'תאריך',type:'date',required:true},
    {key:'signature',label:'חתימה',type:'signature',required:true}
  ],
  insurance: [
    {key:'insurer',label:'חברת ביטוח',type:'text',required:true},
    {key:'policy_number',label:'מספר פוליסה',type:'text',required:true},
    {key:'coverage',label:'סכום כיסוי',type:'number',required:true},
    {key:'expiry',label:'תוקף',type:'date',required:true}
  ],
  custom: [
    {key:'field1',label:'שדה 1',type:'text',required:false},
    {key:'field2',label:'שדה 2',type:'text',required:false},
    {key:'notes',label:'הערות',type:'textarea',required:false}
  ]
};

function enrichAppendixFields(appendices){
  return appendices.map(app => {
    if(!app.fields || app.fields.length === 0){
      app.fields = APPENDIX_TYPE_FIELDS[app.type] || APPENDIX_TYPE_FIELDS.custom;
      app._defaultFields = true; // flag: needs AI field extraction
    }
    if(!Array.isArray(app.rows)) app.rows = [];
    return app;
  });
}

/* ── Lazy per-appendix field extraction ── */
const _fieldFetchInProgress = {};

async function fetchAppendixFields(app, filteredText, tenderId){
  const key = `${tenderId}_${app.id}`;
  if(_fieldFetchInProgress[key]) return; // already fetching
  _fieldFetchInProgress[key] = true;

  try {
    const response = await fetch('/.netlify/functions/extract-appendices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'fields',
        title: app.title,
        hebrewLabel: app.hebrewLabel,
        type: app.type,
        description: app.description,
        isTable: app.isTable,
        filteredText,
        companyData: { bidder: BIDDER, team: teamMembers }
      })
    });

    if(!response.ok){
      console.warn('Field fetch failed for', app.title, response.status);
      return;
    }

    const data = await response.json();
    if(data.fields && data.fields.length > 0){
      app.fields = data.fields;
      if(data.rows && data.rows.length > 0) app.rows = data.rows;
      if(typeof data.isTable === 'boolean') app.isTable = data.isTable;
    }
    delete app._defaultFields;
    app._fieldsLoaded = true;

    // Persist updated appendices
    if(tenderId >= 0){
      const apps = currentAIResult?.appendices || tmDynApps || [];
      saveAppendices(tenderId, apps);
    }
  } catch(err){
    console.error('fetchAppendixFields error:', err.message);
  } finally {
    delete _fieldFetchInProgress[key];
  }
}

/* ── Call Netlify Function → Appendix extraction ── */
async function callAIForAppendices(content, fileName){
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [3000, 6000, 10000];

  for(let attempt = 0; attempt < MAX_RETRIES; attempt++){
    const response = await fetch('/.netlify/functions/extract-appendices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content, fileName })
    });

    if(response.ok){
      const data = await response.json();
      // Enrich with default fields client-side (keeps server response fast)
      if(data.appendices) data.appendices = enrichAppendixFields(data.appendices);
      // Store filteredText for per-appendix field extraction
      if(data.filteredText) data._filteredText = data.filteredText;
      return data;
    }

    const err = await response.json().catch(()=>({error:'Unknown'}));
    const retryable = response.status === 429 || response.status === 503;

    if(retryable && attempt < MAX_RETRIES - 1){
      console.log(`Appendix retry ${attempt+1}/${MAX_RETRIES} after ${response.status}`);
      await new Promise(r=>setTimeout(r, RETRY_DELAYS[attempt]));
      continue;
    }

    throw new Error(err.error || 'Appendix API error: ' + response.status);
  }
}

/* ── Main analysis flow ── */
async function runAIAnalysis(){
  if(!uploadedFiles.length){ alert('נא לבחור קובץ'); return; }
  document.getElementById('uploadCard').style.display='none';
  document.getElementById('aiProgress').style.display='block';
  document.getElementById('aiResultSection').style.display='none';

  const progText = document.getElementById('aiProgressText');
  const progBar  = document.getElementById('aiProgressBar');
  const file = uploadedFiles[0];
  uploadedFileName = file.name;

  // Retain PDF blob for "Open original" feature
  if (file.name.toLowerCase().endsWith('.pdf')) {
    if (uploadedPdfBlobUrl) URL.revokeObjectURL(uploadedPdfBlobUrl);
    uploadedPdfBlobUrl = URL.createObjectURL(file);
  } else {
    uploadedPdfBlobUrl = null;
  }

  try {
    // Step 1: Extract text
    progText.textContent = 'קורא את הקובץ...';
    progBar.style.width = '15%';
    const { fullText, text, truncated } = await extractFileText(file);
    const section132Scoring = extractSection132Scoring(fullText);
    uploadedFileContent = text;

    if(text.trim().length < 50){
      throw new Error('לא הצלחתי לחלץ טקסט מהקובץ — ייתכן שהקובץ סרוק (תמונה) או ריק');
    }

    // Step 2: Send to AI — both calls in parallel
    progText.textContent = 'שולח ל-AI לניתוח...';
    progBar.style.width = '35%';

    // Animate progress while waiting
    let pct = 35;
    const iv = setInterval(()=>{
      if(pct < 90){ pct += 2; progBar.style.width = pct+'%'; }
      if(pct > 45 && pct < 55) progText.textContent = 'AI מחלץ תנאי סף וניקוד...';
      if(pct > 55 && pct < 65) progText.textContent = 'מזהה נספחים וטפסים...';
      if(pct > 65 && pct < 75) progText.textContent = 'ממלא נספחים אוטומטית...';
      if(pct > 75 && pct < 85) progText.textContent = 'מזהה מועדים ופרטי קשר...';
      if(pct > 85) progText.textContent = 'מסמן חריגות ודגשים...';
    }, 500);

    // Run analysis + appendix extraction in parallel
    const [analysisResult, appendicesResult] = await Promise.allSettled([
      callAIForAnalysis(text, file.name, truncated),
      callAIForAppendices(fullText, file.name)
    ]);

    clearInterval(iv);

    if(analysisResult.status === 'rejected'){
      throw analysisResult.reason;
    }

    const result = analysisResult.value;
    const scoringDiagnosis = classifyScoringPayload(result);
    window.__lastAnalysisRaw = result;
    window.__lastScoringDiagnosis = scoringDiagnosis;
    console.group('AI scoring diagnosis');
    console.log('Diagnosis:', scoringDiagnosis);
    console.log('Raw qualityScoring:', result?.qualityScoring);
    console.log('Raw priceScoring:', result?.priceScoring);
    console.log('Alt qualityCriteria:', result?.qualityCriteria);
    console.log('Alt priceCriteria:', result?.priceCriteria);
    console.log('Section 13.2 fallback rows:', section132Scoring?.length || 0);
    console.groupEnd();

    if ((!Array.isArray(result.qualityScoring) || result.qualityScoring.length === 0) && section132Scoring.length > 0) {
      result.qualityScoring = section132Scoring;
      result.scoringNote = (result.scoringNote ? `${result.scoringNote} ` : '') + 'מדדי האיכות הושלמו מסעיף 13.2 במסמך.';
    }

    // Attach appendices (may have failed independently)
    if(appendicesResult.status === 'fulfilled' && appendicesResult.value?.appendices){
      result.appendices = appendicesResult.value.appendices;
      result._filteredText = appendicesResult.value._filteredText || '';
      console.log('Appendix extraction OK:', result.appendices.length, 'appendices found');
    } else {
      const reason = appendicesResult.status === 'rejected'
        ? appendicesResult.reason?.message || appendicesResult.reason
        : 'Response missing appendices field';
      console.error('Appendix extraction FAILED:', reason, appendicesResult);
      result.appendices = [];
    }

    progText.textContent = 'מכין תוצאות...';
    progBar.style.width = '100%';

    await new Promise(r=>setTimeout(r, 300));
    currentAIResult = result;
    showAIResult(result);

    // Persist appendices and filteredText after tender is created
    if(currentAnalysisIdx >= 0){
      saveAppendices(currentAnalysisIdx, result.appendices);
      if(result._filteredText) saveFilteredText(currentAnalysisIdx, result._filteredText);
    }

  } catch(err) {
    console.error('Analysis error:', err);
    document.getElementById('aiProgress').style.display='none';
    document.getElementById('uploadCard').style.display='block';
    alert('שגיאה בניתוח: ' + err.message);
  }
}

function showAIResult(result){
  document.getElementById('aiProgress').style.display='none';
  document.getElementById('uploadCard').style.display='block';
  document.getElementById('aiResultSection').style.display='block';
  document.getElementById('aiTenderName').textContent = result.tenderName || 'מכרז';
  document.getElementById('aiTenderOrg').textContent = (result.orgName||'') + (result.tenderNumber?' | '+result.tenderNumber:'');
  document.getElementById('aiAnalysisDate').textContent = 'נותח: '+new Date().toLocaleDateString('he-IL');

  const normalized = normalizeScoringItems(result);
  result.qualityScoring = normalized.qualityScoring;
  result.priceScoring = normalized.priceScoring;

  // Add to TENDERS list
  const existing = TENDERS.find(t=>t.name===result.tenderName);
  const mappedTender = {
    name:result.tenderName||uploadedFileName.replace(/\.[^.]+$/,''),
    org:result.orgName||'',
    number:result.tenderNumber||'',
    type:result.type||'',
    status:+result.daysLeft<=3?'urgent':+result.daysLeft<=14?'soon':'ok',
    daysLeft:+result.daysLeft||0,
    score:+result.score||0,
    value:result.value||'',
    duration:result.duration||'',
    winners:result.winners||'',
    submitDeadline:result.submitDeadline||'',
    questionsDeadline:result.timeline&&result.timeline[0]?result.timeline[0].date:'',
    tenderBond:result.tenderBond||'',
    performanceBond:result.performanceBond||'',
    scope:result.scope||'',
    highlights:result.highlights||[],
    flags:result.flags||[],
    thresholds:[
      ...(result.adminThresholds||[]),
      ...((result.professionalThresholds||[]).map(p=>`${p.field}: ${p.detail}`))
    ],
    qualityScoring:result.qualityScoring||[],
    priceScoring:result.priceScoring||[],
    teamReq:result.teamReq||[],
    insurance:result.insurance||'',
    liabilityBond:result.liabilityBond||'',
    tourDate:result.tourDate||'',
    openDate:result.openDate||'',
    contact:result.contact||null,
    appendices: Array.isArray(result.appendices) ? result.appendices : []
  };

  if(!existing){
    const newTender = {
      id:getNextTenderId(),
      ...mappedTender
    };
    if (uploadedPdfBlobUrl) newTender._pdfBlobUrl = uploadedPdfBlobUrl;
    TENDERS.push(newTender);
    saveTender(newTender);
    currentAnalysisIdx = newTender.id;
    updateSimSelect();
    renderTenderTable();
    renderTenderCards();
    renderDashboard();
    document.getElementById('simOpenTenderBtn').onclick=()=>openTenderModal(newTender.id);
  } else {
    Object.assign(existing, mappedTender);
    if (uploadedPdfBlobUrl) existing._pdfBlobUrl = uploadedPdfBlobUrl;
    saveTender(existing);
    currentAnalysisIdx = existing.id;
    renderTenderTable();
    renderTenderCards();
    renderDashboard();
  }

  // Persist PDF blob to IndexedDB for "Open original" after refresh
  if (uploadedFiles[0] && currentAnalysisIdx >= 0) {
    savePdfBlob(currentAnalysisIdx, uploadedFiles[0]);
  }

  switchAITab('overview', document.querySelector('#aiResultTabs .tab'));
}

let aiTab = 'overview';
function switchAITab(tab, el){
  aiTab = tab;
  if(el){
    document.querySelectorAll('#aiResultTabs .tab').forEach(t=>t.classList.remove('on'));
    el.classList.add('on');
  }
  const r = currentAIResult;
  if(!r) return;
  const body = document.getElementById('aiResultBody');

  if(tab==='overview'){
    /* א. מועדי המכרז */
    const timelineHtml = (r.timeline&&r.timeline.length) ? `
      <div class="stl">א. מועדי המכרז</div>
      <table class="atable"><thead><tr><th>נושא</th><th>תאריך ושעה</th></tr></thead><tbody>
        ${r.timeline.map(t=>`<tr><td style="font-weight:600">${t.label}</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:600;white-space:nowrap">${t.date}</td></tr>`).join('')}
      </tbody></table>` : '';

    /* ב. איש קשר */
    const c = r.contact;
    const hasContact = c && (c.name || c.email || c.phone || c.method);
    const contactHtml = hasContact ? `
      <div class="stl">ב. איש קשר ופרטיו</div>
      <div class="ai-contact-card">
        ${c.name?`<div class="ai-contact-row"><span class="ai-contact-icon">👤</span><strong>${c.name}</strong></div>`:''}
        ${c.email?`<div class="ai-contact-row"><span class="ai-contact-icon">📧</span><a href="mailto:${c.email}" style="color:var(--grn);font-weight:600">${c.email}</a></div>`:''}
        ${c.phone&&c.phone!=='—'?`<div class="ai-contact-row"><span class="ai-contact-icon">📞</span>${c.phone}</div>`:''}
        ${c.method?`<div class="ai-contact-row"><span class="ai-contact-icon">📋</span>${c.method}</div>`:''}
      </div>` : '';

    /* ג. היקף ההתקשרות */
    const scopeRows = [
      ['מספר זוכים', r.winners],
      ['היקף שעות שנתי', r.hoursScope],
      ['תקופת התקשרות', r.duration],
    ].filter(row=>row[1]);
    const engagementHtml = scopeRows.length ? `
      <div class="stl">ג. היקף ההתקשרות ומספר זוכים</div>
      <table class="atable"><thead><tr><th>קטגוריה</th><th>פירוט</th></tr></thead><tbody>
        ${scopeRows.map(row=>`<tr><td style="font-weight:600">${row[0]}</td><td>${row[1]}</td></tr>`).join('')}
      </tbody></table>` : '';

    /* ד. דגשים מיוחדים */
    const highlightsHtml = (r.highlights||[]).length ? `
      <div class="stl">ד. דגשים מיוחדים</div>
      ${r.highlights.map(h=>`<div class="alert ab2" style="margin-bottom:5px;font-size:11.5px">ℹ️ ${h}</div>`).join('')}` : '';

    /* ה. ערבות מכרז */
    const bondHtml = r.tenderBond ? `
      <div class="stl">ה. גובה ערבות מכרז</div>
      <div class="ai-result-card"><div class="ai-result-value">${r.tenderBond}</div></div>` : '';

    /* ו. ערבות ביצוע */
    const perfBondHtml = r.performanceBond ? `
      <div class="stl">ו. גובה ערבות ביצוע</div>
      <div class="ai-result-card"><div class="ai-result-value">${r.performanceBond}</div></div>` : '';

    /* אזהרות */
    const flagsHtml = (r.flags||[]).length ? `
      <div class="stl" style="color:var(--amb)">⚠ אזהרות</div>
      ${r.flags.map(f=>`<div class="alert aa" style="margin-bottom:5px;font-size:11.5px">⚠️ ${f}</div>`).join('')}` : '';

    body.innerHTML = `${timelineHtml}${contactHtml}${engagementHtml}${highlightsHtml}${bondHtml}${perfBondHtml}${flagsHtml}`;
  }
  else if(tab==='thresholds'){
    /* א. תנאי סף מנהליים */
    const adminHtml = (r.adminThresholds||[]).length ? `
      <div class="stl">א. תנאי סף מנהליים</div>
      ${r.adminThresholds.map(th=>`<div class="thresh-ok"><span style="color:var(--grn);flex-shrink:0">✅</span><span style="font-size:12.5px">${th}</span></div>`).join('')}` : '';

    /* ב. תנאי סף מקצועיים */
    const profHtml = (r.professionalThresholds||[]).length ? `
      <div class="stl" style="margin-top:13px">ב. תנאי סף מקצועיים</div>
      <table class="atable"><thead><tr><th>תחום</th><th>פירוט תנאי הסף</th></tr></thead><tbody>
        ${r.professionalThresholds.map(t=>`<tr><td style="font-weight:700;white-space:nowrap">${t.field}</td><td style="font-size:12px;line-height:1.5">${t.detail}</td></tr>`).join('')}
      </tbody></table>` : '';

    const empty = !(r.adminThresholds||[]).length && !(r.professionalThresholds||[]).length;
    body.innerHTML = empty
      ? '<div class="alert ab2">לא זוהו תנאי סף במסמך</div>'
      : `${adminHtml}${profHtml}`;
  }
  else if(tab==='scoring'){
    const qs = r.qualityScoring||[];

    /* הערה על ציון מזערי */
    const minScoreHtml = r.minQualityScore ? `
      <div class="alert aa" style="margin-bottom:10px;font-size:13px">⚠️ ציון האיכות המזערי למעבר לשלב בדיקת המחיר הוא <strong>${r.minQualityScore}</strong></div>` : '';

    /* הערה כללית */
    const noteHtml = r.scoringNote ? `<div class="alert ag2" style="margin-bottom:10px;font-size:13px">📊 ${r.scoringNote}</div>` : '';

    /* תצוגת סעיפים: פירוט + ניקוד */
    const qualityHtml = qs.length ? `
      <div class="stl">מדדי איכות (חלוקה לסעיפים)</div>
      ${qs.map((q,i)=>`
        <div style="display:grid;grid-template-columns:1fr 104px;gap:12px;border:1px solid var(--s5);border-radius:10px;padding:12px 13px;margin-bottom:10px;background:var(--w)">
          <div>
            <div style="font-weight:700;font-size:14px;line-height:1.45;color:var(--navy);margin-bottom:6px">${i+1}. ${q.l}</div>
            <div style="font-size:13px;line-height:1.65;color:var(--s2)">${q.detail||'—'}</div>
          </div>
          <div style="display:flex;align-items:center;justify-content:center">
            <div style="text-align:center;background:var(--grn-light);border:1px solid var(--grn-border);border-radius:9px;padding:9px 8px;min-width:86px">
              <div style="font-size:11px;color:var(--s3);margin-bottom:2px">ניקוד</div>
              <div style="font-family:'IBM Plex Mono',monospace;font-weight:800;font-size:15px;line-height:1.2;color:var(--grn)">${formatScoreDisplay(q)}</div>
            </div>
          </div>
        </div>
      `).join('')}` : '';

    /* טבלת ניקוד מחיר */
    const priceHtml = (r.priceScoring&&r.priceScoring.length) ? `
      <div class="stl" style="margin-top:13px">ניקוד מחיר</div>
      <table class="atable"><thead><tr><th>שירות / קטגוריה</th><th style="width:60px">משקל</th></tr></thead><tbody>
        ${r.priceScoring.map(p=>`<tr><td style="font-weight:600">${p.l}</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700;text-align:center">${p.w}</td></tr>`).join('')}
      </tbody></table>` : '';

    const empty = !qs.length && !(r.priceScoring||[]).length;
    body.innerHTML = empty
      ? '<div class="alert ab2">לא זוהו מדדי ניקוד במסמך</div>'
      : `${minScoreHtml}${noteHtml}${qualityHtml}${priceHtml}`;
  }
  else if(tab==='fit'){
    body.innerHTML = buildAnalysisFitTab(r);
  }
  else if(tab==='docs'){
    const apps = r.appendices || [];
    const renderDocsTab = (pdfUrl) => {
      const pdfBtn = pdfUrl
        ? `<button class="btn bo sm" style="margin-bottom:10px" onclick="window.open('${pdfUrl}','_blank')">📄 פתח PDF מקורי</button>`
        : '';
      if(!apps.length){
        body.innerHTML = pdfBtn + '<div class="alert ab2" style="font-size:12px">לא זוהו נספחים למילוי במסמך זה.</div>';
        return;
      }
      body.innerHTML = `
        ${pdfBtn}
        <div class="alert ag2" style="margin-bottom:12px">✨ AI זיהה ${apps.length} נספחים וביצע מילוי אוטומטי מנתוני המשרד</div>
        <div class="atabs" id="aiAppTabsRow" style="flex-wrap:wrap;gap:4px">
          ${apps.map((app, i) =>
            `<div class="atab ${i===0?'on':''}" onclick="switchDynAppTab(${i})">${app.title}</div>`
          ).join('')}
        </div>
        <div id="aiAppContent"></div>`;
      renderDynAppContent(0);
    };

    if (uploadedPdfBlobUrl) {
      renderDocsTab(uploadedPdfBlobUrl);
    } else if (currentAnalysisIdx >= 0) {
      // Restore PDF blob URL from IndexedDB after refresh
      renderDocsTab(null); // render immediately without PDF button
      getPdfBlobUrl(currentAnalysisIdx).then(url => {
        if (url && aiTab === 'docs') {
          uploadedPdfBlobUrl = url;
          renderDocsTab(url);
        }
      });
    } else {
      renderDocsTab(null);
    }
  }
}

/* ═════ DYNAMIC APPENDIX RENDERING ═════ */
let currentDynAppIdx = 0;
let signatureModalState = { appIdx: -1, rowIdx: 0, fieldKey: '' };
let signaturePadState = { drawing: false, hasInk: false, initialized: false };

function switchDynAppTab(idx){
  currentDynAppIdx = idx;
  document.querySelectorAll('#aiAppTabsRow .atab').forEach((el, i) => {
    el.className = 'atab' + (i === idx ? ' on' : '');
  });
  renderDynAppContent(idx);
}

function isSignatureField(field){
  const type = String(field?.type || '').toLowerCase();
  const label = String(field?.label || '').toLowerCase();
  const key = String(field?.key || '').toLowerCase();
  return type === 'signature' || label.includes('חתימ') || key.includes('sign');
}

function isSignatureDataUrl(val){
  return typeof val === 'string' && /^data:image\/(png|jpeg|jpg);base64,/i.test(val.trim());
}

function ensureSignatureCanvasSize(){
  const canvas = document.getElementById('signatureCanvas');
  if(!canvas) return;
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(320, Math.floor(rect.width || 500));
  const h = Math.max(180, Math.floor(rect.height || 220));
  if (canvas.width === w * ratio && canvas.height === h * ratio) return;
  const prev = canvas.toDataURL('image/png');
  canvas.width = w * ratio;
  canvas.height = h * ratio;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#12302a';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  if (prev && prev.length > 30) {
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, w, h);
    img.src = prev;
  }
}

function getCanvasPoint(ev, canvas){
  const rect = canvas.getBoundingClientRect();
  const src = ev.touches?.[0] || ev.changedTouches?.[0] || ev;
  return {
    x: src.clientX - rect.left,
    y: src.clientY - rect.top
  };
}

function initSignatureModalCanvas(){
  if(signaturePadState.initialized) return;
  const canvas = document.getElementById('signatureCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');

  const start = (ev) => {
    ev.preventDefault();
    ensureSignatureCanvasSize();
    const p = getCanvasPoint(ev, canvas);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    signaturePadState.drawing = true;
  };
  const move = (ev) => {
    if(!signaturePadState.drawing) return;
    ev.preventDefault();
    const p = getCanvasPoint(ev, canvas);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    signaturePadState.hasInk = true;
  };
  const end = (ev) => {
    if(!signaturePadState.drawing) return;
    ev.preventDefault();
    signaturePadState.drawing = false;
  };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end, { passive: false });
  window.addEventListener('resize', () => {
    const modal = document.getElementById('signatureModal');
    if(modal?.classList.contains('on')) ensureSignatureCanvasSize();
  });

  signaturePadState.initialized = true;
}

function setSignatureError(msg){
  const err = document.getElementById('signatureError');
  if(!err) return;
  if(!msg){
    err.style.display = 'none';
    err.textContent = '';
    return;
  }
  err.style.display = 'block';
  err.textContent = msg;
}

function drawSignatureDataUrl(dataUrl){
  const canvas = document.getElementById('signatureCanvas');
  if(!canvas) return;
  ensureSignatureCanvasSize();
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.onload = () => {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    const fit = Math.min(w / img.width, h / img.height);
    const iw = img.width * fit;
    const ih = img.height * fit;
    const x = (w - iw) / 2;
    const y = (h - ih) / 2;
    ctx.drawImage(img, x, y, iw, ih);
    signaturePadState.hasInk = true;
  };
  img.src = dataUrl;
}

function openSignatureModal(appIdx, rowIdx, fieldKey){
  signatureModalState = { appIdx, rowIdx, fieldKey };
  initSignatureModalCanvas();
  const modal = document.getElementById('signatureModal');
  if(!modal) return;
  setSignatureError('');
  ensureSignatureCanvasSize();
  clearSignatureCanvas();

  const row = currentAIResult?.appendices?.[appIdx]?.rows?.[rowIdx] || {};
  const existing = row.__signature || row[fieldKey];
  if(isSignatureDataUrl(existing)) drawSignatureDataUrl(existing);

  const fileInput = document.getElementById('signatureFileInput');
  if(fileInput) fileInput.value = '';
  modal.classList.add('on');
}

function closeSignatureModal(){
  document.getElementById('signatureModal')?.classList.remove('on');
  setSignatureError('');
}

function clearSignatureCanvas(){
  const canvas = document.getElementById('signatureCanvas');
  if(!canvas) return;
  ensureSignatureCanvasSize();
  const ctx = canvas.getContext('2d');
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  signaturePadState.hasInk = false;
}

function uploadSignatureFromFile(e){
  const file = e?.target?.files?.[0];
  if(!file) return;
  if(!/^image\/(png|jpeg|jpg)$/i.test(file.type)){
    setSignatureError('ניתן להעלות רק קובץ PNG/JPG.');
    return;
  }
  if(file.size > 2 * 1024 * 1024){
    setSignatureError('הקובץ גדול מדי. המגבלה היא 2MB.');
    return;
  }
  setSignatureError('');
  const reader = new FileReader();
  reader.onload = () => drawSignatureDataUrl(String(reader.result || ''));
  reader.readAsDataURL(file);
}

function saveSignatureFromModal(){
  const canvas = document.getElementById('signatureCanvas');
  if(!canvas) return;
  if(!signaturePadState.hasInk){
    setSignatureError('לא זוהתה חתימה. צייר/י חתימה או העלה/י תמונה.');
    return;
  }
  const dataUrl = canvas.toDataURL('image/png');
  const { appIdx, rowIdx, fieldKey } = signatureModalState;
  // Keep one shared signature value per appendix row and reuse it for all signature fields.
  updateAppField(appIdx, rowIdx, '__signature', dataUrl);
  if (fieldKey) updateAppField(appIdx, rowIdx, fieldKey, dataUrl);
  renderDynAppContent(currentDynAppIdx);
  if(typeof renderTmDynApp === 'function' && document.getElementById('tmAppContent')){
    renderTmDynApp(currentDynAppIdx);
  }
  closeSignatureModal();
}

function buildSignaturePreview(appIdx, rowIdx, fieldKey, val){
  const keyArg = JSON.stringify(String(fieldKey || ''));
  const row = currentAIResult?.appendices?.[appIdx]?.rows?.[rowIdx] || {};
  const sharedVal = row.__signature || val;
  if(isSignatureDataUrl(sharedVal)){
    return `<button type="button" class="sign-preview" onclick='openSignatureModal(${appIdx},${rowIdx},${keyArg})'>
      <img src="${sharedVal}" alt="חתימה">
    </button>`;
  }
  return `<button type="button" class="sign-preview" onclick='openSignatureModal(${appIdx},${rowIdx},${keyArg})'>
    <span class="sign-placeholder">לחץ להוספת חתימה</span>
  </button>`;
}

function renderDynAppContent(idx){
  const ac = document.getElementById('aiAppContent');
  if(!ac) return;
  const apps = currentAIResult?.appendices || [];
  const app = apps[idx];
  if(!app){ ac.innerHTML = ''; return; }
  ac.innerHTML = buildDynAppHtml(app, idx, currentAnalysisIdx);

  // Lazy-load real fields from AI if still using defaults
  if(app._defaultFields && currentAIResult?._filteredText){
    const overlay = document.createElement('div');
    overlay.id = 'fieldLoadingOverlay';
    overlay.style.cssText = 'text-align:center;padding:12px;font-size:12px;color:var(--s2)';
    overlay.innerHTML = '<span class="spn"></span> טוען שדות ספציפיים מהמכרז...';
    ac.prepend(overlay);

    fetchAppendixFields(app, currentAIResult._filteredText, currentAnalysisIdx).then(() => {
      if(currentDynAppIdx === idx) renderDynAppContent(idx);
    });
  }
}

function buildDynAppHtml(app, idx, tenderId){
  const tenderName = currentAIResult?.tenderName || '';
  const tenderOrg = currentAIResult?.orgName || '';
  const tenderNumber = currentAIResult?.tenderNumber || '';

  const headerHtml = `
    <div class="adoc">
      <div class="adoch">
        <div class="seal">נספח<br>${app.hebrewLabel || ''}</div>
        <div style="flex:1">
          <div class="adocht">${app.title}</div>
          <div class="adochs">${tenderName} | ${tenderOrg} | ${tenderNumber}</div>
        </div>
        <button class="btn bo sm" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff"
          onclick="printDocument('dynApp',${tenderId},${idx})">
          <svg width="11" height="11"><use href="#ic-print"/></svg> הדפס
        </button>
      </div>
      <div style="height:3px;background:linear-gradient(90deg,rgba(255,255,255,.3),rgba(255,255,255,.1))"></div>
      <div style="padding:12px 16px">
        <div style="margin-bottom:9px">
          <div style="font-weight:800;font-size:13px;color:var(--navy)">${BIDDER.name}${BIDDER.subtitle?' — '+BIDDER.subtitle:''}</div>
          <div style="font-size:10.5px;color:var(--s2)">${BIDDER.address} | ${BIDDER.phone} | ${BIDDER.email}</div>
        </div>
        ${app.description ? `<div style="font-size:11.5px;color:var(--s2);margin-bottom:9px;padding:6px 9px;background:var(--bg2);border-radius:6px">${app.description}</div>` : ''}
        ${app.autoFillNotes ? `<div class="alert ag2" style="margin-bottom:9px;font-size:11px">🤖 ${app.autoFillNotes}</div>` : ''}`;

  let contentHtml = '';
  const hasSignatureField = (app.fields || []).some(isSignatureField);

  if(app.isTable && app.fields && app.fields.length > 0){
    const displayFields = app.fields.filter(f => !isSignatureField(f));
    // Table-style appendix
    contentHtml = `
        <div style="overflow-x:auto">
          <table class="atable" id="appTable_${idx}">
            <thead><tr>${displayFields.map(f => `<th>${f.label}</th>`).join('')}<th style="width:30px"></th></tr></thead>
            <tbody>
              ${(app.rows||[]).map((row, ri) => `
                <tr>${displayFields.map(f => {
                  const val = row[f.key] !== undefined ? row[f.key] : '';
                  const dirStyle = (f.type === 'text' && /^[a-zA-Z0-9@+]/.test(val+'')) ? 'direction:ltr;' : '';
                  return `<td contenteditable="true" data-app="${idx}" data-row="${ri}" data-field="${f.key}"
                    onblur="updateAppField(${idx},${ri},'${f.key}',this.textContent)"
                    style="font-size:11.5px;min-width:60px;${dirStyle}">${val}</td>`;
                }).join('')}
                <td><span class="badge bgg" style="font-size:8px;cursor:default" title="ממולא אוטומטית">AI</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
  } else {
    // Form-style appendix
    const row = (app.rows && app.rows[0]) || {};
    contentHtml = (app.fields||[]).map(f => {
      const val = row[f.key] !== undefined ? row[f.key] : '';
      if(f.type === 'textarea'){
        return `<div style="margin-bottom:8px">
          <div style="font-weight:700;font-size:10px;color:var(--s3);margin-bottom:3px">${f.label}</div>
          <textarea class="fi" style="min-height:60px" data-app="${idx}" data-field="${f.key}"
            onblur="updateAppField(${idx},0,'${f.key}',this.value)">${val}</textarea>
        </div>`;
      }
      if(f.type === 'boolean'){
        return `<div style="margin-bottom:8px">
          <div style="font-weight:700;font-size:10px;color:var(--s3);margin-bottom:3px">${f.label}</div>
          <select class="fs" data-app="${idx}" data-field="${f.key}"
            onchange="updateAppField(${idx},0,'${f.key}',this.value)">
            <option value="false" ${!val || val==='false' ? 'selected' : ''}>לא</option>
            <option value="true" ${val && val!=='false' ? 'selected' : ''}>כן</option>
          </select>
        </div>`;
      }
      if(isSignatureField(f)) return '';
      // Default: text/number/date input
      const dirStyle = (f.type === 'text' && /^[a-zA-Z0-9@+]/.test(val+'')) ? 'direction:ltr;' : '';
      return `<div style="margin-bottom:8px">
        <div style="font-weight:700;font-size:10px;color:var(--s3);margin-bottom:3px">${f.label}</div>
        <input class="fi" type="${f.type==='date'?'date':f.type==='number'?'number':'text'}"
          value="${val}" style="${dirStyle}"
          data-app="${idx}" data-field="${f.key}"
          onblur="updateAppField(${idx},0,'${f.key}',this.value)">
      </div>`;
    }).join('');
  }

  if (hasSignatureField) {
    const sigVal = (app.rows && app.rows[0] && (app.rows[0].__signature || app.rows[0].signature)) || '';
    contentHtml += `
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--s5)">
        <div style="font-weight:700;font-size:11px;color:var(--navy);margin-bottom:6px">חתימה</div>
        ${buildSignaturePreview(idx, 0, 'signature', sigVal)}
      </div>`;
  }

  const footerHtml = `
        <div class="wm">מזכיר Tender Intelligence | נוצר ${new Date().toLocaleDateString('he-IL')} | סודי</div>
      </div>
    </div>`;

  return headerHtml + contentHtml + footerHtml;
}

function updateAppField(appIdx, rowIdx, fieldKey, value){
  const apps = currentAIResult?.appendices;
  if(!apps || !apps[appIdx]) return;
  if(!apps[appIdx].rows) apps[appIdx].rows = [];
  if(!apps[appIdx].rows[rowIdx]) apps[appIdx].rows[rowIdx] = {};
  apps[appIdx].rows[rowIdx][fieldKey] = value;
  apps[appIdx].userEdited = true;
  apps[appIdx].lastModified = new Date().toISOString();

  // Persist
  if(currentAnalysisIdx >= 0){
    saveAppendices(currentAnalysisIdx, apps);
  }
}
