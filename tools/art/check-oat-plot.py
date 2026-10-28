#!/usr/bin/env python3
"""독립 원본 귀리밭 PNG/CRC/SVG 검사. 게임/제작기 import 없음."""
from __future__ import annotations
import hashlib,json,struct,zlib
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/"public/sprites/original/terrain"

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
    j=lambda p:json.loads(p.read_text());stem="ashveil-hearth-oat-plot";key="original_hearth_oat_plot"
    source=j(ART/(stem+"-source.json"));contract=j(ROOT/"tools/art/oat-plot-reference-contract.json")
    palette=j(ART/(stem+"-palette.json"));fragment=j(ROOT/"tools/art/oat-plot-manifest.fragment.json")
    assert len(palette)==18 and source["key"]==contract["key"]==key
    assert fragment=={"sheets":{key:"sprites/original/terrain/"+stem+".png"},"frames":{key:[key,0,0,32,32]}}
    w,h,pixels=read_png(ART/(stem+".png"));assert (w,h)==(32,32)
    assert svg_pixels(ART/(stem+".svg"),32,32)==pixels
    allowed={bytes.fromhex(c[1:])+b"\xff" for c in palette.values()}
    assert set(pixels[3::4])=={0,255}
    assert {pixels[i:i+4] for i in range(0,len(pixels),4) if pixels[i+3]}<=allowed
    occupied=[(x,y) for y in range(32) for x in range(32) if pixel(pixels,32,x,y)[3]]
    assert all(0<x<31 and 0<y<31 for x,y in occupied)
    bounds=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
    assert bounds==source["opaqueBoundsInclusive"] and len(occupied)==source["opaquePixels"]
    assert bounds[3]+1==source["groundBottomEdge"]==contract["sharedGroundBottomEdge"]==30
    assert source["optionalArtFootPoint"]==contract["optionalArtFootPoint"]==[16,30]
    assert source["rootedStemCountByDesign"]==3
    sw,sh,small=read_png(ART/(stem+"-16.png"));assert (sw,sh)==(16,16)
    assert small==b"".join(pixel(pixels,32,2*x+1,2*y+1) for y in range(16) for x in range(16))
    young=b"".join(pixel(pixels,32,(2*x+1)*32//38,(2*y+1)*32//38) for y in range(19) for x in range(19))
    straw={bytes.fromhex(palette[c][1:])+b"\xff" for c in "sh"}
    assert any(pixel(small,16,x,y) in straw for y in range(16) for x in range(16))
    assert any(pixel(young,19,x,y) in straw for y in range(19) for x in range(19))
    cw,ch,contact=read_png(ART/(stem+"-contact.png"));assert (cw,ch)==(384,352)
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
    for left in [0,192]:rect(left+8,8,176,336,"1b272c")
    blit(pixels,32,4,32,20);blit(young,19,4,224,72)
    for left in [0,192]:
        for start,bg in [(left+24,"11191f"),(left+104,"b8b39f")]:
            rect(start,168,64,80,bg)
            if left==0:blit(pixels,32,1,start+16,172)
            else:blit(young,19,1,start+22,184)
            blit(small,16,1,start+24,226);rect(start,264,64,64,bg);blit(small,16,4,start,264)
    assert bytes(expected)==contact
    for record in source["files"]:
        data=(ROOT/record["file"]).read_bytes()
        assert len(data)==record["bytes"] and hashlib.sha256(data).hexdigest()==record["sha256"]
    assert len(source["files"])==6
    assert hashlib.sha256((ROOT/source["source"]).read_bytes()).hexdigest()==source["sourceSha256"]
    assert hashlib.sha256((ROOT/source["referenceContract"]).read_bytes()).hexdigest()==source["referenceContractSha256"]
    assert contract["rawTerrain"]["id"]=="Terrain.OatPlot"
    assert contract["rawTerrain"]["visual"]=={"sprite":"mushrooms","scale":.3,"tint":11704912}
    assert contract["rendererObserved"]["anchor"]==[.5,.96] and contract["rendererObserved"]["immatureMultiplier"]==.6
    assert contract["recommendationOnly"]["notADefPatch"] is True
    assert source["integrationApplied"] is contract["integrationApplied"] is False
    assert source["newGrowthStageField"] is False and source["existingOatGeometryReused"] is False
    assert source["externalImageInputs"]==[] and source["existingImagesCopiedEditedOrRecolored"] is False
    licensepath=ROOT/"tools/art/oat-plot-LICENSE.txt"
    if not licensepath.exists():licensepath=ROOT/"LICENSE.txt"
    assert "CC0-1.0" in licensepath.read_text() and source["license"]=="CC0-1.0"
    print(json.dumps({"result":"PASS","scope":"격리 귀리밭 원본 정적 검사만; 실제 게임/성장 동작 미검증","key":key,"PNGSVGPairs":1,"PNGCount":3,"nativeSize":[32,32],"smallSize":[16,16],"opaqueBoundsInclusive":bounds,"opaqueWidth":bounds[2]-bounds[0]+1,"opaqueHeight":bounds[3]-bounds[1]+1,"opaquePixels32":len(occupied),"opaquePixels16":sum(a>0 for a in small[3::4]),"paletteEntries":18,"alphaValues":[0,255],"CRCAndTerminalIEND":True,"PNGSVGAllPixelsExact":True,"centerNearest16Exact":True,"wholeContactPixelsExact":True,"nineteenPixelPreviewOnlyApproximatesPointSix":True,"strawVisibleInBothReducedSizes":True,"groundBottomEdge":30,"optionalArtFootPoint":[16,30],"sourceHashesVerified":6,"generatorAndContractHashesVerified":True,"noNewGrowthStageField":True,"integrationApplied":False},ensure_ascii=False,indent=2))


if __name__=="__main__":main()
