"""Guard the reusable button contract in delivered pages.

Run after tools/build_blog.py. Discover controls from native HTML semantics,
existing visual-action hooks and inline paint, rather than only selecting
.ui-button (which would miss a newly introduced one-off button).
"""
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from html_tree import parse

APPEARANCES = {"ui-button--primary", "ui-button--secondary", "ui-button--ghost", "ui-button--social"}
MODIFIERS = APPEARANCES | {"ui-button--icon", "ui-button--compact", "ui-button--media"}
SOCIAL_HOOK = re.compile(r"(?:^|[-_])social-link$|^(?:news-author-link|article-share-control)$")
SOCIAL_HOSTS = {"x.com", "twitter.com", "youtube.com", "tiktok.com", "linkedin.com",
                "facebook.com", "instagram.com", "threads.net", "bsky.app", "t.me"}
VISUAL_HOOK = re.compile(r"(?:^|[-_])(?:button|btn)(?:$|[-_])|^play-cta$|"
                         r"^(?:article-share-control|home-contact-submit|press-expandable-toggle)$|"
                         r"(?:social-link|asset-download|download-link)$")
INLINE_PAINT = re.compile(r"(?:^|;)\s*(?:background(?:-\w+)?|border(?:-\w+)?|box-shadow|"
                          r"text-shadow|font(?:-\w+)?|color|letter-spacing|padding(?:-\w+)?)\s*:", re.I)


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def local_path(page, reference):
    url = urlsplit(reference)
    if url.scheme or url.netloc or not url.path:
        return None
    return ((ROOT / unquote(url.path).lstrip("/")) if url.path.startswith("/")
            else (page.parent / unquote(url.path))).resolve()


def is_control(node):
    if node.tag == "button" or node.attrs.get("role") == "button":
        return True
    if node.tag == "input" and node.attrs.get("type", "").lower() in {"submit", "button", "reset"}:
        return True
    classes = node.attrs.get("class", "").split()
    if node.tag == "a":
        return any(VISUAL_HOOK.search(cls) for cls in classes) or bool(
            INLINE_PAINT.search(node.attrs.get("style", ""))) or "download" in node.attrs
    return any(cls in {"swiper-button-next", "swiper-button-prev"} for cls in classes)


def is_social_control(node):
    # A local Blog link and a video-view action are not social-profile/share
    # controls, even when displayed beside the social links.
    host = (urlsplit(node.attrs.get("href", "")).hostname or "").lower()
    network = any(host == domain or host.endswith("." + domain) for domain in SOCIAL_HOSTS)
    return node.tag == "a" and network and any(
        SOCIAL_HOOK.search(cls) for cls in node.attrs.get("class", "").split())


pages, controls = 0, 0
for page in sorted([*ROOT.glob("*.html"), *(ROOT / "uk").glob("*.html")]):
    tree = parse(page.read_text(encoding="utf-8"))
    nodes = list(tree.walk())
    relative = page.relative_to(ROOT).as_posix()
    for node in nodes:
        if node.tag in {"script", "link"}:
            reference = node.attrs.get("src") or node.attrs.get("href", "")
            check(local_path(page, reference) not in {
                (ROOT / "css/play-cta.css").resolve(), (ROOT / "js/play-cta.js").resolve()},
                f"{relative}: obsolete Play-only assets reintroduce competing button rules")
        if any(cls.startswith("ui-button--") for cls in node.attrs.get("class", "").split()):
            check(node.has_class("ui-button"), f"{relative}: a button modifier is missing its base class")

    actions = [node for node in nodes if is_control(node)]
    if not actions:
        continue
    pages += 1
    sheets = [node for node in nodes if node.tag == "link" and
              local_path(page, node.attrs.get("href", "")) == (ROOT / "css/buttons.css").resolve()]
    check(len(sheets) == 1 and sheets[0].attrs.get("rel") == "stylesheet",
          f"{relative}: controls require exactly one shared button stylesheet")
    for action in actions:
        controls += 1
        description = action.attrs.get("id") or action.attrs.get("class") or action.text().strip()[:35]
        where = f"{relative}: {description}"
        classes = set(action.attrs.get("class", "").split())
        check("ui-button" in classes, f"{where}: control bypasses the shared button system")
        check(len(classes & APPEARANCES) == 1, f"{where}: choose one shared appearance")
        unknown = {cls for cls in classes if cls.startswith("ui-button--")} - MODIFIERS
        check(not unknown, f"{where}: undocumented button modifier {sorted(unknown)}")
        check(("ui-button--social" in classes) == is_social_control(action),
              f"{where}: reserve the black social appearance for external social-profile/share controls")
        check(not INLINE_PAINT.search(action.attrs.get("style", "")),
              f"{where}: inline appearance competes with the shared stylesheet")
        check(action.tag in {"a", "button", "input"},
              f"{where}: use native links for navigation and buttons for actions")
        if action.tag == "button":
            check(action.attrs.get("type") in {"button", "submit", "reset"},
                  f"{where}: button type must be explicit")
        if action.tag == "a":
            check(bool(action.attrs.get("href")), f"{where}: navigation needs a native href")
        if "ui-button--icon" in classes:
            check(bool(action.attrs.get("aria-label") or action.attrs.get("aria-labelledby")),
                  f"{where}: icon-only control needs an accessible name")

check(controls > 0, "No published controls checked")
stylesheet = ROOT / "css/buttons.css"
check(stylesheet.is_file(), "Shared button CSS is missing")
css = re.sub(r"/\*.*?\*/", "", stylesheet.read_text(encoding="utf-8"), flags=re.S)
# Check readable foreground/background pairs at both ends of each shared
# gradient. Decorative depth is permitted; a hard ban on shadows/gradients
# would protect a flat implementation rather than this reusable contract.
root_block = re.search(r":root\s*\{([^}]+)\}", css)
check(root_block is not None, "Shared button palette needs root tokens")
tokens = dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", root_block.group(1)))


def luminance(token):
    value = tokens.get(token, "").strip()
    check(bool(re.fullmatch(r"#[0-9a-fA-F]{6}", value)),
          f"Shared contrast token {token} must be an explicit six-digit hex color")
    channels = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [channel / 12.92 if channel <= 0.04045 else
              ((channel + 0.055) / 1.055) ** 2.4 for channel in channels]
    return sum(channel * weight for channel, weight in zip(linear, (0.2126, 0.7152, 0.0722)))


contrast_results = []
for foreground, backgrounds in (
        ("--button-primary-text", ("--button-primary-top", "--button-primary-bottom")),
        ("--button-foreground", ("--button-secondary-top", "--button-secondary-bottom"))):
    for background in backgrounds:
        light, dark = sorted((luminance(foreground), luminance(background)), reverse=True)
        contrast = (light + 0.05) / (dark + 0.05)
        check(contrast >= 4.5,
              f"{foreground} against {background}: {contrast:.2f}:1 is below 4.5:1")
        contrast_results.append(contrast)
check((ROOT / "docs/buttons.md").is_file(), "Reusable button rules need a documented reference")
print(f"Shared button checks passed: {controls} controls on {pages} pages; explicit variants, native semantics and one stylesheet; "
      f"minimum text contrast {min(contrast_results):.2f}:1.")
