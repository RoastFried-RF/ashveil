#!/usr/bin/env python3
"""Draw original ASHVEIL six-legged Tender Drone directional poses from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-drone.py [--check]
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
    "o": "#172329", "k": "#252629", "u": "#384347", "v": "#65716d",
    "w": "#939b8e", "p": "#b3b5a0", "c": "#7c7d6f", "b": "#302c29",
    "r": "#4c463b", "n": "#77624b", "a": "#b3844f", "g": "#d0b778",
    "d": "#2d4145", "t": "#3d5958", "m": "#62756b", "l": "#91a197",
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


def strut(c: Canvas, points: list[tuple[int, int]], fill: str = "v") -> None:
    for p0, p1 in zip(points, points[1:]):
        for dx, dy in [(-1, 0), (0, -1), (1, 0), (0, 1)]:
            c.line(p0[0] + dx, p0[1] + dy, p1[0] + dx, p1[1] + dy, "o")
    for p0, p1 in zip(points, points[1:]):
        c.line(*p0, *p1, fill)
    if len(points) > 2:
        x, y = points[1]
        c.rect(x - 1, y - 1, 3, 3, "u")
        c.point(x, y, "a")


def legs(c: Canvas, direction: str, phase: int, inert: bool) -> None:
    if direction in ["down", "up"]:
        geometry = [((10, 18), (6, 19), (3, 24)),
                    ((9, 21), (5, 23), (3, 27)),
                    ((11, 23), (8, 27), (7, 30)),
                    ((22, 18), (26, 19), (29, 24)),
                    ((23, 21), (27, 23), (29, 27)),
                    ((21, 23), (24, 27), (25, 30))]
    else:
        geometry = [((11, 18), (7, 17), (3, 22)),
                    ((16, 18), (16, 15), (16, 18)),
                    ((21, 18), (25, 17), (29, 22)),
                    ((11, 23), (7, 26), (5, 29)),
                    ((16, 24), (16, 27), (16, 30)),
                    ((21, 23), (25, 26), (28, 30))]
    for index, (root, knee, foot) in enumerate(geometry):
        if inert:
            kx = 16 + (knee[0] - 16) * 2 // 3
            ky = min(29, knee[1] + 3)
            fx = 16 + (foot[0] - 16) * 2 // 3
            fy = min(30, foot[1] + 2)
            points = [(root[0], min(28, root[1] + 3)), (kx, ky), (fx, fy - 1)]
        else:
            group = 1 if index % 2 else -1
            lift = 1 if phase != 0 and group == phase else 0
            shift = phase * group
            fx = foot[0] + (shift if 3 < foot[0] < 29 else 0)
            fy = foot[1] - lift
            # One member of the low tripod always stays on the y=31 ground edge.
            if index == 5 and phase == 1:
                fy = foot[1]
            points = [root, (knee[0], knee[1] - lift), (fx, fy - 1)]
        strut(c, points, "u" if inert or index < 3 else "v")
        fx, fy = points[-1]
        fy += 1
        c.row(fx - 1, fy, "uvo" if not inert else "uru")
        if not inert and index >= 3:
            c.point(fx - 1, fy, "w")


def shell(c: Canvas, direction: str, inert: bool) -> None:
    shift = 3 if inert else 0
    if direction in ["down", "up"]:
        points = [(12, 14), (20, 14), (24, 17), (25, 22), (21, 25),
                  (11, 25), (7, 22), (8, 17)]
        c.polygon([(x, y + shift) for x, y in points], "o")
        c.polygon([(12, 15 + shift), (20, 15 + shift), (23, 18 + shift),
                   (23, 22 + shift), (20, 24 + shift), (12, 24 + shift),
                   (9, 21 + shift), (10, 18 + shift)], "t")
        c.polygon([(19, 16 + shift), (22, 18 + shift), (23, 22 + shift),
                   (20, 24 + shift), (17, 23 + shift), (18, 19 + shift)], "d")
        c.line(11, 17 + shift, 14, 15 + shift, "m")
        c.line(10, 18 + shift, 10, 20 + shift, "l")
        c.line(12, 23 + shift, 19, 23 + shift, "u")
        c.rect(11, 18 + shift, 4, 3, "c")
        c.row(11, 18 + shift, "wccc")
        c.point(11, 20 + shift, "a")
        c.point(14, 19 + shift, "r")
        c.point(21, 18 + shift, "a")
        c.point(20, 22 + shift, "c")
        # Three distinct dorsal cooling plates, not insect wings or feathers.
        for x, top in [(13, 12), (16, 11), (19, 12)]:
            c.rect(x - 1, top + shift, 3, 7, "o")
            c.line(x, top + shift, x, 17 + shift, "v")
            c.line(x + 1, top + 1 + shift, x + 1, 17 + shift, "u")
            c.point(x, top + shift, "w")
            c.point(x + 1, top + 1 + shift, "c")
        sy = (22 if direction == "down" else 14) + shift
        c.rect(13, sy, 7, 4, "o")
        c.rect(14, sy + 1, 5, 2, "u")
        c.row(15, sy + 1, "ngn" if not inert else "vuv")
        c.point(14, sy + 1, "a" if not inert else "r")
        if direction == "up":
            c.rect(13, 23 + shift, 7, 2, "u")
            c.row(14, 23 + shift, "vrvrv")
    else:
        points = [(10, 16), (22, 16), (26, 19), (25, 24), (21, 26),
                  (10, 25), (6, 22), (7, 18)]
        c.polygon([(x, y + shift) for x, y in points], "o")
        c.polygon([(11, 17 + shift), (21, 17 + shift), (24, 19 + shift),
                   (23, 23 + shift), (20, 24 + shift), (11, 23 + shift),
                   (8, 21 + shift), (9, 19 + shift)], "t")
        c.polygon([(20, 18 + shift), (24, 20 + shift), (23, 23 + shift),
                   (19, 24 + shift), (15, 23 + shift)], "d")
        c.line(10, 18 + shift, 15, 17 + shift, "m")
        c.point(10, 18 + shift, "l")
        c.line(11, 23 + shift, 20, 24 + shift, "u")
        c.rect(16, 19 + shift, 5, 3, "c")
        c.row(16, 19 + shift, "wcccc")
        c.point(20, 21 + shift, "a")
        c.point(17, 20 + shift, "r")
        # Perspective changes plate spacing while retaining the same three fins.
        for x, top in [(12, 13), (16, 11), (20, 12)]:
            c.polygon([(x - 1, top + shift), (x + 1, top - 1 + shift),
                       (x + 2, 18 + shift), (x - 1, 18 + shift)], "o")
            c.line(x, top + shift, x + 1, 17 + shift, "v")
            c.line(x + 1, top + 1 + shift, x + 2, 17 + shift, "u")
            c.point(x, top + shift, "w")
        sx = 7 if direction == "left" else 23
        c.rect(sx, 18 + shift, 4, 5, "o")
        c.rect(sx + 1, 19 + shift, 2, 3, "u")
        c.point(sx + (1 if direction == "left" else 2), 20 + shift,
                "g" if not inert else "u")
        c.point(sx + 1, 19 + shift, "n" if not inert else "r")
    # Faded pipe fittings and irregular material wear are deliberately restrained.
    c.point(11, 21 + shift, "n")
    c.point(12, 22 + shift, "a")
    c.point(21, 21 + shift, "u")


def tools(c: Canvas, direction: str, inert: bool = False,
          pose: int | None = None, offset: tuple[int, int] = (0, 0)) -> None:
    vectors = {"down": (0, 1), "up": (0, -1), "left": (-1, 0), "right": (1, 0)}
    roots = {"down": ((20, 22), (12, 22)), "up": ((20, 16), (12, 16)),
             "left": ((11, 23), (11, 19)), "right": ((21, 23), (21, 19))}
    centers = {"down": [(22, 24), (24, 23), (22, 26), (23, 25)],
               "up": [(22, 13), (24, 14), (22, 10), (23, 12)],
               "left": [(8, 22), (9, 19), (5, 21), (7, 22)],
               "right": [(24, 22), (23, 19), (27, 21), (25, 22)]}
    nozzle = {"down": (10, 25), "up": (10, 12), "left": (6, 17), "right": (26, 17)}
    dx, dy = vectors[direction]
    px, py = -dy, dx
    p0, n0 = roots[direction]
    joint = centers[direction][pose or 0]
    spread = [2, 3, 0, 2][pose or 0]
    length = 3
    if inert:
        p0 = (p0[0], min(28, p0[1] + 3))
        n0 = (n0[0], min(28, n0[1] + 3))
        joint = {"down": (18, 25), "up": (18, 20),
                 "left": (12, 25), "right": (20, 25)}[direction]
        spread, length = 1, 1
    ox, oy = offset
    def shifted(point: tuple[int, int]) -> tuple[int, int]:
        return point[0] + ox, point[1] + oy
    mid = ((p0[0] + joint[0]) // 2, (p0[1] + joint[1]) // 2)
    strut(c, [shifted(p0), shifted(mid), shifted(joint)], "u" if inert else "v")
    jx, jy = shifted(joint)
    c.rect(jx - 1, jy - 1, 3, 3, "u")
    c.point(jx, jy, "n" if inert else "a")
    # Two angular opposed cutting jaws; closing does not turn them into organic teeth.
    for sign in [-1, 1]:
        elbow = (jx + dx + px * 2 * sign, jy + dy + py * 2 * sign)
        end = (jx + dx * length + px * spread * sign,
               jy + dy * length + py * spread * sign)
        strut(c, [(jx, jy), elbow, end], "v" if not inert else "u")
        c.point(*end, "w" if not inert else "v")
    tip = nozzle[direction]
    if pose == 2:
        tip = (tip[0] + dx * 2, tip[1] + dy * 2)
    if inert:
        tip = ((tip[0] + n0[0]) // 2, min(28, (tip[1] + n0[1]) // 2 + 3))
    strut(c, [shifted(n0), shifted(tip)], "u")
    tx, ty = shifted(tip)
    c.point(tx, ty, "n" if inert else "a")
    c.point(tx + px, ty + py, "u")
    # No welded flame: the current renderer does not select attack animations by attack ID.


def walking(direction: str, phase: int, inert: bool = False) -> Canvas:
    c = Canvas(32, 32)
    legs(c, direction, phase, inert)
    shell(c, direction, inert)
    tools(c, direction, inert)
    return c


def attack(direction: str, pose: int) -> Canvas:
    c = Canvas(40, 40)
    body = Canvas(32, 32)
    legs(body, direction, 0, False)
    shell(body, direction, False)
    c.blit(body, 4, 8)
    tools(c, direction, False, pose, (4, 8))
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


def contact(walks: dict[str, list[Canvas]], attacks: dict[str, list[Canvas]],
            dormant: dict[str, Canvas]) -> Canvas:
    c = Canvas(752, 1512, "#11191f")
    text(c, "WALK", 16, 8)
    for row, direction in enumerate(DIRS):
        y = 32 + row * 140
        c.rect(8, y - 4, 736, 136, "#1b272c")
        text(c, direction[0].upper(), 20, y + 48, 4)
        for col, pose in enumerate(walks[direction]):
            c.blit(pose, 112 + col * 176, y, 4)
    text(c, "ATTACK", 16, 592)
    for row, direction in enumerate(DIRS):
        y = 616 + row * 168
        c.rect(8, y - 4, 736, 164, "#1b272c")
        text(c, direction[0].upper(), 20, y + 64, 4)
        for col, pose in enumerate(attacks[direction]):
            c.blit(pose, 64 + col * 168, y, 4)
    text(c, "INERT", 16, 1296)
    c.rect(8, 1320, 736, 184, "#1b272c")
    for col, direction in enumerate(DIRS):
        x = 64 + col * 168
        text(c, direction[0].upper(), x + 48, 1328, 2)
        c.blit(dormant[direction], x, 1360, 4)
    return c


def fragment() -> dict:
    sheets = {"tender_drone": "sprites/original/ashveil-drone-walk.png",
              "tender_drone_atk": "sprites/original/ashveil-drone-attack.png",
              "tender_drone_inert": "sprites/original/ashveil-drone-inert.png"}
    frames, walk, idle, strike, inert_walk = {}, {}, {}, {}, {}
    for row, direction in enumerate(DIRS):
        walk[direction] = [f"tender_drone_w_{direction}{col}" for col in range(3)]
        idle[direction] = [f"tender_drone_w_{direction}1"]
        strike[direction] = [f"tender_drone_a_{direction}{col}" for col in range(4)]
        inert_walk[direction] = [f"tender_drone_i_{direction}"]
        for col, key in enumerate(walk[direction]):
            frames[key] = ["tender_drone", col * 32, row * 32, 32, 32]
        for col, key in enumerate(strike[direction]):
            frames[key] = ["tender_drone_atk", col * 40, row * 40, 40, 40]
        frames[inert_walk[direction][0]] = ["tender_drone_inert", 0, row * 32, 32, 32]
    # Preserve BOTH existing static frame keys as aliases for external frame consumers.
    frames["tender_drone"] = frames["tender_drone_w_down1"].copy()
    frames["tender_drone_inert"] = frames["tender_drone_i_down"].copy()
    return {"sheets": sheets, "frames": frames, "chars": {
        "tender_drone": {"walk": walk, "idle": idle, "attack": strike,
                         "anchor": [0.5, 31 / 32], "attackAnchor": [0.5, 39 / 40],
                         "renderScale": 0.75, "headOffset": 17},
        "tender_drone_inert": {"walk": inert_walk, "idle": inert_walk,
                               "anchor": [0.5, 31 / 32], "renderScale": 0.75, "headOffset": 17}}}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify without modifying files")
    args = parser.parse_args()
    walks = {direction: [walking(direction, phase) for phase in [-1, 0, 1]] for direction in DIRS}
    attacks = {direction: [attack(direction, pose) for pose in range(4)] for direction in DIRS}
    dormant = {direction: walking(direction, 0, True) for direction in DIRS}
    walk_sheet, attack_sheet, inert_sheet = Canvas(96, 128), Canvas(160, 160), Canvas(32, 128)
    for row, direction in enumerate(DIRS):
        for col, pose in enumerate(walks[direction]):
            walk_sheet.blit(pose, col * 32, row * 32)
        for col, pose in enumerate(attacks[direction]):
            attack_sheet.blit(pose, col * 40, row * 40)
        inert_sheet.blit(dormant[direction], 0, row * 32)
    mapping = fragment()
    assert len(mapping["frames"]) == 34
    assert set(mapping["sheets"]) == {"tender_drone", "tender_drone_atk", "tender_drone_inert"}
    assert set(mapping["chars"]) == {"tender_drone", "tender_drone_inert"}
    assert 39 - 8 == 31
    for direction in DIRS:
        assert len({png(pose) for pose in walks[direction]}) == 3
        assert len({png(pose) for pose in attacks[direction]}) == 4
    assert len({png(pose) for pose in dormant.values()}) == 4
    for pose in [p for poses in walks.values() for p in poses] + list(dormant.values()) + [p for poses in attacks.values() for p in poses]:
        occupied = [(x, y) for y, row in enumerate(pose.pixels) for x, color in enumerate(row) if color != "."]
        assert occupied and all(0 < x < pose.width - 1 and 0 < y < pose.height - 1 for x, y in occupied)
    artifacts = {
        "public/sprites/original/ashveil-drone-walk.png": png(walk_sheet),
        "public/sprites/original/ashveil-drone-attack.png": png(attack_sheet),
        "public/sprites/original/ashveil-drone-inert.png": png(inert_sheet),
        "public/sprites/original/ashveil-drone-walk.svg": svg(walk_sheet, "new directional six-legged repair-drone walk poses"),
        "public/sprites/original/ashveil-drone-attack.svg": svg(attack_sheet, "new maintenance manipulator deployment and cutting poses"),
        "public/sprites/original/ashveil-drone-inert.svg": svg(inert_sheet, "directional inactive repair-drone poses"),
        "public/sprites/original/ashveil-drone-contact.png": png(contact(walks, attacks, dormant)),
        "public/sprites/original/ashveil-drone-palette.json": (json.dumps(PALETTE, indent=2) + "\n").encode(),
        "tools/art/drone-manifest.fragment.json": (json.dumps(mapping, indent=2) + "\n").encode(),
    }
    records = [{"file": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
               for name, data in artifacts.items()]
    origin = {
        "created": "2026-10-21", "method": "original authored pixel geometry of a six-legged mechanical maintenance drone",
        "source": "tools/art/draw-drone.py", "inputs": [],
        "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "externalImageInputs": False, "modifiedExistingImages": False,
        "coreContract": {"creature": "Creature.TenderDrone", "body": "Body.TenderDrone", "legCount": 6,
                         "sprite": "tender_drone", "dormantChar": "tender_drone_inert", "attacks": ["cut", "weld"]},
        "legacyContract": {"frameKeys": ["tender_drone", "tender_drone_inert"], "frameSize": [32, 32],
                           "sharedSingleFrameForAllDirections": True, "legacyAttackExists": False,
                           "anchor": [0.5, 0.8], "implicitScale": 0.72},
        "newContent": {"walkCount": 12, "attackCount": 16, "inertCount": 4, "legacyFrameAliases": 2,
                       "walkCell": [32, 32], "attackCell": [40, 40], "inertCell": [32, 32],
                       "bodyOffsetInAttack": [4, 8], "walkGroundY": 31, "attackGroundY": 39,
                       "renderScale": 0.75, "headOffsetWorldPx": 17},
        "attackVisualNote": "Common tool-arm deployment; no permanent welding flame because renderer does not select a sheet by cut/weld attack ID.",
        "directions": DIRS, "status": "prepared original art and merge fragment, not registered in the game",
        "files": records,
    }
    artifacts["public/sprites/original/ashveil-drone-source.json"] = (json.dumps(origin, indent=2) + "\n").encode()
    if args.check:
        for name, data in artifacts.items():
            assert (ROOT / name).read_bytes() == data, f"regeneration differs: {name}"
        print(f"Verified {len(artifacts)} deterministic drone files; 12 new walks, 16 new attacks, 4 inert poses, 2 preserved frame aliases.")
    else:
        for name, data in artifacts.items():
            target = ROOT / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        print(f"Wrote {len(artifacts)} original drone files and a merge-only fragment.")


if __name__ == "__main__":
    main()
