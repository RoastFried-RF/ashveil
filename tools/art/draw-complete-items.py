#!/usr/bin/env python3
"""ASHVEIL v302: directly authored 32px item and ability originals.

No image inputs are used to draw the art. All shapes below are authored on an
integer pixel canvas. SVG files contain the same explicit opaque pixel runs.
Existing originals are surveyed and retained; this script never reads their PNGs.
Run from any directory: python3 tools/art/draw-complete-items.py [--check]
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import struct
import zlib
from pathlib import Path
from xml.sax.saxutils import escape
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/sprites/original/complete/items'
ART = ROOT / 'tools/art'
PALETTE = {
    'ink': '#182125', 'dark': '#293435', 'deep': '#354744',
    'teal': '#516b65', 'sage': '#81968a', 'light': '#b1beb0',
    'iron': '#57656a', 'steel': '#849697', 'edge': '#bdccc0',
    'rust': '#76513c', 'rustlight': '#ac7952',
    'wooddark': '#3b302b', 'wood': '#70503c', 'grain': '#a17b52',
    'leather': '#84613f', 'leatherlight': '#b19361',
    'clothdark': '#6c6b58', 'cloth': '#a4a087', 'ivory': '#d5ceb0',
    'brassdark': '#66583c', 'brass': '#9e8954', 'brasslight': '#cab573',
    'leafdark': '#364537', 'leaf': '#64734b', 'leaflight': '#9b9f67',
    'reddark': '#4f3033', 'red': '#89504b', 'redlight': '#b47766',
    'bone': '#b9b69a', 'white': '#e2dcc3', 'amber': '#d4a357',
}

# The final survey found three semantic-sharing groups among existing original
# images. Keep Arrow/WaterBottle/PillWhite themselves, and author these five Defs
# separately so no different Item definitions retain a shared icon binding.
SPLIT_ORIGINAL_ITEMS={
    'Item.Bolt':'Short heavy crossbow bolt, distinct from the long arrow bundle.',
    'Item.WaterPill':'Known water-purification tablet, distinct from unidentified white pills.',
    'Item.DirtyWaterBottle':'Cloudy contents in the water vessel, with visible settled sediment.',
    'Item.PineTeaBottle':'Pine tea in its water vessel, with a pine-needle label motif.',
    'Item.CharcoalFilter':'Portable filter with separate charcoal and sand layers, not a bottle silhouette.',
}


def preserve_original(consumer):
    # All 28 abilities receive their own action diagram; old weapon/pill art
    # remains in place for actual items and other legacy consumers.
    return not consumer['id'].startswith('Ab.') and consumer['id'] not in SPLIT_ORIGINAL_ITEMS and all(b['original'] for b in consumer['bindings'])


class Canvas:
    def __init__(self):
        self.im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
    def c(self, c):
        return PALETTE.get(c, c)
    def rect(self, box, c, outline=None):
        self.d.rectangle(box, fill=self.c(c), outline=self.c(outline) if outline else None)
    def poly(self, pts, c, outline='ink'):
        self.d.polygon(pts, fill=self.c(c), outline=self.c(outline) if outline else None)
    def line(self, pts, c, width=1):
        self.d.line(pts, fill=self.c(c), width=width)
    def ell(self, box, c, outline='ink'):
        self.d.ellipse(box, fill=self.c(c), outline=self.c(outline) if outline else None)
    def dot(self, x, y, c):
        self.d.point((x, y), self.c(c))


def stitch(c, x, y, n=5, horizontal=False, color='ivory'):
    for k in range(n):
        if horizontal: c.line([(x+k*3,y),(x+k*3,y+1)],color)
        else: c.line([(x,y+k*3),(x+1,y+k*3)],color)


def leaf(c, x=16, y=18, color='leaf', kind='leaf'):
    if kind == 'pine':
        c.line([(x-8,y+7),(x+7,y-8)],'wood',2)
        for dx,dy in [(-5,3),(-2,0),(1,-3),(4,-6)]:
            c.line([(x+dx,y+dy),(x+dx-6,y+dy-2)],color)
            c.line([(x+dx,y+dy),(x+dx+2,y+dy+5)],'leaflight')
    else:
        c.poly([(x-7,y+4),(x-8,y-2),(x-5,y-8),(x+3,y-10),(x+6,y-4),(x+4,y+3),(x-1,y+5)],color)
        c.line([(x-4,y+7),(x+2,y-7)],'leaflight')
        c.line([(x-2,y+2),(x-6,y-2)],'leafdark')
        c.line([(x,y-2),(x+4,y-4)],'leafdark')


def bone(c, x=6, y=23, endx=25, endy=8, color='bone', broken=False):
    c.line([(x,y),(endx,endy)],'ink',6)
    c.line([(x,y),(endx,endy)],color,3)
    for ax,ay in [(x,y),(endx,endy)]:
        c.ell((ax-3,ay-3,ax+1,ay+1),color)
        c.ell((ax,ay,ax+3,ay+3),color)
    if broken:
        c.line([(14,14),(13,17),(17,17),(16,20)],'ink',2)


def dagger(c, variant='hunting'):
    if variant == 'bone':
        c.poly([(11,23),(15,13),(25,4),(24,13),(17,23)],'bone')
        c.line([(16,18),(23,8)],'white')
        c.line([(18,14),(21,15)],'clothdark')
    elif variant == 'custom':
        c.poly([(10,22),(18,9),(26,5),(24,14),(15,24)],'iron')
        c.poly([(18,10),(25,6),(21,15),(14,22)],'edge',None)
        c.rect((15,16,18,18),'brassdark')
    elif variant == 'steel':
        c.poly([(11,22),(21,6),(27,3),(25,11),(16,23)],'steel')
        c.line([(14,21),(25,5)],'edge',2)
        c.line([(19,10),(22,11)],'iron')
    else:
        c.poly([(10,22),(20,7),(26,5),(23,13),(15,24)],'iron')
        c.line([(13,21),(23,8)],'steel',2)
        c.rect((20,11,21,13),'rust')
    c.line([(9,22),(15,26)],'ink',4)
    c.line([(9,22),(15,26)],'brass',2)
    c.line([(7,28),(12,22)],'ink',5)
    c.line([(7,27),(11,23)],'wood',3)
    c.line([(8,26),(10,27)],'leatherlight')
    c.dot(6,28,'brass')


def axe(c, variant='custom'):
    c.line([(9,28),(21,7)],'ink',5)
    c.line([(9,27),(20,8)],'wood',3)
    c.line([(10,25),(18,10)],'grain')
    shapes = {
        'steel': [(17,7),(24,4),(29,9),(27,16),(22,17),(19,12)],
        'flint': [(16,8),(21,4),(27,7),(28,12),(25,18),(20,15),(18,12)],
        'alloy': [(16,7),(26,6),(29,10),(28,16),(23,19),(19,13)],
        'custom':[(16,8),(24,5),(28,8),(28,14),(23,17),(19,13)],
    }
    fill={'steel':'steel','flint':'clothdark','alloy':'deep','custom':'iron'}[variant]
    c.poly(shapes[variant],fill)
    if variant == 'flint':
        c.poly([(22,6),(26,8),(23,12),(20,10)],'light',None)
        c.line([(23,14),(25,17),(27,12)],'bone')
        c.line([(16,10),(20,12)],'cloth',2)
        c.line([(17,8),(20,10)],'cloth')
    else:
        c.line([(27,9),(26,14),(23,16)],'edge',2)
        c.rect((20,9,21,11),'brass' if variant == 'custom' else 'ink')
        if variant == 'alloy': c.line([(22,8),(25,10),(22,13)],'sage')
    c.line([(9,22),(12,24)],'clothdark',2)


def shirt(c, kind):
    coat=kind in ['coat','custom_coat','wolf_coat']
    chain=kind in ['mail','custom_mail','iron_mail','steel_mail']
    base = 'leather' if coat else ('iron' if chain else 'cloth')
    if kind in ['wool_shirt','wool_gloves']: base='bone'
    if kind == 'oil_shirt': base='teal'
    if kind == 'padded': base='deep'
    bottom=29 if coat else 26
    pts=[(10,5),(13,7),(18,7),(21,5),(27,9),(29,17),(23,19),(22,15),(23,bottom),(8,bottom),(9,15),(7,19),(2,16),(5,9)]
    c.poly(pts,base)
    shade='wood' if coat else ('deep' if chain else 'clothdark')
    c.poly([(19,9),(22,13),(21,bottom-1),(16,bottom-1),(17,13)],shade,None)
    c.line([(6,10),(4,15),(6,16)],'steel' if chain else ('leatherlight' if coat else 'ivory'))
    c.poly([(11,6),(15,9),(12,12),(9,7)],'clothdark' if not coat else 'wood')
    c.poly([(20,6),(16,9),(19,12),(22,7)],'ivory' if kind=='wolf_coat' else shade)
    c.line([(15,10),(15,bottom-1)],'ink')
    if chain:
        step = 3 if kind in ['steel_mail','iron_mail'] else 4
        for y in range(12,25,step):
            for x in range(10,22,step):
                c.ell((x,y,x+2,y+2),'dark', 'edge' if kind=='steel_mail' else 'steel')
        if kind=='mail':
            c.rect((7,12,10,15),'rust', 'ink');c.rect((19,23,22,26),'rust','ink')
        if kind=='iron_mail': c.line([(9,25),(21,25)],'rust')
        if kind=='custom_mail': stitch(c,11,10,4,True,'brass')
    elif kind=='padded':
        for y in [13,18,23]:c.line([(9,y),(22,y)],'sage')
        for x in [11,17,21]:c.line([(x,12),(x,25)],'teal')
        c.rect((16,18,19,21),'clothdark','ink')
    elif kind=='rag':
        c.poly([(8,24),(10,22),(12,27),(14,24),(17,27),(21,25),(22,26)],'cloth')
        c.rect((10,16,13,20),'teal','ink');stitch(c,10,16,2)
        c.line([(20,11),(21,14)],'ink',2)
        c.line([(17,25),(18,28)],'ink',2)
    elif kind=='custom_shirt':
        c.rect((9,13,14,20),'clothdark');c.rect((17,18,21,24),'teal')
        stitch(c,14,12,5);stitch(c,17,17,2,True)
    elif kind=='wool_shirt':
        for y in [13,17,21,25]:
            c.line([(10,y),(12,y-1),(14,y),(16,y-1),(18,y),(21,y-1)],'clothdark')
        c.rect((3,14,7,17),'clothdark');c.rect((24,15,28,18),'clothdark')
    elif kind=='oil_shirt':
        c.line([(10,13),(10,23)],'sage',2);c.line([(17,9),(20,12)],'sage')
        c.rect((17,18,20,20),'deep','ink')
    elif coat:
        c.line([(8,21),(22,21)],'wooddark',2);c.rect((14,20,17,22),'brass','ink')
        c.rect((10,23,12,25),'wood');c.rect((18,23,20,25),'wood')
        if kind=='wolf_coat':
            c.poly([(7,9),(10,5),(13,8),(15,6),(17,9),(21,5),(25,9),(22,13),(19,11),(17,13),(15,10),(12,13)],'bone')
            c.line([(10,27),(12,26),(14,28),(17,27),(20,28)],'clothdark')
        if kind=='custom_coat':
            c.rect((10,14,13,19),'teal');stitch(c,10,14,2);stitch(c,19,23,2)
    else:
        for y in [13,17,21]:c.dot(16,y,'brassdark')


def book(c, kind):
    thin = kind in ['note','map','ledger','chimney']
    if thin:
        if kind == 'chimney': pts=[(7,4),(22,5),(22,11),(25,13),(22,16),(25,19),(22,22),(23,28),(6,27)]
        elif kind == 'ledger':pts=[(5,7),(23,5),(27,11),(25,26),(7,28),(8,22),(4,20)]
        elif kind == 'map':pts=[(5,7),(12,5),(19,7),(26,4),(27,24),(20,27),(12,25),(5,28)]
        else:pts=[(7,4),(23,4),(27,8),(25,27),(6,27)]
        c.poly(pts,'cloth');c.line([(8,7),(22,7)],'ivory')
        if kind=='map':
            c.line([(12,7),(12,24)],'clothdark');c.line([(20,8),(20,24)],'clothdark')
            c.line([(8,21),(10,19),(16,20),(18,14),(23,13)],'rust',2)
            for x,y in [(9,12),(15,16),(23,9)]:c.rect((x,y,x+2,y+2),'deep')
        elif kind=='ledger':
            c.line([(12,10),(12,24)],'rust');c.line([(19,9),(19,24)],'clothdark')
            for y in [11,15,19,23]: c.line([(8,y),(23,y)],'wood')
        elif kind=='chimney':
            c.rect((10,11,15,23),'deep');c.line([(11,10),(11,8),(17,8)],'iron',2)
            c.line([(19,11),(21,12),(20,15)],'wood')
        else:
            for y,n in [(11,11),(15,13),(19,8),(23,12)]:c.line([(9,y),(9+n,y)],'wood')
        return
    color = {'medical':'leafdark','firstaid':'red','ward':'deep','survival':'wood','alphabet':'clothdark','dictionary':'wooddark','pharma':'teal','pill':'brassdark','bestiary':'leather','material':'iron','craft':'wood','seed':'leafdark','signal':'deep','salt':'teal','boat':'wood','journal':'reddark'}.get(kind,'deep')
    thick = kind in ['dictionary','pharma','bestiary']
    c.poly([(5,6),(23,3),(27,6),(27,27),(9,29),(5,26)],color)
    c.poly([(9,25),(25,22),(25,26),(10,28)],'cloth')
    c.line([(10,26),(23,24)],'ivory')
    c.poly([(5,6),(9,8),(9,25),(5,26)],'ink')
    c.line([(11,9),(23,7)],'clothdark')
    if thick:c.line([(27,8),(27,25)],'brass')
    if kind=='medical':
        c.poly([(11,19),(23,17),(21,23),(15,24)],'bone')
        c.line([(16,18),(13,12)],'wood',3)
        c.line([(21,17),(21,11),(24,9)],'leaflight',2)
        c.line([(20,13),(17,11)],'leaflight')
    elif kind=='survival':
        c.line([(12,22),(21,11)],'grain',2);c.line([(12,13),(22,21)],'ivory',2)
        c.poly([(14,14),(15,10),(18,9),(19,12),(17,15)],'leaflight')
    elif kind=='seed':
        c.line([(12,23),(23,21)],'brassdark',2)
        c.line([(18,21),(17,14)],'sage',2)
        c.poly([(16,17),(12,14),(12,11),(16,12),(18,15)],'leaflight')
        c.poly([(18,16),(19,11),(23,10),(23,14)],'sage')
        c.ell((12,20,15,23),'brass')
    elif kind=='firstaid':
        c.rect((16,11,19,22),'ivory');c.rect((12,15,23,18),'ivory')
    elif kind=='ward':
        c.line([(12,13),(12,23)],'brass',2);c.line([(12,20),(24,18)],'brass',2)
        c.line([(23,17),(23,22)],'brass',2);c.ell((13,13,17,17),'ivory')
        c.poly([(17,15),(22,14),(23,17),(18,19)],'cloth')
    elif kind=='alphabet':
        c.line([(12,21),(16,11),(20,20)],'ivory',2);c.line([(14,17),(19,16)],'ivory')
        c.line([(23,11),(23,20)],'brass')
    elif kind=='dictionary':
        c.line([(12,12),(15,11),(15,21),(12,22)],'ivory',2)
        c.line([(19,10),(22,10),(22,20),(19,21)],'brass',2)
    elif kind=='pharma':
        c.ell((12,13,21,19),'ivory');c.line([(16,13),(17,19)],'teal',2)
        c.rect((17,21,23,22),'brass')
    elif kind=='pill':
        c.ell((12,13,18,19),'ivory');c.line([(13,16),(17,16)],'clothdark')
        c.ell((19,18,24,23),'brasslight');c.line([(21,19),(22,22)],'brassdark')
    elif kind=='bestiary':
        c.poly([(12,13),(13,9),(17,12),(21,10),(23,16),(19,21),(14,19)],'bone')
        c.dot(20,15,'ink');c.line([(13,22),(22,23)],'clothdark')
    elif kind=='material':
        c.poly([(12,12),(17,10),(20,13),(15,16)],'steel');c.line([(12,20),(22,15)],'grain',3)
        stitch(c,13,20,3,True)
    elif kind=='craft':
        c.line([(13,23),(22,11)],'grain',3);c.poly([(16,12),(20,9),(25,12),(22,16)],'steel')
    elif kind=='signal':
        c.line([(12,21),(23,12)],'brass',2);c.line([(16,18),(16,12),(20,10)],'sage')
        c.ell((21,18,24,21),'edge')
    elif kind=='salt':
        c.poly([(12,21),(16,13),(22,20)],'ivory');c.line([(11,24),(17,23),(22,24)],'sage')
    elif kind=='boat':
        c.poly([(11,18),(24,16),(21,23),(15,24)],'cloth');c.line([(15,17),(14,12),(20,14),(22,17)],'grain')
    elif kind=='journal':
        c.rect((13,12,23,18),'cloth');c.line([(15,14),(21,14)],'wood');c.line([(14,16),(19,16)],'wood')
        c.line([(20,4),(20,10)],'leatherlight',2)


def meat(c, kind):
    raw=kind in ['raw','rat_raw']
    rat=kind in ['rat_raw','rat_cooked']
    if kind in ['jerky','dried','salted']:
        for i,(x,y) in enumerate([(4,7),(11,4),(18,8)]):
            pts=[(x,y),(x+7,y+2),(x+5,y+19),(x+1,y+20),(x-1,y+12)]
            c.poly(pts,'wood' if kind=='jerky' else ('reddark' if kind=='dried' else 'red'))
            c.line([(x+2,y+4),(x+1,y+14),(x+3,y+17)],'redlight' if kind=='dried' else 'leather')
            if kind=='salted':
                for xx,yy in [(x+2,y+5),(x+4,y+10),(x+2,y+15)]:c.rect((xx,yy,xx+1,yy+1),'ivory')
        if kind=='jerky':c.line([(4,11),(25,14)],'clothdark',2)
        return
    if rat:
        c.poly([(5,17),(8,9),(16,7),(22,10),(27,19),(24,25),(14,27),(6,23)],'red' if raw else 'wood')
        c.poly([(13,10),(20,11),(23,17),(18,20),(10,18)],'redlight' if raw else 'rustlight',None)
        c.line([(7,23),(5,27),(10,28)],'bone',2)
    else:
        c.poly([(4,13),(9,6),(18,5),(27,12),(28,22),(22,27),(10,26),(4,22)],'red' if raw else ('wood' if kind=='smoked' else 'rust'))
        c.poly([(7,13),(11,9),(18,8),(23,12),(23,16),(17,16),(13,22),(8,21)],'redlight' if raw else 'leather',None)
        c.line([(6,22),(13,24),(19,21),(24,22)],'bone' if raw else 'wooddark',2)
        if kind=='smoked':
            for x in [10,16,22]:c.line([(x,12),(x-2,19)],'wooddark',2)
            c.line([(10,4),(12,2)],'iron');c.line([(17,3),(18,1)],'iron')
        if kind=='roast':
            for x in [9,15,21]:c.line([(x,10),(x+5,16)],'wooddark',2)


def tin(c, kind):
    opened=kind=='opened';empty=kind=='empty'
    c.rect((6,10,25,25),'iron','ink')
    c.ell((6,20,25,29),'iron');c.rect((7,11,24,24),'iron')
    c.rect((8,14,23,23),'clothdark');c.line([(9,15),(9,22)],'cloth')
    c.line([(25,13),(25,24)],'rust',2)
    if opened or empty:
        c.ell((6,6,25,15),'ink','steel');c.ell((9,9,22,13),'reddark' if opened else 'dark',None)
        if opened:
            c.poly([(8,8),(8,3),(17,2),(24,7),(20,9)],'steel');c.line([(10,4),(18,4),(22,7)],'edge')
            c.rect((13,10,17,11),'red')
        else:
            c.line([(11,11),(21,11)],'iron')
            c.poly([(20,8),(28,4),(29,10),(25,14)],'steel')
    else:
        c.ell((6,5,25,13),'steel');c.ell((9,7,22,11),'iron','edge');c.line([(11,8),(21,8)],'steel')
        c.poly([(13,17),(20,17),(19,21),(13,21)],'red')
    c.line([(8,26),(22,27)],'steel')


def ration(c, kind):
    pts=[(5,6),(24,5),(27,24),(22,28),(5,27),(3,12)]
    if kind=='empty':pts=[(3,11),(9,6),(14,10),(24,7),(28,21),(21,25),(14,22),(5,27),(7,19)]
    c.poly(pts,'teal' if kind!='empty' else 'clothdark')
    c.line([(6,8),(23,7)],'brass');c.line([(7,25),(24,24)],'ink')
    if kind=='sealed':
        c.rect((8,12,22,21),'cloth');c.line([(11,15),(19,15)],'deep',2);c.line([(12,18),(19,18)],'wood')
        c.line([(4,11),(6,22)],'sage')
    elif kind=='opened':
        c.poly([(4,6),(9,9),(13,6),(16,9),(22,6),(26,10)],'ink')
        c.poly([(8,10),(23,10),(21,15),(10,14)],'wood');c.rect((10,16,21,22),'cloth')
        c.line([(13,18),(19,18)],'deep',2)
    else:
        c.line([(8,11),(13,15),(10,23)],'ink');c.line([(18,11),(19,17),(24,21)],'ivory')
        c.rect((14,14,17,18),'cloth')


def bottle(c, kind):
    # Vessel shapes identify the item; colours are art materials, not quality or effect codes.
    if kind=='serum':
        c.rect((12,3,19,7),'brass','ink');c.rect((11,8,20,23),'steel','ink')
        c.rect((13,10,17,21),'light');c.rect((10,22,21,25),'brassdark','ink')
        c.line([(15,26),(15,30)],'edge');c.line([(18,11),(18,19)],'iron')
        c.rect((13,13,16,16),'deep');return
    if kind=='oil':
        c.poly([(8,11),(23,11),(26,27),(5,27)],'brassdark')
        c.rect((11,5,19,11),'brass','ink');c.line([(18,7),(25,5),(27,8)],'iron',3)
        c.line([(8,15),(9,24)],'brass');c.ell((13,16,20,23),'wooddark')
        c.line([(15,20),(17,17),(19,20)],'amber');return
    neck=14 if kind=='poppy' else 12
    c.rect((neck,3,neck+6,7),'wood','ink')
    body=[(neck,7),(neck+6,7),(neck+6,11),(24,15),(25,26),(22,29),(8,29),(6,26),(7,15),(neck,11)]
    if kind=='willow':body=[(12,7),(19,7),(19,11),(23,14),(23,27),(21,29),(10,29),(8,26),(8,14),(12,11)]
    c.poly(body,'deep' if kind=='moonshine' else ('teal' if kind=='willow' else 'wooddark'))
    c.line([(10,16),(9,24),(11,26)],'sage')
    c.rect((12,16,22,24),'clothdark' if kind=='moonshine' else 'cloth','ink')
    if kind=='willow':c.line([(15,23),(18,18)],'wood',2);c.line([(17,21),(20,20)],'wood')
    elif kind=='poppy':
        c.ell((15,18,20,21),'red');c.dot(17,19,'ink');c.line([(17,21),(17,23)],'leaf')
    else:c.line([(14,19),(20,20)],'wood',2)


def gloves(c, wool=False):
    for shift in [0,13]:
        c.poly([(4+shift,25),(3+shift,18),(1+shift,15),(2+shift,11),(5+shift,15),(5+shift,7),(7+shift,6),(8+shift,10),(8+shift,5),(10+shift,5),(11+shift,15),(13+shift,18),(12+shift,26)],'bone' if wool else 'leather')
        c.rect((4+shift,23,12+shift,28),'clothdark' if wool else 'wood','ink')
        c.line([(7+shift,10),(7+shift,17)],'ivory' if wool else 'leatherlight')
        if wool:
            for y in [18,21]:c.line([(5+shift,y),(7+shift,y-1),(9+shift,y)],'clothdark')
        else:stitch(c,9+shift,18,2)


def maneuver_shove(c):
    """HUD's basic shove, authored separately from the weapon-tree ability."""
    c.ell((1,1,30,30),'dark','deep')
    c.poly([(3,20),(8,19),(11,16),(12,9),(14,8),(15,16),(16,7),(18,7),(18,16),(20,9),(22,10),(21,18),(23,14),(25,15),(22,23),(17,27),(10,27),(7,24),(3,24)],'bone')
    c.line([(10,20),(16,18),(19,20)],'clothdark')
    c.line([(24,6),(29,6)],'sage',2);c.poly([(27,3),(31,6),(27,9)],'sage')
    c.line([(24,26),(29,26)],'sage',2);c.poly([(27,23),(31,26),(27,29)],'sage')


