import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {makeWorld} from './helpers'
import {player,tileAt,TURNS_PER_HOUR} from '../src/core/ctx'
import {addWound,painTotal} from '../src/core/body'
import {THERMAL_REGIONS} from '../src/core/thermal'
export function conditionThoughtsFixture(seed='condition-thoughts',overworld=false){
 const w=makeWorld(seed,'Bg.Hunter',overworld),p=player(w)
 w.s.creatures=[p];w.s.time=12*TURNS_PER_HOUR*100;w.s.weather='clear';w.s.map.lights=[];p.nextAct=w.s.time;w.s.weatherUntil=1e12;w.s.wind={x:0,y:0};w.s.storyteller.budget=-1e9
 // 초기 검사 장면의 시계를 다시 정했다. 생성 직후의 더 늦은 관찰 시점을 이 장면의 과거로 주장하지 않는다.
 for(const t of w.s.map.tiles)delete t.observed
 p.traits=[];p.background=undefined;p.age=undefined;p.abilities=[];p.equip={};p.bag=[];p.body.wounds=[];p.body.tourniquets={};p.effects=[];p.diseases=[];p.thoughts=[];p.traumas=[]
 Object.assign(p.needs,{bodyTemp:37,wetness:0,skinWetness:{},hygiene:70,fatigue:20,sleepDebt:0,kcal:1000,waterDeficit:0,stress:10})
 for(let y=p.pos.y-4;y<=p.pos.y+4;y++)for(let x=p.pos.x-4;x<=p.pos.x+4;x++){const tile=tileAt(w,{x,y});if(tile){tile.t='Terrain.Earth';tile.roof=true;tile.items=[]}}
 invalidateLights(w);updatePlayerVision(w,p)
 const wet=(n:number)=>{p.needs.skinWetness=Object.fromEntries(THERMAL_REGIONS.map(r=>[r.id,n]))}
 // 실제 상처를 먼저 만들고 초기 장면의 남은 통증량을 설정한다. 턴 중에는 수치를 주입하지 않는다.
 const pain=(n:number)=>{p.body.wounds=[];if(!n)return;const wd=addWound(w,p,{def:'Wound.Cut',part:'LeftForearm',severity:1,source:'검사 초기 부상'}).wound;const factor=painTotal(w,p);wd.severity=n/factor}
 return {w,s:w.s,p,wet,pain}
}

export type ConditionThoughtPhase='cold'|'hot'|'wet'|'dirty'|'pain'|'fatigue'
export async function conditionThoughtsNativeFixture(phase:ConditionThoughtPhase){
 const d=conditionThoughtsFixture(),{playerAct}=await import('../src/core/game')
 if(phase==='cold')d.p.needs.bodyTemp=34.8
 if(phase==='hot')d.p.needs.bodyTemp=38
 if(phase==='wet')d.wet(55)
 if(phase==='dirty')d.p.needs.hygiene=10
 if(phase==='pain')d.pain(45)
 if(phase==='fatigue')d.p.needs.fatigue=71
 const at=d.s.time,error=playerAct(d.w,phase==='fatigue'?{type:'rest',turns:20}:{type:'wait'},phase==='fatigue'?1:undefined)
 if(error)throw Error(error)
 updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,actualFirstTurns:(d.s.time-at)/100,pending:phase==='fatigue'}}
}
