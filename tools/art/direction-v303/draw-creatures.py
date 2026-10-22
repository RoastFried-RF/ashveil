#!/usr/bin/env python3
"""v303 actor originals. New authored integer geometry; no PNG/image input.

52 original actor sheets, 718 existing frame keys, 28 CharDef registrations.
All metadata/layout contracts come from baseline-registry.json, never its images.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
from pathlib import Path
import struct
import zlib
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
OUT=ROOT/'public/sprites/original/direction-v303/creatures'
BASE=HERE/'baseline-registry.json'
DIRS=['down','left','right','up']
COLORS={
    '.':'00000000','ink':'19191b','shade':'29282a','earth':'49413b',
    'stone':'68645c','worn':'969080','linen':'a69a7b','skin':'b3a18b',
    'paper':'d0c2a0','iron':'697075','rust':'78503c','moss':'4d5644',
    'flesh':'8e7b69','skinshade':'65534b','chalk':'c3b7a1','hair':'38302c',
    'wool':'555354','cloth':'797264','clothlight':'9b917a','leather':'5d4939',
    'seam':'3d3530','cuff':'b0a58d','ironlight':'9a9c92','ironshade':'404346',
    'brass':'9f875a','blood':'6f4740','sore':'8b5d4e','sack':'8a7656',
    'bluegrey':'555d62','bluegreyLight':'7c8280','charcoal':'343234',
    'bark':'5b4c42','hide':'817664','fur':'77766c','furLight':'a09b8b',
    'furDark':'4d4e49','rose':'9a7867','fungus':'a4977d','gill':'685b4f',
    'fungusDark':'80715d','fungusPale':'c0b093','BG':'302e2e',
}
P={k:tuple(bytes.fromhex(v)) if len(v)==8 else (*bytes.fromhex(v),255) for k,v in COLORS.items()}


class C:
    def __init__(self,w,h,ox=0,oy=0,fill='.'):
        self.w,self.h,self.ox,self.oy=w,h,ox,oy
        self.pixels=[[fill]*w for _ in range(h)]
        self.clipped=set()
    def p(self,x,y,color):
        assert isinstance(x,int) and isinstance(y,int)
        x+=self.ox;y+=self.oy
        if 0<=x<self.w and 0<=y<self.h:self.pixels[y][x]=color
        elif color!='.':self.clipped.add((x,y))
    def rect(self,x,y,w,h,color):
        for yy in range(y,y+h):
            for xx in range(x,x+w):self.p(xx,yy,color)
    def line(self,x0,y0,x1,y1,color):
        dx,sx=abs(x1-x0),1 if x0<x1 else -1
        dy,sy=-abs(y1-y0),1 if y0<y1 else -1
        err=dx+dy
        while True:
            self.p(x0,y0,color)
            if x0==x1 and y0==y1:break
            e=err*2
            if e>=dy:err+=dy;x0+=sx
            if e<=dx:err+=dx;y0+=sy
    def poly(self,pts,color,border='ink'):
        for y in range(min(p[1] for p in pts),max(p[1] for p in pts)+1):
            for x in range(min(p[0] for p in pts),max(p[0] for p in pts)+1):
                inside=False;j=len(pts)-1
                for i,(xi,yi) in enumerate(pts):
                    xj,yj=pts[j]
                    if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi)+xi:inside=not inside
                    j=i
                if inside:self.p(x,y,color)
        if border:
            for a,b in zip(pts,pts[1:]+pts[:1]):self.line(*a,*b,border)
    def ellipse(self,x,y,w,h,color,border=None):
        # Integer centre-distance ellipse, used only for original anatomy/materials.
        pts=[]
        for yy in range(y,y+h):
            for xx in range(x,x+w):
                if (2*(xx-x)+1-w)**2*h*h+(2*(yy-y)+1-h)**2*w*w<=w*w*h*h:pts.append((xx,yy))
        for xx,yy in pts:self.p(xx,yy,color)
        if border:
            s=set(pts)
            for xx,yy in pts:
                if any((xx+dx,yy+dy) not in s for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]):self.p(xx,yy,border)
    def stroke(self,pts,color,width=1):
        for a,b in zip(pts,pts[1:]):
            for d in range(-(width//2),width-width//2):self.line(a[0]+d,a[1],b[0]+d,b[1],color)
    def blit(self,other,x,y,scale=1):
        for yy,row in enumerate(other.pixels):
            for xx,col in enumerate(row):
                if col!='.':self.rect(x+xx*scale,y+yy*scale,scale,scale,col)


DESIGNS={
 'hero':'Retired traveller: exposed small weathered head, long open wool coat, uneven shoulder blanket, tied case and cuff repairs.',
 'original_wanderer_hero':'Active wanderer: very narrow angular hood, visible small tired face, long legs, diagonal mantle and a separate low satchel. Entirely new geometry.',
 'reaver0':'Broad iron-capped adult, short riveted scrap vest, bare scarred forearms, hanging side bindings and heavy boots.',
 'reaver1':'Lean shaven adult, slashed one-sleeve coat, diagonal leather sash, wrapped calves and jutting elbow.',
 'complete_reaver_chief':'Tall chief with split heavy overcoat, layered shoulder slab, scrap helmet, tied hatchet and small worn buckler. Defined loadout visual interpretation.',
 'complete_reaver_archer':'Lean archer with narrow cowl, sloping quiver, long bow at rest/draw, short side cape and articulated knees. Defined bow loadout.',
 'shade0':'Small adult human with a small bald crown, drooped shoulders, long low forearms, torn work smock and bent knees.',
 'shade1':'Small adult human, side-parted hair, open vest over a narrow chest, bound shins and a one-sided satchel.',
 'shade2':'Small adult human with loose lank hair, one hanging long sleeve, diagonal chest wrap and long hands.',
 'shade3':'Small adult human with knotted hair, sleeveless shoulder wrap, apron-like rag and very narrow feet.',
 'shade_chief':'Small adult leader, high rough collar, overlapping short coat, narrow crown, bandaged forearm. No crown or magical eyes.',
 'withered':'Living emaciated fever patient: lowered small face, long forearms, protruding clothed rib cage, one fallen sleeve, flexed shins.',
 'withered_priest':'Living fever patient priest: inclined bald face, worn long vestment and rope stole, bell-shaped hanging censer with chain.',
 'spore0':'Living infected pilgrim: small side-tilted face, torn long shirt, dry irregular shelf growth on one shoulder and forearm; no glowing aura.',
 'spore1':'Living infected pilgrim with a different asymmetric back growth, folded hood, sparse crust on calves, worn short surcoat; no mushroom mascot head.',
 'resident_worker':'Adult worker: small short-haired head, rolled sleeves, long linen apron, waist cord, knee patch and repair pouch.',
 'resident_healer':'Adult caregiver: hair tied under a narrow linen wrap, asymmetric long apron, clean folded cloths at belt and practical side bag; no modern emblem.',
 'resident_guard':'Adult guard: open hood, long quilted coat, leather shoulder reinforcement, narrow spear from defined loadout, separate braced legs.',
 'resident_trader':'Adult trader: receding narrow head, overlapping long waistcoat, high folded collar, soft document case and belt pockets; no coins or stock count.',
 'tender_drone':'Six-legged service machine, rusted iron shell, brass worm-drive joints, comb cooling fins, dark optical slit and two unequal tool arms.',
 'tender_drone_inert':'Same new service machine with legs folded into separate low joints and tool arm resting; four real directional inert poses.',
 'amalgam':'Living failed-treatment fusion: three separate small human heads, four long arms, several joined clothed torsos and dragging legless base; skin and old linen remain distinguishable.',
 'ash_hound':'Low lean feral canine: pointed muzzle, small ears, sloping back, long hock, clumped ash-grey fur and a hanging bent tail.',
 'ash_hound_alpha':'Larger canine with a separate heavy ruff, wider chest, ragged high withers, shorter hanging tail and neck scar; geometry differs from hound.',
 'burrow_rat':'Low elongated rodent with distinct snout, folded ear, thin scaly tail, hunched rump and small visible incisors.',
 'murk_leech':'Flattened flexible segmented worm, elongated hooked body and end sucker, warm grey skin ridge, no legs, eyes or shell.',
}


def limb(c,shoulder,elbow,hand,cloth,skin=False,width=2):
    for a,b in [(shoulder,elbow),(elbow,hand)]:
        c.stroke([a,b],'ink',width+2);c.stroke([a,b],'flesh' if skin else cloth,width)
        if skin:c.line(a[0]-1,a[1],b[0]-1,b[1]-1,'skin')
    c.rect(hand[0],hand[1],1,2,'skin')
    c.p(hand[0]+1,hand[1]+1,'skinshade')


def head(c,x,y,d,hair='hair',kind='bare'):
    # The exposed face is 3 pixels wide and five high: adult 5.5–6 head proportion.
    if d in ['down','up']:
        c.poly([(x-2,y+1),(x-1,y),(x+1,y),(x+2,y+2),(x+1,y+5),(x-1,y+5),(x-2,y+3)],'skin' if d=='down' else hair)
        c.line(x-1,y,x+1,y,hair);c.p(x-2,y+2,'flesh')
        if d=='down':
            c.p(x-1,y+2,'shade');c.p(x+1,y+2,'shade');c.p(x,y+3,'chalk');c.p(x,y+4,'skinshade')
        else:c.line(x-1,y+1,x-1,y+3,'earth');c.p(x+1,y+4,'skinshade')
        c.rect(x-1,y+6,2,2,'flesh')
        if kind=='hood':
            c.poly([(x-3,y+2),(x-2,y-1),(x,y-2),(x+2,y),(x+3,y+5),(x+1,y+6),(x+2,y+1),(x-1,y),(x-2,y+4),(x-2,y+6),(x-3,y+5)],'bluegrey')
            c.line(x-1,y-1,x,y-2,'bluegreyLight');c.p(x-2,y+1,'worn')
        elif kind=='wrap':
            c.line(x-2,y,x+1,y-1,'linen');c.p(x+2,y,'clothlight');c.p(x+2,y+5,'hair')
        elif kind=='helmet':
            c.poly([(x-3,y+1),(x-2,y-1),(x+1,y-1),(x+3,y+2),(x+2,y+3),(x-3,y+2)],'ironshade')
            c.line(x-2,y,x+1,y,'iron');c.p(x-1,y-1,'ironlight');c.line(x-3,y+2,x+2,y+2,'earth')
        elif kind=='lank':c.line(x-2,y+1,x-3,y+6,'hair');c.line(x+2,y+1,x+2,y+7,'hair')
        elif kind=='knot':c.rect(x+1,y-2,2,2,'hair');c.p(x,y-1,'earth')
    elif d=='left':
        c.poly([(x-1,y),(x+1,y),(x+2,y+2),(x+1,y+5),(x-1,y+5),(x-2,y+3),(x-3,y+2),(x-1,y+1)],'flesh')
        c.line(x-1,y,x+1,y,hair);c.line(x+1,y+1,x+1,y+3,hair)
        c.p(x-2,y+2,'shade');c.p(x-3,y+3,'skin');c.p(x-1,y+3,'skin');c.p(x-1,y+4,'skinshade');c.rect(x,y+6,2,2,'flesh')
        if kind=='hood':
            c.poly([(x-2,y),(x,y-2),(x+2,y-1),(x+3,y+3),(x+2,y+7),(x,y+6),(x+1,y+3),(x,y),(x-2,y+1)],'bluegrey')
            c.line(x,y-1,x+1,y-1,'bluegreyLight')
        elif kind=='helmet':
            c.poly([(x-3,y+1),(x-1,y-1),(x+2,y),(x+3,y+2),(x+1,y+3),(x-2,y+2)],'ironshade');c.line(x-2,y,x,y,'ironlight')
        elif kind=='wrap':c.line(x-1,y-1,x+2,y,'linen');c.p(x+2,y+5,'hair')
        elif kind=='lank':c.line(x+1,y+1,x+2,y+7,'hair');c.p(x-2,y,'hair')
        elif kind=='knot':c.rect(x+2,y-1,2,2,'hair')
    else:
        c.poly([(x-1,y),(x+1,y),(x+1,y+1),(x+3,y+2),(x+2,y+3),(x+1,y+5),(x-1,y+5),(x-2,y+2)],'flesh')
        c.line(x-1,y,x+1,y,hair);c.line(x-1,y+1,x-1,y+3,hair)
        c.p(x+2,y+2,'shade');c.p(x+3,y+3,'skin');c.p(x,y+3,'skin');c.p(x+1,y+4,'skinshade');c.rect(x-1,y+6,2,2,'flesh')
        if kind=='hood':
            c.poly([(x+2,y),(x,y-2),(x-2,y-1),(x-3,y+3),(x-2,y+7),(x,y+6),(x-1,y+3),(x,y),(x+2,y+1)],'bluegrey');c.p(x-1,y-1,'bluegreyLight')
        elif kind=='helmet':
            c.poly([(x-3,y+2),(x-2,y),(x+1,y-1),(x+3,y+1),(x+2,y+2),(x-1,y+3)],'ironshade');c.line(x-1,y,x+1,y,'iron')
        elif kind=='wrap':c.line(x-2,y,x+1,y-1,'linen');c.p(x-2,y+5,'hair')
        elif kind=='lank':c.line(x-1,y+1,x-2,y+7,'hair');c.p(x+2,y,'hair')
        elif kind=='knot':c.rect(x-3,y-1,2,2,'hair')


def legs(c,d,phase,top,kind,small=False,ill=False):
    gait=[0,-1,1][phase%3]
    feet=29 if kind.startswith('spore') else 30
    knee=(top+feet)//2
    col='skinshade' if ill else 'charcoal' if kind in ['hero','original_wanderer_hero','complete_reaver_archer'] else 'earth'
    hi='flesh' if ill else 'cloth'
    if d in ['down','up']:
        for i,(x,step) in enumerate([(9,-gait),(14,gait)]):
            if small:x+=1 if i==0 else -1
            c.poly([(x-1,top),(x+1,top),(x+1+step,knee),(x+step,feet-1),(x-1+step,feet-1),(x-1+step,knee)],col)
            c.line(x-1,top+2,x-1+step,knee,hi)
            c.p(x+step,knee+1,'skin' if ill else 'earth')
            fy=feet-(1 if step==-1 else 0)
            c.rect(x-1+step,fy-1,2,1,'skinshade' if ill else 'leather');c.rect(x-2+step,fy,4 if not small else 3,1,'ink')
    else:
        k=1 if d=='right' else -1
        c.poly([(11,top),(13,top),(13+gait*k,knee),(12+gait*k,feet-1),(10+gait*k,feet-1),(11+gait*k,knee)],col)
        c.rect(10+gait*k,feet-1,3,1,'leather' if not ill else 'skinshade')
        c.poly([(9,top),(11,top),(10-gait*k,knee),(11-gait*k,feet),(9-gait*k,feet),(8-gait*k,knee)],col)
        c.line(9,top+1,9-gait*k,knee,hi)
        c.rect((8 if d=='left' else 9)-gait*k,feet-(1 if gait==1 else 0),4,1,'ink')
    if kind in ['reaver1','shade1']:
        c.line(9,feet-6,10,feet-5,'linen');c.line(13,feet-4,14,feet-3,'linen')


def torso(c,kind,d,top,hip,small,gait):
    # Anatomy is shared; every costume below has its own cut, hem and attachments.
    x=12;left=8 if not small else 9;right=16 if not small else 15
    if d in ['left','right']:left+=1;right-=1
    c.poly([(left,top),(right-1,top-1),(right+1,top+3),(right,hip),(left,hip),(left-1,top+4)],'cloth')
    c.line(left,top+2,left,hip-1,'clothlight');c.line(right-1,top+3,right-1,hip-1,'earth')
    if kind=='hero':
        c.poly([(7,top),(15,top),(18,top+4),(17,24),(18,27),(14,27),(12,22),(10,27),(5,26),(7,18)],'wool')
        c.line(8,top+2,7,23,'worn');c.line(15,top+3,15,24,'charcoal')
        c.poly([(7,top),(12,top-1),(14,top+3),(7,top+5),(5,top+3)],'clothlight')
        c.line(8,top+1,11,top+2,'earth');c.rect(14,21,3,4,'leather');c.p(15,22,'brass')
    elif kind=='original_wanderer_hero':
        c.poly([(8,top),(14,top),(16,top+3),(14,22),(16,25),(12,24),(10,22),(7,24),(8,18)],'bluegrey')
        c.line(9,top+3,8,20,'bluegreyLight');c.line(13,top+3,13,21,'charcoal')
        c.poly([(8,top),(14,top-1),(18,top+4),(13,top+5),(8,top+3),(6,top+4)],'cloth')
        c.line(8,top+1,12,top+1,'linen');c.p(16,top+3,'worn')
        c.line(15,top+3,9,21,'leather');c.line(14,top+3,8,21,'seam')
        c.poly([(6,20),(10,20),(11,24),(7,25),(5,23)],'leather');c.line(6,21,9,21,'sack');c.p(7,22,'brass')
        c.rect(12,19,2,3,'wool');c.p(12,20,'linen')
    elif kind=='reaver0':
        c.poly([(7,top),(16,top-1),(17,19),(15,22),(8,22),(6,18)],'leather')
        for xx,yy in [(9,top+3),(12,top+2),(14,top+4),(10,top+6),(13,top+7),(8,20)]:c.p(xx,yy,'iron');c.p(xx+1,yy+1,'seam')
        c.poly([(5,top),(9,top-1),(10,top+3),(6,top+4),(4,top+2)],'ironshade');c.line(5,top+1,8,top,'ironlight')
        c.line(11,top+1,11,20,'linen');c.p(11,top+4,'earth');c.p(11,top+7,'earth')
        c.line(7,21,16,21,'seam');c.rect(16,20,2,5,'cloth')
    elif kind=='reaver1':
        c.poly([(8,top),(13,top-1),(16,top+2),(15,23),(12,22),(11,20),(7,24),(7,18)],'earth')
        c.poly([(7,top),(10,top),(10,top+3),(8,top+6),(6,top+4)],'clothlight')
        c.line(15,top,8,21,'leather');c.line(14,top,7,21,'skinshade')
        c.line(12,top+5,14,top+7,'linen');c.p(14,22,'clothlight');c.p(8,22,'ink')
    elif kind=='complete_reaver_chief':
        c.poly([(7,top),(16,top-1),(19,top+3),(17,22),(19,27),(14,26),(12,22),(10,27),(5,26),(6,19),(4,top+3)],'charcoal')
        c.line(7,top+4,6,24,'wool');c.line(16,top+4,16,24,'earth')
        c.poly([(6,top),(10,top-1),(13,top+3),(9,top+5),(4,top+3)],'ironshade');c.line(6,top+1,10,top,'iron');c.p(8,top+1,'ironlight')
        c.poly([(12,top),(16,top),(18,top+4),(15,top+5),(12,top+3)],'leather');c.line(14,top+1,16,top+3,'rust')
        c.line(12,top+3,12,21,'sack');c.rect(7,21,10,1,'seam');c.p(12,21,'brass')
        c.line(8,24,9,25,'linen');c.p(17,24,'cloth')
    elif kind=='complete_reaver_archer':
        qx=15 if d in ['down','left'] else 6
        c.poly([(qx,7),(qx+3,8),(qx+3,20),(qx+1,21),(qx,15)],'leather');c.line(qx+1,8,qx+2,18,'sack')
        c.line(qx+1,4,qx+1,9,'worn');c.p(qx,4,'paper');c.p(qx+2,5,'linen')
        c.poly([(9,top),(14,top),(16,top+4),(14,21),(16,23),(12,24),(9,22),(7,24),(8,17)],'cloth')
        c.line(9,top+3,9,20,'clothlight');c.poly([(8,top),(12,top),(11,top+5),(6,top+7)],'wool')
        c.line(14,top+2,9,21,'leather');c.p(12,17,'brass');c.line(8,21,15,21,'earth')
    elif kind=='resident_worker':
        c.poly([(7,top),(16,top),(17,top+5),(15,22),(8,22),(6,top+5)],'earth')
        c.poly([(10,top+1),(14,top+1),(14,19),(16,25),(10,26),(7,24),(9,18)],'linen')
        c.line(10,top+3,10,21,'cuff');c.line(14,20,13,24,'cloth');c.p(9,24,'earth')
        c.line(7,20,16,20,'leather');c.rect(16,21,2,4,'sack');c.p(17,22,'brass');c.rect(8,27,2,2,'clothlight')
    elif kind=='resident_healer':
        c.poly([(8,top),(15,top),(17,top+5),(15,25),(8,25),(6,top+5)],'wool')
        c.poly([(10,top+1),(14,top+1),(14,20),(16,27),(11,28),(7,26),(9,19)],'cuff')
        c.line(10,top+4,10,24,'paper');c.line(14,22,13,26,'clothlight');c.line(7,20,15,20,'leather')
        c.poly([(6,19),(9,20),(9,24),(5,24),(5,21)],'leather');c.line(6,20,8,21,'sack')
        c.rect(14,19,3,3,'linen');c.line(15,19,15,21,'paper');c.p(16,20,'clothlight')
    elif kind=='resident_guard':
        c.poly([(7,top),(16,top),(18,top+4),(16,22),(17,26),(13,25),(12,22),(10,26),(6,25),(7,19),(5,top+4)],'bluegrey')
        c.line(8,top+3,7,23,'bluegreyLight');c.line(15,top+4,15,23,'charcoal')
        for yy in [top+3,top+5,top+7]:c.line(10,yy,14,yy,'ironshade')
        c.poly([(5,top),(9,top),(10,top+3),(6,top+4)],'leather');c.line(6,top+1,8,top+1,'sack')
        c.line(12,top+1,12,21,'seam');c.line(7,21,16,21,'leather');c.p(12,21,'brass')
    elif kind=='resident_trader':
        c.poly([(8,top),(15,top),(17,top+3),(15,22),(17,25),(12,24),(8,26),(6,23),(8,17)],'leather')
        c.poly([(9,top),(11,top+1),(12,top+6),(10,top+4),(8,top+2)],'linen')
        c.poly([(14,top),(12,top+1),(12,top+6),(14,top+4),(15,top+2)],'clothlight')
        c.line(10,top+7,9,23,'sack');c.line(14,top+7,15,23,'earth')
        c.rect(7,20,3,3,'earth');c.rect(14,20,3,3,'wool');c.p(12,19,'brass')
        c.poly([(16,20),(19,19),(20,24),(16,25)],'earth');c.line(17,20,18,22,'worn')
    elif kind.startswith('shade'):
        if kind=='shade0':
            c.poly([(8,top),(14,top),(16,top+3),(14,23),(12,22),(10,24),(7,22),(8,18)],'clothlight')
            c.line(9,top+2,9,20,'linen');c.line(11,top+5,14,top+6,'earth');c.p(10,23,'ink')
        elif kind=='shade1':
            c.poly([(9,top),(14,top),(16,top+3),(14,21),(11,22),(8,21)],'earth')
            c.line(11,top+1,11,20,'skinshade');c.rect(12,top+3,2,4,'skin')
            c.rect(15,20,3,4,'leather');c.line(14,top+1,16,20,'sack')
        elif kind=='shade2':
            c.poly([(8,top),(14,top-1),(16,top+3),(14,23),(10,22),(7,24),(8,19)],'wool')
            c.line(8,top+1,14,top+5,'linen');c.line(8,top+2,13,top+6,'cloth');c.line(9,19,8,22,'worn')
        elif kind=='shade3':
            c.poly([(9,top),(14,top),(15,top+3),(14,22),(10,23),(8,21)],'skinshade')
            c.poly([(9,top),(15,top),(15,top+3),(12,top+4),(8,top+2)],'clothlight')
            c.poly([(9,20),(14,20),(15,25),(12,24),(9,25)],'earth');c.line(10,21,10,24,'cloth')
        else:
            c.poly([(8,top),(14,top-1),(17,top+3),(15,23),(12,22),(10,25),(7,23)],'charcoal')
            c.poly([(9,top-1),(14,top-2),(15,top+1),(12,top+3),(8,top+1)],'cloth')
            c.line(9,top+5,8,22,'worn');c.line(15,top+4,14,21,'earth');c.line(10,21,14,21,'sack')
    elif kind=='withered':
        c.poly([(8,top),(13,top-2),(15,top+2),(14,hip),(11,hip+2),(8,hip),(7,top+4)],'flesh')
        c.line(9,top+1,9,hip-1,'skin');c.line(12,top,12,hip-1,'skinshade')
        for yy in [top+2,top+4,top+6]:c.line(9,yy,11,yy+1,'stone')
        c.poly([(7,top),(10,top+2),(9,top+5),(7,top+4),(6,top+2)],'cloth')
        c.poly([(8,20),(14,20),(15,24),(12,22),(11,25),(8,24)],'wool');c.p(10,23,'ink')
    elif kind=='withered_priest':
        c.poly([(8,top),(14,top),(17,top+4),(15,21),(18,28),(14,29),(12,25),(10,29),(6,28),(8,20),(6,top+4)],'earth')
        c.line(9,top+3,8,25,'clothlight');c.line(14,top+5,14,26,'shade')
        c.poly([(10,top),(13,top),(14,top+4),(13,25),(11,27),(10,21)],'linen')
        c.line(11,top+3,11,24,'clothlight');c.p(12,22,'rust');c.p(16,27,'skinshade')
    elif kind.startswith('spore'):
        c.poly([(8,top),(14,top),(17,top+4),(15,21),(17,25),(13,24),(11,22),(9,25),(6,24),(7,19),(6,top+4)],'cloth' if kind=='spore0' else 'wool')
        c.line(9,top+2,8,22,'linen');c.line(14,top+4,14,21,'earth')
        c.poly([(10,top+2),(14,top+3),(13,18),(10,19)],'flesh');c.line(11,top+4,11,17,'skinshade')
        c.p(12,20,'blood');c.line(10,23,11,24,'ink');c.p(15,24,'ink')
    # A back seam and its shoulder folds differ visibly from the front face.
    if d=='up':
        c.line(12,top+3,12,hip-1,'seam');c.line(9,top+3,11,top+4,'worn')
        if kind in ['hero','original_wanderer_hero']:c.poly([(8,top+4),(13,top+4),(14,19),(9,20),(7,18)],'leather');c.line(9,top+5,12,top+5,'sack')


def shelf(c,x,y,w,tilt=0):
    c.poly([(x,y+2),(x+1,y),(x+w-2,y-1+tilt),(x+w,y+1),(x+w-1,y+3),(x+2,y+3)],'fungusDark')
    c.line(x+1,y,x+w-2,y+tilt,'fungusPale');c.line(x+2,y+2,x+w-2,y+2,'gill')
    c.p(x+w-1,y+1,'fungus');c.p(x+2,y+1,'fungus')


def human(kind,d,phase,attack,w,h):
    ox=(w-24)//2;oy=h-32
    c=C(w,h,ox,oy)
    small=kind.startswith('shade');ill=kind in ['withered','withered_priest']
    spore=kind.startswith('spore')
    top=14 if small else 14 if kind=='withered' else 12 if spore or kind=='withered_priest' else 10
    hip=22 if small or ill or spore else 21
    gait=[0,-1,1][phase%3] if not attack else [0,-1,1,0][phase]
    legs(c,d,phase,hip,kind,small,ill)
    # Weight transfers above the fixed planted feet, so shoulder and pelvis do not
    # remain a rigid upright column. Each direction is authored, never PNG flipped.
    if not attack:c.ox+=gait
    # Back arm precedes torso; lower hands have long forearms instead of chibi mitts.
    skinarm=small or kind in ['reaver0','withered','spore0','shade3']
    cloth='wool' if kind in ['hero','resident_healer','shade2','shade_chief'] else 'bluegrey' if kind in ['original_wanderer_hero','resident_guard'] else 'earth'
    low=25 if small or ill else 23
    if d in ['down','up']:
        left=(6,low+gait);right=(18,low-gait)
        elbows=((6,top+7),(18,top+7))
        if small:left=(7,26+gait);right=(17,26-gait);elbows=((7,top+6),(17,top+6))
        if attack:
            if d=='down':left,right=[((7,top+7),(17,top+8)),((5,top+2),(19,top+4)),((5,26),(18,26)),((7,low-1),(18,low))][phase]
            else:left,right=[((7,top+7),(17,top+5)),((6,top+1),(18,top-1)),((6,top-2),(19,top-5)),((7,top+5),(18,top+3))][phase]
        torso(c,kind,d,top,hip,small,gait)
        limb(c,(8,top+1),elbows[0],left,cloth,skinarm,1 if small or ill else 2)
        limb(c,(16,top+1),elbows[1],right,cloth,skinarm,1 if small or ill else 2)
        hand=right
    elif d=='left':
        far=(14,low-gait);near=(7,low+gait)
        if attack:far=[(13,top+7),(13,top+4),(8,top+8),(13,top+7)][phase];near=[(8,top+7),(9,top),(2,top+6),(7,top+9)][phase]
        limb(c,(14,top+1),(15,top+6),far,cloth,False,1)
        torso(c,kind,d,top,hip,small,gait)
        limb(c,(9,top+1),(7,top+6),near,cloth,skinarm,1 if small or ill else 2)
        hand=near
    else:
        far=(10,low+gait);near=(17,low-gait)
        if attack:far=[(11,top+7),(11,top+4),(16,top+8),(11,top+7)][phase];near=[(16,top+7),(15,top),(22,top+6),(17,top+9)][phase]
        limb(c,(10,top+1),(9,top+6),far,cloth,False,1)
        torso(c,kind,d,top,hip,small,gait)
        limb(c,(15,top+1),(17,top+6),near,cloth,skinarm,1 if small or ill else 2)
        hand=near
    hy=8 if small else 8 if kind=='withered' else 5 if spore or kind=='withered_priest' else 3
    hx=11 if kind in ['withered','shade0','spore0'] else 12
    if attack and phase==2 and d in ['left','right']:hx+=-1 if d=='left' else 1
    hk='hood' if kind in ['original_wanderer_hero','complete_reaver_archer','resident_guard'] else 'helmet' if kind in ['reaver0','complete_reaver_chief'] else 'wrap' if kind=='resident_healer' else 'lank' if kind in ['shade2','withered','spore1'] else 'knot' if kind=='shade3' else 'bare'
    head(c,hx,hy,d,'earth' if kind in ['reaver1','withered_priest','resident_trader'] else 'hair',hk)
    if kind=='resident_worker':
        c.line(6,top+5,7,top+5,'linen');c.line(17,top+5,18,top+5,'linen')
    if kind=='shade2':c.poly([(6,top+3),(8,top+4),(8,24),(5,24)],'wool');c.p(6,22,'worn')
    if kind=='shade_chief':c.line(7,22,8,23,'linen');c.line(7,24,8,25,'clothlight')
    if kind=='withered':c.p(hx+1,hy+4,'sore');c.p(8,24,'sore');c.line(16,22,17,24,'skin')
    if kind.startswith('spore'):
        if kind=='spore0':
            shelf(c,4,11,6);shelf(c,5,15,5,1);shelf(c,3 if d!='right' else 17,20,4)
            c.p(8,10,'fungus');c.p(6,19,'gill');c.p(16,27,'fungus')
        else:
            shelf(c,14 if d!='left' else 5,7,6,1);shelf(c,16 if d!='left' else 4,13,5)
            shelf(c,13,24,4);c.p(10,13,'fungusPale');c.p(8,26,'fungusDark')
    # Defined role equipment is a silhouette, never an inventory/quantity indicator.
    if kind=='resident_guard':
        xx=19 if d in ['down','right'] else 4
        if attack and phase==2:
            if d=='left':c.line(1,top+6,14,top+9,'bark');c.line(1,top+5,4,top+6,'ironlight')
            elif d=='right':c.line(9,top+9,22,top+6,'bark');c.line(20,top+6,22,top+5,'ironlight')
            else:c.line(xx,7,xx,27,'bark');c.poly([(xx,3),(xx-1,7),(xx+1,8)],'iron')
        else:
            c.line(xx,9,xx,29,'bark');c.line(xx-1,10,xx-1,26,'leather');c.poly([(xx,4),(xx-1,8),(xx+1,10)],'iron');c.p(xx,5,'ironlight')
    if kind=='complete_reaver_chief':
        xx=18 if d in ['down','right'] else 5
        if attack and phase in [1,2]:xx=max(3,min(19,hand[0]));yy=max(7,hand[1]-3)
        else:yy=21
        c.line(xx,yy-2,xx,yy+5,'bark');c.poly([(xx-2,yy-2),(xx+2,yy-3),(xx+3,yy),(xx+1,yy+1),(xx-1,yy)],'ironshade');c.line(xx+1,yy-2,xx+2,yy,'ironlight')
        bx=5 if d in ['down','left'] else 18
        c.poly([(bx-2,18),(bx+1,17),(bx+3,20),(bx+1,24),(bx-2,22)],'leather');c.p(bx,20,'iron')
    if kind=='complete_reaver_archer':
        xx=5 if d in ['down','left'] else 19
        if d in ['left','right'] and attack:
            xx=4 if d=='left' else 19
            bend=[1,2,3,1][phase]
            c.stroke([(xx,9),(xx+(-bend if d=='left' else bend),16),(xx,24)],'bark')
            c.line(xx,9,xx,24,'linen')
            c.line(xx,16,12,16,'bark');c.p(xx+(-1 if d=='left' else 1),16,'ironlight')
        else:
            c.stroke([(xx,12),(xx-2,17),(xx-1,23),(xx+1,26)],'bark');c.line(xx,12,xx+1,26,'linen')
    if kind=='withered_priest':
        xx,yy=hand
        yy=min(23,yy)
        c.line(xx,yy,xx-1,yy+3,'iron');c.p(xx-1,yy+2,'ironlight')
        c.poly([(xx-2,yy+3),(xx+1,yy+3),(xx+2,yy+5),(xx-1,yy+7),(xx-3,yy+5)],'brass');c.line(xx-2,yy+4,xx+1,yy+4,'ironlight');c.p(xx,yy+6,'earth')
    return c


def canine(kind,d,phase,attack):
    c=C(16,16);alpha=kind.endswith('alpha')
    g=([0,-1,1] if not attack else [0,-1,1,0])[phase]
    dip=1 if attack and phase in [1,3] else 0
    if d in ['left','right']:
        if d=='left':
            # A low loin and bent hocks differ from the old horizontal body block.
            c.stroke([(11,8),(13,7),(14,5),(13,4)],'furDark',2)
            c.line(5,10,4-g,13,'furDark');c.line(11,10,12+g,13,'furDark')
            c.poly([(4,8),(6,6-alpha),(9,7),(11,7),(13,9),(12,11),(8,11),(6,10)],'fur')
            c.line(6,7,8,8,'furLight');c.p(11,8,'worn');c.line(9,10,11,10,'furDark')
            c.poly([(3,5+dip),(4,4+dip),(5,6+dip),(6,8+dip),(4,10),(2,9),(1,8+dip)],'furLight')
            c.poly([(3,5+dip),(3,3+dip),(5,6+dip)],'furDark');c.p(2,7+dip,'ink');c.p(1,8+dip,'ink')
            c.line(6,10,5+g,12,'furDark');c.line(5+g,12,5+g,14,'fur');c.p(4+g,14,'ink')
            c.line(11,10,10-g,12,'furDark');c.line(10-g,12,11-g,14,'fur');c.p(12-g,14,'ink')
            if alpha:
                c.poly([(5,6),(6,4),(8,5),(7,8),(8,10),(5,11)],'furDark');c.line(6,5,6,8,'stone');c.p(6,9,'sore')
            if attack:
                c.p(2,9+dip,'ink')
                if phase==2:c.p(1,9,'paper');c.p(2,10,'rose');c.p(4,9,'skinshade')
                if phase==0:c.p(4,8,'furDark')
        else:
            c.stroke([(4,8),(2,7),(1,5),(2,4)],'furDark',2)
            c.line(10,10,11+g,13,'furDark');c.line(4,10,3-g,13,'furDark')
            c.poly([(11,8),(9,6-alpha),(6,7),(4,7),(2,9),(3,11),(7,11),(9,10)],'fur')
            c.line(4,8,6,8,'furLight');c.p(8,7,'worn');c.line(4,10,6,10,'furDark')
            c.poly([(12,5+dip),(11,4+dip),(10,6+dip),(9,8+dip),(11,10),(13,9),(14,8+dip)],'fur')
            c.poly([(12,5+dip),(12,3+dip),(10,6+dip)],'furDark');c.p(13,7+dip,'ink');c.p(14,8+dip,'ink');c.p(11,6+dip,'furLight')
            c.line(9,10,10-g,12,'furDark');c.line(10-g,12,10-g,14,'fur');c.p(11-g,14,'ink')
            c.line(4,10,5+g,12,'furDark');c.line(5+g,12,4+g,14,'fur');c.p(3+g,14,'ink')
            if alpha:
                c.poly([(10,6),(9,4),(7,5),(8,8),(7,10),(10,11)],'furDark');c.line(8,5,9,8,'stone');c.p(9,9,'sore')
            if attack:
                c.p(13,9+dip,'ink')
                if phase==2:c.p(14,9,'paper');c.p(13,10,'rose');c.p(11,9,'skinshade')
                if phase==0:c.p(11,8,'furLight')
    else:
        if d=='down':
            c.line(8,5,9+g,3,'furDark')
            c.poly([(6,6-alpha),(9,6-alpha),(11,9),(10,12),(6,12),(4,9)],'fur')
            c.line(6,7,6,9,'furLight');c.line(9,8,9,11,'furDark')
            for x,gg in [(6,g),(10,-g)]:c.line(x,10,x+gg,13,'furDark');c.p(x+gg,14-max(0,gg),'furLight')
            c.poly([(5,4+dip),(6,3+dip),(7,5+dip),(9,5+dip),(10,3+dip),(11,4+dip),(10,8+dip),(8,10),(6,8+dip)],'furDark' if alpha else 'fur')
            c.p(6,6+dip,'ink');c.p(10,6+dip,'ink');c.rect(7,7+dip,2,2,'furLight');c.rect(7,8+dip,2,1,'ink')
            if alpha:c.line(4,7,5,10,'furDark');c.line(11,7,12,10,'furDark');c.p(10,8+dip,'sore')
            if attack:
                c.p(8,9,'rose' if phase==2 else 'skinshade')
                if phase==2:c.p(7,9,'paper')
                if phase==1:c.p(5,8,'furLight')
        else:
            c.poly([(6,4),(7,2),(8,4),(9,3),(11,5),(10,8),(6,8),(5,6)],'furDark')
            c.poly([(6,7),(10,7),(11,10),(10,12),(7,13),(5,11)],'fur')
            c.line(6,8,7,10,'furLight');c.p(9,10,'worn')
            for x,gg in [(6,-g),(10,g)]:c.line(x,10,x+gg,13,'furDark');c.p(x+gg,14-max(0,gg),'furLight')
            c.stroke([(8,11),(8+g,13),(7+g,14)],'furDark')
            if alpha:c.poly([(5,5),(6,4),(10,4),(12,7),(10,9),(8,7),(5,9)],'furDark');c.p(6,6,'stone');c.p(10,7,'sore')
            if attack:
                c.p(5 if phase in [0,2] else 10,5+phase%2,'furLight')
                if phase==2:c.p(11,6,'paper');c.p(6,8,'furLight')
    return c


def rodent(d,phase,attack):
    c=C(16,16);g=([0,-1,1] if not attack else [0,-1,1,0])[phase]
    lift=1 if attack and phase==1 else 0
    if d=='left':
        c.stroke([(10,12),(13,13),(14,11+g),(13,8+g)],'rose')
        c.poly([(5,10),(7,8),(10,8),(12,10),(11,13),(6,13),(3,12),(2,11)],'hide')
        c.line(7,9,10,9,'worn');c.p(11,11,'bark');c.p(3,11,'ink');c.p(2,12,'rose')
        c.ellipse(4,8-lift,3,3,'rose','skinshade');c.p(4,9-lift,'skin');c.p(4,12,'paper')
        c.p(6+g,14,'skinshade');c.p(10-g,14,'rose');c.line(2,11,1,10,'worn')
        if attack:c.p(3,13-lift,'paper' if phase==2 else 'skinshade');c.p(7,12,'stone' if phase==3 else 'hide')
    elif d=='right':
        c.stroke([(5,12),(2,13),(1,11-g),(2,8-g)],'rose')
        c.poly([(10,10),(8,8),(5,8),(3,10),(4,13),(9,13),(12,12),(13,11)],'hide')
        c.line(5,9,8,9,'worn');c.p(4,11,'bark');c.p(12,11,'ink');c.p(13,12,'rose')
        c.ellipse(9,8-lift,3,3,'rose','skinshade');c.p(10,9-lift,'skin');c.p(11,12,'paper')
        c.p(9-g,14,'skinshade');c.p(5+g,14,'rose');c.line(13,11,14,10,'worn')
        if attack:c.p(12,13-lift,'paper' if phase==2 else 'skinshade');c.p(8,12,'stone' if phase==3 else 'hide')
    elif d=='down':
        c.stroke([(8,9),(10+g,7),(11+g,6)],'rose')
        c.ellipse(4,8,8,6,'hide','ink');c.p(5,10,'worn');c.p(10,12,'bark')
        c.ellipse(4,8-lift,3,3,'rose','skinshade');c.ellipse(9,8-lift,3,3,'rose','skinshade')
        c.poly([(6,10),(9,10),(10,12),(8,14),(6,13)],'hide');c.p(6,11,'ink');c.p(9,11,'ink');c.p(8,13,'rose')
        c.p(5+g,14,'rose');c.p(11-g,14,'skinshade')
        if attack:c.p(7,13 if phase!=2 else 14,'paper');c.p(9,12,'worn' if phase==3 else 'hide')
    else:
        c.ellipse(5,7-lift,3,3,'rose','skinshade');c.ellipse(9,7-lift,3,3,'rose','skinshade')
        c.poly([(6,8-lift),(9,8-lift),(11,11),(10,13),(6,13),(4,11)],'hide');c.line(6,10,7,11,'worn')
        c.p(4+g,12,'rose');c.p(11-g,12,'skinshade')
        c.stroke([(8,12),(8+g,14),(10+g,14)],'rose')
        if attack:c.p(10,9,'paper' if phase==2 else 'hide');c.p(6,9,'worn' if phase==3 else 'hide')
    return c


def worm(d,phase,attack):
    c=C(16,16)
    length=([0,-1,1] if not attack else [0,-1,2,1])[phase]
    if d=='left':path=[(12,12),(10,11),(8,11),(6,12),(4-length,12)]
    elif d=='right':path=[(3,12),(5,11),(7,11),(9,12),(11+length,12)]
    elif d=='down':path=[(8,7),(7,9),(7,11),(8,12+length)]
    else:path=[(8,13),(7,11),(7,9),(8,8-length)]
    if phase==1:path=[(x,y-1 if i in [1,2] else y) for i,(x,y) in enumerate(path)]
    for x,y in path:c.ellipse(x-1,y-1,3,3,'stone','shade')
    for a,b in zip(path,path[1:]):c.line(*a,*b,'worn')
    for x,y in path[1:-1]:c.p(x,y+1,'earth')
    x,y=path[-1];c.p(x,y,'skinshade');c.p(x,y-1,'flesh')
    if attack:
        c.p(x-1,y,'stone');c.p(x+1,y,'stone');c.p(x,y,'ink')
        if phase==3:c.p(path[1][0]-1,path[1][1],'clothlight')
    return c


def machine(d,phase,attack,w,h,inert=False):
    c=C(w,h,(w-32)//2,h-32)
    g=0 if inert else ([0,-1,1] if not attack else [0,-1,2,0])[phase]
    # Three leg pairs each have hip, elbow, ankle and foot, in front/back depth.
    if d in ['down','up']:
        roots=[(11,18),(10,21),(12,24),(21,18),(22,21),(20,24)]
        knees=[(7,17),(5,22),(8,26),(25,17),(27,22),(24,26)]
        feet=[(4,23),(3,28),(7,30),(28,23),(29,28),(25,30)]
    elif d=='left':
        roots=[(10,18),(15,17),(21,18),(10,23),(16,24),(22,23)]
        knees=[(7,16),(13,15),(25,18),(6,24),(15,27),(26,25)]
        feet=[(4,21),(11,20),(28,22),(4,29),(13,30),(28,29)]
    else:
        roots=[(11,18),(17,17),(22,18),(10,23),(16,24),(22,23)]
        knees=[(6,18),(19,15),(25,16),(6,25),(17,27),(26,24)]
        feet=[(3,22),(21,20),(28,21),(3,29),(19,30),(28,29)]
    for i,(root,knee,foot) in enumerate(zip(roots,knees,feet)):
        if inert:knee=(root[0]+(knee[0]-root[0])//2,knee[1]+3);foot=(root[0]+(foot[0]-root[0])//2,29)
        else:foot=(foot[0]+(g if i%2 else -g)//2,foot[1]-max(0,g if i%2 else -g))
        c.stroke([root,knee,foot],'ink',3);c.stroke([root,knee,foot],'ironshade',1)
        c.rect(knee[0]-1,knee[1]-1,3,3,'earth');c.p(*knee,'brass');c.p(foot[0],foot[1],'ironlight')
    yy=3 if inert else 0
    c.poly([(9,15+yy),(14,12+yy),(21,13+yy),(25,18+yy),(23,24+yy),(15,26+yy),(8,23+yy),(6,19+yy)],'ironshade')
    c.poly([(10,16+yy),(15,13+yy),(20,14+yy),(23,18+yy),(19,20+yy),(10,19+yy)],'iron')
    c.line(11,15+yy,16,14+yy,'ironlight');c.line(10,21+yy,20,23+yy,'earth')
    for x,y in [(10,18),(21,17),(10,22),(21,22)]:c.p(x,y+yy,'brass');c.p(x+1,y+yy,'rust')
    for x,high in [(13,7),(16,6),(19,8)]:
        c.rect(x,high+yy,2,8 if not inert else 6,'shade');c.line(x,high+yy,x,high+yy+6,'iron');c.p(x,high+yy,'ironlight')
    if d=='down':c.rect(12,21+yy,8,2,'shade');c.line(14,21+yy,18,21+yy,'worn')
    elif d=='up':c.rect(12,20+yy,8,4,'earth');c.line(13,21+yy,18,22+yy,'rust');c.p(15,23+yy,'brass')
    elif d=='left':c.rect(7,18+yy,3,3,'shade');c.p(7,19+yy,'worn')
    else:c.rect(23,18+yy,3,3,'shade');c.p(25,19+yy,'stone')
    if not inert:
        if d=='left':path=[(10,19),(6,18),(2 if attack and phase==2 else 4,15+g)]
        elif d=='right':path=[(22,19),(26,18),(30 if attack and phase==2 else 28,15+g)]
        elif d=='up':path=[(20,17),(23,13),(23+g,9)]
        else:path=[(12,22),(8,24),(7-g,27)]
        if attack and phase==3:path[-1]=(path[-1][0]+(1 if d in ['right','down'] else -1),path[-1][1]+1)
        c.stroke(path,'ink',3);c.stroke(path,'iron',1)
        x,y=path[-1];c.p(x-1,y-1,'brass');c.p(x+1,y+1,'ironlight')
        c.p(24,21,'rust');c.line(22,22,25,25,'earth')
    else:c.line(11,24+yy,15,27,'earth');c.p(14,27,'brass')
    return c


def large_head(c,x,y,d,turn=0):
    c.poly([(x-3,y+1),(x-1,y-1),(x+2,y),(x+4,y+3),(x+3,y+8),(x+1,y+11),(x-2,y+9),(x-4,y+5)],'flesh')
    c.line(x-2,y+1,x+1,y,'skin');c.line(x-3,y+3,x-2,y+6,'skin')
    c.rect(x-1,y+10,3,4,'skinshade')
    if d=='up':
        c.poly([(x-3,y+1),(x-1,y-1),(x+2,y),(x+4,y+3),(x+2,y+6),(x,y+4),(x-2,y+7),(x-4,y+4)],'hair')
        c.line(x-2,y+1,x,y,'earth');c.line(x+1,y+1,x+2,y+4,'earth')
    else:
        eye=x-2 if d=='left' else x+2 if d=='right' else x-1
        c.p(eye,y+4,'shade');c.p(eye+(2 if d=='down' else 0),y+4,'shade')
        c.p(x+(1 if d=='right' else -1),y+6,'skin');c.line(x-1,y+8,x+1,y+8,'skinshade')
        c.p(x+2,y+7,'sore');c.p(x-2,y+2,'worn')


def amalgam(d,phase,attack,w,h,legacy=False):
    c=C(w,h,(w-80)//2,h-64)
    g=([0,-1,1,-2,2,0] if legacy else [0,-1,1,0] if attack else [0,-1,1])[phase]
    if d=='left':heads=[(20,23),(33,10),(47,20)];s=-3
    elif d=='right':heads=[(32,21),(47,10),(59,23)];s=3
    elif d=='up':heads=[(23,18),(41,9),(57,18)];s=0
    else:heads=[(22,23),(40,9),(57,22)];s=0
    # Several rib cages remain separate; the lowest base has no legs/feet.
    c.poly([(13+s,39),(17+s,32),(27+s,30),(35+s,28),(48+s,31),(58+s,31),(67+s,39),(73+s,51),(70+s,57),(60+s,61),(49+s,62),(39+s,60),(27+s,62),(16+s,59),(8+s,55),(7+s,49)],'skinshade')
    c.poly([(12+s,43),(22+s,35),(34+s,34),(40+s,42),(49+s,35),(60+s,38),(67+s,48),(64+s,56),(49+s,58),(40+s,55),(29+s,59),(16+s,56),(10+s,52)],'flesh')
    c.line(16+s,43,21+s,39,'skin');c.line(20+s,54,31+s,55,'skin');c.line(49+s,53,61+s,53,'skin')
    c.line(25+s,59,32+s,57,'earth');c.line(39+s,59,48+s,60,'earth')
    c.poly([(19+s,34),(25+s,31),(31+s,36),(34+s,49),(28+s,56),(23+s,52),(20+s,43)],'cloth')
    c.line(23+s,35,26+s,46,'linen');c.line(24+s,48,29+s,52,'earth')
    c.poly([(48+s,32),(58+s,34),(64+s,45),(61+s,52),(57+s,49),(54+s,39)],'earth')
    c.line(52+s,35,56+s,44,'clothlight');c.p(60+s,45,'linen')
    c.poly([(32+s,23),(36+s,20),(46+s,21),(51+s,28),(49+s,42),(43+s,47),(35+s,42),(29+s,32)],'flesh')
    c.line(34+s,27,35+s,37,'skin');c.line(43+s,26,46+s,36,'skinshade')
    for x,y in [(35+s,29),(36+s,33),(36+s,37),(44+s,30),(44+s,34),(45+s,38)]:c.line(x,y,x+3,y+1,'worn')
    c.poly([(30+s,26),(34+s,23),(36+s,28),(35+s,41),(31+s,39)],'linen');c.line(31+s,28,32+s,36,'cloth')
    # Four human arms, each shoulder -> elbow -> wrist -> long fingers.
    reach=8 if attack and phase==2 else 3 if attack and phase==1 else 0
    if d=='left':
        arms=[((19,33),(9,39),(3,44-g)),((30,37),(18,48),(5,54)),((52,34),(61,43),(67,50)),((60,39),(68,48),(71,54))]
        if attack:arms[0]=((19,33),(10,28),(2,26+g));arms[1]=((30,37),(14,39),(1+max(0,3-reach),40))
    elif d=='right':
        arms=[((21,34),(13,43),(8,50)),((30,39),(21,49),(11,55)),((53,34),(64,38),(76,44+g)),((62,39),(69,48),(75,54))]
        if attack:arms[2]=((53,34),(67,29),(77,27+g));arms[3]=((62,39),(70,39),(78-max(0,3-reach),40))
    elif d=='up':
        arms=[((20,33),(10,40),(6,48+g)),((29,39),(22,48),(15,57)),((53,32),(64,39),(72,48-g)),((61,39),(67,48),(70,56))]
        if attack:arms[0]=((20,33),(10,25),(7,17+g));arms[2]=((53,32),(65,25),(70,14-g))
    else:
        arms=[((19,34),(11,43),(4,49+g)),((29,40),(21,49),(14,57-g)),((54,34),(64,42),(74,49-g)),((61,40),(68,49),(71,57+g))]
        if attack:arms[1]=((29,40),(19,46),(9,56+g));arms[3]=((61,40),(68,47),(75,56-g))
    for i,(shoulder,elbow,wrist) in enumerate(arms):
        if attack and phase==3:
            elbow=(elbow[0]+(1 if i%2 else -1),elbow[1]+1)
            wrist=(wrist[0]+(1 if i%2 else -1),wrist[1]+1)
        if not attack and not legacy:wrist=(wrist[0]+(g if i%2 else -g),wrist[1])
        if legacy:wrist=(wrist[0]+(g if i%2 else -g),wrist[1]-(phase%3))
        c.stroke([shoulder,elbow,wrist],'ink',5);c.stroke([shoulder,elbow,wrist],'flesh',3)
        c.line(shoulder[0]-1,shoulder[1],elbow[0]-1,elbow[1],'skin')
        c.p(elbow[0]+1,elbow[1]+1,'skinshade')
        for finger in [-1,0,1]:
            c.line(wrist[0]+finger,wrist[1],wrist[0]+finger+(1 if i%2 else -1),wrist[1]+2+abs(finger),'flesh')
            c.p(wrist[0]+finger,wrist[1]+2,'skinshade')
    for i,(x,y) in enumerate(heads):
        large_head(c,x+(g if i==1 else 0),y+(g if i==2 else 0),d)
    # Local pressure creases and rag edges, not random noise or a colour overlay.
    for x,y in [(18,51),(31,53),(37,48),(49,50),(59,55),(43,56)]:
        c.line(x,y,x+3,y+1,'skinshade');c.p(x+1,y-1,'worn')
    c.line(38,44,40,47,'sore');c.p(39,46,'blood');c.p(54,47,'sore')
    if legacy:c.p(47+phase,50+(phase%2),'linen');c.line(36,57,38+phase,57,'skinshade')
    return c


def png(c):
    raw=b''.join(b'\0'+bytes(v for col in row for v in P[col]) for row in c.pixels)
    def chunk(k,d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',c.w,c.h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')


def svg(c,label):
    # Exact native pixel-run source from the newly authored geometry, never a trace
    # of an input image. Every run is an integer rectangle with crisp edges.
    rows=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.w}" height="{c.h}" viewBox="0 0 {c.w} {c.h}" shape-rendering="crispEdges">',f'<title>ASHVEIL v303 original {label}</title>']
    for yy,row in enumerate(c.pixels):
        xx=0
        while xx<c.w:
            col=row[xx];end=xx+1
            while end<c.w and row[end]==col:end+=1
            if col!='.':rows.append(f'<rect x="{xx}" y="{yy}" width="{end-xx}" height="1" fill="#{COLORS[col][:6]}"/>')
            xx=end
    return ('\n'.join(rows+['</svg>',''])).encode()


def serial(v):return (json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode()
def save(path,data,check):
    if check:assert path.read_bytes()==data,f'regeneration mismatch: {path}'
    else:path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)


def draw(kind,d,phase,mode,w,h):
    attack=mode=='attack'
    if kind=='amalgam':return amalgam(d,phase,attack,w,h,mode=='legacy')
    if kind.startswith('tender_drone'):return machine(d,phase,attack,w,h,kind.endswith('inert'))
    if kind.startswith('ash_hound'):return canine(kind,d,phase,attack)
    if kind=='burrow_rat':return rodent(d,phase,attack)
    if kind=='murk_leech':return worm(d,phase,attack)
    return human(kind,d,phase,attack,w,h)


def construct(baseline):
    refs=set(n for ch in baseline['chars'].values() for mode in ['idle','walk','attack'] for ns in ch.get(mode,{}).values() for n in ns)
    refs.update(baseline['anims']['amalgam']['frames'])
    actor_sheets={baseline['frames'][n][0] for n in refs}
    frames={n:copy.deepcopy(v) for n,v in baseline['frames'].items() if v[0] in actor_sheets}
    assert len(actor_sheets)==52 and len(frames)==718
    sheets={s:C(max(f[1]+f[3] for f in frames.values() if f[0]==s),max(f[2]+f[4] for f in frames.values() if f[0]==s)) for s in actor_sheets}
    poses={};canonical={};seen={};frame_owner={}
    for kind,ch in baseline['chars'].items():
        identity=json.dumps({k:ch.get(k) for k in ['walk','idle','attack']},sort_keys=True)
        if identity in seen:canonical[kind]=seen[identity];continue
        seen[identity]=kind;canonical[kind]=kind
        for mode in ['walk','attack']:
            for d,ns in ch.get(mode,{}).items():
                for phase,name in enumerate(ns):
                    sheet,x,y,w,h=frames[name]
                    pose=draw(kind,d,phase,mode,w,h);assert (pose.w,pose.h)==(w,h)
                    sheets[sheet].blit(pose,x,y);poses[name]=pose;frame_owner[name]=kind
    for phase,name in enumerate(baseline['anims']['amalgam']['frames']):
        sheet,x,y,w,h=frames[name];pose=draw('amalgam','down',phase,'legacy',w,h)
        sheets[sheet].blit(pose,x,y);poses[name]=pose;frame_owner[name]='amalgam_legacy'
    # Static aliases intentionally reference the same freshly authored rectangle.
    for name,rect in frames.items():
        if name not in poses:
            same=next(n for n in poses if frames[n]==rect)
            poses[name]=poses[same];frame_owner[name]=frame_owner[same]
    fragment={'sheets':{s:f'sprites/original/direction-v303/creatures/{s}.png' for s in sorted(actor_sheets)},'frames':frames,'chars':copy.deepcopy(baseline['chars']),'anims':{'amalgam':copy.deepcopy(baseline['anims']['amalgam'])}}
    return fragment,sheets,poses,canonical,frame_owner


def contacts(baseline,poses,canonical):
    products={}
    for kind,target in canonical.items():
        if kind!=target:continue
        ch=baseline['chars'][kind]
        frame_names=set(n for mode in ['idle','walk','attack'] for ns in ch.get(mode,{}).values() for n in ns)
        maxw=max(poses[n].w for n in frame_names);maxh=max(poses[n].h for n in frame_names)
        scale=2 if maxw>40 else 3
        cellw=maxw*scale+12;cellh=maxh*scale+12
        contact=C(cellw*8,cellh*4,fill='BG')
        for row,d in enumerate(DIRS):
            seq=ch['idle'][d]+ch['walk'][d]+ch.get('attack',{}).get(d,[])
            for col,n in enumerate(seq):
                p=poses[n];contact.blit(p,col*cellw+(cellw-p.w*scale)//2,row*cellh+cellh-6-p.h*scale,scale)
        products[f'contacts/{kind}.png']=png(contact)
    legacy=C(96*2*3,64*2*2,fill='BG')
    for i,name in enumerate(baseline['anims']['amalgam']['frames']):legacy.blit(poses[name],(i%3)*192,(i//3)*128,2)
    products['contacts/amalgam_legacy.png']=png(legacy)
    # Native-scale line-up: subject proportions and role differences can be read
    # together without making a smaller creature artificially as tall as an adult.
    overview=C(13*64,2*120,fill='BG')
    for i,kind in enumerate(k for k,v in canonical.items() if k==v):
        name=baseline['chars'][kind]['idle']['down'][0];p=poses[name]
        sc=2 if p.w<=40 else 1
        overview.blit(p,(i%13)*64+(64-p.w*sc)//2,(i//13)*120+112-p.h*sc,sc)
    products['contacts/all-26-silhouettes.png']=png(overview)
    return products


def contract(baseline,fragment,sheets,poses,canonical,owners):
    assert fragment['chars']==baseline['chars']
    assert all(fragment['frames'][n]==baseline['frames'][n] for n in fragment['frames'])
    assert fragment['anims']['amalgam']==baseline['anims']['amalgam']
    assert all(P[col][3] in [0,255] for p in poses.values() for row in p.pixels for col in row)
    clipped={n:sorted(p.clipped) for n,p in poses.items() if p.clipped}
    assert not clipped,f'authored points exceed frame: {clipped}'
    rows=[]
    for kind,ch in fragment['chars'].items():
        frame_names=list(dict.fromkeys(n for mode in ['idle','walk','attack'] for ns in ch.get(mode,{}).values() for n in ns))
        unique=len(set(bytes(v for row in poses[n].pixels for col in row for v in P[col]) for n in frame_names))
        mode_unique={}
        for mode in ['walk','attack']:
            mode_unique[mode]={}
            for d,ns in ch.get(mode,{}).items():
                hashes=[hashlib.sha256(png(poses[n])).hexdigest() for n in ns]
                assert len(set(hashes))==len(hashes),f'duplicate {kind}/{mode}/{d}'
                mode_unique[mode][d]=len(set(hashes))
        rows.append({'char':kind,'canonicalGeometry':canonical[kind],'uniqueReferencedFrameKeys':len(frame_names),'uniquePixelPoses':unique,'sourceSheets':sorted(set(fragment['sheets'][fragment['frames'][n][0]] for n in frame_names)),'directionAndPoseCounts':{mode:{d:len(ns) for d,ns in ch.get(mode,{}).items()} for mode in ['walk','idle','attack']},'distinctModePoses':mode_unique,'metadataUnchanged':True,'contact':f'contacts/{canonical[kind]}.png','design':DESIGNS[canonical[kind]]})
    # Independent structural check of the PNGs emitted by our writer, including CRC.
    for sh,c in sheets.items():
        data=png(c);assert data[:8]==b'\x89PNG\r\n\x1a\n';at=8;terminal=0
        while at<len(data):
            n=struct.unpack('>I',data[at:at+4])[0];k=data[at+4:at+8];body=data[at+8:at+8+n]
            assert zlib.crc32(k+body)&0xffffffff==struct.unpack('>I',data[at+8+n:at+12+n])[0]
            at+=12+n
            if k==b'IEND':terminal+=1;assert n==0 and at==len(data)
        assert terminal==1
    for name,(sh,x,y,w,h) in fragment['frames'].items():
        s=sheets[sh];p=poses[name]
        assert x>=0 and y>=0 and x+w<=s.w and y+h<=s.h
        assert [row[x:x+w] for row in s.pixels[y:y+h]]==p.pixels,f'frame overlap or crop mismatch {name}'
    return {'result':'PASS','scope':'Actor resource contracts and exact regeneration only. No browser/GPU/Core/Full/World/Type/pnpm checks.','baselineSHA256':hashlib.sha256(BASE.read_bytes()).hexdigest(),'logicalActorSheets':52,'registeredActorFrameKeys':718,'charRegistrations':28,'uniqueCharacterGeometry':26,'charFrameKeysBeforeStaticAliases':704,'legacyAmalgamFrames':6,'sameRectangleStaticAliases':8,'allFrameArraysByteEquivalentToBaseline':True,'allCharDefinitionsByteEquivalentToBaseline':True,'allAnchorScaleAndDirectionContractsPreserved':True,'allIndividualWalkAndAttackCyclesHaveDistinctPoses':True,'PNGCRCAndSingleTerminalIEND':True,'RGBA8BinaryAlpha':True,'noInputImagesRead':True,'chars':rows,'frameOwners':owners,'sheets':[{'key':s,'path':fragment['sheets'][s],'size':[c.w,c.h],'frames':[n for n,r in fragment['frames'].items() if r[0]==s]} for s,c in sorted(sheets.items())]}


def independently_check_outputs(baseline,fragment,check):
    """Read only our emitted PNG/SVG for verification, never for authoring.

    Old PNG bytes are hashed for the replacement audit; they are never decoded,
    sampled, cropped, transformed, or fed to any drawing operation.
    """
    records=[]
    for key,url in fragment['sheets'].items():
        path=ROOT/'public'/url;data=path.read_bytes()
        assert data[:8]==b'\x89PNG\r\n\x1a\n';at=8;idata=b'';types=[]
        while at<len(data):
            n=int.from_bytes(data[at:at+4],'big');kind=data[at+4:at+8];body=data[at+8:at+8+n]
            assert zlib.crc32(kind+body)&0xffffffff==int.from_bytes(data[at+8+n:at+12+n],'big')
            types.append(kind);at+=n+12
            if kind==b'IHDR':
                w,h,depth,color,comp,filt,inter=struct.unpack('>IIBBBBB',body)
                assert (depth,color,comp,filt,inter)==(8,6,0,0,0)
            if kind==b'IDAT':idata+=body
            if kind==b'IEND':assert n==0 and at==len(data)
        assert types[0]==b'IHDR' and types[-1]==b'IEND' and types.count(b'IEND')==1
        raw=zlib.decompress(idata);assert len(raw)==h*(w*4+1)
        rgba=[]
        for y in range(h):
            row=raw[y*(w*4+1):(y+1)*(w*4+1)];assert row[0]==0
            rgba.extend(tuple(row[i:i+4]) for i in range(1,len(row),4))
        assert set(p[3] for p in rgba)<=set([0,255])
        vector=ET.parse(path.with_suffix('.svg')).getroot()
        assert (int(vector.attrib['width']),int(vector.attrib['height']))==(w,h)
        svg_pixels=[(0,0,0,0)]*(w*h)
        for rect in vector:
            if not rect.tag.endswith('rect'):continue
            x,y,rw,rh=(int(rect.attrib[k]) for k in ['x','y','width','height'])
            assert rh==1 and 0<=x<x+rw<=w and 0<=y<h
            color=(*bytes.fromhex(rect.attrib['fill'][1:]),255)
            for xx in range(x,x+rw):svg_pixels[y*w+xx]=color
        assert rgba==svg_pixels
        oldsha=hashlib.sha256((ROOT/'public'/baseline['sheets'][key]).read_bytes()).hexdigest()
        sha=hashlib.sha256(data).hexdigest();assert sha!=oldsha
        records.append({'key':key,'path':url,'size':[w,h],'sha256':sha,'baselineSHA256':oldsha,'differentFromBaseline':True,'SVGPixelExact':True})
    report={'result':'PASS','scope':'Independent small output-PNG/SVG and baseline contract only; no engine/browser/GPU tests','sheets':52,'frames':718,'chars':28,'distinctGeometry':26,'all52HashesChanged':True,'all52SVGExactNativePixels':True,'PNGCRCAndSingleIEND':True,'RGBA8BinaryAlpha':True,'framesAndCharsUnchanged':True,'records':records}
    save(OUT/'independent-check.json',serial(report),check)


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');args=ap.parse_args()
    baseline=json.loads(BASE.read_text())
    fragment,sheets,poses,canonical,owners=construct(baseline)
    report=contract(baseline,fragment,sheets,poses,canonical,owners)
    products={}
    for key,c in sorted(sheets.items()):products[key+'.png']=png(c);products[key+'.svg']=svg(c,key)
    products.update(contacts(baseline,poses,canonical))
    for name,data in products.items():save(OUT/name,data,args.check)
    save(HERE/'creatures.fragment.json',serial(fragment),args.check)
    save(OUT/'coverage.json',serial(report),args.check)
    independently_check_outputs(baseline,fragment,args.check)
    source={'license':'CC0-1.0','method':'New authored integer-coordinate pixel geometry, new silhouettes and per-role garment cuts. Exact native pixel-run SVG sources. No existing PNG, external asset, image filter, extraction, recolouring, tracing, or image sampling is used.','externalImageInputs':[],'existingImageInputs':[],'generator':'tools/art/direction-v303/draw-creatures.py','generatorSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'baselineSHA256':hashlib.sha256(BASE.read_bytes()).hexdigest(),'referenceUse':'12 official Steam images opened for visual analysis only, never loaded by generator. See tools/art/direction-v303/references.json.','palette':COLORS,'contacts':{'rows':DIRS,'columns':['idle','walk0','walk1','walk2','attack0','attack1','attack2','attack3'],'inert':'idle and the same four directional walk/static references; no attack'},'preservedAliases':{k:v for k,v in canonical.items() if k!=v},'files':[{'path':n,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()} for n,b in products.items()]}
    save(OUT/'source.json',serial(source),args.check)
    print(json.dumps({'result':'PASS','check':args.check,'sheets':len(sheets),'frames':len(fragment['frames']),'chars':len(fragment['chars']),'uniqueGeometry':len(set(canonical.values())),'PNGSources':len(sheets),'SVG':len(sheets),'contacts':len([n for n in products if n.startswith('contacts/')])}))


if __name__=='__main__':main()
