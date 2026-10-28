#!/usr/bin/env python3
"""Independent, standard-library-only validation of the isolated forest art pack.

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


def crop(data,width,x,y,w,h):
    return b"".join(data[((y+row)*width+x)*4:((y+row)*width+x+w)*4] for row in range(h))


def main():
    source=json.loads((ART/"ashveil-forest-source.json").read_text())
    survey=json.loads((ROOT/"tools/art/forest-usage-survey.json").read_text())
    fragment=json.loads((ROOT/"tools/art/forest-manifest.fragment.json").read_text())
    assert set(fragment)=={"sheets","frames"}
    assert set(fragment["sheets"])=={"original_forest_pine","original_forest_dead"}
    assert set(fragment["frames"])=={"original_pine_tree","original_dead_tree"}
    assert source["integrationApplied"] is False and survey["applied"] is False
    assert all(value[3:]==[80,96] for value in survey["oldFrames"].values())
    assert source["anchor"]==[.5,.96] and source["nativeAnchorPixel"]==[40,92.16]
    assert abs(.96*96-92.16)<1e-10
    assert source["groundLastOpaqueRow"]==91 and source["groundBoundary"]==92
    assert source["fixedGroundShadow"] is False and source["stateMarkers"]==[]
    expected_consumers={"Terrain.Tree","Terrain.PineTree","Terrain.BlackwoodTree","Item.Wood","Item.PegLeg","Item.CampfireKit","Item.WhitecapCulture"}
    assert {record["id"] for record in survey["spriteConsumers"]}==expected_consumers
    palette=json.loads((ART/"ashveil-forest-palette.json").read_text())
    allowed={bytes.fromhex(value.removeprefix("#"))+b"\xff" for value in palette.values()}
    cw,ch,contact=read_png(ART/"ashveil-forest-contact.png");assert (cw,ch)==(768,472)
    report=[]
    for index,key in enumerate(["pine_tree","dead_tree"]):
        stem="ashveil-"+key.replace("_","-")
        w,h,pixels=read_png(ART/(stem+".png"));assert (w,h)==(80,96)
        assert svg_pixels(ART/(stem+".svg"),w,h)==pixels
        assert set(pixels[3::4])=={0,255}
        assert {pixels[i:i+4] for i in range(0,len(pixels),4) if pixels[i+3]}<=allowed
        occupied=[(x,y) for y in range(h) for x in range(w) if pixels[(y*w+x)*4+3]]
        assert occupied and all(0<x<79 and 0<y<95 for x,y in occupied)
        bounds=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        assert bounds==source["opaqueBounds"][key] and bounds[3]==91
        assert bounds[3]-bounds[1]+1==source["nativeObjectHeights"][key]
        assert not any(pixels[(y*w+x)*4+3] for y in range(92,96) for x in range(w))
        rw,rh,small=read_png(ART/(stem+"-map-review.png"));assert (rw,rh)==(34,40)
        expected=b"".join(pixels[(min(95,int((y+.5)/.42))*80+min(79,int((x+.5)/.42)))*4:(min(95,int((y+.5)/.42))*80+min(79,int((x+.5)/.42))+1)*4] for y in range(rh) for x in range(rw))
        assert small==expected
        sheet="original_forest_"+("pine" if key=="pine_tree" else "dead")
        assert fragment["sheets"][sheet]==f"sprites/original/{stem}.png"
        assert fragment["frames"]["original_"+key]==[sheet,0,0,80,96]
        # Rebuild contact foreground expectations without importing the drawing tool.
        bg=bytes.fromhex("22302e")+b"\xff";left=index*384
        for ox,oy,scale,mode,raw,width,height in [(left+112,42,2,"direct",pixels,w,h),(left+28,264,1,"direct",pixels,w,h),(left+124,264,1,"mirror",pixels,w,h),(left+234,264,4,"direct",small,rw,rh)]:
            for y in range(height):
                for x in range(width):
                    px=width-1-x if mode=="mirror" else x
                    value=raw[(y*width+px)*4:(y*width+px+1)*4]
                    if not value[3]:value=bg
                    for dy in range(scale):
                        for dx in range(scale):
                            at=((oy+y*scale+dy)*cw+ox+x*scale+dx)*4
                            assert contact[at:at+4]==value
        report.append({"frame":"original_"+key,"size":[w,h],"opaqueBounds":bounds,"nativeHeight":bounds[3]-bounds[1]+1,"rootLastOpaqueY":91,"groundBoundary":92,"anchorPixel":[40,92.16],"anchorToBoundaryGap":.16,"pngSVGEveryPixelMatches":True,"binaryAlpha":True,"paletteOnly":True,"mirrorAndContactPanelsMatchRawPixels":True,"nearestMapReviewSize":[rw,rh],"nearestMapReviewMatchesSourceCentres":True,"opaquePixels":len(occupied),"sha256":hashlib.sha256((ART/(stem+".png")).read_bytes()).hexdigest()})
    assert hashlib.sha256((ROOT/source["source"]).read_bytes()).hexdigest()==source["sourceSha256"]
    for record in source["files"]:
        data=(ROOT/record["file"]).read_bytes()
        assert len(data)==record["bytes"] and hashlib.sha256(data).hexdigest()==record["sha256"]
    print(json.dumps({"result":"PASS","scope":"isolated two-kind forest original art; no game/import/browser/GPU/project tests","paletteColors":len(palette),"alphaValues":[0,255],"contactSize":[cw,ch],"actualSharedConsumers":sorted(expected_consumers),"nativeFrames":report,"sourceHashesMatch":True,"mapReviewNote":"Nearest-pixel illustrative .42-scale preview, not actual GPU rendering."},ensure_ascii=False,indent=2))


if __name__=="__main__":main()
