/* Run with: node tests/check_contact_analytics.js. No browser or network calls. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /<script src="js\/home-contact\.js(?:\?[^"\s]+)?"><\/script>/, 'Home must load its actual contact controller');
const controllers = {
    home: fs.readFileSync(path.join(root, 'js/home-contact.js'), 'utf8'),
    partners: fs.readFileSync(path.join(root, 'js/home-contact.js'), 'utf8'),
    press: fs.readFileSync(path.join(root, 'js/press-contact.js'), 'utf8')
};
const tests = [];

function eventTarget(properties) {
    const listeners = new Map();
    return Object.assign({
        addEventListener(name, callback) {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(callback);
        },
        removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
        dispatch(name) { [...(listeners.get(name) || [])].forEach(callback => callback({ type: name })); }
    }, properties);
}

function element(value = '') {
    const attributes = new Map();
    return {
        value, hidden: false, style: {}, disabled: false, textContent: 'Submit',
        classList: { add() {}, remove() {}, toggle() {} }, dataset: {}, listeners: {},
        addEventListener(name, listener) { this.listeners[name] = listener; },
        setAttribute(name, value) { attributes.set(name, value); },
        removeAttribute(name) { attributes.delete(name); },
        hasAttribute(name) { return attributes.has(name); },
        getAttribute(name) { return attributes.get(name) || null; },
        focus() {}, after() {}, appendChild() {}, querySelector() { return null; },
        closest() { return this.parentElement; }
    };
}

function setup(mode, { httpOk = true, result = { ok: true }, networkError = false, jsonError = false, analytics = 'record', values = {}, href = 'https://points.gs/', loaded = true, localeReady = true, customSuccessId } = {}) {
    const fields = {
        firstName: element('Alice'), lastName: element('PrivateSurname'),
        email: element('alice.private@example.test'),
        message: element('A private message that must never be sent to analytics.'),
        website: element(''), topic: element(mode === 'partners' ? 'partnership' : 'general')
    };
    Object.entries(values).forEach(([name, value]) => { fields[name].value = value; });
    Object.values(fields).forEach(field => { field.parentNode = element(); field.parentElement = field.parentNode; });
    const submit = element();
    const feedback = [];
    submit.after = node => feedback.push(node);
    const form = element();
    const formId = mode === 'home' ? 'contactForm' : mode === 'partners' ? 'partnersContactForm' : 'pressContactForm';
    form.id = formId;
    if (mode === 'partners') {
        form.dataset.successId = customSuccessId || 'partnersContactSuccess';
        form.dataset.analyticsLocation = 'partners_contact';
    }
    const scrolls = [];
    const revealClasses = new Set();
    const reveal = { classList: { add: value => revealClasses.add(value), contains: value => revealClasses.has(value) } };
    form.closest = selector => selector === '.home-about-unified[data-aos]' ? reveal : null;
    const stableDuringScroll = [];
    let formFocuses = 0;
    form.scrollIntoView = options => {
        stableDuringScroll.push(reveal.classList.contains('partnership-contact-target'));
        scrolls.push(JSON.parse(JSON.stringify(options)));
    };
    form.focus = () => { formFocuses += 1; };
    const success = element();
    success.hidden = true;
    const status = element();
    form.dataset.contactEmail = 'bogdan@points.gs';
    form.querySelector = selector => selector === '.home-contact-submit' ? submit :
        selector.startsWith('.') ? feedback.find(node => (node.className || '').split(/\s+/).includes(selector.slice(1))) || null :
            (fields[(selector.match(/name="([^"]+)"/) || [])[1]] || null);
    form.querySelectorAll = () => Object.values(fields);
    const elements = mode === 'home' ? { contactForm: form, contactSuccess: success } :
        mode === 'partners' ? { partnersContactForm: form, [form.dataset.successId]: success } :
            { pressContactForm: form, pressContactSuccess: success, pressContactStatus: status };
    const documentElement = element();
    if (localeReady) documentElement.setAttribute('data-locale-ready', 'true');
    const document = eventTarget({
        readyState: loaded ? 'complete' : 'interactive', createElement: () => element(), documentElement,
        getElementById: id => elements[id] || null
    });
    const events = [];
    const frames = [];
    const window = eventTarget({ location: new URL(href), requestAnimationFrame: callback => frames.push(callback) });
    if (analytics === 'record' || analytics === 'broken') {
        window.PointsAnalytics = {
            track(name, params) {
                events.push({ name, params: JSON.parse(JSON.stringify(params)) });
                if (analytics === 'broken') throw new Error('Analytics unavailable');
            }
        };
    } else if (analytics === 'incomplete') window.PointsAnalytics = {};
    const stored = {};
    const localStorage = {
        getItem: key => stored[key] || null,
        setItem: (key, value) => { stored[key] = value; },
        removeItem: key => { delete stored[key]; }
    };
    const requests = [];
    const fetch = async (url, options) => {
        requests.push({ url, ...options });
        if (networkError) throw new Error('Network unavailable');
        return { ok: httpOk, json: async () => {
            if (jsonError) throw new Error('Invalid JSON response');
            return result;
        } };
    };
    vm.runInNewContext(controllers[mode], { document, localStorage, window, fetch, Date, Number, Set, URL }, {
        filename: mode === 'press' ? 'js/press-contact.js' : 'js/home-contact.js'
    });
    return {
        form, formId, success, status, submit, fields, requests, events, localStorage, feedback,
        document, window, scrolls, reveal, stableDuringScroll, formFocuses: () => formFocuses,
        flushFrames() { frames.splice(0).forEach(callback => callback()); },
        loaded() { document.readyState = 'complete'; window.dispatch('load'); },
        localized() { documentElement.setAttribute('data-locale-ready', 'true'); document.dispatch('points:locale-ready'); },
        async send() {
            await form.listeners.submit({ preventDefault() {} });
            // The home listener starts a promise chain without returning it.
            await new Promise(resolve => setImmediate(resolve));
        },
        assertSuccess() {
            assert.equal(mode === 'press' ? form.hidden : form.style.display === 'none', true);
            assert.equal(mode === 'press' ? !success.hidden : success.style.display === 'block', true);
        },
        assertRetryAvailable() {
            assert.equal(submit.disabled, false);
            assert.equal(mode === 'press' ? form.hidden : form.style.display === 'none', false);
            assert.equal(mode === 'press' ? !success.hidden : success.style.display === 'block', false);
            assert.equal(localStorage.getItem('pts_contact_ts'), null);
        },
        assertOnlyEvent(name) {
            const expected = [{ name, params: { form_id: formId } }];
            if (mode === 'partners' && name === 'generate_lead') expected.push({
                name: 'partnership_inquiry_submit', params: {
                    form_id: 'partnersContactForm', contact_type: 'form', link_location: 'partners_contact'
                }
            });
            assert.deepEqual(events, expected);
            const serialized = JSON.stringify(events);
            for (const name of ['firstName', 'lastName', 'email', 'message', 'website']) {
                const field = fields[name];
                if (!field.value) continue;
                assert.equal(serialized.includes(field.value), false, 'Raw form values must not enter analytics');
            }
        }
    };
}

test('Partnership query safely selects the native topic; arbitrary input is ignored', async () => {
    const partnership = setup('home', { href: 'https://points.gs/?contact_topic=partnership&email=secret@example.test&message=secret#contactForm' });
    assert.equal(partnership.fields.topic.value, 'partnership');
    assert.equal(partnership.fields.email.value, 'alice.private@example.test');
    const arbitrary = setup('home', { href: 'https://points.gs/?contact_topic=some_private_text' });
    assert.equal(arbitrary.fields.topic.value, 'general');
});

test('A partnership arrival aligns after both load and localization, in either order, without moving focus', () => {
    for (const order of [['loaded', 'localized'], ['localized', 'loaded']]) {
        const page = setup('home', { href: 'https://points.gs/?contact_topic=partnership#contactForm', loaded: false, localeReady: false });
        page.flushFrames();
        assert.deepEqual(page.scrolls, []);
        page[order[0]]();
        page.flushFrames();
        assert.deepEqual(page.scrolls, [], 'Neither image load nor translated text alone is a stable target');
        page[order[1]]();
        assert.deepEqual(page.scrolls, [], 'Alignment waits until the next rendering frame');
        page.flushFrames();
        assert.deepEqual(page.scrolls, [{ block: 'start', behavior: 'instant' }]);
        assert.deepEqual(page.stableDuringScroll, [true], 'Reveal transform is disabled before positioning, preventing a later 100px jump');
        assert.equal(page.formFocuses(), 0);
        assert.equal(page.fields.topic.value, 'partnership');
        page.loaded();
        page.localized();
        page.flushFrames();
        assert.equal(page.scrolls.length, 1, 'Repeated readiness notifications never cause another jump');
        assert.deepEqual(page.requests, [], 'Positioning never submits the form');
    }
});

test('Already loaded or localized arrivals still align exactly once after the missing readiness condition', () => {
    for (const [loaded, localeReady] of [[true, false], [false, true], [true, true]]) {
        const page = setup('home', { href: 'https://points.gs/?contact_topic=partnership#contactForm', loaded, localeReady });
        page.flushFrames();
        assert.equal(page.scrolls.length, loaded && localeReady ? 1 : 0);
        if (!loaded) page.loaded();
        if (!localeReady) page.localized();
        page.flushFrames();
        assert.equal(page.scrolls.length, 1);
    }
});

test('Reading or interacting while the page settles prevents a later form jump, including a queued frame', () => {
    for (const intent of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
        for (const afterReady of [false, true]) {
            const page = setup('home', { href: 'https://points.gs/?contact_topic=partnership#contactForm', loaded: false, localeReady: false });
            if (afterReady) { page.loaded(); page.localized(); }
            page.window.dispatch(intent);
            page.loaded();
            page.localized();
            page.flushFrames();
            assert.deepEqual(page.scrolls, [], `${intent} preserves the visitor's chosen position`);
            assert.equal(page.reveal.classList.contains('partnership-contact-target'), false, 'User interaction leaves the normal reveal animation untouched');
            assert.equal(page.formFocuses(), 0);
            assert.equal(page.fields.topic.value, 'partnership', 'Cancellation affects positioning, not the selected topic');
        }
    }
});

test('Leaving the form fragment cancels the correction even if the visitor returns or changes URL before the frame', () => {
    const returned = setup('home', { href: 'https://points.gs/?contact_topic=partnership#contactForm', loaded: false, localeReady: false });
    returned.window.location.hash = '#gameplay';
    returned.window.dispatch('hashchange');
    returned.window.location.hash = '#contactForm';
    returned.window.dispatch('hashchange');
    returned.loaded(); returned.localized(); returned.flushFrames();
    assert.deepEqual(returned.scrolls, []);
    for (const destination of ['https://points.gs/?contact_topic=partnership#about', 'https://points.gs/#contactForm']) {
        const queued = setup('home', { href: 'https://points.gs/?contact_topic=partnership#contactForm' });
        queued.window.location = new URL(destination);
        queued.flushFrames();
        assert.deepEqual(queued.scrolls, [], 'Current URL is checked again immediately before alignment');
    }
});

test('Ordinary home and contact visits never receive partnership positioning behavior', () => {
    for (const href of ['https://points.gs/', 'https://points.gs/#contactForm', 'https://points.gs/?contact_topic=general#contactForm', 'https://points.gs/?contact_topic=partnership#about']) {
        const page = setup('home', { href, loaded: false, localeReady: false });
        page.loaded(); page.localized(); page.flushFrames();
        assert.deepEqual(page.scrolls, []);
        assert.equal(page.reveal.classList.contains('partnership-contact-target'), false);
        assert.equal(page.formFocuses(), 0);
    }
});

test('Partnership topic reaches transport and only confirmed success emits one inquiry', async () => {
    const page = setup('home', { href: 'https://points.gs/?contact_topic=partnership#contactForm' });
    await page.send();
    const payload = JSON.parse(page.requests[0].body);
    assert.equal(payload.topic, 'partnership');
    assert.equal(payload.subject, 'Lumen Grove partnership / pitch deck request');
    assert.deepEqual(page.events, [
        { name: 'generate_lead', params: { form_id: 'contactForm' } },
        { name: 'partnership_inquiry_submit', params: {
            form_id: 'contactForm', contact_type: 'form', link_location: 'home_contact'
        } }
    ]);
    for (const name of ['firstName', 'lastName', 'email', 'message']) {
        assert.equal(JSON.stringify(page.events).includes(page.fields[name].value), false);
    }
    await page.send();
    assert.equal(page.requests.length, 1, 'Repeated dispatch after success cannot send a second inquiry');
    assert.equal(page.events.filter(event => event.name === 'partnership_inquiry_submit').length, 1);
    page.assertSuccess();
});

for (const options of [ { httpOk: false }, { result: { ok: false } }, { result: { ok: 'true' } }, { result: {} }, { networkError: true }, { jsonError: true }, { values: { email: 'invalid' } }, { values: { website: 'spam' } } ]) {
    test(`Partnership failure never emits successful inquiry: ${JSON.stringify(options)}`, async () => {
        const page = setup('home', { ...options, href: 'https://points.gs/?contact_topic=partnership#contactForm' });
        await page.send();
        assert.equal(page.events.some(event => event.name === 'partnership_inquiry_submit'), false);
    });
}

test('Changing the preselected topic to general does not submit or track a partnership', async () => {
    const page = setup('home', { href: 'https://points.gs/?contact_topic=partnership#contactForm' });
    page.fields.topic.value = 'general';
    await page.send();
    assert.equal('topic' in JSON.parse(page.requests[0].body), false);
    page.assertOnlyEvent('generate_lead');
});

test('Repeated dispatch while the partnership transport is pending submits only once on either page', async () => {
    for (const mode of ['home', 'partners']) {
        const page = setup(mode, { values: { topic: 'partnership' } });
        await Promise.all([page.send(), page.send()]);
        await page.send();
        assert.equal(page.requests.length, 1);
        assert.equal(page.events.filter(event => event.name === 'partnership_inquiry_submit').length, 1);
    }
});

test('The inline Partnerships form succeeds without homepage positioning or query prefill', async () => {
    const page = setup('partners', {
        href: 'https://points.gs/partners/?contact_topic=general#contactForm', loaded: false, localeReady: false,
        customSuccessId: 'configuredPartnershipSuccess'
    });
    assert.equal(page.form.noValidate, true, 'Enhanced validation starts only after the controller initializes');
    assert.equal(page.fields.topic.value, 'partnership');
    page.loaded(); page.localized(); page.flushFrames();
    assert.deepEqual(page.scrolls, [], 'A legacy homepage fragment cannot invoke homepage alignment on Partnerships');
    assert.equal(page.reveal.classList.contains('partnership-contact-target'), false);
    await page.send();
    page.assertSuccess();
    page.assertOnlyEvent('generate_lead');
    assert.equal(page.requests[0].url, 'https://formspree.io/f/xkjggyon');
});

test('An inline Partnerships transport error keeps input and visible retry feedback without a success event', async () => {
    const page = setup('partners', { networkError: true });
    const original = Object.fromEntries(Object.entries(page.fields).map(([name, field]) => [name, field.value]));
    await page.send();
    page.assertRetryAvailable();
    assert.deepEqual(Object.fromEntries(Object.entries(page.fields).map(([name, field]) => [name, field.value])), original);
    assert.equal(page.feedback.length, 1);
    assert.equal(page.feedback[0].style.display, 'block');
    assert.match(page.feedback[0].textContent, /Something went wrong/);
    await page.send();
    assert.equal(page.requests.length, 2, 'Retry is possible after a rejected transport');
    assert.equal(page.feedback.length, 1, 'Retry updates one error message rather than adding duplicates');
    assert.equal(page.events.some(event => event.name === 'partnership_inquiry_submit'), false);
});

function test(name, run) { tests.push({ name, run }); }

for (const mode of Object.keys(controllers)) {
    test(`${mode}: only HTTP success and strict ok:true generate one lead`, async () => {
        const page = setup(mode);
        await page.send();
        assert.equal(page.requests.length, 1);
        assert.equal(page.requests[0].url, 'https://formspree.io/f/xkjggyon');
        assert.equal(page.requests[0].method, 'POST');
        const expectedPayload = {
            firstName: page.fields.firstName.value, lastName: page.fields.lastName.value,
            email: page.fields.email.value, message: page.fields.message.value
        };
        if (mode === 'partners') {
            expectedPayload.topic = 'partnership';
            expectedPayload.subject = 'Lumen Grove partnership / pitch deck request';
        }
        assert.deepEqual(JSON.parse(page.requests[0].body), expectedPayload);
        page.assertOnlyEvent('generate_lead');
        page.assertSuccess();
    });

    for (const [label, options] of [
        ['HTTP failure even with ok:true', { httpOk: false }],
        ['ok:false response', { result: { ok: false } }],
        ['string ok response', { result: { ok: 'true' } }],
        ['missing ok response', { result: {} }],
        ['network failure', { networkError: true }],
        ['invalid JSON response', { jsonError: true }]
    ]) {
        test(`${mode}: ${label} generates one error and permits retry`, async () => {
            const page = setup(mode, options);
            await page.send();
            assert.equal(page.requests.length, 1);
            page.assertOnlyEvent('contact_error');
            page.assertRetryAvailable();
        });
    }

    for (const analytics of ['missing', 'incomplete', 'broken']) {
        for (const networkError of [false, true]) {
            test(`${mode}: ${analytics} analytics preserves ${networkError ? 'error' : 'success'} feedback`, async () => {
                const page = setup(mode, { analytics, networkError });
                await page.send();
                if (networkError) page.assertRetryAvailable();
                else page.assertSuccess();
                if (analytics === 'broken') page.assertOnlyEvent(networkError ? 'contact_error' : 'generate_lead');
                else assert.deepEqual(page.events, []);
            });
        }
    }

    for (const [label, values] of [
        ['validation failure', { email: 'invalid-email' }],
        ['honeypot rejection', { website: 'spam.example.test' }]
    ]) {
        test(`${mode}: ${label} does not generate a lead or submission error`, async () => {
            const page = setup(mode, { values });
            await page.send();
            assert.deepEqual(page.requests, []);
            assert.deepEqual(page.events, []);
        });
    }
}

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
    else console.log(`Contact analytics validation passed: ${tests.length} scenarios; actual controllers, mocked transport.`);
})();
