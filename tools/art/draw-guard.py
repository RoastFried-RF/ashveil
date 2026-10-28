#!/usr/bin/env python3
"""Draw original ASHVEIL resident_guard daily-clothing adult poses from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-guard.py [--check]
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
    "e": "#d8ad87", "j": "#a67d60", "c": "#5f665d", "d": "#373f3a",
    "t": "#4c605b", "m": "#858c78", "l": "#a2a58c", "p": "#b7ac8b",
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
  "snapshotContext": "Root phase-288 working tree, not published Git main",
  "guardFamily": [
    {
      "id": "Creature.LanternGuard",
      "label": "해안 등대 파수꾼",
      "parent": "Creature.SettlementGuard",
      "char": "hero",
      "characterAliases": {
        "hero": "resident_worker"
      },
      "displayForStoredHero": "resident_worker",
      "loadout": {
        "slots": [
          {
            "items": [
              "Item.RebarSpear"
            ]
          },
          {
            "items": [
              "Item.PaddedJacket"
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
    },
    {
      "id": "Creature.SettlementGuard",
      "label": "정착지 경비",
      "parent": "Creature.Settler",
      "char": "hero",
      "characterAliases": {
        "hero": "resident_worker"
      },
      "displayForStoredHero": "resident_worker",
      "loadout": {
        "slots": [
          {
            "items": [
              "Item.RebarSpear"
            ]
          },
          {
            "items": [
              "Item.PaddedJacket"
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
      "source": "src/content/core/defs/society.json"
    },
    {
      "id": "Creature.SignalistGuard",
      "label": "신호회 파수꾼",
      "parent": "Creature.SettlementGuard",
      "char": "hero",
      "characterAliases": {
        "hero": "resident_worker"
      },
      "displayForStoredHero": "resident_worker",
      "loadout": {
        "slots": [
          {
            "items": [
              "Item.RebarSpear"
            ]
          },
          {
            "items": [
              "Item.PaddedJacket"
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
      "id": "Creature.ZeroVaultWarden",
      "label": "제3 초소 금고 문지기",
      "parent": "Creature.SettlementGuard",
      "char": "hero",
      "characterAliases": {
        "hero": "resident_worker"
      },
      "displayForStoredHero": "resident_worker",
      "loadout": {
        "slots": [
          {
            "items": [
              "Item.RebarSpear"
            ]
          },
          {
            "items": [
              "Item.PaddedJacket"
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
      "source": "src/content/core/defs/zero-vault.json"
    }
  ],
  "guardBase": {
    "defType": "Creature",
    "id": "Creature.SettlementGuard",
    "parent": "Creature.Settler",
    "label": "정착지 경비",
    "ai": "guard",
    "loadout": {
      "slots": [
        {
          "items": [
            "Item.RebarSpear"
          ]
        },
        {
          "items": [
            "Item.PaddedJacket"
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
    "source": "src/content/core/defs/society.json"
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
  "currentResidentContract": {
    "walk": {
      "down": [
        "resident_worker_w_down0",
        "resident_worker_w_down1",
        "resident_worker_w_down2"
      ],
      "left": [
        "resident_worker_w_left0",
        "resident_worker_w_left1",
        "resident_worker_w_left2"
      ],
      "right": [
        "resident_worker_w_right0",
        "resident_worker_w_right1",
        "resident_worker_w_right2"
      ],
      "up": [
        "resident_worker_w_up0",
        "resident_worker_w_up1",
        "resident_worker_w_up2"
      ]
    },
    "idle": {
      "down": [
        "resident_worker_w_down1"
      ],
      "left": [
        "resident_worker_w_left1"
      ],
      "right": [
        "resident_worker_w_right1"
      ],
      "up": [
        "resident_worker_w_up1"
      ]
    },
    "attack": {
      "down": [
        "resident_worker_a_down0",
        "resident_worker_a_down1",
        "resident_worker_a_down2",
        "resident_worker_a_down3"
      ],
      "left": [
        "resident_worker_a_left0",
        "resident_worker_a_left1",
        "resident_worker_a_left2",
        "resident_worker_a_left3"
      ],
      "right": [
        "resident_worker_a_right0",
        "resident_worker_a_right1",
        "resident_worker_a_right2",
        "resident_worker_a_right3"
      ],
      "up": [
        "resident_worker_a_up0",
        "resident_worker_a_up1",
        "resident_worker_a_up2",
        "resident_worker_a_up3"
      ]
    },
    "anchor": [
      0.5,
      0.96875
    ],
    "attackAnchor": [
      0.5,
      0.975
    ],
    "renderScale": 1,
    "headOffset": 28
  },
  "aliasPatchSnapshot": [
    {
      "op": "add",
      "target": "Creature.Settler",
      "path": "/characterAliases",
      "value": {
        "hero": "resident_worker"
      }
    },
    {
      "op": "add",
      "target": "Creature.RetiredWanderer",
      "path": "/characterAliases",
      "value": {
        "hero": "hero"
      }
    },
    {
      "op": "add",
      "target": "Creature.SettlementDoctor",
      "path": "/characterAliases",
      "value": {
        "hero": "resident_healer"
      }
    }
  ],
  "newChar": "resident_guard",
  "proposedAliasTarget": "Creature.SettlementGuard",
  "proposedAlias": {
    "hero": "resident_guard"
  },
  "applied": false,
  "notes": [
    "Stored char is hero; inherited display alias is currently resident_worker.",
    "Actual selected weapons, armor, hood and supplies remain game inventory, not permanent sprite props.",
    "The new short cloth coat adds no armor statistic, faction emblem or profession Def.",
    "Follow the existing one-step renderer alias pattern instead of rewriting stored Creature.sprite."
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
    # A broad, short cloth coat: seams, lapels and bound sleeves, never fixed armor.
    c.polygon([(7, 12), (17, 12), (20, 14), (21, 20), (20, 24),
               (17, 26), (14, 25), (12, 24), (10, 26), (6, 25),
               (3, 23), (3, 17), (4, 14)], "o")
    c.polygon([(7, 13), (16, 13), (18, 15), (19, 20), (18, 24),
               (15, 25), (12, 23), (10, 25), (6, 24), (5, 21),
               (5, 16)], "c")
    c.polygon([(9, 13), (14, 13), (15, 18), (13, 21), (10, 20)], "t")
    c.line(7, 14, 8, 19, "m")
    c.line(17, 15, 18, 21, "d")
    c.line(8, 14, 11, 17, "l")
    c.line(15, 14, 13, 17, "m")
    c.line(11, 18, 11, 23, "d")
    c.line(13, 18, 14, 24, "m")
    c.line(6, 21, 10, 21, "m")
    c.line(15, 21, 18, 21, "d")
    c.line(6, 23, 9, 24, "l")
    c.point(16, 24, "m")
    c.point(17, 23, "d")
    c.rect(10, 10, 5, 4, "j")
    c.row(9, 12, "lpjffjpl")
    # Closely cropped hair and broad human jaw leave skin, eyes, nose and lips visible.
    c.row(10, 3, "okkkko")
    c.row(9, 4, "okkrkkko")
    c.row(9, 5, "okjffjko")
    c.row(8, 6, "ojfeefjjo")
    c.row(8, 7, "ofkeefkfo")
    c.row(9, 8, "ojffefjo")
    c.row(9, 9, "ojjjrfjo")
    c.row(10, 10, "ojjjjjo")
    c.row(10, 11, "ojffjo")
    c.point(9, 5, "m")
    c.point(16, 5, "r")


def back(c: Canvas) -> None:
    c.polygon([(7, 12), (17, 12), (20, 14), (21, 20), (20, 24),
               (17, 26), (14, 25), (12, 24), (10, 26), (6, 25),
               (3, 23), (3, 17), (4, 14)], "o")
    c.polygon([(7, 13), (16, 13), (18, 15), (19, 20), (18, 24),
               (15, 25), (12, 23), (10, 25), (6, 24), (5, 21),
               (5, 16)], "c")
    c.line(7, 14, 8, 19, "m")
    c.line(17, 15, 18, 21, "d")
    c.line(8, 14, 15, 14, "m")
    c.line(12, 15, 12, 22, "d")
    c.point(12, 18, "c")
    c.line(6, 21, 17, 21, "m")
    c.line(10, 22, 9, 24, "d")
    c.line(14, 22, 15, 24, "d")
    c.point(6, 23, "l")
    c.rect(11, 10, 4, 3, "j")
    c.row(10, 3, "okkkko")
    c.row(9, 4, "okkrkkko")
    c.row(9, 5, "okkrkkko")
    c.row(9, 6, "okkkkrko")
    c.row(9, 7, "okkrkkko")
    c.row(10, 8, "ojkkkjo")
    c.row(10, 9, "ojjjjjo")
    c.row(11, 10, "jjjj")
    c.row(9, 12, "llcjjcll")


def side(c: Canvas, direction: str) -> None:
    if direction == "left":
        c.polygon([(9, 12), (16, 12), (19, 15), (20, 21), (18, 25),
                   (14, 26), (12, 24), (8, 26), (5, 24), (5, 18), (6, 14)], "o")
        c.polygon([(9, 13), (15, 13), (17, 16), (18, 21), (17, 24),
                   (14, 25), (12, 23), (8, 25), (7, 23), (7, 17)], "c")
        c.line(9, 14, 10, 18, "l")
        c.line(15, 15, 17, 21, "d")
        c.line(8, 20, 16, 21, "m")
        c.line(9, 22, 8, 24, "d")
        c.point(16, 24, "m")
        c.rect(10, 10, 5, 3, "j")
        c.row(9, 12, "lpjffpl")
        c.row(10, 3, "okkkko")
        c.row(9, 4, "okkrkko")
        c.row(8, 5, "ojfkkko")
        c.row(8, 6, "ofkefko")
        c.row(7, 7, "ojfeffko")
        c.row(8, 8, "ojjfffjo")
        c.row(8, 9, "ojrjjfjo")
        c.row(9, 10, "ojjjjjo")
        c.row(10, 11, "ojffjo")
        c.point(15, 5, "m")
    else:
        c.polygon([(8, 12), (15, 12), (18, 14), (20, 18), (20, 24),
                   (17, 26), (13, 24), (11, 26), (6, 25), (4, 21), (5, 15)], "o")
        c.polygon([(8, 13), (14, 13), (16, 15), (18, 18), (18, 23),
                   (16, 25), (13, 23), (11, 25), (7, 24), (6, 21), (7, 16)], "c")
        c.line(14, 14, 13, 18, "l")
        c.line(8, 15, 6, 21, "d")
        c.line(7, 21, 15, 20, "m")
        c.line(14, 22, 16, 24, "d")
        c.point(7, 24, "m")
        c.rect(9, 10, 5, 3, "j")
        c.row(9, 12, "lpffjpl")
        c.row(10, 3, "okkkko")
        c.row(9, 4, "okkrkko")
        c.row(9, 5, "okkkfjo")
        c.row(9, 6, "okfekfo")
        c.row(9, 7, "okffefjo")
        c.row(9, 8, "ojfffjjo")
        c.row(9, 9, "ojfjjrjo")
        c.row(9, 10, "ojjjjjo")
        c.row(10, 11, "ojffjo")
        c.point(9, 5, "m")


def walking(direction: str, step: int, arms: bool = True) -> Canvas:
    c = Canvas(24, 32)
    boots(c, direction, step)
    if direction == "down":
        front(c)
        if arms:
            limb(c, [(5, 15), (4, 19), (5 + step, 23)], "c")
            limb(c, [(19, 15), (20, 19), (18 - step, 23)], "c")
            c.row(3, 20, "npn")
            c.row(18, 20, "npn")
    elif direction == "up":
        if arms:
            limb(c, [(5, 15), (4, 19), (5 - step, 23)], "c")
            limb(c, [(19, 15), (20, 19), (18 + step, 23)], "c")
        back(c)
        if arms:
            c.row(3, 20, "npn")
            c.row(19, 20, "npn")
    elif direction == "left":
        if arms:
            limb(c, [(15, 15), (17, 19), (16 + step, 23)], "d")
        side(c, direction)
        if arms:
            limb(c, [(8, 15), (6, 19), (7 - step, 23)], "c")
            c.row(5, 20, "npn")
    else:
        if arms:
            limb(c, [(8, 15), (6, 19), (8 - step, 23)], "d")
        side(c, direction)
        if arms:
            limb(c, [(16, 15), (18, 19), (17 + step, 23)], "c")
            c.row(17, 20, "npn")
    return c


def attack(direction: str, pose: int) -> Canvas:
    c = Canvas(32, 40)
    c.blit(walking(direction, 0, False), 4, 8)
    # Guard shoulder/hand action; selected weapons and armor remain actual inventory.
    paths = {
        "down": [[(19, 15), (18, 18), (15, 19)],
                 [(19, 15), (21, 13), (19, 9)],
                 [(19, 15), (21, 20), (20, 25)],
                 [(19, 15), (20, 19), (17, 22)]],
        "up": [[(18, 15), (18, 13), (15, 12)],
               [(18, 15), (21, 12), (21, 9)],
               [(18, 15), (20, 10), (20, 5)],
               [(18, 15), (19, 13), (16, 12)]],
        "left": [[(8, 15), (5, 17), (5, 13)],
                 [(8, 15), (5, 11), (8, 7)],
                 [(8, 15), (4, 16), (0, 16)],
                 [(8, 15), (6, 18), (4, 20)]],
        "right": [[(16, 15), (19, 17), (19, 13)],
                  [(16, 15), (19, 11), (16, 7)],
                  [(16, 15), (21, 16), (24, 16)],
                  [(16, 15), (18, 18), (20, 20)]],
    }
    limb(c, [(x + 4, y + 8) for x, y in paths[direction][pose]], "c")
    other = {"down": [(5, 15), (6, 19), (10, 20)],
             "up": [(5, 15), (4, 19), (7, 21)],
             "left": [(15, 15), (17, 18), (13, 20)],
             "right": [(8, 15), (6, 18), (10, 20)]}[direction]
    limb(c, [(x + 4, y + 8) for x, y in other], "d")
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
    sheets = {"resident_guard": "sprites/original/ashveil-guard-walk.png",
              "resident_guard_atk": "sprites/original/ashveil-guard-attack.png"}
    frames, walk, idle, strike = {}, {}, {}, {}
    for row, direction in enumerate(DIRS):
        walk[direction] = [f"resident_guard_w_{direction}{col}" for col in range(3)]
        idle[direction] = [f"resident_guard_w_{direction}1"]
        strike[direction] = [f"resident_guard_a_{direction}{col}" for col in range(4)]
        for col, key in enumerate(walk[direction]):
            frames[key] = ["resident_guard", col * 24, row * 32, 24, 32]
        for col, key in enumerate(strike[direction]):
            frames[key] = ["resident_guard_atk", col * 32, row * 40, 32, 40]
    return {"sheets": sheets, "frames": frames, "chars": {"resident_guard": {
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
    assert set(mapping["sheets"]) == {"resident_guard", "resident_guard_atk"}
    assert set(mapping["chars"]) == {"resident_guard"}
    assert 39 - 8 == 31
    for direction in DIRS:
        assert len({png(pose) for pose in walks[direction]}) == 3
        assert len({png(pose) for pose in attacks[direction]}) == 4
        assert mapping["chars"]["resident_guard"]["idle"][direction] == [f"resident_guard_w_{direction}1"]
    for direction_poses in [walks, attacks]:
        for poses in direction_poses.values():
            for pose in poses:
                occupied = [(x, y) for y, row in enumerate(pose.pixels)
                            for x, color in enumerate(row) if color != "."]
                assert occupied and all(0 < x < pose.width - 1 and 0 < y < pose.height - 1
                                        for x, y in occupied)
    artifacts = {
        "public/sprites/original/ashveil-guard-walk.png": png(walk_sheet),
        "public/sprites/original/ashveil-guard-attack.png": png(attack_sheet),
        "public/sprites/original/ashveil-guard-walk.svg": svg(walk_sheet, "new equipment-neutral broad-shouldered adult guard walk and idle poses"),
        "public/sprites/original/ashveil-guard-attack.svg": svg(attack_sheet, "new guard arm-action poses, no fixed equipment"),
        "public/sprites/original/ashveil-guard-contact.png": png(contact(walks, attacks)),
        "public/sprites/original/ashveil-guard-palette.json": (json.dumps(PALETTE, indent=2) + "\n").encode(),
        "tools/art/guard-manifest.fragment.json": (json.dumps(mapping, indent=2) + "\n").encode(),
        "tools/art/guard-usage-survey.json": (json.dumps(USAGE_SURVEY, indent=2, ensure_ascii=False) + "\n").encode(),
    }
    records = [{"file": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
               for name, data in artifacts.items()]
    origin = {
        "created": "2026-10-21", "method": "original authored pixel geometry for a living adult in a worn short cloth coat and bound sleeves",
        "source": "tools/art/draw-guard.py", "inputs": [],
        "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "externalImageInputs": False, "modifiedExistingImages": False,
        "surveyContext": "Root phase-288 working tree, not published Git main",
        "actualCommonChar": "hero", "actualDisplayedChar": "resident_worker", "selectedCreature": "Creature.SettlementGuard",
        "referenceSharesHeroWithPlayer": True, "newChar": "resident_guard", "existingHeroModified": False,
        "newContent": {"walkCount": 12, "attackCount": 16, "walkCell": [24, 32], "attackCell": [32, 40],
                       "bodyOffsetInAttack": [4, 8], "bodyHeight": 28, "walkGroundY": 31, "attackGroundY": 39,
                       "renderScale": 1, "headOffset": 28},
        "integrationProposal": {"target": "Creature.SettlementGuard", "characterAliases": {"hero": "resident_guard"}, "applied": False,
                                "scope": "SettlementGuard and its three guard descendants only; preserve saved hero and unrelated resident displays."},
        "directions": DIRS, "status": "prepared art and new-char fragment, not registered in the game",
        "files": records,
    }
    artifacts["public/sprites/original/ashveil-guard-source.json"] = (json.dumps(origin, indent=2, ensure_ascii=False) + "\n").encode()
    if args.check:
        for name, data in artifacts.items():
            assert (ROOT / name).read_bytes() == data, f"regeneration differs: {name}"
        print(f"Verified {len(artifacts)} deterministic guard files; 12 new walks + 16 new equipment-neutral attacks; hero untouched.")
    else:
        for name, data in artifacts.items():
            target = ROOT / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        print(f"Wrote {len(artifacts)} original guard files and a new-char merge fragment.")


if __name__ == "__main__":
    main()
