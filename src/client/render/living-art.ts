import type { TerrainDef } from '../../core'
import families from './living-art.json'

export const livingArtFrames=families.flatMap(row=>row.variants.map(variant=>variant.sprite))

/** 등록된 두 생목의 기존 기본 표현에만 적용한다. 명시적인 모드 시각 설정은 보존한다. */
export function livingTreeArt(terrain:Pick<TerrainDef,'id'|'visual'>,hash:number){
 const family=families.find(row=>row.terrain===terrain.id),visual=terrain.visual
 if(!family||!visual||visual.sprite!==family.default.sprite||visual.scale!==family.default.scale||visual.tint!==family.default.tint)return undefined
 const row=family.variants[(hash>>>2)%family.variants.length]!
 return{sprite:row.sprite,worldHeight:row.worldHeight,anchor:row.anchor as [number,number]}
}