def tool(c, kind):
    if kind=='bolt':
        # Short, thick shafts; compact metal points and short rigid tail vanes.
        c.line([(6,23),(19,10)],'ink',5);c.line([(6,23),(19,10)],'wood',3)
        c.poly([(16,10),(21,5),(23,12),(20,15)],'iron')
        c.line([(5,21),(3,19),(5,25),(10,26),(8,23)],'clothdark',2)
        c.line([(11,27),(24,14)],'ink',6);c.line([(11,27),(24,14)],'wood',4)
        c.line([(13,24),(23,14)],'grain')
        c.poly([(20,13),(27,6),(29,15),(25,19)],'iron')
        c.poly([(26,8),(27,14),(24,16)],'steel',None)
        c.line([(22,13),(26,17)],'edge')
        c.poly([(9,25),(6,23),(8,29),(13,30),(12,27)],'sage')
        c.line([(9,25),(12,28)],'clothdark');return
    if kind=='pole':
        c.line([(4,29),(27,3)],'ink',5);c.line([(4,28),(27,3)],'wood',3);c.line([(7,24),(24,5)],'grain')
        c.line([(5,24),(8,26)],'clothdark',2);c.rect((24,3,27,5),'wooddark');return
    if kind=='crossbow':
        c.line([(7,27),(24,8)],'ink',6);c.line([(7,26),(23,8)],'wood',4);c.line([(10,23),(22,10)],'grain')
        c.line([(8,7),(12,6),(18,8),(25,15),(26,20)],'ink',4)
        c.line([(8,7),(12,7),(18,9),(24,15),(25,20)],'wood',2)
        c.line([(8,8),(18,18),(25,20)],'cloth')
        c.line([(14,20),(22,10)],'steel');c.rect((10,23,13,25),'iron');return
    if kind in ['stone_hammer','iron_hammer']:
        c.line([(8,28),(20,9)],'ink',5);c.line([(8,27),(19,10)],'wood',3);c.line([(10,24),(17,12)],'grain')
        c.poly([(10,10),(15,4),(26,9),(27,13),(22,18),(17,16)],'clothdark' if kind=='stone_hammer' else 'iron')
        c.poly([(14,8),(16,6),(24,10),(22,12)],'light' if kind=='stone_hammer' else 'steel',None)
        if kind=='stone_hammer':c.line([(16,10),(21,13)],'cloth',2);c.line([(14,12),(19,15)],'wooddark',2)
        else:c.line([(23,10),(25,12),(23,15)],'edge')
        return
    if kind=='tongs':
        c.line([(7,28),(17,14),(17,7),(14,3)],'ink',5);c.line([(7,28),(17,14),(17,7),(14,3)],'iron',3)
        c.line([(14,29),(15,15),(22,11),(26,4)],'ink',5);c.line([(14,29),(15,15),(22,11),(26,4)],'steel',2)
        c.ell((14,12,19,17),'brassdark');c.dot(16,14,'edge');return
    if kind=='needle':
        c.line([(6,27),(24,5)],'ink',3);c.line([(6,27),(24,5)],'steel')
        c.ell((21,3,26,9),'edge');c.line([(23,5),(24,6)],'ink',2)
        c.line([(23,4),(18,3),(12,6),(14,11),(21,11),(26,15),(24,22),(19,24)],'cloth')
        return
    if kind in ['club','alloy_club']:
        c.line([(6,27),(24,8)],'ink',7);c.line([(6,27),(24,8)],'iron' if kind=='club' else 'deep',5)
        c.line([(11,21),(23,8)],'steel' if kind=='club' else 'sage',2)
        c.ell((21,4,28,11),'dark','steel');c.ell((23,6,26,8),'ink',None)
        if kind=='club':c.rect((15,14,18,17),'rust')
        else:
            c.line([(17,10),(20,16)],'brassdark',3);c.line([(20,7),(24,13)],'brass',2)
        c.line([(5,25),(8,29)],'wood',4);c.line([(7,24),(10,27)],'clothdark',2);return


