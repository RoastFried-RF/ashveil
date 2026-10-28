#!/usr/bin/env python3
"""Original 16px demo salt pouch; Python standard library only, CC0-1.0.

All pixels below are newly authored coordinates, not an input image edit.
No game, mod activation, atlas or existing image is read or modified.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
PALETTE = {
    "b": "#252b29",  # ash outline
    "d": "#493b30",  # deepest cloth fold
    "r": "#634932",  # brown cloth shadow
    "m": "#85613f",  # aged brown cloth
    "L": "#a77e50",  # raised fold
    "l": "#c19c67",  # frayed thread
    "e": "#82745a",  # ash on cloth
    "h": "#777f72",  # salt shaded edge
    "c": "#a5b29d",  # crystal midtone
    "w": "#d3dac2",  # crystal light
    "W": "#eeedd8",  # tiny bright facet
    "s": "#555d52",  # crystal dark facet
    "t": "#4b6159",  # muted plateau green shadow
    "a": "#8c907e",  # dry ash
    "f": "#d3b47c",  # one torn fiber
}

# New asymmetric open sack with an uneven torn mouth and a light crystal heap.
# Each character is one integer pixel. No inherited/cropped/recolored raster.
ROWS = (
    "................",
    "................",
    "......w.........",
    ".....cWw........",
    "....cwWWc.......",
    "...bcWWhwde.....",
    "...bshhdbbrdf...",
    "....brLmmmLrb...",
    "....brmLLmLrb...",
    "...brrlLmmrdb...",
    "...brmLlmmrdb...",
    "..cbrmLlamrdb...",
    ".wWcbmllmmrtb...",
    "..c.brmmrrdb....",
    ".....bbbtbb.....",
    "................",
)


def rgba(hex_color: str) -> bytes:
    return bytes.fromhex(hex_color[1:]) + b"\xff"


def native_pixels() -> bytes:
    assert len(ROWS) == 16 and all(len(row) == 16 for row in ROWS)
    return b"".join(b"\0\0\0\0" if char == "." else rgba(PALETTE[char]) for row in ROWS for char in row)


def png(width: int, height: int, pixels: bytes) -> bytes:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload) & 0xffffffff)
    raw = b"".join(b"\0" + pixels[y * width * 4:(y + 1) * width * 4] for y in range(height))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9))
            + chunk(b"IEND", b""))


def svg() -> bytes:
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges">',
             '<title>ASHVEIL original demo salt pouch</title>',
             '<desc>New integer pixel coordinates; open torn brown sack and pale salt facets. CC0-1.0.</desc>']
    for y, row in enumerate(ROWS):
        for x, char in enumerate(row):
            if char != ".":
                parts.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{PALETTE[char]}"/>')
    return ("\n".join(parts) + "\n</svg>\n").encode()


def nearest(pixels: bytes, source_width: int, source_height: int, factor: int) -> bytes:
    return b"".join(pixels[((y // factor) * source_width + x // factor) * 4:((y // factor) * source_width + x // factor) * 4 + 4]
                    for y in range(source_height * factor) for x in range(source_width * factor))


def contact(pixels: bytes) -> bytes:
    # Native + 2x + 8x on two contrasting matte backgrounds. No resampling blur.
    width, height = 384, 208
    sheet = bytearray(rgba("#172323") * width * height)
    for y in range(height):
        for x in range(width // 2, width):
            offset = (y * width + x) * 4
            sheet[offset:offset + 4] = rgba("#c6c3ad")
    for left in (0, 192):
        for factor, ox, oy in ((1, 12, 12), (2, 44, 8), (8, 32, 64)):
            for py in range(16 * factor):
                for px in range(16 * factor):
                    src = ((py // factor) * 16 + px // factor) * 4
                    if pixels[src + 3]:
                        dst = ((oy + py) * width + left + ox + px) * 4
                        sheet[dst:dst + 4] = pixels[src:src + 4]
    return png(width, height, bytes(sheet))


def encoded_json(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode()


def outputs() -> dict[str, bytes]:
    pixels = native_pixels()
    art = "art/"
    files = {
        art + "demo-salt-pouch.png": png(16, 16, pixels),
        art + "demo-salt-pouch.svg": svg(),
        art + "demo-salt-pouch-8x.png": png(128, 128, nearest(pixels, 16, 16, 8)),
        art + "demo-salt-pouch-contact.png": contact(pixels),
        art + "demo-salt-pouch-palette.json": encoded_json(PALETTE),
    }
    occupied = [(x, y) for y, row in enumerate(ROWS) for x, char in enumerate(row) if char != "."]
    source = {
        "created": "2026-10-21",
        "title": "ASHVEIL demo mod salt pouch — original 16px art",
        "license": "CC0-1.0",
        "commercialUseAllowed": True,
        "redistributionAndDerivativePackagesAllowed": True,
        "attributionRequired": False,
        "method": "newly authored 16x16 integer-coordinate pixel grid",
        "source": "tools/draw-demo-salt.py",
        "sourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "externalImageInputs": [],
        "modifiedExistingImages": False,
        "nativeSize": [16, 16],
        "paletteOpaqueColors": len(PALETTE),
        "paletteIncludingTransparency": len(PALETTE) + 1,
        "alphaValues": [0, 255],
        "opaqueBoundsInclusive": [min(x for x, y in occupied), min(y for x, y in occupied), max(x for x, y in occupied), max(y for x, y in occupied)],
        "gameOrModRegistrationApplied": False,
        "proposedUse": "Demo mod textures/ 16x16 PNG; Root selects the actual sprite/path and registration.",
        "notEncoded": ["stack quantity", "purity", "contamination", "effects", "gameplay values", "status"],
        "files": [{"file": name, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()} for name, data in files.items()],
    }
    files[art + "demo-salt-pouch-source.json"] = encoded_json(source)
    return files


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="read-only deterministic byte comparison")
    args = parser.parse_args()
    generated = outputs()
    if args.check:
        for name, data in generated.items():
            assert (ROOT / name).read_bytes() == data, f"deterministic mismatch: {name}"
        print(f"CHECK PASS: {len(generated)} deterministic original 16px salt files")
    else:
        for name, data in generated.items():
            path = ROOT / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        print(f"WROTE: {len(generated)} original 16px salt files")


if __name__ == "__main__":
    main()
