// Checks Kandu's sun, moon and tide predictions against published reference tables.
// Run: node tools/verify.mjs
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const C = createRequire(import.meta.url)(join(here, '..', 'src', 'core.js'));

// US Naval Observatory, aa.usno.navy.mil/api/rstt/oneday (UTC+5)
const USNO = [
  { date: [2026, 10, 8], place: 'Malé', lat: 4.1755, lon: 73.5093, sunrise: '05:52', sunset: '17:55', moonrise: '03:48', transit: '10:00', moonset: '16:12' },
  { date: [2026, 10, 18], place: 'Maaungoodhoo', lat: 6.0694, lon: 73.2811, sunrise: '05:53', sunset: '17:51', moonrise: '12:03', transit: '18:03', moonset: null },
  { date: [2026, 10, 26], place: 'Maaungoodhoo', lat: 6.0694, lon: 73.2811, sunrise: '05:53', sunset: '17:49', moonrise: '17:56', transit: null, moonset: '05:43' },
  { date: [2026, 12, 21], place: 'Malé', lat: 4.1755, lon: 73.5093, sunrise: '06:07', sunset: '18:00', moonrise: '15:14', transit: '21:36', moonset: '02:58' },
  { date: [2027, 3, 14], place: 'Maaungoodhoo', lat: 6.0694, lon: 73.2811, sunrise: '06:14', sunset: '18:18', moonrise: '10:36', transit: '17:02', moonset: '23:30' },
  { date: [2027, 6, 21], place: 'Addu', lat: -0.6153, lon: 73.0828, sunrise: '06:07', sunset: '18:12', moonrise: '20:13', transit: '01:38', moonset: '07:51' },
];
// USNO moon phases (UT), aa.usno.navy.mil/api/moon/phases
const PHASES = [['New', '2026-10-10T15:50', 0], ['First quarter', '2026-10-18T16:12', 0.25], ['Full', '2026-10-26T04:12', 0.5], ['Last quarter', '2026-11-01T20:28', 0.75], ['New', '2026-11-09T07:02', 0], ['Full', '2026-11-24T14:53', 0.5], ['New', '2026-12-09T00:52', 0], ['Full', '2026-12-24T01:28', 0.5]];

const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
let worstSky = 0;
console.log('Sun and moon vs US Naval Observatory (minutes, app minus USNO)');
for (const r of USNO) {
  const day = C.mvMs(...r.date), s = C.skyDay(day, r.lat, r.lon);
  const cells = [['sunrise', s.sunrise], ['sunset', s.sunset], ['moonrise', s.moonrise], ['transit', s.overhead], ['moonset', s.moonset]].map(([k, v]) => {
    if (!r[k]) return `${k} -`;
    let d = toMin(C.fmtTime(v)) - toMin(r[k]); if (d > 720) d -= 1440; if (d < -720) d += 1440;
    worstSky = Math.max(worstSky, Math.abs(d)); return `${k} ${d >= 0 ? '+' : ''}${d}`;
  });
  console.log(`  ${r.date.join('-').padEnd(10)} ${r.place.padEnd(13)} ${cells.join('  ')}`);
}
let worstPhase = 0;
for (const [name, ut, target] of PHASES) {
  const t0 = Date.parse(ut + 'Z'); let best = null;
  for (let t = t0 - 6 * 3600e3; t <= t0 + 6 * 3600e3; t += 60e3) { let d = Math.abs(C.moonPhase(t).phase - target); d = Math.min(d, 1 - d); if (!best || d < best.d) best = { t, d }; }
  worstPhase = Math.max(worstPhase, Math.abs((best.t - t0) / 60e3));
}
console.log(`  Moon phases: worst error ${worstPhase.toFixed(0)} min over ${PHASES.length} phases`);

const FT = 0.3048;
const load = (f, unit) => readFileSync(join(here, f), 'utf8').trim().split('\n').map(l => { const [d, t, ty, h] = l.split(','); const [Y, M, D] = d.split('-').map(Number), [hh, mm] = t.split(':').map(Number); return { t: C.mvMs(Y, M, D, hh, mm), type: ty, h: +h * unit }; });
const TIDES = [
  ['Hanimaadhoo, tidesatlas (gauge-based TICON-4)', 'reference/atlas_hanimaadhoo.csv', 1, 6.767],
  ['Malé, tidesatlas (gauge-based TICON-4)', 'reference/atlas_male.csv', 1, 4.1755],
  ['Fuvahmulah, tidesatlas', 'reference/atlas_fuvahmulah.csv', 1, -0.2988],
  ['Gan, tidesatlas (gauge-based TICON-4)', 'reference/atlas_gan.csv', 1, -0.687],
  ['Kulhudhuffushi, tide-forecast.com', 'reference/tf_kulhudhuffushi.csv', 1, 6.622],
  ['Naifaru, tide-forecast.com', 'reference/tf_naifaru.csv', 1, 5.4444],
  ['Malé, tide-forecast.com', 'reference/tf_male.csv', 1, 4.1755],
  ['Thinadhoo, tide-forecast.com', 'reference/tf_thinadhoo.csv', 1, 0.53],
  ['Hithadhoo (Addu), tide-forecast.com', 'reference/tf_hithadhoo.csv', 1, -0.60],
];
console.log('\nHigh and low tide times vs other published tables (minutes, app minus table)');
for (const [lbl, f, u, lat] of TIDES) {
  const obs = load(f, u), ex = C.tideExtrema(obs[0].t - 4 * C.HOUR, obs[obs.length - 1].t + 4 * C.HOUR, lat), d = [];
  for (const o of obs) {
    const c = ex.filter(e => e.type === o.type).reduce((a, e) => !a || Math.abs(e.t - o.t) < Math.abs(a.t - o.t) ? e : a, null);
    const m = (c.t - o.t) / 6e4; if (Math.abs(m) < 240) d.push(m);
  }
  const mean = d.reduce((a, b) => a + b, 0) / d.length, rms = Math.sqrt(d.reduce((a, b) => a + b * b, 0) / d.length);
  const med = d.map(Math.abs).sort((a, b) => a - b)[Math.floor(d.length / 2)];
  console.log(`  ${lbl.padEnd(46)} n=${String(d.length).padStart(3)}  mean ${mean >= 0 ? '+' : ''}${mean.toFixed(0).padStart(3)}  median |err| ${med.toFixed(0).padStart(2)}  rms ${rms.toFixed(0).padStart(2)}`);
}
if (worstSky > 1 || worstPhase > 5) { console.error('\nSky check failed'); process.exit(1); }
console.log('\nSky check passed: every sun and moon time within 1 minute of USNO.');
