#!/usr/bin/env python3
"""Draw five original ASHVEIL non-pill inventory icons from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-nonpill-icons.py [--check]
Only writes its own new art files and its own tools/art/ fragment and survey.
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



USAGE_SURVEY = json.loads(r'''{
  "created": "2026-10-21",
  "scope": "Read-only Root working-tree source snapshot for exactly five existing non-pill items; not a game simulation.",
  "items": [
    {
      "id": "Item.Salt",
      "source": "src/content/core/defs/crafting.json",
      "definition": {
        "defType": "Item",
        "id": "Item.Salt",
        "label": "소금",
        "sprite": "pill_white",
        "category": "misc",
        "weight": 0,
        "value": 2,
        "size": [
          1,
          1
        ],
        "stackable": true,
        "maxStack": 5
      }
    },
    {
      "id": "Item.GlassEye",
      "source": "src/content/core/defs/prosthetics.json",
      "definition": {
        "defType": "Item",
        "id": "Item.GlassEye",
        "label": "유리 눈",
        "description": "결손 부위에 설치하는 유리 눈.",
        "sprite": "pill_blue",
        "category": "medical",
        "weight": 1,
        "size": [
          1,
          1
        ],
        "value": 20,
        "prosthetic": "Prosthetic.GlassEye",
        "repair": {
          "material": "Item.GlassShard",
          "unitsPer10": 0.25,
          "turns": 100,
          "attr": "per",
          "tools": [
            "blade"
          ]
        }
      }
    },
    {
      "id": "Item.PowerCell",
      "source": "src/content/core/defs/prosthetics.json",
      "definition": {
        "defType": "Item",
        "id": "Item.PowerCell",
        "label": "개척 전원셀",
        "description": "개척 의수에30일 분량의 전력을 공급한다.",
        "sprite": "pill_green",
        "category": "tool",
        "weight": 0.1,
        "size": [
          1,
          1
        ],
        "value": 50,
        "stackable": true,
        "maxStack": 5
      }
    },
    {
      "id": "Item.HealthDraught",
      "source": "src/content/core/defs/items-consumables.json",
      "definition": {
        "defType": "Item",
        "id": "Item.HealthDraught",
        "label": "쓴 약초탕",
        "description": "수도원 약제실의 약초를 달인 물. 상처의 열을 내리고 체력을 조금 돌려준다.",
        "sprite": "pill_green",
        "category": "drug",
        "weight": 0.3,
        "size": [
          1,
          1
        ],
        "stackable": true,
        "maxStack": 3,
        "value": 20,
        "drug": {
          "effect": "draught",
          "durationTurns": 30
        }
      }
    },
    {
      "id": "Item.PurificationAmpoule",
      "source": "src/content/core/defs/items-consumables.json",
      "definition": {
        "defType": "Item",
        "id": "Item.PurificationAmpoule",
        "label": "정화 앰플",
        "description": "개척기 항생 약품. 사흘 동안 감염 진행을70%늦춘다. 이질에 걸릴 위험이 있다.",
        "sprite": "pill_blue",
        "category": "drug",
        "weight": 0.1,
        "size": [
          1,
          1
        ],
        "stackable": false,
        "maxStack": 1,
        "value": 100,
        "drug": {
          "effect": "purificationAmpoule",
          "durationTurns": 86400,
          "def": "Drug.PurificationAmpoule"
        },
        "relic": true,
        "unknownLabel": "밀봉된 앰플",
        "unknownDescription": "기호가 새겨진 개척기 앰플이다. 내용물의 용도는 모른다."
      }
    }
  ],
  "sourceFiles": [
    {
      "path": "src/content/core/defs/crafting.json",
      "sha256": "d9b195e70adc37176790dac989bc302a3733c27006be8a94b51452816688bec1"
    },
    {
      "path": "src/content/core/defs/prosthetics.json",
      "sha256": "b648c7d8a20c60d8059cb875e3c9c82fd45f7231ee44cdb2772675e47e7a7371"
    },
    {
      "path": "src/content/core/defs/items-consumables.json",
      "sha256": "e18f842b569670fa3f6006b96d9384e0b950c8c586457c9a1c32cc0d096e2195"
    },
    {
      "path": "src/content/core/patches/saltrim-coast.json",
      "sha256": "834aa61009149ac5b3f2e212d28ea03f49efa3d5cdddf84989ed2c0e9878375a"
    },
    {
      "path": "src/core/prosthetics.ts",
      "sha256": "1fd68bf5ff22cb3e0533e794c8e7e021a397fddacf076f24c08d1e805ecc6d82"
    },
    {
      "path": "src/core/fluid-crafting.ts",
      "sha256": "9e4e6cbbfb73f3a5bd8aff12bae657661d9cc9913a2af7f08ca48b11b4268584"
    },
    {
      "path": "src/core/body.ts",
      "sha256": "9c52aa63df7c06a00cf9d09d764607398b59a9860135df2ac5afef3d774c3c5d"
    },
    {
      "path": "docs/design/02-body-and-health.md",
      "sha256": "1bda5934f94106eaf77c642447838bf14e75dd28598d5c5950414ad4d9625a89"
    },
    {
      "path": "docs/design/08-items-and-crafting.md",
      "sha256": "82e5e907930da845d1c9584e7516d5829895e16c9dd753959c58c1b5a801c92f"
    },
    {
      "path": "docs/lore/world-bible.md",
      "sha256": "59df5652bfc698f362f0b40613fd457f063a0865a4316c7ad7a2a6c23d0850cd"
    },
    {
      "path": "docs/lore/factions.md",
      "sha256": "8cc9eb1ccf4852a732a9f83942b2d1144a6df9319d24cd45a18e855137436eb1"
    }
  ],
  "excludes": [
    "all six pill appearance definitions",
    "Item.WaterPill"
  ],
  "applied": false,
  "saltGramsPatch": [
    {
      "op": "add",
      "target": "Item.Salt",
      "path": "/saltGrams",
      "value": 35
    }
  ],
  "prostheticRules": [
    {
      "defType": "Prosthetic",
      "structureHp": 8,
      "installTurns": 60,
      "removeTurns": 20,
      "serviceTurns": 40,
      "medicine": 1,
      "grip": true,
      "id": "Prosthetic.GlassEye",
      "label": "유리 눈",
      "item": "Item.GlassEye",
      "targets": [
        "LeftEye",
        "RightEye"
      ],
      "efficiency": 0,
      "firstImpression": 3
    },
    {
      "defType": "Prosthetic",
      "structureHp": 80,
      "installTurns": 120,
      "removeTurns": 20,
      "serviceTurns": 40,
      "medicine": 3,
      "grip": true,
      "id": "Prosthetic.PioneerArm",
      "label": "개척 의수",
      "item": "Item.PioneerArm",
      "targets": [
        "LeftForearm",
        "LeftHand",
        "RightForearm",
        "RightHand"
      ],
      "efficiency": 0.85,
      "tool": "needle",
      "powerTurns": 864000,
      "powerItem": "Item.PowerCell",
      "coldThreshold": 0,
      "coldMult": 0.8,
      "appraisalRequired": true
    }
  ]
}''')


def salt() -> Canvas:
    c = Canvas()
    # Loose coarse crystals: material, not a tablet, package, stack count or serving size.
    c.polygon([(3, 24), (5, 21), (8, 20), (9, 16), (12, 15), (14, 12),
               (18, 13), (20, 17), (24, 18), (26, 22), (29, 24),
               (27, 27), (21, 28), (8, 28)], "o")
    c.polygon([(4, 24), (7, 22), (10, 20), (10, 17), (13, 16), (15, 13),
               (18, 15), (20, 19), (24, 19), (25, 23), (27, 25),
               (22, 27), (9, 27)], "c")
    c.polygon([(6, 23), (10, 21), (12, 17), (16, 15), (19, 19),
               (23, 20), (24, 24), (21, 26), (10, 25)], "p")
    c.polygon([(10, 18), (14, 16), (16, 19), (13, 21), (10, 20)], "h")
    c.polygon([(15, 15), (17, 15), (18, 19), (16, 20), (14, 18)], "l")
    c.polygon([(18, 20), (21, 19), (23, 22), (20, 24), (18, 23)], "h")
    c.polygon([(8, 22), (11, 22), (12, 25), (9, 26), (7, 24)], "h")
    c.line(14, 21, 16, 23, "c")
    c.point(15, 24, "h");c.point(23, 25, "l")
    c.row(5, 27, "op");c.row(26, 28, "lo")
    c.point(3, 26, "p");c.point(12, 29, "c")
    return c


def glass_eye() -> Canvas:
    c = Canvas()
    # Smooth manufactured glass eye; no flesh, veins, mechanism or restored-vision cue.
    for y in range(6, 27):
        for x in range(4, 28):
            distance=(x-15.5)*(x-15.5)*100+(y-16)*(y-16)*132
            if distance <= 13200:
                fill="o" if distance>10500 else "c" if y>22 or x>24 else "p" if y>17 or x>20 else "h"
                c.point(x,y,fill)
    c.line(8, 10, 12, 8, "l")
    c.line(7, 12, 6, 15, "h")
    c.line(10, 24, 18, 25, "l")
    # Muted artificial iris painted under glass; ordinary appearance, not a status indicator.
    c.polygon([(16, 9), (21, 10), (24, 14), (24, 19), (21, 22),
               (17, 22), (14, 19), (13, 14)], "v")
    c.polygon([(16, 11), (20, 11), (22, 14), (22, 18), (20, 20),
               (17, 20), (15, 18), (15, 14)], "m")
    c.rect(17, 13, 4, 6, "d")
    c.rect(18, 14, 3, 4, "k")
    c.point(16, 12, "l");c.point(20, 20, "t")
    c.row(17, 12, "hh");c.point(17, 13, "p")
    return c


def power_cell() -> Canvas:
    c=Canvas()
    # Compact relic cell with a plain housing and two contacts; no charge gauge or polarity mark.
    c.polygon([(8, 8), (22, 8), (26, 12), (26, 26), (22, 29),
               (7, 28), (5, 25), (5, 12)], "o")
    c.polygon([(9, 9), (21, 9), (24, 12), (23, 15), (7, 15), (6, 12)], "v")
    c.rect(7, 14, 16, 12, "d")
    c.rect(8, 15, 13, 10, "t")
    c.line(9, 16, 9, 23, "m")
    c.line(11, 16, 19, 16, "m")
    c.line(23, 14, 23, 25, "u")
    c.line(24, 13, 24, 25, "v")
    c.row(8, 26, "vvvuuuuuuuuuvvv")
    c.line(9, 27, 21, 27, "u")
    c.rect(9, 5, 5, 5, "o");c.rect(10, 6, 3, 4, "a")
    c.row(10, 6, "ggg");c.line(10, 8, 12, 8, "n")
    c.rect(18, 5, 5, 5, "o");c.rect(19, 6, 3, 4, "a")
    c.row(19, 6, "ggg");c.line(19, 8, 21, 8, "n")
    c.point(8, 12, "w");c.point(22, 12, "w")
    c.point(8, 25, "v");c.point(21, 25, "v")
    return c


def health_draught() -> Canvas:
    c=Canvas()
    # Opaque plain vessel for a brewed liquid. No visible fill level, health mark or seal state.
    c.polygon([(12, 7), (19, 7), (20, 11), (24, 14), (26, 18),
               (26, 25), (22, 29), (9, 29), (5, 25), (5, 18), (7, 14), (11, 11)], "o")
    c.polygon([(12, 9), (18, 9), (19, 13), (23, 16), (24, 20),
               (24, 25), (21, 27), (10, 27), (7, 24), (7, 18), (10, 14)], "r")
    c.polygon([(12, 13), (17, 13), (20, 15), (22, 19), (21, 23),
               (18, 26), (11, 25), (8, 22), (9, 17)], "n")
    c.line(10, 17, 9, 21, "f")
    c.line(12, 15, 16, 14, "s")
    c.line(22, 20, 22, 24, "b")
    c.line(10, 27, 20, 27, "b")
    c.rect(11, 5, 9, 6, "o")
    c.rect(12, 6, 7, 4, "b")
    c.row(12, 6, "nrnnrrn");c.row(12, 7, "rssrrrs")
    c.row(11, 10, "opppppppo")
    c.row(12, 11, "ccccccc")
    return c


def purification_ampoule() -> Canvas:
    c=Canvas()
    # A sealed glass ampoule with a narrow break neck; no needle, dose, expiry or effect glyph.
    c.polygon([(14, 3), (17, 3), (19, 6), (18, 11), (20, 15),
               (22, 18), (22, 27), (19, 30), (12, 30), (9, 27),
               (9, 18), (11, 15), (13, 11), (12, 6)], "o")
    c.polygon([(14, 5), (16, 5), (17, 7), (16, 11), (18, 16),
               (20, 19), (20, 26), (18, 28), (13, 28), (11, 26),
               (11, 19), (13, 15), (14, 11)], "v")
    c.polygon([(14, 6), (16, 6), (15, 12), (17, 17), (18, 20),
               (18, 26), (14, 27), (12, 25), (12, 19), (15, 13)], "m")
    c.line(13, 18, 12, 21, "l")
    c.line(12, 22, 12, 25, "p")
    c.line(19, 20, 19, 26, "u")
    c.line(14, 28, 18, 28, "w")
    c.row(13, 11, "vtvvt")
    c.point(14, 5, "l");c.point(14, 7, "l")
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
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "N": ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
    "/": ["00001", "00001", "00010", "00100", "01000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
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



def text(c, x, y, label, scale=1):
    for i,letter in enumerate(label):
        if letter == " ": continue
        for py,row in enumerate(FONT[letter]):
            for px,bit in enumerate(row):
                if bit == "1": c.rect(x+i*6*scale+px*scale,y+py*scale,scale,scale,"#b8b39f")


def preview16(icon):
    c=Canvas(16,16)
    for y in range(16):
        for x in range(16):c.point(x,y,icon.pixels[2*y+1][2*x+1])
    return c


def contact(icons):
    c=Canvas(960,376,"#11191f")
    for index,(key,icon) in enumerate(icons.items()):
        left=index*192; label=LABELS[key]; small=preview16(icon)
        c.rect(left+8,8,176,360,"#1b272c")
        text(c,left+(192-len(label)*12)//2,18,label,2)
        c.blit(icon,left+32,44,4)
        for start,bg in [(left+24,"#11191f"),(left+104,"#b8b39f")]:
            c.rect(start,184,64,64,bg);c.blit(icon,start+16,188);c.blit(small,start+24,226)
            c.rect(start,264,64,64,bg);c.blit(small,start,264,4)
        text(c,left+24,346,"NATIVE / SMALL")
    return c


LABELS={"salt":"SALT","glass_eye":"EYE","power_cell":"CELL","health_draught":"DRAUGHT","purification_ampoule":"AMPOULE"}
ITEMS={"salt":"Item.Salt","glass_eye":"Item.GlassEye","power_cell":"Item.PowerCell","health_draught":"Item.HealthDraught","purification_ampoule":"Item.PurificationAmpoule"}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args()
    icons={"salt":salt(),"glass_eye":glass_eye(),"power_cell":power_cell(),"health_draught":health_draught(),"purification_ampoule":purification_ampoule()}
    products={};fragment={"sheets":{},"frames":{}};bounds={}
    for key,icon in icons.items():
        name="ashveil-"+key.replace("_","-")
        occupied=[(x,y) for y,row in enumerate(icon.pixels) for x,p in enumerate(row) if p!="."]
        assert occupied and all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds[key]=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        for ext,data in [(".png",png(icon)),(".svg",svg(icon,key.replace("_"," "))),("-16.png",png(preview16(icon)))]:
            products[f"public/sprites/original/items/{name}{ext}"]=data
        sprite="original_"+key
        fragment["sheets"][sprite]=f"sprites/original/items/{name}.png"
        fragment["frames"][sprite]=[sprite,0,0,32,32]
    products["public/sprites/original/items/ashveil-nonpill-contact.png"]=png(contact(icons))
    products["public/sprites/original/items/ashveil-nonpill-palette.json"]=(json.dumps(PALETTE,indent=2)+"\n").encode()
    products["tools/art/nonpill-manifest.fragment.json"]=(json.dumps(fragment,indent=2)+"\n").encode()
    products["tools/art/nonpill-usage-survey.json"]=(json.dumps(USAGE_SURVEY,indent=2,ensure_ascii=False)+"\n").encode()
    records=[{"file":name,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for name,data in products.items()]
    source={"created":"2026-10-21","method":"original authored integer-coordinate pixel geometry","source":"tools/art/draw-nonpill-icons.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"externalImageInputs":[],"modifiedExistingImages":False,"itemCount":5,"nativePixels":[32,32],"previewPixels":[16,16],"alphaValues":[0,255],"paletteColors":len(PALETTE),"opaqueBounds":bounds,"integrationApplied":False,"itemToProposedSprite":{value:"original_"+key for key,value in ITEMS.items()},"proposalScope":"five existing non-pill definitions only; all six pill appearances and Item.WaterPill excluded","notEncoded":["quality","durability","charge","quantity","contents level","effect answer","potency","expiry","knowledge"],"visualInterpretation":"Loose salt crystals and manufactured glass eye follow explicit material names. Plain cell housing/contact geometry and ordinary opaque brewed-liquid vessel/closed glass ampoule are visual interpretations, not new container Items or canonical engineering specifications.","files":records}
    products["public/sprites/original/items/ashveil-nonpill-source.json"]=(json.dumps(source,indent=2,ensure_ascii=False)+"\n").encode()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"regeneration differs: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic files; five original non-pill icons")


if __name__=="__main__":main()
