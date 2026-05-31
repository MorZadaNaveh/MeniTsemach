'use strict';

/* ═════ IMPORT ═════ */
function switchImportTab(n,el){
  [1,2,3].forEach(i=>{
    const e=document.getElementById('importTab'+i);
    if(e) e.style.display=i===n?'block':'none';
  });
  document.querySelectorAll('#importTabs .tab').forEach(t=>t.classList.remove('on'));
  if(el) el.classList.add('on');
  else document.querySelectorAll('#importTabs .tab')[n-1]?.classList.add('on');
  if(n===2) renderMappingGrid();
}

function handleExcelFile(){ switchImportTab(2,null); }

function renderMappingGrid(){
  const g=document.getElementById('mappingGrid');
  if(!g) return;
  g.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--s5);border-radius:9px;padding:10px 13px">
    <div style="display:grid;grid-template-columns:1fr 28px 1fr;gap:0 7px;margin-bottom:7px;font-size:9.5px;font-weight:700;color:var(--s3);letter-spacing:.5px;text-transform:uppercase">
      <div>עמודה בקובץ</div><div></div><div>שדה במערכת</div>
    </div>
    ${EXCEL_COLS.map((col,i)=>`
      <div style="display:grid;grid-template-columns:1fr 28px 1fr;gap:0 7px;align-items:center;margin-bottom:6px">
        <div style="background:var(--w);border:1px solid var(--s4);border-radius:7px;padding:7px 10px;font-size:12.5px;font-weight:600">${col}</div>
        <div style="text-align:center;color:var(--s3);font-size:12px">→</div>
        <select class="fs" style="font-size:12px;padding:6px 9px">${SYS_FIELDS.map((f,j)=>`<option${j===i?' selected':''}>${f}</option>`).join('')}</select>
      </div>`).join('')}
  </div>`;
}

function doImport(){
  const btn=document.getElementById('importBtn');
  btn.innerHTML='<span class="spn"></span> מייבא...';btn.disabled=true;
  // TODO: implement actual CSV/Excel parsing from uploaded file
  setTimeout(()=>{
    btn.innerHTML='ייבוא';btn.className='btn bp';btn.disabled=false;
    document.getElementById('importTab3').innerHTML=`<div class="alert aa">⚠️ ייבוא קבצים עדיין בפיתוח. הוסף עובדים ידנית דרך מסך הצוות.</div>`;
  },1000);
}

function downloadTemplate(){
  const csv=EXCEL_COLS.join(',')+'\n'+'ישראל ישראלי,056789123,מבקר,8,052-1234567,israel@firm.co.il,"רו""ח",ביקורת פנימית\n';
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='Mazkir_Team_Template.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

