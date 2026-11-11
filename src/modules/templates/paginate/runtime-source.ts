/**
 * Pagination code that runs INSIDE every CV document — identically in the preview iframe and in
 * server-side Chromium — so preview pages and PDF pages are the same.
 *
 * It is kept as plain JavaScript source text (not a serialized TS function) so no bundler or
 * transpiler can inject helpers into it. `plan.ts` evaluates PLAN_PAGES_JS for unit tests, so the
 * algorithm tested is byte-for-byte the algorithm shipped. See docs/engineering/template-engine.md.
 */

/**
 * planPages(blocks, capacity) → { pages: number[][], overflow: number[] }
 * blocks: [{ height, keep: 'none' | 'with-next' | 'together' }]; capacity(pageIndex) → px.
 */
export const PLAN_PAGES_JS = String.raw`function planPages(blocks, capacity) {
  var EPS = 0.5;
  var pages = [[]];
  var overflow = [];
  var used = 0;
  var i = 0;
  while (i < blocks.length) {
    var j = i;
    var groupHeight = blocks[i].height;
    while (blocks[j].keep === 'with-next' && j + 1 < blocks.length) {
      j++;
      groupHeight += blocks[j].height;
    }
    var page = pages.length - 1;
    var cap = capacity(page);
    var k;
    if (used + groupHeight <= cap + EPS) {
      for (k = i; k <= j; k++) pages[page].push(k);
      used += groupHeight;
      i = j + 1;
    } else if (pages[page].length === 0) {
      for (k = i; k <= j; k++) {
        var h = blocks[k].height;
        if (pages[pages.length - 1].length > 0 && used + h > capacity(pages.length - 1) + EPS) {
          pages.push([]);
          used = 0;
        }
        if (h > capacity(pages.length - 1) + EPS) overflow.push(k);
        pages[pages.length - 1].push(k);
        used += h;
      }
      i = j + 1;
    } else {
      pages.push([]);
      used = 0;
    }
  }
  return { pages: pages, overflow: overflow };
}`;

/**
 * Document contract (produced by build-document.tsx):
 *   <div data-cv-source>
 *     <div data-slot="header">…</div>      first-page header
 *     <div data-slot="running">…</div>     optional continuation-page header
 *     <div data-flow="main"><div data-block data-keep="…">…</div>…</div>
 *     <div data-flow="aside">…</div>       optional side column
 *   </div>
 *   <div data-cv-pages></div>
 * Result: window.__CV_READY__ = { pages, overflow, nearlyFits }, html[data-cv-ready], and a
 * postMessage { type: 'cv:ready', result } to the parent frame.
 */