def bedding(c, kind):
    if kind=='mat':
        c.poly([(5,7),(23,4),(29,24),(10,29),(3,12)],'leafdark')
        for x in [6,10,14,18,22]:c.line([(x,9),(x+6,25)],'grain',2)
        for y in [10,14,18,22]:c.line([(6,y),(25,y-3)],'leaflight')
        c.line([(8,8),(25,22)],'wood');return
    if kind=='bedroll':
        c.poly([(7,8),(22,5),(27,23),(25,28),(9,29),(5,12)],'teal')
        c.poly([(8,13),(21,10),(24,23),(10,26)],'deep')
        c.ell((5,4,23,14),'sage');c.ell((9,7,21,12),'ink');c.ell((12,8,19,11),'teal',None)
        c.line([(9,20),(24,17)],'wooddark',3);c.rect((16,18,19,20),'brass','ink')
        c.line([(11,26),(23,23)],'sage');return
    straw=kind=='straw';good=kind=='good'
    c.line([(5,7),(5,28)],'wooddark',4);c.line([(26,10),(26,29)],'wooddark',4)
    c.poly([(4,12),(21,7),(28,20),(10,28),(3,18)],'wood')
    c.poly([(5,12),(20,8),(26,20),(10,25)],'grain' if straw else 'clothdark')
    if straw:
        for x,y in [(7,13),(11,15),(14,12),(18,17),(13,20),(20,21),(9,18)]:
            c.line([(x,y),(x+4,y-1)],'ivory');c.line([(x,y+1),(x+3,y+2)],'leather')
    else:
        c.poly([(6,12),(18,9),(21,13),(8,17)],'ivory')
        c.poly([(9,18),(22,14),(26,20),(11,25)],'teal' if good else 'cloth')
        c.line([(12,23),(24,19)],'sage' if good else 'ivory',2)
    if good:
        c.line([(4,7),(21,3),(25,10)],'grain',3)
        c.line([(4,9),(22,5)],'wooddark',2)


def kit(c, kind):
    # Separate assembly silhouettes instead of identical closed crates.
    if kind=='bench':
        c.poly([(3,10),(21,6),(29,12),(10,17)],'wood');c.line([(5,11),(21,8),(26,12)],'grain')
        for pts in [[(7,17),(9,27)],[(24,15),(23,26)]]:c.line(pts,'wooddark',4)
        c.line([(10,23),(22,21)],'grain',2)
        c.line([(12,8),(21,12)],'clothdark',3)
    elif kind=='forge':
        c.poly([(4,17),(8,8),(22,8),(28,18),(26,27),(7,27)],'iron')
        c.rect((9,11,22,16),'ink');c.rect((12,12,19,15),'wooddark')
        c.poly([(8,21),(23,21),(23,25),(8,25)],'rust');c.line([(10,18),(21,18)],'steel')
        c.rect((24,5,27,15),'iron','ink');c.line([(25,6),(26,12)],'steel')
    elif kind=='loom':
        c.line([(6,6),(6,27),(25,27),(25,5),(6,6)],'wooddark',4)
        c.line([(7,7),(24,6)],'grain',2)
        for x in [10,13,16,19,22]:c.line([(x,8),(x,24)],'cloth')
        for y in [17,20,23]:c.line([(9,y),(23,y)],'teal',2)
        c.line([(4,14),(27,14)],'grain',3)
    elif kind=='vat':
        c.poly([(5,12),(27,12),(24,27),(9,27)],'wood')
        c.ell((4,6,27,16),'wooddark','grain');c.ell((7,8,24,13),'dark',None)
        for x in [10,16,22]:c.line([(x,16),(x,25)],'grain')
        c.line([(7,21),(25,21)],'iron',2)
        c.line([(12,11),(20,10)],'leather',2)
    elif kind=='artisan':
        c.poly([(3,14),(22,9),(28,14),(8,20)],'wood');c.line([(7,20),(7,28)],'wooddark',4);c.line([(24,17),(24,28)],'wooddark',4)
        c.rect((8,9,15,14),'iron','ink');c.rect((11,6,17,9),'steel','ink')
        c.line([(18,15),(25,7)],'brass',2);c.ell((21,4,26,8),'steel')
        c.line([(12,23),(20,21)],'grain',2)


def vegetables(c, kind):
    if kind=='cabbage':
        c.ell((4,6,28,28),'leafdark');c.ell((7,5,25,26),'leaf');c.ell((10,9,24,24),'leaflight','leafdark')
        c.line([(8,12),(11,20),(18,25),(25,20)],'sage',2)
        c.line([(15,10),(12,15),(16,19),(21,16),(20,12)],'leafdark')
    elif kind in ['raw_potato','baked_potato','potato_seed']:
        c.poly([(5,13),(11,7),(22,7),(28,13),(25,23),(18,27),(8,24),(4,19)],'leather' if kind!='baked_potato' else 'wood')
        c.poly([(8,12),(12,9),(21,10),(24,14),(17,15),(11,20),(6,18)],'leatherlight' if kind!='baked_potato' else 'rustlight',None)
        for x,y in [(10,13),(21,17),(14,23)]:c.line([(x,y),(x+1,y+1)],'wooddark')
        if kind=='baked_potato':
            c.poly([(11,13),(18,11),(22,15),(18,20),(12,19)],'ivory')
            c.line([(10,14),(14,16),(12,19)],'wooddark');c.line([(18,12),(18,17),(21,16)],'clothdark')
        elif kind=='potato_seed':
            c.line([(20,10),(22,4),(26,3)],'leaflight',2);c.poly([(22,5),(20,1),(17,2),(19,5)],'leaf')
    elif kind=='turnip':
        leaf(c,14,12,'leaf','leaf');c.line([(17,14),(21,5),(25,5)],'leaflight',2)
        c.poly([(7,17),(12,13),(21,14),(25,19),(21,25),(17,29),(16,25),(11,24)],'bone')
        c.line([(9,17),(14,15),(21,16)],'sage',2);c.line([(12,22),(17,24)],'ivory')
    elif kind in ['cabbage_seed','turnip_seed']:
        c.poly([(7,7),(23,6),(26,25),(23,29),(8,28),(5,24)],'cloth')
        c.line([(7,11),(24,10)],'wood',2);c.line([(10,8),(11,11)],'ivory')
        if kind=='cabbage_seed':
            c.ell((10,14,21,24),'leaf');c.line([(11,18),(16,22),(20,17)],'leaflight')
        else:
            c.poly([(11,19),(15,16),(21,19),(18,23),(16,25),(14,23)],'bone')
            c.line([(16,18),(14,13)],'leaf',2);c.line([(17,17),(20,13)],'leaf')
        c.dot(9,25,'wooddark');c.dot(22,25,'wooddark')
    elif kind=='berry':
        c.line([(13,14),(21,4)],'wood',2)
        c.poly([(14,9),(10,5),(16,5),(20,8)],'leaf')
        for x,y in [(6,13),(15,15),(13,22),(22,10)]:
            c.ell((x,y,x+7,y+7),'reddark');c.ell((x+1,y+1,x+5,y+5),'red',None);c.dot(x+2,y+2,'redlight')
    elif kind=='cheese':
        c.poly([(5,15),(22,5),(28,10),(28,25),(5,28)],'brass')
        c.poly([(5,15),(22,5),(28,10),(12,19)],'ivory')
        c.line([(7,26),(26,23)],'brasslight')
        for x,y in [(13,20),(22,15),(23,22)]:c.ell((x,y,x+3,y+3),'brassdark',None)
    elif kind=='apple':
        for x,y in [(4,9),(14,7),(11,18)]:
            c.poly([(x,y),(x+8,y-2),(x+12,y+5),(x+7,y+9),(x+1,y+7)],'rust')
            c.poly([(x+2,y+1),(x+7,y),(x+9,y+4),(x+6,y+6),(x+3,y+5)],'leatherlight')
            c.ell((x+5,y+2,x+7,y+4),'wooddark',None)
    elif kind=='mushroom':
        c.poly([(14,17),(20,17),(21,28),(16,29),(13,26)],'bone')
        c.poly([(3,18),(5,10),(11,5),(20,5),(27,10),(29,18),(24,21),(8,21)],'iron')
        c.poly([(6,15),(10,9),(18,7),(24,11),(26,15)],'sage',None)
        c.line([(6,19),(13,18),(22,19),(26,18)],'dark')
        c.rect((10,11,12,12),'light');c.rect((21,13,23,14),'light')


