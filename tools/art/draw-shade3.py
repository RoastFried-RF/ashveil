#!/usr/bin/env python3
"""Draw original ASHVEIL shade3 walk/idle and new attack poses from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-shade3.py [--check]
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
    "e": "#d7d5c0",  # living pale skin highlight
    "j": "#b5b4a1",  # living pale skin shadow
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


DIRS = ["down", "left", "right", "up"]

def limb(c: Canvas, points: list[tuple[int, int]], fill: str = "c") -> None:
    for a, b in zip(points, points[1:]):
        for dx, dy in [(-1, 0), (0, -1), (1, 0), (0, 1)]:
            c.line(a[0] + dx, a[1] + dy, b[0] + dx, b[1] + dy, "o")
    for a, b in zip(points, points[1:]):
        c.line(*a, *b, fill)
    hx, hy = points[-1]
    c.rect(hx, hy, 2, 2, "j")
    c.point(hx, hy, "e")



def boots(c: Canvas, direction: str, step: int) -> None:
    # Own leg/shoe geometry: narrow legs, uneven cloth ankle wraps, one knee repair.
    if direction in ["down", "up"]:
        lx, rx = 8 + step, 13 - step
        left_lift, right_lift = (1 if step == 1 else 0), (1 if step == -1 else 0)
        c.polygon([(lx, 23), (lx + 3, 23), (lx + 3, 28 - left_lift),
                   (lx + 2, 29 - left_lift), (lx - 1, 29 - left_lift)], "o")
        c.line(lx + 1, 24, lx + 1, 27 - left_lift, "r")
        c.polygon([(rx, 23), (rx + 3, 23), (rx + 3, 29 - right_lift),
                   (rx, 29 - right_lift)], "o")
        c.line(rx + 1, 24, rx + 1, 27 - right_lift, "v")
        c.row(rx, 25, "cpo")
        c.point(rx + 1, 26, "c")
        c.row(lx - 1, 28 - left_lift, "occo")
        c.row(rx, 28 - right_lift, "owvo")
        c.row(lx - 1, 29 - left_lift, "orrbo")
        c.row(rx, 29 - right_lift, "obrr")
        c.row(lx - 1, 30 - left_lift, "ouuuo")
        c.row(rx, 30 - right_lift, "ouuo")
    else:
        near, far = 9 + step, 13 - step
        near_lift, far_lift = (1 if step == 1 else 0), (1 if step == -1 else 0)
        c.rect(far, 23, 3, 6 - far_lift, "o")
        c.line(far + 1, 24, far + 1, 27 - far_lift, "r")
        c.rect(near, 23, 3, 6 - near_lift, "o")
        c.line(near + 1, 24, near + 1, 27 - near_lift, "v")
        c.point(near + 1, 25, "p")
        if direction == "left":
            c.row(far - 1, 28 - far_lift, "ocvo")
            c.row(far - 2, 29 - far_lift, "orrro")
            c.row(far - 2, 30 - far_lift, "ouuuo")
            c.row(near - 1, 28 - near_lift, "ocvo")
            c.row(near - 2, 29 - near_lift, "onrro")
            c.row(near - 2, 30 - near_lift, "ouuuo")
        else:
            c.row(far, 28 - far_lift, "ovco")
            c.row(far, 29 - far_lift, "orrro")
            c.row(far, 30 - far_lift, "ouuuo")
            c.row(near, 28 - near_lift, "ovco")
            c.row(near, 29 - near_lift, "orrno")
            c.row(near, 30 - near_lift, "ouuuo")


def front(c: Canvas) -> None:
    # Broader shoulders, new frayed seams and a long diagonal mended shirt front.
    c.polygon([(8, 16), (13, 15), (17, 16), (19, 20), (18, 24),
               (16, 25), (13, 24), (11, 26), (8, 24), (5, 24), (5, 18)], "o")
    c.polygon([(8, 17), (13, 16), (16, 17), (17, 20), (17, 23),
               (14, 23), (11, 25), (9, 23), (6, 23), (6, 19)], "r")
    c.polygon([(8, 17), (11, 17), (11, 22), (9, 23), (6, 22),
               (7, 19)], "c")
    c.line(7, 19, 7, 21, "p")
    c.line(12, 17, 16, 21, "c")
    c.point(12, 18, "p")
    c.point(14, 20, "p")
    c.line(15, 21, 15, 23, "b")
    c.rect(5, 19, 3, 4, "c")
    c.row(5, 19, "pcc")
    c.point(6, 21, "w")
    c.line(8, 23, 16, 22, "b")
    c.line(8, 22, 15, 22, "n")
    c.point(13, 22, "v")
    c.rect(7, 24, 2, 3, "c")
    c.point(7, 26, "p")
    c.point(11, 24, "w")
    c.rect(11, 14, 3, 3, "j")
    # Plain side-swept cropped hair, exposed forehead and a broad stubbled chin.
    c.row(11, 9, "uuuo")
    c.row(10, 10, "ouuuuo")
    c.row(9, 11, "ouueejo")
    c.row(9, 12, "ojkekjo")
    c.row(9, 13, "ojeeejo")
    c.point(12, 13, "c")
    c.row(9, 14, "ojjjjjo")
    c.point(11, 14, "c")
    c.point(13, 14, "c")
    c.row(10, 15, "ojjjo")
    c.row(10, 16, "cjcc")


def back(c: Canvas) -> None:
    c.polygon([(8, 16), (13, 15), (17, 16), (19, 20), (18, 24),
               (16, 25), (13, 24), (11, 26), (8, 24), (5, 24), (5, 18)], "o")
    c.polygon([(8, 17), (13, 16), (16, 17), (17, 20), (17, 23),
               (14, 23), (11, 25), (9, 23), (6, 23), (6, 19)], "r")
    c.polygon([(9, 17), (12, 17), (13, 21), (11, 24), (9, 22)], "c")
    c.line(10, 18, 10, 21, "w")
    c.line(13, 18, 16, 20, "b")
    c.point(14, 18, "c")
    c.point(16, 20, "p")
    c.rect(15, 19, 3, 4, "c")
    c.row(15, 19, "ccp")
    c.point(16, 21, "w")
    c.line(7, 22, 16, 22, "n")
    c.rect(15, 24, 2, 3, "c")
    c.point(16, 26, "p")
    c.point(11, 24, "w")
    c.row(11, 9, "uuuo")
    c.row(10, 10, "ouuuuo")
    c.row(9, 11, "ouuvuuo")
    c.row(9, 12, "ouuuuoo")
    c.row(9, 13, "ouuvuuo")
    c.row(10, 14, "ouuuo")
    c.row(10, 15, "ojjjo")
    c.row(10, 16, "cjcc")


def side(c: Canvas, direction: str) -> None:
    if direction == "left":
        c.polygon([(10, 16), (15, 16), (18, 18), (18, 23), (16, 25),
                   (13, 24), (10, 26), (7, 24), (7, 19)], "o")
        c.polygon([(10, 17), (14, 17), (16, 19), (16, 23), (13, 23),
                   (10, 24), (8, 23), (8, 19)], "r")
        c.line(10, 18, 9, 22, "c")
        c.line(13, 18, 16, 21, "c")
        c.point(14, 20, "p")
        c.rect(7, 20, 3, 3, "c")
        c.point(7, 20, "p")
        c.line(8, 22, 16, 22, "n")
        c.rect(9, 24, 2, 3, "c")
        c.point(9, 26, "p")
        c.row(10, 9, "ouuuo")
        c.row(9, 10, "ouuuuoo")
        c.row(8, 11, "ojeuuuo")
        c.row(7, 12, "ojkeuuo")
        c.row(7, 13, "oejeejo")
        c.row(8, 14, "ojjjjo")
        c.point(9, 14, "c")
        c.row(9, 15, "ojjjo")
        c.row(10, 16, "cjcc")
    else:
        c.polygon([(8, 16), (13, 16), (16, 18), (18, 21), (17, 24),
                   (14, 26), (11, 24), (7, 25), (6, 20)], "o")
        c.polygon([(9, 17), (13, 17), (15, 19), (16, 22), (14, 24),
                   (11, 23), (8, 24), (7, 20)], "r")
        c.line(10, 18, 13, 21, "c")
        c.point(11, 19, "p")
        c.line(15, 20, 15, 23, "b")
        c.line(8, 22, 15, 22, "n")
        c.rect(13, 24, 2, 3, "c")
        c.point(14, 26, "p")
        c.row(10, 9, "ouuuo")
        c.row(9, 10, "ouuuuoo")
        c.row(9, 11, "ouueejo")
        c.row(10, 12, "ouekjo")
        c.row(10, 13, "ojjeeeo")
        c.row(10, 14, "ojjjjo")
        c.point(14, 14, "c")
        c.row(10, 15, "ojjjo")
        c.row(10, 16, "ccjc")


def walking(direction: str, step: int, arms: bool = True) -> Canvas:
    c = Canvas(24, 32)
    boots(c, direction, step)
    if direction == "down":
        front(c)
        if arms:
            limb(c, [(6, 18), (4, 21), (6 + step, 23)], "c")
            limb(c, [(17, 17), (19, 20), (17 - step, 23)], "r")
            c.point(4, 20, "p")
    elif direction == "up":
        if arms:
            limb(c, [(6, 18), (4, 21), (6 - step, 23)], "c")
            limb(c, [(17, 17), (19, 20), (17 + step, 23)], "r")
        back(c)
    elif direction == "left":
        if arms:
            limb(c, [(14, 17), (16, 20), (14 + step, 22)], "r")
        side(c, direction)
        if arms:
            limb(c, [(9, 18), (7, 21), (9 - step, 23)], "c")
            c.point(7, 20, "p")
    else:
        if arms:
            limb(c, [(9, 17), (7, 20), (9 - step, 22)], "r")
        side(c, direction)
        if arms:
            limb(c, [(14, 18), (17, 21), (15 + step, 23)], "r")
            c.point(17, 20, "c")
    return c


def attack(direction: str, pose: int) -> Canvas:
    c = Canvas(32, 40)
    c.blit(walking(direction, 0, False), 4, 8)
    # NEW attacks: changed shoulder/elbow paths authored for this distinct body.
    paths = {
        "down": [[(17, 18), (18, 21), (16, 22)],
                 [(17, 18), (20, 17), (21, 14)],
                 [(17, 18), (18, 23), (19, 27)],
                 [(17, 18), (20, 21), (17, 24)]],
        "up": [[(17, 18), (18, 16), (17, 14)],
               [(17, 18), (21, 15), (22, 11)],
               [(17, 18), (19, 12), (20, 7)],
               [(17, 18), (19, 17), (20, 14)]],
        "left": [[(10, 18), (7, 20), (6, 18)],
                 [(10, 18), (6, 15), (7, 11)],
                 [(10, 18), (5, 16), (0, 14)],
                 [(10, 18), (7, 20), (4, 21)]],
        "right": [[(14, 18), (17, 20), (18, 18)],
                  [(14, 18), (18, 15), (17, 11)],
                  [(14, 18), (19, 16), (23, 14)],
                  [(14, 18), (17, 20), (20, 21)]],
    }
    limb(c, [(x + 4, y + 8) for x, y in paths[direction][pose]], "r")
    other = {"down": [(6, 18), (5, 20), (8, 22)],
             "up": [(6, 18), (5, 20), (8, 21)],
             "left": [(14, 17), (16, 19), (13, 21)],
             "right": [(9, 17), (7, 19), (10, 21)]}[direction]
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
    sheets = {"shade3": "sprites/original/ashveil-shade3-walk.png",
              "shade3_atk": "sprites/original/ashveil-shade3-attack.png"}
    frames, walk, idle, strike = {}, {}, {}, {}
    for row, direction in enumerate(DIRS):
        walk[direction] = [f"shade3_w_{direction}{col}" for col in range(3)]
        idle[direction] = [f"shade3_w_{direction}1"]
        strike[direction] = [f"shade3_a_{direction}{col}" for col in range(4)]
        for col, key in enumerate(walk[direction]):
            frames[key] = ["shade3", col * 24, row * 32, 24, 32]
        for col, key in enumerate(strike[direction]):
            frames[key] = ["shade3_atk", col * 32, row * 40, 32, 40]
    return {"sheets": sheets, "frames": frames, "chars": {"shade3": {
        "walk": walk, "idle": idle, "attack": strike, "anchor": [0.5, 31 / 32],
        "attackAnchor": [0.5, 39 / 40], "renderScale": 1, "headOffset": 22}}}

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
    assert set(mapping["sheets"]) == {"shade3", "shade3_atk"}
    assert set(mapping["chars"]) == {"shade3"}
    assert 39 - 8 == 31
    for direction in DIRS:
        assert len({png(pose) for pose in walks[direction]}) == 3
        assert len({png(pose) for pose in attacks[direction]}) == 4
        assert mapping["chars"]["shade3"]["idle"][direction] == [f"shade3_w_{direction}1"]
    for direction_poses in [walks, attacks]:
        for poses in direction_poses.values():
            for pose in poses:
                occupied = [(x, y) for y, row in enumerate(pose.pixels)
                            for x, value in enumerate(row) if value != "."]
                assert occupied and all(0 < x < pose.width - 1 and 0 < y < pose.height - 1
                                        for x, y in occupied)
    artifacts = {
        "public/sprites/original/ashveil-shade3-walk.png": png(walk_sheet),
        "public/sprites/original/ashveil-shade3-attack.png": png(attack_sheet),
        "public/sprites/original/ashveil-shade3-walk.svg": svg(walk_sheet, "shade3 original 12 walk and idle poses"),
        "public/sprites/original/ashveil-shade3-attack.svg": svg(attack_sheet, "shade3 original 16 newly authored attack poses"),
        "public/sprites/original/ashveil-shade3-contact.png": png(contact(walks, attacks)),
        "public/sprites/original/ashveil-shade3-palette.json": (json.dumps(PALETTE, indent=2) + "\n").encode(),
        "tools/art/shade3-manifest.fragment.json": (json.dumps(mapping, indent=2) + "\n").encode(),
    }
    records = [{"file": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
               for name, data in artifacts.items()]
    origin = {
        "created": "2026-10-20", "method": "original manually authored integer-coordinate human sprite poses",
        "source": "tools/art/draw-shade3.py", "inputs": [],
        "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "externalImageInputs": False, "modifiedExistingImages": False,
        "legacyContract": {"walkCell": [24, 32], "walkCount": 12, "idleColumn": 1,
                           "legacyAttackExists": False, "previousAnchor": [0.5, 0.92], "legacySheet": "mon1",
                           "legacyX": [0, 24, 48], "legacyY": [128, 160, 192, 224]},
        "newContent": {"walkCount": 12, "attackCount": 16, "attackCell": [32, 40],
                       "bodyOffsetInAttack": [4, 8], "walkGroundY": 31, "attackGroundY": 39},
        "directions": DIRS, "status": "prepared art and merge fragment, not registered in the game",
        "files": records,
    }
    artifacts["public/sprites/original/ashveil-shade3-source.json"] = (
        json.dumps(origin, indent=2, ensure_ascii=False) + "\n").encode()
    if args.check:
        for name, data in artifacts.items():
            assert (ROOT / name).read_bytes() == data, f"regeneration differs: {name}"
        print(f"Verified {len(artifacts)} deterministic original shade3 files, 12 walk + 16 new attack poses.")
    else:
        for name, data in artifacts.items():
            target = ROOT / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        print(f"Wrote {len(artifacts)} original shade3 files, 12 walk + 16 new attack poses.")


if __name__ == "__main__":
    main()
