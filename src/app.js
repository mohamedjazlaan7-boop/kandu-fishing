const $ = s => document.querySelector(s);
const PRESETS = [
  { id: 'male', name: 'Malé', lat: 4.1755, lon: 73.5093 },
  { id: 'maaungoodhoo', name: 'Sh. Maaungoodhoo', lat: 6.0694, lon: 73.2811 },
  { id: 'maafushi', name: 'K. Maafushi', lat: 3.9426, lon: 73.4906 },
  { id: 'dhidhdhoo', name: 'HA. Dhidhdhoo', lat: 6.8875, lon: 73.1139 },
  { id: 'fuvahmulah', name: 'Fuvahmulah', lat: -0.2989, lon: 73.4245 },
  { id: 'addu', name: 'Addu City', lat: -0.6153, lon: 73.0828 },
];
const SPOT_TYPES = {
  kandu: { label: 'Kandu (channel)', short: 'Kandu', tip: 'Fish the strongest flow. An incoming tide pushes clear ocean water and bait through the channel mouth.' },
  thila: { label: 'Thila (pinnacle)', short: 'Thila', tip: 'Needs moving water. Work the up-current side and drift over the top.' },
  giri: { label: 'Giri (coral head)', short: 'Giri', tip: 'Best on a rising tide when water covers the top. Cast around the edges at dawn and dusk.' },
  faru: { label: 'Faru (outer reef)', short: 'Faru', tip: 'Rising tide around dawn and dusk. Troll or cast along the edge.' },
  dropoff: { label: 'Drop-off', short: 'Drop-off', tip: 'Less tide-dependent. Deep bottom fishing is best at night and on major periods.' },
  lagoon: { label: 'Lagoon', short: 'Lagoon', tip: 'Fish around high tide. Many spots are too shallow at low water.' },
  harbour: { label: 'Harbour or jetty', short: 'Harbour', tip: 'Night fishing under lights, around high tide.' },
  ocean: { label: 'Open ocean or FAD', short: 'Ocean', tip: 'Troll early morning. Birds and bait matter more than tide.' },
};
const SPECIES = ['Yellowfin tuna', 'Skipjack tuna', 'Dogtooth tuna', 'Wahoo', 'Mahi-mahi', 'Sailfish', 'Giant trevally', 'Bluefin trevally', 'Rainbow runner', 'Barracuda', 'Red snapper', 'Bohar snapper', 'Green jobfish', 'Grouper', 'Emperor', 'Squirrelfish'];
const METHODS = ['Handline', 'Bottom fishing', 'Jigging', 'Popping', 'Trolling', 'Casting', 'Fly'];

const STANDALONE = !(window.claude && typeof window.claude.use === 'function');
const CAN_GPS = STANDALONE && 'geolocation' in navigator && window.isSecureContext;
function getPosition() {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
    e => reject(e), { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }));
}
function gpsButton(onFix, hintEl) {
  if (!CAN_GPS) return null;
  const b = h('button', { class: 'btn btn-sm quiet', type: 'button', text: 'Use my current position' });
  b.addEventListener('click', async () => {
    b.disabled = true; b.textContent = 'Getting GPS fix…';
    try {
      const p = await getPosition();
      onFix(p);
      if (hintEl) { hintEl.textContent = `${fmtCoord(p.lat, p.lon)} · accurate to about ${Math.round(p.acc)} m`; hintEl.className = 'hint ok'; }
    } catch (e) {
      if (hintEl) { hintEl.textContent = e && e.code === 1 ? 'Location permission is off. Allow it for this app in your phone settings, or paste coordinates.' : 'No GPS fix yet. Move to open sky and try again, or paste coordinates.'; hintEl.className = 'hint err'; }
    } finally { b.disabled = false; b.textContent = 'Use my current position'; }
  });
  return b;
}
const S = { tab: 'today', day: mvDayStart(Date.now()), loc: loadLoc(), spots: [], catches: [], ready: false, mode: 'local' };

