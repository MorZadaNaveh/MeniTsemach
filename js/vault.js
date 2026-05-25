'use strict';

/* ═════ VAULT ═════ */
function renderVault(){
  const grid=document.getElementById('vaultGrid');
  if(!grid) return;
  const alerts=document.getElementById('vaultAlerts');
  if(alerts) alerts.innerHTML='';
  grid.innerHTML=vaultDocs.map(d=>{
    const pct=d.expiry?Math.max(0,Math.min(100,(d.days/365)*100)):100;
    const color=d.days<0?'var(--red)':d.days<=30?'var(--red)':d.days<=60?'var(--amb)':'var(--grn)';
    const cls=d.days<0||d.days<=30?'br':d.days<=60?'ba':'bgg';
    const lbl=d.days===999?'ללא תפוגה':d.days<0?'פג תוקף!':'עוד '+d.days+'d';
    return `<div class="dvi">
      <div style="font-size:18px;flex-shrink:0">${d.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
          <div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.name}</div>
          ${d.required?'<span class="badge bn" style="font-size:8.5px">חובה</span>':''}
          <span class="badge ${cls}" style="font-size:8.5px;margin-right:auto">${lbl}</span>
        </div>
        <div style="font-size:10px;color:var(--s3);margin-top:1px">${d.file}</div>
        <div style="height:3px;background:var(--s5);border-radius:2px;margin-top:4px">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:2px"></div>
        </div>
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <div class="ib sm" title="החלף" onclick="replaceDoc(${d.id})">🔄</div>
        <div class="ib sm" title="ערוך" onclick="editDocExpiry(${d.id})">✏️</div>
      </div>
    </div>`;
  }).join('');
}

function replaceDoc(id){
  const inp=document.createElement('input');inp.type='file';inp.accept='.pdf,.doc,.docx';
  inp.onchange=()=>{const d=vaultDocs.find(d=>d.id===id);if(d&&inp.files[0]){d.file=inp.files[0].name;renderVault();}};
  inp.click();
}

function editDocExpiry(id){
  const d=vaultDocs.find(d=>d.id===id);
  if(!d) return;
  const nd=prompt(`עדכן תאריך תפוגה ל"${d.name}" (YYYY-MM-DD):`,d.expiry||'');
  if(nd&&/^\d{4}-\d{2}-\d{2}$/.test(nd)){
    d.expiry=nd;
    d.days=Math.round((new Date(nd)-new Date('2025-03-02'))/86400000);
    renderVault();renderDashboard();
  }
}

function saveNewDoc(){
  const name=document.getElementById('newDocName').value.trim();
  if(!name){alert('נא להזין שם');return;}
  const expiry=document.getElementById('newDocExpiry').value;
  const icons={legal:'⚖️',tax:'🧾',insurance:'🛡️',financial:'💰'};
  vaultDocs.push({
    id:Date.now(),name,
    icon:icons[document.getElementById('newDocType').value]||'📄',
    expiry:expiry||null,
    days:expiry?Math.round((new Date(expiry)-new Date('2025-03-02'))/86400000):999,
    required:document.getElementById('newDocReq').value==='1',
    file:name.replace(/\s/g,'_').toLowerCase()+'.pdf'
  });
  closeModal('addDocModal');
  document.getElementById('newDocName').value='';
  renderVault();renderDashboard();
}

