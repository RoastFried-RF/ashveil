#!/usr/bin/env python3
"""새 좌표 도기 그릇3상태. 공통 도트 I/O 유틸만 재사용, 외부 이미지/게임 import 없음."""
from __future__ import annotations
import argparse,hashlib,json,struct,zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PALETTE={
    "o":"#202c2c", # cool clay outline
    "k":"#33312d", # empty deep interior
    "b":"#514539", # clay deep shadow
    "r":"#725a45", # old earthen body
    "n":"#92785b", # matte clay middle
    "s":"#b19877", # worn clay edge
    "h":"#c9b69a", # small unglazed rim wear
    "u":"#433e35", # inner clay
    "v":"#665b49", # empty bowl bottom
    "d":"#3c5156", # raw liquid depth
    "t":"#63797a", # raw liquid surface
    "m":"#92a29b", # flat water edge, no safety meaning
    "g":"#b7a16c", # discrete uncooked grain
    "f":"#d6c293", # raw grain ridge
    "c":"#8d8b72", # thick cooked oatmeal shadow
    "p":"#afa78a", # cooked oatmeal middle
    "i":"#c9c0a2", # cooked folds
    "l":"#e0d5b4", # small cooked flakes
    "w":"#b5b6a2", # subtle raw surface edge
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


STATES=("bowl","raw_oatmeal","oatmeal")


def bowl_back(c):
    # Handleless broad pottery silhouette, newly authored for all3 states.
    c.polygon([(6,9),(10,7),(21,7),(27,9),(30,13),(28,21),
               (25,25),(21,28),(11,28),(7,25),(4,21),(2,13)],"o")
    c.polygon([(4,13),(8,10),(23,10),(28,13),(26,21),
               (23,25),(20,27),(12,27),(8,24),(6,20)],"b")
    c.polygon([(5,14),(9,15),(24,15),(27,14),(25,21),
               (22,25),(13,26),(9,23),(7,19)],"r")
    c.polygon([(6,15),(10,17),(21,18),(24,17),(23,22),
               (20,25),(12,24),(9,21)],"n")
    # Unglazed matte wall. Short asymmetrical wear, not bright specular glaze.
    c.polygon([(7,17),(10,18),(12,22),(11,24),(8,22)],"s")
    c.line(14,24,19,25,"r");c.line(22,20,21,23,"b")
    c.point(9,22,"h");c.point(18,24,"s");c.point(24,20,"n")
    c.rect(11,27,11,2,"o");c.line(10,28,22,28,"b")
    c.line(11,29,21,29,"o");c.line(13,28,19,28,"r")
    # Dark empty cavity is the base layer, contents will be painted over it.
    c.polygon([(6,10),(11,8),(21,8),(26,10),(28,12),
               (26,15),(22,17),(10,17),(5,15),(4,12)],"u")
    c.polygon([(7,11),(12,9),(21,9),(25,11),(27,13),
               (24,16),(12,16),(6,14)],"k")
    c.line(9,14,12,15,"v");c.line(12,15,20,15,"v")
    c.line(21,15,24,14,"b")


def raw_surface(c):
    # Watery low surface with several distinct still-firm grain shapes.
    c.polygon([(7,11),(12,9),(21,9),(25,11),(27,13),
               (24,16),(12,16),(6,14)],"d")
    c.polygon([(8,11),(13,10),(20,10),(24,11),(25,13),
               (22,15),(12,15),(8,14)],"t")
    c.line(9,13,12,14,"m");c.line(20,14,23,13,"m")
    c.point(22,11,"w")
    # Grain positions are a surface texture, not exact ingredient units.
    c.polygon([(10,10),(12,10),(14,12),(13,13),(11,13),(9,11)],"g")
    c.line(10,10,12,11,"f");c.line(11,12,13,12,"b")
    c.polygon([(17,11),(19,10),(21,11),(20,13),(18,14),(16,13)],"g")
    c.line(18,11,19,11,"f");c.line(18,13,20,12,"b")
    c.line(13,14,15,13,"g");c.point(14,14,"f")


def cooked_surface(c):
    # Thick opaque gruel and soft ridges, without steam/hot/safety symbols.
    c.polygon([(7,11),(12,9),(21,9),(25,11),(27,13),
               (24,16),(12,16),(6,14)],"c")
    c.polygon([(8,11),(12,10),(21,10),(24,11),(25,13),
               (22,15),(12,15),(8,14)],"p")
    c.polygon([(10,11),(13,10),(18,10),(21,11),(20,12),
               (15,12),(13,13),(10,12)],"i")
    c.line(9,13,12,14,"i");c.line(13,14,16,14,"c")
    c.line(17,14,20,13,"i");c.line(21,12,23,12,"c")
    c.point(12,11,"l");c.point(17,11,"p");c.point(22,14,"l")
    c.point(15,13,"i");c.point(23,13,"i")


def bowl_rim(c):
    # Shared lip and front arc keep container identity and depth unchanged.
    c.line(6,9,10,7,"r");c.line(11,7,20,7,"n")
    c.line(22,8,27,10,"r");c.point(10,8,"h");c.point(19,8,"s")
    c.line(3,13,6,16,"r");c.line(6,16,11,18,"s")
    c.line(11,18,21,18,"s");c.line(21,18,27,16,"n")
    c.line(27,16,29,13,"r");c.line(12,19,20,19,"r")
    c.point(5,15,"h");c.point(16,18,"n");c.point(25,17,"s")


def icon(state):
    c=Canvas();bowl_back(c)
    if state=="raw_oatmeal":raw_surface(c)
    elif state=="oatmeal":cooked_surface(c)
    else:assert state=="bowl"
    bowl_rim(c);return c


def contact(icons):
    c=Canvas(576,352,"#11191f")
    for i,(state,image) in enumerate(icons.items()):
        left=i*192;small=preview16(image)
        c.rect(left+8,8,176,336,"#1b272c");c.blit(image,left+32,20,4)
        for start,bg in [(left+24,"#11191f"),(left+104,"#b8b39f")]:
            c.rect(start,168,64,80,bg);c.blit(image,start+16,172)
            c.blit(small,start+24,226);c.rect(start,264,64,64,bg)
            c.blit(small,start,264,4)
    return c


def encoded_json(value):return (json.dumps(value,ensure_ascii=False,indent=2)+"\n").encode()


def outputs():
    icons={state:icon(state) for state in STATES};products={};fragment={"sheets":{},"frames":{}};bounds={};opaque={}
    for state,image in icons.items():
        name="ashveil-hearth-"+state.replace("_","-");key="original_hearth_"+state
        occupied=[(x,y) for y,row in enumerate(image.pixels) for x,color in enumerate(row) if color!="."]
        assert occupied and all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds[state]=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)];opaque[state]=len(occupied)
        for ext,data in [(".png",png(image)),(".svg",svg(image,{"bowl":"빈 도기 그릇","raw_oatmeal":"귀리와 물을 담은 덜 익은 혼합물","oatmeal":"걸쭉한 귀리죽"}[state])),("-16.png",png(preview16(image)))]:products["public/sprites/original/items/"+name+ext]=data
        fragment["sheets"][key]="sprites/original/items/"+name+".png";fragment["frames"][key]=[key,0,0,32,32]
    products["public/sprites/original/items/ashveil-oatmeal-contact.png"]=png(contact(icons))
    products["public/sprites/original/items/ashveil-oatmeal-palette.json"]=encoded_json(PALETTE)
    products["tools/art/oatmeal-manifest.fragment.json"]=encoded_json(fragment)
    source={"created":"2026-10-21","license":"CC0-1.0","commercialUseAllowed":True,"redistributionAndDerivativePackagesAllowed":True,"attributionRequired":False,"source":"tools/art/draw-oatmeal-icons.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"referenceContract":"tools/art/oatmeal-reference-contract.json","referenceContractSha256":hashlib.sha256((ROOT/"tools/art/oatmeal-reference-contract.json").read_bytes()).hexdigest(),"method":"새 정수 좌표와 새19색 팔레트의 동일 낡은 도기3상태. 일반 자체 CC0 Canvas/I/O 유틸만 재사용.","externalImageInputs":[],"existingImagesCopiedEditedOrRecolored":False,"otherFoodOrBowlGeometryReused":False,"keys":["original_hearth_"+s for s in STATES],"proposedTargets":{"Item.Bowl":"original_hearth_bowl","Item.UnheatedOatmealBowl":"original_hearth_raw_oatmeal","Item.OatmealBowl":"original_hearth_oatmeal"},"nativeSize":[32,32],"smallSize":[16,16],"paletteEntries":19,"alphaValues":[0,255],"stateOrder":list(STATES),"opaqueBoundsInclusive":bounds,"opaquePixels":opaque,"sameBowlOutsideContentRegionXYXY":[4,8,28,18],"sharedGroundBottomEdge":30,"sharedArtFootPoint":[16,30],"noSteamTemperatureSafetyOrContaminationMarks":True,"newPaletteAndGeometry":True,"integrationApplied":False,"files":[{"file":p,"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest()} for p,b in products.items()]}
    products["public/sprites/original/items/ashveil-oatmeal-source.json"]=encoded_json(source);return products


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args();products=outputs()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"deterministic mismatch: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic original oatmeal icon files")


if __name__=="__main__":main()
