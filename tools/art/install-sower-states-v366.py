"""Register parent-authorized full-body fallback rectangles, retaining Native review limits."""
from pathlib import Path
import argparse, hashlib, importlib.util, json, shutil

ROOT = Path(__file__).resolve().parents[2]
STAGE = ROOT.parent / '.ashveil-planned'
ARCHIVE = ROOT / 'tools/art/direction-v364'
module = importlib.util.spec_from_file_location('sower_base', ROOT / 'tools/art/install-sower-rig-v364.py')
base = importlib.util.module_from_spec(module)
module.loader.exec_module(base)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    stage = STAGE / 'v352-sower-state-art'
    left_stage = STAGE / 'v366-sower-left-collapsed'
    fragment = base.read(stage / 'sprites.fragment.json')
    partial = base.read(stage / 'sower.states.partial.json')
    candidates = base.read(stage / 'candidate-crops.json')
    transforms = dict(partial['frameTransforms'])
    motions = json.loads(json.dumps(partial['motions']))
    attack = json.loads(json.dumps(partial['attack']))
    originals, by_action = [], {}
    for source in candidates['sources']:
        action = source['action']
        by_action[action] = source
        sheet = 'av352_sower_' + action + '_v1'
        filename = Path(source['source']).name
        url = 'sprites/original/direction-v364/states/' + filename
        fragment['sheets'][sheet] = url
        originals.append(base.copy_original(stage / 'originals' / filename, ROOT / 'public' / url,
                                            source['dimensions'], source['sha256'], args.write))
    left = sorted((x for x in by_action['fall']['candidates'] if x['direction'] == 'left'), key=lambda x: x['phase'])
    motions['fall']['left'] = []
    for row in left[:3]:
        assert not row['foreignMainComponentPixels'] and not row['cropBorderAlpha16Pixels'] and not row['canvasEdgeTouched']
        key = 'av364_sower_fall_left' + str(row['phase'])
        fragment['frames'][key] = ['av352_sower_fall_v1', *row['crop']]
        transforms[key] = {'anchor': row['anchor'], 'scale': partial['clipScales']['fall']}
        motions['fall']['left'].append(key)

    collapsed = base.read(left_stage / 'frame-candidate.json')
    assert collapsed['sourceCrop'] == [189, 364, 935, 613] and collapsed['groundPivotCrop'] == [471, 600]
    sheet, key = 'av366_sower_left_collapsed_v1', 'av366_sower_left_collapsed'
    fragment['sheets'][sheet] = 'sprites/original/direction-v364/states/sower-left-collapsed-v1.png'
    fragment['sheetSizes'][sheet] = collapsed['sourceSize']
    fragment['frames'][key] = [sheet, *collapsed['sourceCrop']]
    transforms[key] = {'anchor': [471 / 935, 600 / 613], 'scale': .055}
    motions['fall']['left'].append(key)
    originals.append(base.copy_original(left_stage / collapsed['original'], ROOT / 'public' / fragment['sheets'][sheet],
                                        collapsed['sourceSize'], '3f5a479080c89252cb22c0fd69090c48e41cb3e7807a3437abc77dd3d2ca89e2', args.write))

    # Parent explicitly requests exact nearest crops for isolated Native evaluation.
    # Resource registration is not automatic visual acceptance of the narrow spacing.
    right = sorted((x for x in by_action['attack']['candidates'] if x['direction'] == 'right'), key=lambda x: x['phase'])
    attack['right'] = []
    right_receipt = []
    trials = base.read(stage / 'attack-right-margin-trials.json')
    for row in right:
        x, y, width, height = row['bodyBounds']
        crop = [x - 1, y - 1, width + 2, height + 2]
        if row['phase'] in (1, 2):
            evidence = next(x for x in trials['frames'] if x['key'] == row['key'])
            one = next(x for x in evidence['marginTrials'] if x['padding'] == 1)
            assert not one['foreignPixels'] and one['alpha16BorderPixels'] == 0
        else:
            assert not row['foreignMainComponentPixels'] and row['cropBorderAlpha16Pixels'] == 0
        ground = row['groundSource']
        key = 'av364_sower_attack_right' + str(row['phase'])
        fragment['frames'][key] = ['av352_sower_attack_v1', *crop]
        transforms[key] = {'anchor': [(ground[0] - crop[0]) / crop[2], (ground[1] - crop[1]) / crop[3]],
                           'scale': partial['clipScales']['attack']}
        attack['right'].append(key)
        right_receipt.append({'frame': key, 'historicalHeldCandidate': row['key'], 'crop': crop,
                              'sourceGroundUnchanged': ground, 'padding': 1,
                              'status': 'pending-parent-native-acceptance', 'wideSpacingRequestMet': False})
    clips = {'attack': attack, **motions}
    assert len(fragment['frames']) == 64
    assert len(transforms) == 64
    for action, directions in clips.items():
        assert set(directions) == set(base.DIRS), action
        assert all(len(keys) == 4 and len(set(keys)) == 4 for keys in directions.values()), action
    assert 'av352_sower_fall_left3' not in fragment['frames']

    manifest_path = ROOT / 'src/client/sprites.json'
    before = manifest_path.read_bytes().decode('utf8')
    old_values = base.previous_values(before)
    after = before
    for section in ('sheets', 'sheetSizes', 'frames'):
        after = base.add_entries(after, section, fragment[section])
    top, _ = base.members(after)
    chars, _ = base.members(after, top['chars'][0])
    assert 'av331_sower' in chars, 'Install base rig registration first'
    char_begin = chars['av331_sower'][0]
    fields, _ = base.members(after, char_begin)
    after = base.add_entries_at(after, fields['frameTransforms'][0], transforms)
    after = base.add_entries_at(after, char_begin, {'attack': attack, 'motions': motions})
    current = base.previous_values(after)
    for section, rows in old_values.items():
        for name, value in rows.items():
            if (section, name) != ('chars', 'av331_sower'):
                assert current[section][name] == value, (section, name)
    registered = json.loads(after)['chars']['av331_sower']
    old = json.loads(before)['chars']['av331_sower']
    for field, value in old.items():
        if field not in ('frameTransforms', 'attack', 'motions'):
            assert registered[field] == value, field
    assert all(registered['frameTransforms'][key] == value for key, value in old['frameTransforms'].items())
    receipt = {'version': 366, 'status': 'registered-for-parent-native-review-not-release-acceptance',
               'releaseApproved': False, 'coreOrRegionActivation': False, 'originals': originals,
               'fullBodyStateRegions': 64, 'sourceV352RegionsReused': 63, 'sourceV366Regions': 1,
               'newAuthoredWalkFrames': 0, 'clips': clips, 'rasterChanges': False,
               'historicalStagingFlagsModified': False, 'previousNonSowerValueBytesPreserved': True,
               'excludedOriginalLeftFall3': 'av352_sower_fall_left3',
               'rightAttack': right_receipt,
               'leftFallEndpoint': {'frame': 'av366_sower_left_collapsed', 'sourceSHA256': originals[-1]['sha256'],
                                    'crop': collapsed['sourceCrop'], 'groundPivotCrop': [471, 600], 'scale': .055,
                                    'status': 'parent-source-reviewed-pending-actual-tank-scale-comparison',
                                    'producerExampleScale': collapsed['displayScaleExampleOnly'],
                                    'compositionWidthRequestFailed': True},
               'durations': 'Existing controller defaults retained; producer proposals preserved, no TU/cadence override.',
               'limits': ['Parent source review selected the left endpoint and authorized held0..2 reuse.',
                          'Right attack has actual1px bounds gap; no source body overlap. Nearest safe1px crops remain pending Native acceptance.',
                          'Nominal ground anchors are not observations of every physical foot contact.',
                          'No artbook, GPU/browser game, Main build, Core/Def or publication changes by installer.']}
    if args.check:
        assert after == before, 'Resource registration differs'
        assert all((ROOT / row['path']).is_file() for row in originals)
    if args.write:
        for folder in ('v352-sower-state-art', 'v366-sower-left-collapsed'):
            source = STAGE / folder
            for file in sorted(source.rglob('*')):
                if not file.is_file() or not (file.suffix == '.json' or file.name == 'README.md' or file.name.endswith('.prompt.txt')):
                    continue
                target = ARCHIVE / 'history' / folder / file.relative_to(source)
                if target.exists():
                    assert target.read_bytes() == file.read_bytes(), target
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(file, target)
        manifest_path.write_bytes(after.encode('utf8'))
        (ARCHIVE / 'states.fragment.json').write_text(json.dumps(fragment, ensure_ascii=False, indent=2) + '\n')
        (ARCHIVE / 'state-installation.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'mode': 'write' if args.write else 'check' if args.check else 'plan', 'stateRegions': 64,
                      'originalPNGs': 5, 'nonSowerEntriesUnchanged': True,
                      'rightAttack': 'pending-parent-native-acceptance', 'manifestChanged': after != before}))


if __name__ == '__main__':
    main()
