// Reading progress bar — a thin gradient fill at the top of the viewport
// that grows as the user scrolls. Injects its own styles + DOM, so any page
// can opt in with a single <script src="js/reading-progress.js"></script>.
(function () {
    // Inject styles once per document.
    if (!document.getElementById('reading-progress-styles')) {
        const style = document.createElement('style');
        style.id = 'reading-progress-styles';
        style.textContent =
            '.reading-progress {' +
            '  position: fixed;' +
            '  top: 0;' +
            '  left: 0;' +
            '  width: 100%;' +
            '  height: 4px;' +
            '  background: rgba(30, 58, 95, 0.3);' +
            '  z-index: 9999;' +
            '  backdrop-filter: blur(5px);' +
            '  -webkit-backdrop-filter: blur(5px);' +
            '  pointer-events: none;' +
            '}' +
            '.reading-progress-fill {' +
            '  height: 100%;' +
            '  width: 0%;' +
            '  background: linear-gradient(90deg, #40e0d0, #ffe55c, #20b2aa);' +
            '  transition: width 0.2s ease;' +
            '  box-shadow: 0 0 15px rgba(64, 224, 208, 0.8),' +
            '              0 0 30px rgba(255, 215, 0, 0.4);' +
            '}';
        document.head.appendChild(style);
    }

    function init() {
        // Bail if already initialized (defensive against double-include).
        if (document.querySelector('.reading-progress')) return;

        const bar = document.createElement('div');
        bar.className = 'reading-progress';
        const fill = document.createElement('div');
        fill.className = 'reading-progress-fill';
        bar.appendChild(fill);
        document.body.appendChild(bar);

        let ticking = false;
        function onScroll() {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(function () {
                const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
                const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
                const pct = height > 0 ? (scrollTop / height) * 100 : 0;
                fill.style.width = pct + '%';
                ticking = false;
            });
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        onScroll(); // initial paint
    }

    if (document.body) {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();
