#!/usr/bin/env python3
"""ASHVEIL v302 props: original integer-pixel constructions, never PNG inputs.

Every silhouette, contour, material cluster and animation path below is authored
in this file. Pillow only rasterizes these new coordinates. The exported SVGs
contain integer scanline rectangles and are editable pixel-exact source copies.
Run: python tools/art/draw-complete-props.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse
import hashlib
import io
import json
import math

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--check",action="store_true",help="compare deterministic generated artifacts with disk without writing")
CHECK=parser.parse_args().check
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/sprites/original/complete/props"
FRAGMENT = ROOT / "tools/art/complete-props.fragment.json"
if not CHECK:OUT.mkdir(parents=True, exist_ok=True)
EMITTED=0


def emit_bytes(path,data):
    global EMITTED
    if CHECK:
        assert path.is_file(),f"missing generated artifact: {path.relative_to(ROOT)}"
        assert path.read_bytes()==data,f"stale generated artifact: {path.relative_to(ROOT)}"
    else:
        path.write_bytes(data)
    EMITTED+=1


def emit_text(path,data):
    emit_bytes(path,data.encode("utf-8"))


def emit_png(path,im):
    encoded=io.BytesIO()
    im.save(encoded,format="PNG",optimize=True)
    data=encoded.getvalue()
    emit_bytes(path,data)
    return data

P = {
    "ink": "#171d1c", "black": "#101615", "deep": "#29342f",
    "sd": "#3e4b45", "stone": "#606e61", "sl": "#8a9480",
    "shine": "#b1b59a", "moss": "#445b4c", "teald": "#304d4a",
    "teal": "#496e66", "tl": "#7c9a87", "woodd": "#342e25",
    "wood": "#574735", "wl": "#887052", "ivoryd": "#817f6b",
    "ivory": "#bdb99a", "il": "#dbd1ad", "brassd": "#513e2e",
    "brass": "#89633e", "bl": "#b99051", "rust": "#7c4a39",
    "redd": "#442d2b", "red": "#6f4039", "rl": "#a36551",
    "ember": "#bb5e36", "flame": "#d99b51", "firelight": "#f0cd81",
    "water": "#213d3e", "ash": "#646e65",
}


class C:
    def __init__(self, w, h, unit=1):
        self.w, self.h, self.unit = w, h, unit
        self.im = Image.new("RGBA", (w, h))
        self.d = ImageDraw.Draw(self.im)

    def col(self, c):
        return P.get(c, c)

    def rect(self, x, y, w, h, c):
        u = self.unit
        self.d.rectangle((x*u, y*u, (x+w)*u-1, (y+h)*u-1), fill=self.col(c))

    def dot(self, x, y, c):
        self.rect(x, y, 1, 1, c)

    def poly(self, pts, c):
        # Rasterize logical polygon then enlarge its newly authored pixels.
        # This gives big scenery the same square cluster rhythm as 16px props.
        if self.unit == 1:
            self.d.polygon(pts, fill=self.col(c))
        else:
            logical = Image.new("RGBA", (self.w//self.unit, self.h//self.unit))
            ImageDraw.Draw(logical).polygon(pts, fill=self.col(c))
            scaled = logical.resize((self.w, self.h), Image.Resampling.NEAREST)
            self.im.alpha_composite(scaled)
            self.d = ImageDraw.Draw(self.im)

    def line(self, pts, c, width=1):
        if self.unit == 1:
            self.d.line(pts, fill=self.col(c), width=width)
        else:
            logical = Image.new("RGBA", (self.w//self.unit, self.h//self.unit))
            ImageDraw.Draw(logical).line(pts, fill=self.col(c), width=width)
            self.im.alpha_composite(logical.resize((self.w,self.h), Image.Resampling.NEAREST))
            self.d = ImageDraw.Draw(self.im)


ART = {}
SHEET_OF = {}
NOTES = {}


def add(key, sheet, canvas, note):
    assert key not in ART, key
    ART[key] = canvas.im
    SHEET_OF[key] = sheet
    NOTES[key] = note


def bands(c, x, y, w, h, material="stone"):
    """Chipped ledge, not a universal object: used only on masonry plinths."""
    c.rect(x,y,w,h,"ink")
    c.rect(x+1,y,w-2,1,"sl")
    c.rect(x+1,y+1,w-2,max(1,h-2),material)
    c.rect(x+2,y+h-1,w-3,1,"sd")
    c.dot(x+w-3,y,"sd")


def pot(kind):
    c=C(16,32)
    # Three independent mouth/body profiles: tall pitcher, stout jar, shattered jar.
    if kind==0:
        c.poly([(5,7),(11,7),(12,10),(12,15),(14,19),(13,27),(11,30),(4,30),(2,26),(2,20),(4,15),(4,10)],"ink")
        c.rect(5,8,6,3,"teal"); c.rect(6,9,4,1,"black")
        c.poly([(5,13),(10,13),(10,17),(12,20),(11,27),(9,29),(5,28),(4,24),(4,20),(6,16)],"stone")
        c.poly([(9,14),(11,16),(13,20),(12,26),(10,28),(9,23)],"teald")
        c.rect(5,8,6,1,"sl"); c.rect(5,18,6,2,"teal")
        c.line([(5,20),(5,25),(6,26)],"sl");c.dot(6,15,"shine")
        c.line([(11,12),(14,12),(15,14),(15,18),(13,20)],"ink",2)
        c.line([(12,13),(14,14),(14,17),(13,18)],"brass")
    elif kind==1:
        c.poly([(4,13),(11,13),(12,17),(14,20),(14,26),(11,30),(4,30),(1,26),(1,21),(3,17)],"ink")
        c.rect(4,14,7,3,"brassd"); c.rect(5,15,5,1,"black")
        c.poly([(4,18),(11,18),(13,21),(12,27),(10,29),(5,29),(3,25),(3,22)],"brass")
        c.poly([(10,19),(12,21),(11,27),(9,28),(9,22)],"rust")
        c.line([(3,22),(12,22)],"brassd"); c.line([(4,23),(11,23)],"bl")
        c.line([(5,19),(4,21),(4,24)],"bl"); c.rect(4,14,7,1,"bl")
        c.dot(6,27,"wl");c.dot(11,25,"brassd")
    else:
        c.poly([(2,23),(4,18),(6,20),(7,16),(9,20),(11,18),(14,22),(13,28),(10,30),(4,30)],"ink")
        c.poly([(3,23),(5,20),(7,23),(9,21),(11,20),(13,23),(11,28),(5,28)],"stone")
        c.poly([(5,22),(8,24),(11,22),(11,25),(9,27),(5,26)],"black")
        c.line([(3,23),(5,20),(7,23)],"sl");c.line([(9,21),(11,20),(13,23)],"sl")
        c.poly([(1,29),(3,28),(4,30),(1,31)],"stone"); c.dot(14,30,"sl")
    return c


for i in range(3):
    add(f"pot{i}","kt_props",pot(i),["handled glazed ewer","squat brass-banded urn","broken open ceramic urn"][i])


def temple_statue():
    c=C(48,80,2)
    # Hooded archivist, cradling a circular seal. Distinct from the later bound idol.
    bands(c,3,35,18,4)
    bands(c,5,32,14,3)
    c.poly([(8,32),(9,23),(7,19),(6,15),(8,12),(9,7),(11,4),(14,4),(16,7),(17,12),(19,15),(18,21),(16,24),(17,32)],"ink")
    c.poly([(9,30),(10,21),(8,17),(9,13),(11,11),(10,8),(12,5),(14,6),(15,11),(17,14),(17,19),(15,23),(15,30)],"stone")
    c.poly([(10,9),(11,7),(14,7),(15,10),(14,13),(11,13)],"deep")
    c.rect(11,9,3,2,"sd");c.dot(11,9,"sl")
    c.poly([(9,13),(11,15),(11,18),(8,18),(7,16)],"sl")
    c.poly([(15,13),(17,15),(17,18),(14,18),(13,16)],"sd")
    c.poly([(10,16),(14,15),(16,18),(15,22),(11,23),(9,20)],"ink")
    c.poly([(11,17),(14,16),(15,18),(14,21),(11,21),(10,19)],"brass")
    c.line([(11,18),(13,17),(14,19),(12,20),(11,18)],"bl")
    c.line([(10,24),(10,29),(9,31)],"sl"); c.line([(13,24),(12,31)],"sd")
    c.line([(14,25),(15,29),(14,31)],"sl")
    c.rect(7,33,4,1,"sl");c.rect(16,35,3,2,"moss");c.dot(7,37,"sd")
    c.line([(5,36),(7,36),(8,38)],"ink")
    return c


add("statue","kt_props",temple_statue(),"hooded archivist with eroded face, clasped bronze seal, stepped plinth")


def sarcophagus():
    c=C(80,96,2)
    # A slanted long coffin, lid portrait and corroded binding clamps.
    c.poly([(13,3),(29,3),(34,8),(36,35),(31,44),(10,44),(5,37),(7,10)],"ink")
    c.poly([(13,5),(28,5),(32,9),(34,35),(29,40),(10,40),(7,35),(9,11)],"sd")
    c.poly([(13,6),(27,6),(30,10),(32,34),(28,38),(11,38),(9,34),(11,12)],"stone")
    c.line([(13,6),(27,6),(30,10),(32,34)],"sl",2)
    c.line([(13,9),(25,9),(28,12),(29,32),(26,35),(13,35),(11,32),(13,14),(13,9)],"deep")
    c.poly([(18,11),(22,11),(24,14),(23,18),(20,19),(17,17),(17,14)],"sl")
    c.rect(19,14,3,1,"deep");c.line([(20,16),(21,17)],"sd")
    c.poly([(16,19),(23,19),(26,24),(24,33),(15,33),(14,25)],"sd")
    c.line([(17,20),(20,24),(23,20)],"sl");c.line([(15,25),(24,25)],"stone")
    c.line([(17,27),(17,31),(22,31),(22,27)],"stone")
    for x,y in [(9,14),(30,14),(8,29),(31,29)]:
        c.rect(x,y,3,4,"brassd"); c.rect(x,y,2,1,"bl");c.dot(x+1,y+2,"rust")
    c.poly([(8,38),(11,42),(29,42),(33,38),(31,45),(10,46),(6,40)],"deep")
    c.line([(11,42),(29,42)],"stone");c.rect(14,43,5,1,"moss")
    c.line([(27,7),(26,11),(28,14)],"ink");c.dot(12,30,"shine")
    return c


add("sarcophagus","kt_props",sarcophagus(),"long chamfered stone coffin, carved recumbent body and four corroded clamps")


def column():
    c=C(48,128,2)
    bands(c,2,58,20,5)
    bands(c,4,54,16,4)
    c.poly([(7,54),(6,16),(4,14),(4,11),(8,10),(9,6),(12,8),(14,3),(16,7),(19,8),(19,13),(17,17),(17,54)],"ink")
    c.poly([(8,53),(7,17),(6,13),(9,12),(10,9),(12,11),(15,7),(17,9),(17,14),(15,18),(16,53)],"stone")
    c.poly([(9,15),(10,18),(10,52),(8,52)],"sl")
    c.rect(11,18,2,34,"sd");c.rect(14,18,1,34,"deep")
    c.line([(8,14),(10,13),(12,15),(15,11),(17,12)],"shine")
    c.line([(8,29),(10,32),(9,36),(11,39)],"ink")
    c.line([(14,44),(12,47),(13,51)],"deep")
    c.poly([(4,53),(7,51),(9,54),(7,57),(3,57)],"sd")
    c.poly([(17,54),(20,52),(22,56),(20,58),(16,57)],"stone")
    c.line([(17,54),(20,53),(21,55)],"sl")
    c.rect(4,59,4,1,"moss");c.rect(15,61,3,1,"sd")
    return c


add("broken_column","kt_props",column(),"128px contractual column, fractured capital, fluted shaft, base rubble")


def niche():
    c=C(64,64,2)
    c.poly([(3,29),(3,11),(5,6),(10,2),(22,2),(27,6),(29,11),(29,29)],"ink")
    c.poly([(5,28),(5,11),(7,7),(11,4),(21,4),(25,7),(27,11),(27,28)],"stone")
    c.poly([(8,27),(8,12),(10,8),(14,6),(19,6),(23,10),(24,14),(24,27)],"black")
    c.line([(5,12),(6,8),(11,4),(20,4)],"sl")
    c.line([(26,12),(25,8),(22,6)],"sd")
    c.poly([(11,26),(13,18),(12,15),(13,11),(16,10),(19,12),(19,16),(18,18),(21,26)],"sd")
    c.poly([(14,12),(17,12),(18,15),(16,17),(14,16)],"stone")
    c.poly([(14,18),(17,18),(18,24),(13,24)],"stone")
    c.line([(15,19),(15,23)],"sl")
    bands(c,3,27,26,4)
    c.line([(4,15),(7,15)],"deep");c.line([(25,19),(28,19)],"deep")
    c.line([(6,7),(7,10),(5,13)],"ink");c.rect(23,29,4,1,"moss")
    return c


add("niche_statue","kt_props",niche(),"recessed small votive figure in pointed masonry niche")


def chain():
    c=C(16,64)
    c.rect(5,0,6,3,"ink");c.rect(6,0,4,1,"brass")
    for i in range(10):
        y=3+i*6
        if i%2:
            c.rect(7,y,3,7,"ink");c.rect(8,y,1,5,"brass");c.dot(8,y+1,"bl")
        else:
            c.poly([(6,y),(9,y),(11,y+2),(11,y+4),(9,y+6),(6,y+6),(4,y+4),(4,y+2)],"ink")
            c.line([(6,y+1),(9,y+1),(10,y+2)],"brass")
            c.line([(5,y+2),(5,y+4),(6,y+5),(9,y+5)],"rust")
    return c


add("chain0","kt_props",chain(),"alternating face-on and edge-on iron chain links")


def seat():
    c=C(48,48,2)
    c.poly([(4,10),(5,4),(8,2),(16,2),(19,4),(20,10),(18,11),(18,18),(21,19),(20,22),(17,22),(16,19),(8,19),(7,22),(4,22),(3,19),(6,17),(6,11)],"ink")
    c.poly([(7,5),(9,3),(15,3),(17,5),(17,13),(7,13)],"sd")
    c.rect(9,5,6,7,"teald");c.line([(9,5),(14,5)],"teal")
    c.poly([(6,14),(17,14),(20,17),(17,19),(6,19),(4,17)],"stone")
    c.line([(6,14),(16,14),(18,16)],"sl")
    c.rect(5,18,3,3,"sd");c.rect(17,18,2,3,"sd")
    c.rect(4,10,4,2,"stone");c.rect(17,10,4,2,"stone")
    c.dot(6,10,"sl");c.line([(15,3),(14,7),(16,9)],"ink")
    return c


add("seat","kt_props",seat(),"low stone chair, tall inset back, asymmetric broken arms")


def books(kind):
    c=C(32,20)
    if kind==0:
        c.poly([(2,13),(9,9),(25,10),(29,13),(28,17),(10,19),(2,17)],"ink")
        c.poly([(3,13),(10,11),(26,12),(26,15),(10,17),(3,16)],"ivoryd")
        c.line([(5,14),(11,13),(25,13)],"ivory")
        c.poly([(5,6),(20,4),(26,7),(26,11),(12,13),(5,10)],"ink")
        c.poly([(6,7),(20,5),(24,7),(11,9)],"teal")
        c.poly([(7,9),(11,11),(24,9),(24,10),(12,12)],"ivory")
        c.line([(7,7),(11,8),(21,6)],"tl")
        c.rect(17,5,2,5,"brassd");c.dot(17,5,"bl")
    else:
        c.poly([(1,9),(12,7),(16,9),(20,6),(30,8),(29,17),(19,17),(16,19),(12,17),(2,18)],"ink")
        c.poly([(3,10),(11,9),(15,11),(15,17),(11,15),(3,16)],"ivory")
        c.poly([(17,11),(20,8),(28,9),(27,15),(21,15),(17,17)],"ivoryd")
        c.line([(16,10),(16,17)],"brassd")
        for y in [11,13]:
            c.line([(5,y),(10,y-1),(12,y)],"ivoryd")
            c.line([(20,y),(25,y)],"wood")
        c.line([(4,16),(11,15),(14,17)],"il")
    return c


for i in range(2):
    add(f"books{i}","kt_props",books(i),["stack of buckled bound folios","open hand-copied codex with uneven pages"][i])


# Eight flame silhouettes; tips and swallowed negative spaces move independently.
FLAMES = [
    [(4,15),(3,11),(5,7),(6,10),(8,5),(8,1),(11,5),(10,9),(13,6),(13,11),(15,14),(12,18),(7,19)],
    [(4,16),(3,12),(4,8),(7,10),(6,5),(9,2),(10,6),(10,10),(14,8),(13,12),(15,15),(11,19),(7,19)],
    [(4,16),(2,13),(4,9),(5,12),(8,8),(7,4),(9,0),(11,5),(11,9),(14,6),(14,11),(15,15),(12,18),(7,19)],
    [(3,15),(3,11),(6,8),(6,12),(8,7),(10,3),(12,4),(11,9),(14,10),(13,13),(15,15),(11,19),(6,18)],
    [(4,16),(2,12),(4,7),(7,10),(8,6),(7,2),(10,4),(12,8),(11,11),(14,8),(14,14),(12,18),(7,19)],
    [(4,16),(3,12),(5,9),(6,11),(8,8),(9,2),(11,1),(11,7),(13,9),(12,12),(15,13),(14,17),(10,19),(6,18)],
    [(4,16),(2,11),(5,8),(5,11),(7,7),(6,3),(8,1),(11,6),(11,10),(13,7),(15,10),(13,13),(14,16),(11,19),(7,18)],
    [(3,16),(3,12),(5,10),(7,12),(8,7),(8,3),(10,2),(12,6),(10,10),(13,9),(15,12),(13,15),(12,18),(7,19)],
]


def fire(c, ox, oy, frame, compact=False):
    pts=FLAMES[frame%8]
    if compact:
        # 9px torch scale: authored smaller contour, not an input image resize.
        pts=[(ox+x//2,oy+y//2) for x,y in pts]
    else:
        pts=[(ox+x,oy+y) for x,y in pts]
    c.poly(pts,"redd")
    if compact:
        f=frame%3
        c.poly([(ox+2,oy+7),(ox+3,oy+4-f),(ox+4,oy+6),(ox+5,oy+3+f),(ox+6,oy+7),(ox+5,oy+9),(ox+3,oy+9)],"ember")
        c.poly([(ox+3,oy+8),(ox+4,oy+6),(ox+5,oy+8),(ox+4,oy+9)],"firelight")
    else:
        off=[0,1,0,-1,-1,0,1,0][frame%8]
        c.poly([(ox+5,oy+15),(ox+5,oy+11),(ox+8+off,oy+8),(ox+8,oy+13),(ox+10,oy+10),(ox+12,oy+14),(ox+11,oy+18),(ox+7,oy+18)],"ember")
        c.poly([(ox+7,oy+16),(ox+8+off,oy+12),(ox+10,oy+15),(ox+10,oy+18),(ox+7,oy+18)],"flame")
        c.poly([(ox+8,oy+16),(ox+9,oy+15),(ox+10,oy+18),(ox+8,oy+18)],"firelight")


def brazier(frame):
    c=C(48,64,2)
    fire(c,3,0,frame)
    c.poly([(3,19),(20,19),(19,23),(16,26),(8,26),(4,23)],"ink")
    c.poly([(5,20),(18,20),(17,23),(14,25),(9,24),(6,22)],"brass")
    c.line([(5,20),(18,20)],"bl");c.rect(7,21,2,2,"rust")
    c.rect(10,25,4,4,"brassd");c.rect(10,25,1,3,"brass")
    c.poly([(10,27),(7,28),(5,31),(3,31),(5,28),(9,26)],"ink")
    c.poly([(14,27),(17,28),(20,31),(22,31),(19,27),(15,26)],"ink")
    c.line([(9,28),(6,30),(4,30)],"brass");c.line([(15,28),(18,30),(20,30)],"brass")
    c.rect(10,29,4,2,"ink");c.dot(11,29,"brass")
    # Rising embers advance through a hand-authored cycle.
    ember=[(5,8),(17,6),(7,3),(15,2),(4,5),(18,8),(12,1),(6,4)][frame]
    c.dot(*ember,"flame")
    return c


for i in range(8):
    add(f"brazier{i}","kt_brazier",brazier(i),f"tripod brass fire bowl; flame contour/inner flame/ember motion {i+1}/8")


def chest(frame, red=False, crate=False):
    c=C(16,16)
    body="red" if red else "wood"
    light="rl" if red else "wl"
    # Each opening state changes the lid silhouette and interior negative space.
    c.poly([(2,8),(13,8),(14,10),(14,14),(12,15),(3,15),(1,13),(1,10)],"ink")
    c.rect(2,10,11,3,body);c.line([(3,14),(11,14)],"woodd")
    c.rect(3,10,1,3,"brassd");c.rect(11,10,1,3,"brassd")
    c.dot(3,10,"brass");c.dot(11,10,"brass")
    if frame==0:
        c.poly([(2,8),(3,5),(5,4),(11,4),(13,6),(14,9),(12,10),(2,10)],"ink")
        c.poly([(3,8),(4,6),(6,5),(10,5),(12,7),(12,9),(3,9)],body)
        c.line([(5,5),(10,5),(12,7)],light)
        c.rect(4,6,1,3,"brass");c.rect(10,6,1,3,"brass")
        c.rect(7,8,2,3,"ink");c.dot(7,9,"bl")
    elif frame==1:
        c.poly([(2,8),(3,3),(12,3),(14,7),(13,9)],"ink")
        c.poly([(4,4),(11,4),(12,6),(4,7)],body)
        c.line([(4,4),(11,4)],light)
        c.poly([(3,9),(5,7),(12,7),(12,10),(3,10)],"black")
        c.line([(3,10),(12,10)],"brass")
        c.dot(8,6,"bl")
    else:
        c.poly([(2,7),(2,2),(4,1),(12,1),(14,3),(13,8)],"ink")
        c.rect(3,3,10,4,body);c.rect(4,3,8,3,"woodd")
        c.line([(4,2),(11,2),(12,3)],light)
        c.rect(4,3,1,3,"brassd");c.rect(11,3,1,3,"brassd")
        c.poly([(2,9),(4,7),(12,7),(14,9),(12,11),(3,11)],"brassd")
        c.poly([(4,9),(6,8),(11,8),(12,9),(11,10),(4,10)],"black")
        c.dot(7,9,"ivoryd")
    if crate:
        # Crate family is a square nailed shipping coffer, with loose board lid.
        c=C(16,16)
        c.rect(1,6,13,9,"ink");c.rect(2,7,11,7,"wood")
        c.line([(3,8),(11,13)],"wl",2);c.line([(11,8),(3,13)],"woodd",2)
        c.rect(2,7,1,7,"wl");c.rect(12,7,1,7,"brassd")
        for x,y in [(3,8),(11,8),(3,13),(11,13)]:c.dot(x,y,"ink")
        if frame==0:
            c.poly([(1,6),(4,3),(12,3),(14,6),(13,8),(2,8)],"ink")
            c.poly([(3,6),(5,4),(11,4),(12,6)],"wl");c.line([(6,4),(5,6)],"woodd")
        elif frame==1:
            c.poly([(1,6),(2,2),(12,2),(14,6),(12,7)],"ink")
            c.poly([(3,3),(11,3),(12,5),(3,5)],"wl");c.rect(4,6,7,2,"black")
        else:
            c.poly([(2,6),(2,1),(12,1),(13,6)],"ink")
            c.rect(3,2,9,3,"wood");c.line([(3,2),(11,2)],"wl")
            c.rect(3,6,9,3,"black");c.line([(2,9),(12,9)],"wl")
    return c


for i in range(3):
    for prefix,is_red,is_crate in [("chest",False,False),("chest_red",True,False),("crate",False,True)]:
        add(f"{prefix}{i}","objects",chest(i,is_red,is_crate),f"{'red lacquer coffer' if is_red else 'nailed shipping coffer' if is_crate else 'arched wood chest'}; {['closed lid','partly raised lid','fully open dark interior'][i]}")


def torch(frame):
    c=C(16,32)
    c.rect(7,15,3,13,"ink");c.rect(8,16,1,11,"brass")
    c.poly([(5,15),(11,15),(12,17),(10,19),(6,19),(4,17)],"ink")
    c.line([(5,16),(10,16)],"bl");c.rect(6,17,4,1,"brassd")
    c.poly([(7,26),(5,28),(3,30),(2,30),(4,27),(7,25),(9,25),(12,27),(14,30),(12,30),(9,27)],"ink")
    c.line([(7,27),(4,29)],"brass");c.line([(9,27),(12,29)],"brass")
    fire(c,3,5,[0,3,6][frame],compact=True)
    c.dot([4,11,6][frame],[7,5,3][frame],"flame")
    return c


def lantern(frame):
    c=C(16,32)
    c.rect(7,0,2,4,"ink");c.line([(8,1),(8,3)],"brass")
    c.poly([(7,3),(10,3),(12,5),(11,7),(6,7),(5,5)],"ink")
    c.line([(7,4),(9,4),(10,5)],"brass")
    c.poly([(5,7),(11,7),(14,11),(13,23),(10,27),(5,27),(2,23),(2,12)],"ink")
    c.poly([(6,9),(10,9),(12,12),(11,23),(9,25),(5,24),(4,22),(4,13)],"teald")
    c.rect(5,12,6,10,"brassd")
    c.poly([(6,21),(6,16-frame),(8,12+frame),(10,18),(9,22)],"ember")
    c.rect(7,18-frame,2,4,"flame");c.dot(7,20,"firelight")
    c.line([(4,12),(5,23)],"brass");c.line([(10,11),(10,23)],"brass")
    c.line([(5,9),(10,9),(12,11)],"bl")
    c.line([(5,24),(10,24)],"brass")
    c.rect(6,27,4,2,"brassd");c.dot(6,27,"bl")
    return c


def spikes(frame):
    c=C(16,16)
    c.poly([(1,13),(4,11),(11,11),(15,13),(13,15),(3,15)],"ink")
    c.poly([(2,13),(5,12),(11,12),(13,13),(11,14),(4,14)],"sd")
    heights=[[3,6,4],[1,3,2],[8,9,7]][frame]
    for x,y in zip([3,7,11],heights):
        c.poly([(x-1,13),(x,y),(x+2,13)],"ink")
        c.line([(x,y+1),(x,12)],"sl");c.line([(x+1,y+5),(x+1,12)],"sd")
    c.dot(2,13,"brass");c.dot(13,13,"brass")
    return c


for i in range(3):
    add(f"torch_stand{i}","objects",torch(i),f"slender brazed tripod torch; moving flame {i+1}/3")
    add(f"lantern_hang{i}","objects",lantern(i),f"suspended caged amber lantern; inner flame movement {i+1}/3")
    add(f"spikes{i}","objects",spikes(i),f"forged floor teeth; {['half raised','fully raised','withdrawn'][i]}")


def door(opened):
    c=C(16,16 if opened else 32)
    if not opened:
        c.poly([(1,31),(1,8),(3,4),(6,2),(11,2),(14,6),(15,31)],"ink")
        c.poly([(3,29),(3,9),(5,6),(7,4),(10,4),(12,7),(13,10),(13,29)],"wood")
        c.line([(5,7),(5,28)],"woodd");c.line([(9,5),(9,29)],"woodd")
        c.line([(3,11),(12,11)],"brass");c.line([(3,24),(12,24)],"brassd",2)
        c.rect(10,16,3,4,"ink");c.rect(11,17,1,2,"bl")
        c.line([(2,9),(3,5),(6,3),(10,3)],"stone")
        c.dot(4,11,"bl");c.dot(11,11,"bl");c.dot(4,24,"rust")
    else:
        c.poly([(1,2),(4,1),(7,4),(7,14),(4,15),(1,13)],"ink")
        c.poly([(2,3),(4,3),(5,5),(5,13),(2,12)],"wood")
        c.line([(2,6),(5,7)],"brass");c.line([(2,10),(5,11)],"brassd")
        c.rect(7,13,8,2,"sd");c.line([(8,13),(14,13)],"stone")
        c.dot(4,8,"bl")
    return c


add("door_closed","objects",door(False),"arched swollen plank door, iron cross straps, lock plate")
add("door_open","objects",door(True),"open door leaf seen edge-on plus worn threshold; legacy 16px contract")


def tree(dead=False):
    c=C(80,96,2)
    # Blackwood-compatible new source: angular pollarded ash, not a pine.
    branches=[([(19,43),(18,29),(16,22),(16,13)],4), ([(19,32),(12,24),(7,22),(4,15)],3),
              ([(20,28),(26,21),(31,19),(35,11)],3), ([(18,25),(12,18),(11,10),(8,6)],2),
              ([(21,22),(23,14),(29,9),(30,4)],3), ([(15,25),(8,27),(3,24)],2),
              ([(25,22),(31,27),(36,25)],2)]
    c.poly([(12,46),(15,43),(17,39),(17,30),(21,29),(23,40),(26,44),(30,46),(24,47),(20,45),(16,47)],"ink")
    for path,w in branches:c.line(path,"ink",w)
    c.poly([(16,44),(19,40),(18,28),(20,27),(21,39),(24,44),(21,43),(19,45)],"wood")
    for path,w in branches[:5]:
        c.line([(x,y) for x,y in path],"sd" if dead else "wood",max(1,w-2))
    c.line([(18,31),(19,36),(18,40),(16,44)],"sl" if dead else "wl")
    c.line([(20,34),(20,40),(22,44)],"woodd")
    c.line([(12,24),(9,23),(7,20)],"sl" if dead else "wl")
    if dead:
        c.line([(29,9),(33,6),(35,6)],"ink",2);c.line([(11,10),(14,6),(13,3)],"ink",2)
        c.line([(4,15),(3,10),(5,8)],"ink",2)
        c.line([(31,27),(33,31)],"ink",2)
        c.line([(23,14),(22,9),(24,5)],"ink",2)
        c.rect(17,41,2,2,"moss");c.dot(27,45,"stone")
    else:
        # Each crown has its own stepped edge and two purposeful shade clusters.
        crowns=[([(3,14),(2,10),(4,6),(9,4),(13,6),(14,11),(11,15),(6,16)],
                 [(3,10),(5,7),(9,6),(12,8),(10,11),(5,12)]),
                ([(9,8),(10,3),(15,1),(20,3),(21,8),(18,11),(13,11)],
                 [(11,6),(13,3),(17,3),(19,5),(16,7)]),
                ([(21,11),(23,5),(27,3),(32,4),(35,8),(34,13),(30,16),(24,15)],
                 [(24,9),(26,6),(30,5),(33,8),(30,10),(25,11)]),
                ([(5,24),(4,20),(7,16),(13,15),(18,18),(17,24),(13,27),(8,26)],
                 [(6,21),(8,18),(12,17),(15,19),(12,22),(8,23)]),
                ([(15,18),(14,13),(17,9),(22,8),(27,11),(28,16),(25,20),(20,21)],
                 [(16,14),(18,11),(22,10),(25,13),(22,16),(18,16)]),
                ([(25,23),(26,17),(31,14),(36,16),(38,20),(36,25),(31,28),(27,26)],
                 [(28,21),(29,18),(33,17),(36,20),(33,23),(30,24)])]
        for outline,lit in crowns:
            c.poly(outline,"ink");c.poly([(x,y+1) for x,y in lit],"teald");c.poly(lit,"moss")
            c.line(lit[:3],"teal")
        for x,y in [(8,9),(15,4),(29,7),(9,19),(20,12),(31,19)]:
            c.rect(x,y,2,1,"tl");c.dot(x+2,y+1,"teal")
    return c


add("tree","dw_env",tree(False),"angular blackwood ash with six asymmetric blue-green leaf crowns and exposed roots")
add("tree_dead","dw_tree_dead",tree(True),"new leafless lightning-split ash with many angular bare branches")


def rock():
    c=C(48,32,2)
    c.poly([(1,12),(3,7),(8,4),(13,2),(19,4),(22,8),(23,13),(19,15),(7,15)],"ink")
    c.poly([(2,11),(5,7),(9,6),(12,3),(18,5),(19,8),(15,11),(7,13)],"stone")
    c.poly([(15,11),(19,8),(21,10),(22,13),(18,14),(7,14),(7,13)],"sd")
    c.poly([(6,7),(9,6),(12,4),(15,5),(12,8),(8,9)],"sl")
    c.line([(12,4),(13,8),(17,10),(16,12)],"deep")
    c.line([(4,11),(8,10),(9,12)],"sd")
    c.rect(6,13,4,1,"moss");c.dot(18,6,"shine")
    return c


def mushrooms():
    c=C(80,64,2)
    # Large environmental cluster; each cap is a new independent stepped polygon.
    for x,y,h in [(9,25,8),(20,27,15),(29,26,9),(15,29,6)]:
        c.poly([(x-2,y),(x-1,y-h),(x+2,y-h),(x+3,y-1),(x+1,y+1)],"ink")
        c.poly([(x,y-1),(x,y-h),(x+1,y-h),(x+1,y-2)],"ivoryd")
        c.dot(x,y-2,"ivory")
    caps=[([(2,17),(4,13),(8,11),(12,12),(15,16),(14,19),(4,20)],"stone"),
          ([(10,12),(13,6),(19,3),(24,5),(28,10),(29,14),(25,16),(14,16)],"teal"),
          ([(23,18),(25,13),(29,10),(33,12),(36,17),(35,20),(26,21)],"stone"),
          ([(10,24),(12,20),(15,18),(19,20),(21,24),(18,26),(12,26)],"ivoryd")]
    for pts,col in caps:
        c.poly(pts,"ink")
        c.poly([(x,y-1) for x,y in pts[1:-1]],col)
        c.line(pts[1:4],"sl" if col!="ivoryd" else "ivory")
    for x,y in [(7,14),(11,16),(18,7),(23,10),(26,13),(29,14),(32,17),(14,22)]:c.dot(x,y,"ivory")
    c.line([(13,14),(26,14)],"teald");c.line([(25,19),(34,19)],"sd")
    c.poly([(3,29),(8,27),(12,29),(10,31),(4,31)],"deep")
    c.poly([(22,30),(27,27),(34,28),(38,30),(34,31),(25,31)],"deep")
    c.rect(8,29,3,1,"moss");c.dot(29,29,"moss")
    return c


add("rock","dw_env",rock(),"faceted fallen sedimentary block, fissured upper plane and mossy foot")
add("mushrooms","dw_env",mushrooms(),"four distinct gilled caps, chalk stems and stepped slate-teal crowns")


VEIN_PATH=[(1,15),(3,12),(3,9),(6,7),(8,7),(9,4),(9,1),(12,0)]
BRANCHES=[[(4,10),(1,8),(0,5)],[(6,7),(5,4),(3,2)],[(8,7),(12,8),(15,6)],[(3,12),(7,12),(9,15)],[(10,3),(13,3),(15,1)]]
PULSE=[0,0,1,1,2,2,2,1,1,0,0,0]
NODES=[(2,14),(3,13),(3,12),(3,11),(3,10),(3,9),(4,8),(5,8),(6,7),(7,7),(8,7),(9,6),
       (9,5),(9,4),(9,3),(9,2),(9,1),(10,1),(11,0),(12,0),(11,1),(8,8),(5,10),(2,13)]


def veins(frame):
    c=C(16,16)
    # Newly authored root scar: perimeter is not a recolored floor tile.
    c.poly([(0,12),(2,9),(1,7),(4,6),(4,2),(7,3),(9,0),(13,0),(12,5),(15,7),(13,10),(9,10),(9,15),(5,14),(2,15)],"deep")
    phase=PULSE[frame%12]
    c.line(VEIN_PATH,"redd",3+(phase==2))
    c.line(VEIN_PATH,"red",2)
    c.line(VEIN_PATH,"rl",1)
    for n,path in enumerate(BRANCHES):
        wiggle=1 if (frame+5*n)%12<3 else 0
        end=path[-1]
        moved=path[:-1]+[(min(15,end[0]+wiggle), max(0,end[1]-wiggle))]
        c.line(moved,"redd",2)
        c.line(moved,"red")
    # A 24-step traveling swelling alters contour, rather than tint alone.
    x,y=NODES[frame]
    c.rect(max(0,x-1),max(0,y-1),3,3,"red")
    c.dot(x,y,"rl");c.dot(x,min(15,y+1),"ember")
    c.dot((x+1)%16,max(0,y-1),"ivoryd")
    c.dot(4,9,"brassd");c.dot(10,8,"red")
    return c


for i in range(24):
    add(f"cd_veina1_{i}","cd_veina1",veins(i),f"new branching sinew with swelling at distinct path position {i+1}/24")


EYE_POS=[(3,4),(11,9),(4,12)]
BLINK=[3,3,3,3,3,2,1,0,1,2,3,3]
LOOK=[-1,-1,0,0,1,1,1,0,0,-1,-1,0]


def eyes(frame):
    c=C(16,16)
    c.poly([(0,3),(3,1),(6,2),(8,6),(12,6),(15,8),(15,12),(12,14),(8,12),(6,15),(2,15),(0,12),(1,8)],"deep")
    c.line([(1,8),(3,7),(5,8),(7,9),(10,7),(14,7)],"teald",2)
    c.line([(1,13),(3,10),(6,10),(8,12),(12,13)],"redd",2)
    c.line([(6,3),(7,6),(10,5),(13,6)],"red")
    for n,(x,y) in enumerate(EYE_POS):
        p=(frame+n*4)%12
        # Different eyes close in staggered waves. Pupil travels across 36 states.
        aperture=BLINK[p]
        c.poly([(x-3,y),(x-1,y-2),(x+2,y-2),(x+3,y),(x+2,y+2),(x-1,y+2)],"redd")
        if aperture==0:
            c.line([(x-2,y),(x+2,y)],"ink")
            c.dot(x+2,y+1,"rl")
        else:
            a=1 if aperture<3 else 2
            c.poly([(x-2,y),(x-1,y-a),(x+1,y-a),(x+2,y),(x+1,y+a),(x-1,y+a)],"ivoryd")
            if aperture>=2:c.line([(x-1,y-1),(x+1,y-1)],"ivory")
            pupil=LOOK[(frame//3+n*3)%12]
            c.line([(x+pupil,y-max(0,a-1)),(x+pupil,y+max(0,a-1))],"black")
            if aperture==3:c.dot(x+pupil+1,y-1,"il")
        c.dot(x-2,min(15,y+2),"red")
    # Tiny 36-step muscular knot follows a closed contour; each frame differs.
    perimeter=[(x,0) for x in range(0,10)]+[(10,y) for y in range(1,9)]+[(x,9) for x in range(9,-1,-1)]+[(0,y) for y in range(8,0,-1)]
    x,y=perimeter[frame]
    c.dot(x+3,min(15,y+3),"teal")
    return c


for i in range(36):
    add(f"cd_littleeyes_{i}","cd_littleeyes",eyes(i),f"three staggered blinking chalk eyes, tracking pupils and contracting tissue {i+1}/36")


def tainted_urn():
    c=C(16,16)
    c.poly([(4,1),(11,1),(12,4),(10,6),(13,9),(13,12),(10,15),(5,15),(2,12),(2,9),(5,6),(3,4)],"ink")
    c.rect(5,2,5,2,"teal");c.rect(6,3,3,1,"black")
    c.poly([(6,6),(9,6),(11,9),(11,12),(9,14),(5,13),(4,10)],"stone")
    c.line([(5,8),(6,7),(9,7)],"sl");c.rect(4,10,7,1,"teald")
    c.poly([(6,10),(8,8),(10,10),(8,12)],"redd");c.dot(8,10,"ivory");c.dot(8,11,"black")
    c.line([(10,5),(9,8),(11,10)],"ink")
    return c


def bound_idol():
    c=C(48,48,2)
    bands(c,2,20,20,3)
    c.poly([(6,19),(7,14),(5,10),(5,7),(8,5),(8,2),(11,1),(15,3),(16,7),(19,9),(18,14),(16,16),(18,19)],"ink")
    c.poly([(8,18),(9,14),(7,10),(8,7),(10,6),(10,3),(13,3),(14,7),(17,10),(16,13),(14,16),(15,18)],"sd")
    c.poly([(10,4),(13,4),(14,7),(12,9),(10,7)],"stone")
    c.rect(9,6,6,1,"redd");c.dot(12,6,"ivory")
    c.poly([(9,11),(11,10),(14,11),(15,14),(13,17),(9,16)],"teald")
    c.line([(7,10),(15,15),(17,12)],"brassd",2)
    c.line([(8,11),(15,14)],"brass")
    c.line([(9,16),(16,10)],"brassd",2)
    c.line([(10,15),(15,11)],"bl")
    c.line([(11,10),(12,13),(11,16)],"red")
    c.rect(5,21,4,1,"moss");c.line([(18,20),(17,22)],"ink")
    return c


add("cd_urn_1","cd_urn_1",tainted_urn(),"chalk ritual urn, central embedded eye and fractured neck")
add("cd_statue_b1","cd_statue_b1",bound_idol(),"kneeling eyeless idol bound by diagonal rusted bronze bands")


GROUND = []


def ground(key, c, note):
    key="complete_"+key
    GROUND.append(key)
    add(key,"complete_props_ground",c,note)


def well():
    c=C(16,16)
    c.poly([(2,6),(4,4),(11,4),(14,7),(14,12),(11,15),(4,15),(1,12),(1,8)],"ink")
    c.poly([(2,8),(4,6),(11,6),(13,8),(13,12),(10,14),(5,14),(2,12)],"stone")
    c.poly([(4,8),(6,6),(10,7),(11,9),(9,11),(5,10)],"water")
    c.line([(4,8),(6,7),(9,7)],"teal")
    c.line([(3,11),(6,12),(10,12),(12,10)],"sd")
    c.line([(2,8),(4,6),(6,6)],"sl")
    c.line([(5,12),(5,14)],"deep");c.line([(10,12),(10,14)],"deep")
    c.rect(2,2,2,7,"woodd");c.rect(12,2,2,7,"woodd")
    c.rect(2,2,12,2,"wood");c.rect(3,2,9,1,"wl")
    c.rect(7,4,1,4,"brassd");c.dot(7,7,"brass")
    return c


ground("well",well(),"stone ring well, visible dark water, timber windlass and hanging chain")


def cold_fire():
    c=C(16,16)
    c.poly([(1,10),(3,7),(7,6),(12,7),(15,10),(13,14),(7,15),(2,13)],"ink")
    for pts in [[(2,9),(4,8),(5,10),(3,11)],[(10,7),(12,8),(12,10),(10,9)],[(12,12),(14,10),(14,12),(12,14)],[(3,12),(5,12),(6,14),(3,13)],[(7,13),(9,13),(10,14),(7,14)]]:
        c.poly(pts,"stone");c.dot(*pts[0],"sl")
    c.poly([(4,10),(11,10),(12,12),(7,13),(4,12)],"ash")
    c.line([(5,9),(10,12)],"woodd",2);c.line([(5,12),(10,9)],"black",2)
    c.dot(7,11,"ivoryd");c.dot(9,12,"sd")
    return c


ground("campfire_cold",cold_fire(),"extinguished stone fire ring, crossed charred sticks and pale ash")


def bed(insulated=False, scorched=False):
    c=C(16,16)
    if insulated:
        # Portable bedroll laid directly on the ground: cloth hood and quilting,
        # with neither timber frame nor a separate pillow.
        c.poly([(5,0),(10,0),(13,3),(13,12),(11,15),(4,15),(2,13),(2,5),(3,2)],"ink")
        c.poly([(5,1),(10,1),(12,3),(12,12),(10,14),(4,14),(3,12),(3,5),(4,2)],"teald")
        c.poly([(5,2),(9,2),(11,4),(10,6),(4,6),(4,3)],"teal")
        c.poly([(6,3),(9,3),(10,4),(9,5),(5,5),(5,4)],"deep")
        c.line([(5,2),(9,2),(10,3)],"tl")
        c.poly([(3,6),(7,5),(11,6),(12,9),(11,13),(5,13),(4,11)],"teal")
        c.line([(3,6),(7,6),(11,7)],"tl")
        c.line([(5,8),(10,9)],"teald")
        c.line([(5,10),(10,11)],"teald")
        c.line([(5,12),(10,13)],"teald")
        c.line([(6,7),(5,12)],"teald")
        c.line([(9,8),(8,12)],"teald")
        c.line([(4,13),(10,13)],"ivoryd")
        c.line([(3,8),(2,9),(1,9)],"ivoryd")
        c.dot(2,10,"ivoryd")
        return c
    c.rect(2,1,12,14,"ink");c.rect(3,2,10,12,"wood")
    c.rect(3,3,10,3,"ivoryd");c.rect(4,3,8,2,"ivory")
    c.poly([(3,6),(12,6),(12,13),(10,14),(4,13)],"teald" if insulated else "ivoryd")
    c.poly([(4,7),(11,7),(10,13),(4,12)],"teal" if insulated else "ivory")
    c.line([(4,8),(10,8)],"tl" if insulated else "il")
    c.line([(4,10),(10,11)],"teald" if insulated else "ivoryd")
    c.rect(2,1,2,2,"wl");c.rect(12,1,2,2,"wl")
    c.rect(2,13,2,2,"woodd");c.rect(12,13,2,2,"woodd")
    if insulated:
        c.poly([(4,10),(6,9),(8,10),(10,9),(12,11),(11,13),(8,12),(6,13),(4,12)],"moss")
        c.dot(5,10,"stone");c.dot(9,11,"stone")
    if scorched:
        # Transparent scorch overlay, leaving original bedding visible at sides.
        c=C(16,16)
        c.poly([(5,3),(8,4),(11,3),(10,6),(12,9),(10,12),(11,14),(6,13),(4,11),(5,8),(3,6)],"black")
        c.poly([(6,5),(8,6),(9,5),(9,8),(10,10),(8,12),(5,11),(6,8)],"woodd")
        c.line([(5,6),(6,7),(5,9)],"ash");c.dot(9,11,"ash")
    return c


ground("bed_plain",bed(),"ivory linen mattress on a plain timber bed")
ground("bed_insulated",bed(True),"portable padded teal cloth bedroll, integrated hood, folded mouth, quilting and binding cord; no wood or separate pillow")
ground("bed_scorched",bed(scorched=True),"transparent irregular char and ash overlay for burnt bedding")


def forge():
    c=C(16,16)
    c.poly([(2,15),(2,7),(4,4),(6,3),(6,0),(10,0),(10,4),(13,6),(14,15)],"ink")
    c.rect(7,1,2,5,"sd");c.dot(7,1,"sl")
    c.poly([(3,14),(3,8),(5,5),(9,5),(12,7),(13,14)],"stone")
    c.poly([(5,13),(5,9),(6,7),(9,7),(11,9),(11,13)],"black")
    c.poly([(6,12),(7,9),(8,11),(9,8),(10,12)],"ember")
    c.dot(8,12,"flame");c.line([(3,14),(12,14)],"sd")
    c.line([(4,7),(5,6),(9,6)],"sl")
    c.rect(1,10,4,2,"ink");c.rect(1,10,3,1,"brass")
    c.rect(2,12,1,2,"woodd")
    return c


ground("forge",forge(),"arched masonry forge with chimney, coal mouth and side anvil")


def workbench():
    c=C(16,16)
    c.rect(2,7,2,8,"ink");c.rect(12,7,2,8,"ink")
    c.rect(3,8,1,6,"wood");c.rect(12,8,1,6,"wood")
    c.poly([(1,5),(4,3),(13,3),(15,6),(14,9),(1,9)],"ink")
    c.poly([(2,5),(5,4),(12,4),(13,6),(2,6)],"wl")
    c.rect(2,7,12,1,"wood");c.line([(4,5),(10,5)],"woodd")
    c.rect(8,2,2,2,"ink");c.rect(7,2,4,1,"sl")
    c.line([(5,4),(6,6)],"brassd");c.dot(5,3,"brass")
    c.rect(4,11,8,2,"woodd");c.rect(5,11,6,1,"wood")
    return c


ground("workbench",workbench(),"heavy four-legged carpenter table with hammer and lower tool shelf")


def barricade():
    c=C(16,16)
    c.poly([(1,15),(3,5),(4,1),(6,4),(7,15)],"ink")
    c.poly([(9,15),(9,6),(11,1),(13,4),(14,15)],"ink")
    c.poly([(3,13),(4,5),(5,4),(5,13)],"wood")
    c.poly([(10,13),(11,5),(12,4),(12,14)],"wl")
    c.line([(1,9),(14,6)],"ink",3);c.line([(2,9),(13,7)],"wood",2)
    c.line([(2,6),(14,12)],"ink",3);c.line([(3,6),(13,11)],"wl")
    c.dot(5,8,"brass");c.dot(11,9,"brass")
    c.line([(4,11),(6,12)],"brassd");c.line([(11,11),(10,13)],"brassd")
    return c


ground("barricade",barricade(),"two sharpened stakes lashed under crossed irregular timber rails")


def crack(sealed=False):
    c=C(16,16)
    path=[(10,0),(9,3),(6,5),(9,8),(6,10),(5,13),(6,15)]
    c.line(path,"ink",3);c.line([(11,0),(10,3),(7,5),(10,8),(7,10),(6,13)],"sl")
    c.line([(7,5),(3,4),(1,5)],"ink")
    c.line([(6,11),(10,12),(13,11)],"ink")
    if sealed:
        c.poly([(5,2),(11,1),(13,5),(10,8),(12,12),(10,15),(3,15),(2,11),(4,7),(3,5)],"sd")
        c.poly([(6,3),(10,3),(11,5),(8,8),(10,12),(9,14),(4,13),(4,10),(6,7),(4,5)],"stone")
        c.line([(5,5),(8,6),(10,4)],"sl")
        c.line([(5,9),(7,10),(6,13)],"deep")
        c.line([(8,9),(9,12),(8,14)],"sd")
        c.dot(3,12,"sl")
    return c


ground("wall_crack",crack(),"transparent branching structural wall fissure with exposed pale rim")
ground("wall_sealed",crack(True),"transparent raised gray repair mortar with trowel marks over a fissure")


def open_sarco():
    c=C(16,16)
    c.poly([(4,2),(11,2),(13,5),(14,12),(11,15),(3,15),(1,12),(2,5)],"ink")
    c.poly([(4,3),(10,3),(12,6),(12,12),(10,13),(4,13),(3,11),(3,6)],"stone")
    c.poly([(5,5),(9,5),(10,7),(10,11),(9,12),(5,12),(4,10),(4,7)],"black")
    c.line([(4,4),(10,4),(11,6)],"sl");c.line([(3,12),(5,14),(10,14)],"sd")
    c.poly([(11,1),(13,1),(15,4),(15,12),(13,13),(12,9)],"ink")
    c.line([(13,3),(14,5),(14,10)],"sl")
    c.dot(6,7,"ivoryd");c.line([(6,9),(8,11)],"ivoryd")
    return c


ground("sarcophagus_open",open_sarco(),"small open stone coffin with displaced upright lid and exposed dark burial hollow")


BASE_GROUND = list(GROUND)
CROP_STATION_GROUND = []
DEVICE_CAMP_GROUND = []


def extra_ground(key,c,note,group):
    ground(key,c,note)
    group.append("complete_"+key)


def shade_crop():
    c=C(16,16)
    # Only leaf morphology: no visible edible root or harvest-ready indicator.
    c.line([(7,14),(8,6)],"ink",2)
    leaves=[([(7,11),(3,10),(1,6),(4,5),(7,8)],"teald"),
            ([(8,9),(9,4),(13,2),(14,6),(11,9)],"teal"),
            ([(7,13),(3,14),(1,11),(4,10),(6,11)],"moss"),
            ([(8,13),(11,10),(15,10),(14,13),(11,15)],"teald"),
            ([(7,8),(5,4),(6,1),(9,3),(9,6)],"teal")]
    for pts,col in leaves:
        c.poly(pts,"ink")
        c.poly(pts[1:]+[pts[0]],col)
        c.line([pts[0],pts[2]],"sl")
    c.line([(7,13),(8,7),(7,3)],"teald")
    c.dot(3,7,"tl")
    return c


def cabbage_crop():
    c=C(16,16)
    c.poly([(1,9),(2,5),(5,2),(10,2),(14,5),(15,10),(12,14),(4,14)],"ink")
    c.poly([(2,9),(3,6),(6,4),(9,3),(12,6),(14,9),(12,12),(9,14),(4,12)],"teald")
    c.poly([(4,6),(7,3),(10,4),(12,7),(11,11),(8,13),(5,10)],"teal")
    c.line([(3,6),(3,9),(6,11),(6,13)],"moss")
    c.line([(6,4),(8,4),(10,6),(9,9),(6,9),(5,7),(7,6),(8,7)],"tl")
    c.line([(12,6),(12,10),(10,12)],"stone")
    c.line([(3,10),(5,11)],"tl");c.dot(9,11,"sl")
    return c


def potato_crop():
    c=C(16,16)
    c.line([(7,15),(8,9),(7,3)],"ink",2)
    c.line([(7,12),(3,9)],"ink",2);c.line([(8,9),(12,6)],"ink",2)
    leaves=[([(7,4),(4,3),(4,1),(7,1),(8,3)],"teal"),
            ([(7,7),(3,7),(1,5),(2,3),(5,4)],"moss"),
            ([(8,8),(10,3),(13,3),(14,5),(12,8)],"teal"),
            ([(5,11),(2,11),(0,9),(1,7),(4,8)],"teald"),
            ([(8,12),(11,9),(14,9),(15,11),(13,13),(10,13)],"moss"),
            ([(7,15),(3,14),(2,12),(5,11),(7,13)],"teal")]
    for pts,col in leaves:
        c.poly(pts,"ink");c.poly(pts[1:],col)
        c.dot(*pts[2],"sl")
    c.line([(7,14),(8,9),(7,5)],"wood")
    return c


def turnip_crop():
    c=C(16,16)
    # Tall serrated leaf fans; the turnip itself remains underground.
    c.poly([(7,15),(5,12),(2,11),(3,8),(1,5),(4,6),(3,2),(6,4),(8,12)],"ink")
    c.poly([(7,13),(5,10),(4,9),(4,7),(5,7),(5,5),(6,7)],"moss")
    c.poly([(7,15),(6,8),(7,5),(6,2),(8,0),(10,3),(9,5),(10,8),(9,12)],"ink")
    c.poly([(8,13),(7,8),(8,5),(7,3),(8,2),(9,4),(8,7),(9,9)],"teal")
    c.poly([(8,15),(9,9),(11,6),(10,3),(13,4),(15,2),(14,7),(12,8),(13,10),(11,12)],"ink")
    c.poly([(9,14),(10,9),(12,7),(12,5),(14,4),(13,7),(11,9),(11,11)],"moss")
    c.line([(7,13),(5,7)],"sl");c.line([(8,13),(8,6)],"tl");c.line([(9,13),(12,7)],"sl")
    return c


def whitecap_crop():
    c=C(16,16)
    # The actual culture substrate is a brown log, not loose earth.
    c.poly([(2,10),(11,10),(15,12),(15,14),(12,15),(2,15),(0,13)],"ink")
    c.poly([(2,11),(11,11),(13,12),(13,14),(2,14),(1,13)],"wood")
    c.line([(2,11),(10,11)],"wl")
    c.line([(2,13),(5,13),(6,14)],"woodd")
    c.line([(8,13),(10,12),(11,13)],"woodd")
    c.poly([(12,11),(14,12),(14,14),(12,15),(11,14),(11,12)],"woodd")
    c.poly([(12,12),(13,12),(13,14),(12,14)],"wl")
    c.dot(12,13,"brassd")
    c.poly([(5,12),(5,10),(6,7),(9,7),(10,11),(10,12),(8,13)],"ink")
    c.poly([(7,12),(7,9),(8,8),(8,11),(9,12)],"ivoryd")
    c.poly([(1,7),(3,3),(6,1),(10,1),(13,4),(15,8),(13,11),(3,11),(1,9)],"ink")
    c.poly([(2,7),(4,4),(7,2),(10,2),(12,5),(13,7)],"ivoryd")
    c.poly([(4,5),(7,3),(9,3),(11,5),(11,6),(4,7)],"ivory")
    c.line([(3,9),(6,10),(11,10),(13,9)],"sd")
    c.line([(5,9),(6,8)],"stone");c.line([(10,9),(10,8)],"stone")
    c.dot(6,4,"il");c.dot(11,6,"sl")
    return c


for name,draw,note in [
    ("shade",shade_crop,"shade root crop: dark broad pointed leaf rosette only"),
    ("cabbage",cabbage_crop,"cabbage crop: low curling concentric leaf rosette only"),
    ("potato",potato_crop,"potato crop: branching compound oval leaflets only"),
    ("turnip",turnip_crop,"turnip crop: upright serrated fan leaves only"),
    ("whitecap",whitecap_crop,"whitecap culture: chalk-white cap, shaded gills and short pale stem on brown culture log with bark and exposed end grain"),
]:
    extra_ground("crop_"+name,draw(),note+"; no produce, count or ripeness signal",CROP_STATION_GROUND)


def loom():
    c=C(16,16)
    c.rect(1,1,2,14,"ink");c.rect(13,1,2,14,"ink")
    c.rect(2,2,1,12,"wl");c.rect(13,2,1,12,"wood")
    c.rect(1,1,14,2,"wood");c.rect(2,1,11,1,"wl")
    c.rect(4,3,8,9,"woodd")
    for x in [4,6,8,10]:c.rect(x,3,1,8,"ivoryd")
    c.rect(4,7,8,3,"ivory");c.rect(4,9,8,1,"ivoryd")
    c.rect(3,5,10,1,"brassd");c.dot(3,5,"bl")
    c.rect(4,11,8,2,"wood");c.rect(4,11,8,1,"wl")
    c.line([(5,13),(5,14),(10,14)],"wood")
    c.rect(1,14,4,1,"ink");c.rect(11,14,4,1,"ink")
    return c


def tanning_vat():
    c=C(16,16)
    c.poly([(1,5),(4,2),(11,2),(15,5),(14,12),(11,15),(4,15),(1,12)],"ink")
    c.poly([(2,6),(4,4),(11,4),(13,6),(12,12),(10,14),(5,14),(3,12)],"wood")
    c.poly([(3,5),(5,3),(10,3),(13,5),(11,7),(5,7)],"deep")
    c.line([(3,5),(5,4),(10,4)],"brassd")
    c.line([(3,10),(12,10)],"brassd");c.line([(4,12),(11,12)],"brass")
    c.line([(4,8),(5,13)],"woodd");c.line([(10,8),(10,13)],"woodd")
    # Uneven damp hide folded over the near rim, distinct from a chest lid.
    c.poly([(6,5),(10,6),(11,8),(10,10),(11,12),(8,13),(7,11),(5,11),(6,9)],"ink")
    c.poly([(7,6),(9,7),(9,9),(10,11),(8,12),(7,10),(6,10),(7,8)],"ivoryd")
    c.line([(7,6),(8,7),(7,9)],"ivory")
    return c


def artisan():
    c=C(16,16)
    # Precision bench: upright clamp, round grinding wheel, narrow tool rack.
    c.rect(1,7,14,3,"ink");c.rect(2,8,12,1,"wl")
    c.rect(2,10,2,5,"ink");c.rect(12,10,2,5,"ink")
    c.rect(3,10,1,4,"wood");c.rect(12,10,1,4,"wood")
    c.rect(2,3,2,5,"ink");c.rect(3,3,1,4,"brass")
    c.rect(2,2,5,2,"ink");c.rect(3,2,3,1,"brass")
    c.rect(5,4,2,4,"brassd");c.dot(5,4,"bl")
    c.poly([(9,1),(12,1),(14,3),(14,6),(12,8),(9,8),(7,6),(7,3)],"ink")
    c.poly([(9,2),(12,2),(13,4),(12,6),(10,7),(8,5),(8,3)],"stone")
    c.rect(10,3,2,3,"sd");c.dot(10,4,"brassd")
    c.line([(9,2),(11,2),(12,3)],"sl")
    c.rect(5,12,6,1,"woodd");c.rect(7,11,1,3,"brass")
    return c


def saltwork():
    c=C(16,16)
    # One heated communal salt cauldron on a cold soot-dark hearth.
    # No flame, liquid surface, salt quantity or recipe output is invented.
    c.poly([(2,11),(5,10),(11,10),(14,12),(14,15),(1,15),(1,13)],"ink")
    c.poly([(2,13),(4,12),(5,14),(3,14)],"sd")
    c.poly([(11,12),(13,13),(12,14),(10,14)],"sd")
    c.rect(5,13,5,2,"black");c.dot(6,14,"ash");c.dot(9,13,"woodd")
    c.rect(4,10,2,3,"ink");c.rect(10,10,2,3,"ink")
    c.poly([(3,3),(5,1),(10,1),(13,3),(14,7),(12,10),(10,12),(5,12),(3,10),(1,6)],"ink")
    c.poly([(3,5),(12,5),(12,8),(10,11),(6,11),(4,9)],"sd")
    c.poly([(3,5),(5,6),(5,9),(7,10),(6,11),(4,9)],"stone")
    c.poly([(4,3),(6,2),(10,2),(12,3),(12,5),(10,6),(5,6),(3,4)],"stone")
    c.poly([(5,3),(10,3),(11,4),(9,5),(6,5),(4,4)],"black")
    c.line([(4,3),(6,2),(10,2),(11,3)],"sl")
    c.line([(5,6),(10,6)],"deep")
    c.line([(0,4),(0,7),(2,8)],"ink",2)
    c.line([(14,4),(15,5),(15,7),(13,8)],"ink")
    c.dot(0,5,"stone");c.dot(15,5,"stone")
    c.line([(6,11),(10,11)],"deep")
    return c


for name,draw,note in [
    ("loom",loom,"standing timber loom with hanging ivory warp, heddle and treadle"),
    ("tanning_vat",tanning_vat,"round slatted hide vat with dark liquid and draped irregular pale hide"),
    ("artisan",artisan,"precision craft bench, upright vise and faceted grinding wheel"),
    ("saltwork",saltwork,"single large communal metal salt cauldron with side handles, support legs and soot-dark cold hearth; no flame or invented current contents"),
]:extra_ground(name,draw(),note,CROP_STATION_GROUND)


def tower_sensor():
    c=C(16,16)
    c.rect(6,1,4,12,"ink");c.rect(7,2,2,9,"brassd")
    c.rect(7,3,1,5,"sl");c.rect(8,9,1,3,"rust")
    c.poly([(4,4),(5,2),(10,2),(12,4),(12,7),(10,9),(5,9),(4,7)],"ink")
    c.poly([(5,4),(6,3),(9,3),(11,4),(11,7),(9,8),(6,8),(5,7)],"stone")
    c.rect(7,4,2,3,"deep");c.dot(8,5,"brass")
    c.line([(2,11),(6,10),(10,10),(14,12)],"ink",2)
    c.poly([(2,13),(5,11),(11,11),(14,13),(13,15),(3,15)],"ink")
    c.rect(4,12,8,2,"sd");c.line([(5,12),(10,12)],"stone")
    return c


def receiver_conduit():
    c=C(16,16)
    c.line([(2,1),(2,11),(4,13),(11,13),(13,11),(13,5)],"ink",4)
    c.line([(2,2),(2,10),(4,12),(10,12),(12,10),(12,5)],"brassd",2)
    c.line([(2,3),(2,9),(4,11),(9,11)],"brass")
    c.rect(10,3,5,3,"ink");c.rect(11,4,3,1,"brass")
    c.rect(0,4,4,2,"ink");c.rect(1,4,2,1,"bl")
    c.rect(6,10,2,5,"ink");c.rect(6,11,1,3,"rust")
    c.poly([(7,3),(9,1),(11,2),(11,5),(9,7),(7,6)],"ink")
    c.rect(8,3,2,2,"teald");c.dot(8,3,"tl")
    c.line([(10,6),(9,9),(10,11)],"teal")
    return c


def spire_console():
    c=C(16,16)
    c.poly([(2,15),(2,8),(5,3),(12,3),(15,8),(14,15)],"ink")
    c.poly([(3,8),(6,4),(11,4),(13,8),(12,10),(4,10)],"teald")
    c.poly([(4,9),(12,9),(13,14),(3,14)],"sd")
    c.line([(6,4),(11,4),(12,6)],"teal")
    c.rect(6,6,2,2,"brassd");c.dot(6,6,"bl")
    c.rect(10,6,1,2,"brass");c.dot(4,8,"ivoryd")
    c.rect(6,11,4,2,"ink");c.line([(6,11),(9,11)],"brass")
    c.line([(12,3),(12,0),(14,0)],"ink",2);c.dot(12,1,"brass")
    return c


def zero_vault_seal():
    c=C(16,16)
    c.poly([(2,15),(2,5),(5,2),(10,2),(14,6),(14,15)],"ink")
    c.poly([(3,14),(3,6),(6,3),(9,3),(13,7),(13,14)],"sd")
    c.poly([(5,5),(10,5),(12,7),(12,11),(10,13),(5,13),(3,11),(3,7)],"ink")
    c.poly([(6,6),(9,6),(11,8),(11,10),(9,12),(6,12),(4,10),(4,8)],"brassd")
    c.line([(6,6),(9,6),(10,7)],"bl")
    c.line([(5,9),(10,9)],"brass");c.line([(8,6),(8,11)],"brass")
    c.rect(7,8,2,3,"ink");c.dot(7,8,"sl")
    c.rect(1,7,4,2,"ink");c.rect(1,7,3,1,"sl")
    c.rect(11,7,4,2,"ink");c.rect(12,7,3,1,"sl")
    return c


def leaking_conduit():
    c=C(16,16)
    c.poly([(0,4),(4,3),(7,4),(10,3),(15,4),(15,10),(11,11),(7,10),(4,11),(0,10)],"ink")
    c.poly([(1,5),(4,4),(7,5),(10,4),(14,5),(14,9),(10,10),(7,9),(4,10),(1,9)],"sd")
    c.line([(1,5),(4,4),(6,5)],"sl");c.line([(10,4),(14,5)],"stone")
    c.rect(3,3,2,8,"ink");c.rect(3,4,1,6,"brass")
    c.rect(12,3,2,8,"ink");c.rect(12,4,1,6,"brassd")
    c.line([(8,4),(7,6),(9,8),(7,10)],"black",2)
    c.line([(8,9),(8,12),(7,14)],"teal")
    c.dot(8,11,"tl");c.poly([(5,14),(8,13),(11,14),(10,15),(5,15)],"water")
    return c


for name,draw,note in [
    ("tower_sensor",tower_sensor,"upright temperature probe and octagonal gauge on a stone maintenance foot"),
    ("receiver_conduit",receiver_conduit,"bent brass service conduit, flanges, glass coupler and exposed signal wire"),
    ("spire_console",spire_console,"sloping teal control lectern, neutral brass contacts and bent aerial"),
    ("zero_vault_seal",zero_vault_seal,"heavy fixed seal wheel with central keyed spindle and side locking rods"),
    ("leaking_conduit",leaking_conduit,"horizontal fractured old stone pipe with contaminated teal drip"),
]:extra_ground(name,draw(),note+"; no invented success, failure or numeric state",DEVICE_CAMP_GROUND)


def field_mat():
    c=C(16,16)
    c.poly([(3,1),(13,2),(14,13),(11,15),(1,13),(2,5)],"ink")
    c.poly([(4,2),(12,3),(12,12),(10,14),(2,12),(3,5)],"moss")
    for x,y in [(4,3),(6,3),(8,4),(10,4)]:c.line([(x,y),(x-1,y+8)],"stone")
    c.line([(3,5),(11,6)],"woodd");c.line([(2,11),(11,12)],"woodd")
    c.line([(4,2),(11,3)],"sl");c.dot(3,12,"wood")
    return c


def straw_bed():
    c=C(16,16)
    c.poly([(2,2),(13,2),(14,13),(12,15),(1,14),(1,4)],"ink")
    c.rect(2,3,11,10,"woodd");c.rect(3,3,9,10,"wood")
    c.poly([(3,3),(6,4),(8,2),(11,4),(12,7),(11,9),(13,12),(10,14),(7,12),(4,14),(2,10),(4,8),(2,6)],"ivoryd")
    c.line([(3,4),(6,6),(5,9),(6,12)],"wl")
    c.line([(8,4),(8,7),(10,9),(8,12)],"ivory")
    c.line([(11,5),(9,6)],"ivory");c.line([(3,10),(4,12)],"ivory")
    c.line([(7,8),(6,10)],"wood")
    return c


def good_bed():
    c=C(16,16)
    c.rect(1,1,14,14,"ink");c.rect(2,2,12,12,"wood")
    c.rect(3,3,10,3,"ivoryd");c.rect(4,3,3,2,"il");c.rect(9,3,3,2,"ivory")
    c.rect(3,6,10,7,"teald")
    c.poly([(4,6),(12,6),(12,10),(10,13),(4,12)],"teal")
    c.line([(4,7),(11,7)],"tl");c.line([(4,10),(11,11)],"teald")
    c.rect(3,12,10,1,"ivoryd");c.rect(3,13,10,1,"brassd")
    for x,y in [(1,1),(13,1),(1,13),(13,13)]:
        c.rect(x,y,2,2,"brassd");c.dot(x,y,"bl")
    return c


for name,draw,note in [
    ("field_mat",field_mat,"thin woven reed and twig sleeping mat with two visible bindings"),
    ("straw_bed",straw_bed,"uneven loose straw bedding in a low simple timber frame"),
    ("good_bed",good_bed,"brass-capped carved bed with two linen pillows and folded teal cover"),
]:extra_ground(name,draw(),note,DEVICE_CAMP_GROUND)


def beacon():
    c=C(16,16)
    c.poly([(1,15),(4,9),(5,4),(11,4),(12,9),(15,15)],"ink")
    c.poly([(3,14),(5,9),(6,6),(10,6),(11,10),(13,14)],"sd")
    c.line([(6,7),(5,12),(4,14)],"stone")
    c.poly([(2,2),(13,2),(14,4),(12,7),(4,7),(1,4)],"ink")
    c.poly([(3,3),(12,3),(11,5),(5,5)],"brassd")
    c.line([(3,3),(12,3)],"brass");c.line([(5,6),(10,6)],"rust")
    c.line([(6,3),(8,4),(10,3)],"black")
    c.rect(6,11,4,3,"teald");c.dot(7,11,"teal")
    return c


def depot():
    c=C(16,16)
    c.rect(1,2,2,13,"ink");c.rect(13,2,2,13,"ink")
    c.rect(2,3,1,11,"wood");c.rect(13,3,1,11,"wood")
    c.rect(1,2,14,2,"woodd");c.rect(2,2,11,1,"wl")
    c.rect(2,8,12,2,"ink");c.rect(3,8,10,1,"wood")
    # Upright tied sacks and horizontal folded linen give a communal supply rack.
    c.poly([(4,7),(4,5),(5,4),(7,4),(8,5),(8,7)],"ivoryd")
    c.line([(5,4),(6,5)],"wood")
    c.rect(9,5,3,2,"teald");c.rect(9,5,3,1,"teal")
    c.poly([(3,14),(3,11),(5,10),(7,11),(8,14)],"ivoryd")
    c.dot(5,11,"ivory")
    c.poly([(9,14),(9,11),(10,10),(12,11),(12,14)],"wood")
    c.line([(9,14),(12,14)],"wl")
    c.rect(3,14,10,1,"woodd")
    return c


def altar(opened=False):
    c=C(16,16)
    c.poly([(1,15),(2,10),(3,8),(13,8),(14,11),(15,15)],"ink")
    c.poly([(3,14),(4,9),(12,9),(13,14)],"sd")
    c.rect(4,10,8,3,"stone");c.rect(7,10,2,3,"teald")
    c.line([(3,14),(12,14)],"stone")
    if not opened:
        c.poly([(1,7),(3,4),(12,4),(15,7),(14,9),(2,9)],"ink")
        c.poly([(3,6),(4,5),(11,5),(13,7),(3,7)],"stone")
        c.line([(3,6),(5,5),(10,5)],"sl")
        c.rect(6,5,4,5,"red");c.rect(7,6,2,2,"ivoryd")
        c.dot(7,6,"bl")
    else:
        c.poly([(3,7),(3,1),(12,1),(14,3),(13,7)],"ink")
        c.rect(4,2,8,4,"sd");c.line([(4,2),(11,2)],"sl")
        c.rect(7,2,2,4,"red")
        c.poly([(2,8),(4,6),(12,6),(14,8),(12,10),(4,10)],"stone")
        c.poly([(4,8),(5,7),(11,7),(12,8),(10,9),(5,9)],"black")
        c.dot(7,8,"brassd")
    return c


for name,draw,note in [
    ("beacon",beacon,"tapered coastal signal brazier on tall old masonry with a neutral dark bowl"),
    ("resident_depot",depot,"open communal provision rack, tied linen sacks and stacked cloth"),
    ("altar_closed",lambda:altar(False),"stone altar coffer with rust-red hanging cloth and closed beveled slab"),
    ("altar_open",lambda:altar(True),"stone altar coffer with raised rear slab and exposed dark recess"),
]:extra_ground(name,draw(),note,DEVICE_CAMP_GROUND)


def ground_fire(frame):
    c=C(16,16)
    # Three new handle-free fire contours specifically fit inside one tile.
    poses=[[(2,14),(1,10),(3,6),(5,8),(7,5),(7,0),(10,4),(9,7),(12,5),(13,9),(15,12),(12,15),(5,15)],
           [(2,14),(1,11),(4,8),(5,10),(7,6),(9,2),(11,1),(11,6),(10,9),(13,8),(14,12),(12,15),(5,15)],
           [(2,14),(2,10),(4,5),(6,8),(7,4),(6,1),(9,3),(11,7),(10,9),(13,6),(14,10),(13,14),(10,15),(5,15)]]
    c.poly(poses[frame],"redd")
    c.poly([(3,13),(4,9),(6,10),(8,5+frame),(9,10),(12,8+frame),(12,13),(10,15),(5,15)],"ember")
    c.poly([(5,14),(6,10+frame),(8,8),(8,12),(10,10),(11,13),(9,15),(6,15)],"flame")
    c.poly([(7,14),(8,11),(9,14),(8,15),(6,15)],"firelight")
    c.dot([3,12,5][frame],[3,1,0][frame],"flame")
    return c


for i in range(3):
    extra_ground(f"fire{i}",ground_fire(i),f"handle-free floor/wood/bedding/campfire flame; outer and inner contour pose {i+1}/3",DEVICE_CAMP_GROUND)


def rubble():
    c=C(16,16)
    # Fallen masonry only: angular slabs, a split old brick, separate gravel.
    c.poly([(0,12),(3,8),(8,8),(10,11),(14,10),(15,13),(11,15),(3,15)],"deep")
    c.poly([(2,10),(2,6),(5,3),(8,4),(9,8),(7,11),(3,12)],"ink")
    c.poly([(3,7),(5,4),(7,5),(8,8),(6,10),(3,10)],"stone")
    c.poly([(3,7),(5,4),(7,5),(5,7)],"sl")
    c.line([(5,7),(6,9),(5,10)],"sd")
    c.poly([(8,9),(9,6),(13,5),(15,8),(14,11),(11,12)],"ink")
    c.poly([(10,8),(10,7),(13,6),(14,8),(12,10),(10,10)],"sd")
    c.line([(10,7),(13,6),(14,8)],"stone")
    # Chamfered wall-brick fragment lies across the front of the slab pile.
    c.poly([(3,12),(5,10),(8,10),(10,12),(8,14),(4,14)],"ink")
    c.poly([(4,12),(5,11),(8,11),(9,12),(7,13),(4,13)],"ivoryd")
    c.line([(5,11),(7,11)],"sl")
    c.line([(7,11),(6,12),(7,13)],"sd")
    c.rect(1,13,2,1,"stone");c.dot(0,14,"sd")
    c.poly([(11,13),(13,12),(14,13),(12,14)],"stone")
    c.dot(12,12,"sl");c.dot(9,15,"sd");c.dot(15,11,"sd")
    return c


# Append after all existing ground art: preserves every previous atlas coordinate.
extra_ground("rubble",rubble(),"fallen stone slabs, split chamfered wall brick and loose gravel; no skull or bone",BASE_GROUND)


def boat_frame():
    c=C(16,16)
    # Top-down, unfinished hull: pointed stem, narrow curved timber rails.
    # The hull opening is truly transparent so the real shallow water shows.
    c.poly([(7,0),(10,2),(12,5),(14,9),(13,12),(10,14),(7,15),(4,14),(2,11),(2,7),(4,3)],"ink")
    c.poly([(7,1),(9,3),(11,5),(13,9),(12,12),(9,13),(7,14),(5,13),(3,10),(3,7),(5,4)],"woodd")
    c.poly([(7,3),(9,4),(10,6),(12,9),(11,11),(9,12),(7,13),(5,11),(4,9),(5,6)],(0,0,0,0))
    c.line([(7,1),(5,4),(3,7),(3,10),(5,13),(7,14)],"wood")
    c.line([(9,3),(11,5),(13,9),(12,12),(9,13)],"wood")
    c.line([(6,3),(4,7),(4,9)],"wl")
    c.line([(11,6),(12,8)],"wl")
    # Three visible transverse ribs bow toward the stern; gaps stay open.
    c.line([(5,4),(6,5),(9,5),(10,4)],"wood")
    c.line([(3,7),(5,8),(10,8),(12,7)],"wood")
    c.line([(3,10),(5,11),(10,11),(12,10)],"wood")
    # A straight cross brace and exposed keel ends, without a completed deck.
    c.line([(5,8),(10,8)],"wl")
    c.line([(7,1),(7,3)],"wood");c.line([(7,12),(7,14)],"wood")
    c.dot(5,5,"wl");c.dot(10,11,"wl")
    return c


extra_ground("boat_frame",boat_frame(),"unfinished brown timber hull, exposed curved ribs and cross brace; transparent water-facing gaps and exterior",DEVICE_CAMP_GROUND)


def svg(im, title):
    # No tracing: the pixel array is the output of the coordinate authorship above.
    # Save horizontal same-color runs so the SVG stays practical to hand edit.
    w,h=im.size
    px=im.load()
    result=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" shape-rendering="crispEdges">',f'<title>{title}</title>']
    for y in range(h):
        x=0
        while x<w:
            color=px[x,y]
            end=x+1
            while end<w and px[end,y]==color:end+=1
            if color[3]:
                hexcolor="#%02x%02x%02x"%color[:3]
                result.append(f'<rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{hexcolor}"/>')
            x=end
    result.append('</svg>')
    return "\n".join(result)+"\n"


def pack(keys, target_width=256):
    placements={};x=y=rowh=0
    for key in keys:
        w,h=ART[key].size
        if x and x+w>target_width:
            x=0;y+=rowh+2;rowh=0
        placements[key]=(x,y,w,h)
        x+=w+2;rowh=max(rowh,h)
    width=max(x+w for x,y,w,h in placements.values())
    height=max(y+h for x,y,w,h in placements.values())
    im=Image.new("RGBA",(width,height))
    for key,(x,y,w,h) in placements.items():im.alpha_composite(ART[key],(x,y))
    return im,placements


fragment={"sheets":{},"frames":{},"actualGround":GROUND,
          "anims":{"complete_fire":{"frames":[f"complete_fire{i}" for i in range(3)],"fps":7}}}
sheet_stats={}
for sheet in dict.fromkeys(SHEET_OF.values()):
    keys=[k for k in ART if SHEET_OF[k]==sheet]
    width=384 if sheet=="kt_props" else 576 if sheet=="cd_littleeyes" else 384 if sheet=="cd_veina1" else 256
    im,positions=pack(keys,width)
    path=OUT/f"{sheet}.png"
    png_bytes=emit_png(path,im)
    emit_text(OUT/f"{sheet}.svg",svg(im,f"ASHVEIL original props — {sheet}"))
    fragment["sheets"][sheet]=f"sprites/original/complete/props/{sheet}.png"
    for key,rect in positions.items():fragment["frames"][key]=[sheet,*rect]
    sheet_stats[sheet]={"size":list(im.size),"frames":len(keys),"sha256":hashlib.sha256(png_bytes).hexdigest()}

emit_text(FRAGMENT,json.dumps(fragment,ensure_ascii=False,indent=2)+"\n")
emit_text(OUT/"palette.json",json.dumps(P,indent=2)+"\n")


def contact(filename, keys, cols, cell, scale=3):
    rows=math.ceil(len(keys)/cols)
    cw,ch=cell
    im=Image.new("RGB",(cols*cw,rows*ch),(38,45,43))
    d=ImageDraw.Draw(im)
    font=ImageFont.load_default()
    for n,key in enumerate(keys):
        x=(n%cols)*cw;y=(n//cols)*ch
        d.rectangle((x+1,y+1,x+cw-2,y+ch-2),fill=(48,57,52),outline=(64,76,67))
        art=ART[key]
        # Contact resizes only these new in-memory authored frames.
        enlarged=art.resize((art.width*scale,art.height*scale),Image.Resampling.NEAREST)
        ox=x+(cw-enlarged.width)//2;oy=y+ch-18-enlarged.height
        im.paste(enlarged,(ox,oy),enlarged)
        d.text((x+5,y+ch-14),key,fill=(202,204,179),font=font)
    emit_png(OUT/filename,im)


small=[k for k in ART if SHEET_OF[k]=="objects"]+["pot0","pot1","pot2","books0","books1","cd_urn_1"]
contact("contact-01-containers-lights.png",small,6,(130,132),3)
contact("contact-02-stone-and-wood.png",["statue","sarcophagus","broken_column","niche_statue","seat","tree","tree_dead","rock","mushrooms","chain0","cd_statue_b1"],4,(190,286),2)
contact("contact-03-brazier-motion.png",[f"brazier{i}" for i in range(8)],4,(128,158),2)
contact("contact-04-sinew-motion.png",[f"cd_veina1_{i}" for i in range(24)],8,(108,106),5)
contact("contact-05-eyes-motion.png",[f"cd_littleeyes_{i}" for i in range(36)],6,(126,108),5)
contact("contact-06-ground-replacements.png",BASE_GROUND,4,(154,116),5)
contact("contact-07-crops-stations.png",CROP_STATION_GROUND,4,(154,116),5)
contact("contact-08-devices-camp.png",DEVICE_CAMP_GROUND,4,(166,116),5)

# Meaningful structural checks, independent of the future manifest merge.
catalog=json.loads((ROOT/"tools/art/complete-catalog-v302-before.json").read_text())
legacy={k:v for k,v in catalog["registry"]["frames"].items() if v[0] in set(sheet_stats)-{"complete_props_ground"}}
assert len(legacy)==105
for key,old in legacy.items():
    assert key in ART,key
    assert ART[key].size==tuple(old[3:5]),(key,ART[key].size,old[3:5])
for key in GROUND:assert ART[key].size==(16,16)
assert ART["complete_boat_frame"].getpixel((7,7))[3]==0,"boat hull interior must reveal the real water"
assert ART["complete_boat_frame"].getpixel((0,0))[3]==0,"boat exterior must stay transparent"
for sheet in sheet_stats:
    placements=[(k,v[1:]) for k,v in fragment["frames"].items() if v[0]==sheet]
    sw,sh=sheet_stats[sheet]["size"]
    for n,(key,(x,y,w,h)) in enumerate(placements):
        assert x>=0 and y>=0 and x+w<=sw and y+h<=sh,(key,"bounds")
        for other,(xx,yy,ww,hh) in placements[n+1:]:
            assert x+w<=xx or xx+ww<=x or y+h<=yy or yy+hh<=y,(key,other,"overlap")
for prefix,count in [("brazier",8),("cd_veina1_",24),("cd_littleeyes_",36),("complete_fire",3)]:
    unique=len({hashlib.sha256(ART[f"{prefix}{i}"].tobytes()).hexdigest() for i in range(count)})
    assert unique==count,(prefix,unique,count)
for key,im in ART.items():
    assert im.getbbox(),key
    assert set(im.getchannel("A").tobytes())<={0,255},key

report={"authorship":"New integer coordinates and material clusters in draw-complete-props.py. No source PNG opened, cropped, sampled, traced or recolored.",
        "legacyFrames":105,"newGroundFrames":len(GROUND),"totalFrames":len(ART),
        "sheets":sheet_stats,"actualGround":GROUND,"descriptions":NOTES,
        "animationUniqueFrames":{"brazier":8,"cd_veina1":24,"cd_littleeyes":36,"complete_fire":3},
        "alpha":"binary 0/255 only","contract":"all 105 legacy keys and width/height exact; fresh nonoverlapping atlas coordinates",
        "bounds":"all frame rectangles checked against sheet dimensions; pairwise nonoverlap checked"}
emit_text(OUT/"integrity.json",json.dumps(report,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"mode":"check" if CHECK else "write","artifacts":EMITTED,"sheets":len(sheet_stats),"legacyFrames":len(legacy),"groundFrames":len(GROUND),"totalFrames":len(ART),"animationUniqueness":"8/8, 24/24, 36/36, 3/3"}))
