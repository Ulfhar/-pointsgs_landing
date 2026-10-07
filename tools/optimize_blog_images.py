#!/usr/bin/env python3
"""Build deterministic responsive blog images without changing their originals.

Requires Pillow with WebP support. Run from any directory:
    python tools/optimize_blog_images.py
    python tools/optimize_blog_images.py --add images/new-story/cover.png

The previous manifest keeps original asset references after HTML is regenerated
with optimized URLs. New <img> references in the selected pages are discovered
automatically. Covers registered in blog/posts.json also receive a JPEG social
preview. Register the post and its original cover path before optimizing it.
The script writes only images/blog/* and blog/media.json.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

from PIL import Image, ImageOps, features


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PAGES = (
    "news_5.html", "news_6.html", "news_7.html", "pillar_1.html", "lore_1.html",
    "header.html", "footer.html",
)
EXTRA_IMAGES = (
    "images/ava.jpg", "images/new_logo_points.png", "images/favicon_points.png",
    "images/lumen-grove-mobile-banner.png",
)
SOCIAL_IMAGES = {
    "images/cozy-game-article-images/cozy-banner.png",
    "images/news_images/5/img_1.png",
    "images/halloween/h1.png",
    "images/news_images/lore_1/L_3.png",
    "images/lumen-grove-mobile-banner.png",
}
COMPACT_IMAGES = {
    "images/ava.jpg", "images/new_logo_points.png",
    "images/play-store-round-color-icon.png",
    "images/soc-media-logo/x-logo.png", "images/soc-media-logo/tik-tok-logo.png",
    "images/soc-media-logo/linked in logo.png",
}
PASSTHROUGH_IMAGES = {"images/favicon_points.png"}
HERO_IMAGES = {"images/cozy-game-article-images/cozy-banner.png"}
BODY_SIZES = "(max-width: 767px) calc(100vw - 32px), 800px"


def local_image_path(value: str) -> str | None:
    """Normalize local image URLs, including percent-encoded spaces."""
    url = urlsplit(value)
    if url.scheme or url.netloc:
        return None
    name = unquote(url.path).replace("\\", "/").lstrip("/")
    while name.startswith("./"):
        name = name[2:]
    if not name.startswith("images/") or name.startswith("images/blog/"):
        return None
    resolved = (REPO_ROOT / name).resolve()
    try:
        resolved.relative_to(REPO_ROOT / "images")
    except ValueError:
        raise ValueError(f"Image path leaves the images directory: {value}")
    return resolved.relative_to(REPO_ROOT).as_posix()


class ImageReferences(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.paths: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "img":
            return
        src = dict(attrs).get("src")
        if src:
            normalized = local_image_path(src)
            if normalized:
                self.paths.add(normalized)


def post_cover_images() -> set[str]:
    """Discover current and future social-preview covers from the post manifest."""
    posts_path = REPO_ROOT / "blog/posts.json"
    if not posts_path.exists():
        return set()
    posts = json.loads(posts_path.read_text(encoding="utf-8"))
    covers: set[str] = set()
    for post in posts.get("posts", []):
        value = post.get("cover", "")
        normalized = local_image_path(value) if isinstance(value, str) else None
        if not normalized:
            raise ValueError(f"Post {post.get('slug', '(unknown)')} needs an original local cover under images/: {value}")
        covers.add(normalized)
    return covers


def asset_stem(path: str) -> str:
    # Keep names identical on Windows and POSIX hosts.
    descriptive = Path(path).with_suffix("").as_posix()
    descriptive = re.sub(r"[^a-z0-9]+", "-", descriptive.lower()).strip("-")
    digest = hashlib.sha256(path.encode("utf-8")).hexdigest()[:8]
    return f"{descriptive[:100]}-{digest}"


def variant_image(image: Image.Image, target_width: int) -> Image.Image:
    width = min(target_width, image.width)
    height = max(1, round(image.height * width / image.width))
    if (width, height) == image.size:
        return image.copy()
    return image.resize((width, height), Image.Resampling.LANCZOS)


def verify_output(path: Path, expected_size: tuple[int, int], expected_format: str) -> None:
    with Image.open(path) as check:
        check.load()
        if check.size != expected_size or check.format != expected_format:
            raise ValueError(f"Invalid generated image: {path}")


def save_webp(image: Image.Image, filename: str, quality: int) -> dict:
    output = REPO_ROOT / "images/blog" / filename
    image.save(output, "WEBP", quality=quality, method=6, exact=True)
    verify_output(output, image.size, "WEBP")
    return {
        "src": output.relative_to(REPO_ROOT).as_posix(),
        "width": image.width,
        "height": image.height,
        "bytes": output.stat().st_size,
    }


def optimize_one(path: str, quality: int, social_images: set[str] | None = None) -> tuple[str, dict]:
    original = REPO_ROOT / path
    with Image.open(original) as source:
        if getattr(source, "n_frames", 1) > 1:
            raise ValueError(f"Animated source needs a separate workflow: {path}")
        image = ImageOps.exif_transpose(source)
        image.load()
        image = image.convert("RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB")

    entry = {
        "width": image.width,
        "height": image.height,
        "original_bytes": original.stat().st_size,
    }
    if path in PASSTHROUGH_IMAGES:
        entry.update({
            "src": path, "srcset": "", "sizes": "32px", "fullsrc": path,
            "src_bytes": original.stat().st_size,
            "full_bytes": original.stat().st_size,
            "variants": [], "passthrough": True,
        })
        return path, entry

    stem = asset_stem(path)
    widths = {min(width, image.width) for width in (480, 800, 1200)}
    if path in COMPACT_IMAGES:
        widths.update(min(width, image.width) for width in (64, 128))
    variants = []
    for width in sorted(widths):
        resized = variant_image(image, width)
        variants.append(save_webp(resized, f"{stem}-{width}.webp", quality))
        resized.close()

    wanted_width = 128 if path in COMPACT_IMAGES else (1200 if path in HERO_IMAGES else 800)
    default = min(variants, key=lambda item: abs(item["width"] - min(wanted_width, image.width)))
    full_image = variant_image(image, 1920)
    full = save_webp(full_image, f"{stem}-full.webp", quality)
    full_image.close()
    entry.update({
        "src": default["src"],
        "srcset": ", ".join(f'{variant["src"]} {variant["width"]}w' for variant in variants),
        "sizes": "50px" if path == "images/ava.jpg" else ("128px" if path in COMPACT_IMAGES else BODY_SIZES),
        "fullsrc": full["src"],
        "src_bytes": default["bytes"],
        "full_bytes": full["bytes"],
        "full_width": full["width"],
        "full_height": full["height"],
        "variants": variants,
    })

    if path in (SOCIAL_IMAGES if social_images is None else social_images):
        # JPEG gives social crawlers a conventional preview format; preserve
        # the original aspect ratio and never enlarge a small source.
        social = variant_image(image, 1200)
        if social.mode == "RGBA":
            background = Image.new("RGB", social.size, "#0a1628")
            background.paste(social, mask=social.getchannel("A"))
            social.close()
            social = background
        else:
            social = social.convert("RGB")
        ogpath = REPO_ROOT / "images/blog" / f"{stem}-og.jpg"
        social.save(ogpath, "JPEG", quality=88, optimize=True, progressive=True)
        verify_output(ogpath, social.size, "JPEG")
        entry.update({
            "ogsrc": ogpath.relative_to(REPO_ROOT).as_posix(),
            "og_width": social.width, "og_height": social.height,
            "og_bytes": ogpath.stat().st_size,
        })
        social.close()
    image.close()
    return path, entry


def verify_manifest(manifest: dict, cover_images: set[str] | None = None) -> int:
    """Reopen every asset and confirm manifest dimensions and byte counts."""
    for cover in cover_images or ():
        if cover not in manifest or not manifest[cover].get("ogsrc"):
            raise ValueError(f"Cover has no JPEG social preview; run the optimizer after adding it to blog/posts.json: {cover}")
    generated: set[str] = set()
    for original, entry in manifest.items():
        with Image.open(REPO_ROOT / original) as source:
            source = ImageOps.exif_transpose(source)
            source.load()
            if source.size != (entry["width"], entry["height"]):
                raise ValueError(f"Original dimensions changed: {original}")
        if (REPO_ROOT / original).stat().st_size != entry["original_bytes"]:
            raise ValueError(f"Original byte count changed: {original}")
        for variant in entry["variants"]:
            if variant["width"] > entry["width"] or variant["height"] > entry["height"]:
                raise ValueError(f"Upscaled variant: {variant['src']}")
            output = REPO_ROOT / variant["src"]
            verify_output(output, (variant["width"], variant["height"]), "WEBP")
            if output.stat().st_size != variant["bytes"]:
                raise ValueError(f"Variant byte count changed: {output}")
            generated.add(variant["src"])
        if not entry.get("passthrough"):
            full_path = REPO_ROOT / entry["fullsrc"]
            verify_output(full_path, (entry["full_width"], entry["full_height"]), "WEBP")
            if full_path.stat().st_size != entry["full_bytes"] or entry["full_width"] > min(1920, entry["width"]):
                raise ValueError(f"Invalid full image: {full_path}")
            generated.add(entry["fullsrc"])
        if entry.get("ogsrc"):
            og_path = REPO_ROOT / entry["ogsrc"]
            verify_output(og_path, (entry["og_width"], entry["og_height"]), "JPEG")
            if og_path.stat().st_size != entry["og_bytes"]:
                raise ValueError(f"Invalid social image: {og_path}")
            generated.add(entry["ogsrc"])
        if (REPO_ROOT / entry["src"]).stat().st_size != entry["src_bytes"]:
            raise ValueError(f"Default image byte count changed: {entry['src']}")
    return len(generated)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pages", nargs="+", default=list(DEFAULT_PAGES), help="HTML pages to scan, relative to the repository")
    parser.add_argument("--add", action="append", default=[], metavar="IMAGE", help="Add an original image to the responsive manifest")
    parser.add_argument("--quality", type=int, default=87, help="WebP quality (default: 87)")
    parser.add_argument("--workers", type=int, default=4, help="Parallel image encoders (default: 4)")
    parser.add_argument("--strict", action="store_true", help="Fail when a source file is missing")
    parser.add_argument("--verify-only", action="store_true", help="Verify the current manifest without re-encoding images")
    args = parser.parse_args()
    if not features.check("webp"):
        parser.error("Pillow must include WebP support")
    if not 1 <= args.quality <= 100 or args.workers < 1:
        parser.error("quality must be 1–100 and workers must be positive")

    manifest_path = REPO_ROOT / "blog/media.json"
    cover_images = post_cover_images()
    if args.verify_only:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        count = verify_manifest(manifest, cover_images)
        print(f"Verified {len(manifest)} original images and {count} generated files.")
        return 0
    sources = set(EXTRA_IMAGES) | cover_images
    if manifest_path.exists():
        previous = json.loads(manifest_path.read_text(encoding="utf-8"))
        for original in previous:
            normalized = local_image_path(original)
            if normalized:
                sources.add(normalized)
    for page in args.pages:
        page_path = (REPO_ROOT / page).resolve()
        try:
            page_path.relative_to(REPO_ROOT)
        except ValueError:
            parser.error(f"Page leaves repository: {page}")
        refs = ImageReferences()
        refs.feed(page_path.read_text(encoding="utf-8-sig"))
        sources.update(refs.paths)
    for extra in args.add:
        normalized = local_image_path(extra)
        if not normalized:
            parser.error(f"Expected an original local image under images/: {extra}")
        sources.add(normalized)
    missing = sorted(source for source in sources if not (REPO_ROOT / source).is_file())
    if missing:
        print("Missing source images: " + ", ".join(missing), file=sys.stderr)
        if args.strict:
            return 1
        sources.difference_update(missing)

    (REPO_ROOT / "images/blog").mkdir(parents=True, exist_ok=True)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    social_images = SOCIAL_IMAGES | cover_images
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        rows = list(pool.map(lambda path: optimize_one(path, args.quality, social_images), sorted(sources)))
    manifest = dict(rows)
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    original_bytes = sum(item["original_bytes"] for item in manifest.values())
    default_bytes = sum(item["src_bytes"] for item in manifest.values())
    full_bytes = sum(item["full_bytes"] for item in manifest.values())
    saving = (1 - default_bytes / original_bytes) * 100 if original_bytes else 0
    print(f"Verified {len(manifest)} source images and all generated outputs.")
    print(f"Originals: {original_bytes:,} bytes; default variants: {default_bytes:,} bytes ({saving:.1f}% smaller).")
    print(f"Full variants: {full_bytes:,} bytes; manifest: {manifest_path.relative_to(REPO_ROOT).as_posix()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
