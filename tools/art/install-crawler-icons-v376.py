"""Append six unchanged Crawler icon crops; preserve historical pending reviews verbatim."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import struct

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'tools/art/direction-v376'
HISTORY = ARCHIVE / 'history/v376-crawler-harvest-icons'
STAGING = ROOT.parent / '.ashveil-planned/v376-crawler-harvest-icons'
MANIFEST = ROOT / 'src/client/sprites.json'
PUBLIC = ROOT / 'public/sprites/original/direction-v376/crawler-harvest-icons-v1.png'
SOURCE_SHA = '32be48c2f616bd37511b0d09a703fdedf2c42b9f659fd30e2b01b97d45c0ed7b'
PROMPT_SHA = 'b9e6c5c579d1c0dd36d1abda4d753c259e3d2fd3ec329f9e88471f0d1715b3d7'
SHEET = 'av376_crawler_harvest_icons_v1'
CROPS = {
    'av376_crawler_venom_sac': [145, 93, 244, 393],
    'av376_crawler_plate': [584, 171, 364, 299],
    'av376_crawler_leg_segment': [1165, 75, 216, 413],
    'av376_crawler_raw_meat': [92, 606, 364, 309],
    'av376_crawler_roasted_meat': [589, 620, 359, 287],
    'av376_crawler_cuirass': [1101, 545, 328, 403],
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
    source = stage / 'originals/crawler-harvest-icons-v1.png'
    data = source.read_bytes()
    assert digest(data) == SOURCE_SHA and len(data) == 2009628
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    assert struct.unpack('>II', data[16:24]) == (1536, 1024)
    assert data[24:26] == bytes((8, 6)), 'Original must remain RGBA8'
    prompt = (stage / 'requests/exact-prompt.txt').read_bytes()
    request = read(stage / 'requests/crawler-harvest-icons-v1.json')
    assert digest(prompt) == PROMPT_SHA and request['prompt'].encode('utf8') == prompt
    assert request['transparent_background'] is True
    final = read(stage / 'art-final.json')
    proposals = read(stage / 'icons-review.json')
    budget = read(stage / 'records/call-budget.json')
    output = read(stage / 'records/tool-output.json')
    assert final['frozen'] and not final['active'] and not final['releaseAccepted']
    assert final['sourceSha256'] == proposals['sourceSha256'] == output['sourceSha256'] == SOURCE_SHA
    assert final['sourcePngs'] == budget['actualImagegenCalls'] == output['actualImagegenCalls'] == 1
    assert final['uniqueRawRegions'] == len(proposals['icons']) == 6
    assert budget['actualRegeneration'] == output['actualRegeneration'] == 0
    assert {row['iconKey']: row['crop'] for row in proposals['icons']} == CROPS
    assert len({row['cropRgbaSha256'] for row in proposals['icons']}) == 6
    for row in proposals['icons']:
        x, y, width, height = row['crop']
        assert 0 <= x < x + width <= 1536 and 0 <= y < y + height <= 1024
        assert row['thresholds']['1']['mainComponentPixelsOutsideCrop'] == 0
        assert all(row['thresholds']['16'][key] == 0 for key in (
            'mainComponentPixelsOutsideCrop', 'foreignMajorComponentPixels', 'rectBorderAlphaPixels'))

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
    expected_changes = {section: sorted(set(entries) - set(old[section])) for section, entries in fragment.items()}
    for section in old:
        if section not in fragment:
            assert current[section] == old[section], section
        else:
            assert set(current[section]) - set(old[section]) == set(expected_changes[section])
    assert current['chars'] == old['chars'] and current['anims'] == old['anims']

    # Preflight all history/public copies before any writes. Historical pending/held flags stay byte-identical.
    originals = []
    for file in sorted(stage.rglob('*')):
        if file.is_file() and '__pycache__' not in file.parts:
            originals.append((file, HISTORY / file.relative_to(stage)))
    for source_file, target_file in [*originals, (source, PUBLIC)]:
        exact_copy(source_file, target_file, False)
    history = [exact_copy(a, b, args.write) for a, b in originals]
    public_record = exact_copy(source, PUBLIC, args.write)
    fragment_bytes = encoded(fragment)
    fragment_path = ARCHIVE / 'sprites.fragment.json'
    receipt_path = ARCHIVE / 'installation.json'
    if fragment_path.exists():
        assert fragment_path.read_bytes() == fragment_bytes
    receipt = {
        'version': 376, 'status': 'registered-item-icon-candidates-awaits-parent-native-review',
        'resourceRegistrationCompleted': True, 'nativeItemIconAcceptance': 'pending-parent-native',
        'releaseApproved': False, 'sourceOriginal': public_record, 'sourceSHA256': SOURCE_SHA,
        'authoredOriginalPNGs': 1, 'authoredUniqueRegions': 6, 'registeredFrames': fragment['frames'],
        'registeredSheet': SHEET, 'newCharEntries': 0, 'newAnimEntries': 0,
        'generation': {'producerCalls': 1, 'additionalRegistrarCalls': 0,
                       'prompt': 'history/v376-crawler-harvest-icons/requests/exact-prompt.txt',
                       'promptSHA256': PROMPT_SHA,
                       'arguments': 'history/v376-crawler-harvest-icons/requests/crawler-harvest-icons-v1.json'},
        'existingManifestValueBytesPreserved': True,
        'existingRawValueInventorySHA256BeforeInstall': inventory_digest(prior),
        'existingRawValueInventorySHA256AfterInstallProjection': inventory_digest(projected),
        'previousRegistrySectionMemberCounts': {section: len(rows) for section, rows in prior.items()},
        'manifestSHA256BeforeInstall': digest(before_bytes),
        'manifestSHA256AfterInstall': digest(after.encode('utf8')),
        'registryChanges': expected_changes,
        'historyFiles': history, 'historicalStagingFlagsChanged': False,
        'sourcePNGReencodings': 0, 'pixelEdits': 0, 'resamplingOperations': 0, 'alphaErasureOperations': 0,
        'visualEvidence': {'producerSourceAnd24And32DisplayDirectlyViewed': True,
                           'mainGameInventoryReviewedByInstaller': False,
                           'producerRecord': 'history/v376-crawler-harvest-icons/visual-review.json'},
        'limits': ['All six regions exceed requested55percent source-cell extent along at least one axis.',
                   'Low-alpha residue remains:4834pixels outside six main components;4515outside crops;12canvas-edge pixels, all belowalpha16.',
                   'Declared crop alpha1 borders1/1/8/3/0/0 retain original source pixels; mainalpha16 loss/foreign/borders0.',
                   'Gland can read as flask at24px; exact biological identity/material/species needs item context.',
                   'Cuirass is an inventory icon only, not a wearable body/motion layer.',
                   'Core/Item/recipe/drop/food/venom/armor/native/release are parent integration responsibilities.'],
        'validationScope': 'Installer --write and read-only --check only; no shared build, game, Native, broad tests or push.',
        'checkSemantics': 'Each rerun verifies original/history bytes, exact six registrations, receipt, idempotence and raw preservation of every current prior registry value. Installation pre/post digests preserve the initial proof without forbidding later authorized registry changes.'}
    if receipt_path.exists():
        previous = read(receipt_path)
        assert previous['sourceSHA256'] == SOURCE_SHA and previous['registeredFrames'] == fragment['frames']
        assert previous['newCharEntries'] == previous['newAnimEntries'] == 0
        assert previous['existingRawValueInventorySHA256BeforeInstall'] == previous['existingRawValueInventorySHA256AfterInstallProjection']
        assert previous['sourceOriginal'] == public_record and previous['historyFiles'] == history
    if args.check:
        assert after == before, 'Registration differs; use --write after source review'
        assert PUBLIC.is_file() and fragment_path.read_bytes() == fragment_bytes
        assert receipt_path.is_file(), 'Installation receipt missing'
        assert all(target.is_file() for _, target in originals), 'Historical source copy missing'
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
                      'parentNativeAcceptance': 'pending'}))


if __name__ == '__main__':
    main()