def jar(c, filled):
    c.poly([(10,8),(22,8),(23,13),(28,18),(27,27),(22,29),(10,29),(5,26),(5,17),(9,13)],'rust')
    c.poly([(9,16),(12,12),(12,25),(9,26),(7,24),(7,18)],'rustlight',None)
    c.line([(11,27),(22,27)],'wooddark',2)
    if filled:
        c.ell((8,4,24,10),'clothdark');c.line([(8,8),(24,8)],'wood',2)
        c.rect((14,16,23,23),'cloth','ink');c.ell((16,17,21,22),'leaf');c.line([(17,19),(20,20)],'leaflight')
        c.line([(11,10),(10,14),(13,15)],'cloth')
    else:
        c.ell((9,4,23,11),'rustlight');c.ell((11,6,21,9),'wooddark')


def misc(c, kind):
    if kind in ['hide','wolf_hide']:
        c.poly([(7,3),(13,7),(18,6),(25,3),(24,12),(28,18),(24,21),(27,28),(20,25),(15,28),(10,25),(4,28),(7,20),(3,15),(8,11)],'clothdark' if kind=='wolf_hide' else 'leather')
        c.poly([(11,9),(20,8),(23,16),(20,23),(13,24),(9,19)],'sage' if kind=='wolf_hide' else 'redlight',None)
        if kind=='wolf_hide':
            for x,y in [(9,9),(13,17),(21,13),(17,24)]:c.line([(x,y),(x+2,y+2)],'bone')
        else:c.line([(12,11),(11,18),(17,22)],'red')
    elif kind in ['steel_ingot','iron_ingot']:
        c.poly([(4,19),(10,8),(24,5),(29,14),(25,24),(9,28)],'steel' if kind=='steel_ingot' else 'iron')
        c.poly([(5,18),(11,9),(24,7),(27,14),(12,21)],'edge' if kind=='steel_ingot' else 'steel')
        c.poly([(12,21),(27,14),(24,23),(10,26)],'iron' if kind=='steel_ingot' else 'deep')
        if kind=='iron_ingot':c.rect((14,12,17,14),'rust');c.line([(20,18),(23,17)],'rustlight')
        else:c.line([(10,17),(22,11)],'steel');c.rect((19,19,22,20),'brassdark')
    elif kind=='linen':
        c.poly([(5,10),(21,6),(28,11),(25,25),(9,29),(4,23)],'cloth')
        c.poly([(6,10),(20,8),(25,11),(11,16)],'ivory')
        c.line([(11,17),(11,25),(24,22)],'clothdark',2)
        for y in [18,21,24]:c.line([(5,y),(8,y+1)],'ivory')
    elif kind=='wool':
        for b in [(6,7,17,19),(13,4,25,16),(16,14,28,25),(5,16,18,28),(9,11,23,26)]:c.ell(b,'bone')
        for pts in [[(9,12),(12,10),(15,12)],[(16,9),(19,8),(22,10)],[(11,21),(14,19),(17,22)],[(20,17),(23,19),(21,22)]]:c.line(pts,'clothdark')
    elif kind=='wax':
        c.poly([(6,13),(11,8),(24,8),(27,13),(24,26),(8,27),(5,22)],'brass')
        c.ell((7,6,25,15),'brasslight');c.ell((11,9,21,12),'brassdark',None)
        c.line([(10,16),(10,23)],'ivory',2);c.line([(20,14),(21,18),(24,19)],'leather')
    elif kind=='sharpen':
        c.poly([(3,19),(10,9),(25,6),(29,13),(23,24),(7,28)],'iron')
        c.poly([(5,18),(11,11),(25,8),(27,12),(21,20),(8,24)],'clothdark')
        for x,y in [(10,18),(15,15),(20,12)]:c.line([(x,y),(x+3,y-1)],'light')
    elif kind=='charm':
        c.line([(8,9),(10,4),(19,3),(24,9),(22,16),(18,20)],'wood',2)
        c.poly([(11,14),(17,12),(23,16),(21,24),(16,29),(11,24)],'bone')
        c.ell((14,15,19,19),'wooddark');c.line([(13,23),(19,23)],'clothdark')
        c.line([(15,25),(17,27),(19,24)],'ink')
    elif kind=='ring':
        c.ell((5,9,26,29),'brassdark');c.ell((9,13,22,25),'ink');c.ell((10,14,21,24),(0,0,0,0),None)
        c.poly([(8,6),(18,3),(25,10),(21,17),(11,18),(6,13)],'rust')
        c.poly([(10,8),(17,5),(22,10),(19,14),(12,15),(8,12)],'brass')
        c.line([(12,9),(18,9),(18,13),(14,13),(14,11)],'wooddark')
    elif kind=='tourniquet':
        c.ell((4,8,26,25),'clothdark');c.ell((8,12,22,21),(0,0,0,0),None)
        c.line([(7,20),(23,8)],'ink',5);c.line([(7,20),(23,8)],'wood',3)
        c.rect((17,8,23,14),'iron','ink');c.rect((19,10,21,12),'dark')
        c.line([(6,22),(14,27)],'cloth',3)
    elif kind=='splint':
        for dx in [0,7]:
            c.poly([(5+dx,26),(15+dx,4),(19+dx,5),(9+dx,28)],'wood')
            c.line([(8+dx,25),(17+dx,6)],'grain')
        c.line([(8,21),(19,26)],'cloth',3);c.line([(13,10),(25,15)],'cloth',3)
        c.line([(10,19),(20,23)],'clothdark');c.line([(15,9),(24,12)],'clothdark')
    elif kind=='painkiller':
        c.poly([(6,8),(23,5),(28,24),(10,29)],'iron')
        for x,y in [(10,11),(19,9),(13,21),(22,19)]:
            c.ell((x-2,y-2,x+4,y+5),'steel');c.ell((x-1,y-1,x+3,y+4),'ivory');c.line([(x,y+1),(x+2,y+2)],'clothdark')
    elif kind=='lantern':
        c.line([(11,7),(11,3),(16,1),(21,4),(21,8)],'iron',2)
        c.poly([(8,9),(12,5),(21,5),(25,9)],'iron');c.rect((9,10,24,24),'dark','ink')
        c.rect((12,11,21,23),'brassdark');c.poly([(16,13),(14,19),(16,22),(19,19)],'amber')
        c.line([(10,10),(10,25)],'steel',2);c.line([(23,10),(23,25)],'iron',2)
        c.poly([(8,25),(24,25),(26,29),(6,29)],'iron');c.line([(10,27),(22,27)],'steel')
    elif kind=='bones':
        bone(c,5,23,21,8);bone(c,11,8,25,24)
        c.ell((8,12,20,23),'bone');c.ell((10,15,13,18),'ink');c.ell((16,15,19,18),'ink');c.line([(13,22),(17,22)],'ink')
    elif kind=='ash_leaf':leaf(c,17,20,'sage')
    elif kind=='pine':leaf(c,17,18,'leaf','pine')
    elif kind=='moss':
        c.poly([(4,12),(22,8),(28,18),(23,27),(7,28)],'clothdark')
        for pts in [[(7,16),(9,11),(14,12),(15,17),(13,20),(8,21)],[(14,18),(17,12),(23,12),(26,17),(22,23),(17,24)],[(10,21),(12,18),(18,22),(17,26),(11,26)]]:c.poly(pts,'leaf')
        for x,y in [(9,15),(17,17),(22,15),(14,23)]:c.line([(x,y),(x+2,y-1)],'leaflight')
    elif kind=='buckler':
        c.ell((3,4,29,29),'iron');c.ell((6,7,26,26),'deep','rust')
        c.line([(8,10),(24,24)],'steel',2);c.line([(22,8),(8,24)],'iron',2)
        c.ell((11,12,21,22),'steel');c.ell((14,14,19,19),'iron')
        for x,y in [(15,6),(6,15),(25,15),(15,26)]:c.dot(x,y,'brasslight')
    elif kind=='machine_patch':
        c.poly([(5,9),(22,6),(28,23),(10,28)],'deep')
        c.poly([(9,12),(21,10),(24,22),(12,25)],'iron')
        c.line([(11,17),(16,16),(18,19),(22,18)],'ink',2)
        c.line([(13,15),(15,22)],'brass',2);c.line([(19,13),(21,21)],'brass',2)
        for x,y in [(8,11),(21,8),(25,23),(11,26)]:c.dot(x,y,'steel')
    elif kind=='actuator':
        c.line([(7,26),(21,9)],'ink',7);c.line([(7,26),(21,9)],'steel',3)
        c.poly([(10,23),(8,19),(17,8),(23,9),(25,13),(17,25)],'iron')
        c.line([(12,21),(21,11)],'teal',3)
        c.ell((20,4,27,11),'brassdark');c.ell((22,6,25,9),'ink');c.ell((3,24,10,30),'iron');c.dot(6,27,'edge')
    elif kind=='fluid':
        c.rect((10,3,19,7),'iron','ink');c.poly([(9,8),(22,8),(26,14),(26,28),(6,28),(6,13)],'deep')
        c.poly([(19,10),(22,10),(24,15),(19,15)],'ink');c.line([(9,13),(9,25)],'sage')
        c.rect((12,17,22,24),'clothdark','ink');c.poly([(17,18),(14,22),(19,22)],'teal')
    elif kind=='low_cell':
        c.poly([(6,10),(22,5),(27,9),(27,25),(11,29),(6,25)],'deep')
        c.poly([(8,11),(21,7),(25,10),(12,14)],'iron');c.line([(12,15),(12,26)],'teal',2)
        c.rect((13,5,17,7),'brass','ink');c.rect((21,4,24,6),'brass','ink')
        c.line([(18,15),(23,14),(20,19),(23,19),(17,24)],'brass')
    elif kind=='nozzle':
        c.poly([(4,25),(10,18),(15,21),(9,29)],'wood')
        c.poly([(10,20),(15,11),(22,5),(27,9),(22,16),(17,24)],'iron')
        c.line([(16,15),(22,9)],'steel',3);c.poly([(23,4),(27,4),(29,7),(26,10),(23,8)],'brass')
        c.ell((25,4,28,7),'ink');c.line([(5,24),(9,26)],'clothdark')
    elif kind=='ink':
        c.ell((6,15,24,29),'wooddark');c.rect((8,13,22,23),'dark','ink');c.ell((8,9,22,17),'iron');c.ell((11,11,19,14),'ink')
        c.line([(14,13),(23,3)],'grain',2);c.poly([(20,5),(25,2),(26,5),(22,9)],'cloth')
        c.line([(8,19),(8,24)],'teal')
    elif kind=='fragment':
        c.poly([(4,18),(9,7),(20,5),(27,12),(24,25),(13,29),(6,24)],'iron')
        c.poly([(10,9),(19,7),(24,13),(16,18),(7,18)],'steel',None)
        c.poly([(7,20),(14,19),(16,26),(10,26)],'clothdark')
        c.line([(19,17),(23,13),(22,22)],'ink')
    elif kind=='alloy_scrap':
        c.poly([(3,17),(10,5),(17,7),(16,14),(24,10),(29,15),(24,26),(14,23),(8,28)],'deep')
        c.line([(7,17),(12,9),(13,17),(21,15)],'sage',2);c.line([(17,21),(25,17),(23,23)],'iron',2)
        c.ell((19,12,23,16),'ink','brassdark')
    elif kind=='missing':
        c.poly([(5,10),(22,7),(27,11),(26,26),(8,29),(4,25)],'clothdark')
        c.line([(8,12),(21,9),(24,12),(24,24)],'cloth')
        c.rect((12,14,21,23),'dark');c.line([(14,16),(19,21)],'cloth',2);c.line([(19,16),(14,21)],'cloth',2)
        c.line([(7,25),(11,27)],'wood')
    elif kind=='rope':
        for b in [(4,5,27,27),(7,8,24,24),(10,11,21,21)]:
            c.ell(b,'leather','wooddark');c.ell((b[0]+2,b[1]+2,b[2]-2,b[3]-2),(0,0,0,0),None)
        c.line([(24,19),(27,25),(21,29),(16,27)],'wooddark',4);c.line([(24,19),(27,25),(21,29),(16,27)],'leatherlight',2)
        for x,y in [(8,7),(18,6),(25,13),(23,22),(12,25),(5,17)]:c.line([(x,y),(x+2,y+2)],'ivory')
    elif kind=='strap':
        c.ell((4,5,28,27),'wood');c.ell((9,9,23,22),(0,0,0,0),None)
        c.line([(8,23),(19,28),(26,23)],'leather',4);c.rect((19,21,26,27),'brass','ink');c.rect((21,23,24,25),'wooddark')
        for x,y in [(8,10),(7,14),(8,18)]:c.dot(x,y,'ink')
        c.line([(11,7),(20,7)],'leatherlight')
    elif kind=='glass':
        c.poly([(4,24),(10,5),(19,9),(28,21),(20,28),(13,20)],'teal')
        c.poly([(10,6),(16,11),(7,22)],'light',None);c.poly([(17,12),(26,21),(20,25),(15,19)],'sage',None)
        c.line([(10,6),(15,16),(20,26)],'edge');c.line([(5,24),(11,20)],'edge')
    elif kind=='filter':
        c.poly([(3,10),(15,7),(28,10),(23,24),(16,28),(7,24)],'cloth')
        c.poly([(7,13),(16,11),(24,13),(20,22),(15,25),(10,21)],'clothdark')
        for x in [10,14,18,22]:c.line([(x,14),(x-1,20)],'ivory')
        c.line([(5,11),(2,5),(6,3),(9,9)],'wood');c.line([(26,11),(29,5),(25,3),(23,9)],'wood')
    elif kind=='sand':
        c.poly([(3,26),(10,18),(15,11),(19,12),(27,22),(29,27)],'leather')
        c.poly([(6,24),(15,13),(19,15),(22,22),(16,20),(11,25)],'cloth',None)
        for x,y in [(10,21),(15,16),(19,20),(21,25),(6,26),(25,24),(15,25)]:c.dot(x,y,'ivory')
        c.line([(4,28),(25,29)],'clothdark')
    elif kind=='coracle':
        c.poly([(3,14),(10,5),(21,5),(29,13),(27,24),(21,28),(10,27),(4,22)],'wooddark')
        c.poly([(6,14),(12,8),(20,8),(26,14),(24,23),(19,25),(11,24),(7,20)],'leather')
        c.line([(9,11),(23,23)],'grain',2);c.line([(23,10),(9,22)],'grain',2)
        c.line([(5,17),(27,17)],'clothdark',3);c.rect((14,15,18,19),'brassdark','ink')
        stitch(c,8,13,3);c.line([(8,7),(27,25)],'wood',2)
    elif kind=='culture':
        c.poly([(4,17),(10,10),(26,12),(29,23),(23,28),(6,26)],'wood')
        c.ell((3,15,12,26),'grain');c.ell((5,18,10,23),'wooddark');c.dot(7,20,'grain')
        c.poly([(12,13),(21,14),(24,26),(15,26)],'clothdark')
        c.line([(13,15),(22,16)],'ivory');c.line([(15,24),(22,24)],'ivory')
        for x,y in [(11,9),(20,7),(23,15)]:
            c.rect((x+2,y+3,x+3,y+7),'bone');c.ell((x,y,x+6,y+4),'ivory')
    elif kind=='plate':
        c.poly([(5,7),(22,4),(27,8),(26,26),(9,29),(5,25)],'iron')
        c.line([(8,9),(22,6),(24,9)],'steel');c.rect((11,11,22,20),'dark')
        for x,y,n in [(13,13,5),(13,16,7),(13,19,3)]:c.line([(x,y),(x+n,y)],'sage')
        for x in [11,15,19,23]:c.line([(x,24),(x,27)],'brass',2)
    elif kind=='key':
        c.ell((3,3,16,16),'brassdark');c.ell((6,6,13,13),(0,0,0,0),None)
        c.line([(12,13),(27,28)],'ink',5);c.line([(12,13),(27,28)],'brass',3)
        c.poly([(20,19),(25,15),(28,18),(25,21),(28,24),(25,27)],'brassdark')
        c.line([(20,20),(24,24)],'brasslight');c.line([(6,5),(10,4)],'brasslight')
    elif kind=='lute':
        c.ell((4,13,22,29),'wooddark');c.ell((5,12,21,27),'leather');c.ell((8,13,22,26),'grain')
        c.line([(15,17),(24,4)],'ink',6);c.line([(15,17),(24,4)],'wood',4)
        c.ell((11,17,17,23),'wooddark');c.line([(9,24),(14,26)],'wooddark',2)
        for dx in [0,2]:c.line([(11+dx,23),(24+dx,5)],'cloth')
        c.poly([(22,3),(25,2),(29,5),(26,9)],'wood')
        c.dot(28,5,'brass');c.dot(25,3,'brass')
    elif kind=='hardtack':
        c.poly([(5,8),(22,5),(28,11),(26,25),(11,28),(4,22)],'leather')
        c.poly([(6,9),(21,7),(25,12),(23,23),(11,25),(6,21)],'cloth')
        for x,y in [(10,12),(16,11),(21,14),(11,19),(17,18),(21,21)]:c.rect((x,y,x+1,y+1),'wooddark')
        c.line([(7,23),(12,25),(23,23)],'ivory')
    elif kind=='apron':
        c.line([(10,10),(10,4),(20,4),(21,10)],'wood',3)
        c.poly([(10,9),(21,9),(21,14),(25,17),(25,28),(6,28),(6,17),(10,14)],'leather')
        c.line([(11,11),(11,20)],'leatherlight');c.rect((11,19,20,25),'wood','ink');stitch(c,12,20,3,True)
        c.line([(6,17),(2,16)],'wood',2);c.line([(24,17),(29,16)],'wood',2)
    elif kind in ['cloak','raincoat','hood','mask']:
        if kind=='mask':
            c.line([(6,13),(2,8),(4,4),(10,10)],'clothdark',2);c.line([(25,13),(29,8),(28,4),(21,9)],'clothdark',2)
            c.poly([(5,11),(15,8),(26,11),(25,21),(16,26),(6,21)],'cloth')
            for y in [13,17,21]:c.line([(8,y),(15,y+2),(23,y)],'clothdark')
            c.line([(8,11),(14,10),(22,12)],'ivory');return
        c.poly([(5,28),(8,11),(12,4),(20,4),(24,11),(28,28),(20,30),(15,27),(10,30)],'teal' if kind!='hood' else 'clothdark')
        c.ell((10,5,23,19),'deep' if kind!='hood' else 'cloth')
        c.poly([(12,10),(17,8),(21,11),(20,19),(13,19)],'ink')
        c.line([(9,20),(6,27)],'sage' if kind!='hood' else 'cloth')
        c.line([(23,20),(26,27)],'deep')
        c.ell((13,21,19,25),'brassdark')
        if kind=='hood':
            c.line([(12,19),(10,24),(13,27)],'ivory');c.line([(21,20),(22,25),(19,28)],'cloth')
        if kind=='raincoat':
            c.poly([(9,17),(4,19),(2,25),(7,27),(11,22)],'teal');c.poly([(23,17),(27,18),(30,25),(26,27),(21,22)],'teal')
            c.line([(16,25),(16,29)],'ink');c.line([(8,23),(10,20)],'sage')
    elif kind=='medical_bag':
        c.line([(10,9),(10,5),(21,5),(22,9)],'wooddark',3)
        c.poly([(5,10),(25,8),(28,25),(25,28),(6,28),(3,24)],'leather')
        c.line([(5,12),(25,10)],'leatherlight');c.rect((10,16,22,25),'cloth','ink')
        c.rect((15,17,18,24),'red');c.rect((12,19,21,22),'red')
        c.rect((6,12,9,18),'wood','ink');c.rect((23,12,25,17),'brassdark','ink')
    elif kind=='helmet':
        c.poly([(4,23),(5,12),(11,5),(21,5),(27,12),(28,23),(25,27),(20,25),(10,25),(7,27)],'iron')
        c.poly([(7,12),(12,7),(18,7),(15,13),(15,22),(7,22)],'steel',None)
        c.line([(18,6),(20,13),(20,25)],'rust',2)
        c.line([(7,23),(24,23)],'ink',2);c.rect((12,21,18,24),'dark')
        c.dot(7,18,'brass');c.dot(25,18,'brass');c.line([(6,27),(9,29)],'leather')
    elif kind=='boots':
        for dx,dy in [(0,0),(13,-3)]:
            c.poly([(5+dx,8+dy),(13+dx,8+dy),(12+dx,21+dy),(16+dx,24+dy),(16+dx,28+dy),(3+dx,28+dy),(2+dx,24+dy),(5+dx,20+dy)],'wood')
            c.line([(6+dx,10+dy),(11+dx,10+dy)],'leatherlight',2)
            c.line([(5+dx,27+dy),(14+dx,27+dy)],'ink',2)
            c.line([(7+dx,14+dy),(10+dx,14+dy),(7+dx,17+dy),(10+dx,18+dy)],'clothdark')
    else:
        raise ValueError('No authored misc: '+kind)


