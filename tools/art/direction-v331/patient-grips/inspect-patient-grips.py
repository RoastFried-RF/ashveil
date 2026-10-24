"""Read-only source-crop contact sheets; outputs are local diagnostics, not art."""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


parser = argparse.ArgumentParser()
parser.add_argument('--repo', type=Path, default=Path('/workspace/ashveil'))
parser.add_argument('--output', type=Path, default=Path('/tmp/ashveil-v331-patient-grips'))
parser.add_argument('--points', type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
m = json.loads((args.repo / 'src/client/sprites.json').read_text())
character = m['chars']['withered_priest']
points = json.loads(args.points.read_text())['frames'] if args.points else {}
cache = {}
manifest = {'character': 'withered_priest', 'sharedModel': 'patient', 'frames': {}, 'sources': {}}

for motion in ['idle', 'walk', 'attack']:
    for direction in ['down', 'left', 'right', 'up']:
        keys = character[motion][direction]
        rows = (len(keys) + 3) // 4
        contact = Image.new('RGB', (960, rows * 320), (36, 33, 29))
        draw = ImageDraw.Draw(contact)
        for index, key in enumerate(keys):
            sheet, x, y, width, height = m['frames'][key]
            source = args.repo / 'public' / m['sheets'][sheet]
            if sheet not in cache:
                cache[sheet] = Image.open(source).convert('RGBA')
                manifest['sources'][sheet] = {
                    'path': str(source.relative_to(args.repo)),
                    'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                    'size': list(cache[sheet].size),
                }
            transform = character.get('frameTransforms', {}).get(key, {})
            manifest['frames'][key] = {'crop': m['frames'][key], 'transform': transform}
            col, row = index % 4, index // 4
            ox, oy = col * 240 + 30, row * 320 + 30
            crop = cache[sheet].crop((x, y, x + width, y + height))
            contact.paste(crop, (ox, oy), crop)
            draw.text((col * 240 + 4, row * 320 + 3), f'{motion} {direction}{index} {width}x{height} flip={int(transform.get("flipX", False))}', fill=(235, 222, 196))
            for gx in range(0, width + 1, 20):
                draw.line((ox + gx, oy + 60, ox + gx, oy + min(190, height)), fill=(87, 79, 66))
                draw.text((ox + gx - 3, oy + 48), str(gx), fill=(185, 172, 147))
            for gy in range(80, min(190, height) + 1, 20):
                draw.line((ox, oy + gy, ox + width, oy + gy), fill=(87, 79, 66))
                draw.text((ox - 26, oy + gy - 4), str(gy), fill=(185, 172, 147))
            for hand, colour in [('main', (50, 255, 80)), ('off', (255, 80, 220))]:
                point = points.get(key, {}).get(hand)
                if point is not None:
                    px, py = ox + point[0], oy + point[1]
                    draw.line((px - 4, py, px + 4, py), fill=colour)
                    draw.line((px, py - 4, px, py + 4), fill=colour)
        suffix = '-points' if args.points else '-source'
        contact.save(args.output / f'patient-{motion}-{direction}{suffix}.png')

if not args.points:
    (Path(__file__).parent / 'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
