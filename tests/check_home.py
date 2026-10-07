"""Check current acquisition copy, translations, metadata and local routes."""
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from html_tree import parse


def check(condition, message):
    if not condition:
        raise AssertionError(message)


stale = re.compile(r"early[ -]access|puzzle[ -]platformer|fairy[ -]tale puzzle|ранн\w* доступ|пазл[ -]платформ|LiveOps|invest in the", re.I)
paths = [ROOT / name for name in ("index.html", "about.html", "uk/about.html", "pillar_1.html", "uk/pillar_1.html")]
trees = {}
for path in paths:
    source = path.read_text(encoding="utf-8")
    tree = trees[path.name if path.parent == ROOT else "uk/" + path.name] = parse(source)
    nodes = list(tree.walk())
    check(not stale.search(source), f"{path}: stale current-game claim")
    check(sum(n.tag == "h1" for n in nodes) == 1, f"{path}: one H1 required")
    check(sum(n.tag == "main" for n in nodes) == 1, f"{path}: one main required")
    check(any(n.tag == "link" and n.attrs.get("rel") == "canonical" for n in nodes), f"{path}: canonical required")
    ids = [n.attrs["id"] for n in nodes if n.attrs.get("id")]
    check(len(ids) == len(set(ids)), f"{path}: duplicate ids")
    for node in nodes:
        if node.tag == "script" and node.attrs.get("type") == "application/ld+json":
            json.loads(node.text())
        for attr in ("href", "src", "poster", "data-src"):
            href = node.attrs.get(attr, "")
            url = urlsplit(href)
            if not href or url.scheme or url.netloc:
                continue
            target = ROOT / unquote(url.path).lstrip("/") if url.path.startswith("/") else path.parent / unquote(url.path)
            if not url.path:
                target = path
            if target.is_dir():
                target /= "index.html"
            check(target.is_file(), f"{path}: missing {href}")
            if url.fragment and target == path:
                check(unquote(url.fragment) in ids, f"{path}: missing anchor {href}")

home = trees["index.html"]
nodes = list(home.walk())
main = home.find("main")
check(next(n for n in main.children if n.tag == "section").attrs.get("id") == "halloween", "Halloween must lead main content after screenshots")
check(not any(n.has_class("home-roadmap") for n in nodes), "developer roadmap must be removed")
check(sum(n.has_class("home-feature") for n in nodes) == 6, "six player-facing features required")
hero = home.find("header", "home-hero")
hero_links = [n for n in hero.walk() if n.tag == "a" and (n.has_class("home-store-link") or n.has_class("home-btn-secondary"))]
check(len(hero_links) == 2 and "play.google.com/store/apps/details" in hero_links[0].attrs["href"] and hero_links[1].attrs["href"] == "#gameplay", "hero must lead to install and gameplay")
faq = next(n for n in nodes if n.attrs.get("data-i18n") == "home_faq_a2").text()
check("Light" in faq and "Magic Oak" in faq and "fireflies" not in faq.lower(), "current Light-to-Oak loop required")
strings = json.loads((ROOT / "js/locales/ua.json").read_text(encoding="utf-8"))
for node in nodes:
    key = node.attrs.get("data-i18n") or node.attrs.get("data-i18n-content")
    if key:
        check(bool(strings.get(key)), f"missing Ukrainian key: {key}")
        check(not stale.search(strings[key]), f"stale Ukrainian key: {key}")
check("Світло" in strings["home_faq_a2"] and "Чарівному Дубу" in strings["home_faq_a2"], "Ukrainian loop must use Light and Magic Oak")
for name in ("about.html", "uk/about.html"):
    tree = trees[name]
    check(any(n.attrs.get("id") == "bogdan-kagitin" for n in tree.walk()), f"{name}: preserve founder anchor")
    for language, expected in (("en", "https://points.gs/about.html"), ("uk", "https://points.gs/uk/about.html")):
        check(any(n.tag == "link" and n.attrs.get("hreflang") == language and n.attrs.get("href") == expected for n in tree.walk()), f"{name}: language alternate missing")
print("Homepage checks passed: current EN/UK copy, Light loop, hero/event, About, metadata and local links.")
