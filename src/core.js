/* Kandu core: time helpers, sun and moon positions, tides and bite scoring. Runs in the browser and in Node (for tools/verify.mjs). */
const RAD = Math.PI / 180, DAY = 864e5, HOUR = 36e5, MIN = 6e4, TZ = 5 * HOUR;
function mvParts(ms) { const d = new Date(ms + TZ); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay() }; }
function mvDayStart(ms) { const p = mvParts(ms); return Date.UTC(p.y, p.m - 1, p.d) - TZ; }
function mvMs(y, m, d, h = 0, mi = 0) { return Date.UTC(y, m - 1, d, h, mi) - TZ; }
const pad = n => String(n).padStart(2, '0');
function fmtTime(ms) { const p = mvParts(ms + 30000); return pad(p.h) + ':' + pad(p.mi); }
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(ms) { const p = mvParts(ms); return WD[p.wd] + ' ' + p.d + ' ' + MO[p.m - 1]; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Sun and moon positions: Meeus, Astronomical Algorithms (2nd ed.), ch. 12, 25 and 47.
   Checked against the US Naval Observatory: sunrise/sunset and moonrise/moonset/transit within 1 minute. */
const DT_SEC = 69; // TT - UT, seconds (2026)
function jdUT(ms) { return ms / DAY + 2440587.5; }
const norm360 = x => ((x % 360) + 360) % 360;
function gmst(ms) { const d = jdUT(ms) - 2451545, T = d / 36525; return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - T * T * T / 38710000); }
function centuriesTT(ms) { return (jdUT(ms) + DT_SEC / 86400 - 2451545) / 36525; }
function obliquity(T) { return (23.4392911 - 0.0130042 * T) * RAD; }
function eclToEq(lam, bet, eps) {
  const sl = Math.sin(lam), cl = Math.cos(lam), sb = Math.sin(bet), cb = Math.cos(bet), se = Math.sin(eps), ce = Math.cos(eps);
  return { ra: Math.atan2(sl * ce - Math.tan(bet) * se, cl), dec: Math.asin(sb * ce + cb * se * sl) };
}
function sunCoords(ms) {
  const T = centuriesTT(ms);
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * RAD;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) + (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
  const lam = (L0 + C - 0.00569) * RAD;
  return { lam, ...eclToEq(lam, 0, obliquity(T)) };
}
// Meeus table 47.A: [D, M, M', F, sum_l (1e-6 deg), sum_r (1e-3 km)]
const MOON_LR = [[0,0,1,0,6288774,-20905355],[2,0,-1,0,1274027,-3699111],[2,0,0,0,658314,-2955968],[0,0,2,0,213618,-569925],[0,1,0,0,-185116,48888],[0,0,0,2,-114332,-3149],[2,0,-2,0,58793,246158],[2,-1,-1,0,57066,-152138],[2,0,1,0,53322,-170733],[2,-1,0,0,45758,-204586],[0,1,-1,0,-40923,-129620],[1,0,0,0,-34720,108743],[0,1,1,0,-30383,104755],[2,0,0,-2,15327,10321],[0,0,1,2,-12528,0],[0,0,1,-2,10980,79661],[4,0,-1,0,10675,-34782],[0,0,3,0,10034,-23210],[4,0,-2,0,8548,-21636],[2,1,-1,0,-7888,24208],[2,1,0,0,-6766,30824],[1,0,-1,0,-5163,-8379],[1,1,0,0,4987,-16675],[2,-1,1,0,4036,-12831],[2,0,2,0,3994,-10445],[4,0,0,0,3861,-11650],[2,0,-3,0,3665,14403],[0,1,-2,0,-2689,-7003],[2,0,-1,2,-2602,0],[2,-1,-2,0,2390,10056],[1,0,1,0,-2348,6322],[2,-2,0,0,2236,-9884],[0,1,2,0,-2120,5751],[0,2,0,0,-2069,0],[2,-2,-1,0,2048,-4950],[2,0,1,-2,-1773,4130],[2,0,0,2,-1595,0],[4,-1,-1,0,1215,-3958],[0,0,2,2,-1110,0],[3,0,-1,0,-892,3258],[2,1,1,0,-810,2616],[4,-1,-2,0,759,-1897],[0,2,-1,0,-713,-2117],[2,2,-1,0,-700,2354]];
// Meeus table 47.B: [D, M, M', F, sum_b (1e-6 deg)]
const MOON_B = [[0,0,0,1,5128122],[0,0,1,1,280602],[0,0,1,-1,277693],[2,0,0,-1,173237],[2,0,-1,1,55413],[2,0,-1,-1,46271],[2,0,0,1,32573],[0,0,2,1,17198],[2,0,1,-1,9266],[0,0,2,-1,8822],[2,-1,0,-1,8216],[2,0,-2,-1,4324],[2,0,1,1,4200],[2,1,0,-1,-3359],[2,-1,-1,1,2463],[2,-1,0,1,2211],[2,-1,-1,-1,2065],[0,1,-1,-1,-1870],[4,0,-1,-1,1828],[0,1,0,1,-1794],[0,0,0,3,-1749],[0,1,-1,1,-1565],[1,0,0,1,-1491],[0,1,1,1,-1475],[0,1,1,-1,-1410],[0,1,0,-1,-1344],[1,0,0,-1,-1335],[0,0,3,1,1107],[4,0,0,-1,1021],[4,0,-1,1,833]];
function moonCoords(ms) {
  const T = centuriesTT(ms), T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000);
  const D = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000) * RAD;
  const M = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000) * RAD;
  const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000) * RAD;
  const F = norm360(93.2720950 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000) * RAD;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const A1 = (119.75 + 131.849 * T) * RAD, A2 = (53.09 + 479264.290 * T) * RAD, A3 = (313.45 + 481266.484 * T) * RAD;
  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, l, r] of MOON_LR) {
    const arg = d * D + m * M + mp * Mp + f * F, e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sl += l * e * Math.sin(arg); sr += r * e * Math.cos(arg);
  }
  for (const [d, m, mp, f, b] of MOON_B) {
    const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sb += b * e * Math.sin(d * D + m * M + mp * Mp + f * F);
  }
  const LpR = Lp * RAD;
  sl += 3958 * Math.sin(A1) + 1962 * Math.sin(LpR - F) + 318 * Math.sin(A2);
  sb += -2235 * Math.sin(LpR) + 382 * Math.sin(A3) + 175 * Math.sin(A1 - F) + 175 * Math.sin(A1 + F) + 127 * Math.sin(LpR - Mp) - 115 * Math.sin(LpR + Mp);
  const lam = (Lp + sl / 1e6) * RAD, bet = (sb / 1e6) * RAD, dist = 385000.56 + sr / 1000;
  return { lam, bet, dist, ...eclToEq(lam, bet, obliquity(T)) };
}
function altOf(H, phi, de) { return Math.asin(Math.sin(phi) * Math.sin(de) + Math.cos(phi) * Math.cos(de) * Math.cos(H)); }
function hourAngle(ms, lon, ra) { return gmst(ms) * RAD + lon * RAD - ra; }
function sunAlt(ms, lat, lon) { const c = sunCoords(ms); return altOf(hourAngle(ms, lon, c.ra), lat * RAD, c.dec) / RAD; }
function moonAlt(ms, lat, lon) { const c = moonCoords(ms); return altOf(hourAngle(ms, lon, c.ra), lat * RAD, c.dec) / RAD; }
function moonPhase(ms) {
  const s = sunCoords(ms), m = moonCoords(ms);
  const psi = Math.acos(Math.cos(m.bet) * Math.cos(m.lam - s.lam));
  const i = Math.atan2(149598000 * Math.sin(psi), m.dist - 149598000 * Math.cos(psi));
  const elong = norm360((m.lam - s.lam) / RAD);
  return { fraction: (1 + Math.cos(i)) / 2, phase: elong / 360 };
}
function phaseName(p) {
  if (p < 0.034 || p > 0.966) return 'New moon';
  if (p < 0.216) return 'Waxing crescent';
  if (p < 0.284) return 'First quarter';
  if (p < 0.466) return 'Waxing gibbous';
  if (p < 0.534) return 'Full moon';
  if (p < 0.716) return 'Waning gibbous';
  if (p < 0.784) return 'Last quarter';
  return 'Waning crescent';
}

