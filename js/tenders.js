'use strict';

function formatScoreDisplay(item){
  const raw = Number(item?.m);
  const hasRaw = Number.isFinite(raw) && raw > 0;
  if (hasRaw) return `${raw} נק'`;
  return '—';
}

function renderTeamFitList(t){
  if(!teamMembers.length){
    return '<div class="alert ab2" style="font-size:12px">אין חברי צוות במאגר עדיין.</div>';
  }

  const reqText = [
    t.type || '',
    ...(t.thresholds || []),
    ...(t.highlights || []),
    ...(t.qualityScoring || []).map(q => `${q.l || ''} ${q.detail || ''}`)
  ].join(' ').toLowerCase();

  const rows = teamMembers.map(m=>{
    const reasons = [];
    const missing = [];
    let score = 0;

    const years = Number(m.years || 0);
    if (years >= 8) { score += 30; reasons.push(`${years} שנות ניסיון`); }
    else if (years >= 5) { score += 22; reasons.push(`${years} שנות ניסיון`); }
    else if (years >= 3) { score += 14; reasons.push(`${years} שנות ניסיון`); }
    else missing.push('ותק נמוך');

    const roleText = `${m.role || ''} ${m.title || ''}`.toLowerCase();
    if (roleText.includes('רו') || roleText.includes('חשבון') || roleText.includes('ביקורת')) {
      score += 25;
      reasons.push('תפקיד/תואר רלוונטי');
    } else {
      missing.push('תפקיד פחות רלוונטי');
    }

    const certs = (m.certs || []).join(' ').toLowerCase();
    if (certs.includes('רו') || certs.includes('cpa')) {
      score += 20;
      reasons.push('הסמכת רו"ח');
    } else {
      missing.push('לא זוהתה הסמכת רו"ח');
    }

    const areas = (m.areas || []).map(a=>String(a).toLowerCase());
    let overlap = 0;
    if (reqText.includes('ביקורת')) overlap += areas.filter(a=>a.includes('ביקורת')).length > 0 ? 1 : 0;
    if (reqText.includes('מקומי') || reqText.includes('רשות')) overlap += areas.filter(a=>a.includes('תקציב') || a.includes('ציבור') || a.includes('ממשלת')).length > 0 ? 1 : 0;
    if (reqText.includes('סיכונים')) overlap += areas.filter(a=>a.includes('סיכונים') || a.includes('ציות')).length > 0 ? 1 : 0;
    score += Math.min(25, overlap * 10);
    if (overlap > 0) reasons.push('חפיפה לתחומי המכרז');
    else missing.push('אין חפיפה ברורה לתחומי המכרז');

    let fitTier = 'low';
    let statusLabel = 'התאמה נמוכה';
    let statusClass = 'br';
    if (score >= 75) {
      fitTier = 'mostly';
      statusLabel = 'התאמה גבוהה';
      statusClass = 'bgg';
    } else if (score >= 50) {
      fitTier = 'partial';
      statusLabel = 'התאמה חלקית';
      statusClass = 'ba';
    }

    return {
      member: m,
      score: Math.min(100, score),
      fitTier,
      statusLabel,
      statusClass,
      reasons: reasons.slice(0,3),
      missing: missing.slice(0,2)
    };
  }).sort((a,b)=>b.score-a.score);

  const groups = [
    {key:'mostly', title:'מתאימים ביותר', rows:rows.filter(r=>r.fitTier==='mostly')},
    {key:'partial', title:'מתאימים חלקית', rows:rows.filter(r=>r.fitTier==='partial')},
    {key:'low', title:'התאמה נמוכה', rows:rows.filter(r=>r.fitTier==='low')}
  ];

  const renderRow = (r, idx)=>`
    <tr>
      <td style="font-weight:700">${idx+1}. ${r.member.name} ${r.member.title||''}</td>
      <td style="font-size:11px;color:var(--s2)">${r.member.role || '—'}</td>
      <td style="text-align:center"><span class="badge ${r.statusClass}" style="font-size:9px">${r.statusLabel}</span></td>
      <td style="font-family:'IBM Plex Mono',monospace;font-weight:800;text-align:center">${r.score}</td>
      <td style="font-size:11px;color:var(--grn)">${r.reasons.join(' · ') || '—'}</td>
      <td style="font-size:11px;color:var(--amb)">${r.missing.join(' · ') || '—'}</td>
    </tr>`;

  return groups.map(g=>`
    <div style="margin-bottom:10px">
      <div style="font-weight:800;font-size:12px;color:var(--navy);margin-bottom:5px">${g.title} (${g.rows.length})</div>
      ${g.rows.length ? `
        <div style="overflow-x:auto">
          <table class="atable">
            <thead><tr><th>חבר צוות</th><th>תפקיד</th><th>סטטוס</th><th>ציון</th><th>למה מתאים</th><th>מה חסר</th></tr></thead>
            <tbody>${g.rows.map((r,i)=>renderRow(r,i)).join('')}</tbody>
          </table>
        </div>
      ` : '<div class="alert ab2" style="font-size:11px">אין חברי צוות בקטגוריה זו</div>'}
    </div>
  `).join('');
}

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
    [['overview','סקירה'],['scoring','ניקוד'],['fit','התאמת צוות'],['team','צוות'],['appendix','נספחים'],['export','📦 ZIP']].map(([v,l])=>
      `<div class="atab ${tmTab===v?'on':''}" onclick="switchTmTab('${v}')">${l}</div>`
    ).join('');
  const body = document.getElementById('tmBody');
  if(tmTab==='overview') body.innerHTML = buildOverviewTab(t);
  else if(tmTab==='scoring') body.innerHTML = buildScoringTab(t);
  else if(tmTab==='fit') body.innerHTML = buildFitTab(t);
  else if(tmTab==='team') body.innerHTML = buildTeamTab(t);
  else if(tmTab==='appendix'){ renderTmAppendixTab(body, t); }
  else if(tmTab==='export') body.innerHTML = buildExportTab(t);
}

