#!/usr/bin/env python3
"""Independent, standard-library-only validation of the isolated bow equipment art pack.

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
ART = ROOT / "public/sprites/original/items"
DIRS = ["down", "left", "right", "up"]


def read_png(path: Path) -> tuple[int, int, bytes]:
    data = path.read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    pos, compressed, size = 8, bytearray(), None
    chunks = []
    while pos < len(data):
        length = struct.unpack_from(">I", data, pos)[0]
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + length]
        chunks.append(kind)
        if kind == b"IEND": assert length == 0 and pos + 12 == len(data)
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
    assert chunks == [b"IHDR", b"IDAT", b"IEND"]
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


def main() -> None:
    keys=["hunting_bow","bow_string"]
    item_ids=["Item.Bow","Item.BowString"]
    fragment=json.loads((ROOT/"tools/art/bow-manifest.fragment.json").read_text())
    survey=json.loads((ROOT/"tools/art/bow-usage-survey.json").read_text())
    source=json.loads((ART/"ashveil-bow-source.json").read_text())
    assert set(fragment)=={"sheets","frames"}
    assert set(fragment["sheets"])==set(fragment["frames"])=={"original_"+key for key in keys}
    assert survey["newTargets"]==item_ids
    items={record["id"]:record for record in survey["items"]}
    assert [items[ident]["resolvedContext"]["size"] for ident in item_ids]==[[2,3],[1,1]]
    assert all(items[ident]["directChildren"]==items[ident]["allFurtherDescendants"]==[] for ident in item_ids)
    assert [items[ident]["resolvedContext"]["sprite"] for ident in item_ids]==["bow","bones"]
    assert all("abstract" not in items[ident]["resolvedContext"] for ident in item_ids)
    assert items["Item.Bow"]["resolvedContext"]["twoHanded"] is True
    assert items["Item.Bow"]["resolvedContext"]["ranged"]=={"range":14,"effective":6,"ammo":"Item.Arrow"}
    assert survey["integrationApplied"] is False and source["integrationApplied"] is False
    assert source["license"]=="CC0-1.0" and source["commercialUseAllowed"] and source["derivativePackagesAllowed"]
    assert source["externalImageInputs"]==[] and source["modifiedExistingImages"] is False
    assert set(survey["preserve"])=={"Item.Arrow","Item.Bolt","Item.Quiver","Item.LightCrossbow"}
    for ident,sprite in survey["preserve"].items():assert items[ident]["resolvedContext"]["sprite"]==sprite
    shared=survey["existingSharedSpriteConsumers"]
    assert {key:len(value) for key,value in shared.items()}=={"bow":2,"bones":6,"arrow":1,"ashveil_arrow_bundle":2,"ashveil_quiver":1}
    assert {record["id"] for record in shared["bow"]}=={"Item.Bow","Item.LightCrossbow"}
    assert {record["id"] for record in shared["bones"]}=={"Item.BoneCharm","Item.Bones","Item.BowString","Item.Charcoal","Item.GardenerLimb","Item.Lute"}
    assert items["Item.Bolt"]["rawDefinition"]["parent"]=="Item.Arrow"
    assert "sprite" not in items["Item.Bolt"]["rawDefinition"]
    recipes={record["id"]:record for record in survey["recipes"]}
    assert recipes["Recipe.BowString"]["inputs"]==[{"item":"Item.Thread","count":2}]
    assert recipes["Recipe.Bow"]["inputs"]==[{"item":"Item.Wood","count":3},{"item":"Item.Thread","count":3}]
    palette=json.loads((ART/"ashveil-bow-palette.json").read_text())
    allowed={bytes.fromhex(value.removeprefix("#"))+b"\xff" for value in palette.values()}
    assert len(palette)==19
    bounds={};hashes=[];previews=[]
    for key in keys:
        name="ashveil-"+key.replace("_","-");sprite="original_"+key
        assert fragment["sheets"][sprite]==f"sprites/original/items/{name}.png"
        assert fragment["frames"][sprite]==[sprite,0,0,32,32]
        width,height,pixels=read_png(ART/(name+".png"));assert (width,height)==(32,32)
        assert svg_pixels(ART/(name+".svg"),32,32)==pixels
        occupied=[(x,y) for y in range(32) for x in range(32) if pixels[(y*32+x)*4+3]]
        assert occupied and all(0<x<31 and 0<y<31 for x,y in occupied)
        colors={pixels[index:index+4] for index in range(0,len(pixels),4) if pixels[index+3]}
        assert colors<=allowed and set(pixels[3::4])=={0,255}
        bounds[key]=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        assert bounds[key]==source["opaqueBounds"][key]
        sw,sh,small=read_png(ART/(name+"-16.png"));assert (sw,sh)==(16,16)
        expected=b"".join(pixels[((2*y+1)*32+2*x+1)*4:((2*y+1)*32+2*x+2)*4] for y in range(16) for x in range(16))
        assert small==expected
        hashes.append(hashlib.sha256(pixels).hexdigest())
        previews.append({"sprite":sprite,"opaquePixels32":len(occupied),"opaquePixels16":sum(1 for alpha in small[3::4] if alpha)})
    assert len(set(hashes))==2
    cw,ch,_=read_png(ART/"ashveil-bow-contact.png");assert (cw,ch)==(384,376)
    assert hashlib.sha256((ROOT/source["source"]).read_bytes()).hexdigest()==source["sourceSha256"]
    for record in source["files"]:
        data=(ROOT/record["file"]).read_bytes()
        assert len(data)==record["bytes"] and hashlib.sha256(data).hexdigest()==record["sha256"]
    print(json.dumps({"result":"PASS","scope":"isolated original bow equipment; no game/import/mod/browser/GPU/project tests","nativeSize":[32,32],"smallSize":[16,16],"pngSvgPixelPairs":2,"pngCrcAndSingleTerminalIend":True,"alphaValues":[0,255],"paletteColors":19,"twoUniqueImages":True,"targetDescendants":0,"sharedConsumersAfterSpriteFieldPatches":{key:len(value) for key,value in shared.items()},"existingArrowQuiverCrossbowBoltSpritePreservedByProposal":True,"license":"CC0-1.0","bounds":bounds,"previews":previews,"sourceFilesVerified":len(source["files"]),"sourceShaVerified":True},ensure_ascii=False,indent=2))


if __name__=="__main__":main()
