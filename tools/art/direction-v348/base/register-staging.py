"""Staging-only manifest writer; PNG pixels remain untouched."""
import json
from pathlib import Path

BASE = Path(__file__).parent
ANALYSIS = json.loads((BASE / 'source-analysis.json').read_text())
DIRECTIONS = ['down', 'left', 'right', 'up']

# Manually chosen original-sheet ground projections, after viewing each sheet.
# For airborne crow hop frame1 these are virtual ground beneath the feet, not
# an instruction to translate/crop the source pixels or an invented contact.
GROUND = {
    'ash-crow-idle-v1.png': [
        [[179, 280], [489, 280], [797, 282], [1097, 281]],
        [[157, 568], [475, 569], [783, 570], [1084, 570]],
        [[185, 874], [495, 877], [805, 874], [1104, 875]],
        [[174, 1157], [487, 1157], [799, 1158], [1101, 1160]],
    ],
    'ash-crow-walk-v1.png': [
        [[166, 310], [485, 340], [791, 326], [1110, 313]],
        [[158, 602], [484, 611], [783, 600], [1092, 606]],
        [[182, 891], [494, 907], [811, 894], [1113, 893]],
        [[165, 1175], [477, 1180], [790, 1188], [1105, 1179]],
    ],
    'ash-crow-peck-v1.png': [
        [[170, 299], [488, 299], [793, 299], [1100, 298]],
        [[156, 604], [477, 604], [788, 606], [1108, 609]],
        [[185, 901], [490, 903], [809, 902], [1110, 904]],
        [[164, 1178], [478, 1178], [789, 1178], [1097, 1177]],
    ],
    'ash-crow-hurt-v1.png': [
        [[169, 292], [486, 290], [798, 291], [1098, 293]],
        [[159, 588], [477, 590], [792, 590], [1095, 591]],
        [[183, 884], [500, 875], [805, 884], [1106, 884]],
        [[164, 1172], [482, 1167], [795, 1171], [1100, 1173]],
    ],
    'ash-crow-fall-v1.png': [
        None,  # Source front turns sideways; replaced by its new 2x2 source.
        [[157, 584], [477, 590], [790, 592], [1100, 594]],
        [[184, 880], [501, 882], [799, 881], [1110, 882]],
        [[166, 1159], [488, 1158], [796, 1156], [1094, 1158]],
    ],
    'ash-crow-fall-down-v2.png': [
        [[330, 574], [933, 582], [341, 1129], [930, 1127]],
    ],
    'ash-crow-sleep-v1.png': [
        [[174, 289], [490, 289], [800, 289], [1108, 290]],
        [[148, 588], [466, 588], [783, 588], [1091, 590]],
        [[186, 885], [500, 885], [808, 884], [1112, 886]],
        [[177, 1185], [489, 1182], [803, 1184], [1098, 1184]],
    ],
    'ash-crow-rise-v1.png': [
        [[172, 322], [489, 330], [792, 330], [1094, 332]],
        [[148, 602], [475, 602], [792, 602], [1101, 602]],
        [[192, 890], [501, 889], [806, 889], [1106, 889]],
        [[179, 1165], [481, 1163], [791, 1166], [1102, 1165]],
    ],
    'cinder-bear-idle-v1.png': [
        [[163, 302], [466, 302], [777, 302], [1083, 302]],
        [[182, 575], [492, 575], [800, 575], [1112, 575]],
        [[149, 862], [462, 864], [771, 863], [1084, 865]],
        [[155, 1207], [470, 1207], [778, 1207], [1085, 1207]],
    ],
    'cinder-bear-swipe-v2.png': [
        [[207, 317], [488, 319], [770, 319], [1049, 319]],
        [[214, 590], [505, 590], [792, 591], [1057, 590]],
        [[203, 853], [483, 853], [757, 853], [1045, 854]],
        [[211, 1122], [498, 1123], [770, 1123], [1050, 1123]],
    ],
    'cinder-bear-bite-v3.png': [
        [[201, 326], [485, 326], [772, 326], [1057, 326]],
        [[216, 599], [505, 599], [793, 599], [1079, 599]],
        [[197, 868], [482, 869], [771, 869], [1059, 870]],
        [[200, 1138], [488, 1138], [775, 1139], [1059, 1139]],
    ],
    'cinder-bear-walk-down-v1.png': [
        [[353, 577], [936, 577], [341, 1181], [938, 1159]],
    ],
}

