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

/* ── Shared Gemini call helper ── */
async function callGemini(apiKey, prompt, maxTokens) {
  const t0 = Date.now();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 }
        }
      })
    }
  );
  const ms = Date.now() - t0;
  console.log('Gemini fetch:', ms, 'ms, status:', response.status);
  return response;
}

function parseGeminiJson(response, data) {
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;
  try {
    return JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  }
}

function geminiErrorResponse(headers, response, errText) {
  let msg = 'AI API error: ' + response.status;
  if (response.status === 429) msg = 'חריגת מכסה — נסה שוב בעוד דקה';
  else if (response.status === 503) msg = 'השרת עמוס — נסה שוב בעוד רגע';
  return {
    statusCode: response.status === 429 ? 429 : response.status === 503 ? 503 : 502,
    headers,
    body: JSON.stringify({ error: msg })
  };
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

  /* ═══════════════════════════════════════════════
     MODE: fields — extract fields for ONE appendix
     ═══════════════════════════════════════════════ */
  if (body.mode === 'fields') {
    const { title, hebrewLabel, type, description, isTable, filteredText, companyData } = body;
    if (!filteredText || !title) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing title or filteredText' }) };
    }

    const companyJson = companyData ? JSON.stringify(companyData) : '{}';

    const prompt = `אתה מומחה מכרזים. להלן קטעים ממסמך מכרז שמכילים נספחים.

משימתך: חלץ את **שדות הטופס** עבור הנספח הבא בלבד:
- כותרת: ${title}
- סימון: נספח ${hebrewLabel || ''}
- סוג: ${type}
- תיאור: ${description || ''}
- טבלה: ${isTable ? 'כן' : 'לא'}

נתוני המציע:
${companyJson}

קטעי המכרז:
${filteredText}

החזר JSON בלבד:
{"fields":[{"key":"field_id","label":"תווית בעברית","type":"text","required":true}],"rows":[{"field_id":"ערך ממולא"}],"isTable":${isTable ? 'true' : 'false'}}

הנחיות:
- חלץ רק שדות שמופיעים או משתמעים מהנספח הזה במסמך.
- type: text|number|date|boolean|textarea|signature
- מלא rows אוטומטית מנתוני המציע (שם, כתובת, ח.פ וכו'). השאר "" לשדות לא ידועים.
- אם הנספח הוא טבלה — החזר isTable:true ושורת דוגמה אחת ב-rows.
- מקסימום 8 שדות. ענה בקצרה. JSON בלבד.`;

    console.log('Fields mode for:', title, '| prompt:', prompt.length, 'chars');

    try {
      const response = await callGemini(apiKey, prompt, 2048);

      if (!response.ok) {
        const errText = await response.text();
        console.error('Gemini error:', response.status, errText.slice(0, 200));
        return geminiErrorResponse(headers, response, errText);
      }

      const data = await response.json();
      const result = parseGeminiJson(response, data);
      if (!result) {
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Invalid AI response' }) };
      }

      const fields = Array.isArray(result.fields) ? result.fields : [];
      const rows = Array.isArray(result.rows) ? result.rows : [];
      const resultIsTable = typeof result.isTable === 'boolean' ? result.isTable : isTable;

      console.log('Fields extracted:', fields.length, 'for', title);
      return { statusCode: 200, headers, body: JSON.stringify({ fields, rows, isTable: resultIsTable }) };

    } catch (err) {
      console.error('Fields error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
    }
  }

  /* ═══════════════════════════════════════════════
     MODE: identify (default) — find all appendices
     ═══════════════════════════════════════════════ */
  const { text, fileName } = body;
  if (!text || text.length < 20) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text too short or missing' }) };
  }

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

  console.log('Identify mode:', titleCount, 'title pages,', refCount, 'ref pages, filtered:', filteredText.length, 'chars');

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

  console.log('Prompt length:', prompt.length, 'chars');

  try {
    const response = await callGemini(apiKey, prompt, 4096);

    if (!response.ok) {
      const errText = await response.text();
      console.error('Gemini error:', response.status, errText.slice(0, 200));
      return geminiErrorResponse(headers, response, errText);
    }

    const data = await response.json();
    const result = parseGeminiJson(response, data);
    if (!result) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Invalid AI response' }) };
    }

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
    // Return filteredText so client can use it for per-appendix field calls
    return { statusCode: 200, headers, body: JSON.stringify({ appendices, filteredText }) };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};
