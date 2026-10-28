#!/usr/bin/env python3
"""Draw two original ASHVEIL combat-maneuver button icons from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-maneuvers.py [--check]
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


def trip() -> Canvas:
    c = Canvas()
    # One grey opponent's shin and planted boot, seen only below the knee.
    c.polygon([(19, 2), (26, 3), (25, 11), (23, 19), (26, 21),
               (29, 23), (29, 28), (21, 28), (17, 25), (17, 19)], "o")
    c.polygon([(20, 4), (24, 4), (23, 12), (21, 20), (18, 21),
               (19, 13)], "v")
    c.line(20, 5, 19, 15, "w")
    c.line(23, 5, 22, 12, "u")
    c.polygon([(18, 20), (23, 20), (25, 22), (28, 24), (28, 26),
               (22, 26), (19, 24)], "u")
    c.line(20, 21, 23, 21, "w")
    c.line(23, 23, 26, 24, "v")
    c.line(22, 27, 28, 27, "c")
    # A broad teal trouser leg approaches diagonally, its boot hooks the ankle.
    c.polygon([(3, 8), (9, 5), (14, 14), (17, 18), (23, 16),
               (27, 18), (27, 21), (24, 24), (17, 26), (12, 23),
               (8, 17)], "o")
    c.polygon([(5, 9), (8, 7), (12, 15), (16, 20), (13, 22),
               (10, 18)], "t")
    c.line(5, 10, 10, 18, "m")
    c.line(10, 18, 13, 21, "m")
    c.point(7, 10, "l")
    # Toe turns up at the far side of the grey ankle instead of striking forward.
    c.polygon([(14, 18), (17, 20), (23, 18), (25, 19), (25, 21),
               (23, 23), (17, 24), (14, 22), (12, 20)], "b")
    c.line(15, 20, 17, 22, "n")
    c.line(18, 22, 23, 20, "r")
    c.line(22, 19, 24, 19, "n")
    c.line(17, 24, 23, 23, "r")
    c.line(12, 18, 15, 21, "c")
    c.point(13, 19, "p")
    # Small low sweep mark: its curved, ground-level motion is unique to trip.
    c.line(4, 19, 3, 23, "a")
    c.line(4, 23, 7, 27, "a")
    c.line(7, 27, 11, 28, "a")
    c.line(4, 20, 4, 23, "n")
    c.point(6, 26, "g")
    c.polygon([(10, 25), (15, 28), (10, 30), (11, 28)], "a")
    return c


def disarm() -> Canvas:
    c = Canvas()
    # Teal sleeve and an open, pale working glove; broad fingers with clear gaps.
    c.polygon([(3, 25), (7, 21), (15, 24), (15, 28), (11, 31),
               (3, 31)], "o")
    c.polygon([(5, 25), (8, 23), (13, 25), (13, 28), (10, 30),
               (5, 30)], "t")
    c.line(5, 26, 5, 29, "m")
    c.line(8, 24, 12, 26, "m")
    # Original hand silhouette, separate fingers rather than a closed weapon grip.
    c.polygon([(6, 24), (3, 20), (3, 16), (5, 14), (7, 17),
               (7, 9), (8, 7), (10, 7), (11, 9), (11, 16),
               (12, 16), (12, 11), (14, 9), (16, 11), (16, 18),
               (17, 18), (17, 15), (19, 14), (21, 16), (20, 21),
               (17, 25), (13, 27), (9, 27)], "o")
    c.polygon([(7, 23), (5, 20), (4, 17), (5, 16), (8, 20),
               (8, 10), (9, 8), (10, 10), (10, 19), (13, 19),
               (13, 12), (14, 11), (15, 12), (15, 21), (18, 20),
               (18, 17), (19, 16), (20, 17), (19, 21), (16, 24),
               (12, 25), (9, 25)], "p")
    c.line(8, 10, 8, 16, "h")
    c.line(13, 13, 13, 18, "h")
    c.line(5, 18, 7, 21, "h")
    c.line(8, 22, 10, 24, "h")
    c.line(16, 21, 15, 24, "c")
    c.point(10, 20, "c")
    c.point(12, 22, "c")
    c.line(7, 25, 12, 27, "c")
    # A short plain knife is visibly detached, moving away above the fingertips.
    c.polygon([(25, 2), (29, 1), (29, 5), (25, 10), (23, 11),
               (20, 9)], "o")
    c.polygon([(25, 3), (28, 2), (28, 5), (24, 10), (22, 9)], "v")
    c.line(23, 7, 27, 3, "w")
    c.line(24, 9, 27, 6, "u")
    c.line(19, 10, 25, 16, "o")
    c.line(20, 10, 25, 15, "a")
    c.line(19, 15, 22, 12, "o")
    c.line(20, 15, 22, 13, "r")
    c.point(20, 16, "n")
    # Short release ticks point away from the open hand; no letters or symbols.
    c.line(17, 5, 19, 7, "a")
    c.point(17, 5, "g")
    c.line(20, 3, 21, 5, "n")
    c.line(17, 10, 19, 10, "a")
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


def contact(icons: dict[str, Canvas]) -> Canvas:
    c = Canvas(384, 248, "#11191f")
    for index, (label, icon) in enumerate(zip(["TRIP", "DISARM"], icons.values())):
        left = index * 192
        c.rect(left + 8, 8, 176, 232, "#1b272c")
        c.rect(left + 9, 9, 174, 1, "#3e5d67")
        tx = left + (192 - len(label) * 12 + 2) // 2
        for i, letter in enumerate(label):
            for y, row in enumerate(FONT[letter]):
                for x, bit in enumerate(row):
                    if bit == "1":
                        c.rect(tx + i * 12 + x * 2, 20 + y * 2, 2, 2, "#b8b39f")
        c.blit(icon, left + 64, 56, 2)
        c.rect(left + 40, 144, 48, 40, "#11191f")
        c.rect(left + 104, 144, 48, 40, "#b8b39f")
        c.blit(icon, left + 48, 148)
        c.blit(icon, left + 112, 148)
        # Preview the authored coordinate array at 16px, without reading/altering a PNG.
        small = Canvas(16, 16)
        for y in range(16):
            for x in range(16):
                small.point(x, y, icon.pixels[y * 2 + 1][x * 2 + 1])
        c.rect(left + 48, 204, 32, 28, "#11191f")
        c.rect(left + 112, 204, 32, 28, "#b8b39f")
        c.blit(small, left + 56, 210)
        c.blit(small, left + 120, 210)
    return c

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify without modifying files")
    args = parser.parse_args()
    icons = {"ashveil-trip": trip(), "ashveil-disarm": disarm()}
    labels = ["trip maneuver: a hooking boot against a shin", "disarm maneuver: open hand and detached knife"]
    artifacts: dict[str, bytes] = {}
    for (name, icon), label in zip(icons.items(), labels):
        artifacts[f"{name}.png"] = png(icon)
        artifacts[f"{name}.svg"] = svg(icon, label)
    artifacts["ashveil-maneuvers-contact.png"] = png(contact(icons))
    artifacts["ashveil-maneuvers-palette.json"] = (json.dumps(PALETTE, indent=2) + "\n").encode()
    records = [{"file": f"public/sprites/original/items/{name}", "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest()}
               for name, data in artifacts.items()]
    manifest = {
        "created": "2026-10-20", "method": "original manually authored integer-coordinate pixel art",
        "source": "tools/art/draw-maneuvers.py", "inputs": [],
        "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "iconSize": [32, 32], "pngColorType": 6, "alphaValues": [0, 255],
        "externalImageInputs": False, "modifiedExistingImages": False,
        "paletteNote": "Same original 19-color aged teal/ash/brass material palette; new maneuver silhouettes.",
        "rendererNote": "Reuses the project's original Canvas/PNG/SVG renderer pattern.",
        "frameSuggestions": {"trip": {"file": "ashveil-trip.png", "sheet": "original_trip", "frame": [0, 0, 32, 32]},
                             "disarm": {"file": "ashveil-disarm.png", "sheet": "original_disarm", "frame": [0, 0, 32, 32]}},
        "status": "prepared original art, not registered in the game",
        "files": records,
    }
    artifacts["ashveil-maneuvers-source.json"] = (
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
