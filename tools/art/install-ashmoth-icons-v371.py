"""Preserve one original PNG and append two symbolic Ashmoth item-icon regions."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import struct

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'tools/art/direction-v371'
HISTORY = ARCHIVE / 'history/v371-ashmoth-harvest-icons'
STAGING = ROOT.parent / '.ashveil-planned/v371-ashmoth-harvest-icons'
MANIFEST = ROOT / 'src/client/sprites.json'
PUBLIC = ROOT / 'public/sprites/original/direction-v371/ashmoth-harvest-icons-v1.png'
SOURCE_SHA = '3262d4adf9ef3f7babe0447e708a291b27dd349591daaa5cbda5f19f773ed0d9'
SHEET = 'av371_ashmoth_harvest_icons_v1'
CROPS = {'av371_moth_wing_dust': [245, 343, 454, 324],
         'av371_roasted_moths': [1080, 323, 445, 349]}


def read(path):
    return json.loads(path.read_bytes())


def digest(data):
    return hashlib.sha256(data).hexdigest()


def members(text, start=0):
    decoder, found, pos = json.JSONDecoder(), {}, start + 1
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
    existing, close = members(text, top[section][0])
    incoming = {}
    for key, value in entries.items():
        if key in existing:
            begin, end = existing[key]
            assert json.loads(text[begin:end]) == value, ('Refuse to overwrite existing value', section, key)
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


def previous_values(text):
    top, _ = members(text)
    return {section: {key: text[begin:end] for key, (begin, end) in members(text, top[section][0])[0].items()}
            for section in ('sheets', 'sheetSizes', 'frames', 'anims', 'chars', 'ui')}


def exact_copy(source, target, write):
    data = source.read_bytes()
    if target.exists():
        assert target.read_bytes() == data, ('Different original/history bytes already exist', target)
    elif write:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    return {'path': str(target.relative_to(ROOT)), 'bytes': len(data), 'sha256': digest(data)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    parser.add_argument('--source-dir', type=Path, default=HISTORY if HISTORY.is_dir() else STAGING)
    args = parser.parse_args()
    stage = args.source_dir
    proposals = read(stage / 'frame-proposals.json')
    provenance = read(stage / 'provenance.json')
    source = stage / 'originals/ashmoth-harvest-icons-v1.png'
    data = source.read_bytes()
    assert digest(data) == SOURCE_SHA
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    assert struct.unpack('>II', data[16:24]) == (1774, 887)
    # Final producer metadata, not a new alpha/pixel computation by this installer.
    assert proposals['sourceSHA256'] == provenance['sha256'] == SOURCE_SHA
    assert provenance['generationCalls'] == 1 and provenance['returnedPNGs'] == 1
    assert len(data) == provenance['sourceByteCount'] == 410455
    assert proposals['sourceSize'] == provenance['sourceSize'] == [1774, 887]
    assert not provenance['releaseAccepted']
    assert {key: row['cropXYWH'] for key, row in proposals['frames'].items()} == CROPS
    assert all(row['cropEdgeAlphaMaximum'] == 0 and row['omittedAlphaAtLeast8Pixels'] == 0
               for row in proposals['frames'].values())
    args_prompt = read(stage / 'generation-args.json')['prompt']
    assert (stage / 'prompt.txt').read_text().rstrip('\n') == args_prompt.rstrip('\n')

    fragment = {'sheets': {SHEET: str(PUBLIC.relative_to(ROOT / 'public'))},
                'sheetSizes': {SHEET: [1774, 887]},
                'frames': {key: [SHEET, *crop] for key, crop in CROPS.items()}}
    before = MANIFEST.read_bytes().decode('utf8')
    prior, after = previous_values(before), before
    for section, entries in fragment.items():
        after = append_entries(after, section, entries)
    installed = previous_values(after)
    assert all(installed[section][key] == value for section, rows in prior.items() for key, value in rows.items())
    old, current = json.loads(before), json.loads(after)
    assert current['chars'] == old['chars'] and current['anims'] == old['anims']

    history = []
    for file in sorted(stage.rglob('*')):
        if file.is_file() and '__pycache__' not in file.parts:
            record = exact_copy(file, HISTORY / file.relative_to(stage), args.write)
            if args.check:
                assert (ROOT / record['path']).is_file(), record['path']
            history.append(record)
    public_record = exact_copy(source, PUBLIC, args.write)
    receipt = {'version': 371, 'status': 'registered-item-icon-candidates-parent-native-review-pending',
               'resourceRegistrationCompleted': True, 'releaseApproved': False,
               'sourceOriginal': public_record, 'sourceSHA256': SOURCE_SHA,
               'authoredOriginalPNGs': 1, 'authoredUniqueRegions': 2,
               'registeredFrames': fragment['frames'], 'newCharEntries': 0, 'newAnimEntries': 0,
               'exactProducerProposals': proposals,
               'candidateLimitations': {'strictOriginalPromptContractPassed': False,
                                        'producerDeclaredCropBorderMaxAlpha': 0,
                                        'producerDeclaredCanvasNonzeroEdgePixels': 0,
                                        'producerDeclaredCenterClearGutterWidth': 148,
                                        'producerDeclaredAlpha8CropOmissions': 0,
                                        'producerDeclaredNeighborIconContamination': 0,
                                        'producerDeclaredMeaningfulSilhouettesWithin55Percent': True,
                                        'alpha1to7OutsideCropPreserved': {key: row['omittedAlpha1to7Pixels'] for key, row in proposals['frames'].items()},
                                        'backgroundEntirelyAlphaZero': False,
                                        'leftVessel': 'Thicker/deeper than the requested very shallow dish; coarse grains can look pebble-like at source size.',
                                        'rightContents': 'Only a few symbolic cooked moth bodies and some relatively whole large wings are painted; no literal count/weight claim.',
                                        'actual32And48PixelUIReviewedByRegistrar': False},
               'generation': {'producerCalls': 1, 'registrarCalls': 0,
                              'prompt': 'history/v371-ashmoth-harvest-icons/prompt.txt',
                              'arguments': 'history/v371-ashmoth-harvest-icons/generation-args.json'},
               'historicalStagingFlagsChanged': False,
               'sourcePNGReencodings': 0, 'pixelEdits': 0, 'resamplingOperations': 0, 'alphaErasureOperations': 0,
               'existingManifestValueBytesPreserved': True,
               'existingRawValueInventorySHA256AtInstall': digest(json.dumps(prior, ensure_ascii=False, separators=(',', ':')).encode('utf8')),
               'manifestSHA256BeforeInstall': digest(before.encode('utf8')),
               'manifestSHA256AfterInstall': digest(after.encode('utf8')),
               'historyFiles': history,
               'registrarReview': {'isAssetCreator': False, 'directlyOpened': str(STAGING / 'originals/ashmoth-harvest-icons-v1.png'),
                                   'method': 'view_image(detail=original)',
                                   'visible': 'Cool gray dry grains/wing flecks in a shallow chipped stone dish; separate warm brown wooden bowl with dry toasted segmented moth bodies/wing fragments. Distinct vessels, materials and contents.',
                                   'limits': 'Original viewed at source size only. Actual32/48px readability, inventory/rendering, cooking/harvest behavior and all source alpha metrics are parent/producer evidence, not registrar execution.'},
               'quantityBoundary': 'Symbolic portions; painted grains, fragments and insects do not encode one gram, fifty inputs, ten grams or item stock. Core/Def rules are parent-owned.',
               'validationExecution': 'Only authorized --write run by registrar. Parent owns --check, all tests/build/game/Native and final item-art acceptance.'}
    fragment_bytes = (json.dumps(fragment, ensure_ascii=False, indent=2) + '\n').encode('utf8')
    receipt_path = ARCHIVE / 'installation.json'
    if receipt_path.exists():
        previous = read(receipt_path)
        assert previous['sourceSHA256'] == SOURCE_SHA and previous['registeredFrames'] == fragment['frames']
    if args.check:
        assert after == before, 'Run --write to register the final source proposals'
        assert PUBLIC.is_file() and (ARCHIVE / 'sprites.fragment.json').read_bytes() == fragment_bytes
        assert receipt_path.is_file(), 'Installation receipt missing'
    if args.write:
        ARCHIVE.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_bytes(after.encode('utf8'))
        (ARCHIVE / 'sprites.fragment.json').write_bytes(fragment_bytes)
        if not receipt_path.exists():
            receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'mode': 'write' if args.write else 'check' if args.check else 'plan',
                      'originalPNGs': 1, 'uniqueRegions': 2, 'newChars': 0, 'newAnims': 0,
                      'frames': list(CROPS), 'manifestChanged': after != before,
                      'previousValuesUnchanged': True, 'releaseApproved': False}))


if __name__ == '__main__':
    main()
