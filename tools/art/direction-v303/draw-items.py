#!/usr/bin/env python3
"""ASHVEIL v303: newly drawn item geometry and engraved action icons.

Inputs are registry/semantic JSON only. Reference JPGs are analysis material;
neither those images nor any earlier sprite is read by the drawing functions.
All strokes are on integer coordinates, without antialiasing or image filters.
"""
from __future__ import annotations
import argparse, hashlib, json, struct, zlib
from collections import Counter, defaultdict
from pathlib import Path
from xml.sax.saxutils import escape
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[3]
ART=ROOT/'tools/art/direction-v303'
OUT=ROOT/'public/sprites/original/direction-v303/items'
P={
 'ink':'#19191b','shade':'#29282a','earth':'#49413b','stone':'#68645c',
 'worn':'#969080','cloth':'#a69a7b','skin':'#b3a18b','paper':'#d0c2a0',
 'iron':'#697075','edge':'#b1b1a5','steel':'#8b9090','rust':'#78503c',
 'wood':'#654b37','grain':'#96734d','leather':'#796047','hide':'#a0805c',
 'brass':'#9e8655','brassdark':'#63583e','ivory':'#ddd1b4',
 'moss':'#4d5644','leaf':'#747b56','leaflight':'#9b9d72',
 'blood':'#743d36','flesh':'#a36755','dryred':'#5a3934',
 'glass':'#545c5d','glasslight':'#929995','relic':'#5b7775','amber':'#b18b4f',
 'blue':'#5d737f','yellow':'#b29b5b','magenta':'#8a6178','green':'#78835f',
}

class C:
 def __init__(self):self.im=Image.new('RGBA',(32,32));self.d=ImageDraw.Draw(self.im)
 def col(self,c):return P.get(c,c)
 def poly(self,p,c,o='ink'):self.d.polygon(p,fill=self.col(c),outline=self.col(o) if o else None)
 def rect(self,b,c,o=None):self.d.rectangle(b,fill=self.col(c),outline=self.col(o) if o else None)
 def line(self,p,c,w=1):self.d.line(p,fill=self.col(c),width=w)
 def ell(self,b,c,o='ink'):self.d.ellipse(b,fill=self.col(c),outline=self.col(o) if o else None)
 def dot(self,x,y,c):self.d.point((x,y),fill=self.col(c))

def seam(c,x,y,n=4,h=False):
 for i in range(n):c.line([(x+i*3 if h else x,y if h else y+i*3),(x+i*3+1 if h else x+1,y+1 if h else y+i*3)],'cloth')

def sprig(c,x=16,y=19,kind='leaf'):
 if kind=='pine':
  c.line([(x-7,y+6),(x+6,y-7)],'wood',2)
  for dx,dy in [(-4,3),(-1,0),(2,-3),(5,-6)]:
   c.line([(x+dx,y+dy),(x+dx-5,y+dy-3)],'moss');c.line([(x+dx,y+dy),(x+dx+3,y+dy+4)],'leaf')
 else:
  c.line([(x-4,y+8),(x+2,y-7)],'moss',2)
  c.poly([(x-2,y+1),(x-8,y-1),(x-9,y-5),(x-4,y-5),(x,y-1)],'leaf')
  c.poly([(x,y-2),(x+2,y-8),(x+7,y-10),(x+7,y-5)],'moss')
  c.line([(x-7,y-4),(x-2,y)],'leaflight')

def knife(c,v):
 # Curved, wide working blade with a separate pinned tang and worn handle.
 if v=='bone':pts=[(13,23),(14,16),(22,7),(27,4),(25,13),(20,21),(16,25)];base='ivory'
 elif v=='machete':pts=[(10,21),(19,5),(24,2),(28,4),(25,14),(18,24),(14,25)];base='iron'
 elif v=='greatsword':pts=[(10,24),(21,7),(28,1),(28,8),(17,27),(14,28)];base='steel'
 else:pts=[(12,23),(13,17),(20,8),(27,3),(25,12),(20,20),(16,25)];base='iron' if v in ['rusty','hunting','custom'] else 'steel'
 c.poly(pts,base)
 c.poly([(14,20),(21,10),(26,5),(22,14),(17,22)],'edge',None)
 c.line([(14,22),(20,15),(24,9)],'stone')
 if v=='bone':c.line([(17,20),(18,15),(23,11)],'cloth');c.line([(20,11),(22,13)],'worn')
 if v=='rusty':
  for b in [(19,9,21,12),(15,17,18,19),(22,7,24,9)]:c.rect(b,'rust')
 if v=='machete':c.rect((22,5,24,7),'shade');c.line([(17,20),(21,16)],'rust')
 if v=='custom':c.line([(17,18),(21,13)],'earth',2);c.dot(19,14,'brass')
 c.line([(10,21),(17,27)],'ink',4);c.line([(10,21),(16,26)],'brassdark',2)
 c.poly([(5,27),(10,21),(14,25),(10,30),(7,31)],'wood')
 c.line([(7,27),(10,24)],'hide',2);c.dot(8,28,'brass');c.dot(11,25,'brass')
 if v=='greatsword':c.line([(2,30),(10,22)],'wood',3);c.line([(6,20),(19,29)],'iron',2)

def hatchet(c,v):
 c.poly([(7,29),(9,21),(14,13),(16,6),(20,6),(18,15),(13,23),(11,30)],'wood')
 c.line([(10,27),(12,21),(17,12)],'grain',2)
 if v=='flint':pts=[(13,7),(18,3),(25,5),(29,11),(26,17),(21,19),(17,15),(15,12)];base='stone'
 elif v=='alloy':pts=[(13,7),(20,4),(27,6),(29,12),(25,19),(20,17),(17,12)];base='iron'
 else:pts=[(13,7),(19,4),(27,5),(28,11),(25,18),(20,17),(17,12)];base='steel' if v=='steel' else 'iron'
 c.poly(pts,base)
 c.poly([(25,6),(27,7),(26,12),(24,16),(21,15)],'edge',None)
 if v=='flint':
  c.line([(18,5),(23,8),(20,13),(25,14)],'worn');c.line([(13,9),(19,14)],'cloth',3);c.line([(15,7),(20,11)],'earth')
 else:
  c.poly([(15,8),(20,7),(21,10),(17,12)],'shade');c.dot(18,9,'brassdark')
  if v=='alloy':c.line([(21,7),(23,10),(21,14)],'relic')
  if v=='hatchet':c.rect((23,9,25,11),'rust');c.line([(14,9),(18,13)],'earth',2)
  if v=='custom':c.dot(23,10,'brass');c.line([(11,20),(15,23)],'paper',2);c.line([(10,22),(13,24)],'earth')
 c.line([(7,27),(11,29)],'cloth',2)

def clothing(c,v):
 coat=v in ['coat','custom_coat','wolf_coat'];mail=v in ['mail','custom_mail','iron_mail','steel_mail']
 base='leather' if coat else ('iron' if mail else 'cloth')
 if v=='padded':base='earth'
 if v=='oil_shirt':base='glass'
 if v=='wool_shirt':base='worn'
 b=29 if coat else 26
 c.poly([(10,4),(13,6),(17,5),(20,3),(26,7),(29,16),(25,19),(22,14),(24,b),(16,b-1),(7,b),(9,14),(6,20),(2,17),(5,8)],base)
 c.poly([(18,7),(21,9),(21,20),(23,b-1),(17,b-1),(15,21)],'earth' if not mail else 'shade',None)
 c.line([(5,10),(4,16),(6,17)],'hide' if coat else 'worn')
 c.poly([(10,4),(14,8),(11,12),(8,7)],'hide' if coat else 'earth')
 c.poly([(18,5),(16,9),(18,13),(22,7)],'earth')
 c.line([(14,9),(14,b-1)],'shade')
 if mail:
  for y in range(12,26,3):
   for x in range(9,23,3):
    c.line([(x,y),(x+1,y-1),(x+2,y),(x+1,y+1)],'edge' if v=='steel_mail' else 'steel')
  c.line([(8,25),(22,25)],'earth',2)
  if v=='mail':c.rect((18,15,21,18),'rust');c.rect((6,13,8,16),'rust')
  if v=='iron_mail':c.line([(10,22),(13,23)],'rust');c.line([(19,10),(21,12)],'rust')
  if v=='custom_mail':c.rect((9,19,12,22),'brassdark');seam(c,10,11,4,True)
 elif v=='padded':
  for y in [11,15,19,23]:c.line([(8,y),(21,y+1)],'stone')
  for x in [10,17,21]:c.line([(x,10),(x-1,25)],'shade')
  c.rect((17,19,20,23),'leather','shade')
 elif v=='rag':
  c.poly([(7,25),(10,23),(12,27),(15,24),(18,27),(21,25),(23,27)],'cloth')
  c.rect((9,14,13,19),'earth');seam(c,10,14,2);c.line([(24,14),(26,17)],'ink',2)
 elif v=='custom_shirt':
  c.poly([(8,11),(13,13),(12,21),(8,23)],'worn');c.rect((17,15,21,23),'leather')
  seam(c,12,12,4);seam(c,18,15,3)
 elif v=='wool_shirt':
  for y in [12,16,20,24]:c.line([(9,y),(11,y-1),(13,y),(15,y-1),(18,y),(20,y-1)],'cloth')
  c.line([(3,16),(6,18)],'earth',2)
 elif v=='oil_shirt':
  c.line([(9,11),(9,21),(11,24)],'glasslight');c.rect((17,17,20,21),'shade');c.line([(20,8),(24,11)],'iron')
 elif coat:
  c.line([(8,20),(22,20)],'ink',2);c.rect((13,19,17,22),'brassdark','ink')
  c.line([(10,23),(10,26),(12,26)],'wood');c.line([(18,23),(21,23),(21,26)],'wood')
  if v=='wolf_coat':
   c.poly([(7,8),(9,3),(12,6),(14,4),(17,7),(20,3),(24,7),(22,13),(19,10),(17,13),(14,9),(11,12)],'worn')
   c.line([(9,27),(12,26),(16,28),(20,27)],'hide')
  if v=='custom_coat':c.rect((8,14,12,18),'cloth');seam(c,9,14,2);seam(c,19,24,2)
 else:
  for y in [12,16,20,24]:c.dot(15,y,'brassdark')

