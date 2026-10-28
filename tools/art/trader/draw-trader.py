#!/usr/bin/env python3
"""Original resident trader: adult 28px body, 28 manually authored poses.
No image inputs, game imports or installation. Standard library output only.
Run: python3 draw-trader.py [--check]
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
 'o':'#1f2426','k':'#2c2d2b',
 'd':'#443330','t':'#695044','m':'#967257','l':'#b08d6b',
 'c':'#616a65','p':'#969b89','h':'#c8c4ab',
 's':'#88694f','f':'#ba9270','e':'#dab18a',
 'u':'#2d3333','v':'#4d5651','w':'#7b8274',
 'a':'#333f40','g':'#536264','j':'#7f8a80',
 'b':'#3d342e','r':'#62503e','n':'#8b7154'
}
USAGE=json.loads('{"scope": "Read-only raw Creature definition inheritance snapshot; content patches are not evaluated by this art tool. No simulation or runtime world was instantiated.", "actualTraderDefinitions": [{"id": "Creature.LanternMerchant", "source": "src/content/core/defs/saltrim-coast.json", "rawDefinition": {"defType": "Creature", "id": "Creature.LanternMerchant", "parent": "Creature.SettlementTrader", "label": "형제단 소금 장부지기", "faction": "lantern"}, "inheritanceChain": ["Creature.Human", "Creature.Settler", "Creature.SettlementTrader", "Creature.LanternMerchant"], "rawInheritedFields": {"char": "hero", "loadout": {"slots": [{"items": ["Item.RagShirt"]}, {"items": ["Item.LeatherCoat"]}, {"items": ["Item.Boots"]}, {"items": ["Item.Hood"]}, {"items": ["Item.Hardtack"], "count": [3, 3]}, {"items": ["Item.WaterBottle"], "count": [2, 2]}]}, "faction": "lantern", "body": "Body.Humanoid", "sizeClass": "medium", "ai": "civilian", "inn": "Inn.Hearth"}}, {"id": "Creature.SettlementTrader", "source": "src/content/core/defs/society.json", "rawDefinition": {"defType": "Creature", "id": "Creature.SettlementTrader", "parent": "Creature.Settler", "label": "상인", "ai": "civilian", "inn": "Inn.Hearth"}, "inheritanceChain": ["Creature.Human", "Creature.Settler", "Creature.SettlementTrader"], "rawInheritedFields": {"char": "hero", "loadout": {"slots": [{"items": ["Item.RagShirt"]}, {"items": ["Item.LeatherCoat"]}, {"items": ["Item.Boots"]}, {"items": ["Item.Hood"]}, {"items": ["Item.Hardtack"], "count": [3, 3]}, {"items": ["Item.WaterBottle"], "count": [2, 2]}]}, "faction": "coalition", "body": "Body.Humanoid", "sizeClass": "medium", "ai": "civilian", "inn": "Inn.Hearth"}}, {"id": "Creature.SignalistMerchant", "source": "src/content/core/defs/field-devices.json", "rawDefinition": {"defType": "Creature", "id": "Creature.SignalistMerchant", "parent": "Creature.SettlementTrader", "label": "신호회 부품 교환원", "faction": "signalists", "description": "첫불 폐허의 통신 기술자 후손이다. 실제 도구와 부품으로 남은 수신 설비를 돌본다."}, "inheritanceChain": ["Creature.Human", "Creature.Settler", "Creature.SettlementTrader", "Creature.SignalistMerchant"], "rawInheritedFields": {"char": "hero", "loadout": {"slots": [{"items": ["Item.RagShirt"]}, {"items": ["Item.LeatherCoat"]}, {"items": ["Item.Boots"]}, {"items": ["Item.Hood"]}, {"items": ["Item.Hardtack"], "count": [3, 3]}, {"items": ["Item.WaterBottle"], "count": [2, 2]}]}, "faction": "signalists", "body": "Body.Humanoid", "sizeClass": "medium", "ai": "civilian", "inn": "Inn.Hearth", "description": "첫불 폐허의 통신 기술자 후손이다. 실제 도구와 부품으로 남은 수신 설비를 돌본다."}}], "sourceFiles": [{"path": "src/content/core/defs/creatures.json", "sha256": "6e7fb95a1ab39a2b3b2b0200187a38de72dad7519545bcf53ec4b83a4e0b5e48"}, {"path": "src/content/core/defs/field-devices.json", "sha256": "ddd3b557576d2551db085b92f40c02265792c28878cc332a30a1bfe8687a334b"}, {"path": "src/content/core/defs/saltrim-coast.json", "sha256": "fe8157f03c340b1d2cb9346f733242f8a4972af4cf53cff945c04ca37d0f6318"}, {"path": "src/content/core/defs/society.json", "sha256": "d0627be923bda9376b695045229b1c4fc110d6e6376ffbd92f810e2d32311ea1"}], "existingRawChar": "hero", "proposedVisualChar": "resident_trader", "proposedVisualCharPreviouslyPresent": false, "integrationNote": "Root owns the current characterAliases implementation; the new role art does not change saved sprite, ownership, faction, stock, needs, traits or existing hero pixels."}')
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
    if direction in ['down','up']:
        lx=8+(1 if step==1 else -1 if step==-1 else 0)
        rx=14+(-1 if step==1 else 1 if step==-1 else 0)
        ly=29 if step==1 else 30
        ry=29 if step==-1 else 30
        polygon(c,[(8,21),(12,21),(11,25),(lx+2,ly),(lx-1,ly),(7,25)],'o')
        polygon(c,[(13,21),(17,21),(18,25),(rx+2,ry),(rx-1,ry),(13,25)],'o')
        c.line(9,22,lx,ly-3,'g')
        c.line(15,22,rx,ry-3,'a')
        c.row(lx-1,ly-3,'gj')
        c.row(rx-1,ry-3,'ag')
        c.row(lx-2,ly-2,'rrnro')
        c.row(lx-2,ly-1,'rnnbo')
        c.row(lx-2,ly,'obbbbo')
        c.row(rx-1,ry-2,'rnrro')
        c.row(rx-1,ry-1,'rrnbo')
        c.row(rx-1,ry,'obbbbo')
    else:
        far=2 if step==1 else -2 if step==-1 else 0
        near=-far;fy=29 if step==-1 else 30;ny=29 if step==1 else 30
        polygon(c,[(11,21),(15,21),(14+far,25),(13+far,fy),(10+far,fy),(11,25)],'o')
        c.line(13,22,12+far,fy-3,'a')
        c.row(10+far,fy-2,'rrro')
        c.row(10+far,fy-1,'rnbo')
        c.row(9+far,fy,'obbbbo')
        polygon(c,[(8,21),(13,21),(12+near,25),(11+near,ny),(7+near,ny),(8,25)],'o')
        c.line(10,22,10+near,ny-3,'g')
        c.row(8+near,ny-2,'rrno')
        c.row(8+near,ny-1,'rnbo')
        c.row(7+near,ny,'obbbbo')


def sleeve(c,points):
    limb(c,points,'c','p')
    x,y=points[-1]
    c.row(x-1,y-1,'php')
    c.row(x-1,y,'sfs')
    c.point(x,y+1,'f')


def front(step,back=False,active=True):
    c=Canvas(24,32)
    legs(c,'up' if back else 'down',step)
    left=[(6,14),(4,18),(6,21+step)]
    right=[(17,14),(20,18),(18,21-step)]
    sleeve(c,right if back else left)
    if active:sleeve(c,left if back else right)
    # Broad folded collar over a repaired, short double-front waistcoat. No
    # inventory objects are attached: the seam shapes are all ordinary clothes.
    polygon(c,[(8,11),(15,11),(19,14),(18,21),(19,23),(15,24),(12,22),(9,24),(5,22),(5,15)],'o')
    polygon(c,[(8,12),(15,12),(17,15),(16,21),(17,22),(13,21),(11,23),(7,22),(6,16)],'c')
    if back:
        polygon(c,[(8,13),(15,13),(17,16),(16,21),(17,22),(13,23),(9,22),(7,22),(6,16)],'t')
        c.line(8,14,9,20,'m')
        c.line(12,14,12,21,'d')
        c.line(15,15,15,20,'d')
        c.row(8,12,'pphhpp')
        c.row(8,21,'nrnnrrnr')
        c.row(9,22,'rrnnrr')
        c.point(7,19,'l')
    else:
        polygon(c,[(8,13),(11,14),(11,20),(9,23),(7,22),(6,16)],'t')
        polygon(c,[(13,14),(16,13),(18,16),(17,21),(15,23),(13,21)],'t')
        c.line(7,15,8,20,'m')
        c.line(16,15,16,20,'m')
        c.line(9,14,10,20,'d')
        c.line(14,15,14,20,'d')
        c.row(8,12,'phpphp')
        c.row(9,13,'hphph')
        c.row(10,14,'php')
        c.line(12,15,12,20,'p')
        c.point(12,17,'c')
        c.point(12,19,'c')
        c.row(7,21,'nrnrrrnrn')
        c.row(8,22,'rrnnrrrn')
        c.point(9,23,'m')
    # Swept dark hair with two quiet grey temple pixels, a full adult human face.
    polygon(c,[(10,3),(14,3),(17,5),(17,8),(15,11),(13,12),(9,11),(7,8),(7,5)],'o')
    polygon(c,[(10,4),(14,4),(16,6),(16,8),(14,11),(10,10),(8,8),(8,6)],'f')
    c.row(9,3,'uvvvu')
    c.row(8,4,'uvvvuuv')
    c.row(8,5,'vuuuffu')
    c.point(8,6,'w')
    c.point(15,6,'v')
    if back:
        c.row(9,6,'uvvvu')
        c.row(9,7,'vuuuv')
        c.row(10,8,'uvvu')
        c.row(10,9,'vuu')
        c.row(11,10,'sf')
        c.row(10,11,'ppp')
    else:
        c.row(9,6,'sfffs')
        c.row(9,7,'fkfkf')
        c.row(10,8,'sfe')
        c.row(10,9,'sfs')
        c.row(10,10,'rss')
        c.row(11,11,'ff')
        c.point(14,8,'e')
    return c


def side(step,active=True):
    c=Canvas(24,32)
    legs(c,'left',step)
    sleeve(c,[(15,14),(17,18),(16,21-step)])
    polygon(c,[(10,11),(15,12),(18,15),(17,21),(18,23),(14,24),(11,22),(8,24),(6,22),(7,16)],'o')
    polygon(c,[(10,12),(14,13),(16,16),(15,20),(16,22),(13,22),(11,21),(9,23),(8,21),(8,16)],'t')
    c.line(14,14,15,20,'m')
    c.line(13,15,13,21,'d')
    polygon(c,[(9,12),(11,13),(10,20),(9,22),(8,20),(8,15)],'c')
    c.row(9,12,'php')
    c.row(9,13,'hph')
    c.row(9,14,'pp')
    c.row(8,21,'nrnrrrn')
    c.row(9,22,'rrnnrr')
    if active:sleeve(c,[(10,14),(7,18),(8-step,21)])
    polygon(c,[(10,3),(14,3),(17,5),(17,8),(15,11),(12,12),(9,10),(7,8),(8,5)],'o')
    polygon(c,[(10,4),(14,4),(16,6),(16,8),(14,10),(12,11),(10,9),(8,7),(9,5)],'f')
    c.row(10,3,'uvvvu')
    c.row(9,4,'uvvvuu')
    c.row(9,5,'vuuufuu')
    c.row(9,6,'sffvuu')
    c.row(8,7,'okfvuu')
    c.row(7,8,'offs')
    c.row(9,9,'sfe')
    c.row(10,10,'rs')
    c.row(11,11,'ff')
    c.point(14,6,'w')
    return c


def walk(direction,step=0,active=True):
    if direction=='down':return front(step,False,active)
    if direction=='up':return front(-step,True,active)
    if direction=='left':return side(step,active)
    return mirror(side(-step,active))


def attack(direction,pose):
    c=Canvas(32,40);c.blit(walk(direction,[-1,0,1,0][pose],False),4,8)
    paths={
      'down': [[(21,22),(24,27),(22,29)],[(21,22),(26,20),(25,16)],[(21,22),(25,28),(22,34)],[(21,22),(24,26),(20,28)]],
      'up': [[(10,22),(7,26),(9,23)],[(10,22),(5,20),(7,16)],[(10,22),(7,15),(12,7)],[(10,22),(7,25),(11,21)]],
      'left': [[(14,22),(11,26),(10,24)],[(14,22),(17,20),(18,17)],[(14,22),(8,22),(3,21)],[(14,22),(10,25),(12,22)]]
    }
    points=paths['left' if direction=='right' else direction][pose]
    layer=Canvas(32,40)
    limb(layer,points,'c','p')
    hx,hy=points[-1]
    layer.rect(hx-1,hy-1,3,3,'o')
    layer.row(hx-1,hy-1,'sfs')
    layer.row(hx-1,hy,'fef')
    layer.point(hx,hy+1,'s')
    if direction=='right':layer=mirror(layer)
    c.blit(layer,0,0)
    return c


def svg(c,label):
    lines=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.width}" height="{c.height}" viewBox="0 0 {c.width} {c.height}" shape-rendering="crispEdges">',f'  <title>ASHVEIL original resident trader: {label}</title>', '  <desc>Adult human in worn life clothes with folded collar, waistcoat and waist cloth. Original integer pixels. No fixed money, book, bag, stock, weapon, faction emblem or image inputs.</desc>']
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
    text(c,20,16,'ASHVEIL / RESIDENT TRADER',2)
    text(c,20,40,'WORN LIFE CLOTHES / NO FIXED STOCK OR BAGS')
    for i,label in enumerate(['STEP 0','IDLE 1','STEP 2']):text(c,148+i*164,64,label)
    for row,direction in enumerate(DIRS):
        y=80+row*136;text(c,20,y+54,direction.upper())
        for col in range(3):
            x=132+col*164;c.rect(x,y,144,130,'#151e20' if (row+col)%2==0 else '#303b39')
            c.line(x,y+128,x+143,y+128,'#59645b');c.blit(walking[(direction,col)],x+24,y+4,4)
    text(c,20,640,'READY 0 / DRAW 1 / STRIKE 2 / RESET 3')
    for row,direction in enumerate(DIRS):
        y=664+row*176;text(c,20,y+70,direction.upper())
        for col in range(4):
            x=112+col*152;c.rect(x,y,144,170,'#151e20' if (row+col)%2==0 else '#303b39')
            c.line(x,y+160,x+143,y+160,'#59645b');c.blit(attacking[(direction,col)],x+8,y+4,4)
    for i,color in enumerate(PALETTE.values()):c.rect(20+i*30,1376,22,12,color)
    return c


def products():
    walking={(d,i):walk(d,[-1,0,1][i]) for d in DIRS for i in range(3)}
    attacking={(d,i):attack(d,i) for d in DIRS for i in range(4)}
    ws,ats=Canvas(72,128),Canvas(128,160);frames={};poses=[]
    for d in DIRS:
        for i in range(3):
            art=walking[(d,i)];key=f'resident_trader_w_{d}{i}'
            ws.blit(art,i*24,DIRS.index(d)*32);frames[key]=['resident_trader',i*24,DIRS.index(d)*32,24,32];poses.append((key,art))
        for i in range(4):
            art=attacking[(d,i)];key=f'resident_trader_a_{d}{i}'
            ats.blit(art,i*32,DIRS.index(d)*40);frames[key]=['resident_trader_atk',i*32,DIRS.index(d)*40,32,40];poses.append((key,art))
    char={'walk':{d:[f'resident_trader_w_{d}{i}' for i in range(3)] for d in DIRS},'idle':{d:[f'resident_trader_w_{d}1'] for d in DIRS},'attack':{d:[f'resident_trader_a_{d}{i}' for i in range(4)] for d in DIRS},'anchor':[0.5,31/32],'attackAnchor':[0.5,39/40],'renderScale':1,'headOffset':28}
    fragment={'format':'ashveil-atlas-fragment-v1','status':'prepared-not-installed','character':'resident_trader','sheets':{'resident_trader':'sprites/original/ashveil-trader-walk.png','resident_trader_atk':'sprites/original/ashveil-trader-attack.png'},'frames':frames,'chars':{'resident_trader':char},'layout':{'walkCell':[24,32],'walkSheet':[72,128],'attackCell':[32,40],'attackSheet':[128,160],'rowOrder':DIRS,'walkHeadTopRow':3,'walkLastSoleRow':30,'walkGroundBoundary':31,'attackLastSoleRow':38,'attackGroundBoundary':39,'attackBodyOffset':[4,8],'note':'A new visual role character, not a rename of existing hero. Root controls aliases for exactly the trader inheritance family. No existing char, saved sprite, inventory or game state is altered by this fragment.'}}
    files={
      'ashveil-trader-walk.png':png(ws),'ashveil-trader-walk.svg':svg(ws,'walk and idle'),
      'ashveil-trader-attack.png':png(ats),'ashveil-trader-attack.svg':svg(ats,'unarmed body attack'),
      'ashveil-trader-contact.png':png(contact(walking,attacking)),
      'ashveil-trader-palette.json':json_bytes(PALETTE),
      'trader-manifest.fragment.json':json_bytes(fragment),
      'trader-usage-survey.json':json_bytes(USAGE),
    }
    checks=[];unique=set()
    for key,art in poses:
        raw=b''.join(rgba(p) for row in art.pixels for p in row);digest=hashlib.sha256(raw).hexdigest();unique.add(digest)
        alpha=[rgba(p)[3] for row in art.pixels for p in row];assert sorted(set(alpha))==[0,255]
        occupied=[y for y,row in enumerate(art.pixels) if any(p!='.' for p in row)];top,bottom=min(occupied),max(occupied)
        if '_w_' in key:assert top==3 and bottom==30,(key,top,bottom)
        else:assert bottom==38,(key,bottom)
        checks.append({'key':key,'rgbaSha256':digest,'opaquePixels':alpha.count(255),'topRow':top,'bottomRow':bottom})
    assert len(unique)==28,len(unique)
    files['ashveil-trader-integrity.json']=json_bytes({
      'method':'original manually authored integer-coordinate pixel art','externalImageInputs':[],
      'generator':'draw-trader.py','generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
      'provenance':'SOURCE.md','provenanceSha256':hashlib.sha256((ROOT/'SOURCE.md').read_bytes()).hexdigest(),
      'scope':'New isolated resident_trader visual art for the researched three-member trader definition family. No game imports or registry changes.',
      'frameCount':28,'distinctPoseCount':len(unique),'alphaValues':[0,255],'paletteOnly':True,
      'nativeRendering':{'anchor':[0.5,31/32],'attackAnchor':[0.5,39/40],'renderScale':1,'headOffset':28,'walkHeadTop':3,'walkGroundBoundary':31,'attackBodyOffset':[4,8]},
      'files':[{'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in files.items()],
      'poses':checks
    })
    return files


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true')
    args=parser.parse_args();outputs=products()
    for name,data in outputs.items():
        target=ROOT/name
        if args.check:
            if not target.exists() or target.read_bytes()!=data:raise SystemExit('Byte mismatch: '+name)
        else:target.write_bytes(data)
    print(('CHECK PASS: ' if args.check else 'WROTE: ')+str(len(outputs))+' deterministic original-art files; 28 distinct trader poses')


if __name__=='__main__':main()

