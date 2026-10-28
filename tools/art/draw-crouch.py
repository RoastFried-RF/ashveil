#!/usr/bin/env python3
"""Draw one original ASHVEIL crouched-stance button icon from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-crouch.py [--check]
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


def crouch() -> Canvas:
    c = Canvas()
    # One compact human body in profile: both knees bent, weight kept low.
    # The rear support leg is darker and ends in its own grounded boot.
    c.polygon([(11, 20), (16, 23), (11, 25), (12, 27), (15, 28),
               (15, 31), (5, 31), (4, 29), (8, 27), (6, 24), (7, 22)], "o")
    c.polygon([(10, 22), (13, 23), (9, 25), (10, 28), (7, 28),
               (7, 24)], "u")
    c.line(8, 24, 9, 26, "v")
    c.line(7, 28, 12, 28, "b")
    c.row(6, 29, "rrnrrrro")
    # Broad front thigh, angular knee and a calf returning underneath the thigh.
    # A transparent notch between the two legs keeps the folded posture readable.
    c.polygon([(12, 20), (18, 20), (24, 21), (27, 23), (26, 26),
               (22, 28), (22, 29), (29, 29), (29, 31), (18, 31),
               (17, 28), (20, 25), (13, 25), (9, 23)], "o")
    c.polygon([(13, 21), (18, 21), (23, 22), (25, 23), (24, 25),
               (20, 27), (19, 28), (18, 28), (22, 24), (14, 24),
               (11, 23)], "v")
    c.line(14, 22, 22, 22, "w")
    c.point(24, 23, "c")
    c.line(22, 25, 20, 27, "u")
    c.row(19, 28, "brrb")
    c.row(19, 29, "rnnrrrrrro")
    c.line(20, 30, 28, 30, "b")
    # A low leaning teal torso, with no backpack or weapon masking the knee.
    c.polygon([(17, 12), (21, 14), (20, 19), (17, 22), (13, 24),
               (7, 23), (6, 20), (8, 16), (12, 13)], "o")
    c.polygon([(16, 14), (19, 15), (18, 19), (15, 21), (12, 22),
               (8, 21), (8, 19), (10, 16)], "t")
    c.line(10, 16, 14, 14, "m")
    c.line(8, 19, 9, 21, "m")
    c.line(14, 17, 13, 21, "d")
    c.line(15, 21, 18, 19, "d")
    c.point(11, 15, "l")
    c.line(9, 22, 13, 22, "b")
    c.point(13, 22, "a")
    # Bent forearm rests near the same body's forward knee, never a second leg.
    c.polygon([(18, 14), (21, 15), (23, 18), (28, 20), (28, 23),
               (25, 24), (20, 21), (17, 18)], "o")
    c.polygon([(19, 15), (21, 16), (22, 19), (26, 20), (25, 22),
               (21, 20), (18, 17)], "t")
    c.line(19, 15, 21, 17, "m")
    c.line(22, 20, 24, 21, "m")
    c.row(25, 21, "cp")
    c.row(25, 22, "ps")
    # Small hooded head, held low and facing right. A warm face is the focal point.
    c.polygon([(19, 7), (23, 8), (25, 11), (24, 15), (21, 17),
               (17, 15), (15, 12), (16, 9)], "o")
    c.polygon([(19, 8), (22, 9), (23, 11), (21, 15), (18, 14),
               (16, 12), (17, 10)], "t")
    c.line(18, 9, 16, 11, "m")
    c.point(17, 10, "l")
    c.row(21, 11, "nf")
    c.row(21, 12, "sfo")
    c.row(21, 13, "fno")
    c.row(20, 14, "cp")
    c.row(19, 15, "cpp")
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
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "G": ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "N": ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
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


def contact(icon: Canvas) -> Canvas:
    c = Canvas(192, 248, "#11191f")
    c.rect(8, 8, 176, 232, "#1b272c")
    c.rect(9, 9, 174, 1, "#3e5d67")
    label = "CROUCH"
    tx = (192 - len(label) * 12 + 2) // 2
    for i, letter in enumerate(label):
        for y, row in enumerate(FONT[letter]):
            for x, bit in enumerate(row):
                if bit == "1":
                    c.rect(tx + i * 12 + x * 2, 20 + y * 2, 2, 2, "#b8b39f")
    c.blit(icon, 64, 56, 2)
    c.rect(40, 144, 48, 40, "#11191f")
    c.rect(104, 144, 48, 40, "#b8b39f")
    c.blit(icon, 48, 148)
    c.blit(icon, 112, 148)
    # Render a 16px preview directly from the new coordinate array, not a PNG input.
    small = Canvas(16, 16)
    for y in range(16):
        for x in range(16):
            small.point(x, y, icon.pixels[y * 2 + 1][x * 2 + 1])
    c.rect(48, 204, 32, 28, "#11191f")
    c.rect(112, 204, 32, 28, "#b8b39f")
    c.blit(small, 56, 210)
    c.blit(small, 120, 210)
    return c

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify without modifying files")
    args = parser.parse_args()
    icon = crouch()
    artifacts = {"ashveil-crouch.png": png(icon),
                 "ashveil-crouch.svg": svg(icon, "one crouching person, body lowered and knees bent"),
                 "ashveil-crouch-contact.png": png(contact(icon)),
                 "ashveil-crouch-palette.json": (json.dumps(PALETTE, indent=2) + "\n").encode()}
    records = [{"file": f"public/sprites/original/items/{name}", "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest()}
               for name, data in artifacts.items()]
    manifest = {
        "created": "2026-10-20", "method": "original manually authored integer-coordinate pixel art",
        "source": "tools/art/draw-crouch.py", "inputs": [],
        "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "iconSize": [32, 32], "pngColorType": 6, "alphaValues": [0, 255],
        "externalImageInputs": False, "modifiedExistingImages": False,
        "paletteNote": "Same original 19-color teal/ash/brass material palette; new whole-body crouched silhouette.",
        "rendererNote": "Reuses the project's original Canvas/PNG/SVG renderer pattern.",
        "frameSuggestion": {"crouch": {"file": "ashveil-crouch.png", "sheet": "original_crouch", "frame": [0, 0, 32, 32]}},
        "status": "prepared original art, not registered in the game",
        "files": records,
    }
    artifacts["ashveil-crouch-source.json"] = (
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
