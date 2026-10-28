#!/usr/bin/env python3
"""Draw three original ASHVEIL crop inventory icons from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-crop-icons.py [--check]
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
  "scope": "Read-only core raw inheritance plus top-level sprite field patches from current Root working tree; no DB/world execution.",
  "items": [
    {
      "id": "Item.ShadeSeeds",
      "source": "src/content/core/defs/blackwood.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.ShadeSeeds",
        "label": "봉인된 그늘 작물 종자",
        "description": "종자 금고에 보관된 실제 재배용 종자 봉지. 땅에 심으면 그늘 작물 밭을 만든다.",
        "sprite": "cloth",
        "category": "misc",
        "weight": 0.05,
        "size": [
          1,
          1
        ],
        "stackable": true,
        "maxStack": 5,
        "value": 12,
        "place": "Terrain.ShadePlot"
      },
      "resolvedDefinition": {
        "defType": "Item",
        "id": "Item.ShadeSeeds",
        "label": "봉인된 그늘 작물 종자",
        "description": "종자 금고에 보관된 실제 재배용 종자 봉지. 땅에 심으면 그늘 작물 밭을 만든다.",
        "sprite": "cloth",
        "category": "misc",
        "weight": 0.05,
        "size": [
          1,
          1
        ],
        "stackable": true,
        "maxStack": 5,
        "value": 12,
        "place": "Terrain.ShadePlot"
      }
    },
    {
      "id": "Item.ShadeRoot",
      "source": "src/content/core/defs/blackwood.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.ShadeRoot",
        "parent": "Item.Hardtack",
        "label": "그늘뿌리",
        "description": "저조도에서 자라는 검은 잎 식물의 둥근 뿌리. 그늘 마을의 주식이다.",
        "weight": 0.3,
        "value": 4,
        "food": {
          "kcal": 300,
          "protein": 5,
          "vitamin": 1,
          "water": 45,
          "thirst": 0,
          "freshHours": 120,
          "cooked": false
        }
      },
      "resolvedDefinition": {
        "defType": "Item",
        "id": "Item.ShadeRoot",
        "label": "그늘뿌리",
        "sprite": "hardtack",
        "category": "food",
        "weight": 0.3,
        "stackable": true,
        "value": 4,
        "food": {
          "kcal": 300,
          "protein": 5,
          "vitamin": 1,
          "water": 45,
          "thirst": 0,
          "freshHours": 120,
          "cooked": false
        },
        "size": [
          1,
          1
        ],
        "maxStack": 5,
        "parent": "Item.Hardtack",
        "description": "저조도에서 자라는 검은 잎 식물의 둥근 뿌리. 그늘 마을의 주식이다."
      }
    },
    {
      "id": "Item.Whitecap",
      "source": "src/content/core/defs/whitecap.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.Whitecap",
        "label": "흰갓버섯",
        "description": "관로 입구와 어두운 배양목에서 기르는 버섯. 날것은 탈이 날 수 있다.",
        "sprite": "ash_cap",
        "category": "food",
        "weight": 0.05,
        "stackable": true,
        "maxStack": 5,
        "value": 2,
        "size": [
          1,
          1
        ],
        "food": {
          "kcal": 120,
          "vitamin": 3,
          "water": 30,
          "raw": true,
          "poison": 5,
          "protein": 3,
          "freshHours": 72
        }
      },
      "resolvedDefinition": {
        "defType": "Item",
        "id": "Item.Whitecap",
        "label": "흰갓버섯",
        "description": "관로 입구와 어두운 배양목에서 기르는 버섯. 날것은 탈이 날 수 있다.",
        "sprite": "ash_cap",
        "category": "food",
        "weight": 0.05,
        "stackable": true,
        "maxStack": 5,
        "value": 2,
        "size": [
          1,
          1
        ],
        "food": {
          "kcal": 120,
          "vitamin": 3,
          "water": 30,
          "raw": true,
          "poison": 5,
          "protein": 3,
          "freshHours": 72
        }
      }
    }
  ],
  "existingSharedSpriteConsumers": {
    "cloth": [
      {
        "id": "Item.Bedroll",
        "source": "src/content/core/defs/camping.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.CalvisJournal",
        "source": "src/content/core/defs/zero-vault.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.ChimneyHalfManual",
        "source": "src/content/core/defs/zero-vault.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.Cloth",
        "source": "src/content/core/defs/items-consumables.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.ClothFilter",
        "source": "src/content/core/defs/water-items.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.CorporateCodePlate",
        "source": "src/content/core/defs/zero-vault.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.FieldMat",
        "source": "src/content/core/defs/camping.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.HydraulicFluid",
        "source": "src/content/core/defs/machines.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.Linen",
        "source": "src/content/core/defs/crafting.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.MachinePatch",
        "source": "src/content/core/defs/machines.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.RawFragment",
        "source": "src/content/core/defs/material-crafting.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.Rope",
        "source": "src/content/core/defs/prisoners.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.SeedVaultLedger",
        "source": "src/content/core/defs/blackwood.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.ShadeSeeds",
        "source": "src/content/core/defs/blackwood.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.SignalMaintenanceManual",
        "source": "src/content/core/defs/field-devices.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.Thread",
        "source": "src/content/core/defs/crafting.json",
        "resolvedSprite": "cloth"
      },
      {
        "id": "Item.Wax",
        "source": "src/content/core/defs/crafting.json",
        "resolvedSprite": "cloth"
      }
    ],
    "hardtack": [
      {
        "id": "Item.Hardtack",
        "source": "src/content/core/defs/items-consumables.json",
        "resolvedSprite": "hardtack"
      },
      {
        "id": "Item.ShadeRoot",
        "source": "src/content/core/defs/blackwood.json",
        "resolvedSprite": "hardtack"
      }
    ],
    "ash_cap": [
      {
        "id": "Item.AshCap",
        "source": "src/content/core/defs/items-consumables.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.AshLeaf",
        "source": "src/content/core/defs/items-consumables.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.BakedPotato",
        "source": "src/content/core/defs/plant-foods.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.BitterMoss",
        "source": "src/content/core/defs/items-consumables.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.Cabbage",
        "source": "src/content/core/defs/fermentation.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.CabbageSeed",
        "source": "src/content/core/defs/fermentation.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.CrackedEgg",
        "source": "src/content/core/defs/eggs.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.Egg",
        "source": "src/content/core/defs/eggs.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.OatSeed",
        "source": "src/content/core/defs/oatmeal.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.Oats",
        "source": "src/content/core/defs/oatmeal.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.PineNeedles",
        "source": "src/content/core/defs/pine-tea.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.PotatoSeed",
        "source": "src/content/core/defs/plant-foods.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.RawPotato",
        "source": "src/content/core/defs/plant-foods.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.Turnip",
        "source": "src/content/core/defs/plant-foods.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.TurnipSeed",
        "source": "src/content/core/defs/plant-foods.json",
        "resolvedSprite": "ash_cap"
      },
      {
        "id": "Item.Whitecap",
        "source": "src/content/core/defs/whitecap.json",
        "resolvedSprite": "ash_cap"
      }
    ]
  },
  "spriteFieldPatchesObserved": [
    {
      "source": "src/content/core/patches/food-icons.json",
      "patch": {
        "op": "replace",
        "target": "Item.Cheese",
        "path": "/sprite",
        "value": "food_cheese"
      }
    },
    {
      "source": "src/content/core/patches/food-icons.json",
      "patch": {
        "op": "replace",
        "target": "Item.AshBerry",
        "path": "/sprite",
        "value": "food_strawberry"
      }
    },
    {
      "source": "src/content/core/patches/nonpill-original-icons.json",
      "patch": {
        "op": "replace",
        "target": "Item.Salt",
        "path": "/sprite",
        "value": "original_salt"
      }
    },
    {
      "source": "src/content/core/patches/nonpill-original-icons.json",
      "patch": {
        "op": "replace",
        "target": "Item.GlassEye",
        "path": "/sprite",
        "value": "original_glass_eye"
      }
    },
    {
      "source": "src/content/core/patches/nonpill-original-icons.json",
      "patch": {
        "op": "replace",
        "target": "Item.PowerCell",
        "path": "/sprite",
        "value": "original_power_cell"
      }
    },
    {
      "source": "src/content/core/patches/nonpill-original-icons.json",
      "patch": {
        "op": "replace",
        "target": "Item.HealthDraught",
        "path": "/sprite",
        "value": "original_health_draught"
      }
    },
    {
      "source": "src/content/core/patches/nonpill-original-icons.json",
      "patch": {
        "op": "replace",
        "target": "Item.PurificationAmpoule",
        "path": "/sprite",
        "value": "original_purification_ampoule"
      }
    },
    {
      "source": "src/content/core/patches/original-storage-art.json",
      "patch": {
        "op": "replace",
        "target": "Item.Sack",
        "path": "/sprite",
        "value": "ashveil_sack"
      }
    },
    {
      "source": "src/content/core/patches/original-storage-art.json",
      "patch": {
        "op": "replace",
        "target": "Item.Quiver",
        "path": "/sprite",
        "value": "ashveil_quiver"
      }
    },
    {
      "source": "src/content/core/patches/original-storage-art.json",
      "patch": {
        "op": "replace",
        "target": "Item.LeatherBelt",
        "path": "/sprite",
        "value": "ashveil_leather_belt"
      }
    },
    {
      "source": "src/content/core/patches/original-storage-art.json",
      "patch": {
        "op": "replace",
        "target": "Item.Arrow",
        "path": "/sprite",
        "value": "ashveil_arrow_bundle"
      }
    },
    {
      "source": "src/content/core/patches/storage-chest-original.json",
      "patch": {
        "op": "replace",
        "target": "Item.StorageChest",
        "path": "/sprite",
        "value": "original_storage_chest_item"
      }
    }
  ],
  "existingDedicatedCropFramesPresent": [],
  "legacyAshcapOriginal": {
    "generator": "tools/art/ashcap.py",
    "generatorSha256": "8f3e42093a167dbd9d7b9e500447e762a83e99a61222dcbe3789ba6b3c49920a",
    "declaredPurpose": "Original CC0 ash-cap mushroom,16x16 art upscaled to32x32; not a dedicated Whitecap icon.",
    "legacyTile": "public/tiles/ash_cap.png",
    "legacyTileSha256": "12e4e38b4c06982d3ec1086d7669ddd2e7a17d8772f161fb9f7a2ef46351fc4e",
    "existingPixelsUsed": false,
    "decision": "Preserve existing ash_cap and all users; create one distinct dedicated single-whitecap geometry only for Item.Whitecap."
  },
  "sourceFiles": [
    {
      "path": "src/client/sprites.json",
      "sha256": "ea1b8215c7a9fc4f1d87ed12f0e61d93d3cf151760d9576bd0799d01978c56da"
    },
    {
      "path": "src/content/core/defs/blackwood.json",
      "sha256": "70d96600d3dcd9e6422b3d38bd21db0ad8ad7cd1c37ec1f5b937d5d43437a4ca"
    },
    {
      "path": "src/content/core/defs/whitecap.json",
      "sha256": "0c6df48dc8a1caf9a5035fb6378523e514f331709588d5a30eec6bb899f1aa6c"
    },
    {
      "path": "src/content/core/defs/items-consumables.json",
      "sha256": "e18f842b569670fa3f6006b96d9384e0b950c8c586457c9a1c32cc0d096e2195"
    },
    {
      "path": "src/content/core/patches/whitecap.json",
      "sha256": "df1a84e70fa197ee3bd60d91fbab351b90c2710a75c2de4eca1cf76b88533e69"
    },
    {
      "path": "src/content/core/patches/blackwood.json",
      "sha256": "f735af013362839d55c6a5a7a74b0650cc60915c07fb88f19ac996e20be5fe60"
    },
    {
      "path": "tools/art/ashcap.py",
      "sha256": "8f3e42093a167dbd9d7b9e500447e762a83e99a61222dcbe3789ba6b3c49920a"
    },
    {
      "path": "docs/CANON.md",
      "sha256": "fc6dcde298c5bdf18b1e648507abdd4b29c2d990b7a4c888a2957d7b586f72f7"
    },
    {
      "path": "docs/lore/world-bible.md",
      "sha256": "59df5652bfc698f362f0b40613fd457f063a0865a4316c7ad7a2a6c23d0850cd"
    },
    {
      "path": "docs/lore/factions.md",
      "sha256": "8cc9eb1ccf4852a732a9f83942b2d1144a6df9319d24cd45a18e855137436eb1"
    },
    {
      "path": "docs/whitecap-implementation.md",
      "sha256": "b80cd6c0165ec24234388f389a1c6de729549e45f4da9b0543db18c9ce155514"
    },
    {
      "path": "docs/crop-contamination-implementation.md",
      "sha256": "11bceec8eab298396dd5e6f9984b544d3f6072f2a6d310d35472745d66203a8d"
    }
  ],
  "integrationApplied": false
}''')


def shade_seeds():
    c=Canvas()
    # A flat closed cloth packet, with a folded mouth and stitched side rather than a jar neck.
    c.polygon([(6,7),(25,7),(25,25),(22,29),(7,28),(5,24)],"o")
    c.polygon([(7,9),(23,9),(23,24),(21,27),(8,26),(7,23)],"c")
    c.polygon([(9,11),(21,11),(22,23),(20,26),(10,25),(8,22)],"p")
    c.line(9,13,9,20,"h");c.line(11,24,18,25,"h")
    c.line(23,13,23,23,"n")
    for y in [13,16,19,22]:c.point(22,y,"r")
    c.polygon([(6,22),(10,25),(8,27),(6,25)],"n")
    # The plain rolled fold follows the item's description; no contents, count or germination emblem.
    c.polygon([(5,5),(24,5),(26,8),(24,11),(6,10)],"o")
    c.polygon([(7,6),(23,6),(24,8),(22,9),(7,8)],"p")
    c.line(8,6,21,6,"h");c.line(8,8,22,9,"c")
    c.line(21,7,19,11,"d");c.line(22,7,20,11,"t")
    c.row(23,10,"tm");c.line(24,11,25,14,"t")
    return c


def shade_root():
    c=Canvas()
    # A round harvested root from a black-leaf plant, with a short natural crown and rootlets.
    c.polygon([(13,10),(10,7),(9,3),(13,4),(16,9),(18,4),(22,3),
               (21,8),(18,12)],"o")
    c.polygon([(10,5),(12,6),(15,10),(12,9)],"t")
    c.line(18,9,20,6,"m")
    c.point(11,4,"u");c.point(21,4,"u")
    c.polygon([(10,10),(20,10),(25,14),(27,19),(25,24),(20,27),
               (18,29),(14,29),(12,27),(7,24),(5,20),(6,15)],"o")
    c.polygon([(11,11),(19,11),(23,14),(25,19),(23,23),(19,26),
               (15,27),(12,25),(8,23),(7,19),(8,15)],"r")
    c.polygon([(11,12),(18,12),(21,14),(23,18),(21,22),(17,25),
               (12,23),(9,20),(9,16)],"n")
    c.line(10,15,9,18,"s");c.line(12,13,16,12,"f")
    c.line(11,21,14,23,"s");c.line(19,22,21,20,"b")
    c.point(14,17,"r");c.point(19,15,"r");c.point(16,24,"r")
    c.line(15,26,16,29,"n");c.point(18,29,"r")
    c.line(7,23,5,26,"r");c.point(4,27,"n")
    c.line(24,23,26,25,"r");c.point(27,25,"n")
    return c


def whitecap():
    c=Canvas()
    # One dedicated broad ivory cap and stem, new geometry unrelated to the legacy two-ashcap tile.
    c.polygon([(13,15),(19,15),(20,22),(23,26),(21,29),(10,29),
               (8,27),(11,23),(12,19)],"o")
    c.polygon([(14,17),(17,17),(18,22),(20,26),(19,27),(11,27),
               (13,23)],"c")
    c.polygon([(14,18),(16,18),(16,24),(18,26),(12,26),(14,22)],"p")
    c.line(14,20,14,24,"h");c.line(18,23,19,25,"n")
    c.polygon([(3,16),(4,12),(8,8),(13,6),(19,6),(24,9),(28,13),
               (29,17),(26,20),(22,21),(9,21),(5,19)],"o")
    c.polygon([(5,16),(6,12),(10,9),(14,7),(18,7),(23,10),(26,13),
               (27,17),(24,19),(10,19),(6,18)],"p")
    c.polygon([(7,14),(10,10),(15,8),(19,8),(23,11),(25,14),
               (24,16),(18,17),(10,17),(6,16)],"h")
    c.line(7,18,12,19,"c");c.line(13,19,23,19,"c")
    c.line(8,19,11,20,"n");c.line(14,19,14,20,"n")
    c.line(19,19,21,20,"n");c.point(25,18,"c")
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
    c=Canvas(576,376,"#11191f")
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


LABELS={"shade_seeds":"SEEDS","shade_root":"ROOT","whitecap":"WHITECAP"}
ITEMS={"shade_seeds":"Item.ShadeSeeds","shade_root":"Item.ShadeRoot","whitecap":"Item.Whitecap"}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args()
    icons={"shade_seeds":shade_seeds(),"shade_root":shade_root(),"whitecap":whitecap()}
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
    products["public/sprites/original/items/ashveil-crop-contact.png"]=png(contact(icons))
    products["public/sprites/original/items/ashveil-crop-palette.json"]=(json.dumps(PALETTE,indent=2)+"\n").encode()
    products["tools/art/crop-manifest.fragment.json"]=(json.dumps(fragment,indent=2)+"\n").encode()
    products["tools/art/crop-usage-survey.json"]=(json.dumps(USAGE_SURVEY,indent=2,ensure_ascii=False)+"\n").encode()
    records=[{"file":name,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for name,data in products.items()]
    source={"created":"2026-10-21","method":"original authored integer-coordinate pixel geometry","source":"tools/art/draw-crop-icons.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"externalImageInputs":[],"modifiedExistingImages":False,"itemCount":3,"nativePixels":[32,32],"previewPixels":[16,16],"alphaValues":[0,255],"paletteColors":len(PALETTE),"opaqueBounds":bounds,"integrationApplied":False,"itemToProposedSprite":{value:"original_"+key for key,value in ITEMS.items()},"proposalScope":"exactly ShadeSeeds, ShadeRoot and Whitecap; original shared cloth/hardtack/ash_cap and cultivation terrain visuals excluded","notEncoded":["quality","durability","charge","quantity","contents count","effect answer","growth rate","contamination answer","freshness","knowledge"],"visualInterpretation":"Closed packet follows the actual seed-bag description. Round root with dark leaf crown follows ShadeRoot description. Single ivory mushroom is dedicated Whitecap geometry; shared old CC0 ash_cap remains untouched. Colors and pouch details are visual interpretations, not efficacy, growth, cleanliness or freshness state.","files":records}
    products["public/sprites/original/items/ashveil-crop-source.json"]=(json.dumps(source,indent=2,ensure_ascii=False)+"\n").encode()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"regeneration differs: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic files; three original crop icons")


if __name__=="__main__":main()
