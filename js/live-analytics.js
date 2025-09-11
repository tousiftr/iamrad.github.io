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


