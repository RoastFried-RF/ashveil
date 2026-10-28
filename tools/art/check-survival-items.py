#!/usr/bin/env python3
"""Read-only independent PNG/SVG checker; never imports the drawing tool."""
import ast,hashlib,json,pathlib,struct,zlib,xml.etree.ElementTree as E
I=pathlib.Path(__file__).resolve().parents[2]
def h(b):return hashlib.sha256(b).hexdigest()
def j(p):return json.loads(p.read_text())
def m(p,base):
 b=p.read_bytes();return {'path':str(p.relative_to(base)),'bytes':len(b),'sha256':h(b)}
def png(p):
 b=p.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';pos=8;stream=b'';chunks=[];w=height=0
 while pos<len(b):
  assert pos+12<=len(b);n=struct.unpack_from('>I',b,pos)[0];assert pos+n+12<=len(b);typ=b[pos+4:pos+8];body=b[pos+8:pos+8+n];assert zlib.crc32(typ+body)&0xffffffff==struct.unpack_from('>I',b,pos+8+n)[0];chunks.append(typ.decode())
  if typ==b'IHDR':
   w,height,dep,col,comp,fil,inter=struct.unpack('>IIBBBBB',body);assert (dep,col,comp,fil,inter)==(8,6,0,0,0)
  elif typ==b'IDAT':stream+=body
  elif typ==b'IEND':assert n==0 and pos+12==len(b)
  pos+=n+12
 assert chunks==['IHDR','IDAT','IEND'] and pos==len(b);d=zlib.decompressobj();raw=d.decompress(stream)+d.flush();assert d.eof and not d.unused_data and not d.unconsumed_tail;stride=w*4+1;assert len(raw)==stride*height and all(raw[y*stride]==0 for y in range(height));pix=b''.join(raw[y*stride+1:(y+1)*stride] for y in range(height));return w,height,pix,{'file':m(p,I),'dimensions':[w,height],'chunks':chunks,'allCRCsValid':True,'singleTerminalIEND':True,'zlibEOFAndNoTrailingCompressedData':True,'scanlineFilter':0,'colorType':'RGBA8','pixelSha256':h(pix),'alphaValues':sorted(set(pix[3::4]))}
def svg(p,w,ht):
 rt=E.parse(p).getroot();assert rt.tag=='{http://www.w3.org/2000/svg}svg' and [int(rt.get('width')),int(rt.get('height'))]==[w,ht] and rt.get('viewBox')==f'0 0 {w} {ht}';out=bytearray(w*ht*4);seen=set();rects=0
 for n in rt:
  tag=n.tag.rsplit('}',1)[-1];assert tag in ['title','desc','rect']
  if tag!='rect':continue
  assert set(n.attrib)=={'x','y','width','height','fill'};x,y,rw,rh=[int(n.get(k)) for k in ['x','y','width','height']];assert 0<=x<x+rw<=w and 0<=y<y+rh<=ht;v=bytes.fromhex(n.get('fill')[1:])+b'\xff';rects+=1
  for yy in range(y,y+rh):
   for xx in range(x,x+rw):
    assert (xx,yy) not in seen;seen.add((xx,yy));o=(yy*w+xx)*4;out[o:o+4]=v
 return bytes(out),rects

