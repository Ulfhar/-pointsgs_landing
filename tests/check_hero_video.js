/* Run with: node tests/check_hero_video.js. No browser or media files required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const controller = fs.readFileSync(path.join(__dirname, '../js/hero-video.js'), 'utf8');
const tests = [];

class Events {
    constructor() { this.listeners = new Map(); }
    addEventListener(name, listener) {
        if (!this.listeners.has(name)) this.listeners.set(name, []);
        this.listeners.get(name).push(listener);
    }
    dispatch(name, properties = {}) {
        (this.listeners.get(name) || []).forEach(listener => listener({ target: this, ...properties }));
    }
}

function setup({ reduced = false, hidden = false, visible = true, observer = true, legacyMotion = false, present = true } = {}) {
    const sources = ['public/videos/hero-loop.webm', 'public/videos/hero-loop.mp4']
        .map(src => ({ dataset: { src } }));
    const video = new Events();
    Object.assign(video, {
        paused: true, muted: false, defaultMuted: false, preload: 'none',
        loadCalls: 0, pauseCalls: 0, requests: [],
        querySelectorAll(selector) {
            assert.equal(selector, 'source[data-src]');
            return sources;
        },
        load() { this.loadCalls += 1; },
        pause() { this.pauseCalls += 1; this.paused = true; },
        play() {
            this.paused = false;
            let resolve, reject;
            const promise = new Promise((success, failure) => { resolve = success; reject = failure; });
            this.requests.push({ promise, resolve, reject });
            return promise;
        }
    });
    const classes = new Set();
    const hero = {
        classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
        querySelector: selector => selector === '.home-hero-video' ? video : null,
        getBoundingClientRect: () => visible ? { top: 0, bottom: 500 } : { top: 1000, bottom: 1500 }
    };
    const document = new Events();
    Object.assign(document, { hidden, querySelector: selector => selector === '.home-hero' && present ? hero : null });
    const motion = new Events();
    motion.matches = reduced;
    if (legacyMotion) {
        motion.addEventListener = undefined;
        motion.addListener = listener => Events.prototype.addEventListener.call(motion, 'change', listener);
    }
    const window = {
        innerHeight: 800,
        matchMedia(query) {
            assert.equal(query, '(prefers-reduced-motion: reduce)');
            return motion;
        }
    };
    let intersection;
    class IntersectionObserverMock {
        constructor(callback, options) {
            intersection = callback;
            assert.equal(options.threshold, 0.01);
        }
        observe(target) { assert.equal(target, hero); }
    }
    const context = { document, window };
    if (observer) {
        window.IntersectionObserver = IntersectionObserverMock;
        context.IntersectionObserver = IntersectionObserverMock;
    }
    vm.runInNewContext(controller, context, { filename: 'js/hero-video.js' });
    return {
        video, sources,
        playing: () => classes.has('is-video-playing'),
        setReduced(value) { motion.matches = value; motion.dispatch('change'); },
        setHidden(value) { document.hidden = value; document.dispatch('visibilitychange'); },
        setVisible(value) {
            assert.ok(intersection, 'IntersectionObserver must exist for visibility changes');
            intersection([{ isIntersecting: value, intersectionRatio: value ? 1 : 0 }]);
        },
        start(index = video.requests.length - 1) {
            video.paused = false;
            video.dispatch('playing');
            video.requests[index].resolve();
        },
        reject(index = video.requests.length - 1, { pause = true } = {}) {
            if (pause) video.paused = true;
            video.requests[index].reject(new Error('Autoplay interrupted or rejected'));
        }
    };
}

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}
function test(name, run) { tests.push({ name, run }); }

test('Visible motion-enabled hero loads both sources once and reveals only on playing', () => {
    const hero = setup();
    assert.equal(hero.video.muted, true);
    assert.equal(hero.video.defaultMuted, true);
    assert.deepEqual(hero.sources.map(source => source.src), hero.sources.map(source => source.dataset.src));
    assert.equal(hero.video.preload, 'auto');
    assert.equal(hero.video.loadCalls, 1);
    assert.equal(hero.video.requests.length, 1);
    assert.equal(hero.playing(), false);
    hero.start();
    assert.equal(hero.playing(), true);
    hero.setVisible(true);
    hero.setHidden(false);
    assert.equal(hero.video.loadCalls, 1);
    assert.equal(hero.video.requests.length, 1);
});

test('Initially reduced motion never activates sources until the preference changes', () => {
    const hero = setup({ reduced: true });
    assert.ok(hero.sources.every(source => source.src === undefined));
    assert.equal(hero.video.preload, 'none');
    assert.equal(hero.video.loadCalls, 0);
    assert.equal(hero.video.requests.length, 0);
    assert.equal(hero.video.paused, true);
    assert.equal(hero.playing(), false);
    hero.setVisible(true);
    hero.setHidden(false);
    assert.equal(hero.video.loadCalls, 0);
    hero.setReduced(false);
    assert.equal(hero.video.loadCalls, 1);
    assert.equal(hero.video.requests.length, 1);
    hero.start();
    assert.equal(hero.playing(), true);
});

test('Live reduced motion pauses to the poster and resumes without reloading', () => {
    const hero = setup();
    hero.start();
    hero.setReduced(true);
    assert.equal(hero.video.paused, true);
    assert.equal(hero.playing(), false);
    hero.setReduced(false);
    assert.equal(hero.video.requests.length, 2);
    assert.equal(hero.playing(), false);
    hero.start();
    assert.equal(hero.playing(), true);
    assert.equal(hero.video.loadCalls, 1);
});

test('Offscreen and hidden hero pause and resume only when both conditions allow it', () => {
    const hero = setup();
    hero.start();
    hero.setVisible(false);
    assert.equal(hero.video.paused, true);
    assert.equal(hero.playing(), true, 'Intentional visibility pause retains the current frame');
    hero.setHidden(true);
    hero.setVisible(true);
    assert.equal(hero.video.requests.length, 1);
    hero.setHidden(false);
    assert.equal(hero.video.requests.length, 2);
    hero.start();
    hero.setHidden(true);
    assert.equal(hero.video.paused, true);
    hero.setHidden(false);
    assert.equal(hero.video.requests.length, 3);
    assert.equal(hero.video.loadCalls, 1);
});

test('Initially hidden or offscreen hero does not load until it is visible', () => {
    const hidden = setup({ hidden: true });
    assert.equal(hidden.video.loadCalls, 0);
    assert.ok(hidden.sources.every(source => source.src === undefined));
    hidden.setHidden(false);
    assert.equal(hidden.video.loadCalls, 1);
    const offscreen = setup({ visible: false });
    assert.equal(offscreen.video.loadCalls, 0);
    assert.ok(offscreen.sources.every(source => source.src === undefined));
    offscreen.setVisible(true);
    assert.equal(offscreen.video.loadCalls, 1);
});

test('Browser autoplay rejection leaves the poster visible', async () => {
    const hero = setup();
    hero.reject();
    await flushPromises();
    assert.equal(hero.video.paused, true);
    assert.equal(hero.playing(), false);
    assert.equal(hero.video.requests.length, 1);
    assert.equal(hero.video.loadCalls, 1);
});

test('A terminal media error pauses to the poster and never retries on later changes', () => {
    const hero = setup();
    hero.start();
    hero.video.dispatch('error');
    assert.equal(hero.video.paused, true);
    assert.equal(hero.playing(), false);
    hero.setHidden(true);
    hero.setHidden(false);
    hero.setVisible(false);
    hero.setVisible(true);
    hero.setReduced(true);
    hero.setReduced(false);
    hero.video.dispatch('playing');
    assert.equal(hero.video.paused, true);
    assert.equal(hero.playing(), false);
    assert.equal(hero.video.requests.length, 1);
    assert.equal(hero.video.loadCalls, 1);
});

test('A stale rejection after pause cannot hide newer successful playback', async () => {
    const hero = setup();
    hero.setVisible(false);
    hero.setVisible(true);
    assert.equal(hero.video.requests.length, 2);
    hero.start(1);
    assert.equal(hero.playing(), true);
    hero.reject(0, { pause: false });
    await flushPromises();
    assert.equal(hero.playing(), true);
    assert.equal(hero.video.paused, false);
});

test('Late playing events cannot resume a reduced, hidden, or offscreen hero', () => {
    for (const stop of [hero => hero.setReduced(true), hero => hero.setHidden(true), hero => hero.setVisible(false)]) {
        const hero = setup();
        stop(hero);
        hero.video.paused = false;
        hero.video.dispatch('playing');
        assert.equal(hero.video.paused, true);
        assert.equal(hero.playing(), false);
    }
});

test('Motion addListener fallback and visible browsers without IntersectionObserver work', () => {
    const hero = setup({ legacyMotion: true, observer: false });
    assert.equal(hero.video.loadCalls, 1);
    hero.start();
    hero.setReduced(true);
    assert.equal(hero.video.paused, true);
    assert.equal(hero.playing(), false);
    hero.setReduced(false);
    assert.equal(hero.video.requests.length, 2);
});

test('Pages without a hero do not start media or throw', () => {
    const hero = setup({ present: false });
    assert.equal(hero.video.loadCalls, 0);
    assert.equal(hero.video.requests.length, 0);
});

(async () => {
    for (const { name, run } of tests) {
        await run();
        process.stdout.write('PASS ' + name + '\n');
    }
    process.stdout.write('Hero video controller checks passed: ' + tests.length + ' scenarios.\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
