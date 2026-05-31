'use strict';

/* ═════ AI ANALYSIS ═════ */
if(typeof pdfjsLib!=='undefined'){
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let uploadedFiles = [];

function handleFileDrop(e){
  e.preventDefault();
  document.getElementById('uploadZone').classList.remove('drag');
  handleFileSelect(e.dataTransfer.files);
}
function handleFileSelect(files){
  if(!files.length) return;
  uploadedFiles = Array.from(files);
  const listEl = document.getElementById('uploadedFileList');
  listEl.innerHTML = uploadedFiles.map(f=>`
    <div style="background:var(--grn-light);border:1px solid var(--grn-border);border-radius:7px;padding:5px 10px;font-size:12px;font-weight:600;color:var(--grn)">
      📄 ${f.name} (${(f.size/1024).toFixed(0)}KB)
    </div>`).join('');
  document.getElementById('uploadActions').style.display='flex';
}

function resetUpload(){
  uploadedFiles=[];
  document.getElementById('uploadedFileList').innerHTML='';
  document.getElementById('uploadActions').style.display='none';
}

/* ── Extract text from uploaded file ── */
const MAX_TEXT_LENGTH = 30000;
const TAIL_LENGTH = 5000; // also grab last 5K chars for contact/deadline info at end

function smartTruncate(text){
  if(text.length <= MAX_TEXT_LENGTH) return { text, truncated: false };
  // Keep beginning + end of document (contact/deadlines often at end)
  const head = text.slice(0, MAX_TEXT_LENGTH - TAIL_LENGTH);
  const tail = text.slice(-TAIL_LENGTH);
  return { text: head + '\n\n[...חלק אמצעי הושמט...]\n\n' + tail, truncated: true };
}

async function extractFileText(file){
  const name = file.name.toLowerCase();

  // TXT / CSV
  if(file.type.includes('text') || name.endsWith('.txt') || name.endsWith('.csv')){
    const text = await file.text();
    return { fullText: text, ...smartTruncate(text) };
  }

  // PDF — extract ALL pages first, then truncate smartly
  if(name.endsWith('.pdf')){
    if(typeof pdfjsLib==='undefined') throw new Error('PDF.js לא נטען — רענן את הדף');
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: buf}).promise;
    let fullText = '';
    for(let i=1; i<=pdf.numPages; i++){
      const page = await pdf.getPage(i);
      const tc = await page.getTextContent();
      const pageText = tc.items.map(it=>it.str).join(' ');
      fullText += pageText + '\n';
    }
    const truncated = smartTruncate(fullText);
    return { fullText, ...truncated };
  }

  // DOCX
  if(name.endsWith('.docx')){
    if(typeof mammoth==='undefined') throw new Error('Mammoth.js לא נטען — רענן את הדף');
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({arrayBuffer: buf});
    const truncated = smartTruncate(result.value);
    return { fullText: result.value, ...truncated };
  }

  // Unsupported
  if(name.endsWith('.doc')) throw new Error('פורמט .doc ישן — שמור כ-.docx ונסה שוב');
  if(name.endsWith('.xls') || name.endsWith('.xlsx')) throw new Error('קבצי Excel לא נתמכים — שמור כ-.pdf או .txt');
  throw new Error('סוג קובץ לא נתמך: ' + file.name.split('.').pop());
}

/* ── Call Netlify Function → Gemini AI (with client-side retries) ── */
async function callAIForAnalysis(content, fileName, wasTruncated){
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [3000, 6000, 10000];

  for(let attempt = 0; attempt < MAX_RETRIES; attempt++){
    const response = await fetch('/.netlify/functions/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content, fileName, truncated: wasTruncated })
    });

    if(response.ok) return await response.json();

    const err = await response.json().catch(()=>({error:'Unknown'}));
    const retryable = response.status === 429 || response.status === 503;

    if(retryable && attempt < MAX_RETRIES - 1){
      console.log(`Retry ${attempt+1}/${MAX_RETRIES} after ${response.status}, waiting ${RETRY_DELAYS[attempt]}ms...`);
      await new Promise(r=>setTimeout(r, RETRY_DELAYS[attempt]));
      continue;
    }

    throw new Error(err.error || 'API error: ' + response.status);
  }
}

