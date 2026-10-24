import type {AbilityDef,CreatureDef,ItemDef,TerrainDef,World} from '../../core'
import {creatureSprite} from './creature-sprite'
import {mapIconKeys} from './terrain-art'
/** Saved appearances and resolved active definitions only; no simulation, visibility or RNG edits. */
export function worldAssets(w:World){
 const fallback=w.db.all<CreatureDef>('Creature').filter(c=>!c.char).flatMap(c=>Array.isArray(c.sprite)?c.sprite:c.sprite?[c.sprite]:[])
 const icons=[...new Set([...mapIconKeys,...fallback,...w.db.all<ItemDef>('Item').map(i=>i.sprite),...w.db.all<AbilityDef>('Ability').map(a=>a.icon),...w.db.all<TerrainDef>('Terrain').flatMap(t=>[...t.sprites,...(t.visual?[t.visual.sprite]:[])])])].sort()
 const characters=[...new Set(w.s.creatures.map(c=>creatureSprite(w,c)))].sort()
 return{icons,characters,key:w.db.loadHash+'\n'+JSON.stringify([icons,characters])}
}
