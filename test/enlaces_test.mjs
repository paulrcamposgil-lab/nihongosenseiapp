#!/usr/bin/env node
/**
 * enlaces_test.mjs · el botón grande lleva a la tienda del que mira.
 *
 *     node test/enlaces_test.mjs
 *
 * Por qué existe: hasta el 15-sep-2026 el CTA del hero apuntaba SIEMPRE a
 * apps.apple.com. Es el único botón que se ve sin bajar, así que un visitante con
 * Android acababa en una tienda que en su teléfono no le ofrece nada, y los badges de
 * las dos tiendas estaban al final de una página larga. Con campañas pagando por traer
 * gente desde el 4 de septiembre.
 *
 * Se carga la página DE VERDAD en un navegador, con el user-agent de cada aparato, y
 * se lee el href que queda — no se le pregunta a la función que lo decide.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((c) => fs.existsSync(c));
if (!chrome) { console.error('❌ no encuentro Chrome'); process.exit(2); }

const TIPOS = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp',
  '.png': 'image/png', '.mp4': 'video/mp4', '.svg': 'image/svg+xml', '.json': 'application/json' };
const srv = http.createServer((q, s) => {
  const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const f = path.join(RAIZ, rel);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end('no'); }
  s.writeHead(200, { 'Content-Type': TIPOS[path.extname(f).toLowerCase()] || 'text/html; charset=utf-8' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const URL_WEB = `http://127.0.0.1:${srv.address().port}/index.html`;
const perfil = fs.mkdtempSync('/tmp/web-');
const PUERTO = 9600 + (process.pid % 200);
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${PUERTO}`,
  `--user-data-dir=${perfil}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const limpiar = () => { try { proc.kill(); } catch {} try { srv.close(); } catch {}
  try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {} };
process.on('exit', limpiar);
let target = null;
for (let i = 0; i < 60; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json();
    target = l.find((t) => t.type === 'page'); if (target?.webSocketDebuggerUrl) break; } catch {}
  await new Promise((r) => setTimeout(r, 250));
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pend = new Map();
const env = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); } };
await env('Page.enable'); await env('Runtime.enable');

const res = [];
const ok = (cond, nombre, det = '') => res.push([cond === true, nombre, cond === true ? '' : String(det)]);

const UA = {
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  iphone:  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad:    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  win:     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

async function visita(ua, extra) {
  await env('Emulation.setUserAgentOverride', Object.assign({ userAgent: ua }, extra || {}));
  await env('Page.navigate', { url: URL_WEB + '?utm_source=instagram' });
  await new Promise((r) => setTimeout(r, 900));
  const r = await env('Runtime.evaluate', {
    expression: "(function(){var a=document.getElementById('ctaDescarga');return JSON.stringify({href:a?a.getAttribute('href'):null, visible: !!a && a.offsetParent !== null});})()",
    returnByValue: true });
  return JSON.parse(r.result.value);
}

// ── ANDROID · el caso que sangraba ──────────────────────────────────────────
const and = await visita(UA.android);
ok(/play\.google\.com/.test(and.href), 'Android · el botón grande lleva a Google Play', and.href);
ok(and.visible === true, 'Android · y el botón está a la vista', JSON.stringify(and));

// ── iPHONE ──────────────────────────────────────────────────────────────────
const iph = await visita(UA.iphone);
ok(/apps\.apple\.com/.test(iph.href), 'iPhone · el botón grande lleva a la App Store', iph.href);

// ── iPAD (iPadOS 13+ se presenta como un Mac; lo delata el táctil) ──────────
await env('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
const ipd = await visita(UA.ipad);
await env('Emulation.setTouchEmulationEnabled', { enabled: false });
ok(/apps\.apple\.com/.test(ipd.href), 'iPad · también a la App Store (se presenta como Mac)', ipd.href);

// ── ESCRITORIO · no se adivina: se baja a los dos badges ────────────────────
const win = await visita(UA.win);
ok(win.href === '#descargar', 'Escritorio · no elige por él: lleva a la sección con las dos tiendas', win.href);
const badges = await env('Runtime.evaluate', {
  expression: "(function(){var s=document.getElementById('descargar');if(!s)return '0';var a=s.querySelectorAll('a');var ios=0,and=0;a.forEach(function(x){if(/apps.apple.com/.test(x.href))ios++;if(/play.google.com/.test(x.href))and++;});return ios+'/'+and;})()",
  returnByValue: true });
ok(badges.result.value === '1/1', 'Escritorio · y esa sección tiene los dos badges', badges.result.value);

// ── El utm sigue viajando a Play (atribución de Play Console) ───────────────
const andUtm = await visita(UA.android);
ok(/referrer=/.test(andUtm.href) && /utm_source%3Dinstagram|utm_source=instagram/.test(decodeURIComponent(andUtm.href)),
  'Android · el enlace conserva el referrer del utm (atribución de Play)', andUtm.href);

let fallos = 0;
for (const [okk, nombre, det] of res) {
  console.log(`  ${okk ? '✅' : '❌'} ${nombre}${okk ? '' : '\n        → ' + det}`);
  if (!okk) fallos++;
}
console.log(`\n${res.length - fallos}/${res.length} comprobaciones en verde`);
console.log(fallos ? '❌ la web manda gente a la tienda equivocada.' : '✅ cada aparato va a su tienda.');
ws.close(); limpiar();
process.exit(fallos ? 1 : 0);
