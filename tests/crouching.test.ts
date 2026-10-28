import {describe,expect,it} from 'vitest'
import {perform} from '../src/core/actions'
import {knockDown,previewHit} from '../src/core/combat'
import {createCreature} from '../src/core/creatures'
import {tileAt,turnOf} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {updatePlayerVision} from '../src/core/fov'
import {playerAct,SAVE_VERSION} from '../src/core/game'
import {makeItem} from '../src/core/items'
import {crouched,crouchQuote,walkingNoiseMultiplier} from '../src/core/posture'
import {deserialize,serialize} from '../src/core/save'
import {addEffect} from '../src/core/traits'
import {readPackages} from '../tools/loadContent'
import {prisonerFixture} from './prisoner-fixture'

function setup(){
 const d=prisonerFixture();d.s.overworld=undefined;d.s.maps={};d.s.offCreatures={};d.s.map.kind='dungeon';d.s.map.ambient=1;d.s.map.lights=[]
 d.p.bag=[];d.p.equip={main:makeItem(d.w,'Item.Hatchet')};d.p.needs.energy=100
 d.target.nextAct=1e12;d.target.ai.mode='hunt';d.target.ai.target=d.p.id;d.target.ai.alertTurn=turnOf(d.w);d.target.reactPolicy='none'
 updatePlayerVision(d.w,d.p);return d
}
type Fixture=ReturnType<typeof setup>
const toggle=(d:Fixture)=>perform(d.w,d.p,{type:'crouch'})
function unchanged(d:Fixture){const before=serialize(d.s);expect(toggle(d).ok).toBe(false);expect(serialize(d.s)).toBe(before)}

