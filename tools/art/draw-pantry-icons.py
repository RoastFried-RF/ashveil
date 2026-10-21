#!/usr/bin/env python3

"""Original CC0 pantry qualitative-status pictograms; no image inputs or game import."""

from __future__ import annotations

import argparse

import hashlib

import json

from pathlib import Path

import struct

import zlib

ROOT=Path(__file__).resolve().parents[2]

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

STATES=("full","low","empty")


def basket_back(c):
    # One shared arched wood handle. No futuristic panel, stamp or numeric mark.
    c.polygon([(7,15),(7,10),(9,6),(12,4),(19,4),(23,6),
               (25,10),(25,15),(22,15),(22,11),(20,8),(18,7),
               (13,7),(11,9),(10,11),(10,15)],"o")
    c.line(8,14,8,10,"r");c.line(8,10,10,7,"n")
    c.line(10,7,13,5,"n");c.line(13,5,18,5,"n")
    c.line(19,5,22,7,"r");c.line(22,7,24,11,"r")
    c.line(24,11,24,14,"b")
    c.point(11,6,"f");c.point(17,5,"c");c.point(22,8,"c")
    # Ash-worn shallow basket body and a clearly open dark interior.
    c.polygon([(3,15),(6,12),(25,12),(29,15),(27,25),
               (24,29),(7,29),(4,26)],"o")
    c.polygon([(5,16),(7,14),(24,14),(27,16),(25,24),
               (23,27),(9,27),(6,24)],"r")
    c.polygon([(6,14),(24,14),(27,16),(24,20),(8,20),(4,17)],"b")
    c.polygon([(7,15),(23,15),(25,16),(23,18),(9,19),(6,17)],"k")
    c.line(8,17,12,18,"b");c.line(17,18,23,17,"b")


def full_contents(c):
    # Two irregular cloth-wrapped masses illustrate fullness, not exact units.
    c.polygon([(5,14),(7,10),(10,8),(14,9),(16,13),(15,18),
               (11,20),(7,19),(5,17)],"o")
    c.polygon([(7,14),(8,11),(11,10),(13,11),(14,14),(13,18),
               (9,18),(7,17)],"c")
    c.polygon([(8,13),(10,10),(12,11),(13,14),(12,17),
               (9,17),(8,16)],"p")
    c.line(9,12,10,11,"h");c.line(8,16,10,17,"h")
    c.line(12,11,11,17,"r");c.point(11,14,"n")
    c.polygon([(14,14),(16,11),(20,10),(24,12),(26,15),
               (25,18),(22,20),(17,19)],"o")
    c.polygon([(16,14),(18,12),(21,12),(24,14),(24,17),
               (21,18),(18,18)],"p")
    c.polygon([(18,13),(20,12),(22,13),(23,15),(22,16),
               (19,16),(17,15)],"h")
    c.line(20,12,19,17,"c");c.line(16,15,22,17,"c")
    c.point(22,14,"p");c.point(18,17,"n")


def low_contents(c):
    # A small flattened bundle leaves most of the basket's opening visible.
    c.polygon([(8,17),(10,14),(14,14),(17,16),(17,19),
               (12,20),(8,19)],"o")
    c.polygon([(10,17),(11,15),(14,15),(16,17),(14,19),
               (10,18)],"c")
    c.polygon([(11,16),(14,15),(15,17),(13,18),(10,17)],"p")
    c.point(12,16,"h");c.line(13,15,12,18,"r")


def basket_front(c):
    # This foreground weave is byte-identical in every state.
    c.polygon([(4,19),(10,20),(23,20),(28,18),(26,25),
               (23,28),(8,28),(5,25)],"b")
    c.polygon([(6,20),(11,21),(22,21),(26,20),(24,25),
               (22,27),(9,27),(7,24)],"r")
    c.polygon([(8,21),(14,22),(23,21),(23,25),(20,27),
               (11,26),(9,24)],"n")
    for x,y,w in [(7,22,17),(8,24,15),(10,26,11)]:
        c.line(x,y,x+w-1,y,"b")
        c.line(x+1,y+1,x+w-2,y+1,"r")
    for x in [8,12,16,20,24]:
        c.line(x,21,x+1,26,"b")
        c.point(x,22,"n")
    c.line(5,19,10,21,"n");c.line(10,21,22,21,"c")
    c.line(22,21,27,19,"n")
    c.line(8,28,23,28,"o");c.line(9,29,22,29,"b")
    # A few ash/old straw edges, no food dots or state marker.
    c.point(6,23,"c");c.point(23,24,"c");c.point(11,25,"f")
    c.point(19,27,"c");c.point(8,26,"n")