/* ---------- small helpers ---------- */
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function loadLoc() {
  const v = lsGet('kandu.loc');
  if (v && isFinite(v.lat) && isFinite(v.lon) && v.name) return v;
  return PRESETS[0];
}
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600);
}
function fmtCoord(lat, lon) {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
}
function parseCoords(s) {
  if (!s) return null;
  s = String(s).trim();
  const ok = (a, b) => (isFinite(a) && isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180) ? { lat: a, lon: b } : null;
  let m = s.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) || s.match(/[?&](?:q|ll|query|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || s.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) return ok(+m[1], +m[2]);
  const dms = [...s.matchAll(/(\d+(?:\.\d+)?)\s*°\s*(?:(\d+(?:\.\d+)?)\s*['′]\s*)?(?:(\d+(?:\.\d+)?)\s*(?:"|″|'')\s*)?([NSEW])/gi)];
  if (dms.length >= 2) {
    let lat = null, lon = null;
    for (const p of dms) {
      let v = +p[1] + (+p[2] || 0) / 60 + (+p[3] || 0) / 3600;
      const hemi = p[4].toUpperCase();
      if (hemi === 'S' || hemi === 'W') v = -v;
      if (hemi === 'N' || hemi === 'S') lat = v; else lon = v;
    }
    if (lat != null && lon != null) return ok(lat, lon);
  }
  m = s.match(/(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?[\s,;]+(-?\d+(?:\.\d+)?)\s*°?\s*([EW])?/i);
  if (m) {
    let lat = +m[1], lon = +m[3];
    if (m[2] && /s/i.test(m[2])) lat = -Math.abs(lat);
    if (m[4] && /w/i.test(m[4])) lon = -Math.abs(lon);
    return ok(lat, lon);
  }
  return null;
}
function distBearing(a, b) {
  const R = 6371, p1 = a.lat * RAD, p2 = b.lat * RAD, dp = (b.lat - a.lat) * RAD, dl = (b.lon - a.lon) * RAD;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const km = 2 * R * Math.asin(Math.sqrt(x));
  const y = Math.sin(dl) * Math.cos(p2), xx = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  const brg = (Math.atan2(y, xx) / RAD + 360) % 360;
  const pts = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return { km, nm: km / 1.852, brg, pt: pts[Math.round(brg / 22.5) % 16] };
}
function fmtDist(d) {
  const km = d.km < 10 ? d.km.toFixed(1) : Math.round(d.km);
  const nm = d.nm < 10 ? d.nm.toFixed(1) : Math.round(d.nm);
  return `${km} km · ${nm} nm · ${Math.round(d.brg)}° ${d.pt}`;
}
function moonGlyph(phase, size, title) {
  const r = size / 2 - 1, c = size / 2, k = Math.cos(2 * Math.PI * phase), waxing = phase < 0.5;
  const rx = Math.max(0.01, Math.abs(k) * r).toFixed(2);
  const limb = waxing ? 1 : 0;
  const term = waxing ? (k > 0 ? 0 : 1) : (k < 0 ? 0 : 1);
  const lit = `M${c} ${c - r} A${r} ${r} 0 0 ${limb} ${c} ${c + r} A${rx} ${r} 0 0 ${term} ${c} ${c - r}Z`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${title || ''}"><circle cx="${c}" cy="${c}" r="${r}" fill="var(--moon-dark)" stroke="var(--muted)" stroke-width="1"/><path d="${lit}" fill="var(--moon-lit)"/></svg>`;
}
const isToday = day => day === mvDayStart(Date.now());
function dayOffsetLabel(day) {
  const diff = Math.round((day - mvDayStart(Date.now())) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
}
function currentAnalysis() { return analyze(S.day, S.loc.lat, S.loc.lon); }

/* ---------- Today ---------- */
function renderToday() {
  const A = currentAnalysis();
  $('#locName').textContent = S.loc.name;
  $('#dateLabel').replaceChildren(h('span', { text: fmtDate(S.day) }), h('small', { text: dayOffsetLabel(S.day) }));
  $('#todayBtn').setAttribute('aria-pressed', String(isToday(S.day)));

  // Rating
  const pips = h('div', { class: 'pips', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5].map(i => h('i', { class: i <= A.stars ? 'on' : '' })));
  $('#rating').replaceChildren(
    h('div', { class: 'rating-num', 'aria-label': `Bite rating ${A.stars} out of 5` }, String(A.stars), h('small', { text: '/5' })),
    h('div', { class: 'rating-meta' }, h('span', { class: 'eyebrow', text: 'Bite rating' }), h('span', { class: 'rating-label', text: A.label }), pips),
    h('p', { text: A.summary })
  );

  renderNow(A);
  renderChart(A);

  // Windows
  const wl = $('#windows');
  if (!A.wins.length) wl.replaceChildren(h('li', {}, h('div', { class: 'win-time', text: '—' }), h('p', { class: 'fine', text: 'No standout windows today. Fish the tide changes.' })));
  else wl.replaceChildren(...A.wins.map(w => h('li', {},
    h('div', { class: 'win-time' }, `${fmtTime(w.start)}–${fmtTime(w.end === S.day + DAY ? w.end - 1 : w.end)}`, h('small', { class: 'grade-' + w.grade, text: w.grade })),
    h('div', { class: 'chips' }, w.why.map(x => h('span', { class: 'chip', text: x })))
  )));

  // Tides
  $('#tideRange').textContent = `range ${A.tide.range.toFixed(2)} m`;
  $('#tideNote').textContent = `${A.tide.source.text}. Times are usually within 10–20 minutes of published tide tables; local reef and channel effects can shift them a little more.`;
  $('#tideList').replaceChildren(...A.tide.ext.map(e => h('li', {},
    h('span', { class: 't-type ' + e.type, text: e.type }),
    h('span', { class: 'mono', text: fmtTime(e.t) }),
    h('span', { class: 'mono', text: e.h.toFixed(2) + ' m' })
  )));

  // Sky
  const ph = A.ph, age = A.age;
  $('#phaseRow').innerHTML = moonGlyph(ph.phase, 40, phaseName(ph.phase));
  $('#phaseRow').append(h('div', {}, h('b', { text: phaseName(ph.phase) }), h('span', { class: 'fine', text: `${Math.round(ph.fraction * 100)}% lit · day ${Math.floor(age) + 1} of 29.5` })));
  const sk = A.sky, t = x => x ? fmtTime(x) : 'none today';
  const rows = [['Sunrise', sk.sunrise], ['Sunset', sk.sunset], ['Moonrise', sk.moonrise], ['Moonset', sk.moonset], ['Moon overhead', sk.overhead], ['Moon underfoot', sk.underfoot]];
  $('#skyList').replaceChildren(...rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: t(v) })]));

  renderWeek();
  $('#windyLink').href = `https://www.windy.com/?${S.loc.lat.toFixed(3)},${S.loc.lon.toFixed(3)},9`;
  renderPlanArea();
}

function renderNow(A) {
  const el = $('#nowCard');
  if (!isToday(S.day)) { el.hidden = true; return; }
  const now = Date.now(), ts = tideStageAt(now, S.loc.lat);
  const parts = [h('b', { text: 'Now ' + fmtTime(now) }), h('span', { text: `${ts.stage} tide, ${ts.h.toFixed(2)} m` })];
  if (ts.next) parts.push(h('span', { text: `${ts.next.type} at ${fmtTime(ts.next.t)} (${ts.next.h.toFixed(2)} m)` }));
  const nextWin = A.wins.find(w => w.end > now);
  if (nextWin) parts.push(h('span', { text: nextWin.start <= now ? `In a ${nextWin.grade.toLowerCase()} window until ${fmtTime(nextWin.end)}` : `Next window ${fmtTime(nextWin.start)}` }));
  else parts.push(h('span', { text: 'No more windows today' }));
  el.replaceChildren(...parts);
  el.hidden = false;
}

function renderChart(A) {
  const host = $('#chart');
  const W = Math.max(300, Math.round(host.clientWidth || 600)), H = 236;
  const L = 40, R = 8, pw = W - L - R;
  const day = A.day, x = t => L + clamp((t - day) / DAY, 0, 1) * pw;
  const solTop = 6, solH = 18, tTop = 32, tBot = 152, bTop = 162, bBot = 200, axY = 216;
  const span = Math.max(0.2, A.tide.max - A.tide.min);
  const lo = A.tide.min - 0.32 * span, hi = A.tide.max + 0.3 * span;
  const y = v => tBot - (v - lo) / (hi - lo) * (tBot - tTop);
  const out = [];
  out.push(`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`);
  out.push(`<rect class="c-plot" x="${L}" y="${solTop}" width="${pw}" height="${bBot - solTop}"/>`);
  const sk = A.sky;
  if (sk.sunrise) out.push(`<rect class="c-night" x="${L}" y="${solTop}" width="${(x(sk.sunrise) - L).toFixed(1)}" height="${bBot - solTop}"/>`);
  if (sk.sunset) out.push(`<rect class="c-night" x="${x(sk.sunset).toFixed(1)}" y="${solTop}" width="${(L + pw - x(sk.sunset)).toFixed(1)}" height="${bBot - solTop}"/>`);
  const step = pw < 420 ? 6 : 3;
  for (let hr = 0; hr <= 24; hr += step) {
    const gx = (L + hr / 24 * pw).toFixed(1);
    out.push(`<line class="c-grid" x1="${gx}" x2="${gx}" y1="${tTop}" y2="${bBot}"/>`);
    out.push(`<text class="c-lbl" x="${gx}" y="${axY}" text-anchor="${hr === 0 ? 'start' : hr === 24 ? 'end' : 'middle'}">${pad(hr % 24 === 0 && hr ? 24 : hr)}</text>`);
  }
  // tide area
  const pts = A.tide.curve.map(([t, v]) => `${x(t).toFixed(1)},${y(v).toFixed(1)}`);
  out.push(`<path class="c-tide" d="M${L},${tBot} L${pts.join(' L')} L${L + pw},${tBot} Z"/>`);
  out.push(`<path class="c-tide-line" d="M${pts.join(' L')}"/>`);
  for (const e of A.tide.ext) {
    const ex = x(e.t), ey = y(e.h);
    out.push(`<circle class="c-dot" cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.5"/>`);
    const lx = clamp(ex, L + 30, L + pw - 30);
    const ly = e.type === 'High' ? ey - 9 : ey + 17;
    out.push(`<text class="c-val" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle">${fmtTime(e.t)} ${e.h.toFixed(2)}</text>`);
  }
  // solunar bands
  for (const p of sk.periods) {
    const x0 = x(p.start), x1 = x(p.end), w = x1 - x0;
    if (w <= 0.5) continue;
    out.push(`<rect class="${p.kind === 'major' ? 'c-major' : 'c-minor'}" x="${x0.toFixed(1)}" y="${solTop + (p.kind === 'major' ? 0 : 3)}" width="${w.toFixed(1)}" height="${p.kind === 'major' ? solH : solH - 6}" rx="3"/>`);
    if (w > 40) out.push(`<text class="${p.kind === 'major' ? 'c-band-major' : 'c-band-minor'}" x="${((x0 + x1) / 2).toFixed(1)}" y="${solTop + 13}" text-anchor="middle">${p.kind === 'major' ? 'Major' : 'Minor'}</text>`);
  }
  // bite bars
  const bw = pw / 24;
  for (let hr = 0; hr < 24; hr++) {
    const s = A.slots.slice(hr * 4, hr * 4 + 4), v = Math.max(...s.map(z => z.score));
    const t0 = day + hr * HOUR, t1 = t0 + HOUR;
    const hot = A.wins.some(w => w.start < t1 && w.end > t0);
    const bh = Math.max(2, v / 100 * (bBot - bTop));
    out.push(`<rect class="${hot ? 'c-bar-hot' : 'c-bar'}" x="${(L + hr * bw + 1).toFixed(1)}" y="${(bBot - bh).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5"/>`);
  }
  out.push(`<line class="c-grid" x1="${L}" x2="${L + pw}" y1="${bBot}" y2="${bBot}"/>`);
  // row labels
  out.push(`<text class="c-lbl" x="${L - 6}" y="${solTop + 13}" text-anchor="end">Moon</text>`);
  out.push(`<text class="c-lbl" x="${L - 6}" y="${(tTop + tBot) / 2 + 4}" text-anchor="end">Tide</text>`);
  out.push(`<text class="c-lbl" x="${L - 6}" y="${bTop + 24}" text-anchor="end">Bite</text>`);
  // now line
  if (isToday(day)) {
    const nx = x(Date.now()).toFixed(1);
    out.push(`<line class="c-now" x1="${nx}" x2="${nx}" y1="${solTop}" y2="${bBot + 4}"/>`);
    out.push(`<text class="c-now-lbl" x="${nx}" y="${H - 6}" text-anchor="middle">Now</text>`);
  }
  out.push('</svg>');
  host.innerHTML = out.join('');
}

function renderWeek() {
  const today = mvDayStart(Date.now());
  const offset = Math.floor((S.day - today) / DAY / 7) * 7;
  const start = today + offset * DAY;
  const wk = $('#week');
  wk.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
    const d = start + i * DAY, A = analyze(d, S.loc.lat, S.loc.lon), p = mvParts(d);
    const btn = h('button', { class: 'day-btn', type: 'button', 'aria-label': `${fmtDate(d)}, rating ${A.stars} of 5`, onclick: () => { S.day = d; renderToday(); } },
      h('span', { class: 'dn', text: WD[p.wd] }),
      h('span', { class: 'dd', text: String(p.d) }),
      h('span', { html: moonGlyph(A.ph.phase, 18, phaseName(A.ph.phase)) }),
      h('span', { class: 'mini-pips', 'aria-hidden': 'true' }, [1, 2, 3, 4, 5].map(k => h('i', { class: k <= A.stars ? 'on' : '' })))
    );
    if (d === S.day) btn.setAttribute('aria-current', 'date');
    return btn;
  }));
}

