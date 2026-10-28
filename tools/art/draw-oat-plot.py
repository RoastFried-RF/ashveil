#!/usr/bin/env python3
"""새 좌표의 땅에 자란 귀리밭 원본. CC0, 외부 이미지/이전 알곡 그림 입력 없음."""
from __future__ import annotations
import argparse, hashlib, json, struct, zlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PALETTE={'o': '#172429', 'k': '#30332f', 'b': '#514635', 'r': '#7c6848', 'n': '#9d8759', 's': '#bea874', 'h': '#e0c99a', 'f': '#ebe0be', 'd': '#394944', 't': '#526157', 'm': '#73806b', 'l': '#9b9f83', 'c': '#817f72', 'p': '#b8b39f', 'i': '#e0d8bf', 'u': '#4b5149', 'v': '#727869', 'w': '#969c83'}

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


def ear(c,x,y):
    # New compact hanging seed-head geometry, attached at its pointed top.
    c.polygon([(x+2,y),(x+4,y+2),(x+4,y+5),(x+2,y+7),
               (x,y+5),(x,y+2)],"o")
    c.polygon([(x+2,y+1),(x+3,y+3),(x+3,y+5),(x+2,y+6),
               (x+1,y+4)],"r")
    c.line(x+1,y+2,x+2,y+5,"s");c.point(x+2,y+3,"h")


def plot():
    c=Canvas()
    # Irregular native dirt furrows, transparent around the cultivated clod.
    c.polygon([(3,26),(9,24),(15,25),(22,24),(28,26),(30,28),
               (26,30),(18,30),(11,29),(5,30),(2,28)],"k")
    c.line(4,27,12,26,"b");c.line(16,27,26,26,"b")
    c.line(6,29,15,28,"b");c.line(21,29,27,28,"b")
    c.point(5,27,"c");c.point(14,26,"c");c.point(27,27,"r")
    # Three independent rooted straw stems; no detached grain pile.
    c.line(9,28,8,6,"o");c.line(10,27,9,7,"u")
    c.line(9,24,8,10,"v");c.point(8,8,"w")
    c.line(17,28,16,2,"o");c.line(18,27,17,3,"v")
    c.line(17,23,17,13,"w")
    c.line(24,28,25,6,"o");c.line(23,27,24,7,"u")
    c.line(24,24,25,10,"v")
    # Narrow grey-green leaves, not a broad tree canopy or mushroom cap.
    for points in [[(9,25),(4,18),(3,17),(5,23),(10,27)],
                   [(10,22),(13,18),(14,17),(12,24),(10,26)],
                   [(17,26),(13,21),(12,20),(14,26),(18,28)],
                   [(23,26),(28,19),(29,18),(27,25),(24,28)]]:
        c.polygon(points,"d")
    c.line(5,21,8,25,"m");c.line(12,21,11,24,"t")
    c.line(14,23,17,27,"t");c.line(27,22,25,26,"m")
    # Open drooping panicles with distinct little oat heads.
    for x0,y0,x1,y1 in [(8,8,5,10),(9,13,12,15),(17,4,12,5),
                        (17,9,20,10),(17,15,14,17),(25,9,27,11),
                        (24,16,21,18)]:
        c.line(x0,y0,x1,y1,"o");c.line(x0,y0,x1,y1-1,"v")
    for x,y in [(3,9),(10,14),(10,4),(18,9),(12,16),(25,10),(19,17)]:ear(c,x,y)
    # Root strokes join the stems into the clod; no mature/young stage field.
    c.line(8,27,10,28,"r");c.line(17,27,19,28,"b")
    c.line(23,27,25,28,"r")
    return c


def reduced(image,size):
    c=Canvas(size,size)
    for y in range(size):
        for x in range(size):c.point(x,y,image.pixels[min(31,(2*y+1)*32//(2*size))][min(31,(2*x+1)*32//(2*size))])
    return c


def contact(image):
    c=Canvas(384,352,"#11191f");small=preview16(image);young=reduced(image,19)
    for left in [0,192]:c.rect(left+8,8,176,336,"#1b272c")
    c.blit(image,32,20,4);c.blit(young,224,72,4)
    for left in [0,192]:
        for start,bg in [(left+24,"#11191f"),(left+104,"#b8b39f")]:
            c.rect(start,168,64,80,bg)
            if left==0:c.blit(image,start+16,172)
            else:c.blit(young,start+22,184)
            c.blit(small,start+24,226);c.rect(start,264,64,64,bg);c.blit(small,start,264,4)
    return c


def encoded_json(value):return (json.dumps(value,ensure_ascii=False,indent=2)+"\n").encode()


def outputs():
    image=plot();stem="public/sprites/original/terrain/ashveil-hearth-oat-plot";key="original_hearth_oat_plot"
    occupied=[(x,y) for y,row in enumerate(image.pixels) for x,p in enumerate(row) if p!="."]
    assert all(0<x<31 and 0<y<31 for x,y in occupied)
    bounds=[min(x for x,y in occupied),min(y for x,y in occupied),max(x for x,y in occupied),max(y for x,y in occupied)]
    products={stem+".png":png(image),stem+".svg":svg(image,"흙고랑에 뿌리내린 성숙 귀리"),stem+"-16.png":png(preview16(image)),stem+"-contact.png":png(contact(image)),stem+"-palette.json":encoded_json(PALETTE),"tools/art/oat-plot-manifest.fragment.json":encoded_json({"sheets":{key:"sprites/original/terrain/ashveil-hearth-oat-plot.png"},"frames":{key:[key,0,0,32,32]}})}
    source={"created":"2026-10-21","license":"CC0-1.0","commercialUseAllowed":True,"redistributionAndDerivativePackagesAllowed":True,"attributionRequired":False,"source":"tools/art/draw-oat-plot.py","sourceSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),"referenceContract":"tools/art/oat-plot-reference-contract.json","referenceContractSha256":hashlib.sha256((ROOT/"tools/art/oat-plot-reference-contract.json").read_bytes()).hexdigest(),"method":"새 정수 도형의 흙고랑·뿌리내린3줄기·처진7이삭. 기존 알곡 pile/이미지를 확대하거나 좌표 복사하지 않음.","externalImageInputs":[],"existingImagesCopiedEditedOrRecolored":False,"existingOatGeometryReused":False,"nativeSize":[32,32],"smallSize":[16,16],"paletteEntries":18,"alphaValues":[0,255],"key":key,"proposedTarget":"Terrain.OatPlot","opaqueBoundsInclusive":bounds,"opaquePixels":len(occupied),"groundBottomEdge":30,"optionalArtFootPoint":[16,30],"rootedStemCountByDesign":3,"contactReducedPreviewSize":[19,19],"contactReductionApproximation":True,"integrationApplied":False,"newGrowthStageField":False,"files":[{"file":p,"bytes":len(b),"sha256":hashlib.sha256(b).hexdigest()} for p,b in products.items()]}
    products[stem+"-source.json"]=encoded_json(source);return products


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--check",action="store_true");args=parser.parse_args();products=outputs()
    for name,data in products.items():
        path=ROOT/name
        if args.check:assert path.read_bytes()==data,f"deterministic mismatch: {name}"
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(("CHECK PASS: " if args.check else "WROTE: ")+str(len(products))+" deterministic original oat plot files")


if __name__=="__main__":main()
