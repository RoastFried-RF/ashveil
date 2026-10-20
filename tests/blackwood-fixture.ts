import { newGame, playerAct } from '../src/core/game'
import type { World } from '../src/core/ctx'
import { db } from './helpers'
export function blackwoodFixture(){
 const w:World={db,s:newGame(db,{seed:'blackwood-physical',background:'Bg.Hunter',overworld:true})},p=w.s.creatures.find(c=>c.id===w.s.playerId)!,m=w.s.overworld!,site=m.sites.find(s=>s.id==='Region.ShadeGrove')!
 p.bag=[];p.equip={};p.traits=[];p.effects=[];p.age=undefined;p.nextAct=w.s.time;p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.money=1000;Object.assign(p.needs,{bodyTemp:37,kcal:3000,waterDeficit:0,fatigue:10,sleepDebt:0,protein:100,vitamin:100,stress:0})
 // 지역 진입 전 실제 도착 좌표의 안전한 길목을 초기 조건으로 둔다.
 m.currentRegion=undefined;m.position={...site.cell};w.s.creatures=[p];w.s.maps={};w.s.offCreatures={};w.s.sources=[];w.s.map={id:'surface',name:'검은 숲 앞 길목',kind:'surface',depth:0,ambient:1,worldCell:{...site.cell},w:16,h:12,tiles:Array.from({length:192},()=>({t:'Terrain.Earth',v:0,roof:false,blood:0,items:[]})),exits:[],links:[],rooms:[],props:[],lights:[]};p.pos={x:8,y:6}
 const error=playerAct(w,{type:'enterRegion'});if(error)throw Error(error);return{w,p,m,site}
}
