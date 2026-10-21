#!/usr/bin/env python3
"""독립 귀리 PNG/CRC/SVG/메타데이터 검사. 제작기와 게임을 import하지 않는다."""
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
    j=lambda path:json.loads(path.read_text())
    source=j(ART/"ashveil-oat-source.json")
    reference=j(ROOT/"tools/art/oat-reference-contract.json")
    fragment=j(ROOT/"tools/art/oat-manifest.fragment.json")
    palette=j(ART/"ashveil-oat-palette.json")
    states=["oats","oat_seed"]
    names=["ashveil-hearth-oats","ashveil-hearth-oat-seed"]
    keys=["original_hearth_oats","original_hearth_oat_seed"]
    assert source["keys"]==keys and source["stateOrder"]==states
    assert source["proposedTargets"]==reference["proposedPublicKeys"]==dict(zip(["Item.Oats","Item.OatSeed"],keys))
    assert set(fragment)=={"sheets","frames"}
    assert set(fragment["sheets"])==set(fragment["frames"])==set(keys)
    assert source["nativeSize"]==reference["nativeSize"]==[32,32]
    assert source["smallSize"]==reference["smallPreviewSize"]==[16,16]
    assert source["groundBottomEdge"]==reference["sharedArtGroundBottomEdge"]==30
    assert source["optionalArtFootPoint"]==reference["optionalArtFootPoint"]==[16,30]
    defs={value["id"]:value for value in reference["rawTargets"]}
    assert set(defs)=={"Item.Oats","Item.OatSeed"}
    for value in defs.values():
        assert value["sprite"]=="ash_cap" and value["size"]==[1,1]
        assert value["maxStack"]==5 and value["stackable"] and value["category"]=="misc"
        assert "food" not in value
    assert "place" not in defs["Item.Oats"]
    assert defs["Item.OatSeed"]["place"]=="Terrain.OatPlot"
    assert reference["newKeysAbsentInCapturedRootManifest"] is True
    assert reference["visualOnly"] and source["otherFoodOrPouchGeometryReused"] is False
    assert len(palette)==18 and len(set(palette.values()))==18
    allowed={bytes.fromhex(value[1:])+b"\xff" for value in palette.values()}
    bag={bytes.fromhex(palette[key][1:])+b"\xff" for key in "dtml"}
    grain={bytes.fromhex(palette[key][1:])+b"\xff" for key in "nshf"}
    native={};small={};records=[]
    for state,name,key in zip(states,names,keys):
        width,height,pixels=read_png(ART/(name+".png"));assert (width,height)==(32,32)
        assert svg_pixels(ART/(name+".svg"),width,height)==pixels
        assert set(pixels[3::4])=={0,255}
        assert {pixels[i:i+4] for i in range(0,len(pixels),4) if pixels[i+3]}<=allowed
        occupied=[(x,y) for y in range(32) for x in range(32) if pixel(pixels,32,x,y)[3]]
        assert occupied and all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        assert source["opaqueBoundsInclusive"][state]==bounds and source["opaquePixels"][state]==len(occupied)
        assert bounds[3]+1==30
        sw,sh,preview=read_png(ART/(name+"-16.png"));assert (sw,sh)==(16,16)
        assert preview==b"".join(pixel(pixels,32,2*x+1,2*y+1) for y in range(16) for x in range(16))
        assert fragment["sheets"][key]=="sprites/original/items/"+name+".png"
        assert fragment["frames"][key]==[key,0,0,32,32]
        bag_count=sum(pixel(pixels,32,x,y) in bag for y in range(32) for x in range(32))
        grain_count=sum(pixel(pixels,32,x,y) in grain for y in range(32) for x in range(32))
        if state=="oats":
            assert bag_count==0 and grain_count>0
            assert any(pixel(preview,16,x,y) in grain for y in range(10,15) for x in range(2,12))
        else:
            assert bag_count>grain_count>0
            assert any(pixel(preview,16,x,y) in bag for y in range(7,14) for x in range(4,13))
        native[state]=pixels;small[state]=preview
        records.append({"key":key,"boundsInclusive":bounds,"opaqueWidth":bounds[2]-bounds[0]+1,"opaqueHeight":bounds[3]-bounds[1]+1,"opaquePixels32":len(occupied),"opaquePixels16":sum(alpha>0 for alpha in preview[3::4]),"clothPalettePixels32":bag_count,"grainPalettePixels32":grain_count,"pngSHA256":hashlib.sha256((ART/(name+".png")).read_bytes()).hexdigest()})
    assert native["oats"]!=native["oat_seed"] and small["oats"]!=small["oat_seed"]
    assert records[1]["opaquePixels32"]>records[0]["opaquePixels32"]
    # Independently reconstruct the whole label-free contact, backgrounds too.
    cw,ch,contact=read_png(ART/"ashveil-oat-contact.png");assert (cw,ch)==(384,352)
    expected=bytearray((bytes.fromhex("11191f")+b"\xff")*cw*ch)
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
    for index,state in enumerate(states):
        left=index*192;rect(left+8,8,176,336,"1b272c")
        blit(native[state],32,4,left+32,20)
        for start,bg in [(left+24,"11191f"),(left+104,"b8b39f")]:
            rect(start,168,64,80,bg);blit(native[state],32,1,start+16,172)
            blit(small[state],16,1,start+24,226)
            rect(start,264,64,64,bg);blit(small[state],16,4,start,264)
    assert bytes(expected)==contact
    assert hashlib.sha256((ROOT/source["source"]).read_bytes()).hexdigest()==source["sourceSha256"]
    assert hashlib.sha256((ROOT/source["referenceContract"]).read_bytes()).hexdigest()==source["referenceContractSha256"]
    for record in source["files"]:
        data=(ROOT/record["file"]).read_bytes()
        assert len(data)==record["bytes"] and hashlib.sha256(data).hexdigest()==record["sha256"]
    assert len(source["files"])==9
    assert source["license"]=="CC0-1.0" and source["commercialUseAllowed"] and source["redistributionAndDerivativePackagesAllowed"]
    assert source["attributionRequired"] is False and source["externalImageInputs"]==[]
    assert source["existingImagesCopiedEditedOrRecolored"] is False
    assert source["integrationApplied"] is reference["integrationApplied"] is False
    assert source["noRenderedTextDigitsOrSymbols"] is True
    license_path=ROOT/"tools/art/oat-LICENSE.txt"
    if not license_path.exists():license_path=ROOT/"LICENSE.txt"
    text=license_path.read_text()
    assert "CC0-1.0" in text and "Commercial" in text and "attribution" in text
    print(json.dumps({"result":"PASS","scope":"격리 귀리 원본·캡처된 원문 맥락 검사만. 게임/Core/Def/브라우저/GPU/프로젝트 검사 미실행.","newKeys":keys,"nativeSize":[32,32],"smallSize":[16,16],"PNGSVGPairs":2,"PNGCount":5,"PNGCRCAndSingleTerminalIEND":True,"RGBA8":True,"alphaValues":[0,255],"paletteEntries":18,"transparentMargins":True,"distinctNativeAndSmallImages":True,"records":records,"sharedGroundBottomEdge":30,"optionalArtFootPoint":[16,30],"cookingGrainAndSeedPouchSeparatedByGeometryAndMaterial":True,"grainAndClothVisibleAt16px":True,"centerNearest16pxExact":True,"wholeContactPixelsVerifiedIncludingNoLabelAreas":True,"sourceFilesHashVerified":9,"sourceAndReferenceHashesVerified":True,"capturedDefinitionsNotRuntimeDefDB":True,"license":"CC0-1.0","integrationApplied":False},ensure_ascii=False,indent=2))


if __name__=="__main__":main()
