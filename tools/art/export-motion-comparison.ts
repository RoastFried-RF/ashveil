// The old role models remain original PNG files; no reference-game raster data.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {motionDurations,motionNames} from '../../src/client/render/character-motion'
import type {CharDef} from '../../src/client/render/atlas'
type Manifest={chars:Record<string,CharDef>;frames:Record<string,[string,number,number,number,number]>;sheets:Record<string,string>}
const folder='tools/art/direction-v322',baselinePath=folder+'/motion-baseline.json'
const plan=JSON.parse(readFileSync('tools/art/direction-v321/actor-plan.json','utf8'))as{id:string;bindings:string[]}[]
const current=JSON.parse(readFileSync('src/client/sprites.json','utf8'))as Manifest
function snapshot(m:Manifest){
 const characters=Object.fromEntries(plan.map(role=>[role.id,m.chars[role.bindings[0]]])),keys=new Set<string>()
 for(const c of Object.values(characters)){for(const clip of[c.walk,c.idle,c.attack,...Object.values(c.motions??{})])if(clip)for(const frames of Object.values(clip))frames.forEach(key=>keys.add(key))}
 const frames=Object.fromEntries([...keys].map(key=>[key,m.frames[key]])),sheets=Object.fromEntries([...new Set(Object.values(frames).map(f=>f[0]))].map(sheet=>[sheet,m.sheets[sheet]]))
 return{characters,frames,sheets}
}
if(!existsSync(baselinePath)){
 const path=process.argv[2];if(!path)throw Error('First export needs the immutable321 sprites.json path')
 writeFileSync(baselinePath,JSON.stringify(snapshot(JSON.parse(readFileSync(path,'utf8'))),null,2)+'\n')
}
mkdirSync('public/artbook/motion',{recursive:true})
writeFileSync('public/artbook/motion/catalog.json',JSON.stringify({version:322,roles:plan.map(p=>p.id),motionNames,motionDurations,before:JSON.parse(readFileSync(baselinePath,'utf8')),after:snapshot(current)},null,2)+'\n')
console.log('Motion comparison catalog exported')