def book(c,v):
 paper=v in ['note','map','ledger','chimney']
 if paper:
  pts=[(6,5),(22,3),(27,7),(26,24),(20,28),(5,29),(7,18),(4,13)]
  if v=='chimney':pts=[(5,4),(24,5),(21,9),(25,12),(22,16),(25,20),(21,24),(22,28),(5,27)]
  c.poly(pts,'cloth');c.poly([(7,7),(21,5),(24,8),(23,24),(7,26)],'paper',None)
  c.poly([(22,3),(27,7),(22,9)],'worn')
  if v=='map':
   c.line([(12,6),(11,25)],'cloth');c.line([(20,6),(20,24)],'cloth')
   c.line([(8,21),(13,17),(18,19),(22,12)],'rust',2)
   for x,y in [(9,11),(16,12),(23,21)]:c.rect((x,y,x+2,y+2),'earth')
  elif v=='ledger':
   c.line([(11,9),(11,24)],'blood');c.line([(19,8),(19,23)],'wood')
   for y in [11,15,19,23]:c.line([(8,y),(23,y-2)],'earth')
  elif v=='chimney':
   c.rect((9,12,13,23),'stone');c.line([(11,12),(11,8),(17,8)],'iron',2);c.line([(16,15),(20,15)],'wood')
  else:
   for y,n in [(10,13),(14,10),(18,14),(22,8)]:c.line([(9,y),(9+n,y-1)],'earth')
  return
 base={'medical':'moss','firstaid':'dryred','ward':'earth','survival':'leather','alphabet':'cloth','dictionary':'shade','pharma':'glass','pill':'wood','bestiary':'leather','material':'stone','craft':'wood','seed':'moss','signal':'shade','salt':'glass','boat':'wood','journal':'dryred'}.get(v,'wood')
 c.poly([(4,7),(20,3),(27,7),(27,25),(11,30),(5,26)],base)
 c.poly([(5,8),(9,10),(10,27),(6,26)],'shade')
 c.poly([(10,26),(25,22),(26,25),(11,29)],'cloth')
 c.line([(12,27),(24,24)],'paper');c.line([(11,10),(22,7)],'worn')
 c.rect((13,11,24,23),'earth')
 if v=='seed':
  c.line([(18,22),(18,15)],'cloth');c.poly([(18,18),(13,15),(14,13),(18,15)],'leaf');c.poly([(18,16),(20,12),(23,12),(22,16)],'leaflight')
 elif v in ['medical','survival']:
  if v=='medical':c.poly([(13,18),(23,17),(21,23),(16,24)],'cloth');c.line([(15,18),(14,13)],'grain',2)
  else:c.line([(13,22),(23,12)],'grain',2);c.line([(13,14),(23,22)],'cloth',2)
  c.line([(21,17),(21,12)],'leaflight')
 elif v=='firstaid':c.rect((17,12,20,23),'paper');c.rect((13,16,24,19),'paper')
 elif v=='ward':c.line([(13,14),(13,24),(13,21),(24,19),(24,23)],'cloth',2);c.ell((14,14,18,18),'skin');c.line([(19,17),(23,17)],'paper',3)
 elif v=='alphabet':c.line([(13,22),(17,12),(22,20)],'paper',2);c.line([(15,18),(20,17)],'paper')
 elif v=='dictionary':
  c.line([(13,13),(16,12),(16,22),(13,23)],'cloth',2);c.line([(21,11),(24,10),(24,20),(21,21)],'worn')
 elif v in ['pharma','pill']:
  c.ell((13,14,21,20),'ivory');c.line([(17,14),(18,20)],'stone')
  if v=='pill':c.ell((20,20,24,24),'cloth')
  else:c.line([(15,23),(23,22)],'worn')
 elif v=='bestiary':
  c.poly([(13,13),(14,10),(18,13),(23,11),(25,16),(21,21),(16,20)],'cloth');c.dot(21,16,'ink')
 elif v=='material':c.poly([(13,14),(17,11),(22,14),(18,18)],'steel');c.line([(14,23),(23,17)],'grain',3);seam(c,14,20,3,True)
 elif v=='craft':c.line([(14,23),(22,12)],'grain',2);c.poly([(18,12),(21,10),(25,12),(22,16)],'iron')
 elif v=='signal':c.line([(13,21),(22,13),(22,10)],'brass');c.line([(17,17),(17,12),(20,11)],'worn');c.ell((21,19,24,22),'iron')
 elif v=='salt':c.poly([(13,21),(17,13),(23,21)],'paper');c.line([(13,24),(21,23)],'glasslight')
 elif v=='boat':c.poly([(12,18),(24,15),(22,22),(17,24)],'cloth');c.line([(15,17),(16,13),(22,14)],'grain')
 elif v=='journal':c.rect((13,13,24,20),'cloth');c.line([(15,15),(22,15)],'earth');c.line([(15,18),(20,18)],'wood');c.line([(19,4),(19,11)],'hide',2)

def tool(c,v):
 if v in ['pole','spear','javelin']:
  c.line([(3,29),(26,3)],'ink',4);c.line([(3,28),(25,4)],'wood' if v!='spear' else 'iron',2)
  c.line([(8,23),(21,8)],'grain' if v!='spear' else 'steel')
  if v!='pole':c.poly([(20,9),(24,2),(29,1),(27,7),(23,12)],'steel');c.line([(25,4),(22,9)],'edge');c.line([(18,10),(22,13)],'cloth',2)
  else:c.line([(23,5),(26,7)],'shade',2)
 elif v in ['crossbow','bow']:
  c.line([(4,9),(8,4),(16,5),(24,12),(28,20)],'ink',4);c.line([(4,9),(8,5),(15,6),(23,13),(28,20)],'wood',2)
  c.line([(4,9),(15,20),(28,20)],'cloth')
  if v=='crossbow':c.poly([(7,29),(5,26),(19,11),(23,9),(23,14),(13,25),(13,29)],'wood');c.line([(8,26),(21,12)],'steel');c.rect((12,22,15,25),'iron')
  else:c.line([(7,25),(24,8)],'grain',2);c.poly([(22,8),(27,3),(25,10)],'iron');c.line([(7,23),(9,27)],'cloth')
 elif v in ['stone_hammer','iron_hammer']:
  c.poly([(6,29),(6,25),(17,9),(21,10),(15,22),(11,30)],'wood');c.line([(8,27),(17,13)],'grain')
  c.poly([(10,10),(14,4),(24,4),(29,9),(25,16),(18,16)],'stone' if v=='stone_hammer' else 'iron')
  c.poly([(14,6),(23,6),(26,9),(22,11),(13,9)],'worn' if v=='stone_hammer' else 'steel',None)
  if v=='stone_hammer':c.line([(16,8),(20,15)],'cloth',3);c.line([(15,10),(21,12)],'earth')
  else:c.line([(26,10),(24,14)],'edge',2);c.rect((13,9,16,11),'shade')
 elif v=='tongs':
  c.line([(4,28),(16,15),(18,8),(16,3)],'ink',5);c.line([(4,28),(16,15),(18,8),(16,3)],'iron',2)
  c.line([(12,29),(14,16),(22,12),(27,5)],'ink',5);c.line([(12,29),(14,16),(22,12),(27,5)],'steel',2)
  c.ell((13,13,18,18),'iron');c.dot(15,15,'brass')
 elif v=='needle':
  c.line([(5,28),(23,6)],'ink',3);c.line([(5,28),(23,6)],'steel');c.ell((21,3,25,9),'edge');c.line([(23,5),(23,7)],'ink')
  c.line([(22,4),(16,3),(9,8),(12,13),(22,14),(27,19),(25,25),(19,26)],'cloth')
 elif v in ['club','alloy_club']:
  c.poly([(4,28),(6,23),(19,6),(23,3),(28,7),(24,14),(12,28),(8,31)],'iron')
  c.poly([(10,23),(21,8),(24,7),(23,11),(12,25)],'steel',None)
  c.ell((22,3,28,9),'shade','iron');c.ell((24,5,26,7),'ink',None)
  if v=='alloy_club':c.poly([(16,12),(20,10),(24,15),(20,19)],'brassdark');c.line([(18,12),(22,16)],'relic')
  else:c.rect((17,14,20,17),'rust')
  c.line([(5,26),(9,30)],'leather',4);c.line([(7,24),(11,28)],'cloth',2)
 elif v in ['arrow','bolt']:
  for dx,dy in [(0,0),(7,-1)]:
   length=19 if v=='arrow' else 13;sx=4+dx;sy=27+dy;ex=sx+length;ey=sy-length
   c.line([(sx,sy),(ex,ey)],'ink',4 if v=='bolt' else 3);c.line([(sx,sy),(ex,ey)],'grain',2)
   c.poly([(ex-2,ey),(ex+3,ey-5),(ex+4,ey+1),(ex+1,ey+3)],'iron');c.line([(ex+2,ey-2),(ex+2,ey+1)],'edge')
   c.poly([(sx-2,sy-3),(sx+1,sy),(sx+4,sy),(sx+2,sy+3),(sx-1,sy+2)],'worn')
 elif v=='lockpick':
  c.line([(5,27),(20,7),(23,7),(25,10)],'ink',4);c.line([(5,27),(20,7),(23,7),(25,10)],'steel',2)
  c.line([(13,29),(26,15),(25,12)],'ink',4);c.line([(13,29),(26,15),(25,12)],'iron',2)
  c.line([(3,25),(7,29)],'wood',3);c.line([(11,27),(15,30)],'wood',3)
 elif v=='torch':
  c.poly([(7,29),(16,11),(20,13),(12,30)],'wood');c.line([(10,27),(17,15)],'grain')
  c.poly([(13,13),(13,7),(17,3),(21,4),(24,8),(23,15),(19,20)],'shade')
  c.line([(14,8),(22,10)],'earth',3);c.line([(14,12),(22,15)],'worn',2);c.line([(16,6),(18,4)],'stone')
 else:raise ValueError(v)

def bedding(c,v):
 if v=='mat':
  c.poly([(3,12),(21,5),(29,21),(10,29)],'wood')
  for x in [5,9,13,17,21]:c.line([(x,12),(x+7,25)],'leaf',2)
  for y in [12,16,20,24]:c.line([(6,y),(24,y-5)],'cloth')
  c.line([(7,10),(26,21)],'grain',2)
 elif v=='bedroll':
  c.poly([(8,8),(21,5),(27,23),(24,29),(10,29),(5,14)],'earth')
  c.poly([(8,12),(20,9),(24,23),(12,27)],'cloth')
  c.ell((5,4,23,14),'worn');c.ell((9,7,21,12),'earth');c.ell((13,8,19,10),'cloth',None)
  c.line([(8,19),(23,16)],'leather',3);c.rect((15,17,18,19),'brassdark','ink')
  c.line([(13,24),(22,22)],'paper')
 else:
  for x,y in [(4,11),(11,24),(25,17)]:c.line([(x,y),(x,y+7)],'wood',4)
  c.poly([(3,12),(20,5),(29,18),(11,28)],'wood')
  c.poly([(5,12),(20,7),(26,18),(11,24)],'cloth' if v!='straw' else 'grain')
  if v=='straw':
   for x,y in [(7,12),(11,14),(15,10),(18,15),(12,20),(22,18)]:c.line([(x,y),(x+4,y+2)],'cloth');c.line([(x,y+1),(x+3,y-2)],'hide')
  else:
   c.poly([(6,12),(16,8),(20,13),(9,18)],'paper');c.poly([(10,18),(23,13),(26,18),(12,24)],'worn' if v=='good' else 'earth')
   c.line([(13,22),(24,18)],'cloth')
  if v=='good':c.line([(3,12),(3,6),(19,1),(23,6)],'wood',3);c.line([(5,7),(19,3)],'grain',2)

def kit(c,v):
 if v=='bench':
  c.poly([(3,12),(20,6),(29,12),(11,19)],'wood');c.line([(5,12),(20,9),(25,12)],'grain')
  c.line([(8,19),(9,29)],'wood',4);c.line([(25,16),(23,27)],'wood',4);c.line([(10,25),(22,22)],'grain',2)
  c.line([(10,10),(22,15)],'cloth',2)
 elif v=='forge':
  c.poly([(3,17),(10,9),(23,9),(29,18),(25,28),(7,28)],'stone')
  c.poly([(7,17),(12,13),(22,14),(25,18),(21,22),(9,22)],'shade');c.line([(8,24),(24,24)],'iron',2)
  c.rect((23,3,27,13),'iron','ink');c.line([(24,4),(24,10)],'steel')
 elif v=='loom':
  c.line([(5,7),(7,29),(25,26),(25,3),(5,7)],'wood',4);c.line([(7,7),(23,5)],'grain')
  for x in [10,13,16,19,22]:c.line([(x,9),(x+1,25)],'cloth')
  for y in [17,20,23]:c.line([(9,y),(23,y-2)],'earth',2)
  c.line([(4,15),(28,12)],'grain',3)
 elif v=='vat':
  c.poly([(5,12),(28,11),(25,27),(9,29)],'wood');c.ell((4,5,28,15),'grain');c.ell((7,7,25,12),'shade')
  for x in [10,16,22]:c.line([(x,16),(x,26)],'grain')
  c.line([(8,21),(26,20)],'iron',2);c.line([(11,9),(19,11)],'hide',2)
 elif v=='artisan':
  c.poly([(3,14),(21,8),(29,13),(10,21)],'wood');c.line([(8,20),(8,29)],'wood',4);c.line([(26,17),(24,28)],'wood',4)
  c.rect((8,8,16,14),'iron','ink');c.rect((11,5,18,9),'steel','ink');c.line([(19,15),(26,6)],'brass',2)
  c.ell((23,3,28,7),'iron');c.line([(12,25),(22,21)],'grain')

