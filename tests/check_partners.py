"""Validate the delivered Partnerships page and its local visitor journeys.

Run after tools/build_partners.py, tools/build_blog.py and tools/sync_analytics.py.
This checks crawlable HTML and native destinations; live delivery, layout, GA4
receipt and Search Console indexing still require browser/account verification.
"""
from datetime import date
import json
from pathlib import Path
import sys
from urllib.parse import parse_qs, unquote, urlsplit
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from html_tree import parse

PAGE = ROOT / "partners/index.html"
CANONICAL = "https://points.gs/partners/"


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def local_path(page, reference):
    url = urlsplit(reference)
    if url.netloc and url.netloc != "points.gs":
        return None
    if url.scheme and url.scheme not in {"https", "http"}:
        return None
    target = ((ROOT / unquote(url.path).lstrip("/")) if url.path.startswith("/")
              else page.parent / unquote(url.path)) if url.path else page
    return (target / "index.html" if target.is_dir() else target).resolve()


source = PAGE.read_text(encoding="utf-8")
tree = parse(source)
nodes = list(tree.walk())
home = parse((ROOT / "index.html").read_text(encoding="utf-8"))
check(tree.find("html").attrs.get("lang") == "en", "Partnerships must be English")
check(tree.find("body").attrs.get("data-static-locale") == "en", "Stored language must not replace English partner copy")
check(len([n for n in nodes if n.tag == "main"]) == 1, "One main landmark required")
headings = [n for n in nodes if n.tag == "h1"]
check(len(headings) == 1 and all(word in headings[0].text().lower() for word in ("lumen grove", "partner")),
      "One project-specific partnership H1 required")
titles = [n for n in nodes if n.tag == "title"]
check(len(titles) == 1 and titles[0].text() != home.find("title").text(), "Unique title required")
check(all(word in titles[0].text() for word in ("Lumen Grove", "Partnerships", "POINTS.GS")), "Title must identify project, purpose and studio")
ids = [n.attrs["id"] for n in nodes if n.attrs.get("id")]
check(len(ids) == len(set(ids)), "Duplicate IDs would break navigation and labels")
for node in nodes:
    if node.tag == "script" and node.attrs.get("type") == "application/ld+json":
        json.loads(node.text())

meta = {n.attrs.get("name") or n.attrs.get("property"): n.attrs.get("content", "")
        for n in nodes if n.tag == "meta"}
home_meta = {n.attrs.get("name"): n.attrs.get("content", "") for n in home.walk() if n.tag == "meta"}
check(bool(meta.get("description")) and meta["description"] != home_meta.get("description"), "Unique description required")
check([n.attrs.get("href") for n in nodes if n.tag == "link" and n.attrs.get("rel") == "canonical"] == [CANONICAL],
      "Canonical must resolve to the public directory route")
check(meta.get("og:url") == CANONICAL, "Open Graph URL must match canonical")
check(all(meta.get(key) for key in ("og:title", "og:description", "og:image", "og:image:alt", "twitter:card")),
      "Share preview needs title, summary, image, alternate text and card")
check(meta["og:image"].startswith("https://points.gs/"), "Share image must use an absolute public URL")
check(local_path(PAGE, meta["og:image"]).is_file(), "Open Graph image is missing")
for key in ("og:image:width", "og:image:height"):
    check(meta.get(key, "").isdigit() and int(meta[key]) > 0, f"Invalid {key}")
check("noindex" not in meta.get("robots", "").lower() and "none" not in meta.get("robots", "").lower(),
      "Partnerships must allow indexing")
check(not any(n.tag == "meta" and n.attrs.get("http-equiv", "").lower() == "refresh" for n in nodes),
      "The canonical page must serve content without a redirect")
robots = RobotFileParser()
robots.parse((ROOT / "robots.txt").read_text(encoding="utf-8").splitlines())
check(robots.can_fetch("*", CANONICAL), "robots.txt blocks Partnerships")
ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
entries = ET.parse(ROOT / "sitemap.xml").findall("s:url", ns)
locations = [entry.findtext("s:loc", namespaces=ns) for entry in entries]
check(locations.count(CANONICAL) == 1, "Sitemap needs one canonical Partnerships entry")
check(not ({"https://points.gs/partners", "https://points.gs/partners/index.html"} & set(locations)),
      "Sitemap must not list duplicate Partnerships routes")

main = tree.find("main")
copy = main.text().lower()
for fact in ("cozy forest farming", "free-to-play", "android", "released", "unity 2d", "ios planned"):
    check(fact in copy, f"Project fact must be available as HTML text: {fact}")
for focus in ("player acquisition", "product analytics", "retention", "monetization"):
    check(focus in copy, f"Missing visible partnership focus: {focus}")
check("bogdan kagitin" in copy and "points" in copy, "Studio and creator information must be visible")
updates = [n for n in main.walk() if n.tag == "time" and n.attrs.get("datetime")]
check(bool(updates), "Last Android update must be present as a machine-readable date")
for update in updates:
    date.fromisoformat(update.attrs["datetime"])

# Resolve assets and anchors as the nested public URL does, including srcsets.
for node in nodes:
    references = [(attr, node.attrs[attr]) for attr in ("href", "src", "poster") if node.attrs.get(attr)]
    references += [("srcset", entry.strip().rsplit(" ", 1)[0])
                   for entry in node.attrs.get("srcset", "").split(",") if entry.strip()]
    for attr, reference in references:
        target = local_path(PAGE, reference)
        if target is None:
            continue
        check(target.is_relative_to(ROOT.resolve()), f"Local reference escapes site: {reference}")
        check(target.is_file(), f"Missing nested-page {attr}: {reference}")
        url = urlsplit(reference)
        if url.fragment and target.suffix == ".html":
            target_tree = tree if target == PAGE.resolve() else parse(target.read_text(encoding="utf-8"))
            check(any(n.attrs.get("id") == unquote(url.fragment) for n in target_tree.walk()),
                  f"Broken destination anchor: {reference}")
        if node.tag == "a":
            check(not any(key.lower().startswith("utm_") for key in parse_qs(url.query)),
                  "Internal website links must not create campaigns")

gallery = tree.find("div", "partners-gallery")
screenshots = [n for n in gallery.walk() if n.tag == "img"] if gallery else []
check(3 <= len(screenshots) <= 5, "Provide three to five actual screenshots")
for image in screenshots:
    check(bool(image.attrs.get("alt")), "Screenshots need meaningful alternate text")
    check(all(image.attrs.get(key, "").isdigit() and int(image.attrs[key]) > 0 for key in ("width", "height")),
          "Screenshots must reserve their dimensions")
videos = [n for n in nodes if n.tag == "video"]
check(len(videos) == 1 and {"controls", "playsinline"} <= videos[0].attrs.keys(),
      "Gameplay needs one playable native mobile video")
check(bool(videos[0].attrs.get("poster")) and any(n.tag == "source" and n.attrs.get("type") == "video/mp4" for n in videos[0].walk()),
      "Gameplay requires a local poster and MP4 source")
video_source = next(n for n in videos[0].walk() if n.tag == "source" and n.attrs.get("type") == "video/mp4")
video_path = local_path(PAGE, video_source.attrs.get("src", ""))
with video_path.open("rb") as video_file:
    check(video_file.read(12)[4:8] == b"ftyp" and video_path.stat().st_size > 1000,
          "Gameplay source is empty or is not an MP4 asset")
play_links = [n for n in main.walk() if n.tag == "a" and urlsplit(n.attrs.get("href", "")).hostname == "play.google.com"]
check(bool(play_links), "Playable build must be directly reachable")
for link in play_links:
    url = urlsplit(link.attrs["href"])
    check(url.scheme == "https" and url.path == "/store/apps/details" and
          parse_qs(url.query).get("id") == ["comPointsGameForge.FarFarForest"], "Incorrect Google Play build")

links = [n for n in nodes if n.tag == "a"]
form_links = [n for n in links if n.attrs.get("data-partnership-contact") == "form"]
email_links = [n for n in links if n.attrs.get("href", "").startswith("mailto:")]
downloads = [n for n in links if "data-project-overview" in n.attrs]
check(bool(form_links) and bool(email_links) and bool(downloads), "Form, email and overview must all be available")
for link in form_links:
    url = urlsplit(link.attrs.get("href", ""))
    check(parse_qs(url.query).get("contact_topic") == ["partnership"] and url.fragment == "contactForm" and
          local_path(PAGE, link.attrs["href"]) == (ROOT / "index.html").resolve(),
          "Pitch request must open the existing form with the partnership topic")
    check("Request pitch deck" in link.text(), "Pitch CTA must clearly describe the requested material")
for link in email_links:
    check(urlsplit(link.attrs["href"]).path == "info@points.gs" and link.attrs.get("data-partnership-contact") == "email",
          "Business email must be correct and tagged as partnership contact")
pdf_paths = set()
for link in downloads:
    pdf = local_path(PAGE, link.attrs.get("href", ""))
    check(pdf and pdf.suffix == ".pdf" and "download" in link.attrs, "Overview must be a native downloadable PDF")
    check(pdf.read_bytes().startswith(b"%PDF-") and pdf.stat().st_size > 1000, "Overview PDF is empty or invalid")
    pdf_paths.add(pdf)
check(len(pdf_paths) == 1, "Overview buttons must point to the same project document")
for link in [*form_links, *email_links, *downloads]:
    check(bool(link.attrs.get("data-analytics-location")), "Every partnership action needs a reportable placement")
check(len([n for n in nodes if n.tag == "script" and "/js/analytics.js" in n.attrs.get("src", "")]) == 1,
      "Load the shared analytics controller once")
check(len([n for n in nodes if n.attrs.get("id") == "cookieyes"]) == 1, "Use the shared consent banner once")
topic = next((n for n in home.walk() if n.tag == "select" and n.attrs.get("name") == "topic"), None)
check(topic is not None and any(n.tag == "option" and n.attrs.get("value") == "partnership" for n in topic.walk()),
      "The existing contact form must expose the prefilled partnership topic")

# Check every delivered static header/footer and the fetched homepage fragments.
pages = [*ROOT.glob("*.html"), *(ROOT / "uk").glob("*.html"), PAGE]
nav_count = footer_count = 0
for path in pages:
    delivered = parse(path.read_text(encoding="utf-8"))
    for node in delivered.walk():
        if not (node.has_class("header-nav") or node.has_class("footer")):
            continue
        partners = [n for n in node.walk() if n.tag == "a" and n.attrs.get("href") == "/partners/"]
        check(len(partners) == 1 and partners[0].text() == "Partnerships", f"{path.relative_to(ROOT)}: missing or duplicate Partnerships navigation")
        for link in (n for n in node.walk() if n.tag == "a" and n.attrs.get("href")):
            target = local_path(path, link.attrs["href"])
            check(target is None or target.is_file(), f"{path.relative_to(ROOT)}: broken menu/footer destination {link.attrs['href']}")
        nav_count += node.has_class("header-nav")
        footer_count += node.has_class("footer")
about = next(n for n in home.walk() if n.attrs.get("id") == "about")
check(any(n.tag == "a" and n.attrs.get("href") == "/partners/" for n in about.walk()), "Homepage studio block must link directly to Partnerships")
check(nav_count > 2 and footer_count > 2, "Static navigation checks must cover generated and shared components")
print(f"Partnerships checks passed: crawlable copy, nested assets, video, {len(screenshots)} screenshots, PDF, contact journeys, analytics hooks and {nav_count} menus/{footer_count} footers.")
