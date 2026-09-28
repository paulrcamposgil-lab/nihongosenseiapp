#!/usr/bin/env node
/**
 * web20_test.mjs · la web al dia con la 2.0, en los DOS idiomas.
 *
 *     node test/web20_test.mjs
 *
 * Se carga la pagina de verdad y se lee lo pintado tras pulsar el boton de idioma: el
 * titular «Llegó el sensei», la intro del ESTILO elegido en el hero (no el reel: ese es para
 * Instagram), las diez capturas del idioma (enteras en escritorio, en tira en movil),
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
const URL_WEB = process.env.WEB_URL || `http://127.0.0.1:${srv.address().port}/index.html`;
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
      precio: q('[data-t=precioC]'), yugen: q('[data-t=s5p1]'), texto: document.body.innerText,
      ap: document.documentElement.getAttribute('data-appearance') || '',
      salas: [].map.call(document.querySelectorAll('[data-t=s4h]')[0].closest('.wrap').querySelectorAll('.room h3'), function (h) { return h.textContent.trim(); }),
      s4h: q('[data-t=s4h]'), noa: q('[data-t=pjNoa]'), nico: q('[data-t=pjNico]'), hachi: q('[data-t=pjHachi]'), goma: q('[data-t=pjGoma]'), imgs: [].map.call(document.querySelectorAll('.cast .pj img'), function (i) { return i.getAttribute('src'); }).join(','), real: document.querySelectorAll('.pj-real,[data-t=pjReal]').length,
      tag: q('[data-t=tag]'), bloque: document.querySelector('[data-t=precioP]').closest('section').innerText.replace(/\\s+/g, ' ') });
  })()` });
  return JSON.parse(r.result.value);
};
const E = { es: { noa: 'Su hermana pequeña. Estudia en Osaka.', nico: 'Viaja a Japón y aprende contigo.', hachi: 'Shiba roja. La seria.', goma: 'Shiba negra y fuego. La alegre.', clsHist: 'Nico y Noa, dos hermanos de Barcelona, llegan a Japón con sus perras Hachi y Goma', sala0: 'Aprender', ocho: /^Ocho salas/, gratis: /^Vocabulario gratis/, libre: 'Gratis: el vocabulario de las 30 lecciones con su audio', precioN: '19,99 €', h1: 'Llegó el sensei', sub: 'Aprende japonés con Nihongo Sensei', n: '1.224', cls: 'Clases con historia', clsP: /^Nihongo Sensei ahora te da clase/, real: 'Siena y Luna existen de verdad.', precio: /19,99 € al año.*7 días gratis/ },
            en: { noa: 'His younger sister. She studies in Osaka.', nico: 'Travels to Japan and learns with you.', hachi: 'Red shiba. The serious one.', goma: 'Black and tan shiba. The cheerful one.', clsHist: 'Nico and Noa, a brother and sister from Barcelona, arrive in Japan with their dogs Hachi and Goma', sala0: 'Learn', ocho: /^Eight training rooms/, gratis: /^Free vocabulary/, libre: 'Free: the vocabulary of all 30 lessons with audio', precioN: '€19.99', h1: 'The sensei is here', sub: 'Learn Japanese with Nihongo Sensei', n: '1,224', cls: 'Classes with a story', clsP: /^Nihongo Sensei now teaches you/, real: 'Siena and Luna are real.', precio: /€19\.99 a year.*7-day free trial/ } };
for (const L of ['es', 'en']) {
  const d = await lee(L), e = E[L];
  ok(d.h1 === e.h1 && d.sub === e.sub, L + ' · el hero dice «' + e.h1 + '» y debajo «' + e.sub + '»', d.h1 + ' | ' + d.sub);
  ok(d.shots.length === 10 && d.shots.every((s, i) => /^img\/cap\/(sakura|aki|fuyu)-(dark|light)|^img\/cap\/(kaiju|yugen)/.test(s.src) && s.src.endsWith('-' + L + '-' + String(i + 1).padStart(2, '0') + '.webp') && s.alt), L + ' · las diez capturas, las de su idioma y en orden, con su texto', JSON.stringify(d.shots.slice(0, 3)));
  ok(d.nums[0] === e.n && d.nums[1] === '290' && d.nums[2] === '30', L + ' · las cifras: ' + e.n + ' palabras, 290 kanji, 30 lecciones', d.nums.join(' '));
  ok(d.clsH === e.cls && e.clsP.test(d.clsP), L + ' · la seccion de clases con historia', d.clsH + ' | ' + d.clsP.slice(0, 50));
  ok(d.pjs.join(',') === 'Nico,Noa,Hachi,Goma' && d.imgs === 'img/pj-nico.svg,img/pj-noa.svg,img/pj-hachi.svg,img/pj-goma.svg', L + ' · los personajes son Nico, Noa, Hachi y Goma, cada uno con su dibujo', d.pjs.join(',') + ' | ' + d.imgs);
  ok(d.nico === e.nico && d.noa === e.noa && d.hachi === e.hachi && d.goma === e.goma, L + ' · y cada uno dice lo que es (Noa, la hermana pequeña)', [d.nico, d.noa, d.hachi, d.goma].join(' | '));
  ok(d.clsP.indexOf(e.clsHist) >= 0, L + ' · «Clases con historia»: dos hermanos de Barcelona con Hachi y Goma', d.clsP.slice(0, 200));
  ok(!/\b(Paul|M[óo]nica|Siena|Luna)\b|pareja|partner/.test(d.texto), L + ' · ni un nombre de antes en toda la pagina, ni «pareja»', (d.texto.match(/\b(Paul|M[óo]nica|Siena|Luna)\b|pareja|partner/) || [''])[0]);
  ok(d.real === 0 && !/existen de verdad|are real/.test(d.texto), L + ' · y ya no dice que las perras existen de verdad (ni el parrafo vacio)', 'pj-real: ' + d.real);
  ok(d.salas.length === 8 && d.salas[0] === e.sala0 && d.salas.indexOf('Kanji') >= 0 && e.ocho.test(d.s4h) && !/(seis|six|siete|seven) (salas|rooms)|(Seis|Six|Siete|Seven) /.test(d.texto), L + ' · el dojo: ocho salas, la primera ' + e.sala0 + ', con Kanji, y ningun «seis»/«siete»', d.s4h + ' | ' + d.salas.join(','));
  ok(e.gratis.test(d.tag) && (d.texto.split(e.libre).length - 1) >= 1 && (d.bloque.split(e.libre).length - 1) === 1 && (d.texto.split(e.precioN).length - 1) === 1 && !/curso entero es gratis|whole course is free|se queda gratis|stays free/.test(d.texto), L + ' · lo gratis: etiqueta, la lista una vez en «Qué cuesta», el precio una sola vez', d.tag + ' | precio×' + (d.texto.split(e.precioN).length - 1));
  ok(!/Marco|Gus\b|Kimura/.test(d.texto), L + ' · y ni Marco, ni Gus, ni Kimura en toda la pagina', (d.texto.match(/Marco|Gus\b|Kimura/) || [''])[0]);
  ok(e.precio.test(d.precio), L + ' · el precio del dojo, a la vista', d.precio);
  ok(/Yūgen/.test(d.yugen), L + ' · Yūgen, el estilo nuevo', d.yugen.slice(0, 60));
  ok(!/\b(978|1\.?061|994|966)\b/.test(d.texto), L + ' · ninguna cifra vieja', (d.texto.match(/\b(978|1\.?061|994|966)\b/) || [''])[0]);
}
// EL HERO LLEVA LA INTRO DEL ESTILO ELEGIDO, y cambia al cambiar de estilo. Uno a uno, pulsando el
// boton de colores de verdad (regla 5: cada estilo solo).
const INTRO = { 'sakura-dark': 'img/intro_web.mp4', 'aki-dark': 'img/intro_aki.mp4', 'fuyu-dark': 'img/intro_fuyu.mp4', 'kaiju': 'img/intro_kaiju.mp4', 'yugen': 'img/intro_yugen.mp4' };
for (const [set, esperado] of Object.entries(INTRO)) {
  await env('Runtime.evaluate', { expression: `(function(){ var b = document.querySelector('[data-set="${set}"]'); if (b) b.click(); })()` });
  await new Promise((z) => setTimeout(z, 1100));   // el cambio precarga y funde: se lee cuando ha acabado
  const r = await env('Runtime.evaluate', { returnByValue: true, expression: `(function(){ var v = document.querySelector('.hero-video video'); return v ? v.getAttribute('src') : ''; })()` });
  ok(r.result.value === esperado, 'estilo ' + set + ' · el hero lleva su intro', r.result.value);
}
// «ASÍ SE VE» EN EL COLOR DEL ESTILO: cada una de las ocho apariencias, sola, pulsando su boton; las diez
// capturas piden los ficheros de esa apariencia y del idioma, y esos ficheros existen de verdad.
for (const ap of ['sakura-dark', 'sakura-light', 'aki-dark', 'aki-light', 'fuyu-dark', 'fuyu-light', 'kaiju', 'yugen']) {
  await env('Runtime.evaluate', { expression: `(function(){ var b = document.querySelector('[data-set="${ap}"]'); if (b) b.click(); })()` });
  await new Promise((z) => setTimeout(z, 1100));
  const r = await env('Runtime.evaluate', { returnByValue: true, expression: `(function(){
    return JSON.stringify([].map.call(document.querySelectorAll('.shots-row img:not(.ns-xfade)'), function (i) { return i.getAttribute('src'); })); })()` });
  const srcs = JSON.parse(r.result.value);
  const faltan = [];
  for (const s of srcs) { const f = path.join(RAIZ, s); if (!process.env.WEB_URL && !fs.existsSync(f)) faltan.push(s); }
  ok(srcs.length === 10 && srcs.every((s) => s.startsWith('img/cap/' + ap + '-')) && !faltan.length, 'estilo ' + ap + ' · las capturas son las de ese estilo (y existen)', (srcs[0] || '') + ' ' + faltan.slice(0, 2).join(' '));
}
// ── EL CAMBIO DE ESTILO, SUAVE (Paul: «el cambio es brusco») ──────────────────────────────────────────
const leeJs = async (js) => JSON.parse((await env('Runtime.evaluate', { returnByValue: true, expression: '(function(){' + js + '})()' })).result.value);
const zz = (ms) => new Promise((z) => setTimeout(z, ms));
const pulsa = (ap) => env('Runtime.evaluate', { expression: `(function(){ var b = document.querySelector('[data-set="${ap}"]'); if (b) b.click(); })()` });
const ESTADO = "var v = document.querySelectorAll('.hero-video video'), sh = [].slice.call(document.querySelectorAll('.shots-row img:not(.ns-xfade)'));" +
  "return JSON.stringify({ ap: document.documentElement.getAttribute('data-appearance'), videos: v.length, vid: v.length ? v[0].getAttribute('src') : '', caps: sh.map(function (i) { return i.getAttribute('src'); })," +
  " capas: document.querySelectorAll('.ns-xfade').length, clases: document.documentElement.className });";
const final = (e, ap, intro) => e.ap === ap && e.videos === 1 && e.vid === intro && e.caps.length === 10 && e.caps.every((c) => c.indexOf('img/cap/' + ap + '-') === 0) && e.capas === 0 && !/ns-vt|ns-cambia/.test(e.clases);
// (a) cambios rapidos seguidos: cuatro estilos a 120 ms; al final, el ultimo, entero, sin capas ni videos de sobra
await pulsa('sakura-dark'); await zz(1100);
for (const ap of ['aki-light', 'fuyu-dark', 'kaiju', 'yugen']) { await pulsa(ap); await zz(120); }
await zz(1500);
const rap = await leeJs(ESTADO);
ok(final(rap, 'yugen', 'img/intro_yugen.mp4'), 'estilos · cuatro cambios seguidos: acaba en el ultimo, con su intro y sus capturas, sin capas ni videos de sobra', JSON.stringify(rap).slice(0, 220));
// (a2) EL QUE LLEGA TARDE NO PINTA: con red lenta, un estilo pedido antes puede terminar de cargar DESPUES
// de otro pedido luego. Se frena LA RED —desde el navegador, interceptando— solo para las capturas de
// aki-light (900 ms), en español para que no salgan de la cache; se pide aki-light, al momento yugen, y
// tiene que quedar yugen. Sin el numero de turno, aki-light pisaba a yugen al llegar.
await env('Runtime.evaluate', { expression: "document.querySelector('.lang button[data-lang=es]').click();" });
await pulsa('sakura-dark'); await zz(1100);
const _onmsg = ws.onmessage;
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.method === 'Fetch.requestPaused') { const rid = m.params.requestId; setTimeout(() => { env('Fetch.continueRequest', { requestId: rid }); }, 900); return; } _onmsg(e); };
await env('Fetch.enable', { patterns: [{ urlPattern: '*aki-light-*' }] });
await pulsa('aki-light'); await zz(60); await pulsa('yugen'); await zz(2600);
const tarde = await leeJs(ESTADO);
await env('Fetch.disable'); ws.onmessage = _onmsg;
ok(final(tarde, 'yugen', 'img/intro_yugen.mp4'), 'estilos · con red lenta, el estilo pedido antes no pisa al ultimo', JSON.stringify(tarde).slice(0, 200));
// (b) nunca un hueco en blanco: a mitad del cambio, las capturas que se ven estan cargadas y hay un video
await pulsa('sakura-light'); await zz(150);
const medio = await leeJs("var sh = [].slice.call(document.querySelectorAll('.shots-row img')); return JSON.stringify({ vacias: sh.filter(function (i) { return !i.getAttribute('src') || (i.complete && i.naturalWidth === 0); }).length, videos: document.querySelectorAll('.hero-video video').length });");
ok(medio.vacias === 0 && medio.videos >= 1, 'estilos · a mitad del fundido no hay ninguna captura vacia ni se queda sin intro', JSON.stringify(medio));
await zz(1200);
// (c) sin View Transitions: los colores cambian con 400 ms, las capas se funden y se van
await env('Runtime.evaluate', { expression: "window.__vt = document.startViewTransition; document.startViewTransition = undefined;" });
await pulsa('fuyu-light'); await zz(1100);
const durante = await leeJs("var c = document.querySelector('.room') || document.body; return JSON.stringify({ clase: document.documentElement.classList.contains('ns-cambia'), dur: getComputedStyle(c).transitionDuration });");
await pulsa('aki-dark'); await zz(250);
const enMedio = await leeJs("var c = document.querySelector('.room') || document.body; return JSON.stringify({ clase: document.documentElement.classList.contains('ns-cambia'), dur: getComputedStyle(c).transitionDuration, capas: document.querySelectorAll('.ns-xfade').length });");
await zz(1000);
const tras = await leeJs(ESTADO);
await env('Runtime.evaluate', { expression: "document.startViewTransition = window.__vt;" });
ok(enMedio.clase && /0\.4s/.test(enMedio.dur) && enMedio.capas > 0, 'estilos · sin View Transitions: colores a 400 ms y fundido cruzado por capas', JSON.stringify(enMedio));
ok(final(tras, 'aki-dark', 'img/intro_aki.mp4'), 'estilos · sin View Transitions: al acabar, sin capas ni clase, y todo del estilo nuevo', JSON.stringify(tras).slice(0, 200));
// (d) «reducir movimiento»: instantaneo (se lee en el mismo instante del clic)
await env('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
const inst = await leeJs("document.querySelector('[data-set=kaiju]').click(); " + ESTADO);
await env('Emulation.setEmulatedMedia', { features: [] });
ok(final(inst, 'kaiju', 'img/intro_kaiju.mp4'), 'estilos · con «reducir movimiento», el cambio es instantaneo', JSON.stringify(inst).slice(0, 200));
const sinReel = await env('Runtime.evaluate', { returnByValue: true, expression: "document.documentElement.outerHTML.indexOf('reel_') < 0" });
ok(sinReel.result.value === true, 'el reel de Instagram no esta en la web', '');
// LA TIRA: en movil se desliza; en escritorio, las diez enteras, dos filas de cinco dentro del ancho.
const tira = async () => JSON.parse((await env('Runtime.evaluate', { returnByValue: true, expression: `(function(){
  var row = document.querySelector('.shots-row'), ims = [].slice.call(row.querySelectorAll('img'));
  var tops = {}; var fuera = ims.filter(function (i) { var r = i.getBoundingClientRect(); tops[Math.round(r.top)] = 1; return r.left < -1 || r.right > document.documentElement.clientWidth + 1; }).length;
  return JSON.stringify({ n: ims.length, fuera: fuera, filas: Object.keys(tops).length, desliza: row.scrollWidth > row.clientWidth + 2 });
})()` })).result.value);
const movil = await tira();
ok(movil.desliza === true, 'movil · la tira de capturas se desliza', JSON.stringify(movil));
await env('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
await new Promise((r) => setTimeout(r, 600));
const escr = await tira();
ok(escr.n === 10 && escr.fuera === 0 && escr.filas === 2 && escr.desliza === false, 'escritorio · las diez capturas enteras, en dos filas, sin cortarse', JSON.stringify(escr));

let fallos = 0;
for (const [okk, nombre, det] of res) { console.log(`  ${okk ? '✅' : '❌'} ${nombre}${okk ? '' : '\n        → ' + det}`); if (!okk) fallos++; }
console.log(`\n${res.length - fallos}/${res.length} comprobaciones en verde`);
ws.close(); limpiar();
process.exit(fallos ? 1 : 0);
