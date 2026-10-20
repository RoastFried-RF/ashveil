import {loadDb} from '../tools/loadContent'
import {newGame,playerAct,runUntilInput,markCleared} from '../src/core/game'
import {leaveRegion} from '../src/core/journey'
import {player,creatureAt,terrainAt,inBounds,tileAt,type World} from '../src/core/ctx'
import {marketFor} from '../src/core/economy'
import {DIRS} from '../src/core/geom'
import {allItems,itemDef} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,deserialize} from '../src/core/save'
import type {Action} from '../src/core/actions'
export type CropSuppliesPhase='initial'|'prepared'|'planted'|'pending'|'pendingCraft'
export function residentCropSuppliesFixture(phase:CropSuppliesPhase='initial',warm=true){
 const loaded=loadDb();if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'))
 const w:World={db:loaded.db,s:newGame(loaded.db,{seed:'actual-resident-crop-supplies',background:'Bg.Hunter',overworld:true})};runUntilInput(w)
 const p=player(w),originalItems=allItems(p).map(i=>i.uid),originalHp=p.hp,originalBody=structuredClone(p.body),originalActors=w.s.creatures.map(c=>c.id),site=w.s.overworld!.sites.find(s=>s.id==='Region.ShadeGrove')!
 // 원래 인물은 Core 지역 저장에 보존한다. 목적지 길목/온난 조건은 초기 장면이며 실제 장거리 여행 이력은 만들지 않는다.
 const leaveError=leaveRegion(w,markCleared);if(leaveError)throw Error(leaveError);runUntilInput(w)
 const m=w.s.overworld!;m.position={...site.cell};w.s.map.worldCell={...site.cell};if(warm)m.cells[site.cell.y*m.w+site.cell.x].temperature=20
 const act=(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 act({type:'enterRegion'});const s=w.s,c=s.creatures.find(c=>c.traderSite===site.id)!,market=marketFor(w,c)!,townActors=s.creatures.map(c=>c.id)
 const initialStock=market.items.filter(i=>['Item.Wood','Item.Cloth','Item.Whitecap'].includes(i.def)).map(i=>({uid:i.uid,def:i.def,count:i.count})),initialBank=market.money,initialNpcMoney=c.money
 // 선언된 관찰 시작 자리다. 플레이어에게 재료/종자/돈을 주거나 NPC를 옮기지 않는다.
 const observer=DIRS.map(v=>({x:c.pos.x+v.x,y:c.pos.y+v.y})).find(pos=>inBounds(w,pos)&&terrainAt(w,pos).passable&&!creatureAt(w,pos))!;p.pos={...observer};p.facing=2
 const beforeLight=s.time
 if(allItems(p).some(i=>itemDef(w,i).light&&i.lit))throw Error('quiet observer must keep original personal lights unlit')
 // 원래 휴대 등불을 켜지 않는다. 그늘 주민의 빛 회피와 경계를 억지로 끄지 않는다.
 invalidateLights(w);updatePlayerVision(w,p)
 const start=s.time
 if(phase==='prepared'||phase==='planted')for(let i=0;i<200;i++){
  if(phase==='prepared'&&c.bag.some(i=>i.def==='Item.WhitecapCulture')||phase==='planted'&&c.residentPlot)break
  act({type:'wait'});if(i===199)throw Error('actual resident crop preparation/planting did not finish')
 }
 if(phase==='pendingCraft')for(let i=0;i<4;i++)act({type:'wait'})
 if(phase==='pending'||phase==='pendingCraft')act({type:'rest',turns:200},1)
 if(originalItems.some(uid=>!allItems(p).some(i=>i.uid===uid)))throw Error('original player item disappeared during initial real observation')
 const proof={phase,originalActors,originalTownActors:townActors,originalItems,originalHp,originalBody,originalResident:c.id,initialStock,initialBank,initialNpcMoney,declaredArrivalWithoutEarlierJourney:true,declaredWarmDestination:warm,declaredAdjacentObserverPosition:true,actualFiniteLanternPreparationTU:start-beforeLight,actualPostObserverPreparationTU:s.time-start,previousRegionResidentsPreservedInScene:true,observesWithoutPersonalLight:true,initialRendererFx:s.fx.splice(0)}
 const copy:World={db:w.db,s:deserialize(serialize(s))},cs=copy.s,cp=player(copy),resident=cs.creatures.find(t=>t.id===c.id)!,shop=marketFor(copy,resident)!
 invalidateLights(copy);updatePlayerVision(copy,cp)
 return{w:copy,s:cs,p:cp,c:resident,market:shop,act:(a:Action,budget?:number)=>{const error=playerAct(copy,a,budget);if(error)throw Error(error)},proof,plot:()=>resident.residentPlot&&tileAt(copy,resident.residentPlot.pos).cultivation}
}