SELECTION = [
    ('ash-crow-idle-v1.png', 'ash_crow', 'idle', .045),
    ('ash-crow-walk-v1.png', 'ash_crow', 'walk', .045),
    ('ash-crow-peck-v1.png', 'ash_crow', 'attack', .045),
    ('ash-crow-hurt-v1.png', 'ash_crow', 'hurt', .045),
    ('ash-crow-fall-v1.png', 'ash_crow', 'fall', .045),
    ('ash-crow-fall-down-v2.png', 'ash_crow', 'fall', .0225),
    ('ash-crow-sleep-v1.png', 'ash_crow', 'sleep', .045),
    ('ash-crow-rise-v1.png', 'ash_crow', 'rise', .045),
    ('cinder-bear-idle-v1.png', 'cinder_bear', 'idle', .14),
    ('cinder-bear-swipe-v2.png', 'cinder_bear', 'attack', .25),
    ('cinder-bear-bite-v3.png', 'cinder_bear', 'bite', .25),
    ('cinder-bear-walk-down-v1.png', 'cinder_bear', 'walk', .065),
]

fragment = {'sheets': {}, 'sheetSizes': {}, 'frames': {}, 'chars': {}}
models = {model: {'clips': {}, 'frameTransforms': {}} for model in ['ash_crow', 'cinder_bear']}
ground_records = {'format': 1, 'frames': {}}
for filename, model, motion, scale in SELECTION:
    sheet = 'av334_' + Path(filename).stem.replace('-', '_')
    fragment['sheets'][sheet] = 'sprites/original/direction-v334/' + filename
    fragment['sheetSizes'][sheet] = ANALYSIS[filename]['size']
    clip = models[model]['clips'].setdefault(motion, {})
    for region in ANALYSIS[filename]['regionsAlpha16Area400']:
        direction, index = region['direction'], region['index']
        if filename == 'ash-crow-fall-v1.png' and direction == 'down':
            continue
        key = f'av334_{model}_{motion}_{direction}{index}'
        row = 0 if filename in ['cinder-bear-walk-down-v1.png', 'ash-crow-fall-down-v2.png'] else DIRECTIONS.index(direction)
        gx, gy = GROUND[filename][row][index]
        x, y, width, height = region['crop']
        # Include the virtual ground in the rectangle without editing PNGs.
        height = max(height, gy - y + 4)
        width = max(width, gx - x + 4)
        fragment['frames'][key] = [sheet, x, y, width, height]
        clip.setdefault(direction, []).append(key)
        models[model]['frameTransforms'][key] = {'anchor': [(gx - x) / width, (gy - y) / height], 'scale': scale}
        ground_records['frames'][key] = {
            'source': filename, 'originalSheetPoint': [gx, gy],
            'cropPoint': [gx - x, gy - y],
            'kind': 'virtual-ground-below-airborne-feet' if model == 'ash_crow' and motion == 'walk' and index == 1 else 'ground-footprint-projection',
        }

crow = models['ash_crow']
fragment['chars']['av331_ash_crow'] = {
    'anchor': [.5, 1], 'renderScale': .045, 'headOffset': 13,
    'shadow': [3.5, .8], 'healthBarWidth': 10, 'heldItems': False,
    'gait': {'walk': 720, 'crouchWalk': 900},
    'motionDurations': {'idle': 3200, 'attack': 560, 'hurt': 400, 'fall': 800, 'sleep': 4500, 'rise': 800},
    **{key: crow['clips'][key] for key in ['idle', 'walk', 'attack']},
    'motions': {key: value for key, value in crow['clips'].items() if key not in ['idle', 'walk', 'attack']},
    'frameTransforms': crow['frameTransforms'],
}

# The incomplete bear deliberately has NO runtime CharDef in the fragment.
# No idle substitution, mirroring or duplicate poses fill the missing walk.
bear = {
    'format': 1, 'intendedCharacterKey': 'av331_cinder_bear',
    'status': 'partial-do-not-activate',
    'clips': models['cinder_bear']['clips'],
    'frameTransforms': models['cinder_bear']['frameTransforms'],
    'missingAcceptedWalkDirections': ['left', 'right', 'up'],
    'notes': ['down walk has opposite front-paw phases but cross-motion body identity/size still needs final review', 'bite is a separate source clip and is not automatically selected by attack in the current renderer'],
}

(BASE / 'sprites.fragment.json').write_text(json.dumps(fragment, indent=2) + '\n')
(BASE / 'cinder-bear.partial.json').write_text(json.dumps(bear, indent=2) + '\n')
(BASE / 'foot-anchors.json').write_text(json.dumps(ground_records, indent=2) + '\n')
