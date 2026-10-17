/* Run with: node tests/check_analytics.js. Mocked browser APIs; no network calls. */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/analytics.js'), 'utf8');
const tests = [];
const measurementID = 'G-RSXV2Q3WG2';
const game = 'https://play.google.com/store/apps/details?id=comPointsGameForge.FarFarForest';

class Events {
    constructor() { this.listeners = new Map(); }
    addEventListener(name, callback, options) {
        if (!this.listeners.has(name)) this.listeners.set(name, []);
        this.listeners.get(name).push({ callback, once: Boolean(options && options.once) });
    }
    dispatch(name, properties = {}) {
        for (const entry of [...(this.listeners.get(name) || [])]) {
            entry.callback({ type: name, target: this, ...properties });
            if (entry.once) this.listeners.set(name, this.listeners.get(name).filter(value => value !== entry));
        }
    }
}

class Element extends Events {
    constructor(tag = 'div', attributes = {}, parent = null) {
        super();
        this.tagName = tag.toUpperCase();
        this.attributes = attributes;
        this.parent = parent;
        this.id = attributes.id || '';
        this.dataset = {};
        for (const [key, value] of Object.entries(attributes)) {
            if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
        }
    }
    getAttribute(name) { return this.attributes[name] ?? null; }
    matches(selector) {
        return selector.split(',').some(part => {
            part = part.trim();
            if (part.startsWith('.')) return (this.attributes.class || '').split(/\s+/).includes(part.slice(1));
            const match = part.match(/^(\w+)?(?:\[([\w-]+)\])?$/);
            if (!match) throw new Error(`Unsupported test selector: ${part}`);
            return (!match[1] || this.tagName === match[1].toUpperCase()) && (!match[2] || this.getAttribute(match[2]) !== null);
        });
    }
    closest(selector) {
        for (let current = this; current; current = current.parent) if (current.matches(selector)) return current;
        return null;
    }
}

function setup({ href = 'https://points.gs/index.html', lang = 'en', staticLocale, article = false, articleID,
    readyState = 'complete', referrer = '', autoGoogle = true, localeScript = false, localeReady = false } = {}) {
    let now = 0, focused = true;
    const intervals = [];
    const scripts = [];
    const document = new Events();
    const articleRoot = new Element('article', { class: 'news-article', ...(articleID ? { 'data-article-id': articleID } : {}) });
    const content = new Element('div', { class: 'news-content' }, articleRoot);
    content.rect = { top: 800, height: 1000 };
    content.getBoundingClientRect = () => content.rect;
    Object.assign(document, {
        readyState, referrer, hidden: false,
        body: new Element('body', staticLocale ? { 'data-static-locale': staticLocale } : {}),
        documentElement: Object.assign(new Element('html', { ...(localeReady ? { 'data-locale-ready': 'true' } : {}) }), { lang }),
        head: { appendChild(script) { scripts.push(script); if (autoGoogle) script.onload(); } },
        hasFocus: () => focused,
        createElement: tag => new Element(tag),
        querySelector(selector) {
            if (selector === '.news-article .news-content') return article ? content : null;
            if (selector === '.news-article') return article ? articleRoot : null;
            if (selector === 'script[src*="js/locale.js"]') return localeScript ? new Element('script') : null;
            throw new Error(`Unexpected test selector: ${selector}`);
        }
    });
    const window = new Events();
    Object.assign(window, {
        location: new URL(href), innerHeight: 800,
        setInterval(callback, delay) { intervals.push({ callback, delay }); return intervals.length; }
    });
    class ClockDate extends Date { static now() { return now; } }
    const context = vm.createContext({ window, document, URL, Date: ClockDate });
    function load() { vm.runInContext(source, context, { filename: 'js/analytics.js' }); }
    load();
    const commands = () => Array.from(window.dataLayer, args => Array.from(args));
    const events = name => commands().filter(args => args[0] === 'event' && (!name || args[1] === name))
        .map(args => ({ name: args[1], params: JSON.parse(JSON.stringify(args[2])) }));
    const consent = (accepted = ['analytics']) => document.dispatch('cookieyes_consent_update', { detail: { accepted } });
    return {
        window, document, articleRoot, content, scripts, intervals, commands, events, consent, load,
        track: (name, params) => window.PointsAnalytics.track(name, params),
        banner: analytics => document.dispatch('cookieyes_banner_load', { detail: { categories: { analytics } } }),
        googleLoaded() { assert.equal(scripts.length, 1); scripts[0].onload(); },
        localeLoaded(language) {
            document.documentElement.lang = language;
            document.documentElement.attributes['data-locale-ready'] = 'true';
            document.dispatch('points:locale-ready');
        },
        ready() { document.readyState = 'complete'; document.dispatch('DOMContentLoaded'); },
        advance(seconds) {
            for (let i = 0; i < seconds; i += 1) { now += 1000; intervals.forEach(interval => interval.callback()); }
        },
        visible(value) { document.hidden = !value; document.dispatch('visibilitychange'); },
        focus(value) { focused = value; window.dispatch(value ? 'focus' : 'blur'); },
        link(href, attributes = {}, parent = null) {
            const link = new Element('a', { href, ...attributes }, parent);
            link.href = new URL(href, window.location.href).href;
            return link;
        },
        click(target, properties = {}) {
            const event = { target, button: 0, defaultPrevented: false, preventDefault() {
                throw new Error('Analytics must not prevent navigation');
            }, ...properties };
            document.dispatch(properties.type || 'click', event);
        }
    };
}

