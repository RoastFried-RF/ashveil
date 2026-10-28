import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { adjacentCorpse, perform } from '../src/core/actions'
import { botDecide } from '../src/core/bot'
import { killCreature } from '../src/core/combat'
import { corpseMoneyQuote } from '../src/core/corpse-money'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, type World } from '../src/core/ctx'
import { newGame, playerAct } from '../src/core/game'
import { invalidateLights } from '../src/core/fov'
import { makeItem } from '../src/core/items'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { db } from './helpers'
const template=newGame(db,{seed:'corpse-money',background:'Bg.Hunter'})
function setup(){
  const w:World={db,s:structuredClone(template)},p=player(w);w.s.creatures=[p];w.s.sources=[];w.s.storyteller.budget=-1e9;w.s.time=12*1200*100;w.s.weather='clear';w.s.weatherUntil=1e12;w.s.wind={x:0,y:0};p.pos={x:20,y:20};p.nextAct=w.s.time;p.hp=95;p.age=undefined;p.traits=[];p.traumas=[];p.background=undefined;p.effects=[];p.thoughts=[];p.body.wounds=[];p.body.missing=[];p.body.blood=p.body.bloodMax;p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.bag=[];p.money=5;p.statPoints=0;p.abilityPoints=0
  Object.assign(p.needs,{kcal:1000,waterDeficit:0,fatigue:10,sleepDebt:0,bodyTemp:37,wetness:0,stress:0,protein:100,vitamin:100})
  for(let y=17;y<=23;y++)for(let x=17;x<=25;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
  w.s.map.lights=[{pos:{...p.pos},radius:8,kind:'campfire'}];invalidateLights(w)
  const corpse=createCreature(w,'Creature.Reaver',{x:21,y:20});corpse.bag=[];corpse.equip={};corpse.money=17;w.s.creatures.push(corpse);killCreature(w,corpse,'검증')
  const open=()=>{corpse.searched=true;w.s.loot={kind:'corpse',id:corpse.id,pos:{...corpse.pos}}}
  return{w,p,corpse,open}
}
describe('시체의 실제 개인 지갑',()=>{
  it('동전만 있는 시체도 실제2턴 수색 뒤 주머니를 연다',()=>{
    const{w,p,corpse}=setup();expect(adjacentCorpse(w,p)?.id).toBe(corpse.id);expect(corpseMoneyQuote(w,p).amount).toBe(0);const before=w.s.time;expect(playerAct(w,{type:'search'})).toBeNull();expect(w.s.time-before).toBe(200);expect(w.s.loot).toMatchObject({kind:'corpse',id:corpse.id});expect(corpseMoneyQuote(w,p)).toMatchObject({error:null,amount:17,id:corpse.id})
  })
  it('읽기 전용 견적과 실제 회수는 지갑 합계·아이템UID·난수를 보존한다',()=>{
    const{w,p,corpse,open}=setup();open();const hash=stateHash(w.s),id=w.s.nextId,rng=structuredClone(w.s.rng),time=w.s.time;expect(corpseMoneyQuote(w,p)).toMatchObject({error:null,amount:17});expect(stateHash(w.s)).toBe(hash);expect(perform(w,p,{type:'lootMoney',target:corpse.id,expectedAmount:17})).toMatchObject({ok:true,tu:0});expect([p.money,corpse.money]).toEqual([22,0]);expect(w.s.nextId).toBe(id);expect(w.s.rng).toEqual(rng);expect(w.s.time).toBe(time)
  })
  it('두 번 누르거나 재접속해도 같은 동전을 다시 가져오지 못한다',()=>{
    const{w,p,corpse,open}=setup();open();expect(perform(w,p,{type:'lootMoney',target:corpse.id}).ok).toBe(true);const copy={db,s:deserialize(serialize(w.s))},hash=stateHash(copy.s);expect(perform(copy,player(copy),{type:'lootMoney',target:corpse.id}).ok).toBe(false);expect(stateHash(copy.s)).toBe(hash);expect(player(copy).money).toBe(22)
  })
  it('빈 격자와 가득 찬 배낭에서도 모두 가져가기는 실제 동전을 지갑으로 옮긴다',()=>{
    const{w,p,corpse,open}=setup();open();for(let y=0;y<6;y+=3)for(let x=0;x<10;x+=2){const item=makeItem(w,'Item.Bed');Object.assign(item,{gx:x,gy:y});p.bag.push(item)}const bag=structuredClone(p.bag),id=w.s.nextId;expect(perform(w,p,{type:'lootAll'}).ok).toBe(true);expect([p.money,corpse.money]).toEqual([22,0]);expect(p.bag).toEqual(bag);expect(w.s.nextId).toBe(id)
  })
  it('모두 가져가기는 기존 물품과 돈을 함께 옮기며 장착 장비는 남긴다',()=>{
    const{w,p,corpse,open}=setup();open();const food=makeItem(w,'Item.Hardtack',3),knife=makeItem(w,'Item.RustyKnife');Object.assign(food,{gx:0,gy:0});corpse.bag.push(food);corpse.equip.main=knife;expect(perform(w,p,{type:'lootAll'}).ok).toBe(true);expect(p.bag.some((it)=>it.uid===food.uid&&it.count===3)).toBe(true);expect(corpse.bag).toHaveLength(0);expect(corpse.equip.main?.uid).toBe(knife.uid);expect([p.money,corpse.money]).toEqual([22,0])
  })
  it('적이 인식한 동안의 회수는1턴을 써서 실제 NPC 차례를 진행한다',()=>{
    const{w,p,corpse,open}=setup();open();const enemy=createCreature(w,'Creature.Reaver',{x:23,y:20});enemy.ai.mode='hunt';enemy.ai.target=p.id;enemy.nextAct=w.s.time;w.s.creatures.push(enemy);const time=w.s.time;expect(playerAct(w,{type:'lootMoney',target:corpse.id})).toBeNull();expect(w.s.time-time).toBe(100);expect(enemy.nextAct).toBeGreaterThan(time);expect(p.money).toBe(22)
  })
  it('살아 있는 사람·수색 전·멀리 떨어진 시체의 돈은 공개하거나 꺼내지 않는다',()=>{
    for(const kind of ['alive','unsearched','remote']){const{w,p,corpse,open}=setup();open();if(kind==='alive')corpse.alive=true;if(kind==='unsearched')corpse.searched=false;if(kind==='remote')corpse.pos={x:30,y:20};const hash=stateHash(w.s);expect(corpseMoneyQuote(w,p).amount).toBe(0);expect(perform(w,p,{type:'lootMoney',target:corpse.id}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)}
  })
  it('막힌 모퉁이와 손/의식 상실 때는 지갑을 바꾸지 않는다',()=>{
    for(const kind of ['corner','hands','conscious']){const{w,p,corpse,open}=setup();if(kind==='corner'){corpse.pos={x:21,y:19};tileAt(w,{x:20,y:19}).t='Terrain.RuinWall';tileAt(w,{x:21,y:20}).t='Terrain.RuinWall'}open();if(kind==='hands')p.body.missing=['LeftUpperArm','RightUpperArm'];if(kind==='conscious')p.unconscious=true;const hash=stateHash(w.s);expect(perform(w,p,{type:'lootMoney',target:corpse.id}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)}
  })
  it('다른 시체와 오래된 수량의 요청은 원자적으로 거절한다',()=>{
    const{w,p,corpse,open}=setup();open();let hash=stateHash(w.s);expect(perform(w,p,{type:'lootMoney',target:corpse.id+1000,expectedAmount:17}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash);corpse.money=16;hash=stateHash(w.s);expect(perform(w,p,{type:'lootMoney',target:corpse.id,expectedAmount:17}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)
  })
  it('잘못된 동전 값이나 안전 정수 범위를 넘는 이전은 재산을 바꾸지 않는다',()=>{
    for(const value of [-1,NaN,Infinity,.5]){const{w,p,corpse,open}=setup();open();corpse.money=value;const hash=stateHash(w.s);expect(perform(w,p,{type:'lootMoney',target:corpse.id}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)}
    const{w,p,corpse,open}=setup();open();p.money=Number.MAX_SAFE_INTEGER-5;const hash=stateHash(w.s);expect(perform(w,p,{type:'lootMoney',target:corpse.id}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)
  })
  it('현재 플레이어의 루팅 맥락을 다른 NPC가 가로쓰지 않는다',()=>{
    const{w,corpse,open}=setup();open();const actor=createCreature(w,'Creature.Settler',{x:20,y:20});w.s.creatures.push(actor);const hash=stateHash(w.s);expect(perform(w,actor,{type:'lootMoney',target:corpse.id}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)
  })
  it('봇도 동전만 있는 열린 시체를 닫기 전에 실제 지갑을 회수한다',()=>{
    const{w,p,corpse,open}=setup();open();expect(botDecide(w)).toEqual({type:'lootMoney',target:corpse.id,expectedAmount:17});expect(playerAct(w,botDecide(w))).toBeNull();expect(p.money).toBe(22);expect(corpse.money).toBe(0)
  })
  it('v20의 개인 지갑·수색 상태·몸을 보존하고 돈을 새로 부여하지 않는다',()=>{
    const{w,open}=setup();open();const old=JSON.parse(serialize(w.s));old.version=20;const copy=deserialize(JSON.stringify(old));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:20}).toEqual(old)
  })
})
