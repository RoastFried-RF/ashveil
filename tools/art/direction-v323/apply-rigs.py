"""Register species cadence only. Never touch source PNGs, action costs or world rules."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[3]
path=ROOT/'src/client/sprites.json';manifest=json.loads(path.read_text())
roles=json.loads((ROOT/'tools/art/direction-v321/actor-plan.json').read_text())
for role in roles:
 walk,crouch={'hound':(600,850),'amalgam':(1050,1300),'drone':(900,1150),'rat':(500,750),'leech':(1200,1500)}.get(role['id'],(720,1000))
 for binding in role['bindings']:manifest['chars'][binding]['gait']={'walk':walk,'crouchWalk':crouch}
path.write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'models':len(roles),'registrations':sum(len(r['bindings'])for r in roles),'humanCycleMs':720,'humanCrouchCycleMs':1000,'pngPixelsModified':False}))
