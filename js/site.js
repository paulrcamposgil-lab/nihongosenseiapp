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
  function applySkin(id){
    root.setAttribute('data-appearance', id);
    document.querySelectorAll('.skin').forEach(function(b){
      b.setAttribute('aria-pressed', b.dataset.set === id ? 'true' : 'false');
    });
    try{ localStorage.setItem('ns-skin', id); }catch(e){}
  }
  document.querySelectorAll('[data-set]').forEach(function(b){
    b.addEventListener('click', function(){ applySkin(b.dataset.set); });
  });
  /* el <head> ya estampó data-appearance; aquí solo se refleja en los aria-pressed */
  try{ var sv = localStorage.getItem('ns-skin'); if(sv) applySkin(sv); }catch(e){}

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
})();
