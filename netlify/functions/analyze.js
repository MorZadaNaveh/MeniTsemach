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
  console.log('API key loaded:', apiKey ? 'yes (' + apiKey.length + ' chars)' : 'MISSING');
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

חלץ ותחזיר אובייקט JSON בעברית עם כל השדות הבאים. אם שדה לא מצוין במכרז, השתמש במחרוזת ריקה "" (לא null).

{
  "tenderName": "שם המכרז המלא",
  "orgName": "שם הגוף המזמין",
  "tenderNumber": "מספר המכרז",
  "type": "סוג המכרז",
  "submitDeadline": "תאריך ושעת הגשה אחרונה בפורמט DD/MM/YYYY בשעה HH:MM. אם אין שעה — רק DD/MM/YYYY בלי 'בשעה'",
  "daysLeft": 0,
  "value": "היקף כספי / אומדן",
  "duration": "תקופת התקשרות מלאה כולל הארכות",
  "winners": "מספר זוכים ופירוט",
  "hoursScope": "היקף שעות שנתי מוערך",
  "guarantees": [
    {"label": "שם/סוג הערבות כפי שמופיע במכרז", "detail": "סכום, אחוז, תוקף ותנאים — פירוט מלא"}
  ],
  "tenderBond": "ערבות מכרז (סכום ותוקף)",
  "performanceBond": "ערבות ביצוע (סכום ותוקף)",
  "liabilityBond": "ערבות אחריות / בדק (סכום ותוקף)",
  "insurance": "דרישות ביטוח (סוגים וסכומים)",
  "scope": "תיאור מפורט של היקף העבודה",
  "timeline": [
    {"label": "שם האירוע", "date": "DD/MM/YYYY בשעה HH:MM (אם אין שעה — רק DD/MM/YYYY)"}
  ],
  "contact": {"name": "שם", "email": "מייל", "phone": "טלפון", "method": "אופן שליחת שאלות"},
  "adminThresholds": ["תנאי סף מנהלי 1", "תנאי סף מנהלי 2"],
  "professionalThresholds": [
    {"field": "שם התחום", "detail": "פירוט תנאי הסף"}
  ],
  "scoringTables": [
    {
      "title": "כותרת הטבלה במכרז (אופציונלי)",
      "headers": ["נושא", "קריטריון", "ניקוד מקסימאלי"],
      "rows": [["13.2.2.1. כותרת נושא", "פירוט מלא של קריטריון הניקוד", "30"]]
    }
  ],
  "qualityScoring": [
    {"l": "שם מדד האיכות", "detail": "פירוט הניקוד — תיאור מפורט של מה נבדק ואיך", "w": "30%"}
  ],
  "minQualityScore": 75,
  "priceScoring": [
    {"l": "שם קטגוריית מחיר", "w": "35%"}
  ],
  "scoringNote": "הערה כללית על מנגנון הניקוד (יחס איכות/מחיר, נוסחה, ציון מזערי וכו')",
  "highlights": ["דגש חשוב 1", "דגש חשוב 2"],
  "flags": ["אזהרה/סיכון 1", "אזהרה/סיכון 2"],
  "score": 75
}

