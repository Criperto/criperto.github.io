/* Resorte masa-resorte-amortiguador, calibrado a partir de los SpringAnimation de CripertoShell
   (spring 3.8, damping 0.32, mass 0.75: asienta en unos 450 ms con un pequeño rebote). */
(function () {
  'use strict';

  var OMEGA = 13;   // rad/s: frecuencia natural, deriva de sqrt(spring / mass) de la config QML
  var ZETA = 0.6;   // razón de amortiguación: rebote leve, sin oscilación visible
  var EPS = 0.05;

  function reduced() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  function Spring(x, apply) {
    this.x = x; this.v = 0; this.t = x; this.apply = apply; this.run = false; this.last = 0;
    var self = this;
    this.tick = function (now) {
      if (!self.run) return;
      var dt = Math.min((now - self.last) / 1000, 0.05);
      self.last = now;
      var n = Math.max(1, Math.ceil(dt / (1 / 240)));
      var h = dt / n;
      for (var i = 0; i < n; i++) {
        var a = -OMEGA * OMEGA * (self.x - self.t) - 2 * ZETA * OMEGA * self.v;
        self.v += a * h;
        self.x += self.v * h;
      }
      if (Math.abs(self.x - self.t) < EPS && Math.abs(self.v) < EPS) {
        self.x = self.t; self.v = 0; self.run = false; self.apply(self.x);
        return;
      }
      self.apply(self.x);
      requestAnimationFrame(self.tick);
    };
  }
  Spring.prototype.stop = function () {
    this.run = false;
  };
  Spring.prototype.to = function (t, instant) {
    this.t = t;
    if (instant || reduced()) { this.x = t; this.v = 0; this.run = false; this.apply(t); return; }
    if (!this.run) { this.run = true; this.last = performance.now(); requestAnimationFrame(this.tick); }
  };

  /* Resalte que se desliza detrás del elemento activo de `host`. */
  function slider(host) {
    var ind = document.createElement('span');
    ind.className = 'ind';
    ind.setAttribute('aria-hidden', 'true');
    ind.style.opacity = '0';
    host.insertBefore(ind, host.firstChild);

    var vx = 0, vy = 0, vw = 0, vh = 0;
    function paint() {
      ind.style.transform = 'translate(' + vx + 'px,' + vy + 'px)';
      ind.style.width = Math.max(vw, 0) + 'px';
      ind.style.height = Math.max(vh, 0) + 'px';
    }
    var sx = new Spring(0, function (v) { vx = v; paint(); });
    var sy = new Spring(0, function (v) { vy = v; paint(); });
    var sw = new Spring(0, function (v) { vw = v; paint(); });
    var sh = new Spring(0, function (v) { vh = v; paint(); });

    var current = null, placed = false;

    function moveTo(el, instant) {
      current = el;
      if (!el || !el.offsetWidth) { ind.style.opacity = '0'; placed = false; return; }
      var snap = instant || !placed;
      ind.style.opacity = '1';
      sx.to(el.offsetLeft, snap); sy.to(el.offsetTop, snap);
      sw.to(el.offsetWidth, snap); sh.to(el.offsetHeight, snap);
      placed = true;
    }

    if ('ResizeObserver' in window) {
      var pending = false;
      new ResizeObserver(function () {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () { pending = false; if (current) moveTo(current, true); });
      }).observe(host);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (current) moveTo(current, true); });

    return { moveTo: moveTo };
  }

  /* Entrada con resorte del texto que acaba de cambiar de idioma. */
  var TEXT_SEL = '[data-i18n], .repo-desc, #bio, .meta dd, .gal-pause, .gal-empty';

  function textIn(root) {
    if (reduced()) return;
    var els = Array.prototype.slice.call((root || document).querySelectorAll(TEXT_SEL));
    var vh = window.innerHeight;
    var order = 0;
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh || !r.width) return;
      if (el._spTimer) { clearTimeout(el._spTimer); el._spTimer = null; }
      if (el._spAnim) { el._spAnim.stop(); el._spAnim = null; }
      // Cancela animation-fill-mode: forwards (ej. @keyframes enter) para que transform/opacity en línea tengan efecto.
      el.style.animation = 'none';
      el.style.willChange = 'transform, opacity';
      var p = new Spring(0, function (v) {
        if (el._spAnim !== p) return;
        el.style.opacity = String(Math.min(Math.max(v, 0), 1));
        el.style.transform = 'translateY(' + ((1 - v) * 10) + 'px)';
        if (v === 1) {
          el._spAnim = null;
          el.style.opacity = '';
          el.style.transform = '';
          el.style.willChange = '';
        }
      });
      el._spAnim = p;
      el.style.opacity = '0';
      el.style.transform = 'translateY(10px)';
      var delay = Math.min(order * 22, 220);
      order++;
      el._spTimer = setTimeout(function () {
        el._spTimer = null;
        p.to(1);
      }, delay);
    });
  }

  window.CPSpring = { Spring: Spring, slider: slider, textIn: textIn };
})();
