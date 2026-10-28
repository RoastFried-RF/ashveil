#!/usr/bin/env python3
"""새 정수 좌표로 그린 CC0 귀리 알곡/파종 주머니. 외부 이미지·게임 import 없음."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib
ROOT=Path(__file__).resolve().parents[2]
PALETTE={
    "o":"#172429", # shared cold contour
    "k":"#30332f", # dark cavity / grain crease
    "b":"#514635", # old husk shadow
    "r":"#7c6848", # dried husk
    "n":"#9d8759", # muted grain
    "s":"#bea874", # straw middle
    "h":"#e0c99a", # small straw edge
    "f":"#ebe0be", # restrained grain highlight
    "d":"#394944", # weathered cloth shadow
    "t":"#526157", # faded grey-green cloth
    "m":"#73806b", # cloth fold light
    "l":"#9b9f83", # worn cloth edge
    "c":"#817f72", # shared old linen shade
    "p":"#b8b39f", # shared linen
    "i":"#e0d8bf", # shared linen thread
    "u":"#4b5149", # stem shadow
    "v":"#727869", # ash-grey stem
    "w":"#969c83", # stem light
}

class Canvas:
    def __init__(self, width: int = 32, height: int = 32, fill: str = "."):
        self.width = width
        self.height = height
        self.pixels = [[fill] * width for _ in range(height)]

    def point(self, x: int, y: int, color: str) -> None:
        if 0 <= x < self.width and 0 <= y < self.height:
            self.pixels[y][x] = color

    def rect(self, x: int, y: int, width: int, height: int, color: str) -> None:
        for py in range(y, y + height):
            for px in range(x, x + width):
                self.point(px, py, color)

    def row(self, x: int, y: int, colors: str) -> None:
        for i, color in enumerate(colors):
            if color != ".":
                self.point(x + i, y, color)

    def line(self, x0: int, y0: int, x1: int, y1: int, color: str) -> None:
        dx, sx = abs(x1 - x0), 1 if x0 < x1 else -1
        dy, sy = -abs(y1 - y0), 1 if y0 < y1 else -1
        error = dx + dy
        while True:
            self.point(x0, y0, color)
            if x0 == x1 and y0 == y1:
                break
            twice = 2 * error
            if twice >= dy:
                error += dy
                x0 += sx
            if twice <= dx:
                error += dx
                y0 += sy

    def polygon(self, vertices: list[tuple[int, int]], color: str) -> None:
        for y in range(min(p[1] for p in vertices), max(p[1] for p in vertices)):
            for x in range(min(p[0] for p in vertices), max(p[0] for p in vertices)):
                inside = False
                previous = vertices[-1]
                for current in vertices:
                    xi, yi = current
                    xj, yj = previous
                    if ((yi > y + 0.5) != (yj > y + 0.5) and
                            x + 0.5 < (xj - xi) * (y + 0.5 - yi) / (yj - yi) + xi):
                        inside = not inside
                    previous = current
                if inside:
                    self.point(x, y, color)

    def blit(self, other: Canvas, x: int, y: int, scale: int = 1) -> None:
        for py, row in enumerate(other.pixels):
            for px, color in enumerate(row):
                if color != ".":
                    self.rect(x + px * scale, y + py * scale, scale, scale, color)

def rgba(color: str) -> bytes:
    if color == ".":
        return bytes((0, 0, 0, 0))
    value = PALETTE.get(color, color).lstrip("#")
    return bytes((*bytes.fromhex(value), 255))

def png(c: Canvas) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + kind + data +
                struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff))
    raw = b"".join(b"\0" + b"".join(rgba(p) for p in row) for row in c.pixels)
    return (b"\x89PNG\r\n\x1a\n" +
            chunk(b"IHDR", struct.pack(">IIBBBBB", c.width, c.height, 8, 6, 0, 0, 0)) +
            chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

def svg(c: Canvas, label: str) -> bytes:
    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.width}" height="{c.height}" '
             f'viewBox="0 0 {c.width} {c.height}" shape-rendering="crispEdges">',
             f'  <title>ASHVEIL original pixel icon: {label}</title>',
             '  <desc>Original integer-coordinate artwork. No external image references.</desc>']
    for y, row in enumerate(c.pixels):
        x = 0
        while x < c.width:
            color = row[x]
            end = x + 1
            while end < c.width and row[end] == color:
                end += 1
            if color != ".":
                lines.append(f'  <rect x="{x}" y="{y}" width="{end - x}" height="1" '
                             f'fill="{PALETTE[color]}"/>')
            x = end
    lines.append('</svg>')
    return ("\n".join(lines) + "\n").encode()

def preview16(icon):
    c=Canvas(16,16)
    for y in range(16):
        for x in range(16):c.point(x,y,icon.pixels[2*y+1][2*x+1])
    return c


def drooping_husk(c,x,y,side):
    # Small new pointed oat floret, not a wheat's dense upright spike.
    # side describes the stem-side edge; the longer point hangs downward.
    if side<0:
        c.polygon([(x+1,y),(x+4,y+1),(x+5,y+4),(x+3,y+7),
                   (x,y+5),(x,y+2)],"o")
        c.polygon([(x+1,y+1),(x+3,y+2),(x+4,y+4),(x+3,y+6),
                   (x+1,y+4)],"r")
        c.line(x+1,y+2,x+3,y+5,"s");c.point(x+2,y+3,"h")
    else:
        c.polygon([(x+3,y),(x+5,y+2),(x+5,y+5),(x+2,y+7),
                   (x,y+4),(x+1,y+1)],"o")
        c.polygon([(x+3,y+1),(x+4,y+3),(x+4,y+5),(x+2,y+6),
                   (x+1,y+4)],"n")
        c.line(x+2,y+2,x+2,y+5,"h");c.point(x+3,y+4,"s")


def loose_kernel(c,x,y,lean):
    # Separate newly drawn hulled grain with a dark longitudinal crease.
    if lean<0:
        c.polygon([(x+1,y),(x+4,y),(x+7,y+3),(x+6,y+5),
                   (x+3,y+5),(x,y+2)],"o")
        c.polygon([(x+1,y+1),(x+3,y+1),(x+6,y+3),(x+5,y+4),
                   (x+3,y+4)],"n")
        c.line(x+2,y+1,x+5,y+3,"h");c.line(x+2,y+2,x+4,y+3,"r")
    else:
        c.polygon([(x+3,y),(x+5,y+1),(x+5,y+3),(x+2,y+6),
                   (x,y+4),(x,y+2)],"o")
        c.polygon([(x+3,y+1),(x+4,y+2),(x+4,y+3),(x+2,y+5),
                   (x+1,y+3)],"s")
        c.line(x+3,y+2,x+1,y+4,"b");c.point(x+3,y+1,"f")


def oats():
    c=Canvas()
    # Loose open panicle: slender central straw and separated drooping florets.
    c.line(19,3,22,27,"o");c.line(20,4,23,28,"u")
    c.line(20,5,22,25,"v");c.point(21,17,"w")
    for x0,y0,x1,y1 in [(20,6,15,6),(20,10,25,11),
                        (21,14,14,15),(22,19,25,19)]:
        c.line(x0,y0,x1,y1,"o");c.line(x0,y0-1,x1,y1-1,"v")
    drooping_husk(c,12,4,-1);drooping_husk(c,23,9,1)
    drooping_husk(c,11,13,-1);drooping_husk(c,23,17,1)
    c.line(18,21,20,27,"r");c.line(19,22,20,26,"s")
    # Harvested cooking grain is deliberately a broad foreground cluster,
    # so the 16px preview reads as grain rather than an isolated thin plant.
    loose_kernel(c,4,21,-1);loose_kernel(c,10,19,1)
    loose_kernel(c,17,24,-1);loose_kernel(c,3,25,-1)
    c.polygon([(10,22),(13,20),(17,20),(20,23),(18,27),
               (14,30),(10,29),(7,26)],"o")
    c.polygon([(10,23),(13,21),(16,21),(18,23),(17,26),
               (13,28),(10,28),(8,26)],"r")
    c.polygon([(10,24),(13,22),(16,22),(18,23),(15,26),
               (12,28),(10,27)],"s")
    c.line(11,24,15,22,"h");c.point(16,22,"f")
    c.line(10,27,16,24,"b");c.line(12,27,16,25,"n")
    c.point(21,28,"r");c.point(25,28,"b")
    return c


def oat_seed():
    c=Canvas()
    # New round gathered cloth pouch, unlike the old flat shade-seed envelope.
    c.polygon([(10,5),(13,3),(16,5),(20,3),(23,6),(21,9),
               (20,13),(24,16),(27,22),(26,27),(22,30),
               (10,30),(6,27),(5,22),(7,16),(11,12)],"o")
    c.polygon([(11,6),(13,5),(16,7),(20,5),(21,7),(18,12),
               (14,12)],"d")
    c.line(12,6,14,10,"m");c.line(17,7,18,10,"t")
    c.line(20,6,18,10,"l")
    c.polygon([(12,13),(18,12),(22,16),(25,21),(25,26),
               (21,29),(11,29),(7,26),(7,22),(9,17)],"d")
    c.polygon([(13,14),(18,14),(21,17),(23,22),(22,27),
               (18,28),(11,27),(9,24),(10,19)],"t")
    c.polygon([(12,17),(14,15),(16,16),(15,21),(13,25),
               (10,24)],"m")
    c.line(11,19,11,22,"l");c.line(16,17,17,21,"m")
    c.line(19,18,21,24,"d");c.line(20,26,16,27,"m")
    c.line(8,24,10,27,"u");c.line(11,28,21,28,"d")
    # A plain asymmetric repair patch denotes old cloth, not a label/seal.
    c.polygon([(19,22),(23,21),(24,25),(20,26)],"u")
    c.line(20,23,22,22,"c");c.point(21,25,"c")
    # Pale rough binding with its two dangling ends. No letters or quality mark.
    c.line(9,11,21,12,"o");c.line(9,12,21,13,"b")
    c.line(10,11,20,12,"p");c.line(11,12,20,13,"c")
    c.point(14,12,"i");c.point(17,12,"i")
    c.line(16,13,17,18,"o");c.line(17,13,18,17,"p")
    c.line(17,13,14,17,"b");c.line(16,14,14,16,"p")
    # One short real dry oat sprig tucked beneath the binding; no new sprout.
    c.line(22,13,24,5,"o");c.line(23,12,25,5,"v")
    c.polygon([(24,5),(27,5),(28,8),(26,11),(23,9)],"o")
    c.polygon([(25,6),(26,6),(27,8),(25,10),(24,8)],"n")
    c.line(25,7,25,9,"h")
    return c


def contact(icons):
    # 왼쪽은 알곡/오른쪽은 씨앗 주머니. 문자를 렌더하지 않는 검토 시트.
    c=Canvas(384,352,"#11191f")
    for index,(state,image) in enumerate(icons.items()):
        left=index*192;small=preview16(image)
        c.rect(left+8,8,176,336,"#1b272c");c.blit(image,left+32,20,4)
        for start,bg in [(left+24,"#11191f"),(left+104,"#b8b39f")]:
            c.rect(start,168,64,80,bg);c.blit(image,start+16,172)
            c.blit(small,start+24,226);c.rect(start,264,64,64,bg)
            c.blit(small,start,264,4)
    return c


def encoded_json(value):return (json.dumps(value,ensure_ascii=False,indent=2)+"\n").encode()


def outputs():
    icons={"oats":oats(),"oat_seed":oat_seed()}
    names={"oats":"ashveil-hearth-oats","oat_seed":"ashveil-hearth-oat-seed"}
    products={};fragment={"sheets":{},"frames":{}};bounds={};opaque={}
    for state,image in icons.items():
        name=names[state];key="original_hearth_"+state
        occupied=[(x,y) for y,row in enumerate(image.pixels) for x,color in enumerate(row) if color!="."]
        assert occupied and all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds[state]=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        opaque[state]=len(occupied)
        for ext,data in [(".png",png(image)),(".svg",svg(image,"귀리 알곡" if state=="oats" else "귀리 씨앗 주머니")),("-16.png",png(preview16(image)))]:products["public/sprites/original/items/"+name+ext]=data
        fragment["sheets"][key]="sprites/original/items/"+name+".png";fragment["frames"][key]=[key,0,0,32,32]
    products["public/sprites/original/items/ashveil-oat-contact.png"]=png(contact(icons))
    products["public/sprites/original/items/ashveil-oat-palette.json"]=encoded_json(PALETTE)
    products["tools/art/oat-manifest.fragment.json"]=encoded_json(fragment)
    records=[{"file":path,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for path,data in products.items()]
    source={"created":"2026-10-21","license":"CC0-1.0","commercialUseAllowed":True,"redistributionAndDerivativePackagesAllowed":True,"attributionRequired":False,"source":"tools/art/draw-oat-items.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"referenceContract":"tools/art/oat-reference-contract.json","referenceContractSha256":hashlib.sha256((ROOT/"tools/art/oat-reference-contract.json").read_bytes()).hexdigest(),"method":"새 정수 좌표로 그린 처진 귀리 이삭·낱알과 둥근 묶음 씨앗 주머니. 일반 CC0 도구 코드/재질색 일부만 재사용하며 기존 아트나 음식 도형은 복사하지 않음.","externalImageInputs":[],"existingImagesCopiedEditedOrRecolored":False,"otherFoodOrPouchGeometryReused":False,"integrationApplied":False,"keys":["original_hearth_oats","original_hearth_oat_seed"],"proposedTargets":{"Item.Oats":"original_hearth_oats","Item.OatSeed":"original_hearth_oat_seed"},"nativeSize":[32,32],"smallSize":[16,16],"paletteEntries":len(PALETTE),"alphaValues":[0,255],"stateOrder":list(icons),"opaqueBoundsInclusive":bounds,"opaquePixels":opaque,"groundBottomEdge":30,"optionalArtFootPoint":[16,30],"noRenderedTextDigitsOrSymbols":True,"visualInterpretation":"귀리는 소량의 드러난 곡립·처진 이삭, 씨앗은 회록색의 낡은 둥근 주머니·밝은 묶음끈·짧은 마른 귀리 가지. 정면 약간 위 시점.","notEncoded":["정확한 스택/낱알 수량","새 생식 기능/영양 수치","발아율/수확량/성장 단계","신선도/청결/안전 보증","생산/제조/시장 수급"],"files":records}
    products["public/sprites/original/items/ashveil-oat-source.json"]=encoded_json(source)
    return products


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args();products=outputs()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"deterministic mismatch: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic original oat icon files")


if __name__=="__main__":main()