function test(name, run) { tests.push({ name, run }); }
function countCommands(page, command) { return page.commands().filter(args => args[0] === command).length; }

test('No Google script or event before consent or after rejection; actions are not replayed', () => {
    const page = setup({ article: true });
    assert.equal(page.window[`ga-disable-${measurementID}`], true);
    assert.equal(page.scripts.length, 0);
    assert.equal(page.track('generate_lead', { form_id: 'contactForm' }), false);
    page.click(page.link(game));
    page.content.rect.top = -200;
    page.advance(60);
    page.consent(['necessary']);
    page.banner(false);
    assert.equal(page.scripts.length, 0);
    assert.deepEqual(page.events(), []);
    page.consent();
    assert.deepEqual(page.events().map(event => event.name), ['page_view']);
    page.advance(1);
    assert.deepEqual(page.events().map(event => event.name), ['page_view']);
});

test('Accepting Analytics loads Google once and sends one explicit sanitized page view', () => {
    const page = setup();
    page.consent();
    assert.equal(page.scripts.length, 1);
    assert.equal(page.scripts[0].src, `https://www.googletagmanager.com/gtag/js?id=${measurementID}`);
    assert.equal(page.scripts[0].async, true);
    assert.equal(page.window[`ga-disable-${measurementID}`], false);
    assert.equal(countCommands(page, 'config'), 1);
    const config = page.commands().find(args => args[0] === 'config');
    assert.equal(config[1], measurementID);
    assert.equal(config[2].send_page_view, false);
    assert.equal(config[2].allow_google_signals, false);
    assert.equal(config[2].allow_ad_personalization_signals, false);
    assert.equal(page.events('page_view').length, 1);
    for (let i = 0; i < 3; i += 1) { page.consent(); page.banner(true); }
    assert.equal(page.scripts.length, 1);
    assert.equal(countCommands(page, 'config'), 1);
    assert.equal(page.events('page_view').length, 1);
});

test('A returning visitor uses the saved banner categories; a boolean true is required', () => {
    const page = setup();
    page.banner('true');
    assert.equal(page.scripts.length, 0);
    page.banner(true);
    assert.equal(page.scripts.length, 1);
    assert.equal(page.events('page_view').length, 1);
    page.document.dispatch('cookieyes_consent_update', { detail: { categories: { analytics: false } } });
    assert.equal(page.track('generate_lead', { form_id: 'contactForm' }), false);
});

