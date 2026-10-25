"""Append four untouched Ashmoth source regions for parent Native review only."""
from pathlib import Path
import argparse
import hashlib
import json
import math
import shutil
import struct

ROOT = Path(__file__).resolve().parents[2]
PLANNED = ROOT.parent / '.ashveil-planned'
ARCHIVE = ROOT / 'tools/art/direction-v370'
HISTORY = ARCHIVE / 'history'
PUBLIC = ROOT / 'public/sprites/original/direction-v370/ashmoth-flight-four-poses-v1.png'
MANIFEST = ROOT / 'src/client/sprites.json'
SOURCE_SHA = '63ff12331193b3cff2410d6bdf006db64d59ce925c848209fbbeea1f69299215'
PREVIOUS_SHA = 'db25f3789ef04f4a76696111bc49e06b11014707975b60c6a5c0051d91dfeb74'
ORDER = ('raised', 'spread', 'downstroke', 'folded')
SHEET = 'av370_ashmoth_flight_v1'
ANIM = 'av370_ashmoth_flight'


def read(path):
    return json.loads(path.read_bytes())


def digest(data):
    return hashlib.sha256(data).hexdigest()


def members(text, start=0):
    """Locate exact JSON value slices; no pre-existing value is reserialized."""
    decoder = json.JSONDecoder()
    found, pos = {}, start + 1
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


def append_entries(text, section, entries):
    top, _ = members(text)
    current, close = members(text, top[section][0])
    incoming = {}
    for key, value in entries.items():
        if key in current:
            a, b = current[key]
            assert json.loads(text[a:b]) == value, ('Refuse to replace existing value', section, key)
        else:
            incoming[key] = value
    if not incoming:
        return text
    pos = close
    while text[pos - 1].isspace():
        pos -= 1
    encoded = json.dumps(incoming, ensure_ascii=False, indent=2)[2:-2]
    encoded = '\n'.join('  ' + line for line in encoded.splitlines())
    return text[:pos] + (',' if current else '') + '\n' + encoded + text[pos:]


def existing_values(text):
    top, _ = members(text)
    return {section: {key: text[a:b] for key, (a, b) in members(text, top[section][0])[0].items()}
            for section in ('sheets', 'sheetSizes', 'frames', 'anims', 'chars', 'ui')}


def unchanged_copy(source, target, write):
    data = source.read_bytes()
    if target.exists():
        assert target.read_bytes() == data, ('Different original/history bytes already exist', target)
    elif write:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    return {'path': str(target.relative_to(ROOT)), 'bytes': len(data), 'sha256': digest(data)}


