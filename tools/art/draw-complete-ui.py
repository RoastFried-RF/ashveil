#!/usr/bin/env python3
"""Author all 26 legacy UI replacements from new integer-coordinate Canvas drawings.

No input raster, external pack, crop, tracing, recoloring, image library or image
decoder is used. Source dimensions were read once from the old PNG IHDR headers.
The immutable catalog is read only to check registry coverage. Review compositions
sample only the newly authored in-memory Canvas objects, never a PNG input.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/sprites/original/complete/ui'
FRAGMENT = ROOT / 'tools/art/complete-ui.fragment.json'
COLORS = {
    '.': (0, 0, 0, 0),
    'night': '#080f12', 'ink': '#101b1e', 'deep': '#0c1518',
    'teal': '#172528', 'teal2': '#1c2b2d', 'teal3': '#243638',
    'stone': '#374844', 'ash': '#55645b', 'ashLight': '#7d897a',
    'bronzeDark': '#4f4938', 'bronze': '#867653', 'bronzeLight': '#b29b6b',
    'ivory': '#dcd4b8', 'olive': '#202d27', 'olive2': '#29372d',
    'paper': '#ccc3a6', 'paper2': '#c6bda0', 'paperEdge': '#9e977e',
    'paperInk': '#303832', 'rust': '#805148', 'rustLight': '#b47560',
    'red0': '#663f38', 'red1': '#874f43', 'red2': '#aa6a53',
    'blue0': '#34525b', 'blue1': '#486d78', 'blue2': '#719493',
    'green0': '#3d5140', 'green1': '#5c7550', 'green2': '#83986a',
}

SIZE = {
    'frame': (96, 96), 'parchment': (96, 96),
    'celtic': (72, 72), 'celtic2': (72, 72),
    'btn': (64, 32), 'btn_olive': (64, 32), 'btn_sel': (64, 32),
    'slot': (32, 32), 'slot_olive': (32, 32), 'slot_sel': (32, 32),
    'tab': (32, 32), 'tab_olive': (32, 32), 'tab_sel': (32, 32),
    'bar_frame': (96, 16), 'bar_frame2': (96, 16),
    'bar_frame_gold': (96, 24),
    'bar_blue': (96, 8), 'bar_red': (96, 8), 'bar_green': (96, 8),
    'warn': (32, 32), 'xmark': (32, 32), 'diamond': (32, 32),
    'diamond_dim': (32, 32), 'ornament': (64, 32),
    'divider': (96, 16), 'parchment_small': (64, 32),
}
SLICE = {
    'frame': 6, 'parchment': 6, 'celtic': 6, 'celtic2': 6,
    'btn': 4, 'btn_olive': 4, 'btn_sel': 4,
    'slot': 4, 'slot_olive': 4, 'slot_sel': 4,
    'tab': 4, 'tab_olive': 4, 'tab_sel': 4,
    'bar_frame': 3, 'bar_frame2': 3, 'bar_frame_gold': 4,
    'parchment_small': 4,
}


class Canvas:
    def __init__(self, width, height, fill='.'):
        assert isinstance(width, int) and isinstance(height, int)
        self.width, self.height = width, height
        self.pixels = [[fill] * width for _ in range(height)]
        self.writes = 0

    def point(self, x, y, color):
        assert isinstance(x, int) and isinstance(y, int)
        assert color in COLORS, color
        assert 0 <= x < self.width and 0 <= y < self.height, (x, y, self.width, self.height)
        self.pixels[y][x] = color
        self.writes += 1

    def rect(self, x, y, width, height, color):
        assert width >= 0 and height >= 0
        for py in range(y, y + height):
            for px in range(x, x + width):
                self.point(px, py, color)

    def line(self, x0, y0, x1, y1, color):
        dx, sx = abs(x1 - x0), 1 if x0 < x1 else -1
        dy, sy = -abs(y1 - y0), 1 if y0 < y1 else -1
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

    def ring(self, x, y, width, height, color):
        self.rect(x, y, width, 1, color)
        self.rect(x, y + height - 1, width, 1, color)
        self.rect(x, y, 1, height, color)
        self.rect(x + width - 1, y, 1, height, color)

    def blit(self, other, x, y, scale=1):
        for py, row in enumerate(other.pixels):
            for px, color in enumerate(row):
                if color != '.':
                    self.rect(x + px * scale, y + py * scale, scale, scale, color)


def rgb(color):
    value = COLORS[color]
    return value if isinstance(value, tuple) else tuple(bytes.fromhex(value[1:])) + (255,)


def png(canvas):
    def chunk(kind, payload):
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload))
    raw = b''.join(b'\0' + bytes(c for p in row for c in rgb(p)) for row in canvas.pixels)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', canvas.width, canvas.height, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def texture(c, inset, base, speck, period=8):
    """Quiet periodic original material; no random/gradient/old raster input."""
    c.rect(inset, inset, c.width - inset * 2, c.height - inset * 2, base)
    for y in range(inset, c.height - inset):
        for x in range(inset, c.width - inset):
            if x % period == 2 and y % period == 5:
                c.point(x, y, speck)


def bevel(c, line='stone', inner='teal2', corner='bronze'):
    w, h = c.width, c.height
    c.ring(0, 0, w, h, 'night')
    c.ring(1, 1, w - 2, h - 2, line)
    c.ring(2, 2, w - 4, h - 4, 'deep')
    c.ring(3, 3, w - 6, h - 6, inner)
    # Four tiny iron / brass joints, each contained entirely in the 4px corners.
    for x, y in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)):
        c.point(x, y, corner)
    c.point(1, 1, 'ash')
    c.point(w - 2, h - 2, 'bronzeDark')


def panel(name):
    c = Canvas(*SIZE[name], 'ink')
    if name == 'parchment':
        texture(c, 0, 'paper', 'paper2', 12)
        c.ring(0, 0, c.width, c.height, 'bronzeDark')
        c.ring(1, 1, c.width - 2, c.height - 2, 'paperEdge')
        c.ring(3, 3, c.width - 6, c.height - 6, 'paper2')
        # Short worn folds, no borrowed paper texture or visible writing.
        for x, y in ((4, 4), (c.width - 7, 4), (4, c.height - 5), (c.width - 7, c.height - 5)):
            c.rect(x, y, 3, 1, 'paperEdge')
        return c
    olive = name == 'celtic2'
    texture(c, 0, 'olive' if olive else 'ink', 'olive2' if olive else 'teal', 12)
    bevel(c, 'ash' if olive else 'stone', 'olive2' if olive else 'teal2')
    # Fresh design: shrine masonry clamps, not copied Celtic knots.
    for left in (True, False):
        x = 4 if left else c.width - 5
        for top in (True, False):
            y = 4 if top else c.height - 5
            c.point(x, y, 'bronzeLight' if name == 'frame' else 'bronze')
            c.point(x + (1 if left else -1), y, 'bronzeDark')
    if name == 'frame':
        # Restrained one-pixel wear along the outer metal line.
        for x in (18, 49, 78):
            c.point(x, 1, 'ash')
            c.point(c.width - 1 - x, c.height - 2, 'bronzeDark')
    return c


def control(name):
    selected, olive = name.endswith('_sel'), name.endswith('_olive')
    c = Canvas(*SIZE[name], 'olive' if olive or selected else 'ink')
    base = 'olive2' if selected else ('olive' if olive else 'teal')
    texture(c, 4, base, 'teal3' if not olive else 'olive2')
    bevel(c, 'bronzeLight' if selected else 'stone', 'bronzeDark' if selected else base)
    if name.startswith('slot'):
        # Empty inventory cells stay dark; item silhouettes have a quiet field.
        # The complete 4px-sliced center is uniform; no repeating inner border.
        c.rect(4, 4, c.width - 8, c.height - 8, 'deep' if not selected else 'olive')
        if selected:
            c.rect(2, 13, 1, 6, 'ivory')
    elif name.startswith('tab'):
        c.rect(5, c.height - 4, c.width - 10, 1, 'bronze' if selected else 'deep')
        if selected:
            c.rect(14, 2, 4, 1, 'ivory')
    else:
        c.rect(5, 3, c.width - 10, 1, 'teal3' if not selected else 'ash')
        c.rect(5, c.height - 4, c.width - 10, 1, 'deep')
        if selected:
            c.rect(2, 12, 1, 8, 'ivory')
    return c


def bar_frame(name):
    c = Canvas(*SIZE[name])
    w, h = c.width, c.height
    gold = name.endswith('gold')
    edge = 'bronze' if gold else ('ash' if name.endswith('2') else 'stone')
    c.ring(0, 0, w, h, 'night')
    c.ring(1, 1, w - 2, h - 2, edge)
    c.ring(2, 2, w - 4, h - 4, 'deep')
    if gold:
        c.ring(3, 3, w - 6, h - 6, 'bronzeDark')
        for x in (2, w - 3):
            c.point(x, 2, 'bronzeLight')
    else:
        c.point(2, 1, 'ashLight')
    # Center is deliberately transparent. CSS fill is drawn below this frame.
    return c


def bar_fill(name):
    family = name.removeprefix('bar_')
    c = Canvas(*SIZE[name], family + '1')
    for y, color in ((0, family + '0'), (1, family + '2'), (6, family + '0'), (7, 'deep')):
        c.rect(0, y, c.width, 1, color)
    # Invariant columns permit any percent-width crop with no endpoint ornament.
    return c


def symbol(name):
    c = Canvas(*SIZE[name])
    if name == 'warn':
        # Stepped votive-warning tablet: clear exclamation at 1x and 3x.
        for y in range(3, 28):
            half = (y - 3) // 2
            c.rect(15 - half, y, half * 2 + 2, 1, 'night')
        for y in range(6, 26):
            half = (y - 6) // 2
            c.rect(15 - half, y, half * 2 + 2, 1, 'bronze')
        c.rect(15, 12, 2, 8, 'ivory')
        c.rect(15, 23, 2, 2, 'ivory')
    elif name == 'xmark':
        # No enclosing disk: the existing .window-close supplies its own box.
        c.line(9, 10, 21, 22, 'night')
        c.line(10, 10, 22, 22, 'night')
        c.line(10, 22, 22, 10, 'night')
        c.line(9, 22, 21, 10, 'night')
        c.line(10, 9, 22, 21, 'ivory')
        c.line(10, 21, 22, 9, 'ivory')
        c.line(11, 9, 22, 20, 'ashLight')
        c.line(11, 21, 22, 10, 'ashLight')
    elif name in ('diamond', 'diamond_dim'):
        dim = name.endswith('dim')
        for y in range(4, 28):
            half = min(y - 4, 27 - y)
            c.rect(15 - half, y, half * 2 + 2, 1, 'night')
        for y in range(6, 26):
            half = min(y - 6, 25 - y)
            c.rect(15 - half, y, half * 2 + 2, 1, 'stone' if dim else 'bronze')
        c.line(15, 7, 7, 15, 'ash' if dim else 'ivory')
        c.line(16, 8, 24, 16, 'teal2' if dim else 'bronzeLight')
        c.rect(14, 13, 4, 6, 'deep' if dim else 'bronzeDark')
        c.rect(15, 14, 2, 4, 'stone' if dim else 'bronzeLight')
    elif name == 'ornament':
        # Small archivist's broken seal, two sparse wings and central lozenge.
        for start, stop in ((4, 24), (40, 59)):
            c.line(start, 16, stop, 16, 'bronzeDark')
            c.line(start + 2, 15, stop - 2, 15, 'ash')
        c.line(24, 16, 31, 9, 'bronze')
        c.line(31, 9, 38, 16, 'bronzeLight')
        c.line(38, 16, 31, 23, 'bronzeDark')
        c.line(31, 23, 24, 16, 'bronze')
        c.rect(30, 14, 3, 5, 'ivory')
        c.point(7, 14, 'bronze')
        c.point(56, 17, 'bronze')
    elif name == 'divider':
        c.rect(1, 7, 94, 1, 'stone')
        c.rect(4, 8, 88, 1, 'night')
        c.rect(44, 6, 8, 1, 'bronze')
        c.rect(47, 5, 2, 5, 'bronzeDark')
        c.rect(47, 6, 2, 2, 'bronzeLight')
        c.point(1, 7, 'bronze')
        c.point(94, 7, 'bronze')
    elif name == 'parchment_small':
        texture(c, 0, 'paper', 'paper2')
        c.ring(0, 0, c.width, c.height, 'bronzeDark')
        c.ring(1, 1, c.width - 2, c.height - 2, 'paperEdge')
        c.ring(3, 3, c.width - 6, c.height - 6, 'paper2')
        c.point(3, 3, 'paperEdge')
        c.point(c.width - 4, c.height - 4, 'paperEdge')
    else:
        raise AssertionError(name)
    return c


# Authored 3x5 display letters for review labels; no external font image input.
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


def text(c, x, y, value, color='ivory', scale=2):
    for ch in value.upper():
        bits = FONT.get(ch, '0' * 15)
        for n, bit in enumerate(bits):
            if bit == '1':
                c.rect(x + (n % 3) * scale, y + (n // 3) * scale, scale, scale, color)
        x += 4 * scale


def nine(c, asset, x, y, width, height, inset):
    """Repeat 9slice composition using only our new in-memory Canvas pixels."""
    for dy in range(height):
        sy = dy if dy < inset else (asset.height - height + dy if dy >= height - inset else inset + (dy - inset) % (asset.height - inset * 2))
        for dx in range(width):
            sx = dx if dx < inset else (asset.width - width + dx if dx >= width - inset else inset + (dx - inset) % (asset.width - inset * 2))
            color = asset.pixels[sy][sx]
            if color != '.':
                c.point(x + dx, y + dy, color)


def contacts(assets):
    pages = {
        'contact-panels': (['frame', 'parchment', 'celtic', 'celtic2'], 2, 352, 348),
        'contact-controls': (['btn', 'btn_olive', 'btn_sel', 'slot', 'slot_olive', 'slot_sel', 'tab', 'tab_olive', 'tab_sel'], 3, 232, 156),
        'contact-bars': (['bar_frame', 'bar_frame2', 'bar_frame_gold', 'bar_blue', 'bar_red', 'bar_green'], 2, 332, 124),
        'contact-symbols': (['warn', 'xmark', 'diamond', 'diamond_dim', 'ornament', 'divider', 'parchment_small'], 3, 332, 160),
    }
    result = {}
    for page, (names, columns, cellw, cellh) in pages.items():
        rows = (len(names) + columns - 1) // columns
        c = Canvas(columns * cellw + 24, rows * cellh + 56, 'night')
        text(c, 16, 16, page, 'ivory', 2)
        for i, name in enumerate(names):
            a = assets[name]
            x, y = 12 + (i % columns) * cellw, 44 + (i // columns) * cellh
            text(c, x + 6, y + 4, name, 'ashLight', 2)
            text(c, x + 6, y + 20, f'{a.width}/{a.height} / 3X', 'bronze', 1)
            c.blit(a, x + 6, y + 36, 3)
        result[page] = c
    return result


def mock(assets):
    c = Canvas(1120, 760, 'night')
    text(c, 28, 19, 'ASHVEIL / ORIGINAL UI MATERIAL MOCK / NO GAME STATE', 'ashLight', 2)
    nine(c, assets['frame'], 24, 52, 680, 670, 6)
    nine(c, assets['celtic2'], 34, 62, 660, 48, 6)
    text(c, 54, 78, 'INVENTORY / ASHEN WAYFARER', 'ivory', 2)
    c.blit(assets['xmark'], 652, 69)
    for i, name in enumerate(('tab_sel', 'tab', 'tab_olive')):
        nine(c, assets[name], 46 + 138 * i, 128, 126, 32, 4)
        text(c, 58 + 138 * i, 139, ('EQUIPMENT', 'SUPPLIES', 'CRAFT')[i], 'ivory', 2)
    text(c, 46, 184, 'PACK / QUIET FIELD / 1X SOURCE', 'ashLight', 2)
    for row in range(4):
        for col in range(8):
            name = 'slot_sel' if (row, col) == (1, 3) else ('slot_olive' if col > 5 else 'slot')
            nine(c, assets[name], 46 + col * 53, 214 + row * 53, 48, 48, 4)
    # Inventory-content placeholders are deliberately neutral strokes, not assets.
    for i in range(4):
        x = 60 + i * 53
        c.rect(x, 229, 13, 17, 'stone')
        c.rect(x + 2, 227, 9, 3, 'ash')
    text(c, 46, 450, 'HEALTH 73/100', 'ivory', 2)
    text(c, 374, 450, 'ENERGY 48/60', 'ivory', 2)
    for x, fill, frame, length in ((46, 'bar_red', 'bar_frame', 218), (374, 'bar_blue', 'bar_frame2', 240)):
        c.rect(x + 3, 479, length, 8, 'deep')
        for px in range(length):
            for py in range(8):
                c.point(x + 3 + px, 479 + py, assets[fill].pixels[py][px % 96])
        nine(c, assets[frame], x, 475, 282, 16, 3)
    text(c, 46, 518, 'READABLE TEXT / SUBDUED METAL / WORN JOINTS', 'ashLight', 2)
    for x, name, label in ((46, 'btn', 'CLOSE'), (210, 'btn_olive', 'SORT'), (374, 'btn_sel', 'EQUIP')):
        nine(c, assets[name], x, 559, 150, 34, 4)
        text(c, x + 20, 571, label, 'ivory', 2)
    c.blit(assets['ornament'], 320, 628)
    nine(c, assets['parchment'], 728, 52, 368, 334, 6)
    text(c, 752, 78, 'FIELD RECORD', 'paperInk', 3)
    c.rect(752, 111, 320, 1, 'paperEdge')
    for i, line in enumerate(('THE TEMPLE IS QUIET.', 'OLD BRASS HOLDS THE', 'STONE JOINTS TOGETHER.', 'THE LIGHT IS NOT PAINTED', 'OVER THE WRITING.')):
        text(c, 752, 137 + i * 24, line, 'paperInk', 2)
    nine(c, assets['parchment_small'], 752, 300, 320, 46, 4)
    text(c, 766, 317, 'NOTE / 26 ORIGINAL UI FILES', 'paperInk', 2)
    nine(c, assets['celtic'], 728, 408, 368, 314, 6)
    text(c, 751, 432, 'STATE AND SYMBOLS', 'ivory', 2)
    c.blit(assets['warn'], 752, 466)
    text(c, 798, 477, 'WARNING', 'bronzeLight', 2)
    c.blit(assets['diamond'], 752, 510)
    text(c, 798, 520, 'SELECTED', 'ivory', 2)
    c.blit(assets['diamond_dim'], 752, 554)
    text(c, 798, 565, 'INACTIVE', 'ashLight', 2)
    nine(c, assets['bar_frame_gold'], 752, 610, 320, 24, 4)
    for px in range(212):
        for py in range(8):
            c.point(756 + px, 618 + py, assets['bar_green'].pixels[py][px % 96])
    c.blit(assets['divider'], 754, 660, 3)
    return c


def png_check(data):
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    offset, raw, count, dimensions = 8, bytearray(), 0, None
    while offset < len(data):
        length = struct.unpack('>I', data[offset:offset + 4])[0]
        kind, payload = data[offset + 4:offset + 8], data[offset + 8:offset + 8 + length]
        expected = struct.unpack('>I', data[offset + 8 + length:offset + 12 + length])[0]
        assert zlib.crc32(kind + payload) == expected
        if kind == b'IHDR':
            dimensions = struct.unpack('>II', payload[:8])
            assert payload[8:] == bytes((8, 6, 0, 0, 0))
        if kind == b'IDAT':
            raw.extend(payload)
        count += 1
        offset += length + 12
        if kind == b'IEND':
            break
    assert offset == len(data)
    pixels = zlib.decompress(raw)
    width, height = dimensions
    assert len(pixels) == height * (width * 4 + 1)
    assert all(pixels[y * (width * 4 + 1)] == 0 for y in range(height))
    return {'width': width, 'height': height, 'crcChunks': count, 'rgbaBytes': width * height * 4}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true', help='Verify authored bytes without writing')
    args = parser.parse_args()
    catalog = json.loads((ROOT / 'tools/art/complete-catalog-v302-before.json').read_text())
    assert set(catalog['registry']['ui']) == set(SIZE)
    assets = {}
    for name in SIZE:
        if name in ('frame', 'parchment', 'celtic', 'celtic2'):
            assets[name] = panel(name)
        elif name.startswith(('btn', 'slot', 'tab')):
            assets[name] = control(name)
        elif name.startswith('bar_frame'):
            assets[name] = bar_frame(name)
        elif name.startswith('bar_'):
            assets[name] = bar_fill(name)
        else:
            assets[name] = symbol(name)
    outputs = {f'{name}.png': c for name, c in assets.items()}
    outputs.update({f'review/{name}.png': c for name, c in contacts(assets).items()})
    outputs['review/mock-panels.png'] = mock(assets)
    fragment = {'ui': {name: f'sprites/original/complete/ui/{name}.png' for name in SIZE}}
    audit = {
        'scope': '26 newly authored original UI rasters; all original registry keys covered',
        'provenance': 'Integer Canvas authored coordinates only; no PNG input, crop, trace, pack sampling or recolor',
        'sourceDimensionEvidence': 'Legacy PNG signature and IHDR bytes 16-24 only were read during investigation; generator does not open them',
        'registeredCount': len(assets), 'reviewCount': len(outputs) - len(assets),
        'bounds': 'All Canvas.point writes assert integer coordinates, valid palette, and in-bounds positions',
        'sourceConsumersBeforeIntegration': {'injection': 'src/client/App.vue onMounted -> --ui-${k}', 'imageVariableConsumers': 0, 'cssFile': 'src/style.css'},
        'slice': SLICE, 'files': [],
    }
    for name, canvas in outputs.items():
        data = png(canvas)
        info = png_check(data)
        assert (info['width'], info['height']) == (canvas.width, canvas.height)
        info.update({'path': f'sprites/original/complete/ui/{name}', 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'canvasWrites': canvas.writes})
        if name.removesuffix('.png') in SIZE:
            key = name.removesuffix('.png')
            assert (canvas.width, canvas.height) == SIZE[key]
            info['legacyDimensionsPreserved'] = True
            info['slice'] = SLICE.get(key)
            if key in ('frame', 'parchment', 'celtic', 'celtic2'):
                inset, period = SLICE[key], 12
                assert (canvas.width - 2 * inset) % period == 0
                assert (canvas.height - 2 * inset) % period == 0
                for y in range(inset, canvas.height - inset):
                    for x in range(inset, canvas.width - inset):
                        assert canvas.pixels[y][x] == canvas.pixels[inset + (y - inset) % period][inset + (x - inset) % period]
                info['centerPatternPeriod'] = period
                info['seamlessCenterVerified'] = True
            if key.startswith('slot'):
                inset = SLICE[key]
                center = {canvas.pixels[y][x] for y in range(inset, canvas.height - inset) for x in range(inset, canvas.width - inset)}
                assert len(center) == 1
                info['uniformSlotCenterVerified'] = True
            info['nontransparentPixels'] = sum(p != '.' for row in canvas.pixels for p in row)
            assert info['nontransparentPixels'] > 0
            if key.startswith('bar_frame'):
                inset = SLICE[key]
                assert all(canvas.pixels[y][x] == '.' for y in range(inset, canvas.height - inset) for x in range(inset, canvas.width - inset))
                info['transparentCenterVerified'] = True
            if key in ('bar_red', 'bar_green', 'bar_blue'):
                assert all(len(set(row)) == 1 for row in canvas.pixels)
                info['arbitraryWidthCropSafe'] = True
        audit['files'].append(info)
        target = OUT / name
        if args.check:
            assert target.read_bytes() == data, f'Out of date: {target}'
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
    asset_rows = audit['files'][:len(assets)]
    audit['uniqueAssetShaCount'] = len({row['sha256'] for row in asset_rows})
    assert audit['uniqueAssetShaCount'] == len(assets)
    audit['registeredKeysExact'] = True
    audit['assetBytes'] = sum(row['bytes'] for row in asset_rows)
    for path, obj in ((FRAGMENT, fragment), (OUT / 'review/ui-audit.json', audit)):
        data = (json.dumps(obj, indent=2, ensure_ascii=False) + '\n').encode()
        if args.check:
            assert path.read_bytes() == data, f'Out of date: {path}'
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    print(json.dumps({'mode': 'check' if args.check else 'draw', 'registered': len(assets), 'reviews': len(outputs) - len(assets), 'pngCrcAndRgba': len(outputs), 'dimensionMismatches': 0, 'outOfBoundsWrites': 0, 'fragment': str(FRAGMENT.relative_to(ROOT))}))


if __name__ == '__main__':
    main()
