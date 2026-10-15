#!/usr/bin/env node
/**
 * app_test.mjs · el enlace de los anuncios, /app?c=<campaña> (15-oct-2026).
 *
 *     node test/app_test.mjs
 *
 * Se abre app.html como lo abriría cada aparato (iPhone, Android, ordenador) y se mira lo que
 * SALE de verdad del navegador —regla 6: no se pregunta a la función—: Chrome intercepta la
 * petición a la tienda y el beacon al contador, y la prueba lee su URL y su cuerpo.
 *   · iPhone  → App Store (con pt+ct si hay PT), beacon {e:'ios', o:c}
 *   · Android → Google Play con referrer utm_source=meta & utm_campaign=c, beacon {e:'android', o:c}
 *   · ordenador → la portada con utm_source=c, y la visita la cuenta la portada en el canal c
 *   · una campaña con caracteres raros no viaja: se cuenta como «directo»
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const APP = process.env.APP_HTML || path.join(RAIZ, 'app.html');
const chrome = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((c) => fs.existsSync(c));
if (!chrome) { console.error('❌ no encuentro Chrome'); process.exit(2); }
const TIPOS = { '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.mp4': 'video/mp4', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, s) => {
  let rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const f = rel === 'app.html' ? APP : path.join(RAIZ, rel);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end('no'); }
  s.writeHead(200, { 'Content-Type': TIPOS[path.extname(f).toLowerCase()] || 'text/html; charset=utf-8' });
  fs.createReadStream(f).pipe(s);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}`;
const perfil = fs.mkdtempSync('/tmp/webapp-');
const PUERTO = 9800 + (process.pid % 150);
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${PUERTO}`,
  `--user-data-dir=${perfil}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const limpiar = () => { try { proc.kill(); } catch {} try { srv.close(); } catch {}
  try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {} };
process.on('exit', limpiar);
const RELOJ = setTimeout(() => { console.error('❌ colgado'); limpiar(); process.exit(3); }, 120000);
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
let vistas = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m.result); pend.delete(m.id); return; }
  if (m.method === 'Fetch.requestPaused') {
    const r = m.params.request;
    vistas.push({ url: r.url, cuerpo: r.postData || '' });
    env('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 204, responseHeaders: [], body: '' });
  }
};
await env('Page.enable'); await env('Network.enable');
await env('Fetch.enable', { patterns: [{ urlPattern: '*apps.apple.com*' }, { urlPattern: '*play.google.com*' }, { urlPattern: '*deno.net*' }] });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
};
const PLAT = { iphone: 'iOS', android: 'Android', mac: 'macOS' };
async function abre(aparato, c) {
  vistas = [];
  await env('Emulation.setUserAgentOverride', { userAgent: UA[aparato],
    userAgentMetadata: { platform: PLAT[aparato], platformVersion: '1', architecture: '', model: '', mobile: aparato !== 'mac', brands: [] } });
  await env('Page.navigate', { url: BASE + '/app.html' + (c === null ? '' : '?c=' + encodeURIComponent(c)) });
  await espera(1500);
  const loc = await env('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
  const beacons = vistas.filter((v) => /deno\.net/.test(v.url)).map((v) => { try { return JSON.parse(v.cuerpo); } catch { return { roto: v.cuerpo }; } });
  return { tienda: vistas.find((v) => /apps\.apple\.com|play\.google\.com/.test(v.url))?.url || null, beacons, loc: loc?.result?.value };
}

const res = []; const ok = (c, n, d) => res.push([!!c, n, d || '']);
const PT = (fs.readFileSync(APP, 'utf8').match(/var PT = '([^']*)'/) || [])[1] ?? null;

const i = await abre('iphone', 'meta-es');
const iosEsperado = 'https://apps.apple.com/app/id6789333985' + (PT ? `?pt=${PT}&ct=meta-es&mt=8` : '');
ok(i.tienda === iosEsperado, 'iPhone → App Store' + (PT ? ' con pt y ct=meta-es' : ' (PT vacío: sin etiqueta de campaña)'), JSON.stringify(i));
ok(i.beacons.length === 1 && i.beacons[0].e === 'ios' && i.beacons[0].o === 'meta-es', 'iPhone · el clic se cuenta una vez, ios en meta-es', JSON.stringify(i.beacons));

const a = await abre('android', 'meta-en');
ok(a.tienda === 'https://play.google.com/store/apps/details?id=com.nihongonosensei.app&referrer=utm_source%3Dmeta%26utm_campaign%3Dmeta-en',
  'Android → Google Play con referrer utm_source=meta & utm_campaign=meta-en', JSON.stringify(a));
ok(a.beacons.length === 1 && a.beacons[0].e === 'android' && a.beacons[0].o === 'meta-en', 'Android · el clic se cuenta una vez, android en meta-en', JSON.stringify(a.beacons));

const m = await abre('mac', 'meta-es');
ok(m.tienda === null && /\/\?utm_source=meta-es$/.test(m.loc || ''), 'ordenador → la portada con utm_source=meta-es, sin abrir ninguna tienda', JSON.stringify(m));
ok(m.beacons.length === 1 && m.beacons[0].e === 'visit' && m.beacons[0].o === 'meta-es', 'ordenador · una sola marca, la visita de la portada en meta-es', JSON.stringify(m.beacons));

const me = await abre('mac', 'meta-en');
ok(/\/\?utm_source=meta-en$/.test(me.loc || '') && me.beacons.length === 1 && me.beacons[0].o === 'meta-en', 'ordenador con meta-en → la portada, y la visita cuenta en meta-en (el idioma lo pone el navegador)', JSON.stringify(me));

const raro = await abre('iphone', 'x"><script>');
ok(raro.beacons.length === 1 && raro.beacons[0].o === 'directo' && (!PT || /ct=directo/.test(raro.tienda || '')), 'una campaña con caracteres raros no viaja: cuenta como «directo»', JSON.stringify(raro));

clearTimeout(RELOJ);
let fallos = 0;
for (const [c, n, d] of res) { console.log('  ' + (c ? '✅' : '❌') + ' ' + n + (c ? '' : '\n        → ' + d)); if (!c) fallos++; }
console.log(fallos ? '❌ /app no lleva a donde debe.' : '✅ /app lleva a cada aparato a su tienda y cuenta el clic en su campaña.');
limpiar(); process.exit(fallos ? 1 : 0);
