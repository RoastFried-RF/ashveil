import {creatureAt,inBounds,player,terrainAt,tileAt,TURNS_PER_HOUR,type World} from '../src/core/ctx'
import {newGame,playerAct} from '../src/core/game'
import {perform} from '../src/core/actions'
import {addEffect} from '../src/core/traits'
import {activeBeddingLice} from '../src/core/bedding-lice'
import {cheb,DIRS,dirIndex} from '../src/core/geom'
import {findPath} from '../src/core/path'
import {initializeSettlement} from '../src/core/settlements'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {isWaterVessel} from '../src/core/water-vessels'
import {drinkVolume} from '../src/core/wash-water'
import {db} from './helpers'
const template=newGame(db,{seed:'actual-resident-hygiene-0',overworld:true})
export function residentHygieneFixture(){
 const w:World={db,s:structuredClone(template)},s=w.s,p=player(w),m=s.overworld!,site=m.sites.find(s=>s.kind==='settlement'&&s.faction==='coalition')!
 m.currentRegion=site.id;m.position={...site.cell};s.creatures=[p];s.time=12*TURNS_PER_HOUR*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:20,y:20};s.sources=[];s.storyteller.budget=-1e9
 for(let y=10;y<=36;y++)for(let x=14;x<=45;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
 initializeSettlement(w)
 const c=s.creatures.find(c=>c.clinicSite)!,well=s.map.residentWell!,bed=s.map.residentBeds!.find(b=>b.owner===c.id)!
 for(const a of s.creatures){a.nextAct=a.id===p.id||a.id===c.id?s.time:1e12;a.age=undefined;a.traits=[];a.abilities=[];a.skills={};a.traumas=[];a.effects=[];a.thoughts=[];a.body.wounds=[];a.body.missing=[];a.body.blood=a.body.bloodMax;a.equip={};a.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(a.needs,{kcal:2500,waterDeficit:0,bodyTemp:37,fatigue:10,sleepDebt:0,hygiene:70,protein:100,vitamin:100,wetness:0,stress:0});a.hands={kind:'washed',at:s.time/100}}
 const bottles=c.bag.filter(i=>isWaterVessel(w,i)).slice(0,2),uids=bottles.map(i=>i.uid);c.bag=c.bag.filter(i=>!isWaterVessel(w,i)||uids.includes(i.uid));for(const b of bottles){b.uses=0;delete b.water}
 c.needs.hygiene=0;c.money=0;s.map.lights=[{pos:{x:32,y:18},radius:12,kind:'campfire'}];invalidateLights(w);updatePlayerVision(w,p)
 const water=()=>c.bag.reduce((n,i)=>n+(!w.db.item(i.def).drink?.alcohol?drinkVolume(w,i):0),0)
 const wait=(turns=1)=>{for(let i=0;i<turns;i++){const e=playerAct(w,{type:'wait'});if(e)throw Error(e)}}
 return{w,s,p,c,well,bed,bottles,water,wait}
}

export function residentHygieneNativeFixture(phase:'initial'|'body'|'bodyDone'|'bedding'|'clean'|'pending'='initial'){
 const d=residentHygieneFixture()
 // 유효한 초기 보균자. 침구 오염은 이 원래 몸의 실제1턴 휴식으로만 생긴다.
 d.c.pos={...d.bed.pos};d.p.pos={x:d.bed.pos.x+1,y:d.bed.pos.y};addEffect(d.c,'lice',Number.MAX_SAFE_INTEGER)
 if(!perform(d.w,d.c,{type:'rest',turns:1}).ok)throw Error('actual original carrier rest')
 const ready=()=>phase==='initial'?!!activeBeddingLice(d.w,d.bed.pos):phase==='body'||phase==='pending'?d.c.activity?.kind==='wash':phase==='bodyDone'?d.c.needs.hygiene>=60:phase==='bedding'?d.c.activity?.kind==='washBedding':d.c.needs.hygiene>=60&&!activeBeddingLice(d.w,d.bed.pos)
 let guard=0;while(!ready()&&guard++<900)d.wait();if(!ready())throw Error('actual resident hygiene phase '+phase)
 // 플레이어도 같은 실제 지도 위를 걸어 가까이서 확인한다.
 for(let i=0;cheb(d.p.pos,d.c.pos)>1&&i<40;i++){
  const paths=DIRS.map(v=>({x:d.c.pos.x+v.x,y:d.c.pos.y+v.y})).filter(p=>inBounds(d.w,p)&&terrainAt(d.w,p).passable&&(!creatureAt(d.w,p)||creatureAt(d.w,p)?.id===d.p.id)).map(p=>findPath(d.w,d.p.pos,p,{avoidCreatures:true,selfId:d.p.id})).filter((p):p is NonNullable<typeof p>=>!!p?.length).sort((a,b)=>a.length-b.length)
  const next=paths[0]?.[0];if(!next)throw Error('actual observer walk path')
  const error=playerAct(d.w,{type:'move',dir:dirIndex(next.x-d.p.pos.x,next.y-d.p.pos.y)});if(error)throw Error(error)
 }
 if(cheb(d.p.pos,d.c.pos)>1)throw Error('actual observer not beside resident')
 if(phase==='pending'){const error=playerAct(d.w,{type:'rest',turns:500},1);if(error||!d.s.simulationPending)throw Error('actual pending resident body/bedding work')}
 updatePlayerVision(d.w,d.p);return d
}
