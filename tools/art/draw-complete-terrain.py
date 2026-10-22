#!/usr/bin/env python3
"""Draw ASHVEIL v302 original terrain from authored integer pixel geometry.

No input images, extraction, recolouring, tracing, RNG, external packages or fonts.
The only read-only design input is the pre-migration JSON frame-size contract.
Run: python3 tools/art/draw-complete-terrain.py [--check]
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[2]
ART = Path('public/sprites/original/complete/terrain')
FRAGMENT = Path('tools/art/complete-terrain.fragment.json')
P = {
    '.': '#00000000', 'bg': '#18201f', 'panel': '#293330', 'label': '#d3d0b5',
    'joint': '#29322f', 'recess': '#202a28', 'edge': '#414b42',
    'stone': '#596253', 'stone2': '#626856', 'stone3': '#505b4e',
    'wear': '#737967', 'dust': '#818471', 'chip': '#3c473d',
    'moss0': '#303f35', 'moss1': '#435647', 'moss2': '#576b52', 'moss3': '#6c7c5c',
    'wood0': '#282e29', 'wood1': '#43473b', 'wood2': '#5d5f49',
    'book0': '#c0b895', 'book1': '#8d8966', 'book2': '#66765e',
    'book3': '#81715b', 'page': '#dbd0a7', 'brass': '#9e8b58',
    'grass0': '#475345', 'grass1': '#55614b', 'grass2': '#627052', 'grass3': '#778164',
    'earth0': '#484b40', 'earth1': '#56594a', 'earth2': '#676655', 'earth3': '#7b7761',
    'ash0': '#5c6258', 'ash1': '#6b7063', 'ash2': '#818674', 'ash3': '#959783',
    'water0': '#263d3c', 'water1': '#34514c', 'water2': '#47685d', 'water3': '#678072',
    'deep0': '#1e3032', 'deep1': '#294247', 'deep2': '#3d5757',
    'blood0': '#3d2729', 'blood1': '#61373a', 'blood2': '#7d4544', 'blood3': '#925951',
    'taint0': '#293d38', 'taint1': '#3a5245', 'taint2': '#536750', 'taint3': '#6e7b5b',
    'deck0': '#43483d', 'deck1': '#5b604d', 'deck2': '#6e7258', 'deck3': '#838469',
    'mud0': '#3c4640', 'mud1': '#4b5549', 'mud2': '#616657', 'mud3': '#747863',
}


class Canvas:
    def __init__(self, w, h, fill='.'):
        self.width, self.height = w, h
        self.pixels = [[fill] * w for _ in range(h)]

    def point(self, x, y, color):
        if 0 <= x < self.width and 0 <= y < self.height:
            self.pixels[y][x] = color

    def rect(self, x, y, w, h, color):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.point(xx, yy, color)

    def line(self, x0, y0, x1, y1, color):
        dx, sx = abs(x1-x0), 1 if x0 < x1 else -1
        dy, sy = -abs(y1-y0), 1 if y0 < y1 else -1
        error = dx + dy
        while True:
            self.point(x0, y0, color)
            if x0 == x1 and y0 == y1:
                break
            twice = 2 * error
            if twice >= dy:
                error += dy
                x0 += sx
            if twice <= dx:
                error += dx
                y0 += sy

    def path(self, points, color):
        for a, b in zip(points, points[1:]):
            self.line(*a, *b, color)

    def polygon(self, points, color):
        # Pixel-centre scan conversion; all authored vertices are integer pixels.
        for y in range(min(p[1] for p in points), max(p[1] for p in points)+1):
            for x in range(min(p[0] for p in points), max(p[0] for p in points)+1):
                inside, previous = False, points[-1]
                for px, py in points:
                    qx, qy = previous
                    if (py > y+.5) != (qy > y+.5) and x+.5 < (qx-px)*(y+.5-py)/(qy-py)+px:
                        inside = not inside
                    previous = (px, py)
                if inside:
                    self.point(x, y, color)

    def blit(self, other, x, y, scale=1):
        for yy, row in enumerate(other.pixels):
            for xx, color in enumerate(row):
                if color != '.':
                    self.rect(x+xx*scale, y+yy*scale, scale, scale, color)


def rgba(key):
    value = P.get(key, key).removeprefix('#')
    return bytes.fromhex(value) + (b'\xff' if len(value) == 6 else b'')


def png(c):
    def chunk(tag, data):
        return struct.pack('>I', len(data))+tag+data+struct.pack('>I', zlib.crc32(tag+data)&0xffffffff)
    raw = b''.join(b'\0'+b''.join(rgba(v) for v in row) for row in c.pixels)
    return (b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', struct.pack('>IIBBBBB', c.width, c.height, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9))+chunk(b'IEND', b''))


def svg(c, title):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{c.width}" height="{c.height}" viewBox="0 0 {c.width} {c.height}" shape-rendering="crispEdges">',
           '<title>'+title+'</title>', '<desc>Original integer pixel geometry; no external image inputs.</desc>']
    for y, row in enumerate(c.pixels):
        x = 0
        while x < c.width:
            end = x+1
            while end < c.width and row[end] == row[x]:
                end += 1
            if row[x] != '.':
                out.append(f'<rect x="{x}" y="{y}" width="{end-x}" height="1" fill="{P.get(row[x], row[x])}"/>')
            x = end
    return ('\n'.join(out)+'\n</svg>\n').encode()


def slab(c, x, y, w, h, tone='stone'):
    c.rect(x, y, w, h, 'joint')
    c.rect(x+1, y+1, w-1, h-1, 'edge')
    c.rect(x+1, y+1, w-2, h-2, tone)
    if w > 5:
        c.line(x+2, y+1, x+w-3, y+1, 'wear')
    if h > 5:
        c.line(x+1, y+2, x+1, y+3, 'stone2')


# Twenty independent crack paths also define deepest-floor slab topology.
SEAMS = [
    [(0,7),(5,7),(6,9),(15,9)], [(7,0),(7,4),(5,5),(5,15)],
    [(0,4),(10,4),(10,11),(15,11)], [(0,11),(4,11),(4,5),(15,5)],
    [(0,6),(8,6),(8,0),(8,12),(15,12)], [(0,3),(4,3),(4,10),(15,10)],
    [(11,0),(11,7),(8,9),(8,15)], [(0,9),(6,9),(6,4),(15,4)],
    [(3,0),(3,5),(9,5),(9,15)], [(0,12),(11,12),(11,6),(15,6)],
    [(0,5),(6,5),(8,7),(15,7)], [(5,0),(5,6),(12,6),(12,15)],
    [(0,10),(9,10),(9,3),(15,3)], [(12,0),(12,9),(5,9),(5,15)],
    [(0,3),(7,3),(7,11),(15,11)], [(3,0),(3,8),(10,8),(10,15)],
    [(0,8),(4,8),(4,13),(15,13)], [(9,0),(9,5),(2,5),(2,15)],
    [(0,13),(6,13),(6,6),(15,6)], [(13,0),(13,4),(7,4),(7,15)],
]

# Moss silhouette vertex lists are new artwork; shared colour grammar is not noise.
MOSS_SHAPES = [
    [(2,3),(7,2),(9,4),(13,4),(14,8),(11,10),(5,9),(2,6)],
    [(1,8),(4,6),(5,2),(9,3),(10,7),(14,9),(12,13),(6,13)],
    [(3,2),(8,1),(10,4),(9,7),(13,9),(12,13),(7,12),(4,8)],
    [(1,4),(5,4),(7,7),(12,6),(15,10),(12,14),(7,12),(3,11)],
    [(3,1),(6,3),(6,7),(10,8),(14,12),(11,15),(6,12),(2,7)],
    [(1,10),(4,7),(9,8),(11,3),(14,3),(14,9),(10,12),(3,14)],
    [(2,2),(6,1),(8,5),(13,5),(14,9),(11,12),(5,11),(3,7)],
    [(1,6),(5,3),(10,4),(12,2),(15,6),(12,9),(8,9),(5,13),(2,11)],
    [(2,12),(3,7),(7,6),(8,2),(12,1),(14,5),(11,8),(12,13),(7,15)],
    [(1,3),(6,2),(7,5),(12,8),(14,12),(10,14),(8,11),(2,9)],
    [(2,6),(5,2),(8,4),(12,3),(15,7),(12,11),(7,10),(3,14),(1,11)],
    [(1,9),(3,4),(7,5),(9,1),(13,2),(14,6),(10,9),(11,14),(6,13)],
]
MOSS_INNER = [
    [(4,4),(7,4),(8,6),(12,6),(11,8),(5,7)],
    [(4,9),(6,8),(6,4),(8,5),(8,9),(11,10),(9,11),(5,11)],
    [(5,3),(7,3),(7,7),(10,10),(9,11),(6,9)],
    [(3,6),(5,6),(7,9),(11,8),(12,10),(10,12),(5,10)],
    [(4,4),(5,7),(8,9),(11,12),(9,13),(5,10),(3,6)],
    [(4,10),(8,10),(12,5),(12,8),(10,11),(4,12)],
    [(4,3),(5,3),(7,7),(11,7),(12,9),(9,10),(5,9)],
    [(4,6),(6,5),(9,6),(12,4),(13,6),(10,8),(7,8),(4,11)],
    [(4,9),(8,8),(9,4),(11,3),(12,5),(9,9),(10,12),(6,13)],
    [(3,4),(5,4),(6,7),(10,9),(11,12),(9,12),(6,9),(3,8)],
    [(4,7),(6,4),(8,6),(12,5),(13,7),(10,9),(6,8),(3,11)],
    [(3,9),(4,6),(7,7),(10,3),(12,4),(11,6),(8,9),(9,12),(6,11)],
]
MOSS_ACCENTS = [
    (4,5,3),(5,10,3),(5,4,2),(4,7,2),(6,9,3),(5,11,3),
    (6,8,4),(6,6,3),(6,10,2),(4,5,2),(9,6,2),(5,8,3),
]


def moss_small(i):
    c = Canvas(16,16)
    c.polygon(MOSS_SHAPES[i], 'moss0')
    c.polygon(MOSS_INNER[i], 'moss2')
    x,y,w = MOSS_ACCENTS[i]
    c.rect(x,y,w,1,'moss3')
    c.rect(x+1,y+1,w-1,1,'moss1')
    return c


TRAILS = [
    [(3,0),(3,4),(5,6),(5,10),(9,12),(9,15)],
    [(12,0),(11,4),(8,6),(9,10),(5,12),(5,15)],
    [(0,6),(4,6),(6,8),(10,8),(12,11),(15,11)],
    [(7,0),(7,3),(10,5),(9,9),(12,12),(12,15)],
    [(0,12),(4,12),(7,9),(9,9),(11,5),(15,5)],
    [(2,0),(4,3),(4,7),(7,9),(7,12),(10,15)],
]


def moss_trail(i):
    c = Canvas(16,16)
    path = TRAILS[i]
    c.path(path,'moss0')
    for x,y in path[1:-1]:
        c.polygon([(x-2,y),(x,y-2),(x+3,y-1),(x+3,y+2),(x,y+3),(x-2,y+1)],'moss1')
        c.rect(x,y-1,2,2,'moss2')
    x,y = path[2]
    c.rect(x,y,2,1,'moss3')
    return c


LARGE_MOSS = [
    [(1,6),(7,3),(13,5),(16,2),(23,4),(26,10),(31,12),(28,18),(30,24),(23,29),(16,26),(11,30),(5,25),(7,18),(2,15)],
    [(2,4),(9,1),(14,6),(21,4),(28,8),(26,14),(31,19),(27,27),(20,30),(17,24),(10,27),(3,23),(6,16),(1,12)],
    [(4,1),(11,4),(16,3),(20,8),(28,6),(31,12),(27,16),(30,22),(24,29),(16,28),(12,23),(6,26),(1,21),(5,14),(2,8)],
    [(1,10),(8,5),(12,7),(16,1),(22,3),(25,10),(30,13),(28,20),(31,26),(24,29),(18,25),(11,30),(5,25),(6,19)],
    [(2,2),(10,4),(14,1),(20,5),(18,12),(26,10),(31,15),(27,22),(29,28),(21,31),(15,26),(9,28),(4,23),(6,16),(1,11)],
    [(1,8),(6,3),(13,5),(18,2),(24,7),(30,6),(31,13),(24,16),(28,22),(23,29),(16,27),(12,31),(5,26),(8,19),(2,16)],
    [(3,1),(9,4),(15,2),(19,7),(27,4),(30,10),(26,17),(31,22),(26,29),(18,30),(14,24),(8,28),(2,24),(5,17),(1,10)],
    [(1,5),(8,2),(13,7),(18,3),(25,5),(24,11),(30,15),(28,22),(30,28),(22,30),(17,25),(10,29),(4,23),(6,15),(2,12)],
    [(2,9),(7,4),(14,3),(18,7),(25,2),(30,8),(27,13),(31,20),(25,24),(23,30),(15,27),(10,31),(4,26),(6,19),(1,15)],
]
LARGE_ISLANDS = [
    [(5,8),(10,7),(13,10),(19,7),(23,10),(23,15),(18,18),(13,17),(9,21),(5,17)],
    [(7,5),(11,7),(13,11),(19,8),(24,10),(22,15),(25,20),(21,25),(17,20),(10,22),(8,16)],
    [(7,7),(12,8),(16,6),(19,11),(26,10),(25,14),(21,17),(24,22),(20,25),(14,23),(9,20)],
    [(5,12),(10,9),(14,11),(18,6),(21,9),(20,15),(25,16),(24,22),(19,21),(14,25),(9,22)],
    [(6,7),(10,8),(13,5),(16,8),(14,15),(21,14),(25,17),(23,22),(20,26),(14,21),(9,23),(7,17)],
    [(5,9),(9,7),(14,9),(18,6),(21,10),(19,15),(24,18),(21,23),(16,22),(12,26),(8,23),(11,17)],
    [(7,7),(11,9),(15,6),(17,10),(24,9),(24,13),(21,18),(26,23),(23,26),(18,25),(13,20),(9,23),(6,20)],
    [(5,7),(9,6),(13,11),(18,8),(21,9),(18,15),(25,17),(23,23),(20,25),(16,20),(10,25),(8,20),(10,14)],
    [(5,11),(9,8),(13,7),(17,12),(22,7),(26,9),(23,14),(27,19),(22,21),(20,26),(15,23),(11,26),(8,22),(10,17)],
]


def moss_large(i):
    c = Canvas(32,32)
    c.polygon(LARGE_MOSS[i],'moss0')
    c.polygon(LARGE_ISLANDS[i],'moss1')
    # Short connected velvety lobes, separately positioned in every colony.
    paths = [((8,10),(12,10),(14,13)),((10,12),(16,12),(18,15)),((11,11),(16,11),(18,14)),
             ((8,14),(13,14),(16,11)),((9,11),(12,13),(12,18)),((9,12),(13,14),(17,11)),
             ((10,11),(14,13),(18,12)),((10,10),(14,14),(18,11)),((9,12),(13,11),(17,15))]
    c.path(paths[i],'moss3')
    c.path([(x,y+1) for x,y in paths[i]],'moss2')
    c.rect(16+(i%3),20-(i%2),4,2,'moss2')
    return c


WALL_LAYOUTS = [
    [(0,4,9,5),(9,4,7,5),(0,9,5,5),(5,9,11,5)],
    [(0,4,5,6),(5,4,11,6),(0,10,11,4),(11,10,5,4)],
    [(0,4,12,5),(12,4,4,5),(0,9,7,5),(7,9,9,5)],
    [(0,4,7,4),(7,4,9,4),(0,8,12,6),(12,8,4,6)],
    [(0,4,6,7),(6,4,10,7),(0,11,10,3),(10,11,6,3)],
    [(0,4,10,6),(10,4,6,6),(0,10,4,4),(4,10,12,4)],
    [(0,4,4,5),(4,4,12,5),(0,9,10,5),(10,9,6,5)],
    [(0,4,11,4),(11,4,5,4),(0,8,6,6),(6,8,10,6)],
]
WALL_CRACKS = [
    [(11,5),(10,7),(11,8)],[(7,5),(8,7),(7,9)],[(4,10),(5,12),(7,13)],[(13,9),(12,11),(13,13)],
    [(2,6),(3,8),(2,10)],[(12,5),(11,7),(13,8)],[(8,10),(7,12),(8,13)],[(4,5),(5,6),(4,7)],
]


def wall_face(i):
    c = Canvas(16,16,'joint')
    c.rect(0,0,16,1,'wear');c.rect(0,1,16,2,'stone2');c.rect(0,3,16,1,'edge')
    for j,(x,y,w,h) in enumerate(WALL_LAYOUTS[i]):
        slab(c,x,y,w,h,['stone','stone3','stone2'][(i+j)%3])
    c.path(WALL_CRACKS[i],'chip')
    c.rect(0,14,16,1,'edge');c.rect(0,15,16,1,'recess')
    c.point((i*3+2)%15,1,'edge')
    return c


def wall_top():
    c = Canvas(16,16,'joint')
    c.polygon([(1,1),(7,1),(7,7),(3,7),(1,5)],'edge')
    c.polygon([(9,1),(15,1),(15,9),(9,9)],'chip')
    c.polygon([(1,9),(6,9),(6,15),(1,15)],'chip')
    c.polygon([(8,11),(14,11),(15,15),(8,15)],'edge')
    c.rect(2,2,3,1,'stone3');c.rect(10,12,3,1,'stone3')
    return c


def wall_edge(side):
    c = Canvas(16,16)
    if side == 'N':
        c.rect(0,0,16,1,'stone2');c.rect(0,1,16,1,'edge');c.rect(6,0,1,1,'chip')
    elif side == 'S':
        c.rect(0,13,16,1,'edge');c.rect(0,14,16,1,'stone3');c.rect(0,15,16,1,'recess')
    elif side == 'W':
        c.rect(0,0,1,16,'stone2');c.rect(1,0,1,16,'edge');c.rect(0,9,1,2,'chip')
    else:
        c.rect(13,0,1,16,'edge');c.rect(14,0,1,16,'stone3');c.rect(15,0,1,16,'recess')
    return c


def ledge(i):
    c = Canvas(16,16)
    c.rect(0,3,16,3,'stone3');c.rect(0,3,16,1,'stone2')
    c.rect(0,6,16,3,'edge');c.rect(0,9,16,2,'recess')
    c.rect(0,11,16,1,'chip')
    if i:
        c.rect(4,3,3,1,'edge');c.polygon([(10,4),(13,4),(13,8),(11,8)],'joint')
        c.rect(1,7,4,1,'stone3')
    else:
        c.rect(1,4,6,1,'wear');c.rect(8,7,5,1,'stone3');c.rect(14,3,2,2,'edge')
    return c


# Layout strings specify different book/scroll/stack silhouettes, not palette swaps.
BOOK_LAYOUTS = [
    ('Igo.B','slgI'),('B.Ig','gorl'),('rgI.g','BoI.'),('lgoI','s.Ig'),
    ('Ig.rI','vBg'),('sB.I','Igl.'),('ggl.I','rIB'),('vIgo','sl.I'),
    ('oBr.','gIgv'),('I.sgo','lIoB'),('r.lgI','sgg.'),('BgIv','I.rg'),
    ('s.gI','vIlo'),('l.Iog','BB.'),('Io.rg','slg.'),('vlg.','IgoB'),
    ('B.rI','gsl.'),('gI.lg','rB.I'),('sIo.','lvgI'),('rr.I','Bglo'),
    ('v.Bg','I.sl'),('lg.r','gIvB'),('IBl.','rgIo'),('go.s','vIlg'),
]
BOOK_METRICS = {'I':(1,5),'g':(2,4),'o':(2,5),'B':(3,5),'r':(3,2),'s':(4,3),'l':(3,5),'v':(3,4),'.':(2,0)}


def books(c, recipe, bottom):
    x = 2
    for token in recipe:
        w,h = BOOK_METRICS[token]
        if x+w > 14:
            break
        y = bottom-h
        if token == 'I':
            c.rect(x,y,w,h,'book0');c.point(x,bottom-2,'brass')
        elif token in ('g','o','B'):
            col = {'g':'book2','o':'book3','B':'book1'}[token]
            c.rect(x,y,w,h,col);c.line(x,y,x+w-1,y,'page')
            c.rect(x,y+2,w,1,'wood1')
        elif token == 'r':
            c.rect(x,y,w,h,'book0');c.point(x+1,y,'page');c.point(x+2,y+1,'book1')
        elif token == 's':
            c.rect(x,y,w,h,'book1');c.rect(x,y,w,1,'book3');c.rect(x+1,y+1,w-1,1,'page')
        elif token == 'l':
            c.polygon([(x,y),(x+1,y),(x+3,bottom),(x+1,bottom)],'book2')
            c.line(x,y,x+1,y+1,'page')
        elif token == 'v':
            c.polygon([(x,y+1),(x+2,y),(x+3,y+1),(x+3,bottom),(x,bottom)],'book3')
            c.rect(x,y+2,2,1,'book0')
        x += w


def shelf(i):
    c = Canvas(16,16,'wood0')
    c.rect(1,1,14,14,'recess')
    for y in (0,7,14):
        c.rect(0,y,16,1,'wood2');c.rect(0,y+1,16,1,'wood1')
    c.rect(0,0,1,16,'edge');c.rect(15,0,1,16,'edge')
    books(c,BOOK_LAYOUTS[i][0],7);books(c,BOOK_LAYOUTS[i][1],14)
    # Dust collects in a chosen empty corner rather than scattered single pixels.
    x = [2,11,7,3,10,5,9,2,12,6,10,3,8,2,11,5,9,4,12,2,7,10,3,9][i]
    c.rect(x,14,2,1,'book1')
    return c


TAINT_PATCHES = [
    [(0,8),(3,6),(6,8),(9,7),(12,10),(16,10),(16,15),(10,14),(7,16),(1,14)],
    [(4,0),(9,0),(10,4),(8,7),(9,11),(6,16),(2,16),(4,11),(3,7),(6,4)],
    [(0,1),(5,2),(7,5),(12,3),(16,5),(15,9),(10,9),(7,12),(3,9),(0,10)],
    [(7,0),(12,0),(11,4),(14,7),(12,11),(16,13),(16,16),(9,15),(7,11),(9,8),(6,5)],
    [(0,5),(4,4),(7,7),(11,5),(15,7),(16,12),(12,13),(9,10),(5,12),(0,10)],
]
TAINT_PATHS = [
    [(0,10),(4,10),(6,12),(12,12),(15,14)],[(6,0),(6,5),(5,7),(6,12),(4,15)],
    [(0,5),(4,5),(8,7),(12,5),(15,6)],[(10,0),(9,4),(11,7),(10,10),(15,14)],
    [(0,8),(5,7),(8,9),(12,8),(15,10)],[(0,11),(5,11),(7,13),(11,12),(15,13)],
    [(7,0),(8,4),(6,7),(7,10),(5,15)],[(0,4),(4,6),(7,6),(10,8),(15,7)],
    [(9,0),(10,4),(12,6),(11,10),(14,15)],[(0,7),(3,6),(7,8),(11,7),(15,9)],
    [(0,12),(3,11),(6,13),(10,13),(15,12)],[(5,0),(7,4),(7,7),(5,10),(6,15)],
    [(0,3),(4,4),(7,7),(11,6),(15,5)],[(11,0),(10,4),(12,8),(10,11),(15,15)],
    [(0,9),(4,8),(7,10),(11,9),(15,11)],[(0,13),(4,12),(7,14),(11,13),(15,15)],
    [(8,0),(7,4),(8,7),(6,10),(3,15)],[(0,6),(4,7),(8,6),(11,8),(15,8)],
    [(12,0),(11,4),(13,7),(12,11),(15,13)],[(0,6),(4,5),(8,8),(12,6),(15,8)],
]


def depth_floor(i):
    c = Canvas(16,16,'stone3')
    c.rect(1,1,14,14,'stone')
    c.rect(2,2,5+(i%4),2,'stone2')
    c.rect(9-(i%3),11,5,2,'edge')
    c.path(SEAMS[i],'joint')
    c.path([(x,y+1) for x,y in SEAMS[i]],'chip')
    c.polygon(TAINT_PATCHES[i%5],'taint0')
    c.path(TAINT_PATHS[i],'taint2')
    c.path([(x,y+1) for x,y in TAINT_PATHS[i]],'taint1')
    # One matte mineral scab: broad little plates, not luminous vein speckles.
    x,y = [(2,10),(6,5),(10,6),(9,9),(4,8),(9,12),(6,8),(4,6),(11,8),(10,8),
           (5,12),(6,10),(10,6),(11,11),(6,9),(10,13),(6,8),(8,7),(12,9),(10,7)][i]
    c.rect(x,y,3,1,'taint3');c.rect(x+1,y+1,2,1,'taint2')
    return c


def stairs():
    c=Canvas(16,16,'joint')
    c.rect(1,1,14,14,'recess')
    for x,y,w in [(2,3,12),(3,6,10),(4,9,8),(5,12,6)]:
        c.rect(x,y,w,1,'stone2');c.rect(x,y+1,w,1,'stone3');c.rect(x,y+2,w,1,'edge')
    c.rect(1,1,1,14,'edge');c.rect(14,1,1,14,'edge')
    return c


def ladder():
    c=Canvas(16,16)
    c.polygon([(2,1),(14,1),(15,3),(14,15),(2,15),(1,3)],'joint')
    c.rect(3,2,10,13,'recess')
    c.rect(4,1,2,15,'wood1');c.rect(10,1,2,15,'wood1')
    c.rect(4,1,1,15,'wood2');c.rect(10,1,1,15,'wood2')
    for y in (3,6,9,12):
        c.rect(5,y,6,1,'deck2');c.rect(5,y+1,6,1,'wood1')
    c.rect(3,1,3,1,'brass');c.rect(10,1,3,1,'brass')
    return c


def stairs_up():
    """Ascending stone treads widen towards the viewer; four visible risers."""
    c=Canvas(16,16,'joint')
    c.rect(1,1,14,14,'recess')
    c.polygon([(1,3),(5,1),(5,5),(3,8),(2,12),(1,15)],'edge')
    c.polygon([(11,1),(15,3),(15,15),(14,12),(13,8),(11,5)],'edge')
    for x,y,w in [(6,2,4),(5,5,6),(3,8,10),(2,11,12)]:
        c.rect(x,y,w,1,'wear')
        c.rect(x,y+1,w,1,'stone')
        c.rect(x,y+2,w,1,'stone3')
    c.rect(2,14,12,1,'edge')
    c.point(3,11,'stone2');c.point(11,8,'edge')
    return c


def ladder_down():
    """Square dark shaft with descending timber rails and muted metal brackets."""
    c=Canvas(16,16)
    c.rect(1,1,14,14,'joint')
    c.rect(1,1,14,1,'stone2')
    c.rect(1,2,1,12,'stone3');c.rect(14,2,1,12,'edge')
    c.rect(2,2,12,12,'recess')
    c.rect(2,14,12,1,'stone3')
    c.rect(3,3,10,10,'wood0')
    c.line(4,3,6,13,'wood1');c.line(11,3,9,13,'wood1')
    c.line(4,3,5,7,'wood2');c.line(11,3,10,7,'wood2')
    for x,y,w,tone in [(4,4,8,'deck2'),(5,7,6,'wood2'),(5,10,6,'wood1'),(6,12,4,'wood1')]:
        c.rect(x,y,w,1,tone)
    c.rect(3,1,3,2,'brass');c.rect(10,1,3,2,'brass')
    c.rect(4,1,1,1,'wood1');c.rect(11,1,1,1,'wood1')
    return c


def skull():
    c=Canvas(16,16)
    c.polygon([(5,4),(10,4),(12,6),(12,10),(10,12),(6,12),(4,10),(3,7)],'book1')
    c.polygon([(5,4),(9,4),(11,6),(11,9),(9,11),(6,11),(4,9),(4,6)],'book0')
    c.rect(5,7,2,2,'recess');c.rect(9,7,2,2,'recess')
    c.point(8,9,'wood1');c.rect(6,11,4,1,'page')
    c.point(7,11,'wood1');c.point(9,11,'wood1');c.line(7,4,8,6,'book1')
    return c


# Explicit tuft/soil islands: connected strokes and areas instead of dot noise.
GROUND_TUFTS = [
    [(1,4),(6,3),(10,7),(13,12),(4,13)],
    [(3,2),(10,3),(6,7),(2,11),(11,13)],
    [(1,7),(5,3),(12,2),(9,10),(4,14)],
]
SOIL_PATCHES = [
    [(0,5),(5,4),(8,8),(14,7),(16,10),(16,16),(9,15),(5,12),(0,13)],
    [(7,0),(12,0),(12,5),(9,8),(11,12),(6,16),(1,16),(3,11),(5,7)],
    [(0,1),(6,2),(9,5),(16,4),(16,9),(10,10),(7,13),(3,10),(0,10)],
]
SOIL_RUTS = [
    [(0,9),(4,9),(8,11),(12,10),(15,11)],
    [(6,0),(6,4),(8,7),(7,11),(10,15)],
    [(0,3),(4,5),(8,5),(12,7),(15,6)],
]


def tuft(c,x,y,colour='grass2'):
    c.path([(x-1,y+1),(x,y),(x,y-2)],colour)
    c.path([(x,y+1),(x+2,y-1)],'grass1')
    c.rect(x-1,y+2,4,1,'grass0')


def grass(i,mixed=False):
    c=Canvas(16,16,'grass0')
    c.polygon([(0,0),(8,0),(10,4),(6,7),(0,6)],'grass1')
    c.polygon([(7,9),(12,7),(16,10),(16,16),(10,16)],'grass1')
    if mixed:
        c.polygon(SOIL_PATCHES[i],'earth0')
        c.path(SOIL_RUTS[i],'earth1')
    for x,y in GROUND_TUFTS[i]:
        tuft(c,x,y)
    x,y=GROUND_TUFTS[i][1]
    c.rect(x,y,2,1,'grass3')
    return c


def dirt(i):
    c=Canvas(16,16,'earth0')
    c.polygon(SOIL_PATCHES[i],'earth1')
    c.path(SOIL_RUTS[i],'earth2')
    for x,y,w in [[(2,3,5),(9,13,4),(10,5,3)],[(1,9,4),(10,2,4),(5,13,3)],[(3,12,4),(11,10,4),(2,7,3)]][i]:
        c.rect(x,y,w,1,'earth2');c.rect(x+1,y+1,w-1,1,'earth1')
    # Flattened pebbles belong to material clumps, not unrelated bright dots.
    x,y=[(10,4),(3,10),(11,12)][i]
    c.rect(x,y,3,1,'stone2');c.rect(x+1,y+1,2,1,'edge')
    return c


MUD_POOLS = [
    [(1,7),(5,4),(9,5),(11,8),(15,9),(14,13),(8,14),(4,12),(1,13)],
    [(0,2),(6,1),(8,5),(12,4),(16,6),(16,11),(12,12),(9,9),(6,10),(2,7),(0,8)],
    [(0,5),(4,3),(9,4),(12,7),(16,6),(16,9),(11,10),(6,7),(2,8),(0,7)],
    [(4,0),(9,0),(8,5),(10,8),(8,12),(10,16),(5,16),(4,12),(6,8),(3,4)],
]
MUD_RIDGES = [
    [[(0,4),(4,3),(8,3)],[(2,14),(7,15),(12,14)],[(10,2),(13,3),(15,3)]],
    [[(1,10),(4,9),(7,11)],[(9,14),(12,13),(15,14)],[(11,1),(14,2),(15,4)]],
    [[(0,1),(5,1),(9,2),(13,2)],[(0,11),(4,10),(9,12),(15,11)],[(1,14),(6,13),(11,15)]],
    [[(0,6),(2,5),(4,6)],[(10,4),(13,3),(15,4)],[(0,13),(3,12),(4,14)],[(11,10),(13,11),(15,10)]],
]


def mud(i):
    c=Canvas(16,16,'mud0')
    c.polygon([(0,0),(8,0),(10,4),(6,7),(0,5)],'mud1')
    c.polygon([(7,9),(12,7),(16,10),(16,16),(10,16)],'mud1')
    c.polygon(MUD_POOLS[i],'water0')
    for path in MUD_RIDGES[i]:
        c.path(path,'mud2')
        c.path([(x,y+1) for x,y in path],'mud1')
    ripples=[[(4,8),(6,7),(9,8)],[(3,4),(6,5),(8,7)],
             [(1,6),(5,5),(9,7),(13,8)],[(6,2),(6,5),(7,7),(6,10),(7,13)]]
    c.path(ripples[i],'water1')
    if i == 1:
        tuft(c,11,14,'mud3');tuft(c,2,11,'mud2')
    elif i == 2:
        c.line(3,2,6,2,'mud3');c.line(8,13,11,14,'mud3')
    elif i == 3:
        c.polygon([(10,6),(12,5),(14,6),(13,8),(11,8)],'chip')
        c.polygon([(1,9),(3,8),(4,10),(3,11),(1,11)],'chip')
    else:
        c.rect(11,3,3,1,'mud3')
    return c


ASH_DRIFTS = [
    [[(0,4),(4,2),(9,3),(12,6),(16,5),(16,9),(11,10),(7,7),(0,8)],[(0,13),(7,11),(11,12),(16,11),(16,15),(8,16),(0,15)]],
    [[(0,1),(5,3),(10,1),(16,3),(16,6),(10,5),(5,7),(0,5)],[(1,12),(6,9),(12,10),(16,13),(15,16),(10,14),(5,15)]],
    [[(0,7),(4,4),(10,5),(14,3),(16,5),(12,8),(6,7),(2,10),(0,10)],[(2,13),(8,11),(12,12),(16,10),(16,14),(10,15),(6,14)]],
    [[(0,3),(4,1),(9,2),(11,5),(16,4),(16,7),(10,8),(6,5),(0,6)],[(0,11),(6,10),(11,12),(16,11),(16,15),(10,15),(5,13),(0,14)]],
]


def ash(i):
    c=Canvas(16,16,'ash0')
    for patch in ASH_DRIFTS[i]:
        c.polygon(patch,'ash1')
    paths = [[(1,5),(5,4),(8,5),(11,7)],[(1,3),(5,5),(10,3),(14,4)],
             [(2,8),(5,6),(10,7),(14,5)],[(1,4),(5,3),(8,4),(10,6)]]
    c.path(paths[i],'ash2')
    c.path([(x,y+8) for x,y in paths[i]][:3],'ash2')
    x,y=[(6,4),(10,3),(5,6),(6,3)][i]
    c.rect(x,y,2,1,'ash3')
    return c


def water(deep=False):
    c=Canvas(16,16,'deep0' if deep else 'water0')
    if deep:
        c.polygon([(0,2),(6,1),(10,3),(16,3),(16,7),(9,8),(4,6),(0,7)],'deep1')
        c.polygon([(0,13),(5,11),(11,12),(16,10),(16,14),(9,15),(3,14)],'deep1')
        for path in [[(1,3),(5,2),(8,3)],[(9,7),(13,7),(15,6)],[(3,12),(6,12),(8,13)]]:
            c.path(path,'deep2')
    else:
        c.polygon([(0,1),(5,2),(8,5),(13,4),(16,5),(16,9),(10,10),(5,7),(0,8)],'water1')
        c.polygon([(0,12),(4,10),(9,11),(13,14),(16,13),(16,16),(8,16),(4,14),(0,15)],'water1')
        for path in [[(0,3),(4,3),(7,5)],[(9,5),(13,5),(15,6)],[(1,12),(4,11),(7,12)],[(10,14),(13,15),(15,14)]]:
            c.path(path,'water2')
        c.line(2,3,4,3,'water3');c.line(11,14,12,14,'water3')
    return c


BLOOD_SHAPES = [
    [[(5,5),(8,4),(10,6),(9,9),(6,10),(4,8)],[(11,10),(13,10),(14,12),(11,13)]],
    [[(2,7),(5,5),(8,6),(10,10),(8,13),(4,12),(2,10)],[(11,3),(13,4),(12,6),(10,5)]],
    [[(6,1),(9,3),(10,7),(8,10),(9,14),(6,15),(4,11),(5,7),(4,4)]],
    [[(1,9),(5,8),(8,5),(12,6),(15,9),(12,12),(8,11),(5,14),(2,12)]],
    [[(3,4),(7,2),(11,3),(14,5),(15,9),(12,13),(7,15),(3,13),(1,9)]],
]


def blood(i):
    c=Canvas(16,16)
    for poly in BLOOD_SHAPES[i]:
        c.polygon(poly,'blood0')
    inner = [
        [(5,6),(8,5),(9,7),(7,9),(5,8)],
        [(3,8),(5,7),(7,8),(8,11),(5,12),(3,10)],
        [(6,3),(8,4),(8,7),(6,10),(7,13),(5,11),(6,7)],
        [(3,10),(6,9),(9,7),(12,8),(13,10),(9,10),(5,12)],
        [(4,5),(8,4),(11,5),(13,8),(11,11),(7,13),(4,11),(3,8)],
    ]
    c.polygon(inner[i],'blood1')
    x,y,w=[(6,6,2),(4,8,2),(6,5,1),(8,8,3),(6,6,4)][i]
    c.rect(x,y,w,1,'blood2')
    if i == 4:
        c.rect(5,10,3,1,'blood2');c.line(9,12,11,11,'blood1')
    return c


DECK_JOINTS = [[7,3,11],[3,10,6],[11,6,3]]


def deck(i):
    c=Canvas(16,16,'deck0')
    # Three weathered boards and two-pixel recessed seams; offset end joints.
    for row,(y,h) in enumerate([(0,5),(6,5),(12,4)]):
        c.rect(0,y,16,h,'deck1')
        c.rect(0,y,16,1,'deck2')
        c.rect(0,y+h-1,16,1,'deck0')
        joint=DECK_JOINTS[i][row]
        c.rect(joint,y,1,h,'wood0')
        c.rect(joint+1,y+1,1,1,'brass')
    grain=[[(1,2,4),(9,8,5),(5,13,4)],[(7,2,5),(1,9,5),(8,14,4)],[(3,3,5),(8,8,5),(5,14,5)]][i]
    for x,y,w in grain:
        c.rect(x,y,w,1,'deck2')
    x,y=[(4,8),(12,13),(8,2)][i]
    c.rect(x,y,3,1,'deck0');c.rect(x+1,y+1,2,1,'deck2')
    return c


# A compact self-authored 3x5 alphabet labels contact sheets only.
FONT = {
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


def label(c,x,y,value,scale=1):
    for i,letter in enumerate(value.upper()):
        for yy,row in enumerate(FONT[letter].split('/')):
            for xx,v in enumerate(row):
                if v == '1':
                    c.rect(x+(4*i+xx)*scale,y+yy*scale,scale,scale,'label')


def contact(title, members, columns=6, cell_w=140, cell_h=108, scale=4):
    rows=(len(members)+columns-1)//columns
    c=Canvas(16+columns*cell_w,48+rows*cell_h,'bg')
    label(c,12,12,title,2)
    for i,(key,art) in enumerate(members):
        x=12+(i%columns)*cell_w;y=40+(i//columns)*cell_h
        c.rect(x,y,cell_w-8,cell_h-8,'panel')
        # Coarse contact checker shows alpha without becoming the artwork.
        for yy in range(art.height):
            for xx in range(art.width):
                color = 'edge' if ((xx//4+yy//4)&1) else 'joint'
                c.rect(x+8+xx*scale,y+4+yy*scale,scale,scale,color)
        c.blit(art,x+8,y+4,scale)
        label(c,x+4,y+art.height*scale+12,key)
    return c


def study(ground):
    """Adjacent-tile reading of surface transitions and water/deck seam rhythm."""
    c=Canvas(448,400,'bg')
    label(c,12,12,'SURFACE MATERIAL STUDY / 4X',2)
    bands=[['grass0','grass1','grass2','grassdirt0','grassdirt1','grassdirt2'],
           ['dirt0','dirt1','dirt2','ash0','ash1','ash2'],
           ['water_shallow']*3+['water_deep']*3,
           ['deck0','deck1','deck2','deck1','deck2','deck0']]
    for row,keys in enumerate(bands):
        for col,key in enumerate(keys):
            c.blit(ground[key],16+col*64,44+row*80,4)
        label(c,16,112+row*80,'/'.join(keys[:3]))
    return c


def json_bytes(value):
    return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()


def build():
    groups = {
        'moss': [(f'moss_s{i}',moss_small(i)) for i in range(12)]
                + [(f'moss_t{i}',moss_trail(i)) for i in range(6)]
                + [(f'moss_l{i}',moss_large(i)) for i in range(9)],
        'walls': [(f'wall_face{i}',wall_face(i)) for i in range(8)]
                 + [('wall_top',wall_top())] + [(f'wall_edge_{s}',wall_edge(s)) for s in 'NSEW']
                 + [(f'wall_ledge{i}',ledge(i)) for i in range(2)]
                 + [(f'shelf{i}',shelf(i)) for i in range(24)],
        'depth': [(f'cd_floor{i}',depth_floor(i)) for i in range(20)],
        'misc': [('floor_stairs',stairs()),('floor_ladder',ladder()),('skull',skull()),
                 ('complete_stairs_up',stairs_up()),('complete_ladder_down',ladder_down())],
        'ground': [(f'grass{i}',grass(i)) for i in range(3)]
                  + [(f'grassdirt{i}',grass(i,True)) for i in range(3)]
                  + [(f'dirt{i}',dirt(i)) for i in range(3)]
                  + [(f'mud{i}',mud(i)) for i in range(4)]
                  + [(f'ash{i}',ash(i)) for i in range(4)]
                  + [('water_shallow',water()),('water_deep',water(True))]
                  + [(f'blood{i}',blood(i)) for i in range(4)] + [('blood_pool',blood(4))]
                  + [(f'deck{i}',deck(i)) for i in range(3)],
    }
    fragment={'sheets':{},'frames':{}}
    out={}
    for name,members in groups.items():
        # 32px cells preserve large-moss sizes; no source-image atlas is consulted.
        cell = 32 if name == 'moss' else 16
        columns = 6 if name == 'moss' else 8
        sheet=Canvas(columns*cell,((len(members)+columns-1)//columns)*cell)
        sheet_key='av_complete_terrain_'+name+'_v302'
        fragment['sheets'][sheet_key]=str(ART/f'{name}.png').removeprefix('public/')
        for i,(key,art) in enumerate(members):
            x,y=(i%columns)*cell,(i//columns)*cell
            sheet.blit(art,x,y)
            fragment['frames'][key]=[sheet_key,x,y,art.width,art.height]
        out[ART/f'{name}.png']=png(sheet)
        out[ART/f'{name}.svg']=svg(sheet,'ASHVEIL original terrain '+name+' v302')
    # Small and large moss have separate contact pages so every pixel is legible.
    out[ART/'contact-moss-small.png']=png(contact('MOSS SMALL AND TRAILS / 4X',groups['moss'][:18]))
    out[ART/'contact-moss-large.png']=png(contact('MOSS LARGE / 4X',groups['moss'][18:],3,156,156))
    out[ART/'contact-walls.png']=png(contact('STONE WALLS AND 24 BOOK GROUPS / 4X',groups['walls'],6))
    out[ART/'contact-depth.png']=png(contact('DEEPEST FLOOR / 4X',groups['depth'],5))
    out[ART/'contact-ground.png']=png(contact('HIGHLAND GROUND AND DECK / 4X',groups['ground'],5))
    out[ART/'contact-misc.png']=png(contact('STAIRS LADDER AND SKULL / 6X',groups['misc'],3,148,136,6))
    out[ART/'surface-study.png']=png(study(dict(groups['ground'])))
    out[FRAGMENT]=json_bytes(fragment)
    out[ART/'palette.json']=json_bytes(P)
    # Explicit contract validation does not read or decode any existing image.
    catalog=json.loads((ROOT/'tools/art/complete-catalog-v302-before.json').read_text())
    legacy={k:v for k,v in catalog['registry']['frames'].items()
            if v[0] in ('kt_moss','kt_walls','cd_tiles','x72_misc')}
    assert len(legacy) == 89
    for key,old in legacy.items():
        assert fragment['frames'][key][3:] == old[3:], (key,old,fragment['frames'][key])
    assert len(fragment['frames']) == 118
    assert set(fragment) == {'sheets','frames'}
    all_members=[member for members in groups.values() for member in members]
    hashes=[hashlib.sha256(png(art)).hexdigest() for _,art in all_members]
    assert len(hashes) == len(set(hashes)), 'Duplicate pixel frames'
    for name in ('depth','ground'):
        for key,art in groups[name]:
            if not key.startswith('blood'):
                assert all(v != '.' for row in art.pixels for v in row), key
    source={
        'version':'v302','created':'2026-10-22','method':'Direct authored integer coordinates, silhouette vertex lists, masonry layouts, book arrangements, connected material strokes and ripple paths.',
        'generator':'tools/art/draw-complete-terrain.py',
        'generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'externalImageInputs':[],'externalPixelExtraction':False,'tracing':False,'recolouring':False,'randomNoise':False,
        'softwareReuse':'Canvas/PNG/SVG scanline and contact conventions from own repository art tools; no artwork data imported.',
        'counts':{k:len(v) for k,v in groups.items()},'totalFrames':118,'legacyFramesWithDimensionsPreserved':89,
        'newGroundFrames':20,'newMudFrames':4,'newDeckFrames':3,'nativeTilePixels':16,
        'newDirectionalAccessFrames':['complete_stairs_up','complete_ladder_down'],
        'alpha':'Transparent moss, edges, ledges, skull, ladder and blood overlays; opaque base ground/depth/wall faces/stairs.',
        'groundDimensionChoice':'Former unregistered ground textures had32x32 file extents. These new registered frames are authored at16x16 to match D13 and16px renderer output; legacy manifest-frame dimensions remain unchanged.',
        'scopeExclusions':['murk_leech','kt_floor','item/ability icons','production manifest','Core/Def/renderer','browser/GPU/Full/World/type/project checks'],
        'verification':['89 legacy frame keys/dimensions equal frozen catalog','118 distinct pixel hashes','ground/depth base layers opaque','regeneration byte equality with --check'],
        'runtimeStatus':'Prepared fragment only; runtime integration and browser examination belong to coordinating task.',
        'frames':[{'key':key,'size':[art.width,art.height],'rgbaSha256':hashlib.sha256(b''.join(rgba(v) for row in art.pixels for v in row)).hexdigest()} for key,art in all_members],
        'files':[{'path':str(path),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for path,data in out.items()],
    }
    out[ART/'source-integrity.json']=json_bytes(source)
    return out


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    outputs=build()
    for rel,data in outputs.items():
        path=ROOT/rel
        if args.check:
            if not path.exists() or path.read_bytes() != data:
                raise SystemExit('DIFF '+str(rel))
        else:
            path.parent.mkdir(parents=True,exist_ok=True)
            path.write_bytes(data)
    print(('CHECK PASS' if args.check else 'WROTE')+f': {len(outputs)} original terrain artifacts /118 frames /89 preserved legacy sizes')


if __name__ == '__main__':
    main()