def icon(state):
    c=Canvas()
    basket_back(c)
    if state=="full":full_contents(c)
    elif state=="low":low_contents(c)
    else:assert state=="empty"
    basket_front(c)
    return c


def contact(icons):
    # No text/digits even on this review sheet. Left-to-right full/low/empty.
    c=Canvas(576,352,"#11191f")
    for index,(key,image) in enumerate(icons.items()):
        left=index*192;small=preview16(image)
        c.rect(left+8,8,176,336,"#1b272c")
        c.blit(image,left+32,20,4)
        for start,bg in [(left+24,"#11191f"),(left+104,"#b8b39f")]:
            c.rect(start,168,64,80,bg)
            c.blit(image,start+16,172);c.blit(small,start+24,226)
            c.rect(start,264,64,64,bg);c.blit(small,start,264,4)
    return c


def encoded_json(value):return (json.dumps(value,ensure_ascii=False,indent=2)+"\n").encode()


def outputs():
    icons={s:icon(s) for s in STATES};products={};fragment={"sheets":{},"frames":{}};bounds={};opaque={}
    for state,image in icons.items():
        name="ashveil-pantry-"+state;sprite="original_pantry_"+state
        occupied=[(x,y) for y,row in enumerate(image.pixels) for x,v in enumerate(row) if v!="."]
        assert occupied and all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds[state]=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)];opaque[state]=len(occupied)
        for ext,data in [(".png",png(image)),(".svg",svg(image,"qualitative pantry "+state)),("-16.png",png(preview16(image)))]:products["public/sprites/original/ui/"+name+ext]=data
        fragment["sheets"][sprite]="sprites/original/ui/"+name+".png";fragment["frames"][sprite]=[sprite,0,0,32,32]
    products["public/sprites/original/ui/ashveil-pantry-contact.png"]=png(contact(icons))
    products["public/sprites/original/ui/ashveil-pantry-palette.json"]=encoded_json(PALETTE)
    products["tools/art/pantry-manifest.fragment.json"]=encoded_json(fragment)
    records=[{"file":p,"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest()} for p,b in products.items()]
    source={"created":"2026-10-21","license":"CC0-1.0","commercialUseAllowed":True,"redistributionAndDerivativePackagesAllowed":True,"attributionRequired":False,"source":"tools/art/draw-pantry-icons.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"contract":"tools/art/pantry-art-contract.json","contractSha256":hashlib.sha256((ROOT/"tools/art/pantry-art-contract.json").read_bytes()).hexdigest(),"method":"new authored basket/cloth integer-coordinate geometry; same common basket reused across three new qualitative states","externalImageInputs":[],"existingImagesCopiedEditedOrRecolored":False,"integrationApplied":False,"keys":["original_pantry_"+s for s in STATES],"nativeSize":[32,32],"smallSize":[16,16],"paletteEntries":len(PALETTE),"alphaValues":[0,255],"stateOrder":list(STATES),"opaqueBoundsInclusive":bounds,"opaquePixels":opaque,"sharedFootPoint":[16,30],"groundBottomEdge":30,"sharedContainerOutsideContentRegionXYXY":[4,8,28,20],"noRenderedTextDigitsOrSymbols":True,"visualInterpretation":"Identical ash-worn wood/straw basket and handle, ample cloth-wrapped food bundles, one small remaining packet, or empty dark interior. Relative fullness only; not exact item counts or economy thresholds.","notEncoded":["exact numerical quantity","supply thresholds","calories","prices","quality","freshness","safety","economic production","forecasts","world food generation"],"files":records}
    products["public/sprites/original/ui/ashveil-pantry-source.json"]=encoded_json(source)
    return products


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args();products=outputs()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"deterministic mismatch: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic original pantry icon files")


if __name__=="__main__":main()