/* ---------- Trip plan (Claude) ---------- */
let sampleFn = null, planCtl = null;
function renderPlanArea() { $('#planArea').hidden = !sampleFn; }
function planPrompt() {
  const A = currentAnalysis(), sk = A.sky;
  const lines = [];
  lines.push(`You are an experienced Maldivian fishing guide. Plan a fishing trip for ${fmtDate(S.day)} near ${S.loc.name} (${fmtCoord(S.loc.lat, S.loc.lon)}). Use only the conditions below. You have no live weather data.`);
  lines.push('', 'Conditions (Maldives time, UTC+5):');
  lines.push(`- Bite rating ${A.stars}/5 (${A.label}). ${A.summary}`);
  lines.push(`- Moon: ${phaseName(A.ph.phase)}, ${Math.round(A.ph.fraction * 100)}% lit.`);
  lines.push(`- Sunrise ${sk.sunrise ? fmtTime(sk.sunrise) : 'n/a'}, sunset ${sk.sunset ? fmtTime(sk.sunset) : 'n/a'}.`);
  lines.push(`- Tides (Malé prediction): ${A.tide.ext.map(e => `${e.type} ${fmtTime(e.t)} ${e.h.toFixed(2)} m`).join('; ')}.`);
  lines.push(`- Solunar periods: ${sk.periods.map(p => `${p.kind} ${fmtTime(p.start)}-${fmtTime(p.end)} (${p.label} ${fmtTime(p.at)})`).join('; ') || 'none'}.`);
  lines.push(`- Best windows by score: ${A.wins.map(w => `${fmtTime(w.start)}-${fmtTime(w.end)} ${w.grade} (${w.why.join(', ')})`).join('; ') || 'none'}.`);
  lines.push('', 'The angler\'s saved spots:');
  if (S.spots.length) for (const s of S.spots.slice(0, 15)) {
    const d = distBearing(S.loc, s);
    lines.push(`- ${s.name}: ${SPOT_TYPES[s.type]?.label || s.type}${s.depth ? `, ${s.depth} m deep` : ''}, ${d.km.toFixed(1)} km ${d.pt} of ${S.loc.name}${s.notes ? `. Notes: ${String(s.notes).slice(0, 160)}` : ''}`);
  } else lines.push('- None saved yet. Suggest spot types (kandu, thila, faru edge, drop-off) instead of named places.');
  if (S.catches.length) {
    const st = catchStats();
    lines.push('', `Catch history: ${S.catches.length} catches. Top species: ${st.topSpecies}. Most catches on: ${st.bestTide} tide.`);
  }
  lines.push('', 'Write a short plan of at most 170 words. Use exactly these four headings, each on its own line: When, Where, How, Safety. Plain text only, no markdown symbols. Match spots to the windows and tide direction, suggest methods and bait that suit Maldivian reef and pelagic fishing, and remind the angler to check wind and swell before going out.');
  return lines.join('\n');
}
function renderPlanText(text) {
  const out = $('#planOut');
  out.hidden = false;
  const lines = String(text).replace(/[*#_`]/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  out.replaceChildren(...lines.map(l => {
    const m = l.match(/^(When|Where|How|Safety)\s*:?\s*(.*)$/i);
    if (m) return [h('div', { class: 'ph', text: m[1] }), m[2] ? h('p', { text: m[2] }) : null];
    return h('p', { text: l });
  }).flat().filter(Boolean));
}
async function askPlan() {
  if (!sampleFn) return;
  const btn = $('#planBtn'), stop = $('#planStop'), out = $('#planOut');
  btn.disabled = true; stop.hidden = false;
  out.hidden = false; out.replaceChildren(h('p', { class: 'fine', text: 'Thinking…' }));
  planCtl = new AbortController();
  try {
    const { text, truncated } = await sampleFn(planPrompt(), { signal: planCtl.signal, onText: ({ text }) => renderPlanText(text) });
    renderPlanText(text);
    if (truncated) out.append(h('p', { class: 'fine', text: 'The plan was cut short. Ask again for a shorter version.' }));
  } catch (e) {
    const code = e && e.code;
    if (code === 'cancelled') { if (e.text) renderPlanText(e.text); else out.hidden = true; }
    else if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) { sampleFn = null; out.hidden = true; renderPlanArea(); }
    else {
      if (e && e.text && code !== 'refused') renderPlanText(e.text); else out.replaceChildren();
      out.append(h('p', { class: 'fine', text: code === 'rate_limited' ? 'Claude is busy or your usage limit is reached. Try again later.' : code === 'session_expired' ? 'Sign in to Claude again, then try once more.' : 'The plan didn\'t finish. Tap the button to try again.' }));
    }
  } finally {
    btn.disabled = false; stop.hidden = true; planCtl = null;
  }
}

