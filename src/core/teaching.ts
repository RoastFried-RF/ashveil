import {rememberMeeting} from './first-impressions'
// 문해0→1은 서로 다른 날짜의 실제 수업을 마친 이정표다. 수업 중단은 진도가 아니다.
import { capacity } from './body'
import { channelTurns, hostileAware } from './action-time'
import { creatureById, log, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { hostile, reputationBand } from './diplomacy'
import { economyDef } from './economy'
import { hasLos, lightLevel } from './fov'
import { cheb } from './geom'
import type { Activity, Creature, TeacherDef } from './types'

export const teacherDef = (w: World, c: Creature) => {
  const id = w.db.creature(c.def).teacher
  return id ? w.db.tryGet<TeacherDef>(id) : undefined
}
const literacy = (c: Creature) => c.literacy ?? (c.literate ? 2 : 0)
const dayOf = (w: World) => Math.floor(turnOf(w) / TURNS_PER_DAY)
export function initializeTeaching(w: World) {
  for (const c of w.s.creatures) if (teacherDef(w, c) && c.literacy === undefined && w.db.creature(c.def).literacy !== undefined) {
    c.literacy = w.db.creature(c.def).literacy; c.literate = c.literacy! > 0
  }
}
function lessonAccess(w: World, pupil: Creature, teacher: Creature): string | null {
  const d = teacherDef(w, teacher), site = teacher.residentSite ?? teacher.traderSite, place = w.s.overworld?.sites.find((s) => s.id === site)
  if (!d || teacher.id === pupil.id || !site || site !== w.s.overworld?.currentRegion || !place || place.kind !== 'settlement' || teacher.faction !== place.faction) return '이곳에서 글을 가르치는 사람이 아니다'
  if (!teacher.alive || !pupil.alive || teacher.asleep || pupil.asleep || teacher.unconscious || pupil.unconscious || capacity(w, teacher, 'consciousness') < .5 || capacity(w, pupil, 'consciousness') < .5) return '서로 깨어 있고 의식이 또렷해야 한다'
  if (hostile(w, teacher, pupil)) return '적대하는 상대에게 수업할 수 없다'
  if (literacy(teacher) < d.literacyMin) return '교사의 문해가 부족하다'
  if (literacy(pupil) !== 0) return '이미 기초 글자를 읽을 수 있다'
  if (cheb(teacher.pos, pupil.pos) > 1 || !hasLos(w, teacher.pos, pupil.pos)) return '교사 곁으로 다가가야 한다'
  if (capacity(w, teacher, 'sight') < .1 || capacity(w, pupil, 'sight') < .1 || capacity(w, teacher, 'manipulation') < .2 || capacity(w, pupil, 'manipulation') < .2) return '글자를 보고 짚을 수 있어야 한다'
  if (capacity(w, teacher, 'hearing') < .1 || capacity(w, pupil, 'hearing') < .1) return '서로 설명을 들을 수 있어야 한다'
  if (lightLevel(w, teacher.pos) >= 2 || lightLevel(w, pupil.pos) >= 2) return '글자를 볼 빛이 부족하다'
  if (hostileAware(w, teacher) || hostileAware(w, pupil)) return '교전 중에는 수업할 수 없다'
  if (pupil.id === w.s.playerId && !reputationBand(w, teacher.faction).trade) return '이 세력은 수업을 거절한다'
  return null
}
export function lessonQuote(w: World, pupil: Creature, teacher: Creature) {
  const d = teacherDef(w, teacher), day = dayOf(w), prior = pupil.literacyLessons, progress = prior && d && prior.course === d.id ? prior.days : []
  const out = { error: lessonAccess(w, pupil, teacher), fee: d ? Math.ceil(d.fee * (pupil.id === w.s.playerId ? reputationBand(w, teacher.faction).price : 1)) : 0, turns: 0, days: [...progress], target: d?.days ?? 0, day }
  if (out.error || !d) return out
  if (pupil.activity || teacher.activity) { out.error = '하던 일을 마친 뒤 수업해야 한다'; return out }
  if (progress.includes(day)) { out.error = '오늘 수업은 이미 마쳤다. 다른 날에 이어서 배운다'; return out }
  const turns = channelTurns(w, pupil, d.lessonTurns), teaching = channelTurns(w, teacher, d.lessonTurns)
  if (turns === null || teaching === null) { out.error = '몸 상태 때문에 수업을 이어 갈 수 없다'; return out }
  out.turns = Math.max(turns, teaching) + Math.ceil(Math.max(0, teacher.nextAct - w.s.time) / 100)
  if ((pupil.money ?? 0) < out.fee) out.error = '수업료가 부족하다'
  return out
}
export function requestLesson(w: World, pupil: Creature, teacher: Creature, expectedFee?: number): string | null {
  const q = lessonQuote(w, pupil, teacher), d = teacherDef(w, teacher)
  if (q.error) return q.error
  if (expectedFee !== undefined && q.fee !== expectedFee) return '수업료가 달라졌다. 다시 확인해야 한다'
  pupil.money = (pupil.money ?? 0) - q.fee; teacher.money = (teacher.money ?? 0) + q.fee
  const total = Math.max(channelTurns(w, pupil, d!.lessonTurns)!, channelTurns(w, teacher, d!.lessonTurns)!), shared = { lessonAt: w.s.time, lessonDay: q.day, course: d!.id, teacherId: teacher.id, learnerId: pupil.id }
  teacher.activity = { ...shared, kind: 'teach', remaining: total, total, label: '글자 가르치기', woundCount: teacher.body.wounds.length }
  pupil.activity = { ...shared, kind: 'lessonWait', remaining: q.turns, total: q.turns, label: `${teacher.name}에게 글자 배우기` }
  rememberMeeting(w,pupil,teacher)
  teacher.met = true
  if (pupil.id === w.s.playerId) log(w, 'info', `${teacher.name}에게 수업료${q.fee}${economyDef(w).currency}을(를) 냈다. 중단하면 오늘의 진도를 얻지 못하며 수업료는 돌려받지 못한다.`)
  return null
}
function pair(w: World, c: Creature, act: Activity) {
  const other = creatureById(w, act.kind === 'teach' ? act.learnerId : act.teacherId), otherAct = other?.activity
  return other && otherAct && otherAct.lessonAt === act.lessonAt && otherAct.course === act.course && otherAct.teacherId === act.teacherId && otherAct.learnerId === act.learnerId && otherAct.kind === (act.kind === 'teach' ? 'lessonWait' : 'teach') ? other : undefined
}
export function cancelLesson(w: World, c: Creature, reason?: string) {
  const act = c.activity
  if (!act || !['teach','lessonWait'].includes(act.kind)) return
  const other = pair(w, c, act), pupil = act.kind === 'teach' ? other : c
  if (other) { other.activity = undefined; if (other.residentSite) other.residentReturning = true }
  c.activity = undefined; if (c.residentSite) c.residentReturning = true
  if (reason && pupil?.id === w.s.playerId) log(w, 'warn', `글자 수업 중단: ${reason}.`)
}
export function lessonStep(w: World, c: Creature): boolean {
  const act = c.activity!, other = pair(w, c, act)
  if (!other) { c.activity = undefined; return true }
  const pupil = act.kind === 'teach' ? other : c, teacher = act.kind === 'teach' ? c : other, d = teacherDef(w, teacher), error = lessonAccess(w, pupil, teacher)
  if (error || !d || d.id !== act.course) { cancelLesson(w, c, error ?? '수업 과정이 바뀌었다'); return true }
  if (act.kind === 'lessonWait') { act.remaining = Math.max(1, act.remaining); return false }
  if (act.remaining > 0) return false
  const day = act.lessonDay!, days = pupil.literacyLessons?.course === d.id ? [...pupil.literacyLessons.days] : []
  if (!days.includes(day)) days.push(day)
  days.sort((a,b) => a-b)
  pupil.literacyLessons = { course: d.id, days: days.slice(-d.days), teacher: teacher.name, at: turnOf(w) }
  if (days.length >= d.days) { pupil.literacy = 1; pupil.literate = true }
  pupil.history.push({ turn: turnOf(w), kind: 'book', text: `${teacher.name}의 글자 수업 ${Math.min(days.length,d.days)}/${d.days}일${days.length >= d.days ? ' — 기초 문해 습득' : ''}` })
  if (pupil.id === w.s.playerId) log(w, 'good', `글자 수업을 마쳤다 (${Math.min(days.length,d.days)}/${d.days}일).${days.length >= d.days ? ' 이제 글자를 더듬더듬 읽을 수 있다.' : ' 다음 진도는 다른 날에 배운다.'}`)
  pupil.activity = undefined; pupil.nextAct = Math.max(pupil.nextAct, w.s.time + 100)
  c.activity = undefined; c.residentReturning = true
  return true
}
