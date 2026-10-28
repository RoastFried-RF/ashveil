import {describe,it,expect} from 'vitest'
import {specimenFixture,buySpecimenBook,readSpecimenBook,learnSpecimenBook,completeSpecimenDissection} from './research-specimens-fixture'
import {researchThreads} from '../src/core/research'
import {learnBestiary,bestiaryStage,speciesDissections} from '../src/core/bestiary-state'
import {playerAct} from '../src/core/game'
import {serialize,deserialize} from '../src/core/save'
import {createCreature} from '../src/core/creatures'
import {makeItem} from '../src/core/items'
import {startDissection,finishDissection} from '../src/core/bestiary'
const connection=(d:ReturnType<typeof specimenFixture>,reader=d.p)=>researchThreads(d.w,reader).find(t=>t.id===d.thread)?.steps.find(s=>s.id===d.step)
describe('research distinguishes literature, an original purchased document, and successful personal dissection',()=>{
 for(const kind of ['rat','hound']as const)it(`${kind}: actual purchase, reading and dissection establish a persistent personal connection`,()=>{
  const d=specimenFixture(kind),cash=d.p.money??0,q=buySpecimenBook(d);expect(d.p.money).toBe(cash-q.balance);expect(d.market.items.some(i=>i.uid===d.book.uid)).toBe(false);expect(d.p.bag.find(i=>i.uid===d.book.uid)?.count).toBe(1)
  expect(researchThreads(d.w,d.p).some(t=>t.id===d.thread)).toBe(false);readSpecimenBook(d)
  const partial=connection(d)!;expect(partial.found).toBe(1);expect(partial.total).toBe(2);expect(partial.text).toBeUndefined();expect(partial.sources.map(s=>s.kind)).toEqual(['book'])
  expect(playerAct(d.w,{type:'dissect',target:d.corpse.id})).toBeNull();expect(d.corpse.dissected?.success).toBe(true)
  const before=serialize(d.s),complete=connection(d)!;expect(complete.confirmed).toBe(true);expect(complete.sources.map(s=>s.kind)).toEqual(['book','dissection']);expect(serialize(d.s)).toBe(before)
  const copy={db:d.w.db,s:deserialize(before)},other=copy.s.creatures.find(c=>c.id===d.p.id)!;expect(researchThreads(copy,other)).toEqual(researchThreads(d.w,d.p));expect(serialize(copy.s)).toBe(before)
 },30000)
 it('reading the ordinary bestiary can reach S4 without supplying a successful dissection',()=>{const d=specimenFixture('hound');buySpecimenBook(d);learnSpecimenBook(d);learnBestiary(d.w,'BestiaryEntry.Hound','Item.HighlandBestiary');expect(bestiaryStage(d.w,d.corpse.def)).toBe(4);expect(speciesDissections(d.w,d.corpse.def)).toBe(0);const before=serialize(d.s);expect(connection(d)!.confirmed).toBe(false);expect(connection(d)!.sources.map(s=>s.kind)).toEqual(['book']);expect(serialize(d.s)).toBe(before)})
 it('a failed actual dissection damages that carcass but never confirms the connection',()=>{const d=specimenFixture('rat',false);buySpecimenBook(d);learnSpecimenBook(d);completeSpecimenDissection(d);expect(d.corpse.dissected?.success).toBe(false);expect(connection(d)!.confirmed).toBe(false);expect(connection(d)!.text).toBeUndefined()})
 it('a successful alpha belongs to the same canonical species connection',()=>{const d=specimenFixture('hound',true,true);buySpecimenBook(d);learnSpecimenBook(d);completeSpecimenDissection(d);expect(d.corpse.dissected?.success).toBe(true);expect(connection(d)!.confirmed).toBe(true)})
 for(const mode of ['misread','partial']as const)it(`${mode} reading does not become a completed connection after personal dissection`,()=>{const d=specimenFixture();buySpecimenBook(d);learnSpecimenBook(d);completeSpecimenDissection(d);if(mode==='misread')d.p.misreadBooks=[d.book.def];else d.p.literacyBooks=[];const before=serialize(d.s),row=connection(d)!;expect(row.found).toBe(1);expect(row.confirmed).toBe(false);expect(row.text).toBeUndefined();expect(row.sources.map(s=>s.kind)).toEqual(['dissection']);expect(serialize(d.s)).toBe(before)})
 it('another actor’s successful dissection does not become the player’s experience',()=>{const d=specimenFixture();buySpecimenBook(d);learnSpecimenBook(d);const npc=createCreature(d.w,'Creature.ShadeGroveResident',{...d.p.pos});npc.bag=[makeItem(d.w,'Item.RustyKnife')];npc.stats.per=12;npc.skills={survival:30};d.s.creatures.push(npc);expect(startDissection(d.w,npc,d.corpse.id,200)).toBeNull();expect(finishDissection(d.w,npc,npc.activity!)).toBeNull();expect(d.corpse.dissected?.success).toBe(true);expect(speciesDissections(d.w,d.corpse.def,npc)).toBe(1);expect(speciesDissections(d.w,d.corpse.def,d.p)).toBe(0);expect(connection(d)!.confirmed).toBe(false)})
})
