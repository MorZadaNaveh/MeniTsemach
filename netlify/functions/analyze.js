const fs = require('fs');
const path = require('path');

// Load .env manually (netlify dev may override with its own token)
function loadEnvKey() {
  const tryPaths = [
    path.resolve(__dirname, '../../.env'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '../../../.env'),
  ];
  for (const envPath of tryPaths) {
    try {
      console.log('Trying .env at:', envPath, 'exists:', fs.existsSync(envPath));
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const m = line.match(/^GEMINI_API_KEY=(.+)/);
        if (m) { console.log('Found key in:', envPath); return m[1].trim(); }
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
  console.log('API key loaded:', apiKey ? apiKey.slice(0,10) + '...' + apiKey.slice(-4) + ' (' + apiKey.length + ' chars)' : 'MISSING');
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

  const { text, fileName, truncated } = body;
  if (!text || text.length < 20) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text too short or missing (' + (text ? text.length : 0) + ' chars)' }) };
  }

  const prompt = `אתה מומחה מספר 1 בישראל בניתוח מכרזים ציבוריים. נתח את המכרז הבא בקפידה רבה וחלץ את כל המידע.

שם הקובץ: ${fileName || 'unknown'}
${truncated ? '(הטקסט קוצר — נתח את מה שיש)' : ''}

תוכן המכרז:
${text}

חלץ ותחזיר אובייקט JSON בעברית עם כל השדות הבאים. אם שדה לא מצוין במכרז, השתמש ב-null.

{
  "tenderName": "שם המכרז המלא",
  "orgName": "שם הגוף המזמין",
  "tenderNumber": "מספר המכרז",
  "type": "סוג המכרז (ביקורת פנימית / ביקורת שכר / ייעוץ / תקשורת וכו')",
  "submitDeadline": "תאריך ושעת הגשה בפורמט DD.MM.YYYY | HH:MM",
  "daysLeft": 0,
  "value": "היקף כספי / אומדן",
  "duration": "תקופת התקשרות",
  "winners": "מספר זוכים",
  "tenderBond": "ערבות מכרז (סכום ותוקף)",
  "performanceBond": "ערבות ביצוע",
  "liabilityBond": "ערבות אחריות",
  "insurance": "דרישות ביטוח",
  "scope": "תיאור מפורט של היקף העבודה",
  "hoursScope": "היקף בשעות אם צוין",
  "timeline": [
    {"label": "שם האירוע", "date": "DD.MM.YYYY"}
  ],
  "contact": {"name": "שם", "email": "מייל", "phone": "טלפון", "method": "אופן שליחת שאלות"},
  "thresholds": ["תנאי סף 1", "תנאי סף 2"],
  "qualityScoring": [
    {"l": "שם הקריטריון", "w": 0, "m": 0}
  ],
  "priceScoring": [
    {"l": "שם קטגוריית מחיר", "w": 0}
  ],
  "scoringNote": "הערה כללית על מנגנון הניקוד (יחס איכות/מחיר, נוסחה וכו')",
  "teamReq": [
    {"role": "תפקיד", "req": "דרישות מינימום"}
  ],
  "highlights": ["דגש חשוב 1", "דגש חשוב 2"],
  "flags": ["אזהרה/סיכון 1", "אזהרה/סיכון 2"],
  "score": 75
}

הנחיות חשובות:
- daysLeft: חשב מספר ימים מהיום (${new Date().toISOString().slice(0, 10)}) עד מועד ההגשה. אם עבר — 0.
- score: הערך 0-100 את סיכוי הזכייה של משרד רו"ח בינוני.
- thresholds: חלץ את כל תנאי הסף — כל אחד בנפרד.
- qualityScoring: w = משקל באחוזים, m = ניקוד מקסימלי. אם רק אחד מהם צוין, השתמש באותו ערך לשניהם.
- priceScoring: אם יש מרכיב מחיר עם חלוקה לקטגוריות, פרט. אחרת null.
- timeline: כלול מועד שאלות הבהרה, מועד מענה, סיור קבלנים, מועד הגשה — כל מה שמצוין.
- contact: חפש כתובת דוא"ל, טלפון, מוקד תמיכה, או כל פרט קשר לשאלות הבהרה. גם אם זה מוקד תמיכה כללי (כמו moked@mail.gov.il) — זה נחשב. name = שם איש קשר או "מוקד תמיכה". אל תחזיר null אם יש כתובת מייל כלשהי במכרז.
- highlights: 3-6 נקודות חשובות שכל מגיש חייב לדעת.
- flags: 2-4 סיכונים או אזהרות.
- החזר JSON תקין בלבד.`;

  const model = 'gemini-2.5-flash';
  const MAX_RETRIES = 4;
  const RETRY_DELAYS = [3000, 5000, 8000];

  try {
    let response, data;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      console.log(`Attempt ${attempt + 1}/${MAX_RETRIES} with ${model}`);

      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
              ...(model.includes('2.5') ? { thinkingConfig: { thinkingBudget: 0 } } : {})
            }
          })
        }
      );

      if (response.ok) break;

      const errText = await response.text();
      console.error(`Attempt ${attempt + 1} error:`, response.status, errText.slice(0, 200));

      // Retry on 503 (overloaded) or 429 (rate limit)
      if ((response.status === 503 || response.status === 429) && attempt < MAX_RETRIES - 1) {
        const delay = RETRY_DELAYS[attempt] || 5000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      let msg = 'AI API error: ' + response.status;
      if (response.status === 429) msg = 'חריגת מכסה — נסה שוב בעוד דקה';
      else if (response.status === 503) msg = 'השרת עמוס — נסה שוב בעוד רגע';
      else if (response.status === 400) {
        try { msg = JSON.parse(errText).error?.message || msg; } catch {}
      }
      return { statusCode: 502, headers, body: JSON.stringify({ error: msg }) };
    }

    data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Empty AI response' }) };
    }

    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      // Try to extract JSON from response
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) {
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Invalid JSON from AI' }) };
      }
      result = JSON.parse(match[0]);
    }

    console.log('AI result keys:', Object.keys(result).join(', '));
    console.log('contact:', JSON.stringify(result.contact));
    console.log('timeline:', JSON.stringify(result.timeline));

    // Ensure numeric fields
    if (result.daysLeft != null) result.daysLeft = Math.max(0, parseInt(result.daysLeft) || 0);
    if (result.score != null) result.score = Math.min(100, Math.max(0, parseInt(result.score) || 0));

    // Ensure arrays
    if (!Array.isArray(result.thresholds)) result.thresholds = [];
    if (!Array.isArray(result.qualityScoring)) result.qualityScoring = [];
    if (!Array.isArray(result.teamReq)) result.teamReq = [];
    if (!Array.isArray(result.highlights)) result.highlights = [];
    if (!Array.isArray(result.flags)) result.flags = [];
    if (!Array.isArray(result.timeline)) result.timeline = [];

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};
