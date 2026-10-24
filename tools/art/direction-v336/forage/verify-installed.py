"""Read original PNGs and registration only; never modifies pixels or game state."""
from pathlib import Path
from PIL import Image
import hashlib,json
root=Path(__file__).resolve().parents[4]
here=Path(__file__).resolve().parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
records=[json.loads(p.read_text())for p in(here/'records').glob('*.json')]
preserved=[]
for record in records:
    original=root/'public/sprites/original/direction-v336/forage'/Path(record['preserved']).name
    assert sha(original)==record['sha256'],original
    with Image.open(original)as im:im.verify()
    for ref in record['referencedOwnImages']:
        relative=ref['path'].split('/ashveil/',1)[1]
        assert sha(root/relative)==ref['sha256'],relative
    preserved.append({'path':str(original.relative_to(root)),'sha256':sha(original)})
manifest=json.loads((root/'src/client/sprites.json').read_text())
fragment=json.loads((here/'sprites.forage.fragment.json').read_text())
families=json.loads((root/'src/client/render/forage-art.json').read_text())
for section in['sheets','sheetSizes','frames']:
    for key,value in fragment[section].items():assert manifest[section][key]==value,key
regions=set();references=[]
for family in families:
    assert len(family['pairs'])==4
    for pair in family['pairs']:
        assert 0<pair['scale']<1
        for state in['mature','spent']:
            art=pair[state];frame=manifest['frames'][art['sprite']];sheet,x,y,width,height=frame
            assert len(art['anchor'])==2 and all(0<=n<=1 for n in art['anchor'])
            assert width*pair['scale']<=14.000001 and height*pair['scale']<=12.000001
            with Image.open(root/'public'/manifest['sheets'][sheet])as im:
                assert 0<=x and 0<=y and x+width<=im.width and y+height<=im.height
            regions.add(tuple(frame));references.append(art['sprite'])
assert len(regions)==len(set(references))==len(references)==16
print(json.dumps({'scope':'Installed original PNG/hash/CRC, exact atlas fragment and matched-pair footprint/anchor references only. No visual or ecological release approval.','errors':[],'preservedOriginalPNGs':len(preserved),'selectedSheets':len(fragment['sheets']),'uniqueSelectedRegions':len(regions),'sameScalePairs':8,'originals':preserved},ensure_ascii=False,indent=2))
