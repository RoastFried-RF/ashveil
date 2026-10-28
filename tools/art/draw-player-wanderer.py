#!/usr/bin/env python3
"""Original CC0 ASHVEIL player-only traveller, authored integer geometry.

No image input or game import. Only this isolated pack's files are generated.
--check reconstructs products in memory and compares stored bytes read-only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[2]
ART = "public/sprites/original/"
PREFIX = "original_wanderer_hero"
DIRS = ("down", "left", "right", "up")
PALETTE = {
    "o": "#172327",  # cool, readable contour
    "k": "#252e30",  # hood opening, split coat
    "d": "#3b494b",  # hood deep fold
    "h": "#596766",  # ash-grey hood
    "H": "#80908a",  # worn hood ridge
    "c": "#4b504b",  # coat shadow
    "m": "#74776a",  # neutral dusty coat
    "l": "#969a89",  # coat lit plane
    "e": "#b7b7a0",  # small abraded cloth edge
    "v": "#5e635a",  # old lining
    "s": "#c4c1a6",  # small linen neck fold
    "b": "#443b35",  # leather shadow
    "r": "#6a5546",  # plain belt/hip pouch
    "R": "#93765b",  # worn leather edge
    "f": "#7d7064",  # skin shade
    "p": "#ac9680",  # neutral warm human skin
    "P": "#c9b29a",  # cheek/hand light
    "u": "#302e2b",  # boot
    "U": "#5a554a",  # boot welt
    "t": "#4b5554",  # trousers
    "T": "#77827a",  # trouser lit edge
    "a": "#76705c",  # plain cloth repair
}


class Canvas:
    def __init__(self, w: int, h: int, fill: str = "."):
        self.w, self.h = w, h
        self.p = [[fill] * w for _ in range(h)]

    def dot(self, x: int, y: int, color: str):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.p[y][x] = color

    def rect(self, x: int, y: int, w: int, h: int, color: str):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.dot(xx, yy, color)

    def line(self, x0: int, y0: int, x1: int, y1: int, color: str, width: int = 1):
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        error = dx + dy
        while True:
            self.rect(x0 - width // 2, y0 - width // 2, width, width, color)
            if x0 == x1 and y0 == y1:
                break
            e2 = error * 2
            if e2 >= dy:
                error += dy
                x0 += sx
            if e2 <= dx:
                error += dx
                y0 += sy

    def poly(self, points: list[tuple[int, int]], color: str):
        minx, maxx = min(x for x, y in points), max(x for x, y in points)
        miny, maxy = min(y for x, y in points), max(y for x, y in points)
        for y in range(miny, maxy + 1):
            for x in range(minx, maxx + 1):
                inside = False
                j = len(points) - 1
                for i, (xi, yi) in enumerate(points):
                    xj, yj = points[j]
                    if (yi > y + .5) != (yj > y + .5):
                        cross = (xj - xi) * (y + .5 - yi) / (yj - yi) + xi
                        if x + .5 < cross:
                            inside = not inside
                    j = i
                if inside:
                    self.dot(x, y, color)

    def paste(self, src: "Canvas", x: int, y: int, scale: int = 1):
        for yy, row in enumerate(src.p):
            for xx, color in enumerate(row):
                if color != ".":
                    self.rect(x + xx * scale, y + yy * scale, scale, scale, color)

    def flipped(self):
        out = Canvas(self.w, self.h)
        out.p = [list(reversed(row)) for row in self.p]
        return out


def hand(c: Canvas, x: int, y: int, shaded: bool = False):
    c.rect(x - 1, y - 1, 3, 3, "o")
    c.rect(x - 1, y - 1, 2, 2, "f" if shaded else "p")
    c.dot(x, y - 1, "p" if shaded else "P")


def arm(c: Canvas, path: list[tuple[int, int]], shaded: bool = False):
    for a, b in zip(path, path[1:]):
        c.line(*a, *b, "o", 4)
    for a, b in zip(path, path[1:]):
        c.line(*a, *b, "c" if shaded else "m", 2)
    a, b = path[0], path[1]
    c.line(a[0], a[1], b[0], b[1], "v" if shaded else "l")
    hand(c, *path[-1], shaded)


def boot(c: Canvas, x: int, top: int, width: int = 4, to_right: bool = False):
    c.rect(x - 1, top - 1, width + 1, 32 - top, "o")
    c.rect(x, top, width - 1, 30 - top, "u")
    c.rect(x, 29, width, 2, "u")
    c.line(x, 30, x + width - 1, 30, "U")
    if to_right:
        c.dot(x + width - 1, 29, "b")
    else:
        c.dot(x, 29, "b")


def legs_front(c: Canvas, step: int, attacking: bool):
    # Feet always meet the same baseline: last opaque row30, edge31.
    if attacking:
        x0, x1 = ((6, 15) if step == 2 else (7, 14))
    else:
        x0, x1 = ((7, 14), (5, 14), (7, 16))[step]
    c.poly([(7, 21), (12, 21), (11, 27), (x0 + 3, 29),
            (x0, 29), (x0, 25)], "o")
    c.poly([(12, 21), (17, 21), (18, 25), (x1 + 3, 29),
            (x1, 29), (12, 25)], "o")
    c.line(9, 23, x0 + 1, 27, "t", 3)
    c.line(14, 23, x1 + 1, 27, "t", 3)
    c.line(9, 24, x0, 27, "T")
    c.line(15, 24, x1 + 2, 27, "v")
    boot(c, x0, 28)
    boot(c, x1, 28, to_right=True)
    if not attacking and step == 1:
        c.rect(x1, 29, 4, 2, ".")
        c.line(x1, 28, x1 + 3, 28, "U")
    if not attacking and step == 2:
        c.rect(x0 - 1, 29, 5, 2, ".")
        c.line(x0, 28, x0 + 3, 28, "U")


def coat_front(c: Canvas, back: bool, phase: int = 0):
    c.poly([(7, 10), (16, 10), (19, 14), (18, 21), (20, 24),
            (15, 26), (12, 24), (8, 26), (4, 23), (6, 17), (5, 14)], "o")
    c.poly([(7, 12), (16, 12), (17, 17), (16, 21), (18, 23),
            (15, 24), (12, 22), (9, 24), (6, 22), (8, 17)], "m")
    if back:
        c.poly([(8, 13), (16, 13), (16, 20), (18, 23), (14, 24),
                (12, 22), (8, 24), (6, 22)], "c")
        c.line(10, 15, 9, 21, "m")
        c.line(14, 15, 15, 22, "l")
        c.line(11, 15, 12, 22, "v")
    else:
        c.poly([(8, 13), (11, 14), (11, 21), (9, 24), (6, 22)], "l")
        c.poly([(13, 13), (16, 13), (16, 21), (18, 23), (14, 24)], "c")
        c.line(13, 15, 14, 22, "m")
        c.line(12, 14, 12, 23, "k")
        c.line(7, 19, 9, 16, "e")
    # Unadorned short shoulder mantle, not plate armor.
    c.poly([(7, 10), (16, 10), (19, 13), (16, 15), (12, 13),
            (8, 15), (4, 13)], "c")
    c.poly([(7, 11), (16, 11), (17, 13), (15, 14), (12, 12),
            (8, 14), (6, 13)], "l")
    c.line(7, 11, 10, 11, "e")
    c.line(14, 12, 17, 13, "m")
    c.line(7, 19, 17, 19, "b")
    c.line(8, 19, 15, 19, "r")
    if not back:
        c.dot(12, 19, "e")
    # A plain repaired patch and a small cloth-covered hip pouch. No weapon.
    c.rect(7, 21, 2, 2, "a")
    c.dot(7, 21, "v")
    c.rect(3 if back else 16, 19, 4, 5, "o")
    c.rect(4 if back else 17, 20, 2, 3, "r")
    c.dot(4 if back else 17, 20, "R")


def hood_front(c: Canvas, back: bool):
    # New low angular crown and broad wrapped opening, not old hero geometry.
    c.poly([(9, 1), (14, 1), (17, 3), (18, 7), (17, 10),
            (14, 12), (8, 11), (6, 8), (6, 5), (7, 3)], "o")
    c.poly([(9, 2), (14, 2), (16, 4), (17, 7), (15, 10),
            (9, 10), (7, 7), (8, 4)], "h")
    c.line(9, 2, 13, 2, "H")
    c.line(8, 3, 7, 6, "H")
    c.line(15, 4, 16, 7, "d")
    if back:
        c.poly([(10, 3), (13, 3), (15, 5), (15, 8), (12, 10),
                (9, 8), (8, 5)], "d")
        c.line(10, 4, 12, 9, "h")
        c.line(11, 3, 14, 4, "H")
        c.line(9, 10, 14, 11, "l")
        return
    c.poly([(9, 4), (14, 4), (16, 7), (14, 10), (9, 10),
            (7, 7)], "k")
    c.poly([(10, 5), (13, 5), (15, 7), (13, 10), (10, 9),
            (9, 7)], "f")
    c.rect(10, 6, 4, 3, "p")
    c.dot(10, 6, "P")
    c.dot(13, 7, "P")
    c.dot(10, 6, "k")
    c.dot(13, 6, "k")
    c.dot(12, 7, "P")
    c.line(11, 9, 13, 9, "f")
    c.line(8, 4, 7, 7, "H")
    # Short neck fold: no beard, gender marker or costume emblem.
    c.poly([(8, 10), (14, 10), (16, 12), (12, 13), (8, 12)], "v")
    c.line(9, 10, 13, 11, "s")
    c.line(9, 12, 12, 12, "e")


def front(direction: str, frame: int, attacking: bool) -> Canvas:
    c = Canvas(32, 32)
    back = direction == "up"
    legs_front(c, frame if attacking else frame, attacking)
    if attacking:
        if back:
            paths = [
                ([(6, 13), (4, 15), (5, 18)], [(17, 13), (19, 15), (18, 18)]),
                ([(6, 13), (5, 10), (7, 7)], [(17, 13), (19, 10), (17, 7)]),
                ([(6, 13), (7, 8), (10, 5)], [(17, 13), (18, 8), (15, 5)]),
                ([(6, 13), (4, 12), (5, 10)], [(17, 13), (20, 12), (20, 15)]),
            ][frame]
        else:
            paths = [
                ([(6, 13), (4, 17), (6, 20)], [(17, 13), (19, 17), (17, 20)]),
                ([(6, 13), (4, 11), (7, 8)], [(17, 13), (19, 11), (18, 8)]),
                ([(6, 13), (8, 18), (10, 22)], [(17, 13), (15, 19), (13, 23)]),
                ([(6, 13), (4, 16), (6, 19)], [(17, 13), (19, 15), (20, 18)]),
            ][frame]
    else:
        paths = [
            ([(6, 13), (5, 17), (6, 21)], [(17, 13), (18, 17), (17, 21)]),
            ([(6, 13), (4, 16), (4, 19)], [(17, 13), (19, 18), (18, 22)]),
            ([(6, 13), (4, 18), (5, 22)], [(17, 13), (19, 16), (19, 19)]),
        ][frame]
    arm(c, paths[0], True)
    coat_front(c, back, frame)
    hood_front(c, back)
    arm(c, paths[1])
    if attacking and not back and frame in (1, 2):
        arm(c, paths[0], True)
    return c


def side(direction: str, frame: int, attacking: bool) -> Canvas:
    c = Canvas(32, 32)
    # All authored geometry faces right; left is a reflection of our own source.
    steps = [(9, 13), (7, 15), (11, 12)]
    x0, x1 = ((8, 15) if attacking and frame == 2 else
              (9, 14) if attacking else steps[frame])
    c.line(11, 22, x0 + 1, 27, "o", 5)
    c.line(13, 22, x1 + 1, 27, "o", 5)
    c.line(11, 23, x0 + 1, 27, "t", 3)
    c.line(14, 23, x1 + 1, 27, "T", 2)
    boot(c, x0, 28, 4, True)
    boot(c, x1, 28, 4, True)
    if not attacking and frame == 1:
        c.rect(x1 - 1, 29, 5, 2, ".")
        c.line(x1, 28, x1 + 3, 28, "U")
    if not attacking and frame == 2:
        c.rect(x0 - 1, 29, 5, 2, ".")
        c.line(x0, 28, x0 + 3, 28, "U")
    if attacking:
        far, near = [
            ([(10, 13), (10, 17), (13, 18)], [(15, 13), (17, 17), (16, 20)]),
            ([(10, 13), (9, 10), (12, 9)], [(15, 13), (13, 10), (14, 7)]),
            ([(10, 13), (17, 13), (21, 12)], [(15, 13), (20, 13), (25, 14)]),
            ([(10, 13), (12, 16), (15, 17)], [(15, 13), (18, 16), (20, 18)]),
        ][frame]
    else:
        far, near = [
            ([(10, 13), (9, 17), (10, 20)], [(15, 13), (15, 17), (16, 21)]),
            ([(10, 13), (12, 17), (14, 20)], [(15, 13), (12, 17), (11, 20)]),
            ([(10, 13), (8, 16), (7, 19)], [(15, 13), (17, 17), (18, 21)]),
        ][frame]
    arm(c, far, True)
    c.poly([(8, 10), (14, 10), (17, 14), (16, 21), (18, 24),
            (14, 26), (11, 24), (7, 25), (5, 22), (7, 16)], "o")
    c.poly([(9, 12), (14, 12), (15, 16), (14, 21), (16, 24),
            (13, 24), (10, 22), (7, 24), (7, 20)], "m")
    c.poly([(8, 13), (11, 13), (10, 21), (8, 23), (6, 22)], "c")
    c.line(13, 15, 13, 22, "l")
    c.line(10, 20, 11, 24, "v")
    c.poly([(8, 10), (14, 10), (17, 13), (14, 15), (11, 13),
            (7, 15), (5, 13)], "c")
    c.line(8, 11, 14, 12, "l", 2)
    c.dot(8, 11, "e")
    c.line(7, 19, 15, 19, "b")
    c.line(8, 19, 14, 19, "r")
    c.rect(6, 20, 4, 4, "o")
    c.rect(7, 20, 2, 3, "r")
    c.dot(7, 20, "R")
    c.rect(13, 21, 2, 2, "a")
    # Hood side has a low crown, a defined nose and a shaded open face.
    c.poly([(9, 1), (13, 1), (16, 3), (17, 6), (16, 10),
            (13, 12), (8, 10), (6, 7), (7, 3)], "o")
    c.poly([(9, 2), (13, 2), (15, 4), (16, 7), (14, 10),
            (9, 9), (7, 6), (8, 4)], "h")
    c.poly([(8, 5), (11, 3), (13, 4), (12, 9), (9, 9)], "d")
    c.line(9, 2, 13, 2, "H")
    c.line(8, 3, 7, 6, "H")
    c.poly([(13, 4), (16, 5), (16, 6), (18, 7), (17, 8),
            (16, 8), (15, 10), (12, 9), (12, 6)], "k")
    c.poly([(14, 5), (15, 5), (15, 7), (17, 7), (16, 8),
            (14, 9), (13, 8), (13, 6)], "p")
    c.dot(14, 5, "k")
    c.dot(15, 7, "P")
    c.dot(13, 8, "f")
    c.line(12, 10, 15, 11, "s")
    c.line(11, 11, 14, 12, "e")
    arm(c, near)
    # Crop to the same authored24px body coordinate system before reflecting.
    out = Canvas(24, 32)
    for yy in range(32):
        for xx in range(24):
            out.dot(xx, yy, c.p[yy][xx])
    if attacking:
        # Side strikes may extend to x26 beyond the walk cell; reflect around x11.5.
        out = Canvas(32, 40)
        for yy, row in enumerate(c.p):
            for xx, color in enumerate(row):
                if color != ".":
                    tx = (23 - xx if direction == "left" else xx) + 4
                    out.dot(tx, yy + 8, color)
        return out
    return out.flipped() if direction == "left" else out


def frame(direction: str, index: int, attacking: bool) -> Canvas:
    if direction in ("left", "right"):
        return side(direction, index, attacking)
    body = front(direction, index, attacking)
    out = Canvas(32, 40) if attacking else Canvas(24, 32)
    out.paste(body, 4 if attacking else 0, 8 if attacking else 0)
    return out


def rgba(color: str) -> bytes:
    if color == ".":
        return b"\0\0\0\0"
    return bytes.fromhex(PALETTE.get(color, color)[1:]) + b"\xff"


def png(c: Canvas) -> bytes:
    def chunk(kind, body):
        return struct.pack(">I", len(body)) + kind + body + struct.pack(">I", zlib.crc32(kind + body) & 0xffffffff)
    pixels = b"".join(b"\0" + b"".join(rgba(v) for v in row) for row in c.p)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", c.w, c.h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(pixels, 9)) + chunk(b"IEND", b"")


def svg(c: Canvas, title: str) -> bytes:
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.w}" height="{c.h}" viewBox="0 0 {c.w} {c.h}" shape-rendering="crispEdges">',
           f'<title>ASHVEIL original player traveller: {title}</title>',
           '<desc>New authored integer-coordinate geometry, CC0-1.0. No external image inputs.</desc>']
    for y, row in enumerate(c.p):
        x = 0
        while x < c.w:
            end = x + 1
            while end < c.w and row[end] == row[x]:
                end += 1
            if row[x] != ".":
                out.append(f'<rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{PALETTE[row[x]]}"/>')
            x = end
    return ("\n".join(out) + "\n</svg>\n").encode()


FONT = {
    "A": ["010", "101", "111", "101", "101"], "B": ["110", "101", "110", "101", "110"],
    "C": ["011", "100", "100", "100", "011"], "D": ["110", "101", "101", "101", "110"],
    "E": ["111", "100", "110", "100", "111"], "F": ["111", "100", "110", "100", "100"],
    "G": ["011", "100", "101", "101", "011"], "H": ["101", "101", "111", "101", "101"],
    "I": ["111", "010", "010", "010", "111"], "J": ["001", "001", "001", "101", "010"],
    "K": ["101", "101", "110", "101", "101"], "L": ["100", "100", "100", "100", "111"],
    "M": ["101", "111", "111", "101", "101"], "N": ["101", "111", "111", "111", "101"],
    "O": ["010", "101", "101", "101", "010"], "P": ["110", "101", "110", "100", "100"],
    "Q": ["010", "101", "101", "111", "011"], "R": ["110", "101", "110", "101", "101"],
    "S": ["011", "100", "010", "001", "110"], "T": ["111", "010", "010", "010", "010"],
    "U": ["101", "101", "101", "101", "111"], "V": ["101", "101", "101", "101", "010"],
    "W": ["101", "101", "111", "111", "101"], "X": ["101", "101", "010", "101", "101"],
    "Y": ["101", "101", "010", "010", "010"], "Z": ["111", "001", "010", "100", "111"],
    "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
    "2": ["110", "001", "010", "100", "111"], "3": ["110", "001", "010", "001", "110"],
    "4": ["101", "101", "111", "001", "001"], " ": ["000"] * 5,
}


def text(c, x, y, label, scale=2, color="#b7b7a0"):
    for ch in label:
        for yy, row in enumerate(FONT.get(ch, FONT[" "])):
            for xx, v in enumerate(row):
                if v == "1":
                    c.rect(x + xx * scale, y + yy * scale, scale, scale, color)
        x += 4 * scale


def contact(walk, attacks):
    c = Canvas(744, 1264, "#1b2427")
    text(c, 16, 12, "ASHVEIL PLAYER TRAVELLER", 3)
    text(c, 112, 44, "IDLE 0       WALK 1       WALK 2", 2)
    top = 64
    for row, d in enumerate(DIRS):
        y = top + row * 128
        text(c, 8, y + 52, d.upper(), 2)
        for f in range(3):
            x = 112 + f * 152
            c.rect(x, y, 144, 120, "#202c2e" if row % 2 else "#151c20")
            c.rect(x, y + 105, 144, 1, "#4b5553")
            c.paste(walk[d][f], x + 36, y + 12, 3)
    top = 608
    text(c, 112, 584, "READY 0     LIFT 1     STRIKE 2    RESET 3", 2)
    for row, d in enumerate(DIRS):
        y = top + row * 152
        text(c, 8, y + 62, d.upper(), 2)
        for f in range(4):
            x = 112 + f * 152
            c.rect(x, y, 144, 144, "#202c2e" if row % 2 else "#151c20")
            c.rect(x, y + 121, 144, 1, "#4b5553")
            c.paste(attacks[d][f], x + 24, y + 4, 3)
    text(c, 16, 1230, "CC0   NEW PIXELS   NO WEAPON LOCK", 2)
    return c


def encoded_json(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def outputs():
    walk = {d: [frame(d, f, False) for f in range(3)] for d in DIRS}
    attacks = {d: [frame(d, f, True) for f in range(4)] for d in DIRS}
    walk_sheet, attack_sheet = Canvas(72, 128), Canvas(128, 160)
    mapping = {"sheets": {PREFIX: "sprites/original/ashveil-player-wanderer-walk.png", PREFIX + "_atk": "sprites/original/ashveil-player-wanderer-attack.png"}, "frames": {}, "chars": {}}
    ch = {"walk": {}, "idle": {}, "attack": {}, "anchor": [.5, 31 / 32], "attackAnchor": [.5, 39 / 40], "renderScale": 1, "headOffset": 30}
    measurements = []
    for row, d in enumerate(DIRS):
        for kind, frames, sheet, cell, target in [("w", walk[d], PREFIX, (24, 32), walk_sheet), ("a", attacks[d], PREFIX + "_atk", (32, 40), attack_sheet)]:
            names = []
            for f, image in enumerate(frames):
                name = f"{PREFIX}_{kind}_{d}{f}"
                target.paste(image, f * cell[0], row * cell[1])
                mapping["frames"][name] = [sheet, f * cell[0], row * cell[1], *cell]
                names.append(name)
                occupied = [(x, y) for y, line in enumerate(image.p) for x, v in enumerate(line) if v != "."]
                measurements.append({"frame": name, "direction": d, "kind": kind, "index": f, "cell": list(cell), "boundsInclusive": [min(x for x, y in occupied), min(y for x, y in occupied), max(x for x, y in occupied), max(y for x, y in occupied)], "opaquePixels": len(occupied)})
            ch["walk" if kind == "w" else "attack"][d] = names
        ch["idle"][d] = [ch["walk"][d][0]]
    mapping["chars"][PREFIX] = ch
    products = {
        ART + "ashveil-player-wanderer-walk.png": png(walk_sheet),
        ART + "ashveil-player-wanderer-walk.svg": svg(walk_sheet, "12 walking poses"),
        ART + "ashveil-player-wanderer-attack.png": png(attack_sheet),
        ART + "ashveil-player-wanderer-attack.svg": svg(attack_sheet, "16 generic attack poses"),
        ART + "ashveil-player-wanderer-contact.png": png(contact(walk, attacks)),
        ART + "ashveil-player-wanderer-palette.json": encoded_json(PALETTE),
        ART + "ashveil-player-wanderer-frames.json": encoded_json(mapping),
        "tools/art/player-manifest.fragment.json": encoded_json(mapping),
    }
    records = [{"file": n, "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()} for n, b in products.items()]
    source = {"created": "2026-10-21", "license": "CC0-1.0", "commercialUseAllowed": True, "redistributionAndDerivativePackagesAllowed": True, "attributionRequired": False, "method": "new authored integer-coordinate geometry and original pose construction", "source": "tools/art/draw-player-wanderer.py", "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "referenceContract": "tools/art/player-reference-contract.json", "referenceContractSha256": hashlib.sha256((ROOT / "tools/art/player-reference-contract.json").read_bytes()).hexdigest(), "externalImageInputs": [], "existingHeroPixelsCopiedOrEdited": False, "integrationApplied": False, "playerOnlyProposedChar": PREFIX, "poses": 28, "walkPoses": 12, "attackPoses": 16, "idleReusesNewWalk0": True, "nativeWalkCell": [24, 32], "nativeAttackCell": [32, 40], "attackBodyOffset": [4, 8], "groundY": {"walk": 31, "attack": 39}, "headOffset": 30, "renderScale": 1, "paletteOpaqueColors": len(PALETTE), "alphaValues": [0, 255], "notEncoded": ["gender", "specific weapon", "armor/equipment statistics", "quality", "player identity or background", "collision shape", "gameplay state"], "visualInterpretation": "Neutral ash-grey hood and weathered dusty coat, a small linen neck fold and ordinary hip cloth pouch. Unarmed hand/shoulder gestures are generic animation, not a new combat style. Existing NPC/retiree hero is not replaced.", "measurements": measurements, "files": records}
    products[ART + "ashveil-player-wanderer-source.json"] = encoded_json(source)
    return products


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    products = outputs()
    for name, data in products.items():
        p = ROOT / name
        if args.check:
            assert p.read_bytes() == data, f"deterministic mismatch: {name}"
        else:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ") + f"{len(products)} files; original player-only28 poses")


if __name__ == "__main__":
    main()