def prosthetic(c, kind):
    if kind=='peg':
        c.poly([(10,3),(22,3),(24,9),(20,14),(18,28),(14,30),(11,13),(8,8)],'wood')
        c.ell((10,2,22,8),'leather');c.ell((12,3,20,6),'wooddark')
        c.line([(13,12),(16,26)],'grain',2);c.line([(11,12),(21,12)],'iron',3)
        c.line([(15,29),(18,29)],'iron',2)
    elif kind=='joint_leg':
        c.poly([(11,3),(21,3),(22,10),(18,15),(18,24),(25,26),(25,29),(10,29),(10,25),(13,17),(9,11)],'iron')
        c.ell((10,1,22,7),'leather');c.ell((12,3,20,5),'wooddark')
        c.ell((11,12,20,20),'brassdark');c.ell((14,14,17,17),'steel');c.line([(16,20),(15,25)],'steel',2)
        c.line([(13,8),(18,8)],'steel',2)
    elif kind=='hook':
        c.poly([(7,25),(10,17),(20,18),(23,26),(21,29),(8,29)],'leather')
        c.rect((10,16,20,21),'iron','ink');c.line([(14,17),(12,12),(13,6),(17,3),(23,4),(27,8),(26,11),(23,12)],'ink',5)
        c.line([(14,17),(12,12),(13,6),(17,3),(23,4),(26,8),(24,11)],'steel',3)
        c.line([(15,5),(21,5)],'edge');c.line([(10,25),(20,25)],'wood')
    elif kind=='arm':
        c.ell((7,2,20,12),'iron');c.ell((10,4,17,9),'dark','brass')
        c.poly([(10,11),(20,10),(23,20),(19,25),(12,24),(8,18)],'deep')
        c.line([(13,12),(13,19)],'steel',3);c.ell((13,19,22,27),'iron')
        c.poly([(15,25),(14,29),(17,31),(21,29),(25,29),(27,25),(25,21),(23,24)],'steel')
        c.line([(18,26),(19,29)],'ink');c.line([(21,25),(22,28)],'ink');c.line([(17,13),(20,19)],'brassdark',2)
    elif kind=='gardener':
        c.poly([(12,29),(10,24),(14,16),(12,9),(8,4),(10,2),(15,6),(18,11),(23,6),(25,2),(28,3),(27,9),(21,16),(20,22),(23,27),(20,29),(16,25),(15,30)],'bone')
        c.line([(14,25),(17,18),(16,10),(12,5)],'white',2)
        c.line([(19,16),(24,9),(26,4)],'clothdark')
        c.line([(13,22),(17,23),(19,21)],'teal');c.dot(20,13,'brassdark')


