#!/usr/bin/env python3
"""Independent CC0 PNG/SVG/frame/anchor audit of the isolated player art.

Standard library only. Does not import the drawing tool, game, or old images.
Reads only this pack and prints JSON; writes no files.
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
PREFIX = "original_wanderer_hero"
DIRS = ["down", "left", "right", "up"]


def read_png(path):
    b = path.read_bytes()
    assert b[:8] == b"\x89PNG\r\n\x1a\n"
    pos, stream, kinds, size = 8, bytearray(), [], None
    while pos < len(b):
        assert pos + 12 <= len(b)
        length = struct.unpack_from(">I", b, pos)[0]
        assert pos + length + 12 <= len(b)
        kind = b[pos + 4:pos + 8]
        payload = b[pos + 8:pos + 8 + length]
        crc = struct.unpack_from(">I", b, pos + 8 + length)[0]
        assert zlib.crc32(kind + payload) & 0xffffffff == crc
        if kind == b"IHDR":
            w, h, depth, color, comp, filt, interlace = struct.unpack(">IIBBBBB", payload)
            assert (depth, color, comp, filt, interlace) == (8, 6, 0, 0, 0)
            size = w, h
        elif kind == b"IDAT":
            stream.extend(payload)
        elif kind == b"IEND":
            assert length == 0 and pos + 12 == len(b)
        kinds.append(kind)
        pos += 12 + length
    assert pos == len(b) and kinds == [b"IHDR", b"IDAT", b"IEND"] and size
    dec = zlib.decompressobj()
    raw = dec.decompress(stream) + dec.flush()
    assert dec.eof and not dec.unused_data and not dec.unconsumed_tail
    w, h = size
    stride = w * 4 + 1
    assert len(raw) == h * stride
    rgba = bytearray()
    for y in range(h):
        assert raw[y * stride] == 0
        rgba.extend(raw[y * stride + 1:(y + 1) * stride])
    return w, h, bytes(rgba)


def svg_rgba(path, w, h):
    root = ET.parse(path).getroot()
    assert (int(root.attrib["width"]), int(root.attrib["height"])) == (w, h)
    assert root.attrib["viewBox"] == f"0 0 {w} {h}"
    pixels = bytearray(w * h * 4)
    used = set()
    for n in root:
        tag = n.tag.rsplit("}", 1)[-1]
        assert tag in {"title", "desc", "rect"}
        if tag != "rect":
            continue
        assert set(n.attrib) == {"x", "y", "width", "height", "fill"}
        x, y, rw, rh = [int(n.attrib[k]) for k in ["x", "y", "width", "height"]]
        assert 0 <= x < x + rw <= w and 0 <= y < y + rh <= h
        color = bytes.fromhex(n.attrib["fill"][1:]) + b"\xff"
        for yy in range(y, y + rh):
            for xx in range(x, x + rw):
                assert (xx, yy) not in used
                used.add((xx, yy))
                pixels[(yy * w + xx) * 4:(yy * w + xx + 1) * 4] = color
    return bytes(pixels)


def crop(sheet, sw, x, y, w, h):
    return b"".join(sheet[((y + yy) * sw + x) * 4:((y + yy) * sw + x + w) * 4] for yy in range(h))


def main():
    j = lambda p: json.loads(p.read_text())
    source = j(ART / "ashveil-player-wanderer-source.json")
    fragment = j(ROOT / "tools/art/player-manifest.fragment.json")
    assert fragment == j(ART / "ashveil-player-wanderer-frames.json")
    assert set(fragment) == {"sheets", "frames", "chars"}
    assert set(fragment["sheets"]) == {PREFIX, PREFIX + "_atk"}
    assert set(fragment["chars"]) == {PREFIX}
    assert len(fragment["frames"]) == 28
    palette = j(ART / "ashveil-player-wanderer-palette.json")
    allowed = {bytes.fromhex(c[1:]) + b"\xff" for c in palette.values()}
    assert len(palette) == 22
    ch = fragment["chars"][PREFIX]
    assert ch["anchor"] == [.5, 31 / 32] and ch["attackAnchor"] == [.5, 39 / 40]
    assert ch["renderScale"] == 1 and ch["headOffset"] == 30
    reference = j(ROOT / source["referenceContract"])
    assert reference["existingHero"]["anchor"] == ch["anchor"]
    assert reference["existingHero"]["attackAnchor"] == ch["attackAnchor"]
    assert reference["existingHero"]["renderScale"] == ch["renderScale"]
    assert reference["existingHero"]["headOffset"] == ch["headOffset"]
    sheets = {}
    for sheet, size, filename in [(PREFIX, (72, 128), "walk"), (PREFIX + "_atk", (128, 160), "attack")]:
        assert fragment["sheets"][sheet] == f"sprites/original/ashveil-player-wanderer-{filename}.png"
        w, h, pixels = read_png(ART / f"ashveil-player-wanderer-{filename}.png")
        assert (w, h) == size
        assert svg_rgba(ART / f"ashveil-player-wanderer-{filename}.svg", w, h) == pixels
        assert set(pixels[3::4]) == {0, 255}
        assert {pixels[i:i + 4] for i in range(0, len(pixels), 4) if pixels[i + 3]} <= allowed
        sheets[sheet] = (w, h, pixels)
    records, hashes, frame_pixels = [], [], {}
    for row, direction in enumerate(DIRS):
        assert ch["idle"][direction] == [ch["walk"][direction][0]]
        for kind, key, count, w, h, ground, top in [("w", "walk", 3, 24, 32, 31, 1), ("a", "attack", 4, 32, 40, 39, 9)]:
            names = ch[key][direction]
            assert len(names) == count
            sheet = PREFIX if kind == "w" else PREFIX + "_atk"
            for index in range(count):
                name = f"{PREFIX}_{kind}_{direction}{index}"
                assert names[index] == name
                assert fragment["frames"][name] == [sheet, index * w, row * h, w, h]
                sw, sh, data = sheets[sheet]
                pixels = crop(data, sw, index * w, row * h, w, h)
                occupied = [(x, y) for y in range(h) for x in range(w) if pixels[(y * w + x) * 4 + 3]]
                bounds = [min(x for x, y in occupied), min(y for x, y in occupied), max(x for x, y in occupied), max(y for x, y in occupied)]
                assert bounds[1] == top and bounds[3] == ground - 1, (name, bounds)
                assert all(0 < x < w - 1 and 0 < y < h - 1 for x, y in occupied), (name, bounds)
                assert bounds[3] - bounds[1] + 1 == 30
                digest = hashlib.sha256(pixels).hexdigest()
                hashes.append(digest)
                frame_pixels[name] = (w, h, pixels)
                records.append({"frame": name, "direction": direction, "kind": kind, "index": index, "cell": [w, h], "boundsInclusive": bounds, "opaquePixels": len(occupied)})
    assert len(set(hashes)) == 28, "all28authoredposes must be distinct"
    assert records == source["measurements"]
    cw, chh, contact = read_png(ART / "ashveil-player-wanderer-contact.png")
    assert (cw, chh) == (744, 1264)
    for row, direction in enumerate(DIRS):
        for kind, count, top, row_height, image_y, image_x, ground in [("w", 3, 64, 128, 12, 36, 105), ("a", 4, 608, 152, 4, 24, 121)]:
            for index in range(count):
                name = f"{PREFIX}_{kind}_{direction}{index}"
                w, h, pixels = frame_pixels[name]
                left, cell_top = 112 + index * 152, top + row * row_height
                background = bytes.fromhex("202c2e" if row % 2 else "151c20") + b"\xff"
                guide = bytes.fromhex("4b5553") + b"\xff"
                for yy in range(h * 3):
                    for xx in range(w * 3):
                        src = ((yy // 3) * w + xx // 3) * 4
                        local_y = image_y + yy
                        expected = pixels[src:src + 4] if pixels[src + 3] else guide if local_y == ground else background
                        dst = ((cell_top + local_y) * cw + left + image_x + xx) * 4
                        assert contact[dst:dst + 4] == expected
    assert source["license"] == "CC0-1.0"
    assert source["commercialUseAllowed"] and source["redistributionAndDerivativePackagesAllowed"]
    assert source["attributionRequired"] is False
    assert source["externalImageInputs"] == [] and source["existingHeroPixelsCopiedOrEdited"] is False
    assert source["integrationApplied"] is False
    for name, field in [(source["source"], "sourceSha256"), (source["referenceContract"], "referenceContractSha256")]:
        assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == source[field]
    for item in source["files"]:
        b = (ROOT / item["file"]).read_bytes()
        assert len(b) == item["bytes"] and hashlib.sha256(b).hexdigest() == item["sha256"]
    # Integration may preserve this pack's license under tools/art without
    # replacing the main project's own license.
    license_path = ROOT / "tools/art/player-LICENSE.txt"
    if not license_path.exists():
        license_path = ROOT / "LICENSE.txt"
    license_text = license_path.read_text()
    assert "CC0-1.0" in license_text and "Commercial" in license_text and "attribution" in license_text
    print(json.dumps({"result": "PASS", "scope": "isolated original player-only art; no game/browser/GPU/Core or existing image input", "nativeWalkSheet": [72, 128], "nativeAttackSheet": [128, 160], "walkCell": [24, 32], "attackCell": [32, 40], "attackBodyOffset": [4, 8], "walkFrames": 12, "attackFrames": 16, "distinctPoseRGBAs": 28, "idleReusesNewWalk0": True, "PNGSVGPairs": 2, "PNGCRCSingleTerminalIEND": True, "alphaValues": [0, 255], "paletteEntries": len(palette), "everyPoseHeight": 30, "headOffset": 30, "renderScale": 1, "walkGroundY": 31, "attackGroundY": 39, "allFrameOuterEdgesTransparent": True, "all28ContactFramePixelsVerified": True, "sourceListedHashesVerified": len(source["files"]), "sourceAndReferenceHashesVerified": True, "license": "CC0-1.0", "onlyNewCharacterKey": PREFIX, "integrationApplied": False}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
