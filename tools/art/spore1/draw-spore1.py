#!/usr/bin/env python3
"""Original ASHVEIL spore-taken pilgrim, manually authored integer pixels.
No external image inputs. Stdlib PNG/SVG utilities reuse our own original art tool.
Only writes beside this script. Run: python3 draw-spore1.py [--check]
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
 'o':'#1c2525','k':'#2b302c',
 'd':'#54434b','t':'#7b6268','m':'#a18a84',
 'p':'#b9b69b','h':'#d5ceb0',
 'r':'#695544','b':'#3e3831',
 's':'#82715e','f':'#b3a18a','e':'#d0b99b',
 'v':'#45534e','g':'#738175','l':'#9daca0','q':'#c3c0a0',
 'u':'#5b514b','j':'#877565','c':'#a69b83',
 'a':'#606a60','n':'#8c927d'
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


FONT['0']='01110/10001/10011/10101/11001/10001/01110'


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


def cluster(c,x,y,large=False):
    # Layered crust on a human shoulder/back, with thin ash-coloured rims.
    # Unlike spore0's rounded nodules this shell grows in overlapping plates.
    if large:
        c.row(x+2,y,'ovvvo')
        c.row(x+1,y+1,'ovgllo')
        c.row(x,y+2,'ovlqqgvo')
        c.row(x,y+3,'vggjjgvo')
        c.row(x+1,y+4,'ovllgvo')
        c.row(x+2,y+5,'ouuuo')
    else:
        c.row(x+1,y,'ovvo')
        c.row(x,y+1,'ovqlvo')
        c.row(x,y+2,'vljgvo')
        c.row(x+1,y+3,'ouuo')


def legs(c,direction,step):
    # Wrapped human calves under a long split tabard; no stalk-like fungal legs.
    if direction in ['down','up']:
        lx=7+(1 if step==1 else -1 if step==-1 else 0)
        rx=15+(-1 if step==1 else 1 if step==-1 else 0)
        ly=28 if step==1 else 29
        ry=28 if step==-1 else 29
        polygon(c,[(7,22),(11,22),(10,25),(lx+2,ly),(lx-1,ly),(6,25)],'o')
        polygon(c,[(13,22),(17,22),(18,25),(rx+2,ry),(rx-1,ry),(13,25)],'o')
        c.line(9,23,lx,ly-2,'a')
        c.line(15,23,rx,ry-2,'r')
        c.row(lx-1,ly-3,'pn')
        c.row(rx-1,ry-3,'np')
        c.row(lx-2,ly-1,'ornbo')
        c.row(lx-2,ly,'obbbbo')
        c.row(rx-1,ry-1,'rnbbo')
        c.row(rx-1,ry,'obbbbo')
    else:
        far=2 if step==1 else -2 if step==-1 else 0
        near=-far
        fy=28 if step==-1 else 29
        ny=28 if step==1 else 29
        polygon(c,[(12,22),(16,22),(15+far,25),(14+far,fy),(11+far,fy),(11,25)],'o')
        c.line(13,23,13+far,fy-2,'r')
        c.row(10+far,fy-1,'rbbo')
        c.row(9+far,fy,'obbbbo')
        polygon(c,[(8,22),(13,22),(12+near,25),(11+near,ny),(7+near,ny),(8,25)],'o')
        c.line(10,23,10+near,ny-3,'a')
        c.row(9+near,ny-3,'pn')
        c.row(7+near,ny-1,'ornbo')
        c.row(6+near,ny,'obbbbo')


def front(step,pose=None,back=False):
    c=Canvas(24,32)
    legs(c,'up' if back else 'down',step)
    # Broad, bent shoulders and an ash-linen tabard; plum cloth is a cowl/tail,
    # not a palette swap of the first pilgrim's short olive tunic.
    limb(c,[(18,14),(20,18),(19,22+step)],'a','n')
    c.row(18,22+step,'osfo')
    c.row(18,23+step,'ofeo')
    polygon(c,[(8,11),(15,11),(19,15),(18,21),(19,25),(15,26),(12,24),(10,27),(6,25),(5,19),(6,14)],'o')
    polygon(c,[(9,12),(14,12),(17,15),(16,20),(17,24),(14,25),(12,23),(9,25),(7,24),(7,17)],'a')
    polygon(c,[(9,13),(13,13),(15,16),(14,20),(15,24),(13,23),(11,21),(9,24),(8,22),(8,16)],'p')
    c.line(10,15,9,20,'h')
    c.line(13,16,13,20,'n')
    c.row(7,21,'rprrrprrr')
    c.row(8,22,'npp')
    c.point(9,24,'n')
    c.point(16,24,'p')
    # The head sits low inside a patched cloth cowl. Human eyes, nose and mouth
    # remain visible; all four walk views begin at hood/head pixel row 4.
    polygon(c,[(10,4),(14,4),(17,7),(16,11),(13,13),(8,11),(7,8),(8,5)],'o')
    polygon(c,[(10,5),(14,5),(16,7),(15,10),(13,12),(9,10),(8,8),(9,6)],'d')
    c.row(10,5,'tmmt')
    c.point(9,6,'m')
    if back:
        c.row(9,7,'dtttd')
        c.row(9,8,'tmttd')
        c.row(10,9,'tttd')
        c.row(10,10,'mtd')
        c.row(10,11,'ppp')
        polygon(c,[(14,12),(18,14),(18,20),(16,24),(14,22),(15,18),(12,14)],'d')
        c.line(16,14,16,20,'t')
        c.point(15,22,'m')
        cluster(c,3,10,True)
        cluster(c,8,17,True)
    else:
        c.row(10,7,'sffs')
        c.row(9,8,'fokof')
        c.row(10,9,'sfe')
        c.row(10,10,'sks')
        c.row(10,11,'ppp')
        c.row(9,12,'npppn')
        c.line(12,14,12,16,'r')
        c.point(12,17,'p')
        polygon(c,[(14,12),(17,13),(19,16),(17,18),(15,16),(13,14)],'d')
        c.line(15,13,17,15,'t')
        cluster(c,3,9,True)
        cluster(c,13,24)
    if pose is None:
        limb(c,[(7,15),(4,19),(6,22-step)],'a','n')
        c.row(5,22-step,'ofso')
        cluster(c,3,18-step)
    else:
        if back:
            points=[[(16,14),(20,17),(18,12)],[(16,14),(20,12),(18,8)],[(16,14),(19,7),(17,2)],[(16,14),(19,15),(16,11)]][pose]
        else:
            points=[[(7,15),(4,18),(7,20)],[(7,15),(3,13),(5,9)],[(7,15),(4,21),(7,26)],[(7,15),(6,18),(9,21)]][pose]
        limb(c,points,'a','p')
        hx,hy=points[-1]
        c.rect(hx-1,hy-1,3,3,'o')
        c.row(hx-1,hy-1,'plp')
        c.row(hx-1,hy,'fgf')
        c.point(hx,hy+1,'j')
    return c


def side(step,pose=None):
    c=Canvas(24,32)
    legs(c,'left',step)
    # Projecting nose and a drooping hood make the human stoop distinct from
    # spore0. Overlapping fungal plates grow from the back, not from a giant head.
    limb(c,[(14,14),(17,18),(16,22+step)],'d','t')
    c.row(15,22+step,'osfo')
    polygon(c,[(10,11),(15,12),(18,16),(17,23),(18,25),(14,26),(11,24),(8,26),(6,24),(7,17)],'o')
    polygon(c,[(10,13),(14,13),(16,16),(15,22),(16,24),(13,24),(11,22),(9,25),(8,23),(8,17)],'a')
    polygon(c,[(9,14),(12,14),(13,18),(12,22),(10,24),(8,22),(8,17)],'p')
    c.line(10,16,9,21,'h')
    c.row(8,21,'rprrpr')
    polygon(c,[(9,4),(13,4),(16,6),(16,11),(13,13),(8,12),(6,9),(7,6)],'o')
    polygon(c,[(9,5),(13,5),(15,7),(14,11),(12,12),(8,10),(7,8),(8,6)],'d')
    c.row(9,5,'tmmtd')
    c.row(8,6,'tmtt')
    c.row(7,7,'sfft')
    c.row(7,8,'okft')
    c.row(6,9,'offd')
    c.row(7,10,'sfdt')
    c.row(8,11,'pnpp')
    c.point(8,12,'p')
    c.line(13,13,16,22,'d')
    c.line(14,14,16,20,'t')
    cluster(c,14,10,True)
    cluster(c,12,18)
    if pose is None:
        limb(c,[(10,15),(7,18),(7-step,22)],'a','p')
        c.row(6-step,22,'ofso')
        cluster(c,5-step,18)
    else:
        points=[[(10,15),(7,19),(7,17)],[(10,15),(15,16),(19,12)],[(10,15),(5,15),(1,15)],[(10,15),(6,18),(8,16)]][pose]
        limb(c,points,'a','p')
        hx,hy=points[-1]
        c.rect(hx-1,hy-1,3,3,'o')
        c.row(hx-1,hy-1,'plp')
        c.row(hx-1,hy,'fgf')
        c.point(hx,hy+1,'j')
    return c


def frame(direction,step=0,pose=None):
    if direction=='down':return front(step,pose)
    if direction=='up':return front(-step,pose,True)
    if direction=='left':return side(step,pose)
    return mirror(side(-step,pose))


def svg(c,label):
    lines=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.width}" height="{c.height}" viewBox="0 0 {c.width} {c.height}" shape-rendering="crispEdges">',f'  <title>ASHVEIL original spore-taken pilgrim: {label}</title>', '  <desc>Human face, hands and legs in worn pilgrim cloth; asymmetrical fungal shell. Original integer pixels. No external image inputs.</desc>']
    for y,row in enumerate(c.pixels):
        x=0
        while x<c.width:
            end,color=x+1,row[x]
            while end<c.width and row[end]==color:end+=1
            if color!='.':lines.append(f'  <rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{PALETTE[color]}"/>')
            x=end
    return ('\n'.join(lines)+'\n</svg>\n').encode()


def contact(walk,attacks):
    c=Canvas(704,1232,'#20292b')
    text(c,20,16,'ASHVEIL / SPORE PILGRIM 2',2)
    text(c,20,40,'ASH LINEN / PLUM COWL / FUNGAL SHELL')
    for i,label in enumerate(['STEP 0','IDLE 1','STEP 2']):text(c,148+i*164,64,label)
    for row,direction in enumerate(DIRS):
        y=80+row*136
        text(c,20,y+54,direction.upper())
        for col in range(3):
            x=132+col*164
            c.rect(x,y,144,130,'#151e20' if (row+col)%2==0 else '#303b39')
            c.line(x,y+124,x+143,y+124,'#59645b')
            c.blit(walk[(direction,col)],x+24,y+4,4)
    text(c,20,632,'READY 0 / DRAW 1 / STRIKE 2 / RESET 3')
    for row,direction in enumerate(DIRS):
        y=656+row*136
        text(c,20,y+54,direction.upper())
        for col in range(4):
            x=112+col*144
            c.rect(x,y,136,130,'#151e20' if (row+col)%2==0 else '#303b39')
            c.line(x,y+124,x+135,y+124,'#59645b')
            c.blit(attacks[(direction,col)],x+20,y+4,4)
    for i,color in enumerate(PALETTE.values()):c.rect(20+i*30,1208,22,12,color)
    return c


def json_bytes(value):return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()


def products():
    walk={(d,i):frame(d,[-1,0,1][i]) for d in DIRS for i in range(3)}
    attacks={(d,i):frame(d,[-1,0,1,0][i],i) for d in DIRS for i in range(4)}
    ws,ats=Canvas(72,128),Canvas(96,128)
    frames={}
    poses=[]
    for d in DIRS:
        for i in range(3):
            art=walk[(d,i)];key=f'spore1_w_{d}{i}'
            ws.blit(art,i*24,DIRS.index(d)*32)
            frames[key]=['original_spore1',i*24,DIRS.index(d)*32,24,32]
            poses.append((key,art))
        for i in range(4):
            art=attacks[(d,i)];key=f'spore1_a_{d}{i}'
            ats.blit(art,i*24,DIRS.index(d)*32)
            frames[key]=['original_spore1_atk',i*24,DIRS.index(d)*32,24,32]
            poses.append((key,art))
    walk_char={'walk':{d:[f'spore1_w_{d}{i}' for i in range(3)] for d in DIRS},'idle':{d:[f'spore1_w_{d}1'] for d in DIRS},'anchor':[0.5,0.92]}
    complete_char={**walk_char,'anchor':[0.5,30/32],'attack':{d:[f'spore1_a_{d}{i}' for i in range(4)] for d in DIRS},'attackAnchor':[0.5,30/32],'renderScale':1,'headOffset':26}
    sheets={'original_spore1':'sprites/original/ashveil-spore1-walk.png','original_spore1_atk':'sprites/original/ashveil-spore1-attack.png'}
    fragment={'format':'ashveil-atlas-fragment-v1','status':'prepared-not-installed','character':'spore1','sheets':sheets,'frames':frames,'chars':{'spore1':complete_char},'layout':{'walkCell':[24,32],'walkSheet':[72,128],'attackCell':[24,32],'attackSheet':[96,128],'floorPixelRow':29,'groundBoundaryY':30,'anchorPixelY':30,'headTopPixelRow':4,'headOffset':26,'renderScale':1,'rowOrder':DIRS,'note':'Complete integration proposal: preserves all 12 existing spore1 walk keys and idle references, uses scale 1 matching the new original human sprites, and anchors both equal-size sheets at the pixel boundary below sole row 29. Head offset is ground boundary 30 minus actual head top row 4; raised attack hands do not change anatomical head height. The old character has no attack frames; the 16 a_* keys are optional additions. The separate walk-only fragment preserves the historical 0.92 anchor and unspecified scale/head offset.'}}
    walk_fragment={'sheets':{'original_spore1':sheets['original_spore1']},'frames':{k:v for k,v in frames.items() if '_w_' in k},'chars':{'spore1':walk_char}}
    files={
      'ashveil-spore1-walk.png':png(ws),'ashveil-spore1-walk.svg':svg(ws,'walk and idle'),
      'ashveil-spore1-attack.png':png(ats),'ashveil-spore1-attack.svg':svg(ats,'optional unarmed attack'),
      'ashveil-spore1-contact.png':png(contact(walk,attacks)),
      'ashveil-spore1-palette.json':json_bytes(PALETTE),
      'ashveil-spore1-frames.json':json_bytes(fragment),
      'ashveil-spore1-walk-only.fragment.json':json_bytes(walk_fragment),
    }
    checks=[]
    unique=set()
    for key,art in poses:
        raw=b''.join(rgba(p) for row in art.pixels for p in row)
        digest=hashlib.sha256(raw).hexdigest()
        unique.add(digest)
        alpha=[rgba(p)[3] for row in art.pixels for p in row]
        assert sorted(set(alpha))==[0,255]
        bottom=max(y for y,row in enumerate(art.pixels) if any(p!='.' for p in row))
        top=min(y for y,row in enumerate(art.pixels) if any(p!='.' for p in row))
        assert bottom==29,(key,bottom)
        if '_w_' in key:assert top==4,(key,top)
        checks.append({'key':key,'rgbaSha256':digest,'opaquePixels':alpha.count(255),'topRow':top,'bottomRow':bottom})
    assert len(unique)==28,len(unique)
    files['ashveil-spore1-integrity.json']=json_bytes({
      'scope':'One original second spore1 appearance, isolated and unregistered. No spore0 or shared atlas pixels modified.',
      'method':'original manually authored integer-coordinate pixel art','externalImageInputs':[],
      'generator':'draw-spore1.py','generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
      'provenance':'SOURCE.md','provenanceSha256':hashlib.sha256((ROOT/'SOURCE.md').read_bytes()).hexdigest(),
      'frameCount':28,'distinctPoseCount':len(unique),'walkFrameCount':12,'optionalAttackFrameCount':16,
      'alphaValues':[0,255],'paletteOnly':True,'floorPixelRow':29,
      'completeIntegration':{'anchor':[0.5,30/32],'attackAnchor':[0.5,30/32],'renderScale':1,'groundBoundaryY':30,'headTopPixelRow':4,'headOffset':26},
      'historicalWalkOnly':{'anchor':[0.5,0.92],'renderScaleUnspecified':True,'headOffsetUnspecified':True,'sha256':hashlib.sha256(files['ashveil-spore1-walk-only.fragment.json']).hexdigest()},
      'files':[{'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in files.items()],
      'poses':checks
    })
    return files


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    outputs=products()
    for name,data in outputs.items():
        target=ROOT/name
        if args.check:
            if not target.exists() or target.read_bytes()!=data:raise SystemExit('Byte mismatch: '+name)
        else:target.write_bytes(data)
    print(('CHECK PASS: ' if args.check else 'WROTE: ')+str(len(outputs))+' deterministic original-art files; 28 distinct poses')


if __name__=='__main__':main()