def distinct_water(c, kind):
    if kind=='water_pill':
        # A known water-treatment tool: droplet on the packet, unmarked tablet.
        c.poly([(5,5),(20,3),(25,8),(24,25),(7,28),(4,23)],'steel')
        c.poly([(8,8),(20,6),(22,10),(21,21),(9,23)],'cloth')
        c.line([(7,7),(19,5)],'edge');c.line([(7,25),(20,23)],'iron')
        c.poly([(14,9),(10,15),(11,18),(14,20),(17,18),(18,15)],'teal')
        c.line([(13,15),(12,17),(14,18)],'sage')
        c.ell((16,19,28,30),'clothdark');c.ell((17,18,29,28),'white')
        c.line([(20,21),(25,24)],'clothdark');return
    if kind=='charcoal_filter':
        # Cutaway-like layer depiction makes the actual charcoal/sand contents
        # legible without claiming a housing material or an unseen quality state.
        c.poly([(6,5),(25,5),(24,11),(22,14),(22,27),(10,27),(10,14),(7,11)],'iron')
        c.ell((5,2,26,10),'steel');c.ell((8,4,23,8),'dark')
        c.line([(8,10),(12,14)],'sage');c.line([(24,10),(20,14)],'sage')
        c.rect((10,14,22,19),'ink')
        for pts in [[(11,16),(14,14),(17,16),(15,18)],[(17,17),(20,15),(22,17),(20,19)]]:c.poly(pts,'dark',None)
        c.rect((11,20,21,24),'clothdark')
        c.line([(11,20),(21,20)],'cloth')
        for x,y in [(12,22),(15,23),(18,21),(20,24)]:c.dot(x,y,'ivory')
        c.line([(9,14),(9,26)],'steel');c.line([(23,14),(23,26)],'steel')
        c.rect((9,25,23,28),'cloth','ink');c.rect((13,28,19,31),'iron','ink')
        c.line([(14,29),(17,29)],'sage');return
    # The two filled vessels share a water-bottle type but receive distinct
    # physical contents/labels. No pathogen, ash or salt assay is encoded.
    c.rect((12,2,19,6),'wood','ink')
    c.poly([(12,6),(19,6),(19,10),(24,13),(25,27),(22,30),(8,30),(6,27),(7,13),(12,10)],'deep')
    c.line([(10,13),(9,25),(11,27)],'sage',2)
    if kind=='dirty_water':
        c.poly([(11,16),(15,17),(22,16),(23,26),(20,28),(11,28),(9,25)],'clothdark')
        c.poly([(10,24),(14,23),(17,25),(22,24),(22,27),(11,28)],'wood')
        c.line([(12,16),(16,17),(21,16)],'light')
        for x,y in [(13,20),(19,19),(18,23),(12,26),(21,25)]:c.dot(x,y,'wooddark')
        c.line([(8,14),(9,12)],'light')
    elif kind=='pine_tea':
        c.poly([(11,15),(22,15),(23,26),(20,28),(10,28),(9,25)],'brassdark')
        c.line([(12,16),(21,16)],'brass')
        c.rect((10,18,22,26),'cloth','ink')
        c.line([(12,24),(20,19)],'wood')
        for x,y in [(14,23),(17,21),(19,20)]:
            c.line([(x,y),(x-1,y-3)],'leaf');c.line([(x,y),(x+2,y+1)],'leaf')
    else:raise ValueError(kind)