test('A slow Google load holds consented actions only and drops them if consent is withdrawn', () => {
    const page = setup({ autoGoogle: false });
    page.click(page.link(game)); // No consent: never collect this action.
    page.consent();
    page.click(page.link(game));
    assert.equal(countCommands(page, 'config'), 0);
    assert.equal(countCommands(page, 'js'), 0);
    assert.deepEqual(page.events(), []);
    page.consent([]);
    page.googleLoaded();
    assert.equal(countCommands(page, 'config'), 0);
    assert.deepEqual(page.events(), []);
    page.consent();
    assert.equal(page.events('page_view').length, 1);
    assert.equal(page.events('play_store_click').length, 0);
    page.click(page.link(game));
    assert.equal(page.events('play_store_click').length, 1);
    assert.equal(countCommands(page, 'config'), 1);
    assert.equal(page.scripts.length, 1);
    const accepted = setup({ autoGoogle: false });
    accepted.consent();
    accepted.click(accepted.link(game));
    accepted.googleLoaded();
    assert.deepEqual(accepted.events().map(event => event.name), ['page_view', 'play_store_click']);
});

test('Consented actions waiting for Google have a bounded queue', () => {
    const page = setup({ autoGoogle: false });
    page.consent();
    const accepted = [];
    for (let i = 0; i < 80; i += 1) accepted.push(page.track('play_store_click', { link_location: 'hero' }));
    assert.ok(accepted.some(value => value === false), 'An unavailable Google script must not grow memory indefinitely');
    assert.ok(accepted.some(value => value === true));
    page.googleLoaded();
    assert.equal(page.events('play_store_click').length, accepted.filter(Boolean).length);
    page.googleLoaded();
    assert.equal(page.events('play_store_click').length, accepted.filter(Boolean).length);
    assert.equal(page.events('page_view').length, 1);
});

test('Initial home page view waits for the resolved dynamic locale and remains once only', () => {
    const page = setup({ localeScript: true });
    page.consent();
    assert.equal(page.events('page_view').length, 0);
    page.localeLoaded('uk');
    assert.equal(page.events('page_view').length, 1);
    assert.equal(page.events('page_view')[0].params.page_language, 'uk');
    page.localeLoaded('en');
    assert.equal(page.events('page_view').length, 1);
    const alreadyResolved = setup({ localeScript: true, localeReady: true, lang: 'uk' });
    alreadyResolved.consent();
    assert.equal(alreadyResolved.events('page_view')[0].params.page_language, 'uk');
});

test('Revocation stops events immediately; regrant does not reload Google or count a second page view', () => {
    const page = setup();
    page.consent();
    page.click(page.link(game));
    assert.equal(page.events('play_store_click').length, 1);
    page.consent([]);
    assert.equal(page.window[`ga-disable-${measurementID}`], true);
    const before = page.events().length;
    page.click(page.link(game));
    assert.equal(page.track('share', { method: 'native' }), false);
    assert.equal(page.events().length, before);
    page.consent();
    page.click(page.link(game));
    assert.equal(page.events('play_store_click').length, 2);
    assert.equal(page.events('page_view').length, 1);
    assert.equal(page.scripts.length, 1);
    assert.equal(countCommands(page, 'config'), 1);
    const updates = page.commands().filter(args => args[0] === 'consent' && args[1] === 'update');
    assert.deepEqual(updates.map(args => args[2].analytics_storage), ['granted', 'denied', 'granted']);
});

test('Consent before DOM readiness waits for the page; loading the controller twice is safe', () => {
    const page = setup({ readyState: 'loading', article: true });
    const firstAPI = page.window.PointsAnalytics;
    page.load();
    assert.equal(page.window.PointsAnalytics, firstAPI);
    assert.equal(countCommands(page, 'consent'), 1);
    page.consent();
    assert.equal(page.scripts.length, 1);
    assert.equal(page.events('page_view').length, 0);
    page.ready();
    page.ready();
    page.load();
    assert.equal(page.events('page_view').length, 1);
    assert.equal(page.intervals.length, 1);
    page.click(page.link(game));
    assert.equal(page.events('play_store_click').length, 1);
});

