#!/usr/bin/env python3
"""New CC0 Hearth egg/cracked-egg integer-coordinate art. No image inputs or game imports."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib
ROOT=Path(__file__).resolve().parents[2]
PALETTE={
    "o":"#263237", # cool contour
    "k":"#4b4840", # broken-shell cavity
    "b":"#817a64", # ash-worn shell shadow
    "r":"#a59b80", # yellow-grey shadow
    "n":"#c4b99b", # shell middle
    "s":"#d7ceb2", # shell light
    "h":"#e5dec6", # chalk edge
    "u":"#a49c85", # faint shell grain
    "w":"#9ca8a0", # pooled white shadow
    "c":"#bfc8b7", # pooled white
    "p":"#dce1cc", # pale white edge
    "d":"#997349", # yolk edge
    "t":"#c39a4c", # yolk middle
    "m":"#d8b05e", # yolk light
    "l":"#e5c581", # muted yolk highlight
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


def whole_egg():
    c=Canvas()
    # The top is narrower than the rounded bottom: an egg, not a pill/disc.
    c.polygon([(13,3),(17,3),(20,6),(22,10),(24,16),(25,22),
               (23,26),(20,29),(13,30),(9,27),(7,23),(7,18),
               (9,11),(11,6)],"o")
    c.polygon([(13,5),(17,4),(20,8),(22,13),(23,19),(23,24),
               (20,27),(14,28),(10,25),(9,21),(9,17),(11,10)],"b")
    c.polygon([(13,5),(17,5),(20,9),(21,14),(22,19),(21,24),
               (18,27),(13,26),(10,22),(10,16),(11,11)],"r")
    c.polygon([(13,5),(16,5),(19,9),(20,14),(20,21),(17,25),
               (13,24),(11,21),(10,17),(11,11)],"n")
    c.polygon([(13,6),(16,6),(18,10),(19,15),(18,21),(15,23),
               (12,20),(11,16),(12,10)],"s")
    c.line(13,7,15,6,"h");c.line(12,10,12,13,"h")
    c.line(13,22,16,24,"n");c.line(17,26,21,24,"r")
    c.line(11,26,14,28,"b");c.line(15,28,19,28,"b")
    # Scattered soft shell grain; never spots resembling mushroom gills/caps.
    c.point(15,10,"n");c.point(18,17,"n");c.point(12,18,"n")
    c.point(17,23,"u");c.point(21,20,"u");c.point(14,25,"u")
    return c


def cracked_egg():
    c=Canvas()
    # A small uneven spill under two newly drawn jagged shell halves.
    # The raw contents remain low, without a plate, pan or fried white ring.
    c.polygon([(6,23),(10,21),(16,22),(23,21),(28,24),(29,26),
               (25,28),(18,30),(10,29),(4,27),(3,25)],"o")
    c.polygon([(6,24),(10,23),(15,23),(20,22),(25,24),(27,26),
               (23,28),(16,29),(10,28),(5,26)],"w")
    c.polygon([(7,24),(12,24),(16,25),(23,23),(25,25),
               (24,27),(17,28),(10,27),(6,26)],"c")
    c.line(7,25,10,24,"p");c.line(21,27,24,26,"p")
    # Left half: high broken back edge, dark visible interior and round belly.
    c.polygon([(4,14),(6,10),(8,12),(10,9),(12,12),(15,11),
               (16,15),(16,20),(13,24),(9,25),(5,22),(3,18)],"o")
    c.polygon([(5,14),(6,12),(8,14),(10,11),(12,14),(14,13),
               (15,16),(14,20),(11,23),(7,21),(5,18)],"k")
    c.polygon([(5,17),(8,18),(10,17),(13,18),(15,16),(14,21),
               (11,24),(8,23),(5,21)],"b")
    c.polygon([(5,17),(8,19),(11,19),(14,17),(13,21),(11,23),
               (8,22),(6,20)],"n")
    c.line(5,15,6,12,"s");c.line(6,12,8,14,"h")
    c.line(8,14,10,11,"s");c.line(10,11,12,14,"h")
    c.line(12,14,14,13,"s")
    c.line(6,18,8,20,"s");c.line(8,20,11,21,"s")
    c.point(9,22,"r");c.point(13,19,"r")
    # Right half tilts away, exposes another cavity and its uneven snap edge.
    c.polygon([(18,14),(19,10),(21,12),(23,9),(25,12),(27,11),
               (29,15),(28,21),(25,24),(21,23),(18,20)],"o")
    c.polygon([(19,15),(20,12),(21,14),(23,11),(25,14),(27,13),
               (28,16),(26,20),(23,22),(20,20)],"k")
    c.polygon([(19,17),(22,18),(25,18),(28,16),(27,21),
               (25,23),(22,22),(20,20)],"b")
    c.polygon([(20,17),(22,19),(25,19),(27,17),(26,21),
               (24,22),(22,21)],"r")
    c.line(20,13,21,14,"s");c.line(21,14,23,11,"h")
    c.line(23,11,25,14,"s");c.line(25,14,27,13,"h")
    c.line(27,13,28,16,"n")
    c.line(21,19,23,20,"n");c.line(23,20,26,19,"n")
    # Small ochre yolk, imperfect and low: distinct from either pale shell.
    c.polygon([(13,23),(16,22),(20,23),(22,25),(21,27),
               (17,28),(13,27),(11,25)],"d")
    c.polygon([(14,23),(17,23),(20,24),(21,25),(19,27),
               (15,27),(13,25)],"t")
    c.polygon([(15,23),(18,23),(20,25),(18,26),(15,26),(14,25)],"m")
    c.line(15,24,17,23,"l");c.point(20,26,"m")
    c.point(11,28,"p");c.point(23,26,"c")
    return c


def contact(icons):
    # Left whole/right cracked; entirely image-only, no label or text glyph.
    c=Canvas(384,352,"#11191f")
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
    icons={"whole":whole_egg(),"cracked":cracked_egg()}
    names={"whole":"ashveil-hearth-egg","cracked":"ashveil-cracked-hearth-egg"}
    keys={"whole":"original_hearth_egg","cracked":"original_cracked_hearth_egg"}
    products={};fragment={"sheets":{},"frames":{}};bounds={};opaque={}
    for state,image in icons.items():
        name=names[state];key=keys[state]
        occupied=[(x,y) for y,row in enumerate(image.pixels) for x,value in enumerate(row) if value!="."]
        assert occupied and all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds[state]=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
        opaque[state]=len(occupied)
        for ext,data in [(".png",png(image)),(".svg",svg(image,state+" Hearth egg")),("-16.png",png(preview16(image)))]:products["public/sprites/original/items/"+name+ext]=data
        fragment["sheets"][key]="sprites/original/items/"+name+".png";fragment["frames"][key]=[key,0,0,32,32]
    products["public/sprites/original/items/ashveil-egg-contact.png"]=png(contact(icons))
    products["public/sprites/original/items/ashveil-egg-palette.json"]=encoded_json(PALETTE)
    products["tools/art/egg-manifest.fragment.json"]=encoded_json(fragment)
    records=[{"file":path,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for path,data in products.items()]
    source={"created":"2026-10-21","license":"CC0-1.0","commercialUseAllowed":True,"redistributionAndDerivativePackagesAllowed":True,"attributionRequired":False,"source":"tools/art/draw-egg-items.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"referenceContract":"tools/art/egg-reference-contract.json","referenceContractSha256":hashlib.sha256((ROOT/"tools/art/egg-reference-contract.json").read_bytes()).hexdigest(),"method":"new authored integer-coordinate egg ovoid, separate jagged shell halves and small raw yolk/white geometry; no image inputs or previous food shape reuse","externalImageInputs":[],"existingImagesCopiedEditedOrRecolored":False,"otherFoodGeometryReused":False,"integrationApplied":False,"keys":list(keys.values()),"proposedTargets":{"Item.Egg":keys["whole"],"Item.CrackedEgg":keys["cracked"]},"nativeSize":[32,32],"smallSize":[16,16],"paletteEntries":len(PALETTE),"alphaValues":[0,255],"stateOrder":list(icons),"opaqueBoundsInclusive":bounds,"opaquePixels":opaque,"groundBottomEdge":30,"optionalArtFootPoint":[16,30],"noRenderedTextDigitsOrSymbols":True,"visualInterpretation":"pale yellow-grey whole egg; matching broken shell halves with a small ochre raw yolk and grey-white spill, front/slightly above","notEncoded":["freshness or safety indicator","exact stack count","nutrition change","drop/break probability","item generation","economic production","storage protection"],"files":records}
    products["public/sprites/original/items/ashveil-egg-source.json"]=encoded_json(source)
    return products


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args();products=outputs()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"deterministic mismatch: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic original egg icon files")


if __name__=="__main__":main()