def glove(c,v):
 for dx,dy in [(0,2),(14,-1)]:
  c.poly([(3+dx,25+dy),(3+dx,18+dy),(1+dx,15+dy),(2+dx,12+dy),(5+dx,15+dy),(5+dx,8+dy),(7+dx,7+dy),(8+dx,11+dy),(8+dx,6+dy),(10+dx,7+dy),(11+dx,15+dy),(13+dx,18+dy),(12+dx,25+dy)],'worn' if v=='wool' else 'leather')
  c.rect((3+dx,23+dy,12+dx,27+dy),'earth','ink');c.line([(6+dx,12+dy),(6+dx,18+dy)],'cloth' if v=='wool' else 'hide')
  if v=='wool':c.line([(5+dx,20+dy),(7+dx,19+dy),(9+dx,21+dy),(11+dx,20+dy)],'cloth')
  else:seam(c,9+dx,18+dy,2)

def bottle(c,v):
 if v=='serum':
  c.poly([(13,2),(21,3),(19,9),(16,9)],'brassdark');c.poly([(12,8),(20,9),(18,23),(10,22)],'iron')
  c.poly([(13,11),(17,12),(16,20),(12,19)],'paper');c.line([(12,24),(10,30)],'steel');c.line([(11,22),(18,23)],'brass',2);return
 if v=='oil':
  c.poly([(7,12),(21,9),(27,13),(26,28),(9,30),(5,26)],'brassdark');c.rect((10,6,18,12),'brass','ink')
  c.line([(18,8),(25,4),(28,7)],'iron',3);c.line([(9,16),(9,25)],'brass');c.ell((13,17,21,25),'wood');return
 if v=='ampoule':
  c.poly([(14,2),(19,3),(18,9),(21,12),(20,28),(12,29),(10,24),(12,12),(15,9)],'glass')
  c.line([(14,13),(13,24),(15,26)],'glasslight',2);c.rect((13,17,19,23),'cloth');c.line([(14,6),(18,7)],'brass');return
 if v=='fluid':
  c.poly([(6,11),(20,7),(27,11),(27,27),(10,30),(5,25)],'iron');c.poly([(17,9),(21,9),(24,12),(19,13)],'shade')
  c.rect((9,4,17,10),'iron','ink');c.line([(8,15),(8,24)],'steel');c.rect((13,17,24,25),'cloth','shade');c.poly([(17,19),(15,23),(20,23)],'earth');return
 base='wood' if v in ['poppy','draught'] else 'glass'
 c.poly([(12,3),(19,2),(20,9),(24,13),(26,26),(22,30),(8,29),(6,25),(8,13),(12,9)],base)
 c.poly([(12,2),(19,2),(20,6),(12,7)],'wood','ink')
 c.line([(10,13),(9,23),(11,26)],'glasslight',2)
 if v=='dirty_water':
  c.poly([(11,16),(16,18),(22,16),(24,25),(20,28),(11,27)],'stone')
  c.poly([(10,24),(14,23),(18,25),(23,24),(22,27),(11,27)],'earth')
  for x,y in [(12,20),(19,19),(18,23),(14,26),(22,25)]:c.dot(x,y,'wood')
 elif v=='water':
  c.poly([(11,17),(22,16),(24,25),(21,28),(11,27)],'glasslight');c.line([(12,18),(20,18)],'worn')
 elif v=='pine_tea':
  c.poly([(11,16),(21,15),(24,25),(21,28),(11,27)],'amber');c.rect((10,18,23,25),'cloth','earth');c.line([(12,23),(21,19)],'wood')
  for x,y in [(14,22),(17,21),(19,20)]:c.line([(x,y),(x-1,y-3)],'moss');c.line([(x,y),(x+2,y+1)],'moss')
 else:
  c.poly([(11,16),(21,14),(23,24),(13,26)],'cloth','earth')
  if v in ['willow','draught']:c.line([(14,23),(19,17)],'wood',2);c.line([(17,20),(20,21)],'moss')
  elif v=='poppy':c.ell((15,17,21,22),'dryred');c.dot(18,19,'ink');c.line([(17,21),(17,24)],'wood')
  else:c.line([(13,20),(20,19)],'earth',2)

def meat(c,v):
 if v in ['jerky','dried','salted']:
  for x,y in [(4,9),(12,5),(21,8)]:
   c.poly([(x,y),(x+6,y-1),(x+5,y+15),(x+2,y+20),(x-1,y+16)],'wood' if v=='jerky' else 'dryred')
   c.line([(x+2,y+3),(x+1,y+10),(x+3,y+16)],'hide' if v=='jerky' else 'flesh')
   if v=='salted':
    for xx,yy in [(x+2,y+4),(x+4,y+10),(x+1,y+15)]:c.rect((xx,yy,xx+1,yy+1),'paper')
  if v=='jerky':c.line([(3,16),(25,12)],'cloth',2)
  return
 raw=v in ['raw','rat_raw'];rat=v.startswith('rat_')
 pts=[(4,16),(6,10),(14,5),(23,7),(29,15),(26,24),(17,29),(7,26)] if not rat else [(3,20),(7,12),(13,8),(22,10),(26,15),(27,24),(19,28),(8,27)]
 c.poly(pts,'blood' if raw else 'wood')
 c.poly([(7,15),(12,9),(20,9),(25,15),(21,20),(14,19),(10,24),(6,22)],'flesh' if raw else 'hide',None)
 c.line([(8,25),(15,26),(20,22),(25,23)],'cloth' if raw else 'earth',2)
 if rat:c.line([(7,24),(4,28),(10,30)],'ivory',2)
 if v=='smoked':
  for x,y in [(10,12),(16,10),(22,14)]:c.line([(x,y),(x-2,y+7)],'shade',2)
  c.line([(10,5),(9,2)],'stone');c.line([(18,4),(20,1)],'stone')
 if v=='roast':
  for x,y in [(9,12),(15,10),(21,13)]:c.line([(x,y),(x+5,y+6)],'earth',2)

def vegetable(c,v):
 if v=='cabbage':
  c.poly([(4,17),(7,9),(14,5),(22,6),(29,14),(27,24),(20,28),(10,27),(4,23)],'moss')
  c.ell((7,7,25,25),'leaf','moss');c.line([(10,10),(8,18),(13,24),(21,23),(25,17)],'leaflight',2)
  c.line([(14,10),(19,9),(23,14),(19,20),(14,18),(13,14)],'moss')
 elif v in ['raw_potato','baked_potato','potato_seed','shade_root']:
  base='stone' if v=='shade_root' else ('wood' if v=='baked_potato' else 'hide')
  c.poly([(3,20),(6,12),(14,7),(24,8),(29,17),(25,25),(17,29),(7,27)],base)
  c.poly([(7,15),(13,10),(22,11),(25,16),(17,16),(12,22),(6,22)],'worn' if v=='shade_root' else 'cloth',None)
  for x,y in [(10,16),(20,20),(15,25)]:c.dot(x,y,'earth')
  if v=='baked_potato':c.poly([(12,15),(17,12),(23,16),(20,22),(13,22)],'paper');c.line([(15,15),(18,18),(16,20)],'earth')
  if v in ['potato_seed','shade_root']:
   c.line([(19,10),(21,4),(26,3)],'moss',2);c.poly([(21,6),(17,2),(18,0),(22,2)],'leaf' if v=='potato_seed' else 'shade')
 elif v=='turnip':
  sprig(c,16,13);c.poly([(7,18),(11,13),(21,13),(26,18),(23,24),(18,29),(17,26),(12,25)],'paper');c.line([(9,17),(15,15),(21,16)],'worn',2);c.line([(12,22),(18,24)],'cloth')
 elif v in ['cabbage_seed','turnip_seed','shade_seeds','oat_seed']:
  c.poly([(6,6),(23,3),(27,24),(24,29),(8,30),(4,24)],'cloth')
  c.poly([(7,8),(22,6),(24,10),(8,13)],'worn');c.line([(6,10),(25,8)],'wood',2)
  if v=='cabbage_seed':c.ell((10,15,22,25),'moss');c.line([(12,17),(15,22),(20,18)],'leaf')
  elif v=='turnip_seed':c.poly([(12,20),(15,16),(22,19),(19,24),(16,26)],'paper');c.line([(16,18),(16,13)],'moss',2)
  elif v=='oat_seed':c.line([(12,24),(21,15)],'grain',2);c.ell((11,18,16,21),'paper');c.ell((16,13,21,17),'cloth')
  else:c.ell((11,17,17,23),'shade');c.ell((18,16,23,21),'earth');c.line([(8,6),(23,4)],'brass',2)
 elif v=='berry':
  c.line([(10,17),(18,5),(25,4)],'wood');c.poly([(16,8),(11,4),(15,2),(20,5)],'moss')
  for x,y in [(4,17),(13,20),(21,12),(11,11)]:c.ell((x,y,x+7,y+7),'dryred');c.ell((x+1,y+1,x+4,y+3),'flesh',None)
 elif v=='cheese':
  c.poly([(3,17),(21,6),(28,10),(28,25),(8,30),(3,26)],'amber');c.poly([(3,17),(21,6),(28,10),(10,21)],'paper')
  c.line([(9,28),(25,24)],'cloth');
  for x,y in [(12,21),(23,17),(22,23)]:c.ell((x,y,x+3,y+3),'brassdark',None)
 elif v=='apple':
  for x,y in [(4,12),(15,7),(12,20)]:
   c.poly([(x,y),(x+6,y-3),(x+12,y+3),(x+10,y+8),(x+3,y+9),(x-1,y+5)],'rust');c.poly([(x+2,y+1),(x+6,y-1),(x+9,y+3),(x+7,y+6),(x+3,y+6)],'cloth');c.dot(x+6,y+3,'earth')
 elif v in ['mushroom','whitecap']:
  c.poly([(14,17),(20,16),(20,26),(23,29),(15,30),(12,27)],'cloth')
  c.poly([(2,18),(6,10),(12,5),(22,6),(28,13),(29,19),(23,22),(8,21)],'paper' if v=='whitecap' else 'stone')
  c.poly([(6,16),(11,9),(18,8),(25,13),(26,16)],'ivory' if v=='whitecap' else 'worn',None)
  c.line([(5,19),(11,18),(22,20),(27,18)],'earth')
 elif v=='oats':
  for pts in [[(5,26),(14,7)],[(13,29),(22,8)],[(19,28),(28,11)]]:c.line(pts,'grain',2)
  for x,y in [(9,15),(13,8),(17,17),(21,10),(24,18),(26,12)]:
   c.poly([(x-3,y),(x,y-3),(x+2,y),(x,y+4)],'cloth');c.line([(x,y),(x+1,y-2)],'paper')
 else:raise ValueError(v)

def jar(c,v):
 c.poly([(10,7),(20,5),(23,10),(24,14),(28,19),(26,27),(20,30),(10,29),(5,24),(5,17),(9,11)],'rust')
 c.poly([(9,15),(12,12),(11,25),(9,26),(7,22)],'hide',None);c.line([(12,28),(23,26)],'wood',2)
 if v=='filled':c.ell((8,3,23,10),'cloth');c.line([(8,8),(24,8)],'wood',2);c.poly([(13,17),(22,15),(23,23),(14,25)],'paper');c.ell((16,18,21,22),'moss')
 else:c.ell((9,3,22,10),'hide');c.ell((11,5,20,8),'earth')

