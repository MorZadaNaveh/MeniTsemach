'use strict';

/* ═════ NAVIGATION ═════ */
function goPage(id, el){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  const pg = document.getElementById('page-'+id);
  if(pg) pg.classList.add('on');
  // Desktop nav
  document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('on'));
  if(el && el.classList?.contains('sb-item')) el.classList.add('on');
  else { const n=document.getElementById('nav-'+id); if(n) n.classList.add('on'); }
  const meta = PAGE_META[id]||{t:id,s:''};
  const pt = document.getElementById('pgTitle');
  const ps = document.getElementById('pgSub');
  if(pt) pt.textContent = meta.t;
  if(ps) ps.textContent = meta.s;
  currentPage = id;
  if(isMobile) window.scrollTo(0,0);
}

function setMobNav(id){
  document.querySelectorAll('.mob-nav').forEach(n=>n.classList.remove('on'));
  const el = document.getElementById('mnav-'+id);
  if(el) el.classList.add('on');
}

function goPageMob(id){
  closeMoreMenu();
  goPage(id, null);
  // Update bottom nav if applicable
  const navMap = {dashboard:'dashboard',tenders:'tenders',analysis:'analysis',simulator:'simulator'};
  setMobNav(navMap[id]||'');
  setTimeout(()=>document.querySelectorAll('.mob-nav.on')[0],100);
}

/* ═════ MORE MENU ═════ */
function openMoreMenu(){
  document.getElementById('moreOverlay').classList.add('on');
  document.getElementById('moreSheet').classList.add('on');
}
function closeMoreMenu(){
  document.getElementById('moreOverlay').classList.remove('on');
  document.getElementById('moreSheet').classList.remove('on');
}

/* ═════ MODAL ═════ */
function openModal(id){ document.getElementById(id).classList.add('on'); }
function closeModal(id){ document.getElementById(id).classList.remove('on'); }
