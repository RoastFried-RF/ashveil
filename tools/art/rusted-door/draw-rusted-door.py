#!/usr/bin/env python3
"""Original integer-coordinate door artwork; stdlib only, no image inputs.

Run in this isolated directory: python3 draw-rusted-door.py [--check]
The PNG and SVG are generated from the same hand-authored pixel canvas.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parent
PALETTE = {
    "o": "#1b2323",  # cool silhouette
    "d": "#282b27",  # open wood splits
    "w": "#3b3e32",  # damp wood shadow
    "m": "#555746",  # weathered wood
    "l": "#73705a",  # worn plank edge
    "g": "#96917a",  # exposed dry grain
    "i": "#262e31",  # iron undercut
    "s": "#454f4b",  # old iron
    "e": "#758078",  # cold rubbed iron edge
    "r": "#4c352b",  # deep rust
    "t": "#79513b",  # rust body
    "c": "#a07854",  # restrained copper/rust chip
    "a": "#b2ac91",  # ash caught in wood
    "k": "#323c38",  # threshold shadow
    "f": "#4c5550",  # threshold stone
    "h": "#4d5c46",  # old moss, few pixels only
}


class Canvas:
    def __init__(self, width, height, fill="."):
        self.width, self.height = width, height
        self.pixels = [[fill] * width for _ in range(height)]

    def point(self, x, y, color):
        assert 0 <= x < self.width and 0 <= y < self.height
        self.pixels[y][x] = color

    def rect(self, x, y, width, height, color):
        for py in range(y, y + height):
            for px in range(x, x + width):
                self.point(px, py, color)

    def line(self, x0, y0, x1, y1, color):
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

    def blit(self, image, x, y, scale=1):
        for py, row in enumerate(image.pixels):
            for px, color in enumerate(row):
                if color != ".":
                    self.rect(x + px * scale, y + py * scale, scale, scale, color)


def closed():
    c = Canvas(16, 32)
    # Four upright planks. The stepped top has broken corners rather than an arch.
    c.rect(1, 2, 14, 28, "o")
    c.rect(2, 1, 12, 29, "w")
    c.rect(3, 0, 10, 1, "o")
    c.rect(3, 1, 10, 1, "l")
    c.rect(2, 3, 3, 26, "m")
    c.rect(6, 2, 3, 27, "l")
    c.rect(10, 2, 3, 27, "m")
    c.line(5, 3, 5, 28, "d")
    c.line(9, 2, 9, 29, "w")
    c.line(13, 3, 13, 29, "w")
    # All grain and rot marks are placed deliberately; no noise or sampled texture.
    for x, y0, y1, col in [(3, 3, 5, "l"), (3, 10, 13, "w"),
                           (4, 18, 21, "l"), (7, 3, 5, "g"),
                           (7, 11, 16, "m"), (8, 20, 22, "w"),
                           (11, 4, 8, "w"), (12, 10, 13, "l"),
                           (11, 20, 22, "l"), (3, 26, 28, "w")]:
        c.line(x, y0, x, y1, col)
    for x, y, col in [(4, 2, "a"), (8, 9, "g"), (6, 19, "g"),
                       (11, 27, "g"), (12, 28, "w"), (4, 29, "d"),
                       (6, 28, "w"), (8, 29, "d"), (12, 2, "l")]:
        c.point(x, y, col)
    # Long supporting timber is faded wood, separate from the two iron straps.
    c.line(4, 26, 11, 11, "w")
    c.line(4, 25, 10, 12, "m")
    # Left hinges and rust-pitted horizontal straps; asymmetrical wear is hand set.
    for y in [6, 23]:
        c.rect(0, y, 2, 4, "i")
        c.rect(1, y, 1, 3, "s")
        c.rect(2, y + 1, 10, 3, "i")
        c.rect(2, y + 1, 10, 1, "e")
        c.rect(2, y + 2, 10, 1, "s")
        c.rect(2, y + 3, 10, 1, "r")
        c.point(3, y + 2, "c")
        c.point(10, y + 2, "t")
        c.point(6, y + 1, "t")
        c.point(8, y + 2, "r")
    # A recessed key escutcheon and short latch, never an attached padlock.
    c.rect(10, 15, 4, 7, "i")
    c.rect(10, 15, 3, 1, "e")
    c.rect(10, 16, 3, 5, "t")
    c.point(12, 16, "c")
    c.rect(11, 17, 1, 3, "o")
    c.point(12, 19, "r")
    c.point(10, 20, "r")
    c.line(12, 18, 14, 18, "s")
    c.point(14, 18, "e")
    # The same low threshold occupies the final row of both frame sizes.
    c.rect(0, 30, 16, 1, "k")
    c.rect(1, 31, 14, 1, "f")
    c.point(2, 30, "h")
    c.point(13, 31, "e")
    return c


def opened():
    c = Canvas(16, 16)
    # Hinge remains left. The open leaf is seen foreshortened across the bottom,
    # leaving the top/right passage transparent at this legacy 16x16 frame size.
    c.rect(1, 2, 2, 12, "o")
    c.line(2, 3, 2, 12, "s")
    for x, y, col in [(1, 4, "t"), (2, 5, "e"), (1, 11, "r")]:
        c.point(x, y, col)
    # Authored leaf silhouette, diagonal timber grain, two consistent iron bands.
    for x, top in [(3, 4), (4, 5), (5, 5), (6, 6), (7, 7), (8, 7),
                    (9, 8), (10, 9), (11, 9), (12, 10), (13, 11)]:
        c.rect(x, top, 1, 3, "o")
        c.point(x, top, "l")
        c.point(x, top + 1, "m" if x % 3 else "w")
        c.point(x, top + 2, "w")
    c.line(4, 7, 12, 12, "d")
    c.line(4, 6, 12, 11, "g")
    c.line(4, 5, 5, 8, "s")
    c.point(4, 5, "e")
    c.point(5, 7, "t")
    c.line(10, 9, 11, 12, "i")
    c.point(10, 9, "e")
    c.point(11, 11, "t")
    c.point(12, 11, "c")
    c.point(13, 12, "s")
    c.rect(0, 14, 16, 1, "k")
    c.rect(1, 15, 14, 1, "f")
    c.point(2, 14, "h")
    c.point(13, 15, "e")
    return c


def rgba(color):
    return bytes(4) if color == "." else bytes.fromhex(PALETTE.get(color, color).lstrip("#")) + b"\xff"


def png(c):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    raw = b"".join(b"\0" + b"".join(rgba(p) for p in row) for row in c.pixels)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", c.width, c.height, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def svg(c, name):
    rows = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.width}" height="{c.height}" viewBox="0 0 {c.width} {c.height}" shape-rendering="crispEdges">',
            f'  <title>ASHVEIL original {name}</title>',
            '  <desc>Hand-authored pixel coordinates; no external image references. The key escutcheon is not a padlock.</desc>']
    for y, row in enumerate(c.pixels):
        x = 0
        while x < c.width:
            end, color = x + 1, row[x]
            while end < c.width and row[end] == color:
                end += 1
            if color != ".":
                rows.append(f'  <rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{PALETTE[color]}"/>')
            x = end
    return ("\n".join(rows) + "\n</svg>\n").encode()


FONT = {
    "A":"01110/10001/10001/11111/10001/10001/10001", "C":"01111/10000/10000/10000/10000/10000/01111",
    "D":"11110/10001/10001/10001/10001/10001/11110", "E":"11111/10000/10000/11110/10000/10000/11111",
    "G":"01111/10000/10000/10111/10001/10001/01111", "H":"10001/10001/10001/11111/10001/10001/10001",
    "I":"11111/00100/00100/00100/00100/00100/11111", "K":"10001/10010/10100/11000/10100/10010/10001",
    "L":"10000/10000/10000/10000/10000/10000/11111",
    "M":"10001/11011/10101/10101/10001/10001/10001", "N":"10001/11001/11001/10101/10011/10011/10001",
    "O":"01110/10001/10001/10001/10001/10001/01110", "P":"11110/10001/10001/11110/10000/10000/10000",
    "R":"11110/10001/10001/11110/10100/10010/10001", "S":"01111/10000/10000/01110/00001/00001/11110",
    "T":"11111/00100/00100/00100/00100/00100/00100", "U":"10001/10001/10001/10001/10001/10001/01110",
    "V":"10001/10001/10001/10001/10001/01010/00100", "X":"10001/10001/01010/00100/01010/10001/10001",
    "0":"01110/10001/10011/10101/11001/10001/01110", "1":"00100/01100/00100/00100/00100/00100/01110",
    "2":"01110/10001/00001/00010/00100/01000/11111", "3":"11110/00001/00001/01110/00001/00001/11110",
    "6":"00110/01000/10000/11110/10001/10001/01110", "8":"01110/10001/10001/01110/10001/10001/01110",
    "/":"00001/00001/00010/00100/01000/10000/10000", " ":"00000/00000/00000/00000/00000/00000/00000"
}


def text(c, x, y, value, scale=1, color="#b2ac91"):
    for i, letter in enumerate(value):
        for py, row in enumerate(FONT[letter].split("/")):
            for px, bit in enumerate(row):
                if bit == "1":
                    c.rect(x + (i * 6 + px) * scale, y + py * scale, scale, scale, color)


def review(closed_art, open_art):
    c = Canvas(640, 444, "#20292b")
    text(c, 20, 16, "ASHVEIL / RUSTED DOOR", 2)
    text(c, 20, 40, "ORIGINAL / 16X32 CLOSED / 16X16 OPEN")
    for x, background in [(16,"#10191b"), (168,"#c8c5b3")]:
        c.rect(x, 64, 144, 268, background)
        c.blit(closed_art, x + 8, 70, 8)
    for x, background in [(320,"#10191b"), (472,"#c8c5b3")]:
        c.rect(x, 64, 144, 140, background)
        c.blit(open_art, x + 8, 70, 8)
    text(c, 20, 343, "CLOSED 8X")
    text(c, 324, 212, "OPEN 8X")
    c.rect(320, 234, 296, 98, "#303b39")
    c.line(328, 330, 608, 330, "#5b6860")
    c.blit(closed_art, 344, 234, 3)
    c.blit(open_art, 424, 282, 3)
    text(c, 324, 343, "3X / SAME GROUND")
    text(c, 20, 367, "NATIVE 1X")
    c.blit(closed_art, 92, 356)
    c.blit(open_art, 124, 372)
    text(c, 324, 367, "NO ATTACHED PADLOCK")
    for i, color in enumerate(PALETTE.values()):
        c.rect(20 + i * 36, 404, 28, 20, color)
    return c


def encoded_json(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def products():
    arts = {"rusted_door_closed": closed(), "rusted_door_open": opened()}
    files = {}
    for name, art in arts.items():
        files[name + ".png"] = png(art)
        files[name + ".svg"] = svg(art, name)
    files["rusted-door-review.png"] = png(review(*arts.values()))
    files["rusted-door-palette.json"] = encoded_json(PALETTE)
    files["rusted-door-frames.fragment.json"] = encoded_json({
        "sheets": {name: "sprites/original/terrain/" + name + ".png" for name in arts},
        "frames": {name: [name, 0, 0, art.width, art.height] for name, art in arts.items()}
    })
    integrity = {
        "method": "original manually authored integer-coordinate pixel art",
        "externalImageInputs": [], "modifiedExistingImages": False,
        "generator": "draw-rusted-door.py",
        "generatorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "provenance": "SOURCE.md",
        "provenanceSha256": hashlib.sha256((ROOT / "SOURCE.md").read_bytes()).hexdigest(),
        "rendererContract": {"tileSize":16, "anchor":[0,1], "position":["px","py+16"], "zIndex":"py+15.5"},
        "registrationStatus":"prepared in isolated folder; not registered in game",
        "frames": {},
        "files":[{"file":name,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for name,data in files.items()]
    }
    for name, art in arts.items():
        alpha = [rgba(p)[3] for row in art.pixels for p in row]
        assert sorted(set(alpha)) == [0, 255]
        assert len(set(p for row in art.pixels for p in row if p != ".")) <= len(PALETTE)
        integrity["frames"][name] = {"width":art.width,"height":art.height,"pngColorType":6,"alphaValues":[0,255],"transparentPixels":alpha.count(0),"opaquePixels":alpha.count(255),"bottomGroundRow":art.height-1}
    files["rusted-door-integrity.json"] = encoded_json(integrity)
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify exact output bytes without modifying any files.")
    args = parser.parse_args()
    files = products()
    for name, data in files.items():
        path = ROOT / name
        if args.check:
            if not path.exists() or path.read_bytes() != data:
                raise SystemExit("Byte mismatch: " + name)
        else:
            path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ") + str(len(files)) + " deterministic original-art files")


if __name__ == "__main__":
    main()
