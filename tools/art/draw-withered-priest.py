#!/usr/bin/env python3
"""Draw original ASHVEIL withered_priest walk/idle and new attack poses from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-withered-priest.py [--check]
Only writes its own new art files under public/sprites/original/ plus its own manifest fragment.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/sprites/original"
PALETTE = {
    "o": "#242123", "k": "#3a302d", "s": "#705e53", "a": "#927c68",
    "f": "#b29b82", "F": "#d0b99b", "x": "#81786d", "l": "#8d6557",
    "d": "#4b4c46", "c": "#74766b", "p": "#a4a492", "h": "#cbc8ad",
    "b": "#322c28", "r": "#51483e", "n": "#7f6b4d", "t": "#465654",
    "m": "#68766c", "u": "#353c38", "v": "#666b65", "w": "#969a89",
    "B": "#9b7c50", "g": "#b49a6b",
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


DIRS = ["down", "left", "right", "up"]


def limb(c: Canvas, points: list[tuple[int, int]], fill: str = "c") -> None:
    for a, b in zip(points, points[1:]):
        for dx, dy in [(-1, 0), (0, -1), (1, 0), (0, 1)]:
            c.line(a[0] + dx, a[1] + dy, b[0] + dx, b[1] + dy, "o")
    for a, b in zip(points, points[1:]):
        c.line(*a, *b, fill)
    hx, hy = points[-1]
    c.rect(hx, hy, 2, 2, "a")
    c.point(hx, hy, "f")


def censer(c: Canvas, hand: tuple[int, int], bowl: tuple[int, int]) -> None:
    # A closed, unlit metal censer: no flame, magical light, smoke or green aura.
    hx, hy = hand
    cx, cy = bowl
    c.line(hx, hy + 1, cx, cy - 1, "r")
    c.line(hx + 1, hy + 1, cx + 1, cy - 1, "v")
    c.point(hx, hy + 1, "n")
    c.point(cx, cy - 1, "u")
    c.polygon([(cx - 2, cy), (cx + 2, cy), (cx + 3, cy + 2),
               (cx + 1, cy + 4), (cx - 1, cy + 4), (cx - 3, cy + 2)], "o")
    c.row(cx - 1, cy, "BvB")
    c.row(cx - 2, cy + 1, "BvvvB")
    c.row(cx - 2, cy + 2, "uvkvu")
    c.row(cx - 1, cy + 3, "vuv")
    c.point(cx - 1, cy + 1, "w")
    c.point(cx + 1, cy + 3, "B")


def feet(c: Canvas, direction: str, step: int) -> None:
    # Living feet with skin and one old cloth wrap; no exposed bones or skeleton toes.
    if direction in ["down", "up"]:
        lx, rx = 8 + step, 13 - step
        left_lift, right_lift = (1 if step == 1 else 0), (1 if step == -1 else 0)
        c.rect(lx, 26, 3, 4 - left_lift, "o")
        c.rect(rx, 26, 3, 4 - right_lift, "o")
        c.line(lx + 1, 27, lx + 1, 29 - left_lift, "a")
        c.line(rx + 1, 27, rx + 1, 29 - right_lift, "c")
        c.row(lx - 1, 29 - left_lift, "osfao")
        c.row(rx, 29 - right_lift, "ocpo")
        c.row(lx - 1, 30 - left_lift, "osaso")
        c.row(rx, 30 - right_lift, "osao")
    else:
        near, far = 9 + step, 13 - step
        near_lift, far_lift = (1 if step == 1 else 0), (1 if step == -1 else 0)
        c.rect(far, 26, 3, 4 - far_lift, "o")
        c.rect(near, 26, 3, 4 - near_lift, "o")
        c.line(far + 1, 27, far + 1, 29 - far_lift, "a")
        c.line(near + 1, 27, near + 1, 29 - near_lift, "c")
        if direction == "left":
            c.row(far - 2, 29 - far_lift, "osfao")
            c.row(far - 2, 30 - far_lift, "osaso")
            c.row(near - 2, 29 - near_lift, "ofpco")
            c.row(near - 2, 30 - near_lift, "osaso")
        else:
            c.row(far, 29 - far_lift, "oafso")
            c.row(far, 30 - far_lift, "osaso")
            c.row(near, 29 - near_lift, "ocpfo")
            c.row(near, 30 - near_lift, "osaso")


def front(c: Canvas) -> None:
    # An old work-worn monastic robe, visibly fuller than the ordinary patient shirt.
    c.polygon([(9, 12), (14, 12), (18, 15), (17, 20), (18, 24),
               (20, 28), (18, 30), (14, 29), (12, 30), (8, 29),
               (5, 30), (4, 28), (7, 20), (6, 16)], "o")
    c.polygon([(9, 13), (13, 13), (16, 15), (15, 20), (17, 27),
               (18, 28), (14, 28), (12, 29), (9, 28), (6, 29),
               (5, 27), (8, 20), (7, 16)], "c")
    c.polygon([(13, 15), (16, 16), (15, 20), (18, 28), (15, 28),
               (13, 24), (12, 19)], "d")
    c.line(7, 18, 8, 15, "p")
    c.line(8, 23, 6, 27, "p")
    c.line(11, 22, 10, 27, "p")
    c.line(14, 24, 15, 27, "m")
    c.point(7, 28, "h")
    c.point(13, 28, "p")
    # Folded collar and an asymmetrical strip of old cloth, without sacred symbols.
    c.line(9, 13, 11, 17, "h")
    c.line(14, 13, 12, 17, "p")
    c.line(10, 14, 11, 16, "p")
    c.rect(8, 17, 2, 8, "p")
    c.line(9, 19, 9, 24, "c")
    c.point(8, 25, "h")
    c.line(7, 20, 15, 21, "r")
    c.line(8, 20, 15, 20, "n")
    c.point(12, 21, "B")
    c.line(12, 22, 10, 26, "n")
    c.point(10, 27, "r")
    c.rect(11, 10, 3, 3, "a")
    # Continuous living skin, cheeks, nose and lips surround small dark pupils.
    c.row(11, 4, "kkk")
    c.row(10, 5, "osffso")
    c.row(9, 6, "osfFfso")
    c.row(9, 7, "ofkFkfo")
    c.row(9, 8, "osfaffo")
    c.row(10, 9, "oallao")
    c.row(10, 10, "osaaao")
    c.row(11, 11, "sasa")
    c.row(10, 12, "cahc")
    c.point(10, 8, "x")


def back(c: Canvas) -> None:
    c.polygon([(9, 12), (14, 12), (18, 15), (17, 20), (18, 24),
               (20, 28), (18, 30), (14, 29), (12, 30), (8, 29),
               (5, 30), (4, 28), (7, 20), (6, 16)], "o")
    c.polygon([(9, 13), (13, 13), (16, 15), (15, 20), (17, 27),
               (18, 28), (14, 28), (12, 29), (9, 28), (6, 29),
               (5, 27), (8, 20), (7, 16)], "c")
    c.polygon([(11, 14), (14, 15), (14, 20), (17, 27), (14, 28),
               (11, 22)], "d")
    c.line(7, 18, 8, 15, "p")
    c.line(8, 23, 6, 27, "p")
    c.line(12, 22, 12, 27, "m")
    c.line(16, 24, 18, 28, "p")
    c.line(8, 20, 16, 20, "n")
    c.line(13, 21, 15, 26, "r")
    c.point(7, 28, "h")
    c.point(13, 28, "p")
    c.line(9, 13, 11, 16, "p")
    c.line(14, 13, 12, 16, "p")
    c.row(11, 4, "kkk")
    c.row(10, 5, "okkkko")
    c.row(9, 6, "okkxkko")
    c.row(9, 7, "okffkko")
    c.row(9, 8, "okakkko")
    c.row(10, 9, "oksako")
    c.row(10, 10, "osaaao")
    c.row(11, 11, "sasa")
    c.row(10, 12, "cahc")


def side(c: Canvas, direction: str) -> None:
    if direction == "left":
        c.polygon([(10, 12), (15, 12), (18, 15), (17, 20), (18, 27),
                   (20, 29), (16, 30), (13, 29), (10, 30), (6, 29),
                   (5, 27), (8, 20), (7, 15)], "o")
        c.polygon([(10, 13), (14, 13), (16, 16), (15, 20), (17, 27),
                   (18, 28), (14, 28), (11, 29), (7, 28), (6, 27),
                   (9, 20), (8, 16)], "c")
        c.line(9, 15, 9, 18, "p")
        c.line(9, 22, 7, 27, "p")
        c.line(13, 21, 14, 27, "d")
        c.line(9, 20, 16, 20, "n")
        c.line(11, 21, 10, 26, "r")
        c.line(10, 13, 11, 17, "h")
        c.rect(9, 17, 2, 7, "p")
        c.point(9, 25, "h")
        c.row(11, 4, "kk")
        c.row(10, 5, "osffo")
        c.row(9, 6, "osffso")
        c.row(8, 7, "ofkafso")
        c.row(7, 8, "ofFafso")
        c.row(8, 9, "oslaao")
        c.row(9, 10, "osaao")
        c.row(10, 11, "saas")
        c.point(14, 8, "a")
    else:
        c.polygon([(8, 12), (13, 12), (17, 15), (17, 20), (20, 27),
                   (19, 29), (15, 30), (12, 29), (9, 30), (5, 29),
                   (5, 27), (8, 20), (6, 15)], "o")
        c.polygon([(9, 13), (13, 13), (15, 16), (15, 20), (18, 27),
                   (18, 28), (15, 28), (12, 29), (9, 28), (6, 28),
                   (6, 27), (9, 20), (7, 16)], "c")
        c.line(13, 15, 14, 18, "p")
        c.line(15, 22, 17, 27, "p")
        c.line(10, 21, 9, 27, "d")
        c.line(8, 20, 16, 20, "n")
        c.line(14, 21, 15, 26, "r")
        c.line(13, 13, 12, 17, "h")
        c.rect(11, 17, 2, 7, "p")
        c.point(12, 25, "h")
        c.row(10, 4, "kkk")
        c.row(9, 5, "osffso")
        c.row(9, 6, "osfFfso")
        c.row(10, 7, "osFakfo")
        c.row(10, 8, "osfafFo")
        c.row(10, 9, "oaalso")
        c.row(10, 10, "osaaao")
        c.row(10, 11, "saas")
        c.point(10, 8, "a")


def walking(direction: str, step: int, arms: bool = True) -> Canvas:
    c = Canvas(24, 32)
    feet(c, direction, step)
    if direction == "down":
        front(c)
        if arms:
            limb(c, [(7, 15), (5, 18), (8, 20)], "p")
            hand = (17 + step, 19)
            limb(c, [(17, 15), (18, 17), hand], "c")
            censer(c, hand, (18 + step, 23 + abs(step)))
    elif direction == "up":
        if arms:
            limb(c, [(17, 15), (18, 18), (16, 20)], "p")
            hand = (6 - step, 19)
            limb(c, [(7, 15), (5, 17), hand], "c")
            censer(c, hand, (5 - step, 23 + abs(step)))
        back(c)
    elif direction == "left":
        if arms:
            limb(c, [(14, 15), (16, 18), (13, 20)], "d")
        side(c, direction)
        if arms:
            hand = (7 + step, 19)
            limb(c, [(9, 15), (7, 17), hand], "p")
            censer(c, hand, (5 + step, 23 + abs(step)))
    else:
        if arms:
            limb(c, [(9, 15), (7, 18), (10, 20)], "d")
        side(c, direction)
        if arms:
            hand = (16 - step, 19)
            limb(c, [(15, 15), (17, 17), hand], "p")
            censer(c, hand, (18 - step, 23 + abs(step)))
    return c


def attack(direction: str, pose: int) -> Canvas:
    c = Canvas(32, 40)
    c.blit(walking(direction, 0, False), 4, 8)
    # NEW censer motion: preparation, lift, downward/forward strike, recovery.
    paths = {
        "down": [[(17, 15), (18, 17), (18, 18)],
                 [(17, 15), (20, 14), (20, 11)],
                 [(17, 15), (20, 18), (21, 20)],
                 [(17, 15), (20, 18), (18, 19)]],
        "up": [[(7, 15), (5, 16), (5, 17)],
               [(7, 15), (4, 12), (4, 9)],
               [(7, 15), (7, 10), (7, 7)],
               [(7, 15), (5, 16), (5, 14)]],
        "left": [[(9, 15), (7, 17), (6, 18)],
                 [(9, 15), (7, 12), (8, 10)],
                 [(9, 15), (5, 16), (2, 18)],
                 [(9, 15), (7, 18), (6, 19)]],
        "right": [[(15, 15), (17, 17), (18, 18)],
                  [(15, 15), (17, 12), (16, 10)],
                  [(15, 15), (19, 16), (21, 18)],
                  [(15, 15), (17, 18), (18, 19)]],
    }
    bowls = {"down": [(21, 24), (21, 9), (22, 25), (20, 23)],
             "up": [(3, 23), (3, 3), (5, -1), (3, 18)],
             "left": [(4, 24), (6, 5), (0, 23), (4, 23)],
             "right": [(20, 24), (18, 5), (23, 23), (20, 23)]}
    active = [(x + 4, y + 8) for x, y in paths[direction][pose]]
    limb(c, active, "p")
    bx, by = bowls[direction][pose]
    censer(c, active[-1], (bx + 4, by + 8))
    other = {"down": [(7, 15), (6, 18), (10, 20)],
             "up": [(17, 15), (18, 18), (15, 20)],
             "left": [(14, 15), (16, 18), (13, 20)],
             "right": [(9, 15), (7, 18), (10, 20)]}[direction]
    limb(c, [(x + 4, y + 8) for x, y in other], "c")
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


def text(c: Canvas, value: str, x0: int, y0: int, scale: int = 2) -> None:
    for index, letter in enumerate(value):
        if letter == " ":
            continue
        for y, row in enumerate(FONT[letter]):
            for x, bit in enumerate(row):
                if bit == "1":
                    c.rect(x0 + index * 6 * scale + x * scale, y0 + y * scale,
                           scale, scale, "p")


def contact(walks: dict[str, list[Canvas]], attacks: dict[str, list[Canvas]]) -> Canvas:
    c = Canvas(640, 1304, "#11191f")
    text(c, "WALK", 16, 8)
    for row, direction in enumerate(DIRS):
        y = 32 + row * 140
        c.rect(8, y - 4, 624, 136, "#1b272c")
        text(c, direction[0].upper(), 20, y + 48, 4)
        for col, pose in enumerate(walks[direction]):
            c.blit(pose, 96 + col * 128, y, 4)
    text(c, "ATTACK", 16, 592)
    for row, direction in enumerate(DIRS):
        y = 616 + row * 168
        c.rect(8, y - 4, 624, 164, "#1b272c")
        text(c, direction[0].upper(), 20, y + 64, 4)
        for col, pose in enumerate(attacks[direction]):
            c.blit(pose, 64 + col * 136, y, 4)
    return c


def fragment() -> dict:
    sheets = {"withered_priest": "sprites/original/ashveil-withered-priest-walk.png",
              "withered_priest_atk": "sprites/original/ashveil-withered-priest-attack.png"}
    frames, walk, idle, strike = {}, {}, {}, {}
    for row, direction in enumerate(DIRS):
        walk[direction] = [f"withered_priest_w_{direction}{col}" for col in range(3)]
        idle[direction] = [f"withered_priest_w_{direction}1"]
        strike[direction] = [f"withered_priest_a_{direction}{col}" for col in range(4)]
        for col, key in enumerate(walk[direction]):
            frames[key] = ["withered_priest", col * 24, row * 32, 24, 32]
        for col, key in enumerate(strike[direction]):
            frames[key] = ["withered_priest_atk", col * 32, row * 40, 32, 40]
    return {"sheets": sheets, "frames": frames, "chars": {"withered_priest": {
        "walk": walk, "idle": idle, "attack": strike, "anchor": [0.5, 31 / 32],
        "attackAnchor": [0.5, 39 / 40], "renderScale": 1, "headOffset": 27}}}

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify without modifying files")
    args = parser.parse_args()
    walks = {direction: [walking(direction, step) for step in [-1, 0, 1]] for direction in DIRS}
    attacks = {direction: [attack(direction, pose) for pose in range(4)] for direction in DIRS}
    walk_sheet, attack_sheet = Canvas(72, 128), Canvas(128, 160)
    for row, direction in enumerate(DIRS):
        for col, pose in enumerate(walks[direction]):
            walk_sheet.blit(pose, col * 24, row * 32)
        for col, pose in enumerate(attacks[direction]):
            attack_sheet.blit(pose, col * 32, row * 40)
    # These light asset checks validate frame contracts, never game/Core behavior.
    mapping = fragment()
    assert len(mapping["frames"]) == 28
    assert set(mapping["sheets"]) == {"withered_priest", "withered_priest_atk"}
    assert set(mapping["chars"]) == {"withered_priest"}
    assert 39 - 8 == 31
    for direction in DIRS:
        assert len({png(pose) for pose in walks[direction]}) == 3
        assert len({png(pose) for pose in attacks[direction]}) == 4
        assert mapping["chars"]["withered_priest"]["idle"][direction] == [f"withered_priest_w_{direction}1"]
    for direction_poses in [walks, attacks]:
        for poses in direction_poses.values():
            for pose in poses:
                occupied = [(x, y) for y, row in enumerate(pose.pixels)
                            for x, value in enumerate(row) if value != "."]
                assert occupied and all(0 < x < pose.width - 1 and 0 < y < pose.height - 1
                                        for x, y in occupied)
    artifacts = {
        "public/sprites/original/ashveil-withered-priest-walk.png": png(walk_sheet),
        "public/sprites/original/ashveil-withered-priest-attack.png": png(attack_sheet),
        "public/sprites/original/ashveil-withered-priest-walk.svg": svg(walk_sheet, "withered_priest original 12 walk and idle poses"),
        "public/sprites/original/ashveil-withered-priest-attack.svg": svg(attack_sheet, "withered_priest original 16 newly authored attack poses"),
        "public/sprites/original/ashveil-withered-priest-contact.png": png(contact(walks, attacks)),
        "public/sprites/original/ashveil-withered-priest-palette.json": (json.dumps(PALETTE, indent=2) + "\n").encode(),
        "tools/art/withered-priest-manifest.fragment.json": (json.dumps(mapping, indent=2) + "\n").encode(),
    }
    records = [{"file": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
               for name, data in artifacts.items()]
    origin = {
        "created": "2026-10-20", "method": "original manually authored integer-coordinate human sprite poses",
        "source": "tools/art/draw-withered-priest.py", "inputs": [],
        "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "externalImageInputs": False, "modifiedExistingImages": False,
        "legacyContract": {"walkCell": [24, 32], "walkCount": 12, "idleColumn": 1,
                           "legacyAttackExists": False, "previousAnchor": [0.5, 0.92], "legacySheet": "mon1_withered",
                           "legacyX": [144, 168, 192], "legacyY": [128, 160, 192, 224]},
        "newContent": {"walkCount": 12, "attackCount": 16, "attackCell": [32, 40],
                       "bodyOffsetInAttack": [4, 8], "bodyHeight": 27, "walkGroundY": 31, "attackGroundY": 39},
        "directions": DIRS, "status": "prepared art and merge fragment, not registered in the game",
        "files": records,
    }
    artifacts["public/sprites/original/ashveil-withered-priest-source.json"] = (
        json.dumps(origin, indent=2, ensure_ascii=False) + "\n").encode()
    if args.check:
        for name, data in artifacts.items():
            assert (ROOT / name).read_bytes() == data, f"regeneration differs: {name}"
        print(f"Verified {len(artifacts)} deterministic original withered_priest files, 12 walk + 16 new attack poses.")
    else:
        for name, data in artifacts.items():
            target = ROOT / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        print(f"Wrote {len(artifacts)} original withered_priest files, 12 walk + 16 new attack poses.")


if __name__ == "__main__":
    main()
