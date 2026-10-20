import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { activityStep, perform } from '../src/core/actions'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { tradeAccess } from '../src/core/economy'
import { invalidateLights } from '../src/core/fov'
import { newGame, playerAct, runUntilInput } from '../src/core/game'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeTeaching, lessonQuote, requestLesson } from '../src/core/teaching'
import { initializeSettlement } from '../src/core/settlements'
import { db } from './helpers'
const template = newGame(db, { seed: 'teaching', overworld: true })
function setup() {
  const w: World = { db, s: structuredClone(template) }, p = player(w), m = w.s.overworld!, site = m.sites.find((s) => s.kind === 'settlement' && s.faction === 'coalition')!
  m.currentRegion = site.id; m.position = { ...site.cell }; w.s.creatures = [p]; w.s.time = 12 * 1200 * 100; w.s.weather = 'clear'; w.s.weatherUntil = 1e12; w.s.wind = { x: 0, y: 0 }; w.s.sources = []; w.s.storyteller.budget = -1e9; p.pos = { x: 20, y: 20 }
  const teacher = createCreature(w, 'Creature.SettlementTrader', { x: 21, y: 20 }); teacher.faction = site.faction!; teacher.residentSite = site.id; teacher.traderSite = site.id; teacher.home = { ...teacher.pos }; teacher.money = 50; w.s.creatures.push(teacher)
  for (const c of w.s.creatures) {
    c.nextAct = w.s.time; c.hp = 95; c.age = undefined; c.traits = []; c.traumas = []; c.background = undefined; c.effects = []; c.thoughts = []; c.equip = {}; c.bag = []; c.body.wounds = []; c.body.missing = []; c.body.blood = c.body.bloodMax; c.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }
    Object.assign(c.needs, { kcal: 1000, waterDeficit: 0, fatigue: 10, sleepDebt: 0, bodyTemp: 37, wetness: 0, stress: 0, protein: 100, vitamin: 100, ash: 0 })
  }
  p.money = 1000; p.literacy = 0; p.literate = false
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 25; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  w.s.map.lights = [{ pos: { ...p.pos }, radius: 8, kind: 'campfire' }]; invalidateLights(w)
  return { w, p, teacher, site }
}
const finishTeacher = (w: World, teacher: ReturnType<typeof createCreature>) => { teacher.activity!.remaining = 0; activityStep(w, teacher) }
describe('실제 NPC 문해 수업', () => {
  it('실제 정착지의 기존 상인이 가르치며 재진입/구형 문해 값을 덮어쓰지 않는다', () => {
    const { w, p } = setup(); w.s.creatures = [p]; for (let y = 12; y <= 25; y++) for (let x = 24; x <= 42; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] }); initializeSettlement(w)
    const teacher = w.s.creatures.find((c) => c.traderSite)!; expect(teacher.literacy).toBe(2); const hash = stateHash(w.s); initializeSettlement(w); expect(stateHash(w.s)).toBe(hash); teacher.literacy = 0; teacher.literate = false; initializeTeaching(w); expect(teacher.literacy).toBe(0)
  })
  it('견적은 읽기 전용이고 실제1시간 수업은 양쪽 시간/몸·현금만 사용한다', () => {
    const { w, p, teacher } = setup(), hash = stateHash(w.s), before = w.s.time, xp = p.xp, skills = structuredClone(p.skills), money = p.money!, cash = teacher.money!
    const q = lessonQuote(w, p, teacher); expect(q).toMatchObject({ error: null, turns: 1200, target: 10, days: [] }); expect(stateHash(w.s)).toBe(hash)
    expect(playerAct(w, { type: 'lesson', target: teacher.id, expectedFee: q.fee })).toBeNull(); expect(w.s.time - before).toBe(120000); expect([p.activity,teacher.activity]).toEqual([undefined,undefined]); expect(p.money).toBe(money-q.fee); expect(teacher.money).toBe(cash+q.fee); expect(p.literacyLessons?.days).toEqual([0]); expect(p.literacy).toBe(0); expect(p.needs.waterDeficit).toBeGreaterThan(0); expect(p.xp).toBe(xp); expect(p.skills).toEqual(skills)
  })
  it('교사 주도권이37TU 늦으면 실제 마지막100TU까지120037TU를 정산한다', () => {
    const { w, p, teacher } = setup(), before = w.s.time; teacher.nextAct += 37; expect(lessonQuote(w,p,teacher).turns).toBe(1201); expect(playerAct(w,{type:'lesson',target:teacher.id})).toBeNull(); expect(w.s.time-before).toBe(120037); expect(p.literacyLessons?.days).toHaveLength(1)
  })
  it('같은 날의 재수업·재접속은 진도나 돈을 다시 만들지 않는다', () => {
    const { w,p,teacher }=setup();expect(requestLesson(w,p,teacher)).toBeNull();finishTeacher(w,teacher);let hash=stateHash(w.s);expect(requestLesson(w,p,teacher)).toContain('오늘');expect(stateHash(w.s)).toBe(hash)
    const copy={db,s:deserialize(serialize(w.s))},cp=player(copy),ct=copy.s.creatures.find((c)=>c.id===teacher.id)!;hash=stateHash(copy.s);expect(requestLesson(copy,cp,ct)).toContain('오늘');expect(stateHash(copy.s)).toBe(hash)
  })
  it('서로 다른10일을 끝내야 문해1을 얻고 경험치·숙달·책 진도를 대신 주지 않는다', () => {
    const {w,p,teacher}=setup(),xp=p.xp,skill=structuredClone(p.skills),books=structuredClone(p.booksRead)
    for(let day=0;day<10;day++){w.s.time=(day*TURNS_PER_DAY+12*1200)*100;expect(requestLesson(w,p,teacher)).toBeNull();finishTeacher(w,teacher);expect(p.literacy).toBe(day===9?1:0)}
    expect(p.literate).toBe(true);expect(p.literacyLessons?.days).toEqual([0,1,2,3,4,5,6,7,8,9]);expect(p.xp).toBe(xp);expect(p.skills).toEqual(skill);expect(p.booksRead).toEqual(books);const hash=stateHash(w.s);expect(requestLesson(w,p,teacher)).toContain('이미');expect(stateHash(w.s)).toBe(hash)
  })
  it('같은 과정의 다른 실제 교사에게 날짜 진도를 이어서 배울 수 있다', () => {
    const {w,p,teacher,site}=setup();p.literacyLessons={course:'Teacher.Hearth',days:[0,1,2,3,4,5,6,7,8],teacher:teacher.name,at:turnOf(w)};w.s.time=(9*TURNS_PER_DAY+12*1200)*100;teacher.pos={x:25,y:20};const next=createCreature(w,'Creature.SettlementTrader',{x:21,y:20});next.faction=site.faction!;next.residentSite=site.id;next.nextAct=w.s.time;w.s.creatures.push(next)
    expect(requestLesson(w,p,next)).toBeNull();finishTeacher(w,next);expect(p.literacy).toBe(1);expect(p.literacyLessons?.teacher).toBe(next.name)
  })
  it('수동 중단은 양쪽 활동을 즉시 끊고 진도/환불을 만들지 않는다', () => {
    const {w,p,teacher}=setup(),q=lessonQuote(w,p,teacher);expect(requestLesson(w,p,teacher)).toBeNull();activityStep(w,teacher);expect(playerAct(w,{type:'stopActivity'})).toBeNull();expect([p.activity,teacher.activity]).toEqual([undefined,undefined]);expect(p.literacyLessons).toBeUndefined();expect(p.money).toBe(1000-q.fee);expect(teacher.money).toBe(50+q.fee)
  })
  it('교사의 수면/의식·거리·빛·손·시력·교전 변화는 진행 중 수업을 끊는다', () => {
    for(const kind of ['sleep','conscious','distance','light','hands','eyes','hearing','hostile']){
      const {w,p,teacher}=setup();expect(requestLesson(w,p,teacher)).toBeNull()
      if(kind==='sleep')teacher.asleep=true;if(kind==='conscious')teacher.unconscious=true;if(kind==='distance')teacher.pos={x:25,y:20};if(kind==='light'){w.s.time=0;w.s.map.lights=[];invalidateLights(w)};if(kind==='hands')teacher.body.missing=['LeftUpperArm','RightUpperArm'];if(kind==='eyes')teacher.body.missing=['LeftEye','RightEye'];if(kind==='hearing')p.body.missing=['LeftEar','RightEar'];if(kind==='hostile'){const foe=createCreature(w,'Creature.Reaver',{x:22,y:20});foe.ai.mode='hunt';foe.ai.target=teacher.id;w.s.creatures.push(foe)}
      activityStep(w,p);expect([p.activity,teacher.activity],kind).toEqual([undefined,undefined]);expect(p.literacyLessons).toBeUndefined()
    }
  })
  it('교사 부족 문해·이미 읽는 학생·지역/역할·돈·가격 변경은 원자적으로 거절한다', () => {
    for(const kind of ['teacher','pupil','site','role','money','fee']){
      const {w,p,teacher}=setup();if(kind==='teacher')teacher.literacy=1;if(kind==='pupil')p.literacy=1;if(kind==='site')teacher.residentSite='elsewhere';if(kind==='role')teacher.def='Creature.Settler';if(kind==='money')p.money=0
      const hash=stateHash(w.s);expect(requestLesson(w,p,teacher,kind==='fee'?999:undefined),kind).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
    }
  })
  it('수업 중에는 교사와 학생이 다른 거래나 중복 수업을 하지 않는다', () => {
    const {w,p,teacher}=setup();expect(requestLesson(w,p,teacher)).toBeNull();expect(tradeAccess(w,p,teacher)).toContain('수업');const hash=stateHash(w.s);expect(requestLesson(w,p,teacher)).toContain('하던');expect(stateHash(w.s)).toBe(hash)
  })
  it('교사가 사라지거나 짝 활동이 바뀌어도 다른 사람의 수업을 취소하지 않는다', () => {
    const {w,p,teacher}=setup();expect(requestLesson(w,p,teacher)).toBeNull();teacher.activity!.lessonAt!--;const other=structuredClone(teacher.activity);activityStep(w,p);expect(p.activity).toBeUndefined();expect(teacher.activity).toEqual(other);expect(p.literacyLessons).toBeUndefined()
  })
  it('수업 중간 각인과 재개는 날짜·몸·진도·현금까지 같다', () => {
    const {w,p,teacher}=setup();expect(requestLesson(w,p,teacher)).toBeNull();runUntilInput(w,60);expect(w.s.simulationPending).toBe(true);expect(teacher.activity!.remaining).toBeLessThan(1200);const copy={db,s:deserialize(serialize(w.s))};runUntilInput(w);runUntilInput(copy);expect(stateHash(copy.s)).toBe(stateHash(w.s));expect(player(copy).literacyLessons?.days).toEqual([0])
  })
  it('v17의 책·문해·몸·영양을 보존하고 진도/문해를 무료로 만들지 않는다', () => {
    const {w}=setup(),old=JSON.parse(serialize(w.s));old.version=17;const copy=deserialize(JSON.stringify(old));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:17}).toEqual(old)
  })
  it('가짜 대상·교사 없는 견적도 상태를 바꾸지 않는다', () => {
    const {w,p,teacher}=setup();teacher.def='Creature.Settler';const hash=stateHash(w.s);expect(lessonQuote(w,p,teacher).error).not.toBeNull();expect(perform(w,p,{type:'lesson',target:-1}).ok).toBe(false);expect(stateHash(w.s)).toBe(hash)
  })
})
