#!/usr/bin/env python3
"""Build the public, single-page Lumen Grove partnership overview.

Requires reportlab and Pillow. Run from any directory with:
    python tools/build_project_overview.py
The game update date is editorial data, independently checked on Google Play.
Do not replace it with the PDF build date.
"""

from __future__ import annotations

import argparse
from datetime import date
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from PIL import Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public/downloads/lumen-grove-project-overview.pdf"
PLAY_URL = "https://play.google.com/store/apps/details?id=comPointsGameForge.FarFarForest"
NAVY = colors.HexColor("#040a12")
SURFACE = colors.HexColor("#0c1724")
LINE = colors.HexColor("#294153")
WHITE = colors.HexColor("#edf4f4")
MUTED = colors.HexColor("#bdcbd5")
GOLD = colors.HexColor("#ffe55c")
TEAL = colors.HexColor("#91ddd2")


def date_text(value: date) -> str:
    return f"{value.day} {value.strftime('%B %Y')}"


def paragraph(pdf: canvas.Canvas, text: str, x: float, top: float, width: float,
              *, size: float = 10.3, leading: float = 15, color=WHITE,
              font: str = "Helvetica", max_height: float | None = None) -> float:
    style = ParagraphStyle("body", fontName=font, fontSize=size, leading=leading,
                           textColor=color, alignment=TA_LEFT, spaceBefore=0,
                           spaceAfter=0, allowWidows=0, allowOrphans=0)
    p = Paragraph(text, style)
    _, height = p.wrap(width, 1000)
    if max_height is not None and height > max_height:
        raise ValueError(f"Copy exceeds its layout area ({height} > {max_height}): {text}")
    p.drawOn(pdf, x, top - height)
    return top - height


def label(pdf: canvas.Canvas, text: str, x: float, y: float,
          *, color=TEAL, size: float = 8.0) -> None:
    pdf.saveState()
    pdf.setFillColor(color)
    text_obj = pdf.beginText(x, y)
    text_obj.setFont("Helvetica-Bold", size)
    text_obj.setCharSpace(1.25)
    text_obj.textOut(text)
    pdf.drawText(text_obj)
    pdf.restoreState()


def framed_image(pdf: canvas.Canvas, asset: str, x: float, y: float,
                 width: float, height: float, radius: float = 5) -> None:
    """Fit existing artwork without cropping or modifying the source asset."""
    source = Image.open(ROOT / asset).convert("RGB")
    encoded = BytesIO()
    source.save(encoded, format="JPEG", quality=90, subsampling=0, optimize=True)
    encoded.seek(0)
    pdf.saveState()
    clip = pdf.beginPath()
    clip.roundRect(x, y, width, height, radius)
    pdf.clipPath(clip, stroke=0, fill=0)
    pdf.drawImage(ImageReader(encoded), x, y, width, height,
                  preserveAspectRatio=True, anchor="c", mask="auto")
    pdf.restoreState()
    pdf.setStrokeColor(LINE)
    pdf.setLineWidth(.6)
    pdf.roundRect(x, y, width, height, radius, stroke=1, fill=0)


def link(pdf: canvas.Canvas, title: str, url: str, x: float, y: float,
         *, size: float = 10, color=TEAL) -> None:
    pdf.setFont("Helvetica-Bold", size)
    pdf.setFillColor(color)
    pdf.drawString(x, y, title)
    width = pdf.stringWidth(title, "Helvetica-Bold", size)
    pdf.setStrokeColor(color)
    pdf.setLineWidth(.4)
    pdf.line(x, y - 2.3, x + width, y - 2.3)
    pdf.linkURL(url, (x, y - 3, x + width, y + size + 2), relative=0)


