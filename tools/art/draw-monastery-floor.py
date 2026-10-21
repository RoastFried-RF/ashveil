#!/usr/bin/env python3
"""Original ASHVEIL monastery flagstone pixels; no input image or external package.

All slab outlines, worn patches, ash marks and short cracks below are authored here.
Run this portable isolated package: python3 tools/art/draw-monastery-floor.py [--check]
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[2]
ART = Path('public/sprites/original')
NAME = 'ashveil-monastery-floor'
PALETTE = {
    'g': '#353b34',  # sunken, accumulated mortar
    'j': '#41473e',  # damp mortar lip, never black
    'e': '#4b5046',  # rounded stone edge
    'd': '#53584d',  # darker stone face
    's': '#5b6053',  # cool worn flagstone
    'w': '#626456',  # warmer neighbouring flagstone
    'f': '#696d5e',  # flattened worn surface
    'a': '#777b69',  # small settled ash strokes
    'p': '#666c5b',  # dusty worn grain
    'm': '#4b574b',  # subdued damp stain
    'c': '#3e463c',  # short hairline crack
}

# Each row is (native pixel height, individually chosen slab widths).
# Every block sums to128x128. These are four arrangements of ONE stone material,
# not four game terrain types. The renderer samples them into16px tiles.
ROWS = [
    [(16,[32,48,48]),(16,[48,32,48]),(24,[24,48,32,24]),
     (16,[40,48,40]),(16,[56,32,40]),(24,[32,48,48]),(16,[48,40,40])],
    [(16,[48,40,40]),(24,[32,56,40]),(16,[48,32,48]),
     (16,[24,48,56]),(24,[40,48,40]),(16,[56,40,32]),(16,[32,48,48])],
    [(24,[40,48,40]),(16,[56,32,40]),(16,[32,48,48]),
     (24,[48,40,40]),(16,[24,56,48]),(16,[48,32,48]),(16,[40,48,40])],
    [(16,[24,48,56]),(16,[48,40,40]),(16,[32,56,40]),
     (24,[48,32,48]),(16,[40,48,40]),(16,[56,40,32]),(24,[32,48,48])],
]

# Irregular low-contrast wear, at explicit offsets within a stone; no generated noise.
WEAR = [
    [(4,4,5,1,'p'),(8,5,4,1,'f'),(6,6,2,1,'p'),(13,8,3,1,'p')],
    [(8,4,3,1,'f'),(10,5,5,1,'p'),(12,6,3,1,'f'),(4,9,4,1,'p')],
    [(5,7,4,1,'p'),(7,8,6,1,'f'),(9,9,3,1,'p'),(15,4,4,1,'p')],
    [(3,5,3,1,'p'),(5,6,5,1,'p'),(8,7,2,1,'f'),(14,10,4,1,'p')],
    [(9,3,4,1,'p'),(7,4,6,1,'f'),(8,5,3,1,'p'),(3,10,3,1,'p')],
    [(6,8,4,1,'p'),(9,9,3,1,'f'),(12,10,4,1,'p'),(15,5,3,1,'f')],
]
# Short cracks end inside slabs; no light-emitting/tainted gaps or baked light.
CRACKS = [
    [(0,0),(2,1),(3,3),(5,4)],
    [(0,0),(1,2),(0,4),(2,5)],
    [(0,0),(2,-1),(4,0),(5,2)],
    [(0,0),(-1,2),(1,3),(2,5)],
]
# Four sets of independently placed minor damp islands, away from macro boundaries.
DAMP = [
    [(18,30),(77,59),(108,103),(40,111)],
    [(62,23),(20,82),(97,112),(112,47)],
    [(22,49),(88,22),(57,103),(104,79)],
    [(43,27),(22,100),(91,54),(71,116)],
]


class Canvas:
    def __init__(self,w,h,fill='g'):
        self.width,self.height=w,h
        self.pixels=[[fill]*w for _ in range(h)]
    def point(self,x,y,color):
        if 0<=x<self.width and 0<=y<self.height:self.pixels[y][x]=color
    def rect(self,x,y,w,h,color):
        for yy in range(y,y+h):
            for xx in range(x,x+w):self.point(xx,yy,color)
    def line(self,x0,y0,x1,y1,color):
        dx,sx=abs(x1-x0),1 if x0<x1 else -1
        dy,sy=-abs(y1-y0),1 if y0<y1 else -1
        err=dx+dy
        while True:
            self.point(x0,y0,color)
            if x0==x1 and y0==y1:break
            twice=2*err
            if twice>=dy:err+=dy;x0+=sx
            if twice<=dx:err+=dx;y0+=sy
    def polygon(self,points,color):
        for y in range(min(p[1] for p in points),max(p[1] for p in points)+1):
            for x in range(min(p[0] for p in points),max(p[0] for p in points)+1):
                inside=False;previous=points[-1]
                for px,py in points:
                    qx,qy=previous
                    if (py>y+.5)!=(qy>y+.5) and x+.5<(qx-px)*(y+.5-py)/(qy-py)+px:inside=not inside
                    previous=(px,py)
                if inside:self.point(x,y,color)
    def blit(self,other,x,y,scale=1):
        for yy,row in enumerate(other.pixels):
            for xx,color in enumerate(row):self.rect(x+xx*scale,y+yy*scale,scale,scale,color)


def stone(c,x,y,w,h,index):
    base=['s','w','d','s','s','w'][index%6]
    # Low rounded outline with tiny displaced corners; a matte surface, not bevel shine.
    c.polygon([(x+2,y+1),(x+w-3,y+1),(x+w-1,y+3),(x+w-1,y+h-3),
               (x+w-3,y+h-1),(x+2,y+h-1),(x+1,y+h-3),(x+1,y+3)],'e')
    c.polygon([(x+3,y+2),(x+w-4,y+2),(x+w-2,y+3),(x+w-2,y+h-4),
               (x+w-4,y+h-2),(x+3,y+h-2),(x+2,y+h-4),(x+2,y+4)],base)
    # Broken, small top-left worn arcs; no fixed directional lighting or glossy rim.
    c.line(x+4,y+2,x+9,y+2,'p')
    c.line(x+2,y+5,x+2,y+7,'p')
    c.line(x+w-8,y+h-2,x+w-5,y+h-2,'j')
    for dx,dy,ww,hh,color in WEAR[index%len(WEAR)]:c.rect(x+dx,y+dy,ww,hh,color)
    # A second broad, soft weathering patch makes larger slabs read as one stone.
    if w>=32:
        c.rect(x+w-15,y+h//2,7,1,'p')
        c.rect(x+w-17,y+h//2+1,11,1,'p')
        c.rect(x+w-14,y+h//2+2,5,1,'f')
    if index%3==1:
        xx,yy=x+w//2+2,y+5
        path=CRACKS[(index//3)%4]
        for (ax,ay),(bx,by) in zip(path,path[1:]):c.line(xx+ax,yy+ay,xx+bx,yy+by,'c')
        c.point(xx+2,yy+5,'j')
    # Sparse ash rests in shallow grooves; subdued and disconnected from illumination.
    if index%4 in [0,3]:
        c.rect(x+5,y+h-3,2,1,'a');c.point(x+8,y+h-4,'p')
    if index%5==2:
        c.point(x+w-3,y+4,'g');c.point(x+w-4,y+3,'j')


def block(q):
    c=Canvas(128,128)
    y=0
    for row,(height,widths) in enumerate(ROWS[q]):
        assert sum(widths)==128
        x=0
        for col,width in enumerate(widths):
            stone(c,x,y,width,height,q*23+row*7+col*3)
            x+=width
        y+=height
    assert y==128
    for x,y in DAMP[q]:
        for dx,dy,width in [(1,0,2),(0,1,5),(1,2,6),(3,3,3)]:c.rect(x+dx,y+dy,width,1,'m')
        c.rect(x+2,y+4,2,1,'j')
    # Common opaque boundary profile permits ALL4x4 neighbour combinations.
    # One-pixel recessed joint profile; no transparency, auto-tiling mask or UV gutter.
    for n in range(128):
        color='g' if n in [0,127] else 'j'
        c.point(n,0,color);c.point(n,127,color)
        c.point(0,n,color);c.point(127,n,color)
    return c


def rgba(value):return bytes.fromhex(PALETTE.get(value,value).removeprefix('#'))+b'\xff'
def png(c):
    def chunk(tag,data):return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
    raw=b''.join(b'\0'+b''.join(rgba(p) for p in row) for row in c.pixels)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',c.width,c.height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
def svg(c):
    lines=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.width}" height="{c.height}" viewBox="0 0 {c.width} {c.height}" shape-rendering="crispEdges">',
           '<title>ASHVEIL original worn monastery flagstone floor, four macro variants</title>',
           '<desc>Hand-authored slab, dust and crack geometry. No external image inputs, traced pixels, baked light or special contamination.</desc>']
    for y,row in enumerate(c.pixels):
        x=0
        while x<c.width:
            end=x+1
            while end<c.width and row[end]==row[x]:end+=1
            lines.append(f'  <rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{PALETTE[row[x]]}"/>');x=end
    return ('\n'.join(lines)+ '\n</svg>\n').encode()


FONT={
'A':'01110/10001/10001/11111/10001/10001/10001','B':'11110/10001/10001/11110/10001/10001/11110',
'C':'01111/10000/10000/10000/10000/10000/01111','D':'11110/10001/10001/10001/10001/10001/11110',
'E':'11111/10000/10000/11110/10000/10000/11111','F':'11111/10000/10000/11110/10000/10000/10000',
'G':'01111/10000/10000/10111/10001/10001/01111','H':'10001/10001/10001/11111/10001/10001/10001',
'I':'11111/00100/00100/00100/00100/00100/11111','K':'10001/10010/10100/11000/10100/10010/10001',
'L':'10000/10000/10000/10000/10000/10000/11111','M':'10001/11011/10101/10101/10001/10001/10001',
'N':'10001/11001/11001/10101/10011/10011/10001','O':'01110/10001/10001/10001/10001/10001/01110',
'P':'11110/10001/10001/11110/10000/10000/10000','Q':'01110/10001/10001/10001/10101/10010/01101',
'R':'11110/10001/10001/11110/10100/10010/10001','S':'01111/10000/10000/01110/00001/00001/11110',
'T':'11111/00100/00100/00100/00100/00100/00100','U':'10001/10001/10001/10001/10001/10001/01110',
'V':'10001/10001/10001/10001/10001/01010/00100','W':'10001/10001/10001/10101/10101/10101/01010',
'X':'10001/10001/01010/00100/01010/10001/10001','Y':'10001/10001/01010/00100/00100/00100/00100',
'0':'01110/10011/10101/10101/11001/10001/01110','1':'00100/01100/00100/00100/00100/00100/01110',
'2':'01110/10001/00001/00010/00100/01000/11111','3':'11110/00001/00001/01110/00001/00001/11110',
'4':'00010/00110/01010/10010/11111/00010/00010','6':'00110/01000/10000/11110/10001/10001/01110',
'8':'01110/10001/10001/01110/10001/10001/01110','/':'00001/00001/00010/00100/01000/10000/10000',
' ':'00000/00000/00000/00000/00000/00000/00000'}
def text(c,x,y,value,scale=1):
    for i,letter in enumerate(value):
        for yy,row in enumerate(FONT[letter].split('/')):
            for xx,bit in enumerate(row):
                if bit=='1':c.rect(x+(i*6+xx)*scale,y+yy*scale,scale,scale,'#c1c3ae')


def js_hash(x,y):
    # Match renderer's JS number multiplication/ToInt32, not an integer imul rewrite.
    h=(x*374761393+y*668265263)&0xffffffff
    mixed=(h^(h>>13))&0xffffffff
    if mixed>=0x80000000:mixed-=0x100000000
    h=int(float(mixed)*1274126177)&0xffffffff
    return (h^(h>>16))&0xffffffff


def sampler(blocks):
    c=Canvas(512,320)
    for ty in range(20):
        for tx in range(32):
            src=blocks[js_hash(tx>>3,ty>>3)%4]
            for yy in range(16):
                for xx in range(16):c.point(tx*16+xx,ty*16+yy,src.pixels[(ty&7)*16+yy][(tx&7)*16+xx])
    return c


def contact(blocks,preview):
    c=Canvas(1056,1060,'#151d1b')
    text(c,16,12,'ASHVEIL / ORIGINAL MONASTERY FLAGSTONE',2)
    for q,src in enumerate(blocks):
        x=16+q*256;text(c,x,42,'Q'+str(q)+' / 128PX / 2X');c.blit(src,x,56,2)
    text(c,16,330,'ACTUAL 16PX SUB SAMPLING / 32 X 20 TILES / 2X')
    c.blit(preview,16,350,2)
    text(c,16,1008,'NATIVE 16PX SAMPLES / 2X / ONE MATERIAL / NO BAKED LIGHT')
    for i in range(32):
        q=i//8;sx=(i%8)*16;sy=((i*3)%8)*16
        for yy in range(16):
            for xx in range(16):c.rect(16+i*32+xx*2,1024+yy*2,2,2,blocks[q].pixels[sy+yy][sx+xx])
    return c


def json_bytes(value):return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
def outputs():
    blocks=[block(q) for q in range(4)];sheet=Canvas(256,256)
    for q,c in enumerate(blocks):sheet.blit(c,(q&1)*128,(q>>1)*128)
    preview=sampler(blocks)
    fragment={'sheets':{'kt_floor':f'sprites/original/{NAME}.png'},'frames':{f'kt_floor_q{q}':['kt_floor',(q&1)*128,(q>>1)*128,128,128] for q in range(4)}}
    contract={'basis':'Read-only source contract from /workspace/ashveil at preparation time; no production import at generation/check time.',
              'terrain':'Terrain.KtFloor','selectedBecause':'General monastery flagstone used by depth1/2 rooms, surfaced monastery and renderer fallback. Usage is source-based, not a measured saved-world frequency ranking.',
              'nativeTile':[16,16],'sheet':[256,256],'macroVariantCount':4,'macroCell':[128,128],'samplesPerMacro':[8,8],
              'totalAddressableNativeSamples':256,'existingFrameKeys':list(fragment['frames']),
              'rendererSelection':'q=hash(x>>3,y>>3)%4; sub(kt_floor_q{q},(x&7)*16,(y&7)*16,16,16)',
              'edgeContract':'Every ordered pair of4 macro variants matches left/right and top/bottom opaque edge pixels.',
              'notCovered':{'terrain':'Terrain.CdFloor','nativeTile':[16,16],'frameCount':20,'frames':'cd_floor0..19','selection':'h%20','reason':'Special contaminated deepest-floor material; not changed by this general stone artwork.'},
              'sourceReferences':{'CANON.md':'D13:16x16, worn damp stone from the outset','12-ui-ux.md':'section8 graphics: wear in material, light not baked into tile','14-locations-and-dungeons.md':'section3:monastery and section3.3 depth1/2/3 material distinction','lore/world-bible.md':'section1.4:old stone relief house, ash-stained Grey Cloister'},
              'gameFilesRead':['src/client/sprites.json','src/client/render/MapRenderer.ts','src/client/render/atlas.ts','src/content/core/defs/terrain.json','src/core/mapgen.ts'],
              'hashFirst4Rows6Blocks':[[js_hash(x,y)%4 for x in range(6)] for y in range(4)]}
    out={ART/(NAME+'.png'):png(sheet),ART/(NAME+'.svg'):svg(sheet),ART/(NAME+'-sampler.png'):png(preview),ART/(NAME+'-contact.png'):png(contact(blocks,preview)),
         ART/(NAME+'-palette.json'):json_bytes(PALETTE),Path('tools/art/monastery-floor-manifest.fragment.json'):json_bytes(fragment),Path('tools/art/monastery-floor-contract.json'):json_bytes(contract)}
    source={'created':'2026-10-21','method':'Original authored integer-coordinate flagstone outlines, six wear motifs, four crack paths and independently placed damp/ash marks.',
            'externalImageInputs':[],'externalPixelExtraction':False,'tracingOrRecoloring':False,'generatedImageInputs':False,
            'generator':'tools/art/draw-monastery-floor.py','generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'ownToolReuse':'Standard-library Canvas/PNG/SVG/contact/font patterns from own original resident/character tools. No floor image pixels were read.',
            'paletteColors':len(PALETTE),'alpha':'fully opaque floor; no alpha gaps or black atlas gutters','nativeDensity':'1 authored pixel=1 native world pixel before existing integer camera zoom',
            'lighting':'No baked torch, fixed directional cast shadow, gloss, glow or purple contamination. Existing renderer lighting stays separate.',
            'status':'Isolated original art prepared; not registered or tested in the game.',
            'integration':'Replace only kt_floor sheet URL with the provided original; four frame keys and rectangles remain byte-equivalent. Do not replace cd_tiles, walls, terrain Def or renderer.',
            'files':[{'path':str(p),'bytes':len(v),'sha256':hashlib.sha256(v).hexdigest()} for p,v in out.items()]}
    out[ART/(NAME+'-source.json')]=json_bytes(source)
    return out


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args();out=outputs()
    for rel,data in out.items():
        p=ROOT/rel
        if args.check:
            if not p.exists() or p.read_bytes()!=data:raise SystemExit('DIFF '+str(rel))
        else:p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
    print(('CHECK PASS ' if args.check else 'WROTE ')+str(len(out))+' own original-art files')
if __name__=='__main__':main()
