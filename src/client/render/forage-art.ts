import type {TerrainDef,Tile} from '../../core/types'
import families from './forage-art.json'

export const forageArtFrames=families.flatMap(family=>family.pairs.flatMap(pair=>[pair.mature.sprite,pair.spent.sprite]))

/** Consume the last real observation only. No live crop clock, food amount or RNG. */
export function forageArt(terrain:Pick<TerrainDef,'id'|'visual'>,tile:Pick<Tile,'observed'|'v'>){
 const family=families.find(row=>row.terrain===terrain.id),visual=terrain.visual
 if(!family||visual?.sprite!==family.default.sprite||visual.scale!==family.default.scale||visual.tint!==undefined)return
 const variant=((Math.trunc(tile.v)%family.pairs.length)+family.pairs.length)%family.pairs.length,pair=family.pairs[variant]!
 const available=tile.observed?.terrain===terrain.id?tile.observed.gatherAvailable:undefined,state=available===true?'mature':available===false?'spent':'unknown',art=available===true?pair.mature:pair.spent
 return{...art,anchor:art.anchor as [number,number],scale:pair.scale,state,variant}
}
