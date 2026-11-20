/* Núcleo compartido: datos de GitHub, idioma y estados. Sin dependencias. */
(function () {
  'use strict';

  var USER = 'Criperto';
  var API = 'https://api.github.com';
  var CACHE_KEY = 'criperto.repos.v1';
  var PROFILE_KEY = 'criperto.profile.v1';
  var CACHE_MS = 60 * 60 * 1000;
  var LANG_KEY = 'criperto.lang';
  var EXCLUDE = ['criperto', 'criperto.github.io'];

  var STRINGS = {
    es: {
      'meta.title': 'Criperto: apps hechas por Tomás',
      'meta.desc': 'Portafolio de Criperto. La lista de proyectos sale en vivo de mi GitHub.',
      'skip': 'Saltar al contenido',
      'nav.projects': 'Proyectos',
      'nav.links': 'Enlaces',
      'lang.label': 'Idioma',
      'hero.title': 'Apps que hago para mi propio escritorio y mi casa.',
      'hero.cta': 'Ver los proyectos',
      'projects.title': 'Proyectos',
      'state.loading': 'Cargando proyectos desde GitHub…',
      'state.empty': 'Todavía no hay proyectos públicos.',
      'state.error': 'No pude traer los proyectos de GitHub.',
      'state.rate': 'GitHub limitó los pedidos desde tu conexión. Probá de nuevo en un rato.',
      'state.retry': 'Reintentar',
      'state.stale': 'Mostrando la última copia guardada.',
      'repo.open': 'Ver en GitHub',
      'repo.site': 'Abrir sitio',
      'repo.updated': 'Actualizado',
      'repo.license': 'Licencia',
      'repo.noimg': 'Este repo no tiene capturas en su README.',
      'repo.shot': 'Captura {n} de {total}',
      'repo.zoom': 'Ampliar captura',
      'repo.pause': 'Pausar capturas',
      'repo.play': 'Reanudar capturas',
      'repo.nodesc': 'Sin descripción.',
      'lb.label': 'Visor de imagen ampliada',
      'lb.close': 'Cerrar visor',
      'lb.zoomIn': 'Acercar',
      'lb.zoomOut': 'Alejar',
      'lb.reset': 'Restablecer zoom',
      'links.title': 'Donde más me encontrás'
    },
    en: {
      'meta.title': 'Criperto: apps built by Tomás',
      'meta.desc': 'Criperto portfolio. The project list is read live from my GitHub.',
      'skip': 'Skip to content',
      'nav.projects': 'Projects',
      'nav.links': 'Links',
      'lang.label': 'Language',
      'hero.title': 'Apps I build for my own desktop and my home.',
      'hero.cta': 'See the projects',
      'projects.title': 'Projects',
      'state.loading': 'Loading projects from GitHub…',
      'state.empty': 'There are no public projects yet.',
      'state.error': "I couldn't fetch the projects from GitHub.",
      'state.rate': 'GitHub rate-limited requests from your connection. Try again in a while.',
      'state.retry': 'Retry',
      'state.stale': 'Showing the last saved copy.',
      'repo.open': 'View on GitHub',
      'repo.site': 'Open site',
      'repo.updated': 'Updated',
      'repo.license': 'License',
      'repo.noimg': 'This repo has no screenshots in its README.',
      'repo.shot': 'Screenshot {n} of {total}',
      'repo.zoom': 'Expand screenshot',
      'repo.pause': 'Pause screenshots',
      'repo.play': 'Resume screenshots',
      'repo.nodesc': 'No description.',
      'lb.label': 'Expanded image viewer',
      'lb.close': 'Close viewer',
      'lb.zoomIn': 'Zoom in',
      'lb.zoomOut': 'Zoom out',
      'lb.reset': 'Reset zoom',
      'links.title': 'Where else to find me'
    }
  };

  var LOCALE = { es: 'es-AR', en: 'en-US' };
  var lang = 'es';
  var listeners = [];
  var overrides = {};
  var i18nPromise = null;

  function detectLang() {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      if (saved === 'es' || saved === 'en') return saved;
    } catch (e) { /* storage bloqueado */ }
    var nav = (navigator.language || 'es').toLowerCase();
    return nav.indexOf('es') === 0 ? 'es' : 'en';
  }

  function t(key, vars) {
    var s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.es[key] || key;
    if (vars) for (var k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  }

  function applyStatic() {
    document.documentElement.lang = LOCALE[lang];
    document.title = t('meta.title');
    var d = document.querySelector('meta[name="description"]');
    if (d) d.setAttribute('content', t('meta.desc'));
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-label]').forEach(function (el) {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-label')));
    });
    document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
      var on = b.getAttribute('data-lang-btn') === lang;
      if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on));
    });
  }

  function setLang(next) {
    if (next !== 'es' && next !== 'en') return;
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignorar */ }
    applyStatic();
    listeners.forEach(function (fn) { fn(lang); });
    if (window.CPSpring) CPSpring.textIn(document);
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat(LOCALE[lang], { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
  }

  /* ---------- datos ---------- */

  function isHttps(u) { return typeof u === 'string' && /^https:\/\//i.test(u); }

  function resolveImg(src, repo) {
    if (!src) return null;
    src = src.trim();
    if (/^https?:\/\//i.test(src)) return isHttps(src) ? src : null;
    if (src.indexOf('//') === 0 || /^[a-z]+:/i.test(src)) return null;
    var path = src.replace(/^\.?\//, '');
    return 'https://raw.githubusercontent.com/' + USER + '/' + repo.name + '/' + repo.default_branch + '/' + path;
  }

  function isBadge(u) {
    return /shields\.io|badge|img\.shields|github\.com\/.+\/workflows\/.+\/badge|travis-ci|codecov/i.test(u);
  }

  function extractImages(md, repo) {
    var found = [];
    var re = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?[^)]*\)|<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi;
    var m;
    while ((m = re.exec(md)) !== null) {
      var raw = m[1] || m[2];
      if (!raw || isBadge(raw)) continue;
      var url = resolveImg(raw, repo);
      if (url && found.indexOf(url) === -1) found.push(url);
      if (found.length >= 8) break;
    }
    return found;
  }

  function fetchJson(url) {
    return fetch(url, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) {
      if (r.status === 403 || r.status === 429) {
        var e = new Error('rate'); e.rate = true; throw e;
      }
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  function fetchReadme(repo) {
    return fetch(API + '/repos/' + USER + '/' + repo.name + '/readme', {
      headers: { Accept: 'application/vnd.github.raw' }
    }).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; });
  }

  function readCache() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && Array.isArray(c.repos)) return c;
    } catch (e) { /* cache roto */ }
    return null;
  }

  function loadI18nOverrides() {
    if (!i18nPromise) {
      i18nPromise = fetch('repo-i18n.json')
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    }
    return i18nPromise;
  }

  /* Devuelve {repos, stale}. Rechaza con {rate:boolean} si no hay nada que mostrar. */
  function loadRepos() {
    var cached = readCache();
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return Promise.resolve({ repos: cached.repos, stale: false });
    }
    return fetchJson(API + '/users/' + USER + '/repos?per_page=100&sort=pushed')
      .then(function (list) {
        if (!Array.isArray(list)) throw new Error('shape');
        var keep = list.filter(function (r) {
          return r && typeof r.name === 'string' &&
            EXCLUDE.indexOf(r.name.toLowerCase()) === -1 &&
            !r.fork && !r.archived && !r.private &&
            (r.topics || []).indexOf('hidden') === -1;
        });
        return Promise.all(keep.map(function (r) {
          return fetchReadme(r).then(function (md) {
            return {
              name: r.name,
              description: r.description || '',
              language: r.language || '',
              license: r.license && r.license.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? r.license.spdx_id : '',
              pushed_at: r.pushed_at,
              html_url: r.html_url,
              homepage: isHttps(r.homepage) ? r.homepage : '',
              images: extractImages(md, r)
            };
          });
        }));
      })
      .then(function (repos) {
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repos: repos })); } catch (e) { /* ignorar */ }
        return { repos: repos, stale: false };
      })
      .catch(function (err) {
        if (cached) return { repos: cached.repos, stale: true };
        throw { rate: !!(err && err.rate) };
      });
  }

  /* Descripción en el idioma activo: override manual si existe, si no la de GitHub. */
  function describe(repo) {
    var o = overrides[repo.name];
    if (o && o[lang]) return o[lang];
    return repo.description || t('repo.nodesc');
  }

  /* ---------- UI común ---------- */

  function stateBox(kind, onRetry) {
    var box = document.createElement('div');
    box.className = 'state state-' + kind;
    box.setAttribute('role', kind === 'loading' ? 'status' : 'alert');
    var p = document.createElement('p');
    p.setAttribute('data-i18n', 'state.' + kind);
    p.textContent = t('state.' + kind);
    box.appendChild(p);
    if (onRetry) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.setAttribute('data-i18n', 'state.retry');
      b.textContent = t('state.retry');
      b.addEventListener('click', onRetry);
      box.appendChild(b);
    }
    return box;
  }

  function mountProjects(host, render) {
    function run() {
      host.setAttribute('aria-busy', 'true');
      host.replaceChildren(stateBox('loading'));
      Promise.all([loadRepos(), loadI18nOverrides()]).then(function (res) {
        overrides = res[1] || {};
        var data = res[0];
        host.replaceChildren();
        host.setAttribute('aria-busy', 'false');
        if (!data.repos.length) { host.appendChild(stateBox('empty')); return; }
        if (data.stale) {
          var note = document.createElement('p');
          note.className = 'stale';
          note.setAttribute('data-i18n', 'state.stale');
          note.textContent = t('state.stale');
          host.appendChild(note);
        }
        render(host, data.repos);
      }).catch(function (err) {
        host.setAttribute('aria-busy', 'false');
        host.replaceChildren(stateBox(err && err.rate ? 'rate' : 'error', run));
      });
    }
    run();
  }

  /* ---------- perfil (bio de GitHub) ---------- */

  function loadProfile() {
    try {
      var c = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
      if (c && typeof c.bio === 'string' && Date.now() - c.at < CACHE_MS) return Promise.resolve(c.bio);
    } catch (e) { /* cache roto */ }
    return fetchJson(API + '/users/' + USER).then(function (u) {
      var bio = u && typeof u.bio === 'string' ? u.bio.trim() : '';
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ at: Date.now(), bio: bio })); } catch (e) { /* ignorar */ }
      return bio;
    });
  }

  /* Pone la bio en `el`. Si falla o está vacía, muestra `hero.title` como respaldo.
     Traducción: _profile en repo-i18n.json solo se usa si la bio actual coincide con su texto `es`. */
  function mountBio(el) {
    var bio = '';
    var done = false;
    function paint() {
      if (!done) return;
      if (!bio) { el.textContent = t('hero.title'); return; }
      var o = overrides._profile;
      var text = (o && o.es === bio && o[lang]) ? o[lang] : bio;
      if (el.textContent !== text) el.textContent = text;
    }
    Promise.all([loadProfile().catch(function () { return ''; }), loadI18nOverrides()]).then(function (res) {
      bio = res[0];
      overrides = res[1] || {};
      done = true;
      paint();
    });
    listeners.push(paint);
  }

  function init() {
    lang = detectLang();
    applyStatic();
    document.querySelectorAll('[data-lang-btn]').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang-btn')); });
    });
  }

  window.CP = {
    t: t, describe: describe, fmtDate: fmtDate, init: init, mountProjects: mountProjects,
    onLang: function (fn) { listeners.push(fn); },
    lang: function () { return lang; },
    applyStatic: applyStatic, mountBio: mountBio,
    reduced: function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  };
})();