def rgba(v):return bytes.fromhex(v.lstrip("#"))+b"\xff"
def reduce32(pix,size):
 return b"".join(pix[((((2*y+1)*32)//(2*size))*32+((2*x+1)*32)//(2*size))*4:((((2*y+1)*32)//(2*size))*32+((2*x+1)*32)//(2*size))*4+4] for y in range(size) for x in range(size))
palette=j(I/"public/sprites/original/items/ashveil-survival-palette.json")
assert len(palette)==20;valid={rgba(v) for v in palette.values()}
source=j(I/"public/sprites/original/items/ashveil-survival-source.json")
assert source["externalImageInputs"]==[] and source["modelImageInputs"]==[]
assert source["integrationApplied"] is False
assert h((I/source["source"]).read_bytes())==source["sourceSha256"]
assert h((I/source["referenceContract"]).read_bytes())==source["referenceContractSha256"]
for record in source["files"]:
 data=(I/record["file"]).read_bytes()
 assert len(data)==record["bytes"] and h(data)==record["sha256"]
states=["cloth","bandage","torch","campfire_kit","stone"]
assert source["stateOrder"]==states
manifest=j(I/"tools/art/survival-manifest.fragment.json")
assert set(manifest)=={"sheets","frames"} and len(manifest["sheets"])==len(manifest["frames"])==5
native={};small={};entries=[]
for state in states:
 stem="public/sprites/original/items/ashveil-hearth-"+state.replace("_","-")
 path=I/(stem+".png");w,ht,pix,meta=png(path);assert (w,ht)==(32,32)
 assert set(pix[3::4])=={0,255}
 assert all(pix[q:q+3]==b"\0\0\0" for q in range(0,len(pix),4) if pix[q+3]==0)
 opaque=[(n%32,n//32) for n in range(1024) if pix[n*4+3]]
 assert all(0<x<31 and 0<y<31 for x,y in opaque)
 bounds=[min(x for x,y in opaque),min(y for x,y in opaque),max(x for x,y in opaque),max(y for x,y in opaque)]
 assert bounds==source["opaqueBoundsInclusive"][state]
 assert len(opaque)==source["opaquePixels"][state]
 assert all(pix[q:q+4] in valid for q in range(0,len(pix),4) if pix[q+3])
 vector,rectangles=svg(I/(stem+".svg"),32,32);assert vector==pix
 sw,sh,spix,smeta=png(I/(stem+"-16.png"));assert (sw,sh)==(16,16)
 assert spix==reduce32(pix,16)
 key="original_hearth_"+state
 assert manifest["sheets"][key]==stem.removeprefix("public/")+".png"
 assert manifest["frames"][key]==[key,0,0,32,32]
 native[state]=(32,32,pix);small[state]=(16,16,spix)
 entries.append({"state":state,"png":meta,"svg":m(I/(stem+".svg"),I),
                 "svgIntegerRectangles":rectangles,"svgAll1024PixelsEqual":True,
                 "small":smeta,"smallAll256PixelsEqual":True,
                 "boundsInclusive":bounds,"opaquePixels":len(opaque),
                 "smallOpaquePixels":sum(spix[q+3]>0 for q in range(0,len(spix),4)),
                 "paletteOpaqueColorsValid":True,"alphaBinary":True,
                 "transparentOuterEdge":True,"transparentPixelsRGBZero":True})
assert len({h(x[2]) for x in native.values()})==5 and len({h(x[2]) for x in small.values()})==5
# Compose the contact from independently decoded PNGs and fixed documented layout.
W,H=800,352
c=bytearray(rgba("#11191f")*(W*H))
def rect(x,y,w,ht,color):
 row=rgba(color)*w
 for yy in range(y,y+ht):c[(yy*W+x)*4:(yy*W+x+w)*4]=row
def blit(img,x,y,scale=1):
 w,ht,p=img
 for yy in range(ht):
  for xx in range(w):
   v=p[(yy*w+xx)*4:(yy*w+xx+1)*4]
   if not v[3]:continue
   for dy in range(scale):
    at=((y+yy*scale+dy)*W+x+xx*scale)*4;c[at:at+scale*4]=v*scale
for index,state in enumerate(states):
 left=index*160;n=native[state];s=small[state];g=(12,12,reduce32(n[2],12))
 rect(left+8,8,144,336,"#1b272c");blit(n,left+16,16,4)
 for start,bg in [(left+12,"#11191f"),(left+84,"#b8b39f")]:
  rect(start,160,64,96,bg);blit(n,start+16,164)
  blit(s,start+24,206);blit(g,start+26,232)
  rect(start,272,64,64,bg);blit(s,start,272,4)
cw,ch,contact,cmeta=png(I/"public/sprites/original/items/ashveil-survival-contact.png")
assert (cw,ch)==(W,H) and contact==bytes(c)
assert set(contact[3::4])=={255}
result={
 "status":"PASS","scope":"isolated original files only; independent decoder, no drawing-module import, no game/root files read",
 "nativePairs":5,"nativeComparedPixels":5120,"nearest16Pairs":5,
 "contactComparedPixels":W*H,"contactAllPixelsEqual":True,
 "contactNative16And12SamplesOnDarkAndLight":True,
 "sourceRecordedGeneratedFiles":len(source["files"]),"sourceHashesMatch":True,
 "generatorAndReferenceHashesMatch":True,"onlyFiveNewSheetFrameKeys":True,
 "allNativeAnd16SilhouettesDistinct":True,"paletteEntries":20,
 "entries":entries,"contact":cmeta
}
print(json.dumps(result,ensure_ascii=False,indent=2))
