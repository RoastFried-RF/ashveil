// Resolved game definitions and every registered image; this does not modify content.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {loadDb} from '../loadContent'
import type {ItemDef,CreatureDef,TerrainDef,AbilityDef} from '../../src/core/types'
import {mapIconKeys} from '../../src/client/render/terrain-art'

const output=process.argv[2]
if(!output)throw Error('출력 파일을 지정하세요')
if(existsSync(output))throw Error('기존 조사 결과는 덮어쓰지 않습니다: '+output)
const {db,report}=loadDb();if(report.errors.length)throw Error(report.errors.join('\n'))
const manifest=JSON.parse(readFileSync('src/client/sprites.json','utf8')) as {
 sheets:Record<string,string>;frames:Record<string,[string,number,number,number,number]>
 chars:Record<string,unknown>;anims:Record<string,unknown>;ui:Record<string,string>
}
const sha=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex')
const binding=(key:string)=>{
 const frame=manifest.frames[key],url=frame?manifest.sheets[frame[0]]:'tiles/'+key+'.png'
 return {key,url,registeredFrame:!!frame,original:url.includes('/original/'),exists:existsSync(resolve('public',url)),...(frame?{frame}:{})}
}
const definitions={items:db.all<ItemDef>('Item'),creatures:db.all<CreatureDef>('Creature'),terrains:db.all<TerrainDef>('Terrain'),abilities:db.all<AbilityDef>('Ability')}
const consumers={
 items:definitions.items.map(d=>({id:d.id,label:d.label,bindings:[binding(d.sprite)]})),
 abilities:definitions.abilities.map(d=>({id:d.id,label:d.label,bindings:[binding(d.icon)]})),
 terrains:definitions.terrains.map(d=>({id:d.id,label:d.label,bindings:[...new Set([...d.sprites,...(d.visual?[d.visual.sprite]:[])])].map(binding),rendererFeatures:{wall:d.wall,water:d.water,floor:d.floor,visual:d.visual,station:d.station,bedding:d.bedding,residentWell:d.residentWell,beacon:!!d.beacon}})),
 creatures:definitions.creatures.map(d=>({id:d.id,label:d.label,char:d.char,aliases:d.characterAliases,dormant:d.dormantChar,legacySprites:d.sprite,characterKeys:[...new Set([...(Array.isArray(d.char)?d.char:d.char?[d.char]:[]),...Object.values(d.characterAliases??{}),...(d.dormantChar?[d.dormantChar]:[])])]})),
}
const sheets=Object.entries(manifest.sheets).map(([key,url])=>({key,url,original:url.includes('/original/'),exists:existsSync('public/'+url),sha256:sha('public/'+url),frames:Object.keys(manifest.frames).filter(k=>manifest.frames[k][0]===key)}))
const ground=mapIconKeys
const sharedItemIcons=[...new Set(definitions.items.map(d=>d.sprite))].map(key=>({key,items:definitions.items.filter(d=>d.sprite===key).map(d=>({id:d.id,label:d.label}))})).filter(r=>r.items.length>1)
const result={scope:'All resolved base-game Item/Ability/Terrain/Creature definitions, complete manifest (including compatibility-only entries), MapView preloaded ground icons. Registered/declared references are distinguished from actual renderer routing; actual scene coverage is recorded separately.',source:{manifestSha256:sha('src/client/sprites.json'),rendererSha256:sha('src/client/render/MapRenderer.ts')},counts:{...Object.fromEntries(Object.entries(definitions).map(([k,v])=>[k,v.length])),...Object.fromEntries(Object.entries(manifest).map(([k,v])=>['registered'+k[0].toUpperCase()+k.slice(1),Object.keys(v).length])),nonOriginalSheets:sheets.filter(r=>!r.original&&r.frames.length).length,unusedSheets:sheets.filter(r=>!r.frames.length).length,nonOriginalItems:consumers.items.filter(r=>r.bindings.some(b=>!b.original)).length,nonOriginalAbilities:consumers.abilities.filter(r=>r.bindings.some(b=>!b.original)).length,nonOriginalUI:Object.values(manifest.ui).filter(url=>!url.includes('/original/')).length,sharedItemIconGroups:sharedItemIcons.length},definitions,consumers,sheets,preloadedGround:ground.map(binding),sharedItemIcons,registry:manifest}
mkdirSync(dirname(resolve(output)),{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({output,counts:result.counts}))
