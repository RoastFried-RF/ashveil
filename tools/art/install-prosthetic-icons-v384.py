"""Install six reviewed prosthetic item icons from unchanged original PNG bytes."""
from pathlib import Path
import argparse
import hashlib
import json
import runpy
import shutil
import struct

ROOT = Path(__file__).resolve().parents[2]
ARCHIVE = ROOT / 'tools/art/direction-v384'
HISTORY = ARCHIVE / 'history/v384-prosthetic-icons'
STAGING = ROOT.parent / '.ashveil-planned/v384-prosthetic-mounts'
MANIFEST = ROOT / 'src/client/sprites.json'
PATCH = ROOT / 'src/content/core/patches/zzz-prosthetic-icons-v384.json'
SOURCES = {
    'prosthetic-objects-v1.png': ('2f3ec151ad95be18ca46dfc7e2794b1d8b1239b192c98fa5f35f7d3a96685332', (1536, 1024), 2012274),
    'prosthetic-leg-pioneer-v2.png': ('64b83b162a71bbc6cc56331a057e7f79b70379d694a420eb1bfc5f81a8294b46', (1774, 887), 867928),
}
# Reuse the existing reviewed JSON-member append implementation without running its main.
UTILITY = runpy.run_path(str(ROOT / 'tools/art/install-culler-icons-v380.py'))
previous_values = UTILITY['previous_values']
append_entries = UTILITY['append_entries']


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read(path):
    return json.loads(path.read_bytes())