test('Only declared event names and parameters pass; raw contact fields are discarded', () => {
    const page = setup();
    page.consent();
    assert.equal(page.track('unknown_event', { email: 'person@example.com' }), false);
    assert.equal(page.track('generate_lead', {
        form_id: 'contactForm', email: 'person@example.com', name: 'Visitor', message: 'A private message',
        page_location: 'https://evil.invalid/?email=person@example.com', debug_mode: true, event_callback() {}
    }), true);
    const event = page.events('generate_lead')[0];
    assert.deepEqual(event.params, {
        page_language: 'en', page_type: 'home', form_id: 'contactForm',
        page_location: 'https://points.gs/index.html', page_referrer: ''
    });
    page.track('article_read', { active_seconds: Infinity, percent_scrolled: NaN, email: 'private' });
    assert.equal('active_seconds' in page.events('article_read')[0].params, false);
    assert.equal('percent_scrolled' in page.events('article_read')[0].params, false);
    page.track('contact_error', { form_id: 'a'.repeat(150) });
    assert.equal(page.events('contact_error')[0].params.form_id.length, 100);
});

test('URL parameters keep supported campaign attribution and remove private queries and fragments', () => {
    const page = setup({
        href: 'https://points.gs/news_8.html?utm_source=tiktok&utm_medium=social&utm_campaign=launch&utm_id=42&utm_content=video&utm_term=forest&email=visitor%40example.com&token=secret&analytics_debug=1#private-message',
        referrer: 'https://example.com/article?email=visitor%40example.com&utm_source=secret#private', article: true
    });
    page.consent();
    page.track('generate_lead', { form_id: 'contactForm' });
    const expected = 'https://points.gs/news_8.html?utm_source=tiktok&utm_medium=social&utm_campaign=launch&utm_id=42&utm_content=video&utm_term=forest';
    const config = page.commands().find(args => args[0] === 'config')[2];
    assert.equal(config.page_location, expected);
    assert.equal(config.page_referrer, 'https://example.com/article');
    for (const { params } of page.events()) {
        assert.equal(params.page_location, expected);
        assert.equal(params.page_referrer, 'https://example.com/article');
        assert.equal(params.debug_mode, true);
    }
    assert.equal(JSON.stringify(page.commands()).includes('visitor'), false);
    assert.equal(JSON.stringify(page.commands()).includes('private-message'), false);
});

test('Current locale and article identity are evaluated when events occur', () => {
    const page = setup({ href: 'https://points.gs/uk/news_8.html', lang: 'uk', staticLocale: 'uk', article: true });
    page.consent();
    page.track('share', { method: 'copy_link', content_id: '/uk/news_8.html', content_type: 'article' });
    assert.equal(page.events('share')[0].params.page_language, 'uk');
    assert.equal(page.events('share')[0].params.page_type, 'article');
    assert.equal(page.events('share')[0].params.article_id, 'news_8');
    page.document.body.attributes['data-static-locale'] = 'en';
    page.track('share', { method: 'native' });
    assert.equal(page.events('share')[1].params.page_language, 'en');
    const idPage = setup({ href: 'https://points.gs/news_8.html', article: true, articleID: 'jackdaw-post' });
    idPage.consent();
    assert.equal(idPage.events('page_view')[0].params.article_id, 'jackdaw-post');
});

test('Nested Play CTA clicks report their explicit or section placement without blocking navigation', () => {
    const page = setup();
    page.consent();
    const section = new Element('section', { id: 'halloween' });
    const link = page.link(game, {}, section);
    page.click(new Element('svg', {}, new Element('span', {}, link)));
    page.click(new Element('span', {}, page.link(game, { 'data-analytics-location': 'hero' })));
    const footer = new Element('footer');
    page.click(page.link(game, {}, footer), { type: 'auxclick', button: 1 });
    assert.deepEqual(page.events('play_store_click').map(event => event.params.link_location), ['halloween', 'hero', 'footer']);
    page.click(link, { defaultPrevented: true });
    page.click(link, { type: 'auxclick', button: 2 });
    page.click(page.link('https://play.google.com/store/apps/details?id=another.app'));
    assert.equal(page.events('play_store_click').length, 3);
});

