"""Append source rectangles/plain rig registration; never rasterize or rewrite historical entries."""
from pathlib import Path
import argparse, hashlib, json, shutil, struct, subprocess

ROOT = Path(__file__).resolve().parents[2]
STAGE = ROOT.parent / '.ashveil-planned'
ARCHIVE = ROOT / 'tools/art/direction-v364'
MANIFEST = ROOT / 'src/client/sprites.json'
DIRS = ('down', 'left', 'right', 'up')


def read(path):
    return json.loads(path.read_text())


def sha(data):
    return hashlib.sha256(data).hexdigest()


def members(text, start=0):
    """Retain exact value slices instead of reformatting the pre-existing manifest."""
    decoder = json.JSONDecoder()
    pos = start + 1
    found = {}
    while True:
        while text[pos].isspace() or text[pos] == ',':
            pos += 1
        if text[pos] == '}':
            return found, pos
        key, pos = decoder.raw_decode(text, pos)
        while text[pos].isspace():
            pos += 1
        assert text[pos] == ':'
        pos += 1
        while text[pos].isspace():
            pos += 1
        begin = pos
        _, pos = decoder.raw_decode(text, pos)
        found[key] = (begin, pos)


def add_entries_at(text, begin, entries, allow_extension=False):
    existing, close = members(text, begin)
    incoming = {}
    for key, value in entries.items():
        if key in existing:
            a, b = existing[key]
            actual = json.loads(text[a:b])
            def includes(expected, present):
                return (isinstance(present, dict) and all(k in present and includes(v, present[k]) for k, v in expected.items())
                        if isinstance(expected, dict) else expected == present)
            assert actual == value or allow_extension and includes(value, actual), ('Refuse to overwrite', key)
        else:
            incoming[key] = value
    if not incoming:
        return text
    pos = close
    while text[pos - 1].isspace():
        pos -= 1
    encoded = json.dumps(incoming, ensure_ascii=False, indent=2)[2:-2]
    encoded = '\n'.join('  ' + line for line in encoded.splitlines())
    return text[:pos] + (',' if existing else '') + '\n' + encoded + text[pos:]


def add_entries(text, section, entries, allow_extension=False):
    top, _ = members(text)
    return add_entries_at(text, top[section][0], entries, allow_extension)


def previous_values(text):
    top, _ = members(text)
    return {section: {key: text[a:b] for key, (a, b) in members(text, top[section][0])[0].items()}
            for section in ('sheets', 'frames', 'chars')}