def tin(c,v):
 c.poly([(5,11),(22,6),(28,10),(27,26),(10,30),(5,26)],'iron');c.line([(7,14),(7,24)],'steel');c.line([(26,14),(26,24)],'rust')
 c.poly([(8,16),(23,12),(24,23),(10,27)],'cloth');c.line([(12,19),(20,17)],'wood',2)
 if v=='sealed':c.ell((5,4,28,14),'steel');c.ell((9,6,24,11),'iron','edge');c.line([(13,8),(21,7)],'worn')
 else:
  c.ell((5,5,28,16),'shade','steel');c.ell((8,8,25,13),'blood' if v=='opened' else 'earth',None)
  if v=='opened':c.poly([(8,6),(7,1),(18,0),(26,6),(21,9)],'iron');c.line([(9,3),(17,2),(24,6)],'steel');c.line([(11,10),(19,12)],'flesh',2)
  else:c.poly([(22,9),(28,4),(31,9),(28,15)],'iron');c.line([(10,11),(20,11)],'stone')

def ration(c,v):
 pts=[(3,9),(20,4),(26,7),(29,24),(24,28),(7,30),(4,24)]
 if v=='empty':pts=[(3,11),(9,5),(15,9),(23,5),(29,20),(24,26),(16,23),(7,30),(8,20)]
 c.poly(pts,'earth' if v=='empty' else 'stone');c.line([(6,10),(21,6),(25,9)],'cloth');c.line([(8,27),(25,23)],'shade')
 if v=='sealed':c.poly([(8,14),(21,10),(24,20),(11,25)],'paper');c.line([(11,17),(19,15)],'earth',2);c.line([(13,21),(20,19)],'worn')
 elif v=='opened':c.poly([(5,9),(10,11),(13,7),(17,10),(22,7),(26,11)],'ink');c.poly([(9,13),(22,10),(24,15),(12,18)],'grain');c.poly([(11,19),(23,16),(24,22),(13,25)],'cloth')
 else:c.line([(8,12),(14,16),(11,24)],'shade',2);c.line([(19,10),(21,17),(26,20)],'worn');c.rect((15,15,18,20),'cloth')

def prosthetic(c,v):
 if v=='peg':
  c.poly([(10,4),(20,3),(24,8),(21,13),(17,30),(13,30),(11,14),(8,9)],'wood');c.ell((9,1,22,9),'hide');c.ell((12,3,19,6),'earth');c.line([(14,15),(15,26)],'grain',2);c.line([(11,12),(21,12)],'iron',2)
 elif v=='joint_leg':
  c.ell((10,1,22,8),'leather');c.ell((13,3,20,6),'shade');c.poly([(11,8),(21,8),(20,14),(18,18),(18,25),(26,27),(25,30),(11,30),(10,26),(13,18),(9,13)],'iron')
  c.ell((11,12,21,21),'earth','iron');c.ell((14,15,18,18),'brass');c.line([(16,22),(15,27)],'steel',2)
 elif v=='hook':
  c.poly([(8,23),(10,16),(20,16),(23,26),(21,30),(8,29)],'leather');c.line([(14,17),(12,11),(14,5),(19,2),(25,4),(28,9),(26,13),(22,13)],'ink',5);c.line([(14,17),(12,11),(14,5),(19,2),(25,4),(27,9),(25,12)],'iron',3);c.line([(15,5),(20,4),(24,6)],'edge');c.rect((10,17,20,22),'iron','shade');c.line([(10,26),(20,26)],'hide')
 elif v=='arm':
  c.ell((6,1,19,11),'iron');c.ell((10,4,16,9),'earth','brassdark');c.poly([(10,10),(20,9),(24,19),(21,25),(12,25),(7,18)],'earth');c.line([(12,12),(14,20)],'steel',3);c.ell((13,20,23,28),'iron')
  c.poly([(15,26),(15,30),(18,31),(22,29),(26,29),(28,24),(25,22),(23,25)],'steel');c.line([(19,26),(20,29)],'shade');c.line([(23,25),(24,28)],'shade');c.line([(18,12),(21,19)],'brass')
 elif v=='gardener':
  c.poly([(11,30),(10,24),(14,16),(12,9),(7,4),(9,1),(14,5),(18,12),(22,7),(25,1),(28,3),(27,10),(21,17),(20,23),(24,28),(21,30),(17,26),(14,31)],'paper');c.line([(14,25),(17,17),(16,10),(11,4)],'ivory',2);c.line([(21,14),(25,7)],'worn');c.line([(13,22),(17,23),(20,20)],'relic')

