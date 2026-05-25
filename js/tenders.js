'use strict';

/* ═════ TENDERS TABLE ═════ */
function renderTenderTable(){
  const list = tenderFilter==='all'?TENDERS:TENDERS.filter(t=>t.status===tenderFilter);
  const sc = s=>s>=80?'var(--grn)':s>=65?'var(--amb)':'var(--red)';
  const bc = s=>s==='urgent'?'br':s==='soon'?'ba':'bgg';
  const dl = t=>t.daysLeft<=0?'היום!':t.daysLeft<=3?`${t.daysLeft}d ⚡`:`${t.daysLeft} ימים`;
  const body = document.getElementById('tenderTableBody');
  if(!body) return;
  body.innerHTML = list.map(t=>`
    <div onclick="openTenderModal(${t.id})"
      style="display:grid;grid-template-columns:auto 1fr 100px 110px 80px 70px;gap:0 11px;align-items:center;padding:10px 18px;border-bottom:1px solid var(--s5);cursor:pointer;transition:background .11s"
      onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
      <div class="tdot" style="background:${t.status==='urgent'?'var(--red)':t.status==='soon'?'var(--amb)':'var(--grn)'}"></div>
      <div><div style="font-weight:700;font-size:13px">${t.name}</div><div style="font-size:10.5px;color:var(--s3);margin-top:1px">${t.org} · ${t.type}</div></div>
      <div style="text-align:center;font-weight:700;font-size:12.5px">${t.value}</div>
      <div style="text-align:center">
        <div style="font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:13px;color:${sc(t.score)}">${t.score}%</div>
        <div class="prog" style="width:65px;margin:2px auto 0"><div class="pf" style="width:${t.score}%;background:${sc(t.score)}"></div></div>
      </div>
      <div style="text-align:center"><span class="badge ${bc(t.status)}" style="font-size:9.5px">${dl(t)}</span></div>
      <div style="display:flex;gap:4px;justify-content:flex-end">
        <div class="ib sm" onclick="event.stopPropagation();openTenderModal(${t.id})">📄</div>
        <div class="ib sm" onclick="event.stopPropagation();openTenderModalTab(${t.id},'export')">📦</div>
      </div>
    </div>`).join('');
}

function renderTenderCards(){
  const list = tenderFilter==='all'?TENDERS:TENDERS.filter(t=>t.status===tenderFilter);
  const container = document.getElementById('tenderCardList');
  if(!container) return;
  container.innerHTML = list.map(t=>{
    const sc = t.score>=80?'var(--grn)':t.score>=65?'var(--amb)':'var(--red)';
    const bc = t.status==='urgent'?'br':t.status==='soon'?'ba':'bgg';
    return `<div onclick="openTenderModal(${t.id})" style="background:var(--w);border:1px solid var(--s5);border-radius:12px;padding:14px;margin-bottom:10px;box-shadow:var(--sh1)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
        <div style="flex:1">
          <div style="font-weight:800;font-size:14px;color:var(--navy);margin-bottom:2px">${t.name}</div>
          <div style="font-size:11.5px;color:var(--s2)">${t.org} · ${t.type}</div>
        </div>
        <span class="badge ${bc}" style="margin-right:8px;flex-shrink:0;font-size:10px">${t.daysLeft<=3?t.daysLeft+'d ⚡':t.daysLeft+' ימים'}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 11px;background:var(--bg2);border-radius:8px;margin-bottom:10px">
        <div style="text-align:center">
          <div style="font-size:9px;color:var(--s3);margin-bottom:2px">סיכוי זכייה</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:16px;color:${sc}">${t.score}%</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:9px;color:var(--s3);margin-bottom:2px">ערך</div>
          <div style="font-weight:700;font-size:13px">${t.value}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:9px;color:var(--s3);margin-bottom:2px">מועד הגשה</div>
          <div style="font-size:11.5px;font-weight:600;color:var(--red)">${t.submitDeadline.split('|')[0].trim()}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn bp sm" style="flex:1;justify-content:center" onclick="event.stopPropagation();openTenderModal(${t.id})">📄 פרטים</button>
        <button class="btn bo sm" style="flex:1;justify-content:center" onclick="event.stopPropagation();openTenderModalTab(${t.id},'export')">📦 ZIP</button>
      </div>
    </div>`;
  }).join('');
}

