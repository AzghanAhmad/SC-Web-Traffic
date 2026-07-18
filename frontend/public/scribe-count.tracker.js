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
 * Works with plain HTML sites AND single-page apps (React / Vue / Angular / Next.js).
 * For SPAs there is no full page reload on navigation, so the SDK auto-detects route
 * changes via the History API (pushState/replaceState), popstate, hashchange, and a
 * light URL poll — every virtual route change fires a fresh page_view.
 *
 * Auto-tracked:
 * - page_view on every (virtual) navigation
 * - scroll_depth (25/50/75/100)
 * - clicks on a/button/input/select
 * - Funnel intent (NOT counted as conversions):
 *     "add to cart" / "buy now" / "checkout" / "place order" clicks
 * - CONVERSION (Purchase) only when the order actually succeeds:
 *     1) You call tracker.track('order_completed', ...) after a successful payment, OR
 *     2) The buyer lands on a thank-you / order-success URL, OR
 *     3) A confirmed element: data-sc-event="order_completed" data-sc-confirmed="true"
 *   Clicking "Place order" alone does NOT count if the order fails.
 *
 * Identity (visitors / sessions):
 *   tracker.identify('buyer_123')  // after login — different accounts = different visitors
 *   tracker.reset()                // on logout — clears the account, keeps anonymous device id
 *
 * Or fire events explicitly from your app code:
 *   tracker.track('add_to_cart', { productId: 'book-42', price: 9.99 });
 *   tracker.track('order_completed', { orderId: 'o1', value: 9.99, currency: 'USD' });
 *
 * Supported core events:
 * - page_view, ad_click, add_to_wishlist, add_to_cart, remove_from_cart,
 *   checkout_started, checkout_attempt, order_completed
 */