def miscellaneous(c,v):
 if v in ['hood','cloak','raincoat','mask']:
  if v=='mask':
   c.line([(7,13),(2,8),(3,4),(9,8)],'earth',2);c.line([(24,13),(29,7),(27,3),(21,8)],'earth',2)
   c.poly([(5,11),(15,7),(26,10),(25,20),(18,26),(8,23)],'cloth');c.line([(8,13),(16,15),(23,12)],'paper');c.line([(8,17),(16,20),(23,17)],'earth');return
  c.poly([(4,27),(7,13),(12,4),(19,2),(24,9),(25,18),(29,28),(21,30),(16,27),(10,30)],'earth' if v=='hood' else 'glass')
  c.poly([(9,14),(11,8),(17,5),(22,10),(21,17),(15,21)],'cloth' if v=='hood' else 'stone')
  c.poly([(12,12),(16,8),(20,11),(19,19),(14,21)],'ink');c.line([(9,20),(6,27)],'worn');c.line([(21,20),(25,27)],'shade');c.line([(14,22),(19,23)],'leather',2)
  if v=='raincoat':c.poly([(8,17),(3,20),(1,26),(6,28),(11,22)],'glass');c.poly([(23,17),(28,19),(31,25),(27,28),(21,23)],'glass');c.line([(17,25),(17,29)],'shade')
 elif v=='apron':
  c.line([(11,9),(9,4),(17,2),(21,8)],'wood',2);c.poly([(10,9),(21,7),(22,13),(26,16),(27,28),(7,30),(5,20),(8,15)],'leather');c.line([(10,12),(10,21)],'hide');c.poly([(12,19),(21,17),(23,24),(13,27)],'wood');seam(c,13,21,3,True);c.line([(6,18),(2,17)],'wood',2)
 elif v=='lute':
  c.ell((3,13,23,30),'wood');c.poly([(5,19),(10,12),(19,13),(22,20),(17,26),(8,27)],'grain');c.line([(15,18),(25,4)],'shade',6);c.line([(15,18),(25,4)],'wood',4);c.ell((10,17,17,24),'earth');c.line([(8,25),(14,27)],'shade',2)
  for dx in [0,2]:c.line([(10+dx,24),(24+dx,5)],'cloth')
  c.poly([(23,3),(27,1),(30,5),(27,9)],'wood');c.dot(28,5,'brass')
 elif v=='hardtack':
  c.poly([(4,12),(11,6),(22,5),(29,12),(27,24),(19,29),(7,27),(3,21)],'grain');c.poly([(6,13),(12,9),(21,8),(25,13),(24,22),(18,25),(9,24),(6,20)],'cloth')
  for x,y in [(11,13),(18,12),(22,16),(10,20),(17,19),(21,23)]:c.rect((x,y,x+1,y+1),'earth')
 elif v=='key':
  c.ell((2,2,17,16),'brassdark');c.ell((6,5,13,12),(0,0,0,0),None);c.line([(13,12),(27,28)],'ink',5);c.line([(13,12),(27,28)],'brass',3);c.poly([(20,18),(25,14),(29,18),(26,21),(29,24),(25,28)],'brassdark');c.line([(6,4),(11,3)],'cloth')
 elif v in ['hide','wolf_hide','leather']:
  c.poly([(6,3),(13,7),(19,5),(26,2),(25,12),(29,18),(24,22),(27,29),(19,26),(15,30),(10,26),(3,29),(7,20),(2,15),(8,11)],'worn' if v=='wolf_hide' else ('leather' if v=='leather' else 'hide'))
  c.poly([(11,10),(19,8),(23,16),(20,23),(13,25),(9,19)],'stone' if v=='wolf_hide' else ('wood' if v=='leather' else 'flesh'),None)
  c.line([(10,14),(11,20),(17,23)],'cloth' if v=='wolf_hide' else 'grain')
  if v=='wolf_hide':c.line([(16,11),(18,14),(17,18)],'cloth')
  if v=='leather':seam(c,9,9,3);c.line([(21,20),(24,23)],'hide')
 elif v in ['steel_ingot','iron_ingot']:
  c.poly([(3,20),(10,9),(23,4),(29,12),(26,23),(9,29)],'iron');c.poly([(5,18),(11,10),(23,6),(26,12),(12,22)],'steel' if v=='steel_ingot' else 'stone');c.poly([(13,22),(27,13),(25,21),(10,27)],'earth')
  c.line([(9,17),(21,10)],'edge');
  if v=='iron_ingot':c.rect((16,13,19,15),'rust');c.line([(20,20),(23,18)],'rust')
 elif v in ['linen','cloth']:
  c.poly([(4,12),(20,5),(29,10),(26,24),(12,30),(5,25)],'worn');c.poly([(6,12),(20,8),(26,11),(12,18)],'paper');c.poly([(12,18),(26,11),(23,23),(12,27)],'cloth');c.line([(7,16),(10,21),(9,25)],'earth')
  if v=='cloth':c.poly([(5,24),(9,23),(11,28),(15,27),(14,31),(9,29)],'cloth');c.line([(20,15),(20,20)],'earth',2)
  else:c.line([(14,20),(23,17)],'paper');c.line([(14,23),(22,20)],'worn')
 elif v=='wool':
  for b in [(4,10,17,24),(10,4,23,19),(16,12,29,27),(5,18,19,30),(10,12,23,27)]:c.ell(b,'cloth')
  for p in [[(8,15),(11,13),(14,15)],[(15,9),(19,8),(22,11)],[(11,23),(15,21),(18,23)],[(21,18),(24,21),(21,24)]]:c.line(p,'worn')
 elif v=='wax':
  c.poly([(5,13),(10,6),(23,5),(28,12),(25,26),(11,30),(6,25)],'brass');c.ell((6,4,26,15),'cloth');c.ell((11,8,21,12),'brassdark',None);c.line([(9,16),(10,24)],'paper',2);c.line([(22,14),(23,20),(26,21)],'grain')
 elif v in ['sharpen','stone']:
  c.poly([(2,21),(9,11),(23,5),(29,14),(25,24),(10,30)],'stone');c.poly([(4,20),(10,12),(23,7),(27,13),(21,22),(9,26)],'worn');c.line([(9,19),(22,12)],'cloth')
  if v=='stone':c.line([(14,10),(13,17),(18,21)],'earth');c.poly([(20,24),(27,21),(30,25),(26,29)],'stone')
 elif v=='charm':
  c.line([(8,12),(7,6),(12,2),(21,3),(26,9),(22,18)],'wood',2);c.poly([(10,17),(16,11),(23,17),(22,24),(16,30),(11,26)],'paper');c.ell((13,16,19,21),'earth');c.line([(13,25),(19,25)],'worn')
 elif v=='ring':
  c.ell((4,11,27,31),'brassdark');c.ell((9,16,22,26),(0,0,0,0),None);c.poly([(6,11),(11,4),(19,2),(26,9),(24,17),(15,21),(8,18)],'rust');c.poly([(9,11),(13,6),(19,5),(23,10),(20,15),(13,17)],'brass');c.line([(13,9),(19,8),(19,12),(16,13)],'earth')
 elif v=='tourniquet':
  c.ell((3,8,28,27),'leather');c.ell((8,12,23,22),(0,0,0,0),None);c.line([(7,23),(25,8)],'shade',5);c.line([(7,23),(25,8)],'wood',3);c.rect((18,8,25,15),'iron','ink');c.rect((20,10,23,13),'shade');c.line([(6,24),(13,29)],'cloth',3)
 elif v=='splint':
  for dx in [0,7]:c.poly([(4+dx,27),(14+dx,4),(19+dx,5),(9+dx,30)],'wood');c.line([(7+dx,26),(16+dx,7)],'grain')
  c.line([(7,22),(20,28)],'cloth',3);c.line([(12,10),(26,15)],'cloth',3);c.line([(9,21),(19,25)],'worn')
 elif v=='painkiller':
  c.poly([(4,10),(21,4),(28,22),(12,30)],'iron');
  for x,y in [(10,13),(19,10),(14,23),(23,20)]:c.ell((x-3,y-3,x+3,y+4),'steel');c.ell((x-2,y-2,x+2,y+3),'ivory');c.line([(x-1,y),(x+1,y+1)],'worn')
 elif v=='lantern':
  c.line([(11,8),(10,4),(16,1),(22,4),(22,8)],'iron',2);c.poly([(7,11),(11,6),(22,6),(27,11)],'iron');c.poly([(8,12),(25,12),(24,26),(9,27)],'earth');c.poly([(12,13),(21,13),(21,24),(12,25)],'amber');c.line([(13,14),(13,22)],'cloth');c.line([(9,11),(9,27)],'iron',2);c.line([(24,11),(24,26)],'iron',2);c.poly([(7,27),(25,26),(28,30),(5,31)],'iron')
 elif v=='bones':
  c.line([(5,27),(24,8)],'earth',6);c.line([(5,27),(24,8)],'paper',3);c.line([(8,8),(27,25)],'earth',6);c.line([(8,8),(27,25)],'cloth',3);c.ell((7,11,21,26),'cloth');c.ell((9,15,13,19),'shade');c.ell((16,14,20,18),'shade');c.line([(12,24),(18,24)],'earth')
 elif v in ['ash_leaf','pine']:sprig(c,17,19,'pine' if v=='pine' else 'leaf')
 elif v=='moss':
  c.poly([(3,16),(18,7),(27,13),(28,24),(19,29),(7,29)],'cloth');
  for p in [[(6,19),(8,12),(13,10),(17,14),(15,22),(9,24)],[(15,17),(19,11),(24,13),(26,19),(22,25),(17,24)],[(9,24),(14,21),(20,25),(17,28),(10,28)]]:c.poly(p,'moss')
  for x,y in [(10,15),(20,17),(14,25)]:c.line([(x,y),(x+2,y-1)],'leaf')
 elif v=='buckler':
  c.poly([(7,6),(17,3),(27,8),(29,18),(24,27),(14,30),(5,25),(2,16)],'iron');c.poly([(8,9),(17,6),(24,10),(26,18),(21,25),(13,27),(7,22),(5,15)],'earth');c.line([(8,11),(24,24)],'steel',2);c.ell((10,11,23,24),'iron');c.ell((13,14,20,21),'steel');c.line([(7,25),(12,27)],'rust')
 elif v in ['machine_patch','plate']:
  c.poly([(4,9),(21,3),(28,9),(27,25),(10,30),(4,25)],'iron');c.line([(7,10),(21,6),(25,10)],'steel')
  if v=='plate':
   c.poly([(10,13),(23,9),(24,20),(11,24)],'shade')
   for y,n in [(14,7),(17,10),(20,5)]:c.line([(13,y),(13+n,y-2)],'worn')
   for x in [12,16,20,24]:c.line([(x,25),(x,28)],'brass',2)
  else:c.poly([(10,14),(20,10),(24,21),(13,26)],'earth');c.line([(11,18),(16,16),(20,20),(22,18)],'ink',2);c.line([(14,14),(17,23)],'brassdark',2);c.line([(19,12),(22,21)],'brass')
 elif v=='actuator':
  c.line([(5,28),(22,8)],'shade',7);c.line([(5,28),(22,8)],'steel',3);c.poly([(9,24),(8,18),(17,7),(23,8),(27,14),(17,27)],'iron');c.line([(12,21),(21,11)],'edge',2);c.ell((20,2,28,10),'brassdark');c.ell((23,4,26,7),'shade');c.ell((2,25,10,31),'iron')
 elif v in ['low_cell','cell']:
  c.poly([(4,12),(21,5),(28,9),(27,26),(12,31),(5,27)],'iron');c.poly([(7,12),(21,8),(25,11),(13,16)],'steel');c.line([(13,17),(13,27)],'brassdark',2);c.rect((13,5,17,8),'brass','ink');c.rect((22,4,25,7),'brass','ink')
  if v=='cell':c.poly([(16,17),(24,14),(24,23),(16,26)],'relic');c.line([(18,19),(22,17)],'glasslight');c.rect((7,20,10,25),'shade')
  else:c.poly([(18,18),(23,16),(20,21),(23,21),(17,27)],'brassdark')
 elif v=='nozzle':
  c.poly([(3,26),(10,18),(16,21),(10,30)],'wood');c.poly([(10,21),(15,10),(24,3),(29,7),(23,16),(18,25)],'iron');c.line([(16,15),(24,7)],'steel',3);c.poly([(23,3),(28,2),(31,6),(27,11)],'brass');c.ell((26,3,29,6),'shade');c.line([(5,25),(9,28)],'cloth')
 elif v=='ink':
  c.poly([(5,20),(9,12),(21,9),(27,16),(26,27),(13,31),(6,27)],'shade');c.ell((8,8,23,17),'iron');c.ell((12,11,20,14),'ink');c.line([(15,13),(25,2)],'grain',2);c.poly([(22,5),(26,0),(28,3),(25,8)],'paper');c.line([(8,20),(9,25)],'glasslight')
 elif v in ['fragment','alloy_scrap','iron_scrap']:
  pts=[(3,19),(8,7),(17,4),(24,8),(22,14),(29,17),(25,27),(13,30),(7,26)]
  c.poly(pts,'iron');c.poly([(8,12),(16,7),(22,10),(17,18),(6,22)],'steel');c.line([(19,16),(24,13),(24,22)],'shade',2)
  if v=='alloy_scrap':c.ell((18,10,23,15),'shade','brassdark');c.line([(11,22),(20,25)],'relic')
  elif v=='iron_scrap':c.poly([(8,18),(15,14),(20,18),(15,22)],'rust');c.rect((10,10,13,12),'rust')
  else:c.poly([(6,23),(13,20),(16,27),(10,28)],'stone')
 elif v=='missing':
  c.poly([(4,13),(21,7),(28,11),(27,26),(10,31),(4,26)],'cloth');c.line([(7,14),(21,10),(25,13)],'paper');c.poly([(11,17),(20,14),(23,23),(14,27)],'earth');c.line([(14,19),(20,23)],'worn',2);c.line([(19,17),(15,25)],'worn',2)
 elif v in ['rope','strap','bow_string','thread']:
  base='leather' if v in ['strap','rope'] else 'cloth';start=3 if v!='thread' else 8
  for b in [(start,4,28,29),(start+4,8,24,25),(start+8,12,20,21)]:
   if b[0]>=b[2]:continue
   c.ell(b,base);c.ell((b[0]+2,b[1]+2,b[2]-2,b[3]-2),(0,0,0,0),None)
  c.line([(24,23),(29,26),(24,30),(19,29)],'earth',4);c.line([(24,23),(29,26),(24,30),(19,29)],base,2)
  if v=='strap':c.rect((18,23,27,29),'brassdark','ink');c.rect((21,25,25,27),'shade')
  elif v=='thread':c.poly([(5,10),(17,7),(21,24),(10,29)],'wood');c.line([(6,11),(17,9)],'cloth',3);c.line([(8,16),(19,13)],'cloth',3);c.line([(9,22),(20,19)],'cloth',3)
  elif v=='rope':
   for x,y in [(7,9),(18,6),(25,13),(22,24),(9,26)]:c.line([(x,y),(x+2,y+2)],'cloth')
 elif v=='glass':
  c.poly([(3,26),(10,4),(19,9),(29,22),(20,29),(13,21)],'glass');c.poly([(11,6),(16,13),(6,23)],'glasslight',None);c.poly([(18,13),(26,21),(20,26),(15,20)],'worn',None);c.line([(10,5),(14,16),(20,27)],'edge')
 elif v=='filter':
  c.poly([(3,13),(15,7),(28,10),(25,23),(17,29),(7,26)],'cloth');c.poly([(8,15),(16,11),(24,13),(21,22),(16,26),(11,23)],'worn');
  for x in [11,15,19,23]:c.line([(x,15),(x-1,21)],'paper')
  c.line([(5,12),(2,6),(6,3),(10,9)],'earth');c.line([(26,12),(30,6),(26,3),(22,9)],'earth')
 elif v in ['sand','salt','charcoal']:
  if v=='charcoal':
   for p in [[(3,23),(9,12),(17,15),(17,27),(8,30)],[(14,16),(17,5),(26,6),(29,18),(24,25)],[(18,26),(24,20),(30,24),(27,30)]]:c.poly(p,'shade');c.line([p[0],p[1]],'stone')
  else:
   c.poly([(2,27),(10,19),(15,10),(20,12),(27,22),(30,28)],'cloth' if v=='salt' else 'grain');c.poly([(6,25),(15,13),(19,15),(22,22),(16,20),(11,26)],'paper' if v=='salt' else 'worn',None)
   for x,y in [(10,23),(15,17),(19,21),(23,26),(6,28),(16,26)]:c.dot(x,y,'ivory' if v=='salt' else 'cloth')
 elif v=='coracle':
  c.poly([(2,16),(9,6),(21,4),(29,12),(28,23),(21,29),(10,28),(4,23)],'wood');c.poly([(5,16),(11,9),(20,7),(26,13),(25,22),(19,26),(11,25),(7,21)],'leather');c.line([(8,13),(23,24)],'grain',2);c.line([(23,10),(9,23)],'grain',2);c.line([(4,18),(27,17)],'cloth',3);c.rect((13,16,18,20),'brassdark','ink');seam(c,7,14,3)
 elif v=='culture':
  c.poly([(3,19),(10,10),(26,11),(30,22),(23,29),(6,28)],'wood');c.ell((2,17,13,28),'grain');c.ell((5,19,10,25),'earth');c.poly([(12,13),(21,13),(25,26),(15,28)],'cloth');c.line([(13,16),(22,16)],'paper')
  for x,y in [(10,8),(19,6),(23,15)]:c.rect((x+2,y+4,x+3,y+9),'cloth');c.ell((x,y,x+7,y+5),'paper')
 elif v=='medical_bag':
  c.line([(10,10),(10,5),(19,3),(23,8)],'wood',3);c.poly([(4,12),(21,7),(28,11),(29,24),(24,29),(8,31),(3,26)],'leather');c.poly([(5,13),(22,10),(26,13),(25,18),(9,21)],'hide');c.rect((12,19,24,27),'cloth','earth');c.rect((17,20,19,26),'blood');c.rect((14,22,22,24),'blood');c.line([(6,22),(7,27)],'hide')
 elif v=='helmet':
  c.poly([(3,24),(5,12),(11,5),(20,3),(27,10),(29,22),(26,28),(20,26),(10,27),(6,30)],'iron');c.poly([(7,12),(13,7),(18,6),(15,14),(15,23),(6,23)],'steel',None);c.line([(20,5),(23,12),(23,25)],'rust',2);c.line([(7,24),(22,22)],'shade',2);c.dot(6,18,'brassdark');c.dot(27,17,'brassdark')
 elif v=='boots':
  for dx,dy in [(0,2),(14,-1)]:
   c.poly([(4+dx,7+dy),(12+dx,6+dy),(12+dx,19+dy),(16+dx,23+dy),(15+dx,27+dy),(2+dx,28+dy),(1+dx,24+dy),(5+dx,19+dy)],'wood');c.line([(5+dx,9+dy),(10+dx,9+dy)],'hide',2);c.line([(4+dx,26+dy),(14+dx,25+dy)],'shade',2);c.line([(7+dx,13+dy),(10+dx,13+dy),(7+dx,16+dy),(10+dx,17+dy)],'cloth')
 else:raise ValueError(v)

