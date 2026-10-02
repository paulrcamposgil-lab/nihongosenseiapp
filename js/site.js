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
    kaiju:  ['intro_kaiju.mp4', 'poster_kaiju.webp'],
    yugen:  ['intro_yugen.mp4', 'poster_yugen.webp']
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
  /* ── EL CAMBIO DE ESTILO, SUAVE (Paul, 28-sep: «el cambio es brusco») ─────────────────
     · Se PRECARGA lo nuevo antes de tocar nada: las capturas del estilo (NS_SKIN_IMGS, de la portada)
       y la intro (un <video> escondido que ya tiene su primer fotograma). Nunca un hueco en blanco ni
       la imagen vieja saltando.
     · Con View Transitions, fundido de TODA la pagina en 400 ms; durante el, sin transiciones
       propias (html.ns-vt), o habria dos fundidos a la vez.
     · Sin ellas: colores a 400 ms (html.ns-cambia: fondo, texto, bordes y sombras; nada de layout) y
       las imagenes y la intro se funden por encima de las viejas y las sustituyen al acabar.
     · Cambios rapidos seguidos: cada cambio lleva su numero; el que llega tarde no pinta nada, y la
       transicion en curso se corta.
     · «Reducir movimiento», y el primer pintado al abrir: cambio instantaneo, como siempre. */
  var _turno = 0, _vtEnCurso = null, DUR = 400;
  var _reduce = function(){ try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } };
  function _aplicaYa(id){
    root.setAttribute('data-appearance', id);
    document.querySelectorAll('.skin').forEach(function(b){
      b.setAttribute('aria-pressed', b.dataset.set === id ? 'true' : 'false');
    });
    _heroVideo(id);
    if(typeof window.NS_AFTER_SKIN === 'function'){ window.NS_AFTER_SKIN(id); }   // la portada repinta sus capturas
    try{ localStorage.setItem('ns-skin', id); }catch(e){}
  }
  function _precargaImg(src){ return new Promise(function(ok){ var im = new Image(); im.onload = im.onerror = function(){ ok(im); }; im.src = src; if(im.complete) ok(im); }); }
  function _precargaVideo(id){
    return new Promise(function(ok){
      var v = _VIDS[(id || '').split('-')[0]], hv = document.querySelector('.hero-video video');
      if(!v || !hv || hv.getAttribute('src') === 'img/' + v[0]) return ok(null);
      var nv = hv.cloneNode(false); nv.setAttribute('poster', 'img/' + v[1]); nv.setAttribute('src', 'img/' + v[0]);
      nv.muted = true; nv.setAttribute('muted', ''); nv.preload = 'auto';
      var listo = false, fin = function(){ if(listo) return; listo = true; ok(nv); };
      nv.addEventListener('loadeddata', fin); setTimeout(fin, 2500);   // si la red va lenta, no se espera para siempre
      try{ nv.load(); }catch(e){ fin(); }
    });
  }
  function applySkin(id, inmediato){
    var mio = ++_turno;
    if(_vtEnCurso && _vtEnCurso.skipTransition){ try{ _vtEnCurso.skipTransition(); }catch(e){} }
    if(inmediato || _reduce()){ _aplicaYa(id); return; }
    var imgs = (typeof window.NS_SKIN_IMGS === 'function') ? window.NS_SKIN_IMGS(id) : [];
    Promise.all([_precargaVideo(id)].concat(imgs.map(function(x){ return _precargaImg(x.src); }))).then(function(res){
      if(mio !== _turno) return;                          // ya se ha pedido otro estilo: este no pinta nada
      var nv = res[0], hv = document.querySelector('.hero-video video');
      var cambiaVideo = function(){ if(nv && hv && hv.parentNode){ hv.parentNode.replaceChild(nv, hv); try{ var pr = nv.play(); if(pr && pr.catch) pr.catch(function(){}); }catch(e){} } };
      if(document.startViewTransition){
        root.classList.add('ns-vt');
        var vt = _vtEnCurso = document.startViewTransition(function(){ cambiaVideo(); _aplicaYa(id); });
        var limpia = function(){ if(_vtEnCurso === vt){ _vtEnCurso = null; root.classList.remove('ns-vt'); } };
        vt.finished.then(limpia, limpia);
        return;
      }
      // sin View Transitions: colores a 400 ms y fundido cruzado de las imagenes y de la intro
      root.classList.add('ns-cambia');
      imgs.forEach(function(x){
        var fig = x.el.parentNode; if(!fig) return;
        var capa = x.el.cloneNode(false); capa.className = (capa.className ? capa.className + ' ' : '') + 'ns-xfade';
        capa.setAttribute('src', x.src); capa.style.opacity = '0'; fig.appendChild(capa);
        requestAnimationFrame(function(){ capa.style.opacity = '1'; });
        setTimeout(function(){ if(mio === _turno) x.el.setAttribute('src', x.src); if(capa.parentNode) capa.parentNode.removeChild(capa); }, DUR + 30);
      });
      if(nv && hv && hv.parentNode){
        nv.classList.add('ns-xfade'); nv.style.opacity = '0'; hv.parentNode.appendChild(nv);
        try{ var pr2 = nv.play(); if(pr2 && pr2.catch) pr2.catch(function(){}); }catch(e){}
        requestAnimationFrame(function(){ nv.style.opacity = '1'; });
        setTimeout(function(){ if(hv.parentNode) hv.parentNode.removeChild(hv); nv.classList.remove('ns-xfade'); nv.style.opacity = ''; }, DUR + 30);
      }
      _aplicaYa(id);
      setTimeout(function(){ if(mio === _turno) root.classList.remove('ns-cambia'); }, DUR + 60);
    });
  }
  document.querySelectorAll('[data-set]').forEach(function(b){
    b.addEventListener('click', function(){ applySkin(b.dataset.set); });
  });
  /* el <head> ya estampó data-appearance; aquí solo se refleja en los aria-pressed */
  try{ var sv = localStorage.getItem('ns-skin'); if(sv) applySkin(sv, true); }catch(e){}   // al abrir: sin animar
  _heroVideo(root.getAttribute('data-appearance') || 'sakura');   // carga el vídeo de la piel activa al abrir

  /* ---- idioma ----
     La portada define window.NS_STRINGS (las cadenas de los [data-t]) y,
     si quiere, window.NS_AFTER_LANG (para repintar lo que dependa del idioma). Las
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

  /* ---- EL BOTÓN GRANDE LLEVA A LA TIENDA DEL QUE MIRA (15-sep-2026) --------
     Estaba clavado en apps.apple.com. Es el único botón que se ve sin bajar, así que
     un visitante con Android pulsaba «Descargar» y acababa en la App Store, que en su
     teléfono no le ofrece nada; los badges de las dos tiendas viven al final de una
     página larga. Desde el 4 de septiembre hay campañas pagando por traer gente aquí.

     Cuando NO se sabe qué aparato es (escritorio, un navegador raro), no se adivina:
     se baja a la sección de descarga, que enseña los dos badges y deja elegir. Es la
     misma regla que rompió esto — decidir por el visitante— aplicada al revés.

     Va ANTES del bloque de métricas a propósito: ése engancha los contadores mirando
     el href, así que reescribirlo aquí hace que el clic se cuente en la tienda que de
     verdad se abre, y que el referrer de Play se añada al enlace bueno. */
  var IOS_URL = 'https://apps.apple.com/app/id6789333985';
  var AND_URL = 'https://play.google.com/store/apps/details?id=com.nihongonosensei.app';
  function sistema(){
    // userAgentData primero: es el dato que los navegadores están dejando de meter en
    // el user-agent (Chrome lo congela por privacidad), así que el UA a secas envejece.
    try{
      var p = navigator.userAgentData && navigator.userAgentData.platform;
      if(p){
        if(/android/i.test(p)) return 'android';
        if(/ios|iphone|ipad/i.test(p)) return 'ios';
      }
    }catch(e){}
    var ua = navigator.userAgent || '';
    if(/Android/i.test(ua)) return 'android';
    // iPadOS 13+ se presenta como un Mac: se distingue por el táctil.
    if(/iPad|iPhone|iPod/.test(ua)) return 'ios';
    if(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios';
    return null;
  }
  try{
    var cta = document.getElementById('ctaDescarga');
    if(cta){
      var so = sistema();
      if(so === 'android') cta.href = AND_URL;
      else if(so === 'ios') cta.href = IOS_URL;
      else cta.href = '#descargar';   // que elija él, con los dos badges delante
    }
  }catch(e){}

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
