'use strict';

/* ═════ TEAM ═════ */
function renderTeam(){
  const grid = document.getElementById('teamGrid');
  if(!grid) return;
  grid.innerHTML = teamMembers.map((m,idx)=>`
    <div class="mcard" onclick="showMemberDetail(${idx})">
      <div class="mav" style="background:linear-gradient(135deg,${m.color},${m.color}bb)">${m.ini}</div>
      <div class="mn">${m.name} ${m.title}</div>
      <div class="mr">${m.role}</div>
      <div class="me">${m.years} שנות ניסיון</div>
      <div class="mtags">${m.areas.slice(0,3).map(a=>`<span class="mtag">${a}</span>`).join('')}${m.areas.length>3?`<span class="mtag">+${m.areas.length-3}</span>`:''}</div>
    </div>`).join('');

  // Team stats for simulator
  const ts = document.getElementById('teamStats');
  if(ts) ts.innerHTML = [
    {l:'עובדים',v:teamMembers.length,h:'בצוות',a:'var(--grn2)',ab:'var(--grn-light)'},
    {l:'ממוצע ניסיון',v:Math.round(teamMembers.reduce((a,m)=>a+m.years,0)/teamMembers.length)+'y',h:'שנות ניסיון',a:'var(--navy)',ab:'var(--bg2)'},
    {l:'עוברים תנאי סף',v:'0',h:'מתוך '+TENDERS.length+' מכרזים',a:'var(--amb)',ab:'var(--abg)'},
    {l:'ניקוד ממוצע',v:'0',h:'מתוך 24',a:'var(--blu)',ab:'var(--bbg)'}
  ].map(s=>`<div class="sc" style="--a:${s.a};--ab:${s.ab}"><div class="sc-i">👤</div><div class="sc-v">${s.v}</div><div class="sc-l">${s.l}</div><div class="sc-h">${s.h}</div></div>`).join('');

  const lbl = document.getElementById('teamCountLbl');
  if(lbl) lbl.textContent = `${teamMembers.length} עובדים — ניקוד מחושב בזמן אמת`;
}

function showMemberDetail(idx){
  const m=teamMembers[idx];
  alert(`👤 ${m.name} ${m.title}\n\nתפקיד: ${m.role}\nשנות ניסיון: ${m.years}\n\nהסמכות:\n• ${m.certs.join('\n• ')}\n\nתחומי ניסיון:\n• ${m.areas.join('\n• ')}`);
}

function switchTeamTab(tab,el){
  ['personal','exp','projects'].forEach(t=>{
    const e=document.getElementById('at'+t.charAt(0).toUpperCase()+t.slice(1));
    if(e) e.style.display=t===tab?'block':'none';
  });
  document.querySelectorAll('#addTeamTabs .tab').forEach(t=>t.classList.remove('on'));
  if(el) el.classList.add('on');
}

function saveTeamMember(){
  const name=document.getElementById('atName').value.trim();
  if(!name){alert('נא להזין שם מלא');return;}
  teamMembers.push({
    name,title:document.getElementById('atTitle').value,
    role:document.getElementById('atRole').value,
    years:+document.getElementById('atYears').value||0,
    color:'#1a5c4a',ini:name.split(' ').slice(0,2).map(w=>w[0]).join(''),
    areas:selectedAreas,certs:document.getElementById('atCerts').value.split(',').map(s=>s.trim()).filter(Boolean)
  });
  closeModal('addTeamModal');
  renderTeam();
}

function renderExpertAreas(){
  const wrap=document.getElementById('expertAreasWrap');
  if(!wrap) return;
  wrap.innerHTML=EXPERT_AREAS.map(a=>`
    <span class="ea-tag ${selectedAreas.includes(a)?'on':''}" onclick="toggleArea('${a}',this)">${a}</span>`
  ).join('');
}

function toggleArea(a,el){
  if(selectedAreas.includes(a)){
    selectedAreas=selectedAreas.filter(x=>x!==a);
    el.classList.remove('on');
  } else {
    selectedAreas.push(a);
    el.classList.add('on');
  }
}

function promptNewArea(){
  const a=prompt('הזן שם קטגוריה חדשה:');
  if(a&&a.trim()){EXPERT_AREAS.push(a.trim());renderExpertAreas();}
}

function addProjectBlock(){
  const list=document.getElementById('projectsList');
  const div=document.createElement('div');
  div.style.cssText='background:var(--bg2);border:1px solid var(--s5);border-radius:9px;padding:12px;margin-bottom:8px';
  div.innerHTML=`<div style="display:flex;justify-content:space-between;margin-bottom:9px">
    <div style="font-weight:700;font-size:12.5px">פרויקט נוסף</div>
    <button class="btn bgh sm" onclick="this.closest('div[style]').remove()">✕</button>
  </div>
  <div class="fr"><div class="fg"><label class="fl">שם הלקוח</label><input class="fi" placeholder="עיריית..."></div><div class="fg"><label class="fl">תחום</label><select class="fs"><option>ביקורת פנימית</option><option>ביקורת שכר</option><option>ביקורת רכש</option><option>ייעוץ כלכלי</option></select></div></div>
  <div class="fr"><div class="fg"><label class="fl">שנת תחילה</label><input class="fi" type="number" placeholder="2020"></div><div class="fg"><label class="fl">שנת סיום</label><input class="fi" type="number" placeholder="2024"></div></div>`;
  list.appendChild(div);
}

