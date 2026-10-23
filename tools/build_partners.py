"""Build the crawlable English Partnerships page from shared navigation and assets."""
import hashlib
import json
import re
from pathlib import Path

from analytics_snippet import analytics_head

ROOT = Path(__file__).resolve().parents[1]


def asset_version(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()[:12]


def root_links(fragment):
    return re.sub(r'(\b(?:href|src)=["\'])(?!https?:|mailto:|#|/)([^"\']+)', r'\1/\2', fragment)


def build():
    header = root_links((ROOT / 'header.html').read_text(encoding='utf-8'))
    header = header.replace('href="/partners/"', 'href="/partners/" aria-current="page"')
    footer = root_links((ROOT / 'footer.html').read_text(encoding='utf-8'))
    # This page has no translated counterpart; offer explicit destinations instead.
    footer = re.sub(r'<div class="footer-section">\s*<h4>Language</h4>.*?</div>\s*</div>',
                    '<div class="footer-section"><h4>Explore</h4><div class="legal-links">'
                    '<a href="/about.html">About the studio</a><a href="/devlog.html">Blog</a>'
                    '<a href="/press-kit.html">Press kit</a></div></div>', footer, count=1, flags=re.S)
    footer = footer.replace('href="mailto:info@points.gs"',
                            'href="mailto:info@points.gs" data-partnership-contact="email" data-analytics-location="partners_footer"')
    structured = {
        '@context': 'https://schema.org', '@graph': [
            {'@type': 'WebPage', '@id': 'https://points.gs/partners/#webpage',
             'url': 'https://points.gs/partners/', 'name': 'Lumen Grove — Publishing & Partnerships | POINTS.GS',
             'inLanguage': 'en', 'about': {'@id': 'https://points.gs/#lumen-grove'},
             'publisher': {'@id': 'https://points.gs/#organization'}},
            {'@type': 'VideoGame', '@id': 'https://points.gs/#lumen-grove', 'name': 'Lumen Grove',
             'genre': 'Cozy forest farming', 'operatingSystem': 'Android', 'applicationCategory': 'GameApplication',
             'isAccessibleForFree': True,
             'url': 'https://play.google.com/store/apps/details?id=comPointsGameForge.FarFarForest',
             'publisher': {'@id': 'https://points.gs/#organization'}},
            {'@type': 'Organization', '@id': 'https://points.gs/#organization', 'name': 'Points Game Studio',
             'alternateName': 'POINTS.GS', 'url': 'https://points.gs/', 'email': 'info@points.gs'}
        ]}
    replacements = {
        'HEADER': header, 'FOOTER': footer,
        'HEADER_VERSION': asset_version('css/header.css'),
        'BUTTONS_VERSION': asset_version('css/buttons.css'),
        'PARTNERS_VERSION': asset_version('css/partners.css'),
        'PDF_VERSION': asset_version('public/downloads/lumen-grove-project-overview.pdf'),
        'ANALYTICS_HEAD': analytics_head('/'),
        'STRUCTURED_DATA': json.dumps(structured, ensure_ascii=False).replace('</', '<\\/'),
    }
    output = (ROOT / 'templates/partners.html').read_text(encoding='utf-8')
    for key, value in replacements.items():
        output = output.replace('{{' + key + '}}', value)
    if re.search(r'\{\{[A-Z_]+\}\}', output):
        raise ValueError('Unresolved Partnerships template field')
    path = ROOT / 'partners/index.html'
    path.parent.mkdir(exist_ok=True)
    path.write_text(output, encoding='utf-8', newline='\n')
    print('Built partners/index.html')


if __name__ == '__main__':
    build()
