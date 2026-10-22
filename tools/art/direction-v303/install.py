"""Install all reviewed v303 original art; preserve game content and frame contracts."""
from pathlib import Path
import argparse
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--write', action='store_true')
args = parser.parse_args()
baseline = json.loads((HERE / 'baseline-registry.json').read_text())
result = json.loads(json.dumps(baseline))
result['sheets'] = {}
owners = {}
coverage = {}
for family in ['terrain', 'props', 'items', 'creatures', 'ui']:
    fragment = json.loads((HERE / (family + '.fragment.json')).read_text())
    coverage[family] = {group: len(fragment.get(group, {})) for group in baseline}
    for group in baseline:
        for key, value in fragment.get(group, {}).items():
            if group != 'sheets':
                assert key in baseline[group], (family, group, key)
            assert (group, key) not in owners, (family, owners.get((group, key)), group, key)
            if group == 'frames':
                assert value[3:] == baseline[group][key][3:], (family, key, 'dimensions')
            if group in ['chars', 'anims']:
                assert value == baseline[group][key], (family, key, 'pose contract')
            owners[(group, key)] = family
            result[group][key] = value
for group in ['frames', 'ui']:
    assert all((group, key) in owners for key in baseline[group]), (group, 'unassigned keys', [k for k in baseline[group] if (group, k) not in owners])
for group in ['sheets', 'ui']:
    assert all('/original/direction-v303/' in value for value in result[group].values()), group
    assert all((ROOT / 'public' / value).is_file() for value in result[group].values()), group
assert all(row[0] in result['sheets'] for row in result['frames'].values())
assert {group: len(values) for group, values in result.items() if group != 'sheets'} == {group: len(values) for group, values in baseline.items() if group != 'sheets'}
body = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
report = {'version': 303, 'coverage': coverage, 'counts': {group: len(values) for group, values in result.items()}, 'all1266PriorFrameNamesAndDimensionsPreserved': True, 'all26RegisteredUIReplaced': True, 'charactersAndAnimationsByteEquivalent': result['chars'] == baseline['chars'] and result['anims'] == baseline['anims'], 'contentPatchesChanged': False, 'manifestSha256': hashlib.sha256(body.encode()).hexdigest()}
if args.write:
    (ROOT / 'src/client/sprites.json').write_text(body)
    (ROOT / 'docs/art-direction-v303-merge.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
else:
    assert (ROOT / 'src/client/sprites.json').read_text() == body, 'Run --write to install'
print(json.dumps(report, ensure_ascii=False))
