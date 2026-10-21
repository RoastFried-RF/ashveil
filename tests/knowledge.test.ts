import {SAVE_VERSION} from '../src/core/game'
import {describe,expect,it} from 'vitest'
import {identification,identifyPill,startTaste,finishTaste,usePill} from '../src/core/knowledge'
import {pillBelief,recordPill,readingPageTurns} from '../src/core/knowledge-state'
import {drugEffects} from '../src/core/drug-state'
import {drugLines} from '../src/core/pharmacology'
import {addWound,painTotal} from '../src/core/body'
import {createCreature} from '../src/core/creatures'
import {activityStep,perform} from '../src/core/actions'
import {playerAct,runUntilInput} from '../src/core/game'
import {player,TURNS_PER_HOUR,type World} from '../src/core/ctx'
import {addToBag,canStack,itemLabel,makeItem} from '../src/core/items'
import {invalidateLights} from '../src/core/fov'
import {studyBook} from '../src/core/skills'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {makeWorld} from './helpers'
function setup(){
 const w=makeWorld('knowledge-contracts','Bg.Deserter'),p=player(w)
 w.s.creatures=[p];p.pos={x:20,y:20};p.traits=[];p.traumas=[];p.thoughts=[];p.effects=[];p.age=undefined;p.background=undefined;p.abilities=[];p.bag=[];p.equip={};p.body.wounds=[];p.body.blood=p.body.bloodMax;p.stats={str:10,agi:10,per:12,vit:10,wil:10};p.hp=95;p.skills={medicine:5,survival:0};p.literacy=1;p.booksRead=[]
 Object.assign(p.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:20,hygiene:100,fatigue:40,sleepDebt:0,stress:0,bodyTemp:37,wetness:0,skinWetness:{}})
 w.s.time=14*TURNS_PER_HOUR*100;p.nextAct=w.s.time;w.s.weather='clear';w.s.weatherUntil=1e12;w.s.wind={x:0,y:0}
 for(let y=17;y<=23;y++)for(let x=17;x<=23;x++)Object.assign(w.s.map.tiles[y*w.s.map.w+x],{t:'Terrain.Earth',roof:true,items:[]})
 w.s.map.lights=[{pos:{...p.pos},radius:6,kind:'campfire'}];invalidateLights(w)
 return {w,p}
}
// 종류 감별/분량의 기존 계약은 명시적인100%·미변질 표본으로 검사한다. 노화 표본은 pill-aging.test.ts에서 별도 검사한다.
function pill(w:World,effect:string,count=1){const it=makeItem(w,'Item.PillWhite',count);it.pillAge={potency:100,spoiled:false};expect(addToBag(w,player(w),it)).toBe(0);w.s.knowledge.pillMap[it.def]='Pill.'+effect;return it}
function add(w:World,id:string){const it=makeItem(w,'Item.'+id);expect(addToBag(w,player(w),it)).toBe(0);return it}
function finish(w:World){let n=0;while(w.s.simulationPending&&n++<10000)runUntilInput(w,200);expect(n).toBeLessThan(10000)}
function roll(w:World,percent:number){w.s.rng['world.knowledge']=[Math.floor(percent/100*4294967296),0,0,0]}

