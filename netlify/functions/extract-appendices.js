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

  const { text, fileName, companyData } = body;
  if (!text || text.length < 20) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text too short or missing' }) };
  }

  // Pre-filter: find lines where an appendix STARTS (title line) and grab context
  const lines = text.split('\n');
  const CONTEXT_AFTER = 40; // lines after the title to capture form fields
  const MAX_FILTERED = 15000; // cap total filtered text to avoid timeout

  // Step 1: Find lines that look like appendix TITLES (not just mentions)
  // Title pattern: line starts with or prominently contains "נספח" + label (א', ב', 1, 2, etc.)
  const titlePattern = /נספח\s*[א-ת]'|נספח\s*\d|נספח\s*ב'\s*\(/;
  const titleLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (titlePattern.test(lines[i])) {
      titleLines.push(i);
    }
  }

  // Step 2: Merge overlapping ranges into non-overlapping sections
  const ranges = [];
  for (const lineNum of titleLines) {
    const start = Math.max(0, lineNum - 2);
    const end = Math.min(lines.length, lineNum + CONTEXT_AFTER);
    if (ranges.length > 0 && start <= ranges[ranges.length - 1].end) {
      // Merge with previous range
      ranges[ranges.length - 1].end = Math.max(ranges[ranges.length - 1].end, end);
    } else {
      ranges.push({ start, end, titleLine: lineNum });
    }
  }

  // Step 3: Build filtered text from merged ranges, respecting size cap
  let filteredText = '';
  for (let idx = 0; idx < ranges.length; idx++) {
    const r = ranges[idx];
    const section = `--- אזור ${idx + 1} (שורה ${r.titleLine}) ---\n` +
      lines.slice(r.start, r.end).join('\n');
    if (filteredText.length + section.length > MAX_FILTERED) break;
    filteredText += (filteredText ? '\n\n' : '') + section;
  }

  // Fallback: if no title-pattern matches, try broader "נספח" search
  if (!filteredText) {
    const broadMatches = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('נספח')) {
        broadMatches.push(i);
      }
    }
    // Take last few matches (appendices are typically at the end)
    const lastFew = broadMatches.slice(-3);
    for (const lineNum of lastFew) {
      const start = Math.max(0, lineNum - 2);
      const end = Math.min(lines.length, lineNum + CONTEXT_AFTER);
      const section = lines.slice(start, end).join('\n');
      if (filteredText.length + section.length > MAX_FILTERED) break;
      filteredText += (filteredText ? '\n\n' : '') + section;
    }
  }

  // Final fallback: last 10K chars of document
  if (!filteredText) {
    filteredText = text.slice(-10000);
  }

  console.log('Appendix filter: found', titleLines.length, 'title lines, merged into', ranges.length, 'ranges, filtered text:', filteredText.length, 'chars (from', text.length, 'total)');

  const companyJson = companyData ? JSON.stringify(companyData, null, 2) : '{}';

  const prompt = `אתה מומחה מכרזים ציבוריים בישראל.

להלן קטעים מתוך מסמך מכרז שמכילים את המילה "נספח". משימתך: זהה אילו מהם הם **נספחים שהמציע נדרש למלא ולהגיש**.

## מה זה נספח (ומה זה לא):
- **כן נספח** = טופס/מסמך נפרד עם כותרת שמתחילה ב"נספח" (למשל: "נספח א'", "נספח ב' (1) להסכם", "נספח 3"). הנספח מכיל שדות/טבלאות שהמציע צריך למלא, לחתום ולהגיש.
- **לא נספח** = כל דבר אחר: סעיפים בגוף ההסכם שמזכירים את המילה "נספח" (למשל "המציע יחתום על נספח ב'"), תוכן עניינים, הפניות לנספח, כותרות של סעיפי חוזה רגילים.

## חוק ברזל:
- החזר **רק** טפסים/מסמכים שכותרתם מתחילה ב"נספח" ושמכילים שדות למילוי.
- **אל תמציא נספחים.** אם יש אחד — החזר אחד. אם אין — מערך ריק.

שם הקובץ: ${fileName || 'unknown'}

קטעים רלוונטיים מהמכרז:
${filteredText}

נתוני המציע (לצורך מילוי אוטומטי):
${companyJson}

עבור כל נספח שזוהה, החזר JSON:
{
  "appendices": [
    {
      "id": "app_0",
      "type": "experience|team|declarations|financial|methodology|pricing|references|confidentiality|conflict|insurance|custom",
      "title": "כותרת הנספח בדיוק כפי שמופיעה במכרז",
      "hebrewLabel": "א'",
      "description": "תיאור קצר של מה הנספח דורש",
      "fields": [
        {
          "key": "field_name",
          "label": "תווית השדה בעברית",
          "type": "text|number|date|boolean|textarea|signature",
          "required": true
        }
      ],
      "rows": [
        {
          "field_name": "ערך ממולא אוטומטית מנתוני המציע"
        }
      ],
      "isTable": false,
      "autoFillNotes": "הסבר קצר איך מולאו הנתונים"
    }
  ]
}

הנחיות:
- הכותרת (title) חייבת להיות בדיוק כפי שמופיעה במכרז.
- אם נספח הוא טבלה למילוי שורות, הגדר isTable=true. אם טופס/הצהרה — isTable=false.
- מלא אוטומטית שדות מנתוני המציע (שמות, כתובת, ח.פ וכו'). השאר ריק ("") שדות שאינך יכול למלא.
- תאריכים בפורמט DD/MM/YYYY.
- מספר id ברצף: app_0, app_1...
- hebrewLabel לפי מה שכתוב במכרז.
- אם אין אף נספח: {"appendices": []}
- החזר JSON תקין בלבד.`;

  const model = 'gemini-2.5-flash';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 16384,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

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

    // Sanitize appendices
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
      if (typeof app.isTable !== 'boolean') app.isTable = app.rows.length > 1;
    });

    console.log('Extracted', appendices.length, 'appendices');
    return { statusCode: 200, headers, body: JSON.stringify({ appendices }) };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};
