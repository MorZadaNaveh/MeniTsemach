'use strict';

/* ═════ AI ANALYSIS ═════ */
if(typeof pdfjsLib!=='undefined'){
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let uploadedFiles = [];

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
    return smartTruncate(text);
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
    return smartTruncate(fullText);
  }

  // DOCX
  if(name.endsWith('.docx')){
    if(typeof mammoth==='undefined') throw new Error('Mammoth.js לא נטען — רענן את הדף');
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({arrayBuffer: buf});
    return smartTruncate(result.value);
  }

  // Unsupported
  if(name.endsWith('.doc')) throw new Error('פורמט .doc ישן — שמור כ-.docx ונסה שוב');
  if(name.endsWith('.xls') || name.endsWith('.xlsx')) throw new Error('קבצי Excel לא נתמכים — שמור כ-.pdf או .txt');
  throw new Error('סוג קובץ לא נתמך: ' + file.name.split('.').pop());
}

/* ── Call Netlify Function → Gemini AI ── */
async function callAIForAnalysis(content, fileName, wasTruncated){
  const response = await fetch('/.netlify/functions/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: content, fileName, truncated: wasTruncated })
  });
  if(!response.ok){
    const err = await response.json().catch(()=>({error:'Unknown'}));
    throw new Error(err.error || 'API error: ' + response.status);
  }
  return await response.json();
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

  try {
    // Step 1: Extract text
    progText.textContent = 'קורא את הקובץ...';
    progBar.style.width = '15%';
    const { text, truncated } = await extractFileText(file);
    uploadedFileContent = text;

    if(text.trim().length < 50){
      throw new Error('לא הצלחתי לחלץ טקסט מהקובץ — ייתכן שהקובץ סרוק (תמונה) או ריק');
    }

    // Step 2: Send to AI
    progText.textContent = 'שולח ל-AI לניתוח...';
    progBar.style.width = '35%';

    // Animate progress while waiting
    let pct = 35;
    const iv = setInterval(()=>{
      if(pct < 90){ pct += 3; progBar.style.width = pct+'%'; }
      if(pct > 50 && pct < 60) progText.textContent = 'AI מחלץ תנאי סף וניקוד...';
      if(pct > 65 && pct < 75) progText.textContent = 'מזהה דרישות צוות ותאריכים...';
      if(pct > 80) progText.textContent = 'מסמן חריגות ודגשים...';
    }, 500);

    const result = await callAIForAnalysis(text, file.name, truncated);
    clearInterval(iv);

    progText.textContent = 'מכין תוצאות...';
    progBar.style.width = '100%';

    await new Promise(r=>setTimeout(r, 300));
    currentAIResult = result;
    showAIResult(result);

  } catch(err) {
    console.error('Analysis error:', err);
    progBar.style.width = '100%';
    // Fall back to demo data
    alert('שגיאה בניתוח: ' + err.message + '\nמציג נתוני דמו.');
    currentAIResult = getDemoAnalysis(uploadedFileName);
    showAIResult(currentAIResult);
  }
}