describe('규칙은 공개되고 알약의 정체는 관찰로 배운다',()=>{
 it('06 검산3: 지각12/의료1의 감별은26%·오인8%p, 맛보기47%·1%p다',()=>{
  const {w,p}=setup(),it=pill(w,'Sedative');expect(identification(w,p,it.def)).toEqual({score:17,difficulty:25,chance:26,mistake:8});expect(identification(w,p,it.def,true)).toEqual({score:24,difficulty:25,chance:47,mistake:1})
 })
 it('실제 지각·의료·매의 눈 보정과5/95%상한을 사용한다',()=>{
  const {w,p}=setup(),it=pill(w,'Sedative');p.traits=['Trait.KeenEyed'];expect(identification(w,p,it.def).score).toBe(22)
  p.traits=[];p.stats.per=1;p.skills.medicine=0;expect(identification(w,p,it.def).chance).toBe(5);p.stats.per=20;p.skills.medicine=100;expect(identification(w,p,it.def).chance).toBe(95)
 })
 it('감별 실패의8%p구간은 틀린 추정을 만들고 진짜 정체를 확정하지 않는다',()=>{
  const {w,p}=setup(),it=pill(w,'Sedative');roll(w,30);identifyPill(w,p,it.def);expect(pillBelief(w,it.def)?.confidence).toBe('likely');expect(pillBelief(w,it.def)?.belief).not.toBe('Pill.Sedative');expect(w.s.knowledge.pillKnown[it.def]).toBeUndefined();expect(itemLabel(w,it)).toContain('추정')
 })
 it('성공·모름을 구분하고 감별 조회는 RNG나 상태를 바꾸지 않는다',()=>{
  const {w,p}=setup(),it=pill(w,'Sedative'),hash=stateHash(w.s);identification(w,p,it.def);expect(stateHash(w.s)).toBe(hash)
  roll(w,80);identifyPill(w,p,it.def);expect(pillBelief(w,it.def)?.confidence).toBe('unknown');roll(w,0);identifyPill(w,p,it.def);expect(w.s.knowledge.pillKnown[it.def]).toBe('Pill.Sedative')
 })
 it('확정한 구형 지식은 나중의 오독·추정으로 덮이지 않는다',()=>{
  const {w}=setup(),it=pill(w,'Sedative');w.s.knowledge.pillKnown[it.def]='Pill.Sedative';recordPill(w,it.def,'book','오독','Pill.Toxin','likely');expect(pillBelief(w,it.def)?.confidence).toBe('certain');expect(pillBelief(w,it.def)?.belief).toBe('Pill.Sedative')
 })
 it('통증 없는 진통제는 실제 약효만 적용하고 이름/효능을 누설하지 않는다',()=>{
  const {w,p}=setup(),it=pill(w,'Analgesic');w.s.rng.body=[0,0,0,1];expect(usePill(w,p,it)).toBeNull();expect(drugEffects(w,p).pain).toBe(50);expect(w.s.knowledge.pillKnown[it.def]).toBeUndefined();expect(drugLines(w,p).join(' ')).not.toContain('백색 정제');expect(w.s.log.map((l)=>l.text).join(' ')).not.toContain('백색 정제');expect(pillBelief(w,it.def)?.ruledOut).toContain('Pill.Sedative');expect(pillBelief(w,it.def)?.ruledOut).not.toContain('Pill.Analgesic')
 })
 it('실제 통증15이상에서 진통 효과를 보면 정체를 확정한다',()=>{
  const {w,p}=setup(),it=pill(w,'Analgesic');addWound(w,p,{def:'Wound.Cut',part:'LeftForearm',severity:20,source:'검증'});const before=painTotal(w,p);expect(before).toBeGreaterThanOrEqual(15);usePill(w,p,it);expect(painTotal(w,p)).toBeLessThan(before);expect(w.s.knowledge.pillKnown[it.def]).toBe('Pill.Analgesic')
 })
 it('항생제는 감염 중에만 식별하고 비타민은 수치 회복만으로 확정하지 않는다',()=>{
  const {w,p}=setup(),it=pill(w,'Antibiotic');usePill(w,p,it);expect(w.s.knowledge.pillKnown[it.def]).toBeUndefined()
  const x=setup(),a=pill(x.w,'Antibiotic');const wd=addWound(x.w,x.p,{def:'Wound.Cut',part:'LeftForearm',severity:5,source:'검증'}).wound;wd.infection={progress:5,immunity:0};usePill(x.w,x.p,a);expect(x.w.s.knowledge.pillKnown[a.def]).toBe('Pill.Antibiotic')
  const v=setup(),b=pill(v.w,'Vitamin');usePill(v.w,v.p,b);expect(v.p.needs.vitamin).toBe(60);expect(v.w.s.knowledge.pillKnown[b.def]).toBeUndefined()
 })
 it('수면제의 눈에 띄는 사용은 잘못된 믿음을 바로잡고 실제 수면을 시작한다',()=>{
  const {w,p}=setup(),it=pill(w,'Sedative');recordPill(w,it.def,'examine','추정','Pill.Analgesic','likely');usePill(w,p,it);expect(w.s.knowledge.pillKnown[it.def]).toBe('Pill.Sedative');expect(p.activity?.drugSleep).toBe(true);expect(p.history.at(-1)?.text).toContain('수면제')
 })
 it('무반응이 앞선 각성제 추정을 반박하면 미확인으로 되돌린다',()=>{
  const {w,p}=setup(),it=pill(w,'Vitamin');recordPill(w,it.def,'examine','추정','Pill.Stimulant','likely');usePill(w,p,it);expect(pillBelief(w,it.def)?.belief).toBeUndefined();expect(pillBelief(w,it.def)?.confidence).toBe('unknown')
  const x=setup(),vit=pill(x.w,'Vitamin');addWound(x.w,x.p,{def:'Wound.Cut',part:'LeftForearm',severity:20,source:'검증'});usePill(x.w,x.p,vit);expect(pillBelief(x.w,vit.def)?.ruledOut).toContain('Pill.Analgesic')
 })
 it('NPC 복용은 몸에 적용되지만 플레이어에게 비밀 지식을 주지 않는다',()=>{
  const {w}=setup(),npc=createCreature(w,'Creature.Reaver',{x:21,y:20}),it=makeItem(w,'Item.PillWhite');it.pillAge={potency:100,spoiled:false};w.s.knowledge.pillMap[it.def]='Pill.Stimulant';npc.bag=[it];npc.needs.fatigue=80;usePill(w,npc,it);expect(npc.needs.fatigue).toBe(40);expect(w.s.knowledge.pillKnown[it.def]).toBeUndefined();expect(w.s.knowledge.pillBeliefs).toBeUndefined()
 })
 it('감별 활동은6턴이며 약을 소비하지 않는다',()=>{
  const {w,p}=setup(),it=pill(w,'Vitamin'),start=w.s.time;expect(playerAct(w,{type:'examine',uid:it.uid})).toBeNull();finish(w);expect(w.s.time-start).toBe(600);expect(p.bag).toContain(it)
 })
})