/* ── Call Netlify Function → Appendix extraction ── */
async function callAIForAppendices(content, fileName){
  const companyData = {
    bidder: BIDDER,
    team: teamMembers
  };

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [3000, 6000, 10000];

  for(let attempt = 0; attempt < MAX_RETRIES; attempt++){
    const response = await fetch('/.netlify/functions/extract-appendices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content, fileName, companyData })
    });

    if(response.ok) return await response.json();

    const err = await response.json().catch(()=>({error:'Unknown'}));
    const retryable = response.status === 429 || response.status === 503;

    if(retryable && attempt < MAX_RETRIES - 1){
      console.log(`Appendix retry ${attempt+1}/${MAX_RETRIES} after ${response.status}`);
      await new Promise(r=>setTimeout(r, RETRY_DELAYS[attempt]));
      continue;
    }

    throw new Error(err.error || 'Appendix API error: ' + response.status);
  }
}

/* ── Main analysis flow ── */
async function runAIAnalysis(){
  if(!uploadedFiles.length){ alert('נא לבחור קובץ'); return; }
  document.getElementById('uploadCard').style.display='none';
  document.getElementById('aiProgress').style.display='block';
  document.getElementById('aiResultSection').style.display='none';

  const progText = document.getElementById('aiProgressText');
  const progBar  = document.getElementById('aiProgressBar');
  const file = uploadedFiles[0];
  uploadedFileName = file.name;

  try {
    // Step 1: Extract text
    progText.textContent = 'קורא את הקובץ...';
    progBar.style.width = '15%';
    const { fullText, text, truncated } = await extractFileText(file);
    uploadedFileContent = text;

    if(text.trim().length < 50){
      throw new Error('לא הצלחתי לחלץ טקסט מהקובץ — ייתכן שהקובץ סרוק (תמונה) או ריק');
    }

    // Step 2: Send to AI — both calls in parallel
    progText.textContent = 'שולח ל-AI לניתוח...';
    progBar.style.width = '35%';

    // Animate progress while waiting
    let pct = 35;
    const iv = setInterval(()=>{
      if(pct < 90){ pct += 2; progBar.style.width = pct+'%'; }
      if(pct > 45 && pct < 55) progText.textContent = 'AI מחלץ תנאי סף וניקוד...';
      if(pct > 55 && pct < 65) progText.textContent = 'מזהה נספחים וטפסים...';
      if(pct > 65 && pct < 75) progText.textContent = 'ממלא נספחים אוטומטית...';
      if(pct > 75 && pct < 85) progText.textContent = 'מזהה מועדים ופרטי קשר...';
      if(pct > 85) progText.textContent = 'מסמן חריגות ודגשים...';
    }, 500);

    // Run analysis + appendix extraction in parallel
    const [analysisResult, appendicesResult] = await Promise.allSettled([
      callAIForAnalysis(text, file.name, truncated),
      callAIForAppendices(fullText, file.name)
    ]);

    clearInterval(iv);

    if(analysisResult.status === 'rejected'){
      throw analysisResult.reason;
    }

    const result = analysisResult.value;
    // Attach appendices (may have failed independently)
    if(appendicesResult.status === 'fulfilled' && appendicesResult.value?.appendices){
      result.appendices = appendicesResult.value.appendices;
    } else {
      console.warn('Appendix extraction failed:', appendicesResult.reason || 'No data');
      result.appendices = [];
    }

    progText.textContent = 'מכין תוצאות...';
    progBar.style.width = '100%';

    await new Promise(r=>setTimeout(r, 300));
    currentAIResult = result;
    showAIResult(result);

    // Persist appendices after tender is created (always overwrite, even if empty)
    if(currentAnalysisIdx >= 0){
      saveAppendices(currentAnalysisIdx, result.appendices);
    }

  } catch(err) {
    console.error('Analysis error:', err);
    document.getElementById('aiProgress').style.display='none';
    document.getElementById('uploadCard').style.display='block';
    alert('שגיאה בניתוח: ' + err.message);
  }
}

