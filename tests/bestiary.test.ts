import {SAVE_VERSION} from '../src/core/game'
import { adjacentCorpse, perform } from '../src/core/actions'
import {describe,expect,it} from 'vitest'
import {bestiaryBody,bestiaryKnown,bestiaryCombatDetails,bestiaryDetails,bestiaryRange,bestiaryStage,ensureBestiary,knownCreatureName,learnBestiary,speciesDissections} from '../src/core/bestiary-state'
import {dissectionChance,dissectionError,finishDissection,noteBestiaryFight,observeBestiary,startDissection} from '../src/core/bestiary'
import {player,TURNS_PER_DAY,TURNS_PER_HOUR,type World} from '../src/core/ctx'
import {resolveAttack} from '../src/core/combat'
import {createCreature} from '../src/core/creatures'
import {newGame,playerAct,runUntilInput} from '../src/core/game'
import {addToBag,makeItem} from '../src/core/items'
import {invalidateLights} from '../src/core/fov'
import {activeThoughts} from '../src/core/thoughts'
import {diplomacyTick,reputation} from '../src/core/diplomacy'
import {studyBook} from '../src/core/skills'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {db,makeWorld} from './helpers'
function setup(world=false){
 const w:World=world?{db,s:newGame(db,{seed:'bestiary-contracts',background:'Bg.Deserter',overworld:true})}:makeWorld('bestiary-contracts','Bg.Deserter'),p=player(w)
 w.s.creatures=[p];w.s.knowledge.bestiary={};p.pos={x:20,y:20};p.traits=[];p.traumas=[];p.thoughts=[];p.effects=[];p.age=undefined;p.background=undefined;p.abilities=[];p.bag=[];p.equip={};p.body.wounds=[];p.body.missing=[];p.body.blood=p.body.bloodMax;p.stats={str:10,agi:10,per:12,vit:10,wil:10};p.hp=95;p.skills={medicine:0,survival:30};p.literacy=2
 Object.assign(p.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,fatigue:40,sleepDebt:0,stress:0,bodyTemp:37,wetness:0,skinWetness:{}})
 w.s.time=14*TURNS_PER_HOUR*100;p.nextAct=w.s.time;w.s.weather='clear';w.s.weatherUntil=1e12;w.s.wind={x:0,y:0}
 for(let y=17;y<=23;y++)for(let x=17;x<=23;x++)Object.assign(w.s.map.tiles[y*w.s.map.w+x],{t:'Terrain.Earth',roof:true,items:[]})
 w.s.map.lights=[{pos:{...p.pos},radius:6,kind:'campfire'}];invalidateLights(w)
 const knife=makeItem(w,'Item.RustyKnife');expect(addToBag(w,p,knife)).toBe(0);return {w,p,knife}
}
function wolf(w:World,def='Creature.AshHound',alive=false){const c=createCreature(w,def,{x:21,y:20});c.alive=alive;c.ai.mode='idle';if(!alive)c.deathTurn=w.s.time/100;w.s.creatures.push(c);return c}
function roll(w:World,pct:number){w.s.rng['world.knowledge']=[Math.floor(pct/100*4294967296),0,0,0]}
function dissect(w:World,c:ReturnType<typeof wolf>,success=true){const p=player(w);expect(startDissection(w,p,c.id,200)).toBeNull();roll(w,success?0:99);expect(finishDissection(w,p,p.activity!)).toBeNull();p.activity=undefined}
function finish(w:World){let n=0;while(w.s.simulationPending&&n++<10000)runUntilInput(w,200);expect(n).toBeLessThan(10000)}

