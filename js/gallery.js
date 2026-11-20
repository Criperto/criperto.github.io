/* Galería de capturas del README. Clases: .gal .gal-frame .gal-thumbs .gal-pause .gal-empty */
(function () {
  'use strict';

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
    var img = document.createElement('img');
    img.alt = repo.name;
    img.decoding = 'async';
    img.loading = opts.eager ? 'eager' : 'lazy';
    frame.appendChild(img);
    wrap.appendChild(frame);

    var idx = 0;
    var thumbs = [];
    var timer = null;
    var paused = CP.reduced();
    var pauseBtn = null;
    var slide = null;

    function show(i) {
      idx = (i + imgs.length) % imgs.length;
      img.src = imgs[idx];
      img.alt = repo.name + ' ' + CP.t('repo.shot', { n: idx + 1, total: imgs.length });
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
        pauseBtn.setAttribute('aria-pressed', 'false');
        pauseBtn.textContent = CP.t('repo.pause');
        pauseBtn.addEventListener('click', function () {
          if (paused) { paused = false; start(); pauseBtn.textContent = CP.t('repo.pause'); pauseBtn.setAttribute('aria-pressed', 'false'); }
          else { stop(); pauseBtn.textContent = CP.t('repo.play'); pauseBtn.setAttribute('aria-pressed', 'true'); }
        });
        row.appendChild(pauseBtn);
        paused = false;
        frame.addEventListener('mouseenter', function () { if (!paused) { show(0); } });
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
    }

    CP.onLang(function () {
      show(idx);
      if (pauseBtn) pauseBtn.textContent = paused ? CP.t('repo.play') : CP.t('repo.pause');
      thumbs.forEach(function (b, k) {
        b.setAttribute('aria-label', CP.t('repo.shot', { n: k + 1, total: imgs.length }));
      });
    });

    show(0);
    return wrap;
  }

  window.CPGallery = { make: make };
})();