/* Sky events for one Maldives day: sunrise/sunset, moonrise/moonset, moon overhead/underfoot */
function skyDay(day, lat, lon) {
  const STEP = 10 * MIN, t0 = day - 3 * HOUR, t1 = day + DAY + 3 * HOUR;
  const ts = [], sa = [], ma = [], mh = [];
  for (let t = t0; t <= t1; t += STEP) {
    ts.push(t);
    sa.push(sunAlt(t, lat, lon) + 0.8333);
    const c = moonCoords(t), H = hourAngle(t, lon, c.ra);
    const h0 = 0.7275 * Math.asin(6378.14 / c.dist) / RAD - 0.5667;
    ma.push(altOf(H, lat * RAD, c.dec) / RAD - h0);
    mh.push(Math.atan2(Math.sin(H), Math.cos(H)));
  }
  const refine = (fn, a, b) => { // bisection on a sign change of fn between a and b
    let fa = fn(a);
    for (let k = 0; k < 18; k++) { const m = (a + b) / 2, fm = fn(m); if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m; }
    return (a + b) / 2;
  };
  const sunF = t => sunAlt(t, lat, lon) + 0.8333;
  const moonF = t => { const c = moonCoords(t); return altOf(hourAngle(t, lon, c.ra), lat * RAD, c.dec) / RAD - (0.7275 * Math.asin(6378.14 / c.dist) / RAD - 0.5667); };
  const cross = (arr, fn, up) => {
    const out = [];
    for (let i = 1; i < arr.length; i++) {
      const a = arr[i - 1], b = arr[i];
      if (up ? (a < 0 && b >= 0) : (a >= 0 && b < 0)) out.push(refine(fn, ts[i - 1], ts[i]));
    }
    return out;
  };
  const inDay = t => t >= day && t < day + DAY;
  const sunrise = cross(sa, sunF, true).find(inDay) || null;
  const sunset = cross(sa, sunF, false).find(inDay) || null;
  const moonrises = cross(ma, moonF, true), moonsets = cross(ma, moonF, false);
  const transits = [];
  for (let i = 1; i < mh.length; i++) {
    const a = mh[i - 1], b = mh[i];
    if (a < 0 && b >= 0 && b - a < Math.PI) transits.push({ t: refine(t => { const c = moonCoords(t), H = hourAngle(t, lon, c.ra); return Math.sin(H); }, ts[i - 1], ts[i]), type: 'over' });
    else if (a > 0 && b < 0 && a - b > Math.PI) transits.push({ t: refine(t => { const c = moonCoords(t), H = hourAngle(t, lon, c.ra); return -Math.sin(H); }, ts[i - 1], ts[i]), type: 'under' });
  }
  const periods = [];
  for (const tr of transits) periods.push({ kind: 'major', start: tr.t - HOUR, end: tr.t + HOUR, at: tr.t, label: tr.type === 'over' ? 'Moon overhead' : 'Moon underfoot' });
  for (const t of moonrises) periods.push({ kind: 'minor', start: t - 30 * MIN, end: t + 30 * MIN, at: t, label: 'Moonrise' });
  for (const t of moonsets) periods.push({ kind: 'minor', start: t - 30 * MIN, end: t + 30 * MIN, at: t, label: 'Moonset' });
  const dayPeriods = periods.filter(p => p.end > day && p.start < day + DAY).sort((a, b) => a.start - b.start);
  return {
    sunrise, sunset,
    moonrise: moonrises.find(inDay) || null, moonset: moonsets.find(inDay) || null,
    overhead: (transits.find(x => x.type === 'over' && inDay(x.t)) || {}).t || null,
    underfoot: (transits.find(x => x.type === 'under' && inDay(x.t)) || {}).t || null,
    periods: dayPeriods,
  };
}

