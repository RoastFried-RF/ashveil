/** Export original work crops and the same presentation geometry as the game. */
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import ts from 'typescript'
import {loadDb} from '../loadContent'
import type {CharDef} from '../../src/client/render/atlas'
const source=JSON.parse(readFileSync('src/client/sprites.json','utf8')) as {chars:Record<string,CharDef>;frames:Record<string,[string,number,number,number,number]>;sheets:Record<string,string>}
const grips=JSON.parse(readFileSync('src/client/render/medical-grips.json','utf8'))
const {db}=loadDb(),out='public/artbook/medical',keys=new Set<string>()
const characters=Object.fromEntries([['player','떠돌이'],['resident_guard','경비'],['reaver1','약탈자'],['shade0','그늘 사람'],['spore0','감염 순례자'],['resident_worker','노동자'],['resident_healer','치료사'],['resident_trader','상인']].map(([id,label])=>{
 const c=source.chars[id],work=c.motions!.work!;Object.values(work).flat().forEach(k=>keys.add(k))
 return[id,{label,work,headOffset:c.headOffset,frameTransforms:Object.fromEntries(Object.values(work).flat().map(k=>[k,c.frameTransforms![k]]))}]
}))
const profiles=[['wrap','붕대','Bandage'],['wrapBag','의료 가방 · 붕대','MedicalBag'],['wash','세척','Moonshine'],['splint','부목','Splint'],['needle','봉합','Needle'],['cut','절개','RustyKnife'],['extract','이물 제거','RustyKnife'],['reduce','관절 처치',null],['examine','진찰',null],['dose','약 복용','BitterMoss']].map(([kind,label,id])=>{
 const item=id?db.item('Item.'+id):null,thread=kind==='needle'?db.item('Item.Thread'):null
 for(const it of[item,thread])if(it)keys.add(it.sprite)
 return{id:kind,kind:kind==='wrapBag'?'wrap':kind,label,sprite:item?.sprite,secondary:thread?.sprite}
})
const frames=Object.fromEntries([...keys].map(k=>[k,source.frames[k]])),sheets=Object.fromEntries([...new Set(Object.values(frames).map(f=>f[0]))].map(k=>[k,source.sheets[k]]))
mkdirSync(out,{recursive:true});writeFileSync(out+'/catalog.json',JSON.stringify({revision:387,characters,profiles,frames,sheets,grips:grips.frames},null,2)+'\n')
const geometry=readFileSync('src/client/render/medical-motion.ts','utf8').replace("import graphicGrips from './medical-prop-grips.json'",'const graphicGrips='+readFileSync('src/client/render/medical-prop-grips.json','utf8'))
writeFileSync(out+'/medical-motion.js',ts.transpileModule(geometry,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText)
console.log(JSON.stringify({characters:8,workFrames:128,profiles:profiles.length,originalPngsModified:false}))
