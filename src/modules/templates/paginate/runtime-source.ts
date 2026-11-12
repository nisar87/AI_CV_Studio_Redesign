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
export const PLAN_PAGES_JS = String.raw`function planPages(blocks, capacity, wideFrom) {
  var EPS = 0.5;
  var pages = [[]];
  var overflow = [];
  var used = 0;
  var i = 0;
  // Pages from wideFrom on are full width (no side column): blocks may be shorter there.
  function h(k, p) {
    var b = blocks[k];
    return wideFrom !== undefined && p >= wideFrom && b.wide != null ? b.wide : b.height;
  }
  while (i < blocks.length) {
    var page = pages.length - 1;
    var j = i;
    var groupHeight = h(i, page);
    while (blocks[j].keep === 'with-next' && j + 1 < blocks.length) {
      j++;
      groupHeight += h(j, page);
    }
    var cap = capacity(page);
    var k;
    if (used + groupHeight <= cap + EPS) {
      for (k = i; k <= j; k++) pages[page].push(k);
      used += groupHeight;
      i = j + 1;
    } else if (pages[page].length === 0) {
      for (k = i; k <= j; k++) {
        var last = pages.length - 1;
        var hk = h(k, last);
        var need = hk;
        if (blocks[k].keep === 'with-next' && k + 1 <= j && h(k, last + 1) + h(k + 1, last + 1) <= capacity(last + 1) + EPS) {
          need = hk + h(k + 1, last);
        }
        if (pages[last].length > 0 && used + need > capacity(last) + EPS) {
          pages.push([]);
          used = 0;
        } else if (pages[last].length === 0 && need > capacity(last) + EPS && need <= capacity(last + 1) + EPS) {
          pages.push([]);
          used = 0;
        }
        last = pages.length - 1;
        hk = h(k, last);
        if (hk > capacity(last) + EPS) overflow.push(k);
        pages[last].push(k);
        used += hk;
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
  var decorSource = null;
  function makePage(first, hasAside) {
    var page = el('section', 'cv-page ' + (first ? 'cv-page--first' : 'cv-page--rest'));
    if (decorSource) {
      var decor = el('div', 'cv-decor');
      decor.setAttribute('aria-hidden', 'true');
      decor.innerHTML = decorSource.innerHTML;
      page.appendChild(decor);
    }
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
  var state = null;
  // Capture the source once; later runs move the same nodes back before laying out again.
  function capture() {
    if (state) return state;
    var source = document.querySelector('[data-cv-source]');
    var target = document.querySelector('[data-cv-pages]');
    if (!source || !target) return null;
    var mainFlow = source.querySelector('[data-flow="main"]');
    var asideFlow = source.querySelector('[data-flow="aside"]');
    state = {
      source: source,
      target: target,
      header: source.querySelector('[data-slot="header"]'),
      running: source.querySelector('[data-slot="running"]'),
      mainFlow: mainFlow,
      asideFlow: asideFlow,
      mainBlocks: blocksOf(mainFlow),
      asideBlocks: blocksOf(asideFlow)
    };
    decorSource = source.querySelector('[data-slot="decor"]');
    return state;
  }
  function restore(st) {
    var i;
    if (st.header) st.source.insertBefore(st.header, st.source.firstChild);
    for (i = 0; i < st.mainBlocks.length; i++) st.mainFlow.appendChild(st.mainBlocks[i]);
    if (st.asideFlow) for (i = 0; i < st.asideBlocks.length; i++) st.asideFlow.appendChild(st.asideBlocks[i]);
    st.target.innerHTML = '';
    st.source.style.display = '';
  }
  function sum(blocks, idx, wide) {
    var h = 0;
    for (var i = 0; i < idx.length; i++) {
      var b = blocks[idx[i]];
      h += wide && b.wide != null ? b.wide : b.height;
    }
    return h;
  }

  // reserve: px kept free at the bottom of every column (used when trying a tighter fit, so a
  // fit that only just works in one browser can't spill onto another page in a different one).
  function layout(st, reserve) {
    var R = reserve || 0;
    restore(st);
    var header = st.header;
    var running = st.running;
    var mainBlocks = st.mainBlocks;
    var asideBlocks = st.asideBlocks;
    var hasAside = asideBlocks.length > 0;
    var target = st.target;
    document.documentElement.classList.toggle('cv-has-aside', hasAside);

    var measure = el('div', 'cv-measure');
    target.appendChild(measure);
    var p1 = makePage(true, hasAside);
    var p2 = makePage(false, hasAside);
    if (header) p1.top.appendChild(header.cloneNode(true));
    if (running) p2.top.appendChild(running.cloneNode(true));
    measure.appendChild(p1.page);
    measure.appendChild(p2.page);
    var capMain1 = p1.main.clientHeight - R;
    var capMainN = p2.main.clientHeight - R;
    var capAside1 = p1.aside ? p1.aside.clientHeight - R : 0;
    var capAsideN = p2.aside ? p2.aside.clientHeight - R : 0;

    // Side column first: it decides from which page on the main column can use the full width.
    var asideMeasure = hasAside ? measureFlow(asideBlocks, p2.aside) : [];
    var asidePlan = hasAside
      ? planPages(asideMeasure, function (p) { return p === 0 ? capAside1 : capAsideN; })
      : { pages: [[]], overflow: [] };
    var wideFrom;
    var capMainWide = capMainN;
    var mainMeasure;
    if (hasAside) {
      wideFrom = asidePlan.pages.length;
      var p3 = makePage(false, false);
      p3.page.className += ' cv-page--wide';
      if (running) p3.top.appendChild(running.cloneNode(true));
      measure.appendChild(p3.page);
      capMainWide = p3.main.clientHeight - R;
      var wide = measureFlow(mainBlocks, p3.main);
      mainMeasure = measureFlow(mainBlocks, p2.main);
      for (var q = 0; q < mainMeasure.length; q++) mainMeasure[q].wide = wide[q].height;
    } else {
      mainMeasure = measureFlow(mainBlocks, p2.main);
    }
    function capMain(p) { return p === 0 ? capMain1 : wideFrom !== undefined && p >= wideFrom ? capMainWide : capMainN; }
    var mainPlan = planPages(mainMeasure, capMain, wideFrom);

    var total = Math.max(mainPlan.pages.length, asidePlan.pages.length);
    target.removeChild(measure);
    for (var p = 0; p < total; p++) {
      var isWide = hasAside && p > 0 && p >= wideFrom;
      var pg = makePage(p === 0, hasAside && !isWide);
      if (isWide) pg.page.className += ' cv-page--wide';
      if (p === 0 && header) pg.top.appendChild(header);
      else if (p > 0 && running) pg.top.appendChild(running.cloneNode(true));
      var mi = mainPlan.pages[p] || [];
      var k;
      for (k = 0; k < mi.length; k++) pg.main.appendChild(mainBlocks[mi[k]]);
      var ai = asidePlan.pages[p] || [];
      if (pg.aside) for (k = 0; k < ai.length; k++) pg.aside.appendChild(asideBlocks[ai[k]]);
      if (total > 1) pg.page.querySelector('.cv-foot').textContent = (p + 1) + ' / ' + total;
      target.appendChild(pg.page);
      // Height of side-column content, for designs whose column background should end with it.
      if (pg.aside) pg.page.style.setProperty('--aside-h', sum(asideMeasure, ai, false) + 'px');
    }
    st.source.style.display = 'none';

    // How full is the last page? (largest of its columns)
    var lp = total - 1;
    var fillMain = lp < mainPlan.pages.length ? sum(mainMeasure, mainPlan.pages[lp], wideFrom !== undefined && lp >= wideFrom) / capMain(lp) : 0;
    var fillAside = hasAside && lp < asidePlan.pages.length ? sum(asideMeasure, asidePlan.pages[lp], false) / (lp === 0 ? capAside1 : capAsideN) : 0;
    return {
      pages: total,
      overflow: mainPlan.overflow.length + asidePlan.overflow.length,
      lastFill: Math.max(fillMain, fillAside)
    };
  }

  // Bounded "fit" steps: slightly tighter spacing (never smaller text) to avoid a near-empty last page.
  var FIT_STEPS = [
    { gap: 0.8, margin: 0.92, lh: 0.03 },
    { gap: 0.62, margin: 0.84, lh: 0.06 }
  ];
  var LAST_PAGE_MAX_FILL = 0.3;
  // A tighter fit is only accepted with about one line to spare on every page (see layout()).
  var FIT_RESERVE = 14;
  function applyFit(f) {
    var st = document.documentElement.style;
    st.setProperty('--fit-gap', f ? String(f.gap) : '1');
    st.setProperty('--fit-margin', f ? String(f.margin) : '1');
    st.setProperty('--fit-lh', f ? String(f.lh) : '0');
  }

  function paginate() {
    var st = capture();
    if (!st) return;
    applyFit(null);
    var r = layout(st);
    var fitted = 0;
    if (r.pages > 1 && r.lastFill < LAST_PAGE_MAX_FILL) {
      for (var i = 0; i < FIT_STEPS.length; i++) {
        applyFit(FIT_STEPS[i]);
        var t = layout(st, FIT_RESERVE);
        if (t.pages < r.pages && t.overflow === 0) {
          r = t;
          fitted = i + 1;
          break;
        }
      }
      if (!fitted) {
        applyFit(null);
        r = layout(st);
      }
    }
    var result = {
      pages: r.pages,
      overflow: r.overflow,
      fitted: fitted,
      nearlyFits: r.pages > 1 && r.lastFill < 0.25
    };
    window.__CV_READY__ = result;
    document.documentElement.setAttribute('data-cv-ready', String(r.pages));
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'cv:ready', result: result }, '*');
    } catch (e) {}
  }

  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (t && t.closest && t.closest('a')) ev.preventDefault();
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
