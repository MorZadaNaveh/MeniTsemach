'use strict';

/* ═════ SETTINGS ═════ */
function saveSettings(){
  BIDDER.name=document.getElementById('setFirm').value;
  BIDDER.address=document.getElementById('setAddr').value;
  BIDDER.phone=document.getElementById('setPhone').value;
  BIDDER.email=document.getElementById('setEmail').value;
  BIDDER.vat=document.getElementById('setVat').value;
  BIDDER.signatory=document.getElementById('setSign').value;
  saveCompany();
  const d=document.createElement('div');d.className='alert ag2';d.style.marginTop='8px';d.innerHTML='✅ הגדרות נשמרו בהצלחה!';
  document.getElementById('setFirm').closest('.card').appendChild(d);
  setTimeout(()=>d.remove(),3000);
}

function renderUsers(){
  const g=document.getElementById('usersGrid');if(!g) return;
  g.innerHTML='<div style="font-size:12px;color:var(--s3);padding:8px">ניהול משתמשים יתווסף בגרסה הבאה.</div>';
}

/* ═════ NEW TENDER ═════ */
function saveNewTender(){
  const name=document.getElementById('ntName').value.trim();
  const org=document.getElementById('ntOrg').value.trim();
  const deadline=document.getElementById('ntDeadline').value;
  if(!name||!org||!deadline){alert('נא למלא שם, גוף מזמין ותאריך הגשה');return;}
  const daysLeft=Math.max(0,Math.round((new Date(deadline)-new Date())/86400000));
  const nt={
    id:getNextTenderId(),name,org,
    number:document.getElementById('ntNum').value||'TBD',
    type:document.getElementById('ntType').value,
    status:daysLeft<=3?'urgent':daysLeft<=14?'soon':'ok',
    daysLeft,score:0,value:document.getElementById('ntValue').value||'TBD',
    duration:'TBD',winners:'TBD',
    submitDeadline:new Date(deadline).toLocaleDateString('he-IL')+' | 12:00',
    questionsDeadline:'TBD',tourDate:'TBD',openDate:'TBD',
    tenderBond:'TBD',performanceBond:'TBD',liabilityBond:'TBD',insurance:'TBD',
    scope:document.getElementById('ntNotes').value,
    thresholds:[],qualityScoring:[],teamReq:[],highlights:[],flags:[]
  };
  TENDERS.push(nt);
  saveTender(nt);
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