export const RUNTIME_JS = String.raw`(function (planPages) {
  function el(tag, cls) {
    var e = document.createElement(tag);
    e.className = cls;
    return e;
  }
  function makePage(first, hasAside) {
    var page = el('section', 'cv-page ' + (first ? 'cv-page--first' : 'cv-page--rest'));
    var top = el('div', first ? 'cv-top cv-top--header' : 'cv-top cv-top--running');
    var body = el('div', 'cv-body');
    var main = el('div', 'cv-main');
    body.appendChild(main);
    var aside = null;
    if (hasAside) {
      aside = el('div', 'cv-aside');
      body.appendChild(aside);
    }
    page.appendChild(top);
    page.appendChild(body);
    page.appendChild(el('div', 'cv-foot'));
    return { page: page, main: main, aside: aside, top: top };
  }
  function blocksOf(flow) {
    return flow ? Array.prototype.slice.call(flow.querySelectorAll(':scope > [data-block]')) : [];
  }
  function measureFlow(blocks, slot) {
    var out = [];
    if (!slot) return out;
    var i;
    for (i = 0; i < blocks.length; i++) slot.appendChild(blocks[i]);
    for (i = 0; i < blocks.length; i++) {
      var k = blocks[i].getAttribute('data-keep');
      out.push({
        height: blocks[i].getBoundingClientRect().height,
        keep: k === 'with-next' ? 'with-next' : k === 'together' ? 'together' : 'none'
      });
    }
    return out;
  }
  function paginate() {
    var source = document.querySelector('[data-cv-source]');
    var target = document.querySelector('[data-cv-pages]');
    if (!source || !target) return;
    var header = source.querySelector('[data-slot="header"]');
    var running = source.querySelector('[data-slot="running"]');
    var mainBlocks = blocksOf(source.querySelector('[data-flow="main"]'));
    var asideBlocks = blocksOf(source.querySelector('[data-flow="aside"]'));
    var hasAside = asideBlocks.length > 0;
    document.documentElement.classList.toggle('cv-has-aside', hasAside);

    var measure = el('div', 'cv-measure');
    target.innerHTML = '';
    target.appendChild(measure);
    var p1 = makePage(true, hasAside);
    var p2 = makePage(false, hasAside);
    if (header) p1.top.appendChild(header.cloneNode(true));
    if (running) p2.top.appendChild(running.cloneNode(true));
    measure.appendChild(p1.page);
    measure.appendChild(p2.page);
    var capMain1 = p1.main.clientHeight;
    var capMainN = p2.main.clientHeight;
    var capAside1 = p1.aside ? p1.aside.clientHeight : 0;
    var capAsideN = p2.aside ? p2.aside.clientHeight : 0;

    var mainPlan = planPages(measureFlow(mainBlocks, p2.main), function (p) { return p === 0 ? capMain1 : capMainN; });
    var asidePlan = hasAside
      ? planPages(measureFlow(asideBlocks, p2.aside), function (p) { return p === 0 ? capAside1 : capAsideN; })
      : { pages: [[]], overflow: [] };

    var total = Math.max(mainPlan.pages.length, asidePlan.pages.length);
    target.removeChild(measure);
    for (var p = 0; p < total; p++) {
      var pg = makePage(p === 0, hasAside);
      if (p === 0 && header) pg.top.appendChild(header);
      else if (p > 0 && running) pg.top.appendChild(running.cloneNode(true));
      var mi = mainPlan.pages[p] || [];
      var k;
      for (k = 0; k < mi.length; k++) pg.main.appendChild(mainBlocks[mi[k]]);
      var ai = asidePlan.pages[p] || [];
      if (pg.aside) for (k = 0; k < ai.length; k++) pg.aside.appendChild(asideBlocks[ai[k]]);
      if (total > 1) pg.page.querySelector('.cv-foot').textContent = (p + 1) + ' / ' + total;
      target.appendChild(pg.page);
    }
    source.style.display = 'none';

    var lastFill = 1;
    if (total === 2 && mainPlan.pages.length === 2) {
      var h = 0;
      var last = mainPlan.pages[1];
      for (var m = 0; m < last.length; m++) h += mainBlocks[last[m]].getBoundingClientRect().height;
      lastFill = capMainN > 0 ? h / capMainN : 1;
    }
    var result = {
      pages: total,
      overflow: mainPlan.overflow.length + asidePlan.overflow.length,
      nearlyFits: total === 2 && lastFill < 0.12
    };
    window.__CV_READY__ = result;
    document.documentElement.setAttribute('data-cv-ready', String(total));
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'cv:ready', result: result }, '*');
    } catch (e) {}
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var ref = t && t.closest ? t.closest('[data-ref]') : null;
    if (ref && window.parent !== window) {
      window.parent.postMessage({ type: 'cv:select', ref: ref.getAttribute('data-ref') }, '*');
    }
  });

  window.__CV_PAGINATE__ = paginate;
  var fonts = document.fonts;
  if (fonts && fonts.ready) {
    var loads = [];
    fonts.forEach(function (f) { loads.push(f.load().catch(function () { return null; })); });
    Promise.all(loads).then(function () { return fonts.ready; }).then(paginate, paginate);
  } else {
    paginate();
  }
})(${PLAN_PAGES_JS});`;
