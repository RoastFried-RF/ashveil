// 정착지에서 실제 육로로 닿는 초기 영향권. 지형/인구/관계/난수를 바꾸지 않는다.
import type {World} from './ctx'
import type {FactionDef,OverworldState,WorldGenDef} from './types'

/** 순수 초기 생성 단계. 바다를 건너거나 아직 없는 정착지를 근거로 삼지 않는다. */
export function buildWorldTerritories(w:World,m:OverworldState):(string|undefined)[]{
 const rules=w.db.get<WorldGenDef>(m.def).territory,owners:(string|undefined)[]=Array(m.cells.length).fill(undefined)
 if(!rules)return owners
 const factions=new Map(w.db.all<FactionDef>('Faction').filter(f=>!f.territorial).map(f=>[f.key,f])),costs=new Float64Array(m.cells.length).fill(Infinity)
 const buckets:{index:number;owner:string}[][]=Array.from({length:rules.maxCost+1},()=>[])
 const offer=(index:number,owner:string,cost:number)=>{
  const prior=owners[index]
  if(cost>rules.maxCost||m.cells[index].sea||cost>costs[index]||cost===costs[index]&&prior!==undefined&&prior<=owner)return
  costs[index]=cost;owners[index]=owner;buckets[cost].push({index,owner})
 }
 for(const site of m.sites){const{x,y}=site.cell;if(site.faction&&factions.has(site.faction)&&Number.isSafeInteger(x)&&Number.isSafeInteger(y)&&x>=0&&y>=0&&x<m.w&&y<m.h)offer(y*m.w+x,site.faction,0)}
 for(let cost=0;cost<=rules.maxCost;cost++)for(let at=0;at<buckets[cost].length;at++){
  const{index,owner}=buckets[cost][at];if(costs[index]!==cost||owners[index]!==owner)continue
  const x=index%m.w,y=Math.floor(index/m.w),from=m.cells[index]
  for(const[dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){
   const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=m.w||ny>=m.h)continue
   const next=ny*m.w+nx,to=m.cells[next];if(to.sea)continue
   const step=(from.road&&to.road?rules.roadCost:rules.landCost)+(!!from.river!==!!to.river?rules.riverCost:0)+Math.ceil(Math.abs(to.altitude-from.altitude)/rules.riseMetersPerCost)
   offer(next,owner,cost+step)
  }
 }
 return owners
}
