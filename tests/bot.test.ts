import { describe, expect, it } from 'vitest'
import { botDecide } from '../src/core/bot'
import { hpMax } from '../src/core/body'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, TURNS_PER_DAY, TURNS_PER_HOUR } from '../src/core/ctx'
import { dirIndex } from '../src/core/geom'
import { makeItem } from '../src/core/items'
import { makeWorld } from './helpers'

describe('봇 높은 자리 (07 §5)', () => {
  it('다가오는 적은 옆 돌무더기에 올라가 맞고, 올라서면 그쪽을 보고 기다린다', () => {
    const w = makeWorld('bothg1')
    w.s.time = (TURNS_PER_DAY + 12 * TURNS_PER_HOUR) * 100
    w.s.weather = 'clear'
    w.s.weatherUntil = Infinity
    const pl = player(w)
    w.s.creatures = [pl]
    pl.statPoints = 0
    pl.abilityPoints = 0
    pl.equip = { main: makeItem(w, 'Item.PipeClub') }
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 5; dx++) {
      const t = tileAt(w, { x: pl.pos.x + dx, y: pl.pos.y + dy })
      t.t = 'Terrain.Earth'
      t.items = []
    }
    tileAt(w, { x: pl.pos.x - 1, y: pl.pos.y }).t = 'Terrain.Rubble'
    const r = createCreature(w, 'Creature.Reaver', { x: pl.pos.x + 4, y: pl.pos.y })
    r.hp = 3
    r.ai.mode = 'hunt'
    w.s.creatures.push(r)
    expect(botDecide(w)).toEqual({ type: 'move', dir: dirIndex(-1, 0) })
    pl.pos = { x: pl.pos.x - 1, y: pl.pos.y }
    const a = botDecide(w)
    expect(a.type === 'face' || a.type === 'wait').toBe(true)
  })
})


describe('봇 야영·보온', () => {
  function camp() {
    const w = makeWorld('bot-cold', 'Bg.Deserter'), pl = player(w)
    w.s.creatures = [pl]; w.s.loot = undefined
    pl.statPoints = 0; pl.abilityPoints = 0; pl.bag = []; pl.traits = []; pl.body.wounds = []
    pl.hp = hpMax(w, pl); pl.needs.kcal = 2500; pl.needs.waterDeficit = 0; pl.needs.fatigue = 20
    const fire = w.s.map.lights.find((l) => l.kind === 'campfire' && l.pos.x === w.s.map.waypoints!.homeFire.x)!
    fire.off = false
    pl.pos = { x: fire.pos.x + 1, y: fire.pos.y }
    return { w, pl, fire }
  }
  it('불가에 도착하면 자기 칸을 제외해 계속 맴돌지 않고 쉰다', () => {
    const { w, pl } = camp(); pl.needs.bodyTemp = 35.5
    expect(botDecide(w)).toEqual({ type: 'rest', turns: 60 })
  })
  it('잠이 필요하면 불을 끄지 않고 자며 꺼져 있으면 먼저 켠다', () => {
    const { w, pl, fire } = camp(); pl.needs.bodyTemp = 37; pl.needs.fatigue = 80
    expect(botDecide(w)).toEqual({ type: 'sleep' })
    fire.off = true
    expect(botDecide(w)).toEqual({ type: 'toggleFire' })
  })
})
