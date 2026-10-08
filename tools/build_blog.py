"""Build English/Ukrainian blog HTML, metadata and sitemap with Python's stdlib.

Edit blog/posts.json and blog/content/*.html, then run python tools/build_blog.py.
The generated HTML is committed so hosting does not need a server or build runtime.
"""
import argparse
import hashlib
import json
import math
import re
import struct
import xml.etree.ElementTree as ET
from datetime import date
from html import escape
from pathlib import Path
from urllib.parse import unquote, urlsplit

from html_tree import Node, parse, remove_where, set_text

ROOT = Path(__file__).resolve().parents[1]
BOGDAN_PROFILE_URL = "https://www.linkedin.com/in/bogdan-kagitin-84bb06127/"
GAME_SOCIAL_URL = "https://x.com/Lumen_Grove"
COPY = {
    "en": {"blog": "Blog", "skip": "Skip to content", "breadcrumb": "Breadcrumb",
           "content": "Article content", "toc": "In this article", "related": "Keep reading",
           "back": "All blog posts", "minutes": "{n} min read", "posts": "Blog posts",
           "intro": "Stories from Lumen Grove — development notes, cozy game design and the lore of our magical forest."},
    "uk": {"blog": "Блог", "skip": "Перейти до вмісту", "breadcrumb": "Навігаційний шлях",
           "content": "Текст статті", "toc": "У цій статті", "related": "Читайте далі",
           "back": "Усі дописи блогу", "minutes": "{n} хв читання", "posts": "Дописи блогу",
           "intro": "Історії Lumen Grove — нотатки розробників, дизайн затишних ігор і лор нашого чарівного лісу."},
}
FOOTER_UK = {
    "Creating magical gaming experiences that teleport players to enchanting worlds filled with wonder and adventure.": "Створюємо чарівні ігрові світи, сповнені див, пригод і затишку.",
    "Contact": "Контакти", "Email:": "Пошта:", "Follow Us": "Стежте за нами",
    "Legal": "Правова інформація", "Terms of Service": "Умови користування",
    "Privacy Policy": "Політика приватності", "Language": "Мова",
    "Show the web site in:": "Мова сайту:",
    "© 2025 Points Game Studio. All rights reserved.": "© 2025 Points Game Studio. Усі права захищено.",
}


def e(text):
    return escape(str(text), quote=True)


def page_url(slug, language):
    return ("uk/" if language == "uk" else "") + slug + ".html"


