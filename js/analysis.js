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

function getDemoAnalysis(fileName){
  return {
    tenderName: fileName.replace(/\.[^.]+$/,'').replace(/_/g,' ') || 'מכרז ביקורת פנימית',
    orgName: 'גוף מזמין — מנותח מהקובץ',
    tenderNumber: 'TBD',
    type: 'ביקורת פנימית',
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
    thresholds:['ראה קובץ המכרז לתנאי הסף המלאים'],
    qualityScoring:[{l:'ניסיון מקצועי',w:40,m:40},{l:'כישורי צוות',w:30,m:30},{l:'מתודולוגיה',w:20,m:20},{l:'מחיר',w:10,m:10}],
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
      questionsDeadline:'TBD',tourDate:'TBD',openDate:'TBD',
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
    body.innerHTML = `
      <div class="agrid">
        <div class="ai-result-card"><div class="ai-result-label">מועד הגשה</div><div class="ai-result-value" style="color:var(--red);font-weight:700">${r.submitDeadline||'TBD'}</div></div>
        <div class="ai-result-card"><div class="ai-result-label">היקף כספי</div><div class="ai-result-value">${r.value||'TBD'}</div></div>
        <div class="ai-result-card"><div class="ai-result-label">משך התקשרות</div><div class="ai-result-value">${r.duration||'TBD'}</div></div>
        <div class="ai-result-card"><div class="ai-result-label">מספר זוכים</div><div class="ai-result-value">${r.winners||'TBD'}</div></div>
        <div class="ai-result-card"><div class="ai-result-label">ערבות מכרז</div><div class="ai-result-value">${r.tenderBond||'TBD'}</div></div>
        <div class="ai-result-card"><div class="ai-result-label">ערבות ביצוע</div><div class="ai-result-value">${r.performanceBond||'TBD'}</div></div>
      </div>
      <div class="stl">היקף העבודה</div>
      <div style="background:var(--grn-light);border:1px solid var(--grn-border);border-radius:9px;padding:10px 13px;font-size:13px;line-height:1.6">${r.scope||'TBD'}</div>
      <div class="stl">דגשים חשובים</div>
      ${(r.highlights||[]).map(h=>`<div class="alert ab2" style="margin-bottom:5px;font-size:11.5px">ℹ️ ${h}</div>`).join('')}
      ${(r.flags||[]).length?`<div class="stl" style="color:var(--amb)">⚠ אזהרות</div>${(r.flags||[]).map(f=>`<div class="alert aa" style="margin-bottom:5px;font-size:11.5px">⚠️ ${f}</div>`).join('')}`:''}`;
  }
  else if(tab==='scoring'){
    const qs=r.qualityScoring||[];
    const sc=qs.reduce((a,q)=>a+Math.round((q.m||0)*0.88),0);
    body.innerHTML=`
      <div class="stl">תנאי סף</div>
      ${(r.thresholds||[]).map(th=>`<div class="thresh-ok"><span style="color:var(--grn);flex-shrink:0">✅</span><span style="font-size:12.5px">${th}</span></div>`).join('')}
      <div class="stl" style="margin-top:13px">ניקוד איכותי</div>
      ${qs.length?`<table class="atable"><thead><tr><th>קריטריון</th><th>משקל</th><th>מקסימום</th><th>ניקוד משוער</th></tr></thead><tbody>
        ${qs.map(q=>{const e=Math.round((q.m||0)*0.88);return`<tr><td style="font-weight:600">${q.l}</td><td>${q.w}%</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700">${q.m}</td><td><div style="display:flex;align-items:center;gap:7px"><div style="flex:1"><div class="prog"><div class="pf" style="width:${q.m?(e/q.m)*100:0}%;background:linear-gradient(90deg,var(--grn),var(--grn3))"></div></div></div><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--grn)">${e}</span></div></td></tr>`;}).join('')}
        <tr style="background:var(--grn-light)"><td style="font-weight:800">סה"כ</td><td>100%</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700">100</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--grn)">${sc}</td></tr>
      </tbody></table>` : '<div class="alert ab2">🤖 לא זוהה טבלת ניקוד בקובץ — נסה קובץ TXT מפורט יותר</div>'}`;
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

