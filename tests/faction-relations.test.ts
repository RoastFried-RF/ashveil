import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { perform } from '../src/core/actions'
import { addWound } from '../src/core/body'
import { killCreature, resolveAttack } from '../src/core/combat'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { diplomacyTick, ensureSociety, factionRelation, hearFactionRelations, hostile, recordFactionIncident, reputation, witnessAttack } from '../src/core/diplomacy'
import { talk } from '../src/core/economy'
import { invalidateLights } from '../src/core/fov'
import { newGame, playerAct } from '../src/core/game'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import type { FactionIncidentKind } from '../src/core/types'
import { db } from './helpers'
const template=newGame(db,{seed:'faction-relations',overworld:true})
function setup(){
  const w:World={db,s:structuredClone(template)},s=w.s,p=player(w),m=s.overworld!,site=m.sites.find((s)=>s.kind==='settlement'&&s.faction==='coalition')!
  m.currentRegion=site.id;m.position={...site.cell};s.creatures=[p];s.sources=[];s.storyteller.budget=-1e9;s.time=12*1200*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};p.pos={x:20,y:20}
  for(let y=12;y<=25;y++)for(let x=24;x<=42;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
  initializeSettlement(w);const doctor=s.creatures.find((c)=>c.clinicSite)!,trader=s.creatures.find((c)=>c.traderSite)!,raider=createCreature(w,'Creature.Reaver',{x:35,y:19});s.creatures.push(raider);p.pos={x:34,y:19}
  for(const c of s.creatures){c.nextAct=c.id===p.id?s.time:1e12;c.age=undefined;c.traits=[];c.background=undefined;c.abilities=[];c.traumas=[];c.effects=[];c.thoughts=[];c.hp=95;c.stats={str:10,agi:10,per:10,vit:10,wil:10};Object.assign(c.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,fatigue:10,stress:0,bodyTemp:37,wetness:0})}
  s.map.lights=[{pos:{x:32,y:18},radius:12,kind:'campfire'}];invalidateLights(w)
  return{w,s,p,m,site,doctor,trader,raider}
}
describe('방향별 세력 관계·목격 원한과 들은 정책',()=>{
  it('기본 비대칭 관계를 읽기 전용으로 읽고 개인 평판과 구분한다',()=>{
    const{w,trader}=setup(),hash=stateHash(w.s);hearFactionRelations(w,trader);expect(factionRelation(w,'coalition','guild')).toBe(25);expect(factionRelation(w,'guild','coalition')).toBe(20);expect(factionRelation(w,'absent','coalition')).toBe(0);expect(stateHash(w.s)).toBe(hash);recordFactionIncident(w,'coalition','guild','raid','one');expect(factionRelation(w,'coalition','guild')).toBe(5);expect(factionRelation(w,'guild','coalition')).toBe(20);expect(reputation(w,'coalition')).toBe(0)
  })
  it('정본 사건 변화를 적용하고 같은 사건/방향은 한 번만 반영한다',()=>{
    for(const[kind,delta]of[['raid',-20],['caravan',1],['commonEnemy',5],['release',3],['execution',-10]]as[FactionIncidentKind,number][]){const{w}=setup();expect(recordFactionIncident(w,'coalition','guild',kind,'event')).toBe(true);expect(factionRelation(w,'coalition','guild')).toBe(25+delta);const hash=stateHash(w.s);expect(recordFactionIncident(w,'coalition','guild',kind,'event')).toBe(false);expect(stateHash(w.s)).toBe(hash)}
  })
  it('한 캐러밴의 양쪽 방향과 서로 다른 원인은 각각 한 번 기록한다',()=>{
    const{w}=setup();recordFactionIncident(w,'coalition','guild','caravan','caravan:1');recordFactionIncident(w,'guild','coalition','caravan','caravan:1');recordFactionIncident(w,'coalition','guild','grudge','caravan:1');expect(factionRelation(w,'coalition','guild')).toBe(26);expect(factionRelation(w,'guild','coalition')).toBe(21);expect(w.s.overworld!.society!.relationEvents).toHaveLength(3)
  })
  it('매일 기저로1씩 복귀하며 긴 정산·분할 정산·조회는 같은 값을 낸다',()=>{
    const{w}=setup();recordFactionIncident(w,'coalition','guild','raid','raid');const copy={db,s:deserialize(serialize(w.s))};for(let day=1;day<=20;day++){copy.s.time=day*TURNS_PER_DAY*100;diplomacyTick(copy)}w.s.time=20*TURNS_PER_DAY*100;const hash=stateHash(w.s);expect(factionRelation(w,'coalition','guild')).toBe(25);expect(stateHash(w.s)).toBe(hash);diplomacyTick(w);expect(w.s.overworld!.society!.relations).toEqual(copy.s.overworld!.society!.relations);const done=stateHash(w.s);diplomacyTick(w);expect(stateHash(w.s)).toBe(done)
  })
  it('원한은 현재 관계를 중복 차감하지 않고 기저−5를 영구 보존하며 상하한을 지킨다',()=>{
    const{w}=setup();recordFactionIncident(w,'coalition','reavers','raid','raid');recordFactionIncident(w,'coalition','reavers','grudge','death');expect(factionRelation(w,'coalition','reavers')).toBe(-90);expect(w.s.overworld!.society!.relations!.coalition.reavers.baseline).toBe(-75);w.s.time=100*TURNS_PER_DAY*100;diplomacyTick(w);expect(factionRelation(w,'coalition','reavers')).toBe(-75);for(let i=0;i<30;i++)recordFactionIncident(w,'coalition','reavers','grudge',`death:${i}`);expect(w.s.overworld!.society!.relations!.coalition.reavers.baseline).toBe(-100);for(let i=0;i<30;i++)recordFactionIncident(w,'coalition','guild','commonEnemy',`help:${i}`);expect(factionRelation(w,'coalition','guild')).toBe(100)
  })
  it('실제 NPC 공격의 목격은 현지 피해 세력에 하루 습격1건과 자기방어를 남긴다',()=>{
    const{w,p,doctor,raider}=setup(),rep=reputation(w,'coalition');resolveAttack(w,raider,doctor);expect(factionRelation(w,'coalition','reavers')).toBe(-90);expect(doctor.attackedBy).toContain(raider.id);expect(reputation(w,'coalition')).toBe(rep);witnessAttack(w,raider,doctor);expect(w.s.overworld!.society!.relationEvents).toHaveLength(1);expect(w.s.overworld!.society!.relationKnowledge).toBeUndefined();expect(p.alive).toBe(true)
  })
  it('실제 주민 사망을 다른 주민이 목격하면 인구 사망과 별개로 원한을 한 번 기록한다',()=>{
    const{w,doctor,raider}=setup();witnessAttack(w,raider,doctor);addWound(w,doctor,{def:'Wound.Cut',part:'Chest',severity:1,source:raider.name,sourceId:raider.id});killCreature(w,doctor,'검증');expect(w.s.overworld!.society!.relations!.coalition.reavers.baseline).toBe(-75);expect(w.s.overworld!.simulation!.settlements[doctor.clinicSite!]!.population.deaths).toBe(1);const hash=stateHash(w.s);killCreature(w,doctor,'다시');expect(stateHash(w.s)).toBe(hash)
  })
  it('목격자 없는 공격·다른 지역 주민·영역 세력은 관계/원한 사건을 만들지 않는다',()=>{
    for(const mode of ['unseen','outsider','territory']){const{w,p,doctor,raider}=setup();if(mode==='unseen'){w.s.creatures=[p,doctor,raider];doctor.asleep=true}if(mode==='outsider')doctor.residentSite='elsewhere';if(mode==='territory')raider.faction='gardeners';witnessAttack(w,raider,doctor);expect(w.s.overworld!.society!.relationEvents).toBeUndefined();expect(factionRelation(w,'coalition','reavers')).toBe(-70)}
  })
  it('실시간 관계가 NPC 적대를 바꾸지만 플레이어 평판·영역 규칙은 따로 유지한다',()=>{
    const{w,trader,raider,p}=setup();raider.faction='guild';expect(hostile(w,trader,raider)).toBe(false);for(let i=0;i<4;i++)recordFactionIncident(w,'coalition','guild','raid',`raid:${i}`);expect(hostile(w,trader,raider)).toBe(true);expect(hostile(w,p,trader)).toBe(false);raider.faction='gardeners';expect(hostile(w,trader,raider)).toBe(true)
  })
  it('대화로 들은 관계는 이후 비공개 사건/날짜 변화로 갱신하지 않고 다시 대화해야 바뀐다',()=>{
    const{w,p,trader}=setup();p.pos={x:29,y:18};expect(talk(w,p,trader)).toBeNull();const known=structuredClone(w.s.overworld!.society!.relationKnowledge);expect(known!.coalition.values.guild).toBe(25);recordFactionIncident(w,'coalition','guild','raid','private');w.s.time+=2*TURNS_PER_DAY*100;diplomacyTick(w);expect(w.s.overworld!.society!.relationKnowledge).toEqual(known);expect(talk(w,p,trader)).toBeNull();expect(w.s.overworld!.society!.relationKnowledge!.coalition.values.guild).toBe(7);expect(w.s.overworld!.society!.relationKnowledge!.coalition.day).toBe(2)
  })
  it('대화는 실제1턴이며 원한/들은 정책은 각인 뒤에도 같은 값으로 복원한다',()=>{
    const{w,p,trader}=setup();p.pos={x:29,y:18};const before=w.s.time;expect(playerAct(w,{type:'talk',target:trader.id})).toBeNull();expect(w.s.time-before).toBe(100);recordFactionIncident(w,'coalition','guild','grudge','grudge');const copy={db,s:deserialize(serialize(w.s))};w.s.time+=TURNS_PER_DAY*100;copy.s.time=w.s.time;diplomacyTick(w);diplomacyTick(copy);expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('없는/동일/영역 세력·빈 사건은 원장을 만들지 않고 구형 사회 원장도 실제 사건 때만 추가한다',()=>{
    const{w,trader}=setup(),hash=stateHash(w.s);for(const[from,to,key]of[['absent','guild','a'],['coalition','coalition','b'],['gardeners','guild','c'],['coalition','guild','']])expect(recordFactionIncident(w,from,to,'raid',key)).toBe(false);expect(stateHash(w.s)).toBe(hash);delete w.s.overworld!.society;expect(recordFactionIncident(w,'coalition','guild','raid','old')).toBe(true);expect(ensureSociety(w)!.relations!.coalition.guild.value).toBe(5);trader.faction='gardeners';const done=stateHash(w.s);hearFactionRelations(w,trader);expect(stateHash(w.s)).toBe(done)
  })
  it('진행 중인 구형 계약·개인 평판/몸을 v23→24에서 추론해 바꾸지 않는다',()=>{
    const{w}=setup(),old=JSON.parse(serialize(w.s));old.version=23;const copy=deserialize(JSON.stringify(old));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:23}).toEqual(old);expect(perform({db,s:copy},player({db,s:copy}),{type:'wait'}).ok).toBe(true)
  })
})