/* ── Hardcoded tender data for demo ── */
const TENDER1_DATA = {
  tenderName:'שירותי ביקורת רו"ח בשלטון המקומי',
  orgName:'משרד הפנים — אגף בכיר לביקורת ברשויות המקומיות',
  tenderNumber:'2/2026',
  type:'ביקורת רו"ח',
  submitDeadline:'18.06.2026 | 15:00',
  daysLeft: Math.max(0,Math.round((new Date('2026-06-18')-new Date())/864e5)),
  value:'לפי היקף שעות — 320-1,600 שע\' לרשות/שנה',
  duration:'שנה + הארכה עד 5 שנים מצטבר',
  winners:'~300 משרדי רו"ח (מכרז מסגרת)',
  tenderBond:'הגשה דרך מערכת יהלום',
  performanceBond:'בהתאם להסכם',
  liabilityBond:'בהתאם להסכם',
  insurance:'בהתאם לנספח ב\'',
  scope:'ביקורת דוחות כספיים ואחרים ברשויות המקומיות — עיריות, מועצות מקומיות ואזוריות, איגודי ערים, תאגידים עירוניים. כולל דו"ח מבוקר, דו"ח ביקורת מפורט, דו"ח מדדי ביצוע, דו"ח חצי שנתי סקור, עבודת רו"ח מעיין.',
  hoursScope:'320-800 שעות/שנה לרשות רגילה; 1,200-1,600 שעות לרשויות גדולות; ייעוץ עד 120 שע\'/חודש',
  timeline:[
    {label:'מועד אחרון לשאלות הבהרה',date:'14.05.2026'},
    {label:'מועד אחרון למענה על שאלות',date:'01.06.2026'},
    {label:'מועד אחרון להגשת הצעות',date:'18.06.2026 | 15:00'}
  ],
  contact:{name:'מוקד תמיכה מערכת יהלום',email:'moked@mail.gov.il',phone:'1299 / 08-6863100',method:'שאלות הבהרה דרך מערכת יהלום בלבד'},
  thresholds:[
    'משרד רו"ח — תאגיד, שותפות או יחיד עוסק מורשה',
    'ניהול ספרים כדין + אישורי מס בתוקף',
    'תצהיר העדר הרשעות (עובדים זרים, שכר מינימום)',
    'שימוש בתוכנות מקוריות בלבד',
    'עמידה בחוק שוויון זכויות לאנשים עם מוגבלות',
    'צוות של 2 רו"ח לפחות — ראש צוות + חבר צוות',
    'ראש צוות: שכיר/שותף במציע, 3+ שנות ניסיון לאחר רישיון',
    'ראש צוות: 3+ שנות ניסיון בביקורת גוף מבוקר, 100 שע\'/שנה לפחות'
  ],
  qualityScoring:[
    {l:'הערכה מקצועית (ציוני אגף)',w:30,m:30},
    {l:'המלצות / ציוני ממליצים',w:30,m:30},
    {l:'שנות ניסיון ראש צוות',w:10,m:10},
    {l:'סוג ניסיון ראש צוות (סל 1-5)',w:50,m:50},
    {l:'רו"ח נוספים בצוות (עד 2)',w:10,m:10}
  ],
  scoringNote:'100% איכות — ללא מרכיב מחיר. הקצאת עבודה לפי דירוג ציון האיכות.',
  teamReq:[
    {role:'ראש צוות ביקורת',req:'רו"ח בעל רישיון, 3+ שנות ניסיון, שכיר/שותף במציע, 30% מהשעות בעצמו'},
    {role:'חבר צוות',req:'רו"ח בעל רישיון בתוקף'},
    {role:'רו"ח מעיין (אופציונלי)',req:'ייבחר ע"י המשרד מבין הזוכים — ליווי וביקורת דוחות'}
  ],
  highlights:[
    'מכרז מסגרת ארצי — עד ~300 זוכים',
    'הקצאת רשויות לפי דירוג ציון האיכות',
    'ראש צוות חייב לבצע 30% מהשעות בעצמו',
    'ניקוד 100% איכות — ללא מרכיב מחיר',
    'הגשה מקוונת דרך מערכת יהלום בלבד'
  ],
  flags:[
    'ראש צוות לא יהיה שותף/ראש צוות במציע אחר',
    'משרד אחד = הצעה אחת בלבד (גם עם סניפים)',
    'ניגוד עניינים — איסור עבודה עם רשות מבוקרת 24 חודשים'
  ],
  score:78
};

