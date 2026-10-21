#!/usr/bin/env python3
"""Draw original ASHVEIL shade1 walk/idle and new attack poses from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-shade1.py [--check]
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
    # Last sole row is y=30: its lower edge is exactly the y=31 ground anchor.
    if direction in ["down", "up"]:
        lx, rx = 7 + step, 13 - step
        left_lift, right_lift = (1 if step == 1 else 0), (1 if step == -1 else 0)
        c.rect(lx + 1, 23, 3, 6 - left_lift, "o")
        c.rect(rx, 23, 3, 6 - right_lift, "o")
        c.line(lx + 2, 24, lx + 2, 27 - left_lift, "v")
        c.line(rx + 1, 24, rx + 1, 27 - right_lift, "u")
        c.rect(lx, 28 - left_lift, 4, 3, "b")
        c.rect(rx, 28 - right_lift, 4, 3, "b")
        c.row(lx, 28 - left_lift, "nrrb")
        c.row(rx, 28 - right_lift, "rrnb")
        c.row(lx, 30 - left_lift, "ouuo")
        c.row(rx, 30 - right_lift, "ouuo")
    else:
        near, far = 9 + step, 12 - step
        near_lift, far_lift = (1 if step == 1 else 0), (1 if step == -1 else 0)
        c.rect(far, 23, 3, 6 - far_lift, "o")
        c.line(far + 1, 24, far + 1, 27 - far_lift, "u")
        c.rect(near, 23, 3, 6 - near_lift, "o")
        c.line(near + 1, 24, near + 1, 27 - near_lift, "v")
        if direction == "left":
            c.rect(far - 1, 28 - far_lift, 4, 3, "b")
            c.rect(near - 2, 28 - near_lift, 5, 3, "b")
            c.row(near - 2, 28 - near_lift, "nrrrb")
            c.row(far - 1, 30 - far_lift, "ouuo")
            c.row(near - 2, 30 - near_lift, "ouuuo")
        else:
            c.rect(far, 28 - far_lift, 4, 3, "b")
            c.rect(near, 28 - near_lift, 5, 3, "b")
            c.row(near, 28 - near_lift, "brrrn")
            c.row(far, 30 - far_lift, "ouuo")
            c.row(near, 30 - near_lift, "ouuuo")


def front(c: Canvas) -> None:
    # Small adult in a repaired shirt; no pointed ears, fangs, skull or huge head.
    c.polygon([(8, 16), (14, 15), (18, 17), (19, 23), (17, 25),
               (14, 24), (12, 25), (9, 24), (6, 25), (5, 22), (6, 18)], "o")
    c.polygon([(8, 17), (14, 16), (17, 18), (17, 23), (15, 23),
               (12, 24), (9, 23), (7, 24), (6, 21), (7, 18)], "c")
    c.line(8, 18, 7, 21, "p")
    c.line(9, 19, 9, 23, "w")
    c.polygon([(14, 17), (17, 18), (17, 23), (15, 24), (13, 22)], "r")
    c.rect(14, 18, 4, 4, "d")
    c.rect(14, 18, 3, 3, "t")
    c.point(14, 18, "m")
    c.point(16, 20, "m")
    c.point(15, 18, "p")
    c.point(17, 21, "p")
    c.line(7, 22, 16, 23, "b")
    c.line(8, 22, 16, 23, "n")
    c.point(12, 23, "a")
    c.rect(16, 23, 2, 4, "d")
    c.line(16, 24, 16, 26, "t")
    c.point(17, 27, "m")
    c.rect(10, 15, 4, 2, "j")
    # Cropped ash-brown hair and a narrow worn cloth headband leave the face open.
    c.row(10, 9, "ouuuo")
    c.row(9, 10, "ouuuuoo")
    c.row(9, 11, "ocpppco")
    c.row(9, 12, "ojeeejo")
    c.row(9, 13, "ojkekjo")
    c.row(9, 14, "ojeeejo")
    c.point(12, 14, "c")
    c.row(10, 15, "ojjjo")
    c.row(10, 16, "cjpc")
    c.point(8, 12, "c")
    c.line(8, 13, 7, 17, "c")
    c.point(7, 15, "p")


def back(c: Canvas) -> None:
    c.polygon([(8, 16), (14, 15), (18, 17), (19, 23), (17, 25),
               (14, 24), (12, 25), (9, 24), (6, 25), (5, 22), (6, 18)], "o")
    c.polygon([(8, 17), (14, 16), (17, 18), (17, 23), (15, 23),
               (12, 24), (9, 23), (7, 24), (6, 21), (7, 18)], "c")
    c.line(8, 18, 7, 21, "p")
    c.line(12, 17, 12, 22, "r")
    c.line(15, 18, 16, 22, "w")
    # The same one-sided patch and hanging cloth are seen from the reverse side.
    c.rect(6, 18, 4, 4, "d")
    c.rect(7, 18, 3, 3, "t")
    c.point(7, 18, "m")
    c.point(9, 20, "m")
    c.point(8, 18, "p")
    c.point(6, 21, "p")
    c.line(7, 22, 16, 23, "b")
    c.line(8, 22, 16, 23, "n")
    c.rect(6, 23, 2, 4, "d")
    c.line(7, 24, 7, 26, "t")
    c.point(6, 27, "m")
    c.row(10, 9, "ouuuo")
    c.row(9, 10, "ouuuuoo")
    c.row(9, 11, "ocpppco")
    c.row(9, 12, "ouuuuoo")
    c.row(9, 13, "ouuvuoo")
    c.row(10, 14, "ouuuo")
    c.row(10, 15, "ojjjo")
    c.row(10, 16, "cjpc")
    c.line(15, 12, 16, 17, "c")
    c.point(16, 14, "p")


def side(c: Canvas, direction: str) -> None:
    # Side views are separately drawn coordinate arrangements, never PNG flips.
    if direction == "left":
        c.polygon([(10, 16), (15, 16), (18, 19), (17, 24), (14, 25),
                   (12, 24), (9, 25), (7, 23), (8, 18)], "o")
        c.polygon([(10, 17), (14, 17), (16, 19), (16, 23), (13, 24),
                   (10, 23), (8, 23), (9, 19)], "c")
        c.line(10, 18, 9, 22, "p")
        c.line(14, 18, 15, 22, "r")
        c.rect(8, 18, 3, 4, "d")
        c.rect(8, 18, 2, 3, "t")
        c.point(8, 18, "m")
        c.point(10, 20, "p")
        c.line(9, 23, 16, 23, "n")
        c.rect(9, 24, 2, 3, "d")
        c.point(9, 26, "m")
        c.row(10, 9, "ouuuo")
        c.row(9, 10, "ouuuuuo")
        c.row(8, 11, "ocpppco")
        c.row(8, 12, "ojkeujo")
        c.row(7, 13, "oejeejo")
        c.row(8, 14, "ojjeoo")
        c.point(13, 13, "p")
        c.row(9, 15, "ojjjo")
        c.row(10, 16, "cpjc")
        c.line(14, 12, 15, 17, "c")
        c.point(15, 15, "p")
    else:
        c.polygon([(9, 16), (14, 16), (17, 18), (18, 23), (16, 25),
                   (13, 24), (11, 25), (7, 24), (6, 19)], "o")
        c.polygon([(9, 17), (13, 17), (16, 19), (16, 23), (14, 24),
                   (11, 23), (8, 23), (7, 20)], "c")
        c.line(13, 18, 15, 22, "p")
        c.line(9, 18, 8, 22, "r")
        c.rect(7, 21, 3, 3, "d")
        c.rect(7, 21, 2, 2, "t")
        c.point(7, 21, "m")
        c.line(8, 23, 15, 23, "n")
        c.rect(15, 24, 2, 3, "d")
        c.point(16, 26, "m")
        c.row(9, 9, "ouuuo")
        c.row(8, 10, "ouuuuuo")
        c.row(9, 11, "ocpppco")
        c.row(9, 12, "ojuekjo")
        c.row(10, 13, "ojjeeeo")
        c.row(10, 14, "oojjjo")
        c.point(10, 13, "p")
        c.row(10, 15, "ojjjo")
        c.row(10, 16, "cjpc")
        c.line(8, 12, 7, 17, "c")
        c.point(7, 15, "p")


def walking(direction: str, step: int, arms: bool = True) -> Canvas:
    c = Canvas(24, 32)
    boots(c, direction, step)
    if direction == "down":
        front(c)
        if arms:
            limb(c, [(6, 18), (5, 20), (6 - step, 23)], "c")
            limb(c, [(18, 18), (18, 20), (18 + step, 23)], "r")
            c.point(5, 19, "p")
    elif direction == "up":
        if arms:
            limb(c, [(6, 18), (5, 20), (6 + step, 23)], "c")
            limb(c, [(18, 18), (18, 20), (18 - step, 23)], "r")
        back(c)
    elif direction == "left":
        if arms:
            limb(c, [(14, 18), (15, 21), (15 - step, 23)], "r")
        side(c, direction)
        if arms:
            limb(c, [(9, 18), (8, 20), (8 + step, 23)], "c")
            c.point(8, 19, "t")
    else:
        if arms:
            limb(c, [(9, 18), (8, 21), (8 + step, 23)], "r")
        side(c, direction)
        if arms:
            limb(c, [(15, 18), (16, 20), (16 - step, 23)], "c")
            c.point(16, 19, "w")
    return c


def attack(direction: str, pose: int) -> Canvas:
    c = Canvas(32, 40)
    c.blit(walking(direction, 0, False), 4, 8)
    # These are 16 NEW attack poses, not a pre-existing legacy attack animation.
    # One open-hand/shoulder motion supports the actual equipped-weapon effect.
    paths = {
        "down": [[(17, 18), (19, 20), (18, 20)],
                 [(17, 18), (20, 16), (19, 12)],
                 [(17, 18), (20, 22), (22, 26)],
                 [(17, 18), (20, 19), (18, 22)]],
        "up": [[(16, 18), (18, 17), (18, 14)],
               [(16, 18), (19, 14), (20, 11)],
               [(16, 18), (18, 12), (17, 7)],
               [(16, 18), (19, 16), (18, 13)]],
        "left": [[(9, 18), (6, 17), (5, 15)],
                 [(9, 18), (7, 14), (10, 10)],
                 [(9, 18), (4, 18), (0, 17)],
                 [(9, 18), (7, 19), (5, 19)]],
        "right": [[(15, 18), (18, 17), (19, 15)],
                  [(15, 18), (17, 14), (14, 10)],
                  [(15, 18), (20, 18), (23, 17)],
                  [(15, 18), (17, 19), (19, 19)]],
    }
    arm_points = [(x + 4, y + 8) for x, y in paths[direction][pose]]
    limb(c, arm_points, "c" if direction in ["left", "right"] else "r")
    other = {"down": [(6, 18), (5, 21), (7, 22)],
             "up": [(6, 18), (5, 20), (6, 21)],
             "left": [(14, 18), (15, 20), (13, 21)],
             "right": [(9, 18), (8, 20), (10, 21)]}[direction]
    limb(c, [(x + 4, y + 8) for x, y in other], "r")
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
    sheets = {"shade1": "sprites/original/ashveil-shade1-walk.png",
              "shade1_atk": "sprites/original/ashveil-shade1-attack.png"}
    frames, walk, idle, strike = {}, {}, {}, {}
    for row, direction in enumerate(DIRS):
        walk[direction] = [f"shade1_w_{direction}{col}" for col in range(3)]
        idle[direction] = [f"shade1_w_{direction}1"]
        strike[direction] = [f"shade1_a_{direction}{col}" for col in range(4)]
        for col, key in enumerate(walk[direction]):
            frames[key] = ["shade1", col * 24, row * 32, 24, 32]
        for col, key in enumerate(strike[direction]):
            frames[key] = ["shade1_atk", col * 32, row * 40, 32, 40]
    return {"sheets": sheets, "frames": frames, "chars": {"shade1": {
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
    assert set(mapping["sheets"]) == {"shade1", "shade1_atk"}
    assert set(mapping["chars"]) == {"shade1"}
    assert 39 - 8 == 31
    for direction in DIRS:
        assert len({png(pose) for pose in walks[direction]}) == 3
        assert len({png(pose) for pose in attacks[direction]}) == 4
        assert mapping["chars"]["shade1"]["idle"][direction] == [f"shade1_w_{direction}1"]
    for direction_poses in [walks, attacks]:
        for poses in direction_poses.values():
            for pose in poses:
                occupied = [(x, y) for y, row in enumerate(pose.pixels)
                            for x, value in enumerate(row) if value != "."]
                assert occupied and all(0 < x < pose.width - 1 and 0 < y < pose.height - 1
                                        for x, y in occupied)
    artifacts = {
        "public/sprites/original/ashveil-shade1-walk.png": png(walk_sheet),
        "public/sprites/original/ashveil-shade1-attack.png": png(attack_sheet),
        "public/sprites/original/ashveil-shade1-walk.svg": svg(walk_sheet, "shade1 original 12 walk and idle poses"),
        "public/sprites/original/ashveil-shade1-attack.svg": svg(attack_sheet, "shade1 original 16 newly authored attack poses"),
        "public/sprites/original/ashveil-shade1-contact.png": png(contact(walks, attacks)),
        "public/sprites/original/ashveil-shade1-palette.json": (json.dumps(PALETTE, indent=2) + "\n").encode(),
        "tools/art/shade1-manifest.fragment.json": (json.dumps(mapping, indent=2) + "\n").encode(),
    }
    records = [{"file": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
               for name, data in artifacts.items()]
    origin = {
        "created": "2026-10-20", "method": "original manually authored integer-coordinate human sprite poses",
        "source": "tools/art/draw-shade1.py", "inputs": [],
        "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "externalImageInputs": False, "modifiedExistingImages": False,
        "legacyContract": {"walkCell": [24, 32], "walkCount": 12, "idleColumn": 1,
                           "legacyAttackExists": False, "previousAnchor": [0.5, 0.92]},
        "newContent": {"walkCount": 12, "attackCount": 16, "attackCell": [32, 40],
                       "bodyOffsetInAttack": [4, 8], "walkGroundY": 31, "attackGroundY": 39},
        "directions": DIRS, "status": "prepared art and merge fragment, not registered in the game",
        "files": records,
    }
    artifacts["public/sprites/original/ashveil-shade1-source.json"] = (
        json.dumps(origin, indent=2, ensure_ascii=False) + "\n").encode()
    if args.check:
        for name, data in artifacts.items():
            assert (ROOT / name).read_bytes() == data, f"regeneration differs: {name}"
        print(f"Verified {len(artifacts)} deterministic original shade1 files, 12 walk + 16 new attack poses.")
    else:
        for name, data in artifacts.items():
            target = ROOT / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        print(f"Wrote {len(artifacts)} original shade1 files, 12 walk + 16 new attack poses.")


if __name__ == "__main__":
    main()