def build(output: Path, prepared: date, game_updated: date) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(output), pagesize=A4, pageCompression=1, invariant=1)
    pdf.setTitle("Lumen Grove - Project Overview | POINTS.GS")
    pdf.setAuthor("Points Game Studio")
    pdf.setSubject("Publishing and growth partnership overview for Lumen Grove")
    pdf.setKeywords("Lumen Grove, POINTS.GS, partnerships, cozy forest farming, Android")
    width, height = A4
    margin = 36
    content = width - 2 * margin
    pdf.setFillColor(NAVY)
    pdf.rect(0, 0, width, height, stroke=0, fill=1)

    label(pdf, "POINTS.GS", margin, 802, color=WHITE, size=10)
    label(pdf, "PUBLISHING & PARTNERSHIPS", 326, 802, size=7.2)
    pdf.setStrokeColor(LINE)
    pdf.line(margin, 786, width - margin, 786)

    label(pdf, "PROJECT OVERVIEW", margin, 756)
    pdf.setFillColor(GOLD)
    pdf.setFont("Times-Bold", 35)
    pdf.drawString(margin, 716, "Lumen Grove")
    paragraph(pdf, "Cozy forest farming,<br/>made for a calmer pace.",
              margin, 698, 263, size=13.2, leading=18, max_height=40)
    framed_image(pdf, "images/press-kit/promo-art-960.webp", 326, 656, 233, 114)

    paragraph(pdf,
              "Restore a forgotten magical forest. Grow plants, decorate your grove and help its "
              "inhabitants bring light back to the Magic Oak.",
              margin, 636, content, size=11, leading=16, max_height=35)

    facts_top, facts_height = 588, 79
    pdf.setFillColor(SURFACE)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(margin, facts_top - facts_height, content, facts_height, 8, fill=1, stroke=1)
    cell_width = content / 3
    facts = [
        ("GENRE", "Cozy forest farming"),
        ("PLATFORM", "Android"),
        ("STATUS", "Released"),
        ("BUSINESS MODEL", "Free-to-play"),
        ("ENGINE", "Unity 2D"),
        ("NEXT PLATFORM", "iOS planned"),
    ]
    for index, (key, value) in enumerate(facts):
        x = margin + 13 + (index % 3) * cell_width
        y = facts_top - 17 - (index // 3) * 37
        label(pdf, key, x, y, color=MUTED, size=6.5)
        paragraph(pdf, escape(value), x, y - 6, cell_width - 20,
                  size=10.3, leading=13, font="Helvetica-Bold", max_height=15)

    gap, shot_width = 10, (content - 20) / 3
    shots = [
        ("images/press-kit/fully-decorated-grove-960.webp", "Restore & decorate"),
        ("images/press-kit/level-up-plants-960.webp", "Grow magical plants"),
        ("images/press-kit/hub-view-960.webp", "Seasonal activities"),
    ]
    for index, (asset, caption) in enumerate(shots):
        x = margin + index * (shot_width + gap)
        framed_image(pdf, asset, x, 409, shot_width, 77)
        paragraph(pdf, escape(caption), x, 399, shot_width,
                  size=8.1, leading=11, color=MUTED, max_height=12)

    column_width, right_x = 244, 315
    label(pdf, "THE GAME & STUDIO", margin, 365)
    bottom = paragraph(pdf,
                       "Plant, harvest and clear new areas. Everyday acts of care generate Light "
                       "to help the Magic Oak grow.",
                       margin, 350, column_width, max_height=65)
    paragraph(pdf,
              "<b>POINTS.GS</b> is an independent game studio behind Lumen Grove. "
              "<b>Bogdan Kagitin</b> is the game's developer.",
              margin, bottom - 14, column_width, max_height=65)

    label(pdf, "PARTNERSHIP FOCUS", right_x, 365)
    bottom = paragraph(pdf,
                       "We welcome publishing and growth partners to help the released game "
                       "reach and retain more players.",
                       right_x, 350, column_width, max_height=65)
    for item in ["Player acquisition", "Product analytics", "Retention", "Monetization"]:
        pdf.setFillColor(TEAL)
        pdf.circle(right_x + 2, bottom - 17, 1.5, fill=1, stroke=0)
        bottom = paragraph(pdf, item, right_x + 11, bottom - 9,
                           column_width - 11, size=10.1, leading=14, max_height=15) - 1

    pdf.setFillColor(SURFACE)
    pdf.setStrokeColor(LINE)
    pdf.roundRect(margin, 66, content, 133, 8, fill=1, stroke=1)
    label(pdf, "LET'S TALK", margin + 16, 179, color=GOLD)
    paragraph(pdf, "Request the pitch deck or discuss a partnership.",
              margin + 16, 165, content - 32, size=11, leading=15, max_height=16)
    link(pdf, "info@points.gs", "mailto:info@points.gs", margin + 16, 121, size=20)
    link(pdf, "Partnerships", "https://points.gs/partners", margin + 16, 98, size=9.2)
    link(pdf, "Google Play", PLAY_URL, margin + 126, 98, size=9.2)
    link(pdf, "Watch gameplay", "https://points.gs/public/videos/press-gameplay.mp4",
         margin + 232, 98, size=9.2)
    paragraph(pdf, "Detailed metrics and commercial materials are available on request.",
              margin + 16, 85, content - 32, size=8.7, leading=11, color=MUTED,
              max_height=12)

    paragraph(pdf,
              f"Last game update: {date_text(game_updated)} (Google Play). "
              f"Overview prepared: {date_text(prepared)}.",
              margin, 47, content, size=7.6, leading=10.5, color=MUTED, max_height=12)
    pdf.showPage()
    pdf.save()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--prepared-date", type=date.fromisoformat, default=date(2026, 10, 23))
    parser.add_argument("--game-updated", type=date.fromisoformat, default=date(2026, 10, 12))
    args = parser.parse_args()
    build(args.output, args.prepared_date, args.game_updated)
    print(f"Created {args.output}")


if __name__ == "__main__":
    main()