function showAIResult(result){
  document.getElementById('aiProgress').style.display='none';
  document.getElementById('uploadCard').style.display='block';
  document.getElementById('aiResultSection').style.display='block';
  document.getElementById('aiTenderName').textContent = result.tenderName || 'מכרז';
  document.getElementById('aiTenderOrg').textContent = (result.orgName||'') + (result.tenderNumber?' | '+result.tenderNumber:'');
  document.getElementById('aiAnalysisDate').textContent = 'נותח: '+new Date().toLocaleDateString('he-IL');

  // Add to TENDERS list
  const existing = TENDERS.find(t=>t.name===result.tenderName);
  if(!existing){
    const newTender = {
      id:TENDERS.length,
      name:result.tenderName||uploadedFileName.replace(/\.[^.]+$/,''),
      org:result.orgName||'',
      number:result.tenderNumber||'',
      type:result.type||'',
      status:+result.daysLeft<=3?'urgent':+result.daysLeft<=14?'soon':'ok',
      daysLeft:+result.daysLeft||0,
      score:+result.score||0,
      value:result.value||'',
      duration:result.duration||'',
      winners:result.winners||'',
      submitDeadline:result.submitDeadline||'',
      questionsDeadline:result.timeline&&result.timeline[0]?result.timeline[0].date:'',
      tenderBond:result.tenderBond||'',
      performanceBond:result.performanceBond||'',
      scope:result.scope||'',
      highlights:result.highlights||[],
      flags:result.flags||[],
      thresholds:result.thresholds||[],
      qualityScoring:result.qualityScoring||[],
      teamReq:result.teamReq||[],
      insurance:result.insurance||'',
      liabilityBond:result.liabilityBond||'',
      tourDate:result.tourDate||'',
      openDate:result.openDate||''
    };
    TENDERS.push(newTender);
    saveTender(newTender);
    currentAnalysisIdx = newTender.id;
    updateSimSelect();
    renderTenderTable();
    renderTenderCards();
    renderDashboard();
    document.getElementById('simOpenTenderBtn').onclick=()=>openTenderModal(newTender.id);
  } else {
    currentAnalysisIdx = existing.id;
  }

  switchAITab('overview', document.querySelector('#aiResultTabs .tab'));
}