def water_tool(c,v):
 if v in ['dirty_water','pine_tea']:bottle(c,v)
 elif v=='charcoal_filter':
  c.poly([(5,6),(25,3),(28,8),(24,14),(24,27),(10,30),(7,26),(8,15)],'iron');c.ell((5,1,28,11),'steel');c.ell((8,3,25,8),'shade');c.poly([(10,14),(22,12),(23,20),(11,22)],'shade');c.line([(12,16),(16,14),(20,17)],'earth');c.poly([(11,23),(23,21),(23,26),(12,28)],'cloth');
  for x,y in [(13,24),(17,26),(21,23)]:c.dot(x,y,'paper')
  c.line([(9,15),(9,26)],'steel');c.line([(24,13),(24,26)],'steel');c.rect((13,28,20,31),'iron','shade')
 elif v=='water_pill':
  c.poly([(4,8),(19,3),(26,7),(25,24),(9,30),(4,25)],'iron');c.poly([(8,11),(20,7),(23,11),(22,22),(10,26)],'paper');c.poly([(15,11),(11,18),(14,22),(18,21),(21,16)],'glass');c.line([(14,17),(14,19)],'glasslight');c.ell((17,20,30,30),'cloth');c.ell((18,18,30,28),'ivory');c.line([(21,21),(27,24)],'worn')
 else:raise ValueError(v)

def domestic(c,v):
 if v=='chest':
  c.poly([(3,13),(19,6),(29,12),(28,25),(11,31),(3,26)],'wood');c.poly([(3,13),(6,7),(20,2),(29,8),(29,12),(11,20)],'grain');c.line([(7,9),(21,5)],'hide');c.line([(6,16),(6,25)],'earth');c.line([(12,21),(27,15)],'earth');c.line([(12,25),(27,20)],'earth');c.line([(10,18),(10,29)],'iron',3);c.line([(25,10),(25,26)],'iron',2);c.rect((13,18,17,23),'brassdark','shade')
 elif v in ['egg','cracked_egg']:
  if v=='egg':c.poly([(9,29),(5,23),(6,16),(11,6),(16,2),(21,4),(27,15),(27,23),(22,29),(15,31)],'cloth');c.poly([(9,16),(13,7),(17,5),(21,10),(23,19),(18,24),(11,25),(8,21)],'paper',None);c.line([(8,25),(14,28),(21,27)],'worn')
  else:c.ell((3,20,30,30),'worn');c.ell((10,21,24,29),'amber');c.poly([(5,19),(6,10),(11,5),(16,8),(18,15),(15,20),(12,15),(9,19)],'paper');c.poly([(20,19),(22,10),(27,12),(29,18),(26,23),(24,19)],'cloth')
 elif v in ['bowl','oatmeal','raw_oatmeal']:
  c.ell((2,10,29,24),'wood');c.poly([(3,17),(28,15),(25,27),(19,31),(10,30),(5,26)],'wood');c.ell((3,8,29,21),'grain');c.ell((6,10,26,18),'earth' if v=='bowl' else 'cloth')
  if v!='bowl':
   for x,y in [(10,13),(16,12),(21,14),(13,16),(22,16)]:c.ell((x,y,x+2,y+1),'paper' if v=='oatmeal' else 'grain',None)
   if v=='raw_oatmeal':c.line([(9,11),(23,12)],'glasslight')
  c.line([(7,24),(12,27),(21,26)],'grain')
 elif v=='bucket':
  c.line([(7,13),(7,6),(12,2),(22,4),(26,10)],'wood',2);c.poly([(3,13),(26,9),(29,15),(25,28),(12,31),(6,27)],'wood');c.ell((3,8,29,20),'grain');c.ell((7,11,25,17),'earth');
  for x,y in [(8,20),(15,20),(23,18)]:c.line([(x,y),(x+1,27)],'grain')
  c.line([(6,24),(26,21)],'cloth',2);c.line([(9,29),(24,26)],'earth')
 elif v=='campfire_kit':
  for p in [[(3,23),(8,18),(13,20),(12,27),(6,29)],[(21,20),(27,18),(30,23),(27,29),(22,28)],[(10,27),(17,23),(23,27),(20,31),(13,31)]]:c.poly(p,'stone');c.line([p[0],p[1]],'worn')
  c.line([(6,20),(22,7)],'wood',5);c.line([(11,8),(24,22)],'wood',5);c.line([(7,20),(22,8)],'grain',2);c.line([(12,9),(24,22)],'grain',2);c.line([(9,14),(19,22)],'cloth',3)
 elif v=='wood':
  for x,y in [(3,20),(10,11),(17,16)]:
   c.poly([(x,y),(x+8,y-7),(x+13,y-4),(x+11,y+2),(x+4,y+9),(x,y+7)],'wood');c.line([(x+2,y+4),(x+10,y-4)],'grain',2);c.ell((x,y+2,x+5,y+8),'hide');c.dot(x+2,y+5,'wood')
 elif v=='bandage':
  c.poly([(7,13),(22,8),(29,19),(24,28),(12,30),(5,23)],'cloth');c.ell((5,4,25,18),'paper');c.ell((9,7,22,14),'worn');c.ell((13,9,20,12),'earth');c.poly([(10,22),(22,18),(25,24),(17,29),(9,31)],'paper');c.line([(13,24),(23,21)],'worn')
 elif v=='eye':
  c.ell((4,8,29,29),'worn');c.ell((4,5,28,26),'ivory');c.ell((10,8,23,23),'stone');c.ell((13,10,21,21),'earth');c.ell((15,12,19,19),'ink');c.rect((12,9,14,11),'ivory');c.line([(6,19),(9,22)],'cloth')
 elif v in ['sack','quiver','belt']:
  if v=='sack':
   c.poly([(9,6),(20,5),(22,10),(28,18),(27,27),(20,31),(8,30),(3,25),(4,17),(9,11)],'cloth');c.line([(7,16),(7,25),(11,28)],'paper');c.line([(21,15),(24,23),(21,28)],'earth');c.line([(8,10),(23,9)],'wood',2);c.line([(11,6),(10,2),(16,4),(22,1),(20,6)],'worn')
  elif v=='quiver':
   c.poly([(8,10),(19,6),(26,23),(22,29),(16,31),(6,15)],'leather');c.line([(9,12),(20,9)],'hide',2);c.line([(11,17),(18,28)],'wood');c.line([(21,15),(28,10),(30,16),(25,25)],'wood');
   for x,y in [(9,4),(14,2),(18,4)]:c.line([(x,y),(x+6,y+14)],'grain',2);c.poly([(x-1,y),(x-2,y-3),(x+2,y-2),(x+3,y+2)],'cloth')
  else:
   c.ell((2,7,29,28),'leather');c.ell((7,11,25,23),(0,0,0,0),None);c.line([(6,23),(19,29),(27,25)],'wood',5);c.rect((17,21,27,29),'brassdark','ink');c.rect((20,23,24,27),'earth');c.poly([(3,14),(8,14),(9,23),(4,25)],'wood');c.dot(10,9,'ink');c.dot(14,8,'ink')
 else:raise ValueError(v)

def firearm(c,v):
 if v=='revolver':
  c.poly([(2,13),(7,8),(17,7),(19,5),(29,6),(30,10),(21,13),(19,18),(13,21),(10,29),(5,29),(4,26),(8,19)],'iron');c.poly([(6,11),(15,10),(18,13),(15,18),(9,18)],'steel');c.ell((9,10,18,19),'iron','shade');c.dot(13,14,'edge');c.line([(21,7),(28,7)],'edge');c.poly([(8,20),(12,20),(9,28),(6,27)],'wood');c.line([(15,21),(19,19),(20,15)],'shade',2)
 elif v in ['musket','rifle']:
  c.poly([(1,29),(3,23),(10,22),(17,14),(21,14),(17,21),(9,28),(4,31)],'wood');c.line([(9,23),(27,4)],'shade',5);c.line([(10,22),(28,3)],'iron',3);c.line([(13,18),(27,3)],'steel');c.line([(4,27),(8,25)],'grain',2)
  if v=='musket':c.poly([(14,16),(17,11),(20,12),(21,15),(17,19)],'brassdark');c.line([(16,13),(14,9),(18,8)],'iron',2);c.line([(12,24),(29,5)],'wood')
  else:c.line([(18,14),(22,16),(24,14)],'steel',2);c.ell((22,14,25,17),'iron');c.line([(13,23),(16,24),(19,21)],'shade',2)
 elif v in ['factory_round','reclaimed_round','empty_case']:
  c.poly([(7,27),(19,12),(24,15),(13,30)],'brassdark');c.line([(10,26),(21,14)],'brass',3);c.line([(7,27),(12,31)],'iron',2)
  if v!='empty_case':c.poly([(19,12),(25,5),(28,4),(27,10),(24,15)],'iron' if v=='reclaimed_round' else 'wood');c.line([(23,10),(26,6)],'edge')
  else:c.ell((18,10,25,16),'brass');c.ell((20,12,23,14),'shade');c.line([(9,24),(13,27)],'rust')
  if v=='reclaimed_round':c.line([(14,20),(18,23)],'rust',2);c.line([(16,17),(20,20)],'earth')
 elif v=='lead_ball':
  for b in [(4,14,19,29),(16,5,28,17)]:c.ell(b,'iron');c.ell((b[0]+2,b[1]+1,b[0]+7,b[1]+5),'steel',None);c.line([(b[0]+4,b[3]-2),(b[2]-3,b[3]-2)],'earth')
 elif v=='powder':
  c.poly([(8,6),(18,3),(25,9),(25,25),(17,31),(7,27),(4,17)],'paper');c.poly([(8,7),(13,12),(21,9),(18,4)],'cloth');c.line([(8,16),(21,13)],'wood',2);c.poly([(10,20),(17,16),(23,20),(18,27),(11,27)],'shade');c.dot(13,22,'stone');c.dot(19,24,'stone')
 elif v=='primer':
  for x,y in [(4,15),(14,5),(19,20)]:c.ell((x,y,x+10,y+7),'brassdark');c.rect((x,y+3,x+10,y+7),'brassdark');c.ell((x,y-1,x+10,y+5),'brass');c.ell((x+3,y+1,x+7,y+3),'earth',None)
 elif v=='gun_oil':
  c.poly([(6,15),(17,10),(25,13),(28,26),(24,29),(10,31),(5,27)],'brassdark');c.rect((10,6,18,13),'iron','ink');c.line([(16,8),(24,3),(29,5)],'iron',3);c.line([(9,18),(10,25)],'brass');c.poly([(14,20),(19,17),(23,22),(19,26)],'earth')
 else:raise ValueError(v)

def pill(c,v):
 # Six visible tablet/capsule colours only; no effect, ailment or hazard symbols.
 colors={'yellow':'yellow','blue':'blue','white':'ivory','black':'shade','green':'green','magenta':'magenta'}
 col=colors[v]
 if v in ['yellow','blue','magenta']:
  c.poly([(5,24),(5,17),(17,5),(23,4),(28,9),(27,16),(15,28),(9,29)],'worn');c.poly([(7,17),(17,7),(22,6),(26,10),(25,15),(15,25),(10,27),(7,24)],col);c.line([(12,13),(21,21)],'earth');c.line([(8,18),(17,9)],'paper' if v=='yellow' else 'worn')
  if v=='blue':c.line([(19,8),(23,10)],'steel')
  if v=='magenta':c.dot(11,23,'cloth')
 else:
  c.ell((4,10,29,29),'earth');c.ell((3,6,28,26),col,'ink');c.line([(7,11),(12,8),(19,8)],'stone' if v=='black' else 'paper');c.line([(10,21),(23,11)],'earth' if v!='black' else 'stone',2)
  if v=='green':c.ell((19,17,22,20),'moss',None)

