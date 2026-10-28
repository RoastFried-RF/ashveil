/** Public view uses the same borrowed-source class; all source PNGs remain byte-identical. */
import {spawnSync} from 'node:child_process'
import {readFileSync,writeFileSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
const r=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','tools/art/swarm-preview-v370/vite.config.ts'],{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1)
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex'),path='public/sprites/original/direction-v370/ashmoth-flight-four-poses-v1.png',sha=hash(path)
if(!readdirSync('public/artbook/swarm/assets').some(p=>p.endsWith('.png')&&hash('public/artbook/swarm/assets/'+p)===sha))throw Error('Public original is missing')
writeFileSync('public/artbook/swarm/provenance.json',JSON.stringify({version:370,sourceOriginal:path,sha256:sha,originalPNGs:1,uniqueFlightPoseRegions:4,authoredDirections:1,runtimeRotation:true,viewSource:{path:'src/client/render/swarm-view.ts',sha256:hash('src/client/render/swarm-view.ts')},motionSource:{path:'src/client/render/walk-motion.ts',sha256:hash('src/client/render/walk-motion.ts')},scope:'Isolated art preview; identical display class and four borrowed original regions. Representative sprites do not enumerate real colony members. No game, inventory, world clock or action mutation. Not release approval.'},null,2)+'\n')