def ability(c, name):
    # Combat diagrams use fixed physical motifs. No effect values are embedded.
    c.ell((1,1,30,30),'dark','deep')
    if name=='blade_deep_cut':
        c.poly([(5,12),(12,8),(24,13),(26,23),(18,28),(7,24)],'clothdark')
        c.line([(7,21),(21,13)],'ink',4)
        c.line([(9,20),(21,13)],'red',2)
        c.poly([(21,18),(18,24),(21,27),(24,24)],'redlight')
        c.line([(5,8),(18,16)],'ink',5);c.line([(5,7),(18,15)],'steel',3)
        c.line([(6,6),(19,14)],'edge')
    elif name=='blade_edge':
        dagger(c,'steel');c.line([(3,10),(5,8),(10,8),(13,10)],'sage');c.ell((6,9,9,12),'brass')
        c.line([(23,2),(23,5)],'ivory');c.line([(27,6),(30,6)],'ivory')
    elif name=='blade_parry':
        c.line([(5,8),(24,27)],'ink',5);c.line([(5,8),(24,27)],'iron',3)
        c.line([(7,25),(25,6)],'ink',5);c.line([(7,25),(25,6)],'steel',3)
        c.line([(3,18),(3,12),(8,5),(15,3)],'sage',2)
        c.poly([(13,2),(17,3),(14,6)],'sage')
        c.rect((13,13,17,17),'brasslight')
    elif name=='blade_vital':
        c.ell((17,4,25,12),'clothdark');c.line([(20,13),(20,25)],'clothdark',5)
        c.line([(20,17),(26,21)],'clothdark',3);c.line([(6,25),(20,11)],'steel',3)
        c.ell((17,10,23,16),'ink','redlight');c.dot(20,13,'red')
    elif name.startswith('axe_'):
        if name=='axe_hamstring':
            c.line([(21,5),(18,16),(23,27)],'clothdark',5);c.line([(18,16),(12,27)],'clothdark',4)
            c.ell((15,17,22,24),'ink','redlight')
            c.line([(6,26),(14,13)],'wood',3);c.poly([(10,12),(16,8),(20,13),(17,19),(13,17)],'steel')
        else:
            axe(c,'steel')
            if name=='axe_split':
                c.poly([(2,19),(10,16),(14,20),(14,28),(6,29)],'iron');c.line([(9,18),(7,22),(11,24),(9,28)],'ink',2)
            elif name=='axe_ferocity':
                c.poly([(6,7),(3,13),(6,17),(9,14)],'red');c.poly([(14,4),(12,8),(14,11),(17,8)],'redlight')
            elif name=='axe_sweep':
                c.line([(3,17),(3,11),(7,5),(14,2)],'sage',2);c.line([(25,22),(22,27),(15,29)],'sage',2)
                c.poly([(12,27),(17,29),(12,31)],'sage')
    elif name=='blunt_head_bash':
        c.ell((9,14,23,28),'bone');c.ell((12,18,15,21),'ink');c.ell((19,18,22,21),'ink')
        c.line([(5,6),(23,15)],'iron',5);c.line([(7,5),(24,13)],'steel',2)
        c.line([(16,8),(17,12)],'brasslight',2);c.line([(25,10),(28,8)],'brasslight')
    elif name=='blunt_bone_breaker':
        bone(c,7,24,24,8,broken=True);c.line([(6,7),(15,16)],'iron',6);c.line([(7,7),(15,15)],'steel',2)
        c.line([(17,17),(21,19)],'brass')
    elif name=='blunt_shove':
        c.poly([(4,13),(9,11),(10,14),(15,15),(15,21),(8,22),(4,19)],'bone')
        c.line([(18,17),(26,17)],'sage',3);c.poly([(23,12),(29,17),(23,23)],'sage')
        c.line([(20,7),(23,4),(27,7),(26,11)],'clothdark',3)
    elif name=='blunt_crumple':
        c.poly([(6,7),(13,6),(17,10),(22,6),(26,10),(24,27),(8,27)],'iron')
        c.poly([(11,11),(19,12),(15,18),(21,22),(12,23),(15,17)],'dark')
        c.line([(2,4),(14,14)],'steel',5);c.line([(13,9),(15,12),(19,10)],'brasslight')
    elif name=='survival_first_aid':
        c.poly([(5,18),(18,8),(27,16),(14,27)],'cloth')
        for i in [0,5,10]:c.line([(8+i,16-i//2),(16+i,23-i//2)],'clothdark',2)
        c.rect((18,3,22,14),'ivory');c.rect((14,7,26,10),'ivory')
    elif name=='survival_breath':
        c.line([(16,7),(16,21)],'bone',2)
        c.poly([(13,10),(9,11),(5,19),(7,25),(13,23),(14,17)],'sage')
        c.poly([(19,10),(23,11),(27,19),(25,25),(19,23),(18,17)],'teal')
        c.line([(12,4),(9,2),(5,3)],'cloth');c.line([(20,4),(23,2),(27,3)],'cloth')
        c.line([(15,26),(17,29),(21,28)],'bone')
    elif name=='survival_sneak':
        c.poly([(9,13),(11,6),(17,4),(22,9),(19,14),(24,19),(20,23),(12,20),(6,25),(3,23),(9,16)],'teal')
        c.poly([(13,9),(18,8),(20,11),(15,13)],'ink');c.line([(14,20),(18,25),(25,27)],'sage',3)
        c.line([(5,28),(12,28)],'clothdark');c.line([(23,12),(28,12)],'dark',2)
    elif name=='survival_tough':
        c.poly([(6,8),(16,3),(26,8),(25,21),(16,29),(7,21)],'iron')
        c.poly([(9,10),(16,6),(23,10),(21,20),(16,25),(11,20)],'deep')
        c.line([(12,15),(14,12),(17,16),(20,11)],'bone',3)
        c.line([(10,19),(13,20),(18,19),(21,20)],'sage')
    elif name=='spear_pierce':
        # Two figures on one trajectory, with a single long spear passing them.
        for x in [12,23]:
            c.ell((x-3,7,x+3,13),'clothdark')
            c.line([(x,13),(x,22)],'clothdark',4)
            c.line([(x,21),(x-3,27)],'clothdark',2)
            c.line([(x,21),(x+3,27)],'clothdark',2)
        c.line([(3,19),(26,16)],'ink',5);c.line([(3,19),(24,16)],'grain',2)
        c.poly([(22,14),(30,15),(24,19)],'steel');c.line([(24,16),(28,15)],'edge')
        c.ell((10,15,14,20),'ink','redlight');c.ell((21,14,25,19),'ink','redlight')
    elif name=='spear_reach':
        c.line([(4,11),(23,11)],'wood',3);c.poly([(22,8),(29,11),(22,14)],'steel')
        c.ell((22,17,28,23),'clothdark');c.line([(25,23),(25,28)],'clothdark',3)
        c.line([(5,21),(5,26),(20,26),(20,21)],'sage',2)
        c.line([(12,23),(12,28)],'sage')
        c.poly([(5,23),(9,21),(9,25)],'sage');c.poly([(20,23),(16,21),(16,25)],'sage')
    elif name=='spear_trip':
        c.line([(19,5),(16,15),(23,24)],'clothdark',5)
        c.line([(16,15),(11,25)],'clothdark',4)
        c.line([(3,22),(26,15)],'ink',5);c.line([(3,22),(26,15)],'grain',2)
        c.poly([(24,12),(30,14),(25,18)],'steel')
        c.line([(5,9),(6,5),(12,3),(17,4)],'sage',2)
        c.poly([(15,1),(20,5),(15,7)],'sage')
        c.ell((10,19,15,24),'ink','brass')
    elif name=='spear_wall':
        c.poly([(4,23),(16,19),(28,23),(27,28),(5,28)],'iron')
        for x,y in [(7,8),(16,4),(25,8)]:
            c.line([(x,25),(x,y+5)],'wood',3)
            c.poly([(x-3,y+6),(x,y),(x+3,y+6)],'steel')
            c.line([(x,y+2),(x,y+4)],'edge')
        c.line([(5,26),(26,26)],'sage')
    elif name=='archery_aimed':
        c.line([(7,5),(13,9),(16,17),(12,24),(6,28)],'ink',4)
        c.line([(7,5),(12,10),(14,17),(11,23),(6,28)],'grain',2)
        c.line([(7,5),(7,28)],'cloth')
        c.line([(4,18),(23,17)],'wood',2);c.poly([(21,14),(28,17),(22,20)],'steel')
        c.ell((18,4,28,14),'dark','sage');c.line([(23,2),(23,8)],'ivory');c.line([(23,11),(23,16)],'ivory')
        c.line([(16,9),(21,9)],'ivory');c.line([(25,9),(30,9)],'ivory');c.dot(23,9,'brasslight')
    elif name=='archery_calm':
        c.ell((11,8,20,17),'clothdark');c.line([(14,17),(10,26)],'teal',5)
        c.line([(15,19),(24,19)],'bone',2)
        c.line([(23,9),(27,14),(27,23),(23,28)],'grain',2)
        c.line([(23,9),(23,28)],'cloth')
        c.line([(5,10),(4,6),(9,3)],'sage',2);c.line([(11,3),(17,3),(21,6)],'sage',2)
        c.line([(7,24),(5,26),(6,29)],'sage')
        c.line([(13,12),(16,12)],'ink');c.dot(19,14,'bone')
    elif name=='archery_leg_shot':
        c.line([(21,5),(19,17),(13,28)],'clothdark',5)
        c.line([(19,17),(25,27)],'clothdark',4)
        c.ell((11,18,22,29),'dark','redlight')
        c.line([(3,10),(16,22)],'wood',2)
        c.poly([(13,21),(18,25),(17,18)],'steel')
        c.line([(4,9),(2,12)],'cloth',2);c.line([(7,12),(5,15)],'cloth')
        c.line([(16,27),(18,24)],'redlight')
    elif name=='archery_recover':
        c.line([(4,27),(27,27)],'clothdark')
        c.line([(6,25),(23,12)],'wood',2);c.poly([(21,11),(27,9),(24,16)],'steel')
        c.line([(4,22),(7,26),(10,27)],'cloth',2)
        c.poly([(11,6),(15,7),(15,13),(19,15),(18,20),(14,22),(10,19),(9,15),(11,12)],'bone')
        c.line([(13,14),(15,17),(17,17)],'clothdark')
        c.line([(24,22),(28,19),(29,14)],'sage',2);c.poly([(27,16),(29,11),(31,16)],'sage')
    elif name=='amalgam_spore_burst':
        c.poly([(12,27),(11,20),(13,16),(18,15),(22,19),(21,26)],'clothdark')
        c.ell((12,12,20,21),'sage');c.ell((15,15,18,18),'dark')
        for x,y,r in [(7,7,3),(19,4,2),(26,10,2),(25,22,2),(4,20,2),(12,3,1),(3,12,1),(27,16,1),(9,15,1)]:
            c.ell((x-r,y-r,x+r,y+r),'leaflight','leafdark')
        for pts in [[(10,10),(12,12)],[(20,9),(19,11)],[(23,14),(21,15)],[(9,21),(7,23)],[(22,24),(24,26)]]:c.line(pts,'sage')
    elif name=='shade_lunge':
        c.ell((17,4,24,11),'clothdark');c.line([(19,12),(13,18),(19,22)],'teal',5)
        c.line([(13,18),(6,25)],'sage',3);c.line([(18,22),(25,27)],'sage',3)
        c.line([(18,14),(27,12)],'bone',2);c.poly([(25,12),(30,8),(28,14)],'steel')
        for x,y in [(3,9),(1,14),(4,19)]:c.line([(x,y),(x+8,y)],'iron',2)
    elif name=='amalgam_sweep':
        c.ell((11,12,21,25),'clothdark');c.line([(14,17),(7,10),(3,12)],'bone',3)
        c.line([(18,16),(24,7),(28,8)],'bone',3);c.line([(19,20),(27,19),(29,24)],'bone',3)
        c.line([(5,5),(11,2),(21,2),(27,5)],'sage',2);c.poly([(25,2),(30,6),(25,7)],'sage')
    elif name=='grab':
        c.poly([(4,22),(8,16),(10,9),(13,7),(16,10),(18,7),(21,9),(22,13),(27,11),(29,14),(25,18),(22,25),(17,29),(10,28)],'bone')
        c.line([(7,6),(12,13),(24,23)],'teal',6);c.line([(9,6),(15,13),(25,21)],'sage',3)
        c.line([(12,12),(10,17),(15,20)],'ink');c.line([(20,13),(17,17)],'ink')
    else:raise ValueError(name)


# Every assignment below is explicit. No hash/random decoration selects a shape.
# Similar materials share physical construction, then receive meaningful seams,
# grain, rings, facets, bindings or state changes in the relevant drawing above.
SPECS = {}
def group(family, entries):
    for item,variant in entries.items():
        assert item not in SPECS,item
        SPECS[item]={'family':family,'variant':variant}

group('misc', {
 'Hood':'hood','AshMask':'mask','LeatherApron':'apron','OilclothCloak':'cloak','OiledRaincoat':'raincoat',
 'Lute':'lute','Hardtack':'hardtack','SeedVaultKey':'key','MedicalBag':'medical_bag',
 'SteelIngot':'steel_ingot','RawHide':'hide','Linen':'linen','Wool':'wool','Wax':'wax',
 'SharpeningStone':'sharpen','ScrapHelmet':'helmet','Boots':'boots','BoneCharm':'charm','SealRing':'ring',
 'Tourniquet':'tourniquet','Splint':'splint','Painkiller':'painkiller','Lantern':'lantern','Bones':'bones',
 'AshLeaf':'ash_leaf','BitterMoss':'moss','ScrapBuckler':'buckler','MachinePatch':'machine_patch',
 'SmallActuator':'actuator','HydraulicFluid':'fluid','LowPowerCell':'low_cell','WeldNozzle':'nozzle','Ink':'ink',
 'RawFragment':'fragment','IronIngot':'iron_ingot','AlloyScrap':'alloy_scrap','AshWolfHide':'wolf_hide',
 'MissingPlaceholder':'missing','PineNeedles':'pine','Rope':'rope','LeatherStrap':'strap','GlassShard':'glass',
 'ClothFilter':'filter','Sand':'sand','CoracleKit':'coracle','WhitecapCulture':'culture','CorporateCodePlate':'plate',
})
group('tool',{'LightCrossbow':'crossbow','Pole':'pole','Needle':'needle','Tongs':'tongs','StoneHammer':'stone_hammer','IronHammer':'iron_hammer','PipeClub':'club','AlloyClub':'alloy_club'})
group('tool',{'Bolt':'bolt'})
group('distinct_water',{'WaterPill':'water_pill','DirtyWaterBottle':'dirty_water','PineTeaBottle':'pine_tea','CharcoalFilter':'charcoal_filter'})
group('shirt',{'LeatherCoat':'coat','RagShirt':'rag','PaddedJacket':'padded','ScrapMail':'mail','CustomShirt':'custom_shirt','CustomMail':'custom_mail','CustomCoat':'custom_coat','IronMail':'iron_mail','SteelMail':'steel_mail','WoolShirt':'wool_shirt','WolfCoat':'wolf_coat','OilclothShirt':'oil_shirt'})
group('book',{'Note':'note','OldMap':'map','OldLedger':'ledger','SeedVaultLedger':'seed','CraftManual':'craft','SignalMaintenanceManual':'signal','MedicalGuide':'medical','FieldManual':'firstaid','WardRecords':'ward','SurvivalGuide':'survival','AlphabetPrimer':'alphabet','PioneerDictionary':'dictionary','PioneerPharmacopoeia':'pharma','PillPrimer':'pill','HighlandBestiary':'bestiary','MaterialManual':'material','SaltworkManual':'salt','CoastalBoatManual':'boat','ChimneyHalfManual':'chimney','CalvisJournal':'journal'})
group('bedding',{'FieldMat':'mat','Bedroll':'bedroll','StrawBed':'straw','Bed':'bed','GoodBed':'good'})
group('kit',{'WorkbenchKit':'bench','ForgeKit':'forge','LoomKit':'loom','TanningVatKit':'vat','ArtisanKit':'artisan'})
group('bottle',{'TetanusSerum':'serum','Moonshine':'moonshine','LampOil':'oil','WillowTea':'willow','PoppyTincture':'poppy'})
group('vegetables',{'Cabbage':'cabbage','CabbageSeed':'cabbage_seed','RawPotato':'raw_potato','BakedPotato':'baked_potato','Turnip':'turnip','AshBerry':'berry','Cheese':'cheese','PotatoSeed':'potato_seed','TurnipSeed':'turnip_seed','DriedApple':'apple','AshCap':'mushroom'})
group('jar',{'CeramicJar':'empty','PickledCabbageJar':'filled'})
group('meat',{'RawMeat':'raw','SmokedMeat':'smoked','Jerky':'jerky','AirDriedMeat':'dried','RoastedMeat':'roast','RawRatMeat':'rat_raw','CookedRatMeat':'rat_cooked','SaltedMeat':'salted'})
group('dagger',{'HuntingKnife':'hunting','CustomKnife':'custom','SteelKnife':'steel','BoneKnife':'bone'})
group('axe',{'CustomHatchet':'custom','SteelHatchet':'steel','FlintHatchet':'flint','AlloyHatchet':'alloy'})
group('gloves',{'Gloves':'leather','WoolGloves':'wool'})
group('prosthetic',{'PegLeg':'peg','ArticulatedLeg':'joint_leg','HookHand':'hook','PioneerArm':'arm','GardenerLimb':'gardener'})
group('ration',{'RationPack':'sealed','OpenedRationPack':'opened','EmptyRationWrapper':'empty'})
group('tin',{'CannedMeat':'sealed','OpenedCannedMeat':'opened','EmptyTin':'empty'})

DRAWERS={k:v for k,v in globals().copy().items() if k in ['misc','tool','shirt','book','bedding','kit','bottle','vegetables','meat','dagger','axe','prosthetic','ration','tin','distinct_water']}
DRAWERS['gloves']=lambda c,v:gloves(c,v=='wool')
DRAWERS['jar']=lambda c,v:jar(c,v=='filled')

# These names can occur in older icon calls/simple mods. Actual resolved Defs
# receive unique keys through patches; these aliases never reintroduce sharing
# for those Defs. Existing registered frames belong to other original sheets.
LEGACY_ALIAS_TARGETS={
 'hood':'complete_item_hood', 'bow':'original_hunting_bow',
 'rebar_spear':'original_rebar_spear', 'leather_coat':'complete_item_leather_coat',
 'oilcloth_cloak':'complete_item_oilcloth_cloak', 'note':'complete_item_note',
 'bones':'complete_item_bones', 'hardtack':'complete_item_hardtack',
 'cloth':'original_hearth_cloth', 'bandage':'original_hearth_bandage',
 'moonshine':'complete_item_moonshine', 'rag_shirt':'complete_item_rag_shirt',
 'arrow':'ashveil_arrow_bundle', 'pipe_club':'complete_item_pipe_club',
 'ash_cap':'complete_item_ash_cap', 'raw_meat':'complete_item_raw_meat',
 'jerky':'complete_item_jerky', 'padded_jacket':'complete_item_padded_jacket',
 'scrap_mail':'complete_item_scrap_mail', 'scrap_helmet':'complete_item_scrap_helmet',
 'boots':'complete_item_boots', 'gloves':'complete_item_gloves',
 'knife':'complete_item_hunting_knife', 'tourniquet':'complete_item_tourniquet',
 'splint':'complete_item_splint', 'painkiller':'complete_item_painkiller',
 'dried_apple':'complete_item_dried_apple', 'canned_meat':'complete_item_canned_meat',
 'lantern':'complete_item_lantern', 'buckler':'complete_item_scrap_buckler',
 'hatchet':'original_hatchet', 'rusty_knife':'original_rusty_knife',
 'food_strawberry':'complete_item_ash_berry', 'food_cheese':'complete_item_cheese',
}


def snake(value):
    value=value.replace('.', '_')
    value=re.sub(r'([a-z0-9])([A-Z])',r'\1_\2',value)
    return value.lower()


def content_patches(before):
    """Choose operations against raw Defs: patches run before inheritance.

    Object add also sets an already present field, so an earlier source patch
    that supplies an inherited icon does not invalidate this raw-based choice.
    """
    raw={}
    for path in sorted((ROOT/'src/content/core/defs').rglob('*.json')):
        data=json.loads(path.read_text())
        definitions=data if isinstance(data,list) else [data]
        for definition in definitions:
            if not isinstance(definition,dict) or 'id' not in definition:continue
            id=definition['id']
            assert id not in raw,('Duplicate raw definition',id,path)
            raw[id]=definition
    patches=[]
    for kind,field,prefix in [('items','sprite','complete_item_'),('abilities','icon','complete_ability_')]:
        consumers={x['id']:x for x in before['consumers'][kind]}
        for definition in before['definitions'][kind]:
            id=definition['id']
            if preserve_original(consumers[id]):continue
            assert id in raw,('Missing raw definition',id)
            op='replace' if field in raw[id] else 'add'
            patches.append({'op':op,'target':id,'path':'/'+field,'value':prefix+snake(id.split('.',1)[1])})
    return patches


def svg(im, title):
    width,height=im.size
    parts=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" shape-rendering="crispEdges"><title>{escape(title)}</title>']
    for y in range(height):
        x=0
        while x<width:
            color=im.getpixel((x,y));end=x+1
            while end<width and im.getpixel((end,y))==color:end+=1
            if color[3]:parts.append(f'<rect x="{x}" y="{y}" width="{end-x}" height="1" fill="#{color[0]:02x}{color[1]:02x}{color[2]:02x}"/>')
            x=end
    return '\n'.join(parts+['</svg>'])+'\n'


def contract(path, size=(32,32)):
    data=path.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n',path
    pos=8;raw=b'';ihdr=None;end=False
    while pos<len(data):
        chunk_size=struct.unpack('>I',data[pos:pos+4])[0];kind=data[pos+4:pos+8];chunk=data[pos+8:pos+8+chunk_size]
        assert zlib.crc32(kind+chunk)&0xffffffff==struct.unpack('>I',data[pos+8+chunk_size:pos+12+chunk_size])[0],(path,kind,'crc')
        if kind==b'IHDR':ihdr=struct.unpack('>IIBBBBB',chunk)
        if kind==b'IDAT':raw+=chunk
        if kind==b'IEND':end=True
        pos+=chunk_size+12
    assert end and pos==len(data),path
    width,height=size
    assert ihdr==(width,height,8,6,0,0,0),(path,ihdr)
    assert len(zlib.decompress(raw))==height*(width*4+1),path
    with Image.open(path) as im:
        assert im.mode=='RGBA' and im.size==size,path
        alphas=set(im.getchannel('A').tobytes());assert alphas=={0,255},(path,alphas)
        bbox=im.getbbox();assert bbox and 0<=bbox[0]<bbox[2]<=width and 0<=bbox[1]<bbox[3]<=height,path
        opaque=sum(a==255 for a in im.getchannel('A').tobytes());assert 50<opaque<width*height,(path,opaque)
    return {'sha256':hashlib.sha256(data).hexdigest(),'opaquePixels':opaque,'bounds':list(bbox),'rgba':[width,height,8,6],'crc':'pass'}


def contacts(rows):
    font_path='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    font=ImageFont.truetype(font_path,11)
    paths=[]
    for section,subset in [('items',[r for r in rows if r['action']=='authored' and r['kind']=='Item']),('abilities',[r for r in rows if r['action']=='authored' and r['kind']=='Ability']),('maneuvers',[r for r in rows if r['kind']=='Maneuver']),('distinct-items',[r for r in rows if r['id'] in SPLIT_ORIGINAL_ITEMS]),('ability-splits',[r for r in rows if r['kind']=='Ability' and all(b['original'] for b in r['before'])])]:
        per=48
        for offset in range(0,len(subset),per):
            entries=subset[offset:offset+per];cols=8;cw,ch=168,132
            contact=Image.new('RGB',(cols*cw,((len(entries)+cols-1)//cols)*ch),'#242c2e');d=ImageDraw.Draw(contact)
            for i,r in enumerate(entries):
                x=(i%cols)*cw;y=(i//cols)*ch
                d.rectangle((x+5,y+4,x+162,y+105),fill='#303c3d')
                im=Image.open(ROOT/'public'/r['url'])
                # Enlarged nearest pixels plus an exact native 32px preview.
                contact.paste(im.resize((96,96),Image.Resampling.NEAREST),(x+9,y+7),im.resize((96,96),Image.Resampling.NEAREST))
                contact.paste(im,(x+120,y+65),im)
                label=r['id'].split('.',1)[1]
                if len(label)>24:
                    split=next((m.start() for m in re.finditer(r'[A-Z]',label) if m.start()>10),17)
                    d.text((x+5,y+107),label[:split],fill='#d5ceb0',font=font)
                    d.text((x+5,y+119),label[split:],fill='#d5ceb0',font=font)
                else:d.text((x+5,y+110),label,fill='#d5ceb0',font=font)
            dest=OUT/f'contact-{section}-{offset//per+1:02}.png';contact.save(dest);paths.append(str(dest.relative_to(ROOT)))
    return paths


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');ap.add_argument('--patches-only',action='store_true',help='Regenerate raw-field-aware content operations without writing images.');args=ap.parse_args()
    before=json.loads((ART/'complete-catalog-v302-before.json').read_text())
    patches=content_patches(before)
    patch_counts={op:sum(p['op']==op for p in patches) for op in ['add','replace']}
    if args.patches_only:
        patch_path=ART/'complete-items.patches.json'
        if args.check:assert json.loads(patch_path.read_text())==patches
        else:patch_path.write_text(json.dumps(patches,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps({'checked':args.check,'patches':len(patches),'operations':patch_counts,'sha256':hashlib.sha256(patch_path.read_bytes()).hexdigest()}))
        return
    rows=[];fragment={'sheets':{},'frames':{}};integrity={};original_images={}
    OUT.mkdir(parents=True,exist_ok=True)
    needed={x['id'].split('.',1)[1] for x in before['consumers']['items'] if not preserve_original(x)}
    assert set(SPECS)==needed,{'missing':sorted(needed-set(SPECS)),'extra':sorted(set(SPECS)-needed)}
    for kind,defkey,field,prefix in [('Item','items','sprite','complete_item_'),('Ability','abilities','icon','complete_ability_')]:
        consumers={x['id']:x for x in before['consumers'][defkey]}
        for definition in before['definitions'][defkey]:
            id=definition['id'];con=consumers[id];original=preserve_original(con)
            row={'id':id,'kind':kind,'label':definition['label'],'description':definition.get('description',''),'before':con['bindings'],'action':'preserved' if original else 'authored'}
            if original:
                row['key']=definition[field];row['bindings']=con['bindings']
            else:
                suffix=id.split('.',1)[1];name=snake(suffix);key=prefix+name
                if kind=='Item':spec=SPECS[suffix];draw=DRAWERS[spec['family']];variant=spec['variant']
                else:variant=name;spec={'family':'ability','variant':variant};draw=ability
                c=Canvas();draw(c,variant)
                original_images[key]=c.im.copy()
                png=OUT/(key+'.png');source=OUT/(key+'.svg')
                if not args.check:
                    c.im.save(png,optimize=False);source.write_text(svg(c.im,id+' / '+definition['label']),encoding='utf-8')
                else:
                    assert Image.open(png).tobytes()==c.im.tobytes(),id
                    assert source.read_text()==svg(c.im,id+' / '+definition['label']),id
                url=str(png.relative_to(ROOT/'public'))
                fragment['sheets'][key]=url;fragment['frames'][key]=[key,0,0,32,32]
                integrity[key]=contract(png)
                row.update(key=key,url=url,source=str(source.relative_to(ROOT)),art=spec)
                if id in SPLIT_ORIGINAL_ITEMS:row['originalSplitReason']=SPLIT_ORIGINAL_ITEMS[id]
            rows.append(row)
    # A literal HUD consumer, not an Ability Def; no content patch is generated.
    c=Canvas();maneuver_shove(c);key='shove';png=OUT/'complete-maneuver-shove.png';source=OUT/'complete-maneuver-shove.svg'
    if not args.check:
        c.im.save(png);source.write_text(svg(c.im,'HUD shove / 밀치기'),encoding='utf-8')
    else:
        assert Image.open(png).tobytes()==c.im.tobytes()
        assert source.read_text()==svg(c.im,'HUD shove / 밀치기')
    url=str(png.relative_to(ROOT/'public'));fragment['sheets'][key]=url;fragment['frames'][key]=[key,0,0,32,32]
    integrity[key]=contract(png)
    original_images[key]=c.im.copy()
    rows.append({'id':'Hud.shove','kind':'Maneuver','label':'밀치기','description':'HUD MANEUVERS literal shove icon; a basic physical action, not an Ability Def.','before':[{'key':'shove','url':'tiles/shove.png','original':False}],'action':'authored','key':'shove','url':url,'source':str(source.relative_to(ROOT)),'art':{'family':'maneuver','variant':'open_hand_shove'}})
    # Pack the just-authored memory canvases, without opening any image input.
    # Individual PNG/SVG files remain editable evidence; only one atlas is loaded.
    atlas_key='complete_items_atlas_v302';atlas_path=OUT/'complete-items-atlas.png';atlas_source=OUT/'complete-items-atlas.svg'
    atlas_height=((len(original_images)+15)//16)*32
    atlas=Image.new('RGBA',(512,atlas_height),(0,0,0,0));packed={}
    for i,(key,im) in enumerate(original_images.items()):
        x,y=(i%16)*32,(i//16)*32;atlas.paste(im,(x,y))
        packed[key]=[atlas_key,x,y,32,32]
    if not args.check:
        atlas.save(atlas_path);atlas_source.write_text(svg(atlas,'ASHVEIL v302 / 149 items + 28 abilities + HUD shove'),encoding='utf-8')
    else:
        assert Image.open(atlas_path).tobytes()==atlas.tobytes(),'Packed atlas differs from authored canvas'
        assert atlas_source.read_text()==svg(atlas,'ASHVEIL v302 / 149 items + 28 abilities + HUD shove')
    loaded_atlas=Image.open(atlas_path)
    for key,im in original_images.items():
        _,x,y,w,h=packed[key]
        assert loaded_atlas.crop((x,y,x+w,y+h)).tobytes()==im.tobytes(),key
        assert loaded_atlas.crop((x,y,x+w,y+h)).tobytes()==Image.open(OUT/('complete-maneuver-shove.png' if key=='shove' else key+'.png')).tobytes(),key
    atlas_url=str(atlas_path.relative_to(ROOT/'public'))
    fragment['sheets']={atlas_key:atlas_url};fragment['frames']=packed.copy()
    for row in rows:
        if row['action']=='authored':row['packedFrame']=packed[row['key']]
    atlas_info={'sheet':atlas_key,'url':atlas_url,'source':str(atlas_source.relative_to(ROOT)),'size':list(atlas.size),'columns':16,'cellSize':[32,32],'frames':178,'exactIndividualRgbaMatches':178,**contract(atlas_path,atlas.size)}
    aliases=[]
    for alias,target in LEGACY_ALIAS_TARGETS.items():
        if alias in before['registry']['frames']:continue
        frame=fragment['frames'].get(target) or before['registry']['frames'].get(target)
        assert frame,(alias,target)
        fragment['frames'][alias]=frame[:]
        aliases.append({'key':alias,'target':target,'frame':frame[:],'purpose':'Legacy icon callers/simple mod compatibility only; resolved Item/Ability definitions use their specific patched key.'})
    hashes=[v['sha256'] for v in integrity.values()];assert len(hashes)==len(set(hashes)), 'New icon pixel duplicates'
    assert len(patches)==177 and len(fragment['sheets'])==1
    assert not (set(fragment['frames']) & set(before['registry']['frames'])), 'Existing frame overwritten'
    assert sum(r['action']=='preserved' and r['kind']=='Item' for r in rows)==57
    assert sum(r['action']=='preserved' and r['kind']=='Ability' for r in rows)==0
    item_keys=[r['key'] for r in rows if r['kind']=='Item'];assert len(item_keys)==len(set(item_keys))==206,'Different Item Defs still share an icon key'
    ability_keys=[r['key'] for r in rows if r['kind']=='Ability'];assert len(ability_keys)==len(set(ability_keys))==28
    catalog={'version':'v302','scope':'206 resolved Item and 28 resolved Ability definitions from complete-catalog-v302-before.json plus one directly consumed HUD maneuver','sourcePolicy':'No PNG/image inputs used for authorship. Integer-coordinate authored primitives; semantic templates have explicit material/state details. Existing original files preserved; five semantically shared Item Defs and all 28 Ability Defs receive distinct meaningful bindings. Palette does not declare gameplay effects.','palette':PALETTE,'counts':{'items':206,'abilities':28,'newItemOriginals':149,'newAbilityOriginals':28,'newHudManeuvers':1,'preservedItems':57,'preservedAbilities':0,'sharedItemIconGroups':0},'splitOriginalItemBindings':SPLIT_ORIGINAL_ITEMS,'abilityBindingPolicy':'All 28 abilities have distinct action diagrams. Previously referenced weapon/pill originals remain available for actual Item definitions and legacy callers.','packedAtlas':atlas_info,'legacyAliases':aliases,'legacyPropKeysExcluded':['pot0','pot1','crate_closed','stump','rubble0','chest'],'entries':rows}
    if not args.check:
        for p,value in [(ART/'complete-items.fragment.json',fragment),(ART/'complete-items.patches.json',patches),(OUT/'catalog.json',catalog),(OUT/'integrity.json',integrity),(OUT/'atlas-integrity.json',atlas_info)]:p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
        cp=contacts(rows)
        contact=Image.new('RGBA',atlas.size,'#303c3d');contact.alpha_composite(atlas);contact=contact.resize((1024,atlas_height*2),Image.Resampling.NEAREST)
        atlas_contact=OUT/'contact-atlas.png';contact.convert('RGB').save(atlas_contact);cp.append(str(atlas_contact.relative_to(ROOT)))
        (OUT/'contacts.json').write_text(json.dumps(cp,indent=2)+'\n')
    else:
        assert json.loads((ART/'complete-items.fragment.json').read_text())==fragment
        assert json.loads((ART/'complete-items.patches.json').read_text())==patches
        assert json.loads((OUT/'catalog.json').read_text())==catalog
        assert json.loads((OUT/'integrity.json').read_text())==integrity
        assert json.loads((OUT/'atlas-integrity.json').read_text())==atlas_info
    print(json.dumps({'checked':args.check,'newItems':149,'newAbilities':28,'newHudManeuvers':1,'legacyAliases':len(aliases),'preservedItems':57,'preservedAbilities':0,'uniqueNewPngs':len(set(hashes)),'allItemsCovered':206,'allAbilitiesCovered':28,'sharedItemIconGroups':0,'registeredSheets':1,'atlasSize':list(atlas.size),'atlasExactMatches':178,'patchOperations':patch_counts,'pngCrcRgbaAlphaBounds':'pass'},ensure_ascii=False))


if __name__=='__main__':main()
