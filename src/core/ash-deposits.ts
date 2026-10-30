/** Finite physical catchments. Queries project; only clock/action hooks commit. */
import {inBounds,tileAt,turnOf,TURNS_PER_DAY,type World}from'./ctx'
import type{Pos}from'./geom'
import type{AshDepositDef,AshDepositState,MapState,WorldTower}from'./types'

const OUTPUT_SCALE=1000,DENOMINATOR=100*OUTPUT_SCALE*TURNS_PER_DAY
const output=(n:number)=>BigInt(Math.round(Math.max(0,Math.min(100,n))*OUTPUT_SCALE))
const key=(map:MapState,p:Pos)=>map.worldCell!.x+','+map.worldCell!.y+'/'+map.id+'/'+p.x+','+p.y
const onMap=(pool:AshDepositState,map:MapState)=>!!map.worldCell&&pool.map===map.id&&pool.cell.x===map.worldCell.x&&pool.cell.y===map.worldCell.y
/** Exact fixed-point integral over actual output changes, not residual atmospheric dust. */
function emitted(t:WorldTower,from:number,to:number){
 let at=from,level=t.history?.[0]?.output??t.output,total=0n
 for(const row of t.history??[])if(row.turn<=from)level=row.output;else break
 for(const row of t.history??[]){
  if(row.turn<=from)continue
  if(row.turn>=to)break
  total+=BigInt(row.turn-at)*output(level);at=row.turn;level=row.output
 }
 return total+BigInt(to-at)*output(level)
}
function projected(t:WorldTower,pool:AshDepositState,now:number){
 if(now<=pool.at)return{stock:pool.stock,remainder:pool.remainder,deposited:pool.deposited,lost:pool.lost}
 const numerator=BigInt(pool.remainder)+(pool.exposed?emitted(t,pool.at,now)*BigInt(pool.rate):0n)
 const units=Number(numerator/BigInt(DENOMINATOR)),stock=Math.min(pool.capacity,pool.stock+units)
 return{stock,remainder:Number(numerator%BigInt(DENOMINATOR)),deposited:pool.deposited+units,lost:pool.lost+pool.stock+units-stock}
}
function commit(t:WorldTower,pool:AshDepositState,now:number){Object.assign(pool,projected(t,pool,now));pool.at=now}
function current(w:World,p:Pos){
 if(!w.s.map.worldCell||!inBounds(w,p))return
 const id=w.db.terrain(tileAt(w,p).t).gather?.ashDeposit,d=id?w.db.tryGet<AshDepositDef>(id):undefined,t=d?w.s.overworld?.towers.find(t=>t.id===d.source):undefined
 const pool=t?.ashDeposits?.[key(w.s.map,p)]
 return d&&t&&pool?{d,t,pool}:undefined
}
/** Adding content never overwrites a person's floor, property, crop or dropped items. */
export function initializeAshDeposits(w:World,fresh=false){
 const m=w.s.overworld,map=w.s.map;if(!m||!map.worldCell)return
 for(const d of w.db.all<AshDepositDef>('AshDeposit')){
  const tower=m.towers.find(t=>t.id===d.source);if(!tower)continue
  for(const place of d.placements){
   if(place.site!==m.currentRegion||place.map!==map.id)continue
   const pos={x:place.pos[0],y:place.pos[1]};if(!inBounds(w,pos))continue
   const id=key(map,pos);if(tower.ashDeposits?.[id])continue
   const tile=tileAt(w,pos),terrain=w.db.terrain(tile.t)
   if(!d.ground.includes(tile.t)||tile.roof||tile.placed||tile.cultivation||tile.cont||tile.items.length||w.s.creatures.some(c=>c.pos.x===pos.x&&c.pos.y===pos.y)||map.exits.some(p=>p.x===pos.x&&p.y===pos.y))continue
   if(!terrain.passable||terrain.container||terrain.door||terrain.water||terrain.stairs||terrain.station||terrain.gather||terrain.bedding||terrain.residentWell||terrain.residentDepot)continue
   // A newly generated landscape may contain old drift. Previously visited ground starts empty.
   const initial=fresh?d.initial:0
   tile.t=d.terrain
   ;(tower.ashDeposits??={})[id]={map:map.id,cell:{...map.worldCell},pos,terrain:d.terrain,at:turnOf(w),initial,deposited:0,taken:0,lost:0,stock:initial,remainder:0,exposed:true,rate:d.unitsPerDayAt100,capacity:d.capacity}
  }
 }
}
/** Close intervals before terrain/roof mutations or a scene transition. */
export function settleAshDeposits(w:World){
 const now=turnOf(w)
 for(const t of w.s.overworld?.towers??[])for(const pool of Object.values(t.ashDeposits??{}))if(onMap(pool,w.s.map))commit(t,pool,now)
}
/** Same-time exposure update; covers do not grant the past interval's ash on reopening. */
export function refreshAshExposure(w:World){
 for(const t of w.s.overworld?.towers??[])for(const pool of Object.values(t.ashDeposits??{})){
  if(!onMap(pool,w.s.map)||!inBounds(w,pool.pos))continue
  const tile=tileAt(w,pool.pos),id=w.db.terrain(tile.t).gather?.ashDeposit,d=id?w.db.tryGet<AshDepositDef>(id):undefined
  if(d?.source===t.id){
   pool.terrain=d.terrain;pool.rate=d.unitsPerDayAt100;pool.capacity=d.capacity
   if(pool.stock>pool.capacity){pool.lost+=pool.stock-pool.capacity;pool.stock=pool.capacity}
  }
  pool.exposed=tile.t===pool.terrain&&!tile.roof
 }
}
export function ashDepositCount(w:World,p:Pos){const q=current(w,p);return q?projected(q.t,q.pool,turnOf(w)).stock:0}
export function takeAshDeposit(w:World,p:Pos,count:number){
 const q=current(w,p);if(!q||!Number.isSafeInteger(count)||count<=0)return 0
 commit(q.t,q.pool,turnOf(w));const taken=Math.min(count,q.pool.stock);q.pool.stock-=taken;q.pool.taken+=taken;return taken
}
/** Historical raw material survives missing current Defs; malformed ledgers do not. */
export function validateAshDeposits(s:import('./types').GameState){
 const now=Math.floor(s.time/100),integer=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0
 for(const tower of s.overworld?.towers??[]){
  const pools=tower.ashDeposits;if(pools===undefined)continue
  if(!pools||typeof pools!=='object'||Array.isArray(pools)||Object.keys(pools).length>256)throw Error('분출 재 채집처 장부 형식이 올바르지 않다')
  for(const[id,p]of Object.entries(pools)){
   if(!p||typeof p!=='object'||typeof p.map!=='string'||!p.map||p.map.length>256||typeof p.terrain!=='string'||!p.terrain||!p.cell||!p.pos||![p.cell.x,p.cell.y,p.pos.x,p.pos.y,p.at,p.initial,p.deposited,p.taken,p.lost,p.stock,p.remainder,p.rate,p.capacity].every(integer)||p.at>now||p.cell.x>=s.overworld!.w||p.cell.y>=s.overworld!.h||p.pos.x>1000000||p.pos.y>1000000||p.capacity<1||p.capacity>1000||p.rate<1||p.rate>1000||p.initial>1000||p.stock>p.capacity||p.remainder>=DENOMINATOR||typeof p.exposed!=='boolean'||!Number.isSafeInteger(p.initial+p.deposited)||p.initial+p.deposited!==p.taken+p.lost+p.stock||id!==p.cell.x+','+p.cell.y+'/'+p.map+'/'+p.pos.x+','+p.pos.y)throw Error('같은 탑의 실제 재 유입·잔량·채집·넘침 수지가 올바르지 않다')
  }
 }
}
