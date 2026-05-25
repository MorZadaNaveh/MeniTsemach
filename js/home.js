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
    greetEl.innerHTML = `
      <h1>שלום, רון פישמן 👋</h1>
      <div class="home-date">${dateStr}</div>
    `;
  }

  // Stat cards data
  const uniqueOrgs = [...new Set(TENDERS.map(t=>t.org))];
  const stats = [
    {label:'לקוחות',value:uniqueOrgs.length,hint:'גופים מזמינים',icon:'👤',cls:'navy'},
    {label:'מכרזים',value:TENDERS.length,hint:TENDERS.filter(t=>t.status==='urgent').length+' בהגשה קרובה',icon:'📄',cls:'teal'},
    {label:'הודעות',value:1,hint:'הודעה חדשה',icon:'✉️',cls:'green'},
    {label:'צוות עובדים',value:teamMembers.length,hint:'משתמשים פעילים',icon:'⚙️',cls:'gold'},
    {label:'הצעות',value:vaultDocs.length,hint:'מסמכי הגשה',icon:'❄️',cls:'brown'}
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
    const activities = [
      {color:'var(--red)',text:'עיריית פתח תקווה — הגשה ב-3 ימים',meta:'מכרז דחוף'},
      {color:'var(--grn2)',text:'מועצה אזורית חוף הכרמל — נוספה לרשימה',meta:'מכרז חדש'},
      {color:'var(--blu)',text:'עיריית נתניה — סיור מציעים 20.03',meta:'תזכורת'},
      {color:'var(--amb)',text:'ניכוי במקור — פג תוקף בעוד 44 יום',meta:'מסמך'},
      {color:'var(--grn)',text:'דניאל ברק — הוגדר ככלכלן ראשי',meta:'צוות'}
    ];
    actEl.innerHTML = activities.map(a=>`
      <div class="home-act-row">
        <div class="home-act-dot" style="background:${a.color}"></div>
        <div class="home-act-text">${a.text}</div>
        <div class="home-act-meta">${a.meta}</div>
      </div>
    `).join('');
  }
}
