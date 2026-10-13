import { describe, expect, it } from 'vitest'
import { abilityReady } from '../src/core/abilities'
import { player, terrainAt, type World } from '../src/core/ctx'
import { changeMap, playerAct } from '../src/core/game'
import { addToBag, BAG_H, BAG_W, fitsAt, itemDef, makeItem, moveInBag } from '../src/core/items'
import { generateDungeon } from '../src/core/mapgen'
import { findPath } from '../src/core/path'
import { canLearn, gainXp, xpNeed, xpToNext, xpTotalFor } from '../src/core/progression'
import { makeWorld } from './helpers'
import { START_TURN as START } from '../src/core/ctx'

function emptyBag(w: World) {
  const pl = player(w)
  pl.bag = []
  return pl
}

describe('격자 배낭·장비', () => {
  it('크기만큼 칸을 차지하고 겹치지 않는다', () => {
    const w = makeWorld('inv1')
    const pl = emptyBag(w)
    const spear = makeItem(w, 'Item.RebarSpear')
    const [sw, sh] = itemDef(w, spear).size
    expect(addToBag(w, pl, spear)).toBe(0)
    expect(spear.gx).toBe(0)
    expect(spear.gy).toBe(0)
    // 같은 자리에는 다른 물건이 못 들어간다
    expect(fitsAt(w, pl, w.db.item('Item.Bandage'), 0, 0)).toBe(false)
    expect(fitsAt(w, pl, w.db.item('Item.Bandage'), sw, 0)).toBe(true)
    // 옮기기: 범위 밖 금지
    expect(moveInBag(w, pl, spear.uid, BAG_W - sw + 1, 0)).toBe(false)
    expect(moveInBag(w, pl, spear.uid, BAG_W - sw, BAG_H - sh)).toBe(true)
  })
  it('회전: 1×N 물건을 눕혀 놓을 수 있다 (D16)', () => {
    const w = makeWorld('inv5')
    const pl = emptyBag(w)
    const spear = makeItem(w, 'Item.RebarSpear')
    const [sw, sh] = itemDef(w, spear).size
    expect(sw).not.toBe(sh)
    addToBag(w, pl, spear)
    // 돌리면 [sh, sw] 칸 — 가로 끝에 붙여 놓을 수 있다
    expect(moveInBag(w, pl, spear.uid, BAG_W - sh, 0, true)).toBe(true)
    expect(spear.rot).toBe(true)
    expect(fitsAt(w, pl, w.db.item('Item.Bandage'), BAG_W - 1, sw - 1)).toBe(false)
  })
  it('쌓이는 물건은 기존 묶음부터 채운다', () => {
    const w = makeWorld('inv2')
    const pl = emptyBag(w)
    addToBag(w, pl, makeItem(w, 'Item.Arrow', 3))
    addToBag(w, pl, makeItem(w, 'Item.Arrow', 2))
    const arrows = pl.bag.filter((i) => i.def === 'Item.Arrow')
    const total = arrows.reduce((s, i) => s + i.count, 0)
    expect(total).toBe(5)
    expect(arrows.length).toBe(Math.ceil(5 / (w.db.item('Item.Arrow').maxStack ?? 5)))
  })
  it('가득 차면 남은 개수를 돌려준다', () => {
    const w = makeWorld('inv3')
    const pl = emptyBag(w)
    let left = 0
    for (let i = 0; i < BAG_W * BAG_H + 5; i++) left += addToBag(w, pl, makeItem(w, 'Item.RustyKnife'))
    expect(left).toBeGreaterThan(0)
  })
  it('장착하면 배낭에서 빠지고, 벗으면 돌아온다', () => {
    const w = makeWorld('inv4')
    const pl = emptyBag(w)
    pl.equip = {}
    const knife = makeItem(w, 'Item.RustyKnife')
    addToBag(w, pl, knife)
    expect(playerAct(w, { type: 'equip', uid: knife.uid })).toBeNull()
    expect(pl.equip.main?.uid).toBe(knife.uid)
    expect(pl.bag.some((i) => i.uid === knife.uid)).toBe(false)
    expect(playerAct(w, { type: 'unequip', slot: 'main' })).toBeNull()
    expect(pl.bag.some((i) => i.uid === knife.uid)).toBe(true)
  })
})

