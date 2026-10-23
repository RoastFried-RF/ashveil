"""Check/install nine authored ground frames. PNG bytes are never edited here."""
from pathlib import Path
import argparse,json,hashlib,struct
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true');parser.add_argument('--check',action='store_true');args=parser.parse_args()
meta=json.loads((HERE/'ground-frames.json').read_text());proof=json.loads((HERE/'provenance.json').read_text())
png=(ROOT/'public'/meta['file']).read_bytes();assert png[:8]==b'\x89PNG\r\n\x1a\n';assert list(struct.unpack('>II',png[16:24]))==meta['sourceSize']
assert hashlib.sha256(png).hexdigest()==proof['pngSha256'];assert hashlib.sha256((HERE/'ground.svg').read_bytes()).hexdigest()==proof['svgSha256']
assert set(meta['frames'])=={f'{kind}{i}'for kind in ['grass','grassdirt','dirt']for i in range(3)}
path=ROOT/'src/client/sprites.json';current=json.loads(path.read_text());expected=json.loads(json.dumps(current));expected['sheets'][meta['sheet']]=meta['file']
for key,frame in meta['frames'].items():
 x,y,w,h=frame;assert w==h==64 and 0<=x<=128 and 0<=y<=128 and x%64==y%64==0
 assert key in current['frames'];expected['frames'][key]=[meta['sheet'],*frame]
if args.write:path.write_text(json.dumps(expected,ensure_ascii=False,indent=2)+'\n')
else:assert current==expected
print(json.dumps({'frames':9,'pngSha256':proof['pngSha256'],'svgAndFrameMappingExact':True,'pngPixelsNotEdited':True}))
