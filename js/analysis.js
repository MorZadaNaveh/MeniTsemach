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

function normalizeGuarantees(source){
  const src = source || {};
  const fromArray = Array.isArray(src.guarantees) ? src.guarantees : [];
  const rows = fromArray
    .map(g => ({
      label: String(g?.label || g?.type || '').trim(),
      detail: String(g?.detail || g?.value || '').trim()
    }))
    .filter(g => g.label || g.detail);
  if (rows.length) return rows;

  return [
    { label: 'ערבות מכרז', detail: String(src.tenderBond || '').trim() },
    { label: 'ערבות ביצוע', detail: String(src.performanceBond || '').trim() },
    { label: 'ערבות אחריות', detail: String(src.liabilityBond || '').trim() }
  ].filter(g => g.detail);
}

function buildGuaranteesSectionHtml(source){
  const rows = normalizeGuarantees(source);
  if (!rows.length) {
    return `<div class="stl">ערבויות</div>
      <div class="alert ab2" style="font-size:12px">אין ערבויות למכרז זה</div>`;
  }
  return `<div class="stl">ערבויות</div>
    <table class="atable"><thead><tr><th>סוג</th><th>פירוט</th></tr></thead><tbody>
      ${rows.map(g=>`<tr><td style="font-weight:600">${g.label}</td><td>${g.detail}</td></tr>`).join('')}
    </tbody></table>`;
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

function escapeHtml(str){
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SCORING_TABLE_HEADERS = ['נושא', 'קריטריון', 'ניקוד מקסימאלי'];
const SCORING_TABLE_CELL_STYLE = 'font-size:14px;min-width:0;white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;line-break:auto;vertical-align:top;line-height:1.55;padding:10px 12px';
const SCORING_TABLE_TOPIC_STYLE = SCORING_TABLE_CELL_STYLE + ';font-weight:600;white-space:pre-wrap;min-width:140px';
const SCORING_TABLE_SCORE_STYLE = SCORING_TABLE_CELL_STYLE + ';text-align:center;white-space:nowrap;width:88px';
const SCORING_TABLE_TH_STYLE = 'font-size:14px;background:var(--bg2);font-weight:700;white-space:nowrap;padding:10px 12px';

function formatScoringTopicText(parts){
  const text = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return text.replace(/(13\.2\.2\.\d+)\s*/, '$1. ');
}

function formatScoringDetailText(lines){
  return lines
    .filter(Boolean)
    .map(line => {
      const t = String(line).trim();
      if (!t) return '';
      if (t.startsWith('•')) return t;
      if (/^\.\d+/.test(t)) return t;
      return t;
    })
    .filter(Boolean)
    .join('\n');
}

function cleanPdfLine(line){
  return String(line || '')
    .replace(/[\u202a-\u202e\u200e\u200f\ufeff\u2066-\u2069]/g, '')
    .replace(/[\u2019\u05F3\u02bc\u2018]/g, "'")
    .trim();
}

function cleanPdfText(text){
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u202a-\u202e\u200e\u200f\ufeff]/g, '');
}

function extractScoringSectionText(fullText){
  const text = cleanPdfText(fullText);
  const tightStart = text.search(/13\.2\.2[^\n]{0,50}הבדיקה\s+תתבצע/i);
  if (tightStart >= 0) {
    const slice = text.slice(tightStart);
    const endMatch = slice.search(/\.?\s*13\.3(?:\s|\.|\s*שלב)/);
    const end = endMatch > 200 ? endMatch : Math.min(slice.length, 80000);
    return slice.slice(0, end).trim();
  }

  const startPatterns = [
    /\.?\s*13\.2\s*שלב\s+שני[^\n]{0,120}בדיקת\s+איכות/i,
    /\.?\s*13\.2[\s\S]{0,50}בדיקת\s+איכות/i,
    /בדיקת\s+איכות\s*[\(\[]?\s*100\s*%?/i,
    /(?:^|\n)\s*13\.2[\s\S]{0,80}בדיקת\s+איכות/m,
    /(?:^|\n)\s*(?:מערכת|טבלת|חלוקת)\s*(?:ה)?ניקוד/m
  ];
  let start = -1;
  for (const re of startPatterns) {
    const idx = text.search(re);
    if (idx >= 0 && (start < 0 || idx < start)) start = idx;
  }
  if (start < 0) return '';

  const slice = text.slice(start);
  const endMatch = slice.search(/\.?\s*13\.3(?:\s|\.|\s*שלב)/);
  const end = endMatch > 200 ? endMatch : Math.min(slice.length, 80000);
  return slice.slice(0, end).trim();
}

function extractBlockMaxScore(blockLines){
  const nums = blockLines
    .map((l, i) => (/^\d{1,3}$/.test(l) ? { n: parseInt(l, 10), i } : null))
    .filter(Boolean);
  if (!nums.length) return '';

  const pageLike = new Set([15, 16, 17, 18, 19, 20]);
  const scoring = nums.filter(x => x.n >= 5 && x.n <= 100);
  const pool = scoring.filter(x => !pageLike.has(x.n) || scoring.some(y => y.n >= 25));
  const use = pool.length ? pool : scoring;
  if (!use.length) return '';

  if (use.length >= 2 && use[use.length - 1].n === 100 && use[use.length - 2].n <= 50) {
    return String(use[use.length - 2].n);
  }
  const big = use.filter(x => x.n >= 10);
  return String((big.length ? big[big.length - 1] : use[use.length - 1]).n);
}

function isScoringTableHeaderAt(lines, idx){
  return lines[idx] === 'קריטריון' && lines[idx + 1] === 'נושא' && /ניקוד/.test(lines[idx + 2] || '');
}

const SCORING_HEADER_WORDS = new Set(['קריטריון', 'נושא', 'ניקוד', 'מקסימאלי']);

function findScoringHeaderIndices(lines){
  const out = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === 'ניקוד' && lines[i + 1] === 'מקסימאלי' &&
        i >= 2 && lines[i - 2] === 'קריטריון' && lines[i - 1] === 'נושא') {
      out.push(i - 2);
    }
  }
  return out;
}

function extractOrderedScoringMaxValues(lines){
  const scores = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/^\d{1,3}$/.test(lines[i])) continue;
    const n = parseInt(lines[i], 10);
    if (n < 5 || n > 100) continue;
    const before = lines[i - 1] || '';
    const after = lines[i + 1] || '';
    const prev3 = lines.slice(Math.max(0, i - 3), i);
    const nearMax = before === 'מקסימאלי' || prev3.includes('מקסימאלי');
    const beforeHeader = after === 'קריטריון' ||
      (lines[i + 1] === 'קריטריון' && lines[i + 2] === 'נושא');
    const beforeNextTopic = /^\.?13\.2\.2\.\d+/.test(after);
    const atTotal = before === 'סה"כ';
    const afterCriterion = /נק/.test(before) && before.length > 20;
    if (n >= 15 && n <= 20 && lines[i + 1] && /^\d{1,3}$/.test(lines[i + 1]) &&
        parseInt(lines[i + 1], 10) >= 10) continue;
    if (n === 100) continue;
    if (nearMax || beforeHeader || beforeNextTopic || atTotal ||
        (afterCriterion && [10, 30, 50].includes(n))) {
      scores.push({ i, val: String(n) });
    }
  }
  return scores;
}

