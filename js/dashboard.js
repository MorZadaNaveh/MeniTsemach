'use strict';

/* ═════ DASHBOARD ═════ */
function renderDashboard(){
  // Alerts
  const expired = vaultDocs.filter(d=>d.expiry&&d.days<0);
  const warn30  = vaultDocs.filter(d=>d.expiry&&d.days>=0&&d.days<=30);
  const da = document.getElementById('dashAlerts');
  if(da){
    da.innerHTML='';
    if(expired.length>0) da.innerHTML += `<div class="alert ar" style="cursor:pointer;margin-bottom:8px" onclick="goPage('vault',document.getElementById('nav-vault'))">⛔ <strong>${expired.length} מסמכים פגו תוקף!</strong> — לחץ לעדכון מיידי</div>`;
    if(warn30.length>0) da.innerHTML += `<div class="alert aa" style="cursor:pointer;margin-bottom:8px" onclick="goPage('vault',document.getElementById('nav-vault'))">⚠️ <strong>${warn30.length} מסמכים פוגעים תוך 30 יום:</strong> ${warn30.map(d=>d.name).join(', ')}</div>`;
  }
  // Topbar alert
  const ta = document.getElementById('topbarAlert');
  if(ta){
    if(expired.length>0){ta.style.display='flex';ta.textContent='⛔ '+expired.length+' מסמכים פגו תוקף!';}
    else if(warn30.length>0){ta.style.display='flex';ta.textContent='⚠️ '+warn30.length+' מסמכים פוגעים בקרוב';}
    else ta.style.display='none';
  }
  // Vault badge
  const vb = document.getElementById('vaultBadge');
  if(vb) vb.style.display = (expired.length+warn30.length)>0?'inline-flex':'none';

  // Stats
  const ds = document.getElementById('dashStats');
  if(ds) ds.innerHTML = [
    {l:'מכרזים פעילים',v:TENDERS.length,h:'1 דחוף במיוחד',i:'📄',a:'var(--grn2)',ab:'var(--grn-light)'},
    {l:'אחוז זכייה',v:'68%',h:'12 חודשים',i:'🏆',a:'var(--navy)',ab:'var(--bg2)'},
    {l:'שווי זכיות',v:'₪1.84M',h:'שנת 2024',i:'💰',a:'var(--gold)',ab:'var(--gl)'},
    {l:'חברי צוות',v:teamMembers.length,h:'כולם זמינים',i:'👥',a:'var(--blu)',ab:'var(--bbg)'}
  ].map(s=>`<div class="sc" style="--a:${s.a};--ab:${s.ab}"><div class="sc-i">${s.i}</div><div class="sc-v">${s.v}</div><div class="sc-l">${s.l}</div><div class="sc-h">${s.h}</div></div>`).join('');

  // Tender list
  const tl = document.getElementById('dashTenderList');
  if(tl) tl.innerHTML = TENDERS.map(t=>`
    <div class="trow" onclick="openTenderModal(${t.id})">
      <div class="tdot" style="background:${t.status==='urgent'?'var(--red)':t.status==='soon'?'var(--amb)':'var(--grn)'}"></div>
      <div style="flex:1"><div style="font-weight:700;font-size:13px">${t.name}</div><div style="font-size:10.5px;color:var(--s3)">${t.org}</div></div>
      <div style="text-align:center">
        <div style="font-size:9px;color:var(--s3);margin-bottom:1px">סיכוי</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:12px;color:${t.score>=80?'var(--grn)':t.score>=65?'var(--amb)':'var(--red)'}">${t.score}%</div>
      </div>
      <span class="badge ${t.status==='urgent'?'br':t.status==='soon'?'ba':'bgg'}" style="font-size:9.5px">${t.daysLeft<=3?t.daysLeft+'d ⚡':t.daysLeft+'d'}</span>
    </div>`).join('');

  // Doc list
  const dl = document.getElementById('dashDocList');
  if(dl) dl.innerHTML = vaultDocs.slice(0,5).map(d=>{
    const pct = d.expiry?Math.max(0,Math.min(100,(d.days/365)*100)):100;
    const color = d.days<0?'var(--red)':d.days<=30?'var(--red)':d.days<=60?'var(--amb)':'var(--grn)';
    const cls = d.days<0||d.days<=30?'br':d.days<=60?'ba':'bgg';
    const lbl = d.days===999?'ללא תפוגה':d.days<0?'פג תוקף!':'עוד '+d.days+'d';
    return `<div style="display:flex;align-items:center;gap:9px;margin-bottom:9px">
      <div style="font-size:15px;flex-shrink:0">${d.icon}</div>
      <div style="flex:1;min-width:0"><div style="font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.name}</div>
        <div class="prog"><div class="pf" style="width:${pct}%;background:${color}"></div></div></div>
      <span class="badge ${cls}" style="font-size:9px;flex-shrink:0">${lbl}</span>
    </div>`;
  }).join('');

  // Reminders
  const dr = document.getElementById('dashReminders');
  if(dr){
    const reminders = [];
    const u3 = TENDERS.filter(t=>t.daysLeft<=5);
    u3.forEach(t=>reminders.push({t:`הגשת "${t.name}" — עוד ${t.daysLeft} ימים!`,c:'ar'}));
    warn30.forEach(d=>reminders.push({t:`${d.name} — פוגע תוך ${d.days} ימים`,c:'aa'}));
    reminders.push({t:'סיור קבלנים נתניה — 20.03 | 09:00',c:'ab2'});
    dr.innerHTML = reminders.slice(0,4).map(r=>`<div class="alert ${r.c}" style="margin-bottom:5px;font-size:11.5px">🔔 ${r.t}</div>`).join('');
  }
}

