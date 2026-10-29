/* ============================================================
   ROTARACT CLUB OF DR. N.G.P ARTS & SCIENCE COLLEGE
   Events Admin Manager - js/events-admin.js
   Complete events, reports, and project management
   ============================================================ */

'use strict';

/* ============================================================
   GEO-TAG STUDIO — stamps action photographs with the event name, place, latitude / longitude,
   event date, a time inside the event window and a small street map, then adds real GPS EXIF data.
   Works for every avenue report. Final images are kept at 150 KB or less.
   ============================================================ */
const GeoTag = (() => {
  const NUM = '(-?\\d{1,3}\\.\\d{3,})';
  const MAX_BYTES = 150 * 1024;
  const mapCache = new Map();

  /* ---------- link reading ---------- */
  const okLatLng = (lat, lng) => isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

  /** Finds coordinates inside any Google Maps address / page text. The exact pin (!3d!4d) wins over the map centre (@). */
  function coordsFromText(text) {
    const t = String(text || '').replace(/%2C/gi, ',').replace(/%40/g, '@');
    const pats = [
      new RegExp(`!3d${NUM}!4d${NUM}`),
      new RegExp(`[?&](?:q|ll|query|destination|daddr|center|sll)=\\s*${NUM}\\s*(?:,|\\+)\\s*${NUM}`),
      new RegExp(`@${NUM},${NUM}`)
    ];
    for (const re of pats) {
      const m = t.match(re); if (!m) continue;
      const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      if (okLatLng(lat, lng)) return { lat, lng };
    }
    return null;
  }

  /** "11.0168, 76.9558"  /  "11.0168° N, 76.9558° E"  /  "N 11.0168 E 76.9558" */
  function coordsFromManual(text) {
    const s = String(text || '').trim();
    let m = s.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])?\s*$/i);
    if (!m) return null;
    let lat = parseFloat(m[1]), lng = parseFloat(m[3]);
    if (m[2] && /s/i.test(m[2])) lat = -Math.abs(lat);
    if (m[4] && /w/i.test(m[4])) lng = -Math.abs(lng);
    return okLatLng(lat, lng) ? { lat, lng } : null;
  }

  function nameFromUrl(url) {
    const m = String(url || '').match(/\/maps\/place\/([^/@?]+)/);
    if (!m) return '';
    try { const n = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); return /^-?\d+\.\d+,/.test(n) ? '' : n; } catch (e) { return ''; }
  }

  function classify(input) {
    const raw = String(input || '').trim();
    if (!raw) return { kind: 'empty' };
    if (coordsFromManual(raw)) return { kind: 'coords' };
    const um = raw.match(/https?:\/\/[^\s<>"']+/i);
    if (!um) return { kind: 'invalid', why: 'This does not look like a link or coordinates.' };
    let u; try { u = new URL(um[0]); } catch (e) { return { kind: 'invalid', why: 'The link is not a valid web address.' }; }
    const h = u.hostname.toLowerCase();
    if (/^(maps\.app\.goo\.gl|goo\.gl|g\.co|share\.google)$/.test(h)) return { kind: 'short', url: um[0], host: h };
    if (/(^|\.)google\.[a-z.]{2,8}$/.test(h) && /\/maps|^maps\./.test(u.pathname + h)) return { kind: 'full', url: um[0], host: h };
    return { kind: 'invalid', why: `“${h}” is not a Google Maps link. Use Share → Copy link in Google Maps.` };
  }

  async function resolveOnServer(url) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ action: 'resolve_map', url })
    });
    if (!res.ok) throw new Error(res.status === 404 ? 'The map-link service is not deployed yet (deploy the generate-document function).' : `The map-link service answered ${res.status}.`);
    return res.json();
  }

  async function reverseGeocode(lat, lng) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 7000);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`, { signal: ctl.signal });
      if (!r.ok) return '';
      const j = await r.json(), a = j.address || {};
      const first = j.name || a.amenity || a.building || a.tourism || a.leisure || a.shop || a.road || '';
      const area = a.suburb || a.neighbourhood || a.village || a.hamlet || '';
      const city = a.city || a.town || a.county || a.state_district || '';
      const parts = [first, area, city].filter((x, i, arr) => x && arr.indexOf(x) === i);
      return parts.length ? parts.join(', ') : String(j.display_name || '').split(',').slice(0, 3).join(',').trim();
    } catch (e) { return ''; } finally { clearTimeout(t); }
  }

  /**
   * Reads whatever the admin pasted and reports every step, so problems are easy to see.
   * Returns { ok, lat, lng, name, steps:[{ok,label,detail}] }
   */
  async function diagnose(input, onStep) {
    const steps = [], out = { ok: false, lat: null, lng: null, name: '', link: '', steps };
    const push = (ok, label, detail) => { steps.push({ ok, label, detail }); if (onStep) onStep(steps.slice()); };
    const c = classify(input);
    if (c.kind === 'empty') { push(false, 'Paste a link', 'Paste a Google Maps link (for example https://maps.app.goo.gl/…) or type latitude, longitude.'); return out; }
    if (c.kind === 'invalid') { push(false, 'Link format', c.why); return out; }

    if (c.kind === 'coords') {
      const k = coordsFromManual(input); out.lat = k.lat; out.lng = k.lng;
      push(true, 'Coordinates typed', `${k.lat.toFixed(6)}, ${k.lng.toFixed(6)}`);
    } else {
      out.link = c.url;
      push(true, 'Link format', c.kind === 'short' ? `Google Maps short link (${c.host})` : `Google Maps link (${c.host})`);
      let k = coordsFromText(c.url);
      if (k) { out.lat = k.lat; out.lng = k.lng; out.name = nameFromUrl(c.url); push(true, 'Reading the address', 'Coordinates found inside the link'); }
      else if (c.kind === 'full') push(false, 'Reading the address', 'No coordinates inside this link — trying the map-link service');
      if (!k) {
        try {
          push(true, 'Opening the link', 'Following the redirect on the server…');
          const r = await resolveOnServer(c.url);
          if (r && r.success) {
            out.lat = r.lat; out.lng = r.lng; out.name = r.name || out.name;
            steps[steps.length - 1] = { ok: true, label: 'Opening the link', detail: `Resolved${r.hops && r.hops.length > 1 ? ` after ${r.hops.length - 1} redirect(s)` : ''}` };
            push(true, 'Coordinates found', `${r.lat.toFixed(6)}, ${r.lng.toFixed(6)}`);
          } else {
            steps[steps.length - 1] = { ok: false, label: 'Opening the link', detail: (r && r.error) || 'The link could not be read.' };
            push(false, 'Next step', 'Type the latitude and longitude below (right-click the spot in Google Maps and copy the numbers).');
            return out;
          }
        } catch (e) {
          steps[steps.length - 1] = { ok: false, label: 'Opening the link', detail: e.message || 'Network problem' };
          push(false, 'Next step', 'Type the latitude and longitude below, or try again when online.');
          return out;
        }
      }
    }
    const inIndia = out.lat >= 6 && out.lat <= 37.5 && out.lng >= 68 && out.lng <= 98;
    push(true, 'Location check', inIndia ? 'Inside India' : 'Valid position (outside India — please double-check)');
    if (!out.name) {
      push(true, 'Place name', 'Looking up the place name…');
      out.name = await reverseGeocode(out.lat, out.lng);
      steps[steps.length - 1] = out.name ? { ok: true, label: 'Place name', detail: out.name } : { ok: false, label: 'Place name', detail: 'Not found — type the location name below' };
      if (onStep) onStep(steps.slice());
    } else push(true, 'Place name', out.name);
    out.ok = true;
    return out;
  }

  /* ---------- time inside the event window ---------- */
  const toSec = (t, d) => { if (!t) return d; const p = String(t).split(':').map(Number); return (p[0] || 0) * 3600 + (p[1] || 0) * 60 + (p[2] || 0); };
  /** n random times between start and end (sorted, so the photo series reads naturally) */
  function randomTimes(startT, endT, n) {
    let a = toSec(startT, 9 * 3600), b = toSec(endT, a + 2 * 3600);
    if (b <= a) b = Math.min(a + 2 * 3600, 86399);
    const list = [];
    for (let i = 0; i < n; i++) list.push(Math.floor(a + Math.random() * (b - a)));
    return list.sort((x, y) => x - y);
  }
  function fmtClock(sec) {
    const h = Math.floor(sec / 3600) % 24, m = Math.floor(sec % 3600 / 60);
    return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }
  function fmtDate(iso) {
    const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
    return isNaN(d) ? String(iso || '') : d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
  const fmtCoord = (v, pos, neg) => `${Math.abs(v).toFixed(6)}° ${v >= 0 ? pos : neg}`;

  /* ---------- street map card (CARTO Voyager tiles — the closest open match to the Google Maps look) ---------- */
  function loadImg(url, ms = 6000) {
    return new Promise((resolve) => {
      const img = new Image(); img.crossOrigin = 'anonymous';
      const t = setTimeout(() => resolve(null), ms);
      img.onload = () => { clearTimeout(t); resolve(img); };
      img.onerror = () => { clearTimeout(t); resolve(null); };
      img.src = url;
    });
  }
  async function buildMap(lat, lng, size) {
    const key = `${lat.toFixed(5)}|${lng.toFixed(5)}|${size}`;
    if (mapCache.has(key)) return mapCache.get(key);
    const z = 16, n = Math.pow(2, z), span = 230, s = size / span;
    const wx = (lng + 180) / 360 * n * 256;
    const lr = lat * Math.PI / 180;
    const wy = (1 - Math.log(Math.tan(lr) + 1 / Math.cos(lr)) / Math.PI) / 2 * n * 256;
    const x0 = wx - span / 2, y0 = wy - span / 2;
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#EAF0E4'; ctx.fillRect(0, 0, size, size);
    const jobs = [];
    for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + span) / 256); tx++) {
      for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + span) / 256); ty++) {
        const sub = 'abcd'[Math.abs(tx + ty) % 4];
        jobs.push((async () => {
          const img = await loadImg(`https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${tx}/${ty}@2x.png`)
                   || await loadImg(`https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`);
          return img ? { img, tx, ty } : null;
        })());
      }
    }
    const tiles = (await Promise.all(jobs)).filter(Boolean);
    let real = tiles.length > 0;
    tiles.forEach(({ img, tx, ty }) => ctx.drawImage(img, (tx * 256 - x0) * s, (ty * 256 - y0) * s, 256 * s, 256 * s));
    if (!real) {                                          // offline: draw a tidy placeholder street grid
      ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = size * 0.045;
      for (let i = -1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(i * size / 4, 0); ctx.lineTo(i * size / 4 + size * 0.3, size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * size / 4 + 10); ctx.lineTo(size, i * size / 4 - 14); ctx.stroke(); }
      ctx.fillStyle = 'rgba(120,150,110,.35)'; ctx.fillRect(size * 0.1, size * 0.55, size * 0.3, size * 0.25);
    }
    const res = { canvas: cv, real };
    mapCache.set(key, res);
    return res;
  }

  /* ---------- drawing helpers (no emoji, no external icons) ---------- */
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function pinShape(ctx, cx, cy, r) {                    // Google-style teardrop, tip at (cx, cy)
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.bezierCurveTo(cx - r * 0.2, cy - r * 0.9, cx - r, cy - r * 1.3, cx - r, cy - r * 2.0);
    ctx.arc(cx, cy - r * 2.0, r, Math.PI, 0, false);
    ctx.bezierCurveTo(cx + r, cy - r * 1.3, cx + r * 0.2, cy - r * 0.9, cx, cy); ctx.closePath();
  }
  function iconPin(ctx, x, y, h, color) { ctx.save(); ctx.fillStyle = color; pinShape(ctx, x + h * 0.35, y + h, h * 0.33); ctx.fill(); ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(x + h * 0.35, y + h * 0.34, h * 0.12, 0, 6.3); ctx.fill(); ctx.restore(); }
  function iconCalendar(ctx, x, y, h, color) { ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = h * 0.09; rr(ctx, x + h * 0.04, y + h * 0.14, h * 0.82, h * 0.74, h * 0.1); ctx.stroke(); ctx.fillRect(x + h * 0.04, y + h * 0.14, h * 0.82, h * 0.22); ctx.fillRect(x + h * 0.25, y, h * 0.09, h * 0.26); ctx.fillRect(x + h * 0.57, y, h * 0.09, h * 0.26); ctx.restore(); }
  function iconClock(ctx, x, y, h, color) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = h * 0.09; ctx.beginPath(); ctx.arc(x + h * 0.45, y + h * 0.5, h * 0.42, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + h * 0.45, y + h * 0.22); ctx.lineTo(x + h * 0.45, y + h * 0.5); ctx.lineTo(x + h * 0.66, y + h * 0.62); ctx.stroke(); ctx.restore(); }
  function iconTarget(ctx, x, y, h, color) { ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = h * 0.11; ctx.beginPath(); ctx.arc(x + h / 2, y + h / 2, h * 0.34, 0, 6.3); ctx.stroke(); ctx.beginPath(); ctx.arc(x + h / 2, y + h / 2, h * 0.1, 0, 6.3); ctx.fill(); [[0.5, 0, 0.5, 0.22], [0.5, 0.78, 0.5, 1], [0, 0.5, 0.22, 0.5], [0.78, 0.5, 1, 0.5]].forEach(l => { ctx.beginPath(); ctx.moveTo(x + h * l[0], y + h * l[1]); ctx.lineTo(x + h * l[2], y + h * l[3]); ctx.stroke(); }); ctx.restore(); }
  function wrap(ctx, text, maxW, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean), lines = []; let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { let last = lines.slice(maxLines - 1).join(' '); while (ctx.measureText(last + '…').width > maxW && last.length > 1) last = last.slice(0, -1); lines.length = maxLines - 1; lines.push(last.trimEnd() + '…'); }
    return lines;
  }
  const FONT = '"Segoe UI","Noto Sans","Noto Sans Tamil","Noto Sans Devanagari","Nirmala UI",Roboto,Arial,sans-serif';
  const MONO = '"Consolas","SF Mono","Roboto Mono","Menlo","Courier New",monospace';

  /**
   * Draws the geo-tag overlay on a photo.
   * info: { eventName, placeName, lat, lng, dateText, timeText }
   */
  async function render(img, info, opts = {}) {
    const maxW = opts.maxW || 1280, maxH = opts.maxH || 960;
    let W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const k = Math.min(1, maxW / W, maxH / H); W = Math.round(W * k); H = Math.round(H * k);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, W, H);

    const u = Math.min(W, H * 1.25) / 100, pad = 2.2 * u, accent = '#E0197D';
    const mapS = Math.round(15.5 * u), mapR = 1.6 * u;
    const textX = pad + mapS + 2 * u, textW = W - textX - pad;

    // measure text first so the card always fits
    ctx.font = `800 ${3.3 * u}px ${FONT}`; const tLines = wrap(ctx, info.eventName || 'Event', textW, 2);
    ctx.font = `600 ${2.3 * u}px ${FONT}`; const lLines = wrap(ctx, info.placeName || 'Location', textW - 3 * u, 2);
    const pillH = 2.6 * u, titleH = tLines.length * 3.9 * u, locH = lLines.length * 2.85 * u, rowH = 2.7 * u, gap = 0.9 * u;
    const textH = pillH + gap + titleH + gap * 0.6 + locH + gap + rowH + gap * 0.8 + rowH;
    const cardH = Math.max(mapS, textH), top = H - pad - cardH;

    // scrim
    const sc = ctx.createLinearGradient(0, top - 6 * u, 0, H);
    sc.addColorStop(0, 'rgba(14,4,10,0)'); sc.addColorStop(0.42, 'rgba(14,4,10,.72)'); sc.addColorStop(1, 'rgba(14,4,10,.9)');
    ctx.fillStyle = sc; ctx.fillRect(0, top - 6 * u, W, H - (top - 6 * u));
    // accent line + viewfinder corners
    const lg = ctx.createLinearGradient(0, 0, W, 0); lg.addColorStop(0, accent); lg.addColorStop(0.55, '#B30F57'); lg.addColorStop(1, '#F2A413');
    ctx.fillStyle = lg; ctx.fillRect(0, top - 1.6 * u, W, 0.45 * u);
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.38 * u; const c = 1.4 * u, L = 4.6 * u;
    [[c, c, 1, 1], [W - c, c, -1, 1]].forEach(([x, y, dx, dy]) => { ctx.beginPath(); ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y); ctx.stroke(); });

    // map card
    const mapY = top + (cardH - mapS) / 2, mx = pad;
    const map = await buildMap(info.lat, info.lng, Math.max(80, mapS));
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 1.6 * u; ctx.shadowOffsetY = 0.4 * u;
    rr(ctx, mx - 0.35 * u, mapY - 0.35 * u, mapS + 0.7 * u, mapS + 0.7 * u, mapR + 0.35 * u); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.restore();
    ctx.save(); rr(ctx, mx, mapY, mapS, mapS, mapR); ctx.clip(); ctx.drawImage(map.canvas, mx, mapY, mapS, mapS);
    const cx = mx + mapS / 2, cy = mapY + mapS / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, mapS * 0.2); g.addColorStop(0, 'rgba(234,67,53,.28)'); g.addColorStop(1, 'rgba(234,67,53,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, mapS * 0.2, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(cx, cy + 0.2 * u, 1.1 * u, 0.45 * u, 0, 0, 6.3); ctx.fill();
    const pr = 1.55 * u; pinShape(ctx, cx, cy, pr); ctx.fillStyle = '#EA4335'; ctx.fill(); ctx.lineWidth = 0.18 * u; ctx.strokeStyle = '#B31412'; ctx.stroke();
    ctx.fillStyle = '#7A0B0B'; ctx.beginPath(); ctx.arc(cx, cy - pr * 2.0, pr * 0.46, 0, 6.3); ctx.fill();
    // compass + attribution
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(mx + mapS - 2.2 * u, mapY + 2.2 * u, 1.5 * u, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#C5221F'; ctx.beginPath(); ctx.moveTo(mx + mapS - 2.2 * u, mapY + 0.9 * u); ctx.lineTo(mx + mapS - 2.9 * u, mapY + 2.4 * u); ctx.lineTo(mx + mapS - 1.5 * u, mapY + 2.4 * u); ctx.fill();
    ctx.fillStyle = '#444'; ctx.font = `800 ${1.0 * u}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('N', mx + mapS - 2.2 * u, mapY + 3.55 * u); ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.fillRect(mx, mapY + mapS - 1.55 * u, mapS, 1.55 * u);
    ctx.fillStyle = '#555'; ctx.font = `600 ${0.95 * u}px ${FONT}`; ctx.fillText(map.real ? '© OpenStreetMap · CARTO' : 'Map preview', mx + 0.7 * u, mapY + mapS - 0.5 * u);
    ctx.restore();

    // text column
    let y = top + (cardH - textH) / 2;
    ctx.font = `800 ${1.5 * u}px ${FONT}`; const pillText = 'GEO-TAGGED', pw = ctx.measureText(pillText).width + pillH + 1.4 * u;
    rr(ctx, textX, y, pw, pillH, pillH / 2); ctx.fillStyle = accent; ctx.fill();
    iconTarget(ctx, textX + 0.7 * u, y + 0.35 * u, pillH - 0.7 * u, '#FFFFFF');
    ctx.fillStyle = '#FFFFFF'; ctx.textBaseline = 'middle'; ctx.fillText(pillText, textX + pillH + 0.5 * u, y + pillH / 2 + 0.05 * u);
    ctx.font = `600 ${1.35 * u}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.68)'; ctx.textAlign = 'right';
    ctx.fillText(info.brand || 'ROTARACT CLUB  ·  SERVICE ABOVE SELF', textX + textW, y + pillH / 2); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    y += pillH + gap;

    ctx.font = `800 ${3.3 * u}px ${FONT}`; ctx.fillStyle = '#FFFFFF'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 0.5 * u;
    tLines.forEach((ln, i) => ctx.fillText(ln, textX, y + (i + 0.82) * 3.9 * u)); ctx.shadowBlur = 0;
    y += titleH + gap * 0.6;

    ctx.font = `600 ${2.3 * u}px ${FONT}`; iconPin(ctx, textX, y + 0.1 * u, 2.5 * u, accent);
    ctx.fillStyle = 'rgba(255,255,255,.95)'; lLines.forEach((ln, i) => ctx.fillText(ln, textX + 3 * u, y + (i + 0.8) * 2.85 * u));
    y += locH + gap;

    // coordinates row
    const chip = (label, value, x) => {
      ctx.font = `700 ${1.25 * u}px ${FONT}`; const lw = ctx.measureText(label).width;
      ctx.font = `700 ${2.0 * u}px ${MONO}`; const vw = ctx.measureText(value).width, w = lw + vw + 2.6 * u;
      rr(ctx, x, y, w, rowH, 0.8 * u); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill();
      ctx.font = `700 ${1.25 * u}px ${FONT}`; ctx.fillStyle = '#FFB3D6'; ctx.fillText(label, x + 0.9 * u, y + rowH * 0.68);
      ctx.font = `700 ${2.0 * u}px ${MONO}`; ctx.fillStyle = '#FFFFFF'; ctx.fillText(value, x + 0.9 * u + lw + 0.8 * u, y + rowH * 0.7);
      return w;
    };
    const w1 = chip('LAT', fmtCoord(info.lat, 'N', 'S'), textX);
    if (textX + w1 + 1.2 * u + 20 * u < W - pad) chip('LNG', fmtCoord(info.lng, 'E', 'W'), textX + w1 + 1.2 * u);
    else { y += rowH + gap * 0.5; chip('LNG', fmtCoord(info.lng, 'E', 'W'), textX); }
    y += rowH + gap * 0.8;

    // date & time row
    ctx.font = `700 ${2.2 * u}px ${FONT}`;
    iconCalendar(ctx, textX, y + 0.2 * u, 2.3 * u, '#FFD98A'); ctx.fillStyle = '#FFFFFF';
    const dt = info.dateText || ''; ctx.fillText(dt, textX + 3 * u, y + rowH * 0.72);
    const tx = textX + 3 * u + ctx.measureText(dt).width + 2.6 * u;
    iconClock(ctx, tx, y + 0.2 * u, 2.3 * u, '#FFD98A'); ctx.fillText(info.timeText || '', tx + 3 * u, y + rowH * 0.72);
    const tw = ctx.measureText(info.timeText || '').width; ctx.font = `700 ${1.35 * u}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('IST', tx + 3 * u + tw + 0.8 * u, y + rowH * 0.72);
    return cv;
  }

  /* ---------- GPS + date written into the JPEG so phones and Google Photos also show the location ---------- */
  function buildExif(lat, lng, when) {
    const dms = (v) => { v = Math.abs(v); const d = Math.floor(v), mf = (v - d) * 60, m = Math.floor(mf), s = Math.round((mf - m) * 60 * 10000); return [[d, 1], [m, 1], [s, 10000]]; };
    const pad2 = (n) => String(n).padStart(2, '0');
    const ds = `${when.getFullYear()}:${pad2(when.getMonth() + 1)}:${pad2(when.getDate())} ${pad2(when.getHours())}:${pad2(when.getMinutes())}:${pad2(when.getSeconds())}\0`;
    const buf = new ArrayBuffer(222), dv = new DataView(buf), u8 = new Uint8Array(buf);
    dv.setUint8(0, 0x4D); dv.setUint8(1, 0x4D); dv.setUint16(2, 42); dv.setUint32(4, 8);          // "MM", 42, IFD0 at 8
    const entry = (off, tag, type, count, val) => { dv.setUint16(off, tag); dv.setUint16(off + 2, type); dv.setUint32(off + 4, count); if (typeof val === 'number') dv.setUint32(off + 8, val); };
    dv.setUint16(8, 3);                                                                          // IFD0: 3 entries
    entry(10, 0x0132, 2, 20, 134); entry(22, 0x8769, 4, 1, 50); entry(34, 0x8825, 4, 1, 68); dv.setUint32(46, 0);
    dv.setUint16(50, 1); entry(52, 0x9003, 2, 20, 154); dv.setUint32(64, 0);                      // Exif IFD
    dv.setUint16(68, 5);                                                                         // GPS IFD: 5 entries
    entry(70, 0x0000, 1, 4, 0); dv.setUint8(78, 2); dv.setUint8(79, 3); dv.setUint8(80, 0); dv.setUint8(81, 0);
    entry(82, 0x0001, 2, 2, 0); dv.setUint8(90, lat >= 0 ? 0x4E : 0x53);
    entry(94, 0x0002, 5, 3, 174);
    entry(106, 0x0003, 2, 2, 0); dv.setUint8(114, lng >= 0 ? 0x45 : 0x57);
    entry(118, 0x0004, 5, 3, 198); dv.setUint32(130, 0);
    for (let i = 0; i < 20; i++) { u8[134 + i] = ds.charCodeAt(i) || 0; u8[154 + i] = ds.charCodeAt(i) || 0; }
    dms(lat).forEach((r, i) => { dv.setUint32(174 + i * 8, r[0]); dv.setUint32(178 + i * 8, r[1]); });
    dms(lng).forEach((r, i) => { dv.setUint32(198 + i * 8, r[0]); dv.setUint32(202 + i * 8, r[1]); });
    const head = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0]), body = new Uint8Array(222 + head.length);
    body.set(head, 0); body.set(u8, head.length);
    const seg = new Uint8Array(4 + body.length); seg[0] = 0xFF; seg[1] = 0xE1; seg[2] = (body.length + 2) >> 8; seg[3] = (body.length + 2) & 255; seg.set(body, 4);
    return seg;
  }
  async function addExif(blob, lat, lng, when) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return blob;
    const seg = buildExif(lat, lng, when);
    const out = new Uint8Array(bytes.length + seg.length); out.set(bytes.subarray(0, 2), 0); out.set(seg, 2); out.set(bytes.subarray(2), 2 + seg.length);
    return new Blob([out], { type: 'image/jpeg' });
  }

  function toBlob(cv, q) { return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', q)); }

  /** Stamp one photo; the result is a JPEG of 150 KB or less with GPS metadata. */
  async function stamp(file, info, opts = {}) {
    const img = await ImageUtils._load(file);
    let cv = await render(img, info, { maxW: opts.maxW || 1280, maxH: opts.maxH || 960 });
    const limit = opts.maxBytes || MAX_BYTES, EXIF_ROOM = 300;
    let best = null;
    for (let round = 0; round < 8; round++) {
      for (const q of (round === 0 ? [0.86, 0.78, 0.7, 0.62, 0.54, 0.46] : [0.7, 0.58, 0.46])) {
        const b = await toBlob(cv, q);
        if (!best || b.size < best.size) best = b;
        if (b.size + EXIF_ROOM <= limit) return addExif(b, info.lat, info.lng, info.when || new Date());
      }
      const s = 0.85, c2 = document.createElement('canvas'); c2.width = Math.max(320, Math.round(cv.width * s)); c2.height = Math.max(240, Math.round(cv.height * s));
      c2.getContext('2d').drawImage(cv, 0, 0, c2.width, c2.height); cv = c2;      // overlay is scaled with the photo, so it stays proportional
    }
    return addExif(best, info.lat, info.lng, info.when || new Date());
  }

  return { diagnose, classify, coordsFromText, coordsFromManual, randomTimes, fmtClock, fmtDate, fmtCoord, render, stamp, buildMap, buildExif, MAX_BYTES };
})();
window.GeoTag = GeoTag;