def encoded(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()


def exact_copy(source, target, write):
    data = source.read_bytes()
    if target.exists():
        assert target.read_bytes() == data, ('Different historical/original bytes', target)
    elif write:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    return {'path': str(target.relative_to(ROOT)), 'bytes': len(data), 'sha256': digest(data)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument('--write', action='store_true')
    modes.add_argument('--check', action='store_true')
    parser.add_argument('--source-dir', type=Path, default=HISTORY if HISTORY.is_dir() else STAGING)
    args = parser.parse_args()
    source = args.source_dir.resolve()
    assert source != ARCHIVE and source not in ARCHIVE.parents
    layout = read(source / 'contracts/selected-prosthetic-art.json')
    proposal = read(source / 'contracts/inventory-registration-proposal.json')
    patch = read(source / 'contracts/item-sprites-v384.patch.json')
    history_plan = read(source / 'records/installation-history-files.json')
    assert layout['selectedOriginalObjects'] == len(layout['items']) == 6
    assert layout['initialOriginalObjects'] == 6 and layout['correctiveOriginalObjects'] == 2
    assert layout['totalImageCalls'] == 2 and layout['automaticRegeneration'] == 0
    assert layout['pixelsEdited'] == layout['newAuthoredHumanCharacters'] == layout['newAnimationFrames'] == 0
    assert not layout['active'] and not layout['releaseApproved'] and not layout['cropUnionPipeline']
    for name, (sha, size, count) in SOURCES.items():
        data = (source / 'originals' / name).read_bytes()
        assert digest(data) == sha and len(data) == count
        assert data[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', data[16:24]) == size
        assert data[24:26] == bytes((8, 6)), 'Original must remain RGBA8'
    for stem in ['prosthetic-objects-v1', 'prosthetic-leg-pioneer-v2']:
        prompt = (source / 'requests' / (stem + '.prompt.txt')).read_text()
        request = read(source / 'requests' / (stem + '.request.json'))
        assert request['prompt'] == prompt and request['transparent_background'] is True
    expected_patch = [{'op': 'replace', 'target': row['item'], 'path': '/sprite', 'value': row['proposedSprite']} for row in layout['items']]
    assert patch == expected_patch and len({p['target'] for p in patch}) == 6
    fragment = {key: proposal[key] for key in ['sheets', 'sheetSizes', 'frames']}
    assert len(fragment['sheets']) == len(fragment['sheetSizes']) == 2 and len(fragment['frames']) == 6
    assert proposal['chars'] == proposal['anims'] == {} and not proposal['active']
    for row in layout['items']:
        frame = fragment['frames'][row['proposedSprite']]
        assert frame[1:] == row['sourceRect']
        width, height = fragment['sheetSizes'][frame[0]]
        x, y, w, h = frame[1:]
        assert 0 <= x < x + w <= width and 0 <= y < y + h <= height
        assert row['sourceAnalysis']['mainAlpha16OutsideFrame'] == 0
        assert row['sourceAnalysis']['otherMajorAlpha16InsideFrame'] == 0
        assert not row['active'] and not row['wornFitAccepted']
    before_bytes = MANIFEST.read_bytes()
    before = before_bytes.decode()
    prior, after = previous_values(before), before
    for section, entries in fragment.items():
        after = append_entries(after, section, entries)
    installed = previous_values(after)
    assert set(prior) == set(installed)
    projected = {section: {key: installed[section][key] for key in rows} for section, rows in prior.items()}
    assert projected == prior, 'Every prior registry value byte must survive'
    old, current = json.loads(before), json.loads(after)
    assert current['chars'] == old['chars'] and current['anims'] == old['anims']
    history = []
    for row in history_plan['files']:
        original = source / row['path']
        assert digest(original.read_bytes()) == row['sha256'] and original.stat().st_size == row['bytes']
        history.append(exact_copy(original, HISTORY / row['path'], args.write))
    history.append(exact_copy(source / 'records/installation-history-files.json', HISTORY / 'records/installation-history-files.json', args.write))
    public = [exact_copy(source / 'originals' / name, ROOT / 'public/sprites/original/direction-v384' / name, args.write) for name in SOURCES]
    patch_bytes = encoded(patch)
    if PATCH.exists():
        assert PATCH.read_bytes() == patch_bytes, 'Sprite patch changed; do not overwrite'
    receipt_path = ARCHIVE / 'installation.json'
    fragment_path = ARCHIVE / 'sprites.fragment.json'
    receipt = {
        'version': 384, 'status': 'six-inventory-icons-registered-awaiting-parent-native',
        'resourceRegistrationCompleted': True, 'nativeItemIconAcceptance': 'pending-parent-native',
        'parentDirectlyReviewedInitialAndCorrectedOriginals': True,
        'generation': {'calls': 2, 'initialCalls': 1, 'manualCorrectionAfterParentReview': 1, 'automaticRegeneration': 0},
        'originalPNGs': public, 'initialAuthoredObjects': 6, 'correctiveAuthoredObjects': 2,
        'selectedUniqueObjects': 6, 'authoredObjectViewsEach': 1, 'newChars': 0, 'newAnims': 0,
        'registeredFrames': fragment['frames'], 'itemSprites': {row['item']: row['proposedSprite'] for row in layout['items']},
        'spriteOnlyPatch': {'path': str(PATCH.relative_to(ROOT)), 'sha256': digest(patch_bytes)},
        'allPriorRegistryValueBytesPreserved': True,
        'priorRawValueDigest': digest(encoded(prior)), 'afterProjectionRawValueDigest': digest(encoded(projected)),
        'manifestSHA256BeforeInstall': digest(before_bytes), 'manifestSHA256AfterInstall': digest(after.encode()),
        'historyFiles': history, 'historicalCandidateFlagsChanged': False,
        'PNGReencodings': 0, 'pixelEdits': 0, 'alphaErasure': 0, 'cropUnionsOrMasks': 0,
        'scope': 'Inventory icons only. No body-mounted prosthetic acceptance, human renderer, anatomy, stats, treatment, hands, power, or Core changes.',
        'limits': ['One authored oblique view per selected object, not four facings or prosthetic animation.',
                   'First leg/forearm overlap failure preserved; selected corrected2objects use clean independent rectangular crops.',
                   'Original low-alpha fringe retained; atlas alpha1 is not uniformly pristine.',
                   'Actual in-game icon UI acceptance belongs to parent Native review.'],
        'bodyMountedAccepted': False, 'releaseApproved': False,
        'validationScope': 'Installer write/check and six resolved Def/sprite checks only; no build, game, full tests or push.'}
    if receipt_path.exists():
        saved = read(receipt_path)
        assert saved['registeredFrames'] == fragment['frames'] and saved['itemSprites'] == receipt['itemSprites']
        assert saved['originalPNGs'] == public and saved['historyFiles'] == history
        assert saved['priorRawValueDigest'] == saved['afterProjectionRawValueDigest']
        assert saved['spriteOnlyPatch'] == receipt['spriteOnlyPatch']
    if args.check:
        assert after == before and PATCH.read_bytes() == patch_bytes
        assert receipt_path.is_file() and fragment_path.read_bytes() == encoded(fragment)
        assert all((ROOT / row['path']).is_file() for row in public + history)
    if args.write:
        ARCHIVE.mkdir(parents=True, exist_ok=True)
        assert MANIFEST.read_bytes() == before_bytes, 'Concurrent registry write; retry safely'
        if after != before:
            MANIFEST.write_bytes(after.encode())
        if not PATCH.exists():
            PATCH.parent.mkdir(parents=True, exist_ok=True)
            PATCH.write_bytes(patch_bytes)
        if not fragment_path.exists():
            fragment_path.write_bytes(encoded(fragment))
        if not receipt_path.exists():
            receipt_path.write_bytes(encoded(receipt))
    print(json.dumps({'mode': 'write' if args.write else 'check' if args.check else 'plan',
                      'manifestChanged': after != before, 'priorValueBytesPreserved': True,
                      'sheets': 2, 'frames': 6, 'spriteOnlyItemPatch': 6,
                      'newChars': 0, 'newAnims': 0, 'historyFiles': len(history),
                      'bodyMountedAccepted': False, 'nativeIconAcceptance': 'pending-parent'}))


if __name__ == '__main__':
    main()
