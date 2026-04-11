/**
 * ScribeCount first-party tracker — page views, scroll milestones, clicks (heatmap + engagement),
 * and optional conversions. No third-party analytics.
 *
 *   window.scribeCountTracking = {
 *     siteId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
 *     endpoint: 'https://your-host/api/collect',
 *     trackSpa: true,
 *     trackScroll: true,
 *     trackClicks: true,
 *     maxClicksPerPage: 8
 *   };
 *
 * Conversions from your site (newsletter, buy button, etc.):
 *   window.scribeCountConversion({ type: 'Signup' });           // or BuyClick, Purchase
 *   window.scribeCountConversion({ type: 'Purchase', value: 4.99 });
 */
(function () {
  'use strict';

  var cfg = window.scribeCountTracking;
  if (!cfg || !cfg.siteId || !cfg.endpoint) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[ScribeCount] Missing window.scribeCountTracking.siteId or .endpoint');
    }
    return;
  }

  var siteId = String(cfg.siteId);
  var endpoint = String(cfg.endpoint).replace(/\/$/, '');
  var trackSpa = cfg.trackSpa !== false;
  var trackScroll = cfg.trackScroll !== false;
  var trackClicks = cfg.trackClicks !== false;
  var maxClicks = typeof cfg.maxClicksPerPage === 'number' ? cfg.maxClicksPerPage : 8;
  var debug = !!cfg.debug;

  var milestonesHit = {};
  var clicksThisPage = 0;
  var scrollTicking = false;

  function utmFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search);
      var m = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
        var v = p.get(k);
        if (v) m[k] = v;
      });
      return m;
    } catch (e) {
      return {};
    }
  }

  function post(bodyObj) {
    var body = JSON.stringify(bodyObj);
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
      mode: 'cors',
      credentials: 'omit',
      keepalive: true,
    }).catch(function (err) {
      if (debug) console.warn('[ScribeCount] collect failed', err);
    });
  }

  function sendPageView() {
    var href = window.location.href;
    if (!/^https?:\/\//i.test(href)) return;
    var meta = Object.assign({ title: document.title || '' }, utmFromUrl());
    return post({
      siteId: siteId,
      eventType: 1,
      pageUrl: href,
      metadata: meta,
      timestamp: null,
    });
  }

  function sendScrollMilestone(depth) {
    var href = window.location.href;
    if (!/^https?:\/\//i.test(href)) return;
    return post({
      siteId: siteId,
      eventType: 3,
      pageUrl: href,
      metadata: { scrollDepth: depth, x: 0, y: 0 },
      timestamp: null,
    });
  }

  function sendClick(ev) {
    if (clicksThisPage >= maxClicks) return;
    clicksThisPage++;
    var href = window.location.href;
    if (!/^https?:\/\//i.test(href)) return;
    return post({
      siteId: siteId,
      eventType: 2,
      pageUrl: href,
      metadata: {
        x: Math.round(ev.clientX || 0),
        y: Math.round(ev.clientY || 0),
        scrollDepth: Math.round(scrollPercent() || 0),
      },
      timestamp: null,
    });
  }

  function scrollPercent() {
    var doc = document.documentElement;
    var body = document.body;
    var scrollTop = window.scrollY ?? doc.scrollTop ?? body.scrollTop ?? 0;
    var h = (doc.scrollHeight || body.scrollHeight) - window.innerHeight;
    if (h <= 0) return 0;
    return Math.min(100, Math.round((scrollTop / h) * 100));
  }

  function onScroll() {
    if (!trackScroll) return;
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      scrollTicking = false;
      var pct = scrollPercent();
      [25, 50, 75, 100].forEach(function (m) {
        if (pct >= m && !milestonesHit[m]) {
          milestonesHit[m] = true;
          sendScrollMilestone(m);
        }
      });
    });
  }

  function onClickCapture(ev) {
    if (!trackClicks) return;
    if (ev.target && ev.target.closest && ev.target.closest('a[href],button,input,textarea,select')) {
      sendClick(ev);
    }
  }

  function resetPageSignals() {
    milestonesHit = {};
    clicksThisPage = 0;
  }

  window.scribeCountConversion = function (opts) {
    opts = opts || {};
    var t = opts.type || 'Signup';
    var href = window.location.href;
    if (!/^https?:\/\//i.test(href)) return Promise.resolve();
    var meta = { type: t };
    if (opts.value != null && opts.value !== '') meta.value = opts.value;
    return post({
      siteId: siteId,
      eventType: 4,
      pageUrl: href,
      metadata: meta,
      timestamp: null,
    });
  };

  var lastUrl = '';
  function onNav() {
    var href = window.location.href;
    if (href === lastUrl) return;
    lastUrl = href;
    resetPageSignals();
    sendPageView();
  }

  function bindEngagement() {
    if (trackScroll) {
      window.addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('scroll', onScroll, { passive: true });
    }
    if (trackClicks) {
      document.addEventListener('click', onClickCapture, true);
    }
  }

  function init() {
    lastUrl = '';
    onNav();
    bindEngagement();

    if (!trackSpa) return;

    var _push = history.pushState;
    var _replace = history.replaceState;
    history.pushState = function () {
      _push.apply(history, arguments);
      setTimeout(onNav, 0);
    };
    history.replaceState = function () {
      _replace.apply(history, arguments);
      setTimeout(onNav, 0);
    };
    window.addEventListener('popstate', function () {
      setTimeout(onNav, 0);
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
