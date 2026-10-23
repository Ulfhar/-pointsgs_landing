"""Check the shared Play link contract across published and archived pages.

Run after tools/build_blog.py. This checks the delivered HTML rather than
repeating the generator, and deliberately leaves ordinary prose links alone.
"""
import json
from pathlib import Path
import re
import sys
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from html_tree import parse


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def local_path(page, reference):
    url = urlsplit(reference)
    if url.scheme or url.netloc or not url.path:
        return None
    return ((ROOT / unquote(url.path).lstrip("/")) if url.path.startswith("/")
            else (page.parent / unquote(url.path))).resolve()


def prominent_store_links(tree):
    def visit(node, in_cta=False):
        classes = (node.attrs.get("class") or "").split()
        in_cta = in_cta or any("cta" in name.split("-") for name in classes)
        href = urlsplit(node.attrs.get("href", ""))
        if node.tag == "a" and href.hostname == "play.google.com":
            media = any(child.tag in {"img", "svg"} for child in node.walk())
            visual_style = re.search(r"background|inline-flex", node.attrs.get("style", ""))
            if in_cta or media or visual_style:
                yield node
        for child in node.children:
            yield from visit(child, in_cta)
    yield from visit(tree)


required = {"index.html", "about.html", "uk/about.html", "press-kit.html", "news_4.html", "partners/index.html"}
manifest = json.loads((ROOT / "blog/posts.json").read_text(encoding="utf-8"))
for post in manifest["posts"]:
    if post["slug"] in {"news_5", "news_6", "news_7", "news_9", "lore_1", "pillar_1"}:
        for language in post.get("languages", ["en", "uk"]):
            slug = post.get("url_slugs", {}).get(language, post["slug"])
            required.add(("uk/" if language == "uk" else "") + slug + ".html")

found_pages, icon_paths = set(), set()
button_count = 0
for page in sorted([*ROOT.glob("*.html"), *(ROOT / "uk").glob("*.html"), ROOT / "partners/index.html"]):
    tree = parse(page.read_text(encoding="utf-8"))
    buttons = list(prominent_store_links(tree))
    if not buttons:
        continue
    relative = page.relative_to(ROOT).as_posix()
    found_pages.add(relative)
    nodes = list(tree.walk())
    language = tree.find("html").attrs.get("lang")
    label = "Грати" if language == "uk" else "Play"
    aria_label = "Грати в Lumen Grove у Google Play" if language == "uk" else "Play Lumen Grove on Google Play"
    stylesheet = (ROOT / "css/buttons.css").resolve()
    matches = [node for node in nodes if node.tag == "link" and
               local_path(page, node.attrs.get("href", "")) == stylesheet]
    check(len(matches) == 1 and matches[0].attrs.get("rel") == "stylesheet",
          f"{relative}: load exactly one shared button stylesheet")
    check(stylesheet.is_file(), f"{relative}: missing shared button stylesheet")

    for button in buttons:
        button_count += 1
        check(button.has_class("play-cta"), f"{relative}: prominent store link bypasses shared CTA")
        check(button.has_class("ui-button") and button.has_class("ui-button--primary"),
              f"{relative}: Play link must use the shared primary button")
        check(not button.attrs.get("style"), f"{relative}: CTA has competing inline styles")
        check(not any(re.search(r"btn|button|lore-cta-play-link", cls) and not cls.startswith("ui-button") for cls in
                      button.attrs.get("class", "").split()), f"{relative}: old CTA style class remains")
        href = urlsplit(button.attrs["href"])
        check(href.scheme == "https" and href.path == "/store/apps/details" and
              parse_qs(href.query).get("id") == ["comPointsGameForge.FarFarForest"],
              f"{relative}: CTA must keep the Lumen Grove Google Play destination")
        check(button.attrs.get("target") == "_blank" and
              {"noopener", "noreferrer"} <= set(button.attrs.get("rel", "").split()),
              f"{relative}: store CTA needs safe native new-tab navigation")
        check(button.attrs.get("aria-label") == aria_label, f"{relative}: incorrect localized accessible name")
        check(not any(key.startswith("on") for key in button.attrs), f"{relative}: avoid inline navigation handlers")
        icon, copy = button.find("img", "play-cta__icon"), button.find("span", "play-cta__copy")
        check(icon is not None and copy is not None, f"{relative}: missing shared icon/copy structure")
        check(icon.attrs.get("alt") == "" and icon.attrs.get("aria-hidden") == "true",
              f"{relative}: decorative icon must not duplicate the accessible name")
        check(all(icon.attrs.get(dimension) == "24" for dimension in ("width", "height")),
              f"{relative}: store icon must reserve the shared 24px dimensions")
        icon_path = local_path(page, icon.attrs.get("src", ""))
        check(icon_path == (ROOT / "images/google-play-icon.svg").resolve() and icon_path.is_file(),
              f"{relative}: use the shared Google Play symbol without a round background")
        check(not any(key in icon.attrs for key in ("srcset", "data-full-src")),
              f"{relative}: the store icon is UI, not gallery media")
        icon_paths.add(icon_path)
        text, store = copy.find("span", "play-cta__label"), copy.find("span", "play-cta__store")
        check(text is not None and text.text().strip() == label, f"{relative}: inconsistent Play label")
        check(store is not None and store.text().strip() == "Google Play", f"{relative}: missing store caption")

check(required <= found_pages, f"Missing Play controls on: {', '.join(sorted(required - found_pages))}")
check(len(icon_paths) == 1, "All Play controls must use the same local store icon")
for locale, label, aria in (("en", "Play", "Play Lumen Grove on Google Play"),
                           ("ua", "Грати", "Грати в Lumen Grove у Google Play")):
    strings = json.loads((ROOT / f"js/locales/{locale}.json").read_text(encoding="utf-8"))
    check((strings.get("play_cta_label"), strings.get("play_cta_store"), strings.get("play_cta_aria_label")) ==
          (label, "Google Play", aria), f"{locale}: homepage CTA translations must match static pages")

print(f"Play CTA checks passed: {button_count} controls on {len(found_pages)} pages; shared assets, locales and native store links.")
