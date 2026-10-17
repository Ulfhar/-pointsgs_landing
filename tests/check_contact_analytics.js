/* Run with: node tests/check_contact_analytics.js. No browser or network calls. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const homeScript = html.match(/<!-- Contact form: validation \+ honeypot \+ rate limit -->\s*<script>([\s\S]*?)<\/script>/);
assert.ok(homeScript, 'The actual home contact controller must be present');
const controllers = {
    home: homeScript[1],
    press: fs.readFileSync(path.join(root, 'js/press-contact.js'), 'utf8')
};
const tests = [];

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

function setup(mode, { httpOk = true, result = { ok: true }, networkError = false, jsonError = false, analytics = 'record', values = {} } = {}) {
    const fields = {
        firstName: element('Alice'), lastName: element('PrivateSurname'),
        email: element('alice.private@example.test'),
        message: element('A private message that must never be sent to analytics.'),
        website: element('')
    };
    Object.entries(values).forEach(([name, value]) => { fields[name].value = value; });
    Object.values(fields).forEach(field => { field.parentNode = element(); field.parentElement = field.parentNode; });
    const submit = element();
    const form = element();
    const success = element();
    success.hidden = true;
    const status = element();
    form.dataset.contactEmail = 'bogdan@points.gs';
    form.querySelector = selector => selector === '.home-contact-submit' ? submit :
        (fields[(selector.match(/name="([^"]+)"/) || [])[1]] || null);
    form.querySelectorAll = () => Object.values(fields);
    const formId = mode === 'home' ? 'contactForm' : 'pressContactForm';
    const elements = mode === 'home' ? { contactForm: form, contactSuccess: success } :
        { pressContactForm: form, pressContactSuccess: success, pressContactStatus: status };
    const document = {
        readyState: 'complete', createElement: () => element(),
        getElementById: id => elements[id] || null
    };
    const events = [];
    const window = {};
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
    vm.runInNewContext(controllers[mode], { document, localStorage, window, fetch, Date, Number, Set }, {
        filename: mode === 'home' ? 'index.html contact controller' : 'js/press-contact.js'
    });
    return {
        form, formId, success, status, submit, fields, requests, events, localStorage,
        async send() {
            await form.listeners.submit({ preventDefault() {} });
            // The inline home listener starts a promise chain without returning it.
            await new Promise(resolve => setImmediate(resolve));
        },
        assertSuccess() {
            assert.equal(mode === 'home' ? form.style.display === 'none' : form.hidden, true);
            assert.equal(mode === 'home' ? success.style.display === 'block' : !success.hidden, true);
        },
        assertRetryAvailable() {
            assert.equal(submit.disabled, false);
            assert.equal(mode === 'home' ? form.style.display === 'none' : form.hidden, false);
            assert.equal(mode === 'home' ? success.style.display === 'block' : !success.hidden, false);
            assert.equal(localStorage.getItem('pts_contact_ts'), null);
        },
        assertOnlyEvent(name) {
            assert.deepEqual(events, [{ name, params: { form_id: formId } }]);
            const serialized = JSON.stringify(events);
            for (const field of Object.values(fields).filter(field => field.value)) {
                assert.equal(serialized.includes(field.value), false, 'Raw form values must not enter analytics');
            }
        }
    };
}

function test(name, run) { tests.push({ name, run }); }

for (const mode of Object.keys(controllers)) {
    test(`${mode}: only HTTP success and strict ok:true generate one lead`, async () => {
        const page = setup(mode);
        await page.send();
        assert.equal(page.requests.length, 1);
        assert.equal(page.requests[0].url, 'https://formspree.io/f/xkjggyon');
        assert.equal(page.requests[0].method, 'POST');
        assert.deepEqual(JSON.parse(page.requests[0].body), {
            firstName: page.fields.firstName.value, lastName: page.fields.lastName.value,
            email: page.fields.email.value, message: page.fields.message.value
        });
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
