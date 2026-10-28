#!/usr/bin/env python3
"""New integer-coordinate survival-item art. CC0. No existing image input."""
from __future__ import annotations
import argparse, hashlib, json, struct, zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PALETTE={"o":"#172429","k":"#2c3534","d":"#404b46","c":"#6c7667","p":"#a3a88b","h":"#d0ccb0","i":"#e6dcc0","t":"#4a655d","u":"#718575","v":"#9ba78b","b":"#443a30","r":"#71553a","n":"#9b7750","s":"#bb9967","w":"#ddd0a1","g":"#596461","m":"#7e8980","l":"#a9afa0","f":"#d0d1ba","a":"#8a7559"}

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



def ellipse(c,cx,cy,rx,ry,color):
    for y in range(c.height):
        for x in range(c.width):
            if ((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1:
                c.point(x,y,color)

def cloth():
    c=Canvas()
    # An irregular opened rag: loose edge, deep folds and actual cut-away tears.
    c.polygon([(6,7),(12,5),(18,6),(25,4),(28,11),(25,17),
               (28,24),(23,27),(17,26),(9,30),(5,25),(3,18),
               (5,12)],"o")
    c.polygon([(7,8),(12,7),(18,8),(24,6),(26,11),(23,18),
               (26,23),(22,25),(17,24),(10,28),(7,24),(5,18)],"d")
    c.polygon([(7,10),(12,8),(17,9),(22,7),(24,10),(21,16),
               (23,22),(17,22),(10,26),(8,21)],"c")
    c.polygon([(8,10),(12,9),(15,10),(12,15),(10,23),(8,21),
               (7,17)],"p")
    c.polygon([(16,11),(21,8),(23,10),(20,15),(22,20),
               (18,20),(15,18)],"u")
    c.line(12,11,10,19,"h")
    c.line(14,11,12,20,"d");c.line(13,21,11,25,"d")
    c.line(17,10,15,15,"t");c.line(18,21,21,23,"p")
    c.line(7,20,9,24,"c")
    # Ragged holes/tears alter the silhouette, not a medical/effect emblem.
    c.polygon([(23,7),(25,6),(26,10),(23,11)],".")
    c.polygon([(7,26),(10,24),(11,28),(9,30)],".")
    c.polygon([(25,19),(28,18),(27,22),(25,22)],".")
    c.point(6,24,"p");c.point(10,28,"c");c.point(22,25,"p")
    c.point(6,8,"c");c.point(24,5,"p")
    return c

def bandage():
    c=Canvas()
    # Tidy rolled cloth, with a round end and short folded tail; no cross.
    c.polygon([(10,8),(21,6),(26,8),(28,12),(27,17),(22,21),
               (15,23),(8,22),(4,18),(3,13),(6,9)],"o")
    c.polygon([(12,9),(21,8),(25,9),(26,13),(25,17),(21,19),
               (14,21),(8,19),(6,14)],"p")
    c.polygon([(13,9),(21,8),(24,9),(24,12),(20,14),(14,16),
               (9,15)],"h")
    c.line(14,10,22,9,"i");c.line(19,15,25,12,"c")
    c.line(19,18,24,15,"d");c.line(21,19,24,17,"c")
    # A short unspooled edge makes this a roll rather than a loaf or stone.
    c.polygon([(18,20),(23,18),(25,21),(24,25),(27,27),
               (25,30),(19,29),(16,25)],"o")
    c.polygon([(19,21),(22,20),(23,22),(22,25),(25,27),
               (24,28),(20,27),(18,24)],"h")
    c.line(19,23,22,22,"p");c.line(21,26,24,27,"c")
    # Hand-built layered oval cross-section, deliberately unlike rag geometry.
    ellipse(c,10,15,7,7,"o")
    ellipse(c,10,15,6,6,"p")
    ellipse(c,10,15,5,5,"h")
    c.line(8,10,11,10,"i");c.line(12,11,14,13,"p")
    c.line(14,14,13,17,"c");c.line(12,18,9,19,"c")
    c.line(8,18,6,16,"c");c.line(6,15,7,13,"p")
    c.line(8,12,10,12,"p");c.line(11,13,12,14,"c")
    c.line(12,15,11,16,"d");c.line(10,16,9,15,"c")
    c.point(9,14,"p");c.point(6,12,"i")
    return c

def torch():
    c=Canvas()
    # One static noun image: no flame, ember, smoke, light halo or fuel gauge.
    c.polygon([(21,11),(26,14),(13,28),(9,30),(5,28),
               (6,25)],"o")
    c.polygon([(21,14),(23,15),(12,27),(9,28),(7,27),
               (8,25)],"r")
    c.line(21,16,9,27,"n");c.line(18,20,11,27,"b")
    c.point(8,27,"s");c.line(14,22,17,20,"a")
    # Broader wrapped fibre head tilted along the shaft. No lantern cage.
    c.polygon([(19,3),(24,2),(27,5),(29,9),(28,13),
               (25,17),(20,16),(17,12),(16,7)],"o")
    c.polygon([(20,5),(23,4),(26,6),(27,9),(26,13),
               (24,15),(21,14),(19,11),(18,7)],"d")
    c.polygon([(20,5),(23,4),(25,6),(26,9),(24,12),
               (21,12),(19,9)],"c")
    c.line(20,5,25,8,"p");c.line(19,8,25,11,"h")
    c.line(20,11,24,14,"p");c.line(21,14,24,15,"a")
    c.line(18,7,20,10,"t");c.line(24,6,26,9,"u")
    c.point(23,4,"h");c.point(26,12,"p")
    return c

def campfire_kit():
    c=Canvas()
    # Detached stone surround plus bound wood: not an installed burning fire.
    for outer,inner in [
        ([(5,8),(10,7),(13,10),(11,14),(5,14),(3,11)],
         [(6,9),(10,9),(11,11),(9,13),(5,12)]),
        ([(15,5),(20,5),(22,8),(20,11),(15,11),(13,8)],
         [(16,6),(19,6),(20,8),(18,10),(15,9)]),
        ([(24,10),(28,11),(30,15),(27,18),(23,16),(22,13)],
         [(25,12),(27,12),(28,15),(26,16),(24,15)])
    ]:
        c.polygon(outer,"o");c.polygon(inner,"m")
    c.line(6,9,9,9,"l");c.line(16,7,19,7,"f")
    c.line(25,12,27,14,"l")
    c.polygon([(6,21),(9,17),(21,8),(25,10),(24,14),
               (12,24),(8,26)],"o")
    c.polygon([(9,20),(21,10),(23,11),(22,14),(11,23),
               (8,24)],"r")
    c.line(10,20,21,11,"n");c.line(12,21,22,13,"b")
    c.polygon([(10,25),(12,20),(23,12),(27,15),(25,19),
               (15,28),(11,28)],"o")
    c.polygon([(12,24),(15,20),(23,14),(25,16),(23,19),
               (15,26),(12,27)],"n")
    c.line(15,23,23,17,"r")
    ellipse(c,9,23,3,2,"b");ellipse(c,9,23,2,1,"s")
    c.point(9,22,"w")
    ellipse(c,13,26,3,2,"b");ellipse(c,13,26,2,1,"s")
    c.point(13,25,"w")
    # One broad lashing, not an exact recipe count or an inventory stack.
    c.line(13,16,21,22,"o");c.line(13,17,20,22,"p")
    c.line(14,16,21,21,"h");c.line(15,18,13,20,"a")
    c.point(18,20,"i")
    for outer,inner in [
        ([(4,20),(8,19),(11,22),(10,26),(6,28),(2,25)],
         [(5,21),(8,21),(9,23),(8,26),(5,26),(3,24)]),
        ([(25,22),(29,24),(28,28),(23,30),(19,27),(20,23)],
         [(24,23),(27,24),(27,27),(23,28),(21,26),(22,24)]),
        ([(13,27),(17,26),(20,28),(18,30),(12,30),(10,28)],
         [(13,28),(17,27),(18,28),(17,29),(13,29)])
    ]:
        c.polygon(outer,"o");c.polygon(inner,"g")
    c.line(5,22,8,22,"l");c.line(4,24,6,25,"m")
    c.line(23,24,26,24,"l");c.line(25,27,27,26,"m")
    c.line(13,28,16,28,"m")
    return c

def stone():
    c=Canvas()
    # Portable irregular flint, one broken mass with broad natural fractures.
    c.polygon([(9,7),(18,4),(24,7),(28,13),(28,18),
               (25,24),(20,28),(11,30),(5,25),(3,18),
               (5,12)],"o")
    c.polygon([(10,8),(18,6),(23,8),(26,13),(26,18),
               (23,23),(19,26),(11,28),(7,24),(5,18),
               (7,13)],"g")
    c.polygon([(10,9),(17,7),(21,8),(22,13),(17,17),
               (10,16),(7,13)],"l")
    c.polygon([(9,17),(17,18),(19,24),(12,27),(8,23),
               (6,18)],"m")
    c.polygon([(23,10),(26,14),(25,19),(22,22),(19,18),
               (22,15)],"m")
    c.polygon([(11,9),(17,8),(19,9),(17,12),(12,13),
               (8,13)],"f")
    c.line(10,15,16,16,"m");c.line(18,17,20,22,"k")
    c.line(8,20,11,24,"l");c.line(13,26,17,25,"g")
    c.point(23,13,"l");c.line(22,19,24,17,"g")
    c.point(6,16,"m");c.point(20,26,"c")
    return c

def reduced(icon,size):
    c=Canvas(size,size)
    for y in range(size):
        for x in range(size):
            c.point(x,y,icon.pixels[((2*y+1)*32)//(2*size)][((2*x+1)*32)//(2*size)])
    return c

def contact(icons):
    c=Canvas(800,352,"#11191f")
    for index,(state,image) in enumerate(icons.items()):
        left=index*160;small=preview16(image);ground=reduced(image,12)
        c.rect(left+8,8,144,336,"#1b272c")
        c.blit(image,left+16,16,4)
        for start,bg in [(left+12,"#11191f"),(left+84,"#b8b39f")]:
            c.rect(start,160,64,96,bg)
            c.blit(image,start+16,164)
            c.blit(small,start+24,206);c.blit(ground,start+26,232)
            c.rect(start,272,64,64,bg);c.blit(small,start,272,4)
    return c

def encoded_json(v):return (json.dumps(v,ensure_ascii=False,indent=2)+"\n").encode()

def outputs():
    icons={"cloth":cloth(),"bandage":bandage(),"torch":torch(),
           "campfire_kit":campfire_kit(),"stone":stone()}
    targets={"cloth":"Item.Cloth","bandage":"Item.Bandage","torch":"Item.Torch",
             "campfire_kit":"Item.CampfireKit","stone":"Item.Stone"}
    products={};fragment={"sheets":{},"frames":{}};bounds={};opaque={}
    for state,image in icons.items():
        base="public/sprites/original/items/ashveil-hearth-"+state.replace("_","-")
        key="original_hearth_"+state
        occupied=[(x,y) for y,row in enumerate(image.pixels) for x,color in enumerate(row) if color!="."]
        assert occupied and all(0<x<31 and 0<y<31 for x,y in occupied)
        bounds[state]=[min(x for x,y in occupied),min(y for x,y in occupied),
                       max(x for x,y in occupied),max(y for x,y in occupied)]
        opaque[state]=len(occupied)
        products[base+".png"]=png(image)
        products[base+".svg"]=svg(image,state)
        products[base+"-16.png"]=png(preview16(image))
        fragment["sheets"][key]=base[len("public/"):]+".png"
        fragment["frames"][key]=[key,0,0,32,32]
    products["public/sprites/original/items/ashveil-survival-contact.png"]=png(contact(icons))
    products["public/sprites/original/items/ashveil-survival-palette.json"]=encoded_json(PALETTE)
    products["tools/art/survival-manifest.fragment.json"]=encoded_json(fragment)
    source={
        "created":"2026-10-21","license":"CC0-1.0","commercialUseAllowed":True,
        "redistributionAndDerivativePackagesAllowed":True,"attributionRequired":False,
        "source":"tools/art/draw-survival-items.py",
        "sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "referenceContract":"tools/art/survival-reference-contract.json",
        "referenceContractSha256":hashlib.sha256((ROOT/"tools/art/survival-reference-contract.json").read_bytes()).hexdigest(),
        "method":"New integer polygons/lines/points for torn rag, rolled bandage, neutral wrapped torch, unlit kit and natural portable flint.",
        "externalImageInputs":[],"modelImageInputs":[],
        "existingImagesCopiedEditedOrRecolored":False,
        "existingGeometryReused":False,
        "helperReuse":"Canvas and generic RGBA/PNG/SVG/16px IO helpers from this workflow's earlier own CC0 oat tool; color families reused/adjusted, all five geometry functions newly written.",
        "helperOrigin":"ashveil-oat-art/tools/art/draw-oat-items.py",
        "helperOriginSha256":"383332a50e46266e19995556036501b073103340fc2828db9338073e9e2d0b27",
        "integrationApplied":False,"nativeSize":[32,32],"smallSize":[16,16],
        "contactContainsGroundApproximation":[12,12],
        "contactGroundSampleIsNotRuntimeCapture":True,
        "paletteEntries":len(PALETTE),"alphaValues":[0,255],
        "stateOrder":list(icons),"proposedTargets":{targets[s]:"original_hearth_"+s for s in icons},
        "opaqueBoundsInclusive":bounds,"opaquePixels":opaque,
        "optionalArtBottomEdge":30,"optionalFootPoint":[16,30],
        "optionalFootIsNotNewRuntimeAnchor":True,
        "torchRepresentation":"Single state-neutral noun, no painted flame/ember/smoke/light halo. Existing item lit/fuel labels and inventory dot retain actual state. No lit/unlit sprite key transition added.",
        "notEncoded":["stack amount","exact recipe ingredients/count","fuel remaining","current lit state","healing/cleanliness/contamination answer","yield/performance","ground shadow"],
        "files":[{"file":p,"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest()} for p,b in products.items()]
    }
    products["public/sprites/original/items/ashveil-survival-source.json"]=encoded_json(source)
    return products

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check",action="store_true");args=parser.parse_args()
    products=outputs()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"deterministic mismatch: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic survival files")

if __name__=="__main__":main()
