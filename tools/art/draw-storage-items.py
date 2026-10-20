#!/usr/bin/env python3
"""Draw four original ASHVEIL inventory icons from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-storage-items.py [--check]
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


def sack() -> Canvas:
    c = Canvas()
    # Gathered, slightly lopsided linen opening; no rigid backpack outline.
    c.polygon([(10, 3), (13, 5), (17, 4), (21, 3), (22, 5), (19, 10),
               (24, 14), (27, 22), (26, 27), (23, 30), (10, 30),
               (6, 27), (5, 22), (8, 14), (12, 10), (9, 6)], "o")
    c.polygon([(10, 5), (14, 7), (18, 6), (20, 5), (18, 10),
               (20, 12), (13, 12), (11, 10), (12, 8)], "c")
    c.row(11, 6, "pccpcppp")
    c.line(12, 7, 14, 10, "h")
    c.line(18, 7, 17, 10, "p")
    c.polygon([(12, 12), (19, 12), (23, 15), (25, 22), (24, 27),
               (22, 28), (11, 28), (8, 26), (7, 22), (10, 15)], "c")
    c.polygon([(12, 12), (16, 12), (14, 17), (14, 23), (11, 26),
               (9, 25), (8, 21), (10, 16)], "p")
    c.polygon([(18, 13), (21, 14), (24, 21), (23, 26), (20, 28),
               (17, 27), (19, 23), (18, 19)], "n")
    c.line(11, 15, 9, 21, "h")
    c.line(10, 23, 11, 25, "h")
    c.line(15, 14, 14, 19, "c")
    c.line(16, 22, 15, 26, "p")
    c.line(21, 16, 23, 22, "s")
    # Twisted dark drawcord and its two loose ends.
    c.rect(11, 10, 10, 2, "b")
    c.row(12, 10, "nanaaaan")
    c.row(12, 11, "rrrbrarr")
    c.row(20, 10, "rno")
    c.line(20, 11, 23, 14, "o")
    c.line(21, 11, 24, 13, "n")
    c.point(24, 14, "r")
    c.line(20, 12, 20, 16, "b")
    c.point(20, 15, "n")
    # A repaired cloth patch is a quiet shared design cue, not a relic glow.
    c.polygon([(17, 18), (22, 17), (24, 23), (19, 26), (16, 23)], "d")
    c.polygon([(18, 19), (21, 18), (23, 23), (19, 25), (17, 23)], "t")
    c.line(18, 20, 21, 23, "m")
    c.line(21, 19, 18, 23, "m")
    for x, y in [(17, 19), (20, 18), (22, 21), (21, 24), (18, 24)]:
        c.point(x, y, "p")
    c.row(10, 28, "ccpcncccccncc")
    c.point(8, 24, "c")
    c.point(12, 19, "p")
    return c


def quiver() -> Canvas:
    c = Canvas()
    # A broad loose carrying strap sits behind the leather tube.
    c.polygon([(15, 5), (18, 6), (11, 10), (7, 15), (6, 21),
               (8, 26), (12, 27), (12, 30), (7, 29), (4, 24),
               (4, 17), (7, 11)], "o")
    c.line(15, 7, 9, 11, "n")
    c.line(9, 11, 6, 17, "n")
    c.line(6, 17, 6, 23, "r")
    c.line(6, 23, 8, 27, "r")
    c.line(8, 27, 11, 28, "n")
    # Slanted body, thicker on the lit left edge; the mouth is visibly empty.
    c.polygon([(18, 6), (27, 10), (20, 28), (17, 30), (11, 27),
               (10, 24)], "o")
    c.polygon([(18, 8), (25, 11), (19, 27), (17, 28), (12, 26),
               (12, 24)], "r")
    c.polygon([(18, 9), (20, 10), (14, 25), (13, 26), (12, 24)], "n")
    c.polygon([(23, 12), (25, 11), (19, 27), (17, 28), (16, 27)], "b")
    c.line(19, 11, 14, 24, "s")
    c.line(20, 14, 16, 24, "r")
    c.point(18, 19, "n")
    c.point(16, 23, "s")
    # Closed stitched toe keeps the tube distinct from an arrow bundle.
    c.line(12, 25, 17, 28, "b")
    c.line(13, 25, 17, 27, "n")
    for x, y in [(13, 26), (15, 27), (18, 27), (19, 25), (20, 22),
                 (21, 19), (22, 16), (23, 13)]:
        c.point(x, y, "p")
    # Worn teal binding and two very small copper rivets.
    c.polygon([(15, 14), (23, 17), (22, 20), (14, 17)], "d")
    c.line(15, 14, 22, 17, "m")
    c.line(15, 15, 22, 18, "t")
    c.point(15, 15, "a")
    c.point(22, 18, "a")
    # Copper rim: dark inside, rim shine stays limited to the upper-left.
    c.polygon([(19, 4), (22, 4), (28, 7), (28, 10), (25, 12),
               (17, 8), (17, 6)], "o")
    c.polygon([(20, 5), (22, 5), (27, 8), (26, 10), (19, 8),
               (18, 7)], "a")
    c.polygon([(20, 6), (23, 7), (26, 8), (25, 9), (21, 8),
               (19, 7)], "k")
    c.row(20, 5, "gn")
    c.point(18, 7, "g")
    c.point(26, 10, "r")
    c.row(10, 21, "oao")
    c.row(10, 22, "ago")
    c.row(10, 23, "oao")
    return c


def belt() -> Canvas:
    c = Canvas()
    # Back half of a loop, irregular from use, with a large transparent centre.
    c.polygon([(9, 6), (21, 6), (27, 9), (29, 13), (29, 20),
               (25, 24), (15, 25), (6, 22), (3, 18), (3, 12), (6, 8)], "o")
    c.polygon([(9, 7), (20, 7), (26, 10), (27, 13), (27, 19),
               (24, 22), (15, 23), (7, 20), (5, 17), (5, 12), (7, 9)], "r")
    c.polygon([(10, 10), (20, 10), (23, 12), (24, 15), (23, 18),
               (19, 20), (12, 19), (8, 17), (8, 13)], ".")
    c.line(10, 7, 20, 7, "n")
    c.line(21, 8, 25, 10, "s")
    c.line(6, 12, 6, 16, "n")
    c.line(8, 20, 15, 22, "n")
    c.line(18, 23, 24, 22, "b")
    c.line(26, 17, 26, 20, "n")
    # The belt's tongue crosses the front, with three holes and a keeper.
    c.polygon([(4, 14), (14, 14), (20, 16), (28, 17), (31, 20),
               (28, 23), (20, 22), (13, 20), (4, 20)], "o")
    c.polygon([(5, 15), (13, 15), (20, 17), (28, 18), (29, 20),
               (27, 21), (20, 20), (13, 18), (5, 18)], "r")
    c.line(12, 15, 21, 18, "n")
    c.line(22, 18, 27, 19, "s")
    c.point(25, 20, "o")
    c.point(22, 19, "o")
    c.point(19, 18, "o")
    c.line(15, 15, 14, 20, "b")
    c.line(16, 16, 15, 20, "n")
    # Small pouch belongs to the actual LeatherBelt Def, with a simple flap.
    c.rect(19, 20, 8, 9, "o")
    c.rect(20, 21, 6, 7, "r")
    c.line(20, 22, 20, 26, "n")
    c.line(21, 27, 24, 27, "n")
    c.polygon([(19, 20), (27, 20), (26, 24), (23, 25), (20, 24)], "b")
    c.polygon([(20, 21), (26, 21), (25, 23), (23, 24), (21, 23)], "t")
    c.line(20, 21, 25, 21, "m")
    c.point(23, 23, "a")
    c.point(23, 22, "g")
    c.point(25, 26, "s")
    # Rectangular copper buckle; the dark hollow shows the leather behind.
    c.rect(3, 12, 11, 9, "o")
    c.rect(4, 13, 9, 7, "a")
    c.rect(6, 15, 5, 3, "b")
    c.line(5, 13, 11, 13, "g")
    c.line(4, 14, 4, 18, "n")
    c.line(6, 16, 12, 16, "a")
    c.point(11, 15, "g")
    c.line(5, 19, 11, 19, "r")
    return c


def arrows() -> Canvas:
    c = Canvas()

    def arrow(x: int, y: int, length: int) -> None:
        # Each shaft rises north-east; feather lobes remain broad at 1x scale.
        c.line(x, y + 1, x + length, y + 1 - length, "o")
        c.line(x + 1, y, x + length + 1, y - length, "o")
        c.line(x, y, x + length, y - length, "n")
        c.line(x + 1, y, x + length + 1, y - length, "p")
        c.polygon([(x - 2, y - 3), (x + 1, y - 6), (x + 2, y - 1),
                   (x, y + 2), (x - 2, y + 2)], "o")
        c.polygon([(x - 1, y - 3), (x + 1, y - 5), (x + 1, y - 1),
                   (x - 1, y + 1)], "p")
        c.line(x, y - 3, x, y - 1, "h")
        c.polygon([(x + 1, y + 1), (x + 5, y - 1), (x + 7, y),
                   (x + 4, y + 3), (x, y + 3)], "o")
        c.polygon([(x + 2, y + 1), (x + 5, y), (x + 6, y),
                   (x + 3, y + 2), (x + 1, y + 2)], "p")
        c.line(x + 3, y + 1, x + 4, y + 1, "h")
        c.line(x, y + 1, x + 4, y - 3, "c")
        tx, ty = x + length, y - length
        c.polygon([(tx - 2, ty - 1), (tx + 3, ty - 3), (tx + 2, ty + 2),
                   (tx, ty + 1), (tx - 1, ty + 2)], "o")
        c.polygon([(tx - 1, ty - 1), (tx + 2, ty - 2), (tx + 1, ty + 1)], "v")
        c.line(tx, ty - 1, tx + 1, ty - 2, "w")
        c.point(tx, ty, "u")
        c.point(tx - 1, ty + 1, "a")

    arrow(5, 23, 16)
    arrow(10, 27, 17)
    arrow(7, 26, 18)
    # Plain cloth tie around the three shafts; it does not encode item quality.
    c.polygon([(13, 15), (16, 14), (20, 18), (18, 21), (15, 19)], "o")
    c.line(14, 15, 18, 19, "m")
    c.line(15, 15, 19, 19, "t")
    c.line(16, 15, 19, 18, "d")
    c.row(16, 18, "mto")
    c.line(16, 19, 15, 22, "d")
    c.point(15, 22, "m")
    c.line(18, 20, 21, 21, "t")
    c.point(21, 22, "m")
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
    labels = ["SACK", "QUIVER", "BELT", "ARROWS"]
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
    icons = {"ashveil-sack": sack(), "ashveil-quiver": quiver(),
             "ashveil-leather-belt": belt(), "ashveil-arrow-bundle": arrows()}
    labels = ["linen sack", "empty leather quiver", "leather belt with pouch", "arrow bundle"]
    artifacts: dict[str, bytes] = {}
    for (name, icon), label in zip(icons.items(), labels):
        artifacts[f"{name}.png"] = png(icon)
        artifacts[f"{name}.svg"] = svg(icon, label)
        opaque = [(x, y) for y, row in enumerate(icon.pixels)
                  for x, color in enumerate(row) if color != "."]
        assert opaque, f"empty icon: {name}"
        assert all(0 < x < 31 and 0 < y < 31 for x, y in opaque), name
        assert len(opaque) < 32 * 32 * 0.7, f"lost transparent silhouette: {name}"
    artifacts["ashveil-storage-items-contact.png"] = png(contact(icons))
    artifacts["ashveil-storage-items-palette.json"] = (
        json.dumps(PALETTE, indent=2, ensure_ascii=False) + "\n").encode()
    records = [{"file": f"public/sprites/original/items/{name}", "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest()}
               for name, data in artifacts.items()]
    manifest = {
        "created": "2026-10-20", "method": "original manually authored integer-coordinate pixel art",
        "source": "tools/art/draw-storage-items.py", "inputs": [],
        "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "iconSize": [32, 32], "pngColorType": 6, "alphaValues": [0, 255],
        "externalImageInputs": False, "modifiedExistingImages": False,
        "paletteNote": "Shared original wanderer material colors; new silhouettes and pixels.",
        "defSuggestions": {"Item.Sack": "ashveil-sack.png", "Item.Quiver": "ashveil-quiver.png",
                           "Item.LeatherBelt": "ashveil-leather-belt.png", "Item.Arrow": "ashveil-arrow-bundle.png"},
        "files": records,
    }
    artifacts["ashveil-storage-items-source.json"] = (
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
