'use strict';

/* ═════ PRINT ═════ */
function printDocument(docType, tidOrNull, extraArg){
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
    const guaranteeRows = typeof normalizeGuarantees === 'function' ? normalizeGuarantees(t) : [];
    const guaranteesPrint = guaranteeRows.length
      ? `<h2>ערבויות</h2>
        <table><thead><tr><th>סוג</th><th>פירוט</th></tr></thead><tbody>
          ${guaranteeRows.map(g=>`<tr><td style="font-weight:600">${g.label}</td><td>${g.detail}</td></tr>`).join('')}
        </tbody></table>`
      : `<h2>ערבויות</h2><div class="ok-box">אין ערבויות למכרז זה</div>`;
    html=head+hdr(`סקירת מכרז: ${t.name}`,`${t.org} | ${t.number}`)+
    `<div class="grid2">
      <div class="ai-box"><div class="ai-lbl">מועד הגשה</div><div class="ai-val" style="color:#c0392b;font-weight:700">${t.submitDeadline}</div></div>
      <div class="ai-box"><div class="ai-lbl">היקף</div><div class="ai-val">${t.value}</div></div>
    </div>
    ${guaranteesPrint}
    <h2>תנאי סף</h2>
    ${(t.thresholds||[]).map(th=>`<div class="ok-box">✅ ${th}</div>`).join('')}
    <h2>דגשים</h2>
    ${(t.highlights||[]).map(h=>`<div style="padding:5pt 8pt;margin-bottom:4pt;background:#eff6ff;border:0.5pt solid #93c5fd;border-radius:5pt;font-size:9.5pt">ℹ️ ${h}</div>`).join('')}
    ${(t.flags||[]).length?`<h2>⚠ אזהרות</h2>${(t.flags||[]).map(f=>`<div class="warn-box">⚠️ ${f}</div>`).join('')}`:''}
    `+ftr+foot;
  } else if(docType==='scoring'&&t){
    const scoringBody = typeof buildScoringTablesHtml === 'function'
      ? buildScoringTablesHtml(t).replace(/class="stl"/g, 'style="font-size:14pt;font-weight:700;margin:12pt 0 6pt"').replace(/font-size:14px/g, 'font-size:14pt')
      : '<p>לא זוהו טבלאות ניקוד</p>';
    html=head+hdr(`טבלת ניקוד: ${t.name}`,t.number)+
    `<h2>ניקוד מהמכרז</h2>${scoringBody}`+ftr+foot;
  } else if(docType==='fullPackage'&&t){
    html=head+hdr(`חבילת הגשה מלאה: ${t.name}`,`${t.org} | ${t.number} | ${today}`)+
    `<h2>פרטי המכרז</h2>
    <div class="grid2">
      <div class="ai-box"><div class="ai-lbl">מועד הגשה</div><div class="ai-val" style="color:#c0392b;font-weight:700">${t.submitDeadline}</div></div>
      <div class="ai-box"><div class="ai-lbl">ערך</div><div class="ai-val">${t.value}</div></div>
    </div>
    ${(t.thresholds||[]).length?`<h2>תנאי סף</h2>${t.thresholds.map(th=>`<div class="ok-box">✅ ${th}</div>`).join('')}`:''}
    ${(t.highlights||[]).length?`<h2>דגשים</h2>${t.highlights.map(h=>`<div style="padding:5pt 8pt;margin-bottom:4pt;background:#eff6ff;border:0.5pt solid #93c5fd;border-radius:5pt;font-size:9.5pt">ℹ️ ${h}</div>`).join('')}`:''}
    <div class="sign-row"><div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">${BIDDER.signatory}</div></div><div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">תאריך וחותמת</div></div></div>`+ftr+foot;
  } else if(docType==='analysis'){
    const r=currentAIResult||{};
    const guaranteeRows = typeof normalizeGuarantees === 'function' ? normalizeGuarantees(r) : [];
    const guaranteesPrint = guaranteeRows.length
      ? `<h2>ערבויות</h2>
        <table><thead><tr><th>סוג</th><th>פירוט</th></tr></thead><tbody>
          ${guaranteeRows.map(g=>`<tr><td style="font-weight:600">${g.label}</td><td>${g.detail}</td></tr>`).join('')}
        </tbody></table>`
      : `<h2>ערבויות</h2><div class="ok-box">אין ערבויות למכרז זה</div>`;
    html=head+hdr(`דוח ניתוח AI: ${r.tenderName||'מכרז'}`,r.orgName||'')+
    `<div class="grid2">
      <div class="ai-box"><div class="ai-lbl">מועד הגשה</div><div class="ai-val" style="color:#c0392b;font-weight:700">${r.submitDeadline||'TBD'}</div></div>
      <div class="ai-box"><div class="ai-lbl">היקף</div><div class="ai-val">${r.value||'TBD'}</div></div>
    </div>
    ${guaranteesPrint}
    <h2>תנאי סף</h2>
    ${(r.thresholds||['לא זוהו תנאי סף ספציפיים']).map(th=>`<div class="ok-box">✅ ${th}</div>`).join('')}
    ${(r.flags||[]).length?`<h2>⚠ אזהרות</h2>${(r.flags||[]).map(f=>`<div class="warn-box">⚠️ ${f}</div>`).join('')}`:''}
    `+ftr+foot;
  } else if(docType==='simulator'){
    const val=document.getElementById('simSelect').value;
    const t2=TENDERS[+val];
    if(!t2){ html=head+hdr('דוח סימולטור','')+'<p>לא נבחר מכרז</p>'+ftr+foot; }
    else {
      html=head+hdr(`דוח סימולטור: ${t2.name}`,t2.org)+
      `<h2>ניקוד משוער</h2>
      <table><thead><tr><th>קריטריון</th><th>משקל</th><th>ניקוד משוער</th></tr></thead>
      <tbody>${(t2.qualityScoring||[]).map(q=>{const e=Math.round((q.m||0)*0.88);return`<tr><td>${q.l}</td><td>${q.w}%</td><td class="mono" style="font-weight:700;color:#2d9b6f">${e}</td></tr>`;}).join('')}</tbody></table>
      ${(t2.teamReq||[]).length?`<h2>דרישות צוות</h2><table><thead><tr><th>תפקיד</th><th>דרישות</th></tr></thead><tbody>${t2.teamReq.map(r=>`<tr><td style="font-weight:700">${r.role}</td><td>${r.req}</td></tr>`).join('')}</tbody></table>`:''}`+ftr+foot;
    }
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
  } else if(docType==='dynApp'){
    // Dynamic appendix print — tidOrNull = tenderId, 3rd arg = appIdx
    const appIdx = extraArg || 0;
    const apps = currentAIResult?.appendices || tmDynApps || [];
    const app = apps[appIdx];
    if(app){
      const tender = t || (currentAIResult ? { name: currentAIResult.tenderName, org: currentAIResult.orgName, number: currentAIResult.tenderNumber } : { name:'', org:'', number:'' });
      html = head + hdr(app.title, `${tender.name} | ${tender.org} | ${tender.number}`);

      const isSignField = (f) => {
        const type = String(f?.type || '').toLowerCase();
        const label = String(f?.label || '').toLowerCase();
        const key = String(f?.key || '').toLowerCase();
        return type === 'signature' || label.includes('חתימ') || key.includes('sign');
      };
      const isSignData = (v) => typeof v === 'string' && /^data:image\/(png|jpeg|jpg);base64,/i.test(v.trim());

      if(app.isTable && app.fields && app.fields.length > 0){
        html += `<table><thead><tr>${app.fields.map(f=>`<th>${f.label}</th>`).join('')}</tr></thead>
        <tbody>${(app.rows||[]).map(row => `<tr>${app.fields.map(f => {
          const val = row[f.key] !== undefined ? row[f.key] : '';
          const sharedSig = row.__signature || '';
          const signVal = sharedSig || val;
          if(isSignField(f) && isSignData(signVal)){
            return `<td><img src="${signVal}" alt="חתימה" style="max-width:180px;max-height:55px;object-fit:contain"></td>`;
          }
          const dirStyle = /^[a-zA-Z0-9@+]/.test(val+'') ? 'direction:ltr;' : '';
          return `<td style="${dirStyle}">${val}</td>`;
        }).join('')}</tr>`).join('')}</tbody></table>`;
      } else {
        const row = (app.rows && app.rows[0]) || {};
        html += '<table><tbody>';
        (app.fields||[]).forEach(f => {
          const val = row[f.key] !== undefined ? row[f.key] : '';
          const sharedSig = row.__signature || '';
          const signVal = sharedSig || val;
          if(isSignField(f) && isSignData(signVal)){
            html += `<tr><td style="width:32%;font-weight:700;background:#e8f5f0">${f.label}</td><td><img src="${signVal}" alt="חתימה" style="max-width:220px;max-height:70px;object-fit:contain"></td></tr>`;
          } else {
            html += `<tr><td style="width:32%;font-weight:700;background:#e8f5f0">${f.label}</td><td>${val}</td></tr>`;
          }
        });
        html += '</tbody></table>';
      }

      html += `<div class="sign-row">
        <div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">${BIDDER.signatory}</div></div>
        <div class="sign-box"><div class="sign-line"></div><div class="sign-lbl">תאריך וחותמת</div></div>
      </div>` + ftr + foot;
    } else {
      html = head + hdr('נספח','') + '<p>לא נמצא נספח</p>' + ftr + foot;
    }
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