describe('장비 착탈 다턴 (D17)', () => {
  it('사슬옷은 6턴에 걸쳐 입고, 끝나야 장착된다', () => {
    const w = makeWorld('eq1')
    const pl = emptyBag(w)
    pl.equip = {}
    pl.traits = []
    const mail = makeItem(w, 'Item.ScrapMail')
    addToBag(w, pl, mail)
    w.s.creatures = [pl]
    expect(playerAct(w, { type: 'equip', uid: mail.uid })).toBeNull()
    expect(pl.equip.chest?.uid).toBe(mail.uid)
    expect(pl.activity).toBeUndefined()
    // 6번의 턴 동안 입는다
    expect(w.s.time).toBeGreaterThanOrEqual(START * 100 + 500) // 6턴째 행동 시점 = 시작 + 5턴
  })
})

describe('성장', () => {
  it('레벨당 필요량 100·300·600 = 누적 100·400·1000 → 레벨과 포인트', () => {
    expect([xpNeed(1), xpNeed(2), xpNeed(3)]).toEqual([100, 300, 600])
    expect([xpToNext(1), xpToNext(2), xpToNext(3), xpTotalFor(10), xpTotalFor(20)]).toEqual([100, 400, 1000, 16500, 133000])
    const w = makeWorld('lv1')
    const pl = player(w)
    const sp = pl.statPoints, ap = pl.abilityPoints
    gainXp(w, pl, 420)
    expect(pl.level).toBe(3)
    expect(pl.statPoints).toBe(sp + 2)
    expect(pl.abilityPoints).toBe(ap + 2)
  })
  it('①②는 바로, ③④는 같은 갈래 1개 이상 (15 §7) · 탈영병은 창② 무료', () => {
    const w = makeWorld('lv2', 'Bg.Deserter')
    const pl = player(w)
    expect(pl.abilities).toContain('Ab.Spear.Reach')
    expect(pl.abilityPoints).toBe(2)
    expect(pl.statPoints).toBe(0)
    // 무료 능력도 갈래 1개로 친다 → 창③ 바로 가능, 창④는 창① 선행
    expect(canLearn(w, pl, 'Ab.Spear.Trip')).toBeNull()
    expect(canLearn(w, pl, 'Ab.Spear.Wall')).toMatch(/먼저/)
    expect(canLearn(w, pl, 'Ab.Blade.Edge')).toBeNull()
    expect(canLearn(w, pl, 'Ab.Blade.Parry')).toMatch(/하나 이상/)
    expect(playerAct(w, { type: 'learn', id: 'Ab.Spear.Pierce' })).toBeNull()
    expect(canLearn(w, pl, 'Ab.Spear.Wall')).toBeNull()
  })
  it('길드 상인은 능력 포인트 3, 활력 +1 은 HP +5', () => {
    const w = makeWorld('lv4', 'Bg.GuildMerchant')
    const pl = player(w)
    expect(pl.abilityPoints).toBe(3)
    pl.statPoints = 1
    const hp = pl.hp
    expect(playerAct(w, { type: 'spendStat', stat: 'vit' })).toBeNull()
    expect(pl.hp).toBe(hp + 5)
  })
  it('재사용 대기 N: t 에 쓰면 t+N 까지 막히고 t+N+1 에 풀린다', async () => {
    const { useAbility } = await import('../src/core/abilities')
    const w = makeWorld('cd1', 'Bg.Herbalist')
    const pl = player(w)
    const t = Math.floor(w.s.time / 100)
    expect(useAbility(w, pl, 'Ab.Survival.Breath').ok).toBe(true)
    const cd = w.db.ability('Ab.Survival.Breath').cooldown!
    w.s.time = (t + cd) * 100
    expect(abilityReady(w, pl, 'Ab.Survival.Breath')).toMatch(/재사용/)
    w.s.time = (t + cd + 1) * 100
    expect(abilityReady(w, pl, 'Ab.Survival.Breath')).toBeNull()
  })
  it('능력은 기력·재사용 대기가 있다', () => {
    const w = makeWorld('lv3', 'Bg.Scavenger')
    const pl = player(w)
    pl.needs.energy = 0
    expect(abilityReady(w, pl, 'Ab.Blunt.HeadBash')).toMatch(/기력/)
  })
})