describe('실제 웅크림 자세',()=>{
 it('미리보기는 전체 상태·시간·난수·UID를 바꾸지 않는다',()=>{const d=setup(),before=serialize(d.s);expect(crouchQuote(d.w,d.p)).toMatchObject({error:null,active:false,rule:{movementTurns:2,meleeHit:-10,rangedTargetHit:-15,noiseMult:.5}});expect(serialize(d.s)).toBe(before)})
 it('0TU로 한 번 바꾸며 같은 턴의 두 번째 자유 행동은 전체 불변이다',()=>{const d=setup(),time=d.s.time,energy=d.p.needs.energy,rng=structuredClone(d.s.rng),uid=d.s.nextId;expect(toggle(d)).toEqual({ok:true,tu:0});expect(crouched(d.w,d.p)).toBe(true);expect(d.p.freeActTurn).toBe(turnOf(d.w));expect(d.s.time).toBe(time);expect(d.p.needs.energy).toBe(energy);expect(d.s.rng).toEqual(rng);expect(d.s.nextId).toBe(uid);unchanged(d)})
 it('실제 물품 떨구기와 같은 턴의 자유 행동 제한을 공유한다',()=>{const d=setup();expect(perform(d.w,d.p,{type:'drop',uid:d.p.equip.main!.uid}).ok).toBe(true);unchanged(d)})
 it('다음 턴에 일어서면 비활성 필드를 남기지 않는다',()=>{const d=setup();expect(toggle(d).ok).toBe(true);expect(playerAct(d.w,{type:'wait'})).toBeNull();expect(toggle(d)).toEqual({ok:true,tu:0});expect(Object.hasOwn(d.p,'crouching')).toBe(false)})
 it('실제 걷기는 정상100TU·웅크림200TU로 진행한다',()=>{const normal=setup(),low=setup();expect(playerAct(normal.w,{type:'move',dir:0})).toBeNull();expect(toggle(low).ok).toBe(true);expect(playerAct(low.w,{type:'move',dir:0})).toBeNull();expect(low.s.time-normal.s.time).toBe(100);expect(low.p.pos).toEqual(normal.p.pos)})
 it('잠행과 겹쳐도200TU·소음0.3을 한 번만 적용한다',()=>{const d=setup(),time=d.s.time;d.p.sneaking=true;expect(toggle(d).ok).toBe(true);expect(walkingNoiseMultiplier(d.w,d.p)).toBe(.3);expect(playerAct(d.w,{type:'move',dir:0})).toBeNull();expect(d.s.time-time).toBe(200)})
 it('사슬옷의 실제 걷기 소음5가 웅크리면 반올림3이 된다',()=>{for(const low of [false,true]){const d=setup();d.p.equip.chest=makeItem(d.w,'Item.ScrapMail');tileAt(d.w,{x:20,y:19}).t='Terrain.CdFloor';d.s.noiseEvents=[];if(low)expect(toggle(d).ok).toBe(true);expect(perform(d.w,d.p,{type:'move',dir:0}).ok).toBe(true);expect(d.s.noiseEvents.filter(e=>e.source===d.p.id).at(-1)?.radius).toBe(low?3:5)}})
 it('자기 근접명중만−10이며 자기 원거리/상대 근접은 변하지 않는다',()=>{const d=setup(),melee=previewHit(d.w,d.p,d.target)!,incoming=previewHit(d.w,d.target,d.p)!;d.p.crouching=true;expect(previewHit(d.w,d.p,d.target)!.chance).toBe(melee.chance-10);expect(previewHit(d.w,d.target,d.p)!.chance).toBe(incoming.chance);d.p.equip.main=makeItem(d.w,'Item.Bow');const low=previewHit(d.w,d.p,d.target,true)!;delete d.p.crouching;expect(previewHit(d.w,d.p,d.target,true)).toEqual(low)})
 it('상대의 실제 원거리 명중만−15이며 플레이어/NPC가 같은 규칙을 쓴다',()=>{const d=setup();d.p.equip.main=makeItem(d.w,'Item.Bow');const normal=previewHit(d.w,d.p,d.target,true)!;expect(perform(d.w,d.target,{type:'crouch'})).toEqual({ok:true,tu:0});expect(previewHit(d.w,d.p,d.target,true)!.chance).toBe(normal.chance-15)})
 it('잠듦·의식상실·기절·넘어짐·작업 중에는 전체 불변이다',()=>{for(const kind of ['sleep','unconscious','stunned','knockedDown','activity','catatonia']){const d=setup();if(kind==='sleep')d.p.asleep=true;else if(kind==='unconscious')d.p.unconscious=true;else if(kind==='activity')d.p.activity={kind:'rest',remaining:10,label:'휴식'};else if(kind==='catatonia')d.p.breakdown={def:'Break.Catatonia',kind:'catatonia',until:turnOf(d.w)+10,remaining:10,hp:d.p.hp};else addEffect(d.p,kind,turnOf(d.w)+10);unchanged(d)}})
 it('인간형이 아닌 몸이나 지탱할 두 다리 상실은 거절한다',()=>{const d=setup();d.p.body.missing.push('LeftThigh','RightThigh');unchanged(d);const dog=createCreature(d.w,'Creature.AshHound',{x:22,y:20});d.s.creatures.push(dog);const before=serialize(d.s);expect(perform(d.w,dog,{type:'crouch'}).ok).toBe(false);expect(serialize(d.s)).toBe(before)})
 it('실제 넘어짐은 자세를 끝내며 원거리 회피를 중첩하지 않는다',()=>{const d=setup();d.p.equip.main=makeItem(d.w,'Item.Bow');d.target.crouching=true;knockDown(d.w,d.target,false,'약탈자');expect(Object.hasOwn(d.target,'crouching')).toBe(false);const down=previewHit(d.w,d.p,d.target,true);d.target.crouching=true;expect(crouched(d.w,d.target)).toBe(false);expect(previewHit(d.w,d.p,d.target,true)).toEqual(down)})
 it('거절된 수면은 자세까지 전체 불변이며 실제 수면만 자세를 끝낸다',()=>{const d=setup();d.target.ai.mode='surrender';d.p.crouching=true;d.p.needs.sleepDebt=0;d.p.needs.fatigue=10;const before=serialize(d.s);expect(perform(d.w,d.p,{type:'sleep'}).ok).toBe(false);expect(serialize(d.s)).toBe(before);d.p.needs.fatigue=50;expect(perform(d.w,d.p,{type:'sleep'}).ok).toBe(true);expect(d.p.asleep).toBe(true);expect(Object.hasOwn(d.p,'crouching')).toBe(false)})
 it('패치된 자세의 실제3턴 이동/소음/명중 값을 읽는다',()=>{const d=setup(),loaded=loadMods([...readPackages(),{manifest:{id:'posture-patch',name:'자세 패치',version:'1',dependencies:['core']},defs:[],patches:[{op:'replace',target:'Posture.Crouch',path:'/movementTurns',value:3},{op:'replace',target:'Posture.Crouch',path:'/noiseMult',value:.4},{op:'replace',target:'Posture.Crouch',path:'/meleeHit',value:-7}]}],['posture-patch']);expect(loaded.report.errors).toEqual([]);d.w.db=loaded.db;const normal=previewHit(d.w,d.p,d.target)!.chance;expect(toggle(d).ok).toBe(true);expect(walkingNoiseMultiplier(d.w,d.p)).toBe(.4);expect(previewHit(d.w,d.p,d.target)!.chance).toBe(normal-7);expect(perform(d.w,d.p,{type:'move',dir:0})).toEqual({ok:true,tu:300})})
 it('소수 턴·음수 소음·범위 밖 명중 정의를 거절한다',()=>{for(const[path,value]of [['/movementTurns',1.5],['/noiseMult',-1],['/meleeHit',-100]]as const){const loaded=loadMods([...readPackages(),{manifest:{id:'bad-posture',name:'잘못된 자세',version:'1',dependencies:['core']},defs:[],patches:[{op:'replace',target:'Posture.Crouch',path,value}]}],['bad-posture']);expect(loaded.report.errors.length).toBeGreaterThan(0)}})
 it('전체192 복원과 다음 실제 입력의 결정론을 보존한다',()=>{const d=setup();expect(toggle(d).ok).toBe(true);const restored=deserialize(serialize(d.s)),copy={db:d.w.db,s:restored};expect(restored.version).toBe(SAVE_VERSION);expect(serialize(restored)).toBe(serialize(d.s));expect(playerAct(d.w,{type:'move',dir:0})).toBeNull();expect(playerAct(copy,{type:'move',dir:0})).toBeNull();expect(serialize(copy.s)).toBe(serialize(d.s))})
 it('기록된191 각인에는 과거 자세나 소급 로그를 추가하지 않는다',()=>{const d=setup(),raw=JSON.parse(serialize(d.s));raw.version=191;const next=deserialize(JSON.stringify(raw));raw.version=SAVE_VERSION;expect(JSON.parse(serialize(next))).toEqual(raw);expect(Object.hasOwn(next.creatures[0],'crouching')).toBe(false)})
})
