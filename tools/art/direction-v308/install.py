"""Check or install reviewed living-tree presentation metadata; do not edit image pixels."""
from pathlib import Path
import argparse, hashlib, json, struct

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--write',action='store_true')
parser.add_argument('--check',action='store_true')
args=parser.parse_args()
frames=json.loads((HERE/'living-frames.json').read_text())
provenance=json.loads((HERE/'provenance.json').read_text())
png=ROOT/'public'/frames['file'];data=png.read_bytes()
assert data[:8]==b'\x89PNG\r\n\x1a\n'
assert list(struct.unpack('>II',data[16:24]))==frames['sourceSize']
assert hashlib.sha256(data).hexdigest()==provenance['pngSha256']
assert hashlib.sha256((HERE/'living-trees.svg').read_bytes()).hexdigest()==provenance['svgSha256']
manifest_path=ROOT/'src/client/sprites.json';runtime_path=ROOT/'src/client/render/living-art.json'
manifest=json.loads(manifest_path.read_text());expected=json.loads(json.dumps(manifest))
expected['sheets'][frames['sheet']]=frames['file']
keys=set()
for row in frames['variants']:
    x,y,w,h=row['frame']
    assert min(x,y)>=0 and min(w,h)>0 and x+w<=frames['sourceSize'][0] and y+h<=frames['sourceSize'][1]
    assert all(0<=a<=1 for a in row['anchor']) and row['worldHeight']>0
    assert row['sprite'] not in keys;keys.add(row['sprite'])
    expected['frames'][row['sprite']]=[frames['sheet'],*row['frame']]
assert len(keys)==4
assert keys=={v['sprite'] for f in frames['families'] for v in f['variants']}
for family in frames['families']:
    for variant in family['variants']:
        original=next(row for row in frames['variants'] if row['sprite']==variant['sprite'])
        assert variant=={key:original[key] for key in ['sprite','worldHeight','anchor']}
if args.write:
    manifest_path.write_text(json.dumps(expected,ensure_ascii=False,indent=2)+'\n')
    runtime_path.write_text(json.dumps(frames['families'],ensure_ascii=False,indent=2)+'\n')
else:
    assert manifest==expected
    assert json.loads(runtime_path.read_text())==frames['families']
print(json.dumps({'frames':len(keys),'pngSha256':hashlib.sha256(data).hexdigest(),'svgAndRuntimeMetadataExact':True,'imagePixelsNotEdited':True}))
