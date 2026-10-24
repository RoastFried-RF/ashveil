"""Read-only PNG analysis and clearly labelled diagnostic composites.

No generated PNG is modified. Crops/scale are display diagnostics only.
"""
import hashlib
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage


BASE = Path(__file__).parent
OUT = Path('/tmp/ashveil-v344-cinder-bear-rear-walk')
OUT.mkdir(parents=True, exist_ok=True)
reports = {}
for path in sorted((BASE / 'originals').glob('*.png')):
    image = Image.open(path).convert('RGBA')
    alpha = np.asarray(image.getchannel('A'))
    mask = alpha >= 16
    labels, count = ndimage.label(mask, structure=np.ones((3, 3)))
    areas = np.bincount(labels.ravel())
    regions = []
    for index, slices in enumerate(ndimage.find_objects(labels), 1):
        if slices is None or areas[index] < 400:
            continue
        ys, xs = slices
        regions.append({'bbox': [xs.start, ys.start, xs.stop, ys.stop], 'alpha16Area': int(areas[index])})
    directional = re.search(r'-(?:walk|fall)-(down|left|right|up)-', path.name)
    columns = 2 if directional else 4
    regions.sort(key=lambda r: (int(((r['bbox'][1]+r['bbox'][3])/2)/image.height*columns), (r['bbox'][0]+r['bbox'][2])/2))
    ordered = []
    for row in range(0, len(regions), columns):
        ordered.extend(sorted(regions[row:row + columns], key=lambda r: r['bbox'][0]))
    for i, region in enumerate(ordered):
        row_directions = ['up', 'left', 'right', 'down'] if path.name in ['culler-idle-v2.png', 'sower-walk-v1.png', 'sower-work-v1.png'] else ['down', 'left', 'right', 'up']
        region['direction'] = directional.group(1) if directional else (row_directions[i // 4] if i < 16 else 'unexpected')
        region['index'] = i if directional else i % 4
        x0, y0, x1, y1 = region['bbox']
        # Small retained edge padding, within the original canvas. This is a
        # manifest rectangle only; do not write it back as a new art PNG.
        region['crop'] = [max(0, x0 - 3), max(0, y0 - 3), min(image.width, x1 + 3) - max(0, x0 - 3), min(image.height, y1 + 3) - max(0, y0 - 3)]
    report = {
        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'size': list(image.size), 'mode': image.mode,
        'alphaExtrema': [int(alpha.min()), int(alpha.max())],
        'lowAlphaPixelCount1to15': int(((alpha > 0) & (alpha < 16)).sum()),
        'opaqueCanvasEdgePixelsAlpha16': int(mask[0].sum() + mask[-1].sum() + mask[:, 0].sum() + mask[:, -1].sum()),
        'regionsAlpha16Area400': ordered,
    }
    reports[path.name] = report
    # Composite exact original pixels over a neutral dark grey; boxes and
    # labels are analysis overlays, not replacement sprite artwork.
    diagnostic = Image.new('RGBA', image.size, (46, 44, 40, 255))
    diagnostic.alpha_composite(image)
    draw = ImageDraw.Draw(diagnostic)
    for region in ordered:
        x0, y0, x1, y1 = region['bbox']
        draw.rectangle((x0 - 2, y0 - 2, x1 + 1, y1 + 1), outline=(160, 174, 110, 255))
        draw.text((x0, max(0, y0 - 14)), f"{region['direction']}{region['index']} {x1-x0}x{y1-y0}", fill=(235, 225, 192, 255))
    diagnostic.convert('RGB').save(OUT / (path.stem + '-analysis.png'))
    print(path.name, 'regions', len(ordered), 'alpha16Edges', report['opaqueCanvasEdgePixelsAlpha16'])
(BASE / 'source-analysis.json').write_text(json.dumps(reports, indent=2) + '\n')
