'use strict';

/* ═════ SIMULATOR ═════ */
function updateSimSelect(){
  const sel=document.getElementById('simSelect');
  if(!sel) return;
  sel.innerHTML='<option value="">-- בחר מכרז --</option>'+
    TENDERS.map(t=>`<option value="${t.id}">${t.name} — ${t.org}</option>`).join('');
}

function runSimulator(){
  const val=document.getElementById('simSelect').value;
  if(!val){alert('נא לבחור מכרז');return;}
  const t=TENDERS[+val];
  document.getElementById('simEmpty').style.display='none';
  const res=document.getElementById('simResults');
  res.style.display='none';
  setTimeout(()=>{
    const score=t.score||75;
    const circ=document.getElementById('simCircle');
    const circ2=2*Math.PI*50;
    circ.setAttribute('stroke-dasharray',`${(score/100)*circ2} ${circ2}`);
    document.getElementById('simPct').textContent=score+'%';
    const bc=score>=80?'bgg':score>=65?'ba':'br';
    document.getElementById('simBadges').innerHTML=`<span class="badge bgg">עובר תנאי סף ✓</span> <span class="badge ${bc}">${score>=80?'המלצה: הגש!':score>=65?'כדאי לשפר':'סיכוי נמוך'}</span>`;
    document.getElementById('simScoring').innerHTML=(t.qualityScoring||[]).map(q=>{
      const e=Math.round((q.m||0)*0.88);
      return `<div class="score-row"><span class="score-row-lbl">${q.l}</span><span class="score-row-val">${e}/${q.m}</span><div class="score-row-bar"><div class="prog"><div class="pf" style="width:${q.m?(e/q.m)*100:0}%;background:linear-gradient(90deg,var(--grn),var(--grn3))"></div></div></div></div>`;
    }).join('');
    document.getElementById('simTeam').innerHTML=(t.appTeam||[]).map((m,i)=>{
      const tm=teamMembers[i%teamMembers.length];
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding:7px 9px;background:var(--bg2);border:1px solid var(--s5);border-radius:7px">
        <div style="width:24px;height:24px;border-radius:5px;background:${tm.color};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff;flex-shrink:0">${tm.ini}</div>
        <div style="flex:1"><div style="font-size:12px;font-weight:700">${m.name}</div><div style="font-size:10px;color:var(--s2)">${m.role}</div></div>
        <span class="badge bgg" style="font-size:9px">+${[5,4,3][i]||2} נק׳</span>
      </div>`;
    }).join('');
    document.getElementById('simRisks').innerHTML=`
      <div class="stl">נקודות תורפה</div>
      ${(t.flags||[]).length?(t.flags||[]).map(f=>`<div class="alert aa" style="margin-bottom:5px;font-size:11px">⚠️ ${f}</div>`).join(''):'<div class="alert ag2" style="font-size:11px">✅ לא זוהו חריגות</div>'}
      <div class="stl" style="margin-top:10px">המלצות שיפור</div>
      ${['חזק את הרפרנס של הלקוח הגדול','הוסף תיאור מפורט של המתודולוגיה','ודא שכל הסמכות הצוות מעודכנות'].map(tip=>`<div style="display:flex;gap:7px;margin-bottom:6px;font-size:11.5px">💡 ${tip}</div>`).join('')}`;
    document.getElementById('simOpenTenderBtn').onclick=()=>openTenderModal(t.id);
    res.style.display='block';
  },1800);
}