def date_label(value, language):
    parts = list(map(int, value.split("-")))
    months = (["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
              if language == "en" else
              ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"])
    if len(parts) == 2:
        if language == "uk":
            return ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"][parts[1]-1] + " " + str(parts[0])
        return months[parts[1]-1] + " " + str(parts[0])
    return (f"{months[parts[1]-1]} {parts[2]}, {parts[0]}" if language == "en" else
            f"{parts[2]} {months[parts[1]-1]} {parts[0]}")


def localize(tree, language, strings):
    # Only the known translation resources are interpreted as markup.
    def visit(node):
        key = node.attrs.pop("data-i18n", None)
        if language == "uk" and key:
            if key not in strings:
                raise ValueError(f"Missing Ukrainian translation: {key}")
            value = strings[key]
            node.children = parse(value).children if re.search(r"<[a-z][\s\S]*?>", value, re.I) else [Node(data=escape(value))]
        for child in node.children:
            visit(child)
    visit(tree)


def image_dimensions(path):
    # Small assets absent from the optimization manifest can still reserve space.
    data = path.read_bytes()
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return struct.unpack(">II", data[16:24])
    raise ValueError(f"Image requires dimensions in blog/media.json: {path}")


def process_images(tree, media, prefix, eager=False):
    for img in (n for n in tree.walk() if n.tag == "img"):
        original = unquote(img.attrs.get("src", ""))
        if not original or urlsplit(original).scheme:
            continue
        info = media.get(original)
        if info:
            img.attrs.update(src=prefix + info["src"], width=str(info["width"]), height=str(info["height"]))
            if info.get("srcset"):
                img.attrs["srcset"] = ", ".join(prefix + entry.strip() for entry in info["srcset"].split(","))
                img.attrs["sizes"] = info.get("sizes", "(max-width: 840px) calc(100vw - 32px), 800px")
            img.attrs["data-full-src"] = prefix + info.get("fullsrc", info["src"])
        else:
            width, height = image_dimensions(ROOT / original)
            img.attrs.update(src=prefix + original, width=str(width), height=str(height))
        img.attrs["loading"] = "eager" if eager else "lazy"
        img.attrs["decoding"] = "async"
        if eager:
            img.attrs["fetchpriority"] = "high"
        img.attrs.pop("onerror", None)


def rewrite_links(tree, prefix, slugs):
    for node in tree.walk():
        if node.attrs.get("target") == "_blank":
            node.attrs["rel"] = "noopener noreferrer"
        for attribute in ("href", "src"):
            value = node.attrs.get(attribute, "")
            if not value or value.startswith(("#", "/", "../", "http:", "https:", "mailto:", "data:")):
                continue
            if attribute == "src" and node.tag == "img":
                continue  # handled with dimensions and responsive variants
            path = value.split("#")[0]
            # Managed article links stay in the current language directory.
            if path.removesuffix(".html") in slugs or path == "devlog.html":
                continue
            node.attrs[attribute] = prefix + value


def header_footer(language, slug, media, slugs):
    prefix = "../" if language == "uk" else ""
    header = parse((ROOT / "header.html").read_text(encoding="utf-8"))
    footer = parse((ROOT / "footer.html").read_text(encoding="utf-8"))
    for node in header.walk():
        if node.tag == "nav":
            node.attrs["aria-label"] = "Main navigation" if language == "en" else "Основна навігація"
        if node.tag == "a" and node.attrs.get("href") == "devlog.html":
            set_text(node, COPY[language]["blog"])
            node.attrs["aria-current"] = "page"
        if language == "uk" and node.tag == "a" and node.text().strip() == "About Us":
            set_text(node, "Про нас")
        if language == "uk" and node.tag == "a" and node.attrs.get("href") == "press-kit.html":
            set_text(node, "Для преси")
        if node.tag == "img":
            node.attrs["alt"] = ""
    if language == "uk":
        for node in footer.walk():
            if node.has_class("footer-bottom"):
                for paragraph in node.children:
                    if paragraph.tag == "p":
                        set_text(paragraph, FOOTER_UK["© 2025 Points Game Studio. All rights reserved."])
        for node in footer.walk():
            if not node.tag and node.data.strip():
                value = node.text().strip()
                if value in FOOTER_UK:
                    node.data = escape(FOOTER_UK[value])
    for control in footer.walk():
        if control.attrs.get("id") in ("switch-to-en", "switch-to-ua"):
            target = "en" if control.attrs["id"] == "switch-to-en" else "uk"
            control.attrs["href"] = ("../" + slug + ".html" if language == "uk" and target == "en" else
                                       "uk/" + slug + ".html" if language == "en" and target == "uk" else slug + ".html")
            if target == language:
                control.attrs["aria-current"] = "page"
                control.attrs["class"] = "lang-switcher active"
    rewrite_links(header, prefix, slugs)
    rewrite_links(footer, prefix, slugs)
    process_images(header, media, prefix)
    for image in (n for n in header.walk() if n.tag == "img"):
        image.attrs["loading"] = "eager"
    return header.html(), footer.html()


def organization(site_url):
    return {"@type": "Organization", "@id": site_url + "/#organization", "name": "Points Game Studio",
            "url": site_url + "/", "logo": {"@type": "ImageObject", "url": site_url + "/images/new_logo_points.png"}}


def author_block(post, author, language, media, prefix):
    """Keep the original author identity and public links beside the article."""
    studio = post["author"] == "studio"
    avatar_src = "images/new_logo_points.png" if studio else "images/ava.jpg"
    avatar = parse(f'<img class="news-author-avatar" src="{avatar_src}" alt="">')
    process_images(avatar, media, prefix)
    for node in avatar.walk():
        if node.tag == "img":
            node.attrs["loading"] = "eager"
            node.attrs["sizes"] = "64px"
    role = ("Ігрова студія" if studio else "Розробник ігор") if language == "uk" else ("Game Studio" if studio else "Game Developer")
    label = ("Про студію" if studio else "Про автора") if language == "uk" else ("About the studio" if studio else "About the author")
    links_label = "Посилання автора та гри" if language == "uk" else "Author and game links"
    profile_attrs = 'rel="author"' if studio else 'target="_blank" rel="author noopener noreferrer"'
    links = [(GAME_SOCIAL_URL, "Twitter/X — @Lumen_Grove", "images/soc-media-logo/x-logo.png")]
    # Keep the additional game social link from the long cozy-games article.
    if post["slug"] == "news_6":
        links.append(("https://www.tiktok.com/@lumen_grove", "TikTok — @lumen_grove", "images/soc-media-logo/tik-tok-logo.png"))
    if not studio:
        links.append((author["url"], f'LinkedIn — {author["name"]}', "images/soc-media-logo/linked in logo.png"))
    social = []
    for url, text, icon_src in links:
        icon = parse(f'<img class="news-author-icon" src="{e(icon_src)}" alt="" aria-hidden="true">')
        process_images(icon, media, prefix)
        for node in icon.walk():
            if node.tag == "img":
                node.attrs.update(loading="eager", sizes="32px")
        social.append(f'<a class="news-author-link" href="{e(url)}" target="_blank" rel="noopener noreferrer" '
                      f'aria-label="{e(text)}" title="{e(text)}">{icon.html()}</a>')
    return f'''<aside class="news-author-section" aria-label="{e(label)}">
                <a class="news-author-profile" href="{e(author["url"])}" {profile_attrs}>
                    {avatar.html()}<div class="news-author-info">
                        <p class="news-author-name">{e(author["name"])}</p>
                        <p class="news-author-title">{e(role)}</p>
                    </div>
                </a>
                <nav class="news-author-links" aria-label="{e(links_label)}">{"".join(social)}</nav>
            </aside>'''


def head(title, description, slug, language, image, schema, site_url):
    prefix = "../" if language == "uk" else ""
    url = site_url + "/" + page_url(slug, language)
    og_locale = "uk_UA" if language == "uk" else "en_US"
    return f'''    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{e(title)}</title>
    <meta name="description" content="{e(description)}">
    <link rel="canonical" href="{url}">
    <link rel="alternate" hreflang="en" href="{site_url}/{page_url(slug, 'en')}">
    <link rel="alternate" hreflang="uk" href="{site_url}/{page_url(slug, 'uk')}">
    <link rel="alternate" hreflang="x-default" href="{site_url}/{page_url(slug, 'en')}">
    <meta property="og:title" content="{e(title)}">
    <meta property="og:description" content="{e(description)}">
    <meta property="og:type" content="{'website' if slug == 'devlog' else 'article'}">
    <meta property="og:url" content="{url}">
    <meta property="og:image" content="{site_url}/{image}">
    <meta property="og:locale" content="{og_locale}">
    <meta property="og:site_name" content="Points Game Studio">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{e(title)}">
    <meta name="twitter:description" content="{e(description)}">
    <meta name="twitter:image" content="{site_url}/{image}">
    <link rel="icon" type="image/png" href="{prefix}images/favicon_points.png">
    <link rel="stylesheet" href="{prefix}css/news.css">
    <link rel="stylesheet" href="{prefix}css/header.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Roboto+Serif:wght@400;600&display=swap" rel="stylesheet">
    <script type="application/ld+json">{json.dumps(schema, ensure_ascii=False).replace('</', '<\\/')}</script>
    <script id="cookieyes" src="https://cdn-cookieyes.com/client_data/e6ba3bfedc57c067fa59e14b/script.js"></script>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-RSXV2Q3WG2"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-RSXV2Q3WG2');</script>'''


def fill_template(path, values):
    result = path.read_text(encoding="utf-8")
    for key, value in values.items():
        result = result.replace("{{" + key + "}}", str(value))
    if re.search(r"{{[a-z_]+}}", result):
        raise ValueError(f"Unfilled template variable in {path}")
    # Asset versions follow file contents, so publishing new CSS/JS refreshes
    # browser caches without changing URLs or metadata for the articles.
    for asset in ("css/news.css", "css/header.css", "js/locale.js", "js/news.js",
                  "js/particles-bg.js", "js/reading-progress.js"):
        url = values["prefix"] + asset
        version = hashlib.sha256((ROOT / asset).read_bytes()).hexdigest()[:12]
        result = result.replace('="' + url + '"', '="' + url + '?v=' + version + '"')
    return "\n".join(line.rstrip() for line in result.splitlines()) + "\n"


def write_generated(path, text):
    changed = not path.exists() or path.read_text(encoding="utf-8") != text
    if changed:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    return changed


def content_for(post, language, strings, media, slugs, image_labels):
    tree = parse((ROOT / "blog/content" / (post["slug"] + ".html")).read_text(encoding="utf-8"))
    remove_where(tree, lambda n: n.has_class("article-footer-meta") or n.has_class("news-article-heading") or
                 (post["slug"] == "pillar_1" and n.tag == "img" and n.attrs.get("src") == post["cover"]))
    localize(tree, language, strings)
    headings = []
    used_ids = {n.attrs["id"] for n in tree.walk() if n.attrs.get("id")}
    for node in tree.walk():
        if node.tag == "img":
            alt = node.attrs.get("alt", "")
            if alt == "Google Play":
                node.attrs["alt"] = ""  # Adjacent CTA text already names the store.
            elif language == "uk" and alt:
                if alt not in image_labels:
                    raise ValueError(f"Missing Ukrainian image label: {alt}")
                node.attrs["alt"] = image_labels[alt]
        if node.tag == "h2":
            label = " ".join(node.text().split())
            if not node.attrs.get("id"):
                candidate = re.sub(r"[^\w]+", "-", label.lower()).strip("-") or "section"
                base = candidate
                counter = 2
                while candidate in used_ids:
                    candidate = base + "-" + str(counter)
                    counter += 1
                node.attrs["id"] = candidate
                used_ids.add(candidate)
            headings.append((node.attrs["id"], label))
        if node.tag == "iframe":
            node.attrs["loading"] = "lazy"
            if language == "uk" and node.attrs.get("title") == "Lumen Grove Weather":
                node.attrs["title"] = "Погода у Lumen Grove"
        if node.has_class("reveal"):
            node.attrs["class"] = " ".join(c for c in node.attrs["class"].split() if c != "reveal")
    process_images(tree, media, "../" if language == "uk" else "")
    rewrite_links(tree, "../" if language == "uk" else "", slugs)
    words = len(re.findall(r"\b[\w’'-]+\b", tree.text(), re.UNICODE))
    return tree.html(), headings, max(1, math.ceil(words / 200))


def card(post, language, minutes, related=False):
    label = COPY[language]
    return f'''<a class="{'related-card' if related else 'devlog-card'}" href="{post['slug']}.html">
        <div class="devlog-card-meta"><span class="devlog-card-badge">{e(post['kind'][language])}</span>
        <time datetime="{post['date']}">{e(date_label(post['date'], language))}</time><span>{e(label['minutes'].format(n=minutes))}</span></div>
        <{'h3' if related else 'h2'} class="devlog-card-title">{e(post['title'][language])}</{'h3' if related else 'h2'}>
        <p class="devlog-card-excerpt">{e(post['summary'][language])}</p></a>'''


def build(modified_date):
    config = json.loads((ROOT / "blog/posts.json").read_text(encoding="utf-8"))
    posts, site_url = config["posts"], config["site_url"].rstrip("/")
    strings = json.loads((ROOT / "js/locales/ua.json").read_text(encoding="utf-8"))
    media = json.loads((ROOT / "blog/media.json").read_text(encoding="utf-8"))
    image_labels = json.loads((ROOT / "blog/image-labels.json").read_text(encoding="utf-8"))
    slugs = {post["slug"] for post in posts}
    if len(slugs) != len(posts):
        raise ValueError("Duplicate post slug")
    for post in posts:
        if not re.fullmatch(r"[a-z0-9_-]+", post["slug"]):
            raise ValueError("Unsafe post slug")
        for field in ("title", "seo_title", "description", "summary", "kind", "cover_alt"):
            if any(not post.get(field, {}).get(language) for language in COPY):
                raise ValueError(f"Missing translated {field}: {post['slug']}")
    generated = []
    pending_outputs = {}
    changed_pages = set()
    for language, label in COPY.items():
        prefix = "../" if language == "uk" else ""
        prepared = {post["slug"]: content_for(post, language, strings, media, slugs, image_labels) for post in posts}
        for post in posts:
            slug = post["slug"]
            content, headings, minutes = prepared[slug]
            header, footer = header_footer(language, slug, media, slugs)
            cover_tree = parse(f'<figure class="article-cover"><img src="{e(post["cover"])}" alt="{e(post["cover_alt"][language])}"></figure>')
            process_images(cover_tree, media, prefix, eager=True)
            cover_info = media[post["cover"]]
            image = cover_info.get("ogsrc", cover_info["src"])
            org = organization(site_url)
            person = {"@type": "Person", "@id": site_url + "/#bogdan", "name": "Bogdan",
                      "url": BOGDAN_PROFILE_URL, "jobTitle": "Game Developer"}
            author = org if post["author"] == "studio" else person
            url = site_url + "/" + page_url(slug, language)
            article = {"@type": "Article", "@id": url + "#article", "url": url,
                       "mainEntityOfPage": url, "headline": post["title"][language],
                       "description": post["description"][language], "image": site_url + "/" + image,
                       "inLanguage": language, "author": {"@id": author["@id"]},
                       "publisher": {"@id": org["@id"]}, "isPartOf": {"@type": "Blog", "name": label["blog"], "url": site_url + "/" + page_url("devlog", language)}}
            if len(post["date"]) == 10:
                article["datePublished"] = post["date"]
            breadcrumbs = {"@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": label["blog"], "item": site_url + "/" + page_url("devlog", language)},
                {"@type": "ListItem", "position": 2, "name": post["title"][language], "item": url}]}
            schema = {"@context": "https://schema.org", "@graph": [org, person, article, breadcrumbs]}
            toc = ""
            if post.get("long_read"):
                links = "".join(f'<li><a href="#{e(id_)}">{e(text)}</a></li>' for id_, text in headings)
                toc = f'<nav class="article-toc" aria-label="{e(label["toc"])}"><details open><summary>{e(label["toc"])}</summary><ol>{links}</ol></details></nav>'
            others = [p for p in posts if p["slug"] != slug][:2]
            related = f'<nav class="related-articles" aria-label="{e(label["related"])}"><h2>{e(label["related"])}</h2><div class="related-grid">' + "".join(
                card(p, language, prepared[p["slug"]][2], True) for p in others) + f'</div><a class="back-to-blog" href="devlog.html">← {e(label["back"])}</a></nav>'
            values = {"language": language, "head": head(post["seo_title"][language], post["description"][language], slug, language, image, schema, site_url),
                      "skip_label": e(label["skip"]), "header": header, "footer": footer, "blog_url": "devlog.html", "blog_label": e(label["blog"]),
                      "breadcrumb_label": e(label["breadcrumb"]), "kind": e(post["kind"][language]), "title": e(post["title"][language]),
                      "summary": e(post["summary"][language]), "author_block": author_block(post, author, language, media, prefix),
                      "date": post["date"], "date_label": e(date_label(post["date"], language)), "reading_time": e(label["minutes"].format(n=minutes)),
                      "cover": cover_tree.html(), "toc": toc, "content": content, "content_label": e(label["content"]), "related": related, "prefix": prefix,
                      "progress": ' data-reading-progress' if post.get("long_read") else "",
                      "progress_script": f'<script src="{prefix}js/reading-progress.js" defer></script>' if post.get("long_read") else ""}
            output = ROOT / page_url(slug, language)
            relative = output.relative_to(ROOT).as_posix()
            pending_outputs[relative] = fill_template(ROOT / "blog/article-template.html", values)
            generated.append(relative)
        header, footer = header_footer(language, "devlog", media, slugs)
        list_title = "Lumen Grove Blog | Points Game Studio" if language == "en" else "Блог Lumen Grove — Points Game Studio"
        list_schema = {"@context": "https://schema.org", "@graph": [organization(site_url),
            {"@type": "CollectionPage", "url": site_url + "/" + page_url("devlog", language), "name": list_title, "inLanguage": language},
            {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i+1, "url": site_url + "/" + page_url(p["slug"], language), "name": p["title"][language]} for i, p in enumerate(posts)]}]}
        list_image = media[posts[0]["cover"]].get("ogsrc", media[posts[0]["cover"]]["src"])
        values = {"language": language, "head": head(list_title, label["intro"], "devlog", language, list_image, list_schema, site_url), "prefix": prefix,
                  "header": header, "footer": footer, "skip_label": e(label["skip"]), "blog_label": e(label["blog"]), "intro": e(label["intro"]),
                  "posts_label": e(label["posts"]), "cards": "\n".join(card(p, language, prepared[p["slug"]][2]) for p in posts)}
        output = ROOT / page_url("devlog", language)
        relative = output.relative_to(ROOT).as_posix()
        pending_outputs[relative] = fill_template(ROOT / "blog/list-template.html", values)
        generated.append(relative)
    # Finish both languages before touching any generated page. Missing translations
    # or assets must not leave English/Ukrainian outputs on different revisions.
    ET.parse(ROOT / "sitemap.xml")
    for relative, html in pending_outputs.items():
        if write_generated(ROOT / relative, html):
            changed_pages.add(relative)
    build_sitemap(generated, changed_pages, site_url, modified_date)
    print(f"Built {len(generated)} static English/Ukrainian pages and sitemap.xml")


