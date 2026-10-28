// 불에서 몸을 움직여 보온한다. 기존 작업 대사/체온 적산을 쓰며 즉시 체온을 올리지 않는다.
import { capacity } from './body'
import { log, tileAt, turnOf, type World } from './ctx'
import { cheb } from './geom'
import { fireWarmth } from './thermal'
import type { Creature, ResidentWarmthDef, WorldSite } from './types'
export const residentWarmthDef = (w: World) => w.db.tryGet<ResidentWarmthDef>('ResidentWarmth.Hearth')
export function initializeResidentWarmth(w: World, site: WorldSite) {
  const d = residentWarmthDef(w)
  if (!d || w.s.map.residentWarmthInitialized) return
  if (!w.s.map.residentHearth) {
    const home = w.s.creatures.find((c) => c.traderSite === site.id)?.home, fire = home && w.s.map.lights.filter((l) => l.kind === 'campfire' && tileAt(w,l.pos).t === d.fireTerrain)
      .sort((a,b) => cheb(home,a.pos)-cheb(home,b.pos)||a.pos.y-b.pos.y||a.pos.x-b.pos.x)[0]
    if (fire) w.s.map.residentHearth = { site: site.id, terrain: d.fireTerrain, pos: { ...fire.pos } }
  }
  w.s.map.residentWarmthInitialized = true
}
export function warmthError(w: World, c: Creature): string | null {
  if (!residentWarmthDef(w)) return '몸을 풀기 위한 규칙이 없다'
  if (!c.alive || c.asleep || c.unconscious || capacity(w,c,'consciousness') < .5 || capacity(w,c,'moving') < .2) return '깨어서 몸을 움직일 수 있어야 한다'
  return fireWarmth(w,c) >= 15 ? null : '실제 불에서2칸 안으로 가야 한다'
}
export function startWarmth(w: World, c: Creature): string | null {
  const err = warmthError(w,c)
  if (err) return err
  const n = residentWarmthDef(w)!.turns
  c.activity = { kind: 'warm', remaining:n, total:n, label:'불 곁에서 몸 풀기', woundCount:c.body.wounds.length }
  return null
}
export function warmthStep(w: World, c: Creature): boolean {
  const err = warmthError(w,c)
  if (err) { if(c.id===w.s.playerId)log(w,'warn',`몸 풀기 중단: ${err}.`);c.activity=undefined;return true }
  if (c.activity!.remaining > 0) return false
  c.activity=undefined;return true
}
export function residentWarmthGoal(w: World, c: Creature) {
  const d = residentWarmthDef(w), fire = w.s.map.residentHearth
  if (!d || !fire || c.id===w.s.playerId || !c.alive || c.activity || c.asleep || c.unconscious || capacity(w,c,'consciousness')<.5 || capacity(w,c,'moving')<.2 || c.residentSite!==w.s.overworld?.currentRegion || c.residentSite!==fire.site || (c.residentWarmAfter??0)>turnOf(w)) return null
  if (c.needs.bodyTemp >= d.target || !c.residentWarming && c.needs.bodyTemp>d.seekAt) return null
  return fire
}
export function delayResidentWarmth(w: World,c:Creature){c.residentWarmAfter=turnOf(w)+(residentWarmthDef(w)?.retryTurns??1);c.residentWarming=undefined;c.residentReturning=true}