function filterTenders(f,el){
  tenderFilter=f;
  document.querySelectorAll('#tenderFilterTabs .tab').forEach(t=>t.classList.remove('on'));
  if(el) el.classList.add('on');
  renderTenderTable();
  renderTenderCards();
}

/* ═════ TENDER MODAL ═════ */
function openTenderModal(id){ openTenderModalTab(id,'overview'); }
function openTenderModalTab(id,tab){ tmId=id; tmTab=tab; tmAppTab='exp'; renderTenderModal(); openModal('tenderModal'); }

function renderTenderModal(){
  const t = TENDERS[tmId];
  // Header
  document.getElementById('tmHeader').innerHTML = `
    <div style="background:var(--grn);padding:14px 18px;border-radius:16px 16px 0 0">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div>
          <div style="font-size:9px;color:rgba(255,255,255,.45);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:3px">${t.number}</div>
          <div style="font-weight:800;font-size:15.5px;color:#fff;margin-bottom:2px">${t.name}</div>
          <div style="font-size:11px;color:rgba(255,255,255,.55)">${t.org} · ${t.type} · ${t.value}</div>
        </div>
        <div style="display:flex;gap:7px;align-items:center">
          <span class="badge ${t.status==='urgent'?'br':t.status==='soon'?'ba':'bgg'}">${t.daysLeft<=3?t.daysLeft+'d ⚡':t.daysLeft+' ימים'}</span>
          <div class="ib" style="background:rgba(255,255,255,.12);border:none;color:#fff;width:30px;height:30px" onclick="closeModal('tenderModal')"><svg width="14" height="14"><use href="#ic-x"/></svg></div>
        </div>
      </div>
      <div style="height:2px;background:linear-gradient(90deg,rgba(255,255,255,.4),rgba(255,255,255,.1));margin-top:10px;border-radius:2px"></div>
    </div>`;
  // Tabs
  document.getElementById('tmTabs').innerHTML =
    [['overview','סקירה'],['scoring','ניקוד'],['team','צוות'],['appendix','נספחים'],['export','📦 ZIP']].map(([v,l])=>
      `<div class="atab ${tmTab===v?'on':''}" onclick="switchTmTab('${v}')">${l}</div>`
    ).join('');
  const body = document.getElementById('tmBody');
  if(tmTab==='overview') body.innerHTML = buildOverviewTab(t);
  else if(tmTab==='scoring') body.innerHTML = buildScoringTab(t);
  else if(tmTab==='team') body.innerHTML = buildTeamTab(t);
  else if(tmTab==='appendix'){ body.innerHTML = buildAppShell(); renderAppContent(t); }
  else if(tmTab==='export') body.innerHTML = buildExportTab(t);
}

function switchTmTab(tab){ tmTab=tab; renderTenderModal(); }
function switchAppTab(tab){ tmAppTab=tab; renderAppContent(TENDERS[tmId]); }

