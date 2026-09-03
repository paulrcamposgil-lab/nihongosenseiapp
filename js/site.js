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
    if(hv.parentElement) hv.parentElement.style.backgroundImage = 'url(img/' + v[1] + ')';  // fallback de pantalla estrecha, también por piel
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

  /* ---- atribución de campaña, SIN cookies (Code) ----
     Si el visitante llega desde el anuncio (?utm_source=...), se etiquetan los enlaces
     a las tiendas para que las CONSOLAS atribuyan la instalación a la campaña, sin
     trackers ni banner de consentimiento:
       · Google Play  → &referrer=utm_...  (lo captura Play Console · Adquisición)
       · App Store    → ?ct=campaña        (App Store Connect · Analytics · Campañas)
     El visitante orgánico no lleva utm, así que sus clics quedan limpios. */
  try{
    var q = new URLSearchParams(location.search);
    var src = q.get('utm_source');
    if(src){
      var camp = q.get('utm_campaign') || src;
      var med  = q.get('utm_medium') || 'cpc';
      document.querySelectorAll('a[href*="apps.apple.com"]').forEach(function(a){
        var u = new URL(a.href, location.href); u.searchParams.set('ct', camp); a.href = u.toString();
      });
      document.querySelectorAll('a[href*="play.google.com"]').forEach(function(a){
        var u = new URL(a.href, location.href);
        u.searchParams.set('referrer', 'utm_source='+src+'&utm_medium='+med+'&utm_campaign='+camp);
        a.href = u.toString();
      });
    }
  }catch(e){}
})();
