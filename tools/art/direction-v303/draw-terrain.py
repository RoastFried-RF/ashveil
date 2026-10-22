#!/usr/bin/env python3
"""ASHVEIL v303 original terrain: authored integer geometry, no input artwork.

python3 tools/art/direction-v303/draw-terrain.py [--check]
Only baseline-registry.json metadata is read. Standard-library Canvas/PNG/SVG
implementation conventions are reused; every artwork coordinate below is new.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[3]
ART = Path('public/sprites/original/direction-v303/terrain')
FRAGMENT = Path('tools/art/direction-v303/terrain.fragment.json')
OWNED = {'kt_floor','av_complete_terrain_moss_v302','av_complete_terrain_walls_v302',
         'av_complete_terrain_depth_v302','av_complete_terrain_misc_v302',
         'av_complete_terrain_ground_v302','rusted_door_closed','rusted_door_open'}
P = {
    '.':'#00000000','bg':'#19191b','panel':'#302f2d','text':'#d0c2a0',
    'mortar':'#454641','flag':'#5b5a53','flag2':'#625e56','worn':'#6d695f','fissure':'#504e48',
    'ink':'#242426','shade':'#353535','stone':'#68645c','stone2':'#787166','stone3':'#55534e','lip':'#969080',
    'moss0':'#3c4438','moss1':'#4d5644','moss2':'#61694e',
    'soil0':'#49433c','soil1':'#504a41','soil2':'#5c5549','soil3':'#696050','silt':'#544c42',
    'grass0':'#484b3d','grass1':'#4e5140','grass2':'#5c6048','grass3':'#6b6b50',
    'mud0':'#3b3d38','mud1':'#47483e','mud2':'#555448','mudwet':'#333b39',
    'ash0':'#5e5c55','ash1':'#64615a','ash2':'#69655d','coal':'#5a5750',
    'water0':'#36403f','water1':'#394340','water2':'#414b46','water3':'#48514a',
    'deep0':'#282f33','deep1':'#2d3436','deep2':'#353e40',
    'depth0':'#504d48','depth1':'#53504b','depth2':'#5a574e','depthwet':'#4c4b46','depthjoint':'#494842',
    'wood0':'#302c28','wood1':'#494138','wood2':'#5c5142','wood3':'#70614c',
    'iron0':'#2b2d30','iron1':'#44484b','iron2':'#697075','iron3':'#89877d',
    'rust0':'#543e32','rust1':'#78503c','rust2':'#94664a','brass':'#9a8358',
    'paper0':'#a69a7b','paper1':'#c0b397','leather':'#695143','cloth':'#666452',
    'bone0':'#8a806b','bone1':'#b9ab8e','bone2':'#d0c2a0',
    'blood0':'#3f292a','blood1':'#633c3b','blood2':'#7a4943',
}


class Canvas:
    def __init__(self,w,h,fill='.'):
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
    def path(self,points,color):
        for a,b in zip(points,points[1:]):self.line(*a,*b,color)
    def poly(self,points,color):
        for y in range(min(v[1] for v in points),max(v[1] for v in points)+1):
            for x in range(min(v[0] for v in points),max(v[0] for v in points)+1):
                inside=False;prior=points[-1]
                for px,py in points:
                    qx,qy=prior
                    if (py>y+.5)!=(qy>y+.5) and x+.5<(qx-px)*(y+.5-py)/(qy-py)+px:inside=not inside
                    prior=(px,py)
                if inside:self.point(x,y,color)
    def blit(self,other,x,y,scale=1):
        for yy,row in enumerate(other.pixels):
            for xx,value in enumerate(row):
                if value!='.':self.rect(x+xx*scale,y+yy*scale,scale,scale,value)


def rgba(key):
    value=P.get(key,key).removeprefix('#')
    return bytes.fromhex(value)+(b'\xff' if len(value)==6 else b'')
def png(c):
    def chunk(tag,data):return struct.pack('>I',len(data))+tag+data+struct.pack('>I',zlib.crc32(tag+data)&0xffffffff)
    raw=b''.join(b'\0'+b''.join(rgba(v) for v in row) for row in c.pixels)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',c.width,c.height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
def svg(c,title):
    out=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.width}" height="{c.height}" viewBox="0 0 {c.width} {c.height}" shape-rendering="crispEdges">',
         '<title>'+title+'</title>','<desc>New authored integer pixel geometry. Reference images analysed only; no input image sampling.</desc>']
    for y,row in enumerate(c.pixels):
        x=0
        while x<c.width:
            end=x+1
            while end<c.width and row[end]==row[x]:end+=1
            if row[x]!='.':out.append(f'<rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{P.get(row[x],row[x])}"/>')
            x=end
    return ('\n'.join(out)+'\n</svg>\n').encode()
def jb(value):return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
def pixel_hash(c):return hashlib.sha256(b''.join(rgba(v) for row in c.pixels for v in row)).hexdigest()


# Four complete ash-limestone pavements. Tall, uneven courses and wide slabs;
# no16px tile motifs, repeating S shapes or bright bevel around each slab.
COURSES=[
 [(27,[29,46,53]),(22,[47,34,47]),(31,[37,54,37]),(25,[55,39,34]),(23,[32,43,53])],
 [(22,[43,51,34]),(30,[30,43,55]),(25,[52,39,37]),(23,[36,48,44]),(28,[46,30,52])],
 [(30,[34,49,45]),(24,[53,31,44]),(22,[39,55,34]),(29,[46,35,47]),(23,[31,45,52])],
 [(25,[50,37,41]),(28,[35,46,47]),(24,[45,53,30]),(22,[29,42,57]),(29,[42,39,47])],
]
SLAB_CHIPS=[(2,1,1,2),(1,2,2,1),(3,1,2,2),(1,3,1,1),(2,2,3,1),(1,1,2,3)]
WEAR_PATCHES=[[(5,7,7,1),(8,8,4,1)],[(13,11,8,1),(15,12,4,1)],[(6,14,4,1),(8,15,6,1)],
              [(12,6,5,1),(9,7,8,1)],[(5,10,6,1),(7,11,4,1)],[(16,15,7,1),(18,16,3,1)]]
CRACKS=[[(0,0),(2,2),(1,4),(3,6),(3,8)],[(0,0),(3,1),(5,0),(7,2)],
        [(0,0),(-1,3),(1,5),(0,7)],[(0,0),(2,-1),(5,0),(6,2)]]


def macro(q):
    c=Canvas(128,128,'mortar');y=0
    for row,(height,widths) in enumerate(COURSES[q]):
        assert sum(widths)==128;x=0
        for col,width in enumerate(widths):
            i=q*17+row*3+col;a,b,d,e=SLAB_CHIPS[i%6]
            outline=[(x+a,y+1),(x+width-b,y+1),(x+width-1,y+d),
                     (x+width-1,y+height-e),(x+width-3,y+height-1),
                     (x+2,y+height-1),(x+1,y+height-3),(x+1,y+3)]
            c.poly(outline,'flag2' if i%4==1 else 'flag')
            # Small matte abrasion patch, never an outline around the whole slab.
            for dx,dy,w,h in WEAR_PATCHES[i%6]:c.rect(x+dx,y+dy,w,h,'flag2')
            if i%3==0:c.rect(x+4,y+2,7,1,'worn')
            if i%7==3:
                path=[(x+width//2+dx,y+height//2+dy) for dx,dy in CRACKS[(i//7)%4]]
                c.path(path,'fissure')
            if i%5==2:c.rect(x+width-9,y+height-3,5,1,'fissure')
            x+=width
        y+=height
    assert y==128
    # Two matte edge pixels share the same field colour for arbitrary macro peers.
    for n in range(128):
        for edge in (0,127):c.point(n,edge,'flag');c.point(edge,n,'flag')
    return c


# Small shallow moss islands. Rectangles are connected lobes, never scatter noise.
MOSS_ISLANDS=[
 [(2,9,5,2),(4,7,4,2),(8,8,3,2)],[(7,3,3,2),(5,5,5,2),(9,6,3,2)],
 [(2,3,4,2),(4,5,3,2),(10,11,3,2)],[(8,10,5,2),(6,8,4,3),(3,9,3,1)],
 [(3,11,3,2),(6,10,5,2),(10,8,3,2)],[(2,5,3,2),(4,3,5,2),(9,4,3,1)],
 [(9,2,3,2),(7,4,4,2),(8,6,5,1)],[(1,11,4,1),(4,9,5,2),(9,10,3,2)],
 [(4,5,5,2),(2,6,3,2),(9,8,3,2)],[(2,2,3,2),(4,4,5,2),(6,6,3,1)],
 [(10,8,4,2),(6,7,5,2),(4,10,4,2)],[(6,11,5,2),(5,8,3,3),(2,8,3,2)],
]
MOSS_LARGE=[
 [(3,6,7,3),(7,4,6,2),(15,9,8,3),(19,12,7,3),(9,23,6,3)],
 [(4,3,6,3),(10,5,8,2),(18,17,8,3),(15,20,6,3),(5,25,4,2)],
 [(6,9,7,3),(3,12,8,2),(14,4,6,3),(18,6,8,2),(16,25,7,3)],
 [(2,18,8,3),(7,15,7,3),(16,7,8,3),(22,9,5,3),(17,25,5,2)],
 [(3,4,9,3),(9,7,5,2),(19,14,7,3),(15,17,8,3),(5,25,6,2)],
 [(4,11,7,3),(8,8,6,3),(17,4,6,3),(16,22,9,3),(23,25,4,2)],
 [(2,7,7,3),(6,10,7,2),(20,5,6,3),(14,21,8,3),(9,24,7,3)],
 [(4,18,8,3),(9,15,6,3),(16,5,8,3),(20,8,7,2),(20,25,5,2)],
 [(5,4,7,3),(9,7,6,2),(17,15,8,3),(21,18,6,3),(5,24,7,3)],
]
MOSS_TRAILS=[[(0,5),(5,5),(6,8),(6,15)],[(9,0),(9,4),(12,6),(15,6)],
             [(0,11),(7,11),(9,8),(15,8)],[(4,0),(4,8),(7,10),(7,15)],
             [(0,3),(7,3),(8,7),(15,7)],[(12,0),(12,9),(9,11),(9,15)]]


def moss(kind,i):
    c=Canvas(32 if kind=='l' else 16,32 if kind=='l' else 16)
    if kind=='t':
        path=MOSS_TRAILS[i];c.path(path,'moss0')
        for x,y in path[1:3]:c.rect(x-1,y,3,2,'moss1')
        return c
    islands=MOSS_LARGE[i] if kind=='l' else MOSS_ISLANDS[i]
    for j,(x,y,w,h) in enumerate(islands):
        c.poly([(x+1,y),(x+w-1,y),(x+w,y+1),(x+w-1,y+h),(x+1,y+h),(x,y+h-1)],'moss0')
        c.rect(x+1,y,w-2,h-1,'moss1')
        if j==1:c.rect(x+2,y,2,1,'moss2')
    return c


# Wall surface course layouts have variable joints beneath a thick upper cap.
WALL_COURSES=[[(0,5,6,5),(6,5,10,5),(0,10,11,4),(11,10,5,4)],
 [(0,5,11,4),(11,5,5,4),(0,9,4,5),(4,9,12,5)],
 [(0,5,8,6),(8,5,8,6),(0,11,5,3),(5,11,11,3)],
 [(0,5,4,4),(4,5,12,4),(0,9,9,5),(9,9,7,5)],
 [(0,5,13,5),(13,5,3,5),(0,10,7,4),(7,10,9,4)],
 [(0,5,5,6),(5,5,11,6),(0,11,12,3),(12,11,4,3)],
 [(0,5,10,4),(10,5,6,4),(0,9,6,5),(6,9,10,5)],
 [(0,5,7,5),(7,5,9,5),(0,10,3,4),(3,10,13,4)]]


def face(i):
    c=Canvas(16,16,'shade')
    c.poly([(0,1),(14,1),(16,3),(16,5),(0,5)],'stone')
    c.rect(0,1,14,1,'stone2');c.rect(1,2,5,1,'lip')
    for j,(x,y,w,h) in enumerate(WALL_COURSES[i]):
        c.rect(x,y,w,h,'stone3');c.rect(x+1,y+1,w-1,h-2,'stone' if j%3 else 'stone2')
    x=[9,4,11,6,3,12,7,10][i]
    c.path([(x,6),(x-1,8),(x,10)],'shade')
    c.rect(0,14,16,1,'stone3');c.rect(0,15,16,1,'ink')
    c.rect([3,11,6,2,9,4,12,7][i],3,2,1,'stone3')
    return c


def wall_top():
    c=Canvas(16,16,'shade')
    for x,y,w,h in [(1,1,9,6),(11,1,5,6),(1,8,5,8),(7,8,9,8)]:
        c.rect(x,y,w,h,'stone3');c.rect(x,y,w-1,1,'stone')
    c.rect(2,2,5,1,'stone2');c.rect(8,9,3,1,'stone')
    return c
def edge(side):
    c=Canvas(16,16)
    if side=='N':c.rect(0,0,16,1,'stone2');c.rect(0,1,16,2,'stone3')
    if side=='S':c.rect(0,13,16,1,'stone3');c.rect(0,14,16,2,'ink')
    if side=='W':c.rect(0,0,1,16,'stone2');c.rect(1,0,1,16,'stone3')
    if side=='E':c.rect(13,0,1,16,'stone3');c.rect(14,0,2,16,'ink')
    return c
def ledge(i):
    c=Canvas(16,16)
    c.rect(0,5,16,2,'stone2');c.rect(0,7,16,3,'stone3');c.rect(0,10,16,2,'ink')
    if i:c.poly([(7,5),(10,5),(10,8),(9,9),(7,7)],'shade');c.rect(1,6,4,1,'lip')
    else:c.rect(2,5,6,1,'lip');c.rect(12,7,3,2,'shade')
    return c


# Shelf objects differ in height, lean, stacks and empty niches; every layout new.
SHELVES=[('qbs.','lak'),('abk','s.q'),('lq.a','bak'),('ss.','qla'),('kb.q','als'),('a.lq','skb'),
 ('laq','b.sa'),('q.ak','slb'),('bss','k.qa'),('akl','qs.'),('s.qb','laa'),('lb.a','qks'),
 ('qks','a.lb'),('aaks','ql.'),('k.qs','lab'),('bl.q','saa'),('sq.l','bak'),('lba','q.s'),
 ('qa.b','lks'),('sbl','ak.'),('klaq','ss.'),('ab.s','qlk'),('ll.q','abs'),('qbl','ka.s')]
BOOKS={'a':(1,4),'b':(2,5),'k':(3,4),'q':(3,2),'s':(4,3),'l':(3,5),'.':(2,0)}
def bookrow(c,recipe,bottom):
    x=2
    for token in recipe:
        w,h=BOOKS[token];y=bottom-h
        if x+w>14:break
        if token in 'abk':
            tone={'a':'paper0','b':'leather','k':'cloth'}[token]
            c.rect(x,y,w,h,tone);c.rect(x,y,w,1,'paper1')
            if w>1:c.rect(x,y+2,w,1,'wood1')
        if token=='q':c.rect(x,y,w,h,'paper0');c.point(x+1,y,'paper1');c.point(x+2,y+1,'wood2')
        if token=='s':
            c.rect(x,y,w,h,'leather');c.rect(x+1,y+1,w-1,1,'paper0');c.rect(x,y+2,w,1,'wood2')
        if token=='l':
            c.poly([(x+1,y),(x+2,y),(x+3,bottom),(x+1,bottom)],'cloth');c.point(x+1,y,'paper1')
        x+=w
def shelf(i):
    c=Canvas(16,16,'wood0');c.rect(2,2,12,12,'ink')
    for y in (0,7,14):c.rect(0,y,16,1,'wood3');c.rect(0,y+1,16,1,'wood1')
    c.rect(0,0,2,16,'wood2');c.rect(14,0,2,16,'wood1')
    c.rect(1,0,1,16,'wood3');bookrow(c,SHELVES[i][0],7);bookrow(c,SHELVES[i][1],14)
    return c


# R2: quiet wet stone. Twelve tiles have no seam; eight have one straight partial
# seam entering from a tile edge. No right-angle junction, full-tile line or pipe.
DEPTH_SEAMS=[
 [],[(0,10),(4,9)],[],[(12,0),(12,4)],[],[],[(11,15),(10,11)],[],
 [(0,4),(5,5)],[],[],[(15,8),(11,8)],[],[],[(4,0),(5,4)],[],
 [(0,12),(3,11)],[],[(15,3),(11,4)],[],
]
DEPTH_WET=[(1,7,9,5),(6,2,7,6),(3,9,9,5),(0,4,7,7),(7,7,8,6),
 (8,1,7,6),(4,8,9,6),(2,3,8,6),(1,9,10,5),(5,7,8,7),
 (0,3,7,8),(8,5,7,7),(5,2,9,6),(1,2,8,7),(6,9,9,5),
 (3,5,8,8),(0,8,8,6),(6,0,8,7),(6,6,8,7),(1,8,9,6)]
DEPTH_WEAR={4:[(3,5),(4,5),(4,6)],9:[(11,3),(12,3),(11,4)],
            17:[(3,11),(3,12),(4,12)],19:[(11,4),(12,4),(12,5)]}
def depth(i):
    c=Canvas(16,16,'depth0')
    x,y,w,h=DEPTH_WET[i]
    c.poly([(x,y+2),(x+3,y),(x+w-2,y+1),(x+w,y+3),
            (x+w-1,y+h),(x+w-4,y+h+1),(x+1,y+h-1)],'depthwet')
    if DEPTH_SEAMS[i]:c.path(DEPTH_SEAMS[i],'depthjoint')
    for xx,yy in DEPTH_WEAR.get(i,[]):c.point(xx,yy,'depth2')
    return c


GROUND_PATCHES=[[(0,7),(5,6),(7,9),(12,9),(13,12),(8,13),(4,11),(0,12)],
 [(8,0),(11,0),(12,4),(9,8),(10,12),(7,14),(5,10),(7,5)],
 [(0,2),(4,3),(7,5),(13,4),(16,6),(14,8),(8,8),(4,6),(0,6)]]
TINY_GRASS=[[(3,10),(12,4)],[(7,3),(11,12)],[(2,5),(9,10)]]
def grass(i,mixed=False):
    c=Canvas(16,16,'grass0')
    c.poly(GROUND_PATCHES[i],'soil0' if mixed else 'grass1')
    if mixed:c.rect([7,3,10][i],[11,8,3][i],4,1,'soil1')
    for x,y in TINY_GRASS[i]:
        c.rect(x,y,2,1,'grass2');c.point(x+1,y-1,'grass2')
    x,y=TINY_GRASS[i][0];c.point(x,y,'grass3')
    return c
def dirt(i):
    # R3: quiet earth, two small asymmetric sediment clumps; no bright slab bars.
    c=Canvas(16,16,'soil0')
    deposits=[
      [[(3,6),(4,5),(4,6),(5,7)],[(11,11),(12,11),(12,12)]],
      [[(9,3),(10,3),(10,4),(11,4)],[(3,12),(4,11),(4,12),(4,13)]],
      [[(2,3),(3,3),(3,4)],[(9,10),(10,9),(10,10),(11,10),(11,11)]],
    ]
    for cluster in deposits[i]:
        for x,y in cluster:c.point(x,y,'soil1')
    x,y=deposits[i][0][1];c.point(x,y,'silt')
    return c
MUD_PUDDLES=[[(4,6),(8,4),(12,6),(13,9),(10,11),(5,10),(3,8)],
 [(1,8),(4,6),(8,7),(10,10),(8,13),(3,13),(1,11)],
 [(6,1),(11,2),(12,5),(10,7),(5,6),(3,4)],
 [(8,8),(12,7),(15,9),(14,13),(11,15),(7,12)]]
def mud(i):
    c=Canvas(16,16,'mud0')
    for x,y,w,h in [[(0,2,6,3),(9,13,7,3)],[(8,1,8,3),(1,13,6,2)],
                    [(0,8,5,3),(8,11,7,2)],[(1,1,6,3),(3,7,5,2)]][i]:c.rect(x,y,w,h,'mud1')
    c.poly(MUD_PUDDLES[i],'mudwet')
    x,y=[(2,3),(10,3),(2,10),(3,8)][i];c.rect(x,y,4,1,'mud2')
    if i==1:c.path([(11,8),(10,10),(11,11)],'grass2')
    if i==3:c.rect(4,11,2,3,'mudwet');c.rect(3,14,3,1,'mudwet')
    return c
def ash(i):
    c=Canvas(16,16,'ash0')
    # R2: two irregular connected dust mottles of3--5 pixels, no rectangle dash.
    mottles=[
      [[(3,4),(4,4),(4,5),(5,5)],[(11,10),(12,9),(12,10)]],
      [[(7,2),(8,2),(7,3),(6,3),(7,4)],[(2,12),(3,12),(3,13)]],
      [[(11,5),(12,5),(12,6),(13,6)],[(4,9),(3,10),(4,10),(4,11)]],
      [[(2,7),(3,6),(3,7),(4,7),(4,8)],[(10,12),(11,11),(11,12)]],
    ]
    for cluster in mottles[i]:
        for x,y in cluster:c.point(x,y,'ash1')
    x,y=mottles[i][0][1];c.point(x,y,'ash2')
    return c
def water(deep=False):
    c=Canvas(16,16,'deep0' if deep else 'water0')
    tone='deep1' if deep else 'water1';bright='deep2' if deep else 'water2'
    c.poly([(0,5),(5,4),(9,5),(16,5),(16,9),(11,10),(5,9),(0,9)],tone)
    # R2: one2px/3px low-contrast stroke, no stacked'=' ripple rows.
    c.line(10,4,11,4,bright) if deep else c.line(4,7,6,7,bright)
    return c
BLOOD=[
 [[(3,7),(6,5),(9,6),(10,9),(7,10),(4,9)],[(12,11),(14,11),(14,13),(12,13)]],
 [[(1,4),(4,3),(6,5),(5,7),(2,7)],[(7,9),(10,8),(12,10),(11,13),(8,12)]],
 [[(8,2),(10,4),(9,8),(7,9),(8,12),(6,15),(4,14),(5,10),(4,7),(6,5)]],
 [[(2,10),(6,9),(8,6),(11,5),(14,7),(13,10),(9,11),(6,13),(3,12)]],
 [[(2,6),(6,3),(10,3),(13,5),(15,8),(13,12),(10,14),(5,14),(2,11),(1,8)]],
]
def blood(i):
    c=Canvas(16,16)
    for p in BLOOD[i]:c.poly(p,'blood0')
    fills=[[(4,7),(6,6),(8,7),(8,9),(5,9)],[(8,10),(10,9),(11,11),(10,12),(8,11)],
           [(7,4),(8,5),(7,9),(6,11),(6,14),(5,13),(6,9)],
           [(4,11),(7,10),(10,7),(12,7),(12,9),(8,11),(5,12)],
           [(4,6),(7,4),(10,5),(12,7),(12,10),(9,12),(6,12),(3,9)]]
    c.poly(fills[i],'blood1')
    x,y,w=[(5,7,2),(9,10,1),(6,8,1),(8,9,2),(6,7,4)][i];c.rect(x,y,w,1,'blood2')
    return c
DECK_JOINTS=[[10,None],[None,4],[6,13]]
def deck(i):
    c=Canvas(16,16,'wood0')
    for row,y in enumerate((0,8)):
        c.rect(0,y,16,7,'wood2');c.rect(0,y+6,16,1,'wood1')
        joint=DECK_JOINTS[i][row]
        if joint is not None:
            c.rect(joint,y,1,7,'wood0');c.point(joint+1 if joint<15 else joint-1,y+2,'iron1')
    scars=[[(1,2,6),(8,11,5)],[(8,3,5),(1,10,6)],[(1,3,4),(6,12,6)]]
    for x,y,w in scars[i]:c.rect(x,y,w,1,'wood3')
    x,y=[(3,11),(11,4),(9,10)][i];c.rect(x,y,3,1,'wood1');c.point(x+1,y+1,'wood3')
    return c


def stair(up=False):
    c=Canvas(16,16,'stone3');c.rect(1,1,14,14,'ink')
    treads=[(1,2,14),(2,5,12),(3,8,10),(5,11,6)]
    if up:treads=[(6,2,4),(5,5,6),(3,8,10),(1,11,14)]
    for x,y,w in treads:
        c.rect(x,y,w,1,'stone2');c.rect(x,y+1,w,1,'stone');c.rect(x,y+2,w,1,'stone3')
    c.point(2 if up else 4,12 if up else 8,'shade');c.rect(1,15,14,1,'shade')
    return c
def ladder(down=False):
    c=Canvas(16,16)
    if down:
        c.rect(1,2,14,13,'stone3');c.rect(2,3,12,11,'ink');c.rect(1,2,14,1,'stone2')
        c.line(4,3,6,13,'wood1');c.line(11,3,9,13,'wood1')
        for x,y,w,tone in [(4,4,8,'wood3'),(5,7,6,'wood2'),(5,10,6,'wood1'),(6,12,4,'wood1')]:c.rect(x,y,w,1,tone)
        c.rect(3,1,3,2,'iron2');c.rect(10,1,3,2,'iron1')
    else:
        c.line(4,1,4,15,'wood2');c.line(11,1,11,15,'wood1')
        c.line(3,1,4,0,'iron2');c.line(11,0,12,1,'iron1')
        for y in (3,7,11,15):c.rect(4,y,8,1,'wood3');c.point(10,y,'iron1')
        c.point(4,5,'wood3');c.point(11,13,'wood0')
    return c
def skull():
    c=Canvas(16,16)
    c.poly([(4,4),(8,3),(12,5),(13,8),(11,11),(8,13),(4,11),(3,8)],'bone0')
    c.poly([(4,5),(7,4),(10,5),(12,7),(11,9),(8,10),(5,9),(4,7)],'bone1')
    c.rect(4,5,3,1,'bone2');c.rect(5,7,2,2,'ink');c.rect(10,7,2,2,'ink')
    c.point(9,10,'ink');c.rect(6,11,3,1,'bone1');c.point(7,11,'wood1')
    c.path([(8,4),(8,5),(9,6)],'bone0')
    return c


def door_closed():
    c=Canvas(16,32)
    c.poly([(1,6),(3,3),(6,1),(10,1),(13,3),(15,6),(15,31),(1,31)],'shade')
    c.poly([(1,6),(4,3),(7,2),(10,2),(13,4),(15,7),(12,7),(10,5),(6,5),(3,7)],'stone')
    c.rect(1,7,2,23,'stone');c.rect(13,7,2,23,'stone3')
    c.rect(1,7,1,21,'stone2');c.rect(1,8,1,5,'lip')
    c.poly([(3,7),(6,5),(10,5),(13,7),(13,29),(3,29)],'iron0')
    c.rect(4,8,8,20,'iron1');c.rect(4,8,1,19,'iron2')
    c.rect(7,7,1,21,'iron0');c.rect(11,8,1,21,'iron0')
    for y in (11,22):
        c.rect(3,y,10,2,'iron0');c.rect(4,y,7,1,'iron2')
        c.point(4,y,'iron3');c.point(10,y,'rust1')
    c.rect(10,16,2,4,'iron0');c.point(10,17,'brass');c.point(10,18,'shade')
    for x,y,w,h in [(5,13,2,4),(8,23,3,4),(5,25,2,3),(10,9,1,2)]:
        c.rect(x,y,w,h,'rust0');c.rect(x,y,w,1,'rust1')
    c.rect(1,29,14,2,'stone3');c.rect(2,29,11,1,'stone2');c.rect(1,31,14,1,'ink')
    return c
def door_open():
    c=Canvas(16,16)
    c.rect(1,1,2,13,'stone');c.rect(13,1,2,13,'stone3')
    c.rect(3,2,10,11,'ink')
    # Edge-on open iron leaf has its own16px geometry, not a cropped closed door.
    c.poly([(3,1),(6,3),(6,13),(3,12)],'iron0')
    c.line(3,1,3,12,'iron2');c.line(4,3,4,11,'iron1')
    c.rect(4,4,2,1,'rust1');c.rect(4,10,2,2,'rust0')
    c.point(5,7,'brass');c.rect(1,13,14,2,'stone3');c.rect(2,13,11,1,'stone2')
    c.rect(1,15,14,1,'ink')
    return c


FONT={
 'A':'010/101/111/101/101','B':'110/101/110/101/110','C':'011/100/100/100/011',
 'D':'110/101/101/101/110','E':'111/100/110/100/111','F':'111/100/110/100/100',
 'G':'011/100/101/101/011','H':'101/101/111/101/101','I':'111/010/010/010/111',
 'J':'001/001/001/101/010','K':'101/101/110/101/101','L':'100/100/100/100/111',
 'M':'101/111/111/101/101','N':'101/111/111/111/101','O':'010/101/101/101/010',
 'P':'110/101/110/100/100','Q':'010/101/101/011/001','R':'110/101/110/101/101',
 'S':'011/100/010/001/110','T':'111/010/010/010/010','U':'101/101/101/101/111',
 'V':'101/101/101/101/010','W':'101/101/111/111/101','X':'101/101/010/101/101',
 'Y':'101/101/010/010/010','Z':'111/001/010/100/111',
 '0':'111/101/101/101/111','1':'010/110/010/010/111','2':'110/001/010/100/111',
 '3':'110/001/010/001/110','4':'101/101/111/001/001','5':'111/100/110/001/110',
 '6':'011/100/111/101/111','7':'111/001/010/010/010','8':'111/101/111/101/111',
 '9':'111/101/111/001/110','_':'000/000/000/000/111','-':'000/000/111/000/000',
 ' ':'000/000/000/000/000','/':'001/001/010/100/100',
}
def text(c,x,y,value,scale=1):
    for i,letter in enumerate(value.upper()):
        for yy,row in enumerate(FONT[letter].split('/')):
            for xx,v in enumerate(row):
                if v=='1':c.rect(x+(4*i+xx)*scale,y+yy*scale,scale,scale,'text')
def contact(title,members,cols=5,cw=132,ch=112,scale=4):
    c=Canvas(16+cols*cw,44+((len(members)+cols-1)//cols)*ch,'bg');text(c,10,10,title,2)
    for i,(key,art) in enumerate(members):
        x=10+(i%cols)*cw;y=34+(i//cols)*ch
        c.rect(x,y,cw-8,ch-8,'panel')
        for yy in range(art.height):
            for xx in range(art.width):
                c.rect(x+6+xx*scale,y+4+yy*scale,scale,scale,'shade' if ((xx//4+yy//4)&1) else 'wood0')
        c.blit(art,x+6,y+4,scale);text(c,x+3,y+art.height*scale+12,key)
    return c
def fields(frames):
    c=Canvas(628,700,'bg');text(c,12,10,'ADJACENT16PX MATERIALS / 3X',2)
    groups=[('LOW GRASS',['grass0','grass1','grass2']),('DRY EARTH',['dirt0','dirt1','dirt2']),
            ('SETTLED ASH',['ash0','ash1','ash2','ash3']),('QUIET WATER',['water_shallow','water_deep']),
            ('TIMBER DECK',['deck0','deck1','deck2']),('WET LIMESTONE',[f'cd_floor{i}' for i in range(20)])]
    selection=[[0,1,0,2,1,0],[2,0,1,0,0,2],[1,2,0,1,2,1],[0,0,2,1,0,2]]
    for g,(title,keys) in enumerate(groups):
        x=12+(g%2)*308;y=44+(g//2)*218;text(c,x,y-10,title)
        for yy in range(4):
            for xx in range(6):
                key=keys[(yy*6+xx)%len(keys)] if g==5 else keys[0 if xx<3 else 1] if g==3 else keys[selection[yy][xx]%len(keys)]
                c.blit(frames[key],x+xx*48,y+yy*48,3)
    return c


def build():
    groups={
      'floor':[(f'kt_floor_q{i}',macro(i)) for i in range(4)],
      'moss':[(f'moss_s{i}',moss('s',i)) for i in range(12)]+[(f'moss_t{i}',moss('t',i)) for i in range(6)]+[(f'moss_l{i}',moss('l',i)) for i in range(9)],
      'walls':[(f'wall_face{i}',face(i)) for i in range(8)]+[('wall_top',wall_top())]+[(f'wall_edge_{s}',edge(s)) for s in 'NSEW']+[(f'wall_ledge{i}',ledge(i)) for i in range(2)]+[(f'shelf{i}',shelf(i)) for i in range(24)],
      'depth':[(f'cd_floor{i}',depth(i)) for i in range(20)],
      'misc':[('floor_stairs',stair()),('floor_ladder',ladder()),('skull',skull()),('complete_stairs_up',stair(True)),('complete_ladder_down',ladder(True))],
      'ground':[(f'grass{i}',grass(i)) for i in range(3)]+[(f'grassdirt{i}',grass(i,True)) for i in range(3)]+[(f'dirt{i}',dirt(i)) for i in range(3)]+[(f'mud{i}',mud(i)) for i in range(4)]+[(f'ash{i}',ash(i)) for i in range(4)]+[('water_shallow',water()),('water_deep',water(True))]+[(f'blood{i}',blood(i)) for i in range(4)]+[('blood_pool',blood(4))]+[(f'deck{i}',deck(i)) for i in range(3)],
      'doors':[('rusted_door_closed',door_closed()),('rusted_door_open',door_open())],
    }
    baseline=json.loads((ROOT/'tools/art/direction-v303/baseline-registry.json').read_text())
    expected={k:v for k,v in baseline['frames'].items() if v[0] in OWNED}
    all_art={k:v for members in groups.values() for k,v in members}
    assert len(expected)==124 and set(expected)==set(all_art)
    for key,c in all_art.items():assert expected[key][3:]==[c.width,c.height],key
    assert len({pixel_hash(c) for c in all_art.values()})==124
    assert len(DEPTH_SEAMS)==20 and sum(bool(v) for v in DEPTH_SEAMS)==8
    assert all(len(v) in (0,2) for v in DEPTH_SEAMS)
    assert all(max(abs(v[0][0]-v[1][0]),abs(v[0][1]-v[1][1]))<=5 for v in DEPTH_SEAMS if v)
    assert sum(len(v) for v in DEPTH_WEAR.values())==12
    quiet_metrics={
      'depthSeamFreeTiles':sum(not v for v in DEPTH_SEAMS),
      'depthPartialSeamTiles':sum(bool(v) for v in DEPTH_SEAMS),
      'depthWearPixelsAcross20Tiles':sum(len(v) for v in DEPTH_WEAR.values()),
      'ashDustPixelsPerTile':[sum(v in ('ash1','ash2') for row in all_art[f'ash{i}'].pixels for v in row) for i in range(4)],
      'dirtSedimentPixelsPerTile':[sum(v in ('soil1','silt') for row in all_art[f'dirt{i}'].pixels for v in row) for i in range(3)],
      'waterRipplePixels':{key:sum(v in ('water2','deep2') for row in all_art[key].pixels for v in row) for key in ('water_shallow','water_deep')},
    }
    assert all(6<=n<=10 for n in quiet_metrics['ashDustPixelsPerTile'])
    assert quiet_metrics['dirtSedimentPixelsPerTile']==[7,8,8]
    assert quiet_metrics['waterRipplePixels']=={'water_shallow':3,'water_deep':2}
    for key,c in all_art.items():
        if key.startswith(('grass','dirt','mud','ash','water','deck','cd_floor','kt_floor','wall_face')) or key=='wall_top':
            assert all(v!='.' for row in c.pixels for v in row),key
    # Edge equality for every ordered pairing of128px macro pavements.
    floors=[c for _,c in groups['floor']]
    for a in floors:
        for b in floors:
            assert [r[-1] for r in a.pixels]==[r[0] for r in b.pixels]
            assert a.pixels[-1]==b.pixels[0]
    assert all(len(set(v for row in c.pixels for v in row))<=5 for _,c in groups['floor'])
    fragment={'sheets':{},'frames':{}};out={};atlas_sizes={}
    for group,members in groups.items():
        cell,cols=(128,2) if group=='floor' else (32,6) if group=='moss' else (32,2) if group=='doors' else (16,8)
        c=Canvas(cell*cols,((len(members)+cols-1)//cols)*cell)
        sheet='av_direction_terrain_'+group+'_v303'
        fragment['sheets'][sheet]=str(ART/(group+'.png')).removeprefix('public/')
        atlas_sizes[sheet]=[c.width,c.height]
        for i,(key,art) in enumerate(members):
            x,y=(i%cols)*cell,(i//cols)*cell;c.blit(art,x,y)
            fragment['frames'][key]=[sheet,x,y,art.width,art.height]
        out[ART/(group+'.png')]=png(c);out[ART/(group+'.svg')]=svg(c,'ASHVEIL v303 original '+group)
    contacts={
      'contact-floor.png':contact('WORN LIMESTONE128PX / 2X',groups['floor'],2,276,280,2),
      'contact-moss-small.png':contact('SHALLOW MOSS AND DAMP JOINTS / 4X',groups['moss'][:18],6),
      'contact-moss-large.png':contact('BROKEN MOSS COLONIES / 4X',groups['moss'][18:],3,150,156,4),
      'contact-walls.png':contact('STONE CAP FACE AND THICKNESS / 6X',groups['walls'][:15],5,132,138,6),
      'contact-shelves.png':contact('24 BOOK STORAGE LAYOUTS / 6X',groups['walls'][15:],6,126,138,6),
      'contact-depth.png':contact('WET LIMESTONE TILES / 6X',groups['depth'],5,132,138,6),
      'contact-ground.png':contact('EARTH GRASS MUD ASH WATER BLOOD DECK / 6X',groups['ground'],5,136,140,6),
      'contact-misc.png':contact('STONE STEPS TIMBER LADDERS AND SKULL / 6X',groups['misc'],3,156,140,6),
      'contact-doors.png':contact('RUSTED IRON DOOR CLOSED AND OPEN / 6X',groups['doors'],2,180,224,6),
      'material-fields.png':fields(all_art),
    }
    for name,c in contacts.items():out[ART/name]=png(c)
    out[FRAGMENT]=jb(fragment);out[ART/'palette.json']=jb(P)
    for key,(sheet,x,y,w,h) in fragment['frames'].items():
        sw,sh=atlas_sizes[sheet];assert 0<=x and 0<=y and x+w<=sw and y+h<=sh,key
    source={
      'version':'v303','revision':'terrain-r3-quiet-earth','created':'2026-10-22','generator':'tools/art/direction-v303/draw-terrain.py',
      'generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
      'method':'New authored integer polygon vertices, masonry courses, sparse grass leaves, compact sediment islands, short ripple strokes, wood joints and rust underneath iron fixtures.',
      'externalImageInputs':[],'tracing':False,'recolouring':False,'randomNoise':False,
      'softwareReuse':'Own repository Canvas/PNG/SVG/bitmap-label routines only. Previous artwork coordinate arrays and pixels are not imported.',
      'referenceAnalysisOnly':['test-results/references-v303/stoneshard-0.jpg','test-results/references-v303/fear-hunger-0.jpg','test-results/references-v303/darkwood-0.jpg','test-results/references-v303/darkest-dungeon-0.jpg'],
      'direction':'Neutral wet limestone, earth and rust; small top-left light accents; low-contrast sparse grass; structural thickness; no large S motifs or glowing floor veins.',
      'reviewRevision':{'reason':'Independent R1 review found pipe/maze-like depth seams, brick-row ash dashes and repeated equals-sign water ripples.',
                       'changes':{'cd_floor0..19':'12 tiles with no seam,8 with one straight partial seam of4--6 pixels;4 tiny3-pixel wear marks in the20-tile set; broad washes differ only slightly in value.',
                                  'ash0..3':'Two irregular connected3--5-pixel dust mottles per tile; no rectangular dashes or charcoal bars.',
                                  'water_shallow/water_deep':'One low-contrast3px/2px ripple stroke per tile; no stacked equals-sign rows.'},
                       'changedFrameCount':26,'mappingAndLogicalDimensions':'All124 frame keys, atlas rectangles and7 sheet URLs remain identical to R1.'},
      'r3ReviewRevision':{'reason':'Final GPU independent review found bright horizontal rectangular dirt0..2 bars repeating across large earth fields.',
                          'changes':'Replaced dirt0..2 geometry with quiet empty earth and two asymmetric low-contrast3--5-pixel sediment clusters,7/8/8 marked pixels per tile.',
                          'changedFrameCount':3,'unchangedFramesAgainstR2':121,'mappingAndLogicalDimensions':'All124 frame rectangles and7 sheet URLs remain byte-identical to R2.'},
      'revisionChecks':quiet_metrics,
      'ownedBaselineSheets':sorted(OWNED),'baselineFrameCount':124,'counts':{k:len(v) for k,v in groups.items()},
      'coverage':{'missing':sorted(set(expected)-set(all_art)),'extra':sorted(set(all_art)-set(expected)),'preservedAllKeysAndWidthsHeights':True},
      'validation':['124 unique pixel hashes','124 exact baseline keys and dimensions','base-layer opacity','all atlas bounds','every128px macro edge pairing','floor palette<=5 colours','R2 sparse partial-seam/ash/ripple counts','byte equality with --check'],
      'runtimeReview':'Isolated artwork package; production mapping, in-game light/tint and browser checks belong to the coordinating task.',
      'excluded':['original_hearth_oat_plot (props owner)','production manifest','Core','Defs','package files','Git','GPU/Full checks'],
      'frames':[{'key':k,'size':[c.width,c.height],'rgbaSha256':pixel_hash(c)} for k,c in all_art.items()],
      'files':[{'path':str(p),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for p,data in out.items()],
    }
    out[ART/'source-integrity.json']=jb(source)
    return out


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    outputs=build()
    for rel,data in outputs.items():
        path=ROOT/rel
        if args.check:
            if not path.exists() or path.read_bytes()!=data:raise SystemExit('DIFF '+str(rel))
        else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    print(('CHECK PASS' if args.check else 'WROTE')+f':{len(outputs)} artifacts /124 exact baseline terrain frames /7 original sheets')


if __name__=='__main__':main()
