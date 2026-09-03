/* ============================================================
   site.js · cabecera COMPARTIDA: apariencia, idioma y su
   persistencia en localStorage. Lo cargan la portada y las
   páginas hijas (privacy/terms/support).

   La PRIMERA pintura (anti-parpadeo de la apariencia) la hace un
   <script> síncrono en el <head> de cada página, antes del CSS.
   Esto solo añade la interactividad y marca los botones después
   de cargar.
   ============================================================ */
(function(){
  "use strict";
  var root = document.documentElement;

  /* ---- apariencia ---- */
  /* El vídeo del hero cambia con la piel, y SOLO se descarga el de la piel elegida
     (carga perezosa): se cambia el src cuando la piel cambia, no se precargan los cuatro. */
  var _VIDS = {
    sakura: ['intro_web.mp4', 'intro_poster.webp'],
    aki:    ['intro_aki.mp4', 'poster_aki.webp'],
    fuyu:   ['intro_fuyu.mp4', 'poster_fuyu.webp'],
    kaiju:  ['intro_kaiju.mp4', 'poster_kaiju.webp']
  };
  function _heroVideo(id){
    var v = _VIDS[(id || '').split('-')[0]]; if(!v) return;
    var hv = document.querySelector('.hero-video video'); if(!hv) return;
    var src = 'img/' + v[0];
    if(hv.getAttribute('src') === src) return;      // ya es el de esta piel: no recargar
    hv.setAttribute('poster', 'img/' + v[1]);
    hv.setAttribute('src', src);
    try{ hv.load(); var pr = hv.play(); if(pr && pr.catch) pr.catch(function(){}); }catch(e){}
  }
  function applySkin(id){
    root.setAttribute('data-appearance', id);
    document.querySelectorAll('.skin').forEach(function(b){
      b.setAttribute('aria-pressed', b.dataset.set === id ? 'true' : 'false');
    });
    _heroVideo(id);
    try{ localStorage.setItem('ns-skin', id); }catch(e){}
  }
  document.querySelectorAll('[data-set]').forEach(function(b){
    b.addEventListener('click', function(){ applySkin(b.dataset.set); });
  });
  /* el <head> ya estampó data-appearance; aquí solo se refleja en los aria-pressed */
  try{ var sv = localStorage.getItem('ns-skin'); if(sv) applySkin(sv); }catch(e){}
  _heroVideo(root.getAttribute('data-appearance') || 'sakura');   // carga el vídeo de la piel activa al abrir

  /* ---- idioma ----
     La portada define window.NS_STRINGS (las cadenas de los [data-t]) y,
     si quiere, window.NS_AFTER_LANG (para repintar el ejercicio). Las
     hijas NO tienen NS_STRINGS: en ellas el selector solo guarda la
     preferencia y marca el botón. El texto legal no se traduce ni se toca. */
  function applyLang(L){
    var S = window.NS_STRINGS;
    if(S){
      root.setAttribute('lang', L);
      var d = S[L] || {};
      document.querySelectorAll('[data-t]').forEach(function(el){
        var k = el.dataset.t;
        if(d[k] !== undefined) el.innerHTML = d[k];
      });
    }
    document.querySelectorAll('.lang button').forEach(function(b){
      b.setAttribute('aria-pressed', b.dataset.lang === L ? 'true' : 'false');
    });
    if(typeof window.NS_AFTER_LANG === 'function'){ window.NS_AFTER_LANG(L); }
    try{ localStorage.setItem('ns-lang', L); }catch(e){}
  }
  document.querySelectorAll('.lang button').forEach(function(b){
    b.addEventListener('click', function(){ applyLang(b.dataset.lang); });
  });

  var start = 'es';
  try{
    var sl = localStorage.getItem('ns-lang');
    if(sl) start = sl;
    else if(!/^es/i.test(navigator.language || '')) start = 'en';
  }catch(e){}
  applyLang(start);

  /* ---- atribución de campaña + contador de embudo, SIN cookies (brief de Code, 3-sep) ----

     DOS medidas, que responden a preguntas distintas:

     1) INSTALACIONES por campaña — lo cuentan las CONSOLAS de las tiendas, no esta
        página. Para Android se reenvía el utm como `referrer` y Play Console lo recoge
        en Adquisición. Para iOS NO se compone nada: App Store no va por UTM, sino por
        los Campaign Links que GENERA Apple (App Analytics -> Campaigns); Paul crea uno
        por canal y ese enlace ya trae su token. Componer un ct a mano -como hacía la
        versión anterior- no registra ninguna campaña en App Store Connect: era humo.

     2) EMBUDO de la página por canal — lo cuenta este beacon contra el servicio propio
        nihongo-sensei-metricas (Deno KV, agregado, sin cookie ni IP). Mide lo que las
        tiendas no ven: de quien LLEGA de cada canal, cuántos PULSAN descargar. El canal
        sale del utm_source de entrada; si no hay, es directo. */

  var METRICAS = 'https://nihongo-sensei-metricas.nihongosenseiapp.deno.net/m';
  var CANALES = ['instagram', 'reddit', 'discord', 'clase', 'web'];
  var canal = 'directo';
  try{
    var q = new URLSearchParams(location.search);
    var src = q.get('utm_source');
    if(src && CANALES.indexOf(src) !== -1) canal = src;

    // Android: reenviar el utm como referrer para que Play Console atribuya la instalación.
    if(src){
      var camp = q.get('utm_campaign') || src;
      var med  = q.get('utm_medium') || 'social';
      document.querySelectorAll('a[href*="play.google.com"]').forEach(function(a){
        var u = new URL(a.href, location.href);
        u.searchParams.set('referrer', 'utm_source='+src+'&utm_medium='+med+'&utm_campaign='+camp);
        a.href = u.toString();
      });
    }
  }catch(e){}

  /* El beacon: sobrevive a que la página se vaya a la tienda (por eso sendBeacon y no
     fetch), manda text/plain -petición simple, sin preflight- y nunca bloquea la
     navegación. Si el navegador no lo soporta o falla, no pasa nada: un clic sin contar
     es mejor que un clic que se retrasa. */
  function marca(evento){
    try{
      var cuerpo = JSON.stringify({ e: evento, o: canal });
      if(navigator.sendBeacon){ navigator.sendBeacon(METRICAS, cuerpo); return; }
      fetch(METRICAS, { method:'POST', body:cuerpo, keepalive:true, mode:'no-cors' });
    }catch(e){}
  }

  marca('visit');
  document.querySelectorAll('a[href*="apps.apple.com"]').forEach(function(a){
    a.addEventListener('click', function(){ marca('ios'); });
  });
  document.querySelectorAll('a[href*="play.google.com"]').forEach(function(a){
    a.addEventListener('click', function(){ marca('android'); });
  });
})();
