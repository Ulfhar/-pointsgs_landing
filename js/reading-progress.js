/* Opt-in progress for the article text; page chrome and footer do not count. */
(function () {
    'use strict';
    function init() {
        var article = document.querySelector('article[data-reading-progress], .news-content[data-reading-progress]');
        if (!article || document.querySelector('.reading-progress')) return;
        var content = article.matches('.news-content') ? article : article.querySelector('.news-content');
        if (!content) return;
        var bar = document.createElement('div');
        bar.className = 'reading-progress';
        bar.setAttribute('aria-hidden', 'true');
        var fill = document.createElement('div');
        fill.className = 'reading-progress-fill';
        bar.appendChild(fill);
        document.body.appendChild(bar);
        var start = 0, end = 0, ticking = false;
        function paint() {
            var position = window.scrollY || document.documentElement.scrollTop;
            var progress = end > start ? (position - start) / (end - start) : (position >= start ? 1 : 0);
            fill.style.width = Math.max(0, Math.min(1, progress)) * 100 + '%';
            ticking = false;
        }
        function measure() {
            var rect = content.getBoundingClientRect();
            var header = document.querySelector('.fixed-header');
            var headerHeight = header ? header.getBoundingClientRect().height : 0;
            var position = window.scrollY || document.documentElement.scrollTop;
            start = Math.max(0, rect.top + position - headerHeight - 12);
            end = rect.bottom + position - window.innerHeight;
            paint();
        }
        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(paint);
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', measure, { passive: true });
        window.addEventListener('load', measure, { once: true });
        article.querySelectorAll('.article-toc details').forEach(function (details) {
            details.addEventListener('toggle', measure);
        });
        if ('ResizeObserver' in window) {
            var observer = new ResizeObserver(measure);
            observer.observe(content);
            if (article !== content) observer.observe(article);
            var header = document.querySelector('.fixed-header');
            if (header) observer.observe(header);
        }
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
        measure();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
})();
