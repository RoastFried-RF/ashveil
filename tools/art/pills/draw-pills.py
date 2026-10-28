#!/usr/bin/env python3
"""Six original appearance-only ASHVEIL tablet/pill icons; no effect markings.
No image inputs. Standard-library PNG/SVG output into this isolated folder only.
Run: python3 draw-pills.py [--check]
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib
ROOT=Path(__file__).resolve().parent
COLORS=['white','yellow','blue','black','green','magenta']
LABELS={'white':'흰 알약','yellow':'노란 알약','blue':'푸른 알약','black':'검은 알약','green':'초록 알약','magenta':'자홍 알약'}
PALETTE={'o':'#172429'}
RAMPS={
 'white':['#858d81','#a3ad9d','#c7cbbb','#e0dfcd'],
 'yellow':['#716239','#8f7f48','#b9a159','#d6c17b'],
 'blue':['#34485b','#4c6279','#647f9a','#92a7b0'],
 'black':['#2d3534','#424e4d','#5a6663','#89958b'],
 'green':['#3e503f','#556b4d','#72835f','#a5b294'],
 'magenta':['#5f3d56','#80536c','#a16c86','#c293a5'],
}
for color,ramp in RAMPS.items():
 for i,value in enumerate(ramp):PALETTE[color+str(i)]=value
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


def rgba(color):
    return bytes(4) if color=="." else bytes.fromhex(PALETTE.get(color,color).lstrip("#"))+b"\xff"


def png(c):
    def chunk(kind,data):
        return struct.pack(">I",len(data))+kind+data+struct.pack(">I",zlib.crc32(kind+data)&0xffffffff)
    raw=b"".join(b"\0"+b"".join(rgba(p) for p in row) for row in c.pixels)
    return b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",c.width,c.height,8,6,0,0,0))+chunk(b"IDAT",zlib.compress(raw,9))+chunk(b"IEND",b"")


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


def polygon(c, vertices, color):
    for y in range(min(p[1] for p in vertices), max(p[1] for p in vertices)):
        for x in range(min(p[0] for p in vertices), max(p[0] for p in vertices)):
            inside=False
            previous=vertices[-1]
            for current in vertices:
                xi,yi=current
                xj,yj=previous
                if (yi>y+0.5)!=(yj>y+0.5) and x+0.5<(xj-xi)*(y+0.5-yi)/(yj-yi)+xi:
                    inside=not inside
                previous=current
            if inside:c.point(x,y,color)


def json_bytes(value):return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()


FONT['0']='01110/10001/10011/10101/11001/10001/01110'
FONT['B']='11110/10001/10001/11110/10001/10001/11110'


def ellipse(c,x,y,width,height,color):
    # Integer-centred original ellipse raster, no image transform or antialiasing.
    for py in range(height):
        for px in range(width):
            if (2*px+1-width)**2*height**2+(2*py+1-height)**2*width**2<=width**2*height**2:
                c.point(x+px,y+py,color)


def tablet(color):
    c=Canvas(32,32)
    dark,edge,body,light=[color+str(i) for i in range(4)]
    if color=='white':
        # Matte round pressed tablet, visible side wall and one shallow score.
        # Grey-ivory wear is neutral; no yellow spoiled edge is baked into it.
        ellipse(c,5,9,22,19,'o')
        ellipse(c,6,10,20,17,dark)
        ellipse(c,5,5,22,20,'o')
        ellipse(c,6,6,20,18,edge)
        ellipse(c,7,6,18,16,body)
        c.line(9,11,12,8,light)
        c.line(12,8,18,8,light)
        c.line(10,18,21,11,edge)
        c.line(11,19,22,12,light)
        c.point(9,20,edge)
    elif color=='yellow':
        # Ocher oval tablet, not a bottle and not an effect-specific token.
        ellipse(c,3,12,26,14,'o')
        ellipse(c,4,12,24,13,dark)
        ellipse(c,3,8,26,15,'o')
        ellipse(c,4,9,24,13,edge)
        ellipse(c,5,9,22,11,body)
        c.line(8,11,13,10,light)
        c.line(13,10,19,10,light)
        c.line(14,11,18,19,dark)
        c.line(15,11,19,19,light)
    elif color=='blue':
        # A diagonally resting blue oval caplet with rounded, compressed ends.
        polygon(c,[(5,21),(6,16),(17,6),(22,6),(27,10),(27,14),(15,27),(10,28),(6,25)],'o')
        polygon(c,[(6,21),(8,17),(18,8),(22,8),(26,11),(25,15),(14,26),(10,26),(7,24)],dark)
        polygon(c,[(5,18),(7,13),(17,5),(22,4),(26,7),(27,11),(24,16),(14,25),(9,26),(6,23)],'o')
        polygon(c,[(6,18),(8,14),(18,6),(22,5),(25,8),(26,11),(23,15),(13,24),(9,25),(7,22)],edge)
        polygon(c,[(7,17),(9,14),(18,7),(22,6),(24,8),(24,11),(22,14),(13,22),(10,23),(8,21)],body)
        c.line(10,15,18,8,light)
        c.line(12,12,19,19,dark)
        c.line(13,12,20,19,light)
    elif color=='black':
        # Charcoal pressed lozenge with an ash-grey bevel for dark-ground contrast.
        polygon(c,[(11,6),(20,6),(25,11),(25,22),(21,27),(11,27),(6,22),(6,12)],'o')
        polygon(c,[(11,8),(20,8),(24,12),(24,22),(20,26),(11,26),(7,22),(7,12)],dark)
        polygon(c,[(11,5),(20,5),(25,10),(25,20),(21,24),(11,24),(6,20),(6,11)],'o')
        polygon(c,[(11,6),(20,6),(24,11),(24,19),(20,23),(11,23),(7,19),(7,11)],edge)
        polygon(c,[(12,7),(19,7),(23,11),(23,18),(19,22),(12,22),(8,18),(8,12)],body)
        c.line(10,11,13,8,light)
        c.line(13,8,18,8,light)
        c.line(10,16,21,13,dark)
        c.line(10,17,21,14,edge)
    elif color=='green':
        # Long green pressed caplet; a plain score describes manufacture only.
        ellipse(c,8,6,16,24,'o')
        ellipse(c,9,7,14,22,dark)
        ellipse(c,7,3,17,24,'o')
        ellipse(c,8,4,15,22,edge)
        ellipse(c,9,4,13,20,body)
        c.line(11,8,12,6,light)
        c.line(11,9,11,13,light)
        c.line(10,16,21,14,dark)
        c.line(10,17,21,15,light)
    else:
        # Muted magenta capsule, two same-hue shells with a single joining seam.
        # No cross, skull, flash, letter or chemical/effect marking is present.
        polygon(c,[(4,21),(6,16),(18,5),(23,5),(28,9),(28,13),(15,28),(10,29),(5,26)],'o')
        polygon(c,[(5,21),(8,17),(19,7),(23,7),(27,10),(26,14),(14,27),(10,27),(6,25)],dark)
        polygon(c,[(4,19),(6,14),(18,3),(23,3),(27,7),(28,11),(25,16),(14,27),(9,28),(5,24)],'o')
        polygon(c,[(5,19),(7,15),(19,4),(23,4),(26,8),(27,11),(24,15),(13,26),(9,27),(6,23)],edge)
        polygon(c,[(6,18),(8,15),(19,5),(23,5),(25,8),(25,11),(23,14),(13,24),(10,25),(7,22)],body)
        polygon(c,[(6,19),(8,16),(12,13),(19,20),(13,25),(10,26),(7,23)],edge)
        c.line(10,13,19,6,light)
        c.line(12,13,20,20,dark)
        c.line(13,13,21,20,light)
    return c


def half(c):
    small=Canvas(16,16)
    for y in range(16):
        for x in range(16):small.pixels[y][x]=c.pixels[2*y+1][2*x+1]
    return small


def svg(c,label):
    lines=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.width}" height="{c.height}" viewBox="0 0 {c.width} {c.height}" shape-rendering="crispEdges">',f'  <title>ASHVEIL original appearance-only {label} pill</title>', '  <desc>Hand-authored matte pharmaceutical tablet/capsule pixels. No effect marking, bottle, package, backdrop, spoilage cue or external image input.</desc>']
    for y,row in enumerate(c.pixels):
        x=0
        while x<c.width:
            end,color=x+1,row[x]
            while end<c.width and row[end]==color:end+=1
            if color!='.':lines.append(f'  <rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{PALETTE[color]}"/>')
            x=end
    return ('\n'.join(lines)+'\n</svg>\n').encode()


def contact(arts,small):
    c=Canvas(960,664,'#20292b')
    text(c,20,16,'ASHVEIL / SIX PILL APPEARANCES',2)
    text(c,20,40,'MATTE TABLETS / CAPSULE / NO EFFECT MARKS')
    for index,color in enumerate(COLORS):
        x=16+(index%3)*316;y=72+(index//3)*280
        text(c,x+4,y,color.upper()+' / 32PX 4X')
        for shift,bg in [(0,'#10191b'),(144,'#c8c5b3')]:
            c.rect(x+shift,y+18,136,136,bg)
            c.blit(arts[color],x+shift+4,y+22,4)
        text(c,x+4,y+164,'NATIVE 32 / 16')
        text(c,x+148,y+164,'16PX / 4X')
        c.rect(x,y+180,136,72,'#303b39')
        c.blit(arts[color],x+12,y+200)
        c.blit(small[color],x+80,y+208)
        c.rect(x+144,y+180,64,64,'#10191b')
        c.rect(x+216,y+180,64,64,'#c8c5b3')
        c.blit(small[color],x+144,y+180,4)
        c.blit(small[color],x+216,y+180,4)
    text(c,20,640,'NATIVE 32PX AND 16PX / COLOR AND FORM ONLY')
    return c


def products():
    arts={color:tablet(color) for color in COLORS}
    small={color:half(arts[color]) for color in COLORS}
    outputs={};details={}
    for color in COLORS:
        name='pill_'+color
        outputs[name+'.png']=png(arts[color])
        outputs[name+'.svg']=svg(arts[color],color)
        outputs[name+'-16.png']=png(small[color])
        alpha=[rgba(pixel)[3] for row in arts[color].pixels for pixel in row]
        assert sorted(set(alpha))==[0,255]
        assert 250<=alpha.count(255)<=700,(color,alpha.count(255))
        details[name]={'label':LABELS[color],'size':[32,32],'physicalItemGrid':[1,1],'alphaValues':[0,255],'opaquePixels':alpha.count(255),'transparentPixels':alpha.count(0),'effectSymbols':False,'conditionalSpoilageCue':False}
    fragment={'sheets':{'original_pill_'+color:'sprites/original/items/pill_'+color+'.png' for color in COLORS},'frames':{'pill_'+color:['original_pill_'+color,0,0,32,32] for color in COLORS}}
    outputs['pills-contact.png']=png(contact(arts,small))
    outputs['pills-palette.json']=json_bytes(PALETTE)
    outputs['pills-frames.fragment.json']=json_bytes(fragment)
    outputs['pills-integrity.json']=json_bytes({
      'method':'original manually authored integer-coordinate pixel artwork','externalImageInputs':[],
      'generator':'draw-pills.py','generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
      'provenance':'SOURCE.md','provenanceSha256':hashlib.sha256((ROOT/'SOURCE.md').read_bytes()).hexdigest(),
      'scope':'Six actual appearance-only pill frames; isolated and not registered in game. No effect mapping or knowledge rule is read or altered.',
      'pngColorType':6,'preview16Method':'nearest-neighbor centre sample (2*x+1,2*y+1)',
      'frames':details,
      'files':[{'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in outputs.items()]
    })
    return outputs


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args();outputs=products()
    for name,data in outputs.items():
        target=ROOT/name
        if args.check:
            if not target.exists() or target.read_bytes()!=data:raise SystemExit('Byte mismatch: '+name)
        else:target.write_bytes(data)
    print(('CHECK PASS: ' if args.check else 'WROTE: ')+str(len(outputs))+' deterministic original-art files; six pill appearances')


if __name__=='__main__':main()

