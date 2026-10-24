// The old role models remain original PNG files; no reference-game raster data.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {motionDurations,motionNames} from '../../src/client/render/character-motion'
import type {CharDef} from '../../src/client/render/atlas'
import {loadDb} from '../loadContent'
import type {ItemDef} from '../../src/core/types'
import {equipmentSpec,attackStyle,attackDuration} from '../../src/client/render/equipment-motion'
import ts from 'typescript'
type Manifest={chars:Record<string,CharDef>;frames:Record<string,[string,number,number,number,number]>;sheets:Record<string,string>}
const folder='tools/art/direction-v323',baselinePath=folder+'/motion-baseline.json'
const plan=[...JSON.parse(readFileSync('tools/art/direction-v321/actor-plan.json','utf8'))as{id:string;bindings:string[]}[],{id:'ashhorn_stag',bindings:['av331_ashhorn_stag']},{id:'tuskhog',bindings:['av331_tuskhog']}]
const current=JSON.parse(readFileSync('src/client/sprites.json','utf8'))as Manifest
const grips=JSON.parse(readFileSync('src/client/render/held-grips.json','utf8')).frames
const{db}=loadDb()
const equipment=db.all<ItemDef>('Item').filter(d=>d.slot==='main'||d.slot==='off').map(d=>{const spec=equipmentSpec(d,undefined,!!d.light);return{...spec,label:d.label,ranged:!!d.ranged,style:attackStyle(d.attacks?.[0]?.family,d.attacks?.[0]?.damageType,spec,!!d.ranged),modes:d.attacks?.map(a=>({id:a.id,label:a.label,style:attackStyle(a.family,a.damageType,spec,!!d.ranged)}))??[]}})
function snapshot(m:Manifest){
 const characters=Object.fromEntries(plan.map(role=>[role.id,m.chars[role.bindings[0]]])),keys=new Set<string>()
 for(const c of Object.values(characters)){for(const clip of[c.walk,c.idle,c.attack,...Object.values(c.motions??{})])if(clip)for(const frames of Object.values(clip))frames.forEach(key=>keys.add(key))}
 equipment.forEach(item=>keys.add(item.sprite))
 const frames=Object.fromEntries([...keys].map(key=>[key,m.frames[key]])),sheets=Object.fromEntries([...new Set(Object.values(frames).map(f=>f[0]))].map(sheet=>[sheet,m.sheets[sheet]]))
 return{characters,frames,sheets,grips:Object.fromEntries([...keys].filter(k=>grips[k]).map(k=>[k,grips[k]]))}
}
if(!existsSync(baselinePath)){
 const path=process.argv[2];if(!path)throw Error('First export needs the immutable previous motion snapshot')
 throw Error('Preserve the previous published motion snapshot and durations before export: '+path)
}
mkdirSync('public/artbook/motion',{recursive:true})
const baseline=JSON.parse(readFileSync(baselinePath,'utf8'))
for(const item of equipment){const f=current.frames[item.sprite];baseline.snapshot.frames[item.sprite]=f;baseline.snapshot.sheets[f[0]]=current.sheets[f[0]]}
writeFileSync('public/artbook/motion/catalog.json',JSON.stringify({version:336,roles:plan.map(p=>p.id),motionNames,motionDurations,beforeDurations:baseline.durations,equipment,attackDurations:Object.fromEntries(equipment.map(item=>[item.id,attackDuration(item.style,item)])),before:baseline.snapshot,after:snapshot(current)},null,2)+'\n')
writeFileSync('public/artbook/motion/equipment-motion.js',ts.transpileModule(readFileSync('src/client/render/equipment-motion.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText)
console.log('Motion comparison catalog exported')
