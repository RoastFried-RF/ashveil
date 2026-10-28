"""Manual source-palm annotations, authored from the contact sheets.

This writes only the sibling staging JSON. It does not alter the game registry.
"""
import json
from pathlib import Path


points = {
    'idle': {
        'down': [
            ([15, 143], [101, 146]),
            ([14, 142], [96, 146]),
            ([16, 148], [98, 147]),
            ([16, 145], [98, 146]),
        ],
        'left': [
            (None, [48, 147]),
            (None, [55, 151]),
            (None, [50, 150]),
            (None, [52, 148]),
        ],
        'right': [
            ([91, 150], None),
            ([85, 151], None),
            ([89, 150], None),
            ([92, 152], None),
        ],
        'up': [
            ([119, 148], [18, 145]),
            ([117, 148], [20, 146]),
            ([112, 148], [18, 146]),
            ([109, 148], [18, 146]),
        ],
    },
    'walk': {
        'down': [
            ([22, 134], [105, 137]),
            ([22, 134], [108, 132]),
            ([18, 136], [110, 143]),
            ([22, 136], [110, 143]),
            ([22, 134], [114, 137]),
            ([21, 136], [107, 140]),
            ([20, 144], [108, 141]),
            ([20, 135], [103, 145]),
            ([17, 140], [104, 143]),
            ([11, 138], [102, 146]),
            ([15, 134], [108, 147]),
            ([12, 135], [105, 147]),
        ],
        'left': [
            ([47, 126], [80, 141]),
            (None, [53, 135]),
            (None, [54, 138]),
            (None, [50, 137]),
            (None, [45, 137]),
            (None, [52, 137]),
            (None, [76, 143]),
            (None, [55, 145]),
            ([37, 128], [78, 146]),
            (None, [61, 138]),
            (None, [58, 137]),
            (None, [52, 135]),
        ],
        'right': [
            ([122, 138], None),
            ([116, 139], None),
            ([106, 146], None),
            ([109, 146], None),
            ([115, 143], None),
            ([109, 145], None),
            ([107, 149], None),
            ([104, 149], None),
            ([123, 145], None),
            ([114, 145], None),
            ([117, 144], None),
            ([109, 144], None),
        ],
        'up': [
            ([117, 146], [19, 149]),
            ([119, 147], [18, 147]),
            ([121, 147], [17, 153]),
            ([128, 140], [27, 132]),
            ([117, 147], [19, 140]),
            ([119, 147], [21, 138]),
            ([113, 147], [19, 147]),
            ([110, 147], [18, 147]),
            ([122, 147], [18, 144]),
            ([126, 146], [21, 143]),
            ([122, 145], [17, 146]),
            ([130, 143], [27, 142]),
        ],
    },
    'attack': {
        'down': [
            ([37, 63], [83, 71]),
            ([25, 69], [73, 81]),
            ([16, 74], [111, 106]),
            ([62, 72], [98, 61]),
            ([66, 70], [103, 53]),
            ([116, 85], [112, 58]),
            ([13, 78], [75, 72]),
            ([35, 66], [78, 73]),
        ],
        'right': [
            ([70, 53], [94, 55]),
            ([45, 76], [100, 56]),
            ([44, 79], [99, 59]),
            ([79, 76], [116, 45]),
            ([130, 48], None),
            ([70, 71], [105, 56]),
            ([65, 69], [94, 59]),
            ([72, 54], [94, 56]),
        ],
        'up': [
            (None, None),
            (None, None),
            ([117, 32], None),
            ([124, 41], None),
            ([120, 39], None),
            (None, None),
            (None, None),
            (None, None),
        ],
    },
}

# Attack left is the same unflipped raw crop as right. Horizontal mirroring
# changes anatomical handedness; do not flip these raw pixel coordinates.
points['attack']['left'] = [(off, main) for main, off in points['attack']['right']]

frames = {}
for motion in ['idle', 'walk', 'attack']:
    for direction in ['down', 'left', 'right', 'up']:
        for index, (main, off) in enumerate(points[motion][direction]):
            frames[f'av322_patient_{motion}_{direction}{index}'] = {'main': main, 'off': off}

(Path(__file__).parent / 'patient-grips.json').write_text(json.dumps({'format': 1, 'frames': frames}, indent=2) + '\n')
