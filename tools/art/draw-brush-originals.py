#!/usr/bin/env python3

"""CC0 original sheet machete and unfruited ashberry bush; no image input/game import."""

from __future__ import annotations

import argparse

import hashlib

import json

from pathlib import Path

import struct

import zlib

ROOT=Path(__file__).resolve().parents[2]

OUT=ROOT/"public/sprites/original/items"

PALETTE = {
    "o": "#172429",  # cold contour, shared with the original wanderer
    "k": "#28292c",  # deep opening
    "b": "#3d3331",  # leather shadow
    "r": "#6c5141",  # worn leather
    "n": "#987354",  # leather/wood light
    "s": "#9b7359",  # warm middle
    "f": "#c69b75",  # small worn edges
    "a": "#b78047",  # copper
    "g": "#e5bd74",  # restrained copper glint
    "d": "#293f48",  # faded teal shadow
    "t": "#3e5d67",  # faded teal
    "m": "#608183",  # faded teal edge
    "l": "#91aaa0",  # light cold edge
    "c": "#817f72",  # old linen/ivory shadow
    "p": "#b8b39f",  # linen
    "h": "#e0d8bf",  # ivory feather and thread
    "u": "#353d40",  # iron shadow
    "v": "#626e6c",  # iron
    "w": "#8b9387",  # iron edge
}

PALETTE.update({"j":"#485648","q":"#75816a","y":"#a1a38b"})

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

