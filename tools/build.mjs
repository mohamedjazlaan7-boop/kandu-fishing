// Builds index.html (the installable web app) from src/. No dependencies: `node tools/build.mjs`.
// `node tools/build.mjs --artifact out.html` writes the claude.ai artifact variant (no manifest or service worker).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');
const core = read('src/core.js').replace(/\nif \(typeof module !== 'undefined'\)[^\n]*\n?/, '\n').trim();
const app = read('src/app.js').trim();
const shell = read('src/shell.html').replace('/*CORE*/', () => core).replace('/*APP*/', () => app);

const args = process.argv.slice(2);
if (args[0] === '--artifact') {
  writeFileSync(args[1], shell);
  console.log('wrote', args[1], shell.length, 'bytes');
} else {
  const split = shell.indexOf('<div class="app">');
  const headPart = shell.slice(0, split).trim(), bodyPart = shell.slice(split).trim();
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Fishing planner for the Maldives: tide times for every atoll, solunar bite windows, sunrise and moon times, GPS spots and a catch log. Works offline.">
<meta name="theme-color" content="#EDF3F5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#061820" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Kandu">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
${headPart}
</head>
<body>
${bodyPart}
</body>
</html>
`;
  writeFileSync(join(root, 'index.html'), html);
  console.log('wrote index.html', html.length, 'bytes');
}
