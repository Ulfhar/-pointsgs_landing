// Blog pages are built separately for each language. Their content and metadata
// must stay identical for readers, crawlers, and browsers with JavaScript off.
function getStaticLocale() {
    const locale = document.body && document.body.getAttribute('data-static-locale');
    return locale === 'en' || locale === 'uk' ? locale : null;
}

function getUserLocale() {
    try {
        const saved = localStorage.getItem('locale');
        if (saved === 'ua' || saved === 'uk') return 'ua';
        if (saved === 'en') return 'en';
    } catch (error) {
        // Language links still work when storage is unavailable.
    }
    const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    return lang.startsWith('ua') || lang.startsWith('uk') ? 'ua' : 'en';
}

function saveUserLocale(locale) {
    try {
        localStorage.setItem('locale', locale === 'uk' || locale === 'ua' ? 'ua' : 'en');
    } catch (error) {
        // Storage is an optional preference, never a navigation dependency.
    }
}

function setUserLocale(locale) {
    saveUserLocale(locale);
    location.reload();
}

function localizedPageTitle(strings) {
    // A translation file's generic "title" belongs to its original Terms page.
    // Explicit title keys or a translated main heading are safe on other pages.
    const titleElement = document.querySelector('title[data-i18n]');
    const titleKey = document.documentElement.getAttribute('data-i18n-title') ||
        (titleElement && titleElement.getAttribute('data-i18n'));
    if (titleKey && strings[titleKey]) return strings[titleKey];

    const pageName = location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
    const pageTitles = {
        index: 'Points Game Studio — розробники інді-ігор для мобільних пристроїв',
        about: 'Про Points Game Studio — розробники інді-ігор',
        fff_terms: 'Lumen Grove — Умови та положення',
        fff_pp: 'Lumen Grove — Політика конфіденційності',
        terms: 'Умови та положення'
    };
    if (getUserLocale() === 'ua' && pageTitles[pageName]) return pageTitles[pageName];

    const heading = document.querySelector('h1[data-i18n]');
    return heading ? strings[heading.getAttribute('data-i18n')] : null;
}

function localizePage(strings) {
    if (getStaticLocale()) return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const value = strings[el.getAttribute('data-i18n')];
        if (value === undefined || value === null) return;
        if (typeof value === 'string' && /<[a-z][\s\S]*?>/i.test(value)) {
            el.innerHTML = value;
        } else {
            el.textContent = value;
        }
    });
    document.querySelectorAll('[data-i18n-content]').forEach(el => {
        const value = strings[el.getAttribute('data-i18n-content')];
        if (typeof value === 'string') el.setAttribute('content', value);
    });
    document.querySelectorAll('a[data-locale-page]').forEach(link => {
        const page = link.getAttribute('data-locale-page');
        link.href = (getUserLocale() === 'ua' ? '/uk/' : '/') + page;
    });
    const title = localizedPageTitle(strings);
    if (title) {
        const plainTitle = document.createElement('span');
        plainTitle.innerHTML = title;
        document.title = plainTitle.textContent;
    }
    document.documentElement.lang = getUserLocale() === 'ua' ? 'uk' : 'en';
    updateLangSwitcherActive(document.documentElement.lang);
}

function updateLangSwitcherActive(locale) {
    const activeLocale = locale === 'ua' ? 'uk' : locale;
    const navigation = document.querySelector('.header-nav');
    if (navigation) {
        const blog = navigation.querySelector('a[href*="devlog.html"]');
        const about = navigation.querySelector('a[href$="#about"], a[href$="about.html"]');
        const press = navigation.querySelector('a[href$="press-kit.html"]');
        if (blog) {
            blog.textContent = activeLocale === 'uk' ? 'Блог' : 'Blog';
            blog.href = (activeLocale === 'uk' ? '/uk/' : '/') + 'devlog.html';
        }
        if (about) about.textContent = activeLocale === 'uk' ? 'Про нас' : 'About Us';
        if (press) press.textContent = activeLocale === 'uk' ? 'Для преси' : 'Press Kit';
    }
    [['switch-to-en', 'en'], ['switch-to-ua', 'uk']].forEach(([id, language]) => {
        const link = document.getElementById(id);
        if (!link) return;
        const active = activeLocale === language;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
}

function attachLangSwitcherListeners() {
    const staticLocale = getStaticLocale();
    [['switch-to-en', 'en'], ['switch-to-ua', 'uk']].forEach(([id, language]) => {
        const link = document.getElementById(id);
        if (!link) return;
        if (staticLocale) {
            const alternate = document.querySelector(`link[rel="alternate"][hreflang="${language}"]`);
            if (alternate) {
                const target = new URL(alternate.href, location.href);
                link.href = target.pathname + target.search + target.hash;
            }
            // Keep the native link action (including keyboard and new-tab use).
            link.onclick = () => saveUserLocale(language);
        } else {
            link.href = location.href;
            link.onclick = event => {
                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                setUserLocale(language);
            };
        }
    });
}

function initializeLocale() {
    const staticLocale = getStaticLocale();
    const locale = staticLocale || getUserLocale();
    attachLangSwitcherListeners();
    updateLangSwitcherActive(locale);

    if (staticLocale) return;

    document.querySelectorAll('.hide-for-en').forEach(el => {
        el.style.display = locale === 'en' ? 'none' : '';
    });

    if (locale !== 'en') {
        fetch(`js/locales/${locale}.json`, { cache: 'no-cache' })
            .then(response => {
                if (!response.ok) throw new Error('Could not load language strings');
                return response.json();
            })
            .then(localizePage)
            .catch(() => {
                // Preserve the readable source language if translations fail.
                document.documentElement.lang = 'en';
                updateLangSwitcherActive('en');
            });
    }

    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) {
        const observer = new MutationObserver(() => {
            attachLangSwitcherListeners();
            updateLangSwitcherActive(document.documentElement.lang === 'uk' ? 'uk' : 'en');
        });
        observer.observe(footerPlaceholder, { childList: true });
    }
    const headerPlaceholder = document.getElementById('header-placeholder');
    if (headerPlaceholder) {
        const observer = new MutationObserver(() => {
            updateLangSwitcherActive(getStaticLocale() || getUserLocale());
        });
        observer.observe(headerPlaceholder, { childList: true });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLocale);
} else {
    initializeLocale();
}
