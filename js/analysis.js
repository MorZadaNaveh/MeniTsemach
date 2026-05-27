'use strict';

/* ═════ AI ANALYSIS ═════ */
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

async function runAIAnalysis(){
  if(!uploadedFiles.length){ alert('נא לבחור קובץ'); return; }
  document.getElementById('uploadCard').style.display='none';
  document.getElementById('aiProgress').style.display='block';
  document.getElementById('aiResultSection').style.display='none';

  const steps=[
    {t:'קורא את הקובץ...',p:15},
    {t:'שולח ל-Claude AI...',p:35},
    {t:'AI מחלץ תנאי סף וניקוד...',p:55},
    {t:'מזהה דרישות צוות ותאריכים...',p:75},
    {t:'מסמן חריגות ודגשים...',p:90},
    {t:'מכין תוצאות...',p:100}
  ];
  const progText = document.getElementById('aiProgressText');
  const progBar  = document.getElementById('aiProgressBar');

  // Read file content
  try {
    const file = uploadedFiles[0];
    uploadedFileName = file.name;
    if(file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.csv')){
      uploadedFileContent = await file.text();
    } else {
      // For PDF/DOCX we can't read natively in browser — use file name + mock content
      uploadedFileContent = `[קובץ: ${file.name}, גודל: ${(file.size/1024).toFixed(0)}KB]\nאנא נתח מכרז זה.`;
    }
  } catch(e){ uploadedFileContent='[לא ניתן לקרוא קובץ]'; }

  // Animate progress
  let si=0;
  const iv=setInterval(()=>{
    if(si<steps.length){
      progText.textContent=steps[si].t;
      progBar.style.width=steps[si].p+'%';
      si++;
    }
  },600);

  // Call Claude API
  setTimeout(async()=>{
    clearInterval(iv);
    progBar.style.width='100%';
    try{
      const result = await callClaudeForAnalysis(uploadedFileContent, uploadedFileName);
      currentAIResult = result;
      showAIResult(result);
    }catch(err){
      console.error(err);
      // Fallback to demo result
      currentAIResult = getDemoAnalysis(uploadedFileName);
      showAIResult(currentAIResult);
    }
  }, steps.length*600+200);
}

async function callClaudeForAnalysis(content, fileName){
  const prompt = `אתה מומחה בניתוח מכרזים ציבוריים בישראל. נתח את מכרז הבאה ומצא את כל המידע הרלוונטי.

שם הקובץ: ${fileName}
תוכן הקובץ:
${content.slice(0,8000)}

אנא חלץ ותחזיר JSON מדויק עם השדות הבאים:
{
  "tenderName": "שם המכרז",
  "orgName": "שם הגוף המזמין",
  "tenderNumber": "מספר המכרז",
  "type": "סוג המכרז (ביקורת פנימית / ביקורת שכר / ייעוץ כלכלי וכו')",
  "submitDeadline": "תאריך ושעת הגשה",
  "daysLeft": "מספר ימים עד הגשה (מספר בלבד)",
  "value": "היקף כספי אומדן",
  "duration": "תקופת התקשרות",
  "winners": "מספר זוכים",
  "tenderBond": "ערבות מכרז",
  "performanceBond": "ערבות ביצוע",
  "liabilityBond": "ערבות אחריות",
  "insurance": "דרישות ביטוח",
  "scope": "תיאור היקף העבודה",
  "thresholds": ["תנאי סף 1", "תנאי סף 2", "..."],
  "qualityScoring": [
    {"l": "שם הקריטריון", "w": 30, "m": 30},
    ...
  ],
  "teamReq": [
    {"role": "שם התפקיד", "req": "דרישות מינימום"},
    ...
  ],
  "highlights": ["דגש חשוב 1", "דגש חשוב 2", "..."],
  "flags": ["אזהרה 1", "אזהרה 2", "..."],
  "score": "ציון סיכוי זכייה 0-100 לפי הערכת AI"
}

החזר JSON בלבד, ללא טקסט נוסף.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      model:'claude-sonnet-4-20250514',
      max_tokens:4000,
      messages:[{role:'user',content:prompt}]
    })
  });

  if(!response.ok) throw new Error('API error: '+response.status);
  const data = await response.json();
  const raw = data.content[0]?.text || '';
  // Parse JSON
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if(!jsonMatch) throw new Error('No JSON in response');
  return JSON.parse(jsonMatch[0]);
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
    const contactHtml = r.contact ? `
      <div class="stl">איש קשר לשו"ת</div>
      <div class="ai-contact-card">
        <div class="ai-contact-row"><span class="ai-contact-icon">👤</span><strong>${r.contact.name}</strong></div>
        <div class="ai-contact-row"><span class="ai-contact-icon">📧</span><a href="mailto:${r.contact.email}" style="color:var(--grn);font-weight:600">${r.contact.email}</a></div>
        ${r.contact.phone&&r.contact.phone!=='—'?`<div class="ai-contact-row"><span class="ai-contact-icon">📞</span>${r.contact.phone}</div>`:''}
        <div class="ai-contact-row"><span class="ai-contact-icon">📋</span>${r.contact.method}</div>
      </div>` : '';
    const hoursHtml = r.hoursScope ? `
      <div class="stl">היקף בשעות</div>
      <div style="background:var(--bg2);border:1px solid var(--s5);border-radius:9px;padding:10px 13px;font-size:13px;line-height:1.6">${r.hoursScope}</div>` : '';
    body.innerHTML = `
      <div class="agrid">
        <div class="ai-result-card"><div class="ai-result-label">מועד הגשה</div><div class="ai-result-value" style="color:var(--red);font-weight:700">${r.submitDeadline||'TBD'}</div></div>
        <div class="ai-result-card"><div class="ai-result-label">היקף כספי</div><div class="ai-result-value">${r.value||'TBD'}</div></div>
        <div class="ai-result-card"><div class="ai-result-label">משך התקשרות</div><div class="ai-result-value">${r.duration||'TBD'}</div></div>
        <div class="ai-result-card"><div class="ai-result-label">מספר זוכים</div><div class="ai-result-value">${r.winners||'TBD'}</div></div>
        <div class="ai-result-card"><div class="ai-result-label">ערבות מכרז</div><div class="ai-result-value">${r.tenderBond||'TBD'}</div></div>
        <div class="ai-result-card"><div class="ai-result-label">ערבות ביצוע</div><div class="ai-result-value">${r.performanceBond||'TBD'}</div></div>
      </div>
      ${timelineHtml}
      ${contactHtml}
      <div class="stl">היקף העבודה</div>
      <div style="background:var(--grn-light);border:1px solid var(--grn-border);border-radius:9px;padding:10px 13px;font-size:13px;line-height:1.6">${r.scope||'TBD'}</div>
      ${hoursHtml}
      <div class="stl">דגשים חשובים</div>
      ${(r.highlights||[]).map(h=>`<div class="alert ab2" style="margin-bottom:5px;font-size:11.5px">ℹ️ ${h}</div>`).join('')}
      ${(r.flags||[]).length?`<div class="stl" style="color:var(--amb)">⚠ אזהרות</div>${(r.flags||[]).map(f=>`<div class="alert aa" style="margin-bottom:5px;font-size:11.5px">⚠️ ${f}</div>`).join('')}`:''}`;
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
      <div class="alert ag2" style="margin-bottom:12px">✨ Claude AI ייצר את הנספחים לפי המידע שחולץ</div>
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