function switchTmTab(tab){ tmTab=tab; renderTenderModal(); }

/* ── Dynamic appendices in tender modal ── */
let tmDynApps = null;

function renderTmAppendixTab(body, t){
  body.innerHTML = '<div style="text-align:center;padding:20px"><span class="spn"></span> טוען נספחים...</div>';
  loadAppendices(tmId).then(appendices => {
    if(appendices && appendices.length > 0){
      tmDynApps = appendices;
      body.innerHTML = `
        <div class="alert ag2" style="margin-bottom:12px">✨ ${appendices.length} נספחים — ממולאים אוטומטית מנתוני המשרד</div>
        <div class="atabs" id="tmAppTabsRow" style="flex-wrap:wrap;gap:4px">
          ${appendices.map((app, i) =>
            `<div class="atab ${i===0?'on':''}" onclick="switchTmDynApp(${i})">${app.title}</div>`
          ).join('')}
        </div>
        <div id="tmAppContent"></div>`;
      renderTmDynApp(0);
    } else {
      tmDynApps = null;
      body.innerHTML = '<div class="alert ab2" style="font-size:12px">לא זוהו נספחים למילוי במכרז זה. העלה את המכרז לניתוח AI כדי לזהות נספחים.</div>';
    }
  }).catch(() => {
    tmDynApps = null;
    body.innerHTML = '<div class="alert ab2" style="font-size:12px">לא זוהו נספחים למילוי במכרז זה. העלה את המכרז לניתוח AI כדי לזהות נספחים.</div>';
  });
}

function switchTmDynApp(idx){
  document.querySelectorAll('#tmAppTabsRow .atab').forEach((el, i) => {
    el.className = 'atab' + (i === idx ? ' on' : '');
  });
  renderTmDynApp(idx);
}

function renderTmDynApp(idx){
  const ac = document.getElementById('tmAppContent');
  if(!ac || !tmDynApps || !tmDynApps[idx]) return;
  // Reuse the shared builder from analysis.js, but with modal-specific context
  const app = tmDynApps[idx];
  const t = TENDERS[tmId];
  const savedResult = currentAIResult;
  // Temporarily set context for buildDynAppHtml
  currentAIResult = currentAIResult || {};
  currentAIResult.tenderName = t.name;
  currentAIResult.orgName = t.org;
  currentAIResult.tenderNumber = t.number;
  currentAIResult.appendices = tmDynApps;
  currentAnalysisIdx = tmId;
  ac.innerHTML = buildDynAppHtml(app, idx, tmId);
  // Restore
  if(savedResult) currentAIResult = savedResult;
}

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
  const quality = (t.qualityScoring||[]).map(q=>{
    const wNum = parseInt(String(q.w||'').replace('%',''), 10);
    const m = Number.isFinite(+q.m) && +q.m > 0 ? +q.m : (Number.isFinite(wNum) ? wNum : 0);
    const estimated = m > 0 ? Math.round(m * 0.88) : 0;
    return { ...q, m, estimated, wLabel: q.w || (m ? `${m}%` : '') };
  });
  const sc = quality.reduce((a,q)=>a+q.estimated,0);
  return `
    <div class="stl">תנאי סף — בינארי</div>
    ${t.thresholds.map(th=>`<div class="thresh-ok"><span style="color:var(--grn);flex-shrink:0">✅</span><span style="font-size:12.5px">${th}</span></div>`).join('')}
    <div class="stl" style="margin-top:14px">ניקוד איכותי (סעיפים)</div>
    ${quality.length ? quality.map((q,i)=>`
      <div style="display:grid;grid-template-columns:1fr 90px;gap:10px;border:1px solid var(--s5);border-radius:10px;padding:10px 11px;margin-bottom:8px;background:var(--w)">
        <div>
          <div style="font-weight:700;font-size:12.5px;color:var(--navy);margin-bottom:4px">${i+1}. ${q.l}</div>
          <div style="font-size:11.5px;line-height:1.55;color:var(--s2)">${q.detail || 'אין פירוט נוסף'}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:center">
          <div style="text-align:center;background:var(--grn-light);border:1px solid var(--grn-border);border-radius:9px;padding:8px 6px;min-width:74px">
            <div style="font-size:9px;color:var(--s3);margin-bottom:1px">ניקוד</div>
            <div style="font-family:'IBM Plex Mono',monospace;font-weight:800;font-size:13px;color:var(--grn)">${formatScoreDisplay(q)}</div>
          </div>
        </div>
      </div>
    `).join('') : '<div class="alert ab2" style="font-size:12px">לא זוהו מדדי ניקוד במכרז</div>'}
    <div class="alert ag2" style="margin-top:8px">סה"כ ניקוד איכותי משוער: <strong>${sc}</strong></div>
    <div style="display:flex;justify-content:flex-end;margin-top:9px">
      <button class="btn bo sm" onclick="printDocument('scoring',${t.id})"><svg width="12" height="12"><use href="#ic-print"/></svg> הדפס</button>
    </div>`;
}