function topicOnlyLinesFromSlice(slice){
  const out = [];
  for (const line of slice) {
    if (SCORING_HEADER_WORDS.has(line)) continue;
    if (/^\d{1,3}$/.test(line) && parseInt(line, 10) >= 10) continue;
    if (/^\.?13\.2\.2\.\d+/.test(line)) {
      out.push(line.replace(/^\.+/, '').trim());
      continue;
    }
    if (/^(המציע|עבור\s|למען|בין\s|על\s|לצורך|\.1מקצועיות|המשרד\sשומר|המשרד\sיבקש|הציון\sהסופי)/.test(line)) break;
    if (line.length > 55) break;
    out.push(line.replace(/^\.+/, '').trim());
  }
  return out;
}

function topicSidecarLinesFromSlice(slice){
  const sh = slice.findIndex(l => /^שאין/.test(l));
  if (sh < 0) return [];
  const out = [];
  for (let i = sh; i < slice.length; i++) {
    if (/^(המשרד\sיבקש|\.1מקצועיות|המציע\sשירותי)/.test(slice[i])) break;
    if (slice[i].length > 35) break;
    out.push(slice[i]);
  }
  return out;
}

function extractScoringPreamble(lines, firstTopicIdx){
  return lines.slice(0, firstTopicIdx).filter(l => {
    if (/^\.?13\.2\.2/.test(l)) return false;
    if (SCORING_HEADER_WORDS.has(l) || l === 'קריטריון' || l === 'נושא') return false;
    if (/הבדיקה\s+תתבצע/.test(l)) return false;
    return true;
  });
}

function filterScoringDetailLines(slice){
  return slice.filter(l => {
    if (SCORING_HEADER_WORDS.has(l)) return false;
    if (/^\d{1,3}$/.test(l) && parseInt(l, 10) >= 10 && parseInt(l, 10) <= 100) return false;
    if (/^\.?13\.2\.2\.\d+/.test(l)) return false;
    return true;
  });
}

function detailBetweenTopicAndScore(lines, start, scoreIdx){
  const slice = lines.slice(start, scoreIdx);
  const topicEnd = slice.findIndex(l => /^(המציע|עבור\s)/.test(l));
  const body = topicEnd >= 0 ? slice.slice(topicEnd) : slice;
  return filterScoringDetailLines(body);
}

function stripTopicEchoFromDetail(detailLines, topicLines){
  const topicWords = new Set(
    topicLines.join(' ').split(/\s+/).filter(w => w.length > 2)
  );
  let start = 0;
  while (start < detailLines.length && detailLines[start].length < 30 &&
      [...topicWords].some(w => detailLines[start].includes(w))) {
    start++;
  }
  return detailLines.slice(start);
}

function joinTopicParts(...parts){
  const lines = parts.flat().filter(Boolean);
  return formatScoringTopicText(lines);
}

function joinDetailParts(...parts){
  const lines = parts.flat().filter(Boolean);
  return formatScoringDetailText(lines);
}

function parseTenderScoringTableFromLines(sectionText){
  const lines = String(sectionText || '').split(/\r?\n/).map(cleanPdfLine).filter(l => l.length > 0);
  if (!lines.length) return [];

  const headers = findScoringHeaderIndices(lines);
  const topics = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\.?\s*13\.2\.2\.(\d+)/);
    if (!m || topics.some(t => t.num === m[1])) continue;
    topics.push({ num: m[1], i });
  }
  const scores = extractOrderedScoringMaxValues(lines);
  if (topics.length < 5 || scores.length < 5) return [];

  const h1 = headers[0];
  const h2 = headers[1] ?? lines.length;
  const pre = extractScoringPreamble(lines, topics[0].i);
  const s = scores.map(x => x.i);
  const totalIdx = lines.findIndex(l => /^סה"כ/.test(l));
  const block2 = lines.slice(h1 + 4, topics[2].i);

  const row4Detail1 = filterScoringDetailLines(lines.slice(topics[3].i, s[3]));
  const row4TopicLines = [
    ...topicOnlyLinesFromSlice(lines.slice(topics[3].i, s[3])),
    ...topicOnlyLinesFromSlice(lines.slice(s[2] + 1, topics[3].i)),
    ...topicOnlyLinesFromSlice(lines.slice(h2 + 4, topics[4].i))
  ];
  const row4Detail2 = filterScoringDetailLines(lines.slice(h2 + 4, topics[4].i));

  const rows = [
    [
      joinTopicParts(topicOnlyLinesFromSlice(lines.slice(topics[0].i, topics[1].i))),
      joinDetailParts(pre, filterScoringDetailLines(lines.slice(s[0] + 1, h1))),
      scores[0].val
    ],
    [
      joinTopicParts(
        topicOnlyLinesFromSlice(lines.slice(topics[1].i, s[0])),
        topicSidecarLinesFromSlice(block2)
      ),
      joinDetailParts(filterScoringDetailLines(block2)),
      scores[1].val
    ],
    [
      joinTopicParts(topicOnlyLinesFromSlice(lines.slice(topics[2].i, s[2]))),
      joinDetailParts(detailBetweenTopicAndScore(lines, topics[2].i, s[2])),
      scores[2].val
    ],
    [
      joinTopicParts(row4TopicLines),
      joinDetailParts(
        stripTopicEchoFromDetail(row4Detail1, row4TopicLines),
        row4Detail2
      ),
      scores[3].val
    ],
    [
      joinTopicParts(topicOnlyLinesFromSlice(lines.slice(topics[4].i, totalIdx))),
      joinDetailParts(detailBetweenTopicAndScore(lines, topics[4].i, totalIdx)),
      scores[4].val
    ]
  ];

  if (totalIdx >= 0) {
    rows.push(['סה"כ', '', lines[totalIdx + 2] || '100']);
  }

  const titleLine = lines.find(l => /בדיקת\s+איכות/.test(l));
  const title = (titleLine || 'בדיקת איכות').replace(/^\.+/, '').trim();
  return [{ title, headers: SCORING_TABLE_HEADERS.slice(), rows }];
}

const SCORING_COL_TOPIC_MIN_X = 470;
const SCORING_COL_DETAIL_MIN_X = 120;
const SCORING_COL_SCORE_MAX_X = 120;
const SCORING_ROW_Y_TOLERANCE = 6;

function pdfItemsToLines(cellItems){
  if (!cellItems.length) return [];
  const sorted = cellItems.slice().sort((a, b) => b.y - a.y || b.x - a.x);
  const lines = [];
  let bucket = null;
  for (const it of sorted) {
    const s = cleanPdfLine(it.str);
    if (!s) continue;
    if (!bucket || Math.abs(bucket.y - it.y) > SCORING_ROW_Y_TOLERANCE) {
      bucket = { y: it.y, parts: [{ x: it.x, s }] };
      lines.push(bucket);
    } else {
      bucket.parts.push({ x: it.x, s });
    }
  }
  return lines.map(bucket => {
    bucket.parts.sort((a, b) => b.x - a.x);
    return bucket.parts.map(p => p.s).join(' ').trim();
  }).filter(Boolean);
}