/* ---------- Storage ---------- */
const Store = {
  db: null,
  async init() {
    let db = null, user = null;
    try {
      if (window.claude && typeof window.claude.use === 'function') {
        [db, user] = await Promise.all([window.claude.use('db').catch(() => null), window.claude.use('user').catch(() => null)]);
      }
    } catch (e) { db = null; }
    let owner = false;
    try { owner = user ? await user.isOwner() : false; } catch (e) { owner = false; }
    if (db && owner) { this.db = db; S.mode = 'cloud'; this.subscribe(); }
    else this.useLocal();
  },
  useLocal(reason) {
    this.db = null; S.mode = 'local';
    S.spots = lsGet('kandu.spots') || [];
    S.catches = lsGet('kandu.catches') || [];
    S.catches.sort((a, b) => b.at - a.at);
    S.ready = true;
    if (reason) toast(reason);
    renderSpots(); renderLog();
  },
  subscribe() {
    const seen = { spots: false, catches: false };
    let failed = false;
    const fail = () => { if (failed) return; failed = true; this.useLocal('Couldn\'t reach your saved data. Saving in this browser for now.'); };
    const after = kind => {
      if (failed) return;
      seen[kind] = true;
      if (seen.spots && seen.catches) { S.ready = true; renderSpots(); renderLog(); }
    };
    this.db.collection('spots').onSnapshot(snap => {
      S.spots = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      after('spots');
    }, fail);
    this.db.collection('catches').onSnapshot(snap => {
      S.catches = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at);
      after('catches');
    }, fail);
  },
  async add(kind, data) {
    data.createdAt = Date.now();
    if (this.db) {
      try { await this.db.collection(kind).doc().set(data); return true; }
      catch (e) { toast(e && e.code === 'quota_exceeded' ? 'Storage is full. Delete some old entries first.' : 'Couldn\'t save. Check your connection and try again.'); return false; }
    }
    const list = kind === 'spots' ? S.spots : S.catches;
    list.push({ id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...data });
    if (kind === 'catches') S.catches.sort((a, b) => b.at - a.at);
    if (!lsSet('kandu.' + kind, list)) toast('Saved for this visit only. This browser blocks storage.');
    kind === 'spots' ? (renderSpots(), renderLog()) : renderLog();
    return true;
  },
  async remove(kind, id) {
    if (this.db) {
      try { await this.db.collection(kind).doc(id).delete(); return true; }
      catch (e) { toast('Couldn\'t delete. Try again.'); return false; }
    }
    if (kind === 'spots') S.spots = S.spots.filter(s => s.id !== id); else S.catches = S.catches.filter(c => c.id !== id);
    lsSet('kandu.' + kind, kind === 'spots' ? S.spots : S.catches);
    kind === 'spots' ? (renderSpots(), renderLog()) : renderLog();
    return true;
  },
};
function storageNote(el) {
  if (!S.ready) return;
  el.classList.toggle('local', S.mode !== 'cloud');
  el.textContent = S.mode === 'cloud' ? 'Private to you and synced across your devices.' : 'Saved in this browser only.';
}