FONT = {
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "N": ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
    "/": ["00001", "00001", "00010", "00100", "01000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
}

def text(c, x, y, label, scale=1):
    for i,letter in enumerate(label):
        if letter == " ": continue
        for py,row in enumerate(FONT[letter]):
            for px,bit in enumerate(row):
                if bit == "1": c.rect(x+i*6*scale+px*scale,y+py*scale,scale,scale,"#b8b39f")

def preview16(icon):
    c=Canvas(16,16)
    for y in range(16):
        for x in range(16):c.point(x,y,icon.pixels[2*y+1][2*x+1])
    return c

def contact(icons):
    c=Canvas(384,376,"#11191f")
    for index,(key,icon) in enumerate(icons.items()):
        left=index*192; label=LABELS[key]; small=preview16(icon)
        c.rect(left+8,8,176,360,"#1b272c")
        text(c,left+(192-len(label)*12)//2,18,label,2)
        c.blit(icon,left+32,44,4)
        for start,bg in [(left+24,"#11191f"),(left+104,"#b8b39f")]:
            c.rect(start,184,64,64,bg);c.blit(icon,start+16,188);c.blit(small,start+24,226)
            c.rect(start,264,64,64,bg);c.blit(small,start,264,4)
        text(c,left+24,346,"NATIVE / SMALL")
    return c

LABELS={"sheet_machete":"MACHETE","ashberry_bush":"BUSH"}
TARGETS={"Item.Machete":"original_sheet_machete","Terrain.AshBerryBush":"original_ashberry_bush"}


def sheet_machete():
    c=Canvas()
    # A broad agricultural sheet blade, not the earlier narrow rusty knife.
    c.polygon([(10,20),(14,12),(20,7),(27,2),(29,3),(28,10),
               (24,17),(18,24),(14,25)],"o")
    c.polygon([(12,20),(16,13),(21,8),(27,4),(27,9),
               (23,16),(17,22),(14,23)],"u")
    c.polygon([(14,19),(18,12),(23,8),(26,6),(26,10),
               (22,16),(17,21),(15,22)],"v")
    # An uneven worn bevel catches a little light; no glow, blood or poison.
    c.line(17,21,23,14,"w");c.line(23,14,27,7,"w")
    c.line(18,20,24,13,"l");c.point(26,8,"h")
    c.line(14,17,17,12,"v");c.point(21,10,"w")
    c.point(18,16,"u");c.point(22,12,"u");c.point(24,9,"u")
    # Short unadorned dark grip and tang. Small fasteners are not stat badges.
    c.polygon([(5,24),(9,20),(13,22),(12,25),(7,30),(3,29)],"o")
    c.polygon([(5,25),(9,22),(11,23),(10,25),(6,28),(4,28)],"b")
    c.line(5,26,9,22,"r");c.line(5,27,9,24,"n")
    c.point(6,26,"v");c.point(9,23,"w")
    c.line(10,20,15,24,"o");c.line(11,20,15,23,"v")
    c.point(11,21,"w")
    return c


def twig(c,a,b,lit=False):
    # Bark clusters, not single aliased wire lines; all branch paths are new.
    for dx,dy in [(-1,0),(0,-1),(0,0),(1,0),(0,1)]:
        c.line(a[0]+dx,a[1]+dy,b[0]+dx,b[1]+dy,"o")
    c.line(*a,*b,"v" if lit else "b")
    if lit:c.point(b[0],b[1],"c")


def leaf(c,x,y,right=True):
    # A small pointed retained leaf; no fruit/flower bulbs or ripeness markings.
    if right:
        c.polygon([(x-2,y),(x,y-2),(x+3,y-2),(x+1,y+2),(x-1,y+2)],"o")
        c.line(x-1,y,x+1,y-1,"j");c.point(x,y,"q");c.point(x+1,y-1,"y")
    else:
        c.polygon([(x+2,y),(x,y-2),(x-3,y-2),(x-1,y+2),(x+1,y+2)],"o")
        c.line(x+1,y,x-1,y-1,"j");c.point(x,y,"q");c.point(x-1,y-1,"y")


def ashberry_bush():
    c=Canvas()
    # Uneven multiple stems, open thorny crown, not a mushroom or a mini fruit tree.
    c.polygon([(11,31),(13,23),(12,16),(13,10),(15,3),(17,3),
               (15,11),(15,17),(16,23),(17,31)],"o")
    c.line(14,29,14,22,"r");c.line(14,22,13,16,"v")
    c.line(13,15,14,10,"v");c.line(14,10,16,4,"c")
    twig(c,(13,28),(10,22),True);twig(c,(10,22),(7,16))
    twig(c,(7,16),(4,10),True);twig(c,(7,16),(3,15))
    twig(c,(11,21),(10,13),True);twig(c,(10,13),(7,8))
    twig(c,(10,13),(12,7));twig(c,(13,18),(17,13),True)
    twig(c,(17,13),(19,7));twig(c,(17,13),(22,10),True)
    twig(c,(16,29),(19,23));twig(c,(19,23),(23,18),True)
    twig(c,(23,18),(25,12));twig(c,(25,12),(27,7),True)
    twig(c,(23,18),(28,16),True);twig(c,(28,16),(29,12))
    twig(c,(18,24),(21,27),True);twig(c,(10,23),(6,24),True)
    # Small angular thorns along the exposed canes, never berries or flowers.
    for a,b in [((6,14),(4,12)),((9,20),(6,21)),((11,15),(9,14)),
                ((14,9),(12,8)),((18,11),(20,12)),((21,20),(24,22)),
                ((25,15),(27,13)),((19,25),(18,27)),((12,25),(10,27))]:
        c.line(*a,*b,"o");c.point(*a,"w")
    # Sparse dusty leaves permit the same neutral art in winter and regrowth.
    for x,y,right in [(4,9,False),(7,8,False),(10,6,True),(15,3,True),
                       (19,7,True),(23,10,True),(27,7,True),(28,13,True),
                       (26,17,True),(21,22,True),(7,23,False)]:leaf(c,x,y,right)
    # Visible roots reach edge31; no painted ground shadow, dropped items or cut stump.
    c.line(12,28,10,30,"b");c.line(15,29,18,30,"v")
    c.line(12,30,16,30,"r");c.point(13,29,"c")
    return c


def encoded_json(obj):return (json.dumps(obj,ensure_ascii=False,indent=2)+"\n").encode()


def outputs():
    images={"sheet_machete":sheet_machete(),"ashberry_bush":ashberry_bush()}
    products={};fragment={"sheets":{},"frames":{}};bounds={};counts={}
    for key,image in images.items():
        base="ashveil-"+key.replace("_","-");sprite="original_"+key
        occupied=[(x,y) for y,row in enumerate(image.pixels) for x,p in enumerate(row) if p!="."]
        assert occupied and all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds[key]=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)];counts[key]=len(occupied)
        for ext,data in [(".png",png(image)),(".svg",svg(image,key)),("-16.png",png(preview16(image)))]:products["public/sprites/original/items/"+base+ext]=data
        fragment["sheets"][sprite]="sprites/original/items/"+base+".png";fragment["frames"][sprite]=[sprite,0,0,32,32]
    products["public/sprites/original/items/ashveil-brush-contact.png"]=png(contact(images))
    products["public/sprites/original/items/ashveil-brush-palette.json"]=encoded_json(PALETTE)
    products["tools/art/brush-manifest.fragment.json"]=encoded_json(fragment)
    records=[{"file":name,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for name,data in products.items()]
    source={"created":"2026-10-21","license":"CC0-1.0","commercialUseAllowed":True,"redistributionAndDerivativePackagesAllowed":True,"attributionRequired":False,"method":"new integer-coordinate machete and unfruited thorny bush geometry; own generic Canvas/PNG/SVG/font helpers reused","source":"tools/art/draw-brush-originals.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"externalImageInputs":[],"existingImagesCopiedCroppedOrRecolored":False,"integrationApplied":False,"proposedTargets":TARGETS,"nativeSize":[32,32],"smallPreviewSize":[16,16],"alphaValues":[0,255],"paletteOpaqueColors":len(PALETTE),"opaqueBoundsInclusive":bounds,"opaquePixels":counts,"referenceFiles":[{"path":name,"sha256":hashlib.sha256((ROOT/name).read_bytes()).hexdigest()} for name in ["tools/art/brush-reference-contract.json","tools/art/brush-render-recommendation.json"]],"notEncoded":["ripe berries","fruit presence","harvest quantity","summer readiness","winter biology","clear or drop rules","damage","quality","new NPC or species","contamination","weapon state"],"visualInterpretation":"Plain broad steel farming-tool machete and sparse grey thorny multi-stem ashberry bush with small retained leaves and no fruit/flower depiction. Renderer scale/tint recommendations are metadata only,not Def patches.","files":records}
    products["public/sprites/original/items/ashveil-brush-source.json"]=encoded_json(source)
    return products


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args();products=outputs()
    for name,data in products.items():
        p=ROOT/name
        if args.check:assert p.read_bytes()==data,f"repro mismatch: {name}"
        else:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic original machete/bush files")


if __name__=="__main__":main()
