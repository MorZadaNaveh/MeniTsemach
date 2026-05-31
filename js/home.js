'use strict';

/* ═════ HOME PAGE ═════ */
function renderHome(){
  const container = document.getElementById('homeStats');
  if(!container) return;

  // Greeting
  const greetEl = document.getElementById('homeGreeting');
  if(greetEl){
    const now = new Date();
    const dateStr = now.toLocaleDateString('he-IL',{weekday:'long', year:'numeric', month:'long', day:'numeric'});
    const userName = BIDDER.signatory || BIDDER.name || '';
    greetEl.innerHTML = `
      <h1>שלום${userName ? ', '+userName : ''}</h1>
      <div class="home-date">${dateStr}</div>
    `;
  }

  // Stat cards data
  const uniqueOrgs = [...new Set(TENDERS.map(t=>t.org))];
  const stats = [
    {label:'לקוחות',value:uniqueOrgs.length,hint:'גופים מזמינים',icon:'👤',cls:'navy'},
    {label:'מכרזים',value:TENDERS.length,hint:TENDERS.filter(t=>t.status==='urgent').length+' בהגשה קרובה',icon:'📄',cls:'teal'},
    {label:'מסמכי יסוד',value:vaultDocs.length,hint:'תיקיית המציע',icon:'📋',cls:'green'},
    {label:'צוות עובדים',value:teamMembers.length,hint:'משתמשים פעילים',icon:'⚙️',cls:'gold'},
  ];

  // Action cards (same design, second row)
  const actions = [
    {label:'מכרזים פעילים',icon:'📊',cls:'act-green clickable',onclick:"goPage('dashboard',document.getElementById('nav-dashboard'))"},
    {label:'העלאת מכרז',icon:'📎',cls:'act-teal clickable',onclick:"goPage('analysis',document.getElementById('nav-analysis'))"}
  ];

  const statCards = stats.map(s=>`
    <div class="home-stat ${s.cls}">
      <div class="home-stat-icon">${s.icon}</div>
      <div>
        <div class="home-stat-label">${s.label}</div>
        <div class="home-stat-value">${s.value}</div>
        <div class="home-stat-hint">${s.hint}</div>
      </div>
    </div>
  `).join('');

  const actionCards = actions.map(a=>`
    <div class="home-stat ${a.cls}" onclick="${a.onclick}">
      <div class="home-stat-icon">${a.icon}</div>
      <div>
        <div class="home-stat-value" style="font-size:16px;line-height:1.3">${a.label}</div>
      </div>
    </div>
  `).join('');

  container.innerHTML = statCards + actionCards;

  // Recent activity
  const actEl = document.getElementById('homeActivity');
  if(actEl){
    const activities = [];
    TENDERS.filter(t=>t.daysLeft<=7).forEach(t=>{
      activities.push({color:'var(--red)',text:`${t.name} — הגשה בעוד ${t.daysLeft} ימים`,meta:'מכרז דחוף'});
    });
    const expiredDocs = vaultDocs.filter(d=>d.expiry&&d.days<0);
    const soonDocs = vaultDocs.filter(d=>d.expiry&&d.days>=0&&d.days<=30);
    expiredDocs.forEach(d=>activities.push({color:'var(--red)',text:`${d.name} — פג תוקף!`,meta:'מסמך'}));
    soonDocs.forEach(d=>activities.push({color:'var(--amb)',text:`${d.name} — פוגע תוך ${d.days} ימים`,meta:'מסמך'}));
    if(activities.length===0) activities.push({color:'var(--grn)',text:'אין עדכונים חדשים',meta:''});
    actEl.innerHTML = activities.map(a=>`
      <div class="home-act-row">
        <div class="home-act-dot" style="background:${a.color}"></div>
        <div class="home-act-text">${a.text}</div>
        <div class="home-act-meta">${a.meta}</div>
      </div>
    `).join('');
  }
}
