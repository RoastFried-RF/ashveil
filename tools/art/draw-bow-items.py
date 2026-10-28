#!/usr/bin/env python3
"""Draw two original ASHVEIL bow equipment icons from newly authored pixel coordinates.
CC0-1.0: commercial use and derivative asset packages permitted.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-bow-items.py [--check]
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
  "scope": "Read-only Core raw JSON inheritance plus every top-level sprite field patch; abstract/id fields excluded from inherited parents as in defs.ts. No actual Def DB, mod package, world or project execution. Other fields are context, not a complete patch engine.",
  "items": [
    {
      "id": "Item.Bow",
      "source": "src/content/core/defs/items-weapons.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.Bow",
        "parent": "Item.Weapon",
        "label": "사냥 활",
        "description": "화살은 귀하다. 젖으면 시위가 늘어진다. 양손 무기.",
        "sprite": "bow",
        "weight": 1.0,
        "value": 40,
        "twoHanded": true,
        "ranged": {
          "range": 14,
          "effective": 6,
          "ammo": "Item.Arrow"
        },
        "size": [
          2,
          3
        ],
        "attacks": [
          {
            "id": "stab",
            "label": "사격",
            "damageType": "stab",
            "damage": 10,
            "pen": 20,
            "accuracy": 10,
            "energy": 6,
            "family": "archery",
            "noise": 3,
            "bleedMult": 1.0
          }
        ],
        "salvage": {
          "material": "Item.Wood",
          "count": 3,
          "turns": 100,
          "attr": "agi",
          "tools": [
            "blade"
          ]
        },
        "repair": {
          "material": "Item.Wood",
          "unitsPer10": 0.25,
          "turns": 200,
          "attr": "agi",
          "tools": [
            "blade"
          ]
        }
      },
      "resolvedContext": {
        "defType": "Item",
        "label": "사냥 활",
        "sprite": "bow",
        "category": "weapon",
        "weight": 1.0,
        "value": 40,
        "size": [
          2,
          3
        ],
        "slot": "main",
        "id": "Item.Bow",
        "parent": "Item.Weapon",
        "description": "화살은 귀하다. 젖으면 시위가 늘어진다. 양손 무기.",
        "twoHanded": true,
        "ranged": {
          "range": 14,
          "effective": 6,
          "ammo": "Item.Arrow"
        },
        "attacks": [
          {
            "id": "stab",
            "label": "사격",
            "damageType": "stab",
            "damage": 10,
            "pen": 20,
            "accuracy": 10,
            "energy": 6,
            "family": "archery",
            "noise": 3,
            "bleedMult": 1.0
          }
        ],
        "salvage": {
          "material": "Item.Wood",
          "count": 3,
          "turns": 100,
          "attr": "agi",
          "tools": [
            "blade"
          ]
        },
        "repair": {
          "material": "Item.Wood",
          "unitsPer10": 0.25,
          "turns": 200,
          "attr": "agi",
          "tools": [
            "blade"
          ]
        }
      },
      "inheritance": [
        "Item.Bow",
        "Item.Weapon"
      ],
      "directChildren": [],
      "allFurtherDescendants": []
    },
    {
      "id": "Item.BowString",
      "source": "src/content/core/defs/gear-care.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.BowString",
        "label": "여분 활시위",
        "sprite": "bones",
        "category": "tool",
        "weight": 0.02,
        "value": 3,
        "size": [
          1,
          1
        ],
        "stackable": true,
        "maxStack": 5
      },
      "resolvedContext": {
        "defType": "Item",
        "id": "Item.BowString",
        "label": "여분 활시위",
        "sprite": "bones",
        "category": "tool",
        "weight": 0.02,
        "value": 3,
        "size": [
          1,
          1
        ],
        "stackable": true,
        "maxStack": 5
      },
      "inheritance": [
        "Item.BowString"
      ],
      "directChildren": [],
      "allFurtherDescendants": []
    },
    {
      "id": "Item.Arrow",
      "source": "src/content/core/defs/items-weapons.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.Arrow",
        "label": "화살",
        "sprite": "arrow",
        "category": "ammo",
        "weight": 0.05,
        "stackable": true,
        "value": 3,
        "size": [
          1,
          2
        ],
        "maxStack": 20
      },
      "resolvedContext": {
        "defType": "Item",
        "id": "Item.Arrow",
        "label": "화살",
        "sprite": "ashveil_arrow_bundle",
        "category": "ammo",
        "weight": 0.05,
        "stackable": true,
        "value": 3,
        "size": [
          1,
          2
        ],
        "maxStack": 20
      },
      "inheritance": [
        "Item.Arrow"
      ],
      "directChildren": [
        "Item.Bolt"
      ],
      "allFurtherDescendants": [
        "Item.Bolt"
      ]
    },
    {
      "id": "Item.Bolt",
      "source": "src/content/core/defs/background-items.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.Bolt",
        "parent": "Item.Arrow",
        "label": "석궁 볼트",
        "description": "짧고 무거운 석궁용 화살.",
        "value": 4
      },
      "resolvedContext": {
        "defType": "Item",
        "label": "석궁 볼트",
        "sprite": "ashveil_arrow_bundle",
        "category": "ammo",
        "weight": 0.05,
        "stackable": true,
        "value": 4,
        "size": [
          1,
          2
        ],
        "maxStack": 20,
        "id": "Item.Bolt",
        "parent": "Item.Arrow",
        "description": "짧고 무거운 석궁용 화살."
      },
      "inheritance": [
        "Item.Bolt",
        "Item.Arrow"
      ],
      "directChildren": [],
      "allFurtherDescendants": []
    },
    {
      "id": "Item.LightCrossbow",
      "source": "src/content/core/defs/background-items.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.LightCrossbow",
        "parent": "Item.Weapon",
        "label": "경석궁",
        "description": "손으로 시위를 당기는 작은 석궁. 한 발 쏜 뒤 기본4턴 동안 다시 장전한다.",
        "sprite": "bow",
        "size": [
          2,
          3
        ],
        "twoHanded": true,
        "value": 45,
        "material": "Material.Wood",
        "ranged": {
          "range": 16,
          "effective": 8,
          "ammo": "Item.Bolt",
          "reloadTurns": 4
        },
        "attacks": [
          {
            "id": "bolt",
            "label": "석궁 쏘기",
            "damageType": "stab",
            "damage": 14,
            "pen": 35,
            "accuracy": 10,
            "energy": 6,
            "family": "crossbow",
            "noise": 8
          }
        ],
        "weapon": {
          "block": 0,
          "parry": 0
        },
        "repair": {
          "material": "Item.Wood",
          "unitsPer10": 0.25,
          "turns": 200,
          "attr": "agi",
          "tools": [
            "blade"
          ]
        }
      },
      "resolvedContext": {
        "defType": "Item",
        "label": "경석궁",
        "sprite": "bow",
        "category": "weapon",
        "weight": 1,
        "value": 45,
        "size": [
          2,
          3
        ],
        "slot": "main",
        "id": "Item.LightCrossbow",
        "parent": "Item.Weapon",
        "description": "손으로 시위를 당기는 작은 석궁. 한 발 쏜 뒤 기본4턴 동안 다시 장전한다.",
        "twoHanded": true,
        "material": "Material.Wood",
        "ranged": {
          "range": 16,
          "effective": 8,
          "ammo": "Item.Bolt",
          "reloadTurns": 4
        },
        "attacks": [
          {
            "id": "bolt",
            "label": "석궁 쏘기",
            "damageType": "stab",
            "damage": 14,
            "pen": 35,
            "accuracy": 10,
            "energy": 6,
            "family": "crossbow",
            "noise": 8
          }
        ],
        "weapon": {
          "block": 0,
          "parry": 0
        },
        "repair": {
          "material": "Item.Wood",
          "unitsPer10": 0.25,
          "turns": 200,
          "attr": "agi",
          "tools": [
            "blade"
          ]
        }
      },
      "inheritance": [
        "Item.LightCrossbow",
        "Item.Weapon"
      ],
      "directChildren": [],
      "allFurtherDescendants": []
    },
    {
      "id": "Item.Quiver",
      "source": "src/content/core/defs/quiver.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.Quiver",
        "label": "가죽 화살통",
        "description": "화살 전용 1×6칸 화살통. 등에 착용하면 실제 화살을 바로 꺼내 쏜다. 망토와 같은 슬롯을 사용하며 비어 있는 상태로 만든다.",
        "sprite": "arrow",
        "category": "apparel",
        "weight": 0.5,
        "size": [
          2,
          2
        ],
        "stackable": false,
        "maxStack": 1,
        "value": 14,
        "slot": "back",
        "material": "Material.Leather",
        "quiver": {
          "size": [
            1,
            6
          ],
          "ammo": [
            "Item.Arrow"
          ]
        },
        "apparel": {
          "layer": 2,
          "groups": [],
          "insulation": 0,
          "armor": {},
          "durability": 40
        },
        "equipTurns": [
          1,
          1
        ]
      },
      "resolvedContext": {
        "defType": "Item",
        "id": "Item.Quiver",
        "label": "가죽 화살통",
        "description": "화살 전용 1×6칸 화살통. 등에 착용하면 실제 화살을 바로 꺼내 쏜다. 망토와 같은 슬롯을 사용하며 비어 있는 상태로 만든다.",
        "sprite": "ashveil_quiver",
        "category": "apparel",
        "weight": 0.5,
        "size": [
          2,
          2
        ],
        "stackable": false,
        "maxStack": 1,
        "value": 14,
        "slot": "back",
        "material": "Material.Leather",
        "quiver": {
          "size": [
            1,
            6
          ],
          "ammo": [
            "Item.Arrow"
          ]
        },
        "apparel": {
          "layer": 2,
          "groups": [],
          "insulation": 0,
          "armor": {},
          "durability": 40
        },
        "equipTurns": [
          1,
          1
        ]
      },
      "inheritance": [
        "Item.Quiver"
      ],
      "directChildren": [],
      "allFurtherDescendants": []
    }
  ],
  "newTargets": [
    "Item.Bow",
    "Item.BowString"
  ],
  "proposedSpriteByTarget": {
    "Item.Bow": "original_hunting_bow",
    "Item.BowString": "original_bow_string"
  },
  "existingSharedSpriteConsumers": {
    "bow": [
      {
        "id": "Item.Bow",
        "source": "src/content/core/defs/items-weapons.json",
        "ownRawSprite": "bow",
        "hasOwnRawSprite": true,
        "resolvedSprite": "bow",
        "inheritance": [
          "Item.Bow",
          "Item.Weapon"
        ]
      },
      {
        "id": "Item.LightCrossbow",
        "source": "src/content/core/defs/background-items.json",
        "ownRawSprite": "bow",
        "hasOwnRawSprite": true,
        "resolvedSprite": "bow",
        "inheritance": [
          "Item.LightCrossbow",
          "Item.Weapon"
        ]
      }
    ],
    "bones": [
      {
        "id": "Item.BoneCharm",
        "source": "src/content/core/defs/items-apparel.json",
        "ownRawSprite": "bones",
        "hasOwnRawSprite": true,
        "resolvedSprite": "bones",
        "inheritance": [
          "Item.BoneCharm"
        ]
      },
      {
        "id": "Item.Bones",
        "source": "src/content/core/defs/items-consumables.json",
        "ownRawSprite": "bones",
        "hasOwnRawSprite": true,
        "resolvedSprite": "bones",
        "inheritance": [
          "Item.Bones"
        ]
      },
      {
        "id": "Item.BowString",
        "source": "src/content/core/defs/gear-care.json",
        "ownRawSprite": "bones",
        "hasOwnRawSprite": true,
        "resolvedSprite": "bones",
        "inheritance": [
          "Item.BowString"
        ]
      },
      {
        "id": "Item.Charcoal",
        "source": "src/content/core/defs/crafting.json",
        "ownRawSprite": "bones",
        "hasOwnRawSprite": true,
        "resolvedSprite": "bones",
        "inheritance": [
          "Item.Charcoal"
        ]
      },
      {
        "id": "Item.GardenerLimb",
        "source": "src/content/core/defs/prosthetics.json",
        "ownRawSprite": "bones",
        "hasOwnRawSprite": true,
        "resolvedSprite": "bones",
        "inheritance": [
          "Item.GardenerLimb"
        ]
      },
      {
        "id": "Item.Lute",
        "source": "src/content/core/defs/background-items.json",
        "ownRawSprite": "bones",
        "hasOwnRawSprite": true,
        "resolvedSprite": "bones",
        "inheritance": [
          "Item.Lute"
        ]
      }
    ],
    "arrow": [
      {
        "id": "Item.Needle",
        "source": "src/content/core/defs/crafting.json",
        "ownRawSprite": "arrow",
        "hasOwnRawSprite": true,
        "resolvedSprite": "arrow",
        "inheritance": [
          "Item.Needle"
        ]
      }
    ],
    "ashveil_arrow_bundle": [
      {
        "id": "Item.Arrow",
        "source": "src/content/core/defs/items-weapons.json",
        "ownRawSprite": "arrow",
        "hasOwnRawSprite": true,
        "resolvedSprite": "ashveil_arrow_bundle",
        "inheritance": [
          "Item.Arrow"
        ]
      },
      {
        "id": "Item.Bolt",
        "source": "src/content/core/defs/background-items.json",
        "ownRawSprite": null,
        "hasOwnRawSprite": false,
        "resolvedSprite": "ashveil_arrow_bundle",
        "inheritance": [
          "Item.Bolt",
          "Item.Arrow"
        ]
      }
    ],
    "ashveil_quiver": [
      {
        "id": "Item.Quiver",
        "source": "src/content/core/defs/quiver.json",
        "ownRawSprite": "arrow",
        "hasOwnRawSprite": true,
        "resolvedSprite": "ashveil_quiver",
        "inheritance": [
          "Item.Quiver"
        ]
      }
    ]
  },
  "spriteFieldPatchesObserved": [
    {
      "source": "src/content/core/patches/basic-weapons-original.json",
      "patch": {
        "op": "replace",
        "target": "Item.RustyKnife",
        "path": "/sprite",
        "value": "original_rusty_knife"
      }
    },
    {
      "source": "src/content/core/patches/basic-weapons-original.json",
      "patch": {
        "op": "replace",
        "target": "Item.Hatchet",
        "path": "/sprite",
        "value": "original_hatchet"
      }
    },
    {
      "source": "src/content/core/patches/basic-weapons-original.json",
      "patch": {
        "op": "replace",
        "target": "Item.RebarSpear",
        "path": "/sprite",
        "value": "original_rebar_spear"
      }
    },
    {
      "source": "src/content/core/patches/basic-weapons-original.json",
      "patch": {
        "op": "add",
        "target": "Item.AlloyHatchet",
        "path": "/sprite",
        "value": "hatchet"
      }
    },
    {
      "source": "src/content/core/patches/basic-weapons-original.json",
      "patch": {
        "op": "add",
        "target": "Item.CustomHatchet",
        "path": "/sprite",
        "value": "hatchet"
      }
    },
    {
      "source": "src/content/core/patches/basic-weapons-original.json",
      "patch": {
        "op": "add",
        "target": "Item.FlintHatchet",
        "path": "/sprite",
        "value": "hatchet"
      }
    },
    {
      "source": "src/content/core/patches/basic-weapons-original.json",
      "patch": {
        "op": "add",
        "target": "Item.SteelHatchet",
        "path": "/sprite",
        "value": "hatchet"
      }
    },
    {
      "source": "src/content/core/patches/crop-icons-original.json",
      "patch": {
        "op": "replace",
        "target": "Item.ShadeSeeds",
        "path": "/sprite",
        "value": "original_shade_seeds"
      }
    },
    {
      "source": "src/content/core/patches/crop-icons-original.json",
      "patch": {
        "op": "add",
        "target": "Item.ShadeRoot",
        "path": "/sprite",
        "value": "original_shade_root"
      }
    },
    {
      "source": "src/content/core/patches/crop-icons-original.json",
      "patch": {
        "op": "replace",
        "target": "Item.Whitecap",
        "path": "/sprite",
        "value": "original_whitecap"
      }
    },
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
  "recipes": [
    {
      "defType": "Recipe",
      "id": "Recipe.Bow",
      "label": "사냥 활 만들기",
      "category": "woodwork",
      "primaryAttr": "agi",
      "basic": false,
      "workTurns": 600,
      "inputs": [
        {
          "item": "Item.Wood",
          "count": 3
        },
        {
          "item": "Item.Thread",
          "count": 3
        }
      ],
      "output": {
        "item": "Item.Bow",
        "count": 1
      },
      "tools": [
        "blade"
      ],
      "stations": [
        "workbench"
      ],
      "noise": 4
    },
    {
      "defType": "Recipe",
      "id": "Recipe.BowString",
      "label": "여분 활시위 꼬기",
      "category": "textile",
      "primaryAttr": "agi",
      "basic": true,
      "workTurns": 120,
      "inputs": [
        {
          "item": "Item.Thread",
          "count": 2
        }
      ],
      "output": {
        "item": "Item.BowString",
        "count": 1
      }
    },
    {
      "defType": "Recipe",
      "id": "Recipe.Arrows",
      "label": "화살 다섯 발 만들기",
      "category": "woodwork",
      "primaryAttr": "agi",
      "basic": false,
      "workTurns": 150,
      "inputs": [
        {
          "item": "Item.Wood",
          "count": 1
        },
        {
          "item": "Item.IronScrap",
          "count": 1
        },
        {
          "item": "Item.Thread",
          "count": 1
        }
      ],
      "output": {
        "item": "Item.Arrow",
        "count": 5
      },
      "tools": [
        "blade"
      ],
      "stations": [
        "workbench"
      ],
      "noise": 4
    }
  ],
  "nonexistentSuggestedIDs": [
    "Item.Shortbow",
    "Item.ShortBow",
    "Item.Longbow",
    "Item.LongBow"
  ],
  "preserve": {
    "Item.Arrow": "ashveil_arrow_bundle",
    "Item.Bolt": "ashveil_arrow_bundle",
    "Item.Quiver": "ashveil_quiver",
    "Item.LightCrossbow": "bow"
  },
  "preserveExistingDedicatedArt": true,
  "integrationApplied": false,
  "sourceFiles": [
    {
      "path": "docs/design/07-combat.md",
      "sha256": "3d5d415223061d7cfe4b65004119708c4f48db5f61cd93a4c67a22a0b9226286"
    },
    {
      "path": "docs/design/08-items-and-crafting.md",
      "sha256": "82e5e907930da845d1c9584e7516d5829895e16c9dd753959c58c1b5a801c92f"
    },
    {
      "path": "src/client/sprites.json",
      "sha256": "edbb81f443c95420b1782f996d5377d812c5d0d9465b4d58a51b8a7ce8a2128c"
    },
    {
      "path": "src/content/core/defs/background-items.json",
      "sha256": "8e6c6daffc724bbf2c2c4bd0280ed438e16446ac9f4c98e0469e0bf951dbaeff"
    },
    {
      "path": "src/content/core/defs/crafting.json",
      "sha256": "d9b195e70adc37176790dac989bc302a3733c27006be8a94b51452816688bec1"
    },
    {
      "path": "src/content/core/defs/gear-care.json",
      "sha256": "747abc72342eebf9848a3d2dae9a89b3c0aed8de7d209e540c5203650093ff34"
    },
    {
      "path": "src/content/core/defs/items-weapons.json",
      "sha256": "ecefb821becdc6cfb82202441087651d4bcead5092eedb5c445cd7ca4da995d0"
    },
    {
      "path": "src/content/core/defs/quiver.json",
      "sha256": "42e3849c53d9fb3c11f4af0575d975a468768dffbfc1d3c4e2f47362ffff30a9"
    },
    {
      "path": "src/content/core/patches/original-storage-art.json",
      "sha256": "d08adaeb3e13fea1c05c24ded978f5f1b7dba221392f18d644846cf4a2f8228d"
    },
    {
      "path": "src/core/defs.ts",
      "sha256": "fafb8a9aa909949715780285c8f2fe62cf50422cdd2680865a633977fcf9acee"
    },
    {
      "path": "src/core/gear-care.ts",
      "sha256": "d81e5f5f18501b82c3413dc99fda77e9e7b7eadc9cccd763c2362e9689e843b1"
    }
  ]
}''')

def hunting_bow():
    c=Canvas()
    # Simple wood bow displayed without an arrow, sights or state-specific marks.
    # The taut-looking line identifies its type; it does not encode the actual bowUnstrung state.
    c.line(24,4,24,28,"o");c.line(23,4,23,28,"c")
    c.line(23,6,23,11,"p");c.line(23,20,23,26,"p")
    c.polygon([(23,2),(25,4),(20,8),(16,11),(13,15),(13,18),
               (16,22),(20,25),(24,28),(24,30),(20,29),(15,26),
               (10,22),(7,18),(7,14),(10,9),(15,5),(20,3)],"o")
    c.polygon([(22,3),(23,4),(18,8),(14,12),(11,16),(12,19),
               (15,23),(19,26),(22,28),(20,28),(16,25),(11,21),
               (9,17),(9,14),(12,10),(16,6),(20,4)],"r")
    c.line(20,4,16,7,"n");c.line(16,7,12,11,"n")
    c.line(12,11,10,15,"s");c.line(10,16,12,20,"n")
    c.line(12,20,16,24,"s");c.line(16,24,21,28,"n")
    c.point(18,6,"f");c.point(13,10,"f");c.point(18,26,"f")
    # A small dark wrapped grip; no arrow rest hardware, metal reinforcement or branding.
    c.polygon([(8,13),(11,12),(13,16),(14,19),(11,21),(8,18)],"o")
    c.polygon([(9,14),(11,14),(12,17),(12,19),(10,19),(9,17)],"b")
    c.line(9,14,11,15,"c");c.line(10,17,12,18,"r")
    c.point(10,16,"n");c.point(11,19,"c")
    # Tiny end notches and string attachment, not a damage-state crack.
    c.point(23,4,"p");c.point(22,28,"p")
    return c


def bow_string():
    c=Canvas()
    # One long fiber cord laid in a loop, with free end loops; winding is not a stack count.
    c.polygon([(11,4),(17,3),(23,6),(26,11),(26,18),(23,24),
               (18,28),(12,28),(7,25),(4,20),(4,13),(7,7)],"o")
    c.polygon([(11,5),(17,4),(22,7),(25,12),(25,18),(22,23),
               (18,27),(12,27),(8,24),(5,20),(5,13),(8,8)],"c")
    c.polygon([(12,7),(17,6),(21,9),(23,13),(23,18),(20,22),
               (17,24),(13,24),(10,22),(8,18),(8,13),(10,9)],"o")
    c.polygon([(12,8),(17,7),(20,10),(22,13),(22,18),(19,21),
               (17,23),(13,23),(11,21),(9,18),(9,13),(11,10)],".")
    # Warm linen fibers on the lower edge; cool old-linen shadows on the inner edge.
    for a,b in [((9,7),(12,5)),((13,5),(17,5)),((19,6),(22,8)),
                ((23,10),(24,13)),((24,16),(23,20)),((21,23),(18,26)),
                ((15,26),(12,26)),((10,25),(7,22)),((6,19),(6,15)),((6,12),(8,9))]:
        c.line(*a,*b,"p")
    for x,y in [(12,5),(19,6),(24,13),(22,22),(15,26),(6,18),(7,10)]:c.point(x,y,"h")
    for x,y in [(10,7),(20,9),(23,16),(18,24),(11,23),(7,16)]:c.point(x,y,"n")
    # A flat winding of the same cord across the folded loop keeps it legible at 16px.
    c.polygon([(5,14),(24,13),(26,15),(25,18),(7,20),(4,18)],"o")
    c.polygon([(6,15),(23,14),(24,16),(23,17),(7,19),(5,17)],"c")
    c.line(7,16,22,15,"p");c.line(7,18,22,16,"p")
    c.line(10,15,9,18,"r");c.line(12,15,11,18,"n")
    c.point(8,16,"h");c.point(21,15,"h")
    # A short loose closed end loop and tail from the lower left; no needles or tools.
    c.line(7,21,3,25,"o");c.line(3,25,5,29,"o");c.line(5,29,9,27,"o")
    c.line(9,27,8,24,"o");c.line(8,24,5,25,"c")
    c.line(4,25,5,28,"p");c.line(5,28,8,27,"p")
    c.point(7,22,"p");c.point(8,23,"c")
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
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
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
    c=Canvas(384,376,"#11191f")
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


LABELS={"hunting_bow":"BOW","bow_string":"STRING"}
ITEMS={"hunting_bow":"Item.Bow","bow_string":"Item.BowString"}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args()
    icons={"hunting_bow":hunting_bow(),"bow_string":bow_string()}
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
    products["public/sprites/original/items/ashveil-bow-contact.png"]=png(contact(icons))
    products["public/sprites/original/items/ashveil-bow-palette.json"]=(json.dumps(PALETTE,indent=2)+"\n").encode()
    products["tools/art/bow-manifest.fragment.json"]=(json.dumps(fragment,indent=2)+"\n").encode()
    products["tools/art/bow-usage-survey.json"]=(json.dumps(USAGE_SURVEY,indent=2,ensure_ascii=False)+"\n").encode()
    records=[{"file":name,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for name,data in products.items()]
    source={"created":"2026-10-21","license":"CC0-1.0","commercialUseAllowed":True,"derivativePackagesAllowed":True,"method":"newly authored integer-coordinate pixel geometry","source":"tools/art/draw-bow-items.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"externalImageInputs":[],"modifiedExistingImages":False,"itemCount":2,"nativePixels":[32,32],"previewPixels":[16,16],"alphaValues":[0,255],"paletteColors":len(PALETTE),"opaqueBounds":bounds,"integrationApplied":False,"itemToProposedSprite":{value:"original_"+key for key,value in ITEMS.items()},"proposalScope":"exactly Item.Bow and Item.BowString; existing original arrows/quiver, crossbow, bolts and all other shared consumers preserved","notEncoded":["quality","durability","moisture","unstrung or broken state","quantity","poison","enchantment","range","combat statistics","ownership"],"visualInterpretation":"A plain curved wood hunting bow with its cord and a spare thread-like fiber bow string loop with loose end. Static type illustrations, not state-specific images.","files":records}
    products["public/sprites/original/items/ashveil-bow-source.json"]=(json.dumps(source,indent=2,ensure_ascii=False)+"\n").encode()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"regeneration differs: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic files; two original bow equipment icons")


if __name__=="__main__":main()