def copy_original(source, target, size, expected_sha=None, write=False):
    data = source.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    assert list(struct.unpack('>II', data[16:24])) == list(size), source
    digest = sha(data)
    if expected_sha:
        assert digest == expected_sha, source
    if target.exists():
        assert target.read_bytes() == data, ('Never replace different source bytes', target)
    elif write:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    return {'source': str(source), 'path': str(target.relative_to(ROOT)), 'bytes': len(data),
            'sha256': digest, 'dimensions': size, 'byteCopyOnly': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    # This runs only the inert geometry extractor, not a Pixi/browser/gait simulation.
    extracted = json.loads(subprocess.check_output(
        ['node', '--import', 'tsx', 'tools/art/export-sower-rig-spec-v364.ts'], cwd=ROOT, text=True))
    fragment = extracted['fragment']
    originals = [copy_original(ROOT / row['source'], ROOT / row['path'], row['size'],
                               row['sha256'], args.write) for row in extracted['originals']]

    fallback_stage = STAGE / 'v335-garden-machine-art'
    fallback_source = read(fallback_stage / 'sprites.fragment.json')
    fallback = read(fallback_stage / 'partial-models.json')['models']['sower']
    idle, transforms = {}, {}
    fallback_sheet = 'av364_sower_fallback_idle_v335'
    fragment['sheets'][fallback_sheet] = 'sprites/original/direction-v364/fallback/sower-idle-v2.png'
    fragment['sheetSizes'][fallback_sheet] = fallback_source['sheetSizes']['av335_sower_idle_v2']
    originals.append(copy_original(fallback_stage / 'originals/sower-idle-v2.png',
                                  ROOT / 'public' / fragment['sheets'][fallback_sheet],
                                  fragment['sheetSizes'][fallback_sheet], write=args.write))
    for direction in DIRS:
        idle[direction] = []
        for historical in fallback['clips']['idle'][direction]:
            key = historical.replace('av335_sower_idle_', 'av364_sower_fallback_idle_')
            rect = fallback_source['frames'][historical]
            fragment['frames'][key] = [fallback_sheet, *rect[1:]]
            transforms[key] = fallback['frameTransforms'][historical]
            idle[direction].append(key)
    assert len(transforms) == 16

    icons = []
    for folder in ('v353-sower-material-icons', 'v365-sower-component-retry'):
        stage = STAGE / folder
        source = read(stage / 'sprites.fragment.json')
        for sheet, old_url in source['sheets'].items():
            url = 'sprites/original/direction-v364/icons/' + Path(old_url).name
            fragment['sheets'][sheet] = url
            fragment['sheetSizes'][sheet] = source['sheetSizes'][sheet]
            expected = (read(stage / 'install-plan.json')['sourceCopyAfterAcceptance']['sha256']
                        if folder.startswith('v353') else read(stage / 'source-icons.json')['sourceSha256'])
            originals.append(copy_original(stage / 'originals' / Path(url).name, ROOT / 'public' / url,
                                          source['sheetSizes'][sheet], expected, args.write))
        fragment['frames'].update(source['frames'])
        icons.extend(source['frames'])
    assert len(icons) == 5 and len(fragment['frames']) == 51 and len(originals) == 11
    # The source whole idle is fallback/portrait only. Actual movement is articulated.
    # Existing controller gait/durations remain defaults, with no TU/cadence override.
    character = {'walk': idle, 'idle': idle, 'anchor': [.5, 1], 'renderScale': .23,
                 'headOffset': 58, 'shadow': [23, 9], 'healthBarWidth': 30, 'heldItems': False,
                 'portrait': idle['down'][0], 'frameTransforms': transforms, 'rig': extracted['rig']}
    fragment['chars'] = {'av331_sower': character}

    before = MANIFEST.read_bytes().decode('utf8')
    old_values = previous_values(before)
    after = before
    for section in ('sheets', 'sheetSizes', 'frames', 'chars'):
        after = add_entries(after, section, fragment[section], allow_extension=section == 'chars')
    new_values = previous_values(after)
    for section, entries in old_values.items():
        assert all(new_values[section][key] == value for key, value in entries.items()), section
    manifest = json.loads(after)
    assert 'av364_sower_left_work_chassis3' not in manifest['frames']
    assert 'av364_sower_right_work_chassis3' not in manifest['frames']
    for direction in ('left', 'right'):
        work = character['rig']['directions'][direction]['work']
        assert work[3] == work[0]

    receipt = {'version': 364, 'status': 'resource-registration-only-awaits-parent-native-integration',
               'releaseApproved': False, 'coreOrRegionActivatedByThisTool': False,
               'calibrationSource': extracted['calibrationSource'], 'originals': originals,
               'selectedRigSourcePNGs': 8, 'uniqueRigRegions': 30,
               'rigBaseRegions': 16, 'uniqueWorkRegions': 14, 'workRuntimeEntries': 16,
               'explicitReuse': {'left': [0, 1, 2, 0], 'right': [0, 1, 2, 0],
                                 'reason': 'Raw closed recovery3 clipped; reuse clean source0, not a new original.'},
               'excludedRawRegions': ['held_av361_sower_left_work_chassis3',
                                      'held_av361_sower_right_work_chassis3'],
               'existingWholeIdleFallbackRegions': 16, 'newAuthoredWalkFrames': 0,
               'walkFallback': 'Exact old v335 idle references; actual locomotion is the rig, not authored walk.',
               'icons': icons, 'iconRegions': 5, 'originalPNGsCopied': 11,
               'rasterChanges': False, 'historicalStagingFlagsModified': False,
               'existingManifestValueBytesPreserved': True,
               'sourceSelection': extracted['selections'],
               'limits': ['2.5D layouts are parent assumptions; all physical hip observations remain null.',
                          'No main game, GPU, Core, Region, browser, artbook or publication changes by installer.',
                          'v365 follows failed v363 zero-PNG attempt; retry metadata preserved separately.',
                          'v352 full-body states and v366 left-fall replacement are not accepted by this base registration.']}
    if args.check:
        assert after == before, 'Registration differs; run --write after reviewing the proposed source metadata'
        for row in originals:
            assert (ROOT / row['path']).is_file(), row['path']
    if args.write:
        ARCHIVE.mkdir(parents=True, exist_ok=True)
        # Keep source history byte-identical, including active:false and failed-attempt records.
        for folder in ('v335-garden-machine-art', 'v353-sower-material-icons',
                       'v365-sower-component-retry', 'v363-sower-harvest-components'):
            source = STAGE / folder
            if not source.exists():
                continue
            for file in sorted(source.rglob('*')):
                if not file.is_file() or not (file.suffix == '.json' or file.name == 'README.md' or file.name.endswith('.prompt.txt')):
                    continue
                target = ARCHIVE / 'history' / folder / file.relative_to(source)
                if target.exists():
                    assert target.read_bytes() == file.read_bytes(), target
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(file, target)
        MANIFEST.write_bytes(after.encode('utf8'))
        (ARCHIVE / 'sprites.fragment.json').write_text(json.dumps(fragment, ensure_ascii=False, indent=2) + '\n')
        (ARCHIVE / 'installation.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'mode': 'write' if args.write else 'check' if args.check else 'plan',
                      'rigRegions': 30, 'icons': 5, 'fallbackIdleRegions': 16,
                      'frames': len(fragment['frames']), 'originalPNGs': len(originals),
                      'previousValueBytesUnchanged': True, 'manifestChanged': after != before}))


if __name__ == '__main__':
    main()