(function () {
  'use strict';

  var EVENT_MAP = {
    page_view: { eventType: 1 },
    ad_click: { eventType: 2 },
    add_to_wishlist: { eventType: 2 },
    add_to_cart: { eventType: 2 },
    remove_from_cart: { eventType: 2 },
    // Intent only — never a dashboard "conversion". Real conversion = order_completed.
    checkout_started: { eventType: 2 },
    checkout_attempt: { eventType: 2 },
    order_completed: { eventType: 4, conversionType: 'Purchase' },
    scroll_depth: { eventType: 3 },
    click: { eventType: 2 },
  };

  var CLIENT_ID_KEY = 'sc_client_id';
  var USER_ID_KEY = 'sc_user_id';

  var state = {
    trackingKey: null,
    siteId: null,
    endpoint: '/api/collect',
    trackSpa: true,
    trackScroll: true,
    trackClicks: true,
    trackConversions: true,
    maxClicksPerPage: 8,
    debug: false,
    identifiedUserId: null,
    clientId: null,
    initialized: false,
  };

  // Intent autocapture from button text. "Place order" is checkout_attempt (NOT a purchase).
  // Purchase only fires after success (explicit track / thank-you URL / data-sc-confirmed).
  var INTENT_RULES = [
    { event: 'checkout_attempt', kw: ['place order', 'complete order', 'complete purchase', 'confirm order', 'confirm & pay', 'confirm and pay', 'pay now', 'pay $', 'submit order'] },
    { event: 'checkout_started', kw: ['proceed to checkout', 'go to checkout', 'checkout', 'check out'] },
    { event: 'checkout_started', kw: ['buy now', 'buy it now', 'buy this book', 'buy book', 'buy', 'order now', 'purchase now', 'purchase'] },
    { event: 'add_to_cart', kw: ['add to cart', 'add to bag', 'add to basket', 'add to trolley', 'add to order'] },
    { event: 'add_to_wishlist', kw: ['add to wishlist', 'save for later', 'wishlist'] },
  ];

  var milestonesHit = {};
  var clicksThisPage = 0;
  var scrollTicking = false;
  var lastUrl = '';
  var urlPollTimer = null;
  var pageEnteredAt = 0;

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  function getOrCreateClientId() {
    if (state.clientId) return state.clientId;
    var existing = storageGet(CLIENT_ID_KEY);
    if (existing) {
      state.clientId = existing;
      return existing;
    }
    var id = 'c_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    storageSet(CLIENT_ID_KEY, id);
    state.clientId = id;
    return id;
  }

  function loadPersistedUserId() {
    return storageGet(USER_ID_KEY);
  }

  /**
   * Discover a logged-in account id from common auth storage (Supabase, etc.).
   * PriceHub and many apps store the session in localStorage without calling identify().
   */
  function discoverAuthUserId() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (!key) continue;
        var lower = key.toLowerCase();
        var looksAuth =
          lower.indexOf('auth-token') >= 0 ||
          lower.indexOf('supabase.auth') >= 0 ||
          lower === 'user' ||
          lower === 'currentuser' ||
          lower === 'authuser' ||
          lower === 'userid' ||
          lower === 'user_id' ||
          lower.indexOf('sb-') === 0 && lower.indexOf('auth') >= 0;
        if (!looksAuth) continue;

        var raw = localStorage.getItem(key);
        if (!raw) continue;

        // Plain id string
        if (raw.length < 80 && raw.indexOf('{') < 0 && raw.indexOf('[') < 0) {
          var plain = raw.replace(/^"|"$/g, '').trim();
          if (plain && plain.length >= 2) return plain;
        }

        try {
          var parsed = JSON.parse(raw);
          var uid =
            (parsed && parsed.user && (parsed.user.id || parsed.user.userId || parsed.user.email)) ||
            (parsed && parsed.currentSession && parsed.currentSession.user &&
              (parsed.currentSession.user.id || parsed.currentSession.user.email)) ||
            (parsed && parsed.session && parsed.session.user &&
              (parsed.session.user.id || parsed.session.user.email)) ||
            (parsed && (parsed.id || parsed.userId || parsed.uid || parsed.email));
          if (uid) return String(uid).trim();
        } catch {
          // ignore non-JSON
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  /** Keep tracker identity in sync with site login/logout (no site code changes required). */
  function syncIdentityFromAuth(forceNav) {
    var authId = discoverAuthUserId();
    if (authId) {
      if (state.identifiedUserId !== authId) {
        window.tracker.identify(authId);
        return true;
      }
    } else if (state.identifiedUserId) {
      // Logged out in the host app — drop account binding so the next buyer is separate.
      window.tracker.reset();
      return true;
    } else if (forceNav) {
      // no-op
    }
    return false;
  }

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

  /** Match backend DetectDevice — used as metadata.deviceType on every collect. */
  function detectDeviceType() {
    var ua = '';
    try { ua = String(navigator.userAgent || '').toLowerCase(); } catch { /* ignore */ }
    if (!ua) return 'Desktop';
    if (ua.indexOf('ipad') >= 0 || ua.indexOf('tablet') >= 0 || ua.indexOf('kindle') >= 0
        || (ua.indexOf('android') >= 0 && ua.indexOf('mobile') < 0)) {
      return 'Tablet';
    }
    if (ua.indexOf('mobi') >= 0 || ua.indexOf('iphone') >= 0 || ua.indexOf('ipod') >= 0
        || ua.indexOf('android') >= 0 || ua.indexOf('windows phone') >= 0
        || ua.indexOf('blackberry') >= 0 || ua.indexOf('opera mini') >= 0) {
      return 'Mobile';
    }
    return 'Desktop';
  }

  function attributionFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search);
      var m = {};
      // Support both standard UTMs and plain ?campaign= / ?source= / ?medium= links
      // e.g. https://shop.example/catalog?campaign=Flash%20Friday
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'campaign', 'source', 'medium'].forEach(function (k) {
        var v = p.get(k);
        if (v) m[k] = v;
      });
      if (m.campaign && !m.utm_campaign) m.utm_campaign = m.campaign;
      if (m.source && !m.utm_source) m.utm_source = m.source;
      if (m.medium && !m.utm_medium) m.utm_medium = m.medium;
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
    var metadata = Object.assign({}, attributionFromUrl(), data || {});
    metadata.eventName = eventName;
    metadata.clientId = getOrCreateClientId();

    if (eventName === 'page_view') {
      metadata = Object.assign({ title: document.title || '' }, metadata);
      metadata.clientId = getOrCreateClientId();
      try {
        if (document.referrer) metadata.referrer = document.referrer;
      } catch { /* ignore */ }
    }

    if (state.identifiedUserId && !metadata.userId) {
      metadata.userId = state.identifiedUserId;
    }

    // Explicit device class so Device Insights stays correct even if a proxy strips User-Agent.
    if (!metadata.deviceType) {
      metadata.deviceType = detectDeviceType();
    }

    if (map.eventType === 4) {
      var fromData = normalizeConversionType(metadata.type);
      var fromMap = normalizeConversionType(map.conversionType);
      metadata.type = fromData || fromMap || 'Purchase';
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

  function actionableText(el) {
    if (!el) return '';
    var raw =
      el.getAttribute('aria-label') ||
      (typeof el.value === 'string' ? el.value : '') ||
      el.textContent ||
      el.getAttribute('title') ||
      '';
    return String(raw).toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  // Camel-case data-sc-* attributes (except data-sc-event) into a metadata object.
  function collectScData(el) {
    var out = {};
    if (!el || !el.attributes) return out;
    for (var i = 0; i < el.attributes.length; i++) {
      var attr = el.attributes[i];
      if (attr.name.indexOf('data-sc-') !== 0 || attr.name === 'data-sc-event') continue;
      var suffix = attr.name.slice('data-sc-'.length);
      var camel = suffix.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
      if (camel) out[camel] = attr.value;
    }
    return out;
  }

  // Decide whether a clicked element represents a business event.
  function detectIntent(el) {
    var explicit = el.getAttribute && el.getAttribute('data-sc-event');
    if (explicit && explicit.trim()) {
      var data = collectScData(el);
      if (!data.label) data.label = actionableText(el);
      return { event: explicit.trim(), data: data };
    }
    var text = actionableText(el);
    if (!text) return null;
    for (var r = 0; r < INTENT_RULES.length; r++) {
      var rule = INTENT_RULES[r];
      for (var k = 0; k < rule.kw.length; k++) {
        if (text.indexOf(rule.kw[k]) >= 0) {
          return { event: rule.event, data: { label: text, matchedOn: 'text' } };
        }
      }
    }
    return null;
  }

  function isConfirmedPurchase(el, data) {
    if (!el) return false;
    if (el.getAttribute && el.getAttribute('data-sc-confirmed') === 'true') return true;
    if (data && (data.confirmed === true || data.confirmed === 'true')) return true;
    return false;
  }

  function onClickCapture(ev) {
    if (!ev.target || !ev.target.closest) return;

    // 1) Intent / conversion autocapture.
    // Elements inside [data-sc-ignore] (e.g. header nav links) are skipped.
    if (state.trackConversions && !(ev.target.closest && ev.target.closest('[data-sc-ignore]'))) {
      var actionable = ev.target.closest('a[href],button,[role="button"],input[type="submit"],input[type="button"],[data-sc-event]');
      if (actionable) {
        var intent = detectIntent(actionable);
        if (intent && intent.event) {
          // order_completed from a click only when explicitly confirmed (success UI).
          // A bare "Place order" click is checkout_attempt — order may still fail.
          if (intent.event === 'order_completed' && !isConfirmedPurchase(actionable, intent.data)) {
            window.tracker.track('checkout_attempt', intent.data);
          } else {
            window.tracker.track(intent.event, intent.data);
          }
        }
      }
    }

    // 2) Generic click for engagement/heatmaps (rate-limited per page).
    if (!state.trackClicks) return;
    if (!ev.target.closest('a[href],button,input,textarea,select')) return;
    if (clicksThisPage >= state.maxClicksPerPage) return;
    clicksThisPage++;
    window.tracker.track('click', {
      x: Math.round(ev.clientX || 0),
      y: Math.round(ev.clientY || 0),
      scrollDepth: Math.round(scrollPercent() || 0),
    });
  }

  function flushDwellTime() {
    if (!lastUrl || !pageEnteredAt) return;
    if (!state.trackingKey && !state.siteId) return;
    var secs = Math.max(0, Math.round((Date.now() - pageEnteredAt) / 1000));
    if (secs < 1) return;
    var payload = toPayload('page_view', { pageUrl: lastUrl, timeOnPage: secs, dwellUpdate: 'true' });
    if (payload) postCollect(payload);
  }

  function onNav() {
    var href = getPageUrl();
    if (!href || href === lastUrl) return;
    flushDwellTime();
    lastUrl = href;
    pageEnteredAt = Date.now();
    resetPageSignals();
    window.tracker.track('page_view');
    trackBusinessEventsFromPath();
  }

  function identityKey() {
    return state.identifiedUserId || state.clientId || getOrCreateClientId() || 'anon';
  }

  function seenKey(eventName, urlPath) {
    return 'sc_seen_event::' + identityKey() + '::' + eventName + '::' + urlPath;
  }

  function clearSeenEvents() {
    try {
      var keys = [];
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i);
        if (k && k.indexOf('sc_seen_event::') === 0) keys.push(k);
      }
      keys.forEach(function (k) { sessionStorage.removeItem(k); });
    } catch {
      // ignore
    }
  }

  function newPurchaseNonce() {
    return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function trackOncePerPath(eventName, data) {
    var path = (window.location.pathname || '/') + (window.location.search || '');
    try {
      var key = seenKey(eventName, path);
      if (sessionStorage.getItem(key) === '1') return;
      sessionStorage.setItem(key, '1');
    } catch {
      // If storage is blocked, fall through and track anyway.
    }
    window.tracker.track(eventName, data || {});
  }

  function pathLooksLikeAny(tokens) {
    var p = ((window.location.pathname || '') + (window.location.search || '')).toLowerCase();
    return tokens.some(function (t) { return p.indexOf(t) >= 0; });
  }

  function trackBusinessEventsFromPath() {
    if (pathLooksLikeAny(['/wishlist', 'wishlist'])) trackOncePerPath('add_to_wishlist');
    if (pathLooksLikeAny(['/cart', 'cart'])) trackOncePerPath('add_to_cart');
    if (pathLooksLikeAny(['/checkout', 'checkout'])) trackOncePerPath('checkout_started');

    var pathOnly = (window.location.pathname || '').toLowerCase();
    // PriceHub and many stores: /order/:id after a successful checkout (NOT /orders list).
    var orderMatch = pathOnly.match(/^\/order\/([^/]+)\/?$/);
    if (orderMatch && orderMatch[1] && orderMatch[1] !== 'new') {
      trackOncePerPath('order_completed', {
        orderId: decodeURIComponent(orderMatch[1]),
        purchaseNonce: newPurchaseNonce(),
      });
      return;
    }

    if (pathLooksLikeAny([
      '/thank-you', '/thankyou', '/order-success', '/order-confirmation',
      '/order-confirmed', '/orders/success', '/checkout/success', '/purchase/success',
      '/success', 'order=complete', 'payment=success', 'status=success',
    ])) {
      trackOncePerPath('order_completed', { purchaseNonce: newPurchaseNonce() });
    }
  }

  function bindAutoTracking() {
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true });
    if (state.trackClicks || state.trackConversions) {
      document.addEventListener('click', onClickCapture, true);
    }
    window.addEventListener('pagehide', flushDwellTime);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') flushDwellTime();
    });

    if (!state.trackSpa) return;

    // Patch the History API so client-side router navigations fire a page_view.
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
    // Hash-based routers (e.g. HashRouter, #/cart) don't touch pushState.
    window.addEventListener('hashchange', function () {
      setTimeout(onNav, 0);
    });
    // Safety net for routers that swap the URL without the History API or that we
    // patched too late: poll the location and emit a page_view when it changes.
    if (urlPollTimer) clearInterval(urlPollTimer);
    urlPollTimer = setInterval(function () {
      // Keep identity aligned with host-app login/logout (e.g. Supabase session in localStorage).
      syncIdentityFromAuth(false);
      if (getPageUrl() !== lastUrl) onNav();
    }, 800);

    // Cross-tab login/logout.
    window.addEventListener('storage', function () {
      syncIdentityFromAuth(false);
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
      assignIfDefined(state, 'trackConversions', options.trackConversions);
      assignIfDefined(state, 'maxClicksPerPage', options.maxClicksPerPage);
      assignIfDefined(state, 'debug', options.debug);

      if (!state.trackingKey && !state.siteId) {
        warn('[ScribeCount] tracker.init requires a trackingKey (preferred) or siteId');
        return;
      }

      getOrCreateClientId();
      // Prefer live auth session (Supabase etc.) over a stale persisted id.
      var authId = discoverAuthUserId();
      if (authId) {
        state.identifiedUserId = authId;
        storageSet(USER_ID_KEY, authId);
      } else if (!state.identifiedUserId) {
        var persisted = loadPersistedUserId();
        if (persisted) state.identifiedUserId = persisted;
      }

      if (!state.initialized) {
        state.initialized = true;
        bindAutoTracking();
      }
      // Re-sync in case auth hydrated a moment after init.
      setTimeout(function () { syncIdentityFromAuth(false); }, 300);
      setTimeout(function () { syncIdentityFromAuth(false); }, 1500);
      onNav();
    },

    /**
     * Bind subsequent events to a logged-in buyer account.
     * Different accounts on the same device become different visitors/sessions.
     */
    identify: function (userId) {
      if (!userId) return;
      var next = String(userId).trim();
      if (!next) return;
      var prev = state.identifiedUserId;
      state.identifiedUserId = next;
      storageSet(USER_ID_KEY, next);
      // Switching accounts: clear path-dedupe so the new buyer can convert on thank-you,
      // and force a fresh page_view so the backend opens a new visitor/session.
      if (prev !== next) {
        clearSeenEvents();
        if (state.initialized) {
          lastUrl = '';
          onNav();
        }
      }
    },

    /** Call on logout so the next anonymous / next account is tracked separately. */
    reset: function () {
      state.identifiedUserId = null;
      storageRemove(USER_ID_KEY);
      clearSeenEvents();
      if (state.initialized) {
        lastUrl = '';
        onNav();
      }
    },

    track: function (eventName, data) {
      if (!state.trackingKey && !state.siteId) {
        warn('[ScribeCount] Call tracker.init(trackingKey, ...) before tracker.track(...)');
        return Promise.resolve();
      }
      var name = String(eventName || '').trim();
      if (!name) return Promise.resolve();
      var payloadData = Object.assign({}, data || {});
      // Every purchase gets a unique key so two accounts never collapse into one conversion.
      if (name === 'order_completed' && !payloadData.orderId && !payloadData.purchaseNonce) {
        payloadData.purchaseNonce = newPurchaseNonce();
      }
      var payload = toPayload(name, payloadData);
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
      trackConversions: preloaded.trackConversions,
      maxClicksPerPage: preloaded.maxClicksPerPage,
      debug: preloaded.debug,
    });
  }
})();