const TENDER2_DATA = {
  tenderName:'שירותי בדיקה ובקרה של חשבונות תקשורת סלולר ו-DATA',
  orgName:'עיריית רמלה',
  tenderNumber:'16/26',
  type:'בדיקה ובקרה תקשורת',
  submitDeadline:'25.05.2026 | 12:00',
  daysLeft: Math.max(0,Math.round((new Date('2026-05-25')-new Date())/864e5)),
  value:'₪750 לרכישת חוברת מכרז',
  duration:'36 חודשים + 2 הארכות × 12 חודשים = עד 60 חודשים',
  winners:'1 זוכה (העדפה למפעיל אחד)',
  tenderBond:'₪1,200 — תוקף עד 31.8.2026',
  performanceBond:'בהתאם להסכם',
  liabilityBond:'בהתאם להסכם',
  insurance:'בהתאם לנספח ה\'',
  scope:'3 שירותים: (1) בדיקה ובקרה של חשבונות סלולר ו-DATA — כ-260 מנויים (2) הכנת מסמכי מכרז לתקשורת סלולרית וליווי העירייה במעבר לחברת סלולר חדשה (3) חישוב הטבות מס סלולר לעובדי העירייה מידי חודש.',
  hoursScope:'~260 מנויי סלולר; 6 חודשי ניסיון; הגשה ידנית ברח\' ויצמן 1, רמלה',
  timeline:[
    {label:'מועד אחרון לשאלות הבהרה',date:'11.05.2026 | 12:00'},
    {label:'מועד אחרון להגשת הצעות',date:'25.05.2026 | 12:00'}
  ],
  contact:{name:'גלית יעקב',email:'galit@ramle.org.il',phone:'—',method:'מסמך חתום בדוא"ל'},
  thresholds:[
    'תאגיד רשום בישראל או עוסק מורשה',
    'אישורים לפי חוק עסקאות גופים ציבוריים',
    'הצעה ללא תיאום עם מציעים אחרים',
    'ללא ניגוד עניינים או חשש למראית עין',
    'לא בהליכי פירוק, פשיטת רגל או חדלות פירעון',
    'שימוש בתוכנות מורשות בלבד',
    '5 שנות ניסיון מקצועי (2015-2025) בעבודות נשוא המכרז',
    'ניסיון ב-2 רשויות מקומיות בסדר גודל רמלה לפחות',
    'עובד בעל ידע וניסיון בתחום + קורות חיים'
  ],
  qualityScoring:[
    {l:'שנות ניסיון נוספות (5)',w:20,m:20},
    {l:'המלצות נוספות (5)',w:20,m:20},
    {l:'ניסיון קודם עם עיריית רמלה',w:20,m:20},
    {l:'השכלת והכשרת הצוות',w:20,m:20},
    {l:'איכות מסמכים והתרשמות הועדה',w:20,m:20}
  ],
  priceScoring:[
    {l:'בדיקה/בקרה סלולר + DATA',w:35},
    {l:'הכנת מכרז סלולרי + ליווי מעבר',w:35},
    {l:'חישוב הטבות מס חודשי',w:30}
  ],
  scoringNote:'40% איכות (A) + 60% מחיר (B). ההצעה הזולה ביותר בכל קטגוריה מקבלת 100 נק\'.',
  teamReq:[
    {role:'נותן שירות',req:'עובד בעל ידע וניסיון בתחום בדיקת חשבונות תקשורת סלולר'},
    {role:'אחראי מקצועי',req:'5+ שנות ניסיון, הכרת 2+ רשויות בסדר גודל רמלה'}
  ],
  highlights:[
    'מסירה ידנית בלבד — רח\' ויצמן 1, רמלה (בניין העירייה)',
    '₪750 לרכישת חוברת המכרז (לא יוחזר)',
    '6 חודשי ניסיון — העירייה רשאית לבטל בהתראת 30 יום',
    'העדפה למפעיל אחד לכל 3 השירותים',
    'ראש העירייה: מיכאל וידל'
  ],
  flags:[
    'המועד להגשה קרוב מאוד — יש לוודא ערבות בנקאית',
    'אסור להפעיל קבלני משנה',
    'שינוי במסמכי המכרז = ביטול אוטומטי של ההצעה'
  ],
  score:82
};

