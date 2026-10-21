#!/usr/bin/env python3
"""Original small human shade chief, manually authored integer-coordinate art.
Python standard library only; no image inputs or game edits.
Run: python3 draw-shade-chief.py [--check]
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib
ROOT=Path(__file__).resolve().parent
DIRS=['down','left','right','up']
PALETTE={
 'o':'#1d2225','k':'#2c2c2c',
 'd':'#303c40','t':'#4a5a5d','m':'#728080',
 'p':'#a3a58b','h':'#c7c5a5',
 'b':'#342f2c','r':'#5d4c3b','n':'#8c7652',
 's':'#80847a','f':'#b8bfb1','e':'#d8dac7',
 'v':'#46514e','g':'#697366','l':'#959e8c',
 'u':'#453a37','j':'#74614b','c':'#aa9270'
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


def mirror(c):
    result=Canvas(c.width,c.height)
    for y,row in enumerate(c.pixels):
        result.pixels[y]=list(reversed(row))
    return result


def limb(c,points,base='t',edge='m'):
    for (x0,y0),(x1,y1) in zip(points,points[1:]):
        for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]:
            c.line(x0+dx,y0+dy,x1+dx,y1+dy,'o')
        c.line(x0,y0,x1,y1,base)
        c.point(x0-1,y0,edge)


def json_bytes(value):return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()


FONT['0']='01110/10001/10011/10101/11001/10001/01110'
FONT['B']='11110/10001/10001/11110/10001/10001/11110'


def legs(c,direction,step):
    # Small adult human proportions, bent knees, plain feet/worn cloth wraps.
    # No giant leader scaling: the same top/floor span as ordinary shades 0-3.
    if direction in ['down','up']:
        lx=8+(1 if step==1 else -1 if step==-1 else 0)
        rx=14+(-1 if step==1 else 1 if step==-1 else 0)
        ly=29 if step==1 else 30
        ry=29 if step==-1 else 30
        polygon(c,[(8,23),(12,23),(11,26),(lx+2,ly),(lx-1,ly),(7,26)],'o')
        polygon(c,[(13,23),(17,23),(17,26),(rx+2,ry),(rx-1,ry),(13,26)],'o')
        c.line(9,24,lx,ly-2,'g')
        c.line(15,24,rx,ry-2,'v')
        c.row(lx-1,ly-1,'nss')
        c.row(lx-2,ly,'osffo')
        c.row(rx-1,ry-1,'rsso')
        c.row(rx-1,ry,'osffo')
    else:
        far=2 if step==1 else -2 if step==-1 else 0
        near=-far
        fy=29 if step==-1 else 30
        ny=29 if step==1 else 30
        polygon(c,[(11,23),(15,23),(14+far,26),(13+far,fy),(10+far,fy),(11,26)],'o')
        c.line(13,24,12+far,fy-2,'v')
        c.row(10+far,fy-1,'nss')
        c.row(9+far,fy,'osffo')
        polygon(c,[(8,23),(12,23),(12+near,26),(11+near,ny),(7+near,ny),(8,26)],'o')
        c.line(10,24,10+near,ny-2,'g')
        c.row(8+near,ny-1,'rss')
        c.row(7+near,ny,'osffo')


def front(step,back=False,active=True):
    c=Canvas(24,32)
    legs(c,'up' if back else 'down',step)
    # A patched rag shirt with a folded pale collar and an asymmetrical repaired
    # hem. These are cloth details, not a new armour item or a royal cape.
    limb(c,[(6,18),(4,21),(6,23+step)],'t','m')
    c.row(5,23+step,'sff')
    if active:
        limb(c,[(17,18),(20,21),(18,23-step)],'t','m')
        c.row(17,23-step,'sff')
    polygon(c,[(8,16),(15,16),(19,19),(18,23),(19,25),(15,24),(12,26),(9,24),(6,25),(5,20)],'o')
    polygon(c,[(8,17),(15,17),(17,20),(16,23),(17,24),(13,23),(11,24),(8,23),(7,24),(6,20)],'t')
    c.line(8,20,8,23,'m')
    c.line(14,19,15,23,'d')
    c.row(8,23,'nrrrnr')
    c.row(10,24,'rnnr')
    if back:
        c.line(8,18,15,18,'m')
        c.line(8,19,14,19,'p')
        c.row(9,20,'gppg')
        c.line(13,20,16,23,'j')
        c.point(15,22,'c')
    else:
        c.line(8,17,11,19,'p')
        c.line(15,17,12,19,'h')
        c.point(11,20,'o')
        c.row(15,21,'pp')
        c.row(15,22,'pp')
        c.point(16,23,'n')
    # A pale human face with broad dark pupils. A tied scrap of the same cloth
    # marks the brow; there is no crown, horn, metal helmet or monstrous ear.
    polygon(c,[(10,9),(14,9),(16,11),(16,15),(14,17),(10,17),(8,15),(8,11)],'o')
    polygon(c,[(10,10),(14,10),(15,12),(15,15),(13,16),(10,15),(9,13),(9,11)],'f')
    c.row(10,9,'gllg')
    c.row(9,10,'jjnnjj')
    c.point(15,11,'r')
    if back:
        c.row(10,11,'lggl')
        c.row(9,12,'gsssg')
        c.row(10,13,'sss')
        c.row(10,14,'ssg')
        c.row(10,15,'sf')
        c.row(14,11,'rj')
        c.row(15,12,'jr')
        c.point(15,13,'r')
    else:
        c.row(9,12,'fokfokf')
        c.row(10,13,'sfe')
        c.row(10,14,'skf')
        c.row(11,15,'fe')
        c.point(9,11,'e')
        c.row(11,16,'pp')
    return c


def side(step,active=True):
    c=Canvas(24,32)
    legs(c,'left',step)
    limb(c,[(15,18),(17,21),(16,24+step)],'d','t')
    c.row(15,24+step,'sff')
    polygon(c,[(10,16),(15,17),(18,20),(17,24),(15,25),(12,24),(9,26),(7,24),(8,20)],'o')
    polygon(c,[(10,17),(14,18),(16,20),(15,23),(14,24),(11,23),(9,24),(8,23),(9,20)],'t')
    c.line(10,18,9,22,'m')
    c.line(14,19,15,22,'d')
    c.row(9,23,'rnnrr')
    c.line(9,17,11,19,'p')
    c.point(10,20,'h')
    c.row(14,21,'pp')
    c.point(14,22,'n')
    if active:
        limb(c,[(10,18),(7,21),(9-step,23)],'t','m')
        c.row(8-step,23,'sff')
    polygon(c,[(10,9),(14,9),(16,11),(16,15),(13,17),(9,16),(7,13),(8,11)],'o')
    polygon(c,[(10,10),(14,10),(15,12),(14,15),(12,16),(9,14),(8,12)],'f')
    c.row(10,9,'gllg')
    c.row(9,10,'jjnnjj')
    c.row(8,12,'okffs')
    c.row(7,13,'offs')
    c.row(8,14,'sfe')
    c.row(9,15,'fs')
    c.row(11,16,'pp')
    c.row(14,11,'jr')
    c.point(15,12,'r')
    return c


def walk(direction,step=0,active=True):
    if direction=='down':return front(step,False,active)
    if direction=='up':return front(-step,True,active)
    if direction=='left':return side(step,active)
    return mirror(side(-step,active))


def attack(direction,pose):
    # The small body stays at offset(4,8) inside a roomier optional attack cell,
    # exactly as in the original regular shade family. No fixed weapon is drawn.
    c=Canvas(32,40)
    c.blit(walk(direction,[-1,0,1,0][pose],False),4,8)
    paths={
      'down': [[(21,26),(24,29),(22,31)],[(21,26),(25,24),(25,20)],[(21,26),(24,32),(21,35)],[(21,26),(23,29),(21,30)]],
      'up': [[(11,26),(8,29),(9,24)],[(11,26),(7,23),(8,20)],[(11,26),(8,19),(12,13)],[(11,26),(8,27),(11,23)]],
      'left': [[(14,26),(11,29),(10,27)],[(14,26),(17,24),(18,21)],[(14,26),(9,25),(3,24)],[(14,26),(11,28),(12,25)]]
    }
    points=paths['left' if direction=='right' else direction][pose]
    layer=Canvas(32,40)
    limb(layer,points,'s','f')
    hx,hy=points[-1]
    layer.rect(hx-1,hy-1,3,3,'o')
    layer.row(hx-1,hy-1,'fef')
    layer.row(hx-1,hy,'sfs')
    layer.point(hx,hy+1,'s')
    if direction=='right':layer=mirror(layer)
    c.blit(layer,0,0)
    return c


def svg(c,label):
    lines=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.width}" height="{c.height}" viewBox="0 0 {c.width} {c.height}" shape-rendering="crispEdges">',f'  <title>ASHVEIL original shade chief: {label}</title>', '  <desc>Small pale human descendant with broad pupils and a patched rag shirt. Original integer pixels, no external image inputs, no fixed weapon or invented armour.</desc>']
    for y,row in enumerate(c.pixels):
        x=0
        while x<c.width:
            end,color=x+1,row[x]
            while end<c.width and row[end]==color:end+=1
            if color!='.':lines.append(f'  <rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{PALETTE[color]}"/>')
            x=end
    return ('\n'.join(lines)+'\n</svg>\n').encode()


def contact(walking,attacking):
    c=Canvas(768,1392,'#20292b')
    text(c,20,16,'ASHVEIL / SHADE CHIEF',2)
    text(c,20,40,'SMALL HUMAN / RAG SHIRT / NO FIXED WEAPON')
    for i,label in enumerate(['STEP 0','IDLE 1','STEP 2']):text(c,148+i*164,64,label)
    for row,direction in enumerate(DIRS):
        y=80+row*136
        text(c,20,y+54,direction.upper())
        for col in range(3):
            x=132+col*164
            c.rect(x,y,144,130,'#151e20' if (row+col)%2==0 else '#303b39')
            c.line(x,y+128,x+143,y+128,'#59645b')
            c.blit(walking[(direction,col)],x+24,y+4,4)
    text(c,20,640,'READY 0 / DRAW 1 / STRIKE 2 / RESET 3')
    for row,direction in enumerate(DIRS):
        y=664+row*176
        text(c,20,y+70,direction.upper())
        for col in range(4):
            x=112+col*152
            c.rect(x,y,144,170,'#151e20' if (row+col)%2==0 else '#303b39')
            c.line(x,y+160,x+143,y+160,'#59645b')
            c.blit(attacking[(direction,col)],x+8,y+4,4)
    for i,color in enumerate(PALETTE.values()):c.rect(20+i*34,1376,26,12,color)
    return c


def products():
    walking={(d,i):walk(d,[-1,0,1][i]) for d in DIRS for i in range(3)}
    attacking={(d,i):attack(d,i) for d in DIRS for i in range(4)}
    ws,ats=Canvas(72,128),Canvas(128,160)
    frames={};poses=[]
    for d in DIRS:
        for i in range(3):
            art=walking[(d,i)];key=f'shade_chief_w_{d}{i}'
            ws.blit(art,i*24,DIRS.index(d)*32)
            frames[key]=['original_shade_chief',i*24,DIRS.index(d)*32,24,32]
            poses.append((key,art))
        for i in range(4):
            art=attacking[(d,i)];key=f'shade_chief_a_{d}{i}'
            ats.blit(art,i*32,DIRS.index(d)*40)
            frames[key]=['original_shade_chief_atk',i*32,DIRS.index(d)*40,32,40]
            poses.append((key,art))
    legacy={'walk':{d:[f'shade_chief_w_{d}{i}' for i in range(3)] for d in DIRS},'idle':{d:[f'shade_chief_w_{d}1'] for d in DIRS},'anchor':[0.5,0.92]}
    char={**legacy,'anchor':[0.5,31/32],'attack':{d:[f'shade_chief_a_{d}{i}' for i in range(4)] for d in DIRS},'attackAnchor':[0.5,39/40],'renderScale':1,'headOffset':22}
    sheets={'original_shade_chief':'sprites/original/ashveil-shade-chief-walk.png','original_shade_chief_atk':'sprites/original/ashveil-shade-chief-attack.png'}
    fragment={'format':'ashveil-atlas-fragment-v1','status':'prepared-not-installed','creature':'Creature.ShadeChief','character':'shade_chief','sheets':sheets,'frames':frames,'chars':{'shade_chief':char},'layout':{'walkCell':[24,32],'walkSheet':[72,128],'attackCell':[32,40],'attackSheet':[128,160],'walkFloorLastPixel':30,'walkGroundBoundary':31,'walkHeadTop':9,'attackFloorLastPixel':38,'attackGroundBoundary':39,'attackBodyOffset':[4,8],'headOffset':22,'rowOrder':DIRS,'note':'Preserves the 12 existing shade_chief walk keys and idle references. The 16 a_* keys are optional new unarmed body poses. Native scale and actual head/floor span match the ordinary original shade family; no new size or equipment rule.'}}
    history={'sheets':{'original_shade_chief':sheets['original_shade_chief']},'frames':{k:v for k,v in frames.items() if '_w_' in k},'chars':{'shade_chief':legacy}}
    files={
      'ashveil-shade-chief-walk.png':png(ws),'ashveil-shade-chief-walk.svg':svg(ws,'walk and idle'),
      'ashveil-shade-chief-attack.png':png(ats),'ashveil-shade-chief-attack.svg':svg(ats,'optional unarmed attack'),
      'ashveil-shade-chief-contact.png':png(contact(walking,attacking)),
      'ashveil-shade-chief-palette.json':json_bytes(PALETTE),
      'ashveil-shade-chief-frames.json':json_bytes(fragment),
      'ashveil-shade-chief-walk-only.fragment.json':json_bytes(history),
    }
    checks=[];unique=set()
    for key,art in poses:
        raw=b''.join(rgba(p) for row in art.pixels for p in row)
        digest=hashlib.sha256(raw).hexdigest();unique.add(digest)
        alpha=[rgba(p)[3] for row in art.pixels for p in row]
        assert sorted(set(alpha))==[0,255]
        occupied=[y for y,row in enumerate(art.pixels) if any(p!='.' for p in row)]
        bottom=max(occupied);top=min(occupied)
        if '_w_' in key:assert bottom==30 and top==9,(key,top,bottom)
        else:assert bottom==38,(key,bottom)
        checks.append({'key':key,'rgbaSha256':digest,'opaquePixels':alpha.count(255),'topRow':top,'bottomRow':bottom})
    assert len(unique)==28,len(unique)
    files['ashveil-shade-chief-integrity.json']=json_bytes({
      'scope':'Only the exact Creature.ShadeChief / shade_chief appearance is prepared in an isolated folder; no game registry, ordinary shade or shared sheet is changed.',
      'method':'original manually authored integer-coordinate pixel art','externalImageInputs':[],
      'generator':'draw-shade-chief.py','generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
      'provenance':'SOURCE.md','provenanceSha256':hashlib.sha256((ROOT/'SOURCE.md').read_bytes()).hexdigest(),
      'frameCount':28,'distinctPoseCount':len(unique),'walkFrameCount':12,'optionalAttackFrameCount':16,
      'alphaValues':[0,255],'paletteOnly':True,
      'nativeRendering':{'anchor':[0.5,31/32],'attackAnchor':[0.5,39/40],'renderScale':1,'headOffset':22,'walkHeadTopRow':9,'walkLastSoleRow':30,'walkGroundBoundary':31,'attackBodyOffset':[4,8]},
      'files':[{'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in files.items()],
      'poses':checks
    })
    return files


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args();outputs=products()
    for name,data in outputs.items():
        target=ROOT/name
        if args.check:
            if not target.exists() or target.read_bytes()!=data:raise SystemExit('Byte mismatch: '+name)
        else:target.write_bytes(data)
    print(('CHECK PASS: ' if args.check else 'WROTE: ')+str(len(outputs))+' deterministic original-art files; 28 distinct poses')


if __name__=='__main__':main()

