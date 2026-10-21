import {worldCartographyFixture} from './world-cartography-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {revealWorld} from '../src/core/overworld'
import {turnOf} from '../src/core/ctx'

/** 유한 초기 장면. 과거 영토 변경/이동/생산을 실행했다고 주장하지 않는다. */
export function worldTerritoriesFixture(legacy=false){
 const d=worldCartographyFixture(),{w,s,p,m}=d
 const index=m.cells.findIndex((c,i)=>i%m.w>=3&&i%m.w<m.w-3&&i>=m.w*3&&i<m.cells.length-m.w*3&&c.territory&&[i-1,i+1,i-m.w,i+m.w].some(j=>m.cells[j].territory&&m.cells[j].territory!==c.territory))
 if(index<0)throw Error('실제 생성된 육로 영향권 경계가 필요하다')
 m.position={x:index%m.w,y:Math.floor(index/m.w)};m.currentRegion=undefined;m.travel=undefined;m.seen=[];m.worldObservations={};s.map.worldCell={...m.position};s.map.name='실제 육로 영향권의 당시 기록 검증실';revealWorld(m,turnOf(w),'survey')
 const current=m.cells[index].territory!,old=current==='guild'?'coalition':'guild';m.worldObservations[index].cell.territory=old
 p.bag=[];p.hotbar=Array(10).fill(null)
 const items=[];for(const def of['Item.Salt','Item.GlassEye','Item.PowerCell','Item.HealthDraught','Item.PurificationAmpoule','Item.WaterBottle','Item.WaterBucket']){const item=makeItem(w,def);if(def==='Item.WaterBottle'){item.uses=1.5;item.water={pathogen:0,ash:0,source:'유한 초기 식수300ml'}}if(def==='Item.WaterBucket'){item.uses=0;delete item.water}if(addToBag(w,p,item)!==0)throw Error('유한 초기7물품 배치');items.push(item)}
 if(legacy){for(const c of m.cells)delete c.territory;for(const o of Object.values(m.worldObservations))delete o.cell.territory}
 s.fx=[]
 return{...d,index,current,old,items,bottle:items[5],bucket:items[6],legacy}
}
