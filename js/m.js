/* El contador de la web, en TODAS las páginas: anónimo, sin cookies y sin guardar nada en el navegador.
   Manda: la página, el canal (utm_source de una lista cerrada), el dominio del que se llega (solo el
   dominio), la zona horaria (para un país aproximado, sin IP), si es una visita nueva (llega de fuera)
   o se navega por dentro, cuánto tiempo estuvo (al irse) y los clics a las tiendas. El servidor solo
   suma contadores; nada identifica a nadie. */
(function () {
  var M = 'https://nihongo-sensei-metricas.nihongosenseiapp.deno.net/m';
  var CANALES = ['instagram', 'reddit', 'discord', 'clase', 'web', 'meta-es', 'meta-en'];
  var canal = 'directo', ref = '', tz = '';
  try {
    var s = new URLSearchParams(location.search).get('utm_source');
    if (s && CANALES.indexOf(s) !== -1) canal = s;
  } catch (e) {}
  try { if (document.referrer) ref = new URL(document.referrer).hostname; } catch (e) {}
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var pag = document.documentElement.hasAttribute('data-404') ? '/404' : location.pathname;
  var dentro = /(^|\.)nihongosenseiapp\.com$/.test(ref);

  function manda(o) {
    try {
      o.o = canal; o.p = pag; o.r = ref;
      var b = JSON.stringify(o);
      if (navigator.sendBeacon && navigator.sendBeacon(M, b)) return;
      fetch(M, { method: 'POST', body: b, keepalive: true, mode: 'no-cors' });
    } catch (e) {}
  }

  manda({ e: 'visit', n: dentro ? 0 : 1, z: dentro ? '' : tz });

  var t0 = Date.now(), ido = false;
  function vete() {
    if (ido) return;
    ido = true;
    manda({ e: 'dur', s: Math.round((Date.now() - t0) / 1000) });
  }
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') vete(); });
  addEventListener('pagehide', vete);

  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    if (/apps\.apple\.com/.test(a.href)) manda({ e: 'ios' });
    else if (/play\.google\.com/.test(a.href)) manda({ e: 'android' });
  }, true);
})();
