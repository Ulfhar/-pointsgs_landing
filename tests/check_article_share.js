/* Run with: node tests/check_article_share.js. Uses mocked browser APIs only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const controller = fs.readFileSync(path.join(__dirname, '../js/article-share.js'), 'utf8');
const tests = [];

function setup({ clipboard, share, groups = [{}], readyState = 'complete', analytics = true } = {}) {
    const document = { activeElement: null, readyState };
    let onReady;
    document.addEventListener = (name, listener) => {
        assert.equal(name, 'DOMContentLoaded');
        onReady = listener;
    };
    function element({ hidden = true, value = '' } = {}) {
        const listeners = new Map();
        return {
            hidden, value, readOnly: true, disabled: false, textContent: '',
            focusCalls: 0, selectCalls: 0,
            addEventListener(name, listener) {
                if (!listeners.has(name)) listeners.set(name, []);
                listeners.get(name).push(listener);
            },
            async click() {
                if (this.disabled || this.hidden) return;
                await Promise.all((listeners.get('click') || []).map(listener => listener({ target: this, preventDefault() {} })));
            },
            focus() { this.focusCalls += 1; document.activeElement = this; },
            select() { this.selectCalls += 1; }
        };
    }
    const elements = groups.map((data, index) => {
        const shareTitle = data.shareTitle ?? `Article title ${index + 1}`;
        const dataset = {
            shareUrl: `https://points.gs/news_${index + 8}.html`,
            shareTitle,
            shareText: `Learn more about Lumen Grove in “${shareTitle}”.`,
            copySuccess: `Link copied ${index + 1}`,
            copyFallback: `Copy this link ${index + 1}`,
            shareFallback: `Share this link ${index + 1}`,
            ...data
        };
        const copy = element();
        const native = element();
        const status = element();
        // The generated HTML supplies a readonly field with the canonical URL.
        const field = element({ value: dataset.shareUrl });
        const selectors = {
            '[data-share-copy]': copy,
            '[data-share-native]': native,
            '[data-share-status]': status,
            '[data-share-url-field]': field
        };
        return {
            dataset,
            querySelector(selector) {
                assert.ok(selector in selectors, `Unexpected share selector: ${selector}`);
                return selectors[selector];
            },
            copy, native, status, field
        };
    });
    document.querySelectorAll = selector => {
        assert.equal(selector, '[data-article-share]');
        return elements;
    };
    const navigator = {};
    if (clipboard !== undefined) navigator.clipboard = clipboard;
    if (share !== undefined) navigator.share = share;
    const location = { href: 'https://points.gs/uk/devlog.html?tracking=example#unrelated-fragment' };
    const events = [];
    const window = { navigator, location };
    if (analytics === true) window.PointsAnalytics = { track: (name, params) => events.push({ name, params: JSON.parse(JSON.stringify(params)) }) };
    else if (analytics) window.PointsAnalytics = analytics;
    vm.runInNewContext(controller, { document, navigator, window, location, URL }, { filename: 'js/article-share.js' });
    return { document, events, groups: elements, ready() { document.readyState = 'complete'; if (onReady) onReady(); } };
}

function assertFallback(group, document, message) {
    assert.equal(group.field.hidden, false);
    assert.equal(group.field.readOnly, true);
    assert.equal(group.field.value, group.dataset.shareUrl);
    assert.equal(document.activeElement, group.field);
    assert.equal(group.field.focusCalls, 1);
    assert.equal(group.field.selectCalls, 1);
    assert.equal(group.status.textContent, message);
    assert.equal(group.status.hidden, false);
}

function test(name, run) { tests.push({ name, run }); }

test('Pages without article-share groups are a safe no-op', () => {
    assert.equal(setup({ groups: [] }).groups.length, 0);
});

test('A loading document waits until its share controls exist', () => {
    const page = setup({ readyState: 'loading' });
    assert.equal(page.groups[0].copy.hidden, true);
    page.ready();
    assert.equal(page.groups[0].copy.hidden, false);
});

test('Copy is enhanced without clipboard support; native sharing is exposed only when supported', () => {
    for (const share of [undefined, null, 'unsupported', () => Promise.resolve()]) {
        const { groups: [group] } = setup({ share });
        assert.equal(group.copy.hidden, false);
        assert.equal(group.native.hidden, typeof share !== 'function');
        assert.equal(group.field.hidden, true);
    }
});

test('Copy writes the canonical dataset URL and announces success', async () => {
    const writes = [];
    const { groups: [group], events } = setup({ clipboard: { writeText: async value => writes.push(value) } });
    await group.copy.click();
    assert.deepEqual(writes, [group.dataset.shareUrl]);
    assert.equal(group.status.textContent, group.dataset.copySuccess);
    assert.equal(group.status.hidden, false);
    assert.equal(group.field.hidden, true);
    assert.equal(group.field.focusCalls, 0);
    assert.deepEqual(events, [{ name: 'share', params: { method: 'copy_link', content_id: '/news_8.html', content_type: 'article' } }]);
});

test('Missing clipboard API reveals a focused, selected canonical URL', async () => {
    for (const clipboard of [undefined, {}]) {
        const page = setup({ clipboard });
        await page.groups[0].copy.click();
        assertFallback(page.groups[0], page.document, page.groups[0].dataset.copyFallback);
        assert.equal(page.groups[0].copy.disabled, false);
        assert.deepEqual(page.events, []);
    }
});

test('Clipboard rejection falls back to manual copy without exposing the exception', async () => {
    const page = setup({ clipboard: { writeText: async () => { throw new Error('Permission denied details'); } } });
    await page.groups[0].copy.click();
    assertFallback(page.groups[0], page.document, page.groups[0].dataset.copyFallback);
    assert.deepEqual(page.events, []);
});

test('Native sharing sends the canonical URL, English title and caption', async () => {
    const requests = [];
    const page = setup({ share: async value => requests.push({ ...value }) });
    const group = page.groups[0];
    await group.native.click();
    assert.deepEqual(requests, [{ title: group.dataset.shareTitle, url: group.dataset.shareUrl, text: group.dataset.shareText }]);
    assert.equal(group.field.hidden, true);
    assert.equal(group.field.focusCalls, 0);
    assert.equal(group.status.textContent, '');
    assert.deepEqual(page.events, [{ name: 'share', params: { method: 'native', content_id: '/news_8.html', content_type: 'article' } }]);
});

test('Cancelling the native share sheet stays quiet and does not reveal a fallback', async () => {
    const page = setup({ share: async () => { throw Object.assign(new Error('User cancelled'), { name: 'AbortError' }); } });
    const group = page.groups[0];
    await group.native.click();
    assert.equal(group.status.textContent, '');
    assert.equal(group.field.hidden, true);
    assert.equal(group.field.focusCalls, 0);
    assert.deepEqual(page.events, []);
});

test('Native share failure reveals the share fallback URL with focus and selection', async () => {
    const page = setup({ share: async () => { throw new Error('Share unavailable'); } });
    await page.groups[0].native.click();
    assertFallback(page.groups[0], page.document, page.groups[0].dataset.shareFallback);
    assert.deepEqual(page.events, []);
});

test('Analytics records only the canonical article path, without URL queries or fragments', async () => {
    const page = setup({
        clipboard: { writeText: async () => {} },
        groups: [{ shareUrl: 'https://points.gs/uk/news_8.html?source=example#section' }]
    });
    await page.groups[0].copy.click();
    assert.deepEqual(page.events, [{ name: 'share', params: { method: 'copy_link', content_id: '/uk/news_8.html', content_type: 'article' } }]);
});

test('Missing or failing analytics does not interfere with successful sharing', async () => {
    for (const analytics of [false, {}, { track() { throw new Error('Analytics unavailable'); } }]) {
        const page = setup({ clipboard: { writeText: async () => {} }, share: async () => {}, analytics });
        await page.groups[0].copy.click();
        assert.equal(page.groups[0].status.textContent, page.groups[0].dataset.copySuccess);
        await page.groups[0].native.click();
        assert.equal(page.groups[0].field.hidden, true);
    }
});

test('Each share group preserves its own URL, title, caption, status and fallback field', async () => {
    const writes = [];
    const requests = [];
    const page = setup({
        clipboard: { writeText: async value => writes.push(value) },
        share: async value => requests.push({ ...value }),
        groups: [{}, { shareUrl: 'https://points.gs/uk/news_7.html', shareTitle: 'A Forest Story', copySuccess: 'Посилання скопійовано' }]
    });
    const [first, second] = page.groups;
    await second.copy.click();
    assert.deepEqual(writes, [second.dataset.shareUrl]);
    assert.equal(second.status.textContent, second.dataset.copySuccess);
    assert.equal(first.status.textContent, '');
    await first.native.click();
    assert.deepEqual(requests, [{ title: first.dataset.shareTitle, url: first.dataset.shareUrl, text: first.dataset.shareText }]);
    assert.equal(second.status.textContent, second.dataset.copySuccess);
    assert.ok(page.groups.every(group => group.field.hidden));
});

test('A Ukrainian article shares its own URL with an English headline and caption; copy remains URL-only', async () => {
    const writes = [];
    const requests = [];
    const url = 'https://points.gs/uk/news_8.html';
    const title = 'Jackdaw Post: Bringing Forest News to Lumen Grove';
    const text = 'Learn more about Lumen Grove in “Jackdaw Post: Bringing Forest News to Lumen Grove”.';
    const { groups: [group] } = setup({
        clipboard: { writeText: async value => writes.push(value) },
        share: async value => requests.push({ ...value }),
        groups: [{ shareUrl: url, shareTitle: title, shareText: text }]
    });
    await group.native.click();
    assert.deepEqual(requests, [{ title, url, text }]);
    await group.copy.click();
    assert.deepEqual(writes, [url]);
});

test('Copy awaits a pending clipboard write before announcing success', async () => {
    let complete;
    let requests = 0;
    const page = setup({ clipboard: { writeText: () => {
        requests += 1;
        return new Promise(resolve => { complete = resolve; });
    } } });
    const group = page.groups[0];
    const click = group.copy.click();
    assert.equal(group.status.textContent, '');
    assert.equal(group.field.hidden, true);
    assert.equal(group.copy.disabled, true);
    assert.deepEqual(page.events, []);
    await group.copy.click();
    assert.equal(requests, 1);
    complete();
    await click;
    assert.equal(group.status.textContent, group.dataset.copySuccess);
    assert.equal(group.copy.disabled, false);
    assert.deepEqual(page.events, [{ name: 'share', params: { method: 'copy_link', content_id: '/news_8.html', content_type: 'article' } }]);
});

test('A successful retry hides the manual fallback and restores the copy button', async () => {
    let denied = true;
    const page = setup({ clipboard: { writeText: async () => { if (denied) throw new Error('Denied'); } } });
    const group = page.groups[0];
    await group.copy.click();
    assert.equal(group.field.hidden, false);
    assert.equal(group.copy.disabled, false);
    denied = false;
    await group.copy.click();
    assert.equal(group.field.hidden, true);
    assert.equal(group.status.textContent, group.dataset.copySuccess);
    assert.equal(group.copy.disabled, false);
});

(async () => {
    let failures = 0;
    for (const { name, run } of tests) {
        try {
            await run();
            console.log(`PASS ${name}`);
        } catch (error) {
            failures += 1;
            console.error(`FAIL ${name}`);
            console.error(error);
        }
    }
    if (failures) process.exitCode = 1;
    else console.log(`Article-share validation passed: ${tests.length} scenarios; no browser or network calls.`);
})();