class EventsAdminManager {
  constructor() {
    this.db = getSupabaseClient();
    this.auth = window.authManager;
    this._pendingPosters = [];
    this._pendingReportPhotos = [];
    this._editingEventId = null;
    this._currentDashboard = null;
    this._allEvents = [];
  }

  /* ============================================================
     EVENTS LIST
     ============================================================ */
  async renderEventsList(container, dashboard) {
    this._currentDashboard = dashboard;
    const accessibleAvenues = this.auth.getAccessibleAvenues();

    let query = this.db
      .from('events')
      .select(`
        id, title, avenue, event_date, start_time, end_time,
        venue, event_chair, event_secretary, status, is_dpp,
        group_number, collaboration, collaborator_name,
        actual_attendance, beneficiaries, service_hours,
        budget_proposed, budget_actual, created_at, updated_at,
        dpp_approval_number, dpp_pillar, dpp_category, dpp_council_member,
        event_photos(photo_url, is_action_photo, sort_order),
        event_reports(id, is_approved, submitted_by)
      `)
      .order('event_date', { ascending: false });

    if (!this.auth.isFullAccess() && accessibleAvenues.length > 0) {
      query = query.in('avenue', accessibleAvenues);
    }

    const { data: events, error } = await query;

    if (error) {
      dashboard?.showToast('Failed to load events', 'error');
      return;
    }

    this._allEvents = events || [];

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="calendar-check"></i>
            Events &amp; Projects
          </h1>
          <p class="admin-section-subtitle">
            ${events?.length || 0} total events across all avenues
          </p>
        </div>
        <div class="admin-section-actions">
          ${this.auth.can('CREATE_EVENT') ? `
          <button class="btn btn-primary" onclick="eventsAdmin.showEventForm()">
            <i data-lucide="plus-circle"></i>
            <span>Add Event</span>
          </button>` : ''}
          ${this.auth.can('DOWNLOAD_MONTHLY_REPORT') ? `
          <button class="btn btn-outline"
                  onclick="eventsAdmin.showDownloadOptions()">
            <i data-lucide="download"></i>
            <span>Download Reports</span>
          </button>` : ''}
        </div>
      </div>

      <!-- Avenue Summary Cards -->
      <div class="events-avenue-summary">
        ${this.renderAvenueSummaryCards(events || [])}
      </div>

      <!-- Filters -->
      <div class="admin-card neu-card" style="margin-bottom:20px;">
        <div class="admin-filters-row" style="flex-wrap:wrap;gap:10px;">
          <div class="input-wrap neu-inset"
               style="flex:1;min-width:200px;max-width:300px;">
            <i data-lucide="search"
               style="width:16px;height:16px;color:var(--text-muted);
                      flex-shrink:0;"></i>
            <input type="text" id="ev-search" class="form-input"
                   placeholder="Search by title, chair, venue..."
                   oninput="eventsAdmin.applyFilters()" />
          </div>
          <div class="select-wrap neu-inset" style="min-width:160px;">
            <select id="ev-avenue-filter" class="form-select"
                    onchange="eventsAdmin.applyFilters()">
              <option value="">All Avenues</option>
              ${accessibleAvenues.map(a => `
                <option value="${a}">
                  ${AVENUES[a]?.label || StringUtils.snakeToTitle(a)}
                </option>
              `).join('')}
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="select-wrap neu-inset" style="min-width:160px;">
            <select id="ev-status-filter" class="form-select"
                    onchange="eventsAdmin.applyFilters()">
              <option value="">All Status</option>
              ${Object.entries(EVENT_STATUS).map(([k, v]) =>
                `<option value="${k}">${v.label}</option>`
              ).join('')}
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <div class="select-wrap neu-inset" style="min-width:130px;">
            <select id="ev-dpp-filter" class="form-select"
                    onchange="eventsAdmin.applyFilters()">
              <option value="">All Types</option>
              <option value="dpp">DPP Only</option>
              <option value="regular">Regular Only</option>
            </select>
            <i data-lucide="chevron-down" class="select-arrow"></i>
          </div>
          <button class="btn btn-outline btn-sm"
                  onclick="eventsAdmin.resetFilters()">
            <i data-lucide="x"></i>
            <span>Reset</span>
          </button>
        </div>
      </div>

      <!-- Events Table -->
      <div class="admin-card neu-card">
        <div class="admin-table-wrap">
          <table class="admin-table" id="ev-table">
            <thead>
              <tr>
                <th style="width:30px;">
                  <input type="checkbox" id="ev-select-all"
                         onchange="eventsAdmin.toggleSelectAll(this.checked)"
                         style="cursor:pointer;" />
                </th>
                <th>Event</th>
                <th>Avenue</th>
                <th>Date &amp; Time</th>
                <th>Chair</th>
                <th>Venue</th>
                <th>Status</th>
                <th>Report</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="ev-table-body">
              ${this.renderEventsRows(events || [])}
            </tbody>
          </table>
        </div>

        <!-- Bulk Actions Bar -->
        <div class="ev-bulk-actions" id="ev-bulk-actions" style="display:none;">
          <span id="ev-selected-count"
                style="font-size:0.84rem;font-weight:600;color:var(--accent);">
            0 selected
          </span>
          <div style="display:flex;gap:8px;">
            ${this.auth.can('APPROVE_EVENT') ? `
            <button class="btn btn-success btn-sm"
                    onclick="eventsAdmin.bulkApprove()">
              <i data-lucide="check-circle"></i>
              <span>Approve Selected</span>
            </button>` : ''}
            ${this.auth.can('DELETE_EVENT') ? `
            <button class="btn btn-danger btn-sm"
                    onclick="eventsAdmin.bulkDelete()">
              <i data-lucide="trash-2"></i>
              <span>Delete Selected</span>
            </button>` : ''}
            <button class="btn btn-outline btn-sm"
                    onclick="eventsAdmin.clearSelection()">
              <i data-lucide="x"></i>
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>
    `;

    lucide.createIcons();
  }

  renderAvenueSummaryCards(events) {
    const counts = {};
    Object.keys(AVENUES).forEach(a => counts[a] = 0);
    events.forEach(e => {
      if (counts[e.avenue] !== undefined) counts[e.avenue]++;
    });

    return `
      <div class="avenue-summary-grid">
        ${Object.entries(AVENUES).map(([key, avenue]) => `
          <div class="avenue-summary-card neu-card"
               onclick="eventsAdmin.filterByAvenue('${key}')"
               style="cursor:pointer;">
            <div class="avenue-summary-icon"
                 style="background:${avenue.bgColor};color:${avenue.color};">
              <i data-lucide="${avenue.icon}"></i>
            </div>
            <div class="avenue-summary-count">${counts[key] || 0}</div>
            <div class="avenue-summary-label">
              ${avenue.shortLabel || avenue.label}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderEventsRows(events) {
    if (!events || events.length === 0) {
      return `
        <tr>
          <td colspan="9" class="admin-table-empty">
            <i data-lucide="calendar-x"></i>
            <span>No events found</span>
          </td>
        </tr>`;
    }

    return events.map(event => {
      const avenue            = AVENUES[event.avenue] || {};
      const status            = EVENT_STATUS[event.status] || {};
      const hasApprovedReport = event.event_reports?.some(r => r.is_approved);
      const hasPendingReport  = event.event_reports?.some(r => !r.is_approved);
      const posterUrl         = event.event_photos
        ?.find(p => !p.is_action_photo)?.photo_url || null;

      return `
        <tr data-event-id="${event.id}"
            data-avenue="${event.avenue}"
            data-status="${event.status}"
            data-is-dpp="${event.is_dpp ? 'true' : 'false'}">
          <td>
            <input type="checkbox" class="ev-row-check"
                   value="${event.id}"
                   onchange="eventsAdmin.handleRowSelect()"
                   style="cursor:pointer;" />
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:10px;">
              ${posterUrl ? `
              <img src="${StringUtils.sanitize(posterUrl)}"
                   style="width:40px;height:40px;border-radius:6px;
                          object-fit:cover;flex-shrink:0;"
                   loading="lazy"
                   onerror="this.style.display='none'" />` : ''}
              <div>
                <div style="font-weight:600;color:var(--text-heading);
                            display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  ${event.is_dpp
                    ? '<span class="admin-dpp-badge">DPP</span>'
                    : ''}
                  ${StringUtils.sanitize(event.title || '')}
                </div>
                ${event.event_secretary ? `
                <div style="font-size:0.72rem;color:var(--text-muted);">
                  Sec: ${StringUtils.sanitize(event.event_secretary)}
                </div>` : ''}
              </div>
            </div>
          </td>
          <td>
            <span class="admin-avenue-badge"
                  style="background:${avenue.bgColor || 'var(--accent-light)'};
                         color:${avenue.color || 'var(--accent)'};">
              ${avenue.shortLabel || StringUtils.snakeToTitle(event.avenue)}
            </span>
          </td>
          <td style="white-space:nowrap;">
            <div style="font-size:0.84rem;font-weight:600;">
              ${DateUtils.format(event.event_date, 'short')}
            </div>
            <div style="font-size:0.72rem;color:var(--text-muted);">
              ${DateUtils.formatTime(event.start_time)}
              ${event.end_time
                ? ' – ' + DateUtils.formatTime(event.end_time)
                : ''}
            </div>
            <div style="font-size:0.68rem;color:var(--text-muted);">
              Group ${event.group_number || '1'}
            </div>
          </td>
          <td>
            <div style="font-size:0.82rem;">
              ${StringUtils.sanitize(event.event_chair || '—')}
            </div>
          </td>
          <td>
            <div style="font-size:0.82rem;max-width:150px;overflow:hidden;
                        text-overflow:ellipsis;white-space:nowrap;"
                 title="${StringUtils.sanitize(event.venue || '')}">
              ${StringUtils.sanitize(event.venue || '—')}
            </div>
          </td>
          <td>
            <span class="admin-status-badge"
                  style="background:${status.bg || ''};
                         color:${status.color || ''};">
              ${status.label || event.status}
            </span>
          </td>
          <td>
            ${hasApprovedReport
              ? `<div style="display:flex;align-items:center;gap:4px;
                             color:var(--success);font-size:0.78rem;font-weight:600;">
                   <i data-lucide="check-circle"
                      style="width:13px;height:13px;"></i>
                   Approved
                 </div>`
              : hasPendingReport
                ? `<div style="display:flex;align-items:center;gap:4px;
                               color:var(--warning);font-size:0.78rem;
                               font-weight:600;">
                     <i data-lucide="clock"
                        style="width:13px;height:13px;"></i>
                     Pending
                   </div>`
                : `<div style="color:var(--text-muted);font-size:0.78rem;">
                     None
                   </div>`}
          </td>
          <td>
            <div class="admin-table-actions">
              <button class="admin-action-btn"
                      onclick="eventsAdmin.viewEventDetails('${event.id}')"
                      title="View Details">
                <i data-lucide="eye"></i>
              </button>
              ${this.auth.can('EDIT_ANY_EVENT') ||
                this.auth.canAccessAvenue(event.avenue) ? `
              <button class="admin-action-btn"
                      onclick="eventsAdmin.showEventForm('${event.id}')"
                      title="Edit Event">
                <i data-lucide="pencil"></i>
              </button>` : ''}
              ${this.auth.can('APPROVE_EVENT') &&
                event.status === 'pending_approval' ? `
              <button class="admin-action-btn admin-action-success"
                      onclick="eventsAdmin.approveEvent('${event.id}')"
                      title="Approve">
                <i data-lucide="check-circle"></i>
              </button>` : ''}
              ${this.auth.can('APPROVE_EVENT') &&
                event.status === 'approved' ? `
              <button class="admin-action-btn"
                      onclick="eventsAdmin.markCompleted('${event.id}')"
                      title="Mark Completed">
                <i data-lucide="flag"></i>
              </button>` : ''}
              ${(event.status === 'approved' || event.status === 'completed') &&
                (this.auth.can('SUBMIT_REPORT') ||
                  this.auth.canAccessAvenue(event.avenue)) ? `
              <button class="admin-action-btn"
                      onclick="eventsAdmin.showReportForm('${event.id}')"
                      title="Submit / View Report">
                <i data-lucide="file-text"></i>
              </button>` : ''}
              ${hasApprovedReport ? `
              <button class="admin-action-btn"
                      onclick="eventsAdmin.downloadEventReport('${event.id}')"
                      title="Download Report (.docx)">
                <i data-lucide="download"></i>
              </button>` : ''}
              ${this.auth.can('DELETE_EVENT') ? `
              <button class="admin-action-btn admin-action-danger"
                      onclick="eventsAdmin.deleteEvent('${event.id}')"
                      title="Delete">
                <i data-lucide="trash-2"></i>
              </button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');
  }

  /* ============================================================
     FILTER & SEARCH
     ============================================================ */
  applyFilters() {
    const search    = document.getElementById('ev-search')
      ?.value?.toLowerCase() || '';
    const avenue    = document.getElementById('ev-avenue-filter')?.value || '';
    const status    = document.getElementById('ev-status-filter')?.value || '';
    const dppFilter = document.getElementById('ev-dpp-filter')?.value    || '';

    document.querySelectorAll('#ev-table-body tr[data-event-id]')
      .forEach(row => {
        const title     = row.querySelector('td:nth-child(2)')
          ?.textContent?.toLowerCase() || '';
        const rowAvenue = row.getAttribute('data-avenue') || '';
        const rowStatus = row.getAttribute('data-status') || '';
        const isDPP     = row.getAttribute('data-is-dpp') === 'true';

        const matchSearch = !search || title.includes(search);
        const matchAvenue = !avenue || rowAvenue === avenue;
        const matchStatus = !status || rowStatus === status;
        const matchDPP    = !dppFilter
          || (dppFilter === 'dpp'     && isDPP)
          || (dppFilter === 'regular' && !isDPP);

        row.style.display =
          (matchSearch && matchAvenue && matchStatus && matchDPP) ? '' : 'none';
      });
  }

  filterByAvenue(avenue) {
    const select = document.getElementById('ev-avenue-filter');
    if (select) { select.value = avenue; this.applyFilters(); }
  }

  resetFilters() {
    ['ev-search', 'ev-avenue-filter', 'ev-status-filter', 'ev-dpp-filter']
      .forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    this.applyFilters();
  }

  /* ============================================================
     ROW SELECTION
     ============================================================ */
  toggleSelectAll(checked) {
    document.querySelectorAll('.ev-row-check')
      .forEach(cb => { cb.checked = checked; });
    this.handleRowSelect();
  }

  handleRowSelect() {
    const selected = document.querySelectorAll('.ev-row-check:checked');
    const bulkBar  = document.getElementById('ev-bulk-actions');
    const countEl  = document.getElementById('ev-selected-count');
    if (bulkBar) bulkBar.style.display = selected.length > 0 ? 'flex' : 'none';
    if (countEl) countEl.textContent   = `${selected.length} selected`;
  }

  clearSelection() {
    document.querySelectorAll('.ev-row-check')
      .forEach(cb => cb.checked = false);
    const allCheck = document.getElementById('ev-select-all');
    if (allCheck) allCheck.checked = false;
    this.handleRowSelect();
  }

  getSelectedIds() {
    return Array.from(
      document.querySelectorAll('.ev-row-check:checked')
    ).map(cb => cb.value);
  }

  /* ============================================================
     BULK ACTIONS
     ============================================================ */
  async bulkApprove() {
    const ids = this.getSelectedIds();
    if (ids.length === 0) return;
    if (!confirm(`Approve ${ids.length} selected event(s)?`)) return;

    let successCount = 0;
    for (const id of ids) {
      try {
        await this.db.from('events').update({
          status      : 'approved',
          approved_by : this.auth.getAdmin()?.id,
          approved_at : new Date().toISOString()
        }).eq('id', id);
        successCount++;
        if (window.emailService) {
          await window.emailService.sendEventApprovalNotification(id);
        }
      } catch (e) {
        console.warn('Bulk approve error for', id, e);
      }
    }

    this._currentDashboard?.showToast(
      `${successCount} event(s) approved`, 'success'
    );
    this.clearSelection();
    await this.renderEventsList(
      document.getElementById('admin-content'),
      this._currentDashboard
    );
  }

  async bulkDelete() {
    const ids = this.getSelectedIds();
    if (ids.length === 0) return;
    if (!confirm(`Permanently delete ${ids.length} selected event(s)?`)) return;

    let successCount = 0;
    for (const id of ids) {
      try {
        await this.db.from('event_photos').delete().eq('event_id', id);
        await this.db.from('event_reports').delete().eq('event_id', id);
        await this.db.from('events').delete().eq('id', id);
        successCount++;
      } catch (e) {
        console.warn('Bulk delete error for', id, e);
      }
    }

    this._currentDashboard?.showToast(
      `${successCount} event(s) deleted`, 'success'
    );
    await this.renderEventsList(
      document.getElementById('admin-content'),
      this._currentDashboard
    );
  }

  /* ============================================================
     EVENT FORM  (ADD / EDIT)
     ============================================================ */
  async showEventForm(eventId = null) {
    this._editingEventId = eventId;
    let eventData = null;

    if (eventId) {
      const { data } = await this.db
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      eventData = data;
    }

    const isEdit            = !!eventData;
    const content           = document.getElementById('admin-content');
    if (!content) return;

    const accessibleAvenues = this.auth.getAccessibleAvenues();
    const isDPPEvent        = isEdit && !!eventData.is_dpp;
    const isDPPAvenue       = isEdit &&
      eventData.avenue === 'district_priority_projects';

    content.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="${isEdit ? 'pencil' : 'plus-circle'}"></i>
            ${isEdit ? 'Edit Event' : 'Add New Event'}
          </h1>
          ${isEdit ? `
          <p class="admin-section-subtitle">
            ${StringUtils.sanitize(eventData.title || '')}
          </p>` : ''}
        </div>
        <button class="btn btn-outline"
                onclick="eventsAdmin.renderEventsList(
                  document.getElementById('admin-content'),
                  eventsAdmin._currentDashboard)">
          <i data-lucide="arrow-left"></i>
          <span>Back to Events</span>
        </button>
      </div>

      <div class="admin-card neu-card">
        <form id="ev-form" novalidate>
          <div class="admin-form-grid">

            <!-- Title -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="type"></i> Event Title *
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="title" class="form-input"
                       placeholder="Enter full event title"
                       value="${isEdit
                         ? StringUtils.sanitize(eventData.title || '')
                         : ''}"
                       required />
              </div>
            </div>

            <!-- Avenue -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="layers"></i> Avenue of Service *
              </label>
              <div class="select-wrap neu-inset">
                <select name="avenue" class="form-select" required
                        onchange="eventsAdmin.onAvenueChange(this.value)">
                  <option value="">Select Avenue</option>
                  ${accessibleAvenues.map(a => `
                    <option value="${a}"
                            ${isEdit && eventData.avenue === a
                              ? 'selected' : ''}>
                      ${AVENUES[a]?.label || StringUtils.snakeToTitle(a)}
                    </option>
                  `).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <!-- Group Number -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="hash"></i> Group Number *
              </label>
              <div class="select-wrap neu-inset">
                <select name="group_number" class="form-select" required>
                  ${ROTARY_GROUPS.map(g => `
                    <option value="${g}"
                            ${isEdit && eventData.group_number === g
                              ? 'selected'
                              : !isEdit && g === '1' ? 'selected' : ''}>
                      Group ${g}
                    </option>
                  `).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <!-- Event Date -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="calendar"></i> Event Date *
              </label>
              <div class="input-wrap neu-inset">
                <input type="date" name="event_date" class="form-input"
                       value="${isEdit ? (eventData.event_date || '') : ''}"
                       required />
              </div>
            </div>

            <!-- Start Time -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="clock"></i> Start Time *
              </label>
              <div class="input-wrap neu-inset">
                <input type="time" name="start_time" class="form-input"
                       value="${isEdit ? (eventData.start_time || '') : ''}"
                       required />
              </div>
            </div>

            <!-- End Time -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="clock-8"></i> End Time (Optional)
              </label>
              <div class="input-wrap neu-inset">
                <input type="time" name="end_time" class="form-input"
                       value="${isEdit ? (eventData.end_time || '') : ''}" />
              </div>
            </div>

            <!-- Venue -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="map-pin"></i> Venue *
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="venue" class="form-input"
                       placeholder="Full venue name and address"
                       value="${isEdit
                         ? StringUtils.sanitize(eventData.venue || '')
                         : ''}"
                       required />
              </div>
            </div>

            <!-- Event Chair -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="user-check"></i> Event Chair *
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="event_chair" class="form-input"
                       placeholder="Name of event chair"
                       value="${isEdit
                         ? StringUtils.sanitize(eventData.event_chair || '')
                         : ''}"
                       required />
              </div>
            </div>

            <!-- Event Secretary -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="user"></i> Event Secretary (if any)
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="event_secretary" class="form-input"
                       placeholder="Name of event secretary"
                       value="${isEdit
                         ? StringUtils.sanitize(
                             eventData.event_secretary || '')
                         : ''}" />
              </div>
            </div>

            <!-- Proposed By -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="user-plus"></i> Event Proposed By
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="event_proposed_by"
                       class="form-input"
                       placeholder="Proposed by (member name)"
                       value="${isEdit
                         ? StringUtils.sanitize(
                             eventData.event_proposed_by || '')
                         : ''}" />
              </div>
            </div>

            <!-- Seconded By -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="users"></i> Seconded By
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="event_seconded_by"
                       class="form-input"
                       placeholder="Seconded by (member name)"
                       value="${isEdit
                         ? StringUtils.sanitize(
                             eventData.event_seconded_by || '')
                         : ''}" />
              </div>
            </div>

            <!-- Collaboration -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="handshake"></i> Any Collaboration? (if any)
              </label>
              <div class="select-wrap neu-inset">
                <select name="collaboration" class="form-select"
                        onchange="eventsAdmin.onCollabChange(this.value)">
                  ${Object.entries(COLLABORATION_TYPES).map(([k, v]) => `
                    <option value="${k}"
                            ${isEdit && eventData.collaboration === k
                              ? 'selected'
                              : !isEdit && k === 'none' ? 'selected' : ''}>
                      ${v}
                    </option>
                  `).join('')}
                </select>
                <i data-lucide="chevron-down" class="select-arrow"></i>
              </div>
            </div>

            <!-- Collaborator Name -->
            <div class="form-group" id="ev-collaborator-wrap"
                 style="${isEdit &&
                   eventData.collaboration &&
                   eventData.collaboration !== 'none'
                   ? '' : 'display:none;'}">
              <label class="form-label">
                <i data-lucide="building-2"></i> Collaborator Name
              </label>
              <div class="input-wrap neu-inset">
                <input type="text" name="collaborator_name"
                       class="form-input"
                       placeholder="Name of collaborating organization"
                       value="${isEdit
                         ? StringUtils.sanitize(
                             eventData.collaborator_name || '')
                         : ''}" />
              </div>
            </div>

            <!-- DPP Toggle -->
            <div class="form-group" id="ev-dpp-wrap"
                 style="${isDPPAvenue ? '' : 'display:none;'}">
              <label class="form-label">
                <i data-lucide="star"></i> District Priority Project
              </label>
              <div class="admin-toggle-wrap">
                <label class="admin-toggle">
                  <input type="checkbox" name="is_dpp"
                         id="ev-is-dpp-check"
                         ${isDPPEvent ? 'checked' : ''}
                         onchange="eventsAdmin.onDPPToggle(this.checked)" />
                  <span class="admin-toggle-slider"></span>
                </label>
                <span>Mark as District Priority Project</span>
              </div>
            </div>

            <!-- ── DPP Extra Fields ──────────────────────────── -->
            <div class="form-group admin-form-full"
                 id="ev-dpp-extra-fields"
                 style="${isDPPEvent ? '' : 'display:none;'}">
              <div style="padding:16px;
                          background:rgba(var(--avenue-dpp-rgb,239,68,68),0.05);
                          border-radius:var(--border-radius-sm);
                          border:1px solid
                            rgba(var(--avenue-dpp-rgb,239,68,68),0.2);">

                <div style="font-size:0.75rem;font-weight:800;
                            letter-spacing:0.06em;text-transform:uppercase;
                            color:var(--avenue-dpp);margin-bottom:14px;
                            display:flex;align-items:center;gap:6px;">
                  <i data-lucide="award" style="width:14px;height:14px;"></i>
                  DPP Specific Details
                </div>

                <div class="admin-form-grid" style="padding:0;">

                  <!-- Project Approval Number -->
                  <div class="form-group">
                    <label class="form-label">
                      <i data-lucide="hash"></i>
                      Project Approval Number *
                    </label>
                    <div class="input-wrap neu-inset">
                      <input type="text" name="dpp_approval_number"
                             class="form-input"
                             placeholder="e.g. RID3232/DPP/2425/001"
                             value="${isEdit
                               ? StringUtils.sanitize(
                                   eventData.dpp_approval_number || '')
                               : ''}" />
                    </div>
                  </div>

                  <!-- DPP Pillar — FREE TEXT -->
                  <div class="form-group">
                    <label class="form-label">
                      <i data-lucide="layers"></i>
                      DPP Pillar *
                    </label>
                    <div class="input-wrap neu-inset">
                      <input type="text" name="dpp_pillar"
                             class="form-input"
                             placeholder="e.g. Community Service"
                             value="${isEdit
                               ? StringUtils.sanitize(
                                   eventData.dpp_pillar || '')
                               : ''}" />
                    </div>
                  </div>

                  <!-- Category — FREE TEXT -->
                  <div class="form-group">
                    <label class="form-label">
                      <i data-lucide="tag"></i>
                      Category *
                    </label>
                    <div class="input-wrap neu-inset">
                      <input type="text" name="dpp_category"
                             class="form-input"
                             placeholder="e.g. Flagship Project"
                             value="${isEdit
                               ? StringUtils.sanitize(
                                   eventData.dpp_category || '')
                               : ''}" />
                    </div>
                  </div>

                  <!-- Council Member / District Trainer -->
                  <div class="form-group">
                    <label class="form-label">
                      <i data-lucide="shield"></i>
                      Council Member / District Trainer
                      <span style="font-size:0.72rem;color:var(--text-muted);
                                   font-weight:400;">(optional)</span>
                    </label>
                    <div class="input-wrap neu-inset">
                      <input type="text" name="dpp_council_member"
                             class="form-input"
                             placeholder="Full name..."
                             value="${isEdit
                               ? StringUtils.sanitize(
                                   eventData.dpp_council_member || '')
                               : ''}" />
                    </div>
                  </div>

                </div>
              </div>
            </div>
            <!-- ── end DPP Extra Fields ──────────────────────── -->

            <!-- Expected Attendance -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="users"></i> Expected Attendance
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="expected_attendance"
                       class="form-input"
                       placeholder="Expected participants" min="1"
                       value="${isEdit
                         ? (eventData.expected_attendance || '')
                         : ''}" />
              </div>
            </div>

            <!-- Proposed Budget -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="indian-rupee"></i> Proposed Budget (Rs.)
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="budget_proposed"
                       class="form-input"
                       placeholder="0.00" min="0" step="0.01"
                       value="${isEdit
                         ? (eventData.budget_proposed || '0')
                         : '0'}" />
              </div>
            </div>

            <!-- Description -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="file-text"></i> Event Description *
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="description" class="form-textarea"
                          rows="6"
                          placeholder="Detailed description about the event,
                          objectives, and expected outcomes..."
                          required>${isEdit
                            ? StringUtils.sanitize(
                                eventData.description || '')
                            : ''}</textarea>
              </div>
            </div>

            <!-- Poster Upload -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="image"></i>
                Event Poster / Promotional Images
                <span style="font-weight:400;color:var(--text-muted);
                             font-size:0.75rem;">
                  (Max ${MAX_PHOTOS.EVENT} images, 4MB each)
                </span>
              </label>

              ${isEdit
                ? await this.getExistingPhotosHTML(eventId, false)
                : ''}

              <div class="file-upload-wrap neu-inset" id="ev-poster-wrap">
                <input type="file" id="ev-poster-input"
                       class="file-input"
                       accept="image/jpeg,image/png,image/webp"
                       multiple />
                <div class="file-upload-ui">
                  <i data-lucide="upload-cloud"></i>
                  <span id="ev-poster-label">
                    ${isEdit
                      ? 'Upload additional poster images'
                      : 'Click to upload poster images'}
                  </span>
                  <span style="font-size:0.7rem;color:var(--text-muted);">
                    JPG, PNG, WebP — Max 4MB each —
                    Max ${MAX_PHOTOS.EVENT} total
                  </span>
                </div>
              </div>

              <div id="ev-poster-previews"
                   style="margin-top:12px;display:none;
                          flex-wrap:wrap;gap:10px;">
              </div>
            </div>

          </div>

          <!-- Form Footer -->
          <div class="admin-form-actions">
            <button type="button" class="btn btn-outline"
                    onclick="eventsAdmin.renderEventsList(
                      document.getElementById('admin-content'),
                      eventsAdmin._currentDashboard)">
              <i data-lucide="x"></i>
              <span>Cancel</span>
            </button>
            ${!isEdit ? `
            <button type="button" class="btn btn-outline"
                    id="ev-save-draft"
                    onclick="eventsAdmin.submitForm('draft')">
              <i data-lucide="save"></i>
              <span>Save as Draft</span>
            </button>` : ''}
            <button type="submit" class="btn btn-primary"
                    id="ev-submit-btn">
              <i data-lucide="send"></i>
              <span>${isEdit
                ? 'Update Event'
                : 'Submit for Approval'}</span>
            </button>
          </div>

          <div class="form-message" id="ev-form-msg"></div>
        </form>
      </div>
    `;

    this._pendingPosters = [];
    this.setupEventFormListeners(isEdit, eventData);
    lucide.createIcons();
  }

  async getExistingPhotosHTML(eventId, isActionPhoto) {
    if (!eventId) return '';
    try {
      const { data: photos } = await this.db
        .from('event_photos')
        .select('id, photo_url, photo_name, is_action_photo')
        .eq('event_id', eventId)
        .eq('is_action_photo', isActionPhoto)
        .order('sort_order');

      if (!photos || photos.length === 0) return '';

      return `
        <div style="margin-bottom:12px;">
          <p style="font-size:0.78rem;font-weight:600;
                    color:var(--text-muted);margin-bottom:8px;">
            Existing ${isActionPhoto ? 'Action Photos' : 'Poster Images'}:
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${photos.map(photo => `
              <div style="position:relative;width:80px;height:80px;
                          border-radius:var(--border-radius-sm);
                          overflow:hidden;box-shadow:var(--neu-shadow-sm);">
                <img src="${StringUtils.sanitize(photo.photo_url)}"
                     style="width:100%;height:100%;object-fit:cover;"
                     loading="lazy"
                     onerror="this.parentElement.style.display='none'" />
                <button onclick="eventsAdmin.deletePhoto('${photo.id}')"
                        title="Delete photo"
                        style="position:absolute;top:2px;right:2px;
                               width:18px;height:18px;border-radius:50%;
                               background:var(--danger);color:#fff;
                               border:none;cursor:pointer;font-size:0.6rem;
                               display:flex;align-items:center;
                               justify-content:center;">
                  <i data-lucide="x"
                     style="width:10px;height:10px;"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>`;
    } catch (e) {
      return '';
    }
  }

  setupEventFormListeners(isEdit, eventData) {
    const form        = document.getElementById('ev-form');
    const posterInput = document.getElementById('ev-poster-input');

    if (posterInput) {
      posterInput.addEventListener('change', (e) => {
        this.handlePosterFiles(e.target.files);
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = isEdit ? 'keep' : 'pending_approval';
        await this.submitForm(
          status,
          isEdit ? this._editingEventId : null
        );
      });
    }
  }

  onAvenueChange(avenue) {
    const dppWrap = document.getElementById('ev-dpp-wrap');
    if (dppWrap) {
      dppWrap.style.display =
        avenue === 'district_priority_projects' ? 'block' : 'none';
    }
    /* Hide DPP extra fields when avenue is not DPP */
    if (avenue !== 'district_priority_projects') {
      const extraFields = document.getElementById('ev-dpp-extra-fields');
      if (extraFields) extraFields.style.display = 'none';
      const check = document.getElementById('ev-is-dpp-check');
      if (check) check.checked = false;
    }
  }

  onCollabChange(value) {
    const wrap = document.getElementById('ev-collaborator-wrap');
    if (wrap) {
      wrap.style.display =
        (value && value !== 'none') ? 'block' : 'none';
    }
  }

  onDPPToggle(checked) {
    const extraFields = document.getElementById('ev-dpp-extra-fields');
    if (extraFields) {
      extraFields.style.display = checked ? 'block' : 'none';
    }
  }

  handlePosterFiles(files) {
    const maxFiles = MAX_PHOTOS.EVENT;
    const previews = document.getElementById('ev-poster-previews');
    const label    = document.getElementById('ev-poster-label');

    const validFiles = [];
    for (const file of Array.from(files)) {
      if (!Validate.imageType(file)) {
        this._currentDashboard?.showToast(
          `${file.name}: Invalid file type`, 'error'
        );
        continue;
      }
      if (!Validate.fileSize(file, FILE_LIMITS.EVENT_PHOTO)) {
        this._currentDashboard?.showToast(
          `${file.name}: File too large (max 4MB)`, 'error'
        );
        continue;
      }
      validFiles.push(file);
    }

    this._pendingPosters = validFiles.slice(0, maxFiles);

    if (validFiles.length > maxFiles) {
      this._currentDashboard?.showToast(
        `Only first ${maxFiles} images selected`, 'warning'
      );
    }

    if (previews) {
      if (this._pendingPosters.length > 0) {
        previews.style.display = 'flex';
        previews.innerHTML = this._pendingPosters.map((file, i) => {
          const url = URL.createObjectURL(file);
          return `
            <div style="position:relative;width:80px;height:80px;
                        border-radius:var(--border-radius-sm);
                        overflow:hidden;box-shadow:var(--neu-shadow-sm);">
              <img src="${url}"
                   style="width:100%;height:100%;object-fit:cover;" />
              <button onclick="eventsAdmin.removePosterPreview(${i})"
                      style="position:absolute;top:2px;right:2px;
                             width:18px;height:18px;border-radius:50%;
                             background:var(--danger);color:#fff;
                             border:none;cursor:pointer;display:flex;
                             align-items:center;justify-content:center;">
                <i data-lucide="x" style="width:10px;height:10px;"></i>
              </button>
            </div>`;
        }).join('');
        lucide.createIcons();
      } else {
        previews.style.display = 'none';
        previews.innerHTML = '';
      }
    }

    if (label) {
      label.textContent = this._pendingPosters.length > 0
        ? `${this._pendingPosters.length} file(s) selected`
        : 'Click to upload poster images';
    }
  }

  removePosterPreview(index) {
    this._pendingPosters.splice(index, 1);
    const fileInput = document.getElementById('ev-poster-input');
    if (fileInput) {
      const dt = new DataTransfer();
      this._pendingPosters.forEach(f => dt.items.add(f));
      fileInput.files = dt.files;
    }
    this.handlePosterFiles(this._pendingPosters);
  }

  /* ============================================================
     SUBMIT EVENT FORM
     ============================================================ */
  async submitForm(status, eventId = null) {
    const form      = document.getElementById('ev-form');
    const msgEl     = document.getElementById('ev-form-msg');
    const submitBtn = document.getElementById('ev-submit-btn');
    const draftBtn  = document.getElementById('ev-save-draft');

    if (!form) return;

    const formData = new FormData(form);
    const data     = Object.fromEntries(formData.entries());

    /* Required field validation */
    const requiredFields = [
      { key: 'title',       label: 'Event Title' },
      { key: 'avenue',      label: 'Avenue' },
      { key: 'event_date',  label: 'Event Date' },
      { key: 'start_time',  label: 'Start Time' },
      { key: 'venue',       label: 'Venue' },
      { key: 'event_chair', label: 'Event Chair' },
      { key: 'description', label: 'Description' }
    ];

    for (const field of requiredFields) {
      if (!data[field.key] || !data[field.key].toString().trim()) {
        this.showFormMsg(msgEl, `${field.label} is required`, 'error');
        return;
      }
    }

    /* DPP field validation — only when is_dpp is checked */
    const isDPP = !!data.is_dpp;
    if (isDPP) {
      if (!data.dpp_approval_number?.trim()) {
        this.showFormMsg(
          msgEl, 'DPP Project Approval Number is required', 'error'
        );
        return;
      }
      if (!data.dpp_pillar?.trim()) {
        this.showFormMsg(msgEl, 'DPP Pillar is required', 'error');
        return;
      }
      if (!data.dpp_category?.trim()) {
        this.showFormMsg(msgEl, 'DPP Category is required', 'error');
        return;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML =
        '<i data-lucide="loader-2"></i><span>Saving...</span>';
      lucide.createIcons();
    }
    if (draftBtn) draftBtn.disabled = true;

    try {
      const admin  = this.auth.getAdmin();
      const avenue = data.avenue;

      /* Determine final status */
      let finalStatus = status;
      if (status === 'keep' && eventId) {
        const { data: existing } = await this.db
          .from('events')
          .select('status')
          .eq('id', eventId)
          .single();
        finalStatus = existing?.status || 'draft';
      }

      /* Full-access admins auto-approve */
      if (status === 'pending_approval' && this.auth.isFullAccess()) {
        finalStatus = 'approved';
      }

      const payload = {
        title              : data.title.trim(),
        avenue,
        event_date         : data.event_date,
        start_time         : data.start_time,
        end_time           : data.end_time    || null,
        venue              : data.venue.trim(),
        event_chair        : data.event_chair.trim(),
        event_secretary    : data.event_secretary?.trim()    || null,
        event_proposed_by  : data.event_proposed_by?.trim()  || null,
        event_seconded_by  : data.event_seconded_by?.trim()  || null,
        collaboration      : data.collaboration || 'none',
        collaborator_name  : data.collaborator_name?.trim()  || null,
        is_dpp             : isDPP,
        /* DPP-specific — only saved when is_dpp is true */
        dpp_approval_number: isDPP
          ? (data.dpp_approval_number?.trim() || null) : null,
        dpp_pillar         : isDPP
          ? (data.dpp_pillar?.trim()          || null) : null,
        dpp_category       : isDPP
          ? (data.dpp_category?.trim()        || null) : null,
        dpp_council_member : isDPP
          ? (data.dpp_council_member?.trim()  || null) : null,
        expected_attendance: data.expected_attendance
          ? parseInt(data.expected_attendance) : null,
        budget_proposed    : parseFloat(data.budget_proposed) || 0,
        description        : data.description.trim(),
        group_number       : data.group_number || '1',
        updated_at         : new Date().toISOString()
      };

      let savedEventId = eventId;

      if (eventId) {
        const { error } = await this.db
          .from('events')
          .update(payload)
          .eq('id', eventId);
        if (error) throw error;
      } else {
        const { data: newEvent, error } = await this.db
          .from('events')
          .insert({
            ...payload,
            status     : finalStatus,
            created_by : admin?.id,
            ...(finalStatus === 'approved' ? {
              approved_by : admin?.id,
              approved_at : new Date().toISOString()
            } : {})
          })
          .select('id')
          .single();

        if (error) throw error;
        savedEventId = newEvent.id;

        await this.auth.logActivity(
          admin?.id, 'EVENT_CREATED', 'events', savedEventId,
          {
            title  : payload.title,
            avenue : payload.avenue,
            status : finalStatus
          }
        );
      }

      /* Upload poster photos */
      if (this._pendingPosters?.length > 0 && savedEventId) {
        await this.uploadEventPhotos(
          savedEventId, this._pendingPosters, false
        );
        this._pendingPosters = [];
      }

      /* Send notification if approved */
      if (finalStatus === 'approved' && window.emailService) {
        await window.emailService.sendEventApprovalNotification(savedEventId);
      }

      this._currentDashboard?.showToast(
        eventId
          ? 'Event updated successfully!'
          : finalStatus === 'approved'
            ? 'Event created and approved! Members notified.'
            : 'Event submitted for approval!',
        'success'
      );

      await this.renderEventsList(
        document.getElementById('admin-content'),
        this._currentDashboard
      );

    } catch (error) {
      console.error('Event form submit error:', error);
      this.showFormMsg(
        msgEl, `Failed to save event: ${error.message}`, 'error'
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML =
          '<i data-lucide="send"></i><span>Submit for Approval</span>';
        lucide.createIcons();
      }
      if (draftBtn) draftBtn.disabled = false;
    }
  }

  /* ============================================================
     UPLOAD PHOTOS
     ============================================================ */
  async uploadEventPhotos(eventId, files, isActionPhoto = false, opts = null) {
    const uploaded = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        /* optional geo-tag stamp (already ≤150 KB with GPS data); otherwise the normal compression */
        let stamped = null;
        if (opts && opts.stamp) {
          try { stamped = await opts.stamp(file, i); }
          catch (se) { console.warn('Geo-tag failed, uploading the plain photo:', se); this._currentDashboard?.showToast('Could not geo-tag one photo — uploaded without the overlay', 'warning'); }
        }
        const compressed = stamped || await ImageUtils.compress(file, 1280, 960, 0.82);
        const filename   = `event_${eventId}_${Date.now()}_${i}.jpg`;

        const { data: uploadData, error } = await this.db.storage
          .from(STORAGE_BUCKETS.EVENTS)
          .upload(filename, compressed, {
            contentType : 'image/jpeg',
            upsert      : false
          });

        if (!error && uploadData) {
          const url = ImageUtils.getPublicUrl(
            STORAGE_BUCKETS.EVENTS, uploadData.path
          );

          await this.db.from('event_photos').insert({
            event_id        : eventId,
            photo_url       : url,
            photo_name      : file.name,
            is_action_photo : isActionPhoto,
            sort_order      : i,
            file_size_bytes : compressed.size,
            uploaded_by     : this.auth.getAdmin()?.id
          });

          uploaded.push(url);
        }
      } catch (e) {
        console.warn(`Photo upload failed [${file.name}]:`, e);
      }
    }

    return uploaded;
  }

  async deletePhoto(photoId) {
    if (!confirm('Delete this photo?')) return;
    try {
      await this.db.from('event_photos').delete().eq('id', photoId);
      this._currentDashboard?.showToast('Photo deleted', 'success');
      if (this._editingEventId) {
        await this.showEventForm(this._editingEventId);
      }
    } catch (e) {
      this._currentDashboard?.showToast('Failed to delete photo', 'error');
    }
  }

  /* ============================================================
     EVENT DETAIL VIEW
     ============================================================ */
  async viewEventDetails(eventId) {
    try {
      const { data: event, error } = await this.db
        .from('events')
        .select(`
          *,
          event_photos(
            id, photo_url, photo_name, is_action_photo, sort_order
          ),
          event_reports(
            id, report_content, key_highlights, challenges, council_members_count, rotarians_count, district_trainers_count, interactors_count,
            outcomes, future_plans, is_approved, submitted_by,
            created_at, updated_at, photo_urls
          )
        `)
        .eq('id', eventId)
        .single();

      if (error || !event) {
        this._currentDashboard?.showToast('Failed to load event', 'error');
        return;
      }

      const avenue       = AVENUES[event.avenue] || {};
      const status       = EVENT_STATUS[event.status] || {};
      const posters      = (event.event_photos || [])
        .filter(p => !p.is_action_photo)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const actionPhotos = (event.event_photos || [])
        .filter(p => p.is_action_photo)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const report = event.event_reports?.[0] || null;

      const modal = document.createElement('div');
      modal.className = 'modal-overlay active';
      modal.id = 'ev-detail-modal';

      modal.innerHTML = `
        <div class="modal-container neu-card"
             style="max-width:920px;max-height:92vh;">
          <div class="modal-header">
            <div class="modal-title-area">
              <div style="display:flex;align-items:center;gap:8px;
                          margin-bottom:6px;flex-wrap:wrap;">
                <span class="modal-avenue-badge"
                      style="background:${avenue.bgColor
                        || 'var(--accent-light)'};
                             color:${avenue.color || 'var(--accent)'};">
                  ${avenue.label || StringUtils.snakeToTitle(event.avenue)}
                </span>
                ${event.is_dpp
                  ? '<span class="admin-dpp-badge">District Priority Project</span>'
                  : ''}
                <span class="admin-status-badge"
                      style="background:${status.bg || ''};
                             color:${status.color || ''};">
                  ${status.label || event.status}
                </span>
              </div>
              <h2 class="modal-title">
                ${StringUtils.sanitize(event.title || '')}
              </h2>
            </div>
            <button class="modal-close neu-btn"
                    onclick="document.getElementById('ev-detail-modal')
                      .remove();document.body.style.overflow='';">
              <i data-lucide="x"></i>
            </button>
          </div>

          <div class="modal-body" style="overflow-y:auto;">

            <!-- Poster swiper -->
            ${posters.length > 0 ? `
            <div style="border-radius:var(--border-radius-sm);
                        overflow:hidden;margin-bottom:20px;">
              <div class="swiper ev-detail-swiper"
                   id="ev-detail-swiper">
                <div class="swiper-wrapper">
                  ${posters.map(p => `
                    <div class="swiper-slide">
                      <img src="${StringUtils.sanitize(p.photo_url)}"
                           style="width:100%;max-height:360px;
                                  object-fit:cover;
                                  border-radius:var(--border-radius-sm);"
                           loading="lazy"
                           onerror="this.style.display='none'" />
                    </div>
                  `).join('')}
                </div>
                ${posters.length > 1 ? `
                <div class="swiper-pagination"></div>
                <div class="swiper-button-prev"></div>
                <div class="swiper-button-next"></div>` : ''}
              </div>
            </div>` : ''}

            <!-- Event Details -->
            <div class="modal-details-grid" style="margin-bottom:20px;">
              <div class="modal-detail-item">
                <i data-lucide="calendar"></i>
                <div>
                  <span class="modal-detail-label">Date</span>
                  <span class="modal-detail-value">
                    ${DateUtils.format(event.event_date, 'long')}
                  </span>
                </div>
              </div>
              <div class="modal-detail-item">
                <i data-lucide="clock"></i>
                <div>
                  <span class="modal-detail-label">Time</span>
                  <span class="modal-detail-value">
                    ${DateUtils.formatTime(event.start_time)}
                    ${event.end_time
                      ? ' to ' + DateUtils.formatTime(event.end_time)
                      : ''}
                  </span>
                </div>
              </div>
              <div class="modal-detail-item">
                <i data-lucide="map-pin"></i>
                <div>
                  <span class="modal-detail-label">Venue</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(event.venue || '')}
                  </span>
                </div>
              </div>
              <div class="modal-detail-item">
                <i data-lucide="user-check"></i>
                <div>
                  <span class="modal-detail-label">Event Chair</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(event.event_chair || '—')}
                  </span>
                </div>
              </div>
              ${event.event_secretary ? `
              <div class="modal-detail-item">
                <i data-lucide="user"></i>
                <div>
                  <span class="modal-detail-label">Event Secretary</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(event.event_secretary)}
                  </span>
                </div>
              </div>` : ''}
              ${event.event_proposed_by ? `
              <div class="modal-detail-item">
                <i data-lucide="user-plus"></i>
                <div>
                  <span class="modal-detail-label">Proposed By</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(event.event_proposed_by)}
                  </span>
                </div>
              </div>` : ''}
              ${event.event_seconded_by ? `
              <div class="modal-detail-item">
                <i data-lucide="users"></i>
                <div>
                  <span class="modal-detail-label">Seconded By</span>
                  <span class="modal-detail-value">
                    ${StringUtils.sanitize(event.event_seconded_by)}
                  </span>
                </div>
              </div>` : ''}
              <div class="modal-detail-item">
                <i data-lucide="hash"></i>
                <div>
                  <span class="modal-detail-label">Group</span>
                  <span class="modal-detail-value">
                    Group ${event.group_number || '1'}
                  </span>
                </div>
              </div>
              ${event.collaboration && event.collaboration !== 'none' ? `
              <div class="modal-detail-item">
                <i data-lucide="handshake"></i>
                <div>
                  <span class="modal-detail-label">Collaboration</span>
                  <span class="modal-detail-value">
                    ${COLLABORATION_TYPES[event.collaboration]
                      || event.collaboration}
                    ${event.collaborator_name
                      ? ' — ' + StringUtils.sanitize(event.collaborator_name)
                      : ''}
                  </span>
                </div>
              </div>` : ''}
              ${event.actual_attendance ? `
              <div class="modal-detail-item">
                <i data-lucide="users"></i>
                <div>
                  <span class="modal-detail-label">Attendance</span>
                  <span class="modal-detail-value">
                    ${event.actual_attendance} participants
                  </span>
                </div>
              </div>` : ''}
              ${event.beneficiaries ? `
              <div class="modal-detail-item">
                <i data-lucide="heart"></i>
                <div>
                  <span class="modal-detail-label">Beneficiaries</span>
                  <span class="modal-detail-value">
                    ${event.beneficiaries}
                  </span>
                </div>
              </div>` : ''}
              ${event.service_hours ? `
              <div class="modal-detail-item">
                <i data-lucide="clock"></i>
                <div>
                  <span class="modal-detail-label">Service Hours</span>
                  <span class="modal-detail-value">
                    ${event.service_hours} hrs
                  </span>
                </div>
              </div>` : ''}
            </div>

            <!-- ── DPP Details Panel ──────────────────────────── -->
            ${event.is_dpp ? `
            <div style="padding:16px;border-radius:var(--border-radius-sm);
                        background:linear-gradient(135deg,
                          rgba(var(--avenue-dpp-rgb,239,68,68),0.06) 0%,
                          var(--bg-secondary) 100%);
                        border:1px solid
                          rgba(var(--avenue-dpp-rgb,239,68,68),0.2);
                        margin-bottom:20px;">
              <h4 style="font-size:0.78rem;font-weight:800;
                         letter-spacing:0.06em;text-transform:uppercase;
                         color:var(--avenue-dpp);margin-bottom:14px;
                         display:flex;align-items:center;gap:6px;">
                <i data-lucide="award"
                   style="width:15px;height:15px;"></i>
                DPP Information
              </h4>
              <div style="display:grid;
                          grid-template-columns:
                            repeat(auto-fill,minmax(200px,1fr));
                          gap:14px;">

                <!-- Approval Number -->
                <div style="padding:12px;background:var(--bg-primary);
                            border-radius:var(--border-radius-sm);
                            border:1px solid var(--border-color);">
                  <div style="font-size:0.68rem;font-weight:700;
                              color:var(--text-muted);text-transform:uppercase;
                              letter-spacing:0.05em;margin-bottom:4px;
                              display:flex;align-items:center;gap:4px;">
                    <i data-lucide="hash"
                       style="width:11px;height:11px;"></i>
                    Project Approval Number
                  </div>
                  <div style="font-size:0.95rem;font-weight:800;
                              color:var(--accent);font-family:monospace;">
                    ${event.dpp_approval_number
                      ? StringUtils.sanitize(event.dpp_approval_number)
                      : `<span style="color:var(--text-muted);
                                     font-size:0.8rem;
                                     font-family:inherit;">
                           Not specified
                         </span>`}
                  </div>
                </div>

                <!-- DPP Pillar -->
                <div style="padding:12px;background:var(--bg-primary);
                            border-radius:var(--border-radius-sm);
                            border:1px solid var(--border-color);">
                  <div style="font-size:0.68rem;font-weight:700;
                              color:var(--text-muted);text-transform:uppercase;
                              letter-spacing:0.05em;margin-bottom:4px;
                              display:flex;align-items:center;gap:4px;">
                    <i data-lucide="layers"
                       style="width:11px;height:11px;"></i>
                    DPP Pillar
                  </div>
                  <div style="font-size:0.88rem;font-weight:700;
                              color:var(--text-heading);">
                    ${event.dpp_pillar
                      ? StringUtils.sanitize(event.dpp_pillar)
                      : `<span style="color:var(--text-muted);
                                     font-size:0.8rem;">
                           Not specified
                         </span>`}
                  </div>
                </div>

                <!-- Category -->
                <div style="padding:12px;background:var(--bg-primary);
                            border-radius:var(--border-radius-sm);
                            border:1px solid var(--border-color);">
                  <div style="font-size:0.68rem;font-weight:700;
                              color:var(--text-muted);text-transform:uppercase;
                              letter-spacing:0.05em;margin-bottom:4px;
                              display:flex;align-items:center;gap:4px;">
                    <i data-lucide="tag"
                       style="width:11px;height:11px;"></i>
                    Category
                  </div>
                  <div style="font-size:0.88rem;font-weight:700;
                              color:var(--text-heading);">
                    ${event.dpp_category
                      ? StringUtils.sanitize(event.dpp_category)
                      : `<span style="color:var(--text-muted);
                                     font-size:0.8rem;">
                           Not specified
                         </span>`}
                  </div>
                </div>

                <!-- Council Member / District Trainer -->
                <div style="padding:12px;background:var(--bg-primary);
                            border-radius:var(--border-radius-sm);
                            border:1px solid var(--border-color);">
                  <div style="font-size:0.68rem;font-weight:700;
                              color:var(--text-muted);text-transform:uppercase;
                              letter-spacing:0.05em;margin-bottom:4px;
                              display:flex;align-items:center;gap:4px;
                              flex-wrap:wrap;">
                    <i data-lucide="shield"
                       style="width:11px;height:11px;"></i>
                    Council Member / District Trainer
                  </div>
                  <div style="font-size:0.88rem;font-weight:600;
                              color:var(--text-heading);">
                    ${event.dpp_council_member
                      ? StringUtils.sanitize(event.dpp_council_member)
                      : `<span style="color:var(--text-muted);
                                     font-size:0.8rem;">
                           Not specified
                         </span>`}
                  </div>
                </div>

              </div>
            </div>` : ''}
            <!-- ── end DPP Details Panel ─────────────────────── -->

            <!-- Description -->
            <div class="modal-description-section">
              <h4>
                <i data-lucide="file-text"></i> Event Description
              </h4>
              <p>${StringUtils.sanitize(event.description || '')}</p>
            </div>

            <!-- Report snippet -->
            ${report ? `
            <div style="margin-top:20px;padding:16px;
                        background:var(--bg-secondary);
                        border-radius:var(--border-radius-sm);">
              <h4 style="display:flex;align-items:center;gap:8px;
                         font-size:0.9rem;font-weight:700;
                         color:var(--text-heading);margin-bottom:12px;">
                <i data-lucide="file-check"></i>
                Event Report
                <span class="admin-status-badge"
                      style="background:${report.is_approved
                        ? 'var(--success-light)' : 'var(--warning-light)'};
                             color:${report.is_approved
                               ? 'var(--success)' : 'var(--warning)'};">
                  ${report.is_approved ? 'Approved' : 'Pending Approval'}
                </span>
              </h4>
              <p style="font-size:0.84rem;color:var(--text-secondary);
                        line-height:1.7;">
                ${StringUtils.sanitize(
                    report.report_content || '').substring(0, 400)}
                ${(report.report_content || '').length > 400 ? '...' : ''}
              </p>
            </div>` : ''}

            <!-- Action Photos -->
            ${actionPhotos.length > 0 ? `
            <div class="modal-photos-section" style="margin-top:20px;">
              <h4>
                <i data-lucide="camera"></i>
                Action Photographs (${actionPhotos.length})
              </h4>
              <div class="modal-photos-grid">
                ${actionPhotos.map((photo, idx) => `
                  <div class="modal-photo-item"
                       onclick="eventsAdmin._viewPhoto(
                         ${idx},
                         ${JSON.stringify(
                           actionPhotos.map(p => p.photo_url)
                         )})">
                    <img src="${StringUtils.sanitize(photo.photo_url)}"
                         alt="Action photo"
                         loading="lazy"
                         onerror="this.parentElement.style.display='none'" />
                  </div>
                `).join('')}
              </div>
            </div>` : ''}

            <!-- Modal Actions -->
            <div class="modal-actions" style="margin-top:20px;flex-wrap:wrap;">
              ${this.auth.can('EDIT_ANY_EVENT') ||
                this.auth.canAccessAvenue(event.avenue) ? `
              <button class="btn btn-outline btn-sm"
                      onclick="eventsAdmin.showEventForm('${event.id}');
                               document.getElementById('ev-detail-modal')
                                 .remove();
                               document.body.style.overflow='';">
                <i data-lucide="pencil"></i>
                <span>Edit Event</span>
              </button>` : ''}
              ${event.status === 'pending_approval' &&
                this.auth.can('APPROVE_EVENT') ? `
              <button class="btn btn-success btn-sm"
                      onclick="eventsAdmin.approveEvent('${event.id}');
                               document.getElementById('ev-detail-modal')
                                 .remove();
                               document.body.style.overflow='';">
                <i data-lucide="check-circle"></i>
                <span>Approve</span>
              </button>
              <button class="btn btn-danger btn-sm"
                      onclick="eventsAdmin.rejectEvent('${event.id}');
                               document.getElementById('ev-detail-modal')
                                 .remove();
                               document.body.style.overflow='';">
                <i data-lucide="x-circle"></i>
                <span>Reject</span>
              </button>` : ''}
              ${(event.status === 'approved' ||
                event.status === 'completed') ? `
              <button class="btn btn-primary btn-sm"
                      onclick="eventsAdmin.showReportForm('${event.id}');
                               document.getElementById('ev-detail-modal')
                                 .remove();
                               document.body.style.overflow='';">
                <i data-lucide="file-text"></i>
                <span>${report
                  ? 'View/Edit Report' : 'Submit Report'}</span>
              </button>` : ''}
              ${report?.is_approved ? `
              <button class="btn btn-outline btn-sm"
                      onclick="eventsAdmin.downloadEventReport(
                        '${event.id}')">
                <i data-lucide="download"></i>
                <span>Download .docx</span>
              </button>` : ''}
            </div>

          </div>
        </div>
      `;

      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          document.body.style.overflow = '';
        }
      });
      lucide.createIcons();

      if (posters.length > 1) {
        setTimeout(() => {
          new Swiper('#ev-detail-swiper', {
            loop      : true,
            pagination: {
              el       : '#ev-detail-swiper .swiper-pagination',
              clickable: true
            },
            navigation: {
              prevEl: '#ev-detail-swiper .swiper-button-prev',
              nextEl: '#ev-detail-swiper .swiper-button-next'
            }
          });
        }, 100);
      }

    } catch (error) {
      console.error('View event error:', error);
      this._currentDashboard?.showToast(
        'Failed to load event details', 'error'
      );
    }
  }

  _viewPhoto(index, urls) {
    if (window.app) {
      window.app.lightboxImages = urls;
      window.app.openLightbox(index);
    }
  }

  /* ============================================================
     APPROVE / REJECT / DELETE / COMPLETE
     ============================================================ */
  async approveEvent(eventId) {
    const admin = this.auth.getAdmin();
    if (!admin) return;

    try {
      await this.db.from('events').update({
        status      : 'approved',
        approved_by : admin.id,
        approved_at : new Date().toISOString()
      }).eq('id', eventId);

      if (window.emailService) {
        await window.emailService.sendEventApprovalNotification(eventId);
      }

      await this.auth.logActivity(
        admin.id, 'EVENT_APPROVED', 'events', eventId
      );
      this._currentDashboard?.showToast(
        'Event approved! Members notified.', 'success'
      );
      await this._currentDashboard?.loadPendingCounts?.();
      await this.renderEventsList(
        document.getElementById('admin-content'),
        this._currentDashboard
      );
    } catch (e) {
      this._currentDashboard?.showToast('Failed to approve event', 'error');
    }
  }

  async rejectEvent(eventId) {
    const reason = prompt('Reason for rejection (required):');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }

    try {
      await this.db.from('events').update({
        status           : 'rejected',
        rejection_reason : reason.trim()
      }).eq('id', eventId);

      this._currentDashboard?.showToast('Event rejected', 'warning');
      await this.renderEventsList(
        document.getElementById('admin-content'),
        this._currentDashboard
      );
    } catch (e) {
      this._currentDashboard?.showToast('Failed to reject event', 'error');
    }
  }

  async markCompleted(eventId) {
    try {
      await this.db.from('events')
        .update({ status: 'completed' })
        .eq('id', eventId);

      this._currentDashboard?.showToast(
        'Event marked as completed', 'success'
      );
      await this.renderEventsList(
        document.getElementById('admin-content'),
        this._currentDashboard
      );
    } catch (e) {
      this._currentDashboard?.showToast('Failed to update status', 'error');
    }
  }

  async deleteEvent(eventId) {
    if (!this._currentDashboard) return;

    this._currentDashboard.confirmAction(
      'Delete Event',
      'Permanently delete this event and all its photos and reports? '
        + 'This cannot be undone.',
      async () => {
        try {
          await this.db.from('event_photos').delete().eq('event_id', eventId);
          await this.db.from('event_reports').delete().eq('event_id', eventId);
          await this.db.from('events').delete().eq('id', eventId);

          this._currentDashboard?.showToast('Event deleted', 'success');
          await this.renderEventsList(
            document.getElementById('admin-content'),
            this._currentDashboard
          );
        } catch (e) {
          this._currentDashboard?.showToast(
            'Failed to delete event', 'error'
          );
        }
      },
      'trash-2'
    );
  }

  /* ============================================================
     REPORT FORM
     ============================================================ */
  async showReportForm(eventId) {
    const content = document.getElementById('admin-content');
    if (!content) return;

    const { data: event } = await this.db
      .from('events')
      .select('*, event_reports(*), event_photos(*)')
      .eq('id', eventId)
      .single();

    if (!event) {
      this._currentDashboard?.showToast('Event not found', 'error');
      return;
    }

    const existingReport = event.event_reports?.[0] || null;
    const actionPhotos   = (event.event_photos || [])
      .filter(p => p.is_action_photo)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    content.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="file-text"></i>
            ${existingReport ? 'View / Edit Report' : 'Submit Event Report'}
          </h1>
          <p class="admin-section-subtitle">
            ${StringUtils.sanitize(event.title || '')}
          </p>
        </div>
        <div class="admin-section-actions">
          <button class="btn btn-outline"
                  onclick="eventsAdmin.renderEventsList(
                    document.getElementById('admin-content'),
                    eventsAdmin._currentDashboard)">
            <i data-lucide="arrow-left"></i>
            <span>Back</span>
          </button>
          ${existingReport?.is_approved ? `
          <button class="btn btn-primary"
                  onclick="eventsAdmin.downloadEventReport('${eventId}')">
            <i data-lucide="download"></i>
            <span>Download .docx</span>
          </button>` : ''}
        </div>
      </div>

      <!-- Event Summary -->
      <div class="admin-card neu-card" style="margin-bottom:20px;">
        <div class="admin-card-header">
          <h3><i data-lucide="info"></i> Event Summary</h3>
        </div>
        <div class="modal-details-grid" style="padding:20px;">
          <div class="modal-detail-item">
            <i data-lucide="calendar"></i>
            <div>
              <span class="modal-detail-label">Date</span>
              <span class="modal-detail-value">
                ${DateUtils.format(event.event_date, 'long')}
              </span>
            </div>
          </div>
          <div class="modal-detail-item">
            <i data-lucide="clock"></i>
            <div>
              <span class="modal-detail-label">Time</span>
              <span class="modal-detail-value">
                ${DateUtils.formatTime(event.start_time)}
              </span>
            </div>
          </div>
          <div class="modal-detail-item">
            <i data-lucide="map-pin"></i>
            <div>
              <span class="modal-detail-label">Venue</span>
              <span class="modal-detail-value">
                ${StringUtils.sanitize(event.venue || '')}
              </span>
            </div>
          </div>
          <div class="modal-detail-item">
            <i data-lucide="user-check"></i>
            <div>
              <span class="modal-detail-label">Event Chair</span>
              <span class="modal-detail-value">
                ${StringUtils.sanitize(event.event_chair || '—')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Report Form -->
      <div class="admin-card neu-card">
        <div class="admin-card-header">
          <h3>
            <i data-lucide="file-text"></i> Report Details
          </h3>
          ${existingReport ? `
          <span class="admin-status-badge"
                style="background:${existingReport.is_approved
                  ? 'var(--success-light)' : 'var(--warning-light)'};
                       color:${existingReport.is_approved
                         ? 'var(--success)' : 'var(--warning)'};">
            ${existingReport.is_approved ? 'Approved' : 'Pending Approval'}
          </span>` : ''}
        </div>
        <form id="rpt-form" style="padding:20px;">
          <div class="admin-form-grid">

            <!-- Report Content -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="file-text"></i> Report Content *
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="report_content" class="form-textarea"
                          rows="10"
                          placeholder="Write a detailed report..."
                          required>${existingReport?.report_content || ''
                          }</textarea>
              </div>
            </div>

            <!-- Key Highlights -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="star"></i> Key Highlights
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="key_highlights" class="form-textarea"
                          rows="4"
                          placeholder="Notable highlights and achievements..."
                >${existingReport?.key_highlights || ''}</textarea>
              </div>
            </div>

            <!-- Challenges -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="alert-triangle"></i> Challenges Faced
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="challenges" class="form-textarea"
                          rows="4"
                          placeholder="Any difficulties encountered..."
                >${existingReport?.challenges || ''}</textarea>
              </div>
            </div>

            <!-- Outcomes -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="target"></i> Outcomes &amp; Impact
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="outcomes" class="form-textarea"
                          rows="4"
                          placeholder="Results achieved and community impact..."
                >${existingReport?.outcomes || ''}</textarea>
              </div>
            </div>

            <!-- Future Plans -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="arrow-right-circle"></i> Future Plans
              </label>
              <div class="input-wrap neu-inset">
                <textarea name="future_plans" class="form-textarea"
                          rows="4"
                          placeholder="Plans for follow-up activities..."
                >${existingReport?.future_plans || ''}</textarea>
              </div>
            </div>

            <!-- Guests & dignitaries (all avenues, including DPP) -->
            <div class="form-group admin-form-full">
              <div class="set-note" style="margin:0 0 4px;">
                <i data-lucide="users-round"></i>
                <span><strong>Guests &amp; dignitaries present</strong> — enter 0 if none attended. These numbers appear in the generated report.</span>
              </div>
            </div>
              <div class="form-group">
                <label class="form-label"><i data-lucide="landmark"></i> Council Members</label>
                <div class="input-wrap neu-inset">
                  <input type="number" name="council_members_count" class="form-input" min="0" step="1" inputmode="numeric"
                         value="${existingReport?.council_members_count ?? 0}" placeholder="0" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label"><i data-lucide="badge-check"></i> Rotarians</label>
                <div class="input-wrap neu-inset">
                  <input type="number" name="rotarians_count" class="form-input" min="0" step="1" inputmode="numeric"
                         value="${existingReport?.rotarians_count ?? 0}" placeholder="0" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label"><i data-lucide="graduation-cap"></i> District Trainers</label>
                <div class="input-wrap neu-inset">
                  <input type="number" name="district_trainers_count" class="form-input" min="0" step="1" inputmode="numeric"
                         value="${existingReport?.district_trainers_count ?? 0}" placeholder="0" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label"><i data-lucide="sparkles"></i> Interactors</label>
                <div class="input-wrap neu-inset">
                  <input type="number" name="interactors_count" class="form-input" min="0" step="1" inputmode="numeric"
                         value="${existingReport?.interactors_count ?? 0}" placeholder="0" />
                </div>
              </div>

            <!-- Stats -->
            <div class="form-group">
              <label class="form-label">
                <i data-lucide="users"></i> Actual Attendance
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="actual_attendance"
                       class="form-input" min="0"
                       placeholder="Total participants"
                       value="${event.actual_attendance || ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <i data-lucide="heart"></i> Total Beneficiaries
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="beneficiaries"
                       class="form-input" min="0"
                       placeholder="People benefited"
                       value="${event.beneficiaries || ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <i data-lucide="clock"></i> Total Service Hours
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="service_hours"
                       class="form-input" min="0" step="0.5"
                       placeholder="Service hours rendered"
                       value="${event.service_hours || ''}" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <i data-lucide="indian-rupee"></i> Actual Expenses (Rs.)
              </label>
              <div class="input-wrap neu-inset">
                <input type="number" name="budget_actual"
                       class="form-input" min="0" step="0.01"
                       placeholder="Total amount spent"
                       value="${event.budget_actual || ''}" />
              </div>
            </div>

            <!-- Action Photos Upload -->
            <div class="form-group admin-form-full">
              <label class="form-label">
                <i data-lucide="camera"></i> Action Photographs
                <span style="font-weight:400;color:var(--text-muted);
                             font-size:0.75rem;">
                  (Max ${MAX_PHOTOS.REPORT} photos, 4MB each)
                </span>
              </label>

              ${actionPhotos.length > 0 ? `
              <div style="margin-bottom:12px;">
                <p style="font-size:0.78rem;font-weight:600;
                          color:var(--text-muted);margin-bottom:8px;">
                  Existing Action Photos (${actionPhotos.length}):
                </p>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  ${actionPhotos.map((photo, idx) => `
                    <div style="position:relative;width:80px;height:80px;
                                border-radius:var(--border-radius-sm);
                                overflow:hidden;
                                box-shadow:var(--neu-shadow-sm);
                                cursor:pointer;"
                         onclick="eventsAdmin._viewPhoto(
                           ${idx},
                           ${JSON.stringify(
                             actionPhotos.map(p => p.photo_url)
                           )})">
                      <img src="${StringUtils.sanitize(photo.photo_url)}"
                           style="width:100%;height:100%;object-fit:cover;"
                           loading="lazy"
                           onerror="this.parentElement.style.display='none'" />
                    </div>
                  `).join('')}
                </div>
              </div>` : ''}

              ${this._geoPanelHtml(event)}

              <div class="file-upload-wrap neu-inset"
                   id="rpt-photos-wrap">
                <input type="file" id="rpt-photos-input"
                       class="file-input"
                       accept="image/jpeg,image/png,image/webp"
                       multiple />
                <div class="file-upload-ui">
                  <i data-lucide="upload-cloud"></i>
                  <span id="rpt-photos-label">
                    ${actionPhotos.length > 0
                      ? 'Upload additional action photos'
                      : 'Click to upload action photographs'}
                  </span>
                  <span style="font-size:0.7rem;color:var(--text-muted);">
                    Max ${MAX_PHOTOS.REPORT} photos — 4MB each
                  </span>
                </div>
              </div>

              <div id="rpt-photo-previews"
                   style="margin-top:8px;display:none;
                          flex-wrap:wrap;gap:8px;">
              </div>
            </div>

            <!-- Approve toggle (for permitted admins) -->
            ${this.auth.can('APPROVE_REPORT') &&
              existingReport && !existingReport.is_approved ? `
            <div class="form-group admin-form-full">
              <div class="admin-toggle-wrap"
                   style="padding:12px;background:var(--success-light);
                          border-radius:var(--border-radius-sm);">
                <label class="admin-toggle">
                  <input type="checkbox" name="approve_report" />
                  <span class="admin-toggle-slider"></span>
                </label>
                <div>
                  <strong style="color:var(--success);">
                    Approve this report
                  </strong>
                  <p style="font-size:0.78rem;color:var(--text-muted);
                            margin-top:2px;">
                    Approving will notify members via email.
                  </p>
                </div>
              </div>
            </div>` : ''}

          </div>

          <div class="admin-form-actions">
            <button type="button" class="btn btn-outline"
                    onclick="eventsAdmin.renderEventsList(
                      document.getElementById('admin-content'),
                      eventsAdmin._currentDashboard)">
              <i data-lucide="x"></i>
              <span>Cancel</span>
            </button>
            <button type="submit" class="btn btn-primary"
                    id="rpt-submit-btn">
              <i data-lucide="send"></i>
              <span>Submit Report</span>
            </button>
          </div>

          <div class="form-message" id="rpt-form-msg"></div>
        </form>
      </div>
    `;