describe('관찰·생존·해부·문헌은 다른 지식 단계다',()=>{
 it('첫목격S0에서 실제누적20턴 뒤S1이 되고 한턴의 반복조회/무리수로 빨라지지 않는다',()=>{
  const {w}=setup();expect(bestiaryKnown(w,'Creature.Amalgam')).toBe(false);expect(bestiaryDetails(w,'Creature.Amalgam').join(' ')).not.toContain('살덩이');const c=wolf(w,'Creature.AshHound',true);wolf(w,'Creature.AshHound',true);observeBestiary(w,false);expect(bestiaryStage(w,c.def)).toBe(0);expect(knownCreatureName(w,c)).toContain('네발짐승');expect(knownCreatureName(w,c)).not.toBe(c.name)
  for(let n=0;n<19;n++){w.s.time+=100;observeBestiary(w);observeBestiary(w)}expect(bestiaryStage(w,c.def)).toBe(0);w.s.time+=100;observeBestiary(w);expect(bestiaryStage(w,c.def)).toBe(1);expect(w.s.knowledge.bestiary[c.def].observeTurns).toBe(20);expect(knownCreatureName(w,c)).toBe(c.name)
 })
 it('60턴 이상 간격으로 다시목격한 세번째 조우는S1을 연다',()=>{
  const {w}=setup(),c=wolf(w,'Creature.AshHound',true);for(let n=0;n<3;n++){if(n)w.s.time+=60*100;observeBestiary(w,false)}expect(bestiaryStage(w,c.def)).toBe(1);expect(w.s.knowledge.bestiary[c.def].encounters).toBe(3)
 })
 it('벽뒤·수면·의식상실 동안 관찰시간을 쌓지 않는다',()=>{
  const {w,p}=setup(),c=wolf(w,'Creature.AshHound',true);c.pos={x:23,y:20};w.s.map.tiles[20*w.s.map.w+21].t='Terrain.KtWall';invalidateLights(w);for(let n=0;n<30;n++){w.s.time+=100;observeBestiary(w)}expect(w.s.knowledge.bestiary[c.def]).toBeUndefined();w.s.map.tiles[20*w.s.map.w+21].t='Terrain.Earth';invalidateLights(w);p.asleep=true;observeBestiary(w);p.asleep=false;p.unconscious=true;observeBestiary(w);expect(w.s.knowledge.bestiary[c.def]).toBeUndefined()
 })
 it('사체의 겉모습도 관찰되지만 죽였다는 사실만으로S3를 얻지 않는다',()=>{
  const {w}=setup(),c=wolf(w);for(let n=0;n<20;n++){w.s.time+=100;observeBestiary(w)}expect(bestiaryStage(w,c.def)).toBe(1);ensureBestiary(w,c.def).killed=1;expect(bestiaryStage(w,c.def)).toBe(2)
 })
 it('06검산1: 혈액2400/지각12의S1은1800~3000, S2는2200~2600이다',()=>{
  const {w,p}=setup();expect(wolf(w).body.bloodMax).toBe(2400);expect(wolf(w,'Creature.AshHoundAlpha').body.bloodMax).toBe(3120);expect(wolf(w,'Creature.BurrowRat').body.bloodMax).toBe(60);const hash=stateHash(w.s);expect(bestiaryRange(w,p,2400,0)).toBeNull();expect(bestiaryRange(w,p,2400,1)).toEqual([1800,3000]);expect(bestiaryRange(w,p,2400,2)).toEqual([2200,2600]);expect(bestiaryRange(w,p,2400,3)).toEqual([2400,2400]);expect(stateHash(w.s)).toBe(hash)
 })
 it('매의눈은 폭에서5%p를 더 줄이고 부위HP범위를0으로 반올림하지 않는다',()=>{
  const {w,p}=setup();p.traits=['Trait.KeenEyed'];expect(bestiaryRange(w,p,2400,1)).toEqual([1900,2900]);expect(bestiaryRange(w,p,10,1,1)).toEqual([8,12])
 })
 it('첫 공격만으로S2가 되지 않으며 교전 뒤 안전하게 벗어나면S2다',()=>{
  const {w}=setup(),c=wolf(w,'Creature.AshHound',true);noteBestiaryFight(w,c);expect(bestiaryStage(w,c.def)).toBe(0);c.pos={x:55,y:35};c.ai.mode='idle';w.s.time+=10*100;observeBestiary(w);expect(bestiaryStage(w,c.def)).toBe(2)
 })
 it('해부전상대HP/내부출혈/부위가중치는숨기되 자기상태와 판정공식은 공개한다',()=>{
  const {w,p}=setup(),c=wolf(w),lines=['50 + (공격치 2 − 회피치 1) × 2','HP 50 → 40','심각도 10/40','출혈 3 + 동맥 70','부위: 목 20 / 100','→ 심장 관통 (내출혈 20 ml/턴)']
  const hidden=bestiaryCombatDetails(w,c,lines);expect(hidden).toContain(lines[0]);expect(hidden.join(' ')).not.toMatch(/HP|심장|동맥 70|20 \/ 100/);expect(bestiaryCombatDetails(w,p,lines)).toEqual(lines);ensureBestiary(w,c.def).dissected=1;expect(bestiaryCombatDetails(w,c,lines)).toEqual(lines)
 })
 it('도감의유무는실제공격피해·상처·몸기능·난수를 바꾸지않는다',()=>{
  const a=setup(),b=setup(),x=wolf(a.w,'Creature.AshHound',true),y=wolf(b.w,'Creature.AshHound',true);ensureBestiary(b.w,y.def).dissected=1
  const r1=resolveAttack(a.w,a.p,x),r2=resolveAttack(b.w,b.p,y);expect(r1).toEqual(r2);expect(x.body).toEqual(y.body);expect(x.hp).toBe(y.hp);expect(a.w.s.rng).toEqual(b.w.s.rng)
 })
 it('구형 전투기록은S2를 유지하고 버전6각인의 몸/기록을 재보정하지 않는다',()=>{
  const {w}=setup(),oldWolf=wolf(w);oldWolf.body.bloodMax=2500;oldWolf.body.blood=1400;w.s.knowledge.bestiary['Creature.AshHound']={seen:0,fought:2,killed:0};expect(bestiaryStage(w,'Creature.AshHound')).toBe(2);const raw=JSON.parse(serialize(w.s));raw.version=6;const restored=deserialize(JSON.stringify(raw));expect(restored.version).toBe(SAVE_VERSION);expect({...restored,version:6}).toEqual(raw)
 })
 it('관찰중간 각인은 남은턴을 같은결과로 잇는다',()=>{
  const {w}=setup();wolf(w,'Creature.AshHound',true);for(let n=0;n<7;n++){w.s.time+=100;observeBestiary(w)}const copy={db:w.db,s:deserialize(serialize(w.s))};for(let n=0;n<13;n++){w.s.time+=100;copy.s.time+=100;observeBestiary(w);observeBestiary(copy)}expect(stateHash(w.s)).toBe(stateHash(copy.s));expect(bestiaryStage(copy,'Creature.AshHound')).toBe(1)
 })
})

