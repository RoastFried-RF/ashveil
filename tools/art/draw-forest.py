#!/usr/bin/env python3
"""Draw two original ASHVEIL forest terrain sprites from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-forest.py [--check]
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
OUT = ROOT / "public/sprites/original"
PALETTE = {
    "o": "#24302d",
    "d": "#293c34",
    "t": "#3b5042",
    "m": "#52644e",
    "l": "#6c7b62",
    "p": "#8d9480",
    "c": "#b3b39a",
    "b": "#342e29",
    "r": "#51473a",
    "n": "#6f604a",
    "s": "#8b795b",
    "f": "#a49575",
    "u": "#465149",
    "v": "#626d5c",
    "w": "#85927c"
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
  "scope": "Read-only Root working-tree forest renderer/native frame contract snapshot; not a live game/world inspection.",
  "selectedKinds": [
    "living pine conifer",
    "dead tree"
  ],
  "oldFrames": {
    "tree": [
      "dw_env",
      0,
      0,
      80,
      96
    ],
    "tree_dead": [
      "dw_tree_dead",
      0,
      0,
      80,
      96
    ]
  },
  "oldSheets": {
    "dw_env": "sprites/dw_env.png",
    "dw_tree_dead": "sprites/dw_tree_dead.png"
  },
  "framesSharingExistingSheets": {
    "dw_env": {
      "tree": [
        "dw_env",
        0,
        0,
        80,
        96
      ],
      "rock": [
        "dw_env",
        82,
        0,
        48,
        32
      ],
      "mushrooms": [
        "dw_env",
        132,
        0,
        80,
        64
      ]
    },
    "dw_tree_dead": {
      "tree_dead": [
        "dw_tree_dead",
        0,
        0,
        80,
        96
      ]
    }
  },
  "spriteConsumers": [
    {
      "id": "Terrain.BlackwoodTree",
      "source": "src/content/core/defs/blackwood.json",
      "references": [
        {
          "jsonPath": "/visual/sprite",
          "key": "tree"
        }
      ],
      "definition": {
        "defType": "Terrain",
        "id": "Terrain.BlackwoodTree",
        "parent": "Terrain.Tree",
        "label": "검은 잎 나무",
        "description": "장막의 약한 빛에서도 자라도록 개량된 수목이다.",
        "visual": {
          "sprite": "tree",
          "scale": 0.4,
          "tint": 7361650
        }
      }
    },
    {
      "id": "Item.CampfireKit",
      "source": "src/content/core/defs/campfire.json",
      "references": [
        {
          "jsonPath": "/sprite",
          "key": "stump"
        }
      ],
      "definition": {
        "defType": "Item",
        "id": "Item.CampfireKit",
        "label": "야영 모닥불 꾸러미",
        "description": "돌 둘레와 장작 받침. 빈 땅에 설치한 뒤 실제 목재로 불을 피운다.",
        "sprite": "stump",
        "category": "misc",
        "weight": 4,
        "value": 6,
        "size": [
          2,
          2
        ],
        "place": "Terrain.Campfire",
        "material": "Material.Wood"
      }
    },
    {
      "id": "Item.Wood",
      "source": "src/content/core/defs/crafting.json",
      "references": [
        {
          "jsonPath": "/sprite",
          "key": "stump"
        }
      ],
      "definition": {
        "defType": "Item",
        "id": "Item.Wood",
        "label": "목재",
        "sprite": "stump",
        "category": "misc",
        "weight": 0,
        "value": 1,
        "size": [
          1,
          3
        ],
        "stackable": true,
        "maxStack": 3,
        "material": "Material.Wood"
      }
    },
    {
      "id": "Terrain.PineTree",
      "source": "src/content/core/defs/pine-tea.json",
      "references": [
        {
          "jsonPath": "/visual/sprite",
          "key": "tree_dead"
        }
      ],
      "definition": {
        "defType": "Terrain",
        "id": "Terrain.PineTree",
        "parent": "Terrain.Tree",
        "label": "살아 있는 소나무",
        "needles": {
          "item": "Item.PineNeedles",
          "count": 4,
          "turns": 20,
          "regrowTurns": 28800
        },
        "visual": {
          "sprite": "tree_dead",
          "scale": 1,
          "tint": 7709546
        }
      }
    },
    {
      "id": "Item.PegLeg",
      "source": "src/content/core/defs/prosthetics.json",
      "references": [
        {
          "jsonPath": "/sprite",
          "key": "stump"
        }
      ],
      "definition": {
        "defType": "Item",
        "id": "Item.PegLeg",
        "label": "막대 의족",
        "description": "결손 부위에 설치하는 막대 의족.",
        "sprite": "stump",
        "category": "medical",
        "weight": 1,
        "size": [
          1,
          2
        ],
        "value": 20,
        "prosthetic": "Prosthetic.PegLeg",
        "repair": {
          "material": "Item.Wood",
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
      "id": "Terrain.Tree",
      "source": "src/content/core/defs/terrain.json",
      "references": [
        {
          "jsonPath": "/sprites/0",
          "key": "tree_dead"
        }
      ],
      "definition": {
        "defType": "Terrain",
        "id": "Terrain.Tree",
        "label": "말라 죽은 나무",
        "sprites": [
          "tree_dead"
        ],
        "passable": false,
        "opaque": true,
        "moveMult": 1,
        "cover": 15,
        "gather": {
          "item": "Item.Wood",
          "count": 1,
          "turns": 20,
          "regrowTurns": 28800
        }
      }
    },
    {
      "id": "Item.WhitecapCulture",
      "source": "src/content/core/defs/whitecap.json",
      "references": [
        {
          "jsonPath": "/sprite",
          "key": "stump"
        }
      ],
      "definition": {
        "defType": "Item",
        "id": "Item.WhitecapCulture",
        "label": "흰갓 배양목",
        "description": "실제 목재와 천·흰갓으로 만든 배지. 빈 바닥에 설치한다. 햇빛20% 이하·5~35°C·실제 물이 필요하며 네 번 수확하면 목재 하나로 배지를 교체한다. 멸균하지 않았으며 재료 오염은 남는다.",
        "sprite": "stump",
        "category": "misc",
        "weight": 0.1,
        "stackable": false,
        "maxStack": 1,
        "value": 5,
        "size": [
          2,
          2
        ],
        "place": "Terrain.WhitecapPlot"
      }
    }
  ],
  "sourceFiles": [
    {
      "path": "src/client/sprites.json",
      "sha256": "bb9bf270ed45f49e704a9258b26e799a9a9c4735f547467205c5f23efe686c24"
    },
    {
      "path": "src/client/render/MapRenderer.ts",
      "sha256": "04f56938e9c27a721ae6b34171957f9d5bb459db9edd82b73040c8461cd7bf34"
    },
    {
      "path": "src/client/render/atlas.ts",
      "sha256": "37306b3a9e52548001e4a71d2d44614a4c7859d8719a62e695db0a95c92cba0a"
    },
    {
      "path": "src/content/core/defs/terrain.json",
      "sha256": "6ffecdd7087a3283b9412301c05eaa6e6f04918279fa09f2900e6b77d8bb6311"
    },
    {
      "path": "src/content/core/defs/pine-tea.json",
      "sha256": "b89f1f956ba1188426be7988eb3d2e9e2d6a6dc06acc6356c14db7b28e7a5b5d"
    },
    {
      "path": "src/content/core/defs/blackwood.json",
      "sha256": "70d96600d3dcd9e6422b3d38bd21db0ad8ad7cd1c37ec1f5b937d5d43437a4ca"
    },
    {
      "path": "src/content/core/defs/world.json",
      "sha256": "61c51da0af2605b1bf85e251baf4be61ff91e4ab27e48fa7c3ab9cda219f41f5"
    },
    {
      "path": "src/content/core/patches/pine-tea.json",
      "sha256": "d49d3d054e888c332ff54ae1e808ff71f4e732873f46fd4ffcd84bc8c05866e3"
    },
    {
      "path": "src/content/core/patches/terrain-fire.json",
      "sha256": "a9665d70545e2e4c60ac6f84d07b706669d62323547789d3c58d59e6ecd681c6"
    },
    {
      "path": "src/core/mapgen.ts",
      "sha256": "1f01c28e37c3bfbb574b0b1f37dd5729754b05a3d9c542a3a0d715908466b722"
    },
    {
      "path": "src/core/journey.ts",
      "sha256": "05a7a2d5cdfbd851b4aee27a3bd6999e2a3339edbcbdb800a7a9fba08e46265f"
    },
    {
      "path": "docs/CANON.md",
      "sha256": "fc6dcde298c5bdf18b1e648507abdd4b29c2d990b7a4c888a2957d7b586f72f7"
    },
    {
      "path": "docs/design/14-locations-and-dungeons.md",
      "sha256": "c6c232e607a2f79e340f522a6a8c4bcf9db380de21cca5d9ee5ac46c6c6c79e2"
    },
    {
      "path": "docs/lore/world-bible.md",
      "sha256": "59df5652bfc698f362f0b40613fd457f063a0865a4316c7ad7a2a6c23d0850cd"
    }
  ],
  "applied": false,
  "stumpExcludedBecause": "No current terrain stump frame/visual contract; legacy tile icon is shared with Wood/PegLeg/CampfireKit/WhitecapCulture.",
  "rendererContracts": {
    "staticDeadTerrain": {
      "terrain": "Terrain.Tree",
      "selector": "h % 4 === 0 ? tree : tree_dead",
      "anchor": [
        0.5,
        0.96
      ],
      "scaleX": "h % 2 ? .42 : -.42",
      "scaleY": 0.42,
      "tint": "0x9a9a92",
      "position": "tile origin + [8,16]"
    },
    "dynamicPine": {
      "terrain": "Terrain.PineTree",
      "sprite": "tree_dead",
      "scale": 1,
      "tint": "0x75a36a",
      "anchor": [
        0.5,
        0.96
      ],
      "position": "tile origin + [8,16]"
    },
    "blackwoodExcluded": {
      "terrain": "Terrain.BlackwoodTree",
      "sprite": "tree",
      "scale": 0.4
    },
    "animation": "No tree animation or indexed variant frames. Current Terrain.Tree visual alternatives are two image keys and hash-based horizontal mirror."
  }
}''')


def pine_tree():
    c=Canvas(80,96)
    # Trunk and roots are part of the tree; no ground ellipse, loot pile or shadow.
    c.polygon([(36, 18),(42, 17),(44, 73),(46, 85),(54, 90),(53, 92),
               (43, 90),(39, 92),(35, 90),(26, 92),(27, 89),(34, 85)],"o")
    c.polygon([(37, 20),(40, 20),(42, 75),(43, 85),(49, 90),(41, 88),
               (38, 90),(35, 88),(30, 90),(36, 84)],"r")
    c.line(38, 60, 39, 85,"n");c.line(40,70,41,85,"b")
    # An uneven stepped crown, authored as asymmetrical branch tiers.
    crown=[(39,5),(43,16),(47,21),(44,22),(54,29),(51,32),(58,36),
           (54,38),(63,46),(60,48),(70,58),(65,59),(74,68),(69,70),
           (73,75),(64,75),(60,80),(53,77),(48,82),(41,78),(35,81),
           (30,78),(23,81),(19,77),(12,78),(15,73),(6,73),(12,66),
           (9,64),(17,56),(13,55),(24,45),(19,44),(29,33),(25,33),
           (34,23),(31,23)]
    c.polygon(crown,"o")
    c.polygon([(39,8),(42,18),(44,22),(41,23),(50,29),(47,32),(54,36),
               (50,38),(59,46),(55,48),(65,57),(60,59),(68,67),(63,70),
               (67,73),(61,73),(58,77),(52,74),(48,78),(41,75),
               (35,78),(30,75),(24,78),(20,74),(15,75),(18,71),
               (11,71),(17,65),(14,63),(22,56),(18,54),(28,45),
               (23,44),(32,34),(29,32),(37,23),(34,22)],"t")
    # Needle clusters follow boughs and sag instead of forming smooth triangles.
    clusters=[([(39,11),(41,21),(37,26),(33,27),(37,21)],"m"),
              ([(38,27),(45,31),(43,34),(48,36),(39,36),(32,40),(30,39)],"m"),
              ([(37,36),(41,40),(37,45),(40,48),(30,48),(24,51),(27,46)],"d"),
              ([(43,39),(49,41),(55,46),(51,47),(55,50),(46,49),(40,44)],"m"),
              ([(33,44),(36,49),(30,53),(32,56),(24,56),(19,60),(22,55)],"m"),
              ([(41,49),(49,52),(56,57),(52,59),(60,63),(49,62),(42,58)],"d"),
              ([(35,55),(40,58),(35,63),(40,66),(29,65),(22,69),(17,68),(26,60)],"m"),
              ([(45,60),(53,63),(59,67),(55,68),(63,72),(51,71),(47,74),(41,68)],"m"),
              ([(29,66),(35,68),(33,72),(36,74),(29,76),(24,74),(19,76),(23,71)],"d"),
              ([(39,69),(43,71),(47,78),(40,75),(35,78),(33,75)],"d")]
    for points,color in clusters:c.polygon(points,color)
    # Restrained grey ash on branch faces is material texture, never harvest hints.
    needles=[(38,17,40,19),(36,25,39,24),(42,29,46,31),(32,36,35,34),
             (45,41,49,43),(28,47,31,45),(25,51,28,50),(20,58,23,56),
             (43,54,47,55),(55,58,58,60),(29,61,32,60),(20,68,24,66),
             (48,66,52,67),(58,70,62,72),(27,73,30,72),(36,74,38,73)]
    for x0,y0,x1,y1 in needles:c.line(x0,y0,x1,y1,"l")
    for x,y in [(39,14),(36,26),(46,31),(34,35),(29,47),(47,43),(23,58),(31,61),(59,71),(25,72)]:c.point(x,y,"p")
    c.line(38,77,38,86,"n");c.point(36,88,"s")
    return c


def stroke(c, points, widths, color):
    for i,(a,b) in enumerate(zip(points,points[1:])):
        radius=widths[i]
        for dy in range(-radius,radius+1):
            for dx in range(-radius,radius+1):
                if dx*dx+dy*dy<=radius*radius+1:c.line(a[0]+dx,a[1]+dy,b[0]+dx,b[1]+dy,color)


def dead_tree():
    c=Canvas(80,96)
    # Tapered weathered branching: no harvest marker, burnt state, attached loot or ground shadow.
    branches=[([(38,85),(40,67),(43,52),(42,35),(40,19),(38,6)],[6,5,4,3,2]),
              ([(40,60),(30,49),(24,35),(14,28),(10,17)],[4,3,2,1]),
              ([(27,43),(16,42),(7,37)],[2,1]),
              ([(24,35),(25,22),(21,13)],[2,1]),
              ([(41,52),(53,43),(58,30),(68,23),(71,11)],[4,3,2,1]),
              ([(57,32),(52,21),(53,9)],[2,1]),
              ([(67,25),(73,29)],[1]),
              ([(42,34),(47,28),(45,15)],[2,1]),
              ([(40,21),(32,16),(30,8)],[2,1]),
              ([(14,28),(7,26)],[1])]
    for points,widths in branches:stroke(c,points,widths,"o")
    for points,widths in branches:stroke(c,points,[max(0,r-1) for r in widths],"r")
    c.polygon([(33,78),(43,77),(44,86),(51,90),(53,92),(45,91),
               (40,89),(36,92),(32,90),(24,92),(27,89),(32,86)],"o")
    c.polygon([(35,78),(40,78),(41,86),(47,90),(39,87),(35,90),(29,90),(34,85)],"r")
    c.line(37,83,38,71,"n");c.line(38,71,41,55,"n")
    c.line(40,55,39,42,"b");c.line(39,42,40,29,"n")
    c.line(39,24,37,14,"n");c.point(38,8,"s")
    c.line(38,57,30,48,"n");c.line(29,47,24,35,"n")
    c.line(23,34,16,29,"n");c.line(13,26,11,20,"s")
    c.line(25,30,26,23,"n");c.point(22,15,"s")
    c.line(31,43,20,42,"n");c.point(10,38,"s")
    c.line(44,51,53,43,"n");c.line(54,41,58,31,"n")
    c.line(60,29,68,23,"n");c.point(71,14,"s")
    c.line(54,24,53,14,"n");c.point(53,10,"s")
    c.line(44,33,47,27,"n");c.point(45,17,"s")
    # Fine bark fissures and small lichens stay within the wood silhouette.
    c.line(35,78,36,70,"b");c.line(41,77,42,68,"b")
    c.line(36,86,38,85,"b");c.point(39,64,"b")
    for x,y in [(35,80),(36,72),(41,48),(28,43),(53,39),(38,31)]:
        c.point(x,y,"u");c.point(x+1,y,"v")
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



def scaled_review(icon, scale=.42):
    width,height=round(icon.width*scale),round(icon.height*scale)
    out=Canvas(width,height)
    for y in range(height):
        for x in range(width):out.point(x,y,icon.pixels[min(icon.height-1,int((y+.5)/scale))][min(icon.width-1,int((x+.5)/scale))])
    return out


def mirrored(icon):
    out=Canvas(icon.width,icon.height)
    for y,row in enumerate(icon.pixels):out.pixels[y]=list(reversed(row))
    return out


def contact(icons):
    out=Canvas(768,472,"#151e20")
    for index,(key,icon) in enumerate(icons.items()):
        left=index*384;out.rect(left+8,8,368,456,"#22302e")
        text(out,left+160,18,"PINE" if key=="pine_tree" else "DEAD",2)
        out.blit(icon,left+112,42,2)
        out.blit(icon,left+28,264)
        out.blit(mirrored(icon),left+124,264)
        out.blit(scaled_review(icon),left+234,264,4)
        text(out,left+30,374,"NATIVE");text(out,left+126,374,"MIRROR");text(out,left+276,434,"MAP")
    return out


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args()
    icons={"pine_tree":pine_tree(),"dead_tree":dead_tree()};products={};bounds={}
    fragment={"sheets":{},"frames":{}}
    for key,icon in icons.items():
        stem="ashveil-"+key.replace("_","-");sheet="original_forest_"+("pine" if key=="pine_tree" else "dead")
        occupied=[(x,y) for y,row in enumerate(icon.pixels) for x,p in enumerate(row) if p!="."]
        assert occupied and all(0<x<79 and 0<y<95 for x,y in occupied)
        bounds[key]=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        assert bounds[key][3]==91
        products[f"public/sprites/original/{stem}.png"]=png(icon)
        products[f"public/sprites/original/{stem}.svg"]=svg(icon,key.replace("_"," "))
        products[f"public/sprites/original/{stem}-map-review.png"]=png(scaled_review(icon))
        fragment["sheets"][sheet]=f"sprites/original/{stem}.png"
        fragment["frames"]["original_"+key]=[sheet,0,0,80,96]
    products["public/sprites/original/ashveil-forest-contact.png"]=png(contact(icons))
    products["public/sprites/original/ashveil-forest-palette.json"]=(json.dumps(PALETTE,indent=2)+"\n").encode()
    products["tools/art/forest-manifest.fragment.json"]=(json.dumps(fragment,indent=2)+"\n").encode()
    products["tools/art/forest-usage-survey.json"]=(json.dumps(USAGE_SURVEY,indent=2,ensure_ascii=False)+"\n").encode()
    source={"created":"2026-10-21","method":"original authored integer-coordinate polygons, tapered branch strokes and needle clusters","source":"tools/art/draw-forest.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"externalImageInputs":[],"modifiedExistingImages":False,"selectedKinds":2,"nativeFrame":[80,96],"anchor":[.5,.96],"nativeAnchorPixel":[40,92.16],"opaqueBounds":bounds,"nativeObjectHeights":{key:box[3]-box[1]+1 for key,box in bounds.items()},"groundLastOpaqueRow":91,"groundBoundary":92,"anchorToGroundBoundaryNativeGap":.16,"currentStaticDeadScale":.42,"currentDynamicPineScale":1,"reviewScale":.42,"reviewRounding":"round dimensions, nearest source centre at ((x+.5)/.42,(y+.5)/.42); illustrative pixel sampling, not a GPU screenshot","fixedGroundShadow":False,"stateMarkers":[],"variantContract":"One native frame per kind, geometry supports current horizontal mirror. No new animation or resource/harvest state frames.","paletteColors":len(PALETTE),"alphaValues":[0,255],"integrationApplied":False,"integrationScope":"new keys only; preserve old tree,tree_dead,stump,dw_env and dw_tree_dead. Root must scope PineTree and dead-tree selection so Blackwood/shared item icons are unaffected.","notEncoded":["resource quantity","needle availability","gatherAt","burn state","light source","ground shadow"],"files":[{"file":name,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for name,data in products.items()]}
    products["public/sprites/original/ashveil-forest-source.json"]=(json.dumps(source,indent=2,ensure_ascii=False)+"\n").encode()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"regeneration differs: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic files; original pine and dead tree native80x96")


if __name__=="__main__":main()