describe('장소·던전', () => {
  it('모든 층의 모든 방이 입구에서 걸어서 닿는다 (여러 시드)', () => {
    for (const seed of ['d1', 'd2', 'd3', 'd4', 'd5', 'd6']) {
      const w = makeWorld(seed)
      for (let depth = 1; depth <= 3; depth++) {
        const gen = generateDungeon(w, depth)
        const s = { ...w.s, map: gen.map, creatures: [] }
        const ww: World = { db: w.db, s }
        for (const R of gen.map.rooms) {
          let ok = false
          for (let y = R.y; y < R.y + R.h && !ok; y++) for (let x = R.x; x < R.x + R.w && !ok; x++) {
            if (!terrainAt(ww, { x, y }).passable) continue
            ok = !!findPath(ww, gen.start, { x, y }, { maxNodes: 6000 })
          }
          expect(ok, `${seed} 지하${depth} ${R.name}`).toBe(true)
        }
        // 계단이 있다
        expect(gen.map.links.length).toBeGreaterThanOrEqual(depth < 3 ? 2 : 1)
      }
    }
  })
  it('적은 정해진 방에 산다: 지하 3층에만 우두머리', () => {
    const w = makeWorld('d7')
    const g1 = generateDungeon(w, 1), g3 = generateDungeon(w, 3)
    expect(g1.spawns.some((s) => s.def === 'Creature.Amalgam')).toBe(false)
    expect(g3.spawns.filter((s) => s.def === 'Creature.Amalgam').length).toBe(1)
    for (const s of g1.spawns) expect(g1.map.tiles[s.pos.y * g1.map.w + s.pos.x].room).not.toBeUndefined()
  })
  it('지도를 오가도 떠난 층의 상태가 남는다', () => {
    const w = makeWorld('d8')
    const pl = player(w)
    changeMap(w, 'crypt1')
    expect(w.s.map.id).toBe('crypt1')
    const n1 = w.s.creatures.length
    const t = w.s.map.tiles.find((x) => terrainAt(w, { x: 0, y: 0 }) && x.t === 'Terrain.KtFloor')!
    t.blood = 77
    changeMap(w, 'surface')
    expect(w.s.map.id).toBe('surface')
    changeMap(w, 'crypt1')
    expect(w.s.creatures.length).toBe(n1)
    expect(w.s.map.tiles.some((x) => x.blood === 77)).toBe(true)
    expect(terrainAt(w, pl.pos).stairs).toBe('up')
  })
})

describe('HP 풀과 6부위 (02 §2.0)', () => {
  it('검산 0-1: 오른팔 D13 → 62%, D9 추가 → 37%, 회복 상한 89', async () => {
    const { addWound, hpCap, hpMax, regionHpPct, regionState } = await import('../src/core/body')
    const w = makeWorld('hp1')
    const pl = player(w)
    pl.traits = []
    pl.abilities = []
    pl.equip = {}
    pl.stats.vit = 10
    expect(hpMax(w, pl)).toBe(100)
    addWound(w, pl, { def: 'Wound.Cut', part: 'RightUpperArm', severity: 13, source: 't' })
    expect(regionHpPct(w, pl, 'rarm')).toBe(62)
    expect(regionState(w, pl, 'rarm')).toBeGreaterThanOrEqual(1)
    addWound(w, pl, { def: 'Wound.Cut', part: 'RightForearm', severity: 9, source: 't' })
    expect(regionHpPct(w, pl, 'rarm')).toBe(37)
    expect(regionState(w, pl, 'rarm')).toBeGreaterThanOrEqual(2)
    expect(hpCap(w, pl)).toBe(89)
  })
  it('비틀거림: 왼다리 중상 15 + 얕은 물 10 = 25% (상한 60)', async () => {
    const { stumbleChance } = await import('../src/core/actions')
    const { addWound, regionState } = await import('../src/core/body')
    const w = makeWorld('st1')
    const pl = player(w)
    pl.traits = []
    pl.abilities = []
    pl.equip = {}
    // 왼다리 최대치 = 최대 HP × 0.4. 대퇴 타박 sev 30 → HP% 25 이하 = 중상
    pl.stats.vit = 10
    addWound(w, pl, { def: 'Wound.Bruise', part: 'LeftThigh', severity: 30, source: 't' })
    expect(regionState(w, pl, 'lleg')).toBe(3)
    const water = w.s.map.tiles.findIndex((t) => t.t === 'Terrain.ShallowWater')
    const to = { x: water % w.s.map.w, y: Math.floor(water / w.s.map.w) }
    w.s.map.tiles[water].blood = 0
    pl.body.blood = pl.body.bloodMax
    expect(stumbleChance(w, pl, to)).toBe(25)
  })
})

