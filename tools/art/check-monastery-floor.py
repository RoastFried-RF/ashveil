#!/usr/bin/env python3
"""Independent standard-library art inspection. Does not import the drawing tool.

Only reads isolated outputs; optional --report writes one isolated verification JSON.
No game execution, browser, GPU, original pack input or external dependency.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import zlib

ROOT=Path(__file__).resolve().parents[2]
ART=ROOT/'public/sprites/original'
NAME='ashveil-monastery-floor'


def decode_png(path):
    data=path.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n'
    offset=8;compressed=b'';chunks=[];size=None
    while offset<len(data):
        n=struct.unpack('>I',data[offset:offset+4])[0];tag=data[offset+4:offset+8]
        payload=data[offset+8:offset+8+n];crc=struct.unpack('>I',data[offset+8+n:offset+12+n])[0]
        assert zlib.crc32(tag+payload)&0xffffffff==crc,(path,tag,'CRC')
        if tag==b'IHDR':
            width,height,bit_depth,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',payload)
            assert (bit_depth,color,compression,filtering,interlace)==(8,6,0,0,0)
            size=(width,height)
        elif tag==b'IDAT':compressed+=payload
        chunks.append(tag.decode());offset+=n+12
    assert size and offset==len(data) and chunks[-1]=='IEND'
    width,height=size;raw=zlib.decompress(compressed);stride=width*4
    assert len(raw)==height*(stride+1)
    rows=[];previous=[0]*stride
    def paeth(a,b,c):
        p=a+b-c;da,db,dc=abs(p-a),abs(p-b),abs(p-c)
        return a if da<=db and da<=dc else b if db<=dc else c
    for y in range(height):
        f=raw[y*(stride+1)];row=list(raw[y*(stride+1)+1:(y+1)*(stride+1)])
        for x,v in enumerate(row):
            left=row[x-4] if x>=4 else 0;up=previous[x];corner=previous[x-4] if x>=4 else 0
            if f==1:row[x]=(v+left)&255
            elif f==2:row[x]=(v+up)&255
            elif f==3:row[x]=(v+(left+up)//2)&255
            elif f==4:row[x]=(v+paeth(left,up,corner))&255
            else:assert f==0
        rows.append(bytes(row));previous=row
    return width,height,b''.join(rows)


def pixel(raw,width,x,y):return raw[(y*width+x)*4:(y*width+x+1)*4]
def rectangle(raw,width,x,y,w,h):return b''.join(raw[((y+dy)*width+x)*4:((y+dy)*width+x+w)*4] for dy in range(h))
def sha(data):return hashlib.sha256(data).hexdigest()


def inspect():
    p=ART/(NAME+'.png');width,height,pixels=decode_png(p);assert (width,height)==(256,256)
    assert set(pixels[3::4])=={255}
    palette=json.loads((ART/(NAME+'-palette.json')).read_text())
    colors={bytes.fromhex(c.removeprefix('#'))+b'\xff' for c in palette.values()}
    assert {pixels[i:i+4] for i in range(0,len(pixels),4)}<=colors
    # Independently rasterize every SVG rect and compare every RGBA byte.
    svg=ET.parse(ART/(NAME+'.svg')).getroot();assert (int(svg.get('width')),int(svg.get('height')))==(256,256)
    result=bytearray(width*height*4);rects=0
    assert {e.tag.split('}')[-1] for e in svg}<={'title','desc','rect'}
    for e in svg.findall('{http://www.w3.org/2000/svg}rect'):
        x,y,w,h=[int(e.get(k,'0')) for k in ['x','y','width','height']]
        assert 0<=x<x+w<=width and 0<=y<y+h<=height
        value=bytes.fromhex(e.get('fill').removeprefix('#'))+b'\xff'
        for yy in range(y,y+h):result[(yy*width+x)*4:(yy*width+x+w)*4]=value*w
        rects+=1
    assert bytes(result)==pixels
    fragment=json.loads((ROOT/'tools/art/monastery-floor-manifest.fragment.json').read_text())
    assert fragment=={'sheets':{'kt_floor':f'sprites/original/{NAME}.png'},'frames':{f'kt_floor_q{q}':['kt_floor',(q&1)*128,(q>>1)*128,128,128] for q in range(4)}}
    blocks=[rectangle(pixels,width,(q&1)*128,(q>>1)*128,128,128) for q in range(4)]
    assert len({sha(v) for v in blocks})==4
    pairChecks=[]
    for a in range(4):
        for b in range(4):
            lr=all(pixel(blocks[a],128,127,n)==pixel(blocks[b],128,0,n) for n in range(128))
            tb=all(pixel(blocks[a],128,n,127)==pixel(blocks[b],128,n,0) for n in range(128))
            assert lr and tb
            pairChecks.append({'from':a,'to':b,'leftRightEdgeMatches':lr,'topBottomEdgeMatches':tb})
    # Reassemble each macro from the exact64 sub rectangles the renderer addresses.
    sampleHashes=[]
    for block in blocks:
        rebuilt=bytearray(128*128*4)
        for y in range(8):
            for x in range(8):
                tile=rectangle(block,128,x*16,y*16,16,16);assert len(tile)==16*16*4
                sampleHashes.append(sha(tile))
                for yy in range(16):rebuilt[((y*16+yy)*128+x*16)*4:((y*16+yy)*128+x*16+16)*4]=tile[yy*64:(yy+1)*64]
        assert bytes(rebuilt)==block
    # Fixed table independently evaluated from the current renderer JS hash.
    expectedQ=[[0,0,1,0,3,0],[1,2,1,3,1,0],[2,1,2,3,0,3],[0,1,2,0,0,3]]
    contract=json.loads((ROOT/'tools/art/monastery-floor-contract.json').read_text())
    assert contract['hashFirst4Rows6Blocks']==expectedQ
    sw,sh,sample=decode_png(ART/(NAME+'-sampler.png'));assert (sw,sh)==(512,320)
    for ty in range(20):
        for tx in range(32):
            q=expectedQ[ty>>3][tx>>3]
            assert rectangle(sample,sw,tx*16,ty*16,16,16)==rectangle(blocks[q],128,(tx&7)*16,(ty&7)*16,16,16)
    cw,ch,contact=decode_png(ART/(NAME+'-contact.png'));assert (cw,ch)==(1056,1060)
    source=json.loads((ART/(NAME+'-source.json')).read_text())
    assert source['generatorSHA256']==sha((ROOT/source['generator']).read_bytes())
    for f in source['files']:
        data=(ROOT/f['path']).read_bytes();assert len(data)==f['bytes'] and sha(data)==f['sha256']
    rgb=[pixels[i:i+3] for i in range(0,len(pixels),4)]
    return {'scope':'Isolated original general monastery flagstone only; no game/build/browser/GPU execution.',
            'result':'PASS','nativeTile':[16,16],'sheet':[width,height],'frameKeys':list(fragment['frames']),
            'macroVariantCount':4,'nativeAddressableSamples':256,'distinctNativeSamplePixels':len(set(sampleHashes)),
            'pngCRCAndRGBAValid':True,'alphaValues':[255],'paletteOnly':True,'paletteColors':len(palette),
            'svgRectangleCount':rects,'svgMatchesEveryRGBAPixel':True,'noSVGExternalImageOrReference':True,
            'allMacroFramesDistinct':True,'allNativeSubRectanglesInBoundsAndReassembleExactly':True,
            'allOrderedMacroPairsMatchBothAxes':pairChecks,'edgePairChecks':32,
            'samplerMatchesCurrentRendererQAnd16pxSubRule':True,'samplerTilesChecked':640,'samplerSize':[sw,sh],
            'contactSize':[cw,ch],'sourceHashesMatch':True,'nativeRGBRange':{'min':min(min(v) for v in rgb),'max':max(max(v) for v in rgb)},
            'unchangedContract':'Only kt_floor sheet URL is proposed. Existing frame keys/rectangles retained. CdFloor20, walls, Def, mapgen, rendering and lighting excluded.',
            'nativeFiles':[{'path':str(p.relative_to(ROOT)),'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in sorted(ART.iterdir()) if p.is_file()],
            'notVerified':['Actual engine display or browser input','Baked asset against all real lighting/preferences','Game integration/Def/memory/save regressions','Visual blending with existing walls and contaminated floors']}


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--report');args=p.parse_args();report=inspect()
    if args.report:
        path=ROOT/args.report;assert path.resolve().is_relative_to(ROOT.resolve());path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print('INDEPENDENT PASS: PNG/SVG,4 frames,256 subcells,32 edge pairs,640 sampler tiles; distinct samples='+str(report['distinctNativeSamplePixels']))
if __name__=='__main__':main()