def source_folder(name):
    archived = HISTORY / name
    return archived if archived.is_dir() else PLANNED / name


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    parser.add_argument('--source-dir', type=Path, default=source_folder('v370-ashmoth-flight'))
    parser.add_argument('--previous-source-dir', type=Path, default=source_folder('v369-ashmoth-art'))
    args = parser.parse_args()
    poses = read(args.source_dir / 'flight-poses.json')
    provenance = read(args.source_dir / 'provenance.json')
    visual = read(args.source_dir / 'visual-review.json')
    previous = read(args.previous_source_dir / 'provenance.json')
    previous_handoff = read(args.previous_source_dir / 'handoff-contract.json')
    source = args.source_dir / poses['sourcePNG']
    data = source.read_bytes()
    assert digest(data) == poses['sourceSHA256'] == provenance['sha256'] == SOURCE_SHA
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    assert list(struct.unpack('>II', data[16:24])) == poses['sourceSize'] == [1254, 1254]
    assert len(data) == provenance['originalByteCount'] == 495665
    assert provenance['generationCalls'] == 1 and provenance['returnedPNGs'] == 1
    assert poses['authoredDirectionCount'] == 1 and poses['authoredUniquePoseCount'] == 4
    assert poses['poseOrder'] == list(ORDER)
    assert not poses['releaseAccepted'] and not visual['acceptance']['releaseAccepted']
    assert digest((args.previous_source_dir / previous['preservedOriginalPath']).read_bytes()) == previous['sha256'] == PREVIOUS_SHA
    assert previous['generationCalls'] == 1 and not previous_handoff['releaseAccepted']
    assert (args.source_dir / 'prompt.txt').read_text().rstrip('\n') == read(args.source_dir / 'generation-args.json')['prompt'].rstrip('\n')

    frames, anchors, selected = {}, {}, []
    for name in ORDER:
        pose, key = poses['poses'][name], 'av370_ashmoth_' + name
        x, y, width, height = pose['crop']
        assert all(isinstance(n, int) for n in pose['crop']) and x >= 0 and y >= 0 and width > 0 and height > 0
        assert x + width <= 1254 and y + height <= 1254
        cx, cy = pose['cropThoraxCenter']
        assert pose['sourceThoraxCenter'] == [x + cx, y + cy]
        anchor = pose['normalizedThoraxAnchor']
        assert anchor == [cx / width, cy / height]
        assert all(isinstance(n, (int, float)) and math.isfinite(n) and 0 <= n <= 1 for n in anchor)
        assert pose['alphaAtLeast8OmittedOutsideCrop'] == 0
        frames[key] = [SHEET, x, y, width, height]
        anchors[key] = anchor
        selected.append({'pose': name, 'frame': key, 'sourceCrop': pose['crop'],
                         'sourceThoraxCenter': pose['sourceThoraxCenter'], 'cropThoraxCenter': [cx, cy],
                         'normalizedThoraxAnchor': anchor, 'sourceRGBARegionSHA256Declared': pose['RGBARegionSHA256'],
                         'producerDeclaredAlpha8Omissions': 0,
                         'producerDeclaredAlpha1to7OutsideCrop': pose['alpha1to7OutsideCrop']})
    fragment = {'sheets': {SHEET: str(PUBLIC.relative_to(ROOT / 'public'))},
                'sheetSizes': {SHEET: [1254, 1254]}, 'frames': frames,
                'anims': {ANIM: {'frames': list(frames), 'fps': 20, 'anchors': anchors, 'renderScale': .012}}}
    before = MANIFEST.read_bytes().decode('utf8')
    prior = existing_values(before)
    after = before
    for section, entries in fragment.items():
        after = append_entries(after, section, entries)
    installed = existing_values(after)
    assert all(installed[section][key] == value for section, entries in prior.items() for key, value in entries.items())
    old, current = json.loads(before), json.loads(after)
    assert current['chars'] == old['chars']
    assert not any(key.startswith('av369_ashmoth') for key in current['frames'])

    history = []
    for folder, stage in [('v370-ashmoth-flight', args.source_dir), ('v369-ashmoth-art', args.previous_source_dir)]:
        assert stage.is_dir(), stage
        for file in sorted(stage.rglob('*')):
            if file.is_file() and '__pycache__' not in file.parts:
                record = unchanged_copy(file, HISTORY / folder / file.relative_to(stage), args.write)
                if args.check:
                    assert (ROOT / record['path']).is_file(), record['path']
                history.append(record)
    public_record = unchanged_copy(source, PUBLIC, args.write)
    raw_old = json.dumps(prior, ensure_ascii=False, separators=(',', ':')).encode('utf8')
    receipt = {'version': 370, 'status': 'registered-source-candidates-parent-native-review-pending',
               'resourceRegistrationCompleted': True, 'releaseApproved': False,
               'runtimeAnimationReviewedByInstaller': False, 'coreOrRendererActivatedByInstaller': False,
               'sourceOriginal': public_record, 'sourceHistory': 'tools/art/direction-v370/history/v370-ashmoth-flight',
               'sourceSHA256': SOURCE_SHA, 'authoredOriginalPNGs': 1, 'authoredUniquePoseRegions': 4,
               'authoredDirections': 1, 'authoredView': 'dorsal; head points to source top',
               'newCharEntries': 0, 'registeredFrames': list(frames), 'selectedRegions': selected,
               'animation': {ANIM: fragment['anims'][ANIM]}, 'configuredCycleMS': 200,
               'cycleMeaning': 'Parent20fps/four-pose runtime setting; source does not demonstrate smooth loop or physical3D wingbeat.',
               'bodyIconSharedSource': {'bodyFrame': 'av370_ashmoth_folded', 'iconFrame': 'av370_ashmoth_folded',
                                        'additionalAuthoredRegions': 0, 'additionalAliasFrames': 0},
               'generation': {'producerV370Calls': 1, 'installerCalls': 0, 'automaticRegenerations': 0,
                              'imageReferenceInputs': provenance['imageReferenceInputs'],
                              'prompt': 'history/v370-ashmoth-flight/prompt.txt',
                              'exactArguments': 'history/v370-ashmoth-flight/generation-args.json'},
               'historicalV369': {'sourceSHA256': PREVIOUS_SHA, 'producerCalls': previous['generationCalls'],
                                  'status': previous_handoff['status'], 'registeredSourceRegions': 0,
                                  'releaseAccepted': False, 'retainedOriginalAndRecords': True,
                                  'usedAsGenerationImageReference': False},
               'historicalStagingFlagsChanged': False, 'sourcePNGReencodings': 0,
               'pixelEdits': 0, 'alphaErasureOperations': 0, 'resamplingOperations': 0,
               'existingManifestValueBytesPreserved': True,
               'existingValueEntryCountAtInstall': sum(len(x) for x in prior.values()),
               'existingRawValueInventorySHA256AtInstall': digest(raw_old),
               'manifestSHA256BeforeInstall': digest(before.encode('utf8')),
               'manifestSHA256AfterInstall': digest(after.encode('utf8')),
               'historyFiles': history,
               'review': {'registrarIsAssetCreator': False, 'directlyOpened': str(source),
                          'method': 'view_image(detail=original)',
                          'visible': 'Four distinct head-up dorsal poses: raised V, lateral spread, backward/downstroke V and compact folded. Two antennae and charcoal thorax/segmented abdomen remain visible.',
                          'readBoundary': 'Source PNG plus poses/provenance/visual/alpha metadata read. Producer alpha/RGBA claims are not recomputed; no actual-game/native-scale/loop observation by registrar.'},
               'limitations': {'alpha8CropOmissionsDeclared': 0, 'meaningfulAlpha16InsectsIsolatedDeclared': True,
                               'alphaZeroContractPassed': False, 'alpha1RemnantsPreserved': True,
                               'alpha1CanvasEdgePixelsDeclared': visual['alphaReview']['canvasEdge']['nonzeroPixels'],
                               'alpha1CanvasEdgeMaxDeclared': visual['alphaReview']['canvasEdge']['maxAlpha'],
                               'spreadAlpha16CellWidthFraction': 532 / 627,
                               'downstrokeAlpha16CellWidthFraction': 392 / 627,
                               'requested60PercentWidthPassed': False,
                               'identicalBodyPixelsProven': False,
                               'physicalWingHingeObserved': False, 'onlyManualVisibleThoraxCenters': True,
                               'nativeSizeVisibilityAccepted': False,
                               'sourcePoseOrDrawnInsectCountIsWorldPopulationDensityHealth': False},
               'validationExecution': 'Parent owns --check/sprite validation/tests/build/game/Native; registrar only performs authorized source registration --write.'}
    fragment_bytes = (json.dumps(fragment, ensure_ascii=False, indent=2) + '\n').encode('utf8')
    receipt_path = ARCHIVE / 'installation.json'
    if receipt_path.exists():
        prior_receipt = read(receipt_path)
        assert prior_receipt['sourceSHA256'] == SOURCE_SHA and prior_receipt['animation'] == receipt['animation']
        assert prior_receipt['bodyIconSharedSource'] == receipt['bodyIconSharedSource']
    if args.check:
        assert after == before, 'Run --write to register the reviewed candidate fragment'
        assert PUBLIC.is_file() and (ARCHIVE / 'sprites.fragment.json').read_bytes() == fragment_bytes
        assert receipt_path.is_file(), 'Installation receipt missing'
    if args.write:
        ARCHIVE.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_bytes(after.encode('utf8'))
        (ARCHIVE / 'sprites.fragment.json').write_bytes(fragment_bytes)
        # Keep the original install-time before/after proof on idempotent replays.
        if not receipt_path.exists():
            receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'mode': 'write' if args.write else 'check' if args.check else 'plan',
                      'registeredOriginalPNGs': 1, 'authoredDirections': 1, 'uniquePoseRegions': 4,
                      'newCharacters': 0, 'frames': list(frames), 'animation': ANIM,
                      'manifestChanged': after != before, 'previousValuesUnchanged': True,
                      'releaseApproved': False, 'nativeReview': 'pending'}))


if __name__ == '__main__':
    main()
