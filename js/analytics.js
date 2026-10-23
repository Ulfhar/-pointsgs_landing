/* Shared GA4 instrumentation. CookieYes grants analytics before Google is loaded. */
(function () {
    'use strict';
    if (window.PointsAnalytics) return;

    var ID = 'G-RSXV2Q3WG2';
    // Copies on localhost, preview hosts or staging must never send to the live property.
    var production = window.location.protocol === 'https:' &&
        /^(points\.gs|www\.points\.gs)$/.test(window.location.hostname);
    var internalStorageKey = 'points.analytics.internal';
    var query = new URL(window.location.href).searchParams;
    var internalChoice = query.get('analytics_internal');
    var internalBrowser = internalChoice === '1';
    try {
        if (internalChoice === '1') window.localStorage.setItem(internalStorageKey, '1');
        else if (internalChoice === '0') window.localStorage.removeItem(internalStorageKey);
        if (internalChoice !== '0') internalBrowser = internalBrowser || window.localStorage.getItem(internalStorageKey) === '1';
    } catch (_) { /* Explicit on/off still applies to this opening when storage is unavailable. */ }
    var internal = internalBrowser || query.get('analytics_debug') === '1';
    var allowed = false, started = false, googleReady = false, configured = false;
    var ready = false, localeReady = false, pageViewSent = false, pending = [];
    var article, activeMs = 0, reached = 0, readSent = false, lastTick = Date.now();
    var schemas = {
        play_store_click: ['link_location', 'link_url'],
        press_asset_download: ['asset_type', 'file_name', 'link_location'],
        contact_click: ['link_location'],
        generate_lead: ['form_id'],
        contact_error: ['form_id'],
        share: ['method', 'content_id', 'content_type'],
        share_click: ['method', 'content_id', 'content_type'],
        social_click: ['network'],
        article_engaged: ['active_seconds', 'percent_scrolled']
    };
    var campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id', 'utm_content', 'utm_term'];
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window['ga-disable-' + ID] = true;
    window.gtag('consent', 'default', {
        analytics_storage: 'denied', ad_storage: 'denied',
        ad_user_data: 'denied', ad_personalization: 'denied'
    });

    function safeURL(value, campaigns) {
        try {
            var url = new URL(value, window.location.href);
            if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
            var clean = new URL(url.origin + url.pathname);
            if (campaigns) campaignKeys.forEach(function (key) {
                if (url.searchParams.has(key)) clean.searchParams.set(key, url.searchParams.get(key).slice(0, 100));
            });
            return clean.href;
        } catch (_) { return ''; }
    }

    function pageType() {
        var path = window.location.pathname;
        if (document.querySelector('.news-article .news-content')) return 'article';
        if (/\/devlog\.html$/.test(path)) return 'blog_index';
        if (/\/about\.html$/.test(path)) return 'about';
        if (/\/press-kit\.html$/.test(path)) return 'press_kit';
        if (path === '/' || /\/index\.html$/.test(path)) return 'home';
        return 'other';
    }

    function common() {
        var language = (document.body && document.body.getAttribute('data-static-locale')) || document.documentElement.lang;
        var params = { page_language: language === 'uk' || language === 'ua' ? 'uk' : 'en', page_type: pageType() };
        if (params.page_type === 'article') {
            var root = document.querySelector('.news-article');
            params.article_id = root.getAttribute('data-article-id') || window.location.pathname.replace(/^\/uk\//, '/').replace(/^\//, '').replace(/\.html$/, '');
        }
        return params;
    }

    function debug() {
        return query.get('analytics_debug') === '1';
    }

    function send(name, params) {
        if (!allowed) return false;
        params = Object.assign(common(), params);
        // Do not send form values, mailto addresses, URL fragments or unrelated query parameters.
        params.page_location = safeURL(window.location.href, true);
        params.page_referrer = document.referrer ? safeURL(document.referrer, false) : '';
        if (internal) params.traffic_type = 'internal';
        if (debug()) params.debug_mode = true;
        if (googleReady && configured && ready && localeReady) window.gtag('event', name, params);
        else if (pending.length < 50) pending.push({ name: name, params: params });
        else return false;
        return true;
    }

    function track(name, values) {
        try {
            if (!allowed || !Object.prototype.hasOwnProperty.call(schemas, name)) return false;
            var params = {};
            schemas[name].forEach(function (key) {
                var value = values && values[key];
                if (typeof value === 'string') params[key] = key === 'link_url' ? value : value.slice(0, 100);
                else if (typeof value === 'number' && isFinite(value)) params[key] = value;
            });
            return send(name, params);
        } catch (_) { return false; }
    }
    window.PointsAnalytics = { track: track, hasPageView: function () { return pageViewSent; } };

    function pageView() {
        if (ready && localeReady && allowed && googleReady && configured && !pageViewSent) {
            pageViewSent = send('page_view', {});
            if (pageViewSent) document.dispatchEvent(new CustomEvent('points:analytics-page-view'));
        }
    }

    function activateGoogle() {
        if (!allowed || !googleReady) return;
        if (!configured) {
            configured = true;
            // Global settings also label GA's automatic session/engagement events.
            if (internal) window.gtag('set', { traffic_type: 'internal' });
            window.gtag('js', new Date());
            var config = {
                send_page_view: false,
                allow_google_signals: false,
                allow_ad_personalization_signals: false,
                page_location: safeURL(window.location.href, true),
                page_referrer: document.referrer ? safeURL(document.referrer, false) : ''
            };
            if (internal) config.traffic_type = 'internal';
            window.gtag('config', ID, config);
        }
        pageView();
        if (!ready || !localeReady) return;
        var events = pending;
        pending = [];
        events.forEach(function (event) { window.gtag('event', event.name, event.params); });
    }

    function consent(granted) {
        granted = granted && production;
        if (granted === allowed) return;
        allowed = granted;
        window['ga-disable-' + ID] = !allowed;
        activeMs = 0;
        reached = 0;
        lastTick = Date.now();
        window.gtag('consent', 'update', { analytics_storage: allowed ? 'granted' : 'denied',
            ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
        if (!allowed) {
            // Actions from a withdrawn grant must not replay if the remote script is slow.
            if (pending.some(function (event) { return event.name === 'article_engaged'; })) readSent = false;
            pending = [];
            return;
        }
        if (!started) {
            started = true;
            var script = document.createElement('script');
            script.async = true;
            script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
            script.onload = function () { googleReady = true; activateGoogle(); };
            script.onerror = function () { started = false; pending = []; readSent = false; };
            document.head.appendChild(script);
        }
        activateGoogle();
    }

    document.addEventListener('cookieyes_banner_load', function (event) {
        var categories = event.detail && event.detail.categories;
        if (categories) consent(categories.analytics === true);
    });
    document.addEventListener('cookieyes_consent_update', function (event) {
        var detail = event.detail || {};
        if (Array.isArray(detail.accepted)) consent(detail.accepted.indexOf('analytics') !== -1);
        else if (detail.categories) consent(detail.categories.analytics === true);
    });

    function linkLocation(link) {
        var explicit = link.getAttribute('data-analytics-location');
        if (explicit) return explicit;
        if (link.closest('footer, .footer')) return 'footer';
        if (link.closest('.news-article')) return 'article';
        var section = link.closest('section[id]');
        return section ? section.id : pageType();
    }

    function network(host) {
        if (/(^|\.)(twitter\.com|x\.com)$/.test(host)) return 'x';
        if (/(^|\.)facebook\.com$/.test(host)) return 'facebook';
        if (host === 't.me') return 'telegram';
        if (/(^|\.)linkedin\.com$/.test(host)) return 'linkedin';
        if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return 'youtube';
        if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
        if (host === 'bsky.app') return 'bluesky';
        return 'other';
    }

    function click(event) {
        if (!allowed || event.defaultPrevented ||
                (event.type === 'auxclick' && event.button !== 1) ||
                (event.type === 'click' && event.button != null && event.button !== 0)) return;
        var link = event.target && event.target.closest && event.target.closest('a[href]');
        if (!link) return;
        try {
            var url = new URL(link.href, window.location.href);
            var placement = linkLocation(link);
            if (url.protocol === 'https:' && url.hostname === 'play.google.com' &&
                    url.pathname === '/store/apps/details' && url.searchParams.get('id') === 'comPointsGameForge.FarFarForest') {
                track('play_store_click', { link_location: placement, link_url: url.href });
            } else if (url.protocol === 'mailto:') {
                track('contact_click', { link_location: placement });
            } else if (link.matches('.press-bundle-link, .press-asset-download')) {
                var file = decodeURIComponent(url.pathname.split('/').pop());
                track('press_asset_download', { file_name: file, asset_type: file.split('.').pop().toLowerCase(), link_location: placement });
            } else if (link.closest('[data-article-share]')) {
                var group = link.closest('[data-article-share]');
                track('share_click', { method: network(url.hostname), content_type: 'article',
                    content_id: new URL(group.dataset.shareUrl, window.location.href).pathname });
            } else if (url.origin !== window.location.origin && network(url.hostname) !== 'other') {
                track('social_click', { network: network(url.hostname) });
            }
        } catch (_) { /* Navigation remains available if analytics cannot describe a link. */ }
    }

    function readingTick() {
        var now = Date.now();
        var elapsed = Math.min(2000, Math.max(0, now - lastTick));
        lastTick = now;
        if (!article || readSent || !allowed || document.hidden || (document.hasFocus && !document.hasFocus())) return;
        var rect = article.getBoundingClientRect();
        if (rect.top >= window.innerHeight || rect.top + rect.height <= 0) return;
        activeMs += elapsed;
        if (rect.height > 0) reached = Math.max(reached, Math.min(1, (window.innerHeight - rect.top) / rect.height));
        if (reached >= 0.5 && activeMs >= 30000) {
            readSent = track('article_engaged', { active_seconds: Math.floor(activeMs / 1000), percent_scrolled: 50 });
        }
    }

    function init() {
        ready = true;
        localeReady = !!(document.body && document.body.getAttribute('data-static-locale')) ||
            !document.querySelector('script[src*="js/locale.js"]') ||
            document.documentElement.getAttribute('data-locale-ready') === 'true';
        article = document.querySelector('.news-article .news-content');
        lastTick = Date.now();
        document.addEventListener('click', click);
        document.addEventListener('auxclick', click);
        if (article) {
            window.setInterval(readingTick, 1000);
            document.addEventListener('visibilitychange', function () { lastTick = Date.now(); });
            window.addEventListener('focus', function () { lastTick = Date.now(); });
            window.addEventListener('blur', function () { lastTick = Date.now(); });
        }
        activateGoogle();
    }
    document.addEventListener('points:locale-ready', function () {
        localeReady = true;
        activateGoogle();
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
