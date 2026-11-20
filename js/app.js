(function () {
  'use strict';

  function metaItem(dl, labelKey, value) {
    if (!value) return null;
    var row = document.createElement('div');
    var dt = document.createElement('dt');
    dt.setAttribute('data-i18n', labelKey);
    dt.textContent = CP.t(labelKey);
    var dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    dl.appendChild(row);
    return dd;
  }

  function link(cls, href, key) {
    var a = document.createElement('a');
    a.className = cls;
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('data-i18n', key);
    a.textContent = CP.t(key);
    return a;
  }

  function card(repo, i) {
    var art = document.createElement('article');
    art.className = 'repo';
    art.id = 'repo-' + repo.name;
    var grid = document.createElement('div');
    grid.className = 'wrap repo-grid';

    var info = document.createElement('div');
    info.className = 'repo-info';
    var h = document.createElement('h3');
    h.textContent = repo.name;
    var desc = document.createElement('p');
    desc.className = 'repo-desc';
    desc.textContent = CP.describe(repo);
    CP.onLang(function () { desc.textContent = CP.describe(repo); });

    var dl = document.createElement('dl');
    dl.className = 'meta';
    metaItem(dl, 'repo.license', repo.license);
    if (repo.language) {
      var r = document.createElement('div');
      var dd = document.createElement('dd');
      dd.textContent = repo.language;
      r.appendChild(dd);
      dl.insertBefore(r, dl.firstChild);
    }
    var upd = metaItem(dl, 'repo.updated', CP.fmtDate(repo.pushed_at));
    if (upd) CP.onLang(function () { upd.textContent = CP.fmtDate(repo.pushed_at); });

    var actions = document.createElement('div');
    actions.className = 'actions';
    actions.appendChild(link('btn btn-accent', repo.html_url, 'repo.open'));
    if (repo.homepage) actions.appendChild(link('btn', repo.homepage, 'repo.site'));

    info.append(h, desc, dl, actions);
    grid.append(info, CPGallery.make(repo, { eager: i === 0, auto: true, indicator: true }));
    art.appendChild(grid);
    return art;
  }

  function buildSide(repos) {
    var side = document.getElementById('side');
    side.replaceChildren();
    var links = repos.map(function (r) {
      var a = document.createElement('a');
      a.href = '#repo-' + r.name;
      a.textContent = r.name;
      a.setAttribute('aria-current', 'false');
      side.appendChild(a);
      return a;
    });
    side.hidden = repos.length < 2;
    var slide = CPSpring.slider(side);
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + e.target.id;
          if (a.getAttribute('aria-current') !== String(on)) a.setAttribute('aria-current', String(on));
          if (on) slide.moveTo(a);
        });
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    document.querySelectorAll('.repo').forEach(function (el) { io.observe(el); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    CP.init();
    var lang = document.querySelector('.lang');
    var langSlide = CPSpring.slider(lang);
    function moveLang() { langSlide.moveTo(lang.querySelector('[aria-pressed="true"]')); }
    moveLang();
    CP.onLang(moveLang);
    CP.mountBio(document.getElementById('bio'));
    CP.mountProjects(document.getElementById('lista'), function (host, repos) {
      repos.forEach(function (r, i) { host.appendChild(card(r, i)); });
      buildSide(repos);
    });
  });
})();
