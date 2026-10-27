import {describe,it,expect} from 'vitest'
import {createHash} from 'node:crypto'
import {spireFixture} from './spire-fixture'
import {endingFixture} from './expedition-endings-fixture'
import {activityStep} from '../src/core/actions'
import {fieldDeviceQuote,startFieldDevice,cancelFieldDevice,fieldDeviceDef} from '../src/core/field-devices'
import {playerAct,stopActivity} from '../src/core/game'
import {serialize,deserialize} from '../src/core/save'
import {researchThreads} from '../src/core/research'
import {knownExpeditionEndings,expeditionEndingQuote} from '../src/core/expedition-endings'
import {addToBag,makeItem} from '../src/core/items'
import {finishBase} from './base-camp-fixture'
import {turnOf} from '../src/core/ctx'

function transmitted(){const d=spireFixture();for(const operation of ['repair','transmit'])expect(playerAct(d.w,{type:'deviceWork',pos:d.pos,uid:d.device.uid,operation})).toBeNull();return d}
const reply=(d:ReturnType<typeof spireFixture>)=>playerAct(d.w,{type:'deviceWork',pos:d.pos,uid:d.device.uid,operation:'receive'})
describe('the limited management reply requires actual work and physical authorization',()=>{
 it('preserves every original operation signature, including saved in-progress transmission instructions',()=>{
  const d=spireFixture(),operations=fieldDeviceDef(d.w,d.device).operations
  const expected={repair:'5b411522ecf125e933d0f869dee3f857318545b6d54c5bdd1cc39e0bb39cb302',transmit:'a015d99978003a490613d95695f81faac6c87dc3830408c45934607f5cf4be04',stop:'492eb97f4cc6669de20ae9f4825aec996b1e6e613526a0f861e0fe185269275d'}
  for(const[id,sha]of Object.entries(expected))expect(createHash('sha256').update(JSON.stringify(operations.find(o=>o.id===id))).digest('hex')).toBe(sha)
 })
 it('transmission alone cannot reveal the reply, its research text or the new ending',()=>{
  const d=transmitted(),before=serialize(d.s)
  expect(d.p.fieldNotes?.some(n=>n.key==='remaining-star-reply')).toBe(false)
  const step=researchThreads(d.w,d.p).find(t=>t.id==='signal')!.steps.find(s=>s.id==='reply')!
  expect(step.confirmed).toBe(false);expect(step.text).toBeUndefined()
  expect(knownExpeditionEndings(d.w,d.p).some(q=>q.rule?.id==='acknowledged')).toBe(false)
  expect(serialize(d.s)).toBe(before)
 })
 it('spends ten stored energy once, retains the original plate and records only an automatic status response',()=>{
  const d=transmitted(),begin=d.s.time,next=d.s.nextId,plate=structuredClone(d.plate),towers=structuredClone(d.m.towers)
  expect(reply(d)).toBeNull();expect(d.s.time-begin).toBe(12000);expect(d.device.energy).toBe(60)
  expect(d.s.nextId).toBe(next);expect(d.p.bag.find(i=>i.uid===plate.uid)).toEqual({...plate,gearAgedAt:Math.floor(d.s.time/100)});expect(d.m.towers).toEqual(towers)
  const note=d.p.fieldNotes!.find(n=>n.key==='remaining-star-reply')!;expect(note.deviceUid).toBe(d.device.uid);expect(note.turn).toBe(turnOf(d.w)-1);expect(note.text).toContain('자동 상태 회신');expect(note.text).toContain('누가 지금');expect(note.text).toContain('구조 약속이나 사람의 목소리는 없었다')
  expect(researchThreads(d.w,d.p).find(t=>t.id==='signal')!.steps.find(s=>s.id==='reply')!.confirmed).toBe(true)
  const done=serialize(d.s);expect(startFieldDevice(d.w,d.p,d.pos,d.device.uid,'receive')).toContain('이미');expect(serialize(d.s)).toBe(done)
 })
 for(const mode of ['prerequisite','plate','partial','misread','energy','storm']as const)it(`${mode} blocks reception without any world mutation`,()=>{
  const d=mode==='prerequisite'?spireFixture():transmitted()
  if(mode==='plate')d.p.bag=d.p.bag.filter(i=>i.uid!==d.plate.uid)
  if(mode==='partial')d.p.literacyBooks=d.p.literacyBooks!.filter(id=>id!==d.plate.def)
  if(mode==='misread')d.p.misreadBooks=[d.plate.def]
  if(mode==='energy')d.device.energy=9
  if(mode==='storm')d.s.weather='ashstorm'
  const before=serialize(d.s);expect(fieldDeviceQuote(d.w,d.p,d.pos,d.device.uid,'receive').error).toBeTruthy();expect(serialize(d.s)).toBe(before)
 })
 it('cannot substitute another plate UID in an interrupted reservation; cancel rebinds explicitly without spending energy',()=>{
  const d=transmitted();expect(startFieldDevice(d.w,d.p,d.pos,d.device.uid,'receive')).toBeNull();activityStep(d.w,d.p);stopActivity(d.w,d.p)
  expect(d.device.energy).toBe(70);expect(d.device.work!.progress).toBe(1)
  const quoted=serialize(d.s);expect(fieldDeviceQuote(d.w,d.p,d.pos,d.device.uid,'receive').remaining).toBe(119);expect(fieldDeviceQuote(d.w,d.p,d.pos,d.device.uid,'stop').remaining).toBe(120);expect(fieldDeviceQuote(d.w,d.p,d.pos,d.device.uid,'unknown-operation').remaining).toBe(0);expect(serialize(d.s)).toBe(quoted)
  d.p.bag=d.p.bag.filter(i=>i.uid!==d.plate.uid);const replacement=makeItem(d.w,d.plate.def);addToBag(d.w,d.p,replacement)
  const before=serialize(d.s);expect(startFieldDevice(d.w,d.p,d.pos,d.device.uid,'receive')).toContain('원래');expect(serialize(d.s)).toBe(before)
  expect(cancelFieldDevice(d.w,d.p,d.pos,d.device.uid)).toBeNull();expect(startFieldDevice(d.w,d.p,d.pos,d.device.uid,'receive')).toBeNull();expect(d.device.work!.held![0].uid).toBe(replacement.uid);finishBase(d.w,d.p);expect(d.device.energy).toBe(60)
 })
 it('an interrupted receive reservation resumes identically after a complete save round trip',()=>{
  const d=transmitted();expect(startFieldDevice(d.w,d.p,d.pos,d.device.uid,'receive')).toBeNull();for(let i=0;i<7;i++)activityStep(d.w,d.p);stopActivity(d.w,d.p)
  const copy={db:d.w.db,s:deserialize(serialize(d.s))},other=copy.s.creatures.find(c=>c.id===d.p.id)!
  expect(startFieldDevice(d.w,d.p,d.pos,d.device.uid,'receive')).toBeNull();expect(startFieldDevice(copy,other,d.pos,d.device.uid,'receive')).toBeNull();finishBase(d.w,d.p);finishBase(copy,other);expect(serialize(copy.s)).toBe(serialize(d.s))
 })
 it('the new conclusion requires the author’s own valid reply and never invents prior repair/transmission evidence',()=>{
  const d=endingFixture('acknowledged');expect(expeditionEndingQuote(d.w,d.p,'acknowledged').error).toBeNull()
  d.p.fieldNotes=d.p.fieldNotes!.filter(n=>n.key!=='spire-antenna-repaired');expect(expeditionEndingQuote(d.w,d.p,'acknowledged').error).toContain('수리')
  const note=d.p.fieldNotes!.find(n=>n.key==='remaining-star-reply')!;note.turn=turnOf(d.w)+1
  const before=serialize(d.s);expect(expeditionEndingQuote(d.w,d.p,'acknowledged').revealed).toBe(false);expect(serialize(d.s)).toBe(before)
 })
})