/* ---------- Spots ---------- */
function confirmButton(label, onConfirm) {
  const b = h('button', { class: 'btn btn-sm quiet', type: 'button', text: label });
  let armed = false, timer;
  b.addEventListener('click', async () => {
    if (!armed) { armed = true; b.textContent = 'Tap again to delete'; b.className = 'btn btn-sm danger'; timer = setTimeout(() => { armed = false; b.textContent = label; b.className = 'btn btn-sm quiet'; }, 3500); return; }
    clearTimeout(timer); b.disabled = true; await onConfirm(); b.disabled = false;
  });
  return b;
}
function renderSpots() {
  storageNote($('#spotsNote'));
  const list = $('#spotList');
  if (!S.ready) { list.replaceChildren(); $('#spotMapCard').hidden = true; return; }
  if (!S.spots.length) {
    $('#spotMapCard').hidden = true;
    list.replaceChildren(h('div', { class: 'empty' },
      h('h3', { text: 'No spots saved yet' }),
      h('p', { text: 'Save your kandu mouths, thilas and reef edges with GPS coordinates. Paste them from Google Maps or read them off your GPS. Each spot shows its distance and bearing from your base and the tide that suits it.' }),
      h('button', { class: 'btn btn-sm', type: 'button', text: 'Add your first spot', onclick: () => openSpotForm() })));
    return;
  }
  renderSpotMap();
  list.replaceChildren(...S.spots.map(s => {
    const ty = SPOT_TYPES[s.type] || { label: s.type, short: s.type, tip: '' };
    const d = distBearing(S.loc, s);
    const count = S.catches.filter(c => c.spotId === s.id).length;
    return h('article', { class: 'item' },
      h('div', { class: 'item-top' }, h('span', { class: 'item-title', text: s.name }), h('span', { class: 'badge', text: ty.short })),
      h('div', { class: 'meta' }, h('span', { class: 'mono', text: fmtCoord(s.lat, s.lon) }), s.depth ? h('span', { text: `${s.depth} m deep` }) : null, h('span', { text: count ? `${count} catch${count === 1 ? '' : 'es'}` : 'No catches yet' })),
      h('div', { class: 'meta' }, h('span', { text: `From ${S.loc.name}: ${fmtDist(d)}` })),
      s.notes ? h('p', { text: s.notes }) : null,
      ty.tip ? h('div', { class: 'tip' }, h('b', { text: 'Tide tip: ' }), ty.tip) : null,
      h('div', { class: 'row' },
        h('a', { class: 'link-btn', href: `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`, target: '_blank', rel: 'noopener', text: 'Open in Maps' }),
        h('button', { class: 'btn btn-sm quiet', type: 'button', text: 'Log a catch here', onclick: () => openCatchForm(s.id) }),
        confirmButton('Delete', () => Store.remove('spots', s.id)))
    );
  }));
}
function renderSpotMap() {
  const card = $('#spotMapCard'), host = $('#spotMap');
  card.hidden = false;
  const W = Math.max(300, Math.round(host.clientWidth || 600)), H = Math.round(Math.min(320, Math.max(220, W * 0.55)));
  const pts = [{ ...S.loc, home: true }, ...S.spots];
  const lat0 = pts.reduce((a, p) => a + p.lat, 0) / pts.length;
  const kx = Math.cos(lat0 * RAD);
  const xs = pts.map(p => p.lon * kx), ys = pts.map(p => p.lat);
  let minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const padDeg = 0.01;
  if (maxX - minX < padDeg) { minX -= padDeg; maxX += padDeg; }
  if (maxY - minY < padDeg) { minY -= padDeg; maxY += padDeg; }
  const P = 26, sc = Math.min((W - 2 * P) / (maxX - minX), (H - 2 * P - 14) / (maxY - minY));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const px = p => W / 2 + (p.lon * kx - cx) * sc, py = p => (H - 14) / 2 - (p.lat - cy) * sc;
  const o = [`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`];
  for (let i = 1; i < 4; i++) { o.push(`<line class="m-grid" x1="${W * i / 4}" x2="${W * i / 4}" y1="0" y2="${H - 18}"/>`); o.push(`<line class="m-grid" x1="0" x2="${W}" y1="${(H - 18) * i / 4}" y2="${(H - 18) * i / 4}"/>`); }
  // scale bar
  const kmPerUnit = 111.32; const targetPx = W * 0.22; const kmAt = targetPx / sc * kmPerUnit;
  const nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].reduce((a, v) => v <= kmAt ? v : a, 0.1);
  const barPx = nice / kmPerUnit * sc;
  o.push(`<line class="m-scale" x1="12" x2="${(12 + barPx).toFixed(1)}" y1="${H - 8}" y2="${H - 8}"/><text class="m-scale-lbl" x="${(16 + barPx).toFixed(1)}" y="${H - 4}">${nice} km</text>`);
  o.push(`<text class="m-scale-lbl" x="${W - 10}" y="14" text-anchor="end">N ↑</text>`);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  pts.forEach(p => {
    const X = px(p).toFixed(1), Y = py(p).toFixed(1);
    if (p.home) o.push(`<rect class="m-home" x="${X - 5}" y="${Y - 5}" width="10" height="10" rx="2"/>`);
    else o.push(`<circle class="m-spot" cx="${X}" cy="${Y}" r="5"/>`);
    const right = px(p) < W * 0.66;
    const name = p.name.length > 22 ? p.name.slice(0, 21) + '…' : p.name;
    o.push(`<text class="m-lbl" x="${(px(p) + (right ? 9 : -9)).toFixed(1)}" y="${(py(p) + 4).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}">${esc(name)}</text>`);
  });
  o.push('</svg>');
  host.innerHTML = o.join('');
  $('#spotMapSub').textContent = `square = ${S.loc.name}`;
}

