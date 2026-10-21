#!/usr/bin/env python3
"""Independent pantry pixel/PNG/SVG audit; never imports the drawing tool or game."""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import zlib
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/"public/sprites/original/ui"

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
    j=lambda path:json.loads(path.read_text())
    source=j(ART/"ashveil-pantry-source.json")
    contract=j(ROOT/"tools/art/pantry-art-contract.json")
    fragment=j(ROOT/"tools/art/pantry-manifest.fragment.json")
    palette=j(ART/"ashveil-pantry-palette.json")
    states=["full","low","empty"]
    keys=["original_pantry_"+state for state in states]
    assert source["keys"]==contract["keys"]==keys
    assert contract["stateOrder"]==source["stateOrder"]==states
    assert contract["sharedFootPoint"]==source["sharedFootPoint"]==[16,30]
    assert contract["sharedGroundBottomEdge"]==source["groundBottomEdge"]==30
    assert contract["optionalAnchorMetadata"]==[.5,30/32]
    assert contract["sameContainerOutsideContentRegionXYXY"]==[4,8,28,20]
    assert source["sharedContainerOutsideContentRegionXYXY"]==[4,8,28,20]
    assert source["noRenderedTextDigitsOrSymbols"] is True
    assert contract["noTextOrDigitsInImagesOrContact"] is True
    assert set(fragment)=={"sheets","frames"}
    assert set(fragment["sheets"])==set(fragment["frames"])==set(keys)
    assert len(palette)==19
    allowed={bytes.fromhex(value.removeprefix("#"))+b"\xff" for value in palette.values()}
    native={};small={};records=[];cloth_counts=[]
    cloth={bytes.fromhex(palette[key][1:])+b"\xff" for key in ["p","h"]}
    for state in states:
        name="ashveil-pantry-"+state;key="original_pantry_"+state
        width,height,pixels=read_png(ART/(name+".png"))
        assert (width,height)==(32,32)
        assert svg_pixels(ART/(name+".svg"),width,height)==pixels
        assert set(pixels[3::4])=={0,255}
        assert {pixels[i:i+4] for i in range(0,len(pixels),4) if pixels[i+3]}<=allowed
        occupied=[(x,y) for y in range(32) for x in range(32) if pixel(pixels,32,x,y)[3]]
        assert all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        assert bounds==source["opaqueBoundsInclusive"][state]
        assert bounds[3]+1==30 and len(occupied)==source["opaquePixels"][state]
        assert fragment["sheets"][key]=="sprites/original/ui/"+name+".png"
        assert fragment["frames"][key]==[key,0,0,32,32]
        sw,sh,preview=read_png(ART/(name+"-16.png"));assert (sw,sh)==(16,16)
        assert preview==b"".join(pixel(pixels,32,2*x+1,2*y+1) for y in range(16) for x in range(16))
        native[state]=pixels;small[state]=preview
        cloth_count=sum(pixel(pixels,32,x,y) in cloth for y in range(8,20) for x in range(4,28))
        cloth_counts.append(cloth_count)
        records.append({"key":key,"boundsInclusive":bounds,"opaquePixels32":len(occupied),"opaquePixels16":sum(alpha>0 for alpha in preview[3::4]),"brightClothPixelsInContentRegion":cloth_count,"pngSHA256":hashlib.sha256((ART/(name+".png")).read_bytes()).hexdigest()})
    assert len({hashlib.sha256(v).hexdigest() for v in native.values()})==3
    assert len({hashlib.sha256(v).hexdigest() for v in small.values()})==3
    assert len({tuple(record["boundsInclusive"]) for record in records})==1
    assert cloth_counts[0]>cloth_counts[1]>cloth_counts[2]==0
    # This window contains contents only. All other basket/handle/base pixels
    # must stay byte-identical; actual economic thresholds are not encoded.
    outside=0
    for y in range(32):
        for x in range(32):
            if 4<=x<28 and 8<=y<20:continue
            assert len({pixel(native[state],32,x,y) for state in states})==1
            outside+=1
    for y in range(20,32):
        assert len({native[state][y*32*4:(y+1)*32*4] for state in states})==1
    cw,ch,contact=read_png(ART/"ashveil-pantry-contact.png");assert (cw,ch)==(576,352)
    # Reconstruct the whole contact independently: no labels, letters, digits,
    # logos or any other pixels may occur outside the declared review samples.
    field=bytes.fromhex("11191f")+b"\xff"
    expected=bytearray(field*cw*ch)
    def rect(ox,oy,w,h,color):
        row=(bytes.fromhex(color)+b"\xff")*w
        for y in range(oy,oy+h):
            start=(y*cw+ox)*4;expected[start:start+w*4]=row
    def blit(pixels,width,scale,ox,oy):
        for y in range(width*scale):
            for x in range(width*scale):
                color=pixel(pixels,width,x//scale,y//scale)
                if color[3]:
                    start=((oy+y)*cw+ox+x)*4;expected[start:start+4]=color
    for i,state in enumerate(states):
        left=i*192;rect(left+8,8,176,336,"1b272c")
        blit(native[state],32,4,left+32,20)
        for start,bg in [(left+24,"11191f"),(left+104,"b8b39f")]:
            rect(start,168,64,80,bg);blit(native[state],32,1,start+16,172)
            blit(small[state],16,1,start+24,226)
            rect(start,264,64,64,bg);blit(small[state],16,4,start,264)
    assert bytes(expected)==contact
    assert hashlib.sha256((ROOT/source["source"]).read_bytes()).hexdigest()==source["sourceSha256"]
    assert hashlib.sha256((ROOT/source["contract"]).read_bytes()).hexdigest()==source["contractSha256"]
    for record in source["files"]:
        data=(ROOT/record["file"]).read_bytes()
        assert len(data)==record["bytes"] and hashlib.sha256(data).hexdigest()==record["sha256"]
    assert len(source["files"])==12
    assert source["license"]=="CC0-1.0" and source["commercialUseAllowed"] and source["redistributionAndDerivativePackagesAllowed"]
    assert source["attributionRequired"] is False
    assert source["externalImageInputs"]==[] and source["existingImagesCopiedEditedOrRecolored"] is False
    assert source["integrationApplied"] is contract["integrationApplied"] is False
    license_path=ROOT/"tools/art/pantry-LICENSE.txt"
    if not license_path.exists():license_path=ROOT/"LICENSE.txt"
    license_text=license_path.read_text()
    assert "CC0-1.0" in license_text and "Commercial" in license_text and "attribution" in license_text
    print(json.dumps({"result":"PASS","scope":"isolated original art only; no economy/Core/Def/game/browser/GPU/project tests","newKeys":keys,"nativeSize":[32,32],"smallSize":[16,16],"PNGSVGPairs":3,"PNGCount":7,"PNGCRCAndSingleTerminalIEND":True,"RGBA8":True,"alphaValues":[0,255],"paletteEntries":19,"transparentMargins":True,"threeDistinctNativeAndSmallImages":True,"records":records,"sharedFootPoint":[16,30],"sharedGroundBottomEdge":30,"sameContainerOutsideContentRegionXYXY":[4,8,28,20],"identicalPixelsOutsideContentRegion":outside,"allBottom12RowsIdentical":True,"relativeBrightClothCountDescending":True,"centerNearest16pxExact":True,"wholeContactPixelsVerifiedIncludingNoLabelAreas":True,"sourceFilesHashVerified":12,"sourceAndContractHashesVerified":True,"license":"CC0-1.0","noEconomyThresholdsOrCountsEncoded":True,"integrationApplied":False},ensure_ascii=False,indent=2))


if __name__=="__main__":main()
