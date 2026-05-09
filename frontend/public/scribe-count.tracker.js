/**
 * ScribeCount first-party tracker SDK.
 *
 * Usage on an author website (xyz.com) — paste before </body>:
 *   <script src="https://app.scribecount.com/scribe-count.tracker.js" defer></script>
 *   <script>
 *     tracker.init('sc_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', {
 *       endpoint: 'https://app.scribecount.com/api/collect'
 *     });
 *     tracker.identify('user_123');                                   // optional
 *     tracker.track('add_to_cart', { productId: 'p1', price: 999 }); // optional explicit events
 *     tracker.track('order_completed', { orderId: 'o1', value: 999 });
 *   </script>
 *
 * The first argument to init() is the tracking key shown in the dashboard
 * (Settings → Site tracking). It is publishable (safe to ship in client code) — it can
 * only POST events for the site it belongs to. Rotate it from the dashboard if leaked.
 *
 * Auto-tracked: page_view, scroll_depth (25/50/75/100), clicks on a/button/input/select,
 *               and heuristic conversions on /cart, /checkout, /thank-you, /order-success.
 *
 * Supported core events:
 * - page_view, ad_click, add_to_wishlist, add_to_cart, remove_from_cart,
 *   checkout_started, order_completed
 */
(function () {
  'use strict';

  var EVENT_MAP = {
    page_view: { eventType: 1 },
    ad_click: { eventType: 2 },
    add_to_wishlist: { eventType: 2 },
    add_to_cart: { eventType: 2 },
    remove_from_cart: { eventType: 2 },
    checkout_started: { eventType: 4, conversionType: 'BuyClick' },
    order_completed: { eventType: 4, conversionType: 'Purchase' },
    scroll_depth: { eventType: 3 },
    click: { eventType: 2 },
  };

  var state = {
    trackingKey: null,
    siteId: null,
    endpoint: '/api/collect',
    trackSpa: true,
    trackScroll: true,
    trackClicks: true,
    maxClicksPerPage: 8,
    debug: false,
    identifiedUserId: null,
    initialized: false,
  };

  var milestonesHit = {};
  var clicksThisPage = 0;
  var scrollTicking = false;
  var lastUrl = '';

  function warn() {
    if (!state.debug || typeof console === 'undefined' || !console.warn) return;
    console.warn.apply(console, arguments);
  }

  function assignIfDefined(target, key, value) {
    if (value !== undefined && value !== null) target[key] = value;
  }

  function normalizeEndpoint(endpoint) {
    var raw = endpoint || '/api/collect';
    return String(raw).replace(/\/$/, '');
  }

  function getPageUrl() {
    var href = window.location.href;
    return /^https?:\/\//i.test(href) ? href : '';
  }

  function utmFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search);
      var m = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function (k) {
        var v = p.get(k);
        if (v) m[k] = v;
      });
      return m;
    } catch {
      return {};
    }
  }

  function postCollect(payload) {
    return fetch(state.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors',
      credentials: 'omit',
      keepalive: true,
    }).catch(function (err) {
      warn('[ScribeCount] collect failed', err);
    });
  }

  function normalizeConversionType(input) {
    var raw = String(input || '').trim().toLowerCase();
    if (!raw) return null;
    if (raw === 'purchase' || raw === 'order_completed') return 'Purchase';
    if (raw === 'buyclick' || raw === 'buy_click' || raw === 'checkout_started') return 'BuyClick';
    if (raw === 'signup' || raw === 'sign_up' || raw === 'lead') return 'Signup';
    return null;
  }

  function toPayload(eventName, data) {
    var map = EVENT_MAP[eventName] || { eventType: 2 };
    var metadata = Object.assign({}, data || {});
    metadata.eventName = eventName;

    if (eventName === 'page_view') {
      metadata = Object.assign({ title: document.title || '' }, utmFromUrl(), metadata);
    }

    if (state.identifiedUserId && !metadata.userId) {
      metadata.userId = state.identifiedUserId;
    }

    if (map.eventType === 4) {
      var fromData = normalizeConversionType(metadata.type);
      var fromMap = normalizeConversionType(map.conversionType);
      metadata.type = fromData || fromMap || 'Signup';
    }

    var pageUrl = metadata.pageUrl || getPageUrl();
    if (!pageUrl) return null;
    delete metadata.pageUrl;

    var body = {
      eventType: map.eventType,
      pageUrl: pageUrl,
      metadata: metadata,
      timestamp: null,
    };
    if (state.trackingKey) body.trackingKey = state.trackingKey;
    if (state.siteId) body.siteId = state.siteId;
    return body;
  }

  function resetPageSignals() {
    milestonesHit = {};
    clicksThisPage = 0;
  }

  function scrollPercent() {
    var doc = document.documentElement;
    var body = document.body;
    var scrollTop = window.scrollY || doc.scrollTop || body.scrollTop || 0;
    var h = (doc.scrollHeight || body.scrollHeight) - window.innerHeight;
    if (h <= 0) return 0;
    return Math.min(100, Math.round((scrollTop / h) * 100));
  }

  function onScroll() {
    if (!state.trackScroll) return;
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      scrollTicking = false;
      var pct = scrollPercent();
      [25, 50, 75, 100].forEach(function (m) {
        if (pct >= m && !milestonesHit[m]) {
          milestonesHit[m] = true;
          window.tracker.track('scroll_depth', { scrollDepth: m, x: 0, y: 0 });
        }
      });
    });
  }

  function onClickCapture(ev) {
    if (!state.trackClicks) return;
    if (!ev.target || !ev.target.closest) return;
    if (!ev.target.closest('a[href],button,input,textarea,select')) return;
    if (clicksThisPage >= state.maxClicksPerPage) return;
    clicksThisPage++;
    window.tracker.track('click', {
      x: Math.round(ev.clientX || 0),
      y: Math.round(ev.clientY || 0),
      scrollDepth: Math.round(scrollPercent() || 0),
    });
  }

  function onNav() {
    var href = getPageUrl();
    if (!href || href === lastUrl) return;
    lastUrl = href;
    resetPageSignals();
    window.tracker.track('page_view');
    trackBusinessEventsFromPath();
  }

  function seenKey(eventName, urlPath) {
    return 'sc_seen_event::' + eventName + '::' + urlPath;
  }

  function trackOncePerPath(eventName) {
    var path = (window.location.pathname || '/') + (window.location.search || '');
    try {
      var key = seenKey(eventName, path);
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    } catch {
      // If storage is blocked, fall through and track anyway.
    }
    window.tracker.track(eventName);
  }

  function pathLooksLikeAny(tokens) {
    var p = ((window.location.pathname || '') + (window.location.search || '')).toLowerCase();
    return tokens.some(function (t) { return p.indexOf(t) >= 0; });
  }

  function trackBusinessEventsFromPath() {
    if (pathLooksLikeAny(['/wishlist', 'wishlist'])) trackOncePerPath('add_to_wishlist');
    if (pathLooksLikeAny(['/cart', 'cart'])) trackOncePerPath('add_to_cart');
    if (pathLooksLikeAny(['/checkout', 'checkout'])) trackOncePerPath('checkout_started');
    if (pathLooksLikeAny(['/thank-you', '/thankyou', '/order-success', '/success', 'order=complete'])) {
      trackOncePerPath('order_completed');
    }
  }

  function bindAutoTracking() {
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClickCapture, true);

    if (!state.trackSpa) return;
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

  // A tracking key starts with "sc_" (e.g. "sc_live_..."). A SiteId is a 36-char GUID.
  function looksLikeTrackingKey(value) {
    return typeof value === 'string' && value.indexOf('sc_') === 0;
  }

  window.tracker = {
    init: function (keyOrSiteId, options) {
      options = options || {};
      var first = String(keyOrSiteId || options.trackingKey || options.siteId || '').trim();

      if (looksLikeTrackingKey(first)) {
        state.trackingKey = first;
      } else if (first) {
        // Backwards compatibility: treat raw GUID as siteId.
        state.siteId = first;
      }

      // Allow explicit overrides from options.
      if (options.trackingKey) state.trackingKey = String(options.trackingKey).trim();
      if (options.siteId) state.siteId = String(options.siteId).trim();

      state.endpoint = normalizeEndpoint(options.endpoint || state.endpoint);
      assignIfDefined(state, 'trackSpa', options.trackSpa);
      assignIfDefined(state, 'trackScroll', options.trackScroll);
      assignIfDefined(state, 'trackClicks', options.trackClicks);
      assignIfDefined(state, 'maxClicksPerPage', options.maxClicksPerPage);
      assignIfDefined(state, 'debug', options.debug);

      if (!state.trackingKey && !state.siteId) {
        warn('[ScribeCount] tracker.init requires a trackingKey (preferred) or siteId');
        return;
      }

      if (!state.initialized) {
        state.initialized = true;
        bindAutoTracking();
      }
      onNav();
    },

    identify: function (userId) {
      if (!userId) return;
      state.identifiedUserId = String(userId);
    },

    track: function (eventName, data) {
      if (!state.trackingKey && !state.siteId) {
        warn('[ScribeCount] Call tracker.init(trackingKey, ...) before tracker.track(...)');
        return Promise.resolve();
      }
      var name = String(eventName || '').trim();
      if (!name) return Promise.resolve();
      var payload = toPayload(name, data);
      if (!payload) return Promise.resolve();
      return postCollect(payload);
    },
  };

  // Backwards compatibility with older integration docs.
  window.scribeCountConversion = function (opts) {
    opts = opts || {};
    var name = opts.eventName || (opts.type && String(opts.type).toLowerCase() === 'purchase'
      ? 'order_completed'
      : 'checkout_started');
    return window.tracker.track(name, opts);
  };

  // Auto-init from a global config object if present, e.g.
  //   window.scribeCountTracking = { trackingKey: 'sc_live_...', endpoint: '...' };
  var preloaded = window.scribeCountTracking;
  if (preloaded && (preloaded.trackingKey || preloaded.apiKey || preloaded.siteId)) {
    window.tracker.init(preloaded.trackingKey || preloaded.apiKey || preloaded.siteId, {
      trackingKey: preloaded.trackingKey || preloaded.apiKey,
      siteId: preloaded.siteId,
      endpoint: preloaded.endpoint || '/api/collect',
      trackSpa: preloaded.trackSpa,
      trackScroll: preloaded.trackScroll,
      trackClicks: preloaded.trackClicks,
      maxClicksPerPage: preloaded.maxClicksPerPage,
      debug: preloaded.debug,
    });
  }
})();
