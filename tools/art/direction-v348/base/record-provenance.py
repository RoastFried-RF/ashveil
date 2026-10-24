"""Record immutable generation inputs/bytes and read-only crop diagnostics."""
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

BASE = Path(__file__).parent
ORIGINS = {
    'cinder-bear-idle-v1': 'exec-cc8c85c2-0002-459c-9cfc-ce7786395097.png',
    'cinder-bear-walk-v1': 'exec-775dc37b-340d-4e43-9380-a86b53b9561a.png',
    'ash-crow-idle-v1': 'exec-6ff6b3c5-06d7-4c94-95ce-7d360f023195.png',
    'cinder-bear-swipe-v1': 'exec-050be45a-25f9-4b7b-b032-b97e7df03fc5.png',
    'cinder-bear-bite-v1': 'exec-b90d847d-4113-4b2a-945e-5e9b590a8280.png',
    'ash-crow-walk-v1': 'exec-933232fe-8f7c-48b5-9a6d-26734759c68f.png',
    'ash-crow-peck-v1': 'exec-a9145909-8255-4a92-8b9e-6346f30a4132.png',
    'cinder-bear-walk-v2': 'exec-d7f83cae-ec0a-4408-a1ad-ca596a2f24df.png',
    'cinder-bear-bite-v2': 'exec-996259a8-36c7-40c3-9865-52da9038b380.png',
    'cinder-bear-walk-v3': 'exec-9fbaa0a5-d807-46e4-9e4c-022ee328873c.png',
    'cinder-bear-walk-down-v1': 'exec-69850f8d-b8fe-4ef4-807d-52c91ee0591b.png',
    'cinder-bear-walk-left-v1': 'exec-563c085c-23da-4868-85c7-f50f3794756e.png',
    'cinder-bear-walk-right-v1': 'exec-81d500b1-616d-45a9-a22c-bd94183f5ca3.png',
    'cinder-bear-walk-up-v1': 'exec-57c39cec-85fe-4751-b8db-678a07fff192.png',
    'cinder-bear-swipe-v2': 'exec-5576e5bc-56a8-4bb5-921e-2e31dc891ef3.png',
    'cinder-bear-bite-v3': 'exec-7cb71104-d661-4f52-8737-c644fa5c4710.png',
    'ash-crow-hurt-v1': 'exec-1699b878-3a83-40d2-b9f5-41aff3034180.png',
    'ash-crow-fall-v1': 'exec-0a2d0cee-9e97-407c-87af-d20273e07099.png',
    'ash-crow-sleep-v1': 'exec-a6137b03-e805-43d6-a7e7-feb634cee6f8.png',
    'ash-crow-rise-v1': 'exec-7e1709bc-f22b-4e84-995f-86b5512b4ad8.png',
    'ash-crow-fall-down-v2': 'exec-00a6bf0d-0660-4966-b3b5-852141441912.png',
}
STATUS = {
    'ash-crow-idle-v1': ('accepted-basic', '4 directions and 4 genuinely distinct idle poses, two legs/folded wings/beak reviewed'),
    'ash-crow-walk-v1': ('accepted-basic', '4 directions and crouch/hop/landing/recover; two legs and two wings reviewed'),
    'ash-crow-peck-v1': ('accepted-basic', '4 directions and anticipation/low beak contact/follow-through/recover reviewed'),
    'cinder-bear-idle-v1': ('accepted-partial-model', '4 directions idle; heavy quadruped bear identity reviewed; model remains inactive'),
    'cinder-bear-swipe-v2': ('accepted-partial-model', '16 separated crops; forepaw windup/strike/crossing/recover; model remains inactive'),
    'cinder-bear-bite-v3': ('accepted-partial-model', '16 separated crops; low forward jaw/head trajectory and hidden back-facing muzzle; model remains inactive'),
    'cinder-bear-walk-down-v1': ('anatomy-pass-model-match-pending', 'front A/B supporting forepaws switch; body/fur proportions differ from idle and final cross-motion consistency remains pending'),
    'cinder-bear-walk-v1': ('held', 'same visible foreleg is extended in multiple contact poses; opposite support loop not established'),
    'cinder-bear-walk-v2': ('held', 'front third column still repeats first-column support and side alternation remains weak'),
    'cinder-bear-walk-v3': ('held', 'targeted third-column repair did not resolve front/side support; not used as a completed walk'),
    'cinder-bear-walk-left-v1': ('held', 'contact/pass A/B anatomical alternation is not sufficiently established, and body identity differs from idle; alpha background itself is transparent'),
    'cinder-bear-walk-right-v1': ('held', 'contact/pass A/B anatomical alternation is not sufficiently established, and body identity differs from idle; alpha background itself is transparent'),
    'cinder-bear-walk-up-v1': ('held', 'contact A/B swaps rear support, but both passing poses show the same lifted rear sole'),
    'cinder-bear-swipe-v1': ('superseded-held', 'right0/right1 rectangular crop contains neighboring silhouette pixels; replaced by wider-gutter v2'),
    'cinder-bear-bite-v1': ('held', 'upward roar rather than low forward bite; head turns sideways in front/back rows'),
    'cinder-bear-bite-v2': ('superseded-held', 'low bite anatomy improved but some left/right rectangular crops contain neighboring silhouette pixels; replaced by wider-gutter v3'),
    'ash-crow-hurt-v1': ('accepted-extended', '4 directions, recoil/wing flare/recovery; generated only after base idle/walk/attack passed source and staging review'),
    'ash-crow-fall-v1': ('partly-accepted-extended', 'left/right/up 12 poses accepted; front row changes to side-facing at final collapse, all 4 front cells excluded and replaced by directional front source'),
    'ash-crow-sleep-v1': ('accepted-extended', '4 directions, low tucked-head ground sleep and subtle distinct breathing/settling poses'),
    'ash-crow-rise-v1': ('accepted-extended', '4 directions, new tucked-head/waking/braced extension/standing poses; not reverse fall reuse'),
    'ash-crow-fall-down-v2': ('accepted-extended', '4 corrected front-facing buckling/braced/breast-down/inert poses; same top-bottom body axis preserved'),
}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