הנחיות חשובות:
- daysLeft: חשב מספר ימים מהיום (${new Date().toISOString().slice(0, 10)}) עד מועד ההגשה. אם עבר — 0.
- score: הערך 0-100 את סיכוי הזכייה של משרד רו"ח בינוני.
- adminThresholds: תנאי סף מנהליים — רישום כדין, חוק עסקאות גופים ציבוריים, עסק חי, ייצוג הולם וכו'. כל אחד בנפרד.
- professionalThresholds: תנאי סף מקצועיים בטבלה — כל שורה עם field (תחום כמו "השכלה", "ניסיון מקצועי", "היקף פרויקט", "סוג פרויקט") ו-detail (פירוט הדרישה). חלץ את כולם.
- scoringTables: העתק verbatim את טבלת הניקוד תחת "בדיקת איכות" (13.2). עמודות לפי המכרז (מימין לשמאל): נושא (כותרת הסעיף, למשל 13.2.2.1), קריטריון (כל פירוט הניקוד — טקסט מלא), ניקוד מקסימאלי (מספר). שורה = מערך [נושא, קריטריון, ניקוד]. בלי קיצור. אם אין טבלה — [].
- qualityScoring: כל מדד איכות עם l = שם, detail = פירוט מלא של מה נבדק (כולל חלוקת ניקוד פנימית אם יש), w = משקל באחוזים (כמחרוזת עם %).
- minQualityScore: ציון איכות מזערי למעבר לשלב הבא. null אם לא צוין.
- priceScoring: אם יש מרכיב מחיר עם חלוקה לקטגוריות, פרט. אחרת null.
- timeline: כלול מועד שאלות הבהרה, מועד תחילת הגשה, מועד אחרון להגשה, ראיון — כל מה שמצוין. date בפורמט DD/MM/YYYY בשעה HH:MM. אם אין שעה ספציפית — רק DD/MM/YYYY ללא "בשעה".
- contact: חפש כתובת דוא"ל, טלפון, מוקד תמיכה, או כל פרט קשר. אל תחזיר null אם יש כתובת מייל כלשהי במכרז.
- highlights: 3-6 נקודות חשובות (דגשים מיוחדים) שכל מגיש חייב לדעת.
- flags: 2-4 סיכונים או אזהרות.
- winners: ציין מספר זוכים + פירוט (למשל "יועץ אחד בלבד").
- duration: כלול את תקופת ההתקשרות הבסיסית + אופציות הארכה (למשל "12 חודשים + הארכה עד 48 חודשים נוספים").
- hoursScope: היקף שעות שנתי מוערך אם צוין.
- guarantees: חפש בכל המסמך כל אזכור של ערבות / ערבויות / ערבון. לכל סוג ערבות נפרד — שורה עם label (הניסוח מהמכרז) ו-detail (סכום, אחוז, תוקף, תנאים). אל תכלול ביטוחים רגילים אלא אם מוגדרים במפורש כערבות. אם אין ערבויות במכרז — מערך ריק [].
- tenderBond / performanceBond / liabilityBond: מלא לפי ערבות מכרז, ערבות ביצוע וערבות אחריות/בדק (לתאימות לאחור). אם אין — "".
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
            maxOutputTokens: 8192,
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
      else if (response.status === 400) {
        try { msg = JSON.parse(errText).error?.message || msg; } catch {}
      }
      return { statusCode: response.status === 429 ? 429 : response.status === 503 ? 503 : 502, headers, body: JSON.stringify({ error: msg }) };
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
    if (!Array.isArray(result.adminThresholds)) result.adminThresholds = [];
    if (!Array.isArray(result.professionalThresholds)) result.professionalThresholds = [];
    if (!Array.isArray(result.qualityScoring)) result.qualityScoring = [];
    if (!Array.isArray(result.highlights)) result.highlights = [];
    if (!Array.isArray(result.flags)) result.flags = [];
    if (!Array.isArray(result.timeline)) result.timeline = [];
    if (!Array.isArray(result.scoringTables)) result.scoringTables = [];

    if (!Array.isArray(result.guarantees)) result.guarantees = [];
    result.guarantees = result.guarantees
      .map(g => ({
        label: typeof g?.label === 'string' ? g.label : (typeof g?.type === 'string' ? g.type : ''),
        detail: typeof g?.detail === 'string' ? g.detail : (typeof g?.value === 'string' ? g.value : '')
      }))
      .filter(g => (g.label && g.label.trim()) || (g.detail && g.detail.trim()));

    // Clean nulls and empty "בשעה" from all string fields
    function cleanVal(v) {
      if (v === null || v === undefined) return '';
      if (typeof v === 'string') return v.replace(/\s*בשעה\s*(null|)$/g, '').replace(/^null$/, '').trim();
      return v;
    }
    for (const key of Object.keys(result)) {
      if (typeof result[key] === 'string') result[key] = cleanVal(result[key]);
    }
    if (result.timeline) {
      result.timeline.forEach(t => { if (t.date) t.date = cleanVal(t.date); });
    }
    if (result.contact) {
      for (const key of Object.keys(result.contact)) {
        result.contact[key] = cleanVal(result.contact[key]);
      }
    }
    result.guarantees.forEach(g => {
      g.label = cleanVal(g.label);
      g.detail = cleanVal(g.detail);
    });
    result.scoringTables = result.scoringTables
      .map(tbl => {
        const headers = Array.isArray(tbl?.headers)
          ? tbl.headers.map(h => cleanVal(String(h ?? '')))
          : [];
        const rows = Array.isArray(tbl?.rows)
          ? tbl.rows
              .filter(r => Array.isArray(r))
              .map(r => r.map(c => cleanVal(String(c ?? ''))))
              .filter(r => r.some(c => c))
          : [];
        return {
          title: cleanVal(String(tbl?.title || tbl?.caption || '')),
          headers,
          rows
        };
      })
      .filter(tbl => tbl.title || tbl.headers.length || tbl.rows.length);

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};
