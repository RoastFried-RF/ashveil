#!/usr/bin/env python3
"""독립 생활재료 PNG/CRC/SVG 픽셀 검사. 제작기/게임 import 없음."""
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
    j=lambda path:json.loads(path.read_text());states=["wood","iron_scrap","thread","leather","charcoal"]
    ids=["Item.Wood","Item.IronScrap","Item.Thread","Item.Leather","Item.Charcoal"];keys=["original_hearth_"+s for s in states]
    source=j(ART/"ashveil-material-source.json");palette=j(ART/"ashveil-material-palette.json")
    reference=j(ROOT/"tools/art/material-reference-contract.json");fragment=j(ROOT/"tools/art/material-manifest.fragment.json")
    assert len(palette)==len(set(palette.values()))==24
    assert source["keys"]==keys and source["stateOrder"]==states
    assert source["proposedTargets"]==reference["proposedPublicKeys"]==dict(zip(ids,keys))
    assert set(fragment)=={"sheets","frames"} and set(fragment["sheets"])==set(fragment["frames"])==set(keys)
    raw={v["id"]:v for v in reference["rawTargets"]};assert set(raw)==set(ids)
    for item,size,stack,sprite in zip(ids,[[1,3],[1,2],[1,1],[2,2],[1,1]],[3,5,5,3,5],["stump","pipe_club","cloth","leather_coat","bones"]):
        assert raw[item]["size"]==size and raw[item]["maxStack"]==stack and raw[item]["stackable"] is True
        assert raw[item]["sprite"]==sprite and raw[item]["category"]=="misc"
    assert raw["Item.Thread"]["medical"]=={"kind":"suture","tool":0}
    assert reference["newKeysAbsentInCapturedManifest"] is True
    allowed={bytes.fromhex(value[1:])+b"\xff" for value in palette.values()}
    groupkeys={"wood":"rnsh","iron_scrap":"aqfdtm","thread":"cpil","leather":"gjez","charcoal":"kuvw"}
    native={};small={};records=[]
    for state,key in zip(states,keys):
        name="ashveil-hearth-"+state.replace("_","-")
        w,h,pixels=read_png(ART/(name+".png"));assert (w,h)==(32,32)
        assert svg_pixels(ART/(name+".svg"),32,32)==pixels
        assert set(pixels[3::4])=={0,255}
        colors={pixels[i:i+4] for i in range(0,len(pixels),4) if pixels[i+3]};assert colors<=allowed
        occupied=[(x,y) for y in range(32) for x in range(32) if pixel(pixels,32,x,y)[3]]
        assert all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        assert source["opaqueBoundsInclusive"][state]==bounds and source["opaquePixels"][state]==len(occupied)
        assert bounds[3]+1==source["groundBottomEdge"]==reference["groundBottomEdge"]==30
        assert source["optionalArtFootPoint"]==reference["sharedArtFootPoint"]==[16,30]
        sw,sh,preview=read_png(ART/(name+"-16.png"));assert (sw,sh)==(16,16)
        assert preview==b"".join(pixel(pixels,32,2*x+1,2*y+1) for y in range(16) for x in range(16))
        group={bytes.fromhex(palette[c][1:])+b"\xff" for c in groupkeys[state]}
        assert any(pixel(preview,16,x,y) in group for y in range(16) for x in range(16))
        if state=="charcoal":assert colors<={bytes.fromhex(palette[c][1:])+b"\xff" for c in "okduvw"}
        assert fragment["sheets"][key]=="sprites/original/items/"+name+".png" and fragment["frames"][key]==[key,0,0,32,32]
        native[state]=pixels;small[state]=preview
        records.append({"key":key,"boundsInclusive":bounds,"opaqueWidth":bounds[2]-bounds[0]+1,"opaqueHeight":bounds[3]-bounds[1]+1,"opaquePixels32":len(occupied),"opaquePixels16":sum(a>0 for a in preview[3::4]),"pngSHA256":hashlib.sha256((ART/(name+".png")).read_bytes()).hexdigest()})
    assert len(set(native.values()))==len(set(small.values()))==5
    cw,ch,contact=read_png(ART/"ashveil-material-contact.png");assert (cw,ch)==(960,352)
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
    assert len(source["files"])==18
    assert hashlib.sha256((ROOT/source["source"]).read_bytes()).hexdigest()==source["sourceSha256"]
    assert hashlib.sha256((ROOT/source["referenceContract"]).read_bytes()).hexdigest()==source["referenceContractSha256"]
    assert source["existingItemGeometryReused"] is False and source["existingImagesCopiedEditedOrRecolored"] is False and source["externalImageInputs"]==[]
    assert source["integrationApplied"] is reference["integrationApplied"] is False
    assert source["license"]=="CC0-1.0" and source["commercialUseAllowed"] and source["redistributionAndDerivativePackagesAllowed"] and source["attributionRequired"] is False
    assert source["noToolGearOrLargeQuantityStateMarksByDesign"] and source["noCharcoalEmberOrHeatMarks"]
    licensepath=ROOT/"tools/art/material-LICENSE.txt"
    if not licensepath.exists():licensepath=ROOT/"LICENSE.txt"
    assert "CC0-1.0" in licensepath.read_text()
    print(json.dumps({"result":"PASS","scope":"격리 원재료5종 아트 정적 검사만. 제작/재고/의료/게임 규칙 미검증.","keys":keys,"nativeSize":[32,32],"smallSize":[16,16],"PNGSVGPairs":5,"PNGCount":11,"CRCAndTerminalIEND":True,"RGBA8":True,"paletteEntries":24,"alphaValues":[0,255],"transparentMargins":True,"records":records,"groundBottomEdge":30,"optionalArtFootPoint":[16,30],"distinctNativeAnd16Images":True,"centerNearest16Exact":True,"materialColorFamiliesVisibleAt16":True,"charcoalHasNoWarmEmberColors":True,"wholeContactPixelsExact":True,"sourceHashesVerified":18,"generatorAndContractHashesVerified":True,"capturedRawDefsNotRuntimeDB":True,"license":"CC0-1.0","integrationApplied":False},ensure_ascii=False,indent=2))


if __name__=="__main__":main()
