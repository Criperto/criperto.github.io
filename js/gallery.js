/* Galería de capturas del README con visor ampliado, soporte vertical en móvil y botón compacto de pausa. */
(function () {
  'use strict';

  function iconSvg(kind) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'currentColor');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', kind === 'play'
      ? 'M8 5.14v13.72a1 1 0 0 0 1.52.85l10.86-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14z'
      : 'M7 5h3.5v14H7zm6.5 0H17v14h-3.5z');
    svg.appendChild(p);
    return svg;
  }

  function make(repo, opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'gal';
    var imgs = repo.images || [];

    if (!imgs.length) {
      var empty = document.createElement('p');
      empty.className = 'gal-empty';
      empty.setAttribute('data-i18n', 'repo.noimg');
      empty.textContent = CP.t('repo.noimg');
      wrap.appendChild(empty);
      return wrap;
    }

    var frame = document.createElement('div');
    frame.className = 'gal-frame';
    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'gal-trigger';
    trigger.setAttribute('aria-label', CP.t('repo.zoom') + ': ' + repo.name);

    var img = document.createElement('img');
    img.alt = repo.name;
    img.decoding = 'async';
    img.loading = opts.eager ? 'eager' : 'lazy';
    trigger.appendChild(img);
    frame.appendChild(trigger);
    wrap.appendChild(frame);

    var idx = 0;
    var thumbs = [];
    var timer = null;
    var paused = CP.reduced();
    var pauseBtn = null;
    var slide = null;

    function syncOrientation() {
      if (!img.naturalWidth || !img.naturalHeight) return;
      if (img.naturalHeight > img.naturalWidth) {
        var ratio = Math.max(9 / 20, img.naturalWidth / img.naturalHeight);
        frame.classList.add('is-portrait');
        frame.style.setProperty('--gal-ar', String(ratio));
      } else {
        frame.classList.remove('is-portrait');
        frame.style.removeProperty('--gal-ar');
      }
    }

    img.addEventListener('load', syncOrientation);

    function show(i) {
      idx = (i + imgs.length) % imgs.length;
      img.src = imgs[idx];
      img.alt = repo.name + ' ' + CP.t('repo.shot', { n: idx + 1, total: imgs.length });
      trigger.setAttribute('aria-label', CP.t('repo.zoom') + ': ' + img.alt);
      if (img.complete && img.naturalWidth) syncOrientation();
      thumbs.forEach(function (b, k) {
        var on = k === idx;
        if (b.getAttribute('aria-current') !== String(on)) b.setAttribute('aria-current', String(on));
      });
      if (slide && thumbs[idx]) slide.moveTo(thumbs[idx]);
    }

    img.addEventListener('error', function () {
      if (imgs.length > 1) {
        imgs.splice(idx, 1);
        show(idx);
      } else {
        wrap.replaceChildren();
        var p = document.createElement('p');
        p.className = 'gal-empty';
        p.textContent = CP.t('repo.noimg');
        wrap.appendChild(p);
      }
    });

    trigger.addEventListener('click', function () {
      if (!window.CPLightbox) return;
      var resumeAfter = !paused && !!timer;
      if (timer) { clearInterval(timer); timer = null; }
      CPLightbox.open(imgs[idx], img, img.alt, function () {
        if (resumeAfter && !paused) start();
      });
    });

    function paintPauseBtn() {
      if (!pauseBtn) return;
      var label = paused ? CP.t('repo.play') : CP.t('repo.pause');
      pauseBtn.setAttribute('aria-pressed', String(paused));
      pauseBtn.setAttribute('aria-label', label);
      pauseBtn.title = label;
      pauseBtn.replaceChildren(iconSvg(paused ? 'play' : 'pause'));
    }

    if (imgs.length > 1) {
      var row = document.createElement('div');
      row.className = 'gal-thumbs';
      imgs.forEach(function (u, k) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'gal-thumb';
        b.textContent = String(k + 1);
        b.setAttribute('aria-label', CP.t('repo.shot', { n: k + 1, total: imgs.length }));
        b.addEventListener('click', function () { stop(); show(k); });
        thumbs.push(b);
        row.appendChild(b);
      });
      wrap.appendChild(row);
      if (opts.indicator && window.CPSpring) slide = CPSpring.slider(row);

      if (opts.auto && !CP.reduced()) {
        pauseBtn = document.createElement('button');
        pauseBtn.type = 'button';
        pauseBtn.className = 'gal-pause';
        paused = false;
        paintPauseBtn();
        pauseBtn.addEventListener('click', function () {
          if (paused) { paused = false; start(); }
          else { stop(); }
          paintPauseBtn();
        });
        row.appendChild(pauseBtn);
        frame.addEventListener('mouseenter', function () { if (!paused) show(0); });
        start();
      }
    }

    function start() {
      if (timer || !opts.auto || imgs.length < 2) return;
      timer = setInterval(function () { if (!document.hidden) show(idx + 1); }, 3200);
    }
    function stop() {
      paused = true;
      if (timer) { clearInterval(timer); timer = null; }
      paintPauseBtn();
    }

    CP.onLang(function () {
      show(idx);
      paintPauseBtn();
      thumbs.forEach(function (b, k) {
        b.setAttribute('aria-label', CP.t('repo.shot', { n: k + 1, total: imgs.length }));
      });
    });

    show(0);
    return wrap;
  }

  window.CPGallery = { make: make };
})();
