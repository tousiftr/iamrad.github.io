   (function(){
                // ---------- Shared helpers ----------
                const $ = s => document.querySelector(s);
                const fmt = n => Number(n||0).toLocaleString();
                const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));

                // ---------- Card 1: GA bubble cloud ----------
const GA_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxVHInAcoUybD8Uz2J8ve9gRUG44ewEXpnnRF9p7ddZqL8_5bCaLwhm6BnPDPG4g6A/exec';

function setLastUpdated(){ $('#lastUpdatedLabel').textContent = 'Last updated: ' + new Date().toLocaleString(); }
function countUp(el, to){ el.textContent = fmt(to); }

fetch(GA_ENDPOINT, { cache: 'no-store' })
  .then(r=>r.json())
  .then(json=>{
    setLastUpdated();
    if (!json || json.error) { $('#gaEmpty').hidden = false; return; }

    // Determine N from DOM (e.g., <div id="card-top-countries" data-top-n="5">)
    const card = $('#card-top-countries');
    const TOP_N = Number(card?.dataset?.topN) > 0 ? Number(card.dataset.topN) : 5;

    // Build full list once
    const allRows = Object.entries(json)
      .map(([name, val]) => ({ name: name || 'Unknown', value: Number(val)||0 }))
      .filter(d => d.value > 0)
      .sort((a,b)=>b.value-a.value);

    if (!allRows.length){ $('#gaEmpty').hidden = false; return; }

    // Total from ALL countries
    const totalAll = allRows.reduce((s,r)=>s+r.value,0);
    countUp($('#gaVisitorsValue'), totalAll);

    // Render only Top N
    const rows = allRows.slice(0, TOP_N);

    const host = $('#gaCountryBarChart');
    host.hidden = false;

    // ResizeObserver – cleanup-safe
    const ro = new ResizeObserver(entries=>{
      for (const e of entries){
        const w = clamp(Math.floor(e.contentRect.width), 280, 4000);
        const h = clamp(Math.floor(e.contentRect.height), 220, 4000);
        drawBubbleCloud(host, rows, w, h);
      }
    });
    ro.observe(host);
    // tidy up when page leaves
    window.addEventListener('beforeunload', ()=> ro.disconnect(), { once:true });
  })
  .catch(err=>{
    console.error('GA fetch failed', err);
    $('#gaEmpty').hidden = false;
  });
                // ===== Bubble cloud with stacked labels =====
                function drawBubbleCloud(host, data, w, h){
                  host.innerHTML = '';
                  host.style.position = 'relative';

                  const colors = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316','#22c55e','#eab308','#3b82f6'];
                  const color = i => colors[i % colors.length];

                  const svgNS = 'http://www.w3.org/2000/svg';
                  const svg = document.createElementNS(svgNS, 'svg');
                  svg.setAttribute('width', '100%');
                  svg.setAttribute('height', '100%');
                  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
                  svg.style.display = 'block';

                  const cx = w/2, cy = h/2;
                  const maxVal = Math.max(1, ...data.map(d=>d.value));
               const minR = 14;
              const maxR = Math.round(Math.min(w,h) / 3.6);

                  // random-but-stable seed (based on names) so layout doesn't jump on resize
                  function seededRand(seed){
                    let s = 0;
                    for (let i=0;i<seed.length;i++) s = (s*31 + seed.charCodeAt(i)) >>> 0;
                    return ()=> (s = (1103515245*s + 12345) >>> 0) / 2**32;
                  }
                  const rng = seededRand(data.map(d=>d.name).join('|'));

                  const nodes = data.map((d,i)=>({
                    ...d,
                    r: Math.max(minR, Math.sqrt(d.value/maxVal) * maxR),
                    x: cx + (rng()-0.5) * (w*0.25),
                    y: cy + (rng()-0.5) * (h*0.25),
                    vx: 0, vy: 0,
                    color: color(i)
                  }));

                  // simple packing
                  const padding = 6, edgePad = 6, steps = 240;
                  for (let k=0;k<steps;k++){
                    for (const d of nodes){ d.vx += (cx - d.x) * 0.003; d.vy += (cy - d.y) * 0.003; }
                    for (let i=0;i<nodes.length;i++){
                      for (let j=i+1;j<nodes.length;j++){
                        const a=nodes[i], b=nodes[j];
                        const dx=b.x-a.x, dy=b.y-a.y; let dist=Math.hypot(dx,dy)||0.0001;
                        const minD=a.r+b.r+padding;
                        if (dist<minD){
                          const push=(minD-dist)/2, ux=dx/dist, uy=dy/dist;
                          a.x-=ux*push; a.y-=uy*push; b.x+=ux*push; b.y+=uy*push;
                        }
                      }
                    }
                    for (const d of nodes){
                      d.x+=d.vx; d.y+=d.vy; d.vx*=0.88; d.vy*=0.88;
                      d.x = clamp(d.x, edgePad + d.r, w - edgePad - d.r);
                      d.y = clamp(d.y, edgePad + d.r, h - edgePad - d.r);
                    }
                  }

                  // tooltip
                  let tip = host.querySelector('.bubble-tip');
                  if (!tip){
                    tip = document.createElement('div');
                    tip.className = 'bubble-tip';
                    tip.style.opacity = 0;
                    host.appendChild(tip);
                  }

                  const g = document.createElementNS(svgNS, 'g');
                  svg.appendChild(g);

                  // utility to fit text width
                  function fitText(el, text, maxWidth, maxFS, minFS){
                    el.textContent = text;
                    el.style.fontSize = maxFS + 'px';
                    let bbox = el.getBBox();
                    while (bbox.width > maxWidth && maxFS > minFS){
                      maxFS -= 1; el.style.fontSize = maxFS + 'px'; bbox = el.getBBox();
                    }
                    if (bbox.width <= maxWidth) return;
                    let s = el.textContent;
                    while (s.length > 2 && el.getBBox().width > maxWidth){
                      s = s.slice(0, -2) + '…';
                      el.textContent = s;
                    }
                  }

                  nodes.forEach(d=>{
                    const group = document.createElementNS(svgNS, 'g');
                    group.setAttribute('transform', `translate(${d.x},${d.y})`);
                    g.appendChild(group);

                    const circ = document.createElementNS(svgNS, 'circle');
                    circ.setAttribute('r', d.r);
                    circ.setAttribute('fill', d.color);
                    circ.setAttribute('opacity', '0.97');
                    group.appendChild(circ);

                    const maxTextWidth = d.r * 1.7;

                    const num = document.createElementNS(svgNS, 'text');
                    num.setAttribute('text-anchor','middle');
                    num.setAttribute('class','bubble-value');
                    num.setAttribute('y', -4);
                    num.style.fontSize = Math.max(12, Math.min(22, Math.round(d.r * 0.5))) + 'px';
                    num.textContent = fmt(d.value);
                    group.appendChild(num);

                    const lab = document.createElementNS(svgNS, 'text');
                    lab.setAttribute('text-anchor','middle');
                    lab.setAttribute('class','bubble-country');
                    lab.setAttribute('y', 14);
                    const fsLabMax = Math.max(10, Math.min(18, Math.round(d.r * 0.36)));
                    const fsLabMin = 9;
                    lab.style.fontSize = fsLabMax + 'px';
                    lab.textContent = d.name;
                    group.appendChild(lab);

                    if (d.r < 26){ num.setAttribute('opacity','0'); lab.setAttribute('opacity','0'); }
                    else { fitText(lab, d.name, maxTextWidth, fsLabMax, fsLabMin); }

                    group.addEventListener('mouseenter', ()=>{
                      circ.setAttribute('opacity','1');
                      tip.innerHTML = `<b>${d.name}</b><br>${fmt(d.value)} visitors`;
                      tip.style.opacity = 1;
                    });
                    group.addEventListener('mousemove', (ev)=>{
                      const b = host.getBoundingClientRect();
                      tip.style.left = (ev.clientX - b.left + 12) + 'px';
                      tip.style.top  = (ev.clientY - b.top  + 12) + 'px';
                    });
                    group.addEventListener('mouseleave', ()=>{
                      circ.setAttribute('opacity','0.97');
                      tip.style.opacity = 0;
                    });
                  });

                  host.appendChild(svg);
                }

                // ---------- Card 2: Supabase Source bar chart ----------
                const SUPABASE_URL = "https://nmsgbinaxfwwcpgpsucx.supabase.co";
                const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tc2diaW5heGZ3d2NwZ3BzdWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODAzNzAsImV4cCI6MjA3MjA1NjM3MH0.TC-LcpNJPTB6mwiTZgRYlh69fycs5tcGmS4B8yt0nNY";  
                const elChart   = $('#gaCountryBarChart2');
                const elEmpty   = $('#srcEmpty');
                const elLoading = $('#srcLoading');
                const elTotal   = $('#srcTotalVisitors');

                const elFrom  = $('#srcDateStart');
                const elTo    = $('#srcDateEnd');
                const elCtry  = $('#srcCountry');
                const elBtn   = $('#srcRefresh');
                const elClear = $('#srcClear');
                const elSum   = $('#srcSummary');

                const today = new Date();
                const toISO = d => new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
                const minusDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate()-n); return c; };
                const yyyymmdd = iso => (iso||'').replaceAll('-', '');

                // Defaults: last 30 days
                elTo.value = toISO(today);
                elFrom.value = toISO(minusDays(today, 1));

                function sbHeaders(){
                  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
                }

                function updateSummary(){
                  const parts = [];
                  if (elFrom.value && elTo.value) parts.push(`${elFrom.value} → ${elTo.value}`);
                  if (elCtry.value) parts.push(`Country: ${elCtry.value}`);
                  elSum.textContent = parts.length ? `Filters: ${parts.join(' • ')}` : '';
                }

                async function loadCountries() {
                  try {
                    const url = new URL(`${SUPABASE_URL}/rest/v1/ga4_users`);
                    url.searchParams.set('select', 'country');
                    url.searchParams.set('order', 'country.asc');
                    const res = await fetch(url, { headers: sbHeaders(), cache:'no-store' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const rows = await res.json();
                    const seen = new Set();
                    rows.forEach(r => {
                      const c = r.country || '';
                      if (!c || seen.has(c)) return;
                      seen.add(c);
                      const opt = document.createElement('option');
                      opt.value = c; opt.textContent = c;
                      elCtry.appendChild(opt);
                    });
                  } catch(e) { console.warn('Country list failed:', e); }
                }

                async function fetchRows() {
                  const url = new URL(`${SUPABASE_URL}/rest/v1/ga4_users`);
                  url.searchParams.set('select', 'date,country,source,medium,totalusers');
                  url.searchParams.set('order', 'totalusers.desc');

                  const start = yyyymmdd(elFrom.value);
                  const end   = yyyymmdd(elTo.value);
                  url.searchParams.append('date', `gte.${start}`);
                  url.searchParams.append('date', `lte.${end}`);
                  if ((elCtry.value||'').trim()) url.searchParams.append('country', `eq.${elCtry.value.trim()}`);

                  const res = await fetch(url.toString(), { headers: sbHeaders(), cache: 'no-store' });
                  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
                  return await res.json();
                }

                function bySource(rows){
                  const map = new Map();
                  for (const r of rows) {
                    const k = r.source || '(not set)';
                    map.set(k, (map.get(k)||0) + Number(r.totalusers||0));
                  }
                  const arr = Array.from(map, ([name, value]) => ({ name, value }))
                    .sort((a,b)=>b.value - a.value);
                  return { arr, total: arr.reduce((s,x)=>s+x.value, 0) };
                }

               function drawBarChart(host, data){
  host.innerHTML = '';
  const W = Math.max(Math.floor(host.getBoundingClientRect().width), 320);

  const ROW = 48;
  const PAD_TOP = 20;
  const PAD_RIGHT = 72;
  const PAD_BOTTOM = 10;
  const LABEL_W = 110;    

  const H = PAD_TOP + PAD_BOTTOM + data.length * ROW;

  const innerW = W - LABEL_W - PAD_RIGHT;
  const maxVal = Math.max(1, ...data.map(d => d.value));
  const x = v => (v / maxVal) * innerW;

  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('width','100%');
  svg.setAttribute('height', H);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  host.appendChild(svg);

  const ns = svg.namespaceURI;
  const styles = getComputedStyle(document.documentElement);
  const colMuted = styles.getPropertyValue('--muted').trim() || '#6b7280';
  const colText  = styles.getPropertyValue('--text').trim()  || '#111827';

  // Color palette for bars
  const colors = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316','#22c55e','#eab308','#3b82f6'];

  data.forEach((d, i) => {
    const yMid = PAD_TOP + i * ROW + ROW/2;

    // label
    const lab = document.createElementNS(ns, 'text');
    lab.setAttribute('x', LABEL_W - 8);
    lab.setAttribute('y', yMid);
    lab.setAttribute('text-anchor', 'end');
    lab.setAttribute('dominant-baseline', 'middle');
    lab.setAttribute('fill', colMuted);
    lab.style.fontSize = '12px';
    lab.textContent = d.name;
    svg.appendChild(lab);

    // bar
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', LABEL_W);
    rect.setAttribute('y', yMid - 9);
    rect.setAttribute('width', Math.max(2, x(d.value)));
    rect.setAttribute('height', 18);
    rect.setAttribute('rx', 9);
    rect.setAttribute('fill', colors[i % colors.length]); // use different colors
    rect.setAttribute('opacity', 0.85);
    svg.appendChild(rect);

    // value
    const val = document.createElementNS(ns, 'text');
    val.setAttribute('x', LABEL_W + x(d.value) + 6);
    val.setAttribute('y', yMid);
    val.setAttribute('dominant-baseline', 'middle');
    val.setAttribute('fill', colText);
    val.style.fontSize = '12px';
    val.textContent = (Number(d.value)||0).toLocaleString();
    svg.appendChild(val);
  });
}


                async function refreshSources(){
                  try {
                    elLoading.hidden = false;
                    elEmpty.hidden = true;
                    elTotal.textContent = '—';
                    updateSummary();

                    const rows = await fetchRows();
                    const { arr, total } = bySource(rows);
                    elTotal.textContent = fmt(total);
                    if (!arr.length) { elChart.innerHTML = ''; elEmpty.hidden = false; return; }
                    drawBarChart(elChart, arr.slice(0, 12));
                  } catch (e) {
                    console.error('Source refresh failed:', e);
                    elChart.innerHTML = '';
                    elEmpty.hidden = false;
                  } finally {
                    elLoading.hidden = true;
                  }
                }

                // Buttons
                elBtn.addEventListener('click', refreshSources);
                elClear.addEventListener('click', () => {
                  elCtry.value = '';
                  elTo.value = toISO(today);
                  elFrom.value = toISO(minusDays(today, 30));
                  refreshSources();
                });
                document.querySelectorAll('.quick-pills .pill').forEach(p => {
                  p.addEventListener('click', () => {
                    const preset = p.getAttribute('data-preset');
                    const now = new Date();
                    if (preset === 'month') {
                      const first = new Date(now.getFullYear(), now.getMonth(), 1);
                      elFrom.value = toISO(first);
                      elTo.value   = toISO(now);
                    } else {
                      const n = Number(preset)||7;
                      elFrom.value = toISO(minusDays(now, n));
                      elTo.value   = toISO(now);
                    }
                    refreshSources();
                  });
                });

                // Boot
                loadCountries().then(refreshSources);
              })();