function cellTextFromItems(items){
  return formatScoringDetailText(pdfItemsToLines(items));
}

function buildScoringTablesFromPdfItems(pdfItems, fullText){
  if (!Array.isArray(pdfItems) || !pdfItems.length) return [];

  const sectionText = extractScoringSectionText(fullText);
  if (!sectionText || !/בדיקת\s+איכות/.test(sectionText)) return [];

  const items = pdfItems
    .map(it => ({
      str: cleanPdfLine(it.str),
      x: Number(it.x) || 0,
      y: Number(it.y) || 0,
      page: Number(it.page) || 1
    }))
    .filter(it => it.str);

  const anchors = items
    .filter(it => /^\.?\s*13\.2\.2\.\d+/.test(it.str))
    .sort((a, b) => a.page - b.page || b.y - a.y);

  const seenIds = new Set();
  const rowAnchors = anchors.filter(a => {
    const id = (a.str.match(/13\.2\.2\.(\d+)/) || [])[1];
    if (!id || seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });

  if (!rowAnchors.length) return [];

  const titleItem = items.find(it => /בדיקת\s+איכות/.test(it.str));
  const title = titleItem
    ? items
        .filter(it => it.page === titleItem.page && Math.abs(it.y - titleItem.y) < 20)
        .sort((a, b) => b.x - a.x)
        .map(it => it.str)
        .join(' ')
        .replace(/^\.+/, '')
        .trim()
    : 'בדיקת איכות';

  const rows = [];
  const ROW_BAND_HEIGHT = 175;
  for (let i = 0; i < rowAnchors.length; i++) {
    const anchor = rowAnchors[i];
    const yMax = anchor.y + (i === 0 ? 95 : 14);
    const yMin = anchor.y - ROW_BAND_HEIGHT;

    const inRow = items.filter(it => {
      if (it.page !== anchor.page) return false;
      return it.y <= yMax && it.y >= yMin;
    });

    const topicItems = inRow.filter(it => it.x >= SCORING_COL_TOPIC_MIN_X);
    const scoreItems = inRow.filter(it => it.x < SCORING_COL_SCORE_MAX_X && /^\d{1,3}$/.test(it.str));
    const detailItems = inRow.filter(it =>
      it.x >= SCORING_COL_DETAIL_MIN_X && it.x < SCORING_COL_TOPIC_MIN_X &&
      !/^\d{1,3}$/.test(it.str)
    );

    const topicLines = pdfItemsToLines(topicItems);
    const detailLines = pdfItemsToLines(detailItems);
    const scoreLines = pdfItemsToLines(scoreItems);
    const maxScore = extractBlockMaxScore(scoreLines) ||
      (scoreItems.length ? String(scoreItems.sort((a, b) => b.y - a.y)[0].str) : '');

    rows.push([
      formatScoringTopicText(topicLines.length ? topicLines : [anchor.str.replace(/^\.+/, '').trim()]),
      formatScoringDetailText(detailLines),
      maxScore
    ]);
  }

  if (/סה"כ/.test(sectionText)) {
    const totalItems = items.filter(it => /^\d{2,3}$/.test(it.str) && it.x < SCORING_COL_SCORE_MAX_X);
    const nearTotal = items.find(it => it.str === 'סה"כ' || it.str.includes('סה"כ'));
    let totalScore = '100';
    if (nearTotal) {
      const tScores = totalItems
        .filter(it => it.page === nearTotal.page && Math.abs(it.y - nearTotal.y) < 30)
        .map(it => parseInt(it.str, 10))
        .filter(n => n >= 50 && n <= 100);
      if (tScores.length) totalScore = String(Math.max(...tScores));
    }
    rows.push(['סה"כ', '', totalScore]);
  }

  if (!rows.length) return [];
  return [{ title, headers: SCORING_TABLE_HEADERS.slice(), rows }];
}

function parseQualityAssessmentTable(sectionText){
  const lineTables = parseTenderScoringTableFromLines(sectionText);
  if (lineTables.length && lineTables[0].rows.length >= 5) return lineTables;
  return [];
}

function splitScoringTableLine(line){
  const normalized = String(line || '').replace(/\t/g, '    ');
  const trimmed = cleanPdfLine(normalized);
  if (!trimmed) return [];
  const byGap = trimmed.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
  if (byGap.length >= 2) return byGap;
  if (trimmed.includes('|')) {
    return trimmed.split('|').map(s => s.trim()).filter(s => s.length > 0);
  }
  return [trimmed];
}

function padScoringRows(rows){
  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (!maxCols) return [];
  return rows.map(row => {
    const copy = row.slice();
    while (copy.length < maxCols) copy.push('');
    return copy;
  });
}

function parseScoringSectionToTables(sectionText){
  if (/בדיקת\s+איכות/.test(sectionText) && /13\.2\.2\.\d+/.test(sectionText)) {
    const qaTables = parseQualityAssessmentTable(sectionText);
    if (qaTables.length && qaTables[0].rows.length) return qaTables;
  }

  const lines = String(sectionText || '')
    .split(/\r?\n/)
    .map(l => cleanPdfLine(l))
    .filter(l => l.length > 0);
  if (!lines.length) return [];

  const rows = padScoringRows(lines.map(splitScoringTableLine));
  if (!rows.length) return [];

  const headerHint = /משקל|ניקוד|נקוד|קריטריון|מדד|סעיף|שם|ציון|אחוז|מקסימ/i;
  const firstLooksLikeHeader = headerHint.test(rows[0].join(' ')) && rows.length > 1;

  if (firstLooksLikeHeader) {
    return [{ title: '', headers: rows[0], rows: rows.slice(1) }];
  }
  return [{ title: '', headers: [], rows }];
}

function remapScoringTableColumns(tbl){
  const headers = (tbl.headers || []).map(h => String(h).trim());
  const rows = tbl.rows || [];
  if (headers[0] === 'קריטריון' && headers[1] === 'נושא') {
    return {
      ...tbl,
      headers: SCORING_TABLE_HEADERS.slice(),
      rows: rows.map(r => [r[1] || '', r[0] || '', r[2] || ''])
    };
  }
  if (!headers.length && rows.length && rows[0].length >= 3) {
    const first = String(rows[0][0] || '');
    if (/^13\.2\.2\.\d+/.test(first) || first.length < 80) {
      return { ...tbl, headers: SCORING_TABLE_HEADERS.slice() };
    }
  }
  return {
    ...tbl,
    headers: headers.length ? headers : SCORING_TABLE_HEADERS.slice()
  };
}

function normalizeScoringTables(source){
  const src = source || {};
  const fromArray = Array.isArray(src.scoringTables) ? src.scoringTables : [];
  const tables = fromArray
    .map(tbl => {
      const headers = Array.isArray(tbl?.headers)
        ? tbl.headers.map(h => String(h ?? '').trim())
        : [];
      const rows = Array.isArray(tbl?.rows)
        ? padScoringRows(
            tbl.rows
              .filter(r => Array.isArray(r))
              .map(r => r.map(c => String(c ?? '').trim()))
              .filter(r => r.some(c => c))
          )
        : [];
      return remapScoringTableColumns({
        title: String(tbl?.title || tbl?.caption || '').trim(),
        headers: headers.length ? headers : [],
        rows
      });
    })
    .filter(tbl => tbl.title || tbl.headers.length || tbl.rows.length);

  if (tables.length) return tables;

  const sectionText = String(src.scoringSectionText || '').trim();
  if (sectionText) return parseScoringSectionToTables(sectionText);

  const qs = Array.isArray(src.qualityScoring) ? src.qualityScoring : [];
  if (qs.length) {
    return [{
      title: '',
      headers: SCORING_TABLE_HEADERS.slice(),
      rows: qs.map(q => [
        String(q.l || '').trim(),
        String(q.detail || '').trim(),
        String(q.w || '').replace('%', '').trim()
      ])
    }];
  }
  return [];
}

function buildScoringTablesHtml(source){
  const tables = normalizeScoringTables(source);
  if (!tables.length) {
    return '<div class="alert ab2" style="font-size:14px">לא זוהו טבלאות ניקוד במסמך</div>';
  }

  return `<div class="scoring-verbatim-wrap" style="font-size:14px;line-height:1.55">
    ${tables.map(tbl => {
      const headers = (tbl.headers && tbl.headers.length) ? tbl.headers : SCORING_TABLE_HEADERS;
      const rows = tbl.rows || [];
      const thead = `<thead><tr>${headers.map(h =>
        `<th style="${SCORING_TABLE_TH_STYLE}">${escapeHtml(h)}</th>`
      ).join('')}</tr></thead>`;
      const tbodyRows = rows.map(row => {
        const cells = padScoringRows([row])[0];
        const cellStyles = [SCORING_TABLE_TOPIC_STYLE, SCORING_TABLE_CELL_STYLE, SCORING_TABLE_SCORE_STYLE];
        return `<tr>${cells.map((cell, ci) =>
          `<td style="${cellStyles[ci] || SCORING_TABLE_CELL_STYLE}">${escapeHtml(cell)}</td>`
        ).join('')}</tr>`;
      }).join('');

      return `
        ${tbl.title ? `<div class="stl" style="font-size:14px">${escapeHtml(tbl.title)}</div>` : ''}
        <div style="overflow-x:auto;margin-bottom:16px">
          <table class="atable scoring-verbatim-table" dir="rtl" style="font-size:14px;width:100%;table-layout:fixed">
            <colgroup>
              <col style="width:22%">
              <col style="width:68%">
              <col style="width:10%">
            </colgroup>
            ${thead}
            <tbody>${tbodyRows}</tbody>
          </table>
        </div>`;
    }).join('')}
  </div>`;
}

function countScoringTableRows(tables){
  return (tables || []).reduce((sum, tbl) => sum + (tbl.rows?.length || 0), 0);
}

function attachScoringTablesFromDocument(result, fullText, pdfItems){
  const scoringSectionText = extractScoringSectionText(fullText);
  result.scoringSectionText = scoringSectionText;

  const pdfTables = buildScoringTablesFromPdfItems(pdfItems, fullText);
  const aiTables = normalizeScoringTables({ scoringTables: result.scoringTables });
  const clientTables = parseScoringSectionToTables(scoringSectionText);
  const pdfRowCount = countScoringTableRows(pdfTables);
  const clientRowCount = countScoringTableRows(clientTables);
  const aiRowCount = countScoringTableRows(aiTables);

  const clientLooksComplete = clientRowCount >= 5 &&
    clientTables[0]?.rows?.some(r => /^13\.2\.2\.\d+/.test(String(r[0] || '')));

  if (clientLooksComplete || (clientRowCount > pdfRowCount && clientRowCount >= 5)) {
    result.scoringTables = clientTables;
    return;
  }
  if (pdfRowCount > 0) {
    result.scoringTables = pdfTables;
    return;
  }
  if (clientRowCount > aiRowCount && clientTables.length) {
    result.scoringTables = clientTables;
    return;
  }
  if (aiTables.length) {
    result.scoringTables = aiTables;
    return;
  }
  if (clientTables.length) {
    result.scoringTables = clientTables;
    return;
  }

  if (scoringSectionText) {
    result.scoringTables = [{
      title: '',
      headers: [],
      rows: scoringSectionText.split(/\r?\n/).filter(l => l.trim()).map(l => [l.trim()])
    }];
  } else {
    result.scoringTables = [];
  }
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
    const pdfItems = [];
    for(let i=1; i<=pdf.numPages; i++){
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const pageText = tc.items.map(it=>it.str).join(' ');
      fullText += pageText + '\n';
      for (const it of tc.items) {
        const t = it.transform || [];
        pdfItems.push({
          page: i,
          str: it.str,
          x: t[4] || 0,
          y: t[5] || 0,
          width: it.width || 0,
          height: it.height || 0
        });
      }
    }
    // Normalize apostrophe-like characters for consistent downstream matching
    fullText = fullText.replace(/[\u2019\u05F3\u02BC\u2018\u00B4]/g, "'");
    const truncated = smartTruncate(fullText);
    return { fullText, pdfItems, ...truncated };
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
    const { fullText, text, truncated, pdfItems } = await extractFileText(file);
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
    attachScoringTablesFromDocument(result, fullText, pdfItems);
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
    result.guarantees = normalizeGuarantees(result);
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
  result.guarantees = normalizeGuarantees(result);
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
    guarantees:result.guarantees||[],
    scoringTables:result.scoringTables||[],
    scoringSectionText:result.scoringSectionText||'',
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

    const bondsHtml = buildGuaranteesSectionHtml(r);

    /* אזהרות */
    const flagsHtml = (r.flags||[]).length ? `
      <div class="stl" style="color:var(--amb)">⚠ אזהרות</div>
      ${r.flags.map(f=>`<div class="alert aa" style="margin-bottom:5px;font-size:11.5px">⚠️ ${f}</div>`).join('')}` : '';

    body.innerHTML = `${timelineHtml}${contactHtml}${engagementHtml}${highlightsHtml}${bondsHtml}${flagsHtml}`;
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
    body.innerHTML = buildScoringTablesHtml(r);
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
        <button class="btn bo sm no-pdf" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff"
          onclick="printDocument('dynApp',${tenderId},${idx})">
          <svg width="11" height="11"><use href="#ic-print"/></svg> הדפס
        </button>
        <button class="btn bp sm no-pdf" onclick="downloadAppendixPdf(${idx},${tenderId})">
          ⬇ הורד PDF
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

  const dateStr = new Date().toLocaleDateString('he-IL');
  const footerHtml = `
        <div style="margin-top:12px;padding:8px 16px;font-size:12px;color:var(--navy);font-weight:600">תאריך: ${dateStr}</div>
        <div class="wm">מזכיר Tender Intelligence | נוצר ${dateStr} | סודי</div>
      </div>
    </div>`;

  return headerHtml + contentHtml + footerHtml;
}

function downloadAppendixPdf(appIdx, tenderId){
  const container = document.getElementById('aiAppContent') || document.getElementById('tmAppContent');
  if(!container) return;
  const adoc = container.querySelector('.adoc');
  if(!adoc) return;

  const apps = currentAIResult?.appendices || tmDynApps || [];
  const app = apps[appIdx];
  const label = app?.hebrewLabel || (appIdx + 1);
  const tenderName = currentAIResult?.tenderName || '';
  const filename = `נספח_${label}_${tenderName}`.replace(/[\/\\:*?"<>|]/g, '_') + '.pdf';

  // Hide buttons during capture
  const btns = adoc.querySelectorAll('.no-pdf');
  btns.forEach(b => b.style.display = 'none');

  html2pdf().set({
    margin: 10,
    filename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(adoc).save().then(() => {
    btns.forEach(b => b.style.display = '');
  }).catch(() => {
    btns.forEach(b => b.style.display = '');
  });
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

/* ═════════════════════════════════════════════════════════════════════════════
   PDF VIEWER — Click-to-place overlay on original PDF pages
   ═════════════════════════════════════════════════════════════════════════════ */

let _pdfViewerMode = {};       // {appIdx: 'form'|'pdf'}
let _pdfOverlayItems = {};     // {appIdx: [{pageNum, x, y, w, h, type, value, id}]}
let _pdfPlaceMode = null;      // null | {type:'text'|'signature'|'date', value?, label?}
let _pdfDocCache = null;       // cached pdfjsLib document
let _pdfBlobCache = null;      // cached ArrayBuffer for pdf-lib
let _overlayIdCounter = 0;

function _getOverlayItems(appIdx){
  if(!_pdfOverlayItems[appIdx]) _pdfOverlayItems[appIdx] = [];
  return _pdfOverlayItems[appIdx];
}

function _persistOverlayItems(appIdx){
  const apps = currentAIResult?.appendices;
  if(!apps || !apps[appIdx]) return;
  apps[appIdx]._overlayItems = _getOverlayItems(appIdx);
  if(currentAnalysisIdx >= 0) saveAppendices(currentAnalysisIdx, apps);
}

function _restoreOverlayItems(appIdx){
  const apps = currentAIResult?.appendices;
  if(!apps || !apps[appIdx]) return;
  if(Array.isArray(apps[appIdx]._overlayItems)){
    _pdfOverlayItems[appIdx] = apps[appIdx]._overlayItems;
  }
}

function togglePdfViewerMode(appIdx){
  const current = _pdfViewerMode[appIdx] || 'pdf';
  _pdfViewerMode[appIdx] = current === 'form' ? 'pdf' : 'form';
  renderDynAppContent(appIdx);
}

/* ── Render appendix content with form/PDF toggle ── */
const _origRenderDynAppContent = renderDynAppContent;
renderDynAppContent = function(idx){
  const mode = _pdfViewerMode[idx] || 'pdf';
  const ac = document.getElementById('aiAppContent');
  if(!ac) return;
  const apps = currentAIResult?.appendices || [];
  const app = apps[idx];
  if(!app){ ac.innerHTML = ''; return; }

  const hasPages = Array.isArray(app.pages) && app.pages.length > 0;
  const toggleHtml = hasPages ? `
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <button class="btn ${mode==='form'?'bp':'bo'} sm" onclick="togglePdfViewerMode(${idx})">טופס</button>
      <button class="btn ${mode==='pdf'?'bp':'bo'} sm" onclick="togglePdfViewerMode(${idx})">PDF מקור</button>
    </div>` : '';

  if(mode === 'pdf' && hasPages){
    ac.innerHTML = toggleHtml + '<div id="pdfViewerContainer"></div>';
    renderPdfIframeViewer(idx);
    return;
  }

  // Form mode — delegate to original
  _origRenderDynAppContent(idx);
  if(hasPages) ac.insertAdjacentHTML('afterbegin', toggleHtml);
};

/* ══ iframe PDF viewer + signing bar ══ */
let _appendixSignatures = {};  // {appIdx: dataUrl}
let _iframeBlobUrls = {};      // {appIdx: blobUrl} for cleanup

async function renderPdfIframeViewer(appIdx){
  const container = document.getElementById('pdfViewerContainer');
  if(!container) return;
  const apps = currentAIResult?.appendices || [];
  const app = apps[appIdx];
  if(!app || !app.pages || !app.pages.length){
    container.innerHTML = '<div class="alert ab2">לא זוהו עמודי PDF לנספח זה</div>';
    return;
  }

  container.innerHTML = '<div style="text-align:center;padding:20px"><span class="spn"></span> טוען PDF...</div>';

  try {
    const tenderId = currentAnalysisIdx || tmId;
    if(!_pdfBlobCache){
      const blob = await loadPdfBlob(tenderId);
      if(!blob){
        container.innerHTML = '<div class="alert aa">לא נמצא קובץ PDF מקורי. יש להעלות שוב את המכרז.</div>';
        return;
      }
      _pdfBlobCache = await blob.arrayBuffer();
    }

    // Extract only appendix pages into a new PDF
    const { PDFDocument } = PDFLib;
    const srcDoc = await PDFDocument.load(_pdfBlobCache.slice(0));
    const newDoc = await PDFDocument.create();
    const pageIndices = app.pages.map(p => p - 1).filter(i => i >= 0 && i < srcDoc.getPageCount());
    if(!pageIndices.length){
      container.innerHTML = '<div class="alert ab2">עמודי הנספח לא נמצאו ב-PDF</div>';
      return;
    }
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach(p => newDoc.addPage(p));
    const pdfBytes = await newDoc.save();
    const pdfBlob = new Blob([pdfBytes], {type: 'application/pdf'});

    // Revoke old blob URL if any
    if(_iframeBlobUrls[appIdx]) URL.revokeObjectURL(_iframeBlobUrls[appIdx]);
    const blobUrl = URL.createObjectURL(pdfBlob);
    _iframeBlobUrls[appIdx] = blobUrl;

    // Build signature preview if already signed
    const sigData = _appendixSignatures[appIdx];
    const sigPreviewHtml = sigData
      ? `<img class="sig-preview" src="${sigData}" alt="חתימה">
         <span class="sig-name">${BIDDER.signatory || BIDDER.name}</span>`
      : '<span style="font-size:12px;color:var(--s3)">לא נחתם עדיין</span>';

    container.innerHTML = `
      <div class="pdf-iframe-wrap">
        <iframe src="${blobUrl}#toolbar=1&navpanes=0" title="${app.title}"></iframe>
      </div>
      <div class="sign-bar">
        <button class="btn bp sm" onclick="signAppendix(${appIdx})">
          ✍ ${sigData ? 'חתום שוב' : 'חתום'}
        </button>
        <div id="sigPreview_${appIdx}" style="display:flex;align-items:center;gap:8px">
          ${sigPreviewHtml}
        </div>
        <div style="flex:1"></div>
        <button class="btn bo sm" onclick="downloadSignedAppendix(${appIdx})" ${sigData ? '' : 'disabled'} id="dlSignedBtn_${appIdx}">
          ⬇ הורד PDF חתום
        </button>
      </div>`;
  } catch(err){
    console.error('renderPdfIframeViewer error:', err);
    container.innerHTML = '<div class="alert ab2">שגיאה בטעינת PDF: ' + err.message + '</div>';
  }
}

function signAppendix(appIdx){
  // Use existing signature modal infrastructure
  signatureModalState = { appIdx, rowIdx: 0, fieldKey: '__iframe_sig' };
  openSignatureModal(appIdx, 0, '__iframe_sig');
}

async function downloadSignedAppendix(appIdx){
  const sigData = _appendixSignatures[appIdx];
  if(!sigData){ alert('יש לחתום לפני ההורדה'); return; }

  const apps = currentAIResult?.appendices || [];
  const app = apps[appIdx];
  if(!app) return;

  try {
    if(!_pdfBlobCache){
      const blob = await loadPdfBlob(currentAnalysisIdx || tmId);
      if(!blob){ alert('לא נמצא קובץ PDF מקורי'); return; }
      _pdfBlobCache = await blob.arrayBuffer();
    }

    const { PDFDocument, rgb } = PDFLib;
    const srcDoc = await PDFDocument.load(_pdfBlobCache.slice(0));
    const newDoc = await PDFDocument.create();

    // Register fontkit for custom font embedding
    if(typeof fontkit !== 'undefined') newDoc.registerFontkit(fontkit);

    const pageIndices = app.pages.map(p => p - 1).filter(i => i >= 0 && i < srcDoc.getPageCount());
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach(p => newDoc.addPage(p));

    // Stamp signature on last page
    const lastPage = newDoc.getPage(newDoc.getPageCount() - 1);
    const { width, height } = lastPage.getSize();

    // Embed signature image — flatten alpha by drawing on white canvas first
    const tmpCanvas = document.createElement('canvas');
    const tmpCtx = tmpCanvas.getContext('2d');
    const sigImg2 = new Image();
    await new Promise((resolve, reject) => {
      sigImg2.onload = resolve;
      sigImg2.onerror = reject;
      sigImg2.src = sigData;
    });
    tmpCanvas.width = sigImg2.naturalWidth;
    tmpCanvas.height = sigImg2.naturalHeight;
    tmpCtx.fillStyle = '#fff';
    tmpCtx.fillRect(0, 0, tmpCanvas.width, tmpCanvas.height);
    tmpCtx.drawImage(sigImg2, 0, 0);
    const flatDataUrl = tmpCanvas.toDataURL('image/png');
    const flatB64 = flatDataUrl.split(',')[1];
    const flatBytes = Uint8Array.from(atob(flatB64), c => c.charCodeAt(0));
    const sigImg = await newDoc.embedPng(flatBytes);

    const sigW = 150;
    const sigH = sigW * (sigImg.height / sigImg.width);
    lastPage.drawImage(sigImg, {
      x: width - sigW - 50,
      y: 60,
      width: sigW,
      height: sigH
    });

    // Embed font for name/date text — try Hebrew, fall back to Helvetica
    let font;
    try {
      const fontBytes = await _loadHebrewFont();
      if(fontBytes && typeof fontkit !== 'undefined'){
        font = await newDoc.embedFont(fontBytes);
      } else {
        font = await newDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      }
    } catch(e){
      console.warn('Custom font failed, using Helvetica:', e.message);
      font = await newDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    }

    // Add signatory name below signature
    const name = BIDDER.signatory || BIDDER.name || '';
    if(name){
      // Try to draw; Helvetica won't render Hebrew but will work for Latin
      try {
        lastPage.drawText(name, {
          x: width - sigW - 50,
          y: 45,
          size: 10,
          font,
          color: rgb(0.1, 0.1, 0.1)
        });
      } catch(e){ /* skip if font can't encode the characters */ }
    }

    // Add date (digits always work with any font)
    const dateStr = new Date().toLocaleDateString('he-IL');
    try {
      lastPage.drawText(dateStr, {
        x: width - sigW - 50,
        y: 32,
        size: 9,
        font,
        color: rgb(0.3, 0.3, 0.3)
      });
    } catch(e){ /* skip */ }

    // Save and download
    const pdfBytes = await newDoc.save();
    const blob = new Blob([pdfBytes], {type: 'application/pdf'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const label = app.title || ('נספח_' + (appIdx + 1));
    const tenderName = currentAIResult?.tenderName || '';
    a.href = url;
    a.download = `${label}_חתום_${tenderName}`.replace(/[\/\\:*?"<>|]/g, '_') + '.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch(err){
    console.error('downloadSignedAppendix error:', err);
    alert('שגיאה ביצוא PDF: ' + err.message);
  }
}

/* ── Render PDF pages with overlay (legacy) ── */
async function renderPdfViewerForApp(appIdx){
  const container = document.getElementById('pdfViewerContainer');
  if(!container) return;
  const apps = currentAIResult?.appendices || [];
  const app = apps[appIdx];
  if(!app || !app.pages || !app.pages.length){
    container.innerHTML = '<div class="alert ab2">לא זוהו עמודי PDF לנספח זה</div>';
    return;
  }

  container.innerHTML = '<div style="text-align:center;padding:20px"><span class="spn"></span> טוען עמודי PDF...</div>';

  try {
    // Load PDF
    const tenderId = currentAnalysisIdx;
    if(!_pdfDocCache){
      const blob = await loadPdfBlob(tenderId);
      if(!blob){
        container.innerHTML = '<div class="alert aa">לא נמצא קובץ PDF מקורי. יש להעלות שוב את המכרז.</div>';
        return;
      }
      _pdfBlobCache = await blob.arrayBuffer();
      _pdfDocCache = await pdfjsLib.getDocument({data: _pdfBlobCache.slice(0)}).promise;
    }

    // Build quick-fill chips + pages
    const chipsHtml = _buildQuickFillChips(appIdx);
    container.innerHTML = chipsHtml + '<div id="pdfPagesWrap"></div>';
    const pagesWrap = document.getElementById('pdfPagesWrap');

    const containerWidth = container.clientWidth || 700;

    for(const pageNum of app.pages){
      if(pageNum < 1 || pageNum > _pdfDocCache.numPages) continue;
      const page = await _pdfDocCache.getPage(pageNum);
      const viewport = page.getViewport({scale: 1});
      const scale = (containerWidth - 20) / viewport.width;
      const scaledVP = page.getViewport({scale});

      // Page wrapper
      const pageDiv = document.createElement('div');
      pageDiv.className = 'pdf-page-wrap';
      pageDiv.style.cssText = `position:relative;margin-bottom:12px;border:1px solid var(--s5);border-radius:6px;overflow:hidden;background:#fff;`;
      pageDiv.dataset.pageNum = pageNum;
      pageDiv.dataset.scale = scale;
      pageDiv.dataset.pdfWidth = viewport.width;
      pageDiv.dataset.pdfHeight = viewport.height;

      // Canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      canvas.width = scaledVP.width * dpr;
      canvas.height = scaledVP.height * dpr;
      canvas.style.width = scaledVP.width + 'px';
      canvas.style.height = scaledVP.height + 'px';
      ctx.scale(dpr, dpr);
      pageDiv.appendChild(canvas);

      // Overlay
      const overlay = document.createElement('div');
      overlay.className = 'pdf-overlay';
      overlay.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;cursor:crosshair;`;
      overlay.dataset.pageNum = pageNum;
      overlay.addEventListener('click', (e) => _handleOverlayClick(e, appIdx, pageNum, scale, viewport.height));
      pageDiv.appendChild(overlay);

      pagesWrap.appendChild(pageDiv);

      // Render
      await page.render({canvasContext: ctx, viewport: scaledVP}).promise;

      // Restore existing overlay items
      _renderOverlayItemsOnPage(appIdx, pageNum, overlay, scale, viewport.height);
    }
  } catch(err){
    console.error('PDF viewer error:', err);
    container.innerHTML = `<div class="alert aa">שגיאה בטעינת PDF: ${err.message}</div>`;
  }
}

/* ── Quick-fill chips ── */
function _buildQuickFillChips(appIdx){
  const chips = [
    {label: 'שם החברה', value: BIDDER.name, type: 'text'},
    {label: 'ח.פ.', value: BIDDER.id, type: 'text'},
    {label: 'כתובת', value: BIDDER.address, type: 'text'},
    {label: 'טלפון', value: BIDDER.phone, type: 'text'},
    {label: 'דוא"ל', value: BIDDER.email, type: 'text'},
    {label: 'תאריך', value: new Date().toLocaleDateString('he-IL'), type: 'date'},
    {label: 'חתימה', value: '', type: 'signature'},
    {label: 'טקסט חופשי', value: '', type: 'text'},
  ].filter(c => c.type === 'signature' || c.type === 'date' || c.type === 'text');

  return `
    <div style="margin-bottom:10px;padding:8px 12px;background:var(--bg2);border-radius:8px;border:1px solid var(--s5)">
      <div style="font-size:11px;color:var(--s3);margin-bottom:6px;font-weight:600">לחץ על שדה ואז לחץ על המיקום ב-PDF:</div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${chips.map(c => `
          <button class="btn bo sm pdf-chip" style="font-size:11px;padding:3px 8px"
            onclick="setPdfPlaceMode('${c.type}',${JSON.stringify(c.value)},${JSON.stringify(c.label)})"
            data-chip-type="${c.type}">
            ${c.type==='signature'?'✍ ':''}${c.label}${c.value && c.type!=='signature' ? ': '+c.value : ''}
          </button>
        `).join('')}
      </div>
      <div id="pdfPlaceModeIndicator" style="display:none;margin-top:6px;font-size:11px;color:var(--pri);font-weight:600"></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <button class="btn bp sm" onclick="exportSignedPdf(${appIdx})">⬇ הורד PDF חתום</button>
      <button class="btn bo sm" onclick="clearAllOverlayItems(${appIdx})">נקה הכל</button>
    </div>`;
}

function setPdfPlaceMode(type, value, label){
  if(type === 'signature'){
    // Open signature modal first, then enter place mode
    const sigVal = currentAIResult?.appendices?.[currentDynAppIdx]?.rows?.[0]?.__signature || '';
    if(isSignatureDataUrl(sigVal)){
      _pdfPlaceMode = {type:'signature', value: sigVal, label};
    } else {
      _pdfPlaceMode = {type:'signature', value: '', label, needsCapture: true};
      openSignatureModal(currentDynAppIdx, 0, '__pdf_sig');
      return;
    }
  } else if(type === 'text' && !value){
    _pdfPlaceMode = {type:'text', value: '', label, freeText: true};
  } else {
    _pdfPlaceMode = {type, value: value || '', label};
  }

  // Highlight active chip
  document.querySelectorAll('.pdf-chip').forEach(b => b.classList.remove('active-chip'));
  const indicator = document.getElementById('pdfPlaceModeIndicator');
  if(indicator){
    indicator.style.display = 'block';
    indicator.textContent = `📍 לחץ על ה-PDF למיקום: ${label}`;
  }
}

function _handleOverlayClick(e, appIdx, pageNum, scale, pdfHeight){
  if(!_pdfPlaceMode) return;

  const overlay = e.currentTarget;
  const rect = overlay.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // Convert to PDF coordinates (origin bottom-left)
  const pdfX = clickX / scale;
  const pdfY = pdfHeight - (clickY / scale);

  if(_pdfPlaceMode.type === 'text' && _pdfPlaceMode.freeText){
    // Create inline input for free text
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'fi pdf-inline-input';
    input.style.cssText = `position:absolute;top:${clickY-12}px;right:${rect.width-clickX-100}px;width:140px;font-size:12px;padding:2px 4px;z-index:10;direction:rtl;`;
    input.placeholder = 'הקלד כאן...';
    overlay.appendChild(input);
    input.focus();
    input.addEventListener('blur', () => {
      const val = input.value.trim();
      if(val){
        const item = {id: ++_overlayIdCounter, pageNum, x: pdfX, y: pdfY, canvasX: clickX, canvasY: clickY, type:'text', value: val, label: 'טקסט'};
        _getOverlayItems(appIdx).push(item);
        _persistOverlayItems(appIdx);
        _addOverlayElement(overlay, item, appIdx, scale, pdfHeight);
      }
      input.remove();
    });
    input.addEventListener('keydown', (ev) => { if(ev.key==='Enter') input.blur(); });
    return;
  }

  if(_pdfPlaceMode.type === 'signature' && _pdfPlaceMode.needsCapture){
    // Signature not yet captured — wait for modal
    return;
  }

  const item = {
    id: ++_overlayIdCounter,
    pageNum,
    x: pdfX,
    y: pdfY,
    canvasX: clickX,
    canvasY: clickY,
    type: _pdfPlaceMode.type,
    value: _pdfPlaceMode.value,
    label: _pdfPlaceMode.label,
    w: _pdfPlaceMode.type === 'signature' ? 120 : undefined,
    h: _pdfPlaceMode.type === 'signature' ? 40 : undefined
  };

  _getOverlayItems(appIdx).push(item);
  _persistOverlayItems(appIdx);
  _addOverlayElement(overlay, item, appIdx, scale, pdfHeight);

  // Exit place mode
  _pdfPlaceMode = null;
  document.querySelectorAll('.pdf-chip').forEach(b => b.classList.remove('active-chip'));
  const indicator = document.getElementById('pdfPlaceModeIndicator');
  if(indicator) indicator.style.display = 'none';
}

function _addOverlayElement(overlay, item, appIdx, scale, pdfHeight){
  const el = document.createElement('div');
  el.className = 'pdf-stamp';
  el.dataset.itemId = item.id;

  if(item.type === 'signature'){
    el.style.cssText = `position:absolute;top:${item.canvasY-20}px;left:${overlay.clientWidth - item.canvasX - 60}px;cursor:move;z-index:5;`;
    el.innerHTML = `<img src="${item.value}" style="width:120px;height:40px;object-fit:contain;opacity:.85">
      <span class="pdf-stamp-del" onclick="removeOverlayItem(${appIdx},${item.id})">&times;</span>`;
  } else {
    const fontSize = item.type === 'date' ? '12px' : '13px';
    el.style.cssText = `position:absolute;top:${item.canvasY-10}px;left:${overlay.clientWidth - item.canvasX - 60}px;
      font-size:${fontSize};color:#1a1a1a;font-weight:600;cursor:move;z-index:5;direction:rtl;white-space:nowrap;
      background:rgba(255,255,200,.5);padding:1px 4px;border-radius:3px;`;
    el.innerHTML = `${item.value}<span class="pdf-stamp-del" onclick="removeOverlayItem(${appIdx},${item.id})">&times;</span>`;
  }

  // Drag support
  let dragging = false, startX, startY;
  el.addEventListener('mousedown', (e) => {
    if(e.target.classList.contains('pdf-stamp-del')) return;
    dragging = true;
    startX = e.clientX - el.offsetLeft;
    startY = e.clientY - el.offsetTop;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if(!dragging) return;
    el.style.left = (e.clientX - startX) + 'px';
    el.style.top = (e.clientY - startY) + 'px';
  });
  document.addEventListener('mouseup', () => {
    if(!dragging) return;
    dragging = false;
    // Update stored coordinates
    const rect = overlay.getBoundingClientRect();
    item.canvasX = overlay.clientWidth - el.offsetLeft - 60;
    item.canvasY = el.offsetTop + 10;
    item.x = item.canvasX / scale;
    item.y = pdfHeight - (item.canvasY / scale);
    _persistOverlayItems(appIdx);
  });

  overlay.appendChild(el);
}

function _renderOverlayItemsOnPage(appIdx, pageNum, overlay, scale, pdfHeight){
  const items = _getOverlayItems(appIdx).filter(it => it.pageNum === pageNum);
  items.forEach(item => _addOverlayElement(overlay, item, appIdx, scale, pdfHeight));
}

function removeOverlayItem(appIdx, itemId){
  const items = _getOverlayItems(appIdx);
  const idx = items.findIndex(it => it.id === itemId);
  if(idx >= 0) items.splice(idx, 1);
  _persistOverlayItems(appIdx);
  // Remove DOM element
  const el = document.querySelector(`.pdf-stamp[data-item-id="${itemId}"]`);
  if(el) el.remove();
}

function clearAllOverlayItems(appIdx){
  _pdfOverlayItems[appIdx] = [];
  _persistOverlayItems(appIdx);
  document.querySelectorAll('.pdf-stamp').forEach(el => el.remove());
}

/* ── Hook into signature save for PDF place mode + iframe signing ── */
const _origSaveSignature = saveSignatureFromModal;
saveSignatureFromModal = function(){
  _origSaveSignature();

  // iframe signing flow — capture signature for appendix
  if(signatureModalState.fieldKey === '__iframe_sig'){
    const canvas = document.getElementById('signatureCanvas');
    if(canvas && signaturePadState.hasInk){
      const appIdx = signatureModalState.appIdx;
      _appendixSignatures[appIdx] = canvas.toDataURL('image/png');
      // Update the signing bar preview
      const preview = document.getElementById('sigPreview_' + appIdx);
      if(preview){
        preview.innerHTML = `<img class="sig-preview" src="${_appendixSignatures[appIdx]}" alt="חתימה">
          <span class="sig-name">${BIDDER.signatory || BIDDER.name}</span>`;
      }
      // Enable download button
      const dlBtn = document.getElementById('dlSignedBtn_' + appIdx);
      if(dlBtn) dlBtn.disabled = false;
    }
    return;
  }

  // Legacy: PDF overlay place mode
  if(_pdfPlaceMode && _pdfPlaceMode.type === 'signature' && _pdfPlaceMode.needsCapture){
    const canvas = document.getElementById('signatureCanvas');
    if(canvas && signaturePadState.hasInk){
      _pdfPlaceMode.value = canvas.toDataURL('image/png');
      _pdfPlaceMode.needsCapture = false;
      const indicator = document.getElementById('pdfPlaceModeIndicator');
      if(indicator){
        indicator.style.display = 'block';
        indicator.textContent = '📍 לחץ על ה-PDF למיקום החתימה';
      }
    }
  }
};

/* ═════════════════════════════════════════════════════════════════════════════
   PDF EXPORT — Stamp text/signatures onto original PDF with pdf-lib
   ═════════════════════════════════════════════════════════════════════════════ */

let _hebrewFontBytes = null;

async function _loadHebrewFont(){
  if(_hebrewFontBytes) return _hebrewFontBytes;
  try {
    const resp = await fetch('https://fonts.gstatic.com/s/heebo/v26/NGS6v5_NC0k9P9H0TbFhsqMA.ttf');
    if(resp.ok){
      _hebrewFontBytes = await resp.arrayBuffer();
      return _hebrewFontBytes;
    }
  } catch(e){}
  console.warn('Hebrew font not available, falling back to Helvetica');
  return null;
}

async function exportSignedPdf(appIdx){
  const items = _getOverlayItems(appIdx);
  if(!items.length){
    alert('לא נוספו שדות על ה-PDF. לחץ על שדה ואז על המיקום ב-PDF.');
    return;
  }

  const apps = currentAIResult?.appendices || [];
  const app = apps[appIdx];
  if(!app) return;

  try {
    // Load original PDF
    if(!_pdfBlobCache){
      const blob = await loadPdfBlob(currentAnalysisIdx);
      if(!blob){ alert('לא נמצא קובץ PDF מקורי'); return; }
      _pdfBlobCache = await blob.arrayBuffer();
    }

    const { PDFDocument, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.load(_pdfBlobCache.slice(0));
    if(typeof fontkit !== 'undefined') pdfDoc.registerFontkit(fontkit);

    // Embed font — try Hebrew, fall back to Helvetica
    let font;
    try {
      const fontBytes = await _loadHebrewFont();
      if(fontBytes && typeof fontkit !== 'undefined'){
        font = await pdfDoc.embedFont(fontBytes);
      } else {
        font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
      }
    } catch(e){
      console.warn('Custom font failed, using Helvetica:', e.message);
      font = await pdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    }

    // Stamp each item
    for(const item of items){
      const pageIdx = item.pageNum - 1;
      if(pageIdx < 0 || pageIdx >= pdfDoc.getPageCount()) continue;
      const page = pdfDoc.getPage(pageIdx);

      if(item.type === 'signature' && isSignatureDataUrl(item.value)){
        const imgData = item.value.split(',')[1];
        const imgBytes = Uint8Array.from(atob(imgData), c => c.charCodeAt(0));
        const img = await pdfDoc.embedPng(imgBytes);
        const w = item.w || 120;
        const h = item.h || 40;
        // Scale signature to PDF points
        const pageWrap = document.querySelector(`.pdf-page-wrap[data-page-num="${item.pageNum}"]`);
        const scale = pageWrap ? parseFloat(pageWrap.dataset.scale) : 1;
        page.drawImage(img, {
          x: item.x - (w / scale / 2),
          y: item.y - (h / scale / 2),
          width: w / scale,
          height: h / scale
        });
      } else {
        // Text or date
        const size = item.type === 'date' ? 11 : 12;
        // Reverse Hebrew text for PDF (pdf-lib doesn't handle RTL)
        const text = item.value.split('').reverse().join('');
        page.drawText(text, {
          x: item.x,
          y: item.y,
          size,
          font,
          color: rgb(0.05, 0.05, 0.05)
        });
      }
    }

    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], {type: 'application/pdf'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const label = app.hebrewLabel || (appIdx + 1);
    const tenderName = currentAIResult?.tenderName || '';
    a.href = url;
    a.download = `נספח_${label}_${tenderName}`.replace(/[\/\\:*?"<>|]/g, '_') + '.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch(err){
    console.error('Export PDF error:', err);
    alert('שגיאה ביצוא PDF: ' + err.message);
  }
}
