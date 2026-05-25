'use strict';

/* ═════ INIT ═════ */
function initApp(){
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
