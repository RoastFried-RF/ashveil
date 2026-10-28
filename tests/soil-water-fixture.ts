import {cultivationFixture} from './cultivation-fixture'
import {cultivationStatus,plantCultivation} from '../src/core/cultivation'
import {tileAt,turnOf} from '../src/core/ctx'
import {makeItem,addToBag} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export function soilWaterFixture(){
 const d=cultivationFixture(),a=d.pos,b={x:a.x,y:a.y+1}
 d.act({type:'place',uid:d.seedsUid,dir:2});d.act({type:'place',uid:d.seedsUid,dir:3})
 // 유한 초기 구획. 빛0/지붕으로 성장과 증발을 멈추고 수분 이동만 독립 관찰한다.
 d.s.map.daylightMult=0
 for(const p of[a,b])tileAt(d.w,p).roof=true
 const status=(p=a)=>cultivationStatus(d.w,p)!
 const nearBoundary=()=>{d.s.time=(Math.floor(turnOf(d.w)/200)*200+199)*100;d.p.nextAct=d.s.time;for(const p of[a,b])status(p).state.lastAt=turnOf(d.w)}
 return{...d,a,b,status,nearBoundary}
}
export function soilWaterNativeFixture(){
 const d=soilWaterFixture(),add=(id:string)=>{const i=makeItem(d.w,id);if(addToBag(d.w,d.p,i)!==0)throw Error('재배 원본 초기 배낭');return i}
 const root=add('Item.ShadeRoot'),whitecap=add('Item.Whitecap');d.nearBoundary();d.s.map.name='그늘 밭의 실제 남은 물·원본 작물 검증실';d.s.fx=[];invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return{...d,root,whitecap}
}
export function addSoilPlot(d:ReturnType<typeof soilWaterFixture>,x:number,y:number,waterMl=0){
 const pos={x,y},t=tileAt(d.w,pos);t.t='Terrain.ShadePlot';t.roof=true
 if(!plantCultivation(d.w,pos,d.seedsUid))throw Error('유효 초기 토양 밭')
 const s=cultivationStatus(d.w,pos)!;s.state.waterUnits=waterMl*s.total;return pos
}
