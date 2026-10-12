// Builds public/index.html from src/ (Vercel runs this on every deploy — see vercel.json).
// The page is the same one that runs as the claude.ai artifact, started in "server" mode: it loads its
// data from /api/data and saves through the API instead of republishing itself.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function emblem(file) {
  const svg = rd(file);
  return { vb: svg.match(/viewBox="([^"]+)"/)[1], d: svg.match(/ d="([^"]+)"/)[1] };
}
const EMBLEM = { phys: emblem('src/emblems/physics.svg'), juz40: emblem('src/emblems/juz40.svg') };

// "JUZ40 · SapaLine" bookmarklet: comments and indentation stripped, then made into a javascript: URL
function bookmarkletURL(src) {
  const code = src.replace(/^\s*\/\*[\s\S]*?\*\//, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
  new Function(code); // syntax check
  return 'javascript:' + encodeURIComponent(code);
}

const consts = [
  'var HOST_MODE = "server";',
  'var SHELL = "", TITLE_TAG = "", HEAD_LINKS = "", SKELETON_HEAD = "", SKELETON_TAIL = "";',
  'var EMBLEM = ' + JSON.stringify(EMBLEM) + ';',
  'var BOOKMARKLET = ' + JSON.stringify(bookmarkletURL(rd('src/bookmarklet.js'))) + ';',
].join('\n');
const MERGE = rd('src/merge.js');
const APP = rd('src/app.js').replace('/*@MERGE@*/', () => MERGE).replace('/*@CONSTANTS@*/', () => consts);
if (!APP.includes('function mergeSapa(') || APP.includes('/*@')) throw new Error('app.js placeholders were not filled');
new Function(APP); // syntax check
const CSS = rd('src/styles.css');
const SHELL = rd('src/shell.html').trim();
if (/<\/script/i.test(APP)) throw new Error('app.js must not contain </script');
if (/<\/style/i.test(CSS)) throw new Error('styles.css must not contain </style');

const FONTS = [[400, 'Regular'], [500, 'Medium'], [700, 'Bold']]
  .map(([w, n]) => `@font-face{font-family:"JUZ40";src:url(/fonts/JUZ40-${n}.woff2) format("woff2");font-weight:${w};font-style:normal;font-display:swap}`)
  .join('');
// the base styles the claude.ai page wrapper gives the artifact version
const RESET = ':root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#faf9f5;color:#141413}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}';

const html = `<!doctype html>
<html lang="kk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>JUZ40 Физика кері байланыс</title>
<meta name="description" content="JUZ40 · Физика мұғалімдеріне LIVE сабақ бойынша апталық кері байланыс">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#863e98">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preload" href="/fonts/JUZ40-Bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=Noto+Sans+Math&display=swap">
<style>${RESET}</style>
<style>${FONTS}</style>
<style>${CSS}</style>
</head>
<body>
${SHELL}
<script>
${APP}
</script>
</body>
</html>
`;

fs.mkdirSync(path.join(ROOT, 'public'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'public', 'index.html'), html);
console.log(`public/index.html — ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
