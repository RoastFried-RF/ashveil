import { describe, expect, it } from 'vitest'
import { checkpointQuote, currentSaveMode, IMPRINT_MODE, saveModeDef } from '../src/core/save-modes'
import { newGame, SAVE_VERSION } from '../src/core/game'
import { deserialize, serialize } from '../src/core/save'
import { player, tileAt, turnOf } from '../src/core/ctx'
import { invalidateLights } from '../src/core/fov'
import { loadMods } from '../src/core/defs'
import { readPackages } from '../tools/loadContent'
import { db } from './helpers'
import { prisonerFixture } from './prisoner-fixture'
import { addToBag, makeItem } from '../src/core/items'
import { activityStep, perform } from '../src/core/actions'
import { fireTurnsLeft, startFireWork } from '../src/core/campfire'
import { initializeSettlement } from '../src/core/settlements'
import { rentInnBed } from '../src/core/inn'

function fixture(mode='SaveMode.Waymark'){
 const w={db,s:newGame(db,{seed:'save-mode-location',saveMode:mode})},p=player(w)
 p.pos={x:20,y:20};w.s.map.lights=[];w.s.map.innBeds=[]
 for(let y=18;y<=23;y++)for(let x=18;x<=23;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.KtFloor',items:[]})
 return{w,p}
}
describe('저장 방식의 순수 규칙과 구형 저장 호환',()=>{
 it('기본 각인은 필드를 새로 만들지 않으며 다른 방식은 같은 물리 세계/난수와 업적 차단만 갖는다',()=>{
  const base=newGame(db,{seed:'same-physics'});expect(base.saveMode).toBeUndefined();expect(base.achievementsDisabled).toBeUndefined()
  for(const mode of ['SaveMode.Waymark','SaveMode.Study']){const s=newGame(db,{seed:'same-physics',saveMode:mode});expect(s.saveMode).toBe(mode);expect(s.achievementsDisabled).toBe(true);delete s.saveMode;delete s.achievementsDisabled;expect(serialize(s)).toBe(serialize(base))}
  expect(()=>newGame(db,{seed:'bad',saveMode:'Item.Stone'})).toThrow('저장 방식');expect(()=>saveModeDef(db,'SaveMode.Absent')).toThrow('저장 방식')
 })
 it('204는 버전만 이행하고 과거 표석/정책/난수를 추정하지 않는다',()=>{
  const s=newGame(db,{seed:'save-mode-migration'});s.version=204;const raw=serialize(s),restored=deserialize(raw);expect(restored.version).toBe(SAVE_VERSION);expect(serialize(restored)).toBe(serialize({...s,version:SAVE_VERSION}));expect(currentSaveMode({db,s:restored}).id).toBe(IMPRINT_MODE)
  for(const value of [null,0,'',' ',' SaveMode.Study',{},'x'.repeat(257)])expect(()=>deserialize(JSON.stringify({...s,saveMode:value}))).toThrow('저장 방식')
 })
 it('정의의 모순되는 저장/복원/업적 정책을 실제 로더가 거부한다',()=>{
  for(const [path,value]of [['/manual','bad'],['/anchorDistance',4],['/anchorDistance',-1],['/anchorDistance',0.5],['/restoreAfterDeath',false],['/achievements',true]]as const){
   const pkgs=readPackages();pkgs.find(p=>p.manifest.id==='core')!.patches.push({op:'replace',target:'SaveMode.Waymark',path,value});expect(loadMods(pkgs,[]).report.errors.length,path).toBeGreaterThan(0)
  }
 })
 it('기본은 수동 저장을 거부하고 탐구는 위치 제한 없이 전체 상태를 보존한다',()=>{
  for(const mode of [IMPRINT_MODE,'SaveMode.Study']){const{w}=fixture(mode),raw=serialize(w.s),q=checkpointQuote(w);expect(q.error===null).toBe(mode==='SaveMode.Study');expect(serialize(w.s)).toBe(raw)}
 })
 it('실제 켜진 모닥불에만 인접할 수 있고 원거리/소등/막힌 대각선을 거부한다',()=>{
  const{w,p}=fixture(),pos={x:21,y:21};tileAt(w,pos).t='Terrain.Campfire';w.s.map.lights=[{kind:'campfire',radius:5,pos}];invalidateLights(w)
  let raw=serialize(w.s);expect(checkpointQuote(w).anchor).toEqual({kind:'campfire',pos});expect(serialize(w.s)).toBe(raw)
  p.pos.x=19;expect(checkpointQuote(w).error).not.toBeNull();p.pos.x=20;w.s.map.lights[0].off=true;expect(checkpointQuote(w).error).not.toBeNull();w.s.map.lights[0].off=false
  tileAt(w,{x:21,y:20}).t='Terrain.KtWall';tileAt(w,{x:20,y:21}).t='Terrain.KtWall';raw=serialize(w.s);expect(checkpointQuote(w).error).not.toBeNull();expect(serialize(w.s)).toBe(raw)
  tileAt(w,{x:20,y:21}).t='Terrain.KtFloor';expect(checkpointQuote(w).error).toBeNull()
 })
 it('유한 설치 화로에 광원 기록만 위조되어도 실제 연료 없이는 저장을 허용하지 않는다',()=>{
  const{w}=fixture();w.s.map.lights=[{kind:'campfire',radius:5,pos:{x:21,y:20},sourceUid:999}];expect(checkpointQuote(w).error).not.toBeNull()
 })
 it('직접 설치/점화한 화로의 실제 연료가 있을 때만 저장할 수 있다',()=>{
  const{w,p}=prisonerFixture();w.s.creatures=[p];w.s.saveMode='SaveMode.Waymark';w.s.achievementsDisabled=true;for(const l of w.s.map.lights)l.off=true
  const kit=makeItem(w,'Item.CampfireKit'),wood=makeItem(w,'Item.Wood');addToBag(w,p,kit);addToBag(w,p,wood);expect(perform(w,p,{type:'place',uid:kit.uid,dir:6}).ok).toBe(true);const pos={x:19,y:20};expect(checkpointQuote(w).error).not.toBeNull();expect(startFireWork(w,p,pos,wood.uid)).toBeNull();for(let i=0;p.activity&&i<10000;i++)activityStep(w,p);expect(fireTurnsLeft(w,pos)).toBeGreaterThan(0);expect(checkpointQuote(w).anchor).toEqual({kind:'campfire',pos});w.s.map.lights.find(l=>l.sourceUid===kit.uid)!.fuelUntil=turnOf(w);expect(checkpointQuote(w).error).not.toBeNull()
 })
 it('원래 침대·본인 계약·미만료·인접 조건을 모두 요구한다',()=>{
  const{w,p}=fixture(),pos={x:21,y:20},bed={id:'declared-bed',keeper:999,terrain:'Terrain.KtFloor',pos,lease:{tenant:p.id,until:turnOf(w)+100}};w.s.map.innBeds=[bed]
  expect(checkpointQuote(w).anchor).toEqual({kind:'inn',pos});bed.lease.tenant=999;expect(checkpointQuote(w).error).not.toBeNull();bed.lease.tenant=p.id;bed.lease.until=turnOf(w);expect(checkpointQuote(w).error).not.toBeNull();bed.lease.until++;tileAt(w,pos).t='Terrain.Earth';expect(checkpointQuote(w).error).not.toBeNull();tileAt(w,pos).t=bed.terrain;p.pos.x=18;expect(checkpointQuote(w).error).not.toBeNull()
 })
 it('실제 정착지 여관에서 돈을 내어 맺은 숙박 계약을 저장 조건으로 읽는다',()=>{
  const w={db,s:newGame(db,{seed:'inn-contract',saveMode:'SaveMode.Waymark',overworld:true})},p=player(w),m=w.s.overworld!,site=m.sites.find(s=>s.kind==='settlement'&&s.faction==='coalition')!;m.currentRegion=site.id;m.position={...site.cell};w.s.creatures=[p];p.pos={x:29,y:18};p.money=100;p.age=undefined;p.traits=[];p.effects=[];p.body.wounds=[]
  for(let y=12;y<=24;y++)for(let x=24;x<=40;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
  initializeSettlement(w);for(const l of w.s.map.lights)l.off=true;const keeper=w.s.creatures.find(c=>c.traderSite)!,bed=w.s.map.innBeds![0];expect(rentInnBed(w,p,keeper,bed.id)).toBeNull();p.pos={...bed.pos};const before=serialize(w.s);expect(checkpointQuote(w).anchor).toEqual({kind:'inn',pos:bed.pos});expect(serialize(w.s)).toBe(before)
 })
 it('살아 있지 않은 탐구 원정에는 새 복원 지점을 남기지 않는다',()=>{const{w,p}=fixture('SaveMode.Study');p.alive=false;expect(checkpointQuote(w).error).toContain('끝난 원정')})
})
