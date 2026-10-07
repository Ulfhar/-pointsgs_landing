/* Progressive galleries with quiet rotation and a borderless image viewer. */
(function () {
    'use strict';

    function init() {
        if (!document.body.classList.contains('blog-page')) return;
        var savedLocale = '';
        try { savedLocale = localStorage.getItem('locale') || ''; } catch (_) { /* Storage can be unavailable. */ }
        var locale = document.body.dataset.staticLocale || document.documentElement.lang || savedLocale || navigator.language || 'en';
        var isUkrainian = /^(ua|uk)(-|$)/i.test(locale);
        var labels = isUkrainian ? {
            gallery: 'Галерея зображень', previous: 'Попереднє зображення', next: 'Наступне зображення',
            open: 'Збільшити зображення', viewer: 'Перегляд зображення', close: 'Закрити',
            show: 'Показати',
            counter: function (index, total) { return 'Зображення ' + index + ' з ' + total; }
        } : {
            gallery: 'Image gallery', previous: 'Previous image', next: 'Next image',
            open: 'Enlarge image', viewer: 'Image viewer', close: 'Close',
            show: 'Show',
            counter: function (index, total) { return 'Image ' + index + ' of ' + total; }
        };

        function element(tag, className, text) {
            var node = document.createElement(tag);
            if (className) node.className = className;
            if (text) node.textContent = text;
            return node;
        }
        function button(className, text, label) {
            var node = element('button', className, text);
            node.type = 'button';
            if (label) node.setAttribute('aria-label', label);
            return node;
        }
        function fullSource(img) { return img.dataset.fullSrc || img.currentSrc || img.src; }
        var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        var mobileView = window.matchMedia('(max-width: 767px)');
        var galleryControllers = [];
        function syncGalleries() { galleryControllers.forEach(function (gallery) { gallery.sync(); }); }

        var dialog = null;
        var dialogImage, dialogCaption, dialogPrevious, dialogNext, dialogStatus, dialogClose;
        var activeImages = [], activeIndex = 0, opener = null, activeGallery = null;

        function updateDialog() {
            var img = activeImages[activeIndex];
            if (!img) return;
            dialogImage.width = img.naturalWidth || img.width || 800;
            dialogImage.height = img.naturalHeight || img.height || 450;
            dialogImage.src = fullSource(img);
            dialogImage.alt = img.alt || '';
            dialogCaption.textContent = img.alt || '';
            dialogCaption.hidden = !img.alt;
            dialogStatus.textContent = (activeIndex + 1) + ' / ' + activeImages.length;
            dialogStatus.setAttribute('aria-label', labels.counter(activeIndex + 1, activeImages.length));
            dialogPrevious.hidden = dialogNext.hidden = dialogStatus.hidden = activeImages.length < 2;
        }
        function stepDialog(direction) {
            var nextIndex = (activeIndex + direction + activeImages.length) % activeImages.length;
            if (nextIndex !== activeIndex) { activeIndex = nextIndex; updateDialog(); }
        }
        function closeDialog() { if (dialog && dialog.open) dialog.close(); }
        function syncCloseControl() {
            if (!dialog) return;
            var closeHadFocus = document.activeElement === dialogClose;
            dialogClose.hidden = mobileView.matches;
            if (closeHadFocus && dialogClose.hidden && dialog.open) dialog.focus({ preventScroll: true });
        }
        function buildDialog() {
            if (dialog) return;
            dialog = element('dialog', 'news-lightbox');
            dialog.setAttribute('aria-labelledby', 'news-lightbox-title');
            dialog.setAttribute('tabindex', '-1');
            var title = element('h2', 'visually-hidden', labels.viewer);
            title.id = 'news-lightbox-title';
            dialogClose = button('lightbox-close', '×', labels.close);
            dialogClose.title = labels.close;
            var figure = element('figure');
            var stage = element('div', 'lightbox-stage');
            dialogImage = element('img');
            dialogCaption = element('figcaption');
            dialogPrevious = button('lightbox-zone lightbox-previous', '‹', labels.previous);
            dialogNext = button('lightbox-zone lightbox-next', '›', labels.next);
            stage.append(dialogImage, dialogPrevious, dialogNext);
            figure.append(stage, dialogCaption);
            dialogStatus = element('p', 'lightbox-status');
            dialogStatus.setAttribute('aria-live', 'polite');
            dialogStatus.setAttribute('aria-atomic', 'true');
            dialog.append(title, dialogClose, figure, dialogStatus);
            document.body.appendChild(dialog);
            syncCloseControl();
            dialogClose.addEventListener('click', closeDialog);
            dialogPrevious.addEventListener('click', function () { stepDialog(-1); });
            dialogNext.addEventListener('click', function () { stepDialog(1); });
            dialog.addEventListener('cancel', function (event) { event.preventDefault(); closeDialog(); });
            dialog.addEventListener('close', function () {
                document.documentElement.classList.remove('lightbox-open');
                if (activeGallery) {
                    activeGallery.show(activeIndex);
                    opener = activeImages[activeIndex].closest('.gallery-image-button');
                }
                if (opener && opener.isConnected) opener.focus({ preventScroll: true });
                syncGalleries();
            });
            dialog.addEventListener('click', function (event) {
                if (stage.contains(event.target) || dialogClose.contains(event.target)) return;
                closeDialog();
            });
            dialog.addEventListener('keydown', function (event) {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    stepDialog(event.key === 'ArrowLeft' ? -1 : 1);
                } else if (event.key === 'Tab') {
                    var focusable = Array.from(dialog.querySelectorAll('button:not(:disabled)')).filter(function (node) { return !node.hidden; });
                    var first = focusable[0], last = focusable[focusable.length - 1];
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                }
            });
        }
        function openDialog(images, index, trigger, gallery) {
            if (!('HTMLDialogElement' in window) || typeof HTMLDialogElement.prototype.showModal !== 'function') {
                // A normal link remains useful in older browsers without dialog support.
                window.open(fullSource(images[index]), '_blank', 'noopener');
                return;
            }
            buildDialog();
            activeImages = images;
            activeIndex = index;
            opener = trigger;
            activeGallery = gallery || null;
            updateDialog();
            dialog.showModal();
            document.documentElement.classList.add('lightbox-open');
            syncGalleries();
            (dialogClose.hidden ? dialog : dialogClose).focus({ preventScroll: true });
        }
        function enhanceImage(img, group, gallery) {
            if (img.closest('button, a') || img.dataset.lightboxReady) return;
            var trigger = button('gallery-image-button', '', labels.open + (img.alt ? ': ' + img.alt : ''));
            img.before(trigger);
            trigger.appendChild(img);
            img.dataset.lightboxReady = 'true';
            trigger.addEventListener('click', function () { openDialog(group, group.indexOf(img), trigger, gallery); });
        }

        document.querySelectorAll('.news-content .swiper').forEach(function (gallery, galleryIndex) {
            if (gallery.dataset.galleryReady) return;
            var slides = Array.from(gallery.querySelectorAll('.swiper-slide'));
            var images = slides.map(function (slide) { return slide.querySelector('img'); }).filter(Boolean);
            if (!slides.length || !images.length) return;
            var index = 0, timer = null, hovered = false, focused = false;
            var inView = !('IntersectionObserver' in window);
            gallery.setAttribute('role', 'region');
            gallery.setAttribute('aria-roledescription', isUkrainian ? 'карусель' : 'carousel');
            gallery.setAttribute('aria-label', gallery.dataset.galleryLabel || labels.gallery + ' ' + (galleryIndex + 1));
            var controls = element('div', 'gallery-controls');
            var pagination = element('div', 'gallery-dots');
            pagination.setAttribute('role', 'group');
            pagination.setAttribute('aria-label', labels.gallery);
            var dots = slides.map(function (_, slideIndex) {
                return button('gallery-dot', '', labels.show + ' ' + labels.counter(slideIndex + 1, slides.length));
            });
            gallery.querySelectorAll('.swiper-button-prev, .swiper-button-next, .swiper-pagination').forEach(function (node) { node.remove(); });
            dots.forEach(function (dot) { pagination.appendChild(dot); });
            controls.append(pagination);
            gallery.appendChild(controls);
            var wrapper = gallery.querySelector('.swiper-wrapper');
            var firstImage = images[0];
            gallery.style.setProperty('--gallery-aspect', (firstImage.getAttribute('width') || 800) + ' / ' + (firstImage.getAttribute('height') || 450));

            function sync() {
                if (timer !== null) window.clearTimeout(timer);
                timer = null;
                var playing = slides.length > 1 && !focused && !hovered && inView &&
                    !document.hidden && !reducedMotion.matches && !(dialog && dialog.open);
                wrapper.setAttribute('aria-live', playing ? 'off' : 'polite');
                gallery.dataset.rotating = String(playing);
                if (playing) timer = window.setTimeout(function () { timer = null; show(index + 1); }, 5000);
            }

            function show(nextIndex) {
                var imageHadFocus = slides.some(function (slide) { return slide.contains(document.activeElement); });
                index = (nextIndex + slides.length) % slides.length;
                slides.forEach(function (slide, slideIndex) {
                    slide.hidden = slideIndex !== index;
                    slide.setAttribute('role', 'group');
                    slide.setAttribute('aria-roledescription', isUkrainian ? 'слайд' : 'slide');
                    slide.setAttribute('aria-label', labels.counter(slideIndex + 1, slides.length));
                    slide.id = 'article-gallery-' + (galleryIndex + 1) + '-slide-' + (slideIndex + 1);
                    dots[slideIndex].setAttribute('aria-current', String(slideIndex === index));
                    dots[slideIndex].setAttribute('aria-controls', slide.id);
                });
                gallery.dataset.galleryIndex = String(index);
                controls.hidden = slides.length < 2;
                if (imageHadFocus && !(dialog && dialog.open)) {
                    var visibleTrigger = slides[index].querySelector('.gallery-image-button');
                    if (visibleTrigger) visibleTrigger.focus({ preventScroll: true });
                }
                sync();
            }
            var controller = { sync: sync, show: show };
            galleryControllers.push(controller);
            images.forEach(function (img) { enhanceImage(img, images, controller); });
            dots.forEach(function (dot, slideIndex) {
                dot.addEventListener('click', function () { show(slideIndex); });
            });
            gallery.addEventListener('pointerenter', function (event) { hovered = event.pointerType !== 'touch'; sync(); });
            gallery.addEventListener('pointerleave', function () { hovered = false; sync(); });
            gallery.addEventListener('focusin', function () { focused = true; sync(); });
            gallery.addEventListener('focusout', function (event) {
                if (gallery.contains(event.relatedTarget)) return;
                focused = false;
                sync();
            });
            gallery.addEventListener('keydown', function (event) {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    show(index + (event.key === 'ArrowLeft' ? -1 : 1));
                }
            });
            gallery.classList.add('gallery-enhanced');
            gallery.dataset.galleryReady = 'true';
            show(0);
            if ('IntersectionObserver' in window) {
                new IntersectionObserver(function (entries) {
                    inView = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.15;
                    sync();
                }, { threshold: [0, 0.15] }).observe(gallery);
            }
        });

        document.addEventListener('visibilitychange', syncGalleries);
        if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', syncGalleries);
        else reducedMotion.addListener(syncGalleries);
        if (mobileView.addEventListener) mobileView.addEventListener('change', syncCloseControl);
        else mobileView.addListener(syncCloseControl);

        document.querySelectorAll('.news-content .news-image img, .news-content .news-inline-img img, .news-content .pillar-img, .news-content .news-img-pair img, .news-content .cozy-pocket-pair img').forEach(function (img) {
            if (img.closest('.swiper')) return;
            var pair = img.closest('.news-img-pair, .cozy-pocket-pair');
            var images = pair ? Array.from(pair.querySelectorAll('img')) : [img];
            enhanceImage(img, images);
        });

        // Keep content and anchor targets clear when the shared header wraps at zoom.
        var header = document.querySelector('.fixed-header');
        if (header) {
            var updateHeaderHeight = function () {
                document.documentElement.style.setProperty('--header-height', Math.ceil(header.getBoundingClientRect().height) + 'px');
            };
            updateHeaderHeight();
            if ('ResizeObserver' in window) new ResizeObserver(updateHeaderHeight).observe(header);
            else window.addEventListener('resize', updateHeaderHeight, { passive: true });
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
