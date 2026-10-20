// 실제 이동 상점의 유한 격자. 견적은 원래 물품·UID를 바꾸지 않는다.
import type { World } from './ctx'
import { gridSpot, itemDef, maxStack } from './items'
import type { ItemInst, SettlementMarket, WorldSimulationDef } from './types'
export const caravanRules=(w:World)=>w.db.get<WorldSimulationDef>('WorldSimulation.Hearth').caravans!
export function mobileCargoLayout(w:World,market:SettlementMarket,items:ItemInst[]){
 if(!market.mobile)return{error:null as string|null,positions:[] as {uid:number;x:number;y:number;rot:boolean}[]}
 const [width,height]=caravanRules(w).grid,grid={items:[] as ItemInst[],w:width,h:height},positions:{uid:number;x:number;y:number;rot:boolean}[]=[]
 const order=[...items].sort((a,b)=>{const x=itemDef(w,a).size,y=itemDef(w,b).size;return y[0]*y[1]-x[0]*x[1]||a.uid-b.uid})
 for(const it of order){const d=itemDef(w,it);if(!Number.isSafeInteger(it.count)||it.count<1||it.count>maxStack(d))return{error:'원래 화물 더미의 수량이 격자 한도를 넘는다',positions:[]};const p=gridSpot(w,grid,d);if(!p)return{error:'이동 상점의 실제 화물 격자에 들어가지 않는다',positions:[]};const placed={...it,gx:p[0],gy:p[1],rot:p[2]||undefined};grid.items.push(placed);positions.push({uid:it.uid,x:p[0],y:p[1],rot:p[2]})}
 return{error:null,positions}
}
