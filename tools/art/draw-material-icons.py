#!/usr/bin/env python3
"""새 정수 좌표로 그린 생활/제작 재료5종. 자체 공통 유틸만 재사용한 CC0 아트."""
from __future__ import annotations
import argparse,hashlib,json,struct,zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PALETTE={
    "o":"#1d292b", "k":"#303431", # contour / carbon depth
    "b":"#4f3b30", "r":"#74513b", "n":"#9e7550", # bark
    "s":"#bea075", "h":"#d7c19b", # cut wood
    "a":"#594039", "q":"#8c553a", "f":"#af7850", # dull rust
    "d":"#3c4b4f", "t":"#627378", "m":"#97a5a1", # iron
    "u":"#484d4c", "v":"#626a69", "w":"#858c85", # charcoal facets
    "c":"#7e7d6e", "p":"#aaa895", "i":"#d0c9b2", "l":"#e4ddc4", # yarn
    "g":"#6e4d36", "j":"#946c48", "e":"#b18a5e", "z":"#cdab7d", # tanned leather
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


STATES=("wood","iron_scrap","thread","leather","charcoal")
LABELS=("목재 토막","녹슨 고철 조각","감은 실 꾸러미","접힌 무두질 가죽","탄흑 숯 조각")


def wood():
    c=Canvas()
    # Two short felled segments. Cut ends, no rooted stump or weapon grip.
    c.polygon([(11,18),(16,17),(29,24),(28,28),(23,30),
               (9,24),(8,21)],"o")
    c.polygon([(13,19),(16,19),(27,24),(26,27),(23,28),(11,23)],"b")
    c.line(16,21,24,25,"r");c.line(19,23,25,26,"n")
    c.polygon([(10,19),(14,19),(17,22),(16,25),(12,26),
               (9,24),(8,21)],"r")
    c.polygon([(10,20),(13,20),(15,22),(14,24),(11,24),(9,22)],"s")
    c.line(11,21,13,22,"n");c.point(12,23,"h")
    c.polygon([(9,6),(14,6),(29,14),(28,19),(25,22),
               (8,17),(3,13),(4,9)],"o")
    c.polygon([(12,7),(26,14),(27,18),(24,20),(11,16)],"b")
    c.polygon([(13,8),(26,14),(26,16),(13,12)],"r")
    c.line(15,11,24,16,"n");c.line(14,14,23,18,"r")
    c.line(18,13,19,16,"b");c.line(25,15,24,18,"o")
    c.polygon([(8,7),(12,7),(15,10),(15,13),(12,17),
               (7,16),(4,13),(5,10)],"r")
    c.polygon([(8,8),(11,8),(14,11),(13,14),(11,15),
               (7,14),(6,12),(6,10)],"s")
    c.line(8,9,10,9,"h");c.line(7,10,7,12,"h")
    c.line(8,13,11,14,"n");c.line(11,14,13,12,"n")
    c.line(9,10,11,11,"n");c.line(11,11,10,12,"r")
    c.point(10,10,"h");c.line(12,12,13,15,"b")
    return c


def iron_scrap():
    c=Canvas()
    # Broken plate, short crooked angle and snapped perforated strip.
    # Neither an intact pipe club nor a functioning blade/tool silhouette.
    c.polygon([(16,5),(23,7),(27,13),(25,18),(27,22),(23,26),
               (18,24),(14,25),(12,16)],"o")
    c.polygon([(17,7),(22,8),(25,13),(23,18),(25,22),(22,24),
               (18,22),(15,23),(14,16)],"d")
    c.polygon([(17,7),(21,8),(23,11),(21,14),(16,15)],"a")
    c.line(17,8,20,9,"q");c.point(20,10,"f")
    c.line(23,14,22,18,"t");c.line(21,22,18,21,"t")
    c.line(16,16,17,20,"q");c.point(18,20,"f")
    c.rect(19,13,3,3,"o");c.line(19,12,21,12,"m")
    c.polygon([(4,10),(9,8),(12,11),(10,15),(8,18),(11,23),
               (8,25),(4,21),(3,17),(6,13)],"o")
    c.polygon([(5,11),(8,10),(10,12),(7,16),(6,18),(9,22),
               (8,23),(5,20),(5,17),(8,12)],"t")
    c.line(5,11,8,10,"m");c.line(6,19,8,21,"q")
    c.point(6,18,"f");c.line(9,12,8,14,"d")
    c.polygon([(9,24),(17,21),(21,23),(20,26),(24,27),(22,30),
               (16,28),(12,29),(7,27)],"o")
    c.polygon([(10,25),(17,23),(19,24),(18,26),(22,28),
               (18,28),(15,26),(11,27)],"a")
    c.line(10,25,16,23,"q");c.point(15,24,"f")
    c.line(13,27,16,26,"t");c.point(20,28,"m")
    return c


def thread():
    c=Canvas()
    # Wound hank, not cloth sheet, needle, clean bandage or ready-made tool.
    c.polygon([(11,4),(17,3),(22,6),(26,13),(26,19),(22,25),
               (16,27),(10,25),(6,20),(4,13),(6,7)],"o")
    c.polygon([(11,6),(16,5),(21,8),(24,14),(24,19),(20,24),
               (16,25),(11,23),(8,19),(6,13),(8,8)],"c")
    c.polygon([(11,7),(15,6),(19,8),(22,14),(22,19),(18,23),
               (14,23),(10,20),(8,14),(9,9)],"p")
    for points in [[(9,9),(11,7),(13,8),(20,21)],
                   [(7,12),(9,10),(12,11),(21,19)],
                   [(8,17),(10,15),(12,16),(18,23)]]:
        for a,b in zip(points,points[1:]):c.line(*a,*b,"i")
    c.line(13,6,20,18,"l");c.line(17,9,23,17,"c")
    c.line(10,21,13,24,"i");c.line(17,23,21,20,"i")
    # A simple cross binding groups the hank; no package label or glyph.
    c.line(7,17,21,10,"d");c.line(8,18,22,11,"t")
    c.line(10,17,20,12,"c");c.point(15,14,"i")
    c.line(19,24,22,28,"c");c.line(22,28,25,29,"p")
    c.line(25,29,28,26,"i");c.line(28,26,26,24,"c")
    return c


def leather():
    c=Canvas()
    # Irregular folded tanned sheet, no sleeve, collar, strap or garment cut.
    c.polygon([(7,7),(12,5),(23,6),(28,10),(27,17),(29,24),
               (25,29),(20,28),(15,30),(10,28),(5,29),(3,24),
               (5,17),(4,12)],"o")
    c.polygon([(7,10),(13,8),(24,9),(26,13),(25,18),(27,24),
               (24,27),(20,26),(15,28),(10,26),(6,27),(5,24),
               (7,17),(6,13)],"g")
    c.polygon([(8,11),(13,10),(22,10),(24,14),(23,19),(25,24),
               (21,25),(15,27),(10,24),(7,25),(8,20)],"j")
    c.polygon([(9,12),(15,11),(22,12),(21,18),(23,23),(17,24),
               (12,22),(9,23),(10,18)],"e")
    c.line(11,14,18,13,"z");c.line(12,15,18,14,"j")
    c.line(21,15,19,20,"g");c.line(18,20,21,22,"j")
    c.point(10,20,"z");c.point(17,18,"j");c.point(14,22,"g")
    c.point(22,24,"e");c.point(8,25,"j")
    # Rolled-over upper fold and thickness along an uneven lower edge.
    c.polygon([(7,7),(12,6),(23,7),(26,10),(24,13),(15,12),
               (10,14),(6,12)],"g")
    c.polygon([(8,8),(13,7),(22,8),(24,10),(22,11),(15,10),
               (10,12),(7,11)],"e")
    c.line(10,8,15,8,"z");c.line(17,9,22,10,"j")
    c.line(7,27,10,26,"e");c.line(14,28,19,26,"g")
    return c


def charcoal():
    c=Canvas()
    # Cool carbon-black fractured pieces. No orange heat/glow or bone shape.
    c.polygon([(10,7),(16,4),(22,7),(24,15),(21,22),(16,26),
               (9,23),(7,16)],"o")
    c.polygon([(11,8),(16,6),(21,8),(22,14),(19,18),(10,18),(9,14)],"u")
    c.polygon([(11,8),(15,7),(18,8),(16,12),(12,14),(9,13)],"v")
    c.line(11,9,14,8,"w");c.line(18,8,21,9,"v")
    c.polygon([(11,15),(15,12),(18,13),(20,17),(18,22),(14,24),
               (10,21)],"k")
    c.line(14,10,14,15,"o");c.line(14,15,18,18,"o")
    c.line(20,12,19,15,"d");c.line(10,17,12,21,"v")
    c.polygon([(4,20),(8,17),(13,20),(15,26),(12,30),(6,29),
               (2,26)],"o")
    c.polygon([(5,21),(8,19),(11,21),(12,25),(9,28),(5,27),(4,25)],"u")
    c.polygon([(5,21),(8,20),(10,22),(7,24),(4,24)],"v")
    c.line(5,22,7,21,"w");c.line(8,24,10,27,"o")
    c.polygon([(20,20),(26,18),(29,22),(28,27),(24,30),(18,28),
               (17,24)],"o")
    c.polygon([(21,21),(25,20),(27,22),(26,26),(23,28),(19,26),(19,24)],"k")
    c.polygon([(21,21),(25,20),(26,22),(23,24),(19,24)],"v")
    c.line(21,22,23,21,"w");c.line(23,24,24,27,"u")
    c.point(27,24,"v");c.point(16,28,"d")
    return c


def contact(icons):
    c=Canvas(960,352,"#11191f")
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
    icons={s:globals()[s]() for s in STATES};products={};fragment={"sheets":{},"frames":{}};bounds={};opaque={}
    for state,label in zip(STATES,LABELS):
        image=icons[state];name="ashveil-hearth-"+state.replace("_","-");key="original_hearth_"+state
        occupied=[(x,y) for y,row in enumerate(image.pixels) for x,color in enumerate(row) if color!="."]
        assert occupied and all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds[state]=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)];opaque[state]=len(occupied)
        for ext,data in [(".png",png(image)),(".svg",svg(image,label)),("-16.png",png(preview16(image)))]:products["public/sprites/original/items/"+name+ext]=data
        fragment["sheets"][key]="sprites/original/items/"+name+".png";fragment["frames"][key]=[key,0,0,32,32]
    products["public/sprites/original/items/ashveil-material-contact.png"]=png(contact(icons))
    products["public/sprites/original/items/ashveil-material-palette.json"]=encoded_json(PALETTE)
    products["tools/art/material-manifest.fragment.json"]=encoded_json(fragment)
    source={"created":"2026-10-21","license":"CC0-1.0","commercialUseAllowed":True,"redistributionAndDerivativePackagesAllowed":True,"attributionRequired":False,"source":"tools/art/draw-material-icons.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"referenceContract":"tools/art/material-reference-contract.json","referenceContractSha256":hashlib.sha256((ROOT/"tools/art/material-reference-contract.json").read_bytes()).hexdigest(),"method":"새 정수 좌표와24색 재질 팔레트의 생활/제작 원재료5종. 일반 자체 CC0 Canvas/I/O 유틸만 재사용.","externalImageInputs":[],"existingImagesCopiedEditedOrRecolored":False,"existingItemGeometryReused":False,"keys":["original_hearth_"+s for s in STATES],"proposedTargets":dict(zip(["Item.Wood","Item.IronScrap","Item.Thread","Item.Leather","Item.Charcoal"],["original_hearth_"+s for s in STATES])),"nativeSize":[32,32],"smallSize":[16,16],"paletteEntries":24,"alphaValues":[0,255],"stateOrder":list(STATES),"opaqueBoundsInclusive":bounds,"opaquePixels":opaque,"groundBottomEdge":30,"optionalArtFootPoint":[16,30],"noToolGearOrLargeQuantityStateMarksByDesign":True,"noCharcoalEmberOrHeatMarks":True,"integrationApplied":False,"files":[{"file":p,"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest()} for p,b in products.items()]}
    products["public/sprites/original/items/ashveil-material-source.json"]=encoded_json(source);return products


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args();products=outputs()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"deterministic mismatch: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic original material icon files")


if __name__=="__main__":main()
