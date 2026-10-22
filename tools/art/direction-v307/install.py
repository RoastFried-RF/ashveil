"""Validate or install reviewed forest atlas metadata; never modify PNG pixels."""
from pathlib import Path
import argparse
import hashlib
import json
import struct

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--write', action='store_true')
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
frames = json.loads((HERE / 'forest-frames.json').read_text())
provenance = json.loads((HERE / 'provenance.json').read_text())
png = ROOT / 'public' / frames['file']
data = png.read_bytes()
assert data[:8] == b'\x89PNG\r\n\x1a\n'
assert list(struct.unpack('>II', data[16:24])) == frames['sourceSize']
assert hashlib.sha256(data).hexdigest() == provenance['production']['sha256']
manifest_path = ROOT / 'src/client/sprites.json'
runtime_path = ROOT / 'src/client/render/forest-art.json'
manifest = json.loads(manifest_path.read_text())
expected = json.loads(json.dumps(manifest))
expected['sheets'][frames['sheet']] = frames['file']
runtime = []
for row in frames['variants']:
    x, y, width, height = row['frame']
    assert min(x, y) >= 0 and min(width, height) > 0
    assert x + width <= frames['sourceSize'][0] and y + height <= frames['sourceSize'][1]
    assert all(0 <= a <= 1 for a in row['anchor']) and row['worldHeight'] > 0
    expected['frames'][row['sprite']] = [frames['sheet'], *row['frame']]
    runtime.append({key: row[key] for key in ['sprite', 'worldHeight', 'anchor']})
assert len({row['sprite'] for row in runtime}) == 4
if args.write:
    manifest_path.write_text(json.dumps(expected, ensure_ascii=False, indent=2) + '\n')
    runtime_path.write_text(json.dumps(runtime, ensure_ascii=False, indent=2) + '\n')
else:
    assert manifest == expected, 'Run --write to install atlas metadata'
    assert json.loads(runtime_path.read_text()) == runtime, 'Run --write to install runtime metadata'
print(json.dumps({'frames': len(runtime), 'pngSha256': hashlib.sha256(data).hexdigest(), 'pngPixelsUnmodified': True}))
