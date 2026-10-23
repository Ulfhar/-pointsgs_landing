/* Run with: node tests/check_campaign_navigation.js. Actual scripts, mocked navigation only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const localeSource = fs.readFileSync(path.join(root, 'js/locale.js'), 'utf8');
const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_id', 'utm_term'];
const tests = [];
function test(name, run) { tests.push({ name, run }); }

function localePage({ href = 'https://points.gs/news_8.html', staticLocale = 'en', pageView = false, analytics = 'normal' } = {}) {
    const location = new URL(href);
    let reloads = 0;
    location.reload = () => { reloads += 1; };
    const listeners = new Map();
    const stored = {};
    const localStorage = { getItem: key => stored[key] || null, setItem: (key, value) => { stored[key] = value; } };
    function link(href) {
        return { href, textContent: '', classList: { toggle() {} }, setAttribute() {}, removeAttribute() {} };
    }
    const links = { 'switch-to-en': link('/news_8.html'), 'switch-to-ua': link('/uk/news_8.html') };
    const blog = link('/devlog.html');
    const about = link('/about.html');
    const press = link('/press-kit.html');
    const navigation = { querySelector(selector) {
        if (selector.includes('devlog')) return blog;
        if (selector.includes('about')) return about;
        if (selector.includes('press-kit')) return press;
        return null;
    } };
    const document = {
        readyState: 'complete',
        body: { getAttribute: name => name === 'data-static-locale' ? staticLocale : null },
        documentElement: { lang: staticLocale || 'en', setAttribute() {}, getAttribute() { return null; } },
        getElementById: id => links[id] || null,
        querySelector(selector) {
            const alternate = selector.match(/hreflang="(en|uk)"/);
            if (alternate) return { href: `https://points.gs/${alternate[1] === 'uk' ? 'uk/' : ''}news_8.html` };
            if (selector === '.header-nav') return navigation;
            return null;
        },
        querySelectorAll() { return []; },
        addEventListener(name, listener) {
            if (!listeners.has(name)) listeners.set(name, []);
            listeners.get(name).push(listener);
        },
        dispatchEvent(event) { for (const listener of listeners.get(event.type) || []) listener(event); }
    };
    const window = {};
    if (analytics === 'normal') window.PointsAnalytics = { hasPageView: () => pageView };
    else if (analytics === 'broken') window.PointsAnalytics = { hasPageView() { throw new Error('Unavailable'); } };
    else if (analytics === 'incomplete') window.PointsAnalytics = {};
    class CustomEvent { constructor(type) { this.type = type; } }
    vm.runInNewContext(localeSource, {
        document, window, location, localStorage, URL, CustomEvent, navigator: { language: 'en' }
    }, { filename: 'js/locale.js' });
    return {
        links, blog, about, press, location, stored,
        get reloads() { return reloads; },
        firstPageView() {
            pageView = true;
            document.dispatchEvent(new CustomEvent('points:analytics-page-view'));
        }
    };
}

test('Static language switches retain all campaign fields before the first page view', () => {
    const input = new URL('https://points.gs/news_8.html');
    campaignKeys.forEach((key, index) => input.searchParams.set(key, `value ${index} + & =`));
    input.searchParams.set('email', 'private@example.test');
    input.searchParams.set('next', 'https://unrelated.example/');
    const page = localePage({ href: input.href });
    for (const [id, expectedPath] of [['switch-to-en', '/news_8.html'], ['switch-to-ua', '/uk/news_8.html']]) {
        const target = new URL(page.links[id].href, input.href);
        assert.equal(target.pathname, expectedPath);
        for (const key of campaignKeys) assert.equal(target.searchParams.get(key), input.searchParams.get(key));
        assert.deepEqual([...target.searchParams.keys()], campaignKeys);
    }
    assert.equal(page.blog.href, '/devlog.html');
    assert.equal(page.about.href, '/about.html');
    assert.equal(page.press.href, '/press-kit.html');
});

test('First page view removes campaign fields from existing language links', () => {
    const page = localePage({ href: 'https://points.gs/news_8.html?utm_source=newsletter&utm_campaign=launch&analytics_internal=1&analytics_debug=1' });
    assert.ok(page.links['switch-to-ua'].href.includes('utm_source='));
    page.firstPageView();
    const target = new URL(page.links['switch-to-ua'].href, page.location.href);
    assert.deepEqual([...target.searchParams.entries()], [['analytics_internal', '1'], ['analytics_debug', '1']]);
    assert.equal(target.pathname, '/uk/news_8.html');
});

test('Already recorded page views do not add campaigns to language links', () => {
    const page = localePage({ href: 'https://points.gs/news_8.html?utm_source=newsletter', pageView: true });
    assert.equal(page.links['switch-to-en'].href, '/news_8.html');
    assert.equal(page.links['switch-to-ua'].href, '/uk/news_8.html');
});

test('Missing, incomplete or failing analytics still preserves campaigns before navigation', () => {
    for (const analytics of ['missing', 'incomplete', 'broken']) {
        const page = localePage({ href: 'https://points.gs/news_8.html?utm_source=newsletter', analytics });
        assert.equal(page.links['switch-to-ua'].href, '/uk/news_8.html?utm_source=newsletter');
    }
});

test('Language links retain only recognized internal/debug flag values', () => {
    for (const internal of ['0', '1']) {
        const page = localePage({ href: `https://points.gs/news_8.html?analytics_internal=${internal}&analytics_debug=1`, pageView: true });
        const target = new URL(page.links['switch-to-ua'].href, page.location.href);
        assert.equal(target.searchParams.get('analytics_internal'), internal);
        assert.equal(target.searchParams.get('analytics_debug'), '1');
    }
    const invalid = localePage({ href: 'https://points.gs/news_8.html?analytics_internal=yes&analytics_debug=0' });
    assert.equal(invalid.links['switch-to-ua'].href, '/uk/news_8.html');
});

test('Static language links keep native navigation and save the chosen preference', () => {
    const page = localePage({ href: 'https://points.gs/news_8.html?utm_source=newsletter' });
    page.links['switch-to-ua'].onclick({ ctrlKey: true, preventDefault() { throw new Error('Must stay native'); } });
    assert.equal(page.stored.locale, 'ua');
    assert.equal(page.reloads, 0);
    assert.ok(page.links['switch-to-ua'].href.endsWith('?utm_source=newsletter'));
});

test('Dynamic language switches reload the same URL with its existing query intact', () => {
    const href = 'https://points.gs/index.html?utm_source=newsletter&analytics_internal=0#about';
    const page = localePage({ href, staticLocale: null });
    assert.equal(page.links['switch-to-ua'].href, href);
    let prevented = false;
    page.links['switch-to-ua'].onclick({ preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(page.stored.locale, 'ua');
    assert.equal(page.reloads, 1);
    assert.equal(page.location.href, href);
});

for (const [alias, canonicalPath] of [
    ['news_9.html', '/ukrainian-game-development-meridian93-history.html'],
    ['uk/news_9.html', '/uk/istoriia-ukrainskoho-hejmdevu-meridian93.html']
]) {
    const source = fs.readFileSync(path.join(root, alias), 'utf8');
    const script = source.match(/<script>([\s\S]*?)<\/script>/);
    function redirect(search = '', hash = '') {
        assert.ok(script, `${alias}: campaign-preserving redirect script is required`);
        let destination;
        const location = { href: `https://points.gs/${alias}${search}${hash}`, replace(value) { destination = value; } };
        vm.runInNewContext(script[1], { window: { location }, URL }, { filename: alias });
        return new URL(destination);
    }

    test(`${alias}: redirect preserves campaigns/recognized flags/hash to the fixed article`, () => {
        const input = new URL(`https://points.gs/${alias}`);
        campaignKeys.forEach(key => input.searchParams.set(key, `${key} + & =`));
        input.searchParams.set('analytics_internal', '0');
        input.searchParams.set('analytics_debug', '1');
        input.searchParams.set('email', 'private@example.test');
        input.searchParams.set('next', 'https://unrelated.example/');
        const destination = redirect(input.search, '#article-section');
        assert.equal(destination.origin, 'https://points.gs');
        assert.equal(destination.pathname, canonicalPath);
        assert.equal(destination.hash, '#article-section');
        for (const key of campaignKeys) assert.equal(destination.searchParams.get(key), input.searchParams.get(key));
        assert.deepEqual([...destination.searchParams.keys()], [...campaignKeys, 'analytics_internal', 'analytics_debug']);
    });

    test(`${alias}: invalid flags and arbitrary queries cannot change the destination`, () => {
        const destination = redirect('?next=https%3A%2F%2Funrelated.example&analytics_internal=yes&analytics_debug=0&email=private%40example.test');
        assert.equal(destination.href, `https://points.gs${canonicalPath}`);
        assert.equal(redirect('?analytics_internal=1').searchParams.get('analytics_internal'), '1');
    });

    test(`${alias}: crawler/no-JavaScript fallback remains canonical and waits for script`, () => {
        assert.ok(script, `${alias}: redirect script missing`);
        const refresh = source.match(/<meta http-equiv="refresh" content="1; url=([^"]+)">/);
        assert.ok(refresh, `${alias}: delayed meta fallback missing`);
        assert.ok(source.indexOf('<script>') < source.indexOf('<meta http-equiv="refresh"'));
        assert.equal(new URL(refresh[1], `https://points.gs/${alias}`).pathname, canonicalPath);
        assert.ok(source.includes(`<link rel="canonical" href="https://points.gs${canonicalPath}">`));
        assert.ok(source.includes('<meta name="robots" content="noindex,follow">'));
        assert.ok(source.includes(`<a href="${refresh[1]}">`));
        assert.equal(source.includes('js/analytics.js'), false, 'Aliases must not emit their own page view');
    });
}

let failures = 0;
for (const { name, run } of tests) {
    try {
        run();
        console.log(`PASS ${name}`);
    } catch (error) {
        failures += 1;
        console.error(`FAIL ${name}`);
        console.error(error);
    }
}
if (failures) process.exitCode = 1;
else console.log(`Campaign navigation validation passed: ${tests.length} scenarios; no browser or network calls.`);
