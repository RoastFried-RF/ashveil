import type {AbilityDef,CreatureDef,ItemDef,TerrainDef,World} from '../../core'
import {creatureSprite} from './creature-sprite'
import {mapIconKeys} from './terrain-art'
import manifest from '../sprites.json'
import type {CharDef} from './atlas'
import {humanArtFor} from './human-art'
import {humanReplacementFrameKeys} from './human-spec'
const charactersByName=manifest.chars as unknown as Record<string,CharDef>
/** Saved appearances and resolved active definitions only; no simulation, visibility or RNG edits. */
export function worldAssets(w:World){
 const fallback=w.db.all<CreatureDef>('Creature').filter(c=>!c.char).flatMap(c=>Array.isArray(c.sprite)?c.sprite:c.sprite?[c.sprite]:[])
 const replacements=w.s.creatures.flatMap(c=>{
  const appearance=charactersByName[creatureSprite(w,c)]
  if(!appearance?.human)return[]
  const defs=new Set(Object.values(c.body.prosthetics??{}).map(p=>p.def))
  return defs.size?humanReplacementFrameKeys(humanArtFor(appearance.humanSpec),defs):[]
 })
 const icons=[...new Set([...mapIconKeys,...fallback,...replacements,...w.db.all<ItemDef>('Item').map(i=>i.sprite),...w.db.all<AbilityDef>('Ability').map(a=>a.icon),...w.db.all<TerrainDef>('Terrain').flatMap(t=>[...t.sprites,...(t.visual?[t.visual.sprite]:[])])])].sort()
 const characters=[...new Set(w.s.creatures.map(c=>creatureSprite(w,c)))].sort()
 return{icons,characters,key:w.db.loadHash+'\n'+JSON.stringify([icons,characters])}
}