/* ---------- Sheets ---------- */
let lastFocus = null;
function openSheet(title, body, focusSel) {
  lastFocus = document.activeElement;
  $('#sheetTitle').textContent = title;
  $('#sheetBody').replaceChildren(body);
  $('#sheetWrap').hidden = false;
  setTimeout(() => { const f = focusSel ? $(focusSel) : $('#sheetClose'); f && f.focus(); }, 30);
}
function closeSheet() { $('#sheetWrap').hidden = true; $('#sheetBody').replaceChildren(); if (lastFocus && lastFocus.focus) lastFocus.focus(); }

function openLocation() {
  const body = h('div', { class: 'form' });
  const list = h('div', { class: 'loc-list' }, PRESETS.map(p => h('button', { class: 'loc-opt', type: 'button', 'aria-pressed': String(S.loc.name === p.name), onclick: () => setLoc(p) },
    h('span', { text: p.name }), h('small', { text: fmtCoord(p.lat, p.lon) }))));
  body.append(h('p', { class: 'fine', text: 'Sun, moon and tide times are worked out for this location. Tides come from the nearest stations: Dhidhdhoo, Naifaru, Malé and Gan.' }), list);
  body.append(h('div', { class: 'h2', text: 'Or set your own' }));
  const name = h('input', { type: 'text', id: 'locNameIn', placeholder: 'e.g. Home island', maxlength: '40' });
  const coord = h('input', { type: 'text', id: 'locCoordIn', placeholder: '6.0694, 73.2811 or a Google Maps link' });
  const hint = h('span', { class: 'hint', text: 'Paste decimal coordinates, degrees-minutes-seconds or a Google Maps link.' });
  coord.addEventListener('input', () => { const c = parseCoords(coord.value); hint.textContent = c ? fmtCoord(c.lat, c.lon) : (coord.value.trim() ? 'Can\'t read those coordinates yet.' : 'Paste decimal coordinates, degrees-minutes-seconds or a Google Maps link.'); hint.className = 'hint ' + (c ? 'ok' : coord.value.trim() ? 'err' : ''); });
  body.append(h('div', { class: 'field' }, h('label', { for: 'locNameIn', text: 'Name' }), name),
    h('div', { class: 'field' }, h('label', { for: 'locCoordIn', text: 'Coordinates' }), coord, hint, gpsButton(p => { coord.value = `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`; if (!name.value.trim()) name.value = 'My location'; }, hint)),
    h('button', { class: 'btn', type: 'button', text: 'Use this location', onclick: () => {
      const c = parseCoords(coord.value);
      if (!c) { hint.textContent = 'Enter coordinates first, for example 6.0694, 73.2811.'; hint.className = 'hint err'; coord.focus(); return; }
      setLoc({ id: 'custom', name: name.value.trim() || 'My location', lat: c.lat, lon: c.lon });
    } }));
  openSheet('Location', body);
}
function setLoc(p) {
  S.loc = { id: p.id, name: p.name, lat: p.lat, lon: p.lon };
  lsSet('kandu.loc', S.loc);
  closeSheet(); renderToday(); renderSpots();
  toast('Location set to ' + p.name);
}

function openSpotForm() {
  const f = h('form', { class: 'form', novalidate: true });
  f.innerHTML = `
    <div class="field"><label for="spName">Name</label><input type="text" id="spName" maxlength="60" placeholder="e.g. North kandu mouth" required></div>
    <div class="field"><label for="spType">Type</label><select id="spType"></select></div>
    <div class="field"><label for="spCoord">Coordinates</label><input type="text" id="spCoord" placeholder="4.1755, 73.5093 or a Google Maps link" required><span class="hint" id="spHint">Paste decimal coordinates, degrees-minutes-seconds or a Google Maps link.</span></div>
    <div class="two"><div class="field"><label for="spDepth">Depth (m)</label><input type="number" id="spDepth" min="0" max="2000" step="1" inputmode="numeric" placeholder="Optional"></div></div>
    <div class="field"><label for="spNotes">Notes</label><textarea id="spNotes" maxlength="500" placeholder="Bait that works, current direction, landmarks"></textarea></div>
    <p class="hint err" id="spErr" hidden></p>
    <button class="btn" type="button" id="spSave">Save spot</button>`;
  const sel = f.querySelector('#spType');
  for (const [k, v] of Object.entries(SPOT_TYPES)) sel.append(h('option', { value: k, text: v.label }));
  const coord = f.querySelector('#spCoord'), hint = f.querySelector('#spHint');
  const gb = gpsButton(p => { coord.value = `${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}`; }, hint);
  if (gb) hint.after(gb);
  coord.addEventListener('input', () => { const c = parseCoords(coord.value); hint.textContent = c ? fmtCoord(c.lat, c.lon) : (coord.value.trim() ? 'Can\'t read those coordinates yet.' : 'Paste decimal coordinates, degrees-minutes-seconds or a Google Maps link.'); hint.className = 'hint ' + (c ? 'ok' : coord.value.trim() ? 'err' : ''); });
  f.addEventListener('submit', ev => ev.preventDefault());
  f.querySelector('#spSave').addEventListener('click', async () => {
    const err = f.querySelector('#spErr');
    const name = f.querySelector('#spName').value.trim(), c = parseCoords(coord.value);
    if (!name) { err.textContent = 'Give the spot a name.'; err.hidden = false; f.querySelector('#spName').focus(); return; }
    if (!c) { err.textContent = 'Add coordinates, for example 4.1755, 73.5093.'; err.hidden = false; coord.focus(); return; }
    const depth = parseFloat(f.querySelector('#spDepth').value);
    const btn = f.querySelector('#spSave'); btn.disabled = true;
    const ok = await Store.add('spots', { name, type: sel.value, lat: +c.lat.toFixed(6), lon: +c.lon.toFixed(6), depth: isFinite(depth) && depth > 0 ? Math.round(depth) : null, notes: f.querySelector('#spNotes').value.trim() });
    btn.disabled = false;
    if (ok) { closeSheet(); toast('Spot saved'); }
  });
  openSheet('Add spot', f, '#spName');
}