function buildOverviewTab(t){
  return `
    <div class="agrid">
      <div class="ai"><div class="ail">מועד הגשה</div><div class="aiv" style="color:var(--red);font-weight:700">${t.submitDeadline}</div></div>
      <div class="ai"><div class="ail">שאלות הבהרה</div><div class="aiv">${t.questionsDeadline}</div></div>
      <div class="ai"><div class="ail">סיור קבלנים</div><div class="aiv">${t.tourDate}</div></div>
      <div class="ai"><div class="ail">פתיחת מעטפות</div><div class="aiv">${t.openDate}</div></div>
      <div class="ai"><div class="ail">היקף כספי</div><div class="aiv">${t.value}</div></div>
      <div class="ai"><div class="ail">משך</div><div class="aiv">${t.duration}</div></div>
      <div class="ai"><div class="ail">זוכים</div><div class="aiv">${t.winners}</div></div>
      <div class="ai"><div class="ail">ביטוחים</div><div class="aiv">${t.insurance}</div></div>
    </div>
    <div class="stl">ערבויות</div>
    <div class="agrid" style="margin-top:0">
      <div class="ai"><div class="ail">ערבות מכרז</div><div class="aiv">${t.tenderBond}</div></div>
      <div class="ai"><div class="ail">ערבות ביצוע</div><div class="aiv">${t.performanceBond}</div></div>
      <div class="ai" style="grid-column:span 2"><div class="ail">ערבות אחריות</div><div class="aiv">${t.liabilityBond}</div></div>
    </div>
    <div class="stl">היקף העבודה</div>
    <div style="background:var(--bg2);border:1px solid var(--s5);border-radius:8px;padding:9px 12px;font-size:13px;line-height:1.6">${t.scope}</div>
    <div class="stl">דגשים חשובים</div>
    ${t.highlights.map(h=>`<div class="alert ab2" style="margin-bottom:5px;font-size:11.5px">ℹ️ ${h}</div>`).join('')}
    ${t.flags.length?`<div class="stl" style="color:var(--amb)">⚠ אזהרות</div>${t.flags.map(f=>`<div class="alert aa" style="margin-bottom:5px;font-size:11.5px">⚠️ ${f}</div>`).join('')}`:''}
    <div style="display:flex;justify-content:flex-end;margin-top:11px">
      <button class="btn bo sm" onclick="printDocument('overview',${t.id})"><svg width="12" height="12"><use href="#ic-print"/></svg> הדפס</button>
    </div>`;
}

function buildScoringTab(t){
  const sc = t.qualityScoring.reduce((a,q)=>a+Math.round(q.m*0.88),0);
  return `
    <div class="stl">תנאי סף — בינארי</div>
    ${t.thresholds.map(th=>`<div class="thresh-ok"><span style="color:var(--grn);flex-shrink:0">✅</span><span style="font-size:12.5px">${th}</span></div>`).join('')}
    <div class="stl" style="margin-top:14px">ניקוד איכותי</div>
    <table class="atable">
      <thead><tr><th>קריטריון</th><th>משקל</th><th>מקסימום</th><th>ניקוד משוער</th></tr></thead>
      <tbody>
        ${t.qualityScoring.map(q=>{const e=Math.round(q.m*0.88);return`<tr><td style="font-weight:600">${q.l}</td><td>${q.w}%</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700">${q.m}</td><td><div style="display:flex;align-items:center;gap:7px"><div style="flex:1"><div class="prog"><div class="pf" style="width:${(e/q.m)*100}%;background:linear-gradient(90deg,var(--grn),var(--grn3))"></div></div></div><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:700;color:var(--grn)">${e}</span></div></td></tr>`;}).join('')}
        <tr style="background:var(--grn-light)"><td style="font-weight:800">סה"כ</td><td style="font-weight:700">100%</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700">100</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--grn)">${sc}</td></tr>
      </tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:9px">
      <button class="btn bo sm" onclick="printDocument('scoring',${t.id})"><svg width="12" height="12"><use href="#ic-print"/></svg> הדפס</button>
    </div>`;
}

function buildTeamTab(t){
  return `
    <div class="stl">הרכב הצוות הנדרש</div>
    <table class="atable">
      <thead><tr><th>תפקיד</th><th>דרישות</th><th>מוצע</th><th>התאמה</th></tr></thead>
      <tbody>${t.teamReq.map((r,i)=>{const m=teamMembers[i%teamMembers.length];return`<tr><td style="font-weight:700">${r.role}</td><td style="font-size:11px;color:var(--s1)">${r.req}</td><td><div style="display:flex;align-items:center;gap:7px"><div style="width:22px;height:22px;border-radius:5px;background:${m.color};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff;flex-shrink:0">${m.ini}</div><div><div style="font-size:12px;font-weight:700">${m.name} ${m.title}</div><div style="font-size:9.5px;color:var(--s3)">${m.years} שנות ניסיון</div></div></div></td><td><span class="badge bgg" style="font-size:9px">✓</span></td></tr>`;}).join('')}</tbody>
    </table>`;
}

