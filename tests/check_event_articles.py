"""Check delivered article isolation, decorative artwork and the cauldron media."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from html_tree import parse

manifest = json.loads((ROOT / "blog/posts.json").read_text(encoding="utf-8"))
themed = set()
for post in manifest["posts"]:
    if not post.get("event_theme"):
        continue
    for language in post.get("languages", ["en", "uk"]):
        slug = post.get("url_slugs", {}).get(language, post["slug"])
        path = ROOT / ("uk/" if language == "uk" else "") / (slug + ".html")
        themed.add(path)
        tree = parse(path.read_text(encoding="utf-8"))
        body = tree.find("body")
        assert body.attrs.get("data-event-theme") == post["event_theme"], path
        assert "--event-background-start:" in body.attrs.get("style", ""), path
        decor = [node for node in tree.walk() if node.has_class("event-decoration")]
        assert decor, f"{path}: themed article has no artwork"
        for item in decor:
            image = item.find("img")
            assert item.attrs.get("aria-hidden") == "true" and image is not None, path
            assert image.attrs.get("alt") == "" and image.attrs.get("draggable") == "false", path
            assert not any(node.tag in {"a", "button"} for node in item.walk()), path
        if post["slug"] == "news_7":
            sections = {node.attrs.get("data-event-slot"): node for node in tree.walk() if node.tag == "section"}
            video = sections["activity"].find("iframe")
            assert video and "T8LnADoTubI" in video.attrs.get("src", ""), "Cauldron video is outside its section"
            assert sections["scenery"].find("iframe") is None, path
            galleries = [node for node in tree.walk() if node.has_class("swiper")]
            assert len(galleries) == 2, "Expected separate grove and decoration galleries"
            assert sum(node.tag == "img" for gallery in galleries for node in gallery.walk()) >= 9, path
            assert all("decor_sprite" not in node.attrs.get("src", "").lower()
                       for gallery in galleries for node in gallery.walk() if node.tag == "img"), path

count = 0
for path in [*ROOT.glob("*.html"), *(ROOT / "uk").glob("*.html"), ROOT / "partners/index.html"]:
    source = path.read_text(encoding="utf-8")
    tree = parse(source)
    sheets = [node for node in tree.walk() if node.tag == "link" and "css/event-article.css" in node.attrs.get("href", "")]
    assert len(sheets) == (1 if path in themed else 0), f"Theme stylesheet leaked: {path}"
    if path not in themed:
        assert "data-event-theme=" not in source and "event-decoration--" not in source, path
    count += 1
print(f"Event articles passed: {len(themed)} themed pages; {count - len(themed)} other pages remain unthemed; galleries and video verified.")
