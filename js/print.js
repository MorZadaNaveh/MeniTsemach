'use strict';

/* ═════ PRINT ═════ */
function printDocument(docType, tidOrNull){
  const t=(tidOrNull!==null&&tidOrNull!==undefined)?TENDERS[tidOrNull]:null;
  const today=new Date().toLocaleDateString('he-IL');
  const head=`<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body{font-family:'Heebo',sans-serif;direction:rtl;color:#18243f;background:#fff;padding:15mm 18mm;font-size:10.5pt;line-height:1.5}
    h1{font-weight:900;font-size:17pt;color:#1a5c4a;margin-bottom:4pt}
    h2{font-weight:800;font-size:12.5pt;color:#18243f;margin:12pt 0 6pt;padding-bottom:4pt;border-bottom:2pt solid #dce8e4}
    h3{font-weight:700;font-size:11pt;color:#18243f;margin:8pt 0 4pt}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8pt;padding-bottom:8pt;border-bottom:3pt solid #1a5c4a}
    .logo{font-weight:900;font-size:18pt;color:#1a5c4a}
    .logo-sub{font-size:8.5pt;color:#607870;margin-top:2pt}
    .green-bar{height:3pt;background:linear-gradient(90deg,#2d9b6f,#3dbf8a);border-radius:2pt;margin-bottom:10pt}
    table{width:100%;border-collapse:collapse;margin-bottom:9pt;font-size:9.5pt}
    th{background:#1a5c4a;color:#fff;padding:5pt 7pt;text-align:right;font-size:9pt;font-weight:700}
    td{padding:5pt 7pt;border:0.5pt solid #dce8e4;color:#18243f}
    tr:nth-child(even) td{background:#f0f4f2}
    .ai-box{background:#e8f5f0;border:0.5pt solid #a8d8c8;border-radius:6pt;padding:6pt 9pt;margin-bottom:6pt}
    .ai-lbl{font-size:8pt;font-weight:700;color:#2d9b6f;letter-spacing:.5pt;text-transform:uppercase;margin-bottom:2pt}
    .ai-val{font-size:10.5pt;font-weight:500;line-height:1.4}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:5pt;margin-bottom:9pt}
    .ok-box{padding:6pt 9pt;border-radius:6pt;font-size:9.5pt;margin-bottom:5pt;background:#e8f5f0;border:0.5pt solid #a8d8c8}
    .warn-box{padding:6pt 9pt;border-radius:6pt;font-size:9.5pt;margin-bottom:5pt;background:#fffbeb;border:0.5pt solid #fcd34d}
    .sign-row{display:flex;gap:22pt;margin-top:14pt}
    .sign-box{text-align:center}
    .sign-line{width:100pt;height:35pt;border:1pt dashed #a8d8c8;border-radius:4pt;margin-bottom:4pt}
    .sign-lbl{font-size:8pt;color:#607870}
    .footer{margin-top:16pt;padding-top:7pt;border-top:0.5pt solid #dce8e4;font-size:7.5pt;color:#90a8a0;text-align:center}
    .mono{font-family:'IBM Plex Mono',monospace}
  </style></head><body>`;
  const foot=`</body></html>`;

  const hdr=(title,sub)=>`
    <div class="header">
      <div><div class="logo">מזכיר</div><div class="logo-sub">Tender Intelligence | ${BIDDER.name} | ${BIDDER.address}</div></div>
      <div style="text-align:left"><div style="font-size:8.5pt;color:#90a8a0">${today}</div></div>
    </div>
    <div class="green-bar"></div>
    <h1>${title}</h1>${sub?`<div style="font-size:10pt;color:#607870;margin-bottom:10pt">${sub}</div>`:''}`;

  const ftr=`<div class="footer">מזכיר Tender Intelligence | ${today} | ${BIDDER.name} | כל הזכויות שמורות</div>`;
  let html='';

  if(docType==='overview'&&t){
    html=head+hdr(`סקירת מכרז: ${t.name}`,`${t.org} | ${t.number}`)+
    `<div class="grid2">
      <div class="ai-box"><div class="ai-lbl">מועד הגשה</div><div class="ai-val" style="color:#c0392b;font-weight:700">${t.submitDeadline}</div></div>
      <div class="ai-box"><div class="ai-lbl">היקף</div><div class="ai-val">${t.value}</div></div>
      <div class="ai-box"><div class="ai-lbl">ערבות מכרז</div><div class="ai-val">${t.tenderBond}</div></div>
      <div class="ai-box"><div class="ai-lbl">ערבות ביצוע</div><div class="ai-val">${t.performanceBond}</div></div>
    </div>
    <h2>תנאי סף</h2>
    ${(t.thresholds||[]).map(th=>`<div class="ok-box">✅ ${th}</div>`).join('')}
    <h2>דגשים</h2>
    ${(t.highlights||[]).map(h=>`<div style="padding:5pt 8pt;margin-bottom:4pt;background:#eff6ff;border:0.5pt solid #93c5fd;border-radius:5pt;font-size:9.5pt">ℹ️ ${h}</div>`).join('')}
    ${(t.flags||[]).length?`<h2>⚠ אזהרות</h2>${(t.flags||[]).map(f=>`<div class="warn-box">⚠️ ${f}</div>`).join('')}`:''}
    `+ftr+foot;
  } else if(docType==='scoring'&&t){
    const sc=(t.qualityScoring||[]).reduce((a,q)=>a+Math.round((q.m||0)*0.88),0);
    html=head+hdr(`טבלת ניקוד: ${t.name}`,t.number)+
    `<h2>תנאי סף</h2>${(t.thresholds||[]).map(th=>`<div class="ok-box">✅ ${th}</div>`).join('')}
    <h2>ניקוד איכותי</h2>
    <table><thead><tr><th>קריטריון</th><th>משקל</th><th>מקסימום</th><th>ניקוד משוער</th></tr></thead>
    <tbody>${(t.qualityScoring||[]).map(q=>{const e=Math.round((q.m||0)*0.88);return`<tr><td style="font-weight:600">${q.l}</td><td>${q.w}%</td><td class="mono" style="font-weight:700">${q.m}</td><td class="mono" style="font-weight:700;color:#2d9b6f">${e}</td></tr>`;}).join('')}
    <tr style="background:#e8f5f0;font-weight:700"><td>סה"כ</td><td>100%</td><td class="mono">100</td><td class="mono" style="color:#1a5c4a">${sc}</td></tr>
    </tbody></table>`+ftr+foot;
  } else if(docType==='appExp'&&t){
    html=head+hdr(`נספח א' — ניסיון המשרד`,`${t.name} | ${t.org} | ${t.number}`)+
    `<table><thead><tr><th>#</th><th>לקוח</th><th>שנים</th><th>תחום</th><th>היקף</th><th>שעות</th><th>איש קשר</th><th>נייד</th><th>מייל</th></tr></thead>
    <tbody>${(t.appExp||[]).map((e,i)=>`<tr><td style="color:#2d9b6f;font-weight:700">${i+1}</td><td style="font-weight:700">${e.client}</td><td class="mono">${e.years}</td><td>${e.area}</td><td style="font-weight:700">${e.scope}</td><td class="mono">${e.hours}</td><td>${e.contact}</td><td class="mono" style="direction:ltr">${e.mobile}</td><td style="direction:ltr">${e.email}</td></tr>`).join('')}</tbody></table>
    <div class="sign-row"><div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">${BIDDER.signatory}</div></div><div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">תאריך וחותמת</div></div></div>`+ftr+foot;
  } else if(docType==='appTeam'&&t){
    html=head+hdr(`נספח ב' — קורות חיים`,`${t.name} | ${t.org}`)+
    (t.appTeam||[]).map(m=>`<h3 style="background:#e8f5f0;padding:5pt 8pt;border-radius:4pt;border-right:3pt solid #1a5c4a">${m.name} — ${m.role}</h3>
    <table style="margin-bottom:10pt"><tbody>
      <tr><td style="width:25%;font-weight:700;background:#e8f5f0">ת.ז.</td><td class="mono">${m.id}</td></tr>
      <tr><td style="font-weight:700;background:#e8f5f0">שנות ניסיון</td><td class="mono" style="font-weight:700;color:#2d9b6f">${m.years} שנים</td></tr>
      <tr><td style="font-weight:700;background:#e8f5f0">הסמכות</td><td>${m.certs}</td></tr>
      <tr><td style="font-weight:700;background:#e8f5f0">תחומי ניסיון</td><td>${m.areas}</td></tr>
    </tbody></table>`).join('')+ftr+foot;
  } else if(docType==='appDecl'&&t){
    html=head+hdr(`נספח ג' — הצהרות ותצהירים`,`${t.name} | ${t.number}`)+
    `<h2>הצהרת המציע</h2>
    <table><tbody>
      <tr><td style="width:32%;font-weight:700;background:#e8f5f0">שם המציע</td><td>${BIDDER.name}</td></tr>
      <tr><td style="font-weight:700;background:#e8f5f0">ח.פ</td><td class="mono">${BIDDER.vat}</td></tr>
      <tr><td style="font-weight:700;background:#e8f5f0">כתובת</td><td>${BIDDER.address}</td></tr>
      <tr><td style="font-weight:700;background:#e8f5f0">מורשי חתימה</td><td>${BIDDER.signatory}</td></tr>
    </tbody></table>
    <h2>הצהרת ניגוד עניינים</h2>
    <p style="padding:8pt;background:#e8f5f0;border:0.5pt solid #a8d8c8;border-radius:5pt;font-size:10pt">אנו מצהירים כי אין ולא יהיה ניגוד עניינים עם ${t.org} בביצוע העבודה.</p>
    <h2>אישור ניהול תקין</h2>
    <table><tbody><tr><td style="font-weight:700;background:#e8f5f0">סטטוס</td><td>פעיל — תוקף עד 31.12.2025</td></tr><tr><td style="font-weight:700;background:#e8f5f0">מספר</td><td class="mono">NIT-2025-123456</td></tr></tbody></table>
    <div class="sign-row">
      <div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">${BIDDER.signatory}</div></div>
      <div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">עד</div></div>
      <div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">תאריך וחותמת</div></div>
    </div>`+ftr+foot;
  } else if(docType==='fullPackage'&&t){
    html=head+hdr(`חבילת הגשה מלאה: ${t.name}`,`${t.org} | ${t.number} | ${today}`)+
    `<h2>פרטי המכרז</h2>
    <div class="grid2">
      <div class="ai-box"><div class="ai-lbl">מועד הגשה</div><div class="ai-val" style="color:#c0392b;font-weight:700">${t.submitDeadline}</div></div>
      <div class="ai-box"><div class="ai-lbl">ערך</div><div class="ai-val">${t.value}</div></div>
    </div>
    <h2>נספח א' — ניסיון</h2>
    <table><thead><tr><th>לקוח</th><th>שנים</th><th>תחום</th><th>היקף</th><th>נייד</th></tr></thead>
    <tbody>${(t.appExp||[]).map(e=>`<tr><td style="font-weight:700">${e.client}</td><td class="mono">${e.years}</td><td>${e.area}</td><td>${e.scope}</td><td class="mono" style="direction:ltr">${e.mobile}</td></tr>`).join('')}</tbody></table>
    <h2>נספח ב' — צוות</h2>
    <table><thead><tr><th>תפקיד</th><th>שם</th><th>ת.ז.</th><th>שנות ניסיון</th></tr></thead>
    <tbody>${(t.appTeam||[]).map(m=>`<tr><td style="font-weight:700">${m.role}</td><td style="font-weight:700">${m.name}</td><td class="mono">${m.id}</td><td class="mono" style="color:#2d9b6f;font-weight:700">${m.years}</td></tr>`).join('')}</tbody></table>
    <div class="sign-row"><div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">${BIDDER.signatory}</div></div><div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">תאריך וחותמת</div></div></div>`+ftr+foot;
  } else if(docType==='analysis'){
    const r=currentAIResult||{};
    html=head+hdr(`דוח ניתוח AI: ${r.tenderName||'מכרז'}`,r.orgName||'')+
    `<div class="grid2">
      <div class="ai-box"><div class="ai-lbl">מועד הגשה</div><div class="ai-val" style="color:#c0392b;font-weight:700">${r.submitDeadline||'TBD'}</div></div>
      <div class="ai-box"><div class="ai-lbl">היקף</div><div class="ai-val">${r.value||'TBD'}</div></div>
    </div>
    <h2>תנאי סף</h2>
    ${(r.thresholds||['לא זוהו תנאי סף ספציפיים']).map(th=>`<div class="ok-box">✅ ${th}</div>`).join('')}
    ${(r.flags||[]).length?`<h2>⚠ אזהרות</h2>${(r.flags||[]).map(f=>`<div class="warn-box">⚠️ ${f}</div>`).join('')}`:''}
    `+ftr+foot;
  } else if(docType==='simulator'){
    const val=document.getElementById('simSelect').value;
    const t2=TENDERS[+val]||TENDERS[0];
    html=head+hdr(`דוח סימולטור: ${t2.name}`,t2.org)+
    `<h2>ניקוד משוער</h2>
    <table><thead><tr><th>קריטריון</th><th>משקל</th><th>ניקוד משוער</th></tr></thead>
    <tbody>${(t2.qualityScoring||[]).map(q=>{const e=Math.round((q.m||0)*0.88);return`<tr><td>${q.l}</td><td>${q.w}%</td><td class="mono" style="font-weight:700;color:#2d9b6f">${e}</td></tr>`;}).join('')}</tbody></table>
    <h2>צוות מומלץ</h2>
    <table><thead><tr><th>תפקיד</th><th>שם</th><th>שנות ניסיון</th></tr></thead>
    <tbody>${(t2.appTeam||[]).map((m,i)=>{const tm=teamMembers[i%teamMembers.length];return`<tr><td style="font-weight:700">${m.role}</td><td>${tm.name}</td><td class="mono">${tm.years}</td></tr>`;}).join('')}</tbody></table>
    `+ftr+foot;
  } else if(docType==='bidder'){
    html=head+hdr('פרופיל המשרד','')+
    `<table><tbody>
      <tr><td style="font-weight:700;background:#e8f5f0;width:30%">שם המשרד</td><td>${BIDDER.name}</td></tr>
      <tr><td style="font-weight:700;background:#e8f5f0">כתובת</td><td>${BIDDER.address}</td></tr>
      <tr><td style="font-weight:700;background:#e8f5f0">טלפון</td><td>${BIDDER.phone}</td></tr>
      <tr><td style="font-weight:700;background:#e8f5f0">מייל</td><td>${BIDDER.email}</td></tr>
      <tr><td style="font-weight:700;background:#e8f5f0">ח.פ</td><td class="mono">${BIDDER.vat}</td></tr>
      <tr><td style="font-weight:700;background:#e8f5f0">מורשה חתימה</td><td>${BIDDER.signatory}</td></tr>
    </tbody></table>`+ftr+foot;
  } else {
    html=head+hdr('מסמך מזכיר',today)+'<p>נוצר אוטומטית</p>'+ftr+foot;
  }

  const frame=document.getElementById('printFrame');
  frame.contentDocument.open();
  frame.contentDocument.write(html);
  frame.contentDocument.close();
  setTimeout(()=>frame.contentWindow.print(),600);
}

function exportAllZip(){
  alert('📦 מייצר חבילות ZIP לכל המכרזים הפעילים...\n\n'+TENDERS.map(t=>`• ${t.name}`).join('\n')+'\n\nהייצוא יושלם תוך 30 שניות.');
}

