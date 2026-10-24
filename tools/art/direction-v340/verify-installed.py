"""Read-only source-byte and exact source-region verification of the installed NPC batch."""
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
manifest = json.loads((ROOT / 'src/client/sprites.json').read_text())
character = manifest['chars']['av331_surveyor']
originals = []
errors = []
for name in ['surveyor-installation.json', 'materials-installation.json', 'goggles-installation.json']:
    for row in json.loads((HERE / name).read_text())['originals']:
        digest = hashlib.sha256((ROOT / row['destination']).read_bytes()).hexdigest()
        if digest != row['sha256']:
            errors.append('Changed original: ' + row['destination'])
        originals.append({'path': row['destination'], 'sha256': digest})
keys = {key for clip in [character['idle'], character['walk'], *character['motions'].values()] for frames in clip.values() for key in frames}
regions = {tuple(manifest['frames'][key]) for key in keys}
icons = ['av331_survey_lens', 'av331_antenna_wire', 'av331_light_leg_frame', 'av331_thermal_sensor', 'av341_optical_goggles']
if len(keys) != 96 or len(regions) != 96 or set(character['frameTransforms']) != keys:
    errors.append('Expected96unique body source regions and matching transforms')
if character['motions']['use'] != character['motions']['work']:
    errors.append('Flash posture is an explicitly shared clip')
if any(character['frameTransforms'][key].get('flipX') for key in keys):
    errors.append('Unreported mirror reuse')
if len(originals) != 10 or len({tuple(manifest['frames'][key]) for key in icons}) != 5:
    errors.append('Expected10original PNGs and5independent icon regions')
report = {'scope': 'Installed bytes/regions only; not visual or v1release approval', 'errors': errors, 'originalPNGs': len(originals), 'uniqueBodyRegions': len(regions), 'iconRegions': len(icons), 'distinctOriginalMotionFamilies': 6, 'sharedClip': {'use': 'work'}, 'mirroredNewBodyRegions': 0, 'originals': originals}
if len(sys.argv) > 1:
    Path(sys.argv[1]).write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False))
sys.exit(bool(errors))
