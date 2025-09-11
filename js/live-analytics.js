(function(){
  'use strict';

  // ───────────────────────────────────────── Shared helpers
  const $ = s => document.querySelector(s);
  const fmt = n => Number(n||0).toLocaleString();
  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
  function setLastUpdated(){ $('#lastUpdatedLabel').textContent = 'Last updated: ' + new Date().toLocaleString(); }
  function countUp(el, to){ el.textContent = fmt(to); }

  // ───────────────────────────────────────── Card 1: GA bubble cloud
  const GA_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxVHInAcoUybD8Uz2J8ve9gRUG44ewEXpnnRF9p7ddZqL8_5bCaLwhm6BnPDPG4g6A/exec';

  fetch(GA_ENDPOINT, { cache: 'no-store' })
    .then(r=>r.json())
    .then(json=>{
      setLastUpdated();
      if (!json || json.error) { $('#gaEmpty').hidden = false; return; }

      const card = $('#card-top-countries');
      const TOP_N = Number(card?.dataset?.topN) > 0 ? Number(card.dataset.topN) : 5;
      const allRows = Object.entries(json)
        .map(([name, val]) => ({ name: name || 'Unknown', value: Number(val)||0 }))
        .filter(d => d.value > 0)
        .sort((a,b)=>b.value-a.value);
      if (!allRows.length){ $('#gaEmpty').hidden = false; return; }

      countUp($('#gaVisitorsValue'), allRows.reduce((s,r)=>s+r.value,0));
      const rows = allRows.slice(0, TOP_N);

      const host = $('#gaCountryBarChart');
      host.hidden = false;

      const ro = new ResizeObserver(entries=>{
        for (const e of entries){
          const w = clamp(Math.floor(e.contentRect.width), 280, 4000);
          const h = clamp(Math.floor(e.contentRect.height), 220, 4000);
          drawBubbleCloud(host, rows, w, h);
        }
      });
      ro.observe(host);
      window.addEventListener('beforeunload', ()=> ro.disconnect(), { once:true });
    })
    .catch(()=> $('#gaEmpty').hidden = false);

  function drawBubbleCloud(host, data, w, h){
    host.innerHTML = '';
    host.style.position = 'relative';

    const colors = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316','#22c55e','#eab308','#3b82f6'];
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.display = 'block';

    const cx = w/2, cy = h/2;
    const maxVal = Math.max(1, ...data.map(d=>d.value));
    const minR = 14; const maxR = Math.round(Math.min(w,h) / 3.6);

    function seededRand(seed){ let s=0; for (let i=0;i<seed.length;i++) s=(s*31+seed.charCodeAt(i))>>>0; return ()=> (s=(1103515245*s+12345)>>>0)/2**32; }
    const rng = seededRand(data.map(d=>d.name).join('|'));

    const nodes = data.map((d,i)=>(
      { ...d, r: Math.max(minR, Math.sqrt(d.value/maxVal) * maxR), x: cx + (rng()-0.5) * (w*0.25), y: cy + (rng()-0.5) * (h*0.25), vx:0, vy:0, color: colors[i%colors.length] }
    ));

    const padding = 6, edgePad = 6, steps = 240;
    for (let k=0;k<steps;k++){
      for (const d of nodes){ d.vx += (cx - d.x) * 0.003; d.vy += (cy - d.y) * 0.003; }
      for (let i=0;i<nodes.length;i++){
        for (let j=i+1;j<nodes.length;j++){
          const a=nodes[i], b=nodes[j];
          const dx=b.x-a.x, dy=b.y-a.y; let dist=Math.hypot(dx,dy)||0.0001;
          const minD=a.r+b.r+padding;
          if (dist<minD){ const push=(minD-dist)/2, ux=dx/dist, uy=dy/dist; a.x-=ux*push; a.y-=uy*push; b.x+=ux*push; b.y+=uy*push; }
        }
      }
      for (const d of nodes){ d.x+=d.vx; d.y+=d.vy; d.vx*=0.88; d.vy*=0.88; d.x = clamp(d.x, edgePad + d.r, w - edgePad - d.r); d.y = clamp(d.y, edgePad + d.r, h - edgePad - d.r); }
    }

    let tip = host.querySelector('.bubble-tip'); if (!tip){ tip = document.createElement('div'); tip.className='bubble-tip'; tip.style.opacity=0; host.appendChild(tip); }

    const g = document.createElementNS(svgNS, 'g'); svg.appendChild(g);

    function fitText(el, text, maxWidth, maxFS, minFS){ el.textContent = text; el.style.fontSize = maxFS + 'px'; let bbox = el.getBBox(); while (bbox.width > maxWidth && maxFS > minFS){ maxFS -= 1; el.style.fontSize = maxFS + 'px'; bbox = el.getBBox(); } if (bbox.width <= maxWidth) return; let s = el.textContent; while (s.length > 2 && el.getBBox().width > maxWidth){ s = s.slice(0, -2) + '…'; el.textContent = s; } }

    nodes.forEach((d,i)=>{
      const group = document.createElementNS(svgNS, 'g'); group.setAttribute('transform', `translate(${d.x},${d.y})`); g.appendChild(group);
      const circ = document.createElementNS(svgNS, 'circle'); circ.setAttribute('r', d.r); circ.setAttribute('fill', d.color); circ.setAttribute('opacity','0.97'); group.appendChild(circ);
      const maxTextWidth = d.r * 1.7;
      const num = document.createElementNS(svgNS, 'text'); num.setAttribute('text-anchor','middle'); num.setAttribute('class','bubble-value'); num.setAttribute('y', -2); num.style.fontSize = Math.max(12, Math.min(22, Math.round(d.r * 0.5))) + 'px'; num.textContent = fmt(d.value); group.appendChild(num);
      const lab = document.createElementNS(svgNS, 'text'); lab.setAttribute('text-anchor','middle'); lab.setAttribute('class','bubble-country'); lab.setAttribute('y', 16); const fsLabMax = Math.max(10, Math.min(18, Math.round(d.r * 0.36))); lab.style.fontSize = fsLabMax + 'px'; lab.textContent = d.name; group.appendChild(lab);
      if (d.r < 26){ num.setAttribute('opacity','0'); lab.setAttribute('opacity','0'); } else { fitText(lab, d.name, maxTextWidth, fsLabMax, 9); }
      group.addEventListener('mouseenter', ()=>{ circ.setAttribute('opacity','1'); tip.innerHTML = `<b>${d.name}</b><br>${fmt(d.value)} visitors`; tip.style.opacity = 1; });
      group.addEventListener('mousemove', ev=>{ const b = host.getBoundingClientRect(); tip.style.left = (ev.clientX - b.left + 12) + 'px'; tip.style.top  = (ev.clientY - b.top  + 12) + 'px'; });
      group.addEventListener('mouseleave', ()=>{ circ.setAttribute('opacity','0.97'); tip.style.opacity = 0; });
    });

    host.appendChild(svg);
  }

  // ───────────────────────────────────────── Card 2: Supabase Source bar chart (responsive, auto-fitting)
  const SUPABASE_URL = "https://nmsgbinaxfwwcpgpsucx.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tc2diaW5heGZ3d2NwZ3BzdWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODAzNzAsImV4cCI6MjA3MjA1NjM3MH0.TC-LcpNJPTB6mwiTZgRYlh69fycs5tcGmS4B8yt0nNY";
  function sbHeaders(){ return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }; }

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
  const minusDays = (d,n) => { const c = new Date(d); c.setDate(c.getDate()-n); return c; };
  const yyyymmdd = iso => (iso||'').replaceAll('-', '');

  // Defaults: last 30 days (bugfix)
 const yesterday = minusDays(today, 1);
elTo.value   = toISO(yesterday);
elFrom.value = toISO(yesterday);

  function updateSummary(){ const parts = []; if (elFrom.value && elTo.value) parts.push(`${elFrom.value} → ${elTo.value}`); if (elCtry.value) parts.push(`Country: ${elCtry.value}`); elSum.textContent = parts.length ? `Filters: ${parts.join(' • ')}` : ''; }

  async function loadCountries(){
    try{
      const url = new URL(`${SUPABASE_URL}/rest/v1/ga4_users`);
      url.searchParams.set('select', 'country');
      url.searchParams.set('order', 'country.asc');
      const res = await fetch(url, { headers: sbHeaders(), cache:'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      const seen = new Set();
      rows.forEach(r => { const c = r.country || ''; if (!c || seen.has(c)) return; seen.add(c); const opt = document.createElement('option'); opt.value = c; opt.textContent = c; elCtry.appendChild(opt); });
    }catch(e){ console.warn('Country list failed:', e); }
  }

  async function fetchRows(){
    const url = new URL(`${SUPABASE_URL}/rest/v1/ga4_users`);
    url.searchParams.set('select', 'date,country,source,medium,totalusers');
    url.searchParams.set('order', 'totalusers.desc');
    const start = yyyymmdd(elFrom.value); const end = yyyymmdd(elTo.value);
    url.searchParams.append('date', `gte.${start}`);
    url.searchParams.append('date', `lte.${end}`);
    if ((elCtry.value||'').trim()) url.searchParams.append('country', `eq.${elCtry.value.trim()}`);
    const res = await fetch(url.toString(), { headers: sbHeaders(), cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return await res.json();
  }

  function bySource(rows){
    const map = new Map();
    for (const r of rows){ const k = r.source || '(not set)'; map.set(k, (map.get(k)||0) + Number(r.totalusers||0)); }
    const arr = Array.from(map, ([name, value]) => ({ name, value })).sort((a,b)=>b.value - a.value);
    return { arr, total: arr.reduce((s,x)=>s+x.value, 0) };
  }

  // Responsive bar chart with overflow-safe labels
  function drawBarChart(host, data){
    host.innerHTML = '';
    const W = Math.max(Math.floor(host.getBoundingClientRect().width), 320);

    const ROW = 48;
    const PAD_TOP = 20, PAD_RIGHT = 72, PAD_BOTTOM = 10, LABEL_W = 140; // wider labels
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
    const colors = ['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316','#22c55e','#eab308','#3b82f6'];

    const truncate = (s, max=24) => (s.length>max ? s.slice(0,max-1)+'…' : s);

    data.forEach((d, i) => {
      const yMid = PAD_TOP + i * ROW + ROW/2;

      // label (with title tooltip)
      const lab = document.createElementNS(ns, 'text');
      lab.setAttribute('x', LABEL_W - 10);
      lab.setAttribute('y', yMid);
      lab.setAttribute('text-anchor', 'end');
      lab.setAttribute('dominant-baseline', 'middle');
      lab.setAttribute('fill', colMuted);
      lab.style.fontSize = '12px';
      lab.textContent = truncate(d.name, Math.max(12, Math.floor(LABEL_W/7)));
      const ttitle = document.createElementNS(ns, 'title'); ttitle.textContent = d.name; lab.appendChild(ttitle);
      svg.appendChild(lab);

      // bar
      const bw = Math.max(2, x(d.value));
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', LABEL_W);
      rect.setAttribute('y', yMid - 9);
      rect.setAttribute('width', bw);
      rect.setAttribute('height', 18);
      rect.setAttribute('rx', 9);
      rect.setAttribute('fill', colors[i % colors.length]);
      rect.setAttribute('opacity', 0.9);
      svg.appendChild(rect);

      // value label — switches to inside if overflow
      let valX = LABEL_W + bw + 6;
      let anchor = 'start';
      let fill = colText;
      const roomInside = bw > 40; // inside room threshold
      if (valX > W - PAD_RIGHT) { // would overflow → put inside
        valX = LABEL_W + bw - 6;
        anchor = 'end';
        fill = roomInside ? '#ffffff' : colText;
      }
      const val = document.createElementNS(ns, 'text');
      val.setAttribute('x', valX);
      val.setAttribute('y', yMid);
      val.setAttribute('text-anchor', anchor);
      val.setAttribute('dominant-baseline', 'middle');
      val.setAttribute('fill', fill);
      val.style.fontSize = '12px';
      val.textContent = fmt(d.value);
      svg.appendChild(val);
    });
  }

  let lastSourceData = [];
  let barRO;
  function mountSourceChart(data){
    lastSourceData = data.slice(0, 12); // cap to 12 rows
    const redraw = () => drawBarChart(elChart, lastSourceData);
    if (barRO) barRO.disconnect();
    barRO = new ResizeObserver(redraw);
    barRO.observe(elChart);
    redraw();
  }

  async function refreshSources(){
    try {
      elLoading.hidden = false; elEmpty.hidden = true; elTotal.textContent = '—'; updateSummary();
      const rows = await fetchRows();
      const { arr, total } = bySource(rows);
      elTotal.textContent = fmt(total);
      if (!arr.length) { elChart.innerHTML = ''; elEmpty.hidden = false; return; }
      mountSourceChart(arr);
    } catch (e) {
      console.error('Source refresh failed', e);
      elChart.innerHTML = '';
      elEmpty.hidden = false;
    } finally { elLoading.hidden = true; }
  }

  elBtn.addEventListener('click', refreshSources);
  elClear.addEventListener('click', () => { elCtry.value = ''; elTo.value = toISO(today); elFrom.value = toISO(minusDays(today, 30)); refreshSources(); });
  document.querySelectorAll('.quick-pills .pill').forEach(p => {
    p.addEventListener('click', () => {
      const preset = p.getAttribute('data-preset');
      const now = new Date();
      if (preset === 'month') { const first = new Date(now.getFullYear(), now.getMonth(), 1); elFrom.value = toISO(first); elTo.value = toISO(now); }
      else { const n = Number(preset)||7; elFrom.value = toISO(minusDays(now, n)); elTo.value = toISO(now); }
      refreshSources();
    });
  });

  loadCountries().then(refreshSources);

  // ───────────────────────────────────────── Card 3: Last 7 days summary (deduped + lightweight)
  const elTotal7 = $('#csTotalUsers'), elNew7 = $('#csNewUsers'), elSes7 = $('#csSessions');
  const elFrom7 = $('#csDateFrom'), elTo7 = $('#csDateTo');
  const elEmpty7 = $('#csEmpty');
  const dayChartHost = $('#csChart');
  const newListHost  = $('#csCountryNewChart');
  const newListEmpty = $('#csCountryNewEmpty');

  async function fetchRecentDaily(limit=500){
    const url = new URL(`${SUPABASE_URL}/rest/v1/ga_country_daily`);
    url.searchParams.set('select','date,country,total_users,new_users,sessions');
    url.searchParams.set('order','date.desc');
    url.searchParams.set('limit', String(limit));
    const res = await fetch(url.toString(), { headers: sbHeaders(), cache: 'no-store' });
    if (!res.ok){ const body = await res.text(); throw new Error(`Supabase HTTP ${res.status}: ${body}`); }
    return (await res.json()).map(r => ({
      date: String(r.date||'').length===8 ? `${String(r.date).slice(0,4)}-${String(r.date).slice(4,6)}-${String(r.date).slice(6,8)}` : String(r.date||''),
      country: (r.country || '(not set)').toString(),
      total_users: Number(r.total_users || 0),
      new_users: Number(r.new_users || 0),
      sessions: Number(r.sessions || 0)
    }));
  }

  function pick7Days(rows){
    const seen = new Set(); const dates=[];
    for (const r of rows){ if (!r.date) continue; if (!seen.has(r.date)){ seen.add(r.date); dates.push(r.date); if (dates.length===7) break; } }
    if (!dates.length) return null; const daysAsc = [...dates].reverse();
    const perDay = {}; daysAsc.forEach(d => perDay[d] = { t:0,n:0,s:0 });
    let sumT=0,sumN=0,sumS=0;
    for (const r of rows){ if (!dates.includes(r.date)) continue; sumT+=r.total_users; sumN+=r.new_users; sumS+=r.sessions; perDay[r.date].t+=r.total_users; perDay[r.date].n+=r.new_users; perDay[r.date].s+=r.sessions; }
    return { daysAsc, perDay, sumT, sumN, sumS, from: daysAsc[0], to: daysAsc[daysAsc.length-1] };
  }

  function drawGroupedBars(host, days, data){
    host.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';
    const W = Math.max(Math.floor(host.getBoundingClientRect().width), 340);
    const H = 260; const PAD = { t: 24, r: 14, b: 36, l: 44 };
    const innerW = W - PAD.l - PAD.r; const innerH = H - PAD.t - PAD.b;
    const tArr = days.map(d => Number(data[d]?.t || 0));
    const nArr = days.map(d => Number(data[d]?.n || 0));
    const sArr = days.map(d => Number(data[d]?.s || 0));
    const maxY = Math.max(1, ...tArr, ...nArr, ...sArr);
    const xBand = i => PAD.l + (i + 0.5) * (innerW / days.length);
    const y = v => PAD.t + (1 - v / maxY) * innerH;

    const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('width','100%'); svg.setAttribute('height', H); svg.setAttribute('viewBox',`0 0 ${W} ${H}`); host.appendChild(svg);

    const gridN = 4; for (let i=0;i<=gridN;i++){ const gy = PAD.t + (i/gridN)*innerH; const line = document.createElementNS(ns,'line'); line.setAttribute('x1', PAD.l); line.setAttribute('x2', PAD.l + innerW); line.setAttribute('y1', gy); line.setAttribute('y2', gy); line.setAttribute('stroke', '#e5e7eb'); line.setAttribute('stroke-width', 1); svg.appendChild(line); const val = Math.round((1 - i/gridN) * maxY); const lab = document.createElementNS(ns,'text'); lab.setAttribute('x', PAD.l - 6); lab.setAttribute('y', gy); lab.setAttribute('text-anchor','end'); lab.setAttribute('dominant-baseline','central'); lab.setAttribute('fill', '#6b7280'); lab.style.fontSize = '11px'; lab.textContent = fmt(val); svg.appendChild(lab); }

    days.forEach((d, i) => { const tx = xBand(i); const lab = document.createElementNS(ns,'text'); lab.setAttribute('x', tx); lab.setAttribute('y', PAD.t + innerH + 16); lab.setAttribute('text-anchor','middle'); lab.setAttribute('fill', '#6b7280'); lab.style.fontSize = '11px'; lab.textContent = d.slice(5); svg.appendChild(lab); });

    const groupW = innerW / days.length; const gapG = Math.min(12, groupW * 0.2); const avail = groupW - gapG; const barW = Math.max(6, Math.floor(avail / 3) - 2);
    const colors = ['#2563eb', '#10b981', '#f59e0b'];

    days.forEach((d, i) => {
      const left = PAD.l + (i * innerW/days.length) + gapG/2;
      const series = [ { name:'Total', val: tArr[i], idx:0 }, { name:'New', val: nArr[i], idx:1 }, { name:'Sessions', val: sArr[i], idx:2 } ];
      series.forEach((s, k) => { const rect = document.createElementNS(ns,'rect'); const h = Math.max(1, y(0) - y(s.val)); rect.setAttribute('x', left + k*barW); rect.setAttribute('y', y(s.val)); rect.setAttribute('width', barW); rect.setAttribute('height', h); rect.setAttribute('rx', 4); rect.setAttribute('fill', colors[s.idx]); rect.setAttribute('opacity', '0.9'); svg.appendChild(rect); });
    });
  }

  let dayRO;
  async function load7DaySummary(){
    try{
      elEmpty7.hidden = true; elTotal7.textContent = elNew7.textContent = elSes7.textContent = '…';
      const rows = await fetchRecentDaily(); if (!rows.length){ elEmpty7.hidden = false; return; }
      const r = pick7Days(rows); if (!r){ elEmpty7.hidden = false; return; }
      elFrom7.textContent = r.from; elTo7.textContent = r.to; elTotal7.textContent = fmt(r.sumT); elNew7.textContent = fmt(r.sumN); elSes7.textContent = fmt(r.sumS);
      const redraw = () => drawGroupedBars(dayChartHost, r.daysAsc, r.perDay);
      if (dayRO) dayRO.disconnect(); dayRO = new ResizeObserver(redraw); dayRO.observe(dayChartHost); redraw();

      // simple Top countries by new users list
      const picked = new Set(r.daysAsc); const totals = new Map(); for (const row of rows){ if (!picked.has(row.date)) continue; totals.set(row.country, (totals.get(row.country)||0) + row.new_users); }
      const list = Array.from(totals, ([name, value]) => ({ name, value })).filter(d=>d.value>0).sort((a,b)=>b.value-a.value).slice(0, 8);
      newListHost.innerHTML = ''; if (!list.length){ newListEmpty.hidden = false; } else { newListEmpty.hidden = true; const header = document.createElement('div'); header.className='muted tiny'; header.style.display='grid'; header.style.gridTemplateColumns='1fr auto'; header.style.gap='8px'; header.style.padding='4px 0'; header.innerHTML = `<span>Country</span><span>New Users</span>`; newListHost.appendChild(header); list.forEach(d=>{ const row = document.createElement('div'); row.style.display='grid'; row.style.gridTemplateColumns='1fr auto'; row.style.gap='8px'; row.style.padding='6px 0'; row.style.borderTop='1px solid #e5e7eb'; row.innerHTML = `<span>${d.name}</span><span>${fmt(d.value)}</span>`; newListHost.appendChild(row); }); }
    }catch(e){ console.error('[Card3] load failed:', e); elEmpty7.hidden = false; }
  }

  load7DaySummary(); setInterval(load7DaySummary, 5*60*1000);
})();