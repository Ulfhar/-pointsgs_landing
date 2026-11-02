"""Opt-in article themes. Palette and artwork live in blog/event-themes.json."""
import json
import re
from html import escape

from html_tree import Node

COLOR_KEYS = {
    "background_start", "background_middle", "background_end", "surface",
    "surface_hover", "text", "muted", "heading", "accent", "accent_hover", "border",
}


def load_themes(root, posts, media):
    themes = json.loads((root / "blog/event-themes.json").read_text(encoding="utf-8"))
    for post in posts:
        name = post.get("event_theme")
        if name is None:
            continue
        if not re.fullmatch(r"[a-z0-9-]+", name) or name not in themes:
            raise ValueError(f"Unknown event theme: {name}")
        theme = themes[name]
        if set(theme["colors"]) != COLOR_KEYS or any(
                not re.fullmatch(r"#[0-9a-fA-F]{6}", color) for color in theme["colors"].values()):
            raise ValueError(f"Event theme {name} needs the documented hexadecimal palette")
        for decoration in theme.get("decorations", []):
            if decoration["image"] not in media:
                raise ValueError(f"Optimize event artwork first: {decoration['image']}")
            if not re.fullmatch(r"[a-z0-9-]+", decoration["slot"]):
                raise ValueError("Event decoration slot must be a simple name")
            if decoration["side"] not in {"left", "right", "center"}:
                raise ValueError("Event decoration side must be left, right or center")
            for key, default, minimum, maximum in (("width", 180, 48, 320), ("rotate", 0, -30, 30), ("top", 0, -40, 300)):
                value = decoration.get(key, default)
                if not isinstance(value, (int, float)) or not minimum <= value <= maximum:
                    raise ValueError(f"Invalid event artwork {key}: {value}")
    return themes


def body_attributes(name, theme):
    if theme is None:
        return ""
    palette = ";".join(f"--event-{key.replace('_', '-')}:{value}" for key, value in theme["colors"].items())
    return f' data-event-theme="{escape(name)}" style="{escape(palette)}"'


def decorations_for(theme, slot, media, prefix):
    if theme is None:
        return []
    result = []
    for item in theme.get("decorations", []):
        if item["slot"] != slot:
            continue
        info = media[item["image"]]
        # Small transparent variants suit margin artwork, including high-DPI screens.
        asset = min(info["variants"], key=lambda variant: abs(variant["width"] - 480))
        style = f'--decor-width:{item.get("width", 180)}px;--decor-rotate:{item.get("rotate", 0)}deg;--decor-top:{item.get("top", 0)}px'
        image = Node("img", {"src": prefix + asset["src"], "width": str(asset["width"]),
                            "height": str(asset["height"]), "alt": "", "draggable": "false",
                            "loading": "eager" if slot == "header" else "lazy", "decoding": "async"})
        result.append(Node("div", {"class": "event-decoration event-decoration--" + item["side"],
                                   "aria-hidden": "true", "style": style}, [image]))
    return result


def header_art(theme, media, prefix):
    images = decorations_for(theme, "header", media, prefix)
    return Node("div", {"class": "event-ornaments", "aria-hidden": "true"}, images).html() if images else ""


def decorate_content(tree, theme, media, prefix):
    if theme is None:
        return
    slots = {node.attrs["data-event-slot"]: node for node in tree.walk() if "data-event-slot" in node.attrs}
    required = {item["slot"] for item in theme.get("decorations", [])} - {"header"}
    if required - slots.keys():
        raise ValueError(f"Article is missing event artwork slots: {sorted(required - slots.keys())}")
    for name, node in slots.items():
        node.children[0:0] = decorations_for(theme, name, media, prefix)
