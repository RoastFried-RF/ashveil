#!/usr/bin/env python3
"""Original opaque water bottle and wooden water bucket; appearance only.
Standard library, no image inputs, only outputs beside this script.
Run: python3 draw-water-vessels.py [--check]
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib
ROOT=Path(__file__).resolve().parent
PALETTE={
 'o':'#1c2729','k':'#26332f',
 'd':'#314544','t':'#4b6260','m':'#73827a','l':'#a0a794',
 'b':'#332f2b','r':'#554733','n':'#7b6548','a':'#a1875d',
 'c':'#686b5d','p':'#96947a','h':'#c2bca0',
 'u':'#343b32','v':'#535b48','w':'#7a8068',
 's':'#71604b','f':'#948066'
}
NAMES=['water_bottle','water_bucket']
USAGE=json.loads('{"scope": "Read-only actual definitions and UI source snapshot; no game/world instantiated.", "selectedPhysicalTypes": 2, "noWaterSkinOrCanteenDefFound": true, "selectedFrames": ["water_bottle", "water_bucket"], "actualWaterVesselDefinitions": [{"source": "src/content/core/defs/items-consumables.json", "rawDefinition": {"defType": "Item", "id": "Item.WaterBottle", "label": "물병 (깨끗한 물)", "sprite": "water_bottle", "category": "drink", "weight": 0.6, "value": 8, "uses": 5, "drink": {"water": 200}, "size": [1, 2], "description": " 1,000ml 들이, 한 번에 200ml."}}, {"source": "src/content/core/defs/items-consumables.json", "rawDefinition": {"defType": "Item", "id": "Item.DirtyWaterBottle", "label": "물병 (흐린 물)", "description": "웅덩이에서 떠온 물. 이질에 걸릴 수 있다. 1,000ml 들이, 한 번에 200ml.", "sprite": "water_bottle", "category": "drink", "weight": 0.6, "value": 2, "uses": 5, "drink": {"water": 200, "dirty": true}, "size": [1, 2]}}, {"source": "src/content/core/defs/water-vessels.json", "rawDefinition": {"defType": "Item", "id": "Item.WaterBucket", "label": "나무 물 양동이", "description": "빈 상태로 만드는2L 물 용기. 같은 양동이에 물을 채우고 옮기며 씻거나 마신다.", "sprite": "water_bucket", "category": "drink", "weight": 1, "size": [2, 2], "stackable": false, "maxStack": 1, "value": 12, "material": "Material.Wood", "uses": 0, "drink": {"water": 200}, "waterVessel": {"capacityMl": 2000, "clean": "Item.WaterBucket", "dirty": "Item.WaterBucket"}}}], "sharedSpriteConsumers": [{"id": "Item.CharcoalFilter", "label": "숯·모래 여과통", "sprite": "water_bottle", "source": "src/content/core/defs/water-items.json", "description": "숯과 모래를 넣은 휴대 여과통. 재를 크게 줄인다. 열 번 쓴다."}, {"id": "Item.DirtyWaterBottle", "label": "물병 (흐린 물)", "sprite": "water_bottle", "source": "src/content/core/defs/items-consumables.json", "description": "웅덩이에서 떠온 물. 이질에 걸릴 수 있다. 1,000ml 들이, 한 번에 200ml."}, {"id": "Item.PineTeaBottle", "label": "솔잎차 물병", "sprite": "water_bottle", "source": "src/content/core/defs/pine-tea.json", "description": "원래 물병에 끓인 솔잎차. 300ml당 비타민6, 신선6시간. 끓여도 재와 소금은 남는다."}, {"id": "Item.WaterBottle", "label": "물병 (깨끗한 물)", "sprite": "water_bottle", "source": "src/content/core/defs/items-consumables.json", "description": " 1,000ml 들이, 한 번에 200ml."}, {"id": "Item.WaterBucket", "label": "나무 물 양동이", "sprite": "water_bucket", "source": "src/content/core/defs/water-vessels.json", "description": "빈 상태로 만드는2L 물 용기. 같은 양동이에 물을 채우고 옮기며 씻거나 마신다."}], "actualBucketRecipe": {"defType": "Recipe", "id": "Recipe.WaterBucket", "label": "나무 물 양동이 만들기", "category": "woodwork", "primaryAttr": "str", "basic": true, "workTurns": 200, "inputs": [{"item": "Item.Wood", "count": 4}, {"item": "Item.Cloth", "count": 1}, {"item": "Item.Wax", "count": 1}], "output": {"item": "Item.WaterBucket", "count": 1}, "tools": [], "stations": ["workbench"], "mastery": "survival"}, "physicalGrids": {"water_bottle": [1, 2], "water_bucket": [2, 2]}, "uiSizes": {"bottleInventory": 32, "bucketInventory": 64, "hotbar": 32, "smallPreview": 16}, "notes": ["Clean/dirty bottles share one frame; no graphic quality answer is drawn.", "PineTeaBottle and CharcoalFilter share water_bottle; no additional frame or item is invented to split their display.", "Bucket uses Wood4/Cloth1/Wax1; a wood-and-fibre construction is drawn without invented metal hoops."], "sourceFiles": [{"path": "src/client/ui/Hud.vue", "sha256": "1af5d27ad19aa8a073f7ac327404b83e7dda4a8151cd7de9aac454ec768b9377"}, {"path": "src/client/ui/InventoryWindow.vue", "sha256": "0da9b351376a544ebf1b58580ac643386292918fbe74b914455fe7be5e285f9f"}, {"path": "src/client/ui/ItemIcon.vue", "sha256": "f9abb6a4b7a49708b3aadb8c01f66026b3fc56c4d93aab6046596c0905429982"}, {"path": "src/content/core/defs/items-consumables.json", "sha256": "e18f842b569670fa3f6006b96d9384e0b950c8c586457c9a1c32cc0d096e2195"}, {"path": "src/content/core/defs/pine-tea.json", "sha256": "b89f1f956ba1188426be7988eb3d2e9e2d6a6dc06acc6356c14db7b28e7a5b5d"}, {"path": "src/content/core/defs/water-items.json", "sha256": "9d7dbf01e7da29c75452b1232def01c77b9855bf79f0c8d30ac20dec04ddf188"}, {"path": "src/content/core/defs/water-vessels.json", "sha256": "b716fa101c28bb479c13bf2222162fb5a7831a8225bb66fcc913bfe73fc4b4f2"}, {"path": "src/core/water-vessels.ts", "sha256": "675a97bfcd53d9535b063a52e8edc284bdf930cde1b2b87d07a7ac43d42aa353"}]}')
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


def ellipse(c,x,y,width,height,color):
    # Integer-centred original ellipse raster, no image transform or antialiasing.
    for py in range(height):
        for px in range(width):
            if (2*px+1-width)**2*height**2+(2*py+1-height)**2*width**2<=width**2*height**2:
                c.point(x+px,y+py,color)


def half(c):
    small=Canvas(16,16)
    for y in range(16):
        for x in range(16):small.pixels[y][x]=c.pixels[2*y+1][2*x+1]
    return small


FONT['0']='01110/10001/10011/10101/11001/10001/01110'
FONT['B']='11110/10001/10001/11110/10001/10001/11110'


def outlined(c,points,base,highlight):
    for (x0,y0),(x1,y1) in zip(points,points[1:]):
        for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]:c.line(x0+dx,y0+dy,x1+dx,y1+dy,'o')
        c.line(x0,y0,x1,y1,base)
        c.point(x0-1,y0,highlight)


def bottle():
    c=Canvas(32,32)
    # Opaque weathered surface: the SAME body can show clean, cloudy, tea or
    # empty states without a built-in water level or a secret quality answer.
    polygon(c,[(12,5),(20,5),(21,10),(25,13),(26,23),(24,28),(20,30),(11,30),(7,27),(6,22),(7,14),(11,10)],'o')
    polygon(c,[(13,6),(19,6),(19,11),(23,14),(24,22),(22,27),(19,29),(12,29),(9,26),(8,22),(9,14),(12,11)],'d')
    polygon(c,[(13,7),(18,7),(18,12),(22,15),(22,22),(20,27),(13,28),(10,25),(9,21),(10,15),(13,12)],'t')
    polygon(c,[(12,13),(15,14),(13,18),(13,23),(15,27),(12,25),(11,20),(11,16)],'m')
    c.line(12,15,12,19,'l')
    c.point(13,14,'l')
    c.line(21,17,22,22,'d')
    c.line(19,25,18,27,'d')
    c.point(11,24,'t')
    c.point(19,14,'m')
    c.rect(12,2,8,4,'o')
    c.rect(13,2,6,1,'n')
    c.rect(13,3,6,2,'r')
    c.row(13,3,'ananrn')
    c.row(13,4,'rrnrrr')
    # Worn neck wrapping / stopper collar, not a purity seal or a label.
    c.rect(10,7,12,4,'o')
    c.rect(11,7,10,1,'p')
    c.rect(11,8,10,1,'c')
    c.rect(11,9,10,1,'p')
    c.rect(11,10,10,1,'c')
    c.row(11,8,'cpccpcpcpc')
    c.point(20,10,'h')
    return c


def bucket():
    c=Canvas(32,32)
    # The actual recipe is wood + cloth + wax. A fibre handle and lashings are
    # used instead of invented iron bands/rivets. Handle is part of the vessel.
    outlined(c,[(5,15),(5,9),(8,5),(12,3),(17,3),(22,6),(25,10),(25,16)],'p','h')
    c.point(8,6,'c')
    c.point(17,4,'c')
    c.point(24,11,'c')
    polygon(c,[(5,14),(27,14),(26,23),(25,27),(22,30),(10,30),(7,27),(6,22)],'o')
    polygon(c,[(7,15),(25,15),(24,24),(23,27),(21,29),(11,29),(9,26),(8,22)],'r')
    polygon(c,[(8,16),(12,16),(12,28),(10,27),(9,24)],'n')
    polygon(c,[(14,16),(18,16),(18,29),(14,29)],'s')
    polygon(c,[(20,16),(24,16),(23,24),(22,28),(20,29)],'n')
    c.line(12,18,12,27,'b')
    c.line(18,18,18,28,'b')
    c.line(22,19,22,24,'r')
    c.line(10,18,10,22,'a')
    c.line(15,21,15,25,'f')
    c.point(21,26,'a')
    ellipse(c,5,10,22,9,'o')
    ellipse(c,6,11,20,7,'p')
    ellipse(c,8,12,16,5,'b')
    ellipse(c,9,12,14,4,'k')
    # Dark opening is neutral occlusion, not an EMPTY reading or water surface.
    c.line(8,16,24,16,'r')
    c.line(7,17,25,17,'h')
    c.line(8,18,24,18,'c')
    c.row(8,25,'cpcpcpcpcpcpcpcp')
    c.line(9,26,23,26,'c')
    c.point(9,25,'h')
    c.point(22,25,'h')
    c.line(11,29,21,29,'b')
    return c


def doubled(c):
    result=Canvas(c.width*2,c.height*2)
    result.blit(c,0,0,2)
    return result


def svg(c,label):
    lines=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.width}" height="{c.height}" viewBox="0 0 {c.width} {c.height}" shape-rendering="crispEdges">',f'  <title>ASHVEIL original {label} water vessel</title>', '  <desc>Hand-authored container geometry; no water level, water quality cue, quantity marking, faction sign, backdrop or external image input.</desc>']
    for y,row in enumerate(c.pixels):
        x=0
        while x<c.width:
            end,color=x+1,row[x]
            while end<c.width and row[end]==color:end+=1
            if color!='.':lines.append(f'  <rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{PALETTE[color]}"/>')
            x=end
    return ('\n'.join(lines)+'\n</svg>\n').encode()


def contact(arts,small,large):
    c=Canvas(640,520,'#20292b')
    text(c,20,16,'ASHVEIL / WATER VESSELS',2)
    text(c,20,40,'NO LEVEL / NO CONTENT MARKS')
    for index,name in enumerate(NAMES):
        x=20+index*316;y=72
        text(c,x,y,'CLOSED BOTTLE' if index==0 else 'WOOD BUCKET')
        for shift,bg in [(0,'#10191b'),(144,'#c8c5b3')]:
            c.rect(x+shift,y+18,136,136,bg);c.blit(arts[name],x+shift+4,y+22,4)
        text(c,x,y+164,'NATIVE 32 / 16')
        text(c,x+144,y+164,'16PX / 4X')
        c.rect(x,y+180,136,72,'#303b39');c.blit(arts[name],x+12,y+200);c.blit(small[name],x+80,y+208)
        c.rect(x+144,y+180,64,64,'#10191b');c.blit(small[name],x+144,y+180,4)
        c.rect(x+216,y+180,64,64,'#c8c5b3');c.blit(small[name],x+216,y+180,4)
    c.rect(20,364,596,108,'#303b39')
    text(c,30,376,'BUCKET INVENTORY 64PX')
    c.blit(large,242,388)
    text(c,330,390,'1X2 BOTTLE / 2X2 BUCKET')
    text(c,330,408,'SAME SOURCE / NATIVE SCALE')
    for i,col in enumerate(PALETTE.values()):c.rect(20+i*32,490,24,12,col)
    return c


def products():
    arts={'water_bottle':bottle(),'water_bucket':bucket()}
    small={key:half(image) for key,image in arts.items()};large=doubled(arts['water_bucket'])
    files={};details={}
    for name,image in arts.items():
        files[name+'.png']=png(image);files[name+'.svg']=svg(image,name);files[name+'-16.png']=png(small[name])
        alpha=[rgba(p)[3] for row in image.pixels for p in row]
        assert sorted(set(alpha))==[0,255]
        details[name]={'width':32,'height':32,'alphaValues':[0,255],'opaquePixels':alpha.count(255),'transparentPixels':alpha.count(0),'physicalItemGrid':USAGE['physicalGrids'][name]}
    files['water_bucket-64.png']=png(large)
    files['water-vessels-contact.png']=png(contact(arts,small,large))
    files['water-vessels-palette.json']=json_bytes(PALETTE)
    files['water-vessels-manifest.fragment.json']=json_bytes({'sheets':{'original_'+name:'sprites/original/items/'+name+'.png' for name in NAMES},'frames':{name:['original_'+name,0,0,32,32] for name in NAMES}})
    files['water-vessels-usage-survey.json']=json_bytes(USAGE)
    files['water-vessels-integrity.json']=json_bytes({
      'method':'original manually authored integer-coordinate pixel art','externalImageInputs':[],
      'generator':'draw-water-vessels.py','generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
      'provenance':'SOURCE.md','provenanceSha256':hashlib.sha256((ROOT/'SOURCE.md').read_bytes()).hexdigest(),
      'selectedPhysicalTypes':2,'frames':details,'pngColorType':6,
      'scope':'Actual existing bottle and wood bucket only, isolated and unregistered; no new waterskin/canteen, amount or water-quality rule.',
      'files':[{'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in files.items()]
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
    print(('CHECK PASS: ' if args.check else 'WROTE: ')+str(len(outputs))+' deterministic original-art files; two actual vessel types')


if __name__=='__main__':main()