function getDemoAnalysis(fileName){
  const fn = fileName.toLowerCase();
  if(fn.includes('tender1') || fn.includes('2-2026') || fn.includes('2_2026') || fn.includes('פנים'))
    return JSON.parse(JSON.stringify(TENDER1_DATA));
  if(fn.includes('tender2') || fn.includes('16-26') || fn.includes('16_26') || fn.includes('ramle') || fn.includes('רמלה'))
    return JSON.parse(JSON.stringify(TENDER2_DATA));
  // Generic fallback for unknown files
  return {
    tenderName: fileName.replace(/\.[^.]+$/,'').replace(/_/g,' ') || 'מכרז',
    orgName: 'גוף מזמין — מנותח מהקובץ',
    tenderNumber: 'TBD',
    type: 'כללי',
    submitDeadline: new Date(Date.now()+21*864e5).toLocaleDateString('he-IL')+' | 12:00',
    daysLeft: 21,
    value: 'ראה קובץ המכרז',
    duration: 'ראה קובץ המכרז',
    winners: 'ראה קובץ המכרז',
    tenderBond: 'ראה קובץ המכרז',
    performanceBond: 'ראה קובץ המכרז',
    liabilityBond: 'ראה קובץ המכרז',
    insurance: 'ראה קובץ המכרז',
    scope: 'לא ניתן לנתח קובץ בינארי (PDF/DOCX) ישירות — נא להעלות קובץ טקסט.',
    hoursScope:'',
    timeline:[],
    contact:null,
    thresholds:['ראה קובץ המכרז לתנאי הסף המלאים'],
    qualityScoring:[{l:'ניסיון מקצועי',w:40,m:40},{l:'כישורי צוות',w:30,m:30},{l:'מתודולוגיה',w:20,m:20},{l:'מחיר',w:10,m:10}],
    priceScoring:null,
    scoringNote:'',
    teamReq:[{role:'ראה קובץ המכרז',req:'ראה קובץ המכרז'}],
    highlights:['לניתוח מלא — העלה קובץ TXT או הדבק את תוכן המכרז'],
    flags:['⚠️ הקובץ הועלה כ-PDF/DOCX — לניתוח מדויק העלה כ-TXT'],
    score: 0
  };
}

