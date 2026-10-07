// Decorative hero video: load only when motion is allowed and the hero is visible.
(function () {
    const hero = document.querySelector('.home-hero');
    const video = hero && hero.querySelector('.home-hero-video');
    if (!video) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const initialBounds = hero.getBoundingClientRect();
    let inView = initialBounds.bottom > 0 && initialBounds.top < window.innerHeight;
    let loaded = false;
    let failed = false;
    let requestId = 0;

    // Set properties as well as HTML attributes for mobile autoplay policies.
    video.muted = true;
    video.defaultMuted = true;

    function stop(showPoster) {
        requestId += 1;
        video.pause();
        if (showPoster) hero.classList.remove('is-video-playing');
    }

    function syncPlayback() {
        if (motion.matches || failed) {
            stop(true);
            return;
        }
        if (document.hidden || !inView) {
            stop(false);
            return;
        }
        if (!loaded) {
            video.querySelectorAll('source[data-src]').forEach(source => {
                source.src = source.dataset.src;
            });
            video.preload = 'auto';
            video.load();
            loaded = true;
        }
        if (!video.paused) return;

        const thisRequest = ++requestId;
        const playback = video.play();
        if (playback && typeof playback.catch === 'function') {
            playback.catch(() => {
                // A browser may reject autoplay; the poster remains the background.
                // Ignore old requests interrupted by an intentional pause.
                if (thisRequest === requestId) hero.classList.remove('is-video-playing');
            });
        }
    }

    video.addEventListener('playing', () => {
        if (motion.matches || document.hidden || !inView || failed) {
            stop(motion.matches || failed);
            return;
        }
        hero.classList.add('is-video-playing');
    });
    video.addEventListener('error', () => {
        failed = true;
        stop(true);
    });
    document.addEventListener('visibilitychange', syncPlayback);
    if (motion.addEventListener) motion.addEventListener('change', syncPlayback);
    else motion.addListener(syncPlayback);

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            inView = entries[0].isIntersecting;
            syncPlayback();
        }, { threshold: 0.01 });
        observer.observe(hero);
    }

    syncPlayback();
})();
