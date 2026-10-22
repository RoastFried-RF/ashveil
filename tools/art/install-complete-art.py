"""Merge the reviewed original-art fragments; retain old frame names and dimensions."""
from pathlib import Path
import argparse, json, hashlib

ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--write',action='store_true')
args=parser.parse_args()
before=json.loads((ROOT/'tools/art/complete-catalog-v302-before.json').read_text())
m=json.loads(json.dumps(before['registry']))
parts=['terrain','props','creatures','items','ui']
seen={}
for part in parts:
    path=ROOT/f'tools/art/complete-{part}.fragment.json'
    fragment=json.loads(path.read_text())
    for group in ['sheets','frames','anims','chars','ui']:
        for key,value in fragment.get(group,{}).items():
            token=(group,key)
            if token in seen: raise ValueError(f'fragment conflict {token}: {seen[token]} / {part}')
            seen[token]=part
            m[group][key]=value

# A world crate and an inventory kit have different scale and meaning.
m['frames']['crate_closed']=list(m['frames']['crate0'])
# Compatibility names remain original images without changing persisted choices.
m['chars']['player']=m['chars']['original_wanderer_hero']
m['chars']['reaver2']=m['chars']['reaver1']
used={row[0] for row in m['frames'].values()}
retired={key:value for key,value in m['sheets'].items() if key not in used}
m['sheets']={key:value for key,value in m['sheets'].items() if key in used}
for key,row in before['registry']['frames'].items():
    assert key in m['frames'] and m['frames'][key][3:]==row[3:],key
assert all('/original/' in url for url in m['sheets'].values())
assert all('/original/' in url for url in m['ui'].values())
patches=[]
for part in ['items','creatures']:
    patches+=json.loads((ROOT/f'tools/art/complete-{part}.patches.json').read_text())
assert len(patches)==179 and len({(p['target'],p['path']) for p in patches})==179
allowed={(d['id'],'/sprite') for d in before['definitions']['items']}|{(d['id'],'/icon') for d in before['definitions']['abilities']}|{(d['id'],'/characterAliases') for d in before['definitions']['creatures']}
for p in patches: assert (p['target'],p['path']) in allowed
replaced={key:{'before':url,'after':m['sheets'][key]} for key,url in before['registry']['sheets'].items() if key in m['sheets'] and url!=m['sheets'][key]}
report={'before':{k:len(v) for k,v in before['registry'].items()},'after':{k:len(v) for k,v in m.items()},'retiredLoadedSheets':retired,'replacedSheetUrls':replaced,'all813PriorFrameNamesAndDimensionsPreserved':True,'appearanceOnlyPatches':len(patches),'allLoadedSheetsAndRegisteredUIAreOriginal':True,'note':'Legacy public files are retained as historical/explicit-URL compatibility files; none remains in loaded sheet/UI registries. Actual dynamic display is verified separately.'}
if args.write:
    (ROOT/'src/client/sprites.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'src/content/core/patches/zz-complete-original-art.json').write_text(json.dumps(patches,ensure_ascii=False,indent=2)+'\n')
    report['manifestSha256']=hashlib.sha256((ROOT/'src/client/sprites.json').read_bytes()).hexdigest()
    (ROOT/'docs/art-complete-v302-merge.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
