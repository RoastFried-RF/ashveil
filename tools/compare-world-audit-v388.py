"""Compare retained baseline/fixed simulation saves without rewriting either run."""
import json,hashlib,sys
from pathlib import Path
baseline,fixed,output=map(Path,sys.argv[1:4])
if output.exists():raise ValueError('기존 감사를 덮어쓰지 않는다')
def read(p):return json.loads(p.read_text())
def normalized(s):
    s.pop('loadHash',None)
    for mod in s.get('contentMods',[]):mod.pop('hash',None)
    return s
rows=[]
for n in range(30):
    seed=f'sim-{n}';row={'seed':seed,'phases':{}}
    for phase in ['initial','final']:
        a=read(baseline/'states'/f'{seed}-{phase}.json');b=read(fixed/'states'/f'{seed}-{phase}.json')
        changed=[k for k in sorted(a.keys()|b.keys()) if a.get(k)!=b.get(k)]
        physical_a=normalized(a);physical_b=normalized(b)
        keys=[k for k in sorted(physical_a.keys()|physical_b.keys()) if physical_a.get(k)!=physical_b.get(k)]
        row['phases'][phase]={'changedTopLevelFields':changed,'physicalChangedTopLevelFields':keys,'wholeEqualExceptTwoContentHashes':physical_a==physical_b,'baselineStructuralSHA256':hashlib.sha256(json.dumps(physical_a,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'fixedStructuralSHA256':hashlib.sha256(json.dumps(physical_b,sort_keys=True,separators=(',',':')).encode()).hexdigest()}
    rows.append(row)
a=read(baseline/'summary.json');b=read(fixed/'summary.json')
result={'seeds':30,'maxDays':3,'sameSeedSet':True,'baseline':{k:a[k] for k in ['runs','maxDays','averageDays','causes','seconds']},'fixed':{k:b[k] for k in ['runs','maxDays','averageDays','causes','seconds']},'allPhysicalInitialExact':all(r['phases']['initial']['wholeEqualExceptTwoContentHashes'] for r in rows),'physicallyChangedFinalSeeds':[r['seed'] for r in rows if not r['phases']['final']['wholeEqualExceptTwoContentHashes']],'rows':rows,'scope':'Every complete initial/final save compared; metadata normalized ONLY at loadHash/contentMods[].hash. Differing outcomes are reported, never coerced to match. These bot runs are not human playtests or 1,000-expedition certification.'}
output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['rows']},ensure_ascii=False))
