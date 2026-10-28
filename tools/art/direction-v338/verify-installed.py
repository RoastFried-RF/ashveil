"""Read-only verification of installed original bytes and exact crow registrations."""
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
manifest = json.loads((ROOT / 'src/client/sprites.json').read_text())
plan = json.loads((HERE / 'crow-installation.json').read_text())
errors = []
originals = []
for row in plan['originals']:
    path = ROOT / row['destination']
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != row['sha256']:
        errors.append('Original bytes changed: ' + row['destination'])
    originals.append({'path': row['destination'], 'sha256': digest})
character = manifest['chars'][plan['character']]
keys = set()
clips = {}
for name, block in [('idle', character['idle']), ('walk', character['walk']), ('attack', character['attack']), *character['motions'].items()]:
    counts = {direction: len(frames) for direction, frames in block.items()}
    if set(counts) != {'down', 'left', 'right', 'up'} or set(counts.values()) != {4}:
        errors.append('Incomplete four-direction original clip: ' + name)
    clips[name] = counts
    keys.update(key for frames in block.values() for key in frames)
regions = {tuple(manifest['frames'][key]) for key in keys}
if len(keys) != 144 or len(regions) != 144:
    errors.append('Expected 144 unique selected body regions')
if len(character['frameTransforms']) != 144 or set(character['frameTransforms']) != keys:
    errors.append('Body transforms do not cover exact original frames')
for key in keys:
    if character['frameTransforms'][key].get('flipX'):
        errors.append('Unreported mirror reuse: ' + key)
icon = manifest['frames']['av331_crow_feathers']
selected = {manifest['sheets'][manifest['frames'][key][0]] for key in keys}
selected.add(manifest['sheets'][icon[0]])
if selected != {row['destination'].removeprefix('public/') for row in plan['originals']}:
    errors.append('Selected sources differ from original installation plan')
request_count = 0
for directory in [HERE / 'crow-base', HERE / 'work', HERE / 'flight']:
    for request in (directory / 'requests').glob('*.json'):
        json.loads(request.read_text())
        request_count += 1
report = {'scope': 'Installed original SHA and exact body/icon registration only; not visual or release approval', 'errors': errors, 'originalPNGs': len(originals), 'bodyRegions': len(regions), 'iconRegions': 1, 'mirroredBodyRegions': 0, 'clips': clips, 'preservedRequestJSONs': request_count, 'originals': originals}
if len(sys.argv) > 1:
    Path(sys.argv[1]).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False))
sys.exit(bool(errors))
