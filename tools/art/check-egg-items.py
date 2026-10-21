#!/usr/bin/env python3
"""Independent egg PNG/CRC/SVG/metadata audit; no drawing/game import."""
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
    source=j(ART/"ashveil-egg-source.json")
    reference=j(ROOT/"tools/art/egg-reference-contract.json")
    fragment=j(ROOT/"tools/art/egg-manifest.fragment.json")
    palette=j(ART/"ashveil-egg-palette.json")
    states=["whole","cracked"]
    names=["ashveil-hearth-egg","ashveil-cracked-hearth-egg"]
    keys=["original_hearth_egg","original_cracked_hearth_egg"]
    assert source["keys"]==keys and source["stateOrder"]==states
    assert source["proposedTargets"]==reference["proposedPublicKeys"]==dict(zip(["Item.Egg","Item.CrackedEgg"],keys))
    assert set(fragment)=={"sheets","frames"}
    assert set(fragment["sheets"])==set(fragment["frames"])==set(keys)
    assert source["nativeSize"]==reference["nativeSize"]==[32,32]
    assert source["smallSize"]==reference["smallPreviewSize"]==[16,16]
    defs={value["id"]:value for value in reference["rawItemDefinitions"]}
    assert set(defs)=={"Item.Egg","Item.CrackedEgg"}
    for value in defs.values():
        assert value["sprite"]=="ash_cap" and value["size"]==[1,1]
        assert value["maxStack"]==3 and value["stackable"]
        assert value["food"]["kcal"]==80 and value["food"]["protein"]==6 and value["food"]["vitamin"]==1 and value["food"]["water"]==45
    assert defs["Item.Egg"]["food"]["freshHours"]==336 and defs["Item.CrackedEgg"]["food"]["freshHours"]==6
    assert defs["Item.Egg"]["fragile"]["result"]=="Item.CrackedEgg" and defs["Item.Egg"]["fragile"]["dropChance"]==.3
    assert reference["visualOnly"] and source["otherFoodGeometryReused"] is False
    assert len(palette)==15 and len(set(palette.values()))==15
    allowed={bytes.fromhex(value[1:])+b"\xff" for value in palette.values()}
    yolk={bytes.fromhex(palette[key][1:])+b"\xff" for key in "dtml"}
    white={bytes.fromhex(palette[key][1:])+b"\xff" for key in "wcp"}
    cavity=bytes.fromhex(palette["k"][1:])+b"\xff"
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
        assert bounds[3]+1==source["groundBottomEdge"]==30
        assert source["optionalArtFootPoint"]==[16,30]
        sw,sh,preview=read_png(ART/(name+"-16.png"));assert (sw,sh)==(16,16)
        assert preview==b"".join(pixel(pixels,32,2*x+1,2*y+1) for y in range(16) for x in range(16))
        assert fragment["sheets"][key]=="sprites/original/items/"+name+".png"
        assert fragment["frames"][key]==[key,0,0,32,32]
        ycount=sum(pixel(pixels,32,x,y) in yolk for y in range(32) for x in range(32))
        wcount=sum(pixel(pixels,32,x,y) in white for y in range(32) for x in range(32))
        if state=="whole":
            assert ycount==wcount==0
            topwidth=sum(bool(pixel(pixels,32,x,5)[3]) for x in range(32))
            lowerwidth=sum(bool(pixel(pixels,32,x,20)[3]) for x in range(32))
            assert 0<topwidth<lowerwidth
        else:
            assert ycount>0 and wcount>0
            assert all(22<=y<28 for y in range(32) for x in range(32) if pixel(pixels,32,x,y) in yolk)
            assert any(pixel(pixels,32,x,y)==cavity for y in range(10,18) for x in range(4,16))
            assert any(pixel(pixels,32,x,y)==cavity for y in range(10,18) for x in range(18,29))
            assert any(pixel(preview,16,x,y) in yolk for y in range(16) for x in range(16))
        native[state]=pixels;small[state]=preview
        records.append({"key":key,"boundsInclusive":bounds,"opaqueWidth":bounds[2]-bounds[0]+1,"opaqueHeight":bounds[3]-bounds[1]+1,"opaquePixels32":len(occupied),"opaquePixels16":sum(alpha>0 for alpha in preview[3::4]),"yolkPixels32":ycount,"whitePixels32":wcount,"pngSHA256":hashlib.sha256((ART/(name+".png")).read_bytes()).hexdigest()})
    assert native["whole"]!=native["cracked"] and small["whole"]!=small["cracked"]
    # Reconstruct every contact pixel independently, including all label-free
    # background areas. Transparent samples reveal the specified matte field.
    cw,ch,contact=read_png(ART/"ashveil-egg-contact.png");assert (cw,ch)==(384,352)
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
    for i,state in enumerate(states):
        left=i*192;rect(left+8,8,176,336,"1b272c")
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
    license_path=ROOT/"tools/art/egg-LICENSE.txt"
    if not license_path.exists():license_path=ROOT/"LICENSE.txt"
    text=license_path.read_text()
    assert "CC0-1.0" in text and "Commercial" in text and "attribution" in text
    print(json.dumps({"result":"PASS","scope":"isolated original egg art and captured source context only; no game/Core/Def/browser/GPU/project tests","newKeys":keys,"nativeSize":[32,32],"smallSize":[16,16],"PNGSVGPairs":2,"PNGCount":5,"PNGCRCAndSingleTerminalIEND":True,"RGBA8":True,"alphaValues":[0,255],"paletteEntries":15,"transparentMargins":True,"distinctNativeAndSmallImages":True,"records":records,"sharedGroundBottomEdge":30,"optionalArtFootPoint":[16,30],"wholeTopNarrowerThanBelly":True,"crackedHasBothShellCavitiesAndSmallRawContents":True,"yolkVisibleAt16px":True,"centerNearest16pxExact":True,"wholeContactPixelsVerifiedIncludingNoLabelAreas":True,"sourceFilesHashVerified":9,"sourceAndReferenceHashesVerified":True,"capturedDefinitionsNotRuntimeDefDB":True,"license":"CC0-1.0","integrationApplied":False},ensure_ascii=False,indent=2))


if __name__=="__main__":main()
