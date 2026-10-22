import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { calendar, climateCell, climateDef, eruptTower, rainAcidity, regionalTemperature, seasonPhase, setTowerOutput, sunTimes, veilConcentration, weatherDef } from '../src/core/climate-state'
import { climateTick, initializeClimate, nearbyIce, nearbySnow } from '../src/core/climate'
import { ambientTemp, daylight, regionalWeatherAt, weatherTick } from '../src/core/environment'
import { player, rng, tileAt, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { newGame, playerAct, runUntilInput } from '../src/core/game'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { invalidateLights, sightRange } from '../src/core/fov'
import { ambientNoise, scentTick } from '../src/core/perception'
import { addToBag, makeItem } from '../src/core/items'
import { gearTick } from '../src/core/gear-care'
import { temperatureTick, thermalState, wetnessTick, windStrength } from '../src/core/thermal'
import { perform, stumbleChance } from '../src/core/actions'
import { nearbyWater } from '../src/core/water'
import { waterLines } from '../src/core/water-state'
import { washSupply } from '../src/core/food-safety'
import { createCreature } from '../src/core/creatures'
import { needsTick } from '../src/core/needs'
import type { Weather } from '../src/core/types'
import { db } from './helpers'
function setDay(w: World, day: number, hour = 14) { const offset = (day - climateDef(w).startDay + 90) % 90; w.s.time = (offset * TURNS_PER_DAY + hour * TURNS_PER_HOUR) * 100; player(w).nextAct = w.s.time; player(w).needs.nutritionDay = Math.floor(w.s.time / (TURNS_PER_DAY * 100)) }
function setup(weather: Weather = 'overcast'): World {
  const w = { db, s: newGame(db, { seed: 'climate-canon', background: 'Bg.Deserter', overworld: true }) }, p = player(w)
  p.pos = { x: 30, y: 30 }; p.traits = []; p.abilities = []; p.traumas = []; p.thoughts = []; p.effects = []; p.equip = {}; p.bag = []; p.age = undefined
  p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.hp = 90; p.body.wounds = []; p.cond = {}; p.body.blood = p.body.bloodMax; p.unconscious = false
  Object.assign(p.needs, { kcal: 2000, waterDeficit: 500, protein: 100, vitamin: 100, bodyTemp: 37, wetness: 0, fatigue: 10, stress: 0, skinWetness: undefined, thermal: undefined })
  w.s.creatures = [p]; w.s.weather = weather; w.s.weatherUntil = 1e12; w.s.wind = { x: 0, y: 0 }; w.s.map = { ...w.s.map, lights: [] }
  for (let y = 27; y <= 33; y++) for (let x = 27; x <= 33; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: false, items: [], snow: undefined, icy: undefined })
  setDay(w, 28); return w
}
function finish(w: World) { let guard = 0; while (w.s.simulationPending && guard++ < 1000) runUntilInput(w, 200); expect(guard).toBeLessThan(1000) }
function add(w: World, id: string) { const it = makeItem(w, id); expect(addToBag(w, player(w), it)).toBe(0); return it }

