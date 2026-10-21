#!/usr/bin/env python3
"""Independent read-only PNG/SVG/alpha/source validator. CC0-1.0.

Does not import or execute the drawing tool; no game or mod files are read.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import zlib

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "art"


def decode_png(path: Path) -> tuple[int, int, bytes]:
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    position = 8
    compressed = bytearray()
    kinds = []
    dimensions = None
    while position < len(data):
        assert position + 12 <= len(data)
        length = struct.unpack_from(">I", data, position)[0]
        assert position + length + 12 <= len(data)
        kind = data[position + 4:position + 8]
        payload = data[position + 8:position + 8 + length]
        crc = struct.unpack_from(">I", data, position + 8 + length)[0]
        assert zlib.crc32(kind + payload) & 0xffffffff == crc
        kinds.append(kind)
        if kind == b"IHDR":
            width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", payload)
            assert (depth, color, compression, filtering, interlace) == (8, 6, 0, 0, 0)
            dimensions = (width, height)
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            assert length == 0
            assert position + 12 == len(data), "IEND must terminate the file"
        else:
            raise AssertionError(f"unexpected PNG chunk: {kind!r}")
        position += length + 12
    assert kinds == [b"IHDR", b"IDAT", b"IEND"]
    assert dimensions and position == len(data)
    width, height = dimensions
    inflater = zlib.decompressobj()
    raw = inflater.decompress(compressed) + inflater.flush()
    assert inflater.eof and not inflater.unused_data and not inflater.unconsumed_tail
    stride = width * 4 + 1
    assert len(raw) == height * stride
    pixels = bytearray()
    for y in range(height):
        assert raw[y * stride] == 0
        pixels.extend(raw[y * stride + 1:(y + 1) * stride])
    return width, height, bytes(pixels)


def svg_rgba() -> bytes:
    root = ET.parse(ART / "demo-salt-pouch.svg").getroot()
    assert root.attrib["width"] == root.attrib["height"] == "16"
    assert root.attrib["viewBox"] == "0 0 16 16"
    result = bytearray(16 * 16 * 4)
    occupied = set()
    for node in root:
        tag = node.tag.rsplit("}", 1)[-1]
        assert tag in {"title", "desc", "rect"}
        if tag != "rect":
            continue
        assert set(node.attrib) == {"x", "y", "width", "height", "fill"}
        x, y, width, height = [int(node.attrib[key]) for key in ("x", "y", "width", "height")]
        assert width == height == 1 and 0 <= x < 16 and 0 <= y < 16
        assert (x, y) not in occupied
        occupied.add((x, y))
        rgba = bytes.fromhex(node.attrib["fill"].removeprefix("#")) + b"\xff"
        start = (y * 16 + x) * 4
        result[start:start + 4] = rgba
    return bytes(result)


def main() -> None:
    width, height, pixels = decode_png(ART / "demo-salt-pouch.png")
    assert (width, height) == (16, 16)
    assert svg_rgba() == pixels
    assert set(pixels[3::4]) == {0, 255}
    occupied = [(x, y) for y in range(16) for x in range(16) if pixels[(y * 16 + x) * 4 + 3]]
    assert occupied and all(0 < x < 15 and 0 < y < 15 for x, y in occupied)
    bounds = [min(x for x, y in occupied), min(y for x, y in occupied), max(x for x, y in occupied), max(y for x, y in occupied)]
    palette = json.loads((ART / "demo-salt-pouch-palette.json").read_text())
    allowed = {bytes.fromhex(value.removeprefix("#")) + b"\xff" for value in palette.values()}
    colors = {pixels[i:i + 4] for i in range(0, len(pixels), 4) if pixels[i + 3]}
    assert len(palette) == 15 and len(colors) <= 15 and colors <= allowed
    ew, eh, enlarged = decode_png(ART / "demo-salt-pouch-8x.png")
    assert (ew, eh) == (128, 128)
    for y in range(128):
        for x in range(128):
            src = ((y // 8) * 16 + x // 8) * 4
            dst = (y * 128 + x) * 4
            assert enlarged[dst:dst + 4] == pixels[src:src + 4]
    cw, ch, sheet = decode_png(ART / "demo-salt-pouch-contact.png")
    assert (cw, ch) == (384, 208) and set(sheet[3::4]) == {255}
    for left, background in [(0, "172323"), (192, "c6c3ad")]:
        for factor, ox, oy in [(1, 12, 12), (2, 44, 8), (8, 32, 64)]:
            for y in range(16 * factor):
                for x in range(16 * factor):
                    src = ((y // factor) * 16 + x // factor) * 4
                    rgba = pixels[src:src + 4] if pixels[src + 3] else bytes.fromhex(background) + b"\xff"
                    dst = ((oy + y) * cw + left + ox + x) * 4
                    assert sheet[dst:dst + 4] == rgba
    source = json.loads((ART / "demo-salt-pouch-source.json").read_text())
    assert source["license"] == "CC0-1.0"
    assert source["commercialUseAllowed"] and source["redistributionAndDerivativePackagesAllowed"]
    assert source["attributionRequired"] is False
    assert source["externalImageInputs"] == [] and source["modifiedExistingImages"] is False
    assert source["gameOrModRegistrationApplied"] is False
    assert bounds == source["opaqueBoundsInclusive"]
    assert hashlib.sha256((ROOT / source["source"]).read_bytes()).hexdigest() == source["sourceSha256"]
    for record in source["files"]:
        data = (ROOT / record["file"]).read_bytes()
        assert len(data) == record["bytes"]
        assert hashlib.sha256(data).hexdigest() == record["sha256"]
    license_text = (ROOT / "LICENSE.txt").read_text()
    assert "CC0-1.0" in license_text and "commercial" in license_text and "derivative" in license_text
    print(json.dumps({
        "result": "PASS",
        "scope": "isolated original art; no game/mod activation/browser/GPU/project tests",
        "nativeSize": [16, 16],
        "nativePngSvgPixelsEqual": True,
        "pngCrcAndSingleTerminalIend": True,
        "alphaValues": [0, 255],
        "opaquePixels": len(occupied),
        "opaqueBoundsInclusive": bounds,
        "opaquePaletteDefinitions": len(palette),
        "usedOpaqueColors": len(colors),
        "colorsIncludingTransparency": len(colors) + 1,
        "nearest8xPixelsVerified": True,
        "contactNative2x8xOnTwoBackgroundsVerified": True,
        "sourceHashesVerified": len(source["files"]),
        "sourceToolHashVerified": True,
        "license": "CC0-1.0",
        "commercialAndDerivativePackagesAllowed": True,
        "gameOrModRegistrationApplied": False,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