describe('실제 사체·도구·재료와 해부 숙달',()=>{
 it('06검산1: 생존3/의료0/지각12/난이도20의 해부는42%다',()=>{
  const {w,p}=setup(),c=wolf(w),hash=stateHash(w.s);expect(dissectionChance(w,p,c)).toBe(42);expect(stateHash(w.s)).toBe(hash)
 })
 it('소지품없는사체도수색UI에서열지만 일반전리품탐색에는 넣지 않는다',()=>{
  const {w,p}=setup(),c=wolf(w);expect(adjacentCorpse(w,p,true)).toBeUndefined();const before=stateHash(w.s);expect(perform(w,p,{type:'search'}).ok).toBe(false);expect(stateHash(w.s)).toBe(before);expect(playerAct(w,{type:'search',includeEmpty:true})).toBeNull();finish(w);expect(w.s.loot).toEqual({kind:'corpse',id:c.id,pos:c.pos})
 })
 it('빈사체와전리품사체가이웃하면 기존수색은전리품을유지한다',()=>{
  const {w}=setup(),empty=wolf(w,'Creature.SporeMan'),full=wolf(w,'Creature.ShadeChief');expect(empty.bag).toHaveLength(0);expect(Object.values(full.equip).some(Boolean)).toBe(true);expect(playerAct(w,{type:'search'})).toBeNull();finish(w);expect(w.s.loot?.kind).toBe('corpse');expect(w.s.loot?.id).toBe(full.id);expect(empty.searched).toBeUndefined()
 })
 it('해부는 실제200턴 뒤S3/생존성공1회와 바닥의 가죽3·뼈2를 남긴다',()=>{
  const {w,p,knife}=setup(),c=wolf(w),start=w.s.time,xp=p.xp,ap=p.abilityPoints,skill=p.skills.survival;roll(w,0);expect(playerAct(w,{type:'dissect',target:c.id})).toBeNull();finish(w);expect(w.s.time-start).toBe(20000);expect(c.dissected?.success).toBe(true);expect(bestiaryStage(w,c.def)).toBe(3);expect(p.skills.survival).toBe(skill+1);expect([p.xp,p.abilityPoints]).toEqual([xp,ap]);expect(p.bag).toContain(knife);const items=w.s.map.tiles[c.pos.y*w.s.map.w+c.pos.x].items;expect(items.filter((i)=>i.def==='Item.RawHide')).toHaveLength(3);expect(items.filter((i)=>i.def==='Item.Bones')).toHaveLength(2)
 })
 it('실패는 실제수율을70%로줄이고 그사체를 다시갈라 반복학습하지 못한다',()=>{
  const {w,p}=setup(),c=wolf(w),before=p.skills.survival;dissect(w,c,false);expect(c.dissected?.yieldMult).toBe(.7);expect(bestiaryStage(w,c.def)).toBeLessThan(3);expect(p.skills.survival).toBe(before);const items=w.s.map.tiles[c.pos.y*w.s.map.w+c.pos.x].items;expect(items.filter((i)=>i.def==='Item.RawHide')).toHaveLength(2);expect(items.filter((i)=>i.def==='Item.Bones')).toHaveLength(1);const hash=stateHash(w.s);expect(startDissection(w,p,c.id,200)).toContain('이미');expect(stateHash(w.s)).toBe(hash)
 })
 it('같은종세번성공은 우두머리와공유하며 네번째는RNG없이자동성공한다',()=>{
  const {w,p}=setup();for(let n=0;n<3;n++)dissect(w,wolf(w,n===2?'Creature.AshHoundAlpha':'Creature.AshHound'));expect(speciesDissections(w,'Creature.AshHoundAlpha')).toBe(3);const c=wolf(w,'Creature.AshHoundAlpha');expect(dissectionChance(w,p,c)).toBe(100);startDissection(w,p,c.id,200);roll(w,99);const rng=JSON.stringify(w.s.rng);expect(finishDissection(w,p,p.activity!)).toBeNull();expect(c.dissected?.success).toBe(true);expect(JSON.stringify(w.s.rng)).toBe(rng);expect(dissectionChance(w,p,wolf(w,'Creature.BurrowRat'))).toBeLessThan(100)
 })
 it('S3에서만 내부장기·동맥/정확HP를 열고 문헌은S4행동지식을 연다',()=>{
  const {w}=setup(),c=wolf(w);const b=ensureBestiary(w,c.def);b.survived=true;b.specimen={def:c.def,blood:c.body.bloodMax,maxHp:{...c.body.maxHp}};expect(bestiaryBody(w,c.def).join(' ')).not.toContain('동맥');dissect(w,c);const lines=bestiaryBody(w,c.def).join(' ');expect(lines).toContain('동맥');expect(lines).toContain('심장');learnBestiary(w,'BestiaryEntry.Hound','책');expect(bestiaryStage(w,c.def)).toBe(4);expect(bestiaryDetails(w,c.def).join(' ')).toContain('먹이를 던지면')
 })
 it('도중선택한칼이사라지면 다른칼로 대체해 판정/재료를 내지 않는다',()=>{
  const {w,p,knife}=setup(),c=wolf(w);startDissection(w,p,c.id,200);const act={...p.activity!};p.bag=[];const other=makeItem(w,'Item.RustyKnife');addToBag(w,p,other);const hash=stateHash(w.s);expect(finishDissection(w,p,act)).toContain('도구');expect(stateHash(w.s)).toBe(hash);expect(c.dissected).toBeUndefined();expect(p.bag.some((i)=>i.uid===knife.uid)).toBe(false)
 })
 it('사체가멀어지거나 살아있는대상·말라붙은자면 상태를 바꾸지 않는다',()=>{
  const {w,p}=setup(),alive=wolf(w,'Creature.AshHound',true),human=wolf(w,'Creature.Withered');const hash=stateHash(w.s);expect(dissectionError(w,p,alive.id)).toContain('없다');expect(dissectionError(w,p,human.id)).toContain('얼마 전');alive.alive=false;alive.pos={x:25,y:20};expect(dissectionError(w,p,alive.id)).toContain('곁');alive.pos={x:21,y:21};w.s.map.tiles[20*w.s.map.w+21].t='Terrain.KtWall';w.s.map.tiles[21*w.s.map.w+20].t='Terrain.KtWall';expect(dissectionError(w,p,alive.id)).toContain('곁');w.s.map.tiles[20*w.s.map.w+21].t='Terrain.Earth';w.s.map.tiles[21*w.s.map.w+20].t='Terrain.Earth';alive.alive=true;alive.pos={x:21,y:20};expect(stateHash(w.s)).toBe(hash)
 })
 it('해부 중간저장과 복원이 성공/도구/재료/시간/관찰을 똑같이 잇는다',()=>{
  const {w}=setup(),c=wolf(w);roll(w,0);expect(playerAct(w,{type:'dissect',target:c.id},3)).toBeNull();expect(w.s.simulationPending).toBe(true);const copy={db:w.db,s:deserialize(serialize(w.s))};finish(w);finish(copy);expect(stateHash(w.s)).toBe(stateHash(copy.s))
 })
 it('기계분해는숙달대신 실제선택한도구의 품질 보정을 쓴다',()=>{
  const {w,p}=setup();w.db=loadMods([...readPackages(),{manifest:{id:'machine',name:'test',version:'1'},defs:[],patches:[{op:'replace',target:'BestiaryEntry.Hound',path:'/kind',value:'machine'}]}]).db;const c=wolf(w);p.skills={medicine:100,survival:100};p.bag=[];const hammer=makeItem(w,'Item.IronHammer');hammer.quality=0;addToBag(w,p,hammer);expect(dissectionChance(w,p,c)).toBe(19);hammer.quality=3;expect(dissectionChance(w,p,c)).toBe(34);expect(dissectionError(w,p,c.id)).toBeNull();startDissection(w,p,c.id,200);const chosen={...p.activity!};const extra=makeItem(w,'Item.IronHammer');extra.quality=5;addToBag(w,p,extra);roll(w,40);expect(finishDissection(w,p,chosen)).toBeNull();expect(c.dissected?.success).toBe(false)
 })
 it('NPC의해부도 같은판정과재료를 쓰며 플레이어 대신 배우지 않는다',()=>{
  const {w}=setup(),c=wolf(w),npc=createCreature(w,'Creature.Reaver',{x:20,y:21});npc.pos={x:20,y:20};npc.traits=[];npc.age=undefined;npc.stats.per=12;npc.skills={survival:30};npc.bag=[makeItem(w,'Item.RustyKnife')];const hash=JSON.stringify(w.s.knowledge);startDissection(w,npc,c.id,200);roll(w,0);expect(finishDissection(w,npc,npc.activity!)).toBeNull();expect(npc.bestiary?.[c.def].dissected).toBe(1);expect(JSON.stringify(w.s.knowledge)).toBe(hash)
 })
})

