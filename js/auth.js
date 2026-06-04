'use strict';

const USER_SCOPE_KEY = 'mazkir_user_scope';

function normalizeUserScope(email){
  const raw = String(email || '').trim().toLowerCase();
  if(!raw) return 'demo_user';
  return raw.replace(/[^a-z0-9@._-]/g, '_');
}

function setStorageScopeFromLogin(){
  const email = document.getElementById('loginEmail')?.value || '';
  const scope = normalizeUserScope(email);
  try {
    localStorage.setItem(USER_SCOPE_KEY, scope);
  } catch (_) {}
  return scope;
}

function getStorageScope(){
  try {
    const saved = localStorage.getItem(USER_SCOPE_KEY);
    if(saved) return saved;
  } catch (_) {}
  const email = document.getElementById('loginEmail')?.value || '';
  return normalizeUserScope(email);
}

/* ═════ MOBILE DETECT ═════ */
function detectMobile(){
  isMobile = window.innerWidth <= 768;
  const mobBar = document.querySelector('.mob-bar');
  const mobMenuBtn = document.getElementById('mobMenuBtn');
  if(isMobile){
    if(mobBar) mobBar.style.display = 'flex';
    if(mobMenuBtn) mobMenuBtn.style.display = 'inline-flex';
    // Show mobile logos
    document.querySelectorAll('.mob-top-logo').forEach(el=>el.style.display='flex');
    // Render tender cards instead of table
    renderTenderCards();
    document.getElementById('tenderTableBody').closest('.card')?.classList.add('desk-only');
    const cardList = document.getElementById('tenderCardList');
    if(cardList) cardList.style.display = 'block';
  } else {
    if(mobBar) mobBar.style.display = 'none';
    if(mobMenuBtn) mobMenuBtn.style.display = 'none';
    document.querySelectorAll('.mob-top-logo').forEach(el=>el.style.display='none');
  }
}

/* ═════ LOGIN ═════ */
function togglePw(){
  const inp = document.getElementById('pwInp');
  inp.type = inp.type==='password'?'text':'password';
}
function doLogin(){
  setStorageScopeFromLogin();
  document.getElementById('ls1').style.display='none';
  document.getElementById('ls2').style.display='block';
  const row = document.getElementById('otpRow');
  row.innerHTML='';
  for(let i=0;i<6;i++){
    const inp=document.createElement('input');
    inp.className='otpbox';inp.maxLength=1;inp.id='otp'+i;
    inp.addEventListener('input',e=>{
      if(e.target.value&&i<5) document.getElementById('otp'+(i+1)).focus();
      if([...document.querySelectorAll('.otpbox')].map(x=>x.value).join('').length===6) enterApp();
    });
    row.appendChild(inp);
  }
  setTimeout(()=>document.getElementById('otp0').focus(),100);
}
function showOtpHint(){
  document.getElementById('otpMsg').innerHTML='<span style="color:var(--grn);font-weight:700">קוד לדמו: 1 2 3 4 5 6</span>';
}
function enterApp(){
  if(!getStorageScope()) setStorageScopeFromLogin();
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('appShell').style.display='flex';
  detectMobile();
  initApp();
}
