#!/usr/bin/env python3
"""ASHVEIL v302: four missing creature kinds, authored at integer 16px coordinates.

New art never reads an image. The separate review_existing() function may read only
the project's own original sheets, to assemble explicitly labelled audit contacts.
No game definitions, renderer, shared manifest, or existing art is written.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/sprites/original/complete/creatures'
DIRS = ['down', 'left', 'right', 'up']
KINDS = ['ash_hound', 'ash_hound_alpha', 'burrow_rat', 'murk_leech', 'complete_reaver_chief', 'complete_reaver_archer']
P = {
    '.': (0, 0, 0, 0),
    'o': (30, 37, 35, 255), 'k': (43, 48, 43, 255),
    'd': (66, 75, 65, 255), 'f': (92, 99, 88, 255),
    'm': (125, 129, 112, 255), 'l': (153, 154, 133, 255),
    'h': (173, 168, 137, 255), 'b': (74, 61, 49, 255),
    'n': (104, 85, 63, 255), 'r': (132, 103, 77, 255),
    'p': (155, 115, 94, 255), 'q': (104, 75, 65, 255),
    'e': (205, 190, 151, 255), 'a': (158, 135, 79, 255),
    's': (69, 67, 63, 255), 'v': (91, 88, 79, 255),
    'w': (123, 117, 99, 255), 't': (57, 65, 58, 255),
    'u': (82, 96, 80, 255), 'g': (111, 124, 99, 255),
    'z': (37, 42, 43, 255), 'c': (190, 180, 149, 255),
    'F': (175, 138, 103, 255), 'S': (119, 88, 68, 255),
    'H': (61, 53, 46, 255), 'C': (83, 84, 70, 255),
    'J': (114, 91, 70, 255), 'L': (151, 139, 105, 255),
    'B': (60, 55, 46, 255), 'R': (122, 133, 115, 255),
    'A': (82, 97, 91, 255), 'D': (59, 69, 65, 255),
}


class Canvas:
    def __init__(self, w=16, h=16, fill='.'):
        self.w, self.h = w, h
        self.data = [[P[fill] if isinstance(fill, str) else fill for _ in range(w)] for _ in range(h)]

    def p(self, x, y, c):
        assert isinstance(x, int) and isinstance(y, int)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.data[y][x] = P[c] if isinstance(c, str) else c

    def rect(self, x, y, w, h, c):
        for yy in range(y, y+h):
            for xx in range(x, x+w): self.p(xx, yy, c)

    def line(self, x0, y0, x1, y1, c):
        dx, sx = abs(x1-x0), 1 if x0 < x1 else -1
        dy, sy = -abs(y1-y0), 1 if y0 < y1 else -1
        err = dx+dy
        while True:
            self.p(x0, y0, c)
            if x0 == x1 and y0 == y1: break
            e2 = 2*err
            if e2 >= dy: err += dy; x0 += sx
            if e2 <= dx: err += dx; y0 += sy

    def poly(self, points, fill, border='o'):
        # Integer-coordinate, hard-edged fill. No smoothing/resampling/noise.
        for y in range(min(p[1] for p in points), max(p[1] for p in points)+1):
            for x in range(min(p[0] for p in points), max(p[0] for p in points)+1):
                inside = False
                j = len(points)-1
                for i, (xi, yi) in enumerate(points):
                    xj, yj = points[j]
                    if (yi > y) != (yj > y) and x < (xj-xi)*(y-yi)/(yj-yi)+xi:
                        inside = not inside
                    j = i
                if inside: self.p(x, y, fill)
        for a, b in zip(points, points[1:]+points[:1]): self.line(*a, *b, border)

    def stamp(self, x, y, rows):
        for yy, row in enumerate(rows):
            for xx, c in enumerate(row):
                if c != '.': self.p(x+xx, y+yy, c)

    def blit(self, c, x, y, scale=1):
        for yy, row in enumerate(c.data):
            for xx, color in enumerate(row):
                if color[3]: self.rect(x+xx*scale, y+yy*scale, scale, scale, color)


def leg(c, root, knee, foot, near=True):
    c.line(*root, *knee, 'o'); c.line(*knee, *foot, 'o')
    c.p(knee[0], knee[1], 'f' if near else 'd')
    c.p(foot[0], foot[1], 'm' if near else 'd')
    c.p(foot[0]+1, foot[1], 'o')


def dog_side(direction, phase, attack, alpha):
    c = Canvas()
    stride = [0, -1, 1][phase % 3] if not attack else [0, -1, 1, 0][phase]
    thrust = 1 if attack and phase == 2 else 0
    tense = 1 if attack and phase == 1 else 0
    lift = 1 if attack and phase in [1, 3] else 0
    # The two profiles are authored coordinate arrangements, with fixed upper-left light.
    if direction == 'left':
        c.poly([(11, 7), (13, 6-stride), (14, 4-stride), (14, 8), (12, 10)], 'd')
        leg(c, (6, 9), (6-stride, 12), (5-stride, 13), False)
        leg(c, (11, 9), (12+stride, 11), (11+stride, 13), False)
        c.poly([(4, 7+lift), (7, 6-lift-alpha), (11, 6-alpha), (13, 8), (12, 11), (6, 11), (4, 9)], 'f')
        c.line(6, 7-lift, 10, 7-alpha, 'm'); c.p(11, 8, 'l')
        c.line(7, 10, 10, 10, 'd'); c.p(12, 9, 'd')
        leg(c, (6, 10), (5+stride, 12-tense), (4+stride+thrust, 14-tense))
        leg(c, (11, 10), (10-stride, 12), (10-stride, 14))
        hx, hy = 3-thrust, 4+lift
        c.poly([(hx+1, hy), (hx+3, hy+1), (hx+4+alpha, hy+3), (hx+3, hy+6), (hx, hy+5), (hx-1, hy+3), (hx+1, hy+2)], 'm')
        c.poly([(hx+1, hy), (hx+1, hy-1-alpha), (hx+3, hy+1)], 'd')
        c.p(hx+2, hy+2, 'l'); c.p(hx, hy+3, 'o'); c.p(hx+1, hy+3, 'a')
        c.p(hx-1, hy+4, 'o'); c.p(hx, hy+5, 'd')
        if attack:
            c.line(hx-1, hy+5, hx+2, hy+5, 'o')
            if phase == 2: c.p(hx, hy+5, 'e'); c.p(hx+1, hy+6, 'q')
            if phase == 1: c.p(hx+2, hy+4, 'e')
            if phase == 3: c.p(hx+3, hy+5, 'd')
        if alpha:
            c.poly([(6, 5), (8, 4), (9, 5), (8, 9), (6, 10)], 'd')
            c.p(7, 5, 'm'); c.line(5, 8+lift, 6, 9+lift, 'q'); c.p(6, 8+lift, 'p')
    else:
        c.poly([(4, 7), (2, 6+stride), (1, 4+stride), (1, 8), (3, 10)], 'd')
        leg(c, (9, 9), (9+stride, 12), (9+stride, 13), False)
        leg(c, (4, 9), (3-stride, 11), (3-stride, 13), False)
        c.poly([(11, 7+lift), (8, 6-lift-alpha), (4, 6-alpha), (2, 8), (3, 11), (9, 11), (11, 9)], 'f')
        c.line(4, 7-alpha, 8, 7-lift, 'm'); c.p(4, 8, 'l')
        c.line(5, 10, 8, 10, 'd'); c.p(3, 9, 'd')
        leg(c, (9, 10), (10-stride, 12-tense), (10-stride-thrust, 14-tense))
        leg(c, (4, 10), (5+stride, 12), (5+stride, 14))
        hx, hy = 9+thrust, 4+lift
        c.poly([(hx+2, hy), (hx, hy+1), (hx-1-alpha, hy+3), (hx, hy+6), (hx+3, hy+5), (hx+4, hy+3), (hx+2, hy+2)], 'f')
        c.poly([(hx+2, hy), (hx+2, hy-1-alpha), (hx, hy+1)], 'd')
        c.p(hx, hy+2, 'l'); c.p(hx+2, hy+3, 'a'); c.p(hx+3, hy+3, 'o')
        c.p(hx+4, hy+4, 'o'); c.p(hx+3, hy+5, 'd')
        if attack:
            c.line(hx+1, hy+5, hx+4, hy+5, 'o')
            if phase == 2: c.p(hx+3, hy+5, 'e'); c.p(hx+2, hy+6, 'q')
            if phase == 1: c.p(hx+1, hy+4, 'e')
            if phase == 3: c.p(hx, hy+5, 'd')
        if alpha:
            c.poly([(9, 5), (7, 4), (6, 5), (7, 9), (9, 10)], 'd')
            c.p(7, 5, 'm'); c.line(10, 8+lift, 9, 9+lift, 'q'); c.p(9, 8+lift, 'p')
    return c


def dog_axial(direction, phase, attack, alpha):
    c = Canvas()
    gait = [0, -1, 1][phase % 3] if not attack else [0, -1, 1, 0][phase]
    off = 1 if attack and phase == 1 else -1 if attack and phase == 2 else 0
    wide = alpha
    if direction == 'down':
        c.line(8, 5, 10+gait, 3, 'o'); c.p(9, 4, 'f')
        leg(c, (6, 8), (5, 11), (5, 13-gait), False)
        leg(c, (10, 8), (11, 11), (11, 13+gait), False)
        c.poly([(6-wide, 6), (9+wide, 6), (11, 9), (10, 12), (6, 12), (4, 9)], 'f')
        c.line(7, 7, 9, 7, 'm'); c.p(6, 9, 'l'); c.line(7, 11, 9, 11, 'd')
        leg(c, (6, 10), (6-gait, 12), (6-gait, 14-max(0,gait)))
        leg(c, (10, 10), (10+gait, 12), (10+gait, 14-max(0,-gait)))
        y = 4+off
        c.poly([(5-wide, y), (6, y-1-alpha), (7, y+1), (9, y+1), (10, y-1-alpha), (11+wide, y), (11, y+4), (9, y+6), (7, y+6), (5, y+4)], 'm')
        c.line(6, y, 7, y+1, 'd'); c.line(9, y+1, 10, y, 'd')
        c.p(6, y+2, 'o'); c.p(10, y+2, 'o'); c.p(7, y+2, 'a'); c.p(9, y+2, 'a')
        c.stamp(7, y+3, ['lll', 'kok', '.d.'])
        if attack:
            c.line(7, y+5, 9, y+5, 'o')
            if phase == 2: c.stamp(7, y+5, ['eoe', '.q.'])
            if phase == 1: c.p(6, y+3, 'd')
            if phase == 3: c.p(10, y+4, 'd')
        if alpha:
            c.line(4, 7, 5, 10, 'd'); c.line(12, 7, 11, 10, 'd')
            c.line(10, y+3, 11, y+4, 'p')
    else:
        leg(c, (6, 8), (5, 9), (4-gait, 11), False)
        leg(c, (10, 8), (11, 9), (11+gait, 11), False)
        y = 3+off+alpha
        c.poly([(5-wide, y+1), (6, y-1-alpha), (7, y+1), (9, y+1), (10, y-1-alpha), (11+wide, y+1), (10, y+5), (6, y+5)], 'd')
        c.line(6, y+1, 9, y+2, 'm'); c.p(6, y, 'f')
        c.poly([(6-wide, 7), (10+wide, 7), (11, 11), (9, 13), (7, 13), (5, 11)], 'f')
        c.line(6, 8, 6, 11, 'm'); c.line(8, 8, 9, 10, 'd')
        leg(c, (6, 10), (6-gait, 12), (6-gait, 14-max(0,gait)))
        leg(c, (10, 10), (10+gait, 12), (10+gait, 14-max(0,-gait)))
        c.line(8, 11, 8+gait, 14, 'o'); c.p(8, 12, 'm'); c.p(8+gait, 13, 'd')
        if alpha: c.stamp(6, 6, ['fmdmf', '.ddd.']); c.p(10, y+3, 'p')
        if attack:
            if phase == 0:
                c.p(4,11,'.');c.p(4,10,'m');c.p(10,5,'l')
            if phase == 1: c.line(5, 5, 5, 7, 'f')
            if phase == 2: c.p(11, 5, 'e'); c.p(10, 6, 'q')
            if phase == 3: c.p(6, 7, 'l')
    return c


def rat(direction, phase, attack):
    c = Canvas()
    gait = [0, -1, 1][phase % 3] if not attack else [0, -1, 1, 0][phase]
    nibble = 1 if attack and phase == 2 else 0
    y = 8 + (1 if attack and phase == 1 else 0)
    if direction == 'left':
        c.line(11, 12, 14, 11+gait, 'q'); c.line(14, 11+gait, 14, 8+gait, 'p')
        c.poly([(5, 10), (8, 8), (11, 9), (12, 12), (10, 13), (5, 13)], 's')
        c.line(7, 9, 9, 9, 'v'); c.p(10, 10, 'w'); c.p(11, 12, 'd')
        c.p(6+gait, 14, 'p'); c.p(10-gait, 14, 'p')
        c.stamp(3-nibble, y, ['.oo...', 'ovpo..', 'ossvo.', 'oqoeo.', '.oo...'])
        c.p(4-nibble, y+1, 'p'); c.p(3-nibble, y+3, 'p'); c.p(5-nibble, y+2, 'o')
        c.line(2-nibble, y+2, 2-nibble, y+3, 'v')
        if attack: c.p(4-nibble, y+4, 'e' if phase in [1, 2] else 'v'); c.p(6, 12, 'v' if phase == 3 else 's')
    elif direction == 'right':
        c.line(4, 12, 1, 11-gait, 'q'); c.line(1, 11-gait, 1, 8-gait, 'p')
        c.poly([(10, 10), (7, 8), (4, 9), (3, 12), (5, 13), (10, 13)], 's')
        c.line(5, 9, 7, 9, 'w'); c.p(4, 10, 'v'); c.p(4, 12, 'd')
        c.p(9-gait, 14, 'p'); c.p(5+gait, 14, 'p')
        c.stamp(8+nibble, y, ['...oo.', '..opvo', '.ovsss', '.oeoqo', '...oo.'])
        c.p(11+nibble, y+1, 'p'); c.p(12+nibble, y+3, 'p'); c.p(10+nibble, y+2, 'o')
        c.line(13+nibble, y+2, 13+nibble, y+3, 'v')
        if attack: c.p(11+nibble, y+4, 'e' if phase in [1, 2] else 'v'); c.p(9, 12, 'v' if phase == 3 else 's')
    elif direction == 'down':
        c.line(8, 8, 9+gait, 6, 'q'); c.line(9+gait, 6, 11+gait, 5, 'p')
        c.poly([(6, 8), (9, 8), (11, 11), (10, 13), (5, 13), (4, 11)], 's')
        c.p(6, 9, 'w'); c.p(5, 14-max(0,gait), 'p'); c.p(10, 14-max(0,-gait), 'p')
        c.stamp(5, y, ['opooop', 'opvvpo', '.oooo.', '.ovvo.', '..qp..'])
        c.p(6, y+2, 'e'); c.p(9, y+2, 'e'); c.p(7, y+4+nibble, 'p')
        if attack: c.p(8, y+4, 'e' if phase in [1, 2] else 'v'); c.p(5, 12, 'v' if phase == 3 else 's')
    else:
        c.stamp(5, y-2, ['opooop', 'opsvpo', '.ovvo.', '..oo..'])
        c.poly([(6, 9), (9, 9), (11, 11), (10, 13), (5, 13), (4, 11)], 's')
        c.p(6, 10, 'w'); c.p(5-gait, 13, 'p'); c.p(10+gait, 13, 'p')
        c.line(8, 12, 8+gait, 14, 'q'); c.p(8+gait, 14, 'p')
        if attack:
            c.p(9 if phase == 0 else 6, 9, 'w')
            if phase == 2: c.p(10, 8, 'e')
            if phase == 3: c.p(10, 10, 'v')
    return c


def leech(direction, phase, attack):
    c = Canvas()
    # Flattened segmented skin, no eye/limb, red glow, shell, or fish silhouette.
    reach = [0, -1, 1][phase % 3] if not attack else [0, -1, 2, 1][phase]
    hump = 1 if phase == 1 else 0
    if direction in ['left', 'right']:
        if direction == 'left':
            pts = [(5-reach, 11), (7, 9-hump), (10, 10-hump), (12, 12), (10, 14), (7, 13), (5-reach, 13)]
            front = (5-reach, 12)
            c.poly(pts, 'u'); c.line(7, 10-hump, 9, 10-hump, 'g')
            for x,y in [(7,11-hump),(9,12),(11,12)]: c.line(x, y, x-1, y+1, 'd')
        else:
            pts = [(10+reach, 11), (8, 9-hump), (5, 10-hump), (3, 12), (5, 14), (8, 13), (10+reach, 13)]
            front = (10+reach, 12)
            c.poly(pts, 'u'); c.line(5, 10-hump, 7, 10-hump, 'g')
            for x,y in [(5,12),(7,11-hump),(9,12)]: c.line(x, y, x-1, y+1, 'd')
        c.p(*front, 'n'); c.p(8, 12-hump, 'u')
        if attack:
            c.p(front[0], front[1]-1, 'r'); c.p(front[0], front[1]+1, 'n')
            c.p(front[0]+(-1 if direction=='left' else 1), front[1], 'o')
            if phase == 3: c.p(8, 13, 'v')
    elif direction == 'down':
        c.poly([(7, 8), (9, 9), (10, 11), (9, 12+reach), (7, 12+reach), (6, 10)], 'u')
        c.line(7, 9, 7, 11, 'u'); c.p(8, 10, 'g')
        for yy in [10,12]: c.line(7,yy,9,yy,'d')
        c.p(8, 12+reach, 'n')
        if attack: c.p(7, 12+reach, 'r'); c.p(9, 12+reach, 'n'); c.p(8, 11+reach, 'o')
    else:
        c.poly([(7, 13), (9, 12), (10, 10), (9, 8-reach), (7, 8-reach), (6, 11)], 'u')
        c.line(7, 9-reach, 7, 11, 'u'); c.p(8, 10, 'g')
        for yy in [10,12]: c.line(7,yy,9,yy,'d')
        c.p(8, 8-reach, 'n')
        if attack: c.p(7, 8-reach, 'r'); c.p(9, 8-reach, 'n'); c.p(8, 9-reach, 'o')
    return c


def sleeve(c, shoulder, elbow, hand, cloth):
    for a,b in [(shoulder,elbow),(elbow,hand)]:
        for dx,dy in [(-1,0),(1,0),(0,-1),(0,1)]:
            c.line(a[0]+dx,a[1]+dy,b[0]+dx,b[1]+dy,'o')
        c.line(*a,*b,cloth)
    c.p(elbow[0]-1,elbow[1],'R' if cloth=='A' else 'm')
    c.p(hand[0],hand[1],'F'); c.p(hand[0],hand[1]+1,'S')


def human_legs(c, direction, gait, chief):
    if direction in ['down','up']:
        for x,shift,side in [(9,-gait,'l'),(14,gait,'r')]:
            c.poly([(x-1,22),(x+1,22),(x+1+shift,27),(x+shift,29),(x-2+shift,29)],'b' if chief else 'D')
            c.line(x-1,24,x-1+shift,28,'n' if chief else 'A')
            yy=30-max(0,shift)
            c.rect(x-2+shift,yy,4,1,'o');c.rect(x-2+shift,yy-1,3,1,'B')
    elif direction=='left':
        c.poly([(11,22),(14,23),(14+gait,27),(13+gait,29),(11+gait,29)],'b')
        c.rect(10+gait,29-max(0,gait),4,1,'B')
        c.poly([(8,22),(11,22),(10-gait,27),(10-gait,30),(7-gait,30),(8-gait,27)],'C' if chief else 'D')
        c.line(8,24,8-gait,28,'J' if chief else 'A');c.rect(6-gait,30-max(0,-gait),4,1,'o')
    else:
        c.poly([(9,22),(12,23),(12-gait,27),(11-gait,29),(9-gait,29)],'b')
        c.rect(10-gait,29-max(0,-gait),4,1,'B')
        c.poly([(12,22),(15,22),(16+gait,27),(16+gait,30),(13+gait,30),(14+gait,27)],'C' if chief else 'D')
        c.line(13,24,15+gait,28,'J' if chief else 'A');c.rect(14+gait,30-max(0,gait),4,1,'o')


def role_face(c, direction, chief):
    # Living adult faces, ear/nose planes and cloth hood. No skull or monster anatomy.
    if direction=='down':
        if chief:
            c.stamp(8,3,['.oooooo.','oHHHHHHo','oHSSFSSo','.SFFFFS.','.SFoFoS.','..FFFF..','..SooS..','...SS...'])
            c.p(13,7,'S');c.p(13,8,'L')
        else:
            c.stamp(8,3,['..oooo..','.oAARDo.','oARRAodo','oAFSFFDo','.oFoFo.','..FFFF..','..oSSo..','...oo...'])
            c.line(9,4,9,6,'R');c.p(14,9,'D')
    elif direction=='up':
        if chief:
            c.stamp(8,3,['.oooooo.','oHHHHHHo','oHnHHHHo','.HHHHHH.','.SHHHHS.','..HHHH..','..oSSo..','...SS...'])
            c.p(8,7,'S');c.p(15,7,'S')
        else:
            c.stamp(8,3,['..oooo..','.oAARDo.','oARRADDo','oARRADDo','.oAADDo.','..oADo..','..oDDo..','...oo...'])
            c.line(9,4,11,5,'R')
    elif direction=='left':
        if chief:
            c.stamp(7,3,['..oooo..','.oHHHHo.','.SFFHHo.','oFFFFHo.','oFoFSHo.','.SFFSHo.','..FSoo..','..SS....'])
            c.p(8,7,'S');c.p(10,8,'L')
        else:
            c.stamp(7,3,['...ooo..','..oARDo.','.oARRDo.','.oFARDo.','oFFFoDo.','.oFoDo..','..FFo...','...So...'])
            c.line(10,4,9,5,'R')
    else:
        if chief:
            c.stamp(9,3,['..oooo..','.oHHHHo.','.oHHFFS.','.oHFFFFo','.oHSFoFo','.oHSFFS.','..ooSF..','....SS..'])
            c.p(13,7,'S');c.p(12,8,'L')
        else:
            c.stamp(9,3,['..ooo...','.oRADo..','.oRARD..','.oDARFo.','.oDoFFFo','..oDoFo.','...oFF..','...oS...'])
            c.line(11,4,13,5,'R')


def human_role(kind,direction,phase,attack):
    chief=kind=='complete_reaver_chief'
    c=Canvas(24,32)
    gait=[0,-1,1][phase%3] if not attack else [0,-1,1,0][phase]
    cloth='C' if chief else 'A'
    human_legs(c,direction,gait,chief)
    if direction in ['down','up']:
        # The chief has wider dropped shoulders and two independently torn coat tails.
        if chief:
            c.poly([(7,10),(16,10),(19,13),(18,22),(19,26),(14,25),(12,22),(10,26),(5,25),(6,20),(4,14)],'C')
            c.line(7,12,6,23,'m');c.line(16,14,17,23,'d')
            c.line(11,12,11,21,'J');c.line(12,22,12,24,'o')
            c.poly([(5,11),(9,11),(10,14),(7,16),(4,14)],'J')
            c.line(5,12,8,12,'L');c.p(6,14,'L');c.p(8,15,'b')
            c.poly([(14,11),(17,11),(19,14),(16,15),(14,13)],'d')
            c.p(15,12,'v');c.p(16,14,'s')
        else:
            # Slender shoulder, diagonal strap and narrow quiver case; no held weapon.
            qx=15 if direction=='down' else 7
            c.poly([(qx,7),(qx+3,7),(qx+4,19),(qx+1,20),(qx,14)],'b')
            c.line(qx+1,8,qx+2,17,'n');c.line(qx+1,5,qx+1,8,'L');c.p(qx,5,'w');c.p(qx+2,4,'L')
            c.poly([(9,10),(14,10),(16,13),(15,22),(17,25),(12,24),(7,25),(8,21),(7,13)],'A')
            c.line(8,13,8,21,'R');c.line(14,15,14,22,'D');c.line(9,24,11,23,'R')
            if direction=='down':c.line(15,11,9,21,'B');c.line(14,11,8,21,'J')
            else:c.line(8,11,14,21,'J');c.line(9,11,15,21,'B')
            c.p(11,17,'L')
        c.line(7 if chief else 8,21,17 if chief else 15,21,'B')
        c.p(12,21,'L')
        hands=[((6,22),(18,22)),((5,21),(18,23)),((6,23),(19,21))]
        if attack:
            hands=[((7,18),(17,19)),((5,14),(19,18)),((4,23),(19,24)),((6,20),(18,21))]
        left,right=hands[phase]
        if direction=='up' and attack:
            left,right=[((7,18),(17,17)),((5,12),(19,9)),((6,9),(20,4)),((7,15),(18,14))][phase]
        sleeve(c,(6 if chief else 8,13),(5 if chief else 7,17),left,cloth)
        sleeve(c,(18 if chief else 15,13),(19 if chief else 17,17),right,cloth)
        if direction=='up':
            # Back seam and patched neck; arms remain independently authored.
            c.line(12,12,12,19,'D' if not chief else 'b')
            if chief:c.line(8,17,10,19,'J');c.p(9,18,'L')
    elif direction=='left':
        if not chief:
            c.poly([(14,8),(17,8),(18,19),(15,20)],'b');c.line(15,9,16,17,'n')
            c.line(15,5,15,9,'L');c.p(14,5,'w');c.p(17,6,'w')
        c.poly([(9,10),(14,10),(16 if chief else 15,14),(15,22),(17 if chief else 16,25),(12,24),(8,26 if chief else 24),(7,22),(7,14)],cloth)
        c.line(8,13,8,23,'m' if chief else 'R');c.line(13,16,14,22,'d' if chief else 'D')
        c.line(8,21,14,21,'B')
        if chief:
            c.poly([(8,11),(12,11),(13,15),(9,16),(7,14)],'J');c.line(8,12,11,12,'L');c.p(10,14,'L')
            c.line(12,22,13,24,'o');c.p(15,24,'b')
        else:
            c.line(13,11,9,21,'J');c.p(11,16,'L')
        near=[(8,22),(7,21),(9,23)][phase%3]
        if attack:near=[(7,18),(8,12),(2,17),(6,20)][phase]
        sleeve(c,(9,13),(8,17 if not attack else 15),near,cloth)
        far=[(13,21),(14,22),(13,22)][phase%3]
        if attack:far=[(12,18),(13,15),(7,19),(12,20)][phase]
        sleeve(c,(14,13),(14,17),far,'D' if not chief else 'd')
    else:
        if not chief:
            c.poly([(6,8),(9,8),(8,20),(5,19)],'b');c.line(7,9,6,17,'n')
            c.line(8,5,8,9,'L');c.p(7,5,'w');c.p(5,6,'w')
        c.poly([(10,10),(15,10),(17,14),(17,22),(16,26 if chief else 24),(12,24),(7 if chief else 8,25),(9,22),(8 if chief else 9,14)],cloth)
        c.line(10,13,9,23,'m' if chief else 'R');c.line(16,16,16,22,'d' if chief else 'D')
        c.line(9,21,16,21,'B')
        if chief:
            c.poly([(12,11),(16,11),(18,14),(15,16),(11,15)],'J');c.line(13,12,16,12,'L');c.p(14,14,'L')
            c.line(12,22,11,24,'o');c.p(8,24,'b')
        else:
            c.line(10,11,15,21,'J');c.p(13,16,'L')
        far=[(11,21),(10,22),(11,22)][phase%3]
        if attack:far=[(12,18),(11,15),(17,19),(12,20)][phase]
        sleeve(c,(10,13),(10,17),far,'D' if not chief else 'd')
        near=[(15,22),(16,21),(14,23)][phase%3]
        if attack:near=[(16,18),(15,12),(21,17),(17,20)][phase]
        sleeve(c,(15,13),(16,17 if not attack else 15),near,cloth)
    role_face(c,direction,chief)
    return c


def pose(kind, direction, phase, attack):
    if kind.startswith('complete_reaver_'):return human_role(kind,direction,phase,attack)
    if kind in ['ash_hound', 'ash_hound_alpha']:
        return (dog_side if direction in ['left','right'] else dog_axial)(direction, phase, attack, int(kind.endswith('_alpha')))
    if kind == 'burrow_rat': return rat(direction, phase, attack)
    return leech(direction, phase, attack)


def png(c):
    raw = b''.join(b'\0'+bytes(v for pixel in row for v in pixel) for row in c.data)
    def chunk(kind, data): return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',c.w,c.h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')


def serial(obj): return (json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode()


def write(path, data, check):
    if check: assert path.read_bytes()==data, f'regeneration differs: {path}'
    else: path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(data)


def new_art(check):
    fragment = {'sheets':{},'frames':{},'chars':{},'anims':{}}
    products = {}
    records = {}
    for kind in KINDS:
        w,h=(24,32) if kind.startswith('complete_reaver_') else (16,16)
        keybase=kind if kind.startswith('complete_') else 'complete_'+kind
        char = {'walk':{},'idle':{},'attack':{},'anchor':[.5,(h-1)/h], 'attackAnchor':[.5,(h-1)/h], 'renderScale':1, 'headOffset':28 if h==32 else 14 if 'hound' in kind else 10 if kind=='burrow_rat' else 9}
        if h==16:
            char['shadow']=[7,2] if kind.endswith('_alpha') else [6,2] if 'hound' in kind else [4,1] if kind=='burrow_rat' else [2,0.6]
            char['healthBarWidth']=16 if kind.endswith('_alpha') else 14 if 'hound' in kind else 10 if kind=='burrow_rat' else 8
        all_poses = []
        contact = Canvas(w*4*8, h*4*4, (37,42,43,255))
        for mode,count in [('walk',3),('attack',4)]:
            sheet = Canvas(count*w,4*h)
            sheetkey = f'{keybase}_{mode}'
            fragment['sheets'][sheetkey] = f'sprites/original/complete/creatures/{kind}-{mode}.png'
            for di,direction in enumerate(DIRS):
                char[mode][direction] = []
                for phase in range(count):
                    c = pose(kind,direction,phase,mode=='attack')
                    key = f'{keybase}_{mode}_{direction}{phase}'
                    char[mode][direction].append(key)
                    fragment['frames'][key] = [sheetkey,phase*w,di*h,w,h]
                    sheet.blit(c,phase*w,di*h)
                    contact.blit(c,(phase+(1 if mode=='walk' else 4))*w*4,di*h*4,4)
                    all_poses.append((key,c))
                if mode=='walk':
                    char['idle'][direction] = [char['walk'][direction][0]]
                    contact.blit(pose(kind,direction,0,False),0,di*h*4,4)
            products[f'{kind}-{mode}.png'] = png(sheet)
        # Original sprite key also gets an explicit static frame for preload/icons.
        # It is a new drawing's authored idle, never an external tiles/*.png fallback.
        fragment['frames'][kind] = fragment['frames'][char['idle']['down'][0]]
        fragment['chars'][kind] = char
        products[f'{kind}-contact.png'] = png(contact)
        static = pose(kind,'down',0,False)
        products[f'{kind}-static.png'] = png(static)
        rec=[]
        for key,c in all_poses:
            pts=[(x,y) for y,row in enumerate(c.data) for x,p in enumerate(row) if p[3]]
            rec.append({'frame':key,'opaquePixels':len(pts),'boundsInclusive':[min(x for x,y in pts),min(y for x,y in pts),max(x for x,y in pts),max(y for x,y in pts)],'pixelsSHA256':hashlib.sha256(bytes(v for row in c.data for p in row for v in p)).hexdigest()})
        records[kind]=rec
    source={'license':'CC0-1.0','authoring':'New original integer-coordinate 16x16 animal and 24x32 adult role pixel geometry; hard-edged RGBA, no image input, extraction, tracing, recoloring, resampling, or imported silhouette. Existing own-original contacts are a separate review-only operation.','externalImageInputs':[],'newImageInputs':[],'reusedExistingPixelGeometry':False,'palette':{k:list(v) for k,v in P.items()},'source':'tools/art/draw-complete-creatures.py','sourceSHA256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'directions':DIRS,'contactColumns':['idle','walk0','walk1','walk2','attack0','attack1','attack2','attack3'],'contactRows':DIRS,'newKinds':KINDS,'newPoseCount':168,'staticFramesAreIdleReferences':True,'gameplayRulesChanged':False,'rendererIntegrationAppliedByGenerator':False,'records':records,'files':[{'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in products.items()]}
    for name,data in products.items(): write(OUT/name,data,check)
    write(ROOT/'tools/art/complete-creatures.fragment.json',serial(fragment),check)
    write(OUT/'source.json',serial(source),check)
    return fragment,records


def review_existing(check):
    # This operation cannot feed pose() or new_art(). Only own original PNGs are read.
    from PIL import Image, ImageDraw
    m=json.loads((ROOT/'tools/art/complete-catalog-v302-before.json').read_text())['registry']
    chars=list(m['chars']); report={}
    for group in range(5):
        cv=Image.new('RGB',(760,1440),'#252a2b'); p=ImageDraw.Draw(cv)
        for ci,k in enumerate(chars[group*4:group*4+4]):
            ch=m['chars'][k];sy=ci*360;p.text((8,sy+4),k,fill='#e4dbbf')
            for ri,direction in enumerate(DIRS):
                seq=[('idle',n) for n in ch['idle'][direction]]+[('walk',n) for n in ch['walk'][direction]]+[('attack',n) for n in ch.get('attack',{}).get(direction,[])]
                p.text((5,sy+48+ri*76),direction,fill='#a9b4b3')
                for col,(mode,n) in enumerate(seq):
                    sk,x,y,w,h=m['frames'][n];path=m['sheets'][sk];assert path.startswith('sprites/original/')
                    im=Image.open(ROOT/'public'/path).convert('RGBA').crop((x,y,x+w,y+h));scale=2 if max(w,h)<=40 else 1
                    im=im.resize((w*scale,h*scale),Image.Resampling.NEAREST)
                    xx=54+col*88;yy=sy+24+ri*76
                    cv.paste(im,(xx+(84-im.width)//2,yy+66-im.height),im)
                    p.text((xx,yy+66),mode[0]+n[-1],fill='#c4c2b3')
            report[k]={'sourcePaths':sorted(set(m['sheets'][m['frames'][n][0]] for mode in ['idle','walk','attack'] for ns in ch.get(mode,{}).values() for n in ns)),'contact':f'sprites/original/complete/creatures/review/existing-contact-{group+1}.png','modes':{mode:{d:len(ns) for d,ns in ch.get(mode,{}).items()} for mode in ['idle','walk','attack']}}
        import io
        data=io.BytesIO();cv.save(data,format='PNG')
        write(OUT/f'review/existing-contact-{group+1}.png',data.getvalue(),check)
    write(OUT/'review/existing-contract.json',serial(report),check)
    return report


def mapping(fragment,check):
    path=ROOT/'tools/art/complete-catalog-v302-before.json'
    baseline=json.loads(path.read_text()); old=baseline['registry']
    targets={'Creature.ReaverChief':'complete_reaver_chief','Creature.ReaverArcher':'complete_reaver_archer'}
    patches=[];rows=[]
    def as_list(v):return v if isinstance(v,list) else [v] if v else []
    sheets={**old['sheets'],**fragment['sheets']}
    frames={**old['frames'],**fragment['frames']}
    chars={**old['chars'],**fragment['chars']}
    for c in baseline['definitions']['creatures']:
        aliases=dict(c.get('characterAliases',{}))
        saved=as_list(c.get('char')) or as_list(c.get('sprite')) or [c['id']]
        if c['id'] in targets:
            for key in as_list(c.get('char')):aliases[key]=targets[c['id']]
            patches.append({'op':'replace' if 'characterAliases' in c else 'add','target':c['id'],'path':'/characterAliases','value':aliases})
        selected=list(dict.fromkeys(aliases.get(k,k) for k in saved))
        if c['id']=='Creature.Drifter':selected=['original_wanderer_hero']
        dormant=as_list(c.get('dormantChar'))
        bindings=[]
        for key in selected+dormant:
            ch=chars.get(key)
            assert ch, f'unsupported proposed creature char {key}'
            fs=list(dict.fromkeys(n for mode in ['idle','walk','attack'] for ns in ch.get(mode,{}).values() for n in ns))
            bindings.append({'key':key,'sourcePaths':sorted(set(sheets[frames[n][0]] for n in fs)),'uniqueFrames':len(fs),'poseCounts':{mode:{d:len(ns) for d,ns in ch.get(mode,{}).items()} for mode in ['idle','walk','attack']},'newArt':key in fragment['chars'],'dormant':key in dormant})
        note=[]
        if not c.get('char'):note.append('Baseline has no char and no registered creature frame. New same-key character supplies the renderer path without changing creature selection or save values.')
        if c['id'] in targets:note.append('New role character requires the proposed display-only characterAliases patch. Saved char selection is unchanged.')
        if c['id'].startswith('Creature.ShadeGrove'):note.append('Existing own-original shade0/1/2/3 body variants remain shared across grove roles. No unique role costume is promised; no cross-species icon reuse.')
        if c['id']=='Creature.RetiredWanderer':note.append('Explicit hero->hero alias preserves the existing original retired appearance; the active-player override does not apply.')
        if c['id']=='Creature.TenderDrone':note.append('Existing inert four-direction sheet intentionally has no attack cycle.')
        if c['id']=='Creature.MurkLeech':note.append('GROUND preloads murk_leech. Same-key registered static frame prevents the legacy tiles/murk_leech.png request. Attack poses depict attachment reach, not a new naturalAttack rule.')
        if c['id']=='Creature.Drifter':note.append('The active-player hero override is renderer-only. A non-player stored hero still uses the existing original hero char.')
        rows.append({'id':c['id'],'label':c['label'],'body':c['body'],'baselineChar':c.get('char'),'baselineSprite':c.get('sprite'),'baselineAliases':c.get('characterAliases',{}),'baselineDormant':c.get('dormantChar'),'currentSaveSelectionKeys':saved,'proposedDisplayKeys':selected,'proposedAliases':aliases,'bindings':bindings,'unsupportedAfterFragmentAndProposedPatches':[],'notes':note})
    data={'scope':'33 resolved nonabstract Creature definitions from the pre-v302 catalog; original 20 chars retained. Four missing animal keys and two role-specific chars authored separately. No Core/Def/renderer/shared manifest edited by this generator.','baseline':{'path':'tools/art/complete-catalog-v302-before.json','sha256':hashlib.sha256(path.read_bytes()).hexdigest()},'counts':{'resolvedCreatures':len(rows),'existingCharsReviewed':len(old['chars']),'existingUniqueFramesReviewed':len(set(n for ch in old['chars'].values() for mode in ['idle','walk','attack'] for ns in ch.get(mode,{}).values() for n in ns)),'newAnimalChars':4,'newRoleChars':2,'newUniquePoses':168,'newRegisteredFramesIncludingStaticAliases':len(fragment['frames'])},'integration':{'fragment':'tools/art/complete-creatures.fragment.json','patchProposal':'tools/art/complete-creatures.patches.json','appliedByGenerator':False,'runtime':'loadAtlas loads every registered sheet; MapRenderer.makeView selects chars[creatureSprite(w,c)] before animation/static/icon fallbacks. Same-key frames are also supplied for preload/static consumers.','preloadedGround':['murk_leech'],'newGameSelection':'createCreature picks char when present, otherwise sprite; its logic is unchanged.','prototypeOrSpawnPolicy':'No spawn, placement, AI, body, equipment, combat, or save rule changed. Kept excluded species are still drawn.','marineCreatureDefs':'No separate marine animal Creature exists in the 33-definition baseline. Coastal residents are humans with the existing worker/trader/healer/guard appearance aliases.','otherLegacyAnimalConsumers':'Repository source and resolved catalog searches found only the four authored animal sprite keys. No unrelated animal icon is used to stand in for these creatures.','legacyHumanSpriteFields':'player and reaver2 remain in inherited sprite fields but are not selected for new creatures when char is present. Existing raw hero/reaver0/reaver1 are the preserved save selections covered here; unknown historical save values are not asserted.'},'creatures':rows}
    write(ROOT/'tools/art/complete-creatures-mapping.json',serial(data),check)
    write(ROOT/'tools/art/complete-creatures.patches.json',serial(patches),check)
    return data


def validate(fragment,records,check):
    """Independent emitted-PNG/chunk/CRC/frame/pose contract, no engine imports."""
    def decode(path):
        data=path.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n'
        at=8;raw=b'';chunks=[]
        while at<len(data):
            n=struct.unpack('>I',data[at:at+4])[0];kind=data[at+4:at+8];body=data[at+8:at+8+n]
            assert at+12+n<=len(data) and zlib.crc32(kind+body)&0xffffffff==struct.unpack('>I',data[at+8+n:at+12+n])[0]
            chunks.append(kind.decode());at+=12+n
            if kind==b'IHDR':
                w,h,depth,color,comp,filt,inter=struct.unpack('>IIBBBBB',body)
                assert (depth,color,comp,filt,inter)==(8,6,0,0,0)
            if kind==b'IDAT':raw+=body
            if kind==b'IEND':assert n==0 and at==len(data)
        assert chunks[0]=='IHDR' and chunks[-1]=='IEND' and chunks.count('IEND')==1
        raw=zlib.decompress(raw);assert len(raw)==h*(1+w*4)
        rows=[]
        for y in range(h):
            start=y*(1+w*4);assert raw[start]==0
            row=[tuple(raw[start+1+x*4:start+1+(x+1)*4]) for x in range(w)]
            assert all(p[3] in [0,255] for p in row)
            rows.append(row)
        return {'w':w,'h':h,'rows':rows,'sha256':hashlib.sha256(data).hexdigest()}
    pngs={name:decode(OUT/name) for name in [f'{k}-{suffix}.png' for k in KINDS for suffix in ['walk','attack','contact','static']]}
    for row in pngs.values():assert all(p in P.values() or p==(37,42,43,255) for a in row['rows'] for p in a)
    merged_sheets={key:pngs[Path(path).name] for key,path in fragment['sheets'].items()}
    crops={}
    for key,(sheet,x,y,w,h) in fragment['frames'].items():
        im=merged_sheets[sheet];assert x>=0 and y>=0 and w>0 and h>0 and x+w<=im['w'] and y+h<=im['h']
        crops[key]=[row[x:x+w] for row in im['rows'][y:y+h]]
    for key,ch in fragment['chars'].items():
        for mode,count in [('walk',3),('attack',4),('idle',1)]:
            assert set(ch[mode])==set(DIRS)
            for d,ns in ch[mode].items():
                assert len(ns)==count and all(n in crops for n in ns)
                # Genuine articulated poses: no repeated animation frame under new keys.
                assert len(set(bytes(v for row in crops[n] for p in row for v in p) for n in ns))==count
        assert len(set(r['pixelsSHA256'] for r in records[key]))==28
        assert crops[key]==crops[ch['idle']['down'][0]]
        im=pngs[f'{key}-static.png'];assert im['rows']==crops[key]
        assert all(r['boundsInclusive'][0]>=1 and r['boundsInclusive'][1]>=1 and r['boundsInclusive'][2]<im['w']-1 and r['boundsInclusive'][3]<im['h']-1 for r in records[key])
        # Every contact display block must be the exact integer 4x same pose.
        contact=pngs[f'{key}-contact.png']
        assert (contact['w'],contact['h'])==(im['w']*32,im['h']*16)
        for ri,d in enumerate(DIRS):
            sequence=ch['idle'][d]+ch['walk'][d]+ch['attack'][d]
            for col,name in enumerate(sequence):
                for yy in range(im['h']*4):
                    for xx in range(im['w']*4):
                        expected=crops[name][yy//4][xx//4]
                        if expected[3]==0:expected=(37,42,43,255)
                        assert contact['rows'][ri*im['h']*4+yy][col*im['w']*4+xx]==expected
    result={'result':'PASS','scope':'isolated original resource contracts only; no browser, GPU, game, Core, save, World, Full, Type, or pnpm checks','newAnimalChars':4,'newRoleChars':2,'newDistinctPoseFrames':168,'newSheets':12,'registeredFramesIncludingStaticAliases':174,'newPNGs':len(pngs),'PNGCRCAndSingleTerminalIEND':True,'RGBA8AndBinaryAlpha':True,'allRectsInBounds':True,'allPoseOpaqueBoundsHaveOnePixelTransparentMargin':True,'allAnimationReferencesResolve':True,'allFourDirectionsPresent':True,'walk3Attack4DistinctPerDirection':True,'all28PosesDistinctPerChar':True,'sameKeyStaticEqualsAuthoredIdle':True,'contact4xEveryPixelMatches':True,'files':[{'path':name,'size':[im['w'],im['h']],'sha256':im['sha256']} for name,im in pngs.items()]}
    write(OUT/'validation.json',serial(result),check)
    return result


def main():
    ap=argparse.ArgumentParser();ap.add_argument('--check',action='store_true');ap.add_argument('--review-existing',action='store_true')
    args=ap.parse_args()
    f,r=new_art(args.check)
    mapping(f,args.check)
    validate(f,r,args.check)
    if args.review_existing: review_existing(args.check)
    print(json.dumps({'result':'PASS','check':args.check,'newKinds':len(r),'newPoses':sum(map(len,r.values())),'sheets':len(f['sheets']),'frames':len(f['frames']),'chars':len(f['chars']),'existingReviewContacts':5 if args.review_existing else 0}))


if __name__=='__main__': main()
