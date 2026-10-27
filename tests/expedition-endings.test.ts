import {describe,it,expect} from 'vitest'
import {endingFixture} from './expedition-endings-fixture'
import {expeditionEndingQuote,finishExpedition,knownExpeditionEndings} from '../src/core/expedition-endings'
import {researchThreads} from '../src/core/research'
import {playerAct} from '../src/core/game'
import {serialize,deserialize} from '../src/core/save'
import {createCreature} from '../src/core/creatures'
import {canSee,updatePlayerVision} from '../src/core/fov'
import {makeItem} from '../src/core/items'
import {turnOf} from '../src/core/ctx'
const whole=(s:Parameters<typeof serialize>[0])=>JSON.parse(serialize(s))
describe('personal expedition conclusions and physical-world conservation',()=>{
 for(const kind of ['signal','unveiled','witness']as const)it(`${kind}: real prerequisites lead to a0TU report and preserve the entire other World`,()=>{
  const d=endingFixture(kind),before=whole(d.s),q=expeditionEndingQuote(d.w,d.p,kind)
  knownExpeditionEndings(d.w,d.p);researchThreads(d.w,d.p);expect(whole(d.s)).toEqual(before)
  expect(finishExpedition(d.w,d.p,kind,'stale-signature')).toBeTruthy();expect(whole(d.s)).toEqual(before)
  expect(playerAct(d.w,{type:'finishExpedition',ending:kind,expected:q.signature})).toBeNull()
  expect(d.s.over?.kind).toBe('escape');expect(d.p.alive).toBe(true);expect(d.s.over!.turn).toBe(Math.floor(before.time/100));expect(d.s.over!.report.title).toBe(q.rule!.label)
  for(const note of q.notes)expect(d.s.over!.report.chain.some(line=>line.includes(note.text))).toBe(true)
  const after=whole(d.s);delete after.over;const player=after.creatures.find((c:{id:number})=>c.id===d.p.id),old=before.creatures.find((c:{id:number})=>c.id===d.p.id);expect(player.history).toHaveLength(old.history.length+1);expect(player.history.at(-1).kind).toBe('conclusion');player.history=old.history;expect(after).toEqual(before)
  expect(whole(deserialize(serialize(d.s)))).toEqual(whole(d.s));const done=whole(d.s);expect(finishExpedition(d.w,d.p,kind,q.signature)).toBeTruthy();expect(whole(d.s)).toEqual(done)
 })
 for(const state of ['asleep','unconscious','dead','captive','working','pending','off-exit']as const)it(`${state} rejects without altering time, items, body or any other saved field`,()=>{
  const d=endingFixture('signal');if(state==='asleep')d.p.asleep=true;if(state==='unconscious')d.p.unconscious=true;if(state==='dead')d.p.alive=false
  if(state==='captive'){const captor=createCreature(d.w,'Creature.Reaver',{x:1,y:1});d.s.creatures.push(captor);d.p.captivity={captor:captor.id,faction:captor.faction,at:turnOf(d.w),rope:makeItem(d.w,'Item.Rope')}}
  if(state==='working')d.p.activity={kind:'rest',label:'휴식',remaining:1,total:1};if(state==='pending')d.s.simulationPending=true;if(state==='off-exit')d.p.pos={x:d.p.pos.x,y:d.p.pos.y-1}
  const before=whole(d.s),q=expeditionEndingQuote(d.w,d.p,'signal');expect(q.error).toBeTruthy();expect(finishExpedition(d.w,d.p,'signal',q.signature)).toBeTruthy();expect(whole(d.s)).toEqual(before)
 })
 it('an actual waited turn requires a fresh review and a stale confirmation adds no further change',()=>{const d=endingFixture('signal'),q=expeditionEndingQuote(d.w,d.p,'signal');expect(playerAct(d.w,{type:'wait'})).toBeNull();const before=whole(d.s);expect(finishExpedition(d.w,d.p,'signal',q.signature)).toBeTruthy();expect(whole(d.s)).toEqual(before)})
 it('blocks a visible awake hostile without exposing a hidden hostile through eligibility or signature',()=>{const d=endingFixture('signal'),enemy=createCreature(d.w,'Creature.Reaver',{x:d.p.pos.x,y:d.p.pos.y-1});enemy.asleep=false;enemy.unconscious=false;enemy.nextAct=1e12;d.s.creatures.push(enemy);updatePlayerVision(d.w,d.p);expect(canSee(d.w,d.p,enemy.pos)).toBe(true);const before=whole(d.s);expect(expeditionEndingQuote(d.w,d.p,'signal').error).toContain('위협');expect(whole(d.s)).toEqual(before);enemy.pos={x:1,y:1};updatePlayerVision(d.w,d.p);expect(canSee(d.w,d.p,enemy.pos)).toBe(false);const q=expeditionEndingQuote(d.w,d.p,'signal');expect(q.error).toBeNull();enemy.alive=false;expect(expeditionEndingQuote(d.w,d.p,'signal').signature).toBe(q.signature)})
 for(const state of ['other-source','empty-witnesses','future-disclosure','misread','partial-reading']as const)it(`${state} cannot grant the personal witness ending`,()=>{const d=endingFixture('witness'),record=d.m.society!.disclosures![0];if(state==='other-source')record.source=record.witnesses[0];if(state==='empty-witnesses')record.witnesses=[];if(state==='future-disclosure')record.turn=turnOf(d.w)+100;if(state==='misread')d.p.misreadBooks=['Item.CalvisJournal'];if(state==='partial-reading')d.p.literacyBooks=[];const before=whole(d.s);expect(expeditionEndingQuote(d.w,d.p,'witness').error).toBeTruthy();expect(whole(d.s)).toEqual(before)})
 it('hides all conclusions and research when there is no personally confirmed evidence',()=>{const d=endingFixture('signal');d.p.fieldNotes=[];d.p.booksRead=[];d.p.literacyBooks=[];const before=whole(d.s);expect(knownExpeditionEndings(d.w,d.p)).toEqual([]);expect(researchThreads(d.w,d.p)).toEqual([]);expect(whole(d.s)).toEqual(before)})
})