describe('부분 시음은 실제 조각·효과·시간·각인으로 남는다',()=>{
 it('¼시음은3턴 뒤 비타민10만 올리고 같은UID의¾조각을 남긴다',()=>{
  const {w,p}=setup(),it=pill(w,'Vitamin'),start=w.s.time;expect(playerAct(w,{type:'taste',uid:it.uid})).toBeNull();finish(w);expect(w.s.time-start).toBe(300);expect(p.needs.vitamin).toBeCloseTo(30,3);expect(it.pillRemaining).toBe(.75);expect(it.count).toBe(1);expect(itemLabel(w,it)).toContain('3/4정')
 })
 it('두 알 더미에서 시음하면 온전한 한 알과별도¾알을 보존한다',()=>{
  const {w,p}=setup(),it=pill(w,'Vitamin',2);expect(startTaste(w,p,it.uid)).toBeNull();expect(finishTaste(w,p,it.uid)).toBeNull();const pieces=p.bag.filter((i)=>i.def===it.def);expect(pieces).toHaveLength(2);expect(it.count).toBe(1);expect(pieces.reduce((n,i)=>n+i.count*(i.pillRemaining??1),0)).toBe(1.75);expect(pieces.find((i)=>i.pillRemaining)?.uid).not.toBe(it.uid);expect(canStack(pieces[0],pieces[1])).toBe(false)
 })
 it('남은¾복용은 효과30만 적용하고 그조각UID만 소비한다',()=>{
  const {w,p}=setup(),it=pill(w,'Vitamin',2);finishTaste(w,p,it.uid);const part=p.bag.find((i)=>i.pillRemaining)!;const before=p.needs.vitamin;expect(perform(w,p,{type:'consume',uid:part.uid}).ok).toBe(true);expect(p.needs.vitamin-before).toBe(30);expect(p.bag).toContain(it);expect(p.bag.some((i)=>i.uid===part.uid)).toBe(false)
 })
 it('네번 맛보아 한 알만 소진하며 조각/복용량을 복제하지 않는다',()=>{
  const {w,p}=setup(),it=pill(w,'Vitamin');for(let n=0;n<4;n++)expect(finishTaste(w,p,it.uid)).toBeNull();expect(p.needs.vitamin).toBe(60);expect(p.bag).toHaveLength(0)
 })
 it('수면제¼는 의식감점.02와30분수면이며3턴활동 뒤 새수면을 지우지 않는다',()=>{
  const {w,p}=setup(),it=pill(w,'Sedative'),start=w.s.time;expect(playerAct(w,{type:'taste',uid:it.uid},3)).toBeNull();expect(drugEffects(w,p).consciousness).toBeCloseTo(.02,12);expect(p.activity?.drugSleep).toBe(true);finish(w);expect(w.s.time-start).toBe(60200);expect(p.asleep).toBe(false);expect(it.pillRemaining).toBe(.75)
 })
 it('v5 각인은 기존 약물·몸·내성·영양을 보존하며 버전만7으로 올린다',()=>{
  const {w,p}=setup(),it=pill(w,'Analgesic');usePill(w,p,it);const raw=JSON.parse(serialize(w.s));raw.version=5;const restored=deserialize(JSON.stringify(raw));expect(restored.version).toBe(SAVE_VERSION);expect({...restored,version:5}).toEqual(raw)
 })
 it('시음 중간 저장·복원은 잔량/효과/시간/감별을 똑같이 잇는다',()=>{
  const {w}=setup(),it=pill(w,'Vitamin',2);expect(playerAct(w,{type:'taste',uid:it.uid},1)).toBeNull();expect(w.s.simulationPending).toBe(true);const copy={db:w.db,s:deserialize(serialize(w.s))};finish(w);finish(copy);expect(stateHash(w.s)).toBe(stateHash(copy.s))
 })
 it('배낭이 꽉 차면 분리할 여지가 없는 더미를 맛보지 않고 상태를 보존한다',()=>{
  const {w,p}=setup(),it=pill(w,'Vitamin',2);p.bag=[];for(let y=0;y<6;y++)for(let x=0;x<10;x++){const cell=makeItem(w,'Item.PillWhite',x===0&&y===0?2:1);cell.gx=x;cell.gy=y;p.bag.push(cell)}const uid=p.bag[0].uid,hash=stateHash(w.s);expect(startTaste(w,p,uid)).toContain('한 칸');expect(stateHash(w.s)).toBe(hash);expect(it.count).toBe(2)
 })
 it('완료 전에 선택UID가 사라지면 다른 알약을 대신 쓰지 않는다',()=>{
  const {w,p}=setup(),it=pill(w,'Vitamin');startTaste(w,p,it.uid);p.bag=[];const other=pill(w,'Vitamin');const hash=stateHash(w.s);expect(finishTaste(w,p,it.uid)).toContain('없다');expect(stateHash(w.s)).toBe(hash);expect(p.bag).toContain(other)
 })
})

