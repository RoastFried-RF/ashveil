"""Append six unchanged Culler salvage icon regions; preserve historical source-only records."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import struct

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'tools/art/direction-v380'
HISTORY = ARCHIVE / 'history/v380-culler-harvest-icons'
STAGING = ROOT.parent / '.ashveil-planned/v380-culler-harvest-icons'
MANIFEST = ROOT / 'src/client/sprites.json'
PUBLIC = ROOT / 'public/sprites/original/direction-v380/culler-harvest-icons-v1.png'
SOURCE_SHA = 'b389c1be22914533bff7536ae62b2c1604ca407e879a19494721e703a3f1452d'
PROMPT_SHA = 'de620874273ecd865c16d3f24cde784dad3b49e3d8e6a8b5e6da713a70c2e33b'
SHEET = 'av380_culler_harvest_icons_v1'
CROPS = {
    'av380_culler_scythe_blade': [45, 27, 468, 471],
    'av380_culler_heart': [575, 77, 403, 395],
    'av380_culler_armor_plate': [1053, 41, 452, 449],
    'av380_culler_net_fiber': [29, 551, 489, 433],
    'av380_culler_purifier_tank': [539, 570, 491, 348],
    'av380_culler_glaive': [1030, 498, 495, 487],
}
ITEMS = {
    'Item.CullerScytheBlade': 'av380_culler_scythe_blade',
    'Item.CullerHeart': 'av380_culler_heart',
    'Item.CullerArmorPlate': 'av380_culler_armor_plate',
    'Item.CullerNetFiber': 'av380_culler_net_fiber',
    'Item.CullerPurifierTank': 'av380_culler_purifier_tank',
    'Item.CullerGlaive': 'av380_culler_glaive',
}


def read(path):
    return json.loads(path.read_bytes())

def digest(data):
    return hashlib.sha256(data).hexdigest()

def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf8')

def members(text, start=0):
    """Locate JSON member value slices without reserializing any previous value."""
    decoder, found, pos = json.JSONDecoder(), {}, start + 1
    assert text[start] == '{'
    while True:
        while text[pos].isspace() or text[pos] == ',':
            pos += 1
        if text[pos] == '}':
            return found, pos
        key, pos = decoder.raw_decode(text, pos)
        assert key not in found, ('Duplicate registry key', key)
        while text[pos].isspace():
            pos += 1
        assert text[pos] == ':'
        pos += 1
        while text[pos].isspace():
            pos += 1
        begin = pos
        _, pos = decoder.raw_decode(text, pos)
        found[key] = (begin, pos)

def previous_values(text):
    """Every previous registry section/member, including characterSheetHistory."""
    top, _ = members(text)
    values = {}
    for section, (begin, end) in top.items():
        if text[begin] == '{':
            values[section] = {key: text[a:b] for key, (a, b) in members(text, begin)[0].items()}
        else:
            values[section] = {'__whole_non_object_value__': text[begin:end]}
    return values

def append_entries(text, section, entries):
    top, _ = members(text)
    existing, close = members(text, top[section][0])
    incoming = {}
    for key, value in entries.items():
        if key in existing:
            begin, end = existing[key]
            assert json.loads(text[begin:end]) == value, ('Refuse to overwrite', section, key)
        else:
            incoming[key] = value
    if not incoming:
        return text
    pos = close
    while text[pos - 1].isspace():
        pos -= 1
    body = json.dumps(incoming, ensure_ascii=False, indent=2)[2:-2]
    body = '\n'.join('  ' + line for line in body.splitlines())
    return text[:pos] + (',' if existing else '') + '\n' + body + text[pos:]

def exact_copy(source, target, write):
    data = source.read_bytes()
    if target.exists():
        assert target.read_bytes() == data, ('Different source/history bytes already exist', target)
    elif write:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    return {'path': str(target.relative_to(ROOT)), 'bytes': len(data), 'sha256': digest(data)}

def inventory_digest(value):
    return digest(json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf8'))

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    parser.add_argument('--source-dir', type=Path, default=HISTORY if HISTORY.is_dir() else STAGING)
    args = parser.parse_args()
    stage = args.source_dir.resolve()
    assert stage not in ARCHIVE.parents and stage != ARCHIVE, 'History cannot contain its own archive'
    source = stage / 'originals/culler-harvest-icons-v1.png'
    data = source.read_bytes()
    assert digest(data) == SOURCE_SHA and len(data) == 2365557
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    assert struct.unpack('>II', data[16:24]) == (1536, 1024)
    assert data[24:26] == bytes((8, 6)), 'Original must remain RGBA8'
    prompt = (stage / 'requests/exact-prompt.txt').read_bytes()
    request = read(stage / 'requests/culler-harvest-icons-v1.json')
    assert digest(prompt) == PROMPT_SHA and request['prompt'].encode('utf8') == prompt
    assert request['transparent_background'] is True
    final = read(stage / 'art-final.json')
    proposals = read(stage / 'icons-review.json')
    budget = read(stage / 'records/call-budget.json')
    output = read(stage / 'records/tool-output.json')
    assert final['frozen'] and not final['active'] and not final['releaseAccepted']
    assert final['sourceSHA256'] == proposals['sourceSHA256'] == output['sourceSha256'] == SOURCE_SHA
    assert final['originalPNGs'] == budget['actualImagegenCalls'] == output['actualReturnedPNGs'] == 1
    assert final['uniqueSourceRegions'] == len(proposals['icons']) == 6
    assert budget['actualRegeneration'] == output['actualRegeneration'] == 0
    assert {row['iconKey']: row['crop'] for row in proposals['icons']} == CROPS
    assert {row['itemId']: row['iconKey'] for row in proposals['icons']} == ITEMS
    assert len({row['cropRgbaSHA256'] for row in proposals['icons']}) == 6
    omitted = {'av380_culler_armor_plate': 250, 'av380_culler_glaive': 336}
    for row in proposals['icons']:
        x, y, width, height = row['crop']
        assert 0 <= x < x + width <= 1536 and 0 <= y < y + height <= 1024
        assert row['thresholds']['1']['mainComponentPixelsOmittedByCrop'] == omitted.get(row['iconKey'], 0)
        assert row['thresholds']['1']['omittedMainMaxAlpha'] <= 2
        assert row['thresholds']['1']['foreignOtherIconMainComponentPixels'] == 0
        assert all(row['thresholds']['16'][key] == 0 for key in (
            'mainComponentPixelsOmittedByCrop', 'foreignOtherIconMainComponentPixels', 'cropBorderAlphaPixels'))

    fragment = {'sheets': {SHEET: str(PUBLIC.relative_to(ROOT / 'public'))},
                'sheetSizes': {SHEET: [1536, 1024]},
                'frames': {key: [SHEET, *crop] for key, crop in CROPS.items()}}
    assert read(stage / 'sprites.fragment.json') == fragment
    before_bytes = MANIFEST.read_bytes()
    before = before_bytes.decode('utf8')
    prior, after = previous_values(before), before
    for section, entries in fragment.items():
        after = append_entries(after, section, entries)
    installed = previous_values(after)
    assert set(prior) == set(installed), 'No registry sections may be added or removed'
    projected = {section: {key: installed[section][key] for key in rows} for section, rows in prior.items()}
    assert projected == prior, 'All previous registry value bytes must survive exactly'
    old, current = json.loads(before), json.loads(after)
    changes = {section: sorted(set(entries) - set(old[section])) for section, entries in fragment.items()}
    for section in old:
        if section not in fragment:
            assert current[section] == old[section], section
        else:
            assert set(current[section]) - set(old[section]) == set(changes[section])
    assert current['chars'] == old['chars'] and current['anims'] == old['anims']

    # Exact historical copies retain producer pending/held/active:false fields.
    originals = [(file, HISTORY / file.relative_to(stage)) for file in sorted(stage.rglob('*'))
                 if file.is_file() and '__pycache__' not in file.parts]
    for a, b in [*originals, (source, PUBLIC)]:
        exact_copy(a, b, False)
    history = [exact_copy(a, b, args.write) for a, b in originals]
    public_record = exact_copy(source, PUBLIC, args.write)
    fragment_bytes = encoded(fragment)
    fragment_path = ARCHIVE / 'sprites.fragment.json'
    receipt_path = ARCHIVE / 'installation.json'
    if fragment_path.exists():
        assert fragment_path.read_bytes() == fragment_bytes
    receipt = {
        'version': 380, 'status': 'registered-six-item-icon-regions-awaits-parent-native-review',
        'resourceRegistrationCompleted': True, 'nativeItemIconAcceptance': 'pending-parent-native',
        'releaseApproved': False, 'sourceOriginal': public_record, 'sourceSHA256': SOURCE_SHA,
        'authoredOriginalPNGs': 1, 'authoredUniqueRegions': 6, 'registeredSheet': SHEET,
        'registeredFrames': fragment['frames'], 'requestedItemFrameMapping': ITEMS,
        'newCharEntries': 0, 'newAnimEntries': 0,
        'parentSourceReview': {'parentDirectlyOpenedRawPNG': True,
                               'limited24PixelIconUseAccepted': True,
                               'acceptedWithLimits': ['alpha1-2crop fringe retained in original',
                                                     'thin dark glaive shaft at24px',
                                                     'two distinct leather grips not clearly shown'],
                               'actualGameIconNativeAcceptance': 'pending-parent-native',
                               'historicalProducerFlagsUnchanged': True},
        'registrySerialization': {'creatureAgentConfirmedV379RegistryWriteFinished': True,
                                  'message': 'v3794sheets24frames/av379_culler written; future work in culler-motion.ts; sprites.json released to av380 append',
                                  'existingCullerCharacterPreserved': True},
        'generation': {'producerCalls': 1, 'additionalRegistrarCalls': 0,
                       'prompt': 'history/v380-culler-harvest-icons/requests/exact-prompt.txt',
                       'promptSHA256': PROMPT_SHA,
                       'arguments': 'history/v380-culler-harvest-icons/requests/culler-harvest-icons-v1.json'},
        'existingManifestValueBytesPreserved': True,
        'existingRawValueInventorySHA256BeforeInstall': inventory_digest(prior),
        'existingRawValueInventorySHA256AfterInstallProjection': inventory_digest(projected),
        'previousRegistrySectionMemberCounts': {section: len(rows) for section, rows in prior.items()},
        'manifestSHA256BeforeInstall': digest(before_bytes),
        'manifestSHA256AfterInstall': digest(after.encode('utf8')),
        'registryChanges': changes, 'historyFiles': history,
        'historicalStagingFlagsChanged': False,
        'sourcePNGReencodings': 0, 'pixelEdits': 0, 'resamplingOperations': 0, 'alphaErasureOperations': 0,
        'fringeBoundary': {'armorFrameOmittedPixels': 250, 'glaiveFrameOmittedPixels': 336,
                           'omittedMaximumAlpha': 2, 'sourceWholePNGUnmodified': True,
                           'mainAlpha16Loss': 0, 'foreignOtherIconMainMix': 0,
                           'alpha16CropBorderPixels': 0,
                           'wholeAtlasStrictAlpha1Clean': False},
        'limits': ['Inventory icons only; no wearable body or weapon hand-pose artwork was authored.',
                   'Mounting eyes/fittings and proposed main/off shaft zones are graphical candidates, not verified runtime grips or3D pin axes.',
                   'Power/acid/net quantity and tank seal are not certified by pixels.',
                   'Parent owns actual Item/recipe/drop/Core/held-motion/Native integration and final icon acceptance.'],
        'validationScope': 'Installer --write and read-only --check only; no shared build, game, Native, broad tests or push.',
        'checkSemantics': 'Verify original/history bytes, exact six registrations, receipt, idempotence and preservation of every current prior raw registry value. Initial pre/post digests preserve install proof without forbidding future authorized registry changes.'}
    if receipt_path.exists():
        previous = read(receipt_path)
        assert previous['sourceSHA256'] == SOURCE_SHA and previous['registeredFrames'] == fragment['frames']
        assert previous['requestedItemFrameMapping'] == ITEMS
        assert previous['newCharEntries'] == previous['newAnimEntries'] == 0
        assert previous['existingRawValueInventorySHA256BeforeInstall'] == previous['existingRawValueInventorySHA256AfterInstallProjection']
        assert previous['sourceOriginal'] == public_record and previous['historyFiles'] == history
    if args.check:
        assert after == before, 'Registration differs; use --write after source review and registry coordination'
        assert PUBLIC.is_file() and fragment_path.read_bytes() == fragment_bytes
        assert receipt_path.is_file() and all(target.is_file() for _, target in originals)
    if args.write:
        ARCHIVE.mkdir(parents=True, exist_ok=True)
        assert MANIFEST.read_bytes() == before_bytes, 'Manifest changed concurrently; retry instead of overwriting'
        if after != before:
            MANIFEST.write_bytes(after.encode('utf8'))
        if not fragment_path.exists():
            fragment_path.write_bytes(fragment_bytes)
        if not receipt_path.exists():
            receipt_path.write_bytes(encoded(receipt))
    print(json.dumps({'mode': 'write' if args.write else 'check' if args.check else 'plan',
                      'sourceSHA256': SOURCE_SHA, 'originalPNGs': 1, 'uniqueRegions': 6,
                      'newChars': 0, 'newAnims': 0, 'frames': list(CROPS),
                      'manifestChanged': after != before, 'previousValueBytesPreserved': True,
                      'historyFiles': len(history), 'releaseApproved': False,
                      'parentSource24pxUse': 'accepted-with-documented-limits',
                      'parentGameNativeAcceptance': 'pending'}))


if __name__ == '__main__':
    main()
