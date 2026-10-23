import type {TerrainDef,Tile} from '../../core/types'
import families from './crop-art.json'

export const cropArtFrames=families.flatMap(row=>[...row.stages,...(row.spent?[row.spent]:[])])

/** Read only the sanitized display tile. Unseen fields always use a neutral frame. */
export function cropArt(terrain:Pick<TerrainDef,'id'|'visual'|'gather'>,tile:Pick<Tile,'cultivation'|'gatherAt'>,visible:boolean,now:number){
 const family=families.find(row=>row.terrain===terrain.id),visual=terrain.visual
 if(!family||!visual||visual.sprite!==family.default.sprite||visual.scale!==family.default.scale||visual.tint!==family.default.tint)return
 let sprite=family.stages[0]!
 if(visible){
  const state=tile.cultivation,total=terrain.gather?.regrowTurns??0
  if(state&&state.terrain===terrain.id&&Number.isFinite(state.growth)&&state.growth>=0&&total>0&&state.growth<=total){
   const fraction=state.growth/total
   sprite=family.spent&&state.remainingCycles===0?family.spent:family.stages[fraction>=1?4:fraction>=.65?3:fraction>=.25?2:1]!
  }else if(!state)sprite=family.stages[(tile.gatherAt??0)>now?1:4]!
 }
 return{sprite,worldHeight:16}
}
