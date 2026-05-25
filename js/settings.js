'use strict';

/* ═════ SETTINGS ═════ */
function saveSettings(){
  BIDDER.name=document.getElementById('setFirm').value;
  BIDDER.address=document.getElementById('setAddr').value;
  BIDDER.phone=document.getElementById('setPhone').value;
  BIDDER.email=document.getElementById('setEmail').value;
  BIDDER.vat=document.getElementById('setVat').value;
  BIDDER.signatory=document.getElementById('setSign').value;
  const d=document.createElement('div');d.className='alert ag2';d.style.marginTop='8px';d.innerHTML='✅ הגדרות נשמרו בהצלחה!';
  document.getElementById('setFirm').closest('.card').appendChild(d);
  setTimeout(()=>d.remove(),3000);
}

function renderUsers(){
  const g=document.getElementById('usersGrid');if(!g) return;
  [['יוסי כהן','מנהל','var(--grn)'],['מירי לוי','עורכת','var(--navy)'],['דניאל ברק','צופה','var(--s2)']].forEach(([n,r,c])=>{
    const div=document.createElement('div');
    div.style.cssText='display:flex;align-items:center;gap:7px;padding:6px 9px;background:var(--bg2);border:1px solid var(--s5);border-radius:7px;margin-bottom:5px';
    div.innerHTML=`<div style="width:24px;height:24px;border-radius:6px;background:${c};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:${c==='var(--grn)'?'#fff':'#fff'};flex-shrink:0">${n[0]}</div><div style="flex:1;font-size:12.5px;font-weight:600">${n}</div><span class="badge bn" style="font-size:9px">${r}</span>`;
    g.appendChild(div);
  });
}

/* ═════ NEW TENDER ═════ */
function saveNewTender(){
  const name=document.getElementById('ntName').value.trim();
  const org=document.getElementById('ntOrg').value.trim();
  const deadline=document.getElementById('ntDeadline').value;
  if(!name||!org||!deadline){alert('נא למלא שם, גוף מזמין ותאריך הגשה');return;}
  const daysLeft=Math.max(0,Math.round((new Date(deadline)-new Date())/86400000));
  const nt={
    id:TENDERS.length,name,org,
    number:document.getElementById('ntNum').value||'TBD',
    type:document.getElementById('ntType').value,
    status:daysLeft<=3?'urgent':daysLeft<=14?'soon':'ok',
    daysLeft,score:0,value:document.getElementById('ntValue').value||'TBD',
    duration:'TBD',winners:'TBD',
    submitDeadline:new Date(deadline).toLocaleDateString('he-IL')+' | 12:00',
    questionsDeadline:'TBD',tourDate:'TBD',openDate:'TBD',
    tenderBond:'TBD',performanceBond:'TBD',liabilityBond:'TBD',insurance:'TBD',
    scope:document.getElementById('ntNotes').value,
    thresholds:[],qualityScoring:[],teamReq:[],highlights:[],flags:[],
    appExp:TENDERS[0].appExp,appTeam:TENDERS[0].appTeam
  };
  TENDERS.push(nt);
  closeModal('newTenderModal');
  renderTenderTable();renderTenderCards();renderDashboard();updateSimSelect();
  // If file attached, auto-run AI analysis
  const file=document.getElementById('ntFile').files[0];
  if(file){
    alert(`✅ המכרז "${name}" נוסף!\n\nכדי לנתח את קובץ המכרז עם AI, עבור ל"העלאת מכרז".`);
  } else {
    alert(`✅ המכרז "${name}" נוסף בהצלחה!`);
  }
}

