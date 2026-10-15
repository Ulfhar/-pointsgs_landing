/* Social links work without JavaScript; enhance copying and the device share sheet. */
(function () {
    'use strict';

    function init() {
        document.querySelectorAll('[data-article-share]').forEach(function (group) {
            var copy = group.querySelector('[data-share-copy]');
            var nativeShare = group.querySelector('[data-share-native]');
            var status = group.querySelector('[data-share-status]');
            var field = group.querySelector('[data-share-url-field]');
            var url = group.dataset.shareUrl;
            var title = group.dataset.shareTitle;
            var text = group.dataset.shareText;

            function announce(message) {
                status.textContent = message;
                status.hidden = false;
            }
            function manualCopy(message) {
                field.hidden = false;
                field.focus();
                field.select();
                announce(message);
            }

            copy.hidden = false;
            copy.addEventListener('click', async function () {
                copy.disabled = true;
                try {
                    if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
                    await navigator.clipboard.writeText(url);
                    field.hidden = true;
                    announce(group.dataset.copySuccess);
                } catch (_) {
                    manualCopy(group.dataset.copyFallback);
                } finally {
                    copy.disabled = false;
                }
            });

            if (typeof navigator.share === 'function') {
                nativeShare.hidden = false;
                nativeShare.addEventListener('click', async function () {
                    try {
                        await navigator.share({ title: title, text: text, url: url });
                    } catch (error) {
                        if (!error || error.name !== 'AbortError') manualCopy(group.dataset.shareFallback);
                    }
                });
            }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