describe('책의 실제 지식과 문해 이정표',()=>{
 it('약전은 현재 시드의 대응표를 확정하며 경험치·능력포인트를 주지 않는다',()=>{
  const {w,p}=setup(),before={xp:p.xp,ap:p.abilityPoints};p.literacy=3;studyBook(w,p,'Item.PioneerPharmacopoeia',true);for(const [appearance,effect] of Object.entries(w.s.knowledge.pillMap))expect(w.s.knowledge.pillKnown[appearance]).toBe(effect);expect({xp:p.xp,ap:p.abilityPoints}).toEqual(before);const hash=stateHash(w.s);expect(studyBook(w,p,'Item.PioneerPharmacopoeia',true)).toBe(0);expect(stateHash(w.s)).toBe(hash)
 })
 it('문해1의10%오독은 실제로 틀린 추정을 저장하고 확정 지식은 보존한다',()=>{
  const {w,p}=setup(),known=Object.entries(w.s.knowledge.pillMap).find(([,e])=>e==='Pill.Analgesic')!;w.s.knowledge.pillKnown[known[0]]=known[1];w.s.rng.body=[0,0,0,1];studyBook(w,p,'Item.PillPrimer',true);const wrong=Object.entries(w.s.knowledge.pillMap).find(([,e])=>e==='Pill.Antibiotic')!;expect(p.misreadBooks).toContain('Item.PillPrimer');expect(pillBelief(w,wrong[0])?.confidence).toBe('likely');expect(pillBelief(w,wrong[0])?.belief).not.toBe(wrong[1]);expect(w.s.knowledge.pillKnown[known[0]]).toBe(known[1])
 })
 it('글자 익히기는 문맹도30시간 독학하고 사전은읽음에서13.3시간이 필요하다',()=>{
  const {w,p}=setup(),primer=add(w,'AlphabetPrimer');p.literacy=0;expect(perform(w,p,{type:'read',uid:primer.uid}).ok).toBe(true);expect(p.activity?.remaining).toBe(36000);p.activity=undefined;const dict=add(w,'PioneerDictionary');p.literacy=2;expect(perform(w,p,{type:'read',uid:dict.uid}).ok).toBe(true);expect(player(w).activity?.remaining).toBe(16000);p.literacy=3;expect(readingPageTurns(w,p)).toBe(14)
 })
 it('실제 마지막쪽 읽기로0→1·2→3을 올리고 중간진행을 보존한다',()=>{
  const {w,p}=setup(),primer=add(w,'AlphabetPrimer');p.literacy=0;primer.readPages=1799;perform(w,p,{type:'read',uid:primer.uid});for(let n=0;n<10;n++)activityStep(w,p);const copy={db:w.db,s:deserialize(serialize(w.s))};for(let n=0;n<10;n++){activityStep(w,p);activityStep(copy,player(copy))}expect(p.literacy).toBe(1);expect(stateHash(w.s)).toBe(stateHash(copy.s));p.literacy=2;const dict=add(w,'PioneerDictionary');dict.readPages=799;perform(w,p,{type:'read',uid:dict.uid});for(let n=0;n<20;n++)activityStep(w,p);expect(p.literacy).toBe(3)
 })
 it('불완전한책은 문해3권 이정표나 약전 식별을 주지 않는다',()=>{
  const {w,p}=setup();studyBook(w,p,'Item.PillPrimer',true,.8);expect(Object.keys(w.s.knowledge.pillKnown)).toHaveLength(0);studyBook(w,p,'Item.MedicalGuide');studyBook(w,p,'Item.FieldManual');expect(p.literacy).toBe(1);studyBook(w,p,'Item.SurvivalGuide');expect(p.literacy).toBe(2)
 })
 it('낮은 문해로 사전/고문서를 시작하면 시간·상태·지식을 바꾸지 않는다',()=>{
  const {w,p}=setup(),book=add(w,'PioneerDictionary'),hash=stateHash(w.s);expect(perform(w,p,{type:'read',uid:book.uid}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)
 })
})