function buildAppShell(){
  return `<div class="atabs" id="appTabsRow">
    ${[['exp',"נספח א' — ניסיון"],['team',"נספח ב' — קורות חיים"],['decl',"נספח ג' — הצהרות"]].map(([v,l])=>
      `<div class="atab ${tmAppTab===v?'on':''}" onclick="switchAppTab('${v}')">${l}</div>`
    ).join('')}
  </div><div id="appendixContent"></div>`;
}

function renderAppContent(t){
  document.querySelectorAll('#appTabsRow .atab').forEach((el,i)=>{
    el.className='atab'+(['exp','team','decl'][i]===tmAppTab?' on':'');
  });
  const ac = document.getElementById('appendixContent');
  if(!ac) return;
  if(tmAppTab==='exp') ac.innerHTML = buildAppExp(t);
  else if(tmAppTab==='team') ac.innerHTML = buildAppTeam(t);
  else if(tmAppTab==='decl') ac.innerHTML = buildAppDecl(t);
}

function buildAppExp(t){
  return `<div class="adoc">
    <div class="adoch">
      <div class="seal">נספח<br>א'</div>
      <div style="flex:1"><div class="adocht">נספח א' — ניסיון המשרד</div><div class="adochs">${t.name} | ${t.org} | ${t.number}</div></div>
      <button class="btn bo sm" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff" onclick="printDocument('appExp',${t.id})"><svg width="11" height="11"><use href="#ic-print"/></svg> הדפס</button>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,rgba(255,255,255,.3),rgba(255,255,255,.1))"></div>
    <div style="padding:12px 16px">
      <div style="margin-bottom:9px">
        <div style="font-weight:800;font-size:13px;color:var(--navy)">${BIDDER.name} — ${BIDDER.subtitle}</div>
        <div style="font-size:10.5px;color:var(--s2)">${BIDDER.address} | ${BIDDER.phone} | ${BIDDER.email}</div>
      </div>
      <div style="overflow-x:auto"><table class="atable">
        <thead><tr><th>#</th><th>לקוח</th><th>שנים</th><th>תחום</th><th>היקף שנתי</th><th>שעות</th><th>איש קשר</th><th>נייד</th><th>מייל</th></tr></thead>
        <tbody>${t.appExp.map((e,i)=>`<tr><td style="color:var(--grn);font-weight:700">${i+1}</td><td style="font-weight:700">${e.client}</td><td style="font-family:'IBM Plex Mono',monospace;font-size:10px">${e.years}</td><td style="font-size:10.5px">${e.area}</td><td style="font-weight:700">${e.scope}</td><td style="font-family:'IBM Plex Mono',monospace;font-size:10px">${e.hours}</td><td style="font-size:10px">${e.contact}</td><td style="font-family:'IBM Plex Mono',monospace;font-size:9.5px;direction:ltr">${e.mobile}</td><td style="font-size:9.5px;direction:ltr">${e.email}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="wm">מזכיר Tender Intelligence | נוצר ${new Date().toLocaleDateString('he-IL')} | סודי</div>
    </div>
  </div>`;
}

function buildAppTeam(t){
  return `<div class="adoc">
    <div class="adoch">
      <div class="seal">נספח<br>ב'</div>
      <div style="flex:1"><div class="adocht">נספח ב' — קורות חיים הצוות</div><div class="adochs">${t.name} | ${t.org}</div></div>
      <button class="btn bo sm" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff" onclick="printDocument('appTeam',${t.id})"><svg width="11" height="11"><use href="#ic-print"/></svg> הדפס</button>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,rgba(255,255,255,.3),rgba(255,255,255,.1))"></div>
    <div style="padding:12px 16px">
      ${t.appTeam.map((m,i)=>{
        const ini=m.name.split(' ').slice(0,2).map(w=>w[0]).join('');
        return `<div style="background:${i%2===0?'var(--w)':'var(--bg2)'};border:1px solid var(--s5);border-radius:8px;padding:10px 12px;margin-bottom:7px">
          <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px">
            <div style="width:30px;height:30px;border-radius:7px;background:var(--grn);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0">${ini}</div>
            <div style="flex:1"><div style="font-weight:800;font-size:13px">${m.name}</div><div style="font-size:10.5px;color:var(--s2)">${m.role}</div></div>
            <span class="badge bn">ת.ז. ${m.id}</span>
          </div>
          <table class="atable" style="margin-bottom:0"><tbody>
            <tr><td style="width:28%;font-weight:700;background:var(--bg2);font-size:10px">שנות ניסיון</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700;color:var(--grn)">${m.years} שנים</td></tr>
            <tr><td style="font-weight:700;background:var(--bg2);font-size:10px">הסמכות</td><td style="font-size:11.5px">${m.certs}</td></tr>
            <tr><td style="font-weight:700;background:var(--bg2);font-size:10px">תחומי ניסיון</td><td style="font-size:11.5px">${m.areas}</td></tr>
          </tbody></table>
        </div>`;
      }).join('')}
      <div class="wm">מזכיר | ${new Date().toLocaleDateString('he-IL')}</div>
    </div>
  </div>`;
}

function buildAppDecl(t){
  const secs=[
    {title:"הצהרת המציע",rows:[["שם המציע",BIDDER.name],["ח.פ / ע.מ",BIDDER.vat],["כתובת",BIDDER.address],["מורשי חתימה",BIDDER.signatory],["הצהרה","כל הפרטים בהצעה נכונים ומדויקים"]]},
    {title:"הצהרת ניגוד עניינים",rows:[["ניגוד עניינים?","לא"],["עבודה קודמת ב-3 שנים?","לא"],["הצהרה","אין מניעה לביצוע העבודה"]]},
    {title:"הצהרת סודיות",rows:[["מחויבות","שמירה על סודיות כל המידע"],["תוקף","לאורך כל תקופת ההסכם ו-5 שנים"]]},
    {title:"אישור ניהול תקין",rows:[["סטטוס","פעיל — תוקף עד 31.12.2025"],["מספר","NIT-2025-123456"]]}
  ];
  return `<div class="adoc">
    <div class="adoch">
      <div class="seal">נספח<br>ג'</div>
      <div style="flex:1"><div class="adocht">נספח ג' — הצהרות ותצהירים</div><div class="adochs">${t.name} | ${t.number}</div></div>
      <button class="btn bo sm" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff" onclick="printDocument('appDecl',${t.id})"><svg width="11" height="11"><use href="#ic-print"/></svg> הדפס</button>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,rgba(255,255,255,.3),rgba(255,255,255,.1))"></div>
    <div style="padding:12px 16px">
      ${secs.map(s=>`<div style="margin-bottom:11px">
        <div style="font-weight:800;font-size:12.5px;color:var(--navy);margin-bottom:5px;padding-bottom:4px;border-bottom:1px solid var(--s5)">${s.title}</div>
        <table class="atable" style="margin-bottom:0"><tbody>${s.rows.map(([k,v])=>`<tr><td style="width:36%;font-weight:700;background:var(--bg2);font-size:10px">${k}</td><td style="font-size:12px">${v}</td></tr>`).join('')}</tbody></table>
      </div>`).join('')}
      <div style="margin-top:12px;padding:10px 12px;background:var(--grn-light);border:1px solid var(--grn-border);border-radius:8px">
        <div style="font-size:11px;font-weight:700;color:var(--navy);margin-bottom:8px">חתימה ואישור</div>
        <div style="display:flex;gap:20px">
          ${[BIDDER.signatory,'תאריך וחותמת'].map(l=>`<div style="text-align:center"><div style="width:100px;height:36px;border:1.5px dashed var(--grn-border);border-radius:5px;margin-bottom:4px"></div><div style="font-size:9.5px;color:var(--s2)">${l}</div></div>`).join('')}
        </div>
      </div>
      <div class="wm">מזכיר Tender Intelligence | ${new Date().toLocaleDateString('he-IL')}</div>
    </div>
  </div>`;
}

function buildExportTab(t){
  const files=[
    {n:`00_עמוד_שער_${t.org.replace(/\s/g,'_')}.pdf`,s:'42 KB',e:'📄'},
    {n:'01_הצעת_מציע_ממולאת.pdf',s:'118 KB',e:'📋'},
    {n:"02_נספח_א_ניסיון_המשרד.pdf",s:'156 KB',e:'📊'},
    {n:"03_נספח_ב_קורות_חיים.pdf",s:'203 KB',e:'👤'},
    {n:"04_נספח_ג_הצהרות.pdf",s:'88 KB',e:'✍️'},
    {n:'05_אישור_ניהול_תקין.pdf',s:'34 KB',e:'⚖️'},
    {n:'06_ניכוי_במקור.pdf',s:'28 KB',e:'🧾'},
    {n:'07_ניהול_ספרים.pdf',s:'31 KB',e:'🧾'},
    {n:'08_ביטוח_מקצועי.pdf',s:'52 KB',e:'🛡️'},
    {n:"09_ביטוח_צד_ג.pdf",s:'49 KB',e:'🛡️'},
    {n:'10_תעודת_רישום.pdf',s:'22 KB',e:'📜'},
    {n:'11_רישיון_עסק.pdf',s:'19 KB',e:'📜'}
  ];
  return `
    <div style="background:var(--grn-light);border:1px solid var(--grn-border);border-radius:10px;padding:12px 15px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:22px">📦</div>
        <div><div style="font-weight:800;font-size:14px">${t.name} — חבילת הגשה מלאה</div><div style="font-size:11px;color:var(--s2);margin-top:1px">${t.org} · ${t.number} · ${files.length} מסמכים</div></div>
        <div style="margin-right:auto;display:flex;gap:6px">
          <button class="btn bo sm" onclick="printDocument('fullPackage',${t.id})"><svg width="11" height="11"><use href="#ic-print"/></svg> הדפס</button>
          <button class="btn bp sm" id="zipBtn_${t.id}" onclick="simulateZip(${t.id})"><svg width="11" height="11"><use href="#ic-zip"/></svg> ייצא ZIP</button>
        </div>
      </div>
      <div id="zipProgress_${t.id}" style="margin-top:10px;display:none"></div>
    </div>
    <div class="stl">תוכן החבילה</div>
    <div class="zip-wrap">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">
        <span>🗂️</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:rgba(255,255,255,.8)">Mazkir_${t.org.replace(/\s/g,'_')}_${t.id}.zip</span>
      </div>
      ${files.map(f=>`<div class="zip-file"><span style="font-size:12px;flex-shrink:0">${f.e}</span><span class="zip-fn">${f.n}</span><span class="zip-fs">${f.s}</span><span class="badge bgg" style="font-size:8px;flex-shrink:0">מוכן</span></div>`).join('')}
      <div style="margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between">
        <span style="font-size:9.5px;color:rgba(255,255,255,.35)">סה"כ ${files.length} קבצים</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:rgba(255,255,255,.8)">∼ 846 KB</span>
      </div>
    </div>
    <div class="wm" style="margin-top:7px">מזכיר | ${new Date().toLocaleDateString('he-IL')}</div>`;
}

function simulateZip(tid){
  const btn=document.getElementById('zipBtn_'+tid);
  const prog=document.getElementById('zipProgress_'+tid);
  if(!prog) return;
  prog.style.display='block';
  btn.disabled=true;btn.innerHTML='<span class="spn"></span> מכין...';
  const steps=['ממלא הצעת מציע...','מייצר נספח ניסיון...','מחבר קורות חיים...','צורף מסמכי יסוד...','דוחס ל-ZIP...'];
  prog.innerHTML='';
  let i=0;
  const iv=setInterval(()=>{
    if(i<steps.length){
      prog.innerHTML+=`<div style="display:flex;gap:8px;align-items:center;margin-bottom:5px"><div style="width:12px;height:12px;border-radius:50%;background:var(--grn2);flex-shrink:0"></div><div style="font-size:11.5px;color:var(--s2)">${steps[i]}</div></div>`;
      i++;
    }else{
      clearInterval(iv);
      btn.disabled=false;btn.innerHTML='✅ ZIP מוכן';
      btn.className='btn bgg sm';
    }
  },450);
}

