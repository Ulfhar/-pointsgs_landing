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
    // Optionally localize document title
    if (strings.title) document.title = strings.title;
}

document.addEventListener('DOMContentLoaded', function() {
    const uaBtn = document.getElementById('switch-to-ua');
    const enBtn = document.getElementById('switch-to-en');
    if (uaBtn) uaBtn.onclick = () => setUserLocale('ua');
    if (enBtn) enBtn.onclick = () => setUserLocale('en');

    // Load and apply localization
    const locale = getUserLocale();
    fetch(`js/locales/${locale}.json`)
        .then(res => res.json())
        .then(strings => {
            localizePage(strings);
        });
}); 