function localInputValue(ms) { const p = mvParts(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.mi)}`; }
function conditionsAt(ms, lat, lon) {
  const day = mvDayStart(ms), A = analyze(day, lat, lon), ts = tideStageAt(ms, lat);
  const sol = A.sky.periods.find(p => ms >= p.start && ms <= p.end);
  const ph = moonPhase(ms);
  const slot = A.slots[clamp(Math.floor((ms - day) / (15 * MIN)), 0, 95)];
  return { tide: ts.stage, tideH: +ts.h.toFixed(2), solunar: sol ? sol.kind : 'none', moon: phaseName(ph.phase), moonP: +ph.phase.toFixed(3), bite: Math.round(slot.score) };
}
function openCatchForm(spotId) {
  const f = h('form', { class: 'form', novalidate: true });
  f.innerHTML = `
    <div class="field"><label for="ctSpecies">Species</label><select id="ctSpecies"></select></div>
    <div class="field" id="ctOtherWrap" hidden><label for="ctOther">Species name</label><input type="text" id="ctOther" maxlength="40"></div>
    <div class="two">
      <div class="field"><label for="ctKg">Weight (kg)</label><input type="number" id="ctKg" min="0" max="500" step="0.1" inputmode="decimal" placeholder="Optional"></div>
      <div class="field"><label for="ctCm">Length (cm)</label><input type="number" id="ctCm" min="0" max="500" step="1" inputmode="numeric" placeholder="Optional"></div>
    </div>
    <div class="field"><label for="ctWhen">When (Maldives time)</label><input type="datetime-local" id="ctWhen"></div>
    <div class="field"><label for="ctSpot">Spot</label><select id="ctSpot"></select></div>
    <div class="two">
      <div class="field"><label for="ctMethod">Method</label><select id="ctMethod"></select></div>
      <div class="field"><label for="ctBait">Bait or lure</label><input type="text" id="ctBait" maxlength="40" placeholder="e.g. Squid, jig 200 g"></div>
    </div>
    <label class="check"><input type="checkbox" id="ctReleased"> Released</label>
    <div class="field"><label for="ctNotes">Notes</label><textarea id="ctNotes" maxlength="500"></textarea></div>
    <p class="hint err" id="ctErr" hidden></p>
    <p class="fine">Tide stage, solunar period and moon phase are recorded with the catch automatically.</p>
    <button class="btn" type="button" id="ctSave">Save catch</button>`;
  const sp = f.querySelector('#ctSpecies');
  for (const s of SPECIES) sp.append(h('option', { value: s, text: s }));
  sp.append(h('option', { value: '__other', text: 'Other…' }));
  sp.addEventListener('change', () => { f.querySelector('#ctOtherWrap').hidden = sp.value !== '__other'; });
  const spotSel = f.querySelector('#ctSpot');
  spotSel.append(h('option', { value: '', text: 'No saved spot' }));
  for (const s of S.spots) spotSel.append(h('option', { value: s.id, text: s.name }));
  if (spotId) spotSel.value = spotId;
  const ms = f.querySelector('#ctMethod');
  for (const m of METHODS) ms.append(h('option', { value: m, text: m }));
  f.querySelector('#ctWhen').value = localInputValue(Date.now());
  f.addEventListener('submit', ev => ev.preventDefault());
  f.querySelector('#ctSave').addEventListener('click', async () => {
    const err = f.querySelector('#ctErr');
    const species = sp.value === '__other' ? f.querySelector('#ctOther').value.trim() : sp.value;
    if (!species) { err.textContent = 'Enter the species name.'; err.hidden = false; f.querySelector('#ctOther').focus(); return; }
    const wv = f.querySelector('#ctWhen').value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!wv) { err.textContent = 'Set the date and time of the catch.'; err.hidden = false; return; }
    const at = mvMs(+wv[1], +wv[2], +wv[3], +wv[4], +wv[5]);
    const spot = S.spots.find(s => s.id === spotSel.value);
    const where = spot || S.loc;
    const kg = parseFloat(f.querySelector('#ctKg').value), cm = parseFloat(f.querySelector('#ctCm').value);
    const btn = f.querySelector('#ctSave'); btn.disabled = true;
    const ok = await Store.add('catches', {
      species, at, kg: isFinite(kg) && kg > 0 ? +kg.toFixed(1) : null, cm: isFinite(cm) && cm > 0 ? Math.round(cm) : null,
      spotId: spot ? spot.id : null, spotName: spot ? spot.name : null, method: ms.value, bait: f.querySelector('#ctBait').value.trim(),
      released: f.querySelector('#ctReleased').checked, notes: f.querySelector('#ctNotes').value.trim(),
      cond: conditionsAt(at, where.lat, where.lon),
    });
    btn.disabled = false;
    if (ok) { closeSheet(); toast('Catch logged'); }
  });
  openSheet('Log a catch', f, '#ctSpecies');
}

/* ---------- Log ---------- */
function topOf(arr) {
  const m = new Map(); for (const v of arr) if (v) m.set(v, (m.get(v) || 0) + 1);
  let best = null, n = 0; for (const [k, c] of m) if (c > n) { best = k; n = c; }
  return { key: best, n };
}
function catchStats() {
  const C = S.catches;
  const kg = C.reduce((a, c) => a + (c.kg || 0), 0);
  const sp = topOf(C.map(c => c.species));
  const td = topOf(C.map(c => c.cond && c.cond.tide));
  const inSol = C.filter(c => c.cond && c.cond.solunar !== 'none').length;
  return { kg, topSpecies: sp.key ? `${sp.key} (${sp.n})` : '—', bestTide: td.key ? `${td.key.toLowerCase()} (${td.n})` : '—', inSol };
}
function renderBackup() {
  const card = $('#backupCard');
  if (!card) return;
  card.hidden = !(STANDALONE && S.ready && S.mode !== 'cloud');
}
function exportBackup() {
  const data = { app: 'kandu', version: 1, exportedAt: new Date().toISOString(), location: S.loc, spots: S.spots, catches: S.catches };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const p = mvParts(Date.now()), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `kandu-backup-${p.y}-${pad(p.m)}-${pad(p.d)}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(`Backup saved: ${S.spots.length} spots, ${S.catches.length} catches`);
}
function importBackup(file) {
  const r = new FileReader();
  r.onload = () => {
    let d;
    try { d = JSON.parse(r.result); } catch (e) { toast('That file isn\'t a Kandu backup.'); return; }
    if (!d || d.app !== 'kandu' || !Array.isArray(d.spots) || !Array.isArray(d.catches)) { toast('That file isn\'t a Kandu backup.'); return; }
    const haveS = new Set(S.spots.map(s => s.id)), haveC = new Set(S.catches.map(c => c.id));
    const ns = d.spots.filter(s => s && s.id && !haveS.has(s.id) && isFinite(s.lat) && isFinite(s.lon) && s.name);
    const nc = d.catches.filter(c => c && c.id && !haveC.has(c.id) && isFinite(c.at) && c.species);
    S.spots.push(...ns); S.catches.push(...nc); S.catches.sort((a, b) => b.at - a.at);
    lsSet('kandu.spots', S.spots); lsSet('kandu.catches', S.catches);
    renderSpots(); renderLog();
    toast(`Restored ${ns.length} spots and ${nc.length} catches`);
  };
  r.readAsText(file);
}
function renderLog() {
  storageNote($('#logNote'));
  renderBackup();
  const list = $('#catchList');
  if (!S.ready) { list.replaceChildren(); $('#statsCard').hidden = true; return; }
  if (!S.catches.length) {
    $('#statsCard').hidden = true;
    list.replaceChildren(h('div', { class: 'empty' },
      h('h3', { text: 'No catches logged yet' }),
      h('p', { text: 'Log each fish with its spot and method. Kandu records the tide stage, solunar period and moon phase at that moment, so after a few trips you can see which conditions work for you.' }),
      h('button', { class: 'btn btn-sm', type: 'button', text: 'Log your first catch', onclick: () => openCatchForm() })));
    return;
  }
  const st = catchStats(), C = S.catches;
  $('#statsCard').hidden = false;
  const stat = (v, l) => h('div', { class: 'stat' }, h('b', { text: v }), h('span', { text: l }));
  $('#stats').replaceChildren(
    stat(String(C.length), 'catches'),
    stat(st.kg ? `${st.kg.toFixed(1)} kg` : '—', 'total weight'),
    stat(st.topSpecies, 'top species'),
    stat(C.length >= 3 ? st.bestTide : 'Need 3+', 'best tide stage'),
    stat(`${st.inSol} of ${C.length}`, 'in a solunar period'));
  list.replaceChildren(...C.map(c => {
    const spot = c.spotId && S.spots.find(s => s.id === c.spotId);
    const size = [c.kg ? `${c.kg} kg` : null, c.cm ? `${c.cm} cm` : null].filter(Boolean).join(' · ');
    const cd = c.cond || {};
    return h('article', { class: 'item' },
      h('div', { class: 'item-top' }, h('span', { class: 'item-title', text: c.species }), size ? h('span', { class: 'mono', text: size }) : null),
      h('div', { class: 'meta' }, h('span', { class: 'mono', text: `${fmtDate(c.at)} ${fmtTime(c.at)}` }), h('span', { text: spot ? spot.name : (c.spotName || 'No spot') }), c.method ? h('span', { text: c.method }) : null, c.bait ? h('span', { text: c.bait }) : null, c.released ? h('span', { text: 'Released' }) : null),
      h('div', { class: 'chips' },
        cd.tide ? h('span', { class: 'chip', text: `${cd.tide} tide` }) : null,
        cd.solunar && cd.solunar !== 'none' ? h('span', { class: 'chip', text: `${cd.solunar[0].toUpperCase()}${cd.solunar.slice(1)} period` }) : null,
        cd.moon ? h('span', { class: 'chip', text: cd.moon }) : null),
      c.notes ? h('p', { text: c.notes }) : null,
      h('div', { class: 'row' }, confirmButton('Delete', () => Store.remove('catches', c.id))));
  }));
}