/*!
 * Card 3 – Last 7 Days Summary + Grouped Bar Chart
 * Plus: Country grouped bars (Top 8) for the same 7-day window
 * Source: Supabase table `ga_country_daily`
 */



(function(){
  "use strict";

  // ─────────────────────────────────────────────────────────────────────────────
  // 1) Supabase connection
  // ─────────────────────────────────────────────────────────────────────────────
  const SUPABASE_URL = "https://nmsgbinaxfwwcpgpsucx.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tc2diaW5heGZ3d2NwZ3BzdWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODAzNzAsImV4cCI6MjA3MjA1NjM3MH0.TC-LcpNJPTB6mwiTZgRYlh69fycs5tcGmS4B8yt0nNY";
  function sbHeaders(){
    return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2) DOM targets
  // ─────────────────────────────────────────────────────────────────────────────
  const elTotal = document.querySelector('#csTotalUsers');
  const elNew   = document.querySelector('#csNewUsers');
  const elSes   = document.querySelector('#csSessions');
  const elFrom  = document.querySelector('#csDateFrom');
  const elTo    = document.querySelector('#csDateTo');
  const elEmpty = document.querySelector('#csEmpty');
  const dayChartHost = document.querySelector('#csChart');
  const csCountryHost = document.querySelector('#csCountryChart'); // new chart

  // Guard: if card elements aren’t present, bail quietly
  if (!elTotal || !elNew || !elSes || !elFrom || !elTo || !elEmpty || !dayChartHost){
    console.warn('[Card3] Missing one or more required elements. Skipping init.');
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3) Helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const fmt = n => Number(n||0).toLocaleString();
  function animateCount(el, to){
    try { if (typeof countUp === 'function') return countUp(el, to); } catch {}
    el.textContent = fmt(to);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4) Data fetch (recent rows, desc by date)
  // ─────────────────────────────────────────────────────────────────────────────
  async function fetchRecentRows(limit=500){
    const url = new URL(`${SUPABASE_URL}/rest/v1/ga_country_daily`);
    url.searchParams.set('select','date,country,total_users,new_users,sessions');
    url.searchParams.set('order','date.desc');
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url.toString(), { headers: sbHeaders(), cache: 'no-store' });
    if (!res.ok){
      const body = await res.text();
      throw new Error(`Supabase HTTP ${res.status}: ${body}`);
    }
    return await res.json();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5) Compute most recent 7 distinct dates + totals + per-day map
  // ─────────────────────────────────────────────────────────────────────────────
  function computeWindow(rows){
    if (!rows || !rows.length) return null;

    const seen = new Set();
    const datesDesc = [];
    for (const r of rows){
      const d = String(r.date||'').trim();
      if (!d) continue;
      if (!seen.has(d)){
        seen.add(d);
        datesDesc.push(d);
        if (datesDesc.length === 7) break;
      }
    }
    if (!datesDesc.length) return null;

    const daysAsc = [...datesDesc].reverse();      // for chart left→right
    const perDay = {};                             // { iso: {t,n,s} }
    daysAsc.forEach(d => perDay[d] = { t:0, n:0, s:0 });

    let sumT=0, sumN=0, sumS=0;
    for (const r of rows){
      if (datesDesc.includes(r.date)){
        const t = Number(r.total_users||0);
        const n = Number(r.new_users||0);
        const s = Number(r.sessions||0);
        sumT += t; sumN += n; sumS += s;
        if (perDay[r.date]){
          perDay[r.date].t += t;
          perDay[r.date].n += n;
          perDay[r.date].s += s;
        }
      }
    }
    return { daysAsc, perDay, sumT, sumN, sumS, from: daysAsc[0], to: daysAsc[daysAsc.length-1], datesPickedAsc: daysAsc };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6) Day-series grouped bars (SVG)
  // ─────────────────────────────────────────────────────────────────────────────
  let dayChartRO;
  function makeTip(host, cls){
    let tip = host.querySelector(`.${cls}`);
    if (!tip){
      tip = document.createElement('div');
      tip.className = cls;
      Object.assign(tip.style, {
        position:'absolute', pointerEvents:'none',
        background:'rgba(17,24,39,.95)', color:'#fff',
        padding:'6px 8px', borderRadius:'6px', fontSize:'12px',
        opacity:'0', transform:'translate(8px,8px)'
      });
      host.appendChild(tip);
    }
    return tip;
  }

  function drawGroupedBars(host, days, data){
    host.innerHTML = '';
    host.style.position = 'relative';

    const ns = 'http://www.w3.org/2000/svg';
    const W = Math.max(Math.floor(host.getBoundingClientRect().width), 340);
    const H = 260;
    const PAD = { t: 24, r: 14, b: 36, l: 44 };

    const innerW = W - PAD.l - PAD.r;
    const innerH = H - PAD.t - PAD.b;

    const tArr = days.map(d => Number(data[d]?.t || 0));
    const nArr = days.map(d => Number(data[d]?.n || 0));
    const sArr = days.map(d => Number(data[d]?.s || 0));
    const maxY = Math.max(1, ...tArr, ...nArr, ...sArr);

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    host.appendChild(svg);

    const xBand = (i) => PAD.l + (i + 0.5) * (innerW / days.length); // day center
    const y = (v) => PAD.t + (1 - v / maxY) * innerH;

    // gridlines + y labels
    const gridN = 4;
    for (let i=0;i<=gridN;i++){
      const gy = PAD.t + (i/gridN)*innerH;
      const line = document.createElementNS(ns,'line');
      line.setAttribute('x1', PAD.l);
      line.setAttribute('x2', PAD.l + innerW);
      line.setAttribute('y1', gy);
      line.setAttribute('y2', gy);
      line.setAttribute('stroke', '#e5e7eb');
      line.setAttribute('stroke-width', 1);
      svg.appendChild(line);

      const val = Math.round((1 - i/gridN) * maxY);
      const lab = document.createElementNS(ns,'text');
      lab.setAttribute('x', PAD.l - 6);
      lab.setAttribute('y', gy);
      lab.setAttribute('text-anchor','end');
      lab.setAttribute('dominant-baseline','central');
      lab.setAttribute('fill', '#6b7280');
      lab.style.fontSize = '11px';
      lab.textContent = fmt(val);
      svg.appendChild(lab);
    }

    // x labels (MM-DD)
    days.forEach((d, i) => {
      const tx = xBand(i);
      const lab = document.createElementNS(ns,'text');
      lab.setAttribute('x', tx);
      lab.setAttribute('y', PAD.t + innerH + 16);
      lab.setAttribute('text-anchor','middle');
      lab.setAttribute('fill', '#6b7280');
      lab.style.fontSize = '11px';
      lab.textContent = d.slice(5);
      svg.appendChild(lab);
    });

    // bars
    const groupW = innerW / days.length;
    const gapG = Math.min(12, groupW * 0.2);
    const avail = groupW - gapG;
    const barW = Math.max(6, Math.floor(avail / 3) - 2);
    const colors = ['#2563eb', '#10b981', '#f59e0b']; // total/new/sessions
    const tip = makeTip(host, 'cs-tip');

    days.forEach((d, i) => {
      const left = PAD.l + (i * innerW/days.length) + gapG/2;
      const series = [
        { name:'Total',    val: tArr[i], idx:0 },
        { name:'New',      val: nArr[i], idx:1 },
        { name:'Sessions', val: sArr[i], idx:2 },
      ];

      series.forEach((s, k) => {
        const rect = document.createElementNS(ns,'rect');
        const h = Math.max(1, y(0) - y(s.val));
        rect.setAttribute('x', left + k*barW);
        rect.setAttribute('y', y(s.val));
        rect.setAttribute('width', barW);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', 4);
        rect.setAttribute('fill', colors[s.idx]);
        rect.setAttribute('opacity', '0.9');

        rect.addEventListener('mouseenter', () => {
          tip.style.opacity = 1;
          tip.innerHTML = `<b>${d}</b><br>${s.name}: ${fmt(s.val)}`;
        });
        rect.addEventListener('mousemove', (ev) => {
          const b = host.getBoundingClientRect();
          tip.style.left = (ev.clientX - b.left + 10) + 'px';
          tip.style.top  = (ev.clientY - b.top  + 10) + 'px';
        });
        rect.addEventListener('mouseleave', () => tip.style.opacity = 0);

        svg.appendChild(rect);
      });
    });

    // legend
    const legend = document.createElementNS(ns,'g');
    legend.setAttribute('transform', `translate(${PAD.l},8)`);
    [
      { name:'Total', color: '#2563eb' },
      { name:'New', color: '#10b981' },
      { name:'Sessions', color: '#f59e0b' },
    ].forEach((it, idx) => {
      const x0 = idx * 110;
      const sw = document.createElementNS(ns,'rect');
      sw.setAttribute('x', x0);
      sw.setAttribute('y', 0);
      sw.setAttribute('width', 14);
      sw.setAttribute('height', 6);
      sw.setAttribute('rx', 3);
      sw.setAttribute('fill', it.color);
      legend.appendChild(sw);

      const t = document.createElementNS(ns,'text');
      t.setAttribute('x', x0 + 20);
      t.setAttribute('y', 5);
      t.setAttribute('dominant-baseline', 'central');
      t.style.fontSize = '12px';
      t.textContent = it.name;
      legend.appendChild(t);
    });
    svg.appendChild(legend);
  }

  function mountDayChart(daysAsc, perDay){
    if (!dayChartHost) return;
    const redraw = () => drawGroupedBars(dayChartHost, daysAsc, perDay);
    if (dayChartRO) dayChartRO.disconnect();
    dayChartRO = new ResizeObserver(redraw);
    dayChartRO.observe(dayChartHost);
    redraw();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7) Country grouped horizontal bars (Top 8 over same window)
  // ─────────────────────────────────────────────────────────────────────────────
  let csCountryRO;
  function buildCountryTotals(rows, datesPickedAsc, topK = 8){
    const picked = new Set(datesPickedAsc);
    const totals = new Map(); // country -> {t,n,s}
    for (const r of rows){
      if (!picked.has(r.date)) continue;
      const c = (r.country || '(not set)').toString();
      const acc = totals.get(c) || { t:0, n:0, s:0 };
      acc.t += Number(r.total_users||0);
      acc.n += Number(r.new_users||0);
      acc.s += Number(r.sessions||0);
      totals.set(c, acc);
    }
    const sorted = Array.from(totals.entries())
      .sort((a,b)=> b[1].t - a[1].t)
      .slice(0, topK);
    const countries = sorted.map(([c]) => c);
    const data = {}; sorted.forEach(([c,v]) => data[c] = v);
    return { countries, data };
  }

  function drawCountryBars(host, countries, data){
    host.innerHTML = '';
    host.style.position = 'relative';

    const ns = 'http://www.w3.org/2000/svg';
    const W = Math.max(Math.floor(host.getBoundingClientRect().width), 360);
    const ROW = 44;
    const PAD = { t: 24, r: 16, b: 14, l: 140 };
    const H = PAD.t + PAD.b + countries.length * ROW;

    const svg = document.createElementNS(ns,'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    host.appendChild(svg);

    const innerW = W - PAD.l - PAD.r;
    const tArr = countries.map(c => Number(data[c]?.t || 0));
    const nArr = countries.map(c => Number(data[c]?.n || 0));
    const sArr = countries.map(c => Number(data[c]?.s || 0));
    const maxVal = Math.max(1, ...tArr, ...nArr, ...sArr);
    const x = v => (v / maxVal) * innerW;

    const colors = ['#2563eb', '#10b981', '#f59e0b']; // total/new/sessions

    const barH = 22, gapY = (ROW - barH) / 2;
    const clusterGap = 8;
    const tip = makeTip(host, 'cty-tip');

    countries.forEach((c, i) => {
      const yTop = PAD.t + i * ROW + gapY;

      // label
      const lab = document.createElementNS(ns, 'text');
      lab.setAttribute('x', PAD.l - 8);
      lab.setAttribute('y', yTop + barH/2);
      lab.setAttribute('text-anchor','end');
      lab.setAttribute('dominant-baseline','middle');
      lab.setAttribute('fill', '#6b7280');
      lab.style.fontSize = '12px';
      lab.textContent = c;
      svg.appendChild(lab);

      const series = [
        { key:'Total',    val: tArr[i], color: colors[0], y: yTop - (barH + clusterGap) },
        { key:'New',      val: nArr[i], color: colors[1], y: yTop },
        { key:'Sessions', val: sArr[i], color: colors[2], y: yTop + (barH + clusterGap) },
      ];

      series.forEach(s=>{
        const rect = document.createElementNS(ns,'rect');
        rect.setAttribute('x', PAD.l);
        rect.setAttribute('y', s.y);
        rect.setAttribute('width', Math.max(2, x(s.val)));
        rect.setAttribute('height', barH);
        rect.setAttribute('rx', 10);
        rect.setAttribute('fill', s.color);
        rect.setAttribute('opacity', '0.9');
        svg.appendChild(rect);

        // value
        const val = document.createElementNS(ns,'text');
        val.setAttribute('x', PAD.l + x(s.val) + 6);
        val.setAttribute('y', s.y + barH/2);
        val.setAttribute('dominant-baseline','middle');
        val.setAttribute('fill', '#111827');
        val.style.fontSize = '12px';
        val.textContent = fmt(s.val);
        svg.appendChild(val);

        rect.addEventListener('mouseenter', ()=>{
          tip.style.opacity = 1;
          tip.innerHTML = `<b>${c}</b><br>${s.key}: ${fmt(s.val)}`;
        });
        rect.addEventListener('mousemove', (ev)=>{
          const b = host.getBoundingClientRect();
          tip.style.left = (ev.clientX - b.left + 10) + 'px';
          tip.style.top  = (ev.clientY - b.top  + 10) + 'px';
        });
        rect.addEventListener('mouseleave', ()=> tip.style.opacity = 0);
      });
    });

    // x-axis ticks
    const ticks = 4;
    for (let i=1;i<=ticks;i++){
      const v = Math.round((i/ticks) * maxVal);
      const gx = PAD.l + x(v);
      const line = document.createElementNS(ns,'line');
      line.setAttribute('x1', gx);
      line.setAttribute('x2', gx);
      line.setAttribute('y1', PAD.t - 6);
      line.setAttribute('y2', H - PAD.b + 2);
      line.setAttribute('stroke', '#e5e7eb');
      line.setAttribute('stroke-width', 1);
      svg.appendChild(line);

      const lab = document.createElementNS(ns,'text');
      lab.setAttribute('x', gx);
      lab.setAttribute('y', PAD.t - 10);
      lab.setAttribute('text-anchor','middle');
      lab.setAttribute('fill', '#6b7280');
      lab.style.fontSize = '11px';
      lab.textContent = fmt(v);
      svg.appendChild(lab);
    }

    // legend
    const legend = document.createElementNS(ns,'g');
    legend.setAttribute('transform', `translate(${PAD.l},8)`);
    [
      { name:'Total', color: '#2563eb' },
      { name:'New', color: '#10b981' },
      { name:'Sessions', color: '#f59e0b' },
    ].forEach((it, idx) => {
      const x0 = idx * 110;
      const sw = document.createElementNS(ns,'rect');
      sw.setAttribute('x', x0);
      sw.setAttribute('y', 0);
      sw.setAttribute('width', 14);
      sw.setAttribute('height', 6);
      sw.setAttribute('rx', 3);
      sw.setAttribute('fill', it.color);
      legend.appendChild(sw);

      const t = document.createElementNS(ns,'text');
      t.setAttribute('x', x0 + 20);
      t.setAttribute('y', 5);
      t.setAttribute('dominant-baseline', 'central');
      t.style.fontSize = '12px';
      t.textContent = it.name;
      legend.appendChild(t);
    });
    svg.appendChild(legend);
  }

  function mountCountryChart(countries, data){
    if (!csCountryHost) return;
    const redraw = () => drawCountryBars(csCountryHost, countries, data);
    if (csCountryRO) csCountryRO.disconnect();
    csCountryRO = new ResizeObserver(redraw);
    csCountryRO.observe(csCountryHost);
    redraw();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8) Load + render (both charts)
  // ─────────────────────────────────────────────────────────────────────────────
  async function load7DaySummary(){
    try {
      elEmpty.hidden = true;
      elTotal.textContent = elNew.textContent = elSes.textContent = '…';

      const rows = await fetchRecentRows();
      if (!rows.length){ elEmpty.hidden = false; return; }

      const r = computeWindow(rows);
      if (!r){ elEmpty.hidden = false; return; }

      // Counters + date range
      elFrom.textContent = r.from;
      elTo.textContent   = r.to;
      animateCount(elTotal, r.sumT);
      animateCount(elNew,   r.sumN);
      animateCount(elSes,   r.sumS);

      // Day-series grouped bars
      mountDayChart(r.daysAsc, r.perDay);

      // Country grouped bars (Top 8) across the same picked dates
      if (csCountryHost){
        const agg = buildCountryTotals(rows, r.datesPickedAsc, 8);
        if (agg.countries.length){
          mountCountryChart(agg.countries, agg.data);
        }
      }
    } catch (e){
      console.error('[Card3] load failed:', e);
      elEmpty.hidden = false;
    }
  }

  // Initial render + refresh every 5 minutes
  load7DaySummary();
  setInterval(load7DaySummary, 5 * 60 * 1000);

})();


