(() => {
    const ENDPOINT = 'https://formspree.io/f/xkjggyon';
    const RATE_LIMIT_MS = 10 * 60 * 1000;
    const RATE_LIMIT_KEY = 'pts_contact_ts';

    function initializePressContact() {
        const form = document.getElementById('pressContactForm');
        const success = document.getElementById('pressContactSuccess');
        const status = document.getElementById('pressContactStatus');
        if (!form || !success || !status || typeof fetch !== 'function' || form.dataset.pressContactReady) return;

        const submit = form.querySelector('.home-contact-submit');
        const honeypot = form.querySelector('[name="website"]');
        const names = ['firstName', 'lastName', 'email', 'message'];
        const fields = names.map(name => form.querySelector(`[name="${name}"]`));
        if (!submit || !honeypot || fields.some(field => !field)) return;

        const submitLabel = submit.textContent;
        const contactEmail = form.dataset.contactEmail || 'bogdan@points.gs';
        let sending = false;

        status.setAttribute('tabindex', '-1');
        if (!status.hasAttribute('role')) status.setAttribute('role', 'alert');
        success.setAttribute('tabindex', '-1');
        if (!success.hasAttribute('role')) success.setAttribute('role', 'status');

        const errors = fields.map((field, index) => {
            const container = field.closest('.home-contact-field') || field.parentElement;
            let error = container.querySelector('.fc-field-error');
            if (!error) {
                error = document.createElement('span');
                error.className = 'fc-field-error';
                container.appendChild(error);
            }
            if (!error.id) error.id = `press-error-${names[index]}`;
            error.hidden = true;
            error.classList.remove('visible');
            return error;
        });

        function fieldError(index, message) {
            const field = fields[index];
            const error = errors[index];
            const descriptions = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
            error.textContent = message;
            error.hidden = !message;
            error.classList.toggle('visible', Boolean(message));
            field.classList.toggle('fc-error', Boolean(message));
            if (message) {
                field.setAttribute('aria-invalid', 'true');
                descriptions.add(error.id);
            } else {
                field.removeAttribute('aria-invalid');
                descriptions.delete(error.id);
            }
            if (descriptions.size) field.setAttribute('aria-describedby', [...descriptions].join(' '));
            else field.removeAttribute('aria-describedby');
        }

        function clearStatus() {
            status.hidden = true;
            status.textContent = '';
        }

        function showStatus(message, focus = true) {
            status.textContent = message;
            status.hidden = false;
            if (focus) status.focus();
        }

        function remainingRateLimit() {
            try {
                const lastSent = Number(localStorage.getItem(RATE_LIMIT_KEY));
                const elapsed = Date.now() - lastSent;
                if (Number.isFinite(lastSent) && lastSent > 0 && elapsed >= 0 && elapsed < RATE_LIMIT_MS) {
                    return RATE_LIMIT_MS - elapsed;
                }
            } catch (error) { /* Storage is optional; native and enhanced contact still work. */ }
            return 0;
        }

        fields.forEach((field, index) => field.addEventListener('input', () => fieldError(index, '')));

        form.addEventListener('submit', async event => {
            event.preventDefault();
            if (sending || form.hidden) return;
            clearStatus();
            if (honeypot.value.trim()) return;

            const values = fields.map(field => field.value.trim());
            const messages = [
                values[0] ? '' : 'First name is required.',
                values[1] ? '' : 'Last name is required.',
                /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values[2]) ? '' : 'Enter a valid email address.',
                values[3].length < 10 ? 'Message is too short (minimum 10 characters).' :
                    values[3].length > 2000 ? 'Message is too long (maximum 2000 characters).' : ''
            ];
            messages.forEach((message, index) => fieldError(index, message));
            const firstInvalid = messages.findIndex(Boolean);
            if (firstInvalid !== -1) {
                showStatus('Please check the highlighted fields.', false);
                fields[firstInvalid].focus();
                return;
            }

            const remaining = remainingRateLimit();
            if (remaining) {
                const minutes = Math.ceil(remaining / 60000);
                showStatus(`Please wait ${minutes} minute${minutes === 1 ? '' : 's'} before sending another message, or email ${contactEmail} directly.`);
                return;
            }

            sending = true;
            submit.disabled = true;
            submit.textContent = 'Sending…';
            form.setAttribute('aria-busy', 'true');

            try {
                const response = await fetch(ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify({ firstName: values[0], lastName: values[1], email: values[2], message: values[3] })
                });
                const result = await response.json();
                if (!response.ok || result.ok !== true) throw new Error('Message was not accepted');

                try { localStorage.setItem(RATE_LIMIT_KEY, Date.now().toString()); } catch (error) { /* Keep successful feedback when storage is blocked. */ }
                clearStatus();
                form.hidden = true;
                success.hidden = false;
                success.focus();
            } catch (error) {
                submit.disabled = false;
                submit.textContent = submitLabel;
                showStatus(`Something went wrong. Please try again or email ${contactEmail} directly.`);
            } finally {
                sending = false;
                form.removeAttribute('aria-busy');
            }
        });

        // Leave browser validation and the native POST available until setup is complete.
        form.noValidate = true;
        form.dataset.pressContactReady = 'true';
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializePressContact, { once: true });
    else initializePressContact();
})();
