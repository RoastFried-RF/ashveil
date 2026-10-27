"""Classify byte-preserved historical character sheets without removing saved appearances."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[2]
manifest=ROOT/'src/client/sprites.json';audit=json.loads((ROOT/'tools/art/direction-v396/history-audit.json').read_text());m=json.loads(manifest.read_text())
for source in audit['sources']:
 for witness in source['references']:
  assert m['frames'].get(witness['frame'])==witness['rectangle'],witness['frame']
for key,witness in audit['sheetWitnesses'].items():
 assert m['sheets'][key]==witness['path'],key
 assert hashlib.sha256((ROOT/'public'/witness['path']).read_bytes()).hexdigest()==witness['sha256'],key
 assert all(m['frames'][frame][0]==key for frame in witness['witnessFrames']),key
m['characterSheetHistory']=sorted(set(m.get('characterSheetHistory',[]))|set(audit['sheetWitnesses']))
manifest.write_text(json.dumps(m,indent=2)+'\n')
print(json.dumps({'classifiedHistoricalSheets':len(m['characterSheetHistory']),'sourcePNGsChanged':False,'framesChanged':False,'charactersChanged':False}))