describe('숙달 (D23)', () => {
  it('같은 대상은 1회, 시간당 3회, 문턱 5에서 1단계', async () => {
    const { practice, masteryStage, masteryCount } = await import('../src/core/skills')
    const w = makeWorld('ms1', 'Bg.Deserter')
    const pl = player(w)
    practice(w, pl, 'medicine', 'wound:1')
    practice(w, pl, 'medicine', 'wound:1')
    expect(masteryCount(pl, 'medicine')).toBe(1)
    practice(w, pl, 'medicine', 'wound:2'); practice(w, pl, 'medicine', 'wound:3'); practice(w, pl, 'medicine', 'wound:4')
    expect(masteryCount(pl, 'medicine')).toBe(3)
    for (let h = 1; h <= 2; h++) { w.s.time += 1200 * 100; practice(w, pl, 'medicine', `x${h}`) }
    expect(masteryStage(pl, 'medicine')).toBe(1)
  })
})

describe('재점거 (D20)', () => {
  function clearFloor(w: World) {
    changeMap(w, 'crypt1')
    for (const R of w.s.map.rooms) R.discovered = true
    for (const c of w.s.creatures) if (c.faction !== 'player') c.alive = false
  }
  it('3일 유예 안에는 다시 차지 않는다', () => {
    const w = makeWorld('re1')
    clearFloor(w)
    changeMap(w, 'surface')
    w.s.time += 2 * 28800 * 100
    changeMap(w, 'crypt1')
    expect(w.s.creatures.filter((c) => c.alive && c.reoccupied).length).toBe(0)
  })
  it('오래 비우면 공급원에서 다시 들어온다 (공급원은 줄어든다)', () => {
    const w = makeWorld('re2')
    clearFloor(w)
    changeMap(w, 'surface')
    w.s.time += 20 * 28800 * 100
    changeMap(w, 'crypt1')
    const back = w.s.creatures.filter((c) => c.alive && c.reoccupied)
    expect(back.length).toBeGreaterThan(0)
    // 관로 하단: 18명 + 20일 동안 4일마다 +1(상한 24) 에서 들어온 그늘 사람만큼 빠진다
    const shades = back.filter((c) => c.def === 'Creature.Shade').length
    expect(w.s.sources!.find((x) => x.id === 'conduit')!.count).toBe(Math.min(24, 18 + 5) - shades)
  })
})

describe('계단 따라오기 (14 §8)', () => {
  it('추적 중인 인접 말라붙은 자는 따라오고, 그늘 사람은 지상으로 나오지 않는다', async () => {
    const { createCreature } = await import('../src/core/creatures')
    const w = makeWorld('fl1')
    const pl = player(w)
    changeMap(w, 'crypt1')
    const mk = (def: string, dx: number) => {
      const c = createCreature(w, def, { x: pl.pos.x + dx, y: pl.pos.y })
      c.ai.mode = 'hunt'; c.ai.target = pl.id; c.asleep = false
      w.s.creatures.push(c)
      return c
    }
    const wd = mk('Creature.Withered', 1)
    const sh = mk('Creature.Shade', -1)
    changeMap(w, 'surface')
    expect(w.s.creatures.some((c) => c.id === wd.id)).toBe(true)
    expect(w.s.creatures.some((c) => c.id === sh.id)).toBe(false)
  })
})

describe('장소 사건: 약탈자 순찰 (14 §10)', () => {
  it('06:00에 50% 확률로 두목을 뺀 2~3명이 경유지를 순회한다', async () => {
    const { storytellerTick } = await import('../src/core/storyteller')
    let fired = 0
    for (const seed of ['pt1', 'pt2', 'pt3', 'pt4', 'pt5', 'pt6', 'pt7', 'pt8']) {
      const w = makeWorld(seed)
      w.s.time = (28800 + 6 * 1200) * 100 // 2일차 06:00
      storytellerTick(w)
      const pat = w.s.creatures.filter((c) => c.ai.route)
      if (pat.length) {
        fired++
        expect(pat.length).toBeGreaterThanOrEqual(2)
        expect(pat.length).toBeLessThanOrEqual(3)
        expect(pat.some((c) => c.def === 'Creature.ReaverChief')).toBe(false)
        expect(pat[0].ai.route!.length).toBe(3)
      }
    }
    expect(fired).toBeGreaterThan(0)
    expect(fired).toBeLessThan(8)
  })
})

