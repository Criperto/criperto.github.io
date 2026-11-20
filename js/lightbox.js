/* Visor ampliado (lightbox) inspirado en ImageZoomOverlay.qml de qs-notes:
   apertura/cierre con resorte desde la miniatura, zoom centrado en el puntero,
   gestos táctiles (pellizco y arrastre), paneo y cierre por ESC / clic fuera / botón X. */
(function () {
  'use strict';

  var el = null;
  var backdrop = null;
  var stage = null;
  var frame = null;
  var img = null;
  var closeBtn = null;
  var toolbar = null;
  var zoomOutBtn = null;
  var resetBtn = null;
  var zoomInBtn = null;

  var isOpen = false;
  var isClosing = false;
  var springActive = false;
  var sourceEl = null;
  var restoreFocus = null;
  var onCloseCb = null;

  var natW = 0;
  var natH = 0;
  var curScale = 1;
  var panX = 0;
  var panY = 0;

  var sx, sy, sw, sh;
  var vx = 0, vy = 0, vw = 100, vh = 100;
  var closeTimer = null;

  function reduced() { return window.CP && CP.reduced(); }

  function viewport() {
    return { w: window.innerWidth, h: window.innerHeight };
  }

  function fitScale() {
    var vp = viewport();
    var padX = vp.w < 640 ? 24 : 96;
    var padY = vp.w < 640 ? 128 : 112;
    var maxW = Math.max(120, vp.w - padX);
    var maxH = Math.max(120, vp.h - padY);
    var ew = natW > 0 ? natW : 800;
    var eh = natH > 0 ? natH : 600;
    return Math.max(0.05, Math.min(maxW / ew, maxH / eh));
  }

  function minScale() { return Math.min(0.4, fitScale() * 0.55); }
  function maxScale() { return Math.max(fitScale() * 4.5, 4); }

  function dispSize(scale) {
    var s = scale !== undefined ? scale : curScale;
    var ew = natW > 0 ? natW : 800;
    var eh = natH > 0 ? natH : 600;
    return { w: Math.max(24, ew * s), h: Math.max(24, eh * s) };
  }

  function canPan() {
    var vp = viewport();
    var d = dispSize();
    return isOpen && !isClosing && (d.w > vp.w || d.h > vp.h || curScale > fitScale() * 1.02);
  }

  function clampPan(px, py, customW, customH) {
    var vp = viewport();
    var d = dispSize();
    var w = customW !== undefined ? customW : d.w;
    var h = customH !== undefined ? customH : d.h;
    var slackX = Math.min(120, vp.w * 0.2);
    var slackY = Math.min(120, vp.h * 0.2);
    var maxPx = w > vp.w - 48 ? Math.max(0, (w - vp.w) / 2 + slackX) : 0;
    var maxPy = h > vp.h - 48 ? Math.max(0, (h - vp.h) / 2 + slackY) : 0;
    return {
      x: Math.max(-maxPx, Math.min(maxPx, px)),
      y: Math.max(-maxPy, Math.min(maxPy, py))
    };
  }

  function targetRect() {
    var vp = viewport();
    var d = dispSize();
    return {
      x: Math.round((vp.w - d.w) / 2 + panX),
      y: Math.round((vp.h - d.h) / 2 + panY),
      w: Math.round(d.w),
      h: Math.round(d.h)
    };
  }

  function originRect() {
    if (sourceEl && sourceEl.isConnected) {
      var r = sourceEl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      }
    }
    var vp = viewport();
    return { x: Math.round(vp.w / 2 - 48), y: Math.round(vp.h / 2 - 48), w: 96, h: 96 };
  }

  function paintFrame() {
    frame.style.transform = 'translate(' + vx + 'px,' + vy + 'px)';
    frame.style.width = Math.max(24, vw) + 'px';
    frame.style.height = Math.max(24, vh) + 'px';
  }

  function applyRect(rect, instant) {
    if (instant || !springActive || reduced() || !window.CPSpring) {
      sx.to(rect.x, true); sy.to(rect.y, true);
      sw.to(rect.w, true); sh.to(rect.h, true);
    } else {
      sx.to(rect.x, false); sy.to(rect.y, false);
      sw.to(rect.w, false); sh.to(rect.h, false);
    }
  }

  function updateUI() {
    var fit = fitScale();
    var pct = Math.round((curScale / fit) * 100);
    resetBtn.textContent = pct + '%';
    zoomInBtn.disabled = curScale >= maxScale() - 0.001;
    zoomOutBtn.disabled = curScale <= minScale() + 0.001;
    var panning = canPan();
    frame.classList.toggle('can-pan', panning);
    if (!panning) frame.classList.remove('is-panning');
  }

  function setZoom(nextScale, pivotX, pivotY, animate) {
    if (!isOpen || isClosing) return;
    var vp = viewport();
    var oldScale = curScale;
    var clampedScale = Math.max(minScale(), Math.min(maxScale(), nextScale));
    if (Math.abs(clampedScale - oldScale) < 0.0005) return;

    var mx = pivotX !== undefined ? pivotX : vp.w / 2;
    var my = pivotY !== undefined ? pivotY : vp.h / 2;
    var oldCx = vp.w / 2 + panX;
    var oldCy = vp.h / 2 + panY;
    var ratio = clampedScale / oldScale;
    var rawPx = mx - (mx - oldCx) * ratio - vp.w / 2;
    var rawPy = my - (my - oldCy) * ratio - vp.h / 2;

    var nextSize = dispSize(clampedScale);
    var c = clampPan(rawPx, rawPy, nextSize.w, nextSize.h);
    curScale = clampedScale;
    panX = c.x;
    panY = c.y;
    springActive = !!animate;
    applyRect(targetRect(), !animate);
    updateUI();
  }

  function resetZoom(animate) {
    if (!isOpen || isClosing) return;
    curScale = fitScale();
    panX = 0;
    panY = 0;
    springActive = !!animate;
    applyRect(targetRect(), !animate);
    updateUI();
  }

  function finishClose() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    sx.stop(); sy.stop(); sw.stop(); sh.stop();
    isOpen = false;
    isClosing = false;
    springActive = false;
    el.hidden = true;
    el.classList.remove('is-open', 'is-closing');
    img.removeAttribute('src');
    document.body.style.overflow = '';
    if (restoreFocus && restoreFocus.isConnected && typeof restoreFocus.focus === 'function') {
      restoreFocus.focus();
    }
    restoreFocus = null;
    sourceEl = null;
    if (onCloseCb) { var cb = onCloseCb; onCloseCb = null; cb(); }
  }

  function close() {
    if (!isOpen || isClosing) return;
    if (reduced()) { finishClose(); return; }

    isClosing = true;
    springActive = true;
    el.classList.remove('is-open');
    el.classList.add('is-closing');
    applyRect(originRect(), false);
    closeTimer = setTimeout(finishClose, 420);
  }

  function updateStrings() {
    if (!el) return;
    el.setAttribute('aria-label', CP.t('lb.label'));
    closeBtn.setAttribute('aria-label', CP.t('lb.close'));
    closeBtn.title = CP.t('lb.close');
    zoomOutBtn.setAttribute('aria-label', CP.t('lb.zoomOut'));
    zoomOutBtn.title = CP.t('lb.zoomOut');
    resetBtn.setAttribute('aria-label', CP.t('lb.reset'));
    resetBtn.title = CP.t('lb.reset');
    zoomInBtn.setAttribute('aria-label', CP.t('lb.zoomIn'));
    zoomInBtn.title = CP.t('lb.zoomIn');
  }

  function svgIcon(pathD) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2.2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', pathD);
    svg.appendChild(p);
    return svg;
  }

  function ensureDOM() {
    if (el) return;

    el = document.createElement('div');
    el.className = 'lb';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.hidden = true;

    backdrop = document.createElement('div');
    backdrop.className = 'lb-backdrop';

    stage = document.createElement('div');
    stage.className = 'lb-stage';

    frame = document.createElement('div');
    frame.className = 'lb-frame';

    img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    frame.appendChild(img);

    closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'lb-close';
    closeBtn.appendChild(svgIcon('M18 6L6 18M6 6l12 12'));

    toolbar = document.createElement('div');
    toolbar.className = 'lb-bar';

    zoomOutBtn = document.createElement('button');
    zoomOutBtn.type = 'button';
    zoomOutBtn.className = 'lb-btn';
    zoomOutBtn.appendChild(svgIcon('M5 12h14'));

    resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'lb-btn lb-reset';
    resetBtn.textContent = '100%';

    zoomInBtn = document.createElement('button');
    zoomInBtn.type = 'button';
    zoomInBtn.className = 'lb-btn';
    zoomInBtn.appendChild(svgIcon('M12 5v14M5 12h14'));

    toolbar.append(zoomOutBtn, resetBtn, zoomInBtn);
    stage.append(frame, closeBtn, toolbar);
    el.append(backdrop, stage);
    document.body.appendChild(el);

    sx = new CPSpring.Spring(0, function (v) { vx = v; paintFrame(); });
    sy = new CPSpring.Spring(0, function (v) { vy = v; paintFrame(); });
    sw = new CPSpring.Spring(100, function (v) { vw = v; paintFrame(); });
    sh = new CPSpring.Spring(100, function (v) { vh = v; paintFrame(); });

    updateStrings();
    if (window.CP) CP.onLang(updateStrings);

    closeBtn.addEventListener('click', close);
    zoomInBtn.addEventListener('click', function () { setZoom(curScale * 1.35, undefined, undefined, true); });
    zoomOutBtn.addEventListener('click', function () { setZoom(curScale / 1.35, undefined, undefined, true); });
    resetBtn.addEventListener('click', function () { resetZoom(true); });

    /* Rueda de ratón centrada en el puntero */
    el.addEventListener('wheel', function (e) {
      if (!isOpen || isClosing) return;
      e.preventDefault();
      var dy = e.deltaY;
      if (!dy) return;
      var norm = e.deltaMode === 1 ? dy * 32 : dy;
      var steps = Math.max(-3, Math.min(3, -norm / 120));
      var factor = Math.pow(1.18, steps);
      setZoom(curScale * factor, e.clientX, e.clientY, false);
    }, { passive: false });

    /* Paneo por arrastre + pellizco multitouch + clic fuera para cerrar */
    var pointers = new Map();
    var dragging = false;
    var moved = false;
    var downOutside = false;
    var startX = 0, startY = 0, startPx = 0, startPy = 0;
    var pinchDist = 0, pinchScale = 1;

    function pointerDist() {
      var pts = Array.from(pointers.values());
      return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    }
    function pointerMid() {
      var pts = Array.from(pointers.values());
      return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    }

    stage.addEventListener('pointerdown', function (e) {
      if (!isOpen || isClosing) return;
      if (e.target.closest('.lb-close') || e.target.closest('.lb-bar')) return;

      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        dragging = false;
        downOutside = false;
        pinchDist = pointerDist();
        pinchScale = curScale;
        return;
      }

      var r = frame.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside && e.button === 0) {
        downOutside = true;
        dragging = false;
        return;
      }

      downOutside = false;
      moved = false;
      if (canPan() && (e.button === 0 || e.button === 1)) {
        e.preventDefault();
        dragging = true;
        springActive = false;
        frame.classList.add('is-panning');
        startX = e.clientX;
        startY = e.clientY;
        startPx = panX;
        startPy = panY;
        if (stage.setPointerCapture) stage.setPointerCapture(e.pointerId);
      }
    });

    stage.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2 && pinchDist > 0) {
        var d = pointerDist();
        var mid = pointerMid();
        setZoom(pinchScale * (d / pinchDist), mid.x, mid.y, false);
        return;
      }

      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > 4) moved = true;
      var c = clampPan(startPx + dx, startPy + dy);
      panX = c.x;
      panY = c.y;
      applyRect(targetRect(), true);
    });

    function releasePointer(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (dragging) {
        dragging = false;
        frame.classList.remove('is-panning');
      }
      if (downOutside && pointers.size === 0) {
        downOutside = false;
        close();
      }
    }
    stage.addEventListener('pointerup', releasePointer);
    stage.addEventListener('pointercancel', releasePointer);

    /* Doble clic sobre la imagen: alterna entre encajar y 2x */
    frame.addEventListener('dblclick', function (e) {
      if (!isOpen || isClosing || moved) return;
      var fit = fitScale();
      if (curScale > fit * 1.15) resetZoom(true);
      else setZoom(Math.min(maxScale(), fit * 2.2), e.clientX, e.clientY, true);
    });

    document.addEventListener('keydown', function (e) {
      if (!isOpen || isClosing) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(curScale * 1.35, undefined, undefined, true); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(curScale / 1.35, undefined, undefined, true); }
      else if (e.key === '0') { e.preventDefault(); resetZoom(true); }
    });

    window.addEventListener('resize', function () {
      if (!isOpen || isClosing) return;
      var fit = fitScale();
      if (curScale < fit * 1.03) {
        curScale = fit;
        panX = 0;
        panY = 0;
      } else {
        var c = clampPan(panX, panY);
        panX = c.x;
        panY = c.y;
      }
      applyRect(targetRect(), true);
      updateUI();
    });
  }

  function open(src, srcImgEl, altText, onClose) {
    if (!src) return;
    ensureDOM();
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }

    restoreFocus = document.activeElement;
    sourceEl = srcImgEl || null;
    onCloseCb = onClose || null;

    natW = (srcImgEl && srcImgEl.naturalWidth) || 800;
    natH = (srcImgEl && srcImgEl.naturalHeight) || 600;
    curScale = fitScale();
    panX = 0;
    panY = 0;
    isOpen = true;
    isClosing = false;

    img.alt = altText || '';
    img.src = src;
    img.onload = function () {
      if (!isOpen || isClosing) return;
      if (img.naturalWidth > 0 && img.naturalHeight > 0 && (img.naturalWidth !== natW || img.naturalHeight !== natH)) {
        natW = img.naturalWidth;
        natH = img.naturalHeight;
        curScale = fitScale();
        applyRect(targetRect(), !springActive);
        updateUI();
      }
    };

    var orig = originRect();
    springActive = false;
    applyRect(orig, true);
    updateUI();

    document.body.style.overflow = 'hidden';
    el.hidden = false;
    el.classList.remove('is-closing');

    if (reduced()) {
      el.classList.add('is-open');
      applyRect(targetRect(), true);
      closeBtn.focus();
      return;
    }

    requestAnimationFrame(function () {
      if (!isOpen || isClosing) return;
      el.classList.add('is-open');
      springActive = true;
      applyRect(targetRect(), false);
      closeBtn.focus();
    });
  }

  window.CPLightbox = { open: open, close: close };
})();
