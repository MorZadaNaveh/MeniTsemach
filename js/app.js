'use strict';

/* ═════ INIT ═════ */
async function initApp(){
  // Show loading state
  const content = document.querySelector('.content');
  if(content) content.style.opacity = '0.5';

  try {
    await loadAllData();
  } catch(e) {
    console.error('Data load error:', e);
  }

  if(content) content.style.opacity = '1';

  renderHome();
  renderDashboard();
  renderTenderTable();
  renderTenderCards();
  renderTeam();
  renderVault();
  renderUsers();
  renderExpertAreas();
  updateSimSelect();
  // Simulator circle init
  const c=document.getElementById('simCircle');
  if(c) c.setAttribute('stroke-dasharray','0 314.16');
  // Responsive
  window.addEventListener('resize',()=>{ detectMobile(); });
}
