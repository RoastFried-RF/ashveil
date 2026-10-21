#!/usr/bin/env python3
"""Draw original ASHVEIL wood storage chest world states and item icon from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-storage-chest.py [--check]
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
  "scope": "Read-only Root working-tree storage-chest source survey; no game simulation or existing image pixel input.",
  "item": {
    "defType": "Item",
    "id": "Item.StorageChest",
    "label": "목제 보관함",
    "description": "직접 만든 보관함. 비어 있는 땅에 설치하고 주변을 정비해 거점으로 쓸 수 있다.",
    "sprite": "chest",
    "category": "misc",
    "weight": 8,
    "value": 12,
    "size": [
      3,
      2
    ],
    "place": "Terrain.Stash",
    "material": "Material.Wood"
  },
  "recipe": {
    "defType": "Recipe",
    "id": "Recipe.StorageChest",
    "label": "목제 보관함 만들기",
    "category": "woodwork",
    "primaryAttr": "str",
    "basic": true,
    "workTurns": 120,
    "inputs": [
      {
        "item": "Item.Wood",
        "count": 4
      },
      {
        "item": "Item.Cloth",
        "count": 1
      }
    ],
    "output": {
      "item": "Item.StorageChest",
      "count": 1
    },
    "mastery": "survival"
  },
  "terrain": {
    "defType": "Terrain",
    "id": "Terrain.Stash",
    "parent": "Terrain.Chest",
    "label": "야영지 보관함",
    "description": "12×8 칸. 짐을 두고 다닐 수 있다.",
    "container": "Loot.Empty",
    "sprites": [
      "chest0"
    ],
    "lootGrid": [
      12,
      8
    ],
    "openTurns": 0,
    "openNoise": 0
  },
  "terrainParent": {
    "defType": "Terrain",
    "id": "Terrain.Chest",
    "parent": "Terrain.Container",
    "label": "궤짝",
    "sprites": [
      "chest0"
    ],
    "container": "Loot.Chest",
    "lootGrid": [
      6,
      4
    ],
    "openTurns": 1,
    "openNoise": 2,
    "cover": 15
  },
  "material": {
    "defType": "Material",
    "id": "Material.Wood",
    "label": "잿나무",
    "category": "Wood",
    "density": 0.7,
    "sharpness": 10,
    "hardness": 20,
    "toughness": 50,
    "insulation": 0,
    "wetLoss": 0,
    "corrosionResist": 50,
    "flammability": 2,
    "valuePerKg": 0.5
  },
  "spriteConsumers": [
    {
      "id": "Item.StorageChest",
      "source": "src/content/core/defs/base-camp.json",
      "references": [
        {
          "jsonPath": "/sprite",
          "key": "chest"
        }
      ],
      "definition": {
        "defType": "Item",
        "id": "Item.StorageChest",
        "label": "목제 보관함",
        "description": "직접 만든 보관함. 비어 있는 땅에 설치하고 주변을 정비해 거점으로 쓸 수 있다.",
        "sprite": "chest",
        "category": "misc",
        "weight": 8,
        "value": 12,
        "size": [
          3,
          2
        ],
        "place": "Terrain.Stash",
        "material": "Material.Wood"
      }
    },
    {
      "id": "Terrain.Chest",
      "source": "src/content/core/defs/terrain.json",
      "references": [
        {
          "jsonPath": "/sprites/0",
          "key": "chest0"
        }
      ],
      "definition": {
        "defType": "Terrain",
        "id": "Terrain.Chest",
        "parent": "Terrain.Container",
        "label": "궤짝",
        "sprites": [
          "chest0"
        ],
        "container": "Loot.Chest",
        "lootGrid": [
          6,
          4
        ],
        "openTurns": 1,
        "openNoise": 2,
        "cover": 15
      }
    },
    {
      "id": "Terrain.GuardChest",
      "source": "src/content/core/defs/terrain.json",
      "references": [
        {
          "jsonPath": "/sprites/0",
          "key": "chest0"
        }
      ],
      "definition": {
        "defType": "Terrain",
        "id": "Terrain.GuardChest",
        "parent": "Terrain.Chest",
        "label": "경비실 상자",
        "container": "Loot.GuardChest",
        "sprites": [
          "chest0"
        ],
        "lootGrid": [
          6,
          4
        ],
        "openTurns": 1,
        "openNoise": 2,
        "cover": 15
      }
    },
    {
      "id": "Terrain.Stash",
      "source": "src/content/core/defs/terrain.json",
      "references": [
        {
          "jsonPath": "/sprites/0",
          "key": "chest0"
        }
      ],
      "definition": {
        "defType": "Terrain",
        "id": "Terrain.Stash",
        "parent": "Terrain.Chest",
        "label": "야영지 보관함",
        "description": "12×8 칸. 짐을 두고 다닐 수 있다.",
        "container": "Loot.Empty",
        "sprites": [
          "chest0"
        ],
        "lootGrid": [
          12,
          8
        ],
        "openTurns": 0,
        "openNoise": 0
      }
    },
    {
      "id": "Item.CoracleKit",
      "source": "src/content/core/defs/watercraft.json",
      "references": [
        {
          "jsonPath": "/sprite",
          "key": "chest"
        }
      ],
      "definition": {
        "defType": "Item",
        "id": "Item.CoracleKit",
        "label": "접은 통가죽배",
        "description": "나무틀과 꿰맨 가죽의 소형 배. 실제 부두에서 펴고 띄운다. 정원4명과 별도 화물함을 갖는다.",
        "sprite": "chest",
        "category": "tool",
        "weight": 0,
        "size": [
          3,
          3
        ],
        "value": 180,
        "watercraft": {
          "seats": 4,
          "turnsPerCell": 600,
          "launchTurns": 1,
          "minDurability": 10,
          "wearPerHour": 0.2,
          "deckTerrain": "Terrain.BoatDeck",
          "waterTerrain": "Terrain.SeaDeep",
          "cargoTerrain": "Terrain.BoatHold",
          "cargoPos": [
            7,
            6
          ],
          "deck": [
            6,
            4,
            6,
            5
          ],
          "anchor": [
            8,
            6
          ],
          "weather": {
            "clear": 1,
            "overcast": 1,
            "deepOvercast": 1.1,
            "ashrain": 1.2,
            "frostfog": 1.5,
            "ashsnow": 1.4,
            "ashstorm": 0,
            "ashgale": 0
          },
          "repair": {
            "item": "Item.Wood",
            "count": 1,
            "turns": 120,
            "restore": 20
          }
        },
        "repair": {
          "material": "Item.Wood",
          "unitsPer10": 1,
          "turns": 120,
          "attr": "per",
          "tools": [
            "needle"
          ]
        }
      }
    }
  ],
  "legacyFrames": {
    "chest0": [
      "objects",
      0,
      16,
      16,
      16
    ],
    "chest1": [
      "objects",
      16,
      16,
      16,
      16
    ],
    "chest2": [
      "objects",
      32,
      16,
      16,
      16
    ],
    "chest_red0": [
      "objects",
      0,
      48,
      16,
      16
    ],
    "chest_red1": [
      "objects",
      16,
      48,
      16,
      16
    ],
    "chest_red2": [
      "objects",
      32,
      48,
      16,
      16
    ]
  },
  "legacyAnimation": {
    "frames": [
      "chest0",
      "chest1",
      "chest2"
    ],
    "fps": 10
  },
  "objectsSheetFrameCount": 20,
  "legacyItemIcon": {
    "path": "public/tiles/chest.png",
    "size": [
      32,
      32
    ],
    "sha256": "73ac50552ced1f01d18946e0bd4645caa1be2a4faa857e8ae1797348d5393bca",
    "pixelsReadForDrawing": false
  },
  "storageFirePatch": [
    {
      "op": "add",
      "target": "Terrain.Stash",
      "path": "/combustion",
      "value": {
        "family": "wood-stash",
        "burnTurns": 600,
        "burnedAs": "Terrain.Earth"
      }
    },
    {
      "op": "replace",
      "target": "Terrain.Stash",
      "path": "/description",
      "value": "12×8 칸. 목제 보관함은 불씨에 타며 소진되면 안의 원래 물품은 같은 자리에 남는다. 실제 물로 불을 끌 수 있다."
    }
  ],
  "renderer": {
    "worldCell": [
      16,
      16
    ],
    "anchor": [
      0.5,
      1
    ],
    "anchorPixel": [
      8,
      16
    ],
    "scale": 1,
    "position": "[tile.x*16+8,tile.y*16+16]",
    "openSelection": "opened=!!tile.searched; if hasFrame(base.replace(/0$/,\"2\")) use that frame",
    "openedTint": "0x8a8478",
    "stateMeaning": "searched/open appearance; no empty, lock or loot-quality guarantee"
  },
  "inventoryUI": {
    "itemGrid": [
      3,
      2
    ],
    "cellPixels": 38,
    "itemRectangle": [
      112,
      74
    ],
    "iconPixels": 64,
    "sourceIconPixels": [
      32,
      32
    ]
  },
  "sourceFiles": [
    {
      "path": "src/client/sprites.json",
      "sha256": "a4649422e74c0945e0384a2a9a64a3a2a76328a66e7766d31452db0c74ed6763"
    },
    {
      "path": "src/client/render/MapRenderer.ts",
      "sha256": "74b01d974cbaed88c46718f2def0cafd5cc20069a525a3c87d09e762e3215721"
    },
    {
      "path": "src/client/render/atlas.ts",
      "sha256": "37306b3a9e52548001e4a71d2d44614a4c7859d8719a62e695db0a95c92cba0a"
    },
    {
      "path": "src/client/ui/ItemIcon.vue",
      "sha256": "f9abb6a4b7a49708b3aadb8c01f66026b3fc56c4d93aab6046596c0905429982"
    },
    {
      "path": "src/client/ui/InventoryWindow.vue",
      "sha256": "0da9b351376a544ebf1b58580ac643386292918fbe74b914455fe7be5e285f9f"
    },
    {
      "path": "src/content/core/defs/base-camp.json",
      "sha256": "7068d22961b3ec4544f6f616f1534e13e3eab41c9d308f95f6df50a1d5339803"
    },
    {
      "path": "src/content/core/defs/terrain.json",
      "sha256": "6ffecdd7087a3283b9412301c05eaa6e6f04918279fa09f2900e6b77d8bb6311"
    },
    {
      "path": "src/content/core/defs/watercraft.json",
      "sha256": "bb34d26415285e6c081f8f50b6e3641801fefd85aa898a38367d62065e7b1cce"
    },
    {
      "path": "src/content/core/patches/storage-fire.json",
      "sha256": "fe1ff85d78cf3cd6d634fd8023aab8257655f58356fbdf38584f9640b4ec47f5"
    },
    {
      "path": "src/core/base-camp.ts",
      "sha256": "b424cc1467b54acb63e4dff4099b5fc819097faa82edaf85a879e5b85874b7a9"
    },
    {
      "path": "docs/CANON.md",
      "sha256": "fc6dcde298c5bdf18b1e648507abdd4b29c2d990b7a4c888a2957d7b586f72f7"
    },
    {
      "path": "docs/design/13-inventory.md",
      "sha256": "acb89b5afc035794deb2b0234c75dd0ee118d3ecb8f0fefc3ff0e123fc0c48e5"
    },
    {
      "path": "docs/design/08-items-and-crafting.md",
      "sha256": "82e5e907930da845d1c9584e7516d5829895e16c9dd753959c58c1b5a801c92f"
    },
    {
      "path": "src/content/core/defs/zero-vault.json",
      "sha256": "db88d71f71d47b47dd6549f68b3fde6c785e523eb00678b6b275bac41a0fe105"
    }
  ],
  "integrationApplied": false,
  "resolvedChestTerrainFamily": [
    {
      "id": "Terrain.Altar",
      "source": "src/content/core/defs/terrain.json",
      "parent": "Terrain.Chest",
      "rawDefinition": {
        "defType": "Terrain",
        "id": "Terrain.Altar",
        "parent": "Terrain.Chest",
        "label": "제단 상자",
        "container": "Loot.Altar",
        "sprites": [
          "chest_red0"
        ],
        "lootGrid": [
          4,
          3
        ],
        "openTurns": 1,
        "openNoise": 2,
        "elevation": 1,
        "cover": 15
      },
      "resolvedSprites": [
        "chest_red0"
      ],
      "resolvedContainer": "Loot.Altar",
      "resolvedLootGrid": [
        4,
        3
      ]
    },
    {
      "id": "Terrain.BoatHold",
      "source": "src/content/core/defs/watercraft.json",
      "parent": "Terrain.Chest",
      "rawDefinition": {
        "defType": "Terrain",
        "id": "Terrain.BoatHold",
        "parent": "Terrain.Chest",
        "label": "배의 화물함",
        "description": "이 배에 실제로 싣고 움직이는 짐이다.",
        "lootGrid": [
          4,
          4
        ],
        "openTurns": 1
      },
      "resolvedSprites": [
        "chest0"
      ],
      "resolvedContainer": "Loot.Chest",
      "resolvedLootGrid": [
        4,
        4
      ]
    },
    {
      "id": "Terrain.Chest",
      "source": "src/content/core/defs/terrain.json",
      "parent": "Terrain.Container",
      "rawDefinition": {
        "defType": "Terrain",
        "id": "Terrain.Chest",
        "parent": "Terrain.Container",
        "label": "궤짝",
        "sprites": [
          "chest0"
        ],
        "container": "Loot.Chest",
        "lootGrid": [
          6,
          4
        ],
        "openTurns": 1,
        "openNoise": 2,
        "cover": 15
      },
      "resolvedSprites": [
        "chest0"
      ],
      "resolvedContainer": "Loot.Chest",
      "resolvedLootGrid": [
        6,
        4
      ]
    },
    {
      "id": "Terrain.GuardChest",
      "source": "src/content/core/defs/terrain.json",
      "parent": "Terrain.Chest",
      "rawDefinition": {
        "defType": "Terrain",
        "id": "Terrain.GuardChest",
        "parent": "Terrain.Chest",
        "label": "경비실 상자",
        "container": "Loot.GuardChest",
        "sprites": [
          "chest0"
        ],
        "lootGrid": [
          6,
          4
        ],
        "openTurns": 1,
        "openNoise": 2,
        "cover": 15
      },
      "resolvedSprites": [
        "chest0"
      ],
      "resolvedContainer": "Loot.GuardChest",
      "resolvedLootGrid": [
        6,
        4
      ]
    },
    {
      "id": "Terrain.Stash",
      "source": "src/content/core/defs/terrain.json",
      "parent": "Terrain.Chest",
      "rawDefinition": {
        "defType": "Terrain",
        "id": "Terrain.Stash",
        "parent": "Terrain.Chest",
        "label": "야영지 보관함",
        "description": "12×8 칸. 짐을 두고 다닐 수 있다.",
        "container": "Loot.Empty",
        "sprites": [
          "chest0"
        ],
        "lootGrid": [
          12,
          8
        ],
        "openTurns": 0,
        "openNoise": 0
      },
      "resolvedSprites": [
        "chest0"
      ],
      "resolvedContainer": "Loot.Empty",
      "resolvedLootGrid": [
        12,
        8
      ]
    },
    {
      "id": "Terrain.ZeroVaultChest",
      "source": "src/content/core/defs/zero-vault.json",
      "parent": "Terrain.Chest",
      "rawDefinition": {
        "defType": "Terrain",
        "id": "Terrain.ZeroVaultChest",
        "parent": "Terrain.Chest",
        "label": "0호 금고 기록 보관함",
        "lootCrime": {
          "faction": "guard",
          "delta": -15,
          "reason": "0호 금고의 원본 기록을 가져감",
          "provoke": true
        }
      },
      "resolvedSprites": [
        "chest0"
      ],
      "resolvedContainer": "Loot.Chest",
      "resolvedLootGrid": [
        6,
        4
      ]
    }
  ],
  "sharedConsumptionNote": "Five direct references plus inherited BoatHold and ZeroVaultChest chest0 users; Altar inherits Chest but explicitly uses chest_red0. New keys are scoped only to Stash and StorageChest."
}''')

def world_body(c):
    # Common front/base for closed and opened states; wood with coarse cloth bindings.
    c.polygon([(1,8),(12,7),(15,9),(15,14),(12,16),(1,16)],"o")
    c.rect(2,10,10,5,"r")
    c.line(2,10,11,10,"n");c.line(2,12,11,12,"b");c.line(2,14,11,14,"n")
    c.polygon([(12,10),(14,9),(14,14),(12,15)],"b")
    c.line(13,11,13,13,"r")
    c.line(4,10,4,14,"p");c.point(4,12,"c")
    c.line(9,10,9,14,"p");c.point(9,13,"c")
    c.point(6,11,"n");c.point(7,13,"b")


def closed_world():
    c=Canvas(16,16);world_body(c)
    c.polygon([(1,8),(4,5),(12,5),(15,8),(12,10),(1,10)],"o")
    c.polygon([(3,8),(5,6),(11,6),(13,8),(11,9),(2,9)],"n")
    c.line(5,7,11,7,"r");c.point(7,6,"s")
    c.line(5,6,4,9,"p");c.point(4,8,"h")
    c.line(10,6,10,9,"p");c.point(10,8,"c")
    return c


def opened_world():
    c=Canvas(16,16)
    # The raised lid and recessed mouth indicate opening only. No visible inventory or lock.
    c.polygon([(2,1),(13,1),(14,8),(2,8)],"o")
    c.rect(3,2,9,5,"r");c.line(3,2,11,2,"n")
    c.line(3,4,11,4,"b");c.line(3,6,11,6,"n")
    c.line(5,2,5,6,"c");c.line(10,2,10,6,"c")
    c.point(7,3,"n");c.point(8,5,"b")
    world_body(c)
    c.line(2,8,12,8,"n")
    c.rect(2,9,10,1,"k")
    c.line(2,10,11,10,"b")
    c.point(2,9,"r");c.point(11,9,"r")
    return c


def item_icon():
    c=Canvas(32,32)
    # Separately authored larger object geometry, not an upscaled world frame.
    c.polygon([(3,12),(8,7),(24,7),(29,12),(29,25),(24,29),(3,29)],"o")
    c.rect(4,16,19,12,"r")
    c.line(4,17,22,17,"n");c.line(4,21,22,21,"b");c.line(4,25,22,25,"b")
    c.line(5,18,7,18,"s");c.line(12,19,16,19,"n");c.line(15,23,19,23,"b")
    c.line(5,26,7,26,"n");c.line(12,27,20,27,"n")
    c.polygon([(23,16),(28,12),(28,25),(23,28)],"b")
    c.line(25,17,25,25,"r");c.line(27,15,27,23,"r")
    c.point(25,26,"n")
    c.rect(8,17,2,11,"c");c.line(8,18,8,26,"p")
    c.rect(19,17,2,11,"c");c.line(19,18,19,26,"p")
    # Plain flat lid planks and textile straps; no padlock, crest or metal rarity trim.
    c.polygon([(3,12),(8,7),(24,7),(29,12),(23,17),(3,17)],"o")
    c.polygon([(5,12),(9,8),(23,8),(27,12),(22,15),(5,15)],"n")
    c.line(9,10,23,10,"r");c.line(7,13,23,13,"r")
    c.line(12,9,17,9,"s");c.point(20,11,"b")
    c.polygon([(10,8),(12,8),(9,15),(7,15)],"p")
    c.polygon([(21,8),(23,8),(20,15),(18,15)],"p")
    c.point(9,11,"h");c.point(20,11,"h")
    c.line(6,27,6,27,"s")
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



def small_item(icon):
    out=Canvas(16,16)
    for y in range(16):
        for x in range(16):out.point(x,y,icon.pixels[2*y+1][2*x+1])
    return out


def contact(closed,opened,item):
    out=Canvas(832,432,"#151e20")
    for index,(label,icon) in enumerate([("CLOSED",closed),("OPEN",opened),("ITEM",item)]):
        left=index*256;out.rect(left+8,8,240 if index<2 else 304,416,"#22302e")
        text(out,left+76,18,label,2)
        out.blit(icon,left+64,52,8 if index<2 else 4)
        if index<2:
            for ox,bg in [(left+32,"#11191f"),(left+144,"#b8b39f")]:
                out.rect(ox,220,64,64,bg);out.blit(icon,ox+24,244)
            text(out,left+72,310,"NATIVE")
        else:
            out.rect(left+32,220,64,64,"#11191f");out.blit(item,left+48,236)
            out.rect(left+144,220,64,64,"#b8b39f");out.blit(small_item(item),left+168,244)
            text(out,left+28,310,"NATIVE")
            # UI3x2 rectangle:112x74px;64px icon centered, no fake game state or contents.
            out.rect(left+96,336,112,74,"#2a2720")
            out.blit(item,left+120,341,2);text(out,left+48,366,"UI")
    return out


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args()
    closed,opened,item=closed_world(),opened_world(),item_icon()
    icons={"original_storage_chest0":("ashveil-storage-chest-closed",closed),"original_storage_chest2":("ashveil-storage-chest-open",opened),"original_storage_chest_item":("ashveil-storage-chest-item",item)}
    products={};fragment={"sheets":{},"frames":{}};bounds={}
    for key,(stem,icon) in icons.items():
        occupied=[(x,y) for y,row in enumerate(icon.pixels) for x,p in enumerate(row) if p!="."]
        bounds[key]=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        assert occupied and all(0<x<icon.width-1 and 0<y<icon.height for x,y in occupied)
        products[f"public/sprites/original/{stem}.png"]=png(icon)
        products[f"public/sprites/original/{stem}.svg"]=svg(icon,key)
        fragment["sheets"][key]=f"sprites/original/{stem}.png"
        fragment["frames"][key]=[key,0,0,icon.width,icon.height]
    assert bounds["original_storage_chest0"][3]==bounds["original_storage_chest2"][3]==15
    assert closed.pixels[11:]==opened.pixels[11:]
    products["public/sprites/original/ashveil-storage-chest-item-16.png"]=png(small_item(item))
    products["public/sprites/original/ashveil-storage-chest-contact.png"]=png(contact(closed,opened,item))
    products["public/sprites/original/ashveil-storage-chest-palette.json"]=(json.dumps(PALETTE,indent=2)+"\n").encode()
    products["tools/art/storage-chest-manifest.fragment.json"]=(json.dumps(fragment,indent=2)+"\n").encode()
    products["tools/art/storage-chest-usage-survey.json"]=(json.dumps(USAGE_SURVEY,indent=2,ensure_ascii=False)+"\n").encode()
    source={"created":"2026-10-21","method":"original authored integer-coordinate wood planks and textile bindings","source":"tools/art/draw-storage-chest.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"externalImageInputs":[],"modifiedExistingImages":False,"worldNative":[16,16],"worldAnchor":[.5,1],"worldAnchorPixel":[8,16],"worldScale":1,"worldGroundLastOpaqueRow":15,"worldGroundBoundary":16,"itemNative":[32,32],"actualItemGrid":[3,2],"inventoryDisplayPixels":64,"inventoryGridRectangle":[112,74],"opaqueBounds":bounds,"paletteColors":len(PALETTE),"alphaValues":[0,255],"stateMeaning":"closed/open lid only; opened follows searched, not a lock or empty/loot judgement","notEncoded":["fire","contents","loot","lock state","ownership","quantity","quality","durability"],"integrationApplied":False,"scope":"Terrain.Stash and Item.StorageChest only; do not globally replace chest0/chest2/chest or objects sheet","files":[{"file":name,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for name,data in products.items()]}
    products["public/sprites/original/ashveil-storage-chest-source.json"]=(json.dumps(source,indent=2,ensure_ascii=False)+"\n").encode()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"regeneration differs: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic files; two native16 world states and separate native32 item icon")


if __name__=="__main__":main()
