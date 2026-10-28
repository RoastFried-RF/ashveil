#!/usr/bin/env python3
"""New ASHVEIL v303 UI originals: authored iron rails, paper and fasteners.

Pure integer-coordinate Canvas authoring. No old image is decoded, sampled,
cropped, traced, recolored or transformed. Old bytes are read only for SHA/IHDR
contract evidence; official references are for human observation only. Each new
PNG and editable SVG is emitted directly from the same authored rectangle ops.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import zlib

ROOT = Path(__file__).resolve().parents[3]
HERE = ROOT / 'tools/art/direction-v303'
OUT = ROOT / 'public/sprites/original/direction-v303/ui'
COL = {
    '.': '#00000000', 'black': '#0d0d0f', 'pit': '#111113',
    'ink': '#19191b', 'shade': '#29282a', 'warmInk': '#211e1d',
    'rail': '#363536', 'ironD': '#414143', 'iron': '#697075',
    'ironWear': '#969080', 'soil': '#49413b', 'rust': '#78503c',
    'brassD': '#4f4432', 'brass': '#88714a', 'brassL': '#b29b67',
    'bone': '#ded3b5', 'cloth': '#a69a7b', 'paper': '#d0c2a0',
    'paperFace': '#c7b796', 'paperShade': '#b0a080', 'paperEdge': '#8f7d5e',
    'paperInk': '#292623', 'paperFiber': '#d9cbae', 'leather': '#2d2522',
    'red0': '#4f211f', 'red1': '#7f302c', 'red2': '#a85443',
    'blue0': '#283a4b', 'blue1': '#4d6f88', 'blue2': '#8096a6',
    'green0': '#343c2b', 'green1': '#64704c', 'green2': '#929a6a',
}
SIZE = {
    'frame': (96, 96), 'parchment': (96, 96), 'celtic': (72, 72), 'celtic2': (72, 72),
    'btn': (64, 32), 'btn_olive': (64, 32), 'btn_sel': (64, 32),
    'slot': (32, 32), 'slot_olive': (32, 32), 'slot_sel': (32, 32),
    'tab': (32, 32), 'tab_olive': (32, 32), 'tab_sel': (32, 32),
    'bar_frame': (96, 16), 'bar_frame2': (96, 16), 'bar_frame_gold': (96, 24),
    'bar_blue': (96, 8), 'bar_red': (96, 8), 'bar_green': (96, 8),
    'warn': (32, 32), 'xmark': (32, 32), 'diamond': (32, 32), 'diamond_dim': (32, 32),
    'ornament': (64, 32), 'divider': (96, 16), 'parchment_small': (64, 32),
}
SLICE = {name: (6 if name in ('frame', 'parchment', 'celtic', 'celtic2') else
                3 if name in ('bar_frame', 'bar_frame2') else 4)
         for name in ('frame', 'parchment', 'celtic', 'celtic2', 'btn', 'btn_olive', 'btn_sel',
                      'slot', 'slot_olive', 'slot_sel', 'tab', 'tab_olive', 'tab_sel',
                      'bar_frame', 'bar_frame2', 'bar_frame_gold', 'parchment_small')}


class Canvas:
    def __init__(self, width, height, fill='.', record=True):
        self.width, self.height = width, height
        self.pixels = [['.'] * width for _ in range(height)]
        self.ops, self.writes, self.record = [], 0, record
        if fill != '.':
            self.rect(0, 0, width, height, fill)

    def rect(self, x, y, width, height, color):
        assert all(isinstance(n, int) for n in (x, y, width, height))
        assert color in COL and width > 0 and height > 0
        assert x >= 0 and y >= 0 and x + width <= self.width and y + height <= self.height, (x, y, width, height)
        if self.record:
            self.ops.append((x, y, width, height, color))
        for yy in range(y, y + height):
            self.pixels[yy][x:x + width] = [color] * width
        self.writes += width * height

    def point(self, x, y, color):
        self.rect(x, y, 1, 1, color)

    def line(self, x0, y0, x1, y1, color):
        dx, sx = abs(x1 - x0), 1 if x0 < x1 else -1
        dy, sy = -abs(y1 - y0), 1 if y0 < y1 else -1
        error = dx + dy
        while True:
            self.point(x0, y0, color)
            if (x0, y0) == (x1, y1):
                break
            twice = 2 * error
            if twice >= dy:
                error += dy
                x0 += sx
            if twice <= dx:
                error += dx
                y0 += sy

    def ring(self, x, y, w, h, color):
        self.rect(x, y, w, 1, color)
        self.rect(x, y + h - 1, w, 1, color)
        self.rect(x, y, 1, h, color)
        self.rect(x + w - 1, y, 1, h, color)

    def blit(self, other, x, y, scale=1):
        for yy, row in enumerate(other.pixels):
            for xx, color in enumerate(row):
                if color != '.':
                    self.rect(x + xx * scale, y + yy * scale, scale, scale, color)

    def svg(self, name):
        # Integer rectangles are original authoring operations, not embedded raster.
        body = ''.join(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{COL[c]}"/>' for x, y, w, h, c in self.ops if c != '.')
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.width}" height="{self.height}" viewBox="0 0 {self.width} {self.height}" shape-rendering="crispEdges"><title>ASHVEIL v303 original UI: {name}</title>{body}</svg>\n').encode()


def rgba(color):
    value = COL[color]
    return bytes.fromhex(value[1:]) if len(value) == 9 else bytes.fromhex(value[1:]) + b'\xff'


def encode_png(c):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))
    raw = b''.join(b'\0' + b''.join(rgba(p) for p in row) for row in c.pixels)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', c.width, c.height, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


def rail(c, inset, color='ironD'):
    w, h = c.width, c.height
    c.ring(0, 0, w, h, 'black')
    c.rect(1, 1, w - 2, 1, color)
    c.rect(1, 1, 1, h - 2, color)
    c.rect(1, h - 2, w - 2, 1, 'rail')
    c.rect(w - 2, 1, 1, h - 2, 'rail')
    c.ring(2, 2, w - 4, h - 4, 'black')
    if inset > 3:
        c.ring(3, 3, w - 6, h - 6, 'shade')


def iron_panel(name):
    # Different constructions: mounted rail / archive rail / leather-bound rail.
    w, h = SIZE[name]
    base = 'warmInk' if name == 'celtic2' else 'ink'
    c = Canvas(w, h, base)
    rail(c, 6, 'iron' if name == 'frame' else 'ironD')
    c.ring(4, 4, w - 8, h - 8, 'black')
    if name == 'frame':
        # L-shaped iron corner brackets with a small brass fastening head.
        for x, y, sx, sy in ((1, 1, 1, 1), (w - 2, 1, -1, 1), (1, h - 2, 1, -1), (w - 2, h - 2, -1, -1)):
            for step in range(5):
                c.point(x + sx * step, y, 'ironD')
                c.point(x, y + sy * step, 'ironD')
            c.point(x + sx * 2, y + sy * 2, 'brass')
            c.point(x + sx, y + sy, 'ironWear')
        for x, length in ((14, 4), (41, 7), (73, 3)):
            c.rect(x, 1, length, 1, 'ironWear')
        c.rect(36, h - 2, 9, 1, 'black')
        c.rect(w - 2, 27, 1, 6, 'black')
    elif name == 'celtic':
        # Blunt cut steel miters; no knot, seal or repeated decorative motif.
        for x, y in ((2, 2), (w - 4, 2), (2, h - 4), (w - 4, h - 4)):
            c.rect(x, y, 2, 2, 'ironD')
        c.rect(8, 1, 6, 1, 'iron')
        c.rect(33, 1, 3, 1, 'iron')
        c.rect(1, 20, 1, 6, 'iron')
        c.rect(w - 2, 42, 1, 5, 'black')
        c.point(3, 3, 'brassD')
        c.point(w - 4, h - 4, 'rust')
    else:
        # Warm, soot-black leather strip under riveted short iron brackets.
        c.ring(3, 3, w - 6, h - 6, 'leather')
        for x, y in ((2, 2), (w - 4, 2), (2, h - 4), (w - 4, h - 4)):
            c.rect(x, y, 2, 2, 'soil')
            c.point(x, y, 'brass')
        c.rect(12, 1, 4, 1, 'soil')
        c.rect(43, h - 2, 7, 1, 'rust')
        c.rect(w - 2, 16, 1, 5, 'soil')
    # Every mark stays outside the 6px central slice: quiet seamless center.
    return c


def paper_panel(name):
    w, h = SIZE[name]
    inset = SLICE[name]
    c = Canvas(w, h, 'paperFace')
    c.ring(0, 0, w, h, 'paperEdge')
    c.ring(1, 1, w - 2, h - 2, 'paperShade')
    c.rect(2, 2, w - 4, 1, 'paperFiber')
    c.rect(2, 2, 1, h - 4, 'paper')
    # Authored fiber tears and folds are confined to the preserved slice.
    for x, width in ((6, 3), (19, 2), (w - 17, 4), (w - 7, 2)):
        c.rect(x, 0, width, 1, 'paperShade')
        c.rect(x, h - 1, width, 1, 'paperFace')
    for y, height in ((8, 3), (h - 12, 4)):
        c.rect(0, y, 1, height, 'paperFace')
        c.rect(w - 1, y + 1, 1, height, 'paperShade')
    c.line(2, 2, inset - 1, inset - 1, 'paperEdge')
    c.line(w - inset, h - inset, w - 3, h - 3, 'paperShade')
    if inset == 6:
        c.rect(15, 3, 8, 1, 'paperShade')
        c.rect(w - 4, 26, 1, 7, 'paperEdge')
        c.rect(3, h - 13, 1, 5, 'paperShade')
    return c


def button(name):
    w, h = SIZE[name]
    selected, leather = name.endswith('_sel'), name.endswith('_olive')
    c = Canvas(w, h, 'leather' if leather else ('warmInk' if selected else 'ink'))
    rail(c, 4, 'brass' if selected else 'ironD')
    if leather:
        c.rect(3, 4, 1, h - 8, 'soil')
        c.rect(w - 4, 4, 1, h - 8, 'black')
        c.point(2, 2, 'rust')
        c.point(w - 3, h - 3, 'soil')
    else:
        # Dry broken top reflection, attached to the rail rather than the body.
        c.rect(8, 1, 9, 1, 'iron' if not selected else 'brassL')
        c.rect(29, 1, 6, 1, 'ironD')
        c.rect(3, h - 3, w - 6, 1, 'black')
    if selected:
        c.rect(2, 10, 1, 12, 'bone')
        c.point(2, 2, 'brassL')
        c.point(w - 3, h - 3, 'brass')
    return c


def slot(name):
    selected, leather = name.endswith('_sel'), name.endswith('_olive')
    c = Canvas(32, 32, 'pit')
    c.ring(0, 0, 32, 32, 'black')
    c.rect(1, 1, 30, 1, 'brass' if selected else ('soil' if leather else 'ironD'))
    c.rect(1, 1, 1, 30, 'brass' if selected else 'rail')
    c.rect(1, 30, 30, 1, 'ironD' if not selected else 'brassD')
    c.rect(30, 1, 1, 30, 'black')
    c.ring(2, 2, 28, 28, 'black')
    if selected:
        # Corner hooks, rather than a circular dot or a glowing empty cell.
        c.rect(2, 2, 6, 1, 'bone')
        c.rect(2, 2, 1, 6, 'bone')
        c.rect(24, 29, 6, 1, 'brassL')
        c.rect(29, 24, 1, 6, 'brassL')
    else:
        c.point(3, 2, 'iron' if not leather else 'rust')
        c.point(29, 29, 'soil')
    return c


def tab(name):
    selected, leather = name.endswith('_sel'), name.endswith('_olive')
    c = Canvas(32, 32, 'warmInk' if selected else ('leather' if leather else 'ink'))
    c.ring(0, 0, 32, 32, 'black')
    c.rect(1, 1, 30, 1, 'bone' if selected else 'ironD')
    c.rect(1, 1, 1, 30, 'brass' if selected else 'rail')
    c.rect(30, 1, 1, 30, 'rail')
    c.rect(1, 30, 30, 1, 'brassD' if selected else 'black')
    c.ring(2, 2, 28, 28, 'black')
    c.rect(3, 3, 26, 1, 'brassD' if selected else ('soil' if leather else 'shade'))
    # Tear/cut resides in fixed corner; no repeated top-center jewelry.
    c.point(1, 1, 'black')
    c.point(2, 1, 'brassL' if selected else 'iron')
    c.point(29, 2, 'rust' if leather else 'ironD')
    return c


def bar_frame(name):
    w, h = SIZE[name]
    c = Canvas(w, h)
    gold = name.endswith('_gold')
    rail(c, SLICE[name], 'brass' if gold else ('iron' if name == 'bar_frame2' else 'ironD'))
    if gold:
        c.rect(1, 1, 4, 1, 'brassL')
        c.rect(w - 5, h - 2, 4, 1, 'brassD')
        c.point(2, 2, 'brass')
        c.point(w - 3, h - 3, 'brass')
    else:
        c.rect(10, 1, 7, 1, 'iron' if name == 'bar_frame' else 'ironWear')
        c.rect(67, h - 2, 5, 1, 'black')
    return c


def bar_fill(name):
    family = name.split('_')[1]
    c = Canvas(96, 8, family + '1')
    for y, color in ((0, family + '0'), (1, family + '2'), (2, family + '1'), (6, family + '0'), (7, 'black')):
        c.rect(0, y, 96, 1, color)
    return c


def sign(name):
    c = Canvas(*SIZE[name])
    if name == 'warn':
        # An iron warning tag, not the old filled web triangle.
        for y, left, width in ((4, 10, 12), (5, 9, 14), (6, 8, 16), (7, 7, 18)):
            c.rect(left, y, width, 1, 'black')
        c.rect(6, 8, 20, 18, 'black')
        c.rect(7, 9, 18, 16, 'brassD')
        c.rect(8, 10, 16, 14, 'ink')
        c.line(9, 7, 22, 7, 'brass')
        c.point(10, 6, 'brassL')
        c.rect(15, 11, 2, 7, 'bone')
        c.rect(15, 21, 2, 2, 'bone')
    elif name == 'xmark':
        # Two chipped iron strokes; the 28px button remains the hit target.
        for x0, y0, x1, y1 in ((9, 9, 22, 22), (9, 22, 22, 9)):
            c.line(x0, y0 + 1, x1, y1 + 1, 'black')
            c.line(x0, y0, x1, y1, 'bone')
        c.point(10, 9, 'ironWear')
        c.point(21, 10, 'iron')
        c.point(20, 22, 'ironD')
    elif name in ('diamond', 'diamond_dim'):
        dim = name.endswith('_dim')
        # A hollow riveted lozenge; active is a paper shard on a black field.
        for offset, color in ((0, 'black'), (1, 'ironD' if dim else 'brass'), (2, 'black')):
            top, bottom, left, right = 5 + offset, 26 - offset, 5 + offset, 26 - offset
            c.line(15, top, right, 15, color)
            c.line(right, 15, 16, bottom, color)
            c.line(16, bottom, left, 16, color)
            c.line(left, 16, 15, top, color)
        if dim:
            c.rect(14, 14, 4, 4, 'rail')
            c.rect(15, 15, 2, 2, 'ink')
        else:
            c.rect(14, 12, 4, 8, 'paperShade')
            c.rect(15, 12, 2, 7, 'bone')
            c.point(14, 13, 'paper')
    elif name == 'ornament':
        # Bent retaining wire and one archive nail: structural, not a crest.
        c.line(4, 17, 20, 17, 'ironD')
        c.line(20, 17, 27, 14, 'iron')
        c.line(36, 14, 42, 17, 'ironD')
        c.line(42, 17, 59, 17, 'ironD')
        c.rect(28, 10, 7, 12, 'black')
        c.rect(29, 11, 5, 10, 'brassD')
        c.rect(30, 12, 3, 7, 'iron')
        c.point(30, 12, 'ironWear')
        c.rect(31, 14, 1, 4, 'black')
    elif name == 'divider':
        c.rect(3, 7, 90, 1, 'rail')
        c.rect(6, 8, 84, 1, 'black')
        c.rect(3, 7, 13, 1, 'ironD')
        c.rect(43, 6, 10, 1, 'ironD')
        c.rect(45, 7, 5, 1, 'brassD')
        c.point(48, 6, 'iron')
        c.rect(78, 7, 7, 1, 'black')
    else:
        raise ValueError(name)
    return c


FONT = dict(zip('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-:/%.', [
    '010101111101101','110101110101110','011100100100011','110101101101110',
    '111100110100111','111100110100100','011100101101011','101101111101101',
    '111010010010111','001001001101010','101101110101101','100100100100111',
    '101111111101101','101111111111101','010101101101010','110101110100100',
    '010101101111011','110101110101101','011100010001110','111010010010010',
    '101101101101111','101101101101010','101101111111101','101101010101101',
    '101101010010010','111001010100111','111101101101111','010110010010111',
    '110001111100111','110001110001110','101101111001001','111100110001110',
    '011100111101111','111001010010010','111101111101111','111101111001110',
    '000000000000111','000000111000000','000010000010000','001001010100100',
    '101001010100101','000000000000010',
]))


def text(c, x, y, value, color='bone', scale=2):
    for ch in value.upper():
        for i, bit in enumerate(FONT.get(ch, '0' * 15)):
            if bit == '1':
                c.rect(x + i % 3 * scale, y + i // 3 * scale, scale, scale, color)
        x += 4 * scale


def nine(c, a, x, y, w, h, inset):
    assert w >= 2 * inset and h >= 2 * inset
    for dy in range(h):
        sy = dy if dy < inset else a.height - h + dy if dy >= h - inset else inset + (dy - inset) % (a.height - 2 * inset)
        for dx in range(w):
            sx = dx if dx < inset else a.width - w + dx if dx >= w - inset else inset + (dx - inset) % (a.width - 2 * inset)
            color = a.pixels[sy][sx]
            if color != '.':
                c.point(x + dx, y + dy, color)


def make_contacts(assets):
    groups = {
        'panels': (list(SIZE)[:4], 2, 340, 350),
        'controls': (list(SIZE)[4:13], 3, 228, 158),
        'bars': (list(SIZE)[13:19], 2, 330, 120),
        'signs': (list(SIZE)[19:], 3, 330, 162),
    }
    outputs = {}
    for name, (keys, cols, cw, ch) in groups.items():
        rows = (len(keys) + cols - 1) // cols
        c = Canvas(cols * cw + 24, rows * ch + 54, 'black', record=False)
        text(c, 16, 14, 'V303 ORIGINAL UI / ' + name, 'cloth')
        for n, key in enumerate(keys):
            x, y = 18 + n % cols * cw, 44 + n // cols * ch
            a = assets[key]
            text(c, x, y, key, 'bone')
            text(c, x, y + 16, f'{a.width}/{a.height} 3X', 'ironWear', 1)
            c.blit(a, x, y + 34, 3)
        outputs[f'review/contact-{name}.png'] = c
    return outputs


def make_mock(assets):
    c = Canvas(1180, 820, 'black', record=False)
    text(c, 24, 21, 'ASHVEIL / V303 IRON AND TORN PAPER / MATERIAL MOCK', 'cloth')
    nine(c, assets['frame'], 22, 60, 730, 626, 6)
    nine(c, assets['celtic2'], 33, 71, 708, 43, 6)
    text(c, 51, 87, 'INVENTORY / GREY MONASTERY', 'bone')
    c.blit(assets['xmark'], 700, 77)
    for i, key in enumerate(('tab_sel', 'tab', 'tab_olive')):
        nine(c, assets[key], 45 + i * 145, 134, 132, 32, 4)
        text(c, 55 + i * 145, 145, ('EQUIPMENT', 'SUPPLIES', 'RECORD')[i])
    text(c, 45, 190, 'PACK / RECESSED IRON / CLEAR SILHOUETTES', 'ironWear')
    for row in range(4):
        for col in range(9):
            key = 'slot_sel' if (row, col) == (1, 3) else ('slot_olive' if col > 6 else 'slot')
            nine(c, assets[key], 45 + col * 54, 221 + row * 54, 48, 48, 4)
    for n in range(5):
        x = 60 + n * 54
        c.rect(x, 238, 12, 15, 'soil')
        c.rect(x + 2, 235, 8, 3, 'ironWear')
    for x, label, key, frame, length in ((45, 'HEALTH 73/100', 'bar_red', 'bar_frame', 219), (389, 'ENERGY 48/60', 'bar_blue', 'bar_frame2', 238)):
        text(c, x, 467, label)
        for yy in range(8):
            for xx in range(length):
                c.point(x + 3 + xx, 496 + yy, assets[key].pixels[yy][xx % 96])
        nine(c, assets[frame], x, 492, 300, 16, 3)
    for n, key in enumerate(('btn', 'btn_olive', 'btn_sel')):
        x = 45 + n * 173
        nine(c, assets[key], x, 552, 160, 34, 4)
        text(c, x + 19, 564, ('CLOSE', 'SORT', 'EQUIP')[n])
    c.blit(assets['ornament'], 354, 618)
    nine(c, assets['parchment'], 778, 60, 380, 360, 6)
    text(c, 800, 87, 'A WORN FIELD RECORD', 'paperInk', 2)
    c.rect(801, 114, 330, 1, 'paperEdge')
    for n, line in enumerate(('COLD IRON HOLDS THE FRAME.', 'THE PAPER WAS FOLDED HERE.', 'NO GREEN COATING REMAINS.', 'READING COMES BEFORE THE', 'MARKS LEFT BY OLD HANDS.')):
        text(c, 801, 142 + n * 25, line, 'paperInk')
    nine(c, assets['parchment_small'], 800, 328, 336, 48, 4)
    text(c, 812, 348, 'NOTE / ALL 26 UI REPLACED', 'paperInk')
    nine(c, assets['celtic'], 778, 442, 380, 244, 6)
    for n, (key, label) in enumerate((('warn', 'WARNING'), ('diamond', 'SELECTED'), ('diamond_dim', 'INACTIVE'))):
        c.blit(assets[key], 800, 461 + n * 44)
        text(c, 846, 472 + n * 44, label, 'ironWear' if n == 2 else 'bone')
    for yy in range(8):
        for xx in range(213):
            c.point(804 + xx, 625 + yy, assets['bar_green'].pixels[yy][xx % 96])
    nine(c, assets['bar_frame_gold'], 800, 617, 336, 24, 4)
    c.blit(assets['divider'], 803, 656, 3)
    nine(c, assets['celtic2'], 22, 710, 1136, 86, 6)
    text(c, 44, 729, 'HOTBAR / EXISTING TEN SLOTS AND KEY HINTS', 'cloth')
    for n in range(10):
        nine(c, assets['slot_sel' if n == 0 else 'slot'], 672 + n * 46, 733, 40, 40, 4)
        text(c, 676 + n * 46, 740, str((n + 1) % 10), 'bone', 1)
    text(c, 44, 760, '1X SOURCE / PERCENT FILLS / NO GAME STATE', 'ironWear')
    return c


def png_validate(data):
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    offset, packed, dims, chunks = 8, bytearray(), None, 0
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset + 4])[0]
        kind, payload = data[offset + 4:offset + 8], data[offset + 8:offset + 8 + length]
        assert zlib.crc32(kind + payload) == struct.unpack('>I', data[offset + 8 + length:offset + 12 + length])[0]
        if kind == b'IHDR':
            dims = struct.unpack('>II', payload[:8])
            assert payload[8:] == bytes((8, 6, 0, 0, 0))
        elif kind == b'IDAT':
            packed.extend(payload)
        chunks += 1
        offset += length + 12
        if kind == b'IEND':
            break
    assert offset == len(data)
    raw = zlib.decompress(packed)
    w, h = dims
    assert len(raw) == h * (1 + w * 4)
    assert all(raw[y * (1 + w * 4)] == 0 for y in range(h))
    return {'width': w, 'height': h, 'crcChunks': chunks}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_matches_png(source, data):
    """Independently parse the emitted SVG rectangles and compare PNG scanlines."""
    root = ET.fromstring(source)
    w, h = int(root.attrib['width']), int(root.attrib['height'])
    raster = bytearray(w * h * 4)
    rectangles = 0
    for child in root:
        if child.tag.endswith('title'):
            continue
        assert child.tag == '{http://www.w3.org/2000/svg}rect'
        x, y, rw, rh = [int(child.attrib[name]) for name in ('x', 'y', 'width', 'height')]
        assert x >= 0 and y >= 0 and rw > 0 and rh > 0 and x + rw <= w and y + rh <= h
        color = bytes.fromhex(child.attrib['fill'][1:]) + b'\xff'
        assert len(color) == 4
        for yy in range(y, y + rh):
            offset = (yy * w + x) * 4
            raster[offset:offset + rw * 4] = color * rw
        rectangles += 1
    offset, packed = 8, bytearray()
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset + 4])[0]
        if data[offset + 4:offset + 8] == b'IDAT':
            packed.extend(data[offset + 8:offset + 8 + length])
        offset += length + 12
    scanlines = zlib.decompress(packed)
    actual = b''.join(scanlines[yy * (w * 4 + 1) + 1:(yy + 1) * (w * 4 + 1)] for yy in range(h))
    assert bytes(raster) == actual
    return rectangles


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    baseline_path = HERE / 'baseline-registry.json'
    baseline = json.loads(baseline_path.read_text())['ui']
    assert set(baseline) == set(SIZE)
    assets = {}
    for key in SIZE:
        if key in ('frame', 'celtic', 'celtic2'):
            assets[key] = iron_panel(key)
        elif key in ('parchment', 'parchment_small'):
            assets[key] = paper_panel(key)
        elif key.startswith('btn'):
            assets[key] = button(key)
        elif key.startswith('slot'):
            assets[key] = slot(key)
        elif key.startswith('tab'):
            assets[key] = tab(key)
        elif key.startswith('bar_frame'):
            assets[key] = bar_frame(key)
        elif key.startswith('bar_'):
            assets[key] = bar_fill(key)
        else:
            assets[key] = sign(key)
    audit = {'version': 303, 'baselineRegistrySha256': sha(baseline_path.read_bytes()),
             'generatorSha256': sha(Path(__file__).read_bytes()),
             'authorship': 'New integer rectangles/lines/structures. No raster sampled, traced, transformed or recolored.',
             'registeredCount': 26, 'svgSourceCount': 26, 'reviewCount': 5,
             'outOfBoundsWrites': 0, 'files': []}
    files = {}
    for key, canvas in assets.items():
        data = encode_png(canvas)
        info = png_validate(data)
        assert SIZE[key] == (info['width'], info['height'])
        old_bytes = (ROOT / 'public' / baseline[key]).read_bytes()
        assert SIZE[key] == struct.unpack('>II', old_bytes[16:24])
        assert sha(data) != sha(old_bytes)
        inset = SLICE.get(key)
        if inset:
            center = {canvas.pixels[y][x] for y in range(inset, canvas.height - inset) for x in range(inset, canvas.width - inset)}
            assert len(center) == 1, (key, center)
            if key.startswith('bar_frame'):
                assert center == {'.'}
            else:
                assert center != {'.'}
        if key in ('bar_red', 'bar_blue', 'bar_green'):
            assert all(len(set(row)) == 1 for row in canvas.pixels)
        path = f'{key}.png'
        source = canvas.svg(key)
        svg_rects = source_matches_png(source, data)
        files[path] = data
        files[f'source/{key}.svg'] = source
        audit['files'].append({'key': key, 'png': path, 'svg': f'source/{key}.svg', **info,
                               'slice': inset, 'fill': False if key.startswith('bar_frame') else bool(inset),
                               'centerUniformVerified': bool(inset), 'transparentBarCenter': key.startswith('bar_frame'),
                               'sourceOps': len(canvas.ops), 'integerPixelWrites': canvas.writes,
                               'svgRectangles': svg_rects, 'svgPixelsMatchPng': True,
                               'bytes': len(data), 'sha256': sha(data), 'svgSha256': sha(source),
                               'baselineSha256': sha(old_bytes), 'changedFromBaseline': True})
    reviews = make_contacts(assets)
    reviews['review/mock-panels.png'] = make_mock(assets)
    for name, canvas in reviews.items():
        data = encode_png(canvas)
        png_validate(data)
        files[name] = data
    fragment = {'ui': {key: f'sprites/original/direction-v303/ui/{key}.png' for key in SIZE}}
    audit['uniquePngShaCount'] = len({row['sha256'] for row in audit['files']})
    assert audit['uniquePngShaCount'] == 26
    audit['reviewFiles'] = [{'path': name, 'sha256': sha(files[name])} for name in reviews]
    audit['pngBytes'] = sum(row['bytes'] for row in audit['files'])
    audit['all26Changed'] = True
    files['review/ui-audit.json'] = (json.dumps(audit, indent=2, ensure_ascii=False) + '\n').encode()
    for name, data in files.items():
        path = OUT / name
        if args.check:
            assert path.read_bytes() == data, f'Unreproducible: {path}'
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    fragment_bytes = (json.dumps(fragment, indent=2) + '\n').encode()
    fragment_path = HERE / 'ui.fragment.json'
    if args.check:
        assert fragment_path.read_bytes() == fragment_bytes
    else:
        fragment_path.write_bytes(fragment_bytes)
    print(json.dumps({'mode': 'check' if args.check else 'draw', 'ui': 26, 'svg': 26, 'review': 5,
                      'pngCrcAndDimensions': 31, 'all26Changed': True, 'outOfBounds': 0, 'pngBytes': audit['pngBytes']}))


if __name__ == '__main__':
    main()