function buildFitTab(t){
  return `
    <div class="alert ag2" style="margin-bottom:10px">התאמה מחושבת לפי ותק, תפקיד/תואר, הסמכות וחפיפה לתחומי המכרז.</div>
    ${renderTeamFitList(t)}
    <div style="display:flex;justify-content:flex-end;margin-top:9px">
      <button class="btn bo sm" onclick="printDocument('team',${t.id})"><svg width="12" height="12"><use href="#ic-print"/></svg> הדפס</button>
    </div>`;
}

function buildTeamTab(t){
  if(!(t.teamReq||[]).length) return '<div class="alert ab2" style="font-size:12px">לא זוהו דרישות צוות במכרז זה.</div>';
  return `
    <div class="stl">הרכב הצוות הנדרש</div>
    <table class="atable">
      <thead><tr><th>תפקיד</th><th>דרישות</th><th>מוצע</th><th>התאמה</th></tr></thead>
      <tbody>${t.teamReq.map((r,i)=>{const m=teamMembers.length>0?teamMembers[i%teamMembers.length]:null;return`<tr><td style="font-weight:700">${r.role}</td><td style="font-size:11px;color:var(--s1)">${r.req}</td><td>${m?`<div style="display:flex;align-items:center;gap:7px"><div style="width:22px;height:22px;border-radius:5px;background:${m.color};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff;flex-shrink:0">${m.ini}</div><div><div style="font-size:12px;font-weight:700">${m.name} ${m.title||''}</div><div style="font-size:9.5px;color:var(--s3)">${m.years} שנות ניסיון</div></div></div>`:'<span style="font-size:11px;color:var(--s3)">לא שובץ</span>'}</td><td>${m?'<span class="badge bgg" style="font-size:9px">✓</span>':'<span class="badge br" style="font-size:9px">—</span>'}</td></tr>`;}).join('')}</tbody>
    </table>`;
}


function buildExportTab(t){
  // Build file list dynamically from vault docs
  const files = [];
  files.push({n:`00_עמוד_שער_${t.org.replace(/\s/g,'_')}.pdf`,e:'📄'});
  files.push({n:'01_הצעת_מציע.pdf',e:'📋'});
  vaultDocs.forEach((d, i) => {
    files.push({n:`${String(i+2).padStart(2,'0')}_${d.name.replace(/\s/g,'_')}.pdf`,e:d.icon||'📄'});
  });
  return `
    <div style="background:var(--grn-light);border:1px solid var(--grn-border);border-radius:10px;padding:12px 15px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:22px">📦</div>
        <div><div style="font-weight:800;font-size:14px">${t.name} — חבילת הגשה מלאה</div><div style="font-size:11px;color:var(--s2);margin-top:1px">${t.org} · ${t.number} · ${files.length} מסמכים</div></div>
        <div style="margin-right:auto;display:flex;gap:6px">
          <button class="btn bp sm" id="zipBtn_${t.id}" onclick="simulateZip(${t.id})"><svg width="11" height="11"><use href="#ic-zip"/></svg> ייצא ZIP</button>
        </div>
      </div>
      <div id="zipProgress_${t.id}" style="margin-top:10px;display:none"></div>
    </div>
    ${files.length > 0 ? `<div class="stl">תוכן החבילה</div>
    <div class="zip-wrap">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px">
        <span>🗂️</span>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:rgba(255,255,255,.8)">Mazkir_${t.org.replace(/\s/g,'_')}_${t.id}.zip</span>
      </div>
      ${files.map(f=>`<div class="zip-file"><span style="font-size:12px;flex-shrink:0">${f.e}</span><span class="zip-fn">${f.n}</span><span class="badge bgg" style="font-size:8px;flex-shrink:0">מוכן</span></div>`).join('')}
      <div style="margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between">
        <span style="font-size:9.5px;color:rgba(255,255,255,.35)">סה"כ ${files.length} קבצים</span>
      </div>
    </div>` : '<div class="alert ab2" style="font-size:12px">אין מסמכים בתיקיית המציע. הוסף מסמכי יסוד כדי לייצר חבילת הגשה.</div>'}
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