# Fresh engraving grammar. There are no reused v302 canvases, transforms or
# round skill badges. A dry irregular iron plate supports light cut strokes.
def plate(c):
 c.poly([(2,5),(7,2),(27,3),(30,8),(29,27),(25,30),(5,29),(1,24)],'shade','earth')
 c.line([(5,5),(24,5)],'stone');c.line([(4,8),(4,22)],'earth');c.line([(8,28),(25,28)],'earth')

def figure(c,x,y,pose='stand',color='cloth'):
 c.ell((x-2,y-8,x+3,y-3),color,None)
 if pose=='fall':
  c.line([(x,y-2),(x-6,y+3),(x-9,y+1)],color,3);c.line([(x-5,y+3),(x-1,y+7)],color,2)
 elif pose=='crouch':
  c.line([(x,y-2),(x-3,y+3),(x+2,y+5),(x+5,y+8)],color,3);c.line([(x-3,y+3),(x-7,y+8)],color,2)
 else:
  c.line([(x,y-2),(x,y+5)],color,3);c.line([(x,y+4),(x-3,y+10)],color,2);c.line([(x,y+4),(x+4,y+10)],color,2)

def arrow(c,a,b,color='worn'):
 c.line([a,b],color,2);dx=b[0]-a[0];dy=b[1]-a[1]
 if abs(dx)>abs(dy):s=1 if dx>0 else -1;c.poly([(b[0],b[1]),(b[0]-4*s,b[1]-3),(b[0]-4*s,b[1]+3)],color,None)
 else:s=1 if dy>0 else -1;c.poly([(b[0],b[1]),(b[0]-3,b[1]-4*s),(b[0]+3,b[1]-4*s)],color,None)

def action(c,v):
 plate(c)
 if v in ['blade_deep_cut','blade_edge','blade_vital','blade_parry']:
  if v=='blade_parry':
   c.line([(7,23),(24,8)],'steel',3);c.line([(8,8),(24,24)],'iron',3);c.line([(14,11),(16,14),(20,13)],'paper');c.line([(5,16),(5,10),(10,6)],'worn')
  else:
   c.poly([(5,22),(16,9),(25,6),(21,15),(10,25)],'steel');c.line([(8,22),(23,8)],'edge');c.line([(4,23),(8,27)],'wood',3)
   if v=='blade_edge':c.line([(20,3),(20,7)],'paper');c.line([(24,5),(28,5)],'paper');c.line([(18,6),(16,4)],'paper')
   elif v=='blade_deep_cut':c.line([(14,21),(23,15)],'blood',3);c.poly([(24,19),(21,25),(24,28),(27,25)],'flesh',None)
   else:c.ell((17,15,26,24),'shade','flesh');c.line([(21,16),(21,23)],'flesh');c.line([(18,20),(25,20)],'flesh')
 elif v.startswith('axe_'):
  c.line([(7,26),(18,9)],'grain',3);c.poly([(15,8),(23,5),(28,9),(26,17),(21,18),(18,13)],'iron');c.line([(27,10),(25,16)],'edge',2)
  if v=='axe_split':c.poly([(5,15),(13,12),(17,20),(15,27),(7,27)],'stone');c.line([(11,14),(9,19),(14,22),(11,27)],'ink',2)
  elif v=='axe_ferocity':c.poly([(8,5),(5,12),(8,16),(11,12)],'flesh',None);c.poly([(15,3),(12,8),(15,11),(17,8)],'blood',None)
  elif v=='axe_sweep':c.line([(4,17),(5,10),(10,5),(16,3)],'worn',2);arrow(c,(24,21),(17,28),'cloth')
  else:figure(c,21,15);c.ell((13,19,23,29),'shade','flesh');c.line([(8,23),(18,18)],'steel',2)
 elif v.startswith('blunt_'):
  if v=='blunt_head_bash':figure(c,19,17);c.line([(6,6),(20,16)],'iron',5);c.line([(7,5),(20,14)],'steel',2);c.line([(21,8),(22,12),(27,10)],'paper')
  elif v=='blunt_bone_breaker':
   c.line([(7,25),(24,8)],'worn',6);c.line([(7,25),(24,8)],'paper',3);c.line([(14,14),(13,18),(18,18),(17,22)],'ink',2);c.line([(5,7),(14,15)],'iron',4)
  elif v=='blunt_shove':figure(c,8,16);figure(c,24,16,'fall','worn');c.line([(9,15),(17,15)],'cloth',3);arrow(c,(15,10),(25,9))
  else:c.poly([(8,8),(16,5),(25,9),(24,24),(16,28),(8,24)],'iron');c.poly([(12,11),(20,12),(16,17),(21,22),(12,23),(15,18)],'shade');c.line([(4,5),(15,15)],'steel',4)
 elif v.startswith('spear_'):
  if v=='spear_wall':
   for x,y in [(7,9),(16,5),(25,9)]:c.line([(x,27),(x,y+5)],'grain',2);c.poly([(x-3,y+6),(x,y),(x+3,y+6)],'steel')
   c.line([(5,25),(27,25)],'cloth',3)
  elif v=='spear_pierce':figure(c,14,15);figure(c,25,15,'stand','worn');c.line([(3,19),(26,17)],'grain',2);c.poly([(24,14),(30,17),(25,20)],'steel');c.dot(14,18,'flesh');c.dot(25,17,'flesh')
  elif v=='spear_reach':c.line([(4,10),(24,10)],'grain',2);c.poly([(22,7),(29,10),(22,13)],'steel');figure(c,24,18);c.line([(5,22),(5,27),(19,27),(19,22)],'worn',2);c.line([(12,24),(12,29)],'worn')
  else:figure(c,21,14,'fall');c.line([(4,23),(25,16)],'grain',2);c.poly([(24,13),(29,15),(25,19)],'steel');c.line([(6,11),(8,6),(15,5)],'worn',2);arrow(c,(15,5),(20,8))
 elif v.startswith('archery_'):
  if v=='archery_recover':
   c.line([(5,26),(24,11)],'grain',2);c.poly([(23,9),(28,8),(26,14)],'iron');c.poly([(12,7),(16,8),(16,15),(20,17),(18,23),(14,25),(9,20),(10,14)],'cloth');c.line([(13,16),(16,19),(18,18)],'earth');arrow(c,(25,24),(29,17))
  elif v=='archery_leg_shot':figure(c,23,14);c.ell((13,19,25,29),'shade','flesh');c.line([(4,9),(18,22)],'grain',2);c.poly([(15,22),(21,26),(19,19)],'steel');c.line([(4,8),(3,12)],'cloth')
  else:
   c.line([(6,6),(12,10),(15,17),(12,24),(6,28)],'grain',2);c.line([(6,6),(6,28)],'cloth')
   if v=='archery_aimed':c.line([(3,18),(24,17)],'iron');c.ell((19,5,28,14),'shade','cloth');c.line([(23,3),(23,17)],'cloth');c.line([(17,10),(30,10)],'cloth')
   else:figure(c,22,16,'crouch');c.line([(17,7),(21,4),(27,6)],'worn');c.line([(17,25),(21,28),(27,26)],'worn')
 elif v=='survival_first_aid':c.poly([(5,20),(19,9),(27,17),(15,28)],'cloth');c.line([(9,18),(18,25)],'earth',2);c.line([(13,14),(22,21)],'earth',2);c.rect((19,3,22,14),'paper');c.rect((15,7,27,10),'paper')
 elif v=='survival_breath':
  c.line([(16,7),(16,20)],'paper',2);c.poly([(13,11),(8,13),(5,22),(8,26),(13,24),(14,17)],'cloth');c.poly([(19,11),(24,13),(27,22),(24,26),(19,24),(18,17)],'worn');c.line([(7,7),(10,4),(14,4)],'paper');c.line([(19,4),(23,4),(26,7)],'paper')
 elif v=='survival_sneak':figure(c,15,16,'crouch');c.line([(6,26),(11,26)],'earth');c.line([(22,26),(27,26)],'earth');c.line([(4,10),(8,10)],'stone');c.line([(24,11),(28,11)],'stone')
 elif v=='survival_tough':c.poly([(6,9),(16,4),(27,9),(25,22),(17,29),(8,23)],'iron');c.poly([(10,12),(17,8),(23,12),(21,21),(17,25),(12,21)],'shade');c.line([(12,17),(15,13),(18,19),(21,14)],'paper',3)
 elif v=='shade_lunge':figure(c,19,15,'crouch');c.line([(17,14),(27,11)],'cloth',2);c.poly([(25,10),(30,7),(28,13)],'steel');c.line([(3,10),(11,10)],'stone',2);c.line([(3,17),(9,17)],'stone');arrow(c,(4,25),(13,24))
 elif v=='amalgam_sweep':figure(c,16,16);c.line([(15,15),(8,9),(3,13)],'worn',3);c.line([(19,14),(24,8),(29,10)],'cloth',3);c.line([(19,20),(27,19),(29,24)],'cloth',3);c.line([(4,7),(11,3),(22,4)],'paper',2);arrow(c,(22,4),(28,7))
 elif v=='amalgam_spore_burst':
  figure(c,16,18,'crouch','worn')
  for x,y,r in [(7,8,2),(18,5,2),(26,11,2),(25,24,2),(5,22,2),(12,13,1),(25,17,1),(8,15,1)]:c.ell((x-r,y-r,x+r,y+r),'cloth' if r==2 else 'stone',None)
  c.line([(10,10),(12,12)],'stone');c.line([(21,9),(20,12)],'stone');c.line([(21,23),(24,26)],'stone')
 elif v=='grab':c.line([(5,6),(13,15),(25,24)],'worn',6);c.poly([(5,24),(9,17),(11,9),(14,8),(16,13),(19,9),(22,11),(22,16),(27,13),(29,16),(25,22),(21,28),(13,29)],'cloth');c.line([(12,14),(10,19),(16,23)],'earth');c.line([(21,16),(18,21)],'earth')
 elif v in ['shove','trip','disarm','crouch']:
  if v=='shove':figure(c,8,16);figure(c,24,16,'fall');c.line([(9,15),(17,14)],'cloth',3);arrow(c,(16,8),(27,9),'paper')
  elif v=='trip':figure(c,9,14);figure(c,24,15,'fall');c.line([(8,20),(19,23)],'cloth',3);c.line([(19,22),(25,24)],'worn',2);arrow(c,(21,6),(27,12),'paper')
  elif v=='disarm':c.poly([(5,20),(11,11),(15,12),(18,17),(15,23),(9,25)],'cloth');c.line([(12,17),(22,8)],'steel',3);c.line([(20,6),(25,12)],'iron',2);arrow(c,(21,20),(28,26),'paper');c.line([(25,23),(29,19)],'grain',2)
  else:figure(c,17,16,'crouch');c.line([(9,27),(26,27)],'stone');arrow(c,(7,6),(7,18),'paper')
 else:raise ValueError(v)