function showAIResult(result){
  document.getElementById('aiProgress').style.display='none';
  document.getElementById('uploadCard').style.display='block';
  document.getElementById('aiResultSection').style.display='block';
  document.getElementById('aiTenderName').textContent = result.tenderName || 'מכרז';
  document.getElementById('aiTenderOrg').textContent = (result.orgName||'') + (result.tenderNumber?' | '+result.tenderNumber:'');
  document.getElementById('aiAnalysisDate').textContent = 'נותח: '+new Date().toLocaleDateString('he-IL');

  // Add to TENDERS list
  const existing = TENDERS.find(t=>t.name===result.tenderName);
  if(!existing){
    const newTender = {
      id:TENDERS.length,
      name:result.tenderName||uploadedFileName.replace(/\.[^.]+$/,''),
      org:result.orgName||'גוף מזמין',
      number:result.tenderNumber||'TBD',
      type:result.type||'ביקורת',
      status:+result.daysLeft<=3?'urgent':+result.daysLeft<=14?'soon':'ok',
      daysLeft:+result.daysLeft||0,
      score:+result.score||75,
      value:result.value||'TBD',
      duration:result.duration||'TBD',
      winners:result.winners||'TBD',
      submitDeadline:result.submitDeadline||'TBD',
      questionsDeadline:result.timeline&&result.timeline[0]?result.timeline[0].date:'TBD',
      tourDate:'TBD',openDate:'TBD',
      tenderBond:result.tenderBond||'TBD',
      performanceBond:result.performanceBond||'TBD',
      liabilityBond:result.liabilityBond||'TBD',
      insurance:result.insurance||'TBD',
      scope:result.scope||'',
      thresholds:result.thresholds||[],
      qualityScoring:result.qualityScoring||[],
      teamReq:result.teamReq||[],
      highlights:result.highlights||[],
      flags:result.flags||[],
      appExp:TENDERS[0].appExp,
      appTeam:TENDERS[0].appTeam
    };
    TENDERS.push(newTender);
    currentAnalysisIdx = newTender.id;
    updateSimSelect();
    renderTenderTable();
    renderTenderCards();
    renderDashboard();
    document.getElementById('simOpenTenderBtn').onclick=()=>openTenderModal(newTender.id);
  } else {
    currentAnalysisIdx = existing.id;
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
    const timelineHtml = (r.timeline&&r.timeline.length) ? `
      <div class="stl">לוח זמנים</div>
      <div class="ai-timeline">
        ${r.timeline.map((t,i)=>`<div class="ai-timeline-item${i===r.timeline.length-1?' last':''}"><div class="ai-timeline-dot"></div><div class="ai-timeline-content"><span class="ai-timeline-label">${t.label}</span><span class="ai-timeline-date">${t.date}</span></div></div>`).join('')}
      </div>` : '';
    const c = r.contact;
    const hasContact = c && (c.name || c.email || c.phone || c.method);
    const contactHtml = hasContact ? `
      <div class="stl">איש קשר לשו"ת</div>
      <div class="ai-contact-card">
        ${c.name?`<div class="ai-contact-row"><span class="ai-contact-icon">👤</span><strong>${c.name}</strong></div>`:''}
        ${c.email?`<div class="ai-contact-row"><span class="ai-contact-icon">📧</span><a href="mailto:${c.email}" style="color:var(--grn);font-weight:600">${c.email}</a></div>`:''}
        ${c.phone&&c.phone!=='—'?`<div class="ai-contact-row"><span class="ai-contact-icon">📞</span>${c.phone}</div>`:''}
        ${c.method?`<div class="ai-contact-row"><span class="ai-contact-icon">📋</span>${c.method}</div>`:''}
      </div>` : '';
    const hoursHtml = r.hoursScope ? `
      <div class="stl">היקף בשעות</div>
      <div style="background:var(--bg2);border:1px solid var(--s5);border-radius:9px;padding:10px 13px;font-size:13px;line-height:1.6">${r.hoursScope}</div>` : '';
    const cards = [
      ['מועד הגשה', r.submitDeadline, 'color:var(--red);font-weight:700'],
      ['היקף כספי', r.value],
      ['משך התקשרות', r.duration],
      ['מספר זוכים', r.winners],
      ['ערבות מכרז', r.tenderBond],
      ['ערבות ביצוע', r.performanceBond],
    ].filter(c => c[1]).map(c =>
      `<div class="ai-result-card"><div class="ai-result-label">${c[0]}</div><div class="ai-result-value"${c[2]?' style="'+c[2]+'"':''}>${c[1]}</div></div>`
    ).join('');
    const scopeHtml = r.scope ? `
      <div class="stl">היקף העבודה</div>
      <div style="background:var(--grn-light);border:1px solid var(--grn-border);border-radius:9px;padding:10px 13px;font-size:13px;line-height:1.6">${r.scope}</div>` : '';
    const highlightsHtml = (r.highlights||[]).length ? `
      <div class="stl">דגשים חשובים</div>
      ${r.highlights.map(h=>`<div class="alert ab2" style="margin-bottom:5px;font-size:11.5px">ℹ️ ${h}</div>`).join('')}` : '';
    const flagsHtml = (r.flags||[]).length ? `
      <div class="stl" style="color:var(--amb)">⚠ אזהרות</div>
      ${r.flags.map(f=>`<div class="alert aa" style="margin-bottom:5px;font-size:11.5px">⚠️ ${f}</div>`).join('')}` : '';
    body.innerHTML = `
      ${cards?'<div class="agrid">'+cards+'</div>':''}
      ${timelineHtml}
      ${contactHtml}
      ${scopeHtml}
      ${hoursHtml}
      ${highlightsHtml}
      ${flagsHtml}`;
  }
  else if(tab==='scoring'){
    const qs=r.qualityScoring||[];
    const totalMax=qs.reduce((a,q)=>a+(q.m||0),0);
    const sc=qs.reduce((a,q)=>a+Math.round((q.m||0)*0.88),0);
    const noteHtml = r.scoringNote ? `<div class="alert ag2" style="margin-bottom:10px;font-size:12px">📊 ${r.scoringNote}</div>` : '';
    const priceHtml = (r.priceScoring&&r.priceScoring.length) ? `
      <div class="stl" style="margin-top:13px">ניקוד מחיר (60%)</div>
      <table class="atable"><thead><tr><th>שירות</th><th>משקל</th><th>חישוב</th></tr></thead><tbody>
        ${r.priceScoring.map(p=>`<tr><td style="font-weight:600">${p.l}</td><td>${p.w}%</td><td style="font-size:11px;color:var(--s2)">הצעה זולה ביותר = 100 נק' × ${p.w}%</td></tr>`).join('')}
      </tbody></table>` : '';
    body.innerHTML=`
      <div class="stl">תנאי סף</div>
      ${(r.thresholds||[]).map(th=>`<div class="thresh-ok"><span style="color:var(--grn);flex-shrink:0">✅</span><span style="font-size:12.5px">${th}</span></div>`).join('')}
      <div class="stl" style="margin-top:13px">ניקוד איכותי</div>
      ${noteHtml}
      ${qs.length?`<table class="atable"><thead><tr><th>קריטריון</th><th>מקסימום</th><th>ניקוד משוער</th></tr></thead><tbody>
        ${qs.map(q=>{const e=Math.round((q.m||0)*0.88);return`<tr><td style="font-weight:600">${q.l}</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700">${q.m} נק'</td><td><div style="display:flex;align-items:center;gap:7px"><div style="flex:1"><div class="prog"><div class="pf" style="width:${q.m?(e/q.m)*100:0}%;background:linear-gradient(90deg,var(--grn),var(--grn3))"></div></div></div><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--grn)">${e}</span></div></td></tr>`;}).join('')}
        <tr style="background:var(--grn-light)"><td style="font-weight:800">סה"כ איכות</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700">${totalMax} נק'</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--grn)">${sc}</td></tr>
      </tbody></table>` : '<div class="alert ab2">🤖 לא זוהה טבלת ניקוד בקובץ</div>'}
      ${priceHtml}`;
  }
  else if(tab==='team'){
    const tr=r.teamReq||[];
    body.innerHTML=`
      <div class="stl">דרישות צוות</div>
      ${tr.length?`<table class="atable"><thead><tr><th>תפקיד</th><th>דרישות מינימום</th><th>מוצע</th></tr></thead><tbody>
        ${tr.map((req,i)=>{const m=teamMembers[i%teamMembers.length];return`<tr><td style="font-weight:700">${req.role}</td><td style="font-size:11px">${req.req}</td><td><div style="display:flex;align-items:center;gap:7px"><div style="width:22px;height:22px;border-radius:5px;background:${m.color};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff;flex-shrink:0">${m.ini}</div><div style="font-size:12px;font-weight:700">${m.name} ${m.title}</div></div></td></tr>`;}).join('')}
      </tbody></table>` : '<div class="alert ab2">🤖 לא זוהו דרישות צוות ספציפיות בקובץ</div>'}`;
  }
  else if(tab==='docs'){
    body.innerHTML=`
      <div class="alert ag2" style="margin-bottom:12px">✨ AI ייצר את הנספחים לפי המידע שחולץ</div>
      <div class="atabs" id="aiAppTabsRow">
        ${[['exp',"נספח א' — ניסיון"],['team',"נספח ב' — צוות"],['decl',"נספח ג' — הצהרות"]].map(([v,l])=>
          `<div class="atab ${v==='exp'?'on':''}" onclick="switchAIAppTab('${v}')">${l}</div>`
        ).join('')}
      </div>
      <div id="aiAppContent"></div>`;
    renderAIAppContent('exp', r);
  }
}

let aiAppTab = 'exp';
function switchAIAppTab(tab){
  aiAppTab = tab;
  document.querySelectorAll('#aiAppTabsRow .atab').forEach((el,i)=>{
    el.className='atab'+(['exp','team','decl'][i]===tab?' on':'');
  });
  renderAIAppContent(tab, currentAIResult);
}

function renderAIAppContent(tab, r){
  const ac = document.getElementById('aiAppContent');
  if(!ac) return;
  // Synthesize a mock tender from AI result for appendix generation
  const mockT = {
    name: r.tenderName||uploadedFileName,
    org: r.orgName||'גוף מזמין',
    number: r.tenderNumber||'TBD',
    appExp: TENDERS[0].appExp,
    appTeam: TENDERS[0].appTeam
  };
  if(tab==='exp') ac.innerHTML = buildAppExp(mockT);
  else if(tab==='team') ac.innerHTML = buildAppTeam(mockT);
  else if(tab==='decl') ac.innerHTML = buildAppDecl(mockT);
}