/* ---------- Tabs and wiring ---------- */
function setTab(t) {
  S.tab = t;
  for (const b of document.querySelectorAll('.tab-btn')) b.setAttribute('aria-selected', String(b.dataset.tab === t));
  for (const id of ['today', 'spots', 'log']) $('#tab-' + id).hidden = id !== t;
  if (t === 'today') renderToday(); else if (t === 'spots') renderSpots(); else renderLog();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('#prevDay').addEventListener('click', () => { S.day -= DAY; renderToday(); });
$('#nextDay').addEventListener('click', () => { S.day += DAY; renderToday(); });
$('#todayBtn').addEventListener('click', () => { S.day = mvDayStart(Date.now()); renderToday(); });
$('#locBtn').addEventListener('click', openLocation);
$('#addSpotBtn').addEventListener('click', () => openSpotForm());
$('#addCatchBtn').addEventListener('click', () => openCatchForm());
$('#sheetClose').addEventListener('click', closeSheet);
$('#sheetWrap').addEventListener('click', e => { if (e.target === $('#sheetWrap')) closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheetWrap').hidden) closeSheet(); });
$('#planBtn').addEventListener('click', askPlan);
$('#planStop').addEventListener('click', () => planCtl && planCtl.abort());
let rzT; window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (S.tab === 'today') renderChart(currentAnalysis()); else if (S.tab === 'spots' && S.spots.length) renderSpotMap(); }, 150); });
setInterval(() => { if (S.tab === 'today' && isToday(S.day)) { const A = currentAnalysis(); renderNow(A); renderChart(A); } }, 60 * 1000);

renderToday();
renderSpots();
renderLog();
Store.init();
if (STANDALONE) {
  const exp = $('#exportBtn'), imp = $('#importFile');
  if (exp) exp.addEventListener('click', exportBackup);
  if (imp) imp.addEventListener('change', () => { if (imp.files[0]) importBackup(imp.files[0]); imp.value = ''; });
  const installed = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const tip = $('#installTip');
  if (tip && !installed && !lsGet('kandu.tipDone')) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    $('#installText').textContent = ios ? 'Open this page in Safari, tap the Share button, then "Add to Home Screen". Kandu then opens like an app and works offline at sea.' : 'Open your browser menu (⋮) and tap "Install app" or "Add to Home screen". Kandu then opens like an app and works offline at sea.';
    tip.hidden = false;
    $('#installDismiss').addEventListener('click', () => { tip.hidden = true; lsSet('kandu.tipDone', true); });
  }
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
  }
}
(async () => {
  try { sampleFn = (window.claude && typeof window.claude.use === 'function') ? await window.claude.use('sample') : null; } catch (e) { sampleFn = null; }
  renderPlanArea();
})();