/* Tides: harmonic models for four Maldives stations (south to north), fitted to published predictions
   (Oct 2026 - Jun 2027) and checked against gauge-based tables. Heights in metres above chart datum.
   K2, P1 and Q1 are inferred from S2, K1 and O1. Locations between stations use a latitude blend. */
const TIDE_STATIONS = [
  { name: "Gan", lat: -0.693, lon: 73.1556, Z0: 0.7017, M2: [0.3114, 251.85], S2: [0.1723, 286.39], N2: [0.0526, 259.22], K1: [0.0833, 355.17], O1: [0.0442, 19.45] },
  { name: "Malé", lat: 4.1755, lon: 73.5093, Z0: 0.6153, M2: [0.2123, 231.67], S2: [0.1262, 266.18], N2: [0.0299, 229.7], K1: [0.1126, 344.87], O1: [0.0589, 4.64] },
  { name: "Naifaru", lat: 5.4444, lon: 73.3658, Z0: 0.5996, M2: [0.1977, 213.82], S2: [0.1157, 263.67], N2: [0.0319, 197.82], K1: [0.1294, 337.83], O1: [0.0666, 351.26] },
  { name: "Dhidhdhoo", lat: 6.8875, lon: 73.1139, Z0: 0.6775, M2: [0.2337, 198.04], S2: [0.1157, 248.63], N2: [0.0408, 180.22], K1: [0.1579, 346.53], O1: [0.0758, 341.09] },
];
const TIDE_KEYS = ['M2', 'S2', 'N2', 'K1', 'O1'];
const _tideCache = new Map();
function tideModel(lat) {
  const key = lat.toFixed(3);
  if (_tideCache.has(key)) return _tideCache.get(key);
  const S = TIDE_STATIONS, cx = st => { const o = { Z0: st.Z0 }; for (const k of TIDE_KEYS) o[k] = [st[k][0] * Math.cos(st[k][1] * RAD), st[k][0] * Math.sin(st[k][1] * RAD)]; return o; };
  let m, source;
  if (lat <= S[0].lat) { m = cx(S[0]); source = { text: `Tides for ${S[0].name} (nearest station)`, stations: [S[0].name] }; }
  else if (lat >= S[S.length - 1].lat) { const s = S[S.length - 1]; m = cx(s); source = { text: `Tides for ${s.name} (nearest station)`, stations: [s.name] }; }
  else {
    let i = 0; while (lat > S[i + 1].lat) i++;
    const a = S[i], b = S[i + 1], f = (lat - a.lat) / (b.lat - a.lat), A = cx(a), B = cx(b);
    m = { Z0: A.Z0 + f * (B.Z0 - A.Z0) };
    for (const k of TIDE_KEYS) m[k] = [A[k][0] + f * (B[k][0] - A[k][0]), A[k][1] + f * (B[k][1] - A[k][1])];
    if (f < 0.08) source = { text: `Tides for ${a.name}`, stations: [a.name] };
    else if (f > 0.92) source = { text: `Tides for ${b.name}`, stations: [b.name] };
    else source = { text: `Tides estimated between ${a.name} and ${b.name}`, stations: [a.name, b.name] };
  }
  m.source = source;
  if (_tideCache.size > 50) _tideCache.clear();
  _tideCache.set(key, m);
  return m;
}
function tideAt(ms, lat) {
  const m = tideModel(lat);
  const D = jdUT(ms) - 2451545, Tc = D / 36525;
  const s = 218.3165 + 481267.8813 * Tc, h = 280.4661 + 36000.7698 * Tc, p = 83.3535 + 4069.0137 * Tc, N = (125.0445 - 1934.1363 * Tc) * RAD;
  const T = 180 + 15 * ((((ms % DAY) + DAY) % DAY) / HOUR);
  const cN = Math.cos(N), c2 = Math.cos(2 * N), c3 = Math.cos(3 * N), sN = Math.sin(N), s2 = Math.sin(2 * N), s3 = Math.sin(3 * N);
  const fM2 = 1.0004 - 0.0373 * cN + 0.0002 * c2, uM2 = -2.14 * sN;
  const fK1 = 1.0060 + 0.1150 * cN - 0.0088 * c2 + 0.0006 * c3, uK1 = -8.86 * sN + 0.68 * s2 - 0.07 * s3;
  const fO1 = 1.0089 + 0.1871 * cN - 0.0147 * c2 + 0.0014 * c3, uO1 = 10.80 * sN - 1.34 * s2 + 0.19 * s3;
  const fK2 = 1.0241 + 0.2863 * cN + 0.0083 * c2 - 0.0015 * c3, uK2 = -17.74 * sN + 0.68 * s2 - 0.04 * s3;
  // each group: [fitted complex amplitude, members [ratio, f, V+u (deg)]]
  const grp = (ab, members) => { let c = 0, sn = 0; for (const [r, f, th] of members) { c += r * f * Math.cos(th * RAD); sn += r * f * Math.sin(th * RAD); } return ab[0] * c + ab[1] * sn; };
  return m.Z0
    + grp(m.M2, [[1, fM2, 2 * T - 2 * s + 2 * h + uM2]])
    + grp(m.S2, [[1, 1, 2 * T], [0.272, fK2, 2 * T + 2 * h + uK2]])
    + grp(m.N2, [[1, fM2, 2 * T - 3 * s + 2 * h + p + uM2]])
    + grp(m.K1, [[1, fK1, T + h - 90 + uK1], [0.331, 1, T - h + 90]])
    + grp(m.O1, [[1, fO1, T - 2 * s + h + 90 + uO1], [0.194, fO1, T - 3 * s + h + p + 90 + uO1]]);
}
function flowAt(ms, lat) { return (tideAt(ms + 5 * MIN, lat) - tideAt(ms - 5 * MIN, lat)) * 6; } // metres per hour
function tideExtrema(t0, t1, lat) {
  const STEP = 5 * MIN, out = [];
  let yPrev = tideAt(t0 - STEP, lat), tCur = t0, yCur = tideAt(tCur, lat);
  for (let t = t0 + STEP; t <= t1 + STEP; t += STEP) {
    const y = tideAt(t, lat);
    if ((yCur > yPrev && yCur >= y) || (yCur < yPrev && yCur <= y)) {
      const den = yPrev - 2 * yCur + y, off = den !== 0 ? 0.5 * (yPrev - y) / den : 0;
      const te = tCur + off * STEP;
      if (te >= t0 && te < t1) out.push({ t: te, h: tideAt(te, lat), type: yCur > yPrev ? 'High' : 'Low' });
    }
    yPrev = yCur; tCur = t; yCur = y;
  }
  return out;
}
function tideDay(day, lat) {
  const ext = tideExtrema(day, day + DAY, lat);
  const curve = [];
  for (let t = day; t <= day + DAY; t += 10 * MIN) curve.push([t, tideAt(t, lat)]);
  const hs = curve.map(c => c[1]);
  const max = Math.max(...hs), min = Math.min(...hs);
  return { ext, curve, max, min, range: max - min, source: tideModel(lat).source };
}
function tideStageAt(ms, lat) {
  const ext = tideExtrema(ms - 8 * HOUR, ms + 8 * HOUR, lat);
  const near = ext.reduce((a, e) => (!a || Math.abs(e.t - ms) < Math.abs(a.t - ms)) ? e : a, null);
  const next = ext.find(e => e.t > ms) || null;
  const f = flowAt(ms, lat);
  let stage = f >= 0 ? 'Rising' : 'Falling';
  if (near && Math.abs(near.t - ms) <= 40 * MIN) stage = near.type + ' slack';
  return { h: tideAt(ms, lat), flow: f, stage, next };
}