test('Mail links have a separate contact event without exposing the recipient', () => {
    const page = setup();
    page.consent();
    page.click(page.link('mailto:private@example.com?subject=Secret', {}, new Element('footer')));
    assert.equal(page.events('generate_lead').length, 0);
    assert.equal(page.events('contact_click').length, 1);
    assert.equal(page.events('contact_click')[0].params.link_location, 'footer');
    assert.equal(JSON.stringify(page.events()).includes('private@example.com'), false);
});

test('Press archives, images and videos report the file type and decoded file name without query values', () => {
    const page = setup({ href: 'https://points.gs/press-kit.html' });
    page.consent();
    for (const [href, className] of [
        ['/public/press-kit.zip?token=private', 'press-bundle-link'],
        ['/public/videos/press-gameplay.mp4?v=hash', 'press-asset-download'],
        ['/images/hub%20view.png', 'press-asset-download']
    ]) page.click(page.link(href, { class: className }));
    assert.deepEqual(page.events('press_asset_download').map(event => [event.params.asset_type, event.params.file_name]),
        [['zip', 'press-kit.zip'], ['mp4', 'press-gameplay.mp4'], ['png', 'hub view.png']]);
    assert.equal(JSON.stringify(page.events()).includes('private'), false);
});

test('A social sharing link records intent only; a confirmed share uses the separate completion event', () => {
    const page = setup({ article: true, href: 'https://points.gs/uk/news_8.html' });
    page.consent();
    const group = new Element('div', { 'data-article-share': '', 'data-share-url': 'https://points.gs/uk/news_8.html?private=yes#part' }, page.articleRoot);
    page.click(page.link('https://x.com/intent/tweet?url=example', {}, group));
    assert.equal(page.events('share').length, 0);
    const intent = page.events('share_click')[0].params;
    assert.equal(intent.method, 'x');
    assert.equal(intent.content_id, '/uk/news_8.html');
    assert.equal(intent.content_type, 'article');
    assert.equal(page.events('social_click').length, 0);
    page.track('share', { method: 'copy_link', content_id: '/uk/news_8.html', content_type: 'article' });
    assert.equal(page.events('share').length, 1);
    page.click(page.link('https://www.youtube.com/@PointsGameStudio'));
    assert.equal(page.events('social_click')[0].params.network, 'youtube');
});

test('An article read requires both 90 percent depth and 30 active seconds, once per opening', () => {
    const page = setup({ article: true });
    page.consent();
    page.content.rect.top = -99; // 89.9% through content.
    page.advance(31);
    assert.equal(page.events('article_read').length, 0);
    page.content.rect.top = -100; // Exactly 90% through content.
    page.advance(1);
    assert.equal(page.events('article_read').length, 1);
    assert.equal(page.events('article_read')[0].params.percent_scrolled, 90);
    assert.ok(page.events('article_read')[0].params.active_seconds >= 30);
    page.advance(100);
    page.consent([]);
    page.consent();
    page.advance(40);
    assert.equal(page.events('article_read').length, 1);
    const quick = setup({ article: true });
    quick.consent();
    quick.content.rect.top = -200;
    quick.advance(29);
    assert.equal(quick.events('article_read').length, 0);
    quick.advance(1);
    assert.equal(quick.events('article_read').length, 1);
});

test('Hidden and unfocused time never accrues toward an article read', () => {
    const page = setup({ article: true });
    page.consent();
    page.content.rect.top = -200;
    page.advance(10);
    page.visible(false);
    page.advance(60);
    page.visible(true);
    page.focus(false);
    page.advance(60);
    page.focus(true);
    page.advance(19);
    assert.equal(page.events('article_read').length, 0);
    page.advance(1);
    assert.equal(page.events('article_read')[0].params.active_seconds, 30);
});

