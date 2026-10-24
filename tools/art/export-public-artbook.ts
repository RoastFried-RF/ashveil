// Standalone original-art review catalog. No live world state or reference raster files.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {loadDb} from '../loadContent'
import type {ItemDef,CreatureDef,TerrainDef,AbilityDef} from '../../src/core/types'
import {groundObjectArt} from '../../src/client/render/terrain-art'
import {motionDurations} from '../../src/client/render/character-motion'
const {db,report}=loadDb();if(report.errors.length)throw Error(report.errors.join('\n'))
const m=JSON.parse(readFileSync('src/client/sprites.json','utf8'))
const items=db.all<ItemDef>('Item'),creatures=db.all<CreatureDef>('Creature'),terrains=db.all<TerrainDef>('Terrain'),abilities=db.all<AbilityDef>('Ability')
const roleLabels:Record<string,string>={original_wanderer_hero:'떠돌이',hero:'정착한 떠돌이',resident_worker:'주민 · 노동자',resident_healer:'주민 · 치료사',resident_guard:'주민 · 경비',resident_trader:'주민 · 상인',reaver0:'약탈자 · 철모',reaver1:'약탈자 · 비대칭 외투',complete_reaver_chief:'약탈단 우두머리',complete_reaver_archer:'약탈단 궁수',shade0:'그늘 사람 · 짧은 작업복',shade1:'그늘 사람 · 조끼',shade2:'그늘 사람 · 긴 머리',shade3:'그늘 사람 · 묶은 머리',shade_chief:'그늘 사람 우두머리',withered:'말라붙은 자',withered_priest:'말라붙은 사제',spore0:'감염 순례자 · 어깨 균체',spore1:'감염 순례자 · 등 균체',tender_drone:'수리 드론',tender_drone_inert:'수리 드론 · 정지',amalgam:'융합체',ash_hound:'재늑대',ash_hound_alpha:'재늑대 우두머리',burrow_rat:'굴쥐',murk_leech:'늪거머리'}
const actorLabels=(key:string)=>roleLabels[key]??creatures.filter(c=>(Array.isArray(c.char)?c.char:c.char?[c.char]:[]).includes(key)||Object.values(c.characterAliases??{}).includes(key)||c.dormantChar===key).map(c=>c.label).join(' · ')
const seen=new Set<string>(),actors=Object.entries(m.chars).flatMap(([id,value])=>{const c=value as {walk:Record<string,string[]>;idle:Record<string,string[]>;attack?:Record<string,string[]>;portrait?:string;renderScale?:number};const first=c.idle.down[0];if(seen.has(first))return[];seen.add(first);return[{id,label:actorLabels(id)||id,kind:'actors',frame:first,character:id,scale:c.renderScale??.72}]})
const portraits=actors.filter(actor=>m.chars[actor.character].portrait).map(actor=>({...actor,id:'portrait:'+actor.id,kind:'portraits',frame:m.chars[actor.character].portrait,scale:1}))
const terrainRepresentative=(terrain:TerrainDef)=>{
 const object=groundObjectArt(terrain);if(object)return object
 if(terrain.visual)return terrain.visual.sprite
 if(terrain.beacon)return 'complete_beacon'
 if(terrain.wallMark)return terrain.wallMark==='sealedCrack'?'complete_wall_sealed':'complete_wall_crack'
 const props:Record<string,string>={'Terrain.Shelf':'shelf0','Terrain.Statue':'statue','Terrain.SarcoBlock':'sarcophagus','Terrain.Sarcophagus':'sarcophagus','Terrain.Column':'broken_column'}
 if(props[terrain.id])return props[terrain.id]
 if(terrain.door)return terrain.door==='open'?'door_open':'door_closed'
 if(terrain.sprites.length)return terrain.sprites[0]
 if(terrain.water)return terrain.water==='deep'?'water_deep':'water_shallow'
 if(terrain.wall)return 'wall_face0'
 if(terrain.floor==='deck')return 'deck0'
 if(terrain.floor==='earth'||terrain.id==='Terrain.Path')return 'dirt0'
 if(terrain.floor==='cd')return 'cd_floor0'
 return 'kt_floor_q0'
}
const defs=[...items.map(item=>({id:item.id,label:item.label,kind:'items',frame:item.sprite,grid:item.size})),...abilities.map(ability=>({id:ability.id,label:ability.label,kind:'abilities',frame:ability.icon})),...terrains.map(terrain=>({id:terrain.id,label:terrain.label,kind:'terrain',frame:terrainRepresentative(terrain)}))]
const resolvedDefs=defs.map(entry=>Object.hasOwn(m.frames,entry.frame)?entry:{...entry,url:'tiles/'+entry.frame+'.png'})
for(const entry of resolvedDefs)if('url'in entry&&!existsSync('public/'+entry.url))throw Error('Missing preview asset: '+entry.id+' '+entry.url)
const frames=Object.keys(m.frames).map(id=>({id,label:id,kind:'frames',frame:id})),ui=Object.entries(m.ui).map(([id,url])=>({id,label:id,kind:'ui',url}))
mkdirSync('public/artbook',{recursive:true})
writeFileSync('public/artbook/catalog.json',JSON.stringify({version:'0.336-dev',motionDurations,note:'독립 원화 미리보기. 실제 세계의 이동·장비·시야·발견 상태는 진행하지 않는다. 지형 정의와 전체 프레임에는 호환/기억/상태별 표현도 포함한다.',sheets:m.sheets,sheetSizes:m.sheetSizes,frames:m.frames,characters:m.chars,entries:[...actors,...portraits,...resolvedDefs,...ui,...frames]},null,2)+'\n')
console.log(JSON.stringify({actors:actors.length,portraits:portraits.length,items:items.length,terrains:terrains.length,abilities:abilities.length,ui:ui.length,frames:frames.length}))
