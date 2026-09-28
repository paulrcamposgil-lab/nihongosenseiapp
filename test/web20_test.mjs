#!/usr/bin/env node
/**
 * web20_test.mjs · la web al dia con la 2.0, en los DOS idiomas.
 *
 *     node test/web20_test.mjs
 *
 * Se carga la pagina de verdad y se lee lo pintado tras pulsar el boton de idioma: el
 * titular «Llegó el sensei», el reel del idioma en el hero, las diez capturas del idioma,
 * las cifras (1.224 · 290 · 30), las clases con historia, los cuatro personajes (y
 * ninguno mas), el precio del dojo y Yūgen.
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

await env('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await env('Page.navigate', { url: URL_WEB });
await new Promise((r) => setTimeout(r, 1200));
const lee = async (L) => {
  const r = await env('Runtime.evaluate', { returnByValue: true, expression: `(function(){
    var b = document.querySelector('.lang button[data-lang="${L}"]'); if (b) b.click();
    var q = function (s) { var e = document.querySelector(s); return e ? e.textContent.replace(/\\s+/g, ' ').trim() : ''; };
    var v = document.querySelector('.hero-video video');
    var shots = [].map.call(document.querySelectorAll('.shots-row img'), function (i) { return { src: i.getAttribute('src'), alt: i.getAttribute('alt') }; });
    var nums = [].map.call(document.querySelectorAll('.nums .num b'), function (b) { return b.textContent.trim(); });
    var pjs = [].map.call(document.querySelectorAll('.cast .pj b'), function (b) { return b.textContent.trim(); });
    return JSON.stringify({ h1: q('h1'), sub: q('.hero-sub'), video: v ? v.getAttribute('src') : '', poster: v ? v.getAttribute('poster') : '',
      shots: shots, nums: nums, clsH: q('#clases h2'), clsP: q('#clases p'), pjs: pjs, real: q('.pj-real'),
      precio: q('[data-t=precioC]'), yugen: q('[data-t=s5p1]'), texto: document.body.textContent });
  })()` });
  return JSON.parse(r.result.value);
};
const E = { es: { h1: 'Llegó el sensei', sub: 'Aprende japonés con Nihongo Sensei', n: '1.224', cls: 'Clases con historia', clsP: /^Nihongo Sensei ahora te da clase/, real: 'Siena y Luna existen de verdad.', precio: /19,99 € al año.*7 días gratis/ },
            en: { h1: 'The sensei is here', sub: 'Learn Japanese with Nihongo Sensei', n: '1,224', cls: 'Classes with a story', clsP: /^Nihongo Sensei now teaches you/, real: 'Siena and Luna are real.', precio: /€19\.99 a year.*7-day free trial/ } };
for (const L of ['es', 'en']) {
  const d = await lee(L), e = E[L];
  ok(d.h1 === e.h1 && d.sub === e.sub, L + ' · el hero dice «' + e.h1 + '» y debajo «' + e.sub + '»', d.h1 + ' | ' + d.sub);
  ok(d.video === 'img/reel_' + L + '.mp4' && d.poster === 'img/reel_poster_' + L + '.jpg', L + ' · el video del hero es el reel de su idioma', d.video + ' ' + d.poster);
  ok(d.shots.length === 10 && d.shots.every((s, i) => s.src === 'img/cap-' + L + '-' + String(i + 1).padStart(2, '0') + '.jpg' && s.alt), L + ' · las diez capturas, las de su idioma y en orden, con su texto', JSON.stringify(d.shots.slice(0, 3)));
  ok(d.nums[0] === e.n && d.nums[1] === '290' && d.nums[2] === '30', L + ' · las cifras: ' + e.n + ' palabras, 290 kanji, 30 lecciones', d.nums.join(' '));
  ok(d.clsH === e.cls && e.clsP.test(d.clsP), L + ' · la seccion de clases con historia', d.clsH + ' | ' + d.clsP.slice(0, 50));
  ok(d.pjs.join(',') === 'Paul,Mónica,Siena,Luna' && d.real === e.real, L + ' · los personajes son Paul, Mónica, Siena y Luna', d.pjs.join(',') + ' | ' + d.real);
  ok(!/Marco|Gus\b|Kimura/.test(d.texto), L + ' · y ni Marco, ni Gus, ni Kimura en toda la pagina', (d.texto.match(/Marco|Gus\b|Kimura/) || [''])[0]);
  ok(e.precio.test(d.precio), L + ' · el precio del dojo, a la vista', d.precio);
  ok(/Yūgen/.test(d.yugen), L + ' · Yūgen, el estilo nuevo', d.yugen.slice(0, 60));
  ok(!/\b(978|1\.?061|994|966)\b/.test(d.texto), L + ' · ninguna cifra vieja', (d.texto.match(/\b(978|1\.?061|994|966)\b/) || [''])[0]);
}
let fallos = 0;
for (const [okk, nombre, det] of res) { console.log(`  ${okk ? '✅' : '❌'} ${nombre}${okk ? '' : '\n        → ' + det}`); if (!okk) fallos++; }
console.log(`\n${res.length - fallos}/${res.length} comprobaciones en verde`);
ws.close(); limpiar();
process.exit(fallos ? 1 : 0);
