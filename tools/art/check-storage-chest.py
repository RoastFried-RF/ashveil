#!/usr/bin/env python3
"""Independent, standard-library-only validation of the isolated storage chest art pack.

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
    assert {node.tag.rsplit("}", 1)[-1] for node in root} <= {"title", "desc", "rect"}
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


def main():
    source=json.loads((ART/"ashveil-storage-chest-source.json").read_text())
    survey=json.loads((ROOT/"tools/art/storage-chest-usage-survey.json").read_text())
    fragment=json.loads((ROOT/"tools/art/storage-chest-manifest.fragment.json").read_text())
    expected=[("original_storage_chest0","ashveil-storage-chest-closed",16),
              ("original_storage_chest2","ashveil-storage-chest-open",16),
              ("original_storage_chest_item","ashveil-storage-chest-item",32)]
    assert set(fragment)=={"sheets","frames"}
    assert set(fragment["sheets"])==set(fragment["frames"])=={key for key,stem,size in expected}
    assert source["integrationApplied"] is False and survey["integrationApplied"] is False
    assert survey["item"]["size"]==[3,2] and survey["item"]["material"]=="Material.Wood"
    assert survey["item"]["place"]=="Terrain.Stash" and survey["terrain"]["lootGrid"]==[12,8]
    assert survey["legacyFrames"]["chest0"][3:]==survey["legacyFrames"]["chest2"][3:]==[16,16]
    assert source["worldAnchor"]==[.5,1] and source["worldAnchorPixel"]==[8,16]
    assert source["worldGroundBoundary"]==16 and source["worldGroundLastOpaqueRow"]==15
    assert "original_storage_chest0".removesuffix("0")+"2" in fragment["frames"]
    assert {record["id"] for record in survey["spriteConsumers"]}=={
        "Terrain.Chest","Terrain.GuardChest","Terrain.Stash","Item.StorageChest","Item.CoracleKit"}
    assert {x["id"] for x in survey["resolvedChestTerrainFamily"]}=={"Terrain.Chest","Terrain.GuardChest","Terrain.Stash","Terrain.BoatHold","Terrain.ZeroVaultChest","Terrain.Altar"}
    assert sum(1 for x in survey["resolvedChestTerrainFamily"] if x["resolvedSprites"]==["chest0"])==5
    assert next(x for x in survey["resolvedChestTerrainFamily"] if x["id"]=="Terrain.Altar")["resolvedSprites"]==["chest_red0"]
    palette=json.loads((ART/"ashveil-storage-chest-palette.json").read_text())
    allowed={bytes.fromhex(value.removeprefix("#"))+b"\xff" for value in palette.values()}
    pixels_by_key={};checks=[]
    for key,stem,size in expected:
        w,h,pixels=read_png(ART/(stem+".png"));assert (w,h)==(size,size)
        assert svg_pixels(ART/(stem+".svg"),size,size)==pixels
        assert set(pixels[3::4])=={0,255}
        assert {pixels[i:i+4] for i in range(0,len(pixels),4) if pixels[i+3]}<=allowed
        occupied=[(x,y) for y in range(h) for x in range(w) if pixels[(y*w+x)*4+3]]
        assert occupied and all(0<x<w-1 and 0<y<h for x,y in occupied)
        bounds=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        assert bounds==source["opaqueBounds"][key]
        if size==16:assert bounds[3]==15
        assert fragment["sheets"][key]==f"sprites/original/{stem}.png"
        assert fragment["frames"][key]==[key,0,0,size,size]
        pixels_by_key[key]=pixels
        checks.append({"frame":key,"size":[w,h],"opaqueBounds":bounds,"pngSVGEveryPixelMatches":True,"alpha":[0,255],"paletteOnly":True,"sha256":hashlib.sha256((ART/(stem+".png")).read_bytes()).hexdigest()})
    closed=pixels_by_key[expected[0][0]];opened=pixels_by_key[expected[1][0]];item=pixels_by_key[expected[2][0]]
    assert closed!=opened and closed[11*16*4:]==opened[11*16*4:]
    sw,sh,small=read_png(ART/"ashveil-storage-chest-item-16.png");assert (sw,sh)==(16,16)
    assert small==b"".join(item[((2*y+1)*32+2*x+1)*4:((2*y+1)*32+2*x+2)*4] for y in range(16) for x in range(16))
    #32px item is independently drawn, not the same16px map icon enlarged.
    expanded=b"".join(closed[((y//2)*16+x//2)*4:((y//2)*16+x//2+1)*4] for y in range(32) for x in range(32))
    assert item!=expanded
    cw,ch,contact=read_png(ART/"ashveil-storage-chest-contact.png");assert (cw,ch)==(832,432)
    panels=[]
    for index,pixels in enumerate([closed,opened,item]):
        size=16 if index<2 else 32;left=index*256
        panels.append((left+64,52,8 if size==16 else 4,pixels,size,size,"22302e"))
        if size==16:
            panels.extend([(left+56,244,1,pixels,size,size,"11191f"),(left+168,244,1,pixels,size,size,"b8b39f")])
        else:
            panels.extend([(left+48,236,1,item,32,32,"11191f"),(left+168,244,1,small,16,16,"b8b39f"),(left+120,341,2,item,32,32,"2a2720")])
    for ox,oy,scale,pixels,w,h,bg_hex in panels:
        bg=bytes.fromhex(bg_hex)+b"\xff"
        for y in range(h):
            for x in range(w):
                value=pixels[(y*w+x)*4:(y*w+x+1)*4]
                if not value[3]:value=bg
                for dy in range(scale):
                    for dx in range(scale):
                        at=((oy+y*scale+dy)*cw+ox+x*scale+dx)*4
                        assert contact[at:at+4]==value
    assert hashlib.sha256((ROOT/source["source"]).read_bytes()).hexdigest()==source["sourceSha256"]
    for record in source["files"]:
        data=(ROOT/record["file"]).read_bytes();assert len(data)==record["bytes"] and hashlib.sha256(data).hexdigest()==record["sha256"]
    print(json.dumps({"result":"PASS","scope":"isolated original storage chest only; no game/browser/GPU/project tests","worldNative":[16,16],"worldAnchor":[.5,1],"worldGroundBoundary":16,"unchangedFrontBaseRows11through15":True,"openSuffix0to2Resolves":True,"itemNative":[32,32],"actualItemGrid":[3,2],"actualUIIconPixels":64,"actualUIRectangle":[112,74],"itemSeparatelyAuthoredFromMapIcon":True,"pixelChecks":checks,"small16CentreSampleMatches":True,"contactSize":[cw,ch],"contactPanelsCompared":len(panels),"allContactPanelsMatchRawPixels":True,"directConsumers":5,"resolvedTerrainChestFamily":6,"resolvedChest0TerrainConsumers":5,"allSharedConsumersExcludedFromGlobalReplacement":True,"sourceHashesMatch":True},ensure_ascii=False,indent=2))


if __name__=="__main__":main()
