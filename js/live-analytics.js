
'use strict';

(() => {
  // =======================
  // Utilities & Config
  // =======================
  const $ = (s) => document.querySelector(s);
  const fmt = (n) => Number(n || 0).toLocaleString();
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const setLastUpdated = () => {
    const el = $('#lastUpdatedLabel');
    if (el) el.textContent = 'Last updated: ' + new Date().toLocaleString();
  };
  const countUp = (el, to) => {
    if (el) el.textContent = fmt(to);
  };

  async function requestJSON(input, init = {}) {
    const res = await fetch(input, { cache: 'no-store', ...init });
    if (!res.ok) {
      const body = await (async () => {
        try {
          return await res.text();
        } catch {
          return '';
        }
      })();
      throw new Error(`HTTP ${res.status}: ${body || res.statusText}`);
    }
    return res.json();
  }

  // NOTE: consider moving these into env vars for production
  const SUPABASE_URL = 'https://nmsgbinaxfwwcpgpsucx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tc2diaW5heGZ3d2NwZ3BzdWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0ODAzNzAsImV4cCI6MjA3MjA1NjM3MH0.TC-LcpNJPTB6mwiTZgRYlh69fycs5tcGmS4B8yt0nNY';
  const sbHeaders = () => ({ apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` });

  const PALETTE = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#22c55e', '#eab308', '#3b82f6'];
  const today = new Date();
  const toISO = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const minusDays = (d, n) => {
    const c = new Date(d);
    c.setDate(c.getDate() - n);
    return c;
  };
  const yyyymmdd = (iso) => (iso || '').replaceAll('-', '');

  // =======================
  // Shared DOM refs (Cards 1 & 2)
  // =======================
  const elChart = $('#gaCountryBarChart2');
  const elEmpty = $('#srcEmpty');
  const elLoading = $('#srcLoading');
  const elTotal = $('#srcTotalVisitors');

  const elFrom = $('#srcDateStart');
  const elTo = $('#srcDateEnd');
  const elCtry = $('#srcCountry');
  const elBtn = $('#srcRefresh');
  const elClear = $('#srcClear');
  const elSum = $('#srcSummary');

  // Defaults: last 30 days
  const defaultEnd = today;
  const defaultStart = minusDays(today, 7);
  if (elTo) elTo.value = toISO(defaultEnd);
  if (elFrom) elFrom.value = toISO(defaultStart);

  // ---- WORLD FILTER SUPPORT (NEW) ----
  function currentCountry() {
    // Treat blank or "WORLD" as global / all countries
    const v = (elCtry?.value || '').trim();
    return v && v !== 'WORLD' ? v : '';
  }
  function currentCountryLabel() {
    const v = (elCtry?.value || '').trim();
    return v && v !== 'WORLD' ? v : 'World';
  }

  // Filters summary label (Card 2)
  function updateSummary() {
    const parts = [];
    if (elFrom?.value && elTo?.value) parts.push(`${elFrom.value} → ${elTo.value}`);
    parts.push(`Country: ${currentCountryLabel()}`);
    if (elSum) elSum.textContent = parts.length ? `Filters: ${parts.join(' • ')}` : '';
  }

  // Populate countries + "World"
  async function loadCountries() {
    try {
      if (!elCtry) return;
      // Reset & inject "World" option first
      elCtry.innerHTML = '';
      {
        const opt = document.createElement('option');
        opt.value = 'WORLD'; // sentinel value = global
        opt.textContent = 'World (All)';
        elCtry.appendChild(opt);
      }

      const url = new URL(`${SUPABASE_URL}/rest/v1/ga4_users`);
      url.searchParams.set('select', 'country');
      url.searchParams.set('order', 'country.asc');
      const rows = await requestJSON(url.toString(), { headers: sbHeaders() });
      const seen = new Set();
      rows.forEach((r) => {
        const c = (r.country || '').toString().trim();
        if (!c || seen.has(c)) return;
        seen.add(c);
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        elCtry.appendChild(opt);
      });
    } catch (e) {
      console.warn('Country list failed:', e);
    }
  }

  async function fetchRows() {
    const url = new URL(`${SUPABASE_URL}/rest/v1/ga4_users`);
    url.searchParams.set('select', 'date,country,source,medium,totalusers');
    url.searchParams.set('order', 'totalusers.desc');
    const start = yyyymmdd(elFrom?.value);
    const end = yyyymmdd(elTo?.value);
    if (start) url.searchParams.append('date', `gte.${start}`);
    if (end) url.searchParams.append('date', `lte.${end}`);
    const c = currentCountry();
    if (c) url.searchParams.append('country', `eq.${c}`);
    return requestJSON(url.toString(), { headers: sbHeaders() });
  }

  const bySource = (rows) => {
    const map = new Map();
    for (const r of rows) {
      const k = r.source || '(not set)';
      map.set(k, (map.get(k) || 0) + Number(r.totalusers || 0));
    }
    const arr = Array.from(map, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    return { arr, total: arr.reduce((s, x) => s + x.value, 0) };
  };

  const byCountry = (rows) => {
    const map = new Map();
    for (const r of rows) {
      const k = r.country || 'Unknown';
      map.set(k, (map.get(k) || 0) + Number(r.totalusers || 0));
    }
    const arr = Array.from(map, ([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
    return { arr, total: arr.reduce((s, x) => s + x.value, 0) };
  };

  // =======================
  // Card 2 — Source Bar Chart
  // =======================
  function drawBarChart(host, data) {
    if (!host) return; // safe-guard
    host.innerHTML = '';
    const W = Math.max(Math.floor(host.getBoundingClientRect().width), 320);

    const ROW = 48;
    const PAD_TOP = 20,
      PAD_RIGHT = 72,
      PAD_BOTTOM = 10,
      LABEL_W = 160;
    const H = PAD_TOP + PAD_BOTTOM + data.length * ROW;

    const innerW = W - LABEL_W - PAD_RIGHT;
    const maxVal = Math.max(1, ...data.map((d) => d.value));
    const x = (v) => (v / maxVal) * innerW;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    host.appendChild(svg);

    const ns = svg.namespaceURI;
    const styles = getComputedStyle(document.documentElement);
    const colMuted = styles.getPropertyValue('--muted').trim() || '#6b7280';
    const colText = styles.getPropertyValue('--text').trim() || '#111827';
    const trunc = (s, max = 24) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

    data.forEach((d, i) => {
      const yMid = PAD_TOP + i * ROW + ROW / 2;

      // label
      const lab = document.createElementNS(ns, 'text');
      lab.setAttribute('x', LABEL_W - 10);
      lab.setAttribute('y', yMid);
      lab.setAttribute('text-anchor', 'end');
      lab.setAttribute('dominant-baseline', 'middle');
      lab.setAttribute('fill', colMuted);
      lab.style.fontSize = '12px';
      lab.textContent = trunc(d.name, Math.max(12, Math.floor(LABEL_W / 7)));
      const ttitle = document.createElementNS(ns, 'title');
      ttitle.textContent = d.name;
      lab.appendChild(ttitle);
      svg.appendChild(lab);

      // bar
      const bw = Math.max(2, x(d.value));
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', LABEL_W);
      rect.setAttribute('y', yMid - 9);
      rect.setAttribute('width', bw);
      rect.setAttribute('height', 18);
      rect.setAttribute('rx', 9);
      rect.setAttribute('fill', PALETTE[i % PALETTE.length]);
      rect.setAttribute('opacity', 0.9);
      svg.appendChild(rect);

      // value label (outside unless overflow)
      let valX = LABEL_W + bw + 6;
      let anchor = 'start';
      let fill = colText;
      if (valX > W - PAD_RIGHT) {
        // overflow → place inside
        valX = LABEL_W + bw - 6;
        anchor = 'end';
        fill = bw > 40 ? '#ffffff' : colText;
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
  function mountSourceChart(data) {
    lastSourceData = data.slice(0, 12); // cap to 12 rows
    const redraw = () => drawBarChart(elChart, lastSourceData);
    if (barRO) barRO.disconnect();
    if (elChart) {
      barRO = new ResizeObserver(redraw);
      barRO.observe(elChart);
    }
    redraw();
  }

  // =======================
  // Card 1 — Bubble Cloud (Top Countries)
  // =======================
  const elBubbleHost = $('#gaCountryBarChart');
  const elGAEmpty = $('#gaEmpty');
  const elGATotal = $('#gaVisitorsValue');
  const cardTopCountries = $('#card-top-countries');
  let bubbleRO;

  function drawBubbleCloud(host, data, w, h) {
    if (!host) return; // safe-guard
    host.innerHTML = '';
    host.style.position = 'relative';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.style.display = 'block';

    const maxVal = Math.max(1, ...data.map((d) => d.value));
    const minR = 14;
    const maxR = Math.round(Math.min(w, h) / 3.6);

    // deterministic pseudo-random for layout
    function seededRand(seed) {
      let s = 0;
      for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
      return () => ((s = (1103515245 * s + 12345) >>> 0) / 2 ** 32);
    }
    const rng = seededRand(data.map((d) => d.name).join('|'));

    const nodes = data.map((d, i) => ({
      ...d,
      r: Math.max(minR, Math.sqrt(d.value / maxVal) * maxR),
      x: w / 2 + (rng() - 0.5) * (w * 0.25),
      y: h / 2 + (rng() - 0.5) * (h * 0.25),
      vx: 0,
      vy: 0,
      color: PALETTE[i % PALETTE.length],
    }));

    const padding = 6,
      edgePad = 6,
      steps = 240;

    for (let k = 0; k < steps; k++) {
      // pull to center
      for (const d of nodes) {
        d.vx += ((w / 2 - d.x) * 0.003);
        d.vy += ((h / 2 - d.y) * 0.003);
      }
      // collisions
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i],
            b = nodes[j];
          const dx = b.x - a.x,
            dy = b.y - a.y;
          let dist = Math.hypot(dx, dy) || 0.0001;
          const minD = a.r + b.r + padding;
          if (dist < minD) {
            const push = (minD - dist) / 2,
              ux = dx / dist,
              uy = dy / dist;
            a.x -= ux * push;
            a.y -= uy * push;
            b.x += ux * push;
            b.y += uy * push;
          }
        }
      }
      // integrate & clamp
      for (const d of nodes) {
        d.x += d.vx;
        d.y += d.vy;
        d.vx *= 0.88;
        d.vy *= 0.88;
        d.x = clamp(d.x, edgePad + d.r, w - edgePad - d.r);
        d.y = clamp(d.y, edgePad + d.r, h - edgePad - d.r);
      }
    }

    // Tooltip (shared with Card 3 when present)
    let tip = host.querySelector('.bubble-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'bubble-tip';
      tip.style.opacity = 0;
      host.appendChild(tip);
    }

    const g = document.createElementNS(svgNS, 'g');
    svg.appendChild(g);

    function fitText(el, text, maxWidth, maxFS, minFS) {
      el.textContent = text;
      el.style.fontSize = maxFS + 'px';
      let bbox = el.getBBox();
      while (bbox.width > maxWidth && maxFS > minFS) {
        maxFS -= 1;
        el.style.fontSize = maxFS + 'px';
        bbox = el.getBBox();
      }
      if (bbox.width <= maxWidth) return;
      let s = el.textContent;
      while (s.length > 2 && el.getBBox().width > maxWidth) {
        s = s.slice(0, -2) + '…';
        el.textContent = s;
      }
    }

    nodes.forEach((d) => {
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
      num.setAttribute('text-anchor', 'middle');
      num.setAttribute('y', -2);
      num.style.fontSize = Math.max(12, Math.min(22, Math.round(d.r * 0.5))) + 'px';
      num.textContent = fmt(d.value);
      group.appendChild(num);

      const lab = document.createElementNS(svgNS, 'text');
      lab.setAttribute('text-anchor', 'middle');
      lab.setAttribute('y', 16);
      const fsLabMax = Math.max(10, Math.min(18, Math.round(d.r * 0.36)));
      lab.style.fontSize = fsLabMax + 'px';
      lab.textContent = d.name;
      group.appendChild(lab);

      if (d.r < 26) {
        num.setAttribute('opacity', '0');
        lab.setAttribute('opacity', '0');
      } else {
        fitText(lab, d.name, maxTextWidth, fsLabMax, 9);
      }

      group.addEventListener('mouseenter', () => {
        circ.setAttribute('opacity', '1');
        tip.innerHTML = `<b>${d.name}</b><br>${fmt(d.value)} visitors`;
        tip.style.opacity = 1;
      });
      group.addEventListener('mousemove', (ev) => {
        const b = host.getBoundingClientRect();
        tip.style.left = ev.clientX - b.left + 12 + 'px';
        tip.style.top = ev.clientY - b.top + 12 + 'px';
      });
      group.addEventListener('mouseleave', () => {
        circ.setAttribute('opacity', '0.97');
        tip.style.opacity = 0;
      });
    });

    host.appendChild(svg);
  }

  function updateCard1FromRows(allRows) {
    try {
      setLastUpdated();
      const TOP_N = Number(cardTopCountries?.dataset?.topN) > 0 ? Number(cardTopCountries.dataset.topN) : 5;
      const { arr, total } = byCountry(allRows);

      if (!arr.length) {
        if (elGAEmpty) elGAEmpty.hidden = false;
        if (elBubbleHost) elBubbleHost.innerHTML = '';
        if (elGATotal) elGATotal.textContent = '—';
        return;
      }

      countUp(elGATotal, total);
      const rows = arr.slice(0, TOP_N);
      if (!elBubbleHost) return;
      elBubbleHost.hidden = false;

      const redraw = () => {
        const r = elBubbleHost.getBoundingClientRect();
        const w = clamp(Math.floor(r.width), 280, 4000);
        const h = clamp(Math.floor(r.height), 220, 4000);
        drawBubbleCloud(elBubbleHost, rows, w, h);
      };

      if (bubbleRO) bubbleRO.disconnect();
      bubbleRO = new ResizeObserver(redraw);
      bubbleRO.observe(elBubbleHost);
      redraw();
    } catch (e) {
      console.warn('Card1 update failed:', e);
      if (elGAEmpty) elGAEmpty.hidden = false;
    }
  }

  // =======================
  // Unified headers (Cards 1 & 2)
  // =======================
  function rangeShortLabel() {
    const now = new Date();
    const f = elFrom?.value ? new Date(elFrom.value) : null;
    const t = elTo?.value ? new Date(elTo.value) : null;
    if (!f || !t) return 'All';

    const fd = new Date(f.getFullYear(), f.getMonth(), f.getDate());
    const td = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    const diffDays = Math.round((td - fd) / 86400000);
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (fd.getTime() === firstOfThisMonth.getTime()) return 'This month';
    if (diffDays === 7) return '7d';
    if (diffDays === 30) return '30d';
    return `${elFrom.value} → ${elTo.value}`;
  }

  function currentTotalFromDOM() {
    const raw = String(document.getElementById('srcTotalVisitors')?.textContent || '');
    return Number(raw.replace(/[^\d.-]/g, '')) || 0;
  }

  function updateBothCards(total) {
    const range = rangeShortLabel();
    const ctry = currentCountryLabel();

    // Card 2
    const c2Label = document.querySelector('#card-source .stats .muted');
    if (c2Label) c2Label.textContent = `Visitors (${range}, ${ctry}):`;
    const c2Num = document.getElementById('srcTotalVisitors');
    if (c2Num) c2Num.textContent = fmt(total);

    // Card 1
    const c1Label = document.querySelector('#card-top-countries .stats .muted');
    if (c1Label) c1Label.textContent = `Visitors (${range}, ${ctry}):`;
    const c1Num = document.getElementById('gaVisitorsValue');
    if (c1Num) countUp(c1Num, total);
  }

  [elFrom, elTo].forEach((el) => el?.addEventListener('change', () => updateBothCards(currentTotalFromDOM())));
  document.querySelectorAll('.quick-pills .pill').forEach((p) => p.addEventListener('click', () => updateBothCards(currentTotalFromDOM())));
  updateBothCards(currentTotalFromDOM());

  // =======================
  // Refresh (Cards 1 & 2)
  // =======================
  async function refreshSources() {
    try {
      if (elLoading) elLoading.hidden = false;
      if (elEmpty) elEmpty.hidden = true;
      if (elTotal) elTotal.textContent = '—';
      updateSummary();

      const rows = await fetchRows();

      // Card 2
      const { arr, total } = bySource(rows);
      if (elTotal) elTotal.textContent = fmt(total);
      if (!arr.length) {
        if (elChart) elChart.innerHTML = '';
        if (elEmpty) elEmpty.hidden = false;
      } else {
        mountSourceChart(arr);
      }

      // Card 1
      updateCard1FromRows(rows);

      // unified headers
      updateBothCards(total);

      // Also update donuts if present
      osCard?.refresh?.();
      brCard?.refresh?.();
    } catch (e) {
      console.error('Source refresh failed', e);
      if (elChart) elChart.innerHTML = '';
      if (elEmpty) elEmpty.hidden = false;
      if (elGAEmpty) elGAEmpty.hidden = false;
      updateBothCards(0);
    } finally {
      if (elLoading) elLoading.hidden = true;
    }
  }

  // =======================
  // Quick-pills & Controls
  // =======================
  elBtn?.addEventListener('click', refreshSources);
  elClear?.addEventListener('click', () => {
    if (elCtry) elCtry.value = 'WORLD'; // reset to global
    if (elTo) elTo.value = toISO(today);
    if (elFrom) elFrom.value = toISO(minusDays(today, 30));
    refreshSources();
  });

  document.querySelectorAll('.quick-pills .pill').forEach((p) => {
    p.addEventListener('click', () => {
      const preset = p.getAttribute('data-preset');
      const now = new Date();
      if (preset === 'month') {
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        if (elFrom) elFrom.value = toISO(first);
        if (elTo) elTo.value = toISO(now);
      } else {
        const n = Number(preset) || 7;
        if (elFrom) elFrom.value = toISO(minusDays(now, n));
        if (elTo) elTo.value = toISO(now);
      }
      refreshSources();
    });
  });

  // =======================
  // Card 3 — Last 7 Days Summary
  // (now respects country; blank/WORLD = global)
  // =======================
  (() => {
    const elTotal7 = document.getElementById('csTotalUsers');
    const elNew7 = document.getElementById('csNewUsers');
    const elSes7 = document.getElementById('csSessions');
    const elFrom7 = document.getElementById('csDateFrom');
    const elTo7 = document.getElementById('csDateTo');
    const elEmpty7 = document.getElementById('csEmpty');
    const dayChartHost = document.getElementById('csChart');
    const newListHost = document.getElementById('csCountryNewChart');
    const newListEmpty = document.getElementById('csCountryNewEmpty');

    async function fetchRecentDaily(country, limit = 500) {
      const url = new URL(`${SUPABASE_URL}/rest/v1/ga_country_daily`);
      url.searchParams.set('select', 'date,country,total_users,new_users,sessions');
      url.searchParams.set('order', 'date.desc');
      url.searchParams.set('limit', String(limit));
      if (country) url.searchParams.append('country', `eq.${country}`);
      const rows = await requestJSON(url.toString(), { headers: sbHeaders() });
      return rows.map((r) => ({
        date:
          String(r.date || '').length === 8
            ? `${String(r.date).slice(0, 4)}-${String(r.date).slice(4, 6)}-${String(r.date).slice(6, 8)}`
            : String(r.date || ''),
        country: (r.country || '(not set)').toString(),
        total_users: Number(r.total_users || 0),
        new_users: Number(r.new_users || 0),
        sessions: Number(r.sessions || 0),
      }));
    }

    function pick7Days(rows) {
      const seen = new Set();
      const dates = [];
      for (const r of rows) {
        if (!r.date) continue;
        if (!seen.has(r.date)) {
          seen.add(r.date);
          dates.push(r.date);
          if (dates.length === 7) break;
        }
      }
      if (!dates.length) return null;

      const daysAsc = [...dates].reverse();
      const perDay = {};
      daysAsc.forEach((d) => (perDay[d] = { t: 0, n: 0, s: 0 }));

      let sumT = 0,
        sumN = 0,
        sumS = 0;
      for (const r of rows) {
        if (!dates.includes(r.date)) continue;
        sumT += r.total_users;
        sumN += r.new_users;
        sumS += r.sessions;
        perDay[r.date].t += r.total_users;
        perDay[r.date].n += r.new_users;
        perDay[r.date].s += r.sessions;
      }
      return { daysAsc, perDay, sumT, sumN, sumS, from: daysAsc[0], to: daysAsc[daysAsc.length - 1] };
    }

    function drawGroupedBars(host, days, data) {
      if (!host) return; // safe-guard
      host.innerHTML = '';
      const parent = host.parentElement || host;
      const ns = 'http://www.w3.org/2000/svg';

      const W = Math.max(Math.floor(host.getBoundingClientRect().width), 340);
      const H = 260;
      const PAD = { t: 28, r: 12, b: 40, l: 48 };
      const innerW = W - PAD.l - PAD.r;
      const innerH = H - PAD.t - PAD.b;

      const series = [
        { key: 't', name: 'Total', get: (d) => Number(data[d]?.t || 0), color: PALETTE[0] },
        { key: 'n', name: 'New', get: (d) => Number(data[d]?.n || 0), color: PALETTE[1] },
        { key: 's', name: 'Sessions', get: (d) => Number(data[d]?.s || 0), color: PALETTE[2] },
      ];

      const maxY = Math.max(
        1,
        ...days.map((d) => series[0].get(d)),
        ...days.map((d) => series[1].get(d)),
        ...days.map((d) => series[2].get(d))
      );

      const xBand = (i) => PAD.l + (i + 0.5) * (innerW / days.length);
      const y = (v) => PAD.t + (1 - v / maxY) * innerH;

      // Tooltip
      let tip = parent.querySelector('.bubble-tip');
      if (!tip) {
        tip = document.createElement('div');
        tip.className = 'bubble-tip';
        tip.style.opacity = '0';
        tip.style.position = 'absolute';
        tip.style.pointerEvents = 'none';
        parent.appendChild(tip);
      }
      const showTip = (html, evt) => {
        const box = parent.getBoundingClientRect();
        const px = (evt?.clientX || box.left) - box.left + 12;
        const py = (evt?.clientY || box.top) - box.top + 12;
        tip.innerHTML = html;
        tip.style.left = `${px}px`;
        tip.style.top = `${py}px`;
        tip.style.opacity = '1';
      };
      const hideTip = () => {
        tip.style.opacity = '0';
      };

      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', H);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      host.appendChild(svg);

      // Y grid & ticks
      const gridN = 4;
      for (let i = 0; i <= gridN; i++) {
        const gy = PAD.t + (i / gridN) * innerH;
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', PAD.l);
        line.setAttribute('x2', PAD.l + innerW);
        line.setAttribute('y1', gy);
        line.setAttribute('y2', gy);
        line.setAttribute('stroke', '#e5e7eb');
        line.setAttribute('stroke-width', 1);
        svg.appendChild(line);

        const val = Math.round((1 - i / gridN) * maxY);
        const lab = document.createElementNS(ns, 'text');
        lab.setAttribute('x', PAD.l - 6);
        lab.setAttribute('y', gy);
        lab.setAttribute('text-anchor', 'end');
        lab.setAttribute('dominant-baseline', 'central');
        lab.setAttribute('fill', '#6b7280');
        lab.style.fontSize = '11px';
        lab.textContent = fmt(val);
        svg.appendChild(lab);
      }

      // X labels (dates)
      days.forEach((d, i) => {
        const lab = document.createElementNS(ns, 'text');
        lab.setAttribute('x', xBand(i));
        lab.setAttribute('y', PAD.t + innerH + 16);
        lab.setAttribute('text-anchor', 'middle');
        lab.setAttribute('fill', '#6b7280');
        lab.style.fontSize = '11px';
        lab.textContent = d.slice(5);
        svg.appendChild(lab);
      });

      // Bars & labels
      const groupW = innerW / days.length;
      const gapG = Math.min(12, groupW * 0.2);
      const avail = groupW - gapG;
      const barW = Math.max(6, Math.floor(avail / 3) - 2);

      days.forEach((d, i) => {
        const baseLeft = PAD.l + (i * innerW) / days.length + gapG / 2;
        series.forEach((s, k) => {
          const v = s.get(d);
          const h = Math.max(1, PAD.t + innerH - y(v));
          const x = baseLeft + k * barW;

          const rect = document.createElementNS(ns, 'rect');
          rect.setAttribute('x', x);
          rect.setAttribute('y', y(v));
          rect.setAttribute('width', barW);
          rect.setAttribute('height', h);
          rect.setAttribute('rx', 4);
          rect.setAttribute('fill', s.color);
          rect.setAttribute('opacity', 0.9);
          rect.addEventListener('mouseenter', (evt) => showTip(`<strong>${s.name}</strong> · ${d}<br/>${fmt(v)}`, evt));
          rect.addEventListener('mousemove', (evt) => showTip(tip.innerHTML, evt));
          rect.addEventListener('mouseleave', hideTip);
          svg.appendChild(rect);

          const cx = x + barW / 2;
          const ty = y(v) - 6; // above bar top
          const label = document.createElementNS(ns, 'text');
          label.setAttribute('x', cx);
          label.setAttribute('y', ty);
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('fill', '#374151');
          label.style.fontSize = '11px';
          label.style.fontWeight = '500';
          label.textContent = fmt(v);
          svg.appendChild(label);
        });
      });

      // Legend
      const legend = document.createElementNS(ns, 'g');
      const items = series.map((s) => ({ name: s.name, color: s.color }));
      const itemW = 78,
        legendW = itemW * items.length;
      const lx = Math.max(PAD.l, W - PAD.r - legendW - 6);
      const ly = 8;
      items.forEach((it, idx) => {
        const x0 = lx + idx * itemW;
        const sw = document.createElementNS(ns, 'rect');
        sw.setAttribute('x', x0);
        sw.setAttribute('y', ly);
        sw.setAttribute('width', 10);
        sw.setAttribute('height', 10);
        sw.setAttribute('rx', 2);
        sw.setAttribute('fill', it.color);
        const tx = document.createElementNS(ns, 'text');
        tx.setAttribute('x', x0 + 16);
        tx.setAttribute('y', ly + 9);
        tx.setAttribute('fill', '#374151');
        tx.style.fontSize = '12px';
        tx.textContent = it.name;
        legend.appendChild(sw);
        legend.appendChild(tx);
      });
      svg.appendChild(legend);
    }

    let dayRO;
    async function load7DaySummary() {
      try {
        if (elEmpty7) elEmpty7.hidden = true;
        if (elTotal7) elTotal7.textContent = '…';
        if (elNew7) elNew7.textContent = '…';
        if (elSes7) elSes7.textContent = '…';

        const rows = await fetchRecentDaily(currentCountry());
        if (!rows.length) {
          if (elEmpty7) elEmpty7.hidden = false;
          return;
        }

        const r = pick7Days(rows);
        if (!r) {
          if (elEmpty7) elEmpty7.hidden = false;
          return;
        }

        if (elFrom7) elFrom7.textContent = r.from;
        if (elTo7) elTo7.textContent = r.to;
        if (elTotal7) elTotal7.textContent = fmt(r.sumT);
        if (elNew7) elNew7.textContent = fmt(r.sumN);
        if (elSes7) elSes7.textContent = fmt(r.sumS);

        const redraw = () => drawGroupedBars(dayChartHost, r.daysAsc, r.perDay);
        if (dayRO) dayRO.disconnect();
        if (dayChartHost) {
          dayRO = new ResizeObserver(redraw);
          dayRO.observe(dayChartHost);
        }
        redraw();

        // Top countries by new users (same 7-day window)
        const picked = new Set(r.daysAsc);
        const totals = new Map();
        for (const row of rows) {
          if (!picked.has(row.date)) continue;
          totals.set(row.country, (totals.get(row.country) || 0) + row.new_users);
        }
        let list = Array.from(totals, ([name, value]) => ({ name, value }))
          .filter((d) => d.value > 0)
          .sort((a, b) => b.value - a.value);

        // If a specific country is selected, show only that one; otherwise top 8 globally.
        if (currentCountry()) {
          list = list.filter((d) => d.name === currentCountry()).slice(0, 1);
        } else {
          list = list.slice(0, 8);
        }

        if (newListHost) {
          newListHost.innerHTML = '';
          if (!list.length) {
            if (newListEmpty) newListEmpty.hidden = false;
          } else {
            if (newListEmpty) newListEmpty.hidden = true;

            const header = document.createElement('div');
            header.className = 'muted tiny';
            header.style.display = 'grid';
            header.style.gridTemplateColumns = '1fr auto';
            header.style.gap = '8px';
            header.style.padding = '4px 0';
            header.innerHTML = `<span>Country</span><span>New Users</span>`;
            newListHost.appendChild(header);

            list.forEach((d) => {
              const row = document.createElement('div');
              row.style.display = 'grid';
              row.style.gridTemplateColumns = '1fr auto';
              row.style.gap = '8px';
              row.style.padding = '6px 0';
              row.style.borderTop = '1px solid #e5e7eb';
              row.innerHTML = `<span>${d.name}</span><span>${fmt(d.value)}</span>`;
              newListHost.appendChild(row);
            });
          }
        }
      } catch (e) {
        console.error('[Card3] load failed:', e);
        if (elEmpty7) elEmpty7.hidden = false;
      }
    }

    load7DaySummary();
    setInterval(load7DaySummary, 5 * 60 * 1000);

    // keep Card 3 in sync with global controls
    elCtry?.addEventListener('change', load7DaySummary);
    elBtn?.addEventListener('click', load7DaySummary);
    elClear?.addEventListener('click', load7DaySummary);
  })();

  // =======================
  // Cards 5 & 6 — OS / Browser Donuts (clean, full-bleed)
  // Aligned with global controls & helpers above
  // =======================
  const COLORS = Array.isArray(window.PALETTE) ? window.PALETTE : PALETTE;

  const toYMD = (iso) => (typeof yyyymmdd === 'function' ? yyyymmdd(iso) : (iso || '').replaceAll('-', ''));

  const isoStr = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  function last30ISO() {
    const now = new Date();
    const s = new Date(now);
    s.setDate(now.getDate() - 30);
    return { startISO: isoStr(s), endISO: isoStr(now) };
  }
  function computePresetRange(preset) {
    const now = new Date();
    if (preset === '7') {
      const s = new Date(now);
      s.setDate(now.getDate() - 7);
      return { startISO: isoStr(s), endISO: isoStr(now) };
    }
    if (preset === '30') {
      const s = new Date(now);
      s.setDate(now.getDate() - 30);
      return { startISO: isoStr(s), endISO: isoStr(now) };
    }
    if (preset === 'month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startISO: isoStr(s), endISO: isoStr(now) };
    }
    return null; // Global (use page filters)
  }

  async function fetchRowsForRange({ startISO, endISO, country }) {
    const build = (useISO) => {
      const url = new URL(`${SUPABASE_URL}/rest/v1/ga4_users`);
      url.searchParams.set('select', 'date,country,browser,operating_system,totalusers');
      url.searchParams.set('order', 'totalusers.desc');
      url.searchParams.set('limit', '10000');
      url.searchParams.append('date', `gte.${useISO ? startISO : toYMD(startISO)}`);
      url.searchParams.append('date', `lte.${useISO ? endISO : toYMD(endISO)}`);
      if ((country || '').trim()) url.searchParams.append('country', `eq.${country.trim()}`);
      return url.toString();
    };
    try {
      const a = await requestJSON(build(false), { headers: sbHeaders() }); // YYYYMMDD
      if (Array.isArray(a) && a.length) return a;
    } catch {}
    try {
      const b = await requestJSON(build(true), { headers: sbHeaders() }); // YYYY-MM-DD
      return Array.isArray(b) ? b : [];
    } catch {
      return [];
    }
  }

  function aggregateShare(rows, key, topN = 6) {
    const map = new Map();
    let total = 0;
    for (const r of rows) {
      const v = Number(r.totalusers ?? r.total_users ?? 0);
      if (!v) continue;
      const name = (r[key] ?? '(not set)').toString();
      map.set(name, (map.get(name) || 0) + v);
      total += v;
    }
    let arr = Array.from(map, ([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
    if (arr.length > topN) {
      const head = arr.slice(0, topN);
      const other = arr.slice(topN).reduce((s, d) => s + d.value, 0);
      if (other > 0) head.push({ name: 'Other', value: other });
      arr = head;
    }
    return { arr, total };
  }

  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
  }
  function tint(hex, pct) {
    const { r, g, b } = hexToRgb(hex);
    const s = 1 + pct;
    const c = (x) => Math.round(Math.min(255, Math.max(0, x * s)));
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  }

  function drawImpactDonut(host, legendHost, data, centerLabel) {
    if (!host) return; // safe-guard
    host.innerHTML = '';
    if (legendHost) legendHost.innerHTML = '';

    // square, full-bleed
    const W = Math.max(320, Math.floor(host.getBoundingClientRect().width));
    const S = W; // square canvas
    host.style.aspectRatio = '1 / 1';
    host.style.display = 'block';
    host.style.minHeight = `${S}px`;

    const cx = S / 2,
      cy = S / 2;
    const M = 6;
    const R = S / 2 - M; // outer radius near edge
    const r = R * 0.58; // inner radius (thick ring)
    const explode = 10;

    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
    host.appendChild(svg);

    // defs: shadow + gradients
    const defs = document.createElementNS(ns, 'defs');
    const filt = document.createElementNS(ns, 'filter');
    const fid = `pieShadow-${host.id || Math.random().toString(36).slice(2)}`;
    filt.setAttribute('id', fid);
    filt.setAttribute('x', '-50%');
    filt.setAttribute('y', '-50%');
    filt.setAttribute('width', '200%');
    filt.setAttribute('height', '200%');
    const fe = document.createElementNS(ns, 'feDropShadow');
    fe.setAttribute('dx', '0');
    fe.setAttribute('dy', '2');
    fe.setAttribute('stdDeviation', '3');
    fe.setAttribute('flood-opacity', '0.25');
    defs.appendChild(filt).appendChild(fe);

    data.forEach((d, i) => {
      const lg = document.createElementNS(ns, 'linearGradient');
      lg.setAttribute('id', `g-${host.id}-${i}`);
      lg.setAttribute('x1', '0%');
      lg.setAttribute('y1', '0%');
      lg.setAttribute('x2', '100%');
      lg.setAttribute('y2', '100%');
      const base = COLORS[i % COLORS.length];
      const s1 = document.createElementNS(ns, 'stop');
      s1.setAttribute('offset', '0%');
      s1.setAttribute('stop-color', tint(base, +0.18));
      const s2 = document.createElementNS(ns, 'stop');
      s2.setAttribute('offset', '100%');
      s2.setAttribute('stop-color', tint(base, -0.06));
      lg.appendChild(s1);
      lg.appendChild(s2);
      defs.appendChild(lg);
    });
    svg.appendChild(defs);

    const sum = data.reduce((s, d) => s + d.value, 0) || 1;
    const toXY = (ang, rr) => [cx + rr * Math.cos(ang), cy + rr * Math.sin(ang)];

    // center readout (updates on hover)
    const center = document.createElementNS(ns, 'g');
    const big = document.createElementNS(ns, 'text');
    big.setAttribute('x', cx);
    big.setAttribute('y', cy - 4);
    big.setAttribute('text-anchor', 'middle');
    big.setAttribute('dominant-baseline', 'central');
    big.style.fontSize = '22px';
    big.style.fontWeight = '800';
    big.style.fill = '#111827';
    big.textContent = '—%';
    const small = document.createElementNS(ns, 'text');
    small.setAttribute('x', cx);
    small.setAttribute('y', cy + 18);
    small.setAttribute('text-anchor', 'middle');
    small.style.fontSize = '12px';
    small.style.fill = '#6b7280';
    small.textContent = `${centerLabel || ''} · ${fmt(sum)} visitors`;
    center.appendChild(big);
    center.appendChild(small);
    svg.appendChild(center);

    // slices
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('filter', `url(#${fid})`);
    svg.appendChild(g);

    let a0 = -Math.PI / 2;
    const delayStep = 70;
    data.forEach((d, i) => {
      const frac = d.value / sum;
      const a1 = a0 + frac * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;

      const [x0, y0] = toXY(a0, R);
      const [x1, y1] = toXY(a1, R);
      const [xi, yi] = toXY(a1, r);
      const [xj, yj] = toXY(a0, r);

      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${xi} ${yi} A ${r} ${r} 0 ${large} 0 ${xj} ${yj} Z`);
      path.setAttribute('fill', `url(#g-${host.id}-${i})`);
      path.style.transformOrigin = `${cx}px ${cy}px`;
      path.style.transition = 'transform 220ms ease, opacity 220ms ease';
      path.style.animation = `pieIn 420ms ease ${i * delayStep}ms both`;

      path.addEventListener('mouseenter', () => {
        const mid = (a0 + a1) / 2;
        const dx = Math.cos(mid) * 10;
        const dy = Math.sin(mid) * 10;
        path.style.transform = `translate(${dx}px, ${dy}px)`;
        big.textContent = `${Math.round(frac * 1000) / 10}%`;
        small.textContent = `${d.name} · ${fmt(d.value)} visitors`;
      });
      path.addEventListener('mouseleave', () => {
        path.style.transform = 'translate(0,0)';
        big.textContent = '—%';
        small.textContent = `${centerLabel || ''} · ${fmt(sum)} visitors`;
      });

      g.appendChild(path);
      a0 = a1;
    });

    // centered narrow legend
    if (legendHost) {
      const wrap = document.createElement('div');
      wrap.style.display = 'grid';
      wrap.style.gap = '8px';
      wrap.style.maxWidth = '320px';
      wrap.style.margin = '10px auto 0';

      data.forEach((d, i) => {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '14px 1fr auto';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.style.cursor = 'pointer';

        const sw = document.createElement('div');
        sw.style.width = '12px';
        sw.style.height = '12px';
        sw.style.borderRadius = '3px';
        sw.style.background = COLORS[i % COLORS.length];

        const name = document.createElement('div');
        name.textContent = d.name;
        name.style.fontSize = '13px';
        name.style.color = '#374151';

        const pct = document.createElement('div');
        pct.textContent = `${Math.round((d.value / sum) * 1000) / 10}%`;
        pct.style.fontSize = '13px';
        pct.style.color = '#111827';

        row.appendChild(sw);
        row.appendChild(name);
        row.appendChild(pct);
        wrap.appendChild(row);

        const slice = g.children[i];
        row.addEventListener('mouseenter', () => slice?.dispatchEvent(new Event('mouseenter')));
        row.addEventListener('mouseleave', () => slice?.dispatchEvent(new Event('mouseleave')));
      });
      legendHost.appendChild(wrap);
    }

    // keyframes once
    if (!document.getElementById('impactPieKF')) {
      const st = document.createElement('style');
      st.id = 'impactPieKF';
      st.textContent = '@keyframes pieIn{from{transform:scale(.94);opacity:0}to{transform:scale(1);opacity:1}}';
      document.head.appendChild(st);
    }
  }

  function makeDonutCard({ cardId, key, centerLabel, ids: { pieId, legendId, totalId, rangeId, loadingId, emptyId } }) {
    // DOM
    const card = document.getElementById(cardId);
    const pieHost = document.getElementById(pieId);
    const legend = document.getElementById(legendId);
    const totalEl = document.getElementById(totalId);
    const rangeEl = document.getElementById(rangeId);
    const loading = document.getElementById(loadingId);
    const empty = document.getElementById(emptyId);

    // Hide the "Range" label if present (aligned with other cards)
    if (rangeEl?.parentElement) rangeEl.parentElement.style.display = 'none';

    // Add local pill group (7d / 30d / This month / Global)
    let localPreset = null; // '7' | '30' | 'month' | null (Global)
    (function injectPills() {
      if (!card) return;
      const stats = card.querySelector('.card-header .stats');
      if (!stats || card.querySelector('.osb-pills')) return;
      const wrap = document.createElement('div');
      wrap.className = 'osb-pills';
      Object.assign(wrap.style, { display: 'inline-flex', gap: '6px', marginLeft: '10px' });

      function pill(text, preset) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pill';
        b.textContent = text;
        b.dataset.preset = preset ?? '';
        Object.assign(b.style, {
          padding: '4px 8px',
          border: '1px solid #e5e7eb',
          borderRadius: '9999px',
          fontSize: '12px',
          background: 'transparent',
          cursor: 'pointer',
        });
        b.addEventListener('click', () => {
          localPreset = preset ?? null;
          highlight();
          refresh();
        });
        return b;
      }

      wrap.appendChild(pill('7d', '7'));
      wrap.appendChild(pill('30d', '30'));
      wrap.appendChild(pill('This month', 'month'));

      stats.appendChild(wrap);

      function highlight() {
        wrap.querySelectorAll('.pill').forEach((btn) => {
          const active = (btn.dataset.preset || '') === (localPreset || '');
          btn.style.background = active ? '#111827' : 'transparent';
          btn.style.color = active ? '#ffffff' : '';
          btn.style.borderColor = active ? '#111827' : '#e5e7eb';
        });
      }
      highlight();
    })();

    // Resize-aware re-render
    let ro;
    function mount(arr, total) {
      const redraw = () => drawImpactDonut(pieHost, legend, arr, centerLabel);
      if (ro) ro.disconnect();
      if (pieHost) {
        ro = new ResizeObserver(redraw);
        ro.observe(pieHost);
      }
      redraw();
      if (totalEl) totalEl.textContent = fmt(total);
    }

    // Refresh (pulls data, aggregates, renders)
    async function refresh() {
      try {
        if (loading) loading.hidden = false;
        if (empty) empty.hidden = true;
        if (totalEl) totalEl.textContent = '—';

        // Effective range: local preset OR global inputs (or last 30d fallback)
        let range = computePresetRange(localPreset);
        if (!range) {
          let startISO = (elFrom?.value || '').trim();
          let endISO = (elTo?.value || '').trim();
          if (!startISO || !endISO) ({ startISO, endISO } = last30ISO());
          range = { startISO, endISO };
        }
        const country = currentCountry();

        const rows = await fetchRowsForRange({ ...range, country });
        const { arr, total } = aggregateShare(rows, key);

        if (!arr.length || total === 0) {
          if (pieHost) pieHost.innerHTML = '';
          if (legend) legend.innerHTML = '';
          if (empty) empty.hidden = false;
          if (totalEl) totalEl.textContent = '0';
          return;
        }
        mount(arr, total);
      } catch (e) {
        console.error(`[${cardId}] refresh failed:`, e);
        if (empty) empty.hidden = false;
      } finally {
        if (loading) loading.hidden = true;
      }
    }

    return { refresh };
  }

  // ---------- Build the two cards ----------
  const osCard = makeDonutCard({
    cardId: 'card-os',
    key: 'operating_system',
    centerLabel: 'Operating Systems',
    ids: {
      pieId: 'osPie',
      legendId: 'osLegend',
      totalId: 'osTotal',
      rangeId: 'osRange',
      loadingId: 'osLoading',
      emptyId: 'osEmpty',
    },
  });

  const brCard = makeDonutCard({
    cardId: 'card-browser',
    key: 'browser',
    centerLabel: 'Browsers',
    ids: {
      pieId: 'brPie',
      legendId: 'brLegend',
      totalId: 'brTotal',
      rangeId: 'brRange',
      loadingId: 'brLoading',
      emptyId: 'brEmpty',
    },
  });

  // ---------- Wire to global controls (so both cards update) ----------
  elBtn?.addEventListener('click', () => {
    osCard.refresh();
    brCard.refresh();
  });
  elClear?.addEventListener('click', () => {
    osCard.refresh();
    brCard.refresh();
  });
  elFrom?.addEventListener('change', () => {
    osCard.refresh();
    brCard.refresh();
  });
  elTo?.addEventListener('change', () => {
    osCard.refresh();
    brCard.refresh();
  });
  elCtry?.addEventListener('change', () => {
    osCard.refresh();
    brCard.refresh();
  });
  document.querySelectorAll('.quick-pills .pill').forEach((p) =>
    p.addEventListener('click', () => {
      osCard.refresh();
      brCard.refresh();
    })
  );

  // =======================
  // Card 4 — Future hook
  // =======================
  function initCard4() {
    /* no-op for now */
  }

  // =======================
  // Boot
  // =======================
  (async function boot() {
    await loadCountries();
    await refreshSources();
    initCard4();

    // Initial paint for donuts after sources load
    try {
      osCard.refresh();
      brCard.refresh();
    } catch {}
  })();
})();

 