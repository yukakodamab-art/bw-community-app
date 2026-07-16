# -*- coding: utf-8 -*-
"""
BW YouTube community image spec.
Shared by the Flask app: builds one 1080x1080 slide from 2 source frames,
following the format worked out with Yuka:
- square 1080x1080
- slide 1 only: black title band (kicker + headline, ** marks red emphasis)
- 2 source frames stacked, cropped edge-to-edge (bottom/captions always kept,
  top corner tag always trimmed), no letterboxing
- thin black divider between the two frames + thin black outer border
"""
import re
from PIL import Image, ImageDraw, ImageFont

FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"

S = 1080
DIVIDER_H = 6
BORDER_W = 8
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
RED = (230, 20, 30)


def fit_crop_fill(path, target_w, target_h, min_top_crop=200):
    im = Image.open(path).convert("RGB")
    ow, oh = im.size
    r = target_w / target_h

    max_crop_h_by_ratio = ow / r
    crop_h = min(oh - min_top_crop, max_crop_h_by_ratio)
    crop_w = crop_h * r
    if crop_w > ow:
        crop_w = ow
        crop_h = crop_w / r

    crop_top = oh - crop_h
    crop_left = (ow - crop_w) / 2
    box = (crop_left, crop_top, crop_left + crop_w, crop_top + crop_h)
    cropped = im.crop(tuple(int(round(v)) for v in box))
    return cropped.resize((target_w, target_h), Image.LANCZOS)


def _parse_segments(text):
    # "**word**" -> emphasised (red) segment
    parts = re.split(r"\*\*(.+?)\*\*", text)
    segs = []
    for i, p in enumerate(parts):
        if not p:
            continue
        segs.append((p, i % 2 == 1))
    return segs


def _draw_mixed_center(draw, text, cy, font, base_color, emph_color, stroke_width=3):
    segs = _parse_segments(text)
    if not segs:
        return
    widths = []
    for seg, emph in segs:
        bbox = draw.textbbox((0, 0), seg, font=font, stroke_width=stroke_width)
        widths.append(bbox[2] - bbox[0])
    total_w = sum(widths)
    bbox_full = draw.textbbox((0, 0), "".join(s for s, _ in segs), font=font, stroke_width=stroke_width)
    th = bbox_full[3] - bbox_full[1]
    x = (S - total_w) // 2
    y = cy - th // 2 - bbox_full[1]
    for (seg, emph), w in zip(segs, widths):
        color = emph_color if emph else base_color
        draw.text((x, y), seg, font=font, fill=color, stroke_width=stroke_width, stroke_fill=BLACK)
        x += w


def build_slide(frame1_path, frame2_path, title_h=0, kicker="", headline=""):
    """Build one 1080x1080 slide image from two source frame image paths."""
    img_h = (S - title_h - DIVIDER_H) // 2
    canvas = Image.new("RGB", (S, S), BLACK)
    draw = ImageDraw.Draw(canvas)

    if title_h > 0:
        draw.rectangle([0, 0, S, title_h], fill=BLACK)
        f_kicker = ImageFont.truetype(FONT_BOLD, 40)
        f_headline = ImageFont.truetype(FONT_BOLD, 54)
        if kicker:
            _draw_mixed_center(draw, kicker, title_h * 0.35, f_kicker, WHITE, RED, stroke_width=0)
        if headline:
            _draw_mixed_center(draw, headline, title_h * 0.72, f_headline, WHITE, RED, stroke_width=4)

    img1 = fit_crop_fill(frame1_path, S, img_h)
    img2 = fit_crop_fill(frame2_path, S, img_h)

    y = title_h
    canvas.paste(img1, (0, y))
    y += img_h
    draw.rectangle([0, y, S, y + DIVIDER_H], fill=BLACK)
    canvas.paste(img2, (0, y + DIVIDER_H))

    for i in range(BORDER_W):
        draw.rectangle([i, i, S - 1 - i, S - 1 - i], outline=BLACK)

    return canvas
