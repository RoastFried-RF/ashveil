#!/usr/bin/env python3
"""Draw three original ASHVEIL basic weapon inventory icons from authored pixel coordinates.

No image input, downloaded asset, tracing, image transform or raster dependency.
Run: python3 tools/art/draw-basic-weapons.py [--check]
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
  "scope": "Read-only core raw inheritance and top-level sprite-field patches; no actual DB/world execution.",
  "items": [
    {
      "id": "Item.RustyKnife",
      "source": "src/content/core/defs/items-weapons.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.RustyKnife",
        "parent": "Item.Weapon",
        "label": "녹슨 칼",
        "description": "날이 무뎌 베기보다 찢는다. 상처가 더럽다.",
        "sprite": "rusty_knife",
        "weight": 0.3,
        "value": 4,
        "size": [
          1,
          2
        ],
        "attacks": [
          {
            "id": "slash",
            "label": "베기",
            "damageType": "cut",
            "damage": 6,
            "pen": 8,
            "accuracy": 10,
            "energy": 4,
            "family": "blade",
            "noise": 6,
            "bleedMult": 1.2,
            "shortBlade": true
          },
          {
            "id": "stab",
            "label": "찌르기",
            "damageType": "stab",
            "damage": 7,
            "pen": 8,
            "accuracy": 10,
            "energy": 4,
            "family": "blade",
            "noise": 6,
            "bleedMult": 1.2,
            "shortBlade": true
          }
        ],
        "weapon": {
          "block": 5,
          "parry": 0
        },
        "edgeStart": 60,
        "toolTags": [
          "blade"
        ],
        "salvage": {
          "material": "Item.IronScrap",
          "count": 6,
          "turns": 100,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "repair": {
          "material": "Item.IronScrap",
          "unitsPer10": 0.25,
          "turns": 200,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "material": "Material.Scrap"
      },
      "resolvedDefinition": {
        "defType": "Item",
        "id": "Item.RustyKnife",
        "abstract": true,
        "label": "녹슨 칼",
        "sprite": "rusty_knife",
        "category": "weapon",
        "weight": 0.3,
        "value": 4,
        "size": [
          1,
          2
        ],
        "slot": "main",
        "parent": "Item.Weapon",
        "description": "날이 무뎌 베기보다 찢는다. 상처가 더럽다.",
        "attacks": [
          {
            "id": "slash",
            "label": "베기",
            "damageType": "cut",
            "damage": 6,
            "pen": 8,
            "accuracy": 10,
            "energy": 4,
            "family": "blade",
            "noise": 6,
            "bleedMult": 1.2,
            "shortBlade": true
          },
          {
            "id": "stab",
            "label": "찌르기",
            "damageType": "stab",
            "damage": 7,
            "pen": 8,
            "accuracy": 10,
            "energy": 4,
            "family": "blade",
            "noise": 6,
            "bleedMult": 1.2,
            "shortBlade": true
          }
        ],
        "weapon": {
          "block": 5,
          "parry": 0
        },
        "edgeStart": 60,
        "toolTags": [
          "blade"
        ],
        "salvage": {
          "material": "Item.IronScrap",
          "count": 6,
          "turns": 100,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "repair": {
          "material": "Item.IronScrap",
          "unitsPer10": 0.25,
          "turns": 200,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "material": "Material.Scrap"
      }
    },
    {
      "id": "Item.Hatchet",
      "source": "src/content/core/defs/items-weapons.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.Hatchet",
        "parent": "Item.Weapon",
        "label": "손도끼",
        "description": "갑옷째 쪼갠다. 뼈를 부수기도 한다.",
        "sprite": "hatchet",
        "weight": 1.1,
        "value": 26,
        "size": [
          2,
          2
        ],
        "attacks": [
          {
            "id": "slash",
            "label": "찍기",
            "damageType": "cut",
            "damage": 14,
            "pen": 15,
            "accuracy": 4,
            "energy": 8,
            "family": "axe",
            "noise": 6,
            "bleedMult": 1.1,
            "shieldDamage": 2
          }
        ],
        "weapon": {
          "block": 5,
          "parry": -5
        },
        "toolTags": [
          "blade"
        ],
        "salvage": {
          "material": "Item.IronScrap",
          "count": 4,
          "turns": 100,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "repair": {
          "material": "Item.IronScrap",
          "unitsPer10": 0.25,
          "turns": 200,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "stuffSlots": [
          {
            "id": "head",
            "ref": "Material.Scrap",
            "volumeCm3": 70,
            "accepts": [
              "Metal",
              "Stone"
            ],
            "primary": true
          },
          {
            "id": "haft",
            "ref": "Material.Wood",
            "volumeCm3": 350,
            "accepts": [
              "Wood",
              "Bone"
            ]
          }
        ],
        "durabilityBase": 80,
        "massFixedG": 350,
        "material": "Material.Scrap"
      },
      "resolvedDefinition": {
        "defType": "Item",
        "id": "Item.Hatchet",
        "abstract": true,
        "label": "손도끼",
        "sprite": "hatchet",
        "category": "weapon",
        "weight": 1.1,
        "value": 26,
        "size": [
          2,
          2
        ],
        "slot": "main",
        "parent": "Item.Weapon",
        "description": "갑옷째 쪼갠다. 뼈를 부수기도 한다.",
        "attacks": [
          {
            "id": "slash",
            "label": "찍기",
            "damageType": "cut",
            "damage": 14,
            "pen": 15,
            "accuracy": 4,
            "energy": 8,
            "family": "axe",
            "noise": 6,
            "bleedMult": 1.1,
            "shieldDamage": 2
          }
        ],
        "weapon": {
          "block": 5,
          "parry": -5
        },
        "toolTags": [
          "blade"
        ],
        "salvage": {
          "material": "Item.IronScrap",
          "count": 4,
          "turns": 100,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "repair": {
          "material": "Item.IronScrap",
          "unitsPer10": 0.25,
          "turns": 200,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "stuffSlots": [
          {
            "id": "head",
            "ref": "Material.Scrap",
            "volumeCm3": 70,
            "accepts": [
              "Metal",
              "Stone"
            ],
            "primary": true
          },
          {
            "id": "haft",
            "ref": "Material.Wood",
            "volumeCm3": 350,
            "accepts": [
              "Wood",
              "Bone"
            ]
          }
        ],
        "durabilityBase": 80,
        "massFixedG": 350,
        "material": "Material.Scrap"
      }
    },
    {
      "id": "Item.RebarSpear",
      "source": "src/content/core/defs/items-weapons.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.RebarSpear",
        "parent": "Item.Weapon",
        "label": "철근 창",
        "description": "두 칸 떨어진 적을 찌른다. 양손 무기.",
        "sprite": "rebar_spear",
        "weight": 2.2,
        "value": 22,
        "twoHanded": true,
        "size": [
          1,
          4
        ],
        "attacks": [
          {
            "id": "stab",
            "label": "찌르기",
            "damageType": "stab",
            "damage": 12,
            "pen": 18,
            "accuracy": 6,
            "energy": 7,
            "family": "spear",
            "noise": 6,
            "bleedMult": 0.9,
            "reach": 2
          }
        ],
        "weapon": {
          "block": 8,
          "parry": 5
        },
        "salvage": {
          "material": "Item.IronScrap",
          "count": 4,
          "turns": 100,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "repair": {
          "material": "Item.IronScrap",
          "unitsPer10": 0.25,
          "turns": 200,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "material": "Material.Scrap"
      },
      "resolvedDefinition": {
        "defType": "Item",
        "id": "Item.RebarSpear",
        "abstract": true,
        "label": "철근 창",
        "sprite": "rebar_spear",
        "category": "weapon",
        "weight": 2.2,
        "value": 22,
        "size": [
          1,
          4
        ],
        "slot": "main",
        "parent": "Item.Weapon",
        "description": "두 칸 떨어진 적을 찌른다. 양손 무기.",
        "twoHanded": true,
        "attacks": [
          {
            "id": "stab",
            "label": "찌르기",
            "damageType": "stab",
            "damage": 12,
            "pen": 18,
            "accuracy": 6,
            "energy": 7,
            "family": "spear",
            "noise": 6,
            "bleedMult": 0.9,
            "reach": 2
          }
        ],
        "weapon": {
          "block": 8,
          "parry": 5
        },
        "salvage": {
          "material": "Item.IronScrap",
          "count": 4,
          "turns": 100,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "repair": {
          "material": "Item.IronScrap",
          "unitsPer10": 0.25,
          "turns": 200,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "material": "Material.Scrap"
      }
    }
  ],
  "hatchetVariantDescendants": [
    {
      "id": "Item.AlloyHatchet",
      "source": "src/content/core/defs/materials.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.AlloyHatchet",
        "parent": "Item.Hatchet",
        "label": "폐합금 손도끼",
        "stuffDefaults": {
          "head": "Material.Alloy"
        },
        "repair": {
          "material": "Item.AlloyScrap",
          "unitsPer10": 0.2,
          "turns": 200,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "salvage": {
          "material": "Item.AlloyScrap",
          "count": 4,
          "turns": 100,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        }
      },
      "hasOwnRawSprite": false,
      "ownRawSprite": null,
      "existingResolvedSprite": "hatchet",
      "chain": [
        "Item.AlloyHatchet",
        "Item.Hatchet",
        "Item.Weapon"
      ],
      "directChildren": [],
      "allFurtherDescendants": [],
      "preservationProposal": "Root keeps this existing sprite explicitly when changing the basic Hatchet parent."
    },
    {
      "id": "Item.CustomHatchet",
      "source": "src/content/core/defs/material-crafting.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.CustomHatchet",
        "parent": "Item.Hatchet",
        "label": "재질을 고른 손도끼",
        "massFixedG": 0
      },
      "hasOwnRawSprite": false,
      "ownRawSprite": null,
      "existingResolvedSprite": "hatchet",
      "chain": [
        "Item.CustomHatchet",
        "Item.Hatchet",
        "Item.Weapon"
      ],
      "directChildren": [],
      "allFurtherDescendants": [],
      "preservationProposal": "Root keeps this existing sprite explicitly when changing the basic Hatchet parent."
    },
    {
      "id": "Item.FlintHatchet",
      "source": "src/content/core/defs/materials.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.FlintHatchet",
        "parent": "Item.Hatchet",
        "label": "부싯돌 손도끼",
        "stuffDefaults": {
          "head": "Material.Flint"
        },
        "repair": {
          "material": "Item.Stone",
          "unitsPer10": 0.1,
          "turns": 200,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "salvage": {
          "material": "Item.Stone",
          "count": 2,
          "turns": 100,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        }
      },
      "hasOwnRawSprite": false,
      "ownRawSprite": null,
      "existingResolvedSprite": "hatchet",
      "chain": [
        "Item.FlintHatchet",
        "Item.Hatchet",
        "Item.Weapon"
      ],
      "directChildren": [],
      "allFurtherDescendants": [],
      "preservationProposal": "Root keeps this existing sprite explicitly when changing the basic Hatchet parent."
    },
    {
      "id": "Item.SteelHatchet",
      "source": "src/content/core/defs/materials.json",
      "rawDefinition": {
        "defType": "Item",
        "id": "Item.SteelHatchet",
        "parent": "Item.Hatchet",
        "label": "강철 손도끼",
        "stuffDefaults": {
          "head": "Material.Steel"
        },
        "repair": {
          "material": "Item.SteelIngot",
          "unitsPer10": 0.2,
          "turns": 200,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        },
        "salvage": {
          "material": "Item.SteelIngot",
          "count": 4,
          "turns": 100,
          "attr": "str",
          "tools": [
            "hammer"
          ]
        }
      },
      "hasOwnRawSprite": false,
      "ownRawSprite": null,
      "existingResolvedSprite": "hatchet",
      "chain": [
        "Item.SteelHatchet",
        "Item.Hatchet",
        "Item.Weapon"
      ],
      "directChildren": [],
      "allFurtherDescendants": [],
      "preservationProposal": "Root keeps this existing sprite explicitly when changing the basic Hatchet parent."
    }
  ],
  "existingSharedSpriteConsumers": {
    "rusty_knife": [
      {
        "id": "Item.RustyKnife",
        "source": "src/content/core/defs/items-weapons.json",
        "hasOwnRawSprite": true,
        "resolvedSprite": "rusty_knife"
      }
    ],
    "hatchet": [
      {
        "id": "Item.AlloyHatchet",
        "source": "src/content/core/defs/materials.json",
        "hasOwnRawSprite": false,
        "resolvedSprite": "hatchet"
      },
      {
        "id": "Item.CustomHatchet",
        "source": "src/content/core/defs/material-crafting.json",
        "hasOwnRawSprite": false,
        "resolvedSprite": "hatchet"
      },
      {
        "id": "Item.FlintHatchet",
        "source": "src/content/core/defs/materials.json",
        "hasOwnRawSprite": false,
        "resolvedSprite": "hatchet"
      },
      {
        "id": "Item.Hatchet",
        "source": "src/content/core/defs/items-weapons.json",
        "hasOwnRawSprite": true,
        "resolvedSprite": "hatchet"
      },
      {
        "id": "Item.SteelHatchet",
        "source": "src/content/core/defs/materials.json",
        "hasOwnRawSprite": false,
        "resolvedSprite": "hatchet"
      }
    ],
    "rebar_spear": [
      {
        "id": "Item.IronIngot",
        "source": "src/content/core/defs/materials.json",
        "hasOwnRawSprite": true,
        "resolvedSprite": "rebar_spear"
      },
      {
        "id": "Item.LowPowerCell",
        "source": "src/content/core/defs/machines.json",
        "hasOwnRawSprite": true,
        "resolvedSprite": "rebar_spear"
      },
      {
        "id": "Item.Pole",
        "source": "src/content/core/defs/background-items.json",
        "hasOwnRawSprite": true,
        "resolvedSprite": "rebar_spear"
      },
      {
        "id": "Item.RebarSpear",
        "source": "src/content/core/defs/items-weapons.json",
        "hasOwnRawSprite": true,
        "resolvedSprite": "rebar_spear"
      },
      {
        "id": "Item.SeedVaultKey",
        "source": "src/content/core/defs/blackwood.json",
        "hasOwnRawSprite": true,
        "resolvedSprite": "rebar_spear"
      },
      {
        "id": "Item.SmallActuator",
        "source": "src/content/core/defs/machines.json",
        "hasOwnRawSprite": true,
        "resolvedSprite": "rebar_spear"
      },
      {
        "id": "Item.SteelIngot",
        "source": "src/content/core/defs/crafting.json",
        "hasOwnRawSprite": true,
        "resolvedSprite": "rebar_spear"
      },
      {
        "id": "Item.Tongs",
        "source": "src/content/core/defs/crafting.json",
        "hasOwnRawSprite": true,
        "resolvedSprite": "rebar_spear"
      },
      {
        "id": "Item.WeldNozzle",
        "source": "src/content/core/defs/machines.json",
        "hasOwnRawSprite": true,
        "resolvedSprite": "rebar_spear"
      }
    ]
  },
  "spriteFieldPatchesObserved": [
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
  "materialReferences": [
    {
      "defType": "Material",
      "id": "Material.Scrap",
      "label": "고철",
      "category": "Metal",
      "density": 7.7,
      "sharpness": 55,
      "hardness": 50,
      "toughness": 50,
      "insulation": 0,
      "wetLoss": 0,
      "corrosionResist": 25,
      "flammability": 0,
      "valuePerKg": 4
    },
    {
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
    }
  ],
  "recipes": [
    {
      "defType": "Recipe",
      "id": "Recipe.Hatchet",
      "label": "손도끼 단조",
      "category": "smithing",
      "primaryAttr": "str",
      "basic": false,
      "workTurns": 720,
      "inputs": [
        {
          "item": "Item.IronScrap",
          "count": 4
        },
        {
          "item": "Item.Wood",
          "count": 1
        },
        {
          "item": "Item.Charcoal",
          "count": 3
        }
      ],
      "output": {
        "item": "Item.Hatchet",
        "count": 1
      },
      "tools": [
        "hammer",
        "tongs"
      ],
      "stations": [
        "forge",
        "artisan"
      ],
      "noise": 8
    },
    {
      "defType": "Recipe",
      "id": "Recipe.Spear",
      "label": "철근 창 단조",
      "category": "smithing",
      "primaryAttr": "str",
      "basic": false,
      "workTurns": 480,
      "inputs": [
        {
          "item": "Item.IronScrap",
          "count": 4
        },
        {
          "item": "Item.Wood",
          "count": 1
        },
        {
          "item": "Item.Charcoal",
          "count": 2
        }
      ],
      "output": {
        "item": "Item.RebarSpear",
        "count": 1
      },
      "tools": [
        "hammer",
        "tongs"
      ],
      "stations": [
        "forge",
        "artisan"
      ],
      "noise": 8
    }
  ],
  "existingDedicatedFramesPresent": [],
  "existingOriginalWeaponFamiliesExcluded": [
    "javelin",
    "greatsword",
    "flintlock/revolver/bolt rifle and ammunition"
  ],
  "sourceFiles": [
    {
      "path": "src/client/sprites.json",
      "sha256": "167f7e77ad77cc1a63d814ae6ba2853b386462071dd76358688e718fe036b491"
    },
    {
      "path": "src/content/core/defs/items-weapons.json",
      "sha256": "ecefb821becdc6cfb82202441087651d4bcead5092eedb5c445cd7ca4da995d0"
    },
    {
      "path": "src/content/core/defs/crafting.json",
      "sha256": "d9b195e70adc37176790dac989bc302a3733c27006be8a94b51452816688bec1"
    },
    {
      "path": "src/content/core/defs/materials.json",
      "sha256": "fb678594385283564a441ce7af4b06a1ee1aba7fceb5dd4591b351df963038da"
    },
    {
      "path": "src/content/core/defs/material-crafting.json",
      "sha256": "5ac359aba17119dcf2113c2177b24e3de91cc4c8f04322a176ff0a17ee82beb4"
    },
    {
      "path": "src/client/ui/InventoryWindow.vue",
      "sha256": "0da9b351376a544ebf1b58580ac643386292918fbe74b914455fe7be5e285f9f"
    },
    {
      "path": "docs/CANON.md",
      "sha256": "fc6dcde298c5bdf18b1e648507abdd4b29c2d990b7a4c888a2957d7b586f72f7"
    },
    {
      "path": "docs/design/07-combat.md",
      "sha256": "3d5d415223061d7cfe4b65004119708c4f48db5f61cd93a4c67a22a0b9226286"
    },
    {
      "path": "docs/design/08-items-and-crafting.md",
      "sha256": "82e5e907930da845d1c9584e7516d5829895e16c9dd753959c58c1b5a801c92f"
    },
    {
      "path": "docs/design/13-inventory.md",
      "sha256": "acb89b5afc035794deb2b0234c75dd0ee118d3ecb8f0fefc3ff0e123fc0c48e5"
    }
  ],
  "integrationApplied": false,
  "rootDecision": "Only final RustyKnife/Hatchet/RebarSpear display may change. Four material/custom hatchet descendants retain their existing resolved sprite, with explicit child overrides supplied by Root if needed."
}''')


def rusty_knife():
    c=Canvas()
    # Short simple wood grip, with ordinary fasteners; no ceremonial guard or effect mark.
    c.polygon([(6,26),(11,20),(14,18),(18,21),(16,24),(10,30),(7,30),(5,28)],"o")
    c.polygon([(7,26),(12,21),(14,20),(16,21),(14,24),(9,28),(7,28)],"r")
    c.line(8,26,13,21,"n");c.line(10,27,15,22,"b")
    c.point(9,26,"v");c.point(14,22,"w")
    c.line(12,18,18,24,"o");c.line(13,18,18,23,"u")
    # An uneven, visibly oxidized short scrap blade. No blood or contamination/poison cue.
    c.polygon([(14,18),(18,14),(20,9),(25,3),(26,7),(25,14),
               (22,18),(19,21),(17,21)],"o")
    c.polygon([(16,18),(19,14),(21,10),(24,6),(24,13),
               (21,17),(18,19)],"v")
    c.line(20,11,24,6,"w");c.line(21,13,23,9,"u")
    c.line(17,17,19,15,"w")
    c.row(20,13,"rn");c.point(21,12,"r")
    c.row(18,17,"nr");c.point(22,15,"r")
    c.point(19,18,"u");c.point(24,8,"n")
    return c


def hatchet():
    c=Canvas()
    # Short curved ash-wood haft: one hand tool, distinct from both a sword and a pole weapon.
    c.polygon([(6,27),(10,29),(13,24),(16,19),(19,14),(22,9),
               (20,6),(17,10),(15,15),(12,20),(8,24)],"o")
    c.polygon([(8,26),(10,27),(12,23),(15,18),(18,13),(20,9),
               (19,8),(17,12),(14,17),(11,22)],"r")
    c.line(9,25,13,20,"n");c.line(13,20,17,12,"n")
    c.point(10,26,"s");c.point(15,17,"b")
    # One broad working edge and a modest poll; default scrap head, not the steel/flint/alloy variants.
    c.polygon([(14,5),(20,4),(24,7),(29,6),(30,10),(29,17),
               (26,19),(22,15),(18,13),(15,13),(12,10)],"o")
    c.polygon([(15,6),(19,5),(23,8),(28,8),(28,15),(26,17),
               (22,13),(18,12),(15,11),(14,9)],"v")
    c.polygon([(24,9),(27,8),(28,10),(27,15),(26,16),(23,12)],"w")
    c.line(27,10,27,14,"l")
    c.line(15,7,19,6,"u");c.line(15,10,19,11,"u")
    c.rect(18,8,3,3,"u");c.point(19,9,"r");c.point(20,8,"n")
    c.point(22,10,"u");c.point(23,11,"n")
    c.row(16,6,"rv");c.point(16,11,"r")
    return c


def rebar_spear():
    c=Canvas()
    # The wood used by the actual recipe remains the lower shaft; no projectile fletching.
    c.polygon([(2,27),(14,15),(18,13),(20,16),(7,29),(4,30),(2,29)],"o")
    c.line(3,27,16,14,"n");c.line(4,28,17,15,"r")
    c.line(5,28,17,16,"b");c.point(5,27,"s")
    c.line(8,24,12,20,"n");c.point(11,23,"r")
    # A long flattened rebar point and heavy socket, much more metal than the light throwing javelin.
    c.polygon([(13,16),(16,12),(21,8),(28,2),(30,2),(29,7),
               (26,12),(21,17),(17,20)],"o")
    c.polygon([(15,16),(18,12),(22,9),(28,4),(28,7),
               (25,11),(20,16),(17,18)],"v")
    c.line(18,13,28,4,"w");c.line(19,14,26,8,"u")
    c.line(22,11,26,6,"w")
    c.line(13,17,17,21,"o");c.line(14,17,17,20,"u")
    c.line(15,14,18,17,"u");c.line(17,12,20,15,"u")
    c.line(19,10,22,13,"u")
    c.point(16,17,"r");c.point(19,15,"n")
    c.point(23,10,"r");c.point(26,7,"n")
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


LABELS={"rusty_knife":"KNIFE","hatchet":"HATCHET","rebar_spear":"SPEAR"}
ITEMS={"rusty_knife":"Item.RustyKnife","hatchet":"Item.Hatchet","rebar_spear":"Item.RebarSpear"}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args()
    icons={"rusty_knife":rusty_knife(),"hatchet":hatchet(),"rebar_spear":rebar_spear()}
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
    products["public/sprites/original/items/ashveil-basic-weapons-contact.png"]=png(contact(icons))
    products["public/sprites/original/items/ashveil-basic-weapons-palette.json"]=(json.dumps(PALETTE,indent=2)+"\n").encode()
    products["tools/art/basic-weapons-manifest.fragment.json"]=(json.dumps(fragment,indent=2)+"\n").encode()
    products["tools/art/basic-weapons-usage-survey.json"]=(json.dumps(USAGE_SURVEY,indent=2,ensure_ascii=False)+"\n").encode()
    records=[{"file":name,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for name,data in products.items()]
    source={"created":"2026-10-21","method":"original authored integer-coordinate pixel geometry","source":"tools/art/draw-basic-weapons.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"externalImageInputs":[],"modifiedExistingImages":False,"itemCount":3,"nativePixels":[32,32],"previewPixels":[16,16],"alphaValues":[0,255],"paletteColors":len(PALETTE),"opaqueBounds":bounds,"integrationApplied":False,"itemToProposedSprite":{value:"original_"+key for key,value in ITEMS.items()},"proposalScope":"exactly basic RustyKnife, Hatchet and RebarSpear; shared old icons and all material/custom Hatchet descendants retain their previous display by Root-scoped bindings","notEncoded":["quality","durability","edge state","quantity","poison","enchantment","combat statistics","state threshold","ownership"],"visualInterpretation":"Short rusty scrap knife, broad scrap axe head on ash wood, and a long flattened rebar thrusting head with recipe-backed wood shaft. Basic material appearance only; no new metal type, poison, enchantment, numeric wear or combat-stat glyph. Material/custom hatchet variants excluded from final display changes.","files":records}
    products["public/sprites/original/items/ashveil-basic-weapons-source.json"]=(json.dumps(source,indent=2,ensure_ascii=False)+"\n").encode()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"regeneration differs: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic files; three original basic weapon icons")


if __name__=="__main__":main()