let aiTab = 'overview';
function switchAITab(tab, el){
  aiTab = tab;
  if(el){
    document.querySelectorAll('#aiResultTabs .tab').forEach(t=>t.classList.remove('on'));
    el.classList.add('on');
  }
  const r = currentAIResult;
  if(!r) return;
  const body = document.getElementById('aiResultBody');

  if(tab==='overview'){
    /* א. מועדי המכרז */
    const timelineHtml = (r.timeline&&r.timeline.length) ? `
      <div class="stl">א. מועדי המכרז</div>
      <table class="atable"><thead><tr><th>נושא</th><th>תאריך ושעה</th></tr></thead><tbody>
        ${r.timeline.map(t=>`<tr><td style="font-weight:600">${t.label}</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:600;white-space:nowrap">${t.date}</td></tr>`).join('')}
      </tbody></table>` : '';

    /* ב. איש קשר */
    const c = r.contact;
    const hasContact = c && (c.name || c.email || c.phone || c.method);
    const contactHtml = hasContact ? `
      <div class="stl">ב. איש קשר ופרטיו</div>
      <div class="ai-contact-card">
        ${c.name?`<div class="ai-contact-row"><span class="ai-contact-icon">👤</span><strong>${c.name}</strong></div>`:''}
        ${c.email?`<div class="ai-contact-row"><span class="ai-contact-icon">📧</span><a href="mailto:${c.email}" style="color:var(--grn);font-weight:600">${c.email}</a></div>`:''}
        ${c.phone&&c.phone!=='—'?`<div class="ai-contact-row"><span class="ai-contact-icon">📞</span>${c.phone}</div>`:''}
        ${c.method?`<div class="ai-contact-row"><span class="ai-contact-icon">📋</span>${c.method}</div>`:''}
      </div>` : '';

    /* ג. היקף ההתקשרות */
    const scopeRows = [
      ['מספר זוכים', r.winners],
      ['היקף שעות שנתי', r.hoursScope],
      ['תקופת התקשרות', r.duration],
    ].filter(row=>row[1]);
    const engagementHtml = scopeRows.length ? `
      <div class="stl">ג. היקף ההתקשרות ומספר זוכים</div>
      <table class="atable"><thead><tr><th>קטגוריה</th><th>פירוט</th></tr></thead><tbody>
        ${scopeRows.map(row=>`<tr><td style="font-weight:600">${row[0]}</td><td>${row[1]}</td></tr>`).join('')}
      </tbody></table>` : '';

    /* ד. דגשים מיוחדים */
    const highlightsHtml = (r.highlights||[]).length ? `
      <div class="stl">ד. דגשים מיוחדים</div>
      ${r.highlights.map(h=>`<div class="alert ab2" style="margin-bottom:5px;font-size:11.5px">ℹ️ ${h}</div>`).join('')}` : '';

    /* ה. ערבות מכרז */
    const bondHtml = r.tenderBond ? `
      <div class="stl">ה. גובה ערבות מכרז</div>
      <div class="ai-result-card"><div class="ai-result-value">${r.tenderBond}</div></div>` : '';

    /* ו. ערבות ביצוע */
    const perfBondHtml = r.performanceBond ? `
      <div class="stl">ו. גובה ערבות ביצוע</div>
      <div class="ai-result-card"><div class="ai-result-value">${r.performanceBond}</div></div>` : '';

    /* אזהרות */
    const flagsHtml = (r.flags||[]).length ? `
      <div class="stl" style="color:var(--amb)">⚠ אזהרות</div>
      ${r.flags.map(f=>`<div class="alert aa" style="margin-bottom:5px;font-size:11.5px">⚠️ ${f}</div>`).join('')}` : '';

    body.innerHTML = `${timelineHtml}${contactHtml}${engagementHtml}${highlightsHtml}${bondHtml}${perfBondHtml}${flagsHtml}`;
  }
  else if(tab==='thresholds'){
    /* א. תנאי סף מנהליים */
    const adminHtml = (r.adminThresholds||[]).length ? `
      <div class="stl">א. תנאי סף מנהליים</div>
      ${r.adminThresholds.map(th=>`<div class="thresh-ok"><span style="color:var(--grn);flex-shrink:0">✅</span><span style="font-size:12.5px">${th}</span></div>`).join('')}` : '';

    /* ב. תנאי סף מקצועיים */
    const profHtml = (r.professionalThresholds||[]).length ? `
      <div class="stl" style="margin-top:13px">ב. תנאי סף מקצועיים</div>
      <table class="atable"><thead><tr><th>תחום</th><th>פירוט תנאי הסף</th></tr></thead><tbody>
        ${r.professionalThresholds.map(t=>`<tr><td style="font-weight:700;white-space:nowrap">${t.field}</td><td style="font-size:12px;line-height:1.5">${t.detail}</td></tr>`).join('')}
      </tbody></table>` : '';

    const empty = !(r.adminThresholds||[]).length && !(r.professionalThresholds||[]).length;
    body.innerHTML = empty
      ? '<div class="alert ab2">לא זוהו תנאי סף במסמך</div>'
      : `${adminHtml}${profHtml}`;
  }
  else if(tab==='scoring'){
    const qs = r.qualityScoring||[];

    /* הערה על ציון מזערי */
    const minScoreHtml = r.minQualityScore ? `
      <div class="alert aa" style="margin-bottom:10px;font-size:12px">⚠️ ציון האיכות המזערי למעבר לשלב בדיקת המחיר הוא <strong>${r.minQualityScore}</strong></div>` : '';

    /* הערה כללית */
    const noteHtml = r.scoringNote ? `<div class="alert ag2" style="margin-bottom:10px;font-size:12px">📊 ${r.scoringNote}</div>` : '';

    /* טבלת מדדי איכות */
    const qualityHtml = qs.length ? `
      <div class="stl">מדדי איכות</div>
      <table class="atable"><thead><tr><th style="width:30px">מס'</th><th>מדד איכות</th><th>פירוט הניקוד</th><th style="width:60px">משקל</th></tr></thead><tbody>
        ${qs.map((q,i)=>`<tr><td style="text-align:center;font-weight:700">${i+1}</td><td style="font-weight:600">${q.l}</td><td style="font-size:11.5px;line-height:1.5;color:var(--s2)">${q.detail||''}</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700;text-align:center">${q.w}</td></tr>`).join('')}
      </tbody></table>` : '';

    /* טבלת ניקוד מחיר */
    const priceHtml = (r.priceScoring&&r.priceScoring.length) ? `
      <div class="stl" style="margin-top:13px">ניקוד מחיר</div>
      <table class="atable"><thead><tr><th>שירות / קטגוריה</th><th style="width:60px">משקל</th></tr></thead><tbody>
        ${r.priceScoring.map(p=>`<tr><td style="font-weight:600">${p.l}</td><td style="font-family:'IBM Plex Mono',monospace;font-weight:700;text-align:center">${p.w}</td></tr>`).join('')}
      </tbody></table>` : '';

    const empty = !qs.length && !(r.priceScoring||[]).length;
    body.innerHTML = empty
      ? '<div class="alert ab2">לא זוהו מדדי ניקוד במסמך</div>'
      : `${minScoreHtml}${noteHtml}${qualityHtml}${priceHtml}`;
  }
  else if(tab==='docs'){
    const apps = r.appendices || [];
    if(!apps.length){
      body.innerHTML = '<div class="alert ab2" style="font-size:12px">לא זוהו נספחים למילוי במסמך זה.</div>';
      return;
    }

    // Dynamic appendix tabs from AI extraction
    body.innerHTML = `
      <div class="alert ag2" style="margin-bottom:12px">✨ AI זיהה ${apps.length} נספחים וביצע מילוי אוטומטי מנתוני המשרד</div>
      <div class="atabs" id="aiAppTabsRow" style="flex-wrap:wrap;gap:4px">
        ${apps.map((app, i) =>
          `<div class="atab ${i===0?'on':''}" onclick="switchDynAppTab(${i})">${app.title}</div>`
        ).join('')}
      </div>
      <div id="aiAppContent"></div>`;
    renderDynAppContent(0);
  }
}

/* ═════ DYNAMIC APPENDIX RENDERING ═════ */
let currentDynAppIdx = 0;

function switchDynAppTab(idx){
  currentDynAppIdx = idx;
  document.querySelectorAll('#aiAppTabsRow .atab').forEach((el, i) => {
    el.className = 'atab' + (i === idx ? ' on' : '');
  });
  renderDynAppContent(idx);
}

function renderDynAppContent(idx){
  const ac = document.getElementById('aiAppContent');
  if(!ac) return;
  const apps = currentAIResult?.appendices || [];
  const app = apps[idx];
  if(!app){ ac.innerHTML = ''; return; }
  ac.innerHTML = buildDynAppHtml(app, idx, currentAnalysisIdx);
}

function buildDynAppHtml(app, idx, tenderId){
  const tenderName = currentAIResult?.tenderName || '';
  const tenderOrg = currentAIResult?.orgName || '';
  const tenderNumber = currentAIResult?.tenderNumber || '';

  const headerHtml = `
    <div class="adoc">
      <div class="adoch">
        <div class="seal">נספח<br>${app.hebrewLabel || ''}</div>
        <div style="flex:1">
          <div class="adocht">${app.title}</div>
          <div class="adochs">${tenderName} | ${tenderOrg} | ${tenderNumber}</div>
        </div>
        <button class="btn bo sm" style="background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.3);color:#fff"
          onclick="printDocument('dynApp',${tenderId},${idx})">
          <svg width="11" height="11"><use href="#ic-print"/></svg> הדפס
        </button>
      </div>
      <div style="height:3px;background:linear-gradient(90deg,rgba(255,255,255,.3),rgba(255,255,255,.1))"></div>
      <div style="padding:12px 16px">
        <div style="margin-bottom:9px">
          <div style="font-weight:800;font-size:13px;color:var(--navy)">${BIDDER.name}${BIDDER.subtitle?' — '+BIDDER.subtitle:''}</div>
          <div style="font-size:10.5px;color:var(--s2)">${BIDDER.address} | ${BIDDER.phone} | ${BIDDER.email}</div>
        </div>
        ${app.description ? `<div style="font-size:11.5px;color:var(--s2);margin-bottom:9px;padding:6px 9px;background:var(--bg2);border-radius:6px">${app.description}</div>` : ''}
        ${app.autoFillNotes ? `<div class="alert ag2" style="margin-bottom:9px;font-size:11px">🤖 ${app.autoFillNotes}</div>` : ''}`;

  let contentHtml = '';

  if(app.isTable && app.fields && app.fields.length > 0){
    // Table-style appendix
    contentHtml = `
        <div style="overflow-x:auto">
          <table class="atable" id="appTable_${idx}">
            <thead><tr>${app.fields.map(f => `<th>${f.label}</th>`).join('')}<th style="width:30px"></th></tr></thead>
            <tbody>
              ${(app.rows||[]).map((row, ri) => `
                <tr>${app.fields.map(f => {
                  const val = row[f.key] !== undefined ? row[f.key] : '';
                  const dirStyle = (f.type === 'text' && /^[a-zA-Z0-9@+]/.test(val+'')) ? 'direction:ltr;' : '';
                  return `<td contenteditable="true" data-app="${idx}" data-row="${ri}" data-field="${f.key}"
                    onblur="updateAppField(${idx},${ri},'${f.key}',this.textContent)"
                    style="font-size:11.5px;min-width:60px;${dirStyle}">${val}</td>`;
                }).join('')}
                <td><span class="badge bgg" style="font-size:8px;cursor:default" title="ממולא אוטומטית">AI</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
  } else {
    // Form-style appendix
    const row = (app.rows && app.rows[0]) || {};
    contentHtml = (app.fields||[]).map(f => {
      const val = row[f.key] !== undefined ? row[f.key] : '';
      if(f.type === 'textarea'){
        return `<div style="margin-bottom:8px">
          <div style="font-weight:700;font-size:10px;color:var(--s3);margin-bottom:3px">${f.label}</div>
          <textarea class="fi" style="min-height:60px" data-app="${idx}" data-field="${f.key}"
            onblur="updateAppField(${idx},0,'${f.key}',this.value)">${val}</textarea>
        </div>`;
      }
      if(f.type === 'boolean'){
        return `<div style="margin-bottom:8px">
          <div style="font-weight:700;font-size:10px;color:var(--s3);margin-bottom:3px">${f.label}</div>
          <select class="fs" data-app="${idx}" data-field="${f.key}"
            onchange="updateAppField(${idx},0,'${f.key}',this.value)">
            <option value="false" ${!val || val==='false' ? 'selected' : ''}>לא</option>
            <option value="true" ${val && val!=='false' ? 'selected' : ''}>כן</option>
          </select>
        </div>`;
      }
      if(f.type === 'signature'){
        return `<div style="margin-bottom:8px">
          <div style="font-weight:700;font-size:10px;color:var(--s3);margin-bottom:3px">${f.label}</div>
          <div style="width:150px;height:50px;border:1.5px dashed var(--grn-border);border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--s3)">חתימה</div>
        </div>`;
      }
      // Default: text/number/date input
      const dirStyle = (f.type === 'text' && /^[a-zA-Z0-9@+]/.test(val+'')) ? 'direction:ltr;' : '';
      return `<div style="margin-bottom:8px">
        <div style="font-weight:700;font-size:10px;color:var(--s3);margin-bottom:3px">${f.label}</div>
        <input class="fi" type="${f.type==='date'?'date':f.type==='number'?'number':'text'}"
          value="${val}" style="${dirStyle}"
          data-app="${idx}" data-field="${f.key}"
          onblur="updateAppField(${idx},0,'${f.key}',this.value)">
      </div>`;
    }).join('');
  }

  const footerHtml = `
        <div class="wm">מזכיר Tender Intelligence | נוצר ${new Date().toLocaleDateString('he-IL')} | סודי</div>
      </div>
    </div>`;

  return headerHtml + contentHtml + footerHtml;
}

function updateAppField(appIdx, rowIdx, fieldKey, value){
  const apps = currentAIResult?.appendices;
  if(!apps || !apps[appIdx]) return;
  if(!apps[appIdx].rows) apps[appIdx].rows = [];
  if(!apps[appIdx].rows[rowIdx]) apps[appIdx].rows[rowIdx] = {};
  apps[appIdx].rows[rowIdx][fieldKey] = value;
  apps[appIdx].userEdited = true;
  apps[appIdx].lastModified = new Date().toISOString();

  // Persist
  if(currentAnalysisIdx >= 0){
    saveAppendices(currentAnalysisIdx, apps);
  }
}
