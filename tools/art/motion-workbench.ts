/** Reusable motion/held-item audit for the local character-motion skill. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {loadDb} from '../loadContent'
import type {ItemDef} from '../../src/core/types'
import {equipmentSpec,attackStyle,attackDuration} from '../../src/client/render/equipment-motion'
import type {CharDef} from '../../src/client/render/atlas'
const at=process.argv.indexOf('--output'),out=at>=0?process.argv[at+1]:'test-results/motion-workbench'
if(!out)throw Error('--output 경로가 필요하다');mkdirSync(out,{recursive:true})
const{db,report}=loadDb();if(report.errors.length)throw Error(report.errors.join('\n'))
const manifest=JSON.parse(readFileSync('src/client/sprites.json','utf8'))as{chars:Record<string,CharDef>;frames:Record<string,unknown>}
const rows=db.all<ItemDef>('Item').filter(d=>d.slot==='main'||d.slot==='off'||d.throwable).map(d=>{
 const spec=equipmentSpec(d),style=d.attacks?.length?attackStyle(d.attacks[0].family,d.attacks[0].damageType,spec,!!d.ranged):d.throwable?'throw':'unarmed'
 if(!manifest.frames[d.sprite])throw Error('물품 그림 등록 필요: '+d.id)
 if(!spec.grip.every(n=>n>=0&&n<=1)||!Number.isFinite(spec.axis)||spec.length<=0)throw Error('손잡이/방향 등록 필요: '+d.id)
 return{...spec,label:d.label,style,duration:attackDuration(style,spec),ranged:!!d.ranged,attackModes:d.attacks?.map(a=>({id:a.id,label:a.label,style:attackStyle(a.family,a.damageType,spec,!!d.ranged)}))??[]}
})
const actors=Object.entries(manifest.chars).map(([id,c])=>{
 if(!c.gait||c.gait.walk<400||c.gait.crouchWalk<c.gait.walk)throw Error('보행 주기 등록 필요: '+id)
 for(const dir of['down','left','right','up']as const)if(!c.walk[dir]?.length||!c.idle[dir]?.length)throw Error('방향 등록 필요: '+id+'/'+dir)
 return{id,gait:c.gait,heldItems:!!c.heldItems}
})
const result={version:323,actors,heldItems:rows,pngPixelsModified:false,semanticVisualReviewRequired:true}
writeFileSync(join(out,'coverage.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({characters:actors.length,heldItems:rows.length,kinds:[...new Set(rows.map(r=>r.kind))],output:join(out,'coverage.json')}))