describe('4계절·지역 기후와8날씨', () => {
  it('90일/20·15·20·35 기본 달력을 돌고 여름/겨울의 위상을 맞춘다', () => {
    const w = setup(); expect(db.all('Season')).toHaveLength(4); expect(db.all('Weather')).toHaveLength(8)
    for (const [day, label, seasonDay] of [[1,'봄',1],[20,'봄',20],[21,'여름',1],[35,'여름',15],[36,'가을',1],[55,'가을',20],[56,'겨울',1],[90,'겨울',35]] as const) { setDay(w, day); expect(calendar(w).season.label).toBe(label); expect(calendar(w).seasonDay).toBe(seasonDay) }
    expect(seasonPhase(w, 28)).toBe(1); expect(seasonPhase(w, 73)).toBe(-1); expect(seasonPhase(w, 45)).toBe(0)
  })
  it('문서 검산: 여름28일14시 흐림9.6°C, 겨울73일05시 맑음−18.4°C다', () => {
    const w = setup(); expect(climateCell(w).temperature).toBe(-4.4); expect(ambientTemp(w)).toBe(9.6)
    setDay(w, 73, 5); w.s.weather = 'clear'; expect(ambientTemp(w)).toBe(-18.4)
    w.s.map.kind = 'dungeon'; w.s.map.depth = 1; expect(ambientTemp(w)).toBe(6); w.s.map.depth = 3; expect(ambientTemp(w)).toBe(12)
  })
  it('계절의 일출/일몰과 계절 장막이 실제 조도·빗물 산성도에 반영된다', () => {
    const w = setup(); expect(sunTimes(w)).toEqual({ sunrise: 5, sunset: 20 }); expect(veilConcentration(w)).toBe(30); expect(rainAcidity(w)).toBe(1)
    setDay(w, 73); expect(sunTimes(w)).toEqual({ sunrise: 8, sunset: 16 }); expect(veilConcentration(w)).toBe(50); expect(rainAcidity(w)).toBe(2)
    setDay(w, 28, 18); const summer = daylight(w); setDay(w, 73, 18); expect(daylight(w)).toBeLessThan(summer)
  })
  it('탑 분출이 농도를 올리고 매일2씩 줄며 출력 변경은 기온과 장막을 함께 바꾼다', () => {
    const w = setup(), m = w.s.overworld!, tower = m.towers.find((t) => t.id === 'Region.ChimneySeven')!
    const p = { ...m.position }, base = veilConcentration(w); expect(eruptTower(w, tower.id)).toBe(true); expect(veilConcentration(w)).toBe(base + 10)
    w.s.time += TURNS_PER_DAY * 100; expect(veilConcentration(w)).toBeLessThan(base + 10)
    const temp = regionalTemperature(w); expect(setTowerOutput(w, tower.id, 0)).toBe(true); expect(regionalTemperature(w)).toBeGreaterThan(temp); expect(m.position).toEqual(p); expect(eruptTower(w, tower.id)).toBe(false)
  })
  it('비·폭풍은 옷/피부를 대칭적으로 적시고 폭풍은 두 배다', () => {
    const a = setup('ashrain'), b = setup('ashstorm'); wetnessTick(a, player(a)); wetnessTick(b, player(b)); expect(player(a).needs.wetness).toBe(.5); expect(player(b).needs.wetness).toBe(1)
  })
  it('폭풍·서리안개가 실제 시야를 줄이고 재바람은 풍속과 눈 자극을 더한다', () => {
    const w = setup(), p = player(w), base = sightRange(w, p), normal = windStrength(w, p)
    w.s.weather = 'ashstorm'; expect(sightRange(w, p)).toBeLessThan(base); expect(ambientNoise(w)).toBe(6)
    w.s.weather = 'frostfog'; expect(sightRange(w, p)).toBe(4)
    w.s.weather = 'ashgale'; expect(windStrength(w, p)).toBe(normal + 2); expect(sightRange(w, p)).toBe(4)
    tileAt(w, p.pos).roof = true; expect(windStrength(w, p)).toBe(0)
  })
  it('폭풍은 냄새 발생을1/4로 씻고 금속을 재비의 두 배로 부식시킨다', () => {
    const a = setup('ashrain'), b = setup('ashstorm')
    for (const w of [a,b]) { w.s.time += 100; const p = player(w); p.equip.main = makeItem(w, 'Item.Machete'); scentTick(w, p, 40); gearTick(w, p) }
    expect(player(a).scent).toBe(2); expect(player(b).scent).toBe(1)
    expect(player(b).equip.main!.corrosion).toBeCloseTo(player(a).equip.main!.corrosion! * 2)
  })
  it('분리 날씨 스트림은 전투 난수와 무관하고 저장 중간에도 같은 전이를 낸다', () => {
    const a = setup(), b = { db, s: deserialize(serialize(a.s)) }; rng(b, 'combat').int(0, 100)
    const observed = new Set<Weather>()
    for (let i = 0; i < 200; i++) { for (const w of [a,b]) { w.s.time += 6 * TURNS_PER_HOUR * 100; w.s.weatherUntil = 0; weatherTick(w) }; expect(a.s.weather).toBe(b.s.weather); expect(a.s.wind).toEqual(b.s.wind); observed.add(a.s.weather) }
    expect(observed.size).toBe(8)
  })
  it('따뜻한 여름의 날씨 전이는 쌓일 수 없는 눈 대신 비를 고른다', () => {
    const w = setup()
    for (let i = 0; i < 100; i++) { setDay(w, 28, i % 24); w.s.weatherUntil = 0; weatherTick(w); expect(weatherDef(w).precipitation).not.toBe('snow') }
  })
  it('서로 다른 지역의 방문 순서를 바꿔도 날씨와 하위 난수 상태가 같다', () => {
    const a=setup(),b={db,s:deserialize(serialize(a.s))},p={x:24,y:69},q={x:36,y:64}
    regionalWeatherAt(a,p);regionalWeatherAt(a,q);regionalWeatherAt(b,q);regionalWeatherAt(b,p)
    expect(a.s.overworld!.weatherCells).toEqual(b.s.overworld!.weatherCells);expect(a.s.rng).toEqual(b.s.rng);expect(stateHash(a.s)).toBe(stateHash(b.s))
  })
  it('비운 지역의 한 번 따라잡기는 매6시간씩 진행한 결과와 같다', () => {
    const a=setup(),b={db,s:deserialize(serialize(a.s))},p={x:24,y:69}
    for(let i=0;i<12;i++){a.s.time+=6*TURNS_PER_HOUR*100;regionalWeatherAt(a,p)}
    b.s.time=a.s.time;regionalWeatherAt(b,p);expect(stateHash(a.s)).toBe(stateHash(b.s))
  })
  it('뒤에 일어난 탑 분출·정지가 과거 날씨에 소급되지 않는다', () => {
    const a=setup(),b={db,s:deserialize(serialize(a.s))},p={x:24,y:69},id='Region.ChimneySeven'
    regionalWeatherAt(a,p)
    for(const w of [a,b]){w.s.time+=TURNS_PER_HOUR*100;eruptTower(w,id);setTowerOutput(w,id,0);w.s.time+=12*TURNS_PER_HOUR*100}
    regionalWeatherAt(a,p);regionalWeatherAt(b,p)
    expect(a.s.overworld!.weatherCells).toEqual(b.s.overworld!.weatherCells);expect(a.s.rng).toEqual(b.s.rng)
  })
  it('구형 각인의 경고 이력을 로그에서 복원해 같은 갈증 경고를 반복하지 않는다', () => {
    const w=setup(),p=player(w);needsTick(w,p,false);const copy={db,s:deserialize(serialize(w.s))};delete player(copy).needWarnings
    needsTick(w,p,false);needsTick(copy,player(copy),false)
    expect(copy.s.log.filter((e)=>e.text==='목이 마르다.')).toHaveLength(1);expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('3판 각인은 영양과 몸을 재변환하지 않고4판 형식으로 옮긴다', () => {
    const s=newGame(db,{seed:'version3',background:'Bg.Deserter'}),p=player({db,s});s.version=3;p.needs.kcal=-1234.5;p.needs.waterDeficit=890;p.hp=83;p.body.blood=4321
    const raw=serialize(s),restored=deserialize(raw),rp=player({db,s:restored})
    expect(restored.version).toBe(SAVE_VERSION);expect([rp.needs.kcal,rp.needs.waterDeficit,rp.hp,rp.body.blood]).toEqual([-1234.5,890,83,4321]);expect({...restored,version:3}).toEqual(JSON.parse(raw))
  })
  it('장막 틈의 볕을 직접 보면 사고가 생기며 지붕 아래에서는 생기지 않는다', () => {
    const w = setup('clear'), p = player(w); needsTick(w, p, false); expect(p.thoughts.some((t) => t.def === 'Thought.SunBreak')).toBe(true)
    p.thoughts = []; tileAt(w, p.pos).roof = true; needsTick(w, p, false); expect(p.thoughts.some((t) => t.def === 'Thought.SunBreak')).toBe(false)
  })
})

describe('눈·얼음의 실제 채집과 각인', () => {
  it('한겨울에 물이 얼고 실제 급수를 막으며3턴 깨면 물을 뜰 수 있다', () => {
    const w = setup('ashsnow'), p = player(w), q = { x: 31, y: 30 }; setDay(w, 73, 5); tileAt(w,q).t = 'Terrain.ShallowWater'; climateTick(w)
    expect(nearbyIce(w,p)).toEqual(q); expect(nearbyWater(w,p)).toBeNull(); const before = w.s.time
    expect(playerAct(w,{type:'breakIce'})).toBeNull(); expect(w.s.time-before).toBe(300); expect(nearbyWater(w,p)?.pos).toEqual(q)
    w.s.time += TURNS_PER_HOUR*100; expect(nearbyWater(w,p)).toBeNull()
  })
  it('겨울 눈/얼음은 저장되며 해빙 때 녹고 얼음은 비틀거림을 더한다', () => {
    const w=setup('ashsnow'),p=player(w),q={x:31,y:30};setDay(w,73,5);tileAt(w,q).t='Terrain.ShallowWater';climateTick(w)
    expect(tileAt(w,q).icy).toBe(true);const icy=stumbleChance(w,p,q);delete tileAt(w,q).icy;expect(stumbleChance(w,p,q)).toBeLessThan(icy)
    climateTick(w);const copy={db,s:deserialize(serialize(w.s))};expect(tileAt(copy,q).icy).toBe(true);expect(tileAt(copy,q).snow).toBeGreaterThan(0)
    setDay(copy,28);copy.s.weather='clear';climateTick(copy);expect(tileAt(copy,q).icy).toBeUndefined();expect(tileAt(copy,q).snow??0).toBe(0)
  })
  it('구형 월드의 빙설 초기화는 각인 복원 때 한 번만 한다', () => {
    const w=setup('ashsnow');setDay(w,73,5);delete w.s.overworld!.climateInitialized;initializeClimate(w)
    const hash=stateHash(w.s),copy={db,s:deserialize(serialize(w.s))};initializeClimate(copy);expect(stateHash(copy.s)).toBe(hash)
  })
  it('눈100ml는 갈증을 줄이고 즉시 체온.05를 낮춘다', () => {
    const w=setup('ashsnow'),p=player(w);expect(nearbySnow(w,p)).toBeTruthy();const before=p.needs.bodyTemp
    expect(playerAct(w,{type:'eatSnow'})).toBeNull();expect(p.needs.waterDeficit).toBe(400);expect(p.needs.bodyTemp).toBeCloseTo(before-.05);expect(p.needs.ash).toBe(0.25)
  })
  it('빈 병에 모은 눈은 마실 수 없고 불에서 연료를 써야 녹는다', () => {
    const w=setup('ashsnow'),p=player(w),bottle=add(w,'Item.WaterBottle');bottle.uses=0;tileAt(w,p.pos).snow=10
    expect(playerAct(w,{type:'collectSnow',uid:bottle.uid})).toBeNull();expect(bottle.waterFrozen).toBe(true);expect(bottle.uses).toBe(5);expect(waterLines(w,p,bottle).join()).toContain('불에서 녹여야')
    expect(playerAct(w,{type:'consume',uid:bottle.uid})).toContain('녹여야');expect(playerAct(w,{type:'waterTreatment',method:'cloth',uid:bottle.uid})).toContain('녹여야')
    add(w,'Item.Wood');w.s.map.lights.push({pos:{...p.pos},radius:6,kind:'campfire'});invalidateLights(w);expect(playerAct(w,{type:'waterTreatment',method:'boil',uid:bottle.uid},20)).toBeNull();finish(w)
    expect(bottle.waterFrozen).toBeUndefined();expect(bottle.water).toMatchObject({pathogen:0,ash:27.5});expect(bottle.uses).toBe(5);expect(p.bag.some((i)=>i.def==='Item.Wood')).toBe(false)
  })
  it('눈 녹이기 중간 각인도 남은 시간·연료·고유 병을 그대로 복원한다', () => {
    const w=setup('ashsnow'),p=player(w),bottle=add(w,'Item.WaterBottle');bottle.uses=0;tileAt(w,p.pos).snow=10;expect(playerAct(w,{type:'collectSnow',uid:bottle.uid})).toBeNull();add(w,'Item.Wood');w.s.map.lights.push({pos:{...p.pos},radius:6,kind:'campfire'});invalidateLights(w)
    expect(playerAct(w,{type:'waterTreatment',method:'boil',uid:bottle.uid},20)).toBeNull();expect(w.s.simulationPending).toBe(true);expect(p.bag.some((i)=>i.def==='Item.Wood')).toBe(true)
    const copy={db,s:deserialize(serialize(w.s))};finish(w);finish(copy);expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('얼어 있는 물가와 병 속 눈은 씻을 물로 세지 않는다', () => {
    const w=setup(),p=player(w),a=add(w,'Item.DirtyWaterBottle'),b=add(w,'Item.WaterBottle');a.waterFrozen=true;b.waterFrozen=true
    expect(washSupply(w,p).available).toBe(false)
    const t=tileAt(w,p.pos);t.t='Terrain.ShallowWater';t.icy=true;expect(washSupply(w,p).available).toBe(false)
    t.iceHoleUntil=Math.floor(w.s.time/100)+1200;expect(washSupply(w,p)).toEqual({available:true,river:true})
  })
  it('눈을 버리고 액체를 다시 받으면 같은 병에서 얼음 표시를 지운다', () => {
    const w=setup(),bottle=add(w,'Item.DirtyWaterBottle'),uid=bottle.uid;bottle.waterFrozen=true;tileAt(w,{x:31,y:30}).t='Terrain.ShallowWater'
    expect(playerAct(w,{type:'fillBottle',uid})).toBeNull();expect(bottle.waterFrozen).toBeUndefined();expect(bottle.uses).toBe(5);expect(bottle.uid).toBe(uid)
    bottle.waterFrozen=true;w.s.weather='ashrain';expect(playerAct(w,{type:'collectRain',uid})).toBeNull();expect(bottle.waterFrozen).toBeUndefined();expect(bottle.uid).toBe(uid)
  })
  it('병 속 눈을 마실 물처럼 건네지 않고 거절 시 물과 난수를 쓰지 않는다', () => {
    const w=setup(),p=player(w),bottle=add(w,'Item.DirtyWaterBottle');bottle.waterFrozen=true;const target=createCreature(w,'Creature.Withered',{x:31,y:30});w.s.creatures.push(target)
    const before=structuredClone(w.s.rng);expect(perform(w,p,{type:'giveWater',target:target.id}).ok).toBe(false);expect(bottle.uses).toBe(5);expect(w.s.rng).toEqual(before)
  })
  it('지역의 실제 기온 차이는 같은 옷의 몸에 다른 체온 변화를 준다', () => {
    const a=setup(),b=setup();setDay(a,73,5);setDay(b,28,14);const pa=player(a),pb=player(b)
    for(let i=0;i<200;i++){temperatureTick(a,pa,thermalState(a,pa));temperatureTick(b,pb,thermalState(b,pb))}
    expect(pa.needs.bodyTemp).toBeLessThan(pb.needs.bodyTemp)
  })
})
