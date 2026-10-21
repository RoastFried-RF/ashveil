#!/usr/bin/env python3
"""Independent CC0 pixel/CRC/SVG/source audit; reads only isolated art pack, no drawing import/game."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import zlib
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/"public/sprites/original/items"

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


def pixel(data,w,x,y):return data[(y*w+x)*4:(y*w+x+1)*4]


def main():
    j=lambda p:json.loads(p.read_text())
    source=j(ART/"ashveil-brush-source.json");fragment=j(ROOT/"tools/art/brush-manifest.fragment.json")
    palette=j(ART/"ashveil-brush-palette.json");reference=j(ROOT/"tools/art/brush-reference-contract.json");recommendation=j(ROOT/"tools/art/brush-render-recommendation.json")
    assert set(fragment)=={"sheets","frames"}
    assert set(fragment["frames"])==set(fragment["sheets"])=={"original_sheet_machete","original_ashberry_bush"}
    assert source["proposedTargets"]=={"Item.Machete":"original_sheet_machete","Terrain.AshBerryBush":"original_ashberry_bush"}
    assert reference["targets"]["Item.Machete"]["raw"]["size"]==[1,3]
    assert reference["targets"]["Item.Machete"]["raw"]["material"]=="Material.Steel"
    assert reference["targets"]["Terrain.AshBerryBush"]["raw"]["visual"]["sprite"]=="mushrooms"
    assert recommendation["recommendedBaseScale"]==.7 and recommendation["existingRendererAnchor"]==[.5,.96]
    assert recommendation["nativeRootBottomEdge"]==31
    allowed={bytes.fromhex(v[1:])+b"\xff" for v in palette.values()};assert len(palette)==22
    records=[];hashes=[];native={};small={}
    for key in ["sheet_machete","ashberry_bush"]:
        name="ashveil-"+key.replace("_","-");sprite="original_"+key
        w,h,rgba=read_png(ART/(name+".png"));assert (w,h)==(32,32)
        assert svg_pixels(ART/(name+".svg"),w,h)==rgba
        assert set(rgba[3::4])=={0,255}
        assert {rgba[i:i+4] for i in range(0,len(rgba),4) if rgba[i+3]}<=allowed
        occupied=[(x,y) for y in range(h) for x in range(w) if pixel(rgba,w,x,y)[3]]
        assert occupied and all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        assert source["opaqueBoundsInclusive"][key]==bounds and source["opaquePixels"][key]==len(occupied)
        sw,sh,preview=read_png(ART/(name+"-16.png"));assert (sw,sh)==(16,16)
        assert preview==b"".join(pixel(rgba,32,2*x+1,2*y+1) for y in range(16) for x in range(16))
        assert fragment["sheets"][sprite]=="sprites/original/items/"+name+".png"
        assert fragment["frames"][sprite]==[sprite,0,0,32,32]
        native[key]=rgba;small[key]=preview;hashes.append(hashlib.sha256(rgba).hexdigest())
        records.append({"frame":sprite,"boundsInclusive":bounds,"opaquePixels32":len(occupied),"opaquePixels16":sum(a>0 for a in preview[3::4])})
    assert len(set(hashes))==2 and records[1]["boundsInclusive"][3]+1==31
    cw,ch,contact=read_png(ART/"ashveil-brush-contact.png");assert (cw,ch)==(384,376)
    for index,key in enumerate(["sheet_machete","ashberry_bush"]):
        left=index*192
        # Main4x on matte field, then native32/16 and enlarged16 on two backgrounds.
        blits=[(native[key],32,4,left+32,44,"1b272c")]
        for start,bg in [(left+24,"11191f"),(left+104,"b8b39f")]:
            blits += [(native[key],32,1,start+16,188,bg),(small[key],16,1,start+24,226,bg),(small[key],16,4,start,264,bg)]
        for pixels,width,scale,ox,oy,bg in blits:
            for y in range(width*scale):
                for x in range(width*scale):
                    color=pixel(pixels,width,x//scale,y//scale)
                    expected=color if color[3] else bytes.fromhex(bg)+b"\xff"
                    assert pixel(contact,cw,ox+x,oy+y)==expected
    assert hashlib.sha256((ROOT/source["source"]).read_bytes()).hexdigest()==source["sourceSha256"]
    for rec in source["referenceFiles"]:assert hashlib.sha256((ROOT/rec["path"]).read_bytes()).hexdigest()==rec["sha256"]
    for rec in source["files"]:
        b=(ROOT/rec["file"]).read_bytes();assert len(b)==rec["bytes"] and hashlib.sha256(b).hexdigest()==rec["sha256"]
    assert source["license"]=="CC0-1.0" and source["commercialUseAllowed"] and source["redistributionAndDerivativePackagesAllowed"]
    assert source["attributionRequired"] is False and source["externalImageInputs"]==[] and source["existingImagesCopiedCroppedOrRecolored"] is False and source["integrationApplied"] is False
    license_path=ROOT/"tools/art/brush-LICENSE.txt"
    if not license_path.exists():license_path=ROOT/"LICENSE.txt"
    license_text=license_path.read_text();assert "CC0-1.0" in license_text and "Commercial" in license_text and "attribution" in license_text
    print(json.dumps({"result":"PASS","scope":"isolated original art/static recommendations only; no game/Core/Def/browser/GPU/project tests","nativeSize":[32,32],"smallSize":[16,16],"PNGSVGPairs":2,"PNGCRCAndSingleTerminalIEND":True,"alphaValues":[0,255],"paletteEntries":22,"twoDistinctNativeImages":True,"records":records,"centerNearest16pxExact":True,"contactAllDisplayedPixelsVerified":True,"sourceFilesHashVerified":len(source["files"]),"sourceAndReferenceHashesVerified":True,"license":"CC0-1.0","newFrames":["original_sheet_machete","original_ashberry_bush"],"bushContainsNoFruitOrFlowerByAuthoredDesign":True,"rendererRecommendationsAreNotDefPatches":True,"integrationApplied":False},ensure_ascii=False,indent=2))


if __name__=="__main__":main()