describe('문헌과 인간해부의 실제 결과',()=>{
 it('생물지완독은관련종을S4로열되 경험치·능력포인트를 주지 않는다',()=>{
  const {w,p}=setup(),before=[p.xp,p.abilityPoints];studyBook(w,p,'Item.HighlandBestiary',true);expect(bestiaryStage(w,'Creature.AshHound')).toBe(4);expect(bestiaryStage(w,'Creature.Amalgam')).toBe(4);expect([p.xp,p.abilityPoints]).toEqual(before)
 })
 it('미목격인체해부는기분−8을주며 세력에소식을만들지 않는다',()=>{
  const {w,p}=setup(true),c=wolf(w,'Creature.Reaver');dissect(w,c);expect(activeThoughts(w,p).find((t)=>t.def==='Thought.DissectHuman')?.mood).toBe(-8);expect(w.s.overworld?.society?.events??[]).toHaveLength(0)
 })
 it('목격된인체해부는모든인간세력에소식을보내고 거리에따라평판을적용한다',()=>{
  const {w,p}=setup(true),c=wolf(w,'Creature.Reaver'),witness=createCreature(w,'Creature.Reaver',{x:20,y:21});witness.faction='guild';witness.asleep=false;witness.unconscious=false;w.s.creatures.push(witness);const factions=['coalition','guild','reavers','pilgrims','guard'],before=factions.map((f)=>reputation(w,f));dissect(w,c);const events=w.s.overworld!.society!.events.filter((e)=>e.reason==='인체 해부 목격');expect(events.map(e=>e.faction).sort()).toEqual(w.db.all<import('../src/core/types').FactionDef>('Faction').filter(f=>!f.territorial&&!f.unlock).map(f=>f.key).sort());expect(events.some((e)=>e.arrives>e.turn)).toBe(true);w.s.time+=4*TURNS_PER_DAY*100;diplomacyTick(w);expect(factions.map((f)=>reputation(w,f))).toEqual(before.map((n)=>n-5));expect(activeThoughts(w,p).find((t)=>t.def==='Thought.DissectHuman')).toBeUndefined();expect(events.some(e=>e.faction==='guardReform')).toBe(false);w.s.overworld!.society!.unlocks=['calvis-public'];const another=wolf(w,'Creature.Reaver');dissect(w,another);expect(w.s.overworld!.society!.events.some(e=>e.target===another.id&&e.faction==='guardReform')).toBe(true)
 })
})
