import {describe,expect,it} from 'vitest'
import {activeThoughts,capacity,deserialize,ensureSociety,loadMods,mood,newGame,player,reputation,resonanceState,serialize,stopTowerState,type World} from '../src/core'
import {conditionThoughts} from '../src/core/condition-thoughts'
import {gameObservation} from '../src/client/game-observation'
import {readPackages} from '../tools/loadContent'
import {resonanceFixture} from './resonance-fixture'
import {db} from './helpers'

describe('울림 듣는 자의 현재 청각과 초기 평판',()=>{
 it('실제 생성의 희귀 특성과 월드 시작 평판이 같은 배경 규칙에 연결된다',()=>{
  const w:World={db,s:newGame(db,{seed:'resonance-natural-103',background:'Bg.Excommunicate',overworld:true})},p=player(w)
  expect(p.traits).toEqual(['Trait.Pessimist','Trait.ResonantHearing']);expect(reputation(w,'pilgrims')).toBe(-10)
  expect(ensureSociety(w)!.reputation.pilgrims).toBe(-10);expect(ensureSociety(w)!.reputation.pilgrims).toBe(-10)
 })
 it('모드의 실제 감지 반경과 초기 평판을 읽고 정해진 기본 수치를 강제하지 않는다',()=>{
  const id='resonance-range',loaded=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'Trait.ResonantHearing',path:'/resonance/radius',value:14},{op:'replace',target:'Trait.ResonantHearing',path:'/initialReputation/pilgrims',value:7}]}],[id]);expect(loaded.report.errors).toEqual([])
  const d=resonanceFixture();d.w.db=loaded.db;expect(resonanceState(d.w,d.p).machine).toBe(false);d.machine.pos.x--;expect(resonanceState(d.w,d.p).machine).toBe(true);expect(reputation(d.w,'pilgrims')).toBe(-23)
 })
 it('15칸의 보이지 않는 작동 기계는 존재만 듣고16칸은 듣지 않는다',()=>{
  const d=resonanceFixture(),before=serialize(d.w.s)
  expect(d.w.s.visible).not.toContain(d.machine.pos.y*d.w.s.map.w+d.machine.pos.x)
  expect(resonanceState(d.w,d.p)).toEqual({machine:true,tower:false})
  const dto=gameObservation(d.w,'game');expect(dto.heardResonance).toEqual({machine:true,tower:false});expect(dto.visibleCreatures?.some(c=>c.id===d.machine.id)).toBe(false)
  expect(serialize(d.w.s)).toBe(before);d.p.pos.x--;expect(resonanceState(d.w,d.p).machine).toBe(false)
 })
 it('특성이 없는 사람은 숨은 기계가 있어도 듣지 않고 상태를 읽어 바꾸지 않는다',()=>{const d=resonanceFixture();d.p.traits=[];Object.defineProperty(d.machine,'body',{get(){throw Error('Hidden machine body accessed without trait')}});expect(resonanceState(d.w,d.p)).toEqual({machine:false,tower:false})})
 it.each(['asleep','unconscious','dead','deaf','otherMap']as const)('%s 상태는 듣지 않는다',state=>{
  const d=resonanceFixture()
  if(state==='asleep')d.p.asleep=true
  if(state==='unconscious')d.p.unconscious=true
  if(state==='dead')d.p.alive=false
  if(state==='otherMap')d.p.mapId='other-map'
  if(state==='deaf'){const ears=d.w.db.body(d.p.body.def).parts.filter(p=>p.capacities?.hearing);expect(ears.length).toBeGreaterThan(0);for(const p of ears)(d.p.body.organDamage??={})[p.id]=p.hp;expect(capacity(d.w,d.p,'hearing')).toBe(0)}
  expect(resonanceState(d.w,d.p)).toEqual({machine:false,tower:false})
 })
 it.each(['off','shutdown','dead','otherMap','otherFaction']as const)('%s 기계의 숨은 정비음을 들려주지 않는다',state=>{
  const d=resonanceFixture()
  if(state==='off')d.machine.body.machine!.power=0
  if(state==='shutdown')d.machine.body.machine!.shutdownUntil=d.w.s.time/100+1
  if(state==='dead')d.machine.alive=false
  if(state==='otherMap')d.machine.mapId='other-map'
  if(state==='otherFaction')d.machine.faction='guard'
  expect(resonanceState(d.w,d.p).machine).toBe(false)
 })
 it('두꺼운 벽은 음향 비용을 높이며 멀리 있는 기계의 위치를 도감에 넣지 않는다',()=>{const d=resonanceFixture();for(let y=0;y<d.w.s.map.h;y++)d.w.s.map.tiles[y*d.w.s.map.w+22].t='Terrain.KtWall';const before=serialize(d.w.s);expect(resonanceState(d.w,d.p).machine).toBe(false);expect(serialize(d.w.s)).toBe(before)})
 it('탑이 가동 중인 같은 지역에서만−3 조건 두통이고 지나간 사고로 저장하지 않는다',()=>{
  const d=resonanceFixture(true),thought=()=>activeThoughts(d.w,d.p).find(t=>t.def==='Thought.TowerResonance'),before=serialize(d.w.s)
  expect(resonanceState(d.w,d.p).tower).toBe(true);expect(thought()?.mood).toBe(-3);expect(conditionThoughts(d.w,d.p)).toContain('Thought.MachineResonance');expect(serialize(d.w.s)).toBe(before)
  d.w.s.map.worldCell!.x++;expect(thought()).toBeUndefined();expect(d.p.thoughts).toEqual([])
 })
 it('정지된 탑의 대기 잔류가 있어도 기계 고음과 두통을 계속 만들지 않는다',()=>{
  const d=resonanceFixture(true),tower=d.w.s.overworld!.towers.find(t=>t.cell.x===d.w.s.map.worldCell!.x&&t.cell.y===d.w.s.map.worldCell!.y)!
  const season=d.w.db.all<import('../src/core/types').SeasonDef>('Season')[0]!,rules=d.w.db.get<import('../src/core/types').ClimateDef>('Climate.Hearth').towerStop!
  expect(stopTowerState(d.w,tower.id,season,rules)).toBe(true);expect(tower.shutdown).toBeDefined();expect(resonanceState(d.w,d.p).tower).toBe(false);expect(activeThoughts(d.w,d.p).some(t=>t.def==='Thought.TowerResonance')).toBe(false)
 })
 it('같은 현재 몸·전원·기분을205저장 복원으로 순수 재조회한다',()=>{const d=resonanceFixture(true),raw=serialize(d.w.s),w:World={db:d.w.db,s:deserialize(raw)},p=player(w);expect(resonanceState(w,p)).toEqual(resonanceState(d.w,d.p));expect(mood(w,p)).toBe(mood(d.w,d.p));expect(serialize(w.s)).toBe(raw)})
 it('순례회 초기 평판+20을 한 번만 기록하고 기존 평판은 보존한다',()=>{
  const d=resonanceFixture(true);delete d.w.s.overworld!.society
  d.p.traits=[];const base=reputation(d.w,'pilgrims');d.p.traits=['Trait.ResonantHearing'];const before=serialize(d.w.s)
  expect(reputation(d.w,'pilgrims')).toBe(base+20);expect(serialize(d.w.s)).toBe(before)
  const society=ensureSociety(d.w)!;expect(society.reputation.pilgrims).toBe(base+20);d.p.traits=[];expect(reputation(d.w,'pilgrims')).toBe(base+20)
  society.reputation.pilgrims=-37;d.p.traits=['Trait.ResonantHearing'];expect(reputation(d.w,'pilgrims')).toBe(-37)
 })
 it.each([['/resonance',null],['/resonance',{radius:15,faction:'gardeners'}],['/resonance/radius',0],['/resonance/radius',1.5],['/resonance/faction','unknown'],['/resonance/towerRadius',-1],['/initialReputation',null],['/initialReputation',{unknown:20}],['/initialReputation/pilgrims',101]]as const)('모드의 잘못된%s 값은 로드에서 거절한다',(path,value)=>{
  const id='bad-resonance',r=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'Trait.ResonantHearing',path,value}]}],[id]);expect(r.report.errors.length).toBeGreaterThan(0)
 })
})
