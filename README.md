# Kandu

A fishing planner for the Maldives. It shows tide times for every atoll, solunar bite windows, sunrise and moon times, and a 7-day outlook. It also saves your GPS fishing spots and keeps a catch log. Everything is worked out on the phone, so it keeps working at sea with no signal.

**Open the app:** https://mohamedjazlaan7-boop.github.io/kandu-fishing/

## Install it on your phone

- **iPhone:** open the link in Safari, tap the Share button, then **Add to Home Screen**.
- **Android:** open the link in Chrome, tap the ⋮ menu, then **Install app** (or **Add to Home screen**).

Open it once while you have signal. After that it opens like a normal app, offline too.

## What it does

- **Today:** a bite rating out of 5, a day chart (moon periods, tide curve, night, hourly bite strength), the best 2–3 windows with the reasons for each, high and low tides, and sun and moon times.
- **Week ahead:** rating and moon phase for each of the next 7 days.
- **Spots:** save kandus, thilas, giris and reef edges. Use your phone's GPS on the spot, or paste coordinates or a Google Maps link. Each spot shows its distance and compass bearing from your base, plus a tide tip for that type of spot.
- **Catch log:** species, weight, length, method and bait. The tide stage, moon period and moon phase are saved with each catch automatically, so you can see which conditions work for you.
- **Backup:** save your spots and catches to a file and restore them on a new phone.

## How accurate are the times?

Run `node tools/verify.mjs` to repeat these checks.

**Sun and moon.** Compared with the US Naval Observatory on 6 days across a year at Malé, Maaungoodhoo and Addu, every sunrise, sunset, moonrise, moonset and moon-overhead time matched to the minute. Moon phase times are within 1 minute.

**Tides.** The app uses tide models for four stations: Dhidhdhoo (north), Naifaru, Malé and Gan (Addu). Places in between are blended by latitude. This matters a lot: high tide in Haa Alif comes more than an hour before Malé, and in Addu about 45 minutes after.

| Compared with | Typical difference |
|---|---|
| Malé, gauge-based tables (tidesatlas, TICON-4) | about 6 minutes |
| Gan, gauge-based tables | about 5 minutes |
| Fuvahmulah | about 2 minutes |
| Hanimaadhoo, gauge-based tables | about 10 minutes |
| Malé, other months (Jan–Jun 2027) | 7–16 minutes |

tide-forecast.com differs from the gauge-based tables by 10–30 minutes, and in different directions at different places, so it isn't used. Treat tide times as accurate to about 10–20 minutes. Channels and reef flats can shift them a little more, and around neap tides the high and low are flat, so their exact time matters less.

**Bite rating.** This is the standard solunar method that most fishing apps use: moon overhead or underfoot (major periods, 2 hours), moonrise and moonset (minor periods, 1 hour), dawn and dusk, and strong tidal flow, weighted toward new and full moon. It's a guide to when fish are more likely to feed, not a promise.

## Not included yet

- Live wind and swell. The app links to Windy and the Maldives Meteorological Service instead.
- Navigation. Don't use these tide heights for navigation.

## Privacy

Spots and catches are stored only on your phone (browser storage). Nothing is sent anywhere. Use **Log → Backup** to keep a copy.

## Working on the code

The app is plain HTML, CSS and JavaScript with no dependencies.

```
src/core.js        time helpers, sun and moon positions, tides, bite scoring
src/app.js         the interface: Today, Spots, Log
src/shell.html     page layout and styles
index.html         built from src/ (this is what GitHub Pages serves)
sw.js              service worker that makes the app work offline
tools/build.mjs    node tools/build.mjs     rebuilds index.html
tools/verify.mjs   node tools/verify.mjs    checks times against reference tables
tools/fit_tides.py python3 tools/fit_tides.py   refits the tide station constants
```

After editing anything in `src/`, run `node tools/build.mjs` and commit `index.html` too. Bump `VERSION` in `sw.js` when you publish a change, so phones pick up the new version.

## Sources

- Sun and moon formulas: Jean Meeus, *Astronomical Algorithms* (2nd ed.), chapters 12, 15, 25 and 47.
- Sun and moon reference times: US Naval Observatory, aa.usno.navy.mil.
- Tide predictions used for fitting: seatemperatu.re (Dhidhdhoo, Naifaru, Malé, Gan, Oct 2026 – Jun 2027).
- Tide reference tables: tidesatlas.com (TICON-4, NOAA and FES2022) and tide-forecast.com.
