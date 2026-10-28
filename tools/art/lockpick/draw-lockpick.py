#!/usr/bin/env python3
"""Hand-authored original ASHVEIL lockpick icon, without image inputs.

Run: python3 draw-lockpick.py [--check]
Outputs only into this isolated directory; Python standard library only.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parent
PALETTE = {
    "o": "#172429",  # same cool contour as the project's original items
    "u": "#353d40",  # old steel shadow
    "v": "#626e6c",  # old steel
    "w": "#8b9387",  # rubbed steel edge
    "p": "#b8b39f",  # restrained bright steel tip
    "b": "#3d3331",  # leather undercut
    "r": "#6c5141",  # small worn leather handle
    "n": "#987354",  # leather edge
    "a": "#b78047",  # small ferrule, never a decorative gold key bow
}


class Canvas:
    def __init__(self, width=32, height=32, fill="."):
        self.width, self.height = width, height
        self.pixels = [[fill] * width for _ in range(height)]

    def point(self, x, y, color):
        assert 0 <= x < self.width and 0 <= y < self.height
        self.pixels[y][x] = color

    def rect(self, x, y, width, height, color):
        for py in range(y, y + height):
            for px in range(x, x + width):
                self.point(px, py, color)

    def line(self, x0, y0, x1, y1, color):
        dx, sx = abs(x1-x0), 1 if x0 < x1 else -1
        dy, sy = -abs(y1-y0), 1 if y0 < y1 else -1
        error = dx + dy
        while True:
            self.point(x0, y0, color)
            if x0 == x1 and y0 == y1:
                break
            twice = error * 2
            if twice >= dy:
                error += dy
                x0 += sx
            if twice <= dx:
                error += dx
                y0 += sy

    def blit(self, image, x, y, scale=1):
        for py, row in enumerate(image.pixels):
            for px, color in enumerate(row):
                if color != ".":
                    self.rect(x + px*scale, y + py*scale, scale, scale, color)

    def row(self, x, y, value):
        for i, color in enumerate(value):
            if color != ".":
                self.point(x+i, y, color)


def path(c, points, color):
    for (x0,y0),(x1,y1) in zip(points,points[1:]):
        c.line(x0,y0,x1,y1,color)


def outlined_path(c, points):
    # A one-pixel metal spine with a hand-pixeled contour, not antialiasing.
    for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]:
        path(c,[(x+dx,y+dy) for x,y in points],"o")
    path(c,points,"v")


def lockpick():
    c=Canvas()
    # Long thin pick, rising from the tiny leather handle. Its open hook has no
    # closed ring, key bow or toothed bit: the user can read it as a precision tool.
    pick=[(8,23),(11,19),(14,15),(17,11),(20,7),(21,5),(23,4),(25,5),(25,7),(24,8)]
    outlined_path(c,pick)
    path(c,[(9,21),(11,18),(14,14),(17,10),(20,6)],"w")
    path(c,[(21,5),(23,4),(24,5)],"p")
    c.point(25,6,"w")
    c.point(24,8,"w")
    c.point(16,12,"u")
    # The lower-left handle is seven pixels long. A few diagonal stitches stop it
    # looking like a large fantasy key grip, while the shaft stays slender.
    c.row(7,21,"ouuo")
    c.row(6,22,"oubbuo")
    c.row(5,23,"obnrbo")
    c.row(4,24,"obrrbo")
    c.row(3,25,"obnrbo")
    c.row(3,26,"obrrbo")
    c.row(4,27,"obnbo")
    c.row(5,28,"obbo")
    c.point(8,22,"a")
    c.point(6,24,"n")
    c.point(5,26,"b")
    # Separate narrow L-shaped tension wrench. It has no leather/key bow and
    # turns at the upper end, visibly independent from the curved hook tool.
    wrench=[(17,28),(18,26),(20,22),(22,18),(24,14),(28,16)]
    outlined_path(c,wrench)
    path(c,[(18,27),(20,23),(22,19),(24,15)],"w")
    path(c,[(24,14),(27,15),(28,16)],"p")
    c.point(17,28,"u")
    c.point(22,20,"u")
    c.point(27,17,"u")
    return c


def half(c):
    # Center-sampled nearest-neighbor preview of the actual 16px UI silhouette.
    out=Canvas(16,16)
    for y in range(16):
        for x in range(16):
            out.pixels[y][x]=c.pixels[2*y+1][2*x+1]
    return out


def rgba(color):
    return bytes(4) if color=="." else bytes.fromhex(PALETTE.get(color,color).lstrip("#"))+b"\xff"


def png(c):
    def chunk(kind,data):
        return struct.pack(">I",len(data))+kind+data+struct.pack(">I",zlib.crc32(kind+data)&0xffffffff)
    raw=b"".join(b"\0"+b"".join(rgba(p) for p in row) for row in c.pixels)
    return b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",c.width,c.height,8,6,0,0,0))+chunk(b"IDAT",zlib.compress(raw,9))+chunk(b"IEND",b"")


def svg(c):
    lines=['<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges">',
           '  <title>ASHVEIL original lockpick and L-shaped tension wrench</title>',
           '  <desc>Original hand-authored integer pixels. Thin open hook, small leather handle and a separate L-shaped old-steel wrench. No external image references.</desc>']
    for y,row in enumerate(c.pixels):
        x=0
        while x<c.width:
            end,color=x+1,row[x]
            while end<c.width and row[end]==color:
                end+=1
            if color!=".":
                lines.append(f'  <rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{PALETTE[color]}"/>')
            x=end
    return ("\n".join(lines)+"\n</svg>\n").encode()


FONT={
    "A":"01110/10001/10001/11111/10001/10001/10001", "C":"01111/10000/10000/10000/10000/10000/01111",
    "D":"11110/10001/10001/10001/10001/10001/11110", "E":"11111/10000/10000/11110/10000/10000/11111",
    "F":"11111/10000/10000/11110/10000/10000/10000", "G":"01111/10000/10000/10111/10001/10001/01111",
    "H":"10001/10001/10001/11111/10001/10001/10001", "I":"11111/00100/00100/00100/00100/00100/11111",
    "K":"10001/10010/10100/11000/10100/10010/10001", "L":"10000/10000/10000/10000/10000/10000/11111",
    "M":"10001/11011/10101/10101/10001/10001/10001",
    "N":"10001/11001/11001/10101/10011/10011/10001", "O":"01110/10001/10001/10001/10001/10001/01110",
    "P":"11110/10001/10001/11110/10000/10000/10000", "R":"11110/10001/10001/11110/10100/10010/10001",
    "S":"01111/10000/10000/01110/00001/00001/11110", "T":"11111/00100/00100/00100/00100/00100/00100",
    "U":"10001/10001/10001/10001/10001/10001/01110", "V":"10001/10001/10001/10001/10001/01010/00100",
    "W":"10001/10001/10001/10101/10101/10101/01010", "X":"10001/10001/01010/00100/01010/10001/10001",
    "Y":"10001/10001/01010/00100/00100/00100/00100",
    "1":"00100/01100/00100/00100/00100/00100/01110", "2":"01110/10001/00001/00010/00100/01000/11111",
    "3":"11110/00001/00001/01110/00001/00001/11110", "4":"00010/00110/01010/10010/11111/00010/00010",
    "6":"00110/01000/10000/11110/10001/10001/01110", "8":"01110/10001/10001/01110/10001/10001/01110",
    "/":"00001/00001/00010/00100/01000/10000/10000",
    " ":"00000/00000/00000/00000/00000/00000/00000"
}


def text(c,x,y,value,scale=1):
    for i,letter in enumerate(value):
        for py,row in enumerate(FONT[letter].split("/")):
            for px,bit in enumerate(row):
                if bit=="1":
                    c.rect(x+(i*6+px)*scale,y+py*scale,scale,scale,"#b8b39f")


def review(art,small):
    c=Canvas(640,394,"#20292b")
    text(c,20,16,"ASHVEIL / LOCKPICK",2)
    text(c,20,40,"ORIGINAL STEEL HOOK / L TENSION WRENCH")
    for x,bg in [(16,"#10191b"),(180,"#c8c5b3")]:
        c.rect(x,64,152,152,bg)
        c.blit(art,x+12,76,4)
    for x,bg in [(344,"#10191b"),(492,"#c8c5b3")]:
        c.rect(x,64,132,152,bg)
        c.blit(small,x+2,76,8)
    text(c,20,228,"32PX ORIGINAL / 4X")
    text(c,348,228,"16PX PREVIEW / 8X")
    c.rect(16,254,608,66,"#303b39")
    text(c,28,268,"NATIVE 32PX")
    c.blit(art,180,267)
    text(c,292,268,"NATIVE 16PX")
    c.blit(small,444,275)
    text(c,20,336,"PHYSICAL GRID 1X2 / FRAME LOCKPICK")
    for i,col in enumerate(PALETTE.values()):
        c.rect(20+i*36,360,28,20,col)
    return c


def encoded_json(value):
    return (json.dumps(value,ensure_ascii=False,indent=2)+"\n").encode()


def products():
    art=lockpick()
    small=half(art)
    outputs={
        "lockpick.png":png(art),"lockpick.svg":svg(art),
        "lockpick-preview-16.png":png(small),
        "lockpick-review.png":png(review(art,small)),
        "lockpick-palette.json":encoded_json(PALETTE),
        "lockpick-frames.fragment.json":encoded_json({"sheets":{"original_lockpick":"sprites/original/items/lockpick.png"},"frames":{"lockpick":["original_lockpick",0,0,32,32]}}),
    }
    alpha=[rgba(p)[3] for row in art.pixels for p in row]
    assert sorted(set(alpha))==[0,255]
    outputs["lockpick-integrity.json"]=encoded_json({
        "method":"original manually authored integer-coordinate pixel art",
        "externalImageInputs":[],"modifiedExistingImages":False,
        "generator":"draw-lockpick.py","generatorSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "provenance":"SOURCE.md","provenanceSha256":hashlib.sha256((ROOT/'SOURCE.md').read_bytes()).hexdigest(),
        "paletteNote":"Uses the project's existing original-item steel/leather/contour palette subset; new drawing coordinates.",
        "registrationStatus":"isolated original art; not registered in game",
        "physicalItemGrid":[1,2],"frame":"lockpick","width":32,"height":32,"pngColorType":6,
        "alphaValues":[0,255],"transparentPixels":alpha.count(0),"opaquePixels":alpha.count(255),
        "preview16Method":"nearest-neighbor center sample, source pixel (2*x+1,2*y+1)",
        "files":[{"file":name,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()} for name,data in outputs.items()]
    })
    return outputs


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check",action="store_true",help="Check every generated byte without writing files")
    args=parser.parse_args()
    outputs=products()
    for name,data in outputs.items():
        target=ROOT/name
        if args.check:
            if not target.exists() or target.read_bytes()!=data:
                raise SystemExit("Byte mismatch: "+name)
        else:
            target.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(outputs))+" deterministic original-art files")


if __name__=="__main__":
    main()
