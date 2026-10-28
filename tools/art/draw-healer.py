#!/usr/bin/env python3
"""Draw original ASHVEIL resident_healer daily-clothing adult poses from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-healer.py [--check]
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
    "o": "#1d2526", "k": "#3d332d", "s": "#805e48", "f": "#b88b69",
    "e": "#d8ad87", "j": "#a67d60", "c": "#8a8a75", "d": "#354643",
    "t": "#536562", "m": "#809086", "l": "#aaaf98", "p": "#b5af94",
    "h": "#d5cdb0", "v": "#627171", "u": "#343f42", "w": "#949c89",
    "b": "#392f2a", "r": "#65503e", "n": "#937553", "a": "#ad875b",
    "g": "#d0b17a",
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



USAGE_SURVEY = json.loads(r'''{
  "created": "2026-10-21",
  "doctorFamily": [
    {
      "id": "Creature.SettlementDoctor",
      "label": "의사",
      "parent": "Creature.Settler",
      "char": "hero",
      "loadout": {
        "slots": [
          {
            "items": [
              "Item.RagShirt"
            ]
          },
          {
            "items": [
              "Item.LeatherCoat"
            ]
          },
          {
            "items": [
              "Item.Boots"
            ]
          },
          {
            "items": [
              "Item.Hood"
            ]
          },
          {
            "items": [
              "Item.Hardtack"
            ],
            "count": [
              3,
              3
            ]
          },
          {
            "items": [
              "Item.WaterBottle"
            ],
            "count": [
              2,
              2
            ]
          }
        ]
      },
      "source": "src/content/core/defs/clinic.json"
    },
    {
      "id": "Creature.SignalistHealer",
      "label": "신호회 간병인",
      "parent": "Creature.SettlementDoctor",
      "char": "hero",
      "loadout": {
        "slots": [
          {
            "items": [
              "Item.RagShirt"
            ]
          },
          {
            "items": [
              "Item.LeatherCoat"
            ]
          },
          {
            "items": [
              "Item.Boots"
            ]
          },
          {
            "items": [
              "Item.Hood"
            ]
          },
          {
            "items": [
              "Item.Hardtack"
            ],
            "count": [
              3,
              3
            ]
          },
          {
            "items": [
              "Item.WaterBottle"
            ],
            "count": [
              2,
              2
            ]
          }
        ]
      },
      "source": "src/content/core/defs/field-devices.json"
    },
    {
      "id": "Creature.LanternHealer",
      "label": "형제단 간병인",
      "parent": "Creature.SettlementDoctor",
      "char": "hero",
      "loadout": {
        "slots": [
          {
            "items": [
              "Item.RagShirt"
            ]
          },
          {
            "items": [
              "Item.LeatherCoat"
            ]
          },
          {
            "items": [
              "Item.Boots"
            ]
          },
          {
            "items": [
              "Item.Hood"
            ]
          },
          {
            "items": [
              "Item.Hardtack"
            ],
            "count": [
              3,
              3
            ]
          },
          {
            "items": [
              "Item.WaterBottle"
            ],
            "count": [
              2,
              2
            ]
          }
        ]
      },
      "source": "src/content/core/defs/saltrim-coast.json"
    }
  ],
  "doctorBase": {
    "defType": "Creature",
    "id": "Creature.SettlementDoctor",
    "parent": "Creature.Settler",
    "label": "의사",
    "clinic": "Clinic.Hearth",
    "traits": [
      "Trait.Neat"
    ],
    "stats": {
      "str": 10,
      "agi": 10,
      "per": 13,
      "vit": 10,
      "wil": 10
    },
    "skills": {
      "medicine": 50
    },
    "source": "src/content/core/defs/clinic.json"
  },
  "clinic": {
    "id": "Clinic.Hearth",
    "doctor": "Creature.SettlementDoctor",
    "supplies": [
      {
        "item": "Item.MedicalBag",
        "count": 2
      },
      {
        "item": "Item.Moonshine",
        "count": 2
      },
      {
        "item": "Item.Thread",
        "count": 6
      },
      {
        "item": "Item.Needle",
        "count": 1
      },
      {
        "item": "Item.Tourniquet",
        "count": 2
      },
      {
        "item": "Item.Splint",
        "count": 2
      },
      {
        "item": "Item.RustyKnife",
        "count": 1
      },
      {
        "item": "Item.WillowTea",
        "count": 3
      },
      {
        "item": "Item.PoppyTincture",
        "count": 2
      },
      {
        "item": "Item.BitterMoss",
        "count": 3
      },
      {
        "item": "Item.PurificationAmpoule",
        "count": 1,
        "appraisal": 2
      },
      {
        "item": "Item.WaterBottle",
        "count": 3
      }
    ]
  },
  "referenceHeroContract": {
    "walk": {
      "down": [
        "hero_w_down0",
        "hero_w_down1",
        "hero_w_down2"
      ],
      "left": [
        "hero_w_left0",
        "hero_w_left1",
        "hero_w_left2"
      ],
      "right": [
        "hero_w_right0",
        "hero_w_right1",
        "hero_w_right2"
      ],
      "up": [
        "hero_w_up0",
        "hero_w_up1",
        "hero_w_up2"
      ]
    },
    "idle": {
      "down": [
        "hero_w_down1"
      ],
      "left": [
        "hero_w_left1"
      ],
      "right": [
        "hero_w_right1"
      ],
      "up": [
        "hero_w_up1"
      ]
    },
    "anchor": [
      0.5,
      0.96875
    ],
    "attack": {
      "down": [
        "hero_a_down0",
        "hero_a_down1",
        "hero_a_down2",
        "hero_a_down3"
      ],
      "left": [
        "hero_a_left0",
        "hero_a_left1",
        "hero_a_left2",
        "hero_a_left3"
      ],
      "right": [
        "hero_a_right0",
        "hero_a_right1",
        "hero_a_right2",
        "hero_a_right3"
      ],
      "up": [
        "hero_a_up0",
        "hero_a_up1",
        "hero_a_up2",
        "hero_a_up3"
      ]
    },
    "attackAnchor": [
      0.5,
      0.975
    ],
    "renderScale": 1,
    "headOffset": 30
  },
  "newChar": "resident_healer",
  "proposedDefTarget": "Creature.SettlementDoctor",
  "applied": false,
  "notes": [
    "Doctor and healer children currently inherit their ordinary Settler loadout.",
    "Clinic medical stock is real game inventory, not a permanent sprite prop.",
    "The new visual char adds no faction, medical effect or profession Def.",
    "Existing stored Creature.sprite strings require scoped integration handling for old saves."
  ]
}''')

DIRS = ["down", "left", "right", "up"]

def limb(c: Canvas, points: list[tuple[int, int]], fill: str = "p") -> None:
    for p0, p1 in zip(points, points[1:]):
        for dx, dy in [(-1, 0), (0, -1), (1, 0), (0, 1)]:
            c.line(p0[0] + dx, p0[1] + dy, p1[0] + dx, p1[1] + dy, "o")
    for p0, p1 in zip(points, points[1:]):
        c.line(*p0, *p1, fill)
    hx, hy = points[-1]
    c.rect(hx, hy, 2, 2, "j")
    c.point(hx, hy, "f")


def boots(c: Canvas, direction: str, step: int) -> None:
    # Plain worn trouser hems and soft shoes, no faction uniform or fixed armor.
    if direction in ["down", "up"]:
        lx, rx = 7 + step, 13 - step
        left_lift, right_lift = (1 if step == 1 else 0), (1 if step == -1 else 0)
        c.rect(lx + 1, 23, 4, 6 - left_lift, "o")
        c.rect(rx, 23, 4, 6 - right_lift, "o")
        c.rect(lx + 2, 24, 2, 4 - left_lift, "v")
        c.rect(rx + 1, 24, 2, 4 - right_lift, "u")
        c.point(lx + 2, 26, "w")
        c.point(rx + 1, 25, "v")
        c.row(lx, 28 - left_lift, "ornrb")
        c.row(rx, 28 - right_lift, "brrno")
        c.row(lx, 29 - left_lift, "orrbo")
        c.row(rx, 29 - right_lift, "obrrr")
        c.row(lx, 30 - left_lift, "ouuuo")
        c.row(rx, 30 - right_lift, "ouuuo")
    else:
        near, far = 9 + step, 13 - step
        near_lift, far_lift = (1 if step == 1 else 0), (1 if step == -1 else 0)
        c.rect(far, 23, 3, 6 - far_lift, "o")
        c.line(far + 1, 24, far + 1, 27 - far_lift, "u")
        c.rect(near, 23, 4, 6 - near_lift, "o")
        c.rect(near + 1, 24, 2, 4 - near_lift, "v")
        if direction == "left":
            c.row(far - 1, 28 - far_lift, "orrbo")
            c.row(far - 1, 29 - far_lift, "obrrr")
            c.row(far - 1, 30 - far_lift, "ouuuo")
            c.row(near - 2, 28 - near_lift, "ornrbo")
            c.row(near - 2, 29 - near_lift, "orrrbo")
            c.row(near - 2, 30 - near_lift, "ouuuuo")
        else:
            c.row(far, 28 - far_lift, "obrro")
            c.row(far, 29 - far_lift, "rrrbo")
            c.row(far, 30 - far_lift, "ouuuo")
            c.row(near, 28 - near_lift, "obrnro")
            c.row(near, 29 - near_lift, "obrrro")
            c.row(near, 30 - near_lift, "ouuuuo")



def front(c: Canvas) -> None:
    # Worn everyday tunic and a plain coarse linen apron, without medical insignia.
    c.polygon([(8, 12), (15, 12), (18, 14), (20, 19), (19, 24),
               (17, 25), (14, 25), (12, 26), (8, 25), (5, 25),
               (4, 21), (5, 15)], "o")
    c.polygon([(8, 13), (14, 13), (17, 15), (18, 20), (17, 24),
               (14, 24), (11, 25), (7, 24), (5, 21), (6, 16)], "t")
    c.line(7, 15, 6, 19, "m")
    c.line(16, 16, 17, 20, "d")
    c.line(9, 13, 10, 17, "n")
    c.line(14, 13, 14, 17, "n")
    # An irregular sewn hem and folds keep the apron warm grey, never a lab coat.
    c.polygon([(10, 15), (14, 15), (15, 20), (17, 25), (15, 27),
               (11, 26), (8, 27), (8, 23), (9, 19)], "c")
    c.polygon([(10, 16), (13, 16), (14, 21), (15, 25), (12, 25),
               (9, 26), (9, 22)], "p")
    c.line(10, 17, 10, 20, "h")
    c.line(11, 22, 10, 25, "h")
    c.line(14, 22, 15, 25, "c")
    c.point(12, 24, "c")
    c.point(15, 26, "p")
    c.line(6, 20, 17, 20, "r")
    c.line(8, 20, 15, 20, "n")
    c.point(16, 21, "p")
    c.line(16, 22, 17, 25, "c")
    c.rect(11, 10, 4, 3, "j")
    # Tied-back hair leaves an ordinary adult face exposed; no nurse cap or mask.
    c.row(10, 3, "okkko")
    c.row(9, 4, "okkkrkko")
    c.row(9, 5, "okjffjko")
    c.row(9, 6, "ojfeefjo")
    c.row(9, 7, "ofkefkfo")
    c.row(10, 8, "ojfefjo")
    c.row(10, 9, "ojjrfjo")
    c.row(10, 10, "ojfffjo")
    c.row(11, 11, "jffj")
    c.row(10, 12, "pjfpp")
    c.point(10, 5, "r")


def back(c: Canvas) -> None:
    c.polygon([(8, 12), (15, 12), (18, 14), (20, 19), (19, 24),
               (17, 25), (14, 25), (12, 26), (8, 25), (5, 25),
               (4, 21), (5, 15)], "o")
    c.polygon([(8, 13), (14, 13), (17, 15), (18, 20), (17, 24),
               (14, 24), (11, 25), (7, 24), (5, 21), (6, 16)], "t")
    c.line(7, 15, 6, 19, "m")
    c.line(16, 16, 17, 20, "d")
    c.line(12, 15, 12, 23, "c")
    c.point(11, 18, "t")
    # Plain apron straps and a small waist tie; they carry no faction or cure symbol.
    c.line(9, 13, 10, 17, "p")
    c.line(14, 13, 14, 17, "p")
    c.line(6, 20, 17, 20, "n")
    c.row(11, 20, "cpc")
    c.line(12, 21, 10, 24, "p")
    c.line(13, 21, 15, 23, "c")
    c.point(7, 23, "c")
    c.row(10, 3, "okkko")
    c.row(9, 4, "okkkrkko")
    c.row(9, 5, "okkrkkko")
    c.row(9, 6, "okkkkrko")
    c.row(9, 7, "okrkkkko")
    c.row(10, 8, "okkkkko")
    c.row(10, 9, "okkkkko")
    c.row(11, 10, "obkkbo")
    c.row(11, 11, "okkkko")
    c.row(11, 12, "jkkj")


def side(c: Canvas, direction: str) -> None:
    if direction == "left":
        c.polygon([(10, 12), (15, 12), (18, 15), (19, 21), (17, 25),
                   (14, 25), (12, 26), (7, 26), (6, 22), (7, 16)], "o")
        c.polygon([(10, 13), (14, 13), (16, 16), (17, 21), (16, 24),
                   (13, 24), (9, 25), (7, 22), (8, 16)], "t")
        c.line(14, 15, 16, 21, "d")
        c.line(10, 13, 9, 17, "n")
        c.polygon([(9, 16), (11, 16), (10, 20), (11, 26), (8, 27),
                   (7, 25), (8, 20)], "c")
        c.line(9, 17, 8, 24, "p")
        c.line(8, 24, 9, 26, "h")
        c.line(8, 20, 17, 20, "n")
        c.point(15, 21, "p")
        c.row(10, 3, "okkko")
        c.row(9, 4, "okkrkko")
        c.row(8, 5, "ojfkkko")
        c.row(8, 6, "ofkefko")
        c.row(7, 7, "ojfefko")
        c.row(8, 8, "ojjffjo")
        c.point(9, 8, "r")
        c.row(9, 9, "ojfffjo")
        c.row(10, 10, "ojjjjo")
        c.rect(15, 9, 3, 3, "k")
        c.point(15, 9, "r")
        c.point(17, 11, "b")
        c.row(11, 11, "jffj")
        c.row(10, 12, "pjpp")
    else:
        c.polygon([(8, 12), (13, 12), (17, 15), (19, 21), (18, 25),
                   (14, 26), (10, 25), (6, 26), (5, 22), (6, 16)], "o")
        c.polygon([(9, 13), (13, 13), (16, 16), (17, 21), (16, 24),
                   (13, 25), (9, 24), (6, 25), (6, 22), (7, 16)], "t")
        c.line(9, 15, 8, 21, "d")
        c.line(13, 13, 15, 17, "n")
        c.polygon([(14, 16), (16, 16), (17, 21), (17, 26), (15, 27),
                   (13, 25), (14, 20)], "c")
        c.line(15, 17, 16, 24, "p")
        c.line(16, 24, 15, 26, "h")
        c.line(7, 20, 17, 20, "n")
        c.point(9, 21, "p")
        c.row(10, 3, "okkko")
        c.row(9, 4, "okkrkko")
        c.row(9, 5, "okkkfjo")
        c.row(9, 6, "okfekfo")
        c.row(10, 7, "okfefjo")
        c.row(10, 8, "ojffjjo")
        c.point(14, 8, "r")
        c.row(10, 9, "ojfffjo")
        c.row(10, 10, "ojjjjo")
        c.rect(7, 9, 3, 3, "k")
        c.point(9, 9, "r")
        c.point(7, 11, "b")
        c.row(10, 11, "jffj")
        c.row(10, 12, "ppjp")


def walking(direction: str, step: int, arms: bool = True) -> Canvas:
    c = Canvas(24, 32)
    boots(c, direction, step)
    if direction == "down":
        front(c)
        if arms:
            limb(c, [(5, 16), (4, 19), (7 + step, 22)], "p")
            limb(c, [(18, 16), (19, 19), (17 - step, 22)], "c")
            c.row(4, 20, "hp")
            c.row(17, 20, "pc")
    elif direction == "up":
        if arms:
            limb(c, [(5, 16), (4, 19), (7 - step, 22)], "p")
            limb(c, [(18, 16), (19, 19), (17 + step, 22)], "c")
        back(c)
    elif direction == "left":
        if arms:
            limb(c, [(14, 15), (16, 19), (14 + step, 22)], "c")
        side(c, direction)
        if arms:
            limb(c, [(9, 15), (7, 19), (9 - step, 22)], "p")
            c.row(7, 20, "hp")
    else:
        if arms:
            limb(c, [(9, 15), (7, 19), (10 - step, 22)], "c")
        side(c, direction)
        if arms:
            limb(c, [(15, 15), (18, 19), (15 + step, 22)], "p")
            c.row(16, 20, "ph")
    return c


def attack(direction: str, pose: int) -> Canvas:
    c = Canvas(32, 40)
    c.blit(walking(direction, 0, False), 4, 8)
    # Ordinary defensive/attack arm movement; no medical props or healing effects.
    paths = {
        "down": [[(18, 16), (18, 19), (15, 20)],
                 [(18, 16), (20, 14), (19, 11)],
                 [(18, 16), (20, 21), (21, 25)],
                 [(18, 16), (19, 19), (16, 22)]],
        "up": [[(17, 16), (18, 14), (16, 13)],
               [(17, 16), (20, 13), (20, 10)],
               [(17, 16), (19, 10), (19, 6)],
               [(17, 16), (19, 15), (17, 13)]],
        "left": [[(9, 15), (6, 17), (6, 14)],
                 [(9, 15), (6, 12), (9, 8)],
                 [(9, 15), (4, 16), (0, 17)],
                 [(9, 15), (7, 18), (5, 20)]],
        "right": [[(15, 15), (18, 17), (18, 14)],
                  [(15, 15), (18, 12), (15, 8)],
                  [(15, 15), (20, 16), (23, 17)],
                  [(15, 15), (17, 18), (19, 20)]],
    }
    limb(c, [(x + 4, y + 8) for x, y in paths[direction][pose]], "p")
    other = {"down": [(5, 16), (5, 19), (9, 21)],
             "up": [(5, 16), (4, 19), (7, 21)],
             "left": [(14, 15), (16, 18), (13, 21)],
             "right": [(9, 15), (7, 18), (11, 21)]}[direction]
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
    sheets = {"resident_healer": "sprites/original/ashveil-healer-walk.png",
              "resident_healer_atk": "sprites/original/ashveil-healer-attack.png"}
    frames, walk, idle, strike = {}, {}, {}, {}
    for row, direction in enumerate(DIRS):
        walk[direction] = [f"resident_healer_w_{direction}{col}" for col in range(3)]
        idle[direction] = [f"resident_healer_w_{direction}1"]
        strike[direction] = [f"resident_healer_a_{direction}{col}" for col in range(4)]
        for col, key in enumerate(walk[direction]):
            frames[key] = ["resident_healer", col * 24, row * 32, 24, 32]
        for col, key in enumerate(strike[direction]):
            frames[key] = ["resident_healer_atk", col * 32, row * 40, 32, 40]
    return {"sheets": sheets, "frames": frames, "chars": {"resident_healer": {
        "walk": walk, "idle": idle, "attack": strike, "anchor": [0.5, 31 / 32],
        "attackAnchor": [0.5, 39 / 40], "renderScale": 1, "headOffset": 28}}}

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
    mapping = fragment()
    assert len(mapping["frames"]) == 28
    assert set(mapping["sheets"]) == {"resident_healer", "resident_healer_atk"}
    assert set(mapping["chars"]) == {"resident_healer"}
    assert 39 - 8 == 31
    for direction in DIRS:
        assert len({png(pose) for pose in walks[direction]}) == 3
        assert len({png(pose) for pose in attacks[direction]}) == 4
        assert mapping["chars"]["resident_healer"]["idle"][direction] == [f"resident_healer_w_{direction}1"]
    for direction_poses in [walks, attacks]:
        for poses in direction_poses.values():
            for pose in poses:
                occupied = [(x, y) for y, row in enumerate(pose.pixels)
                            for x, color in enumerate(row) if color != "."]
                assert occupied and all(0 < x < pose.width - 1 and 0 < y < pose.height - 1
                                        for x, y in occupied)
    artifacts = {
        "public/sprites/original/ashveil-healer-walk.png": png(walk_sheet),
        "public/sprites/original/ashveil-healer-attack.png": png(attack_sheet),
        "public/sprites/original/ashveil-healer-walk.svg": svg(walk_sheet, "new equipment-neutral adult caregiver walk and idle poses"),
        "public/sprites/original/ashveil-healer-attack.svg": svg(attack_sheet, "new caregiver arm-action poses, no fixed equipment"),
        "public/sprites/original/ashveil-healer-contact.png": png(contact(walks, attacks)),
        "public/sprites/original/ashveil-healer-palette.json": (json.dumps(PALETTE, indent=2) + "\n").encode(),
        "tools/art/healer-manifest.fragment.json": (json.dumps(mapping, indent=2) + "\n").encode(),
        "tools/art/healer-usage-survey.json": (json.dumps(USAGE_SURVEY, indent=2, ensure_ascii=False) + "\n").encode(),
    }
    records = [{"file": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
               for name, data in artifacts.items()]
    origin = {
        "created": "2026-10-21", "method": "original authored pixel geometry for a living adult in worn everyday care clothes with a plain apron and rolled sleeves",
        "source": "tools/art/draw-healer.py", "inputs": [],
        "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "externalImageInputs": False, "modifiedExistingImages": False,
        "actualCommonChar": "hero", "selectedCreature": "Creature.SettlementDoctor",
        "referenceSharesHeroWithPlayer": True, "newChar": "resident_healer", "existingHeroModified": False,
        "newContent": {"walkCount": 12, "attackCount": 16, "walkCell": [24, 32], "attackCell": [32, 40],
                       "bodyOffsetInAttack": [4, 8], "bodyHeight": 28, "walkGroundY": 31, "attackGroundY": 39,
                       "renderScale": 1, "headOffset": 28},
        "integrationProposal": {"target": "Creature.SettlementDoctor", "char": "resident_healer", "applied": False,
                                "scope": "SettlementDoctor and its two healer descendants only; preserve generic resident_worker and hero."},
        "directions": DIRS, "status": "prepared art and new-char fragment, not registered in the game",
        "files": records,
    }
    artifacts["public/sprites/original/ashveil-healer-source.json"] = (json.dumps(origin, indent=2, ensure_ascii=False) + "\n").encode()
    if args.check:
        for name, data in artifacts.items():
            assert (ROOT / name).read_bytes() == data, f"regeneration differs: {name}"
        print(f"Verified {len(artifacts)} deterministic healer files; 12 new walks + 16 new equipment-neutral attacks; hero untouched.")
    else:
        for name, data in artifacts.items():
            target = ROOT / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        print(f"Wrote {len(artifacts)} original healer files and a new-char merge fragment.")


if __name__ == "__main__":
    main()
