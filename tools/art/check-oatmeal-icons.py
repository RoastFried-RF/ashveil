#!/usr/bin/env python3
"""독립 도기/귀리죽 픽셀 검사. 제작기/게임 import 없음."""
from __future__ import annotations
import hashlib,json,struct,zlib
from pathlib import Path
import xml.etree.ElementTree as ET
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
    j=lambda p:json.loads(p.read_text());states=["bowl","raw_oatmeal","oatmeal"]
    keys=["original_hearth_"+s for s in states]
    source=j(ART/"ashveil-oatmeal-source.json");palette=j(ART/"ashveil-oatmeal-palette.json")
    reference=j(ROOT/"tools/art/oatmeal-reference-contract.json");fragment=j(ROOT/"tools/art/oatmeal-manifest.fragment.json")
    assert len(palette)==len(set(palette.values()))==19
    assert source["keys"]==keys and source["stateOrder"]==states
    assert source["proposedTargets"]==reference["proposedPublicKeys"]==dict(zip(["Item.Bowl","Item.UnheatedOatmealBowl","Item.OatmealBowl"],keys))
    assert set(fragment)=={"sheets","frames"} and set(fragment["sheets"])==set(fragment["frames"])==set(keys)
    defs={value["id"]:value for value in reference["rawTargets"]}
    assert set(defs)=={"Item.Bowl","Item.UnheatedOatmealBowl","Item.OatmealBowl"}
    for value in defs.values():assert value["size"]==[1,1] and value["maxStack"]==1 and value["stackable"] is False
    assert defs["Item.Bowl"]["sprite"]==defs["Item.UnheatedOatmealBowl"]["sprite"]=="pot0"
    assert defs["Item.OatmealBowl"]["sprite"]=="pot1"
    assert "food" not in defs["Item.Bowl"]
    for item in ["Item.UnheatedOatmealBowl","Item.OatmealBowl"]:assert defs[item]["food"]["emptyVessel"]=="Item.Bowl"
    assert defs["Item.UnheatedOatmealBowl"]["food"]["raw"] and defs["Item.UnheatedOatmealBowl"]["cooking"]=={"result":"Item.OatmealBowl","turns":400}
    assert defs["Item.OatmealBowl"]["food"]["cooked"]
    assert reference["newKeysAbsentInCapturedManifest"] and reference["sameAlphaSilhouetteAcrossStates"]
    assert source["sameBowlOutsideContentRegionXYXY"]==reference["sameBowlOutsideContentRegionXYXY"]==[4,8,28,18]
    assert source["sharedGroundBottomEdge"]==reference["sharedGroundBottomEdge"]==30
    assert source["sharedArtFootPoint"]==reference["sharedArtFootPoint"]==[16,30]
    assert source["noSteamTemperatureSafetyOrContaminationMarks"] and source["newPaletteAndGeometry"]
    allowed={bytes.fromhex(value[1:])+b"\xff" for value in palette.values()}
    watery={bytes.fromhex(palette[c][1:])+b"\xff" for c in "dtmwgf"}
    thick={bytes.fromhex(palette[c][1:])+b"\xff" for c in "cpil"}
    native={};small={};records=[]
    for state,key in zip(states,keys):
        name="ashveil-hearth-"+state.replace("_","-")
        w,h,pixels=read_png(ART/(name+".png"));assert (w,h)==(32,32)
        assert svg_pixels(ART/(name+".svg"),32,32)==pixels
        assert set(pixels[3::4])=={0,255}
        assert {pixels[i:i+4] for i in range(0,len(pixels),4) if pixels[i+3]}<=allowed
        occupied=[(x,y) for y in range(32) for x in range(32) if pixel(pixels,32,x,y)[3]]
        assert all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        assert source["opaqueBoundsInclusive"][state]==bounds and source["opaquePixels"][state]==len(occupied)
        assert bounds[3]+1==30
        sw,sh,preview=read_png(ART/(name+"-16.png"));assert (sw,sh)==(16,16)
        assert preview==b"".join(pixel(pixels,32,2*x+1,2*y+1) for y in range(16) for x in range(16))
        assert fragment["sheets"][key]=="sprites/original/items/"+name+".png" and fragment["frames"][key]==[key,0,0,32,32]
        wc=sum(pixel(pixels,32,x,y) in watery for y in range(32) for x in range(32))
        tc=sum(pixel(pixels,32,x,y) in thick for y in range(32) for x in range(32))
        if state=="bowl":assert wc==tc==0
        elif state=="raw_oatmeal":assert wc>0 and tc==0 and any(pixel(preview,16,x,y) in watery for y in range(16) for x in range(16))
        else:assert tc>0 and wc==0 and any(pixel(preview,16,x,y) in thick for y in range(16) for x in range(16))
        native[state]=pixels;small[state]=preview
        records.append({"key":key,"boundsInclusive":bounds,"opaqueWidth":bounds[2]-bounds[0]+1,"opaqueHeight":bounds[3]-bounds[1]+1,"opaquePixels32":len(occupied),"opaquePixels16":sum(a>0 for a in preview[3::4]),"wateryPalettePixels32":wc,"thickPalettePixels32":tc,"pngSHA256":hashlib.sha256((ART/(name+".png")).read_bytes()).hexdigest()})
    assert len({pixels[3::4] for pixels in native.values()})==1
    assert len(set(native.values()))==len(set(small.values()))==3
    outside=0
    for y in range(32):
        for x in range(32):
            if 4<=x<28 and 8<=y<18:continue
            assert len({pixel(native[s],32,x,y) for s in states})==1;outside+=1
    cw,ch,contact=read_png(ART/"ashveil-oatmeal-contact.png");assert (cw,ch)==(576,352)
    expected=bytearray((bytes.fromhex("11191f")+b"\xff")*cw*ch)
    def rect(ox,oy,w,h,c):
        row=(bytes.fromhex(c)+b"\xff")*w
        for y in range(oy,oy+h):
            start=(y*cw+ox)*4;expected[start:start+w*4]=row
    def blit(data,width,scale,ox,oy):
        for y in range(width*scale):
            for x in range(width*scale):
                c=pixel(data,width,x//scale,y//scale)
                if c[3]:
                    start=((oy+y)*cw+ox+x)*4;expected[start:start+4]=c
    for index,state in enumerate(states):
        left=index*192;rect(left+8,8,176,336,"1b272c");blit(native[state],32,4,left+32,20)
        for start,bg in [(left+24,"11191f"),(left+104,"b8b39f")]:
            rect(start,168,64,80,bg);blit(native[state],32,1,start+16,172);blit(small[state],16,1,start+24,226)
            rect(start,264,64,64,bg);blit(small[state],16,4,start,264)
    assert bytes(expected)==contact
    for record in source["files"]:
        data=(ROOT/record["file"]).read_bytes();assert len(data)==record["bytes"] and hashlib.sha256(data).hexdigest()==record["sha256"]
    assert len(source["files"])==12
    assert hashlib.sha256((ROOT/source["source"]).read_bytes()).hexdigest()==source["sourceSha256"]
    assert hashlib.sha256((ROOT/source["referenceContract"]).read_bytes()).hexdigest()==source["referenceContractSha256"]
    assert source["otherFoodOrBowlGeometryReused"] is False and source["existingImagesCopiedEditedOrRecolored"] is False and source["externalImageInputs"]==[]
    assert source["integrationApplied"] is reference["integrationApplied"] is False
    assert source["license"]=="CC0-1.0" and source["commercialUseAllowed"] and source["redistributionAndDerivativePackagesAllowed"] and source["attributionRequired"] is False
    licensepath=ROOT/"tools/art/oatmeal-LICENSE.txt"
    if not licensepath.exists():licensepath=ROOT/"LICENSE.txt"
    assert "CC0-1.0" in licensepath.read_text()
    print(json.dumps({"result":"PASS","scope":"격리 도기/귀리죽 원본 정적 검사만; 실제 조리·게임 상태 검증 아님","keys":keys,"nativeSize":[32,32],"smallSize":[16,16],"PNGSVGPairs":3,"PNGCount":7,"CRCAndTerminalIEND":True,"RGBA8":True,"paletteEntries":19,"alphaValues":[0,255],"sameAlphaSilhouetteAcrossThreeStates":True,"outsideContentRegionXYXY":[4,8,28,18],"identicalPixelsOutsideContentRegion":outside,"groundBottomEdge":30,"sharedArtFootPoint":[16,30],"records":records,"distinctNativeAnd16Images":True,"centerNearest16Exact":True,"wholeContactPixelsExact":True,"sourceHashesVerified":12,"generatorAndContractHashesVerified":True,"noSteamOrTemperatureSafetyContaminationSymbolsByDesign":True,"license":"CC0-1.0","integrationApplied":False},ensure_ascii=False,indent=2))


if __name__=="__main__":main()