provenance = {
    'format': 1, 'date': '2026-10-24',
    'generator': 'image_gen.imagegen', 'modelVersion': None,
    'modelVersionNote': 'The tool did not expose a model/version identifier.',
    'pixelPolicy': 'Only image_gen produced new artwork. Original PNG bytes copied without edits. Pillow/NumPy/SciPy used only for read-only analysis and labelled diagnostic composites.',
    'externalGamePixelsUsed': False,
    'inspectedExistingOwnStyleReferences': [], 'candidates': {},
    'unsubmittedRequests': [{'path': 'requests/cinder-bear-walk-v4.json', 'reason': 'Prepared but not submitted; switched to per-direction 2x2 on parent instruction. No image was generated from this request.'}],
}
for ref in ['hound-locomotion-front-left.png', 'rat-locomotion-front-left.png']:
    path = Path('/workspace/ashveil/public/sprites/original/direction-v322') / ref
    provenance['inspectedExistingOwnStyleReferences'].append({'path': str(path), 'sha256': sha(path), 'toolInput': False})
for name, origin in ORIGINS.items():
    request = BASE / 'requests' / (name + '.json')
    original = BASE / 'originals' / (name + '.png')
    generated = Path('/workspace/generated_images') / origin
    args = json.loads(request.read_text())
    input_records = [{'path': p, 'sha256': sha(Path(p))} for p in args.get('referenced_image_paths', [])]
    status, reason = STATUS[name]
    with Image.open(original) as image:
        size, mode = list(image.size), image.mode
    provenance['candidates'][name] = {
        'request': str(request.relative_to(BASE)), 'requestSha256': sha(request),
        'exactArguments': args, 'inputImages': input_records,
        'original': str(original.relative_to(BASE)), 'originalSha256': sha(original),
        'toolOutputPath': str(generated), 'toolOutputSha256': sha(generated),
        'originalBytesPreserved': sha(original) == sha(generated),
        'size': size, 'mode': mode, 'status': status, 'reason': reason,
        'layout': '2x2 single direction' if any('-'+motion+'-'+direction+'-' in name for motion in ['walk','fall'] for direction in ['down','left','right','up']) else '4x4 front-left-right-back rows',
    }
(BASE / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')

# Analyze actual registration rectangles, without running project validators.
fragment = json.loads((BASE / 'sprites.fragment.json').read_text())
records = {}
cache = {}
for key, (sheet, x, y, width, height) in fragment['frames'].items():
    filename = fragment['sheets'][sheet].split('/')[-1]
    if filename not in cache:
        image = Image.open(BASE / 'originals' / filename).convert('RGBA')
        alpha = np.asarray(image.getchannel('A'))
        labels, count = ndimage.label(alpha >= 16, structure=np.ones((3, 3)))
        areas = np.bincount(labels.ravel())
        cache[filename] = image, labels, areas
    image, labels, areas = cache[filename]
    counts = np.bincount(labels[y:y+height, x:x+width].ravel(), minlength=len(areas))
    counts[areas < 400] = 0
    counts[0] = 0
    own = int(counts.argmax())
    records[key] = {
        'source': filename, 'crop': [x, y, width, height],
        'insideOriginal': 0 <= x < x + width <= image.width and 0 <= y < y + height <= image.height,
        'otherLargeSilhouettePixelsAlpha16': int(counts.sum() - counts[own]),
        'cropPixelSha256': hashlib.sha256(image.crop((x,y,x+width,y+height)).tobytes()).hexdigest(),
    }
(BASE / 'registration-analysis.json').write_text(json.dumps({'format': 1, 'threshold': 16, 'largeComponentMinArea': 400, 'scope': 'read-only source rectangle/alpha analysis; not game/runtime validation', 'frames': records}, indent=2) + '\n')
print('original PNGs',len(provenance['candidates']),'registered crop records',len(records),'neighbor-contaminated',sum(r['otherLargeSilhouettePixelsAlpha16']>0 for r in records.values()))
