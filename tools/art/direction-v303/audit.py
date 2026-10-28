"""Read-only pixel/coverage/content audit against the immutable v302 publication."""
from pathlib import Path
from collections import Counter
import argparse
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path)
parser.add_argument('--baseline', type=Path, default=Path('/workspace/.ashveil-checkpoints/v302-art-final'))
args = parser.parse_args()
assert not args.output.exists(), 'Existing evidence cannot be overwritten'
sha = lambda data: hashlib.sha256(data).hexdigest()
before = json.loads((ROOT / 'tools/art/direction-v303/baseline-registry.json').read_text())
after = json.loads((ROOT / 'src/client/sprites.json').read_text())
assert before == json.loads((args.baseline / 'src/client/sprites.json').read_text())
assert {k: len(v) for k, v in before.items() if k != 'sheets'} == {k: len(v) for k, v in after.items() if k != 'sheets'}
images = {}
def pixels(base, registry, key):
    sheet, x, y, w, h = registry['frames'][key]
    path = base / 'public' / registry['sheets'][sheet]
    if path not in images:
        images[path] = Image.open(path).convert('RGBA')
    region = images[path].crop((x, y, x+w, y+h))
    return {'pixelSha256': sha(region.tobytes()), 'nontransparentPixels': sum(a > 0 for a in region.getchannel('A').getdata()), 'size': [w, h]}
frames = []
for key in before['frames']:
    old, new = pixels(args.baseline, before, key), pixels(ROOT, after, key)
    assert old['size'] == new['size'], key
    assert new['nontransparentPixels'] > 0, key
    frames.append({'key': key, 'before': old, 'after': new, 'pixelsChanged': old['pixelSha256'] != new['pixelSha256']})
ui = []
for key in before['ui']:
    old, new = [Image.open(base / 'public' / registry['ui'][key]).convert('RGBA') for base, registry in [(args.baseline, before), (ROOT, after)]]
    assert old.size == new.size, key
    ui.append({'key': key, 'size': list(new.size), 'pixelsChanged': sha(old.tobytes()) != sha(new.tobytes()), 'sha256': sha((ROOT / 'public' / after['ui'][key]).read_bytes())})
def tree(base, group):
    return {str(p.relative_to(base/group)): sha(p.read_bytes()) for p in (base/group).rglob('*') if p.is_file()}
unchanged = {}
for group in ['src/core', 'src/content', 'mods']:
    old, new = tree(args.baseline, group), tree(ROOT, group)
    assert old == new, group
    unchanged[group] = {'files': len(new), 'allBytesExactV302': True}
report = {'version': 303, 'baseline': str(args.baseline), 'counts': {k: len(v) for k,v in after.items()}, 'frames': frames, 'all1266FrameKeysAndDimensionsPreserved': True, 'changedFramePixels': sum(row['pixelsChanged'] for row in frames), 'unchangedFrameKeys': [row['key'] for row in frames if not row['pixelsChanged']], 'ui': ui, 'all26UIPixelsChanged': all(row['pixelsChanged'] for row in ui), 'poseDefinitionsUnchanged': before['chars'] == after['chars'] and before['anims'] == after['anims'], 'unchanged': unchanged, 'loadedSheetURLs': sorted(after['sheets'].values()), 'note': 'Read-only RGBA crop comparisons measure changed pixels, not artistic quality. All source contacts and actual native scenes are reviewed separately.'}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({k: report[k] for k in ['version','counts','changedFramePixels','unchangedFrameKeys','all26UIPixelsChanged','unchanged']}, ensure_ascii=False))