describe('수색대·정산 (10 §3 · 14 §9.2)', () => {
  it('모닥불: 밤 불빛 18칸, 낮 연기 15칸, 바람 아래면 22.5칸', async () => {
    const { fireVisibleFrom } = await import('../src/core/storyteller')
    const w = makeWorld('srch1')
    const map = w.s.map
    const fire = map.waypoints!.homeFire!
    // 낮 12시, 바람 동쪽
    w.s.time = (28800 + 12 * 1200) * 100
    w.s.weather = 'clear'
    w.s.wind = { x: 1, y: 0 }
    const east = (d: number) => ({ x: fire.x + d, y: fire.y })
    const west = (d: number) => ({ x: fire.x - d, y: fire.y })
    expect(fireVisibleFrom(w, map, east(22))).toBeTruthy() // 바람 아래 22.5
    expect(fireVisibleFrom(w, map, west(16))).toBeFalsy() // 바람 위 15 초과
    expect(fireVisibleFrom(w, map, west(15))).toBeTruthy()
    // 밤 (02시): 반경 6 × 3 = 18
    w.s.time = (28800 + 2 * 1200) * 100
    expect(fireVisibleFrom(w, map, west(18))).toBeTruthy()
    expect(fireVisibleFrom(w, map, west(19))).toBeFalsy()
    // 불을 끄면 흔적 없음
    map.lights.find((L) => L.kind === 'campfire' && L.pos.x === fire.x && L.pos.y === fire.y)!.off = true
    expect(fireVisibleFrom(w, map, west(3))).toBeFalsy()
  })
  it('보관함 약탈: 가치 높은 것부터 1명당 2개', async () => {
    const { raidStash } = await import('../src/core/storyteller')
    const { createCreature } = await import('../src/core/creatures')
    const w = makeWorld('srch2')
    const map = w.s.map
    const stash = map.waypoints!.homeStash!
    const t = map.tiles[stash.y * map.w + stash.x]
    t.cont = { items: [makeItem(w, 'Item.Jerky'), makeItem(w, 'Item.Bow'), makeItem(w, 'Item.Machete'), makeItem(w, 'Item.Cloth')], opened: true, kind: 'Terrain.Stash' }
    const r = createCreature(w, 'Creature.Reaver', { x: stash.x + 1, y: stash.y })
    r.bag = []
    const took = raidStash(w, r, map, stash)
    expect(took.map((i) => i.def).sort()).toEqual(['Item.Bow', 'Item.Machete'])
    expect(t.cont.items.length).toBe(2)
    expect(r.bag.length).toBe(2)
  })
  it('재진입 정산: 핏자국은 마르고, 5일 지난 시체는 뼈가 된다', async () => {
    const { settleReentry } = await import('../src/core/game')
    const { createCreature } = await import('../src/core/creatures')
    const w = makeWorld('srch3')
    const { map } = generateDungeon(w, 1)
    const R = map.rooms[1]
    const p = { x: R.x + 1, y: R.y + 1 }
    map.tiles[p.y * map.w + p.x].blood = 100
    const dead = createCreature(w, 'Creature.Shade', p)
    dead.alive = false
    dead.deathTurn = 0
    dead.bag = [makeItem(w, 'Item.RustyKnife')]
    const res = [dead]
    w.s.time = 6 * 28800 * 100
    settleReentry(w, map, res, 0)
    expect(map.tiles[p.y * map.w + p.x].blood).toBe(0)
    expect(res.includes(dead)).toBe(false)
    expect(map.tiles[p.y * map.w + p.x].items.map((i) => i.def)).toEqual(expect.arrayContaining(['Item.RustyKnife', 'Item.Bones']))
  })
})