window.addEventListener('DOMContentLoaded', () => {
(function(){
  "use strict";

  // ─────────────────────────────────────────────────────────────────────────────
  // Supabase (unchanged)
  // ─────────────────────────────────────────────────────────────────────────────
  const SUPABASE_URL = "https://nmsgbinaxfwwcpgpsucx.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tc2diaW5heGZ3d2NwZ3BzdWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODAzNzAsImV4cCI6MjA3MjA1NjM3MH0.TC-LcpNJPTB6mwiTZgRYlh69fycs5tcGmS4B8yt0nNY";
  function sbHeaders(){
    return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DOM handles (for Card 3 and our new list)
  // ─────────────────────────────────────────────────────────────────────────────
  const elTotal = document.querySelector('#csTotalUsers');
  const elNew   = document.querySelector('#csNewUsers');
  const elSes   = document.querySelector('#csSessions');
  const elFrom  = document.querySelector('#csDateFrom');
  const elTo    = document.querySelector('#csDateTo');
  const elEmpty = document.querySelector('#csEmpty');
  const dayChartHost = document.querySelector('#csChart');
  const csCountryHost = document.querySelector('#csCountryChart');

  const newListHost  = document.querySelector('#csCountryNewChart');
  const newListEmpty = document.querySelector('#csCountryNewEmpty');

  if (!elTotal || !elNew || !elSes || !elFrom || !elTo || !elEmpty || !dayChartHost){
    console.warn('[Init] Missing base Card 3 elements. Aborting setup.');
    return;
  }
  if (!newListHost || !newListEmpty){
    console.warn('[Init] New Users list card not found (csCountryNewChart / csCountryNewEmpty).');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Utils
  // ─────────────────────────────────────────────────────────────────────────────
  const fmt = n => Number(n||0).toLocaleString();
  function normalizeDate(d){
    if (!d) return '';
    const s = String(d).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;            // already ISO
    if (/^\d{8}$/.test(s)) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`; // yyyymmdd → ISO
    return s;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Fetch latest rows from ga_country_daily
  // ─────────────────────────────────────────────────────────────────────────────
  async function fetchRecentRows(limit=500){
    const url = new URL(`${SUPABASE_URL}/rest/v1/ga_country_daily`);
    url.searchParams.set('select','date,country,total_users,new_users,sessions');
    url.searchParams.set('order','date.desc');
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url.toString(), { headers: sbHeaders(), cache: 'no-store' });
    if (!res.ok){
      const body = await res.text();
      throw new Error(`Supabase HTTP ${res.status}: ${body}`);
    }
    const rows = await res.json();
    // Normalize + coerce
    return rows.map(r => ({
      date: normalizeDate(r.date),
      country: (r.country || '(not set)').toString(),
      total_users: Number(r.total_users || 0),
      new_users: Number(r.new_users || 0),
      sessions: Number(r.sessions || 0)
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Pick latest 7 distinct dates + aggregates per day
  // ─────────────────────────────────────────────────────────────────────────────
  function computeWindow(rows){
    const seen = new Set();
    const datesDesc = [];
    for (const r of rows){
      if (!r.date) continue;
      if (!seen.has(r.date)){
        seen.add(r.date);
        datesDesc.push(r.date);
        if (datesDesc.length === 7) break;
      }
    }
    if (!datesDesc.length) return null;
    const daysAsc = [...datesDesc].reverse();
    const perDay = {};
    daysAsc.forEach(d => perDay[d] = { t:0, n:0, s:0 });

    let sumT=0, sumN=0, sumS=0;
    for (const r of rows){
      if (!datesDesc.includes(r.date)) continue;
      sumT += r.total_users; sumN += r.new_users; sumS += r.sessions;
      perDay[r.date].t += r.total_users;
      perDay[r.date].n += r.new_users;
      perDay[r.date].s += r.sessions;
    }
    return { daysAsc, perDay, sumT, sumN, sumS, from: daysAsc[0], to: daysAsc[daysAsc.length-1], datesPickedAsc: daysAsc };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Simple Country → New Users list (your requested minimal viz)
  // ─────────────────────────────────────────────────────────────────────────────
  function buildCountryNewTotals(rows, datesPickedAsc, topK = 8){
    const picked = new Set(datesPickedAsc);
    const totals = new Map();
    for (const r of rows){
      if (!picked.has(r.date)) continue;
      totals.set(r.country, (totals.get(r.country) || 0) + r.new_users);
    }
    return Array.from(totals, ([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a,b) => b.value - a.value)
      .slice(0, topK);
  }

  function renderCountryNewList(rows, r){
    if (!newListHost || !newListEmpty) return;
    const data = buildCountryNewTotals(rows, r.datesPickedAsc, 8);

    console.log('[NewUsers] rows=', rows.length, 'dates=', r.datesPickedAsc, 'top=', data);

    newListHost.innerHTML = '';
    if (!data.length){
      newListEmpty.hidden = false;
      return;
    }
    newListEmpty.hidden = true;

    // header
    const header = document.createElement('div');
    header.className = 'muted tiny';
    header.style.display = 'grid';
    header.style.gridTemplateColumns = '1fr auto';
    header.style.gap = '8px';
    header.style.padding = '4px 0';
    header.innerHTML = `<span>Country</span><span>New Users</span>`;
    newListHost.appendChild(header);

    // rows
    data.forEach(d => {
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1fr auto';
      row.style.gap = '8px';
      row.style.padding = '6px 0';
      row.style.borderTop = '1px solid #e5e7eb';
      row.innerHTML = `
        <span>${d.name}</span>
        <span>${fmt(d.value)}</span>
      `;
      newListHost.appendChild(row);
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Minimal day chart mount (keep your existing draw if you have it)
  // ─────────────────────────────────────────────────────────────────────────────
  function mountDayChart(daysAsc, perDay){
    // If you have your own draw function already, keep using it.
    // This stub avoids errors if not present.
    if (typeof drawGroupedBars === 'function'){
      if (!window.__dayRO){
        window.__dayRO = new ResizeObserver(() => drawGroupedBars(dayChartHost, daysAsc, perDay));
        window.__dayRO.observe(dayChartHost);
      }
      drawGroupedBars(dayChartHost, daysAsc, perDay);
    }
  }

  // Existing country bars (keep your functions if already defined)
  function buildCountryTotals(rows, datesPickedAsc, topK = 8){
    const picked = new Set(datesPickedAsc);
    const totals = new Map(); // country -> {t,n,s}
    for (const r of rows){
      if (!picked.has(r.date)) continue;
      const acc = totals.get(r.country) || { t:0, n:0, s:0 };
      acc.t += r.total_users;
      acc.n += r.new_users;
      acc.s += r.sessions;
      totals.set(r.country, acc);
    }
    const sorted = Array.from(totals.entries()).sort((a,b)=> b[1].t - a[1].t).slice(0, topK);
    const countries = sorted.map(([c]) => c);
    const data = {}; sorted.forEach(([c,v]) => data[c] = v);
    return { countries, data };
  }
  function mountCountryChart(countries, data){
    if (!csCountryHost || typeof drawCountryBars !== 'function') return;
    if (!window.__ctyRO){
      window.__ctyRO = new ResizeObserver(() => drawCountryBars(csCountryHost, countries, data));
      window.__ctyRO.observe(csCountryHost);
    }
    drawCountryBars(csCountryHost, countries, data);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Loader
  // ─────────────────────────────────────────────────────────────────────────────
  async function load7DaySummary(){
    try{
      elEmpty.hidden = true;
      elTotal.textContent = elNew.textContent = elSes.textContent = '…';

      const rows = await fetchRecentRows();
      console.log('[Fetch] got', rows.length, 'rows. example:', rows[0]);

      if (!rows.length){ elEmpty.hidden = false; return; }
      const r = computeWindow(rows);
      console.log('[Window]', r);
      if (!r){ elEmpty.hidden = false; return; }

      // Counters
      elFrom.textContent = r.from;
      elTo.textContent   = r.to;
      elTotal.textContent = fmt(r.sumT);
      elNew.textContent   = fmt(r.sumN);
      elSes.textContent   = fmt(r.sumS);

      // Day chart (if present in your file)
      mountDayChart(r.daysAsc, r.perDay);

      // Existing country grouped bars (if present)
      if (csCountryHost){
        const agg = buildCountryTotals(rows, r.datesPickedAsc, 8);
        if (agg.countries.length) mountCountryChart(agg.countries, agg.data);
      }

      // ✅ Our simple Country → New Users list
      renderCountryNewList(rows, r);

    } catch (e){
      console.error('[load7DaySummary] failed:', e);
      elEmpty.hidden = false;
      // Surface error in the new list area so you can see it
      if (newListHost){
        newListHost.innerHTML = `<div class="empty muted">Error: ${e.message}</div>`;
      }
    }
  }

  // Boot + refresh
  load7DaySummary();
  setInterval(load7DaySummary, 5 * 60 * 1000);

})();
});

