#!/usr/bin/env python3
"""Independent, standard-library-only validation of the isolated healer art pack.

Reads only this pack. It neither imports the drawing tool nor changes files.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import zlib

ROOT = Path(__file__).resolve().parents[2]
ART = ROOT / "public/sprites/original"
DIRS = ["down", "left", "right", "up"]


def read_png(path: Path) -> tuple[int, int, bytes]:
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, compressed, size = 8, bytearray(), None
    while pos < len(data):
        length = struct.unpack_from(">I", data, pos)[0]
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        crc = struct.unpack_from(">I", data, pos + 8 + length)[0]
        assert zlib.crc32(kind + body) & 0xffffffff == crc
        if kind == b"IHDR":
            width, height, depth, color, compression, filtering, interlace = struct.unpack(">IIBBBBB", body)
            assert (depth, color, compression, filtering, interlace) == (8, 6, 0, 0, 0)
            size = (width, height)
        elif kind == b"IDAT":
            compressed.extend(body)
        pos += length + 12
    assert size and pos == len(data)
    width, height = size
    scanlines = zlib.decompress(compressed)
    assert len(scanlines) == height * (width * 4 + 1)
    pixels = bytearray()
    for row in range(height):
        start = row * (width * 4 + 1)
        assert scanlines[start] == 0
        pixels.extend(scanlines[start + 1:start + 1 + width * 4])
    assert set(pixels[3::4]) <= {0, 255}
    return width, height, bytes(pixels)


def svg_pixels(path: Path, width: int, height: int) -> bytes:
    root = ET.parse(path).getroot()
    assert (int(root.attrib["width"]), int(root.attrib["height"])) == (width, height)
    pixels = bytearray(width * height * 4)
    for rect in root.findall("{http://www.w3.org/2000/svg}rect"):
        x, y, w, h = [int(rect.attrib[key]) for key in ("x", "y", "width", "height")]
        assert 0 <= x < x + w <= width and 0 <= y < y + h <= height
        rgba = bytes.fromhex(rect.attrib["fill"].removeprefix("#")) + b"\xff"
        for py in range(y, y + h):
            for px in range(x, x + w):
                start = (py * width + px) * 4
                pixels[start:start + 4] = rgba
    return bytes(pixels)


def main() -> None:
    mapping = json.loads((ROOT / "tools/art/healer-manifest.fragment.json").read_text())
    survey = json.loads((ROOT / "tools/art/healer-usage-survey.json").read_text())
    origin = json.loads((ART / "ashveil-healer-source.json").read_text())
    assert set(mapping) == {"sheets", "frames", "chars"}
    assert set(mapping["sheets"]) == {"resident_healer", "resident_healer_atk"}
    assert set(mapping["chars"]) == {"resident_healer"}
    assert len(mapping["frames"]) == 28
    char = mapping["chars"]["resident_healer"]
    reference = survey["referenceHeroContract"]
    for field, count, part in [("walk", 3, "w"), ("idle", 1, "w"), ("attack", 4, "a")]:
        assert set(char[field]) == set(DIRS)
        for direction in DIRS:
            values = char[field][direction]
            assert len(values) == count
            assert [value.replace("resident_healer", "hero") for value in values] == reference[field][direction]
            if field == "idle":
                assert values == [f"resident_healer_w_{direction}1"]
            else:
                assert values == [f"resident_healer_{part}_{direction}{index}" for index in range(count)]
    assert char["anchor"] == reference["anchor"] == [0.5, 31 / 32]
    assert char["attackAnchor"] == reference["attackAnchor"] == [0.5, 39 / 40]
    assert char["renderScale"] == reference["renderScale"] == 1
    assert char["headOffset"] == 28 and 39 - 8 == 31
    assert survey["applied"] is False and origin["integrationProposal"]["applied"] is False
    assert {item["id"] for item in survey["doctorFamily"]} == {
        "Creature.SettlementDoctor", "Creature.SignalistHealer", "Creature.LanternHealer"}
    assert all(item["char"] == "hero" for item in survey["doctorFamily"])
    assert survey["doctorBase"]["skills"]["medicine"] == 50
    assert survey["clinic"]["id"] == "Clinic.Hearth"
    assert survey["clinic"]["doctor"] == "Creature.SettlementDoctor"

    sheets = {}
    for suffix, sheet, expected in [("walk", "resident_healer", (72, 128)),
                                    ("attack", "resident_healer_atk", (128, 160))]:
        width, height, pixels = read_png(ART / f"ashveil-healer-{suffix}.png")
        assert (width, height) == expected
        assert svg_pixels(ART / f"ashveil-healer-{suffix}.svg", width, height) == pixels
        sheets[sheet] = (width, height, pixels)
    bounds = []
    signatures = {}
    for key, (sheet, x, y, w, h) in mapping["frames"].items():
        assert key.startswith("resident_healer_")
        width, height, pixels = sheets[sheet]
        assert 0 <= x < x + w <= width and 0 <= y < y + h <= height
        occupied, frame = [], bytearray()
        for py in range(h):
            for px in range(w):
                start = ((y + py) * width + x + px) * 4
                rgba = pixels[start:start + 4]
                frame.extend(rgba)
                if rgba[3]:
                    occupied.append((px, py))
        assert occupied and all(0 < px < w - 1 and 0 < py < h - 1 for px, py in occupied)
        if sheet == "resident_healer":
            ys = [py for _, py in occupied]
            assert (min(ys), max(ys)) == (3, 30)
            bounds.append(max(ys) - min(ys) + 1)
        group = key[:-1]
        signatures.setdefault(group, set()).add(bytes(frame))
    assert len(bounds) == 12 and set(bounds) == {28}
    assert all(len(values) == (3 if "_w_" in group else 4) for group, values in signatures.items())
    width, height, _ = read_png(ART / "ashveil-healer-contact.png")
    assert (width, height) == (640, 1304)
    assert hashlib.sha256((ROOT / origin["source"]).read_bytes()).hexdigest() == origin["sourceSha256"]
    for record in origin["files"]:
        data = (ROOT / record["file"]).read_bytes()
        assert len(data) == record["bytes"]
        assert hashlib.sha256(data).hexdigest() == record["sha256"]
    print("PASS independent healer PNG/SVG pixel equality, alpha/CRC, 28-frame bounds/unique poses, 28px native body, anchors, hero contract, 3-member Doctor survey and source hashes.")


if __name__ == "__main__":
    main()
