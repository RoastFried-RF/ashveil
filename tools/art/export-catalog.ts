// Offline original-art catalogue. No game state, network or normal game menu is involved.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {loadDb} from '../loadContent'
import {groundObjectArt} from '../../src/client/render/terrain-art'
import type {ItemDef,AbilityDef,CreatureDef,TerrainDef} from '../../src/core/types'

const output=process.argv[2]
if(!output||existsSync(output))throw Error('새 HTML 출력 경로를 지정하세요. 기존 결과는 덮어쓰지 않습니다.')
type Character={walk:Record<string,string[]>;idle:Record<string,string[]>;attack?:Record<string,string[]>}
type Frame=[string,number,number,number,number]
type Entry={id:string;label:string;kind:string;frame?:string;variants?:{key:string;poses:Character}[];url?:string;rect?:[number,number,number,number];note?:string}
const m=JSON.parse(readFileSync('src/client/sprites.json','utf8')) as {sheets:Record<string,string>;frames:Record<string,Frame>;chars:Record<string,Character>;ui:Record<string,string>}
const {db,report}=loadDb();if(report.errors.length)throw Error(report.errors.join('\n'))
const rows:Entry[]=[]
for(const d of db.all<ItemDef>('Item'))rows.push({id:d.id,label:d.label,kind:'items',frame:d.sprite})
for(const d of db.all<AbilityDef>('Ability'))rows.push({id:d.id,label:d.label,kind:'abilities',frame:d.icon})
for(const d of db.all<CreatureDef>('Creature')){
 const raw=d.char??d.sprite??d.id
 const keys=[...new Set((Array.isArray(raw)?raw:[raw]).map(k=>d.characterAliases?.[k]??(d.id==='Creature.Drifter'&&k==='hero'?'original_wanderer_hero':k)))]
 if(d.dormantChar)keys.push(d.dormantChar)
 const variants=keys.map(key=>{if(!m.chars[key])throw Error(d.id+': 캐릭터 없음 '+key);return{key,poses:m.chars[key]}})
 rows.push({id:d.id,label:d.label,kind:'creatures',variants,note:d.dormantChar?'정지 상태도 선택할 수 있습니다.':undefined})
}
const props:Record<string,string>={'Terrain.Tree':'original_dead_tree','Terrain.Rock':'rock','Terrain.Brazier':'brazier0','Terrain.Column':'broken_column','Terrain.Statue':'statue','Terrain.Sarcophagus':'sarcophagus','Terrain.SarcoBlock':'sarcophagus','Terrain.Remains':'skull'}
for(const d of db.all<TerrainDef>('Terrain')){
 const frame=groundObjectArt(d)||(d.wallMark?(d.wallMark==='sealedCrack'?'complete_wall_sealed':'complete_wall_crack'):undefined)||props[d.id]||(d.wall?(d.id==='Terrain.Shelf'?'shelf0':'wall_face0'):d.stairs?(d.stairs==='down'?'floor_stairs':'floor_ladder'):d.id==='Terrain.Campfire'?'complete_campfire_cold':d.beacon?'complete_beacon':d.visual?.sprite??d.sprites[0]??(d.water?d.water==='deep'?'water_deep':'water_shallow':d.floor==='deck'?'deck0':d.floor==='cd'?'cd_floor0':d.floor==='earth'?'dirt0':'kt_floor_q0'))
 rows.push({id:d.id,label:d.label,kind:'terrains',frame,...(frame.startsWith('kt_floor_q')?{rect:[0,0,16,16] as [number,number,number,number]}:{}),note:'원본 대표 프레임입니다. 게임의 조명·가림·성장·열림 상태와 표시 배율은 실제 화면에서 따로 확인합니다.'})
}
for(const [id,url]of Object.entries(m.ui)){const png=readFileSync('public/'+url);rows.push({id:'UI.'+id,label:id,kind:'ui',url,rect:[0,0,png.readUInt32BE(16),png.readUInt32BE(20)]})}
const images:Record<string,string>={},sourceImages:Record<string,{bytes:number;sha256:string}>={}
for(const url of new Set([...Object.values(m.sheets),...Object.values(m.ui)])){
 if(!url.includes('/original/'))throw Error('외부 원본 폴백: '+url)
 const data=readFileSync('public/'+url);images[url]='data:image/png;base64,'+data.toString('base64');sourceImages[url]={bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')}
}
for(const row of rows)if(row.frame&&!m.frames[row.frame])throw Error(row.id+': 프레임 없음 '+row.frame)
const data={version:302,rows,frames:m.frames,sheets:m.sheets,images,sourceImages,counts:Object.fromEntries(['items','terrains','creatures','abilities','ui'].map(k=>[k,rows.filter(r=>r.kind===k).length]))}
const html=readFileSync('tools/art/catalog-template.html','utf8').replace('/*__ART_DATA__*/',JSON.stringify(data).replace(/</g,'\\u003c'))
mkdirSync(dirname(resolve(output)),{recursive:true});writeFileSync(output,html)
console.log(JSON.stringify({output,bytes:Buffer.byteLength(html),counts:data.counts,embeddedOriginalPNGs:Object.keys(images).length,offline:true,containsGameState:false}))