/* Fishing analysis for one day */
const _cache = new Map();
function analyze(day, lat, lon) {
  const key = day + '|' + lat.toFixed(3) + '|' + lon.toFixed(3);
  if (_cache.has(key)) return _cache.get(key);
  const sky = skyDay(day, lat, lon);
  const tide = tideDay(day, lat);
  const ph = moonPhase(day + 12 * HOUR);
  const SYN = 29.530589, age = ph.phase * SYN;
  const dNew = Math.min(age, SYN - age), dFull = Math.abs(age - SYN / 2);
  const moonScore = clamp(1 - Math.min(dNew, dFull) / 7.4, 0, 1);
  const rangeScore = clamp((tide.range - 0.35) / 0.6, 0, 1);
  const lights = [sky.sunrise && { t: sky.sunrise, name: 'sunrise' }, sky.sunset && { t: sky.sunset, name: 'sunset' }].filter(Boolean);
  let overlap = 0, overlapText = '';
  for (const p of sky.periods) for (const L of lights) {
    if (p.start < L.t + HOUR && p.end > L.t - HOUR) {
      const v = p.kind === 'major' ? 1 : 0.6;
      if (v > overlap) { overlap = v; overlapText = `a ${p.kind} period lines up with ${L.name}`; }
    }
  }
  const score = 100 * (0.4 * moonScore + 0.35 * rangeScore + 0.25 * overlap);
  const stars = clamp(1 + Math.round(score / 25), 1, 5);
  // 15-minute slots
  const slots = [];
  let maxFlow = 0;
  for (let i = 0; i < 96; i++) { const t = day + (i + 0.5) * 15 * MIN; const f = flowAt(t, lat); maxFlow = Math.max(maxFlow, Math.abs(f)); slots.push({ t, f }); }
  for (const s of slots) {
    let sol = 0;
    for (const p of sky.periods) {
      const inside = s.t >= p.start && s.t <= p.end;
      const dist = inside ? 0 : Math.min(Math.abs(s.t - p.start), Math.abs(s.t - p.end));
      const w = p.kind === 'major' ? 1 : 0.6, fade = p.kind === 'major' ? 45 * MIN : 30 * MIN;
      sol = Math.max(sol, w * clamp(1 - dist / fade, 0, 1));
    }
    let light = 0;
    for (const L of lights) { const dist = Math.max(0, Math.abs(s.t - L.t) - HOUR); light = Math.max(light, clamp(1 - dist / (45 * MIN), 0, 1)); }
    const flowN = maxFlow > 0 ? Math.abs(s.f) / maxFlow : 0;
    s.sol = sol; s.light = light; s.flowN = flowN;
    s.score = 100 * (0.4 * sol + 0.25 * light + 0.35 * flowN);
  }
  // best windows
  const sc = slots.map(s => s.score), used = new Array(96).fill(false), wins = [];
  for (let k = 0; k < 3; k++) {
    let best = -1;
    for (let i = 0; i < 96; i++) if (!used[i] && (best < 0 || sc[i] > sc[best])) best = i;
    if (best < 0 || sc[best] < 45) break;
    const thr = sc[best] * 0.8;
    let a = best, b = best;
    while (a > 0 && !used[a - 1] && sc[a - 1] >= thr && best - a < 6) a--;
    while (b < 95 && !used[b + 1] && sc[b + 1] >= thr && b - best < 6) b++;
    while (b - a < 3) { if (a > 0 && !used[a - 1]) a--; else if (b < 95 && !used[b + 1]) b++; else break; }
    let sum = 0; for (let i = a; i <= b; i++) sum += sc[i];
    wins.push({ start: day + a * 15 * MIN, end: day + (b + 1) * 15 * MIN, avg: sum / (b - a + 1), peak: sc[best] });
    for (let i = Math.max(0, a - 4); i <= Math.min(95, b + 4); i++) used[i] = true;
  }
  wins.sort((x, y) => x.start - y.start);
  for (const w of wins) {
    const why = [];
    for (const p of sky.periods) if (p.start < w.end && p.end > w.start) why.push(`${p.label} ${fmtTime(p.at)}`);
    for (const L of lights) if (L.t > w.start - HOUR && L.t < w.end + HOUR) why.push(`${L.name === 'sunrise' ? 'Sunrise' : 'Sunset'} ${fmtTime(L.t)}`);
    const mid = slots.filter(s => s.t >= w.start && s.t <= w.end);
    const fAvg = mid.reduce((a, s) => a + s.f, 0) / Math.max(1, mid.length);
    const nAvg = mid.reduce((a, s) => a + s.flowN, 0) / Math.max(1, mid.length);
    why.push((nAvg > 0.6 ? 'Strong ' : '') + (fAvg >= 0 ? 'rising tide' : 'falling tide'));
    w.why = why.map((x, i) => i === why.length - 1 && nAvg <= 0.6 ? x[0].toUpperCase() + x.slice(1) : x);
    w.grade = w.avg >= 70 ? 'Prime' : w.avg >= 55 ? 'Good' : 'Fair';
  }
  // summary
  const isNew = dNew < dFull, dd = isNew ? dNew : dFull;
  const until = isNew ? (age > SYN / 2 ? SYN - age : -age) : (SYN / 2 - age);
  let moonText;
  if (dd < 1) moonText = (isNew ? 'New' : 'Full') + ' moon today';
  else if (dd <= 4.5) { const n = Math.round(Math.abs(until)); moonText = `${isNew ? 'New' : 'Full'} moon ${until > 0 ? `in ${n} day${n === 1 ? '' : 's'}` : `${n} day${n === 1 ? '' : 's'} ago`}`; }
  else moonText = phaseName(ph.phase);
  const tideText = tide.range >= 0.8 ? 'strong spring tides' : tide.range <= 0.5 ? 'weak neap tides' : 'moderate tides';
  const summary = `${moonText} with ${tideText} (${tide.range.toFixed(2)} m range). ` + (overlapText ? overlapText[0].toUpperCase() + overlapText.slice(1) + '.' : 'No solunar period lines up with dawn or dusk.');
  const res = { day, lat, lon, sky, tide, ph, age, score, stars, label: ['Poor', 'Fair', 'Average', 'Good', 'Excellent'][stars - 1], slots, wins, summary, tideText };
  if (_cache.size > 60) _cache.clear();
  _cache.set(key, res);
  return res;
}

if (typeof module !== 'undefined') module.exports = { mvMs, mvDayStart, mvParts, fmtTime, fmtDate, analyze, tideExtrema, tideAt, tideModel, tideStageAt, moonPhase, phaseName, skyDay, moonCoords, sunCoords, gmst, TIDE_STATIONS, DAY, HOUR, MIN };