    this._pendingReportPhotos = [];
    this.setupReportFormListeners(event.id, existingReport?.id);
    this._geoInit(event);
    lucide.createIcons();
  }

  /* ============================================================
     GEO-TAG STUDIO (report form → Action Photographs)
     ============================================================ */
  _geoPanelHtml(event) {
    const hasSaved = event.geo_lat != null && event.geo_lng != null;
    return `
      <div class="geo-panel" id="geo-panel">
        <div class="geo-head">
          <span class="geo-ico"><i data-lucide="map-pin"></i></span>
          <div class="geo-head-text">
            <b>Geo-tag action photos</b>
            <small>Paste the Google Maps link — every photo gets the event name, place, latitude, longitude, event date, a time inside the event hours and a mini map.</small>
          </div>
          <label class="geo-skip" title="Tick this if your photos were already geo-tagged by another app">
            <input type="checkbox" id="geo-skip" /><span class="geo-skip-box"></span><span class="geo-skip-text">Skip geo-tagging</span>
          </label>
        </div>
        <div class="geo-body" id="geo-body">
          <label class="form-label" for="geo-link"><i data-lucide="link"></i> Google Maps link or coordinates</label>
          <div class="geo-link-row">
            <div class="input-wrap neu-inset"><input type="text" id="geo-link" class="form-input" inputmode="url" autocomplete="off" spellcheck="false"
                   placeholder="https://maps.app.goo.gl/…   or   11.0168, 76.9558"
                   value="${StringUtils.sanitize(event.geo_link || '')}" /></div>
            <button type="button" class="btn btn-primary" id="geo-detect"><i data-lucide="scan-search"></i><span>Detect</span></button>
          </div>
          <ul class="geo-diag" id="geo-diag" aria-live="polite"></ul>
          <div class="geo-fields">
            <div class="form-group"><label class="form-label" for="geo-name"><i data-lucide="map-pin"></i> Location name</label>
              <div class="input-wrap neu-inset"><input type="text" id="geo-name" class="form-input" maxlength="140" placeholder="Auto-filled — you can edit it"
                   value="${StringUtils.sanitize(event.geo_place || event.venue || '')}" /></div></div>
            <div class="form-group"><label class="form-label" for="geo-lat"><i data-lucide="move-vertical"></i> Latitude</label>
              <div class="input-wrap neu-inset"><input type="text" id="geo-lat" class="form-input" inputmode="decimal" placeholder="11.016844" value="${hasSaved ? event.geo_lat : ''}" /></div></div>
            <div class="form-group"><label class="form-label" for="geo-lng"><i data-lucide="move-horizontal"></i> Longitude</label>
              <div class="input-wrap neu-inset"><input type="text" id="geo-lng" class="form-input" inputmode="decimal" placeholder="76.955833" value="${hasSaved ? event.geo_lng : ''}" /></div></div>
          </div>
          <div class="geo-preview-wrap" id="geo-preview-wrap" hidden>
            <div class="geo-preview-bar">
              <b><i data-lucide="eye"></i> Live preview</b>
              <button type="button" class="btn btn-outline btn-sm" id="geo-shuffle"><i data-lucide="shuffle"></i><span>New random times</span></button>
            </div>
            <canvas id="geo-preview" class="geo-preview" aria-label="Geo-tag preview"></canvas>
            <p class="geo-note">Times are picked at random inside the event hours. Each photo is saved under 150 KB with the position also stored in its GPS data.</p>
          </div>
        </div>
      </div>`;
  }

  _geoInit(event) {
    this._geo = { event, skip: false, info: { lat: null, lng: null, name: '', link: '' }, flags: [], secs: [], thumbs: [], previewSeq: 0 };
    const g = this._geo, $ = (id) => document.getElementById(id);
    const readFields = () => {
      const lat = parseFloat($('geo-lat')?.value), lng = parseFloat($('geo-lng')?.value);
      g.info = { lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null, name: ($('geo-name')?.value || '').trim(), link: ($('geo-link')?.value || '').trim() };
    };
    readFields();
    $('geo-skip')?.addEventListener('change', (e) => {
      g.skip = e.target.checked; $('geo-panel').classList.toggle('is-skipped', g.skip);
      this._geoThumbs(); if (!g.skip) this._geoPreview();
    });
    $('geo-detect')?.addEventListener('click', () => this._geoDetect());
    $('geo-link')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); this._geoDetect(); } });
    $('geo-link')?.addEventListener('paste', () => setTimeout(() => this._geoDetect(), 60));   // pasting a link detects it straight away
    let t; const upd = () => { clearTimeout(t); t = setTimeout(() => { readFields(); this._geoPreview(); }, 280); };
    ['geo-name', 'geo-lat', 'geo-lng'].forEach(id => $(id)?.addEventListener('input', upd));
    $('geo-shuffle')?.addEventListener('click', () => { this._geoAssignTimes(); this._geoThumbs(); this._geoPreview(); });
    if (g.info.lat != null) this._geoPreview();
  }

  _geoRenderDiag(steps) {
    const box = document.getElementById('geo-diag'); if (!box) return;
    box.innerHTML = steps.map(s => `<li class="${s.ok ? 'ok' : 'bad'}"><i data-lucide="${s.ok ? 'check-circle-2' : 'alert-circle'}"></i><span><b>${StringUtils.sanitize(s.label)}</b>${s.detail ? `<small>${StringUtils.sanitize(s.detail)}</small>` : ''}</span></li>`).join('');
    if (window.lucide) lucide.createIcons();
  }

  async _geoDetect() {
    const g = this._geo; if (!g) return;
    const input = document.getElementById('geo-link').value, btn = document.getElementById('geo-detect');
    btn.disabled = true; btn.innerHTML = '<i data-lucide="loader-2" class="geo-spin"></i><span>Checking…</span>'; lucide.createIcons();
    try {
      const r = await GeoTag.diagnose(input, (steps) => this._geoRenderDiag(steps));
      this._geoRenderDiag(r.steps);
      if (r.ok) {
        document.getElementById('geo-lat').value = r.lat.toFixed(6);
        document.getElementById('geo-lng').value = r.lng.toFixed(6);
        if (r.name) document.getElementById('geo-name').value = r.name;
        g.info = { lat: r.lat, lng: r.lng, name: r.name || document.getElementById('geo-name').value.trim(), link: r.link || input.trim() };
        this._geoAssignTimes(); this._geoThumbs(); await this._geoPreview();
        this._currentDashboard?.showToast('Location detected — photos will be geo-tagged', 'success');
      }
    } finally { btn.disabled = false; btn.innerHTML = '<i data-lucide="scan-search"></i><span>Detect</span>'; lucide.createIcons(); }
  }

  _geoValid() { const i = this._geo?.info; return !!(i && i.lat != null && i.lng != null && Math.abs(i.lat) <= 90 && Math.abs(i.lng) <= 180); }

  _geoAssignTimes() {
    const g = this._geo, ev = g.event, idx = g.flags.map((f, i) => f ? i : -1).filter(i => i >= 0);
    const secs = GeoTag.randomTimes(ev.start_time, ev.end_time, Math.max(1, idx.length));
    g.secs = []; idx.forEach((photoIdx, k) => { g.secs[photoIdx] = secs[k]; });
    g.previewSec = secs[0];
  }

  _geoInfoFor(i) {
    const g = this._geo, ev = g.event, sec = g.secs[i] != null ? g.secs[i] : (g.previewSec != null ? g.previewSec : 36000);
    const day = String(ev.event_date || '').slice(0, 10);
    const when = new Date(`${day}T00:00:00`); when.setSeconds(sec);
    return { eventName: ev.title || 'Event', placeName: g.info.name || ev.venue || 'Location', lat: g.info.lat, lng: g.info.lng,
             dateText: GeoTag.fmtDate(day), timeText: GeoTag.fmtClock(sec), when: isNaN(when) ? new Date() : when };
  }

  async _geoPreview() {
    const g = this._geo, wrap = document.getElementById('geo-preview-wrap'), cv = document.getElementById('geo-preview');
    if (!g || !wrap || !cv) return;
    if (g.skip || !this._geoValid()) { wrap.hidden = true; return; }
    const seq = ++g.previewSeq; wrap.hidden = false;
    if (g.previewSec == null) this._geoAssignTimes();
    let img;
    const firstIdx = g.flags.findIndex(Boolean), file = firstIdx >= 0 ? this._pendingReportPhotos[firstIdx] : null;
    if (file) { try { img = await ImageUtils._load(file); } catch (e) { img = null; } }
    if (!img) {                                                          // sample backdrop until photos are chosen
      const s = document.createElement('canvas'); s.width = 1280; s.height = 960; const c = s.getContext('2d');
      const bg = c.createLinearGradient(0, 0, 1280, 960); bg.addColorStop(0, '#5B7FA6'); bg.addColorStop(0.55, '#8FB1C9'); bg.addColorStop(1, '#C9B88F');
      c.fillStyle = bg; c.fillRect(0, 0, 1280, 960); c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(980, 210, 110, 0, 6.3); c.fill();
      c.fillStyle = 'rgba(40,60,40,.35)'; c.beginPath(); c.moveTo(0, 620); c.quadraticCurveTo(320, 470, 640, 600); c.quadraticCurveTo(960, 470, 1280, 590); c.lineTo(1280, 960); c.lineTo(0, 960); c.fill();
      img = s;
    }
    const out = await GeoTag.render(img, this._geoInfoFor(Math.max(0, firstIdx)), { maxW: 1100, maxH: 900 });
    if (seq !== g.previewSeq) return;
    cv.width = out.width; cv.height = out.height; cv.getContext('2d').drawImage(out, 0, 0);
  }

  _geoOnPhotos(files) {
    const g = this._geo; if (!g) return;
    g.flags = files.map(() => true); g.secs = []; g.previewSec = null;
    this._geoAssignTimes(); this._geoThumbs(); this._geoPreview();
  }

  _geoThumbs() {
    const g = this._geo, box = document.getElementById('rpt-photo-previews'), files = this._pendingReportPhotos || [];
    if (!box) return;
    (g.thumbs || []).forEach(u => URL.revokeObjectURL(u)); g.thumbs = [];
    if (!files.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    box.style.display = 'flex';
    box.innerHTML = files.map((f, i) => {
      const url = URL.createObjectURL(f); g.thumbs.push(url);
      const on = !g.skip && g.flags[i];
      return `<div class="geo-thumb ${on ? 'is-on' : ''}">
        <img src="${url}" alt="Photo ${i + 1}" />
        ${g.skip ? '' : `<button type="button" class="geo-thumb-btn" data-geo-toggle="${i}" aria-pressed="${on}" title="${on ? 'Geo-tag on — click to leave this photo untouched' : 'Geo-tag off — click to geo-tag this photo'}"><i data-lucide="${on ? 'map-pin' : 'map-pin-off'}"></i></button>`}
        ${on && g.secs[i] != null ? `<span class="geo-thumb-time">${GeoTag.fmtClock(g.secs[i])}</span>` : ''}
      </div>`;
    }).join('');
    box.onclick = (e) => {
      const b = e.target.closest('[data-geo-toggle]'); if (!b) return;
      const i = +b.dataset.geoToggle; g.flags[i] = !g.flags[i]; this._geoAssignTimes(); this._geoThumbs(); this._geoPreview();
    };
    if (window.lucide) lucide.createIcons();
  }

  /** photos that will be stamped need a valid location; returns an error message or '' */
  _geoCheckBeforeUpload() {
    const g = this._geo; if (!g || g.skip || !(this._pendingReportPhotos || []).length) return '';
    if (!g.flags.some(Boolean)) return '';
    if (!this._geoValid()) return 'Add the Google Maps link and press Detect (or type the latitude and longitude) — or tick “Skip geo-tagging”.';
    return '';
  }

  _geoUploadOptions() {
    const g = this._geo; if (!g || g.skip || !this._geoValid()) return null;
    return { stamp: async (file, i) => (g.flags[i] ? GeoTag.stamp(file, this._geoInfoFor(i)) : null) };
  }

  setupReportFormListeners(eventId, existingReportId) {
    const form        = document.getElementById('rpt-form');
    const photosInput = document.getElementById('rpt-photos-input');
    const previews    = document.getElementById('rpt-photo-previews');
    const label       = document.getElementById('rpt-photos-label');

    if (photosInput) {
      photosInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files)
          .slice(0, MAX_PHOTOS.REPORT);
        this._pendingReportPhotos = files;
        if (this._geo) { this._geoOnPhotos(files); } else if (previews) {
          if (files.length > 0) {
            previews.style.display = 'flex';
            previews.innerHTML = files.map(file => {
              const url = URL.createObjectURL(file);
              return `
                <div style="width:80px;height:80px;
                            border-radius:var(--border-radius-sm);
                            overflow:hidden;
                            box-shadow:var(--neu-shadow-sm);">
                  <img src="${url}"
                       style="width:100%;height:100%;object-fit:cover;" />
                </div>`;
            }).join('');
          } else {
            previews.style.display = 'none';
          }
        }

        if (label) {
          label.textContent = files.length > 0
            ? `${files.length} photo(s) selected`
            : 'Click to upload action photographs';
        }
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.submitReport(eventId, existingReportId, form);
      });
    }
  }

  async submitReport(eventId, existingReportId, form) {
    const btn   = document.getElementById('rpt-submit-btn');
    const msgEl = document.getElementById('rpt-form-msg');

    const formData = new FormData(form);
    const data     = Object.fromEntries(formData.entries());
    const admin    = this.auth.getAdmin();

    if (!data.report_content?.trim()) {
      this.showFormMsg(msgEl, 'Report content is required', 'error');
      return;
    }
    const geoProblem = this._geoCheckBeforeUpload();
    if (geoProblem) {
      this.showFormMsg(msgEl, geoProblem, 'error');
      document.getElementById('geo-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (btn) {
      btn.disabled  = true;
      btn.innerHTML =
        '<i data-lucide="loader-2"></i><span>Submitting...</span>';
      lucide.createIcons();
    }

    try {
      /* Upload new action photos */
      const newPhotoUrls = [];
      if (this._pendingReportPhotos?.length > 0) {
        const uploaded = await this.uploadEventPhotos(
          eventId, this._pendingReportPhotos, true, this._geoUploadOptions()
        );
        newPhotoUrls.push(...uploaded);
        this._pendingReportPhotos = [];
      }

      const shouldApprove =
        !!data.approve_report && this.auth.can('APPROVE_REPORT');

      const reportPayload = {
        event_id       : eventId,
        report_content : data.report_content.trim(),
        key_highlights : data.key_highlights?.trim()  || null,
        challenges     : data.challenges?.trim()      || null,
        outcomes       : data.outcomes?.trim()        || null,
        future_plans   : data.future_plans?.trim()    || null,
        council_members_count : Math.max(0, parseInt(data.council_members_count, 10) || 0),
        rotarians_count       : Math.max(0, parseInt(data.rotarians_count, 10) || 0),
        district_trainers_count: Math.max(0, parseInt(data.district_trainers_count, 10) || 0),
        interactors_count     : Math.max(0, parseInt(data.interactors_count, 10) || 0),
        photo_urls     : newPhotoUrls,
        submitted_by   : admin?.id,
        report_month   : DateUtils.getMonthName(new Date().getMonth() + 1),
        report_year    : new Date().getFullYear(),
        is_approved    : shouldApprove || this.auth.isFullAccess(),
        updated_at     : new Date().toISOString()
      };

      if (shouldApprove || this.auth.isFullAccess()) {
        reportPayload.approved_by = admin?.id;
        reportPayload.approved_at = new Date().toISOString();
      }

      if (existingReportId) {
        const { error } = await this.db
          .from('event_reports')
          .update(reportPayload)
          .eq('id', existingReportId);
        if (error) throw error;
      } else {
        const { error } = await this.db
          .from('event_reports')
          .insert(reportPayload);
        if (error) throw error;
      }

      /* Update event stats */
      const statsUpdate = { status: 'completed' };
      if (data.actual_attendance) {
        statsUpdate.actual_attendance = parseInt(data.actual_attendance);
      }
      if (data.beneficiaries) {
        statsUpdate.beneficiaries = parseInt(data.beneficiaries);
      }
      if (data.service_hours) {
        statsUpdate.service_hours = parseFloat(data.service_hours);
      }
      if (data.budget_actual) {
        statsUpdate.budget_actual = parseFloat(data.budget_actual);
      }

      await this.db.from('events')
        .update(statsUpdate)
        .eq('id', eventId);

      /* remember the event location so the next report / photo batch is pre-filled */
      if (this._geo && !this._geo.skip && this._geoValid()) {
        try {
          await this.db.from('events').update({
            geo_link: this._geo.info.link || null, geo_lat: this._geo.info.lat, geo_lng: this._geo.info.lng, geo_place: this._geo.info.name || null
          }).eq('id', eventId);
        } catch (ge) { /* columns are optional (sql/004 section 8) */ }
      }

      /* Notify if approved */
      if ((shouldApprove || this.auth.isFullAccess()) && window.emailService) {
        await window.emailService.sendReportNotification(eventId);
      }

      await this.auth.logActivity(
        admin?.id, 'REPORT_SUBMITTED', 'event_reports', null,
        { event_id: eventId }
      );

      this._currentDashboard?.showToast(
        'Report submitted successfully!', 'success'
      );
      await this.renderEventsList(
        document.getElementById('admin-content'),
        this._currentDashboard
      );

    } catch (error) {
      console.error('Report submit error:', error);
      this.showFormMsg(
        msgEl, `Failed to submit report: ${error.message}`, 'error'
      );
    } finally {
      if (btn) {
        btn.disabled  = false;
        btn.innerHTML =
          '<i data-lucide="send"></i><span>Submit Report</span>';
        lucide.createIcons();
      }
    }
  }

  /* ============================================================
     DOWNLOAD OPTIONS
     ============================================================ */
  async showDownloadOptions() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'ev-download-modal';

    const accessibleAvenues = this.auth.getAccessibleAvenues();
    const now = new Date();

    modal.innerHTML = `
      <div class="modal-container neu-card" style="max-width:480px;">
        <div class="modal-header">
          <h2 class="modal-title">
            <i data-lucide="download"></i> Download Reports
          </h2>
          <button class="modal-close neu-btn"
                  onclick="document.getElementById('ev-download-modal')
                    .remove();document.body.style.overflow='';">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="calendar"></i> Select Month
            </label>
            <div class="select-wrap neu-inset">
              <select id="dl-month" class="form-select">
                ${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `
                  <option value="${m}"
                          ${m === now.getMonth() + 1 ? 'selected' : ''}>
                    ${DateUtils.getMonthName(m)}
                  </option>
                `).join('')}
              </select>
              <i data-lucide="chevron-down" class="select-arrow"></i>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="hash"></i> Select Year
            </label>
            <div class="input-wrap neu-inset">
              <input type="number" id="dl-year" class="form-input"
                     value="${now.getFullYear()}"
                     min="2019" max="2100"
                     placeholder="e.g., 2025" />
            </div>
            <span style="font-size:0.68rem;color:var(--text-muted);
                         margin-top:4px;display:block;">
              Enter any year — 2019 onwards
            </span>
          </div>
          <div class="form-group">
            <label class="form-label">
              <i data-lucide="layers"></i> Report Type
            </label>
            <div class="select-wrap neu-inset">
              <select id="dl-type" class="form-select">
                ${this.auth.can('DOWNLOAD_MONTHLY_REPORT') ? `
                <option value="monthly">
                  Monthly Combined Report
                </option>` : ''}
                ${accessibleAvenues.map(a => `
                  <option value="${a}">
                    ${AVENUES[a]?.label
                      || StringUtils.snakeToTitle(a)} Report
                  </option>
                `).join('')}
                <option value="dpp">
                  District Priority Projects Report
                </option>
              </select>
              <i data-lucide="chevron-down" class="select-arrow"></i>
            </div>
          </div>
          <div class="admin-form-actions"
               style="margin-top:20px;padding:0;">
            <button class="btn btn-outline"
                    onclick="document.getElementById('ev-download-modal')
                      .remove();document.body.style.overflow='';">
              Cancel
            </button>
            <button class="btn btn-primary"
                    onclick="eventsAdmin.processDownload()">
              <i data-lucide="download"></i>
              <span>Download .docx</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
        document.body.style.overflow = '';
      }
    });
    lucide.createIcons();
  }

  async processDownload() {
    const month = parseInt(document.getElementById('dl-month')?.value || '0');
    const year  = parseInt(document.getElementById('dl-year')?.value  || '0');
    const type  = document.getElementById('dl-type')?.value;

    document.getElementById('ev-download-modal')?.remove();
    document.body.style.overflow = '';

    if (!window.docGenerator) {
      this._currentDashboard?.showToast(
        'Document generator not available', 'error'
      );
      return;
    }

    if (!month || !year || year < 2019) {
      this._currentDashboard?.showToast(
        'Please enter a valid month and year', 'error'
      );
      return;
    }

    this._currentDashboard?.showToast('Generating document...', 'info');

    try {
      if (type === 'monthly') {
        await window.docGenerator.generateMonthlyReport(month, year);
      } else if (type === 'dpp') {
        await window.docGenerator.generateDPPReport(month, year);
      } else {
        await window.docGenerator.generateAvenueReport(type, month, year);
      }
    } catch (e) {
      console.error('Download error:', e);
      this._currentDashboard?.showToast(
        `Failed to generate report: ${e.message}`, 'error'
      );
    }
  }

  async downloadEventReport(eventId) {
    if (!window.docGenerator) {
      this._currentDashboard?.showToast(
        'Document generator not available', 'error'
      );
      return;
    }

    this._currentDashboard?.showToast('Generating report...', 'info');
    try {
      await window.docGenerator.generateEventReport(eventId);
    } catch (e) {
      console.error('Event report download error:', e);
      this._currentDashboard?.showToast(
        `Failed to generate report: ${e.message}`, 'error'
      );
    }
  }

  /* ============================================================
     PENDING EVENTS LIST
     ============================================================ */
  async renderPendingEvents(container, dashboard) {
    this._currentDashboard = dashboard;

    const { data: events } = await this.db
      .from('events')
      .select('*')
      .eq('status', 'pending_approval')
      .order('created_at', { ascending: true });

    container.innerHTML = `
      <div class="admin-section-header">
        <div>
          <h1 class="admin-section-title">
            <i data-lucide="clock"></i> Pending Approval
          </h1>
          <p class="admin-section-subtitle">
            ${events?.length || 0}
            event${events?.length !== 1 ? 's' : ''}
            awaiting your review
          </p>
        </div>
        <button class="btn btn-outline"
                onclick="eventsAdmin.renderEventsList(
                  document.getElementById('admin-content'),
                  eventsAdmin._currentDashboard)">
          <i data-lucide="arrow-left"></i>
          <span>All Events</span>
        </button>
      </div>

      ${!events || events.length === 0 ? `
      <div class="admin-card neu-card">
        <div class="admin-empty-state" style="padding:80px;">
          <i data-lucide="check-circle"
             style="width:56px;height:56px;color:var(--success);
                    opacity:0.7;"></i>
          <h3 style="color:var(--text-heading);">All Clear!</h3>
          <p>No events are pending approval at this time.</p>
        </div>
      </div>` : `
      <div style="display:flex;flex-direction:column;gap:16px;">
        ${events.map(event => this.renderPendingCard(event)).join('')}
      </div>`}
    `;

    lucide.createIcons();
  }

  renderPendingCard(event) {
    const avenue = AVENUES[event.avenue] || {};

    return `
      <div class="admin-card neu-card" style="padding:0;overflow:hidden;">
        <div style="padding:20px 24px;
                    border-bottom:1px solid var(--border-color);">
          <div style="display:flex;justify-content:space-between;
                      align-items:flex-start;gap:16px;flex-wrap:wrap;">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:8px;
                          margin-bottom:8px;flex-wrap:wrap;">
                <span class="admin-avenue-badge"
                      style="background:${avenue.bgColor
                        || 'var(--accent-light)'};
                             color:${avenue.color || 'var(--accent)'};">
                  ${avenue.label
                    || StringUtils.snakeToTitle(event.avenue)}
                </span>
                ${event.is_dpp
                  ? '<span class="admin-dpp-badge">'
                    + 'District Priority Project</span>'
                  : ''}
                <span style="font-size:0.72rem;color:var(--text-muted);">
                  Group ${event.group_number || '1'}
                </span>
              </div>
              <h3 style="font-size:1.1rem;font-weight:700;
                         color:var(--text-heading);margin-bottom:6px;">
                ${StringUtils.sanitize(event.title || '')}
              </h3>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0;">
              <button class="btn btn-outline btn-sm"
                      onclick="eventsAdmin.viewEventDetails('${event.id}')">
                <i data-lucide="eye"></i>
                <span>View</span>
              </button>
              <button class="btn btn-success btn-sm"
                      onclick="eventsAdmin.approveEvent('${event.id}')">
                <i data-lucide="check-circle"></i>
                <span>Approve</span>
              </button>
              <button class="btn btn-danger btn-sm"
                      onclick="eventsAdmin.rejectEvent('${event.id}')">
                <i data-lucide="x-circle"></i>
                <span>Reject</span>
              </button>
            </div>
          </div>
        </div>
        <div style="padding:14px 24px;display:flex;flex-wrap:wrap;gap:14px;">
          <div style="display:flex;align-items:center;gap:6px;
                      font-size:0.82rem;color:var(--text-secondary);">
            <i data-lucide="calendar"
               style="width:14px;height:14px;color:var(--accent);"></i>
            ${DateUtils.format(event.event_date, 'long')}
          </div>
          <div style="display:flex;align-items:center;gap:6px;
                      font-size:0.82rem;color:var(--text-secondary);">
            <i data-lucide="clock"
               style="width:14px;height:14px;color:var(--accent);"></i>
            ${DateUtils.formatTime(event.start_time)}
            ${event.end_time
              ? ' to ' + DateUtils.formatTime(event.end_time)
              : ''}
          </div>
          <div style="display:flex;align-items:center;gap:6px;
                      font-size:0.82rem;color:var(--text-secondary);">
            <i data-lucide="map-pin"
               style="width:14px;height:14px;color:var(--accent);"></i>
            ${StringUtils.sanitize(event.venue || '')}
          </div>
          <div style="display:flex;align-items:center;gap:6px;
                      font-size:0.82rem;color:var(--text-secondary);">
            <i data-lucide="user-check"
               style="width:14px;height:14px;color:var(--accent);"></i>
            ${StringUtils.sanitize(event.event_chair || '—')}
          </div>
        </div>
        ${event.description ? `
        <div style="padding:0 24px 14px;">
          <p style="font-size:0.84rem;color:var(--text-secondary);
                    line-height:1.7;">
            ${StringUtils.truncate(
                StringUtils.sanitize(event.description || ''), 300)}
          </p>
        </div>` : ''}
      </div>`;
  }

  /* ============================================================
     HELPER
     ============================================================ */
  showFormMsg(el, message, type) {
    if (el) {
      el.textContent = message;
      el.className   = `form-message ${type}`;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

/* ============================================================
   EVENTS ADMIN STYLES
   ============================================================ */
const eventsAdminStyles = `/* styles now live in styles.css */`;

/* ============================================================
   INJECT EVENTS ADMIN STYLES
   ============================================================ */
(function injectEventsAdminStyles() {
  if (!document.getElementById('events-admin-styles')) {
    const style       = document.createElement('style');
    style.id          = 'events-admin-styles';
    style.textContent = eventsAdminStyles;
    document.head.appendChild(style);
  }
})();

/* ============================================================
   GLOBAL INSTANCE
   ============================================================ */
const eventsAdmin  = new EventsAdminManager();
window.eventsAdmin = eventsAdmin;