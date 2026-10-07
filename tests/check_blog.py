#!/usr/bin/env python3
"""Validate the generated English/Ukrainian blog without third-party packages.

Run after tools/build_blog.py: python tests/check_blog.py
Checks the HTML a crawler or a reader with JavaScript disabled receives.
"""

from __future__ import annotations

import argparse
from datetime import date, datetime
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import re
import sys
from urllib.parse import parse_qs, unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET


ARTICLE_TYPES = {"Article", "BlogPosting", "NewsArticle"}


class Page(HTMLParser):
    def __init__(self, path: Path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.source = path.read_text(encoding="utf-8")
        self.elements: list[tuple[str, dict[str, str | None]]] = []
        self.ids: set[str] = set()
        self.duplicate_ids: set[str] = set()
        self.titles: list[str] = []
        self.headings: list[str] = []
        self.reading_times: list[str] = []
        self.schemas: list[str] = []
        self.content_text: list[str] = []
        self._content_section_depth = 0
        self._capture: str | None = None
        self._buffer: list[str] = []
        self.feed(self.source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        if tag == "section":
            if "news-content" in (attrs.get("class") or "").split():
                self._content_section_depth = 1
            elif self._content_section_depth:
                self._content_section_depth += 1
        if attrs.get("id"):
            if attrs["id"] in self.ids:
                self.duplicate_ids.add(attrs["id"])
            self.ids.add(attrs["id"])
        if tag in {"title", "h1"} or (tag == "script" and attrs.get("type") == "application/ld+json"):
            self._capture = tag if tag in {"title", "h1"} else "schema"
            self._buffer = []
        elif tag == "span" and "reading-time" in (attrs.get("class") or "").split():
            self._capture = "reading-time"
            self._buffer = []

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_data(self, data):
        if self._content_section_depth:
            self.content_text.append(data)
        if self._capture:
            self._buffer.append(data)

    def handle_endtag(self, tag):
        if tag == "section" and self._content_section_depth:
            self._content_section_depth -= 1
        if tag == "title" and self._capture == "title":
            self.titles.append("".join(self._buffer).strip())
            self._capture = None
        elif tag == "h1" and self._capture == "h1":
            self.headings.append(" ".join("".join(self._buffer).split()))
            self._capture = None
        elif tag == "span" and self._capture == "reading-time":
            self.reading_times.append("".join(self._buffer).strip())
            self._capture = None
        elif tag == "script" and self._capture == "schema":
            self.schemas.append("".join(self._buffer))
            self._capture = None

    def tags(self, name):
        return [attrs for tag, attrs in self.elements if tag == name]

    def meta(self, name):
        return [attrs.get("content", "") for attrs in self.tags("meta")
                if attrs.get("name") == name or attrs.get("property") == name]

    def links(self, rel):
        return [attrs for attrs in self.tags("link") if rel in (attrs.get("rel") or "").split()]


def schema_nodes(value):
    if isinstance(value, list):
        for item in value:
            yield from schema_nodes(item)
    elif isinstance(value, dict):
        yield value
        if "@graph" in value:
            yield from schema_nodes(value["@graph"])


def types(node):
    value = node.get("@type", [])
    return {value} if isinstance(value, str) else set(value)


def iso_date(value, allow_month=True):
    if not isinstance(value, str):
        return False
    try:
        if allow_month and re.fullmatch(r"\d{4}-\d{2}", value):
            return 1 <= int(value[-2:]) <= 12
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            date.fromisoformat(value)
        else:
            datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def local_target(root, page_path, href, site_url):
    page_url = urljoin(site_url, page_path.relative_to(root).as_posix())
    url = urlsplit(urljoin(page_url, href))
    if url.scheme not in {"http", "https"} or url.hostname != urlsplit(site_url).hostname:
        return None
    relative = unquote(url.path).lstrip("/")
    target = root / relative
    if not relative or url.path.endswith("/"):
        target /= "index.html"
    return target, unquote(url.fragment)


def validate(root: Path):
    errors = []
    cache = {}
    all_titles = {}

    def check(condition, path, message):
        if not condition:
            errors.append(f"{path.relative_to(root).as_posix()}: {message}")

    def read(path):
        if path not in cache:
            cache[path] = Page(path)
        return cache[path]

    manifest_path = root / "blog/posts.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        posts = manifest["posts"]
        site_url = manifest["site_url"].rstrip("/") + "/"
        names = [post["slug"] for post in posts]
    except (OSError, ValueError, KeyError, TypeError) as error:
        check(False, manifest_path, f"cannot read managed posts manifest: {error}")
        return errors, 0
    check(bool(posts), manifest_path, "posts manifest must contain at least one published article")
    check(len(set(names)) == len(names), manifest_path, "post slugs must be unique")
    check(all(re.fullmatch(r"[a-z0-9_-]+", name) and name != "devlog" for name in names),
          manifest_path, "post slugs must be safe and must not replace the blog listing")
    check(urlsplit(site_url).scheme == "https" and bool(urlsplit(site_url).netloc),
          manifest_path, "site_url must be an absolute HTTPS origin")
    if errors:
        return errors, 0
    posts_by_name = {post["slug"] + ".html": post for post in posts}
    page_names = ["devlog.html", *posts_by_name]
    expected_paths = [root / prefix / name for prefix in ("", "uk") for name in page_names]

    for path in expected_paths:
        if not path.is_file():
            check(False, path, "expected generated page is missing; run tools/build_blog.py")
            continue
        page = read(path)
        lang = "uk" if path.parent.name == "uk" else "en"
        relative = path.relative_to(root).as_posix()
        canonical_url = urljoin(site_url, relative)
        post = posts_by_name.get(path.name)
        check(len(page.titles) == 1 and bool(page.titles[0]), path, "requires one nonempty title")
        if page.titles:
            title = page.titles[0]
            check(not re.search(r"News Title|Your News Title|Lorem ipsum|Умови та положення|Terms and Conditions|Privacy Policy", title, re.I),
                  path, "title is a placeholder or unrelated legal-page title")
            check(title not in all_titles, path, f"duplicate title (also in {all_titles.get(title, '')})")
            all_titles[title] = relative
            if post:
                check(title == post["seo_title"][lang], path, "title must match the published language-specific SEO title")
        if post:
            check(page.headings == [post["title"][lang]], path, "H1 must match the manifest article title")
            check(page.meta("description") == [post["description"][lang]], path, "description must match the manifest language")
            cards = [(tag, attrs) for tag, attrs in page.elements
                     if "news-author-section" in (attrs.get("class") or "").split()]
            check(len(cards) == 1 and cards[0][0] in {"aside", "div"}, path, "requires one author card with separate profile and social links")
            profiles = [attrs for attrs in page.tags("a") if "news-author-profile" in (attrs.get("class") or "").split()]
            profile_url = site_url if post.get("author") == "studio" else "https://www.linkedin.com/in/bogdan-kagitin-84bb06127/"
            check(len(profiles) == 1 and profiles[0].get("href") == profile_url, path, "author profile must use the original studio/Bogdan URL")
            social = [attrs for attrs in page.tags("a") if "news-author-link" in (attrs.get("class") or "").split()]
            expected_social = {"https://x.com/Lumen_Grove"}
            if post["slug"] == "news_6":
                expected_social.add("https://www.tiktok.com/@lumen_grove")
            if post.get("author") != "studio":
                expected_social.add(profile_url)
            check({attrs.get("href") for attrs in social} == expected_social, path, "author card must include the author's LinkedIn and preserve public social URLs")
            for link in profiles + social:
                if link.get("target") == "_blank":
                    check({"noopener", "noreferrer"} <= set((link.get("rel") or "").split()),
                          path, "author links opening a new tab require noopener/noreferrer")
        check(len(page.tags("html")) == 1 and page.tags("html")[0].get("lang") == lang,
              path, f"html lang must be {lang}")
        check(len(page.tags("body")) == 1 and page.tags("body")[0].get("data-static-locale") == lang,
              path, "requires data-static-locale matching the generated language")
        check(len(page.tags("h1")) == 1, path, "requires exactly one H1")
        check(len(page.tags("main")) == 1, path, "requires exactly one main landmark")
        check(not page.duplicate_ids, path, f"duplicate element ids: {sorted(page.duplicate_ids)}")
        for meta in ("description", "og:title", "og:description", "og:image", "og:url", "og:type", "twitter:card"):
            values = page.meta(meta)
            check(len(values) == 1 and bool(values[0].strip()), path, f"requires one nonempty {meta}")
        check(page.meta("og:url") == [canonical_url], path, "og:url must match canonical URL")
        canonical = page.links("canonical")
        check(len(canonical) == 1 and canonical[0].get("href") == canonical_url,
              path, f"canonical must be {canonical_url}")
        check(not any("noindex" in value.lower() for value in page.meta("robots")),
              path, "active blog page must not be noindex")

        alternates = {item.get("hreflang"): item.get("href") for item in page.links("alternate")}
        for language in ("en", "uk"):
            counterpart = urljoin(site_url, ("uk/" if language == "uk" else "") + path.name)
            check(alternates.get(language) == counterpart, path, f"requires reciprocal {language} alternate: {counterpart}")
            switches = [attrs for attrs in page.tags("a") if attrs.get("id") == ("switch-to-ua" if language == "uk" else "switch-to-en")]
            check(len(switches) == 1 and urljoin(canonical_url, switches[0].get("href") or "") == counterpart,
                  path, f"native language link must point to {language} counterpart before JavaScript runs")

        nodes = []
        check(bool(page.schemas), path, "requires JSON-LD schema")
        for schema in page.schemas:
            try:
                nodes.extend(schema_nodes(json.loads(schema)))
            except json.JSONDecodeError as error:
                check(False, path, f"invalid JSON-LD: {error}")
        articles = [node for node in nodes if types(node) & ARTICLE_TYPES]
        nodes_by_id = {node["@id"]: node for node in nodes if node.get("@id")}
        if path.name == "devlog.html":
            check(any(types(node) & {"CollectionPage", "Blog", "ItemList"} for node in nodes),
                  path, "blog listing requires a collection/blog/list schema")
        else:
            check(bool(articles), path, "requires Article or BlogPosting schema")
            for article in articles:
                check(bool(article.get("headline")) and bool(article.get("image")), path, "article schema requires headline/image")
                check(article.get("headline") in page.headings, path, "schema headline must match the visible H1")
                check(article.get("url") == canonical_url, path, "article schema URL must match canonical")
                authors = article.get("author", [])
                if isinstance(authors, dict):
                    authors = [authors]
                authors = [nodes_by_id.get(author.get("@id"), author) if isinstance(author, dict) else author for author in authors]
                author_types = {"Organization"} if post.get("author") == "studio" else {"Person"}
                check(bool(authors) and all(isinstance(author, dict) and types(author) & author_types and author.get("name") and
                                           (author.get("url") or author.get("sameAs")) for author in authors),
                      path, "visible author requires a named, correctly typed entity with identifying URL in schema")
                publisher = article.get("publisher", {})
                if isinstance(publisher, dict):
                    publisher = nodes_by_id.get(publisher.get("@id"), publisher)
                check(isinstance(publisher, dict) and "Organization" in types(publisher) and publisher.get("name"),
                      path, "publisher requires a named Organization in the page schema graph")
                known_date = post.get("date")
                check(iso_date(known_date), path, "manifest publication date must be a valid ISO date/month")
                if isinstance(known_date, str) and len(known_date) == 10:
                    check(iso_date(article.get("datePublished"), allow_month=False) and article.get("datePublished") == known_date,
                          path, "article publication date must match its known exact manifest date")
                else:
                    check("datePublished" not in article, path, "do not invent an exact publication day when only a month is known")
                if "dateModified" in article:
                    check(iso_date(article["dateModified"]), path, "dateModified must be valid ISO date/month")

        times = page.tags("time")
        check(bool(times) and all(iso_date(item.get("datetime")) for item in times),
              path, "visible dates require valid time datetime values (known months are allowed)")
        if post:
            check(bool(times) and times[0].get("datetime") == post.get("date"),
                  path, "visible byline date must match the manifest publication date")
        if post and post.get("long_read"):
            # Compare the estimate with the visible essay, allowing ordinary
            # reading speeds rather than a slug-specific expected number.
            words = len(re.findall(r"\b[\w’'-]+\b", "".join(page.content_text), re.UNICODE))
            lower, upper = max(1, math.ceil(words / 250)), max(1, math.ceil(words / 150)) + 1
            estimates = [re.search(r"\d+", value) for value in page.reading_times]
            check(bool(estimates) and all(match and lower <= int(match.group()) <= upper for match in estimates),
                  path, f"long-read estimate must be reasonable for {words} visible words ({lower}–{upper} minutes)")
            check(any("article-toc" in (nav.get("class") or "").split() for nav in page.tags("nav")),
                  path, "long reads require a native table of contents")
            check(any("data-reading-progress" in article for article in page.tags("article")),
                  path, "long reads require the reading-progress hook")
        for image in page.tags("img"):
            src = image.get("src") or ""
            check("alt" in image, path, f"image is missing alt: {src}")
            check(all(re.fullmatch(r"[1-9]\d*", image.get(dimension) or "") for dimension in ("width", "height")),
                  path, f"image needs positive width and height to reserve layout space: {src}")
        check(not re.search(r"swiper(?:-bundle)?(?:\.min)?\.(?:js|css)|new\s+Swiper\b", page.source, re.I),
              path, "article/list should not load Swiper")
        particle_scripts = [script for script in page.tags("script")
                            if urlsplit(script.get("src") or "").path.endswith("particles-bg.js")]
        expected_particles = ("../" if lang == "uk" else "") + "js/particles-bg.js"
        check(len(particle_scripts) == 1 and urlsplit(particle_scripts[0].get("src") or "").path == expected_particles and
              "defer" in particle_scripts[0], path, "requires one deferred local calm-particles script in the current language directory")
        check(not re.search(r"\binitFloatingParticles\w*\s*\(", page.source),
              path, "particle initialization belongs in the deferred script, not inline HTML")
        automatic_media = []
        for tag, attrs in page.elements:
            if tag in {"audio", "video"} and "autoplay" in attrs:
                automatic_media.append(tag)
            if tag == "iframe":
                query = parse_qs(urlsplit(attrs.get("src") or "").query)
                if "autoplay" in attrs or any(value.lower() in {"1", "true"} for value in query.get("autoplay", [])):
                    automatic_media.append("iframe")
        check(not automatic_media, path, "audio/video/iframe media must not autoplay on page load")
        check(not re.search(r"fetch\s*\(\s*['\"](?:header|footer)\.html", page.source),
              path, "header and footer must be present in source HTML")

        for tag, attrs in page.elements:
            references = []
            if tag in {"a", "link"} and attrs.get("href"):
                references.append(attrs["href"])
            if tag in {"img", "script", "iframe", "source", "video"} and attrs.get("src"):
                references.append(attrs["src"])
            if tag in {"img", "source"} and attrs.get("srcset"):
                references.extend(candidate.strip().rsplit(" ", 1)[0] for candidate in attrs["srcset"].split(","))
            for reference in references:
                local = local_target(root, path, reference, site_url)
                if local is None:
                    continue
                target, fragment = local
                check(target.is_file(), path, f"missing internal target: {reference}")
                if fragment and target.is_file() and target.suffix == ".html":
                    check(fragment in read(target).ids, path, f"missing internal fragment: {reference}")

    sitemap_path = root / "sitemap.xml"
    if sitemap_path.is_file():
        try:
            sitemap = ET.parse(sitemap_path)
            urls = {element.text for element in sitemap.iter() if element.tag.endswith("}loc")}
            for path in expected_paths:
                check(urljoin(site_url, path.relative_to(root).as_posix()) in urls, path, "active page is absent from sitemap")
        except ET.ParseError as error:
            check(False, sitemap_path, f"invalid sitemap XML: {error}")
    else:
        check(False, sitemap_path, "sitemap is missing")
    return errors, len(expected_paths)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    errors, count = validate(args.root.resolve())
    if errors:
        print("Blog validation failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print(f"Blog validation passed: {count} static EN/UK pages; metadata, schema, dates, assets and links.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
