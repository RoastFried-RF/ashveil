/** Rebuild the public view from gameplay's borrowed-source rig view. No new raster pixels. */
import {spawnSync} from 'node:child_process'
import {readFileSync,writeFileSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build','--config','tools/art/sower-pixi-v360/vite.config.ts','--outDir',resolve('public/artbook/rig')],{stdio:'inherit'})
if(result.status!==0)process.exit(result.status??1)
const installation=JSON.parse(readFileSync('tools/art/direction-v364/installation.json','utf8'))
const originals=installation.originals.slice(0,8),assets=readdirSync('public/artbook/rig/assets')
for(const original of originals){const bytes=readFileSync(original.path),sha=createHash('sha256').update(bytes).digest('hex');if(sha!==original.sha256)throw Error('Original changed: '+original.path);if(!assets.some(name=>name.endsWith('.png')&&createHash('sha256').update(readFileSync('public/artbook/rig/assets/'+name)).digest('hex')===sha))throw Error('Public original missing: '+original.path)}
writeFileSync('public/artbook/rig/provenance.json',JSON.stringify({version:364,view:'Shared Pixi articulated-rig-view.ts; isolated DOM controls, no world simulation',originalPngs:8,sourceRegions:30,basePartRegions:16,workChassisRegions:14,authoredWalkFrames:0,leftRightRecovery:'Explicit phase0 reuse; clipped phase3 rejected',physicalHipsObserved:{LF:null,RF:null,LH:null,RH:null},layout:'Per-facing inferred2.5D; 120ms facing crossfade creates a new layout/stance owner, not continuous yaw or one proven3D skeleton',limitations:['healthy four-leg gait only','opposite bearing surfaces unproven','no release quality approval'],originals},null,2)+'\n')
