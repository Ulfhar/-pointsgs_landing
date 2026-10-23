(function() {
    var RATE_LIMIT_MS = 10 * 60 * 1000;
    var form = document.getElementById('contactForm') || document.getElementById('partnersContactForm');
    if (!form || form.dataset.contactReady) return;
    var successEl = document.getElementById(form.dataset.successId ||
        (form.id === 'partnersContactForm' ? 'partnersContactSuccess' : 'contactSuccess'));
    if (!successEl) return;
    var submitBtn = form.querySelector('.home-contact-submit');
    if (!submitBtn) return;
    form.noValidate = true;
    form.dataset.contactReady = 'true';
    var topicField = form.querySelector('[name="topic"]');
    var sending = false;
    var submitted = false;
    var submitLabel = submitBtn.textContent;
    // Only a known topic can be populated; no message, email or other query values are copied.
    try {
        if (form.id === 'contactForm' && topicField && new URL(window.location.href).searchParams.get('contact_topic') === 'partnership') {
            topicField.value = 'partnership';
        }
    } catch (_) { /* The unprefilled form remains available. */ }

    // Localization can move the native fragment target after the browser scrolls to it.
    function alignPartnershipTarget() {
        function isTarget() {
            var url = new URL(window.location.href);
            return url.searchParams.get('contact_topic') === 'partnership' && url.hash === '#contactForm';
        }
        if (!isTarget()) return;
        var finished = false;
        var queued = false;
        var loaded = document.readyState === 'complete';
        var localized = document.documentElement.getAttribute('data-locale-ready') === 'true';
        var intentEvents = ['wheel', 'touchstart', 'pointerdown', 'keydown', 'hashchange'];

        function finish() {
            finished = true;
            intentEvents.forEach(function(name) { window.removeEventListener(name, finish, true); });
            window.removeEventListener('load', onLoad);
            document.removeEventListener('points:locale-ready', onLocale);
        }

        function alignWhenReady() {
            if (finished || queued || !loaded || !localized) return;
            queued = true;
            window.requestAnimationFrame(function() {
                if (finished) return;
                var shouldAlign = isTarget();
                finish();
                if (shouldAlign) {
                    // A reveal transform must not move the target after its final alignment.
                    var reveal = form.closest('.home-about-unified[data-aos]');
                    if (reveal) reveal.classList.add('partnership-contact-target');
                    form.scrollIntoView({ block: 'start', behavior: 'instant' });
                }
            });
        }

        function onLoad() { loaded = true; alignWhenReady(); }
        function onLocale() { localized = true; alignWhenReady(); }

        intentEvents.forEach(function(name) { window.addEventListener(name, finish, { capture: true, passive: true }); });
        window.addEventListener('load', onLoad);
        document.addEventListener('points:locale-ready', onLocale);
        alignWhenReady();
    }
    if (form.id === 'contactForm') alignPartnershipTarget();

    function trackContact(name, params) {
        try {
            if (window.PointsAnalytics && typeof window.PointsAnalytics.track === 'function') {
                window.PointsAnalytics.track(name, Object.assign({ form_id: form.id }, params));
            }
        } catch (_) { /* Contact remains available without analytics. */ }
    }

    function fieldError(input, msg) {
        input.classList.add('fc-error');
        var err = input.parentNode.querySelector('.fc-field-error');
        if (!err) {
            err = document.createElement('span');
            err.className = 'fc-field-error';
            input.parentNode.appendChild(err);
        }
        err.textContent = msg;
        err.classList.add('visible');
    }

    function fieldOk(input) {
        input.classList.remove('fc-error');
        var err = input.parentNode.querySelector('.fc-field-error');
        if (err) err.classList.remove('visible');
    }

    function isValidEmail(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
    }

    form.querySelectorAll('input, textarea').forEach(function(f) {
        f.addEventListener('input', function() { fieldOk(f); });
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        if (sending || submitted) return;

        // Honeypot check
        if (form.querySelector('[name="website"]').value) return;

        // Rate limit
        try {
            var last = localStorage.getItem('pts_contact_ts');
            if (last && Date.now() - parseInt(last, 10) < RATE_LIMIT_MS) {
                var rateMsg = form.querySelector('.fc-rate-msg');
                if (!rateMsg) {
                    rateMsg = document.createElement('p');
                    rateMsg.className = 'fc-rate-msg';
                    submitBtn.after(rateMsg);
                }
                rateMsg.textContent = 'Please wait a few minutes before sending another message.';
                rateMsg.style.display = 'block';
                return;
            }
        } catch (_) {}

        // Validate
        var fn = form.querySelector('[name="firstName"]');
        var ln = form.querySelector('[name="lastName"]');
        var em = form.querySelector('[name="email"]');
        var mg = form.querySelector('[name="message"]');
        var ok = true;

        if (!fn.value.trim()) { fieldError(fn, 'Required'); ok = false; } else fieldOk(fn);
        if (!ln.value.trim()) { fieldError(ln, 'Required'); ok = false; } else fieldOk(ln);
        if (!isValidEmail(em.value)) { fieldError(em, 'Enter a valid email address'); ok = false; } else fieldOk(em);
        var msgVal = mg.value.trim();
        if (msgVal.length < 10) { fieldError(mg, 'Message is too short (min 10 characters)'); ok = false; }
        else if (msgVal.length > 2000) { fieldError(mg, 'Message is too long (max 2000 characters)'); ok = false; }
        else fieldOk(mg);

        if (!ok) return;

        // Submit
        sending = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending…';
        var partnership = topicField && topicField.value === 'partnership';
        var payload = {
            firstName: fn.value.trim(),
            lastName: ln.value.trim(),
            email: em.value.trim(),
            message: mg.value.trim()
        };
        if (partnership) {
            payload.topic = 'partnership';
            payload.subject = 'Lumen Grove partnership / pitch deck request';
        }

        try { localStorage.setItem('pts_contact_ts', Date.now().toString()); } catch (_) {}

        fetch('https://formspree.io/f/xkjggyon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(res) {
            return res.json().then(function(data) {
                return { ok: res.ok && data.ok === true };
            });
        })
        .then(function(data) {
            if (data.ok) {
                submitted = true;
                trackContact('generate_lead');
                if (partnership) trackContact('partnership_inquiry_submit', {
                    contact_type: 'form', link_location: form.dataset.analyticsLocation || 'home_contact'
                });
                form.style.display = 'none';
                successEl.style.display = 'block';
            } else {
                trackContact('contact_error');
                submitBtn.disabled = false;
                submitBtn.textContent = submitLabel;
                try { localStorage.removeItem('pts_contact_ts'); } catch (_) {}
                var errP = form.querySelector('.fc-send-error');
                if (!errP) {
                    errP = document.createElement('p');
                    errP.className = 'fc-rate-msg fc-send-error';
                    errP.style.display = 'block';
                    submitBtn.after(errP);
                }
                errP.textContent = 'Something went wrong. Please try again or email us directly at info@points.gs';
                errP.style.display = 'block';
            }
        })
        .catch(function() {
            trackContact('contact_error');
            submitBtn.disabled = false;
            submitBtn.textContent = submitLabel;
            try { localStorage.removeItem('pts_contact_ts'); } catch (_) {}
            var errP = form.querySelector('.fc-send-error');
            if (!errP) {
                errP = document.createElement('p');
                errP.className = 'fc-rate-msg fc-send-error';
                submitBtn.after(errP);
            }
            errP.textContent = 'Something went wrong. Please try again or email us directly at info@points.gs';
            errP.style.display = 'block';
        })
        .finally(function() {
            sending = false;
        });
    });
})();