def build_sitemap(generated, changed_pages, site_url, modified_date):
    namespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
    xhtml = "http://www.w3.org/1999/xhtml"
    ET.register_namespace("", namespace)
    ET.register_namespace("xhtml", xhtml)
    path = ROOT / "sitemap.xml"
    tree = ET.parse(path)
    root = tree.getroot()
    managed = set(generated)
    previous_dates = {}
    for entry in list(root):
        location = entry.find("{" + namespace + "}loc")
        relative = location.text.removeprefix(site_url + "/") if location is not None else ""
        if relative in managed:
            previous_date = entry.find("{" + namespace + "}lastmod")
            if previous_date is not None:
                previous_dates[relative] = previous_date.text
            root.remove(entry)
    for relative in generated:
        url = ET.SubElement(root, "{" + namespace + "}url")
        ET.SubElement(url, "{" + namespace + "}loc").text = site_url + "/" + relative
        ET.SubElement(url, "{" + namespace + "}lastmod").text = (
            modified_date if relative in changed_pages else previous_dates.get(relative, modified_date))
        slug = Path(relative).stem
        for language in COPY:
            ET.SubElement(url, "{" + xhtml + "}link", {"rel": "alternate", "hreflang": language, "href": site_url + "/" + page_url(slug, language)})
    ET.indent(tree, space="  ")
    tree.write(path, encoding="utf-8", xml_declaration=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--modified-date", default=date.today().isoformat(),
                        help="ISO date for pages changed by this build; unchanged pages keep their lastmod")
    args = parser.parse_args()
    date.fromisoformat(args.modified_date)
    build(args.modified_date)
