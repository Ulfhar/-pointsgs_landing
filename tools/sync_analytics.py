"""Synchronize analytics and shared asset versions on delivered HTML pages.

Redirect aliases and templates must not produce extra page views. Run this after
changing js/analytics.js; the blog builder uses the same versioned fragment.
"""
import hashlib
import re
from analytics_snippet import ROOT, analytics_head


def page_paths():
    for folder in (ROOT, ROOT / 'uk', ROOT / 'partners'):
        for path in sorted(folder.glob('*.html')):
            source = path.read_text(encoding='utf-8')
            if ('<head>' not in source or 'template' in path.stem or
                    re.search(r'http-equiv=[\'\"]refresh[\'\"]', source, re.I)):
                continue
            yield path


def sync_page(path):
    source = path.read_text(encoding='utf-8')
    # Remove only the previous GA/CookieYes integration, not page interactions/schema.
    source = re.sub(r'\s*<!--\s*(?:Google tag \(gtag\.js\)|Start cookieyes banner|End cookieyes banner)\s*-->', '', source)
    source = re.sub(r'\s*<script\b[^>]*\bsrc=[\'\"][^\'\"]*(?:googletagmanager\.com/gtag/js|cdn-cookieyes\.com/|js/analytics\.js)[^\'\"]*[\'\"][^>]*>\s*</script>', '', source, flags=re.I)
    source = re.sub(r'\s*<script>\s*window\.dataLayer\s*=.*?gtag\([\'\"]config[\'\"].*?</script>', '', source, flags=re.S)
    prefix = '/' if path.parent == ROOT / 'partners' else '../' if path.parent.name == 'uk' else ''
    source = source.replace('</head>', analytics_head(prefix) + '\n</head>', 1)
    # Standalone pages also need new URLs for changed interaction controllers.
    for asset in ('js/locale.js', 'js/article-share.js', 'js/press-contact.js',
                  'js/home-contact.js', 'js/contact-topic.js', 'css/header.css', 'header.html', 'footer.html'):
        version = hashlib.sha256((ROOT / asset).read_bytes()).hexdigest()[:12]
        source = re.sub(r'([\'\"])' + re.escape(prefix + asset) + r'(?:\?v=[a-f0-9]+)?([\'\"])',
                        lambda match: match[1] + prefix + asset + '?v=' + version + match[2], source)
    previous = path.read_text(encoding='utf-8')
    if source != previous:
        path.write_text(source, encoding='utf-8', newline='\n')
        return True
    return False


if __name__ == '__main__':
    paths = list(page_paths())
    changed = sum(sync_page(path) for path in paths)
    print(f'Analytics synchronized on {len(paths)} pages ({changed} changed)')
