#!/usr/bin/env python3
"""Create lightweight, browser-safe SVG and PNG logos from approved original SVG artwork.

Original sources live in frontend/public/brand-source. The source files contain
embedded Base64 PNG raster masks which have proved unreliable when served
to browsers. The derived SVGs contain only closed vector paths. No network
requests, external SVG references, Base64 images or unsafe script elements.
"""
from __future__ import annotations

from io import BytesIO
from pathlib import Path
import sys

import cairosvg
import cv2
import numpy as np
from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / "public"
SOURCE = PUBLIC / "brand-source"
OUT = PUBLIC / "brand"
SCALE = 2
ASSETS = (
    ("icon-tr", "icon", 375, 375),
    ("iradios-app-logo", "wordmark", 810, 225),
    ("noicon-iradios-app-logo", "full", 810, 225),
)


def contour_path(contour: np.ndarray) -> str:
    simplified = cv2.approxPolyDP(contour, epsilon=1.1, closed=True)
    points = simplified.reshape((-1, 2))
    if len(points) < 3:
        return ""
    coords = [f"{p[0]/SCALE:g},{p[1]/SCALE:g}" for p in points]
    return "M" + coords[0] + "L" + " ".join(coords[1:]) + "Z"


def make_paths(mask: np.ndarray, color: str) -> str:
    contours, _ = cv2.findContours(
        mask.astype(np.uint8), cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
    )
    paths = [
        contour_path(contour)
        for contour in contours
        if cv2.contourArea(contour) >= 1.8
    ]
    joined = "".join(path for path in paths if path)
    if not joined:
        raise ValueError(f"No contours for color {color}")
    return f'<path fill="{color}" fill-rule="evenodd" d="{joined}"/>'


def convert(original: str, safe_name: str, width: int, height: int) -> None:
    input_svg = SOURCE / f"{original}.svg"
    if not input_svg.is_file():
        raise FileNotFoundError(input_svg)
    large_png = cairosvg.svg2png(
        url=str(input_svg), output_width=width * SCALE,
        output_height=height * SCALE
    )
    rgba = np.asarray(Image.open(BytesIO(large_png)).convert("RGBA")).astype(np.int16)
    red, green, blue, alpha = [rgba[:, :, i] for i in range(4)]

    # The original embedded RGB rasters have opaque black behind their logo.
    # Exclude black, preserving transparent holes and the official lime/white art.
    visible = (alpha > 85) & (np.maximum.reduce((red, green, blue)) > 90)
    lime = visible & (green > red * 1.06) & (red > 90) & (blue < red * .72)
    white = visible & ~lime

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {width} {height}" width="{width}" height="{height}">'
        + make_paths(white, "#f6f8f4")
        + make_paths(lime, "#ccff00")
        + "</svg>\n"
    )
    if len(svg) > 120000 or any(x in svg for x in ("<image", "data:", "<script")):
        raise ValueError(f"Unsafe or oversized derived SVG for {original}")
    destination = PUBLIC / f"{original}.svg"
    destination.write_text(svg, encoding="utf-8")

    # Browser-safe fallback for all UI branding, emails, and Canvas Stories.
    rendered = cairosvg.svg2png(
        bytestring=svg.encode("utf-8"),
        output_width=width * 3, output_height=height * 3
    )
    image = Image.open(BytesIO(rendered)).convert("RGBA")
    if image.getbbox() is None:
        raise ValueError(f"Empty PNG for {original}")
    target = OUT / f"{safe_name}.png"
    image.save(target, format="PNG", optimize=True)
    print(f"Generated {destination.name} ({len(svg)} bytes) and "
          f"{target.relative_to(PUBLIC)} ({target.stat().st_size} bytes)")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for original, safe, width, height in ASSETS:
        convert(original, safe, width, height)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Brand asset generation failed: {exc}", file=sys.stderr)
        raise
