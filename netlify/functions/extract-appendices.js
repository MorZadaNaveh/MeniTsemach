const fs = require('fs');
const path = require('path');

function loadEnvKey() {
  const tryPaths = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../../.env'),
  ];
  for (const envPath of tryPaths) {
    try {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const m = line.match(/^GEMINI_API_KEY=(.+)/);
        if (m) return m[1].trim();
      }
    } catch {}
  }
  return null;
}

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = loadEnvKey() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }) };
  }

  let body;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf-8')
      : event.body;
    body = JSON.parse(raw);
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON: ' + e.message }) };
  }

  const { text, fileName } = body;
  if (!text || text.length < 20) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text too short or missing' }) };
  }

  // Filter by "נספח" keyword. Two tiers:
  //   Title pages: "נספח" appears in the first 200 chars → full page text
  //   Reference pages: "נספח" appears later → short excerpt only
  const APOSTROPHE_RE = /[\u2019\u05F3\u02BC\u2018\u0060\u00B4]/g;
  const normalizedText = text.replace(APOSTROPHE_RE, "'");
  const lines = normalizedText.split('\n');
  const MAX_FILTERED = 120000;
  const TITLE_ZONE = 200;
  const MAX_PAGE_CHARS = 800;

  function findNispach(str) {
    let pos = str.indexOf('נספח');
    if (pos >= 0) return pos;
    pos = str.indexOf('נ ספח');
    return pos;
  }

  let filteredText = '';
  let titleCount = 0;
  let refCount = 0;
  let refSummary = '';

  for (let i = 0; i < lines.length; i++) {
    const pos = findNispach(lines[i]);
    if (pos < 0) continue;

    if (pos < TITLE_ZONE) {
      titleCount++;
      const pageText = lines[i].length > MAX_PAGE_CHARS ? lines[i].substring(0, MAX_PAGE_CHARS) + '...' : lines[i];
      const section = `--- עמוד ${i + 1} ---\n${pageText}\n`;
      if (filteredText.length + section.length > MAX_FILTERED) break;
      filteredText += (filteredText ? '\n' : '') + section;
    } else {
      refCount++;
      const excerpt = lines[i].substring(Math.max(0, pos - 60), pos + 100).trim();
      refSummary += `[עמוד ${i + 1}] ...${excerpt}...\n`;
    }
  }

  if (refSummary) {
    filteredText = `=== הפניות ===\n${refSummary}=== סוף ===\n\n${filteredText}`;
  }

  if (!filteredText) {
    filteredText = normalizedText.slice(-15000);
  }

  console.log('Appendix filter:', titleCount, 'title pages,', refCount, 'reference pages, filtered text:', filteredText.length, 'chars (from', text.length, 'total,', lines.length, 'lines)');

  // Identification-only prompt — no fields, minimal output per appendix
  const prompt = `זהה את כל הנספחים שהמציע נדרש להגיש במכרז הבא.

נספח = טופס/הצהרה/תצהיר/רשימה שהמציע צריך למלא ולהגיש.
לא נספח = הפניה בגוף ההסכם, תוכן עניינים, כותרת חלק בהסכם.

שם הקובץ: ${fileName || 'unknown'}

${filteredText}

החזר JSON בלבד:
{"appendices":[{"id":"app_0","type":"declarations","title":"שם מדויק","hebrewLabel":"א'1","description":"תיאור קצר","isTable":false}]}

type: experience|team|declarations|financial|methodology|pricing|references|confidentiality|conflict|insurance|custom
isTable: true רק לטבלאות עם שורות חוזרות.
אל תמציא נספחים. החזר רק מה שמופיע במסמך.`;

  const model = 'gemini-2.5-flash';
  console.log('Prompt length:', prompt.length, 'chars');

  try {
    const t0 = Date.now();
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    const fetchMs = Date.now() - t0;
    console.log('Gemini fetch completed in', fetchMs, 'ms, status:', response.status);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini error:', response.status, errText.slice(0, 200));
      let msg = 'AI API error: ' + response.status;
      if (response.status === 429) msg = 'חריגת מכסה — נסה שוב בעוד דקה';
      else if (response.status === 503) msg = 'השרת עמוס — נסה שוב בעוד רגע';
      return {
        statusCode: response.status === 429 ? 429 : response.status === 503 ? 503 : 502,
        headers,
        body: JSON.stringify({ error: msg })
      };
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Empty AI response' }) };
    }

    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) {
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Invalid JSON from AI' }) };
      }
      result = JSON.parse(match[0]);
    }

    // Sanitize appendices — fields will be generated client-side
    const appendices = Array.isArray(result.appendices) ? result.appendices : [];
    appendices.forEach((app, i) => {
      if (!app.id) app.id = 'app_' + i;
      if (!app.type) app.type = 'custom';
      if (!app.title) app.title = 'נספח ' + (i + 1);
      if (!app.hebrewLabel) {
        const labels = ["א'","ב'","ג'","ד'","ה'","ו'","ז'","ח'","ט'","י'"];
        app.hebrewLabel = labels[i] || (i + 1) + '';
      }
      if (!Array.isArray(app.fields)) app.fields = [];
      if (!Array.isArray(app.rows)) app.rows = [];
      if (typeof app.isTable !== 'boolean') app.isTable = false;
    });

    console.log('Extracted', appendices.length, 'appendices');
    return { statusCode: 200, headers, body: JSON.stringify({ appendices }) };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};