EXTRA={
 'Arrow':('tool','arrow'),'StorageChest':('domestic','chest'),'ShadeRoot':('vegetables','shade_root'),'ShadeSeeds':('vegetables','shade_seeds'),
 'CampfireKit':('domestic','campfire_kit'),'Wood':('domestic','wood'),'Stone':('misc','stone'),'IronScrap':('misc','iron_scrap'),'Leather':('misc','leather'),'Thread':('misc','thread'),'Charcoal':('misc','charcoal'),'Salt':('misc','salt'),
 'Egg':('domestic','egg'),'CrackedEgg':('domestic','cracked_egg'),'FlintlockMusket':('firearm','musket'),'LeadBall':('firearm','lead_ball'),'BlackPowderCharge':('firearm','powder'),'GunOil':('firearm','gun_oil'),
 'BowString':('misc','bow_string'),'Greatsword':('knife','greatsword'),'Revolver':('firearm','revolver'),'BoltRifle':('firearm','rifle'),'FactoryCartridge':('firearm','factory_round'),'ReclaimedCartridge':('firearm','reclaimed_round'),'SpentCase':('firearm','empty_case'),'PrimerCap':('firearm','primer'),
 'LeatherBelt':('domestic','belt'),'Cloth':('misc','cloth'),'Bandage':('domestic','bandage'),'PillYellow':('pill','yellow'),'PillBlue':('pill','blue'),'PillWhite':('pill','white'),'PillBlack':('pill','black'),'PillGreen':('pill','green'),'PillMagenta':('pill','magenta'),
 'WaterBottle':('bottle','water'),'HealthDraught':('bottle','draught'),'Torch':('tool','torch'),'PurificationAmpoule':('bottle','ampoule'),'RustyKnife':('knife','rusty'),'Machete':('knife','machete'),'Hatchet':('axe','hatchet'),'RebarSpear':('tool','spear'),'Bow':('tool','bow'),'Javelin':('tool','javelin'),'Lockpick':('tool','lockpick'),
 'Oats':('vegetables','oats'),'OatSeed':('vegetables','oat_seed'),'Bowl':('domestic','bowl'),'OatmealBowl':('domestic','oatmeal'),'GlassEye':('domestic','eye'),'PowerCell':('misc','cell'),'Quiver':('domestic','quiver'),'Sack':('domestic','sack'),'UnheatedOatmealBowl':('domestic','raw_oatmeal'),'WaterBucket':('domestic','bucket'),'Whitecap':('vegetables','whitecap'),
}
DRAW={'misc':miscellaneous,'tool':tool,'shirt':clothing,'book':book,'bedding':bedding,'kit':kit,'bottle':bottle,'vegetables':vegetable,'meat':meat,'dagger':knife,'knife':knife,'axe':hatchet,'prosthetic':prosthetic,'ration':ration,'tin':tin,'gloves':glove,'jar':jar,'distinct_water':water_tool,'domestic':domestic,'firearm':firearm,'pill':pill}

def sha(data):return hashlib.sha256(data).hexdigest()
def svg(im,title):
 w,h=im.size;parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" shape-rendering="crispEdges"><title>{escape(title)}</title>']
 for y in range(h):
  x=0
  while x<w:
   p=im.getpixel((x,y));end=x+1
   while end<w and im.getpixel((end,y))==p:end+=1
   if p[3]:parts.append(f'<rect x="{x}" y="{y}" width="{end-x}" height="1" fill="#{p[0]:02x}{p[1]:02x}{p[2]:02x}"/>')
   x=end
 return '\n'.join(parts+['</svg>'])+'\n'

def png_contract(path,size):
 data=path.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n';pos=8;ihdr=None;idat=b'';last=None
 while pos<len(data):
  n=struct.unpack('>I',data[pos:pos+4])[0];kind=data[pos+4:pos+8];payload=data[pos+8:pos+8+n];assert struct.unpack('>I',data[pos+8+n:pos+12+n])[0]==zlib.crc32(kind+payload)&0xffffffff
  if kind==b'IHDR':ihdr=struct.unpack('>IIBBBBB',payload)
  if kind==b'IDAT':idat+=payload
  last=kind;pos+=12+n
 assert pos==len(data) and last==b'IEND' and ihdr==(*size,8,6,0,0,0)
 assert len(zlib.decompress(idat))==size[1]*(1+size[0]*4)
 im=Image.open(path);assert im.mode=='RGBA' and im.size==size and set(im.getchannel('A').tobytes())=={0,255}
 return {'sha256':sha(data),'size':list(size),'alpha':[0,255],'crc':'pass','opaquePixels':sum(a==255 for a in im.getchannel('A').tobytes()),'bounds':list(im.getbbox())}

def save_or_check(im,path,title,check):
 source=path.with_suffix('.svg');value=svg(im,title)
 if check:assert Image.open(path).tobytes()==im.tobytes(),path;assert source.read_text()==value,source
 else:im.save(path);source.write_text(value)
 return png_contract(path,im.size)

def make_contacts(rows,images):
 result=[];font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',11)
 groups=[('items',[r for r in rows if r['kind']=='Item']),('abilities',[r for r in rows if r['kind']=='Ability']),('maneuvers',[r for r in rows if r['kind']=='Maneuver'])]
 for name,group in groups:
  for start in range(0,len(group),48):
   subset=group[start:start+48];contact=Image.new('RGB',(1408,((len(subset)+7)//8)*133),'#242326');d=ImageDraw.Draw(contact)
   for i,row in enumerate(subset):
    x,y=(i%8)*176,(i//8)*133;im=images[row['key']];d.rectangle((x+4,y+3,x+171,y+105),fill='#35312e');large=im.resize((96,96),Image.Resampling.NEAREST);contact.paste(large,(x+8,y+7),large);contact.paste(im,(x+128,y+66),im)
    label=row['id'].split('.',1)[1]
    if len(label)>24:d.text((x+4,y+106),label[:23],fill='#d0c2a0',font=font);d.text((x+4,y+119),label[23:],fill='#d0c2a0',font=font)
    else:d.text((x+4,y+111),label,fill='#d0c2a0',font=font)
   path=OUT/f'contact-{name}-{start//48+1:02}.png';contact.save(path);result.append(str(path.relative_to(ROOT)))
 return result

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');args=ap.parse_args();OUT.mkdir(parents=True,exist_ok=True)
 baseline=json.loads((ART/'baseline-registry.json').read_text());prior=json.loads((ROOT/'public/sprites/original/complete/items/catalog.json').read_text())
 owned={k:f for k,f in baseline['frames'].items() if ('/items/' in baseline['sheets'][f[0]] or k=='original_storage_chest_item') and k!='original_ashberry_bush'}
 assert len(owned)==272 and all(f[3:]==[32,32] for f in owned.values())
 rows=[];images={};metas={};physical={};drawing_specs={}
 for row in prior['entries']:
  key=row['key'];assert key in owned,(row['id'],key)
  if row['kind']=='Ability':family,variant='ability',row['id'][3:].replace('.','_');variant=''.join(('_'+x.lower() if x.isupper() else x) for x in variant).lstrip('_').replace('__','_')
  elif row['kind']=='Maneuver':family,variant='ability','shove'
  elif row['id'].split('.',1)[1] in EXTRA:family,variant=EXTRA[row['id'].split('.',1)[1]]
  else:family,variant=row['art']['family'],row['art']['variant']
  if family=='misc' and variant=='fluid':family='bottle'
  c=C()
  if family=='ability':action(c,variant)
  else:DRAW[family](c,variant)
  assert c.im.getbbox(),row['id'];images[key]=c.im;drawing_specs[key]={'family':family,'variant':variant}
  previous=tuple(owned[key]);assert previous not in physical,('Semantic source frame collision',row['id'],physical.get(previous));physical[previous]=key
  rows.append({'id':row['id'],'kind':row['kind'],'label':row['label'],'key':key,'art':drawing_specs[key],'description':row.get('description','')})
 for key,label in [('trip','다리 걸기'),('disarm','무장 해제'),('crouch','웅크리기')]:
  assert key in owned;c=C();action(c,key);images[key]=c.im;physical[tuple(owned[key])]=key;rows.append({'id':'Hud.'+key,'kind':'Maneuver','label':label,'key':key,'art':{'family':'ability','variant':key}})
 assert len(images)==238 and len(rows)==238
 atlas=Image.new('RGBA',(512,480));fragment={'sheets':{'direction_v303_items':'sprites/original/direction-v303/items/items-atlas.png'},'frames':{}};rects={}
 for i,row in enumerate(rows):
  key=row['key'];im=images[key];x,y=(i%16)*32,(i//16)*32;atlas.paste(im,(x,y));rects[key]=['direction_v303_items',x,y,32,32]
  path=OUT/(key+'.png');metas[key]=save_or_check(im,path,row['id']+' / '+row['label'],args.check);row.update(frame=rects[key],png=str(path.relative_to(ROOT)),svg=str(path.with_suffix('.svg').relative_to(ROOT)))
 aliases=[]
 for key,old in owned.items():
  semantic=physical[tuple(old)];fragment['frames'][key]=rects[semantic][:]
  if key!=semantic:aliases.append({'key':key,'semanticFrame':semantic,'frame':rects[semantic][:],'size':[32,32]})
 assert len(aliases)==34 and set(fragment['frames'])==set(owned)
 assert all(fragment['frames'][k][3:]==old[3:] for k,old in owned.items())
 atlas_meta=save_or_check(atlas,OUT/'items-atlas.png','ASHVEIL v303: 206 items, 28 abilities, 4 maneuvers; original integer geometry',args.check)
 loaded=Image.open(OUT/'items-atlas.png')
 for key,im in images.items():
  _,x,y,w,h=rects[key];assert loaded.crop((x,y,x+w,y+h)).tobytes()==im.tobytes(),key
 assert len({m['sha256'] for m in metas.values()})==238,'Different semantic icons accidentally have identical pixels'
 # Check against the previous explicit pixel SVG sources without reading old
 # sprite PNGs: alpha masks differ for every semantic image (no colour filter).
 import xml.etree.ElementTree as ET
 old_sources={r['key']:r.get('source') for r in prior['entries'] if r.get('source')};geometry_changes=[]
 for key,source in old_sources.items():
  old=Image.new('1',(32,32));d=ImageDraw.Draw(old)
  for el in ET.parse(ROOT/source).getroot().findall('{http://www.w3.org/2000/svg}rect'):
   a=el.attrib;x,y,w,h=[int(a[n]) for n in ['x','y','width','height']];d.rectangle((x,y,x+w-1,y+h-1),fill=1)
  assert old.tobytes()!=images[key].getchannel('A').convert('1').tobytes(),('No silhouette change',key);geometry_changes.append(key)
 report={'version':'v303','counts':{'items':206,'abilities':28,'maneuvers':4,'semanticOriginals':238,'frameKeys':272,'legacyAliases':34,'uniquePngHashes':238,'changedPriorAuthoredAlphaMasks':len(geometry_changes)},'logicalSizes':{'32x32':272},'sixteenPixelFrames':0,'sourcePolicy':'Fresh integer geometry. No earlier PNG/JPG inputs, recolour, traced silhouettes or random/hash-generated details. Earlier JSON supplies names/bindings only. Reference JPGs are analysis only.','palette':P,'atlas':{'sheet':'direction_v303_items',**atlas_meta,'exactRgbaRectMatches':238},'coverage':{'expectedKeys':sorted(owned),'providedKeys':sorted(fragment['frames']),'missing':[],'extra':[],'excludedOtherOwners':['original_ashberry_bush','original_hearth_oat_plot','original_pantry_full','original_pantry_low','original_pantry_empty','world props/trees'],'preservedWidthHeight':272},'entries':rows,'legacyAliases':aliases,'perImage':metas,'inputSha256':{str(p.relative_to(ROOT)):sha(p.read_bytes()) for p in [ART/'baseline-registry.json',ROOT/'public/sprites/original/complete/items/catalog.json',Path(__file__).resolve()]}}
 if args.check:
  assert json.loads((ART/'items.fragment.json').read_text())==fragment;assert json.loads((OUT/'catalog.json').read_text())==report
 else:
  (ART/'items.fragment.json').write_text(json.dumps(fragment,ensure_ascii=False,indent=2)+'\n');(OUT/'catalog.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
  contacts=make_contacts(rows,images);contact=Image.new('RGBA',atlas.size,'#35312e');contact.alpha_composite(atlas);contact.resize((1024,960),Image.Resampling.NEAREST).convert('RGB').save(OUT/'contact-atlas.png');contacts.append(str((OUT/'contact-atlas.png').relative_to(ROOT)));(OUT/'contacts.json').write_text(json.dumps(contacts,indent=2)+'\n')
 print(json.dumps({'checked':args.check,**report['counts'],'atlas':[512,480],'rgbaMatches':238,'allWidthsHeightsPreserved':272,'pngCrc':'pass'}))

if __name__=='__main__':main()
