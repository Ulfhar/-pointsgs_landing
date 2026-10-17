"""One analytics head fragment shared by generated and standalone pages."""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COOKIEYES_ID = 'e6ba3bfedc57c067fa59e14b'


def analytics_head(prefix=''):
    version = hashlib.sha256((ROOT / 'js/analytics.js').read_bytes()).hexdigest()[:12]
    # Install consent listeners before the asynchronous CMP can emit its initial event.
    return (f'    <script src="{prefix}js/analytics.js?v={version}"></script>\n'
            f'    <script id="cookieyes" src="https://cdn-cookieyes.com/client_data/{COOKIEYES_ID}/script.js" async></script>')
