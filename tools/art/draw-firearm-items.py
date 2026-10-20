#!/usr/bin/env python3
"""Draw four original ASHVEIL firearm inventory icons from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-firearm-items.py [--check]
Only writes its own new art files under public/sprites/original/items/.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/sprites/original/items"
PALETTE = {
    "o": "#172429",  # cold contour, shared with the original wanderer
    "k": "#28292c",  # deep opening
    "b": "#3d3331",  # leather shadow
    "r": "#6c5141",  # worn leather
    "n": "#987354",  # leather/wood light
    "s": "#9b7359",  # warm middle
    "f": "#c69b75",  # small worn edges
    "a": "#b78047",  # copper
    "g": "#e5bd74",  # restrained copper glint
    "d": "#293f48",  # faded teal shadow
    "t": "#3e5d67",  # faded teal
    "m": "#608183",  # faded teal edge
    "l": "#91aaa0",  # light cold edge
    "c": "#817f72",  # old linen/ivory shadow
    "p": "#b8b39f",  # linen
    "h": "#e0d8bf",  # ivory feather and thread
    "u": "#353d40",  # iron shadow
    "v": "#626e6c",  # iron
    "w": "#8b9387",  # iron edge
}


class Canvas:
    def __init__(self, width: int = 32, height: int = 32, fill: str = "."):
        self.width = width
        self.height = height
        self.pixels = [[fill] * width for _ in range(height)]

    def point(self, x: int, y: int, color: str) -> None:
        if 0 <= x < self.width and 0 <= y < self.height:
            self.pixels[y][x] = color

    def rect(self, x: int, y: int, width: int, height: int, color: str) -> None:
        for py in range(y, y + height):
            for px in range(x, x + width):
                self.point(px, py, color)

    def row(self, x: int, y: int, colors: str) -> None:
        for i, color in enumerate(colors):
            if color != ".":
                self.point(x + i, y, color)

    def line(self, x0: int, y0: int, x1: int, y1: int, color: str) -> None:
        dx, sx = abs(x1 - x0), 1 if x0 < x1 else -1
        dy, sy = -abs(y1 - y0), 1 if y0 < y1 else -1
        error = dx + dy
        while True:
            self.point(x0, y0, color)
            if x0 == x1 and y0 == y1:
                break
            twice = 2 * error
            if twice >= dy:
                error += dy
                x0 += sx
            if twice <= dx:
                error += dx
                y0 += sy

    def polygon(self, vertices: list[tuple[int, int]], color: str) -> None:
        for y in range(min(p[1] for p in vertices), max(p[1] for p in vertices)):
            for x in range(min(p[0] for p in vertices), max(p[0] for p in vertices)):
                inside = False
                previous = vertices[-1]
                for current in vertices:
                    xi, yi = current
                    xj, yj = previous
                    if ((yi > y + 0.5) != (yj > y + 0.5) and
                            x + 0.5 < (xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi):
                        inside = not inside
                    previous = current
                if inside:
                    self.point(x, y, color)

    def blit(self, other: Canvas, x: int, y: int, scale: int = 1) -> None:
        for py, row in enumerate(other.pixels):
            for px, color in enumerate(row):
                if color != ".":
                    self.rect(x + px * scale, y + py * scale, scale, scale, color)


def flintlock_musket() -> Canvas:
    c = Canvas()
    # Narrow faded sling behind the gun, deliberately distinct from a modern grip.
    c.line(8, 25, 19, 21, "o")
    c.line(19, 21, 25, 10, "o")
    c.line(9, 25, 19, 20, "t")
    c.line(19, 20, 24, 11, "m")
    # Long diagonal forged barrel. The ramrod is a separate thin lower line.
    c.polygon([(12, 17), (26, 3), (29, 4), (30, 6), (16, 20)], "o")
    c.polygon([(13, 17), (27, 3), (29, 5), (15, 19)], "v")
    c.line(14, 17, 27, 4, "w")
    c.line(15, 18, 28, 5, "u")
    c.line(17, 21, 29, 9, "o")
    c.line(17, 20, 28, 9, "v")
    # A continuous walnut stock and broad shoulder butt, with a slim wrist.
    c.polygon([(3, 25), (6, 22), (8, 23), (13, 17), (17, 16),
               (24, 9), (25, 10), (18, 19), (15, 20), (10, 26),
               (9, 29), (6, 31), (2, 28)], "o")
    c.polygon([(4, 25), (6, 24), (8, 25), (13, 19), (17, 18),
               (23, 11), (23, 13), (18, 20), (15, 20), (9, 27),
               (8, 29), (6, 29), (3, 27)], "r")
    c.line(4, 25, 6, 24, "n")
    c.line(6, 24, 8, 26, "s")
    c.line(8, 26, 14, 19, "n")
    c.line(17, 18, 22, 13, "n")
    c.line(5, 27, 7, 27, "b")
    c.point(6, 28, "s")
    c.point(10, 24, "b")
    # Restrained old copper furniture: butt plate, barrel bands, trigger bow.
    c.line(3, 27, 6, 30, "a")
    c.point(3, 27, "g")
    c.line(20, 10, 22, 12, "a")
    c.point(20, 10, "g")
    c.line(25, 5, 27, 7, "a")
    c.point(25, 5, "w")
    c.row(12, 20, "ooao")
    c.row(12, 21, "a.ao")
    c.row(12, 22, "oao")
    # Lock plate, raised cock and the tiny visible grey flint.
    c.row(12, 17, "onaao")
    c.row(13, 18, "arbo")
    c.row(13, 16, "ovao")
    c.row(13, 15, "avo")
    c.row(14, 14, "awo")
    c.point(16, 14, "p")
    c.point(16, 15, "u")
    c.point(15, 17, "g")
    # Dark muzzle and one small front sight; no scope, magazine or muzzle flash.
    c.row(27, 3, "uo")
    c.point(28, 4, "k")
    c.point(25, 3, "u")
    return c


def lead_ball() -> Canvas:
    c = Canvas()
    # An original matte cast sphere: broad value clusters, no chrome sparkle.
    for y in range(7, 28):
        for x in range(6, 27):
            distance = (x - 16) ** 2 + (y - 17) ** 2
            if distance <= 100:
                color = "o" if distance >= 83 else "v"
                if distance < 83:
                    if x + y <= 25:
                        color = "w"
                    elif x + y >= 37:
                        color = "u"
                    elif x + y >= 33 and x > 16:
                        color = "u"
                c.point(x, y, color)
    c.row(13, 9, "wwwv")
    c.row(11, 10, "www")
    c.row(10, 11, "ww")
    c.point(10, 12, "l")
    c.line(9, 14, 9, 17, "w")
    c.point(9, 18, "v")
    # The mould seam is irregular and subdued, rather than a decorative glyph.
    c.line(10, 19, 13, 22, "v")
    c.line(13, 22, 18, 23, "v")
    c.line(19, 22, 22, 20, "u")
    c.point(14, 14, "w")
    c.point(20, 16, "v")
    c.point(15, 25, "u")
    return c


def powder_charge() -> Canvas:
    c = Canvas()
    # One angular folded-paper charge, not a rigid jar or a fabric sack.
    c.polygon([(10, 6), (18, 3), (22, 6), (22, 10), (27, 23),
               (24, 28), (15, 30), (10, 25), (7, 11)], "o")
    c.polygon([(11, 7), (18, 4), (21, 7), (20, 11), (25, 23),
               (23, 27), (16, 28), (12, 24), (9, 11)], "p")
    c.polygon([(18, 4), (21, 7), (19, 10), (15, 10), (16, 7)], "c")
    c.line(11, 7, 15, 6, "h")
    c.line(11, 8, 13, 10, "c")
    c.polygon([(19, 11), (21, 11), (25, 23), (23, 27), (20, 28),
               (20, 24), (18, 17)], "c")
    c.line(11, 14, 13, 22, "h")
    c.line(13, 24, 16, 27, "h")
    c.line(16, 27, 21, 26, "c")
    c.line(21, 26, 23, 24, "n")
    c.line(13, 15, 18, 22, "c")
    c.line(15, 17, 17, 18, "p")
    # A narrow reused cloth tie keeps the top fold closed.
    c.polygon([(9, 10), (19, 8), (21, 11), (10, 13)], "d")
    c.line(10, 10, 18, 9, "m")
    c.line(10, 11, 19, 10, "t")
    c.row(19, 9, "dmd")
    c.line(20, 10, 23, 12, "t")
    c.line(20, 10, 20, 14, "d")
    c.point(20, 14, "m")
    # Charcoal-like grains beside the packet identify its black-powder contents.
    c.row(4, 24, "ouo")
    c.row(4, 25, "uvo")
    c.row(4, 26, "oo")
    c.row(7, 27, "ouo")
    c.row(7, 28, "uvo")
    c.point(5, 29, "v")
    c.point(9, 24, "u")
    c.point(8, 22, "v")
    c.row(11, 29, "ou")
    return c


def gun_oil() -> Canvas:
    c = Canvas()
    # Small squat glass bottle, tall neck and old copper/wood stopper.
    c.polygon([(13, 7), (20, 7), (20, 12), (24, 15), (25, 19),
               (25, 27), (22, 30), (11, 30), (8, 27), (8, 18),
               (10, 14), (13, 12)], "o")
    c.rect(14, 8, 5, 6, "t")
    c.line(14, 9, 14, 12, "m")
    c.polygon([(13, 13), (19, 13), (23, 16), (23, 27), (21, 28),
               (12, 28), (10, 26), (10, 18)], "d")
    c.polygon([(13, 14), (15, 14), (13, 18), (13, 26), (11, 26),
               (10, 24), (10, 18)], "t")
    c.line(11, 17, 11, 23, "m")
    c.line(12, 16, 13, 15, "l")
    c.polygon([(20, 15), (23, 17), (23, 26), (21, 28), (18, 28),
               (20, 25)], "u")
    c.line(12, 28, 20, 28, "t")
    c.point(12, 27, "m")
    # A worn paper label carries only a small oil drop, no text or branding.
    c.polygon([(13, 18), (20, 18), (21, 20), (20, 26), (13, 26),
               (12, 24), (12, 20)], "c")
    c.rect(13, 19, 7, 6, "p")
    c.line(13, 19, 18, 19, "h")
    c.row(16, 20, "b")
    c.row(15, 21, "bb")
    c.row(15, 22, "rbb")
    c.row(15, 23, "bbb")
    c.row(16, 24, "b")
    # Stopper is broad enough to read at native size, unlike the paper charge.
    c.rect(12, 4, 9, 5, "o")
    c.rect(13, 5, 7, 3, "r")
    c.row(13, 5, "nnnrrrn")
    c.rect(12, 8, 9, 3, "o")
    c.row(13, 8, "agaaaag")
    c.row(13, 9, "anrrraa")
    c.line(13, 10, 19, 10, "r")
    return c

def rgba(color: str) -> bytes:
    if color == ".":
        return bytes((0, 0, 0, 0))
    value = PALETTE.get(color, color).lstrip("#")
    return bytes((*bytes.fromhex(value), 255))


def png(c: Canvas) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + kind + data +
                struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff))
    raw = b"".join(b"\0" + b"".join(rgba(p) for p in row) for row in c.pixels)
    return (b"\x89PNG\r\n\x1a\n" +
            chunk(b"IHDR", struct.pack(">IIBBBBB", c.width, c.height, 8, 6, 0, 0, 0)) +
            chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def svg(c: Canvas, label: str) -> bytes:
    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.width}" height="{c.height}" '
             f'viewBox="0 0 {c.width} {c.height}" shape-rendering="crispEdges">',
             f'  <title>ASHVEIL original pixel icon: {label}</title>',
             '  <desc>Original integer-coordinate artwork. No external image references.</desc>']
    for y, row in enumerate(c.pixels):
        x = 0
        while x < c.width:
            color = row[x]
            end = x + 1
            while end < c.width and row[end] == color:
                end += 1
            if color != ".":
                lines.append(f'  <rect x="{x}" y="{y}" width="{end - x}" height="1" '
                             f'fill="{PALETTE[color]}"/>')
            x = end
    lines.append('</svg>')
    return ("\n".join(lines) + "\n").encode()


FONT = {
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
}


def contact(icons: dict[str, Canvas]) -> Canvas:
    c = Canvas(768, 248, "#11191f")
    labels = ["MUSKET", "LEAD", "POWDER", "OIL"]
    for index, (label, icon) in enumerate(zip(labels, icons.values())):
        left = index * 192
        c.rect(left + 8, 8, 176, 232, "#1b272c")
        c.rect(left + 9, 9, 174, 1, "#3e5d67")
        tx = left + (192 - len(label) * 12 + 2) // 2
        for i, letter in enumerate(label):
            for y, row in enumerate(FONT[letter]):
                for x, bit in enumerate(row):
                    if bit == "1":
                        c.rect(tx + i * 12 + x * 2, 20 + y * 2, 2, 2, "#b8b39f")
        c.blit(icon, left + 32, 44, 4)
        c.rect(left + 40, 192, 48, 40, "#11191f")
        c.rect(left + 104, 192, 48, 40, "#b8b39f")
        c.blit(icon, left + 48, 196)
        c.blit(icon, left + 112, 196)
    return c


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify without modifying files")
    args = parser.parse_args()
    icons = {"ashveil-flintlock-musket": flintlock_musket(), "ashveil-lead-ball": lead_ball(),
             "ashveil-powder-charge": powder_charge(), "ashveil-gun-oil": gun_oil()}
    labels = ["flintlock long gun", "cast lead ball", "one black-powder paper charge", "gun oil bottle"]
    artifacts: dict[str, bytes] = {}
    for (name, icon), label in zip(icons.items(), labels):
        artifacts[f"{name}.png"] = png(icon)
        artifacts[f"{name}.svg"] = svg(icon, label)
        opaque = [(x, y) for y, row in enumerate(icon.pixels)
                  for x, color in enumerate(row) if color != "."]
        assert opaque, f"empty icon: {name}"
        assert all(0 < x < 31 and 0 < y < 31 for x, y in opaque), name
        assert len(opaque) < 32 * 32 * 0.7, f"lost transparent silhouette: {name}"
    artifacts["ashveil-firearm-items-contact.png"] = png(contact(icons))
    artifacts["ashveil-firearm-items-palette.json"] = (
        json.dumps(PALETTE, indent=2, ensure_ascii=False) + "\n").encode()
    records = [{"file": f"public/sprites/original/items/{name}", "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest()}
               for name, data in artifacts.items()]
    manifest = {
        "created": "2026-10-20", "method": "original manually authored integer-coordinate pixel art",
        "source": "tools/art/draw-firearm-items.py", "inputs": [],
        "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "iconSize": [32, 32], "pngColorType": 6, "alphaValues": [0, 255],
        "externalImageInputs": False, "modifiedExistingImages": False,
        "paletteNote": "Shared original storage-item material colors; new silhouettes and pixels.",
        "rendererNote": "Reuses the project's original Canvas/PNG/SVG/contact-sheet renderer pattern.",
        "frameSuggestions": {"flintlock_musket": "ashveil-flintlock-musket.png",
                             "lead_ball": "ashveil-lead-ball.png", "powder_charge": "ashveil-powder-charge.png",
                             "gun_oil": "ashveil-gun-oil.png"},
        "files": records,
    }
    artifacts["ashveil-firearm-items-source.json"] = (
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode()
    if args.check:
        for name, data in artifacts.items():
            assert (OUT / name).read_bytes() == data, f"regeneration differs: {name}"
        print(f"Verified {len(artifacts)} deterministic original art files; no files changed.")
    else:
        OUT.mkdir(parents=True, exist_ok=True)
        for name, data in artifacts.items():
            (OUT / name).write_bytes(data)
        print(f"Wrote {len(artifacts)} original art files to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
