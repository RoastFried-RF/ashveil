#!/usr/bin/env python3
"""Draw six original ASHVEIL industrial-firearm inventory icons from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-industrial-items.py [--check]
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


def revolver() -> Canvas:
    c = Canvas()
    # The curved walnut grip is visibly separate from the cylinder and barrel.
    c.polygon([(9, 16), (16, 18), (13, 22), (14, 27), (10, 30),
               (4, 28), (4, 24), (7, 20)], "o")
    c.polygon([(9, 18), (14, 19), (11, 22), (12, 27), (9, 28),
               (6, 26), (6, 24), (8, 21)], "r")
    c.line(9, 19, 7, 24, "n")
    c.line(7, 24, 7, 26, "s")
    c.line(8, 26, 10, 27, "b")
    c.point(9, 24, "a")
    c.point(8, 21, "s")
    # Old exposed hammer, small frame, continuous top strap.
    c.polygon([(8, 6), (11, 7), (12, 10), (21, 9), (22, 15),
               (18, 20), (12, 21), (8, 17), (7, 12), (9, 10)], "o")
    c.row(8, 7, "vwo")
    c.line(10, 8, 10, 11, "v")
    c.polygon([(9, 11), (13, 10), (20, 11), (20, 16), (17, 18),
               (12, 19), (9, 16)], "u")
    c.line(10, 13, 10, 16, "v")
    c.line(11, 17, 13, 18, "w")
    c.point(11, 15, "a")
    # Side-on fluted rotating cylinder: broad enough to remain legible at 1x.
    c.rect(12, 9, 9, 9, "o")
    c.rect(13, 10, 7, 7, "v")
    c.line(13, 10, 19, 10, "w")
    c.line(14, 12, 14, 15, "u")
    c.line(17, 12, 17, 15, "u")
    c.line(13, 16, 19, 16, "u")
    c.point(19, 12, "w")
    # Long plain barrel, iron front sight and underslung ejector rod.
    c.rect(19, 8, 11, 6, "o")
    c.rect(20, 9, 9, 3, "v")
    c.line(20, 9, 28, 9, "w")
    c.line(21, 12, 28, 12, "u")
    c.rect(28, 9, 2, 3, "u")
    c.point(29, 10, "k")
    c.point(27, 7, "u")
    c.line(21, 14, 27, 14, "v")
    c.point(20, 14, "a")
    # An open trigger guard, not a solid pistol magazine.
    c.polygon([(14, 18), (20, 17), (21, 20), (18, 23), (14, 22)], "o")
    c.line(15, 21, 18, 21, "a")
    c.point(19, 20, "n")
    c.line(16, 18, 16, 20, "v")
    c.point(17, 19, "u")
    return c


def bolt_rifle() -> Canvas:
    c = Canvas()
    # Slim forged barrel and long worn walnut fore-end; no optical sight.
    c.polygon([(12, 17), (26, 3), (29, 4), (30, 6), (16, 20)], "o")
    c.polygon([(14, 17), (27, 4), (29, 5), (16, 18)], "v")
    c.line(14, 17, 27, 4, "w")
    c.line(15, 18, 28, 5, "u")
    c.polygon([(3, 25), (5, 22), (8, 22), (12, 18), (16, 17),
               (23, 10), (25, 11), (18, 20), (15, 21), (10, 26),
               (9, 29), (6, 31), (2, 28)], "o")
    c.polygon([(4, 25), (6, 24), (8, 24), (13, 19), (16, 19),
               (23, 12), (23, 14), (17, 21), (14, 21), (9, 27),
               (8, 29), (6, 29), (3, 27)], "r")
    c.line(4, 25, 7, 24, "n")
    c.line(7, 24, 9, 25, "n")
    c.line(9, 25, 14, 20, "s")
    c.line(17, 19, 22, 14, "n")
    c.line(5, 27, 7, 28, "b")
    c.point(7, 26, "s")
    c.line(3, 27, 6, 30, "v")
    # Plain metal barrel bands and a closed receiver.
    c.line(21, 11, 23, 13, "v")
    c.point(21, 11, "w")
    c.line(25, 6, 27, 8, "v")
    c.point(25, 6, "w")
    c.line(12, 18, 16, 14, "o")
    c.line(13, 18, 17, 14, "w")
    c.line(14, 19, 18, 15, "v")
    # Projecting bolt stem and rounded knob are the identifying silhouette.
    c.line(17, 17, 21, 20, "o")
    c.line(18, 17, 21, 19, "v")
    c.row(20, 19, "ovo")
    c.row(20, 20, "vwu")
    c.row(20, 21, "ouo")
    # Small open trigger bow beneath the receiver.
    c.row(12, 22, "voo")
    c.row(12, 23, "v.v")
    c.row(12, 24, "ovo")
    c.point(14, 22, "u")
    c.point(26, 3, "u")
    c.point(28, 4, "k")
    return c


def factory_round() -> Canvas:
    c = Canvas()
    # One complete cartridge: finished pointed jacket above a clean brass case.
    c.polygon([(16, 2), (18, 4), (20, 8), (20, 12), (21, 15),
               (22, 26), (23, 27), (23, 29), (10, 29), (10, 27),
               (11, 26), (11, 15), (13, 12), (13, 8), (14, 4)], "o")
    c.polygon([(16, 3), (18, 6), (19, 9), (19, 12), (14, 12),
               (14, 8), (15, 5)], "n")
    c.line(15, 6, 15, 10, "f")
    c.line(18, 7, 19, 10, "r")
    c.rect(14, 12, 5, 3, "a")
    c.line(14, 12, 18, 12, "n")
    c.polygon([(14, 15), (19, 15), (21, 17), (21, 26), (12, 26),
               (12, 17)], "a")
    c.line(13, 17, 13, 25, "g")
    c.line(14, 16, 15, 15, "g")
    c.rect(19, 17, 2, 9, "n")
    c.line(20, 18, 20, 25, "r")
    c.line(16, 17, 16, 24, "a")
    c.row(11, 26, "rnnnnnnnnnr")
    c.row(11, 27, "agaaaaaaaag")
    c.row(11, 28, "nrrrrrrrrrn")
    return c


def reclaimed_round() -> Canvas:
    c = Canvas()
    # One reused complete round, with a dull projectile, uneven rim and dents.
    c.polygon([(16, 3), (18, 4), (20, 8), (20, 12), (21, 15),
               (22, 26), (23, 27), (22, 30), (10, 29), (10, 27),
               (11, 25), (11, 16), (13, 12), (13, 8), (14, 5)], "o")
    c.polygon([(16, 4), (18, 6), (19, 9), (19, 12), (14, 12),
               (14, 8)], "v")
    c.line(15, 7, 15, 10, "w")
    c.line(18, 8, 19, 11, "u")
    c.rect(14, 12, 5, 3, "t")
    c.line(14, 12, 18, 12, "m")
    c.line(15, 14, 18, 14, "d")
    c.polygon([(14, 15), (19, 15), (21, 17), (21, 26), (12, 26),
               (12, 17)], "n")
    c.line(13, 18, 13, 24, "a")
    c.point(13, 17, "g")
    c.rect(19, 18, 2, 8, "r")
    c.line(15, 18, 17, 20, "r")
    c.line(15, 19, 16, 20, "c")
    c.line(17, 23, 19, 21, "b")
    c.point(18, 22, "a")
    c.point(20, 24, "b")
    c.row(11, 26, "rnnrrnnrnnr")
    c.row(11, 27, "naaaaaaanan")
    c.row(11, 28, "rrnnrrrrrnr")
    return c


def empty_case() -> Canvas:
    c = Canvas()
    # A short brass tube with an unmistakably open, dark elliptical mouth.
    c.polygon([(12, 6), (20, 6), (24, 9), (24, 26), (25, 28),
               (23, 30), (9, 30), (7, 28), (8, 26), (8, 10)], "o")
    c.polygon([(10, 11), (22, 11), (22, 27), (10, 27)], "a")
    c.line(10, 13, 10, 25, "g")
    c.line(11, 14, 11, 24, "a")
    c.rect(20, 13, 2, 13, "n")
    c.line(21, 16, 21, 25, "r")
    c.point(17, 24, "r")
    c.line(14, 19, 15, 22, "n")
    c.polygon([(12, 7), (20, 7), (23, 9), (22, 12), (11, 12),
               (9, 10)], "a")
    c.polygon([(13, 8), (19, 8), (21, 9), (20, 10), (12, 10),
               (11, 9)], "k")
    c.line(12, 7, 19, 7, "g")
    c.line(11, 11, 20, 11, "r")
    c.line(10, 12, 10, 13, "g")
    c.row(8, 27, "rnnnnnnnnnnnnnnr")
    c.row(8, 28, "nagaaaaaaaaaaagn")
    c.row(9, 29, "nrrrrrrrrrrrrn")
    return c


def primer_cap() -> Canvas:
    c = Canvas()
    # A shallow, unmarked metal cap; its silhouette is wider than its height.
    c.polygon([(12, 10), (20, 10), (24, 13), (24, 20), (21, 23),
               (11, 23), (8, 20), (8, 14)], "o")
    c.polygon([(10, 15), (22, 15), (22, 20), (20, 22), (12, 22),
               (10, 20)], "n")
    c.line(10, 16, 10, 19, "g")
    c.line(12, 21, 19, 21, "a")
    c.line(21, 17, 21, 20, "r")
    c.polygon([(12, 11), (20, 11), (23, 14), (21, 17), (11, 17),
               (9, 15)], "a")
    c.polygon([(13, 12), (19, 12), (21, 14), (19, 16), (12, 16),
               (11, 14)], "v")
    c.line(13, 12, 18, 12, "w")
    c.line(12, 13, 12, 14, "w")
    c.line(14, 16, 19, 16, "u")
    c.line(12, 11, 19, 11, "g")
    c.point(10, 13, "g")
    c.point(22, 15, "n")
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
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
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
    c = Canvas(576, 496, "#11191f")
    labels = ["REVOLVER", "RIFLE", "FACTORY", "RELOADED", "CASE", "PRIMER"]
    for index, (label, icon) in enumerate(zip(labels, icons.values())):
        left, top = (index % 3) * 192, (index // 3) * 248
        c.rect(left + 8, top + 8, 176, 232, "#1b272c")
        c.rect(left + 9, top + 9, 174, 1, "#3e5d67")
        tx = left + (192 - len(label) * 12 + 2) // 2
        for i, letter in enumerate(label):
            for y, row in enumerate(FONT[letter]):
                for x, bit in enumerate(row):
                    if bit == "1":
                        c.rect(tx + i * 12 + x * 2, top + 20 + y * 2, 2, 2, "#b8b39f")
        c.blit(icon, left + 32, top + 44, 4)
        c.rect(left + 40, top + 192, 48, 40, "#11191f")
        c.rect(left + 104, top + 192, 48, 40, "#b8b39f")
        c.blit(icon, left + 48, top + 196)
        c.blit(icon, left + 112, top + 196)
    return c

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify without modifying files")
    args = parser.parse_args()
    icons = {"ashveil-revolver": revolver(), "ashveil-bolt-rifle": bolt_rifle(),
             "ashveil-factory-round": factory_round(), "ashveil-reclaimed-round": reclaimed_round(),
             "ashveil-empty-case": empty_case(), "ashveil-primer-cap": primer_cap()}
    labels = ["revolving-cylinder handgun", "bolt-action rifle", "one complete factory cartridge",
              "one complete reclaimed cartridge", "empty brass cartridge case", "small shallow primer cap"]
    artifacts: dict[str, bytes] = {}
    for (name, icon), label in zip(icons.items(), labels):
        artifacts[f"{name}.png"] = png(icon)
        artifacts[f"{name}.svg"] = svg(icon, label)
    artifacts["ashveil-industrial-items-contact.png"] = png(contact(icons))
    artifacts["ashveil-industrial-items-palette.json"] = (
        json.dumps(PALETTE, indent=2, ensure_ascii=False) + "\n").encode()
    records = [{"file": f"public/sprites/original/items/{name}", "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest()}
               for name, data in artifacts.items()]
    manifest = {
        "created": "2026-10-20", "method": "original manually authored integer-coordinate pixel art",
        "source": "tools/art/draw-industrial-items.py", "inputs": [],
        "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "iconSize": [32, 32], "pngColorType": 6, "alphaValues": [0, 255],
        "externalImageInputs": False, "modifiedExistingImages": False,
        "paletteNote": "Same original 19-color firearm material palette; six new silhouettes and pixel designs.",
        "rendererNote": "Reuses the project's original Canvas/PNG/SVG renderer pattern.",
        "frameSuggestions": {"revolver": "ashveil-revolver.png", "bolt_rifle": "ashveil-bolt-rifle.png",
                             "factory_round": "ashveil-factory-round.png", "reclaimed_round": "ashveil-reclaimed-round.png",
                             "empty_case": "ashveil-empty-case.png", "primer_cap": "ashveil-primer-cap.png"},
        "files": records,
    }
    artifacts["ashveil-industrial-items-source.json"] = (
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