test('Header and footer dwell outside the article never accrues reading time', () => {
    const page = setup({ article: true });
    page.consent();
    page.content.rect.top = 800; // Entire content below viewport.
    page.advance(60);
    page.content.rect.top = -1000; // Entire content above viewport.
    page.advance(60);
    page.content.rect.top = -100;
    page.advance(29);
    assert.equal(page.events('article_read').length, 0);
    page.advance(1);
    assert.equal(page.events('article_read')[0].params.active_seconds, 30);
});

test('Revoking consent clears prior reading time and depth, with no replay on regrant', () => {
    const page = setup({ article: true });
    page.consent();
    page.content.rect.top = -200;
    page.advance(29);
    page.consent([]);
    page.advance(60);
    page.content.rect.top = 0;
    page.consent();
    page.advance(30);
    assert.equal(page.events('article_read').length, 0);
    page.content.rect.top = -200;
    page.advance(1);
    assert.equal(page.events('article_read').length, 1);
    assert.equal(page.events('article_read')[0].params.active_seconds, 31);
});

test('A completed read awaiting Google is discarded on revocation and can qualify again after regrant', () => {
    const page = setup({ autoGoogle: false, article: true });
    page.consent();
    page.content.rect.top = -200;
    page.advance(30);
    assert.equal(page.events('article_read').length, 0);
    page.consent([]);
    page.googleLoaded();
    page.consent();
    assert.equal(page.events('article_read').length, 0);
    page.advance(29);
    assert.equal(page.events('article_read').length, 0);
    page.advance(1);
    assert.equal(page.events('article_read').length, 1);
});

test('Every real root and Ukrainian HTML page has exactly one current shared tag before one CMP', () => {
    const expectedVersion = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'js/analytics.js'))).digest('hex').slice(0, 12);
    const checked = [];
    for (const folder of ['', 'uk']) {
        for (const name of fs.readdirSync(path.join(root, folder)).filter(name => name.endsWith('.html'))) {
            const file = path.join(folder, name);
            const html = fs.readFileSync(path.join(root, file), 'utf8');
            if (!/<head\b/i.test(html) || /template/i.test(name) || /http-equiv\s*=\s*['"]refresh['"]/i.test(html)) continue;
            const scripts = [...html.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script>/gi)];
            const shared = scripts.filter(match => /\bsrc\s*=\s*['"][^'"]*js\/analytics\.js/.test(match[1]));
            const cmp = scripts.filter(match => /cdn-cookieyes\.com\//.test(match[1]));
            assert.equal(shared.length, 1, `${file}: one shared analytics script`);
            assert.equal(cmp.length, 1, `${file}: one CookieYes script`);
            assert.ok(shared[0].index < cmp[0].index, `${file}: install consent listeners before CMP`);
            const prefix = folder ? '../' : '';
            assert.ok(shared[0][1].includes(`src="${prefix}js/analytics.js?v=${expectedVersion}"`), `${file}: relative URL and current cache hash`);
            assert.ok(!/\b(?:async|defer)\b/.test(shared[0][1]), `${file}: analytics listeners must initialize before CMP`);
            assert.ok(!/googletagmanager\.com\/gtag\/js|G-[A-Z0-9]{8,}/.test(html), `${file}: no legacy inline Google tag`);
            checked.push(file);
        }
    }
    assert.ok(checked.includes('index.html'));
    assert.ok(checked.includes(path.join('uk', 'about.html')));
    assert.ok(checked.includes('about.html'));
    assert.ok(checked.includes('press-kit.html'));
    assert.ok(checked.includes('ukrainian-game-development-meridian93-history.html'));
    console.log(`Validated shared analytics coverage on ${checked.length} actual pages.`);
});

(async () => {
    let failures = 0;
    for (const { name, run } of tests) {
        try { await run(); console.log(`PASS ${name}`); }
        catch (error) { failures += 1; console.error(`FAIL ${name}`); console.error(error); }
    }
    if (failures) process.exitCode = 1;
    else console.log(`Analytics validation passed: ${tests.length} scenarios; no browser or network calls.`);
})();
