function getUserLocale() {
    const saved = localStorage.getItem('locale');
    if (saved) return saved;
    const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    if (lang.startsWith('ua') || lang.startsWith('uk')) return 'ua';
    return 'en';
}

function setUserLocale(locale) {
    localStorage.setItem('locale', locale);
    location.reload();
}

function localizePage(strings) {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (strings[key]) {
            el.textContent = strings[key];
        }
    });
    if (strings.title) document.title = strings.title;
}

function attachLangSwitcherListeners() {
    const uaBtn = document.getElementById('switch-to-ua');
    const enBtn = document.getElementById('switch-to-en');
    if (uaBtn) uaBtn.onclick = () => setUserLocale('ua');
    if (enBtn) enBtn.onclick = () => setUserLocale('en');
}

function updateLangSwitcherActive(locale) {
    const enBtn = document.getElementById('switch-to-en');
    const uaBtn = document.getElementById('switch-to-ua');
    if (enBtn && uaBtn) {
        enBtn.classList.toggle('active', locale === 'en');
        uaBtn.classList.toggle('active', locale === 'ua');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const locale = getUserLocale();

    // Attach listeners immediately (for static footers)
    attachLangSwitcherListeners();
    updateLangSwitcherActive(locale);

    if (locale !== 'en') {
        fetch(`js/locales/${locale}.json`)
            .then(res => res.json())
            .then(strings => {
                localizePage(strings);
            });
    }

    // Attach listeners after the footer is loaded dynamically
    const footerPlaceholder = document.getElementById('footer-placeholder');
    if (footerPlaceholder) {
        const observer = new MutationObserver(() => {
            attachLangSwitcherListeners();
            updateLangSwitcherActive(locale);
        });
        observer.observe(footerPlaceholder, { childList: true });
    }
}); 