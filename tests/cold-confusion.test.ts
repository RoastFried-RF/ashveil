import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { activityStep, perform } from '../src/core/actions'
import { channelTurns } from '../src/core/action-time'
import { addWound, capacity } from '../src/core/body'
import { coldConfusionAction, coldConfusionTick } from '../src/core/cold-confusion'
import { player, tileAt, turnOf, type World } from '../src/core/ctx'
import { createCreature } from '../src/core/creatures'
import { loadMods } from '../src/core/defs'
import { invalidateLights } from '../src/core/fov'
import { newGame, playerAct, runUntilInput } from '../src/core/game'
import { addToBag, itemDef, makeItem } from '../src/core/items'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { addEffect } from '../src/core/traits'
import type { Creature } from '../src/core/types'
import { readPackages } from '../tools/loadContent'
const packages=readPackages(),loaded=loadMods([...packages,{manifest:{id:'cold.test',name:'검증',version:'1'},defs:[],patches:[{op:'replace',target:'ColdConfusion.Human',path:'/chance',value:1}]}],['cold.test']),db=loaded.db
if(loaded.report.errors.length)throw new Error(loaded.report.errors.join('\n'))
const template=newGame(db,{seed:'cold-confusion',background:'Bg.Hunter'})
function setup(npc=false){
  const w:World={db,s:structuredClone(template)},s=w.s,p=player(w);s.creatures=[p];s.sources=[];s.storyteller.budget=-1e9;s.time=400*100;s.map.kind='dungeon';s.map.depth=1;s.map.ambient=.8;s.map.lights=[];p.pos={x:20,y:20}
  for(let y=17;y<=24;y++)for(let x=17;x<=25;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
  const actor=npc?createCreature(w,'Creature.Reaver',{x:23,y:20}):p;if(npc)s.creatures.push(actor)
  function prepare(c:Creature){c.nextAct=s.time;c.hp=95;c.age=undefined;c.traits=[];c.background=undefined;c.abilities=[];c.traumas=[];c.effects=[];c.thoughts=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.stats={str:10,agi:10,per:10,vit:10,wil:10};c.bag=[];c.equip={};c.ai.mode='calm';Object.assign(c.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,fatigue:10,stress:0,bodyTemp:31.9,wetness:0,sleepDebt:0});addEffect(c,'alcohol',turnOf(w)+12000)}
  prepare(p);if(npc)prepare(actor);const coat=makeItem(w,'Item.LeatherCoat');coat.quality=4;coat.durability=47;coat.wetness={torso:80};actor.equip.chest=coat;invalidateLights(w)
  return{w,s,p,actor,coat,prepare}
}
function finish(w:World){let n=0;while(w.s.simulationPending&&n++<1000)runUntilInput(w,100);expect(n).toBeLessThan(1000)}
describe('역설적 탈의와 실제 장비 착탈·바닥 보존',()=>{
  it('교체의 벗기 단계에서 혼란이 끼어들면 실제 입은 옛 옷만 벗고 새 옷은 배낭에 남는다',()=>{const{w,p,coat}=setup(),other=makeItem(w,'Item.PaddedJacket');addToBag(w,p,other);expect(perform(w,p,{type:'equip',uid:other.uid,slot:'chest'}).ok).toBe(true);activityStep(w,p);coldConfusionTick(w,p);expect(p.coldConfusion!.pending!.uid).toBe(coat.uid);runUntilInput(w);expect(p.equip.chest).toBeUndefined();expect(p.bag.filter((i)=>i.uid===other.uid)).toHaveLength(1);expect(other.half).toBeUndefined();expect(tileAt(w,p.pos).items.filter((i)=>i.uid===coat.uid)).toHaveLength(1);expect(tileAt(w,p.pos).items.some((i)=>i.uid===other.uid)).toBe(false)})
  it('기본 정본 임계33도/의식0.6/200턴·5%는 콘텐츠 데이터다',()=>{
    const base=loadMods(packages);expect(base.report.errors).toEqual([]);expect(base.db.get('ColdConfusion.Human')).toMatchObject({temperature:33,consciousness:.6,intervalTurns:200,chance:.05,slots:['back','chest']})
  })
  it('조건/물리적 조작이 안 되면 몸·물품·난수를 바꾸지 않는다',()=>{
    for(const mode of ['warm','conscious','hands','noCoat','dead','unconscious','notBoundary','alreadyUnequipping']){const{w,actor}=setup();if(mode==='warm')actor.needs.bodyTemp=33;if(mode==='conscious')actor.effects=[];if(mode==='hands')actor.body.missing=['LeftUpperArm','RightUpperArm'];if(mode==='noCoat')actor.equip={};if(mode==='dead')actor.alive=false;if(mode==='unconscious')actor.unconscious=true;if(mode==='notBoundary')w.s.time+=100;if(mode==='alreadyUnequipping')expect(perform(w,actor,{type:'unequip',slot:'chest'}).ok).toBe(true);const hash=stateHash(w.s);coldConfusionTick(w,actor);expect(stateHash(w.s)).toBe(hash)}
  })
  it('10분 경계에 같은 사람은 한 번만 판정하며 요청 자체는 시간/옷/UID를 바꾸지 않는다',()=>{
    const{w,actor,coat}=setup(),before={time:w.s.time,id:w.s.nextId,coat:structuredClone(coat),bodyRng:structuredClone(w.s.rng.body)};expect(capacity(w,actor,'consciousness')).toBeLessThan(.6);coldConfusionTick(w,actor);expect(actor.coldConfusion?.pending).toMatchObject({slot:'chest',uid:coat.uid,at:400});const hash=stateHash(w.s);coldConfusionTick(w,actor);expect(stateHash(w.s)).toBe(hash);expect(w.s.time).toBe(before.time);expect(w.s.nextId).toBe(before.id);expect(coat).toEqual(before.coat);expect(w.s.rng.body).toEqual(before.bodyRng)
  })
  it('실제 스케줄러는 대기1턴 뒤 정상 착탈 시간으로 벗고 같은 물품을 바닥에 둔다',()=>{
    const{w,p,actor,coat}=setup(),before=w.s.time,id=w.s.nextId,turns=channelTurns(w,actor,itemDef(w,coat).equipTurns![1])!;coldConfusionTick(w,actor);expect(playerAct(w,{type:'wait'})).toBeNull();finish(w);expect(w.s.time-before).toBe(100+turns*100);expect(actor.equip.chest).toBeUndefined();expect(tileAt(w,actor.pos).items).toContainEqual(coat);expect(coat).toMatchObject({uid:coat.uid,quality:4,durability:47});expect(coat.wetness!.torso).toBeLessThanOrEqual(80);expect(coat.wetness!.torso).toBeGreaterThan(79);expect(w.s.nextId).toBe(id);expect(p.history.at(-1)?.kind).toBe('cold');expect(w.s.log.some((l)=>l.text.includes('덥다는 착각'))).toBe(true)
  })
  it('가방이 가득 차도 새 물품을 만들지 않고 옷을 실제 바닥에 벗는다',()=>{
    const{w,p,coat}=setup();for(let y=0;y<6;y++)for(let x=0;x<10;x++){const it=makeItem(w,'Item.Cloth');it.gx=x;it.gy=y;p.bag.push(it)}const bag=structuredClone(p.bag),id=w.s.nextId;coldConfusionTick(w,p);expect(playerAct(w,{type:'wait'})).toBeNull();finish(w);expect(p.bag).toEqual(bag);expect(tileAt(w,p.pos).items.filter((it)=>it.uid===coat.uid)).toHaveLength(1);expect(w.s.nextId).toBe(id)
  })
  it('NPC도 같은 조건·물리 착탈 행동을 쓰며 개인 혼란을 전역 기록에 누출하지 않는다',()=>{
    const{w,p,actor,coat}=setup(true);p.needs.bodyTemp=37;p.effects=[];coldConfusionTick(w,actor);expect(playerAct(w,{type:'rest',turns:20})).toBeNull();finish(w);expect(actor.equip.chest).toBeUndefined();expect(tileAt(w,actor.pos).items.some((it)=>it.uid===coat.uid)).toBe(true);expect(actor.history.some((h)=>h.kind==='cold')).toBe(true);expect(w.s.log.some((l)=>l.text.includes('덥다는 착각'))).toBe(false)
  })
  it('최외곽 망토를 먼저 고르며 다른 NPC의 판정 순서와 난수를 공유하지 않는다',()=>{
    const{w,actor}=setup(),cloak=makeItem(w,'Item.OilclothCloak');actor.equip.back=cloak;const npc=createCreature(w,'Creature.Reaver',{x:24,y:20});npc.needs.bodyTemp=31.9;npc.needs.fatigue=10;addEffect(npc,'alcohol',turnOf(w)+12000);npc.equip.chest=makeItem(w,'Item.LeatherCoat');w.s.creatures.push(npc);coldConfusionTick(w,actor);const own=structuredClone(w.s.rng[`body.coldConfusion.${actor.id}`]);coldConfusionTick(w,npc);expect(actor.coldConfusion!.pending!.uid).toBe(cloak.uid);expect(w.s.rng[`body.coldConfusion.${actor.id}`]).toEqual(own)
  })
  it('재가온/의식 회복·갈아입음·오래된 요청은 다른 옷을 벗기지 않는다',()=>{
    for(const mode of ['warm','conscious','changed','expired']){const{w,actor,coat}=setup();coldConfusionTick(w,actor);if(mode==='warm')actor.needs.bodyTemp=34;if(mode==='conscious')actor.effects=[];if(mode==='changed')actor.equip.chest=makeItem(w,'Item.PaddedJacket');if(mode==='expired')w.s.time+=200*100;const current=actor.equip.chest;expect(coldConfusionAction(w,actor)).toBeNull();expect(actor.equip.chest).toBe(current);expect(tileAt(w,actor.pos).items.some((it)=>it.uid===coat.uid)).toBe(false)}
  })
  it('장착 방어구를 버리는 입력도 착탈 시간과 실제 물품 보존을 따른다',()=>{
    const{w,actor,coat}=setup();actor.needs.bodyTemp=37;actor.effects=[];const result=perform(w,actor,{type:'drop',uid:coat.uid});expect(result).toEqual({ok:true,tu:0});expect(actor.activity?.kind).toBe('unequip');expect(actor.equip.chest).toBe(coat);while(actor.activity)activityStep(w,actor);expect(actor.equip.chest).toBeUndefined();expect(tileAt(w,actor.pos).items).toContainEqual(coat)
  })
  it('입은 방어구를 보관함/바닥 루팅에 즉시 넣어 착탈 시간을 우회하지 못한다',()=>{
    const{w,actor,coat}=setup();w.s.loot={kind:'floor',pos:{...actor.pos}};const hash=stateHash(w.s);expect(perform(w,actor,{type:'lootPut',uid:coat.uid}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)
  })
  it('기존 가방 물품·손의 무기는 자유 행동으로 놓고 두 번 연속 자유 행동은 막는다',()=>{
    const{w,actor}=setup(),knife=makeItem(w,'Item.RustyKnife');actor.equip.main=knife;expect(perform(w,actor,{type:'drop',uid:knife.uid})).toEqual({ok:true,tu:0});expect(tileAt(w,actor.pos).items).toContainEqual(knife);const cloth=makeItem(w,'Item.Cloth');addToBag(w,actor,cloth);expect(perform(w,actor,{type:'drop',uid:cloth.uid}).ok).toBe(false)
  })
  it('착탈 중 바뀐 장비 UID와 ×4를 넘는 몸 상태는 무효 결과를 만들지 않는다',()=>{
    const{w,actor,coat}=setup();actor.needs.bodyTemp=37;actor.effects=[];expect(perform(w,actor,{type:'unequip',slot:'chest',dropAfter:true}).ok).toBe(true);const other=makeItem(w,'Item.PaddedJacket');actor.equip.chest=other;while(actor.activity)activityStep(w,actor);expect(actor.equip.chest).toBe(other);expect(tileAt(w,actor.pos).items).not.toContainEqual(other);actor.body.missing=['LeftUpperArm','RightUpperArm'];const before=stateHash(w.s);expect(perform(w,actor,{type:'unequip',slot:'chest'}).ok).toBe(false);expect(stateHash(w.s)).toBe(before);addToBag(w,actor,coat);const hash=stateHash(w.s);expect(perform(w,actor,{type:'equip',uid:coat.uid,slot:'chest'}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)
  })
  it('옛 옷을 이미 벗었다면 오래된 혼란 요청은 새 옷 UID를 대신 벗기지 않는다',()=>{
    const{w,p,coat}=setup(),other=makeItem(w,'Item.PaddedJacket');expect(addToBag(w,p,other)).toBe(0);expect(perform(w,p,{type:'equip',uid:other.uid,slot:'chest'}).ok).toBe(true);coldConfusionTick(w,p);expect(p.coldConfusion!.pending!.uid).toBe(coat.uid);for(let i=0;p.activity?.gearSwap?.phase==='remove'&&i<100;i++)activityStep(w,p);expect(p.activity?.gearSwap?.phase).toBe('wear');activityStep(w,p);runUntilInput(w);expect(p.equip.chest?.uid).toBe(other.uid);expect(p.equip.chest?.half).toBeUndefined();expect(p.bag.some((it)=>it.uid===coat.uid)).toBe(true);expect(tileAt(w,p.pos).items).toHaveLength(0)
  })
  it('탈의 중단은 같은 옷을 반쯤 벗은 상태로 남기고 재개는 나머지 시간만 쓴다',()=>{
    const{w,actor,coat}=setup();actor.needs.bodyTemp=37;actor.effects=[];expect(perform(w,actor,{type:'unequip',slot:'chest',dropAfter:true}).ok).toBe(true);activityStep(w,actor);expect(playerAct(w,{type:'stopActivity'})).toBeNull();expect(actor.equip.chest).toBe(coat);expect(coat.half).toBe(true);expect(tileAt(w,actor.pos).items).toHaveLength(0);expect(perform(w,actor,{type:'unequip',slot:'chest',dropAfter:true})).toEqual({ok:true,tu:100});expect(coat.half).toBeUndefined();expect(tileAt(w,actor.pos).items).toContainEqual(coat)
  })
  it('NPC가 옷을 벗다 다쳐 중단해도 반쯤 벗은 장비를 보존하고 전역 기록에 알리지 않는다',()=>{
    const{w,p,actor,coat}=setup(true);for(const c of [p,actor]){c.needs.bodyTemp=37;c.effects=[]}expect(perform(w,actor,{type:'unequip',slot:'chest',dropAfter:true}).ok).toBe(true);activityStep(w,actor);addWound(w,actor,{def:'Wound.Cut',part:'Chest',severity:1,source:'중단 검증'});expect(playerAct(w,{type:'rest',turns:2})).toBeNull();finish(w);expect(actor.equip.chest).toBe(coat);expect(coat.half).toBe(true);expect(tileAt(w,actor.pos).items).toHaveLength(0);expect(w.s.log.some((l)=>l.text.includes('반쯤'))).toBe(false)
  })
  it('느린 몸으로 탈의 한 단계 뒤 중단해도 다시 시작해서 시간을 줄이지 못한다',()=>{
    const{w,actor}=setup();expect(perform(w,actor,{type:'unequip',slot:'chest',dropAfter:true}).ok).toBe(true);const original=actor.activity!.remaining;expect(original).toBeGreaterThan(2);activityStep(w,actor);expect(playerAct(w,{type:'stopActivity'})).toBeNull();const healed={db,s:deserialize(serialize(w.s))};player(healed).needs.bodyTemp=37;player(healed).effects=[];expect(perform(w,actor,{type:'unequip',slot:'chest',dropAfter:true}).ok).toBe(true);expect(actor.activity!.remaining).toBe(original-1);expect(perform(healed,player(healed),{type:'unequip',slot:'chest',dropAfter:true}).ok).toBe(true);expect(player(healed).activity!.remaining).toBeLessThan(original-1)
  })
  it('입다 중단한 옷을 같은 몸에 이어 입어 남은 시간 뒤 완전히 입는다',()=>{
    const{w,actor,coat}=setup();delete actor.equip.chest;expect(addToBag(w,actor,coat)).toBe(0);expect(perform(w,actor,{type:'equip',uid:coat.uid,slot:'chest'}).ok).toBe(true);const total=actor.activity!.remaining;activityStep(w,actor);expect(playerAct(w,{type:'stopActivity'})).toBeNull();expect(actor.equip.chest).toBe(coat);expect(coat.half).toBe(true);expect(perform(w,actor,{type:'equip',uid:coat.uid,slot:'chest'}).ok).toBe(true);expect(actor.activity!.remaining).toBe(total-1);while(actor.activity)activityStep(w,actor);expect(actor.equip.chest).toBe(coat);expect(coat.half).toBeUndefined();expect(coat.dressProgress).toBeUndefined();expect(actor.bag).toHaveLength(0)
  })
  it('반쯤 벗던 옷을 다시 여미면 남은 입기 시간 뒤 같은 옷으로 복구한다',()=>{
    const{w,actor,coat}=setup();actor.needs.bodyTemp=37;actor.effects=[];expect(perform(w,actor,{type:'unequip',slot:'chest',dropAfter:true}).ok).toBe(true);activityStep(w,actor);expect(playerAct(w,{type:'stopActivity'})).toBeNull();const before=w.s.time;expect(playerAct(w,{type:'equip',uid:coat.uid,slot:'chest'})).toBeNull();finish(w);expect(w.s.time-before).toBe(200);expect(actor.equip.chest).toBe(coat);expect(coat.half).toBeUndefined();expect(coat.dressProgress).toBeUndefined();expect(tileAt(w,actor.pos).items).toHaveLength(0)
  })
  it('대기 중인 혼란과 진행 중인 탈의 각인은 시간·옷·난수까지 그대로 이어진다',()=>{
    const{w,p}=setup();coldConfusionTick(w,p);const copy={db,s:deserialize(serialize(w.s))};expect(playerAct(w,{type:'wait'},2)).toBeNull();expect(playerAct(copy,{type:'wait'},2)).toBeNull();expect(w.s.simulationPending).toBe(true);const middle={db,s:deserialize(serialize(w.s))};finish(w);finish(copy);finish(middle);expect(stateHash(copy.s)).toBe(stateHash(w.s));expect(stateHash(middle.s)).toBe(stateHash(w.s))
  })
  it('v24의 몸·의복·개인 원장은 v25 이관에서 바뀌지 않는다',()=>{
    const{w}=setup(),old=JSON.parse(serialize(w.s));old.version=24;const copy=deserialize(JSON.stringify(old));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:24}).toEqual(old)
  })
})