describe('자동 정렬 (13 §9 검산 2)', () => {
  it('활·창·마체테·투구·밀주·붕대·물병·육포·등불 → 25칸, 행 우선 배치', () => {
    const w = makeWorld('sort1')
    const pl = emptyBag(w)
    for (const id of ['Item.Lantern', 'Item.Jerky', 'Item.WaterBottle', 'Item.Bandage', 'Item.Moonshine', 'Item.ScrapHelmet', 'Item.Machete', 'Item.RebarSpear', 'Item.Bow']) {
      pl.bag.push({ ...makeItem(w, id), gx: undefined, gy: undefined })
    }
    // 무작위 배치에서 정렬
    pl.bag = []
    for (const id of ['Item.Lantern', 'Item.Jerky', 'Item.WaterBottle', 'Item.Bandage', 'Item.Moonshine', 'Item.ScrapHelmet', 'Item.Machete', 'Item.RebarSpear', 'Item.Bow']) addToBag(w, pl, makeItem(w, id))
    expect(playerAct(w, { type: 'sortBag' })).toBeNull()
    const at = (def: string) => pl.bag.find((i) => i.def === def)!
    expect([at('Item.Bow').gx, at('Item.Bow').gy]).toEqual([0, 0])
    expect(at('Item.RebarSpear').gx).toBe(2)
    expect(at('Item.Machete').gx).toBe(3)
    let used = 0
    for (const it of pl.bag) { const [a, b] = itemDef(w, it).size; used += a * b }
    expect(used).toBe(25)
  })
})

describe('쌓임·나누기·품질 (13 §5 · §10 · 08 §4)', () => {
  function bagWorld() {
    const w = makeWorld('stk1')
    const pl = player(w)
    pl.bag = []
    return { w, pl }
  }
  it('Ctrl 나누기 = 절반, 같은 것 위에 놓으면 합치고 넘치는 수는 남는다', async () => {
    const { perform } = await import('../src/core/actions')
    const { w, pl } = bagWorld()
    addToBag(w, pl, makeItem(w, 'Item.Bandage', 5))
    const st = pl.bag[0]
    expect(perform(w, pl, { type: 'splitItem', uid: st.uid, n: Math.floor(5 / 2), gx: 5, gy: 2 }).ok).toBe(true)
    expect(pl.bag.map((i) => i.count).sort()).toEqual([2, 3])
    const piece = pl.bag.find((i) => i.gx === 5)!
    const first = pl.bag.find((i) => i.uid !== piece.uid)!
    addToBag(w, pl, makeItem(w, 'Item.Bandage', 4)) // 기존 더미부터: 3 → 5, 남은 2 → 2 → 4
    expect([first.count, piece.count]).toEqual([5, 4])
    expect(perform(w, pl, { type: 'mergeItem', uid: piece.uid, into: first.uid }).ok).toBe(false) // 가득 찬 더미
    expect(perform(w, pl, { type: 'splitItem', uid: first.uid, n: 2, gx: 8, gy: 0 }).ok).toBe(true) // 5 → 3 + 2
    expect(perform(w, pl, { type: 'mergeItem', uid: piece.uid, into: first.uid }).ok).toBe(true) // 4 중 2만 들어간다
    expect([first.count, piece.count]).toEqual([5, 2])
    expect(pl.bag.reduce((n, i) => n + i.count, 0)).toBe(9)
  })
  it('품질·오염이 다르면 쌓이지 않는다', async () => {
    const { canStack } = await import('../src/core/items')
    const { w } = bagWorld()
    const a = makeItem(w, 'Item.Bandage'), b = makeItem(w, 'Item.Bandage')
    expect(canStack(a, b)).toBe(true)
    b.dirty = true
    expect(canStack(a, b)).toBe(false)
    const h1 = makeItem(w, 'Item.Hatchet'), h2 = makeItem(w, 'Item.Hatchet')
    h2.quality = 2
    expect(canStack(h1, h2)).toBe(false)
  })
  it('품질 배율: 조악 ×0.85 · 좋음 ×1.1, 상자 드롭 무기·방어구는 조악·보통·좋음만', async () => {
    const { QUALITY, hasQuality } = await import('../src/core/items')
    const { rollLoot } = await import('../src/core/actions')
    expect(QUALITY[0].dmg).toBe(0.85)
    expect(QUALITY[2].dmg).toBe(1.1)
    // 손도끼 찍기 14: 조악 14 × 0.85 = 11.9, 좋음 14 × 1.1 = 15.4 ((80 + r)% 전)
    expect(14 * QUALITY[0].dmg).toBeCloseTo(11.9)
    expect(14 * QUALITY[2].dmg).toBeCloseTo(15.4)
    const w = makeWorld('loot-q')
    const qs = new Set<number>()
    for (const { id } of w.db.all('LootTable')) for (let i = 0; i < 40; i++) for (const it of rollLoot(w, id)) {
      if (hasQuality(w.db.item(it.def))) qs.add(it.quality ?? 1)
      else expect(it.quality).toBeUndefined()
    }
    expect([...qs].every((q) => q <= 2)).toBe(true)
  })
})
