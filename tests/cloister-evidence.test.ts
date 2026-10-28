import {describe,it,expect} from 'vitest'
import {cloisterEvidenceFixture,CLOISTER_DOCUMENTS} from './cloister-evidence-fixture'
import {playerAct,newGame} from '../src/core/game'
import {createCreature} from '../src/core/creatures'
import {killCreature} from '../src/core/combat'
import {researchThreads} from '../src/core/research'
import {makeItem,allItems} from '../src/core/items'
import {studyBook} from '../src/core/skills'
import {serialize,deserialize} from '../src/core/save'
import {loadDb,readPackages} from '../tools/loadContent'
import {loadMods} from '../src/core/defs'
import {applyContentTransition} from '../src/core/content-transition'
const steps=(d:ReturnType<typeof cloisterEvidenceFixture>)=>researchThreads(d.w,d.p).find(t=>t.id==='cloister-seal')?.steps

describe('original sealed-ward evidence and the player’s own reading',()=>{
 it('third-floor boss carries both original objects before death and repeated death cannot generate replacements',()=>{
  const{db,report}=loadDb();expect(report.errors).toEqual([]);const w={db,s:newGame(db,{seed:'ward-original-loadout'})},boss=createCreature(w,'Creature.Amalgam',{x:1,y:1});w.s.creatures.push(boss)
  const originals=boss.bag.filter(it=>CLOISTER_DOCUMENTS.includes(it.def as typeof CLOISTER_DOCUMENTS[number]));expect(originals.map(it=>it.def)).toEqual([...CLOISTER_DOCUMENTS]);expect(originals.every(it=>it.count===1)).toBe(true);expect(new Set(originals.map(it=>it.uid)).size).toBe(2)
  const ring=allItems(boss).filter(it=>it.def==='Item.SealRing');expect(ring).toHaveLength(1);killCreature(w,boss,'검사');expect(allItems(boss).filter(it=>it.def==='Item.SealRing')).toEqual(ring);expect(boss.bag.filter(it=>CLOISTER_DOCUMENTS.includes(it.def as typeof CLOISTER_DOCUMENTS[number]))).toEqual(originals);const dead=serialize(w.s);killCreature(w,boss,'반복 검사');expect(serialize(w.s)).toBe(dead)
 })
 it('actual search, original UID transfer, full reading and successful dissection connect four records and survive restoration',()=>{
  const d=cloisterEvidenceFixture(),uids=d.documents.map(it=>it.uid);expect(steps(d)).toBeUndefined();expect(playerAct(d.w,{type:'search',includeEmpty:true,target:d.boss.id})).toBeNull()
  for(const it of d.documents)expect(playerAct(d.w,{type:'lootTake',uid:it.uid})).toBeNull()
  expect(d.p.bag.filter(it=>uids.includes(it.uid)).map(it=>it.uid).sort()).toEqual([...uids].sort());expect(d.boss.bag.some(it=>uids.includes(it.uid))).toBe(false)
  for(const it of d.documents)expect(playerAct(d.w,{type:'read',uid:it.uid})).toBeNull()
  expect(steps(d)!.filter(s=>s.confirmed).map(s=>s.id)).toEqual(['last-record','capsule']);expect(playerAct(d.w,{type:'dissect',target:d.boss.id})).toBeNull();expect(d.boss.dissected?.success).toBe(true);expect(steps(d)!.find(s=>s.id==='joined-bodies')!.confirmed).toBe(true)
  expect(playerAct(d.w,{type:'read',uid:d.mycology.uid})).toBeNull();expect(steps(d)!.every(s=>s.confirmed)).toBe(true);const before=serialize(d.s);expect(researchThreads(d.w,d.p).find(t=>t.id==='cloister-seal')!.confirmed).toBe(4);expect(serialize(d.s)).toBe(before);const copy=deserialize(before);expect(serialize(copy)).toBe(before);expect(researchThreads({db:d.w.db,s:copy},copy.creatures.find(c=>c.id===copy.playerId)!)).toEqual(researchThreads(d.w,d.p))
 },30000)
 it('an active fungus capsule or another book cannot substitute for the original remnant',()=>{
  const d=cloisterEvidenceFixture();studyBook(d.w,d.p,CLOISTER_DOCUMENTS[0],true);studyBook(d.w,d.p,d.mycology.def,true);d.p.bag.push(makeItem(d.w,'Item.SettlementFungusCapsule'));const before=serialize(d.s),rows=steps(d)!;expect(rows.find(s=>s.id==='capsule')!.confirmed).toBe(false);expect(rows.find(s=>s.id==='capsule')!.text).toBeUndefined();expect(rows.find(s=>s.id==='mycology')!.confirmed).toBe(false);expect(serialize(d.s)).toBe(before)
 })
 it('an already-created older boss is not retroactively given new original documents on content adoption',()=>{
  const packages=readPackages().map(pkg=>({...pkg,defs:pkg.defs.filter(def=>!CLOISTER_DOCUMENTS.includes(def.id as typeof CLOISTER_DOCUMENTS[number])),patches:pkg.patches.filter(patch=>!(patch.target==='Knowledge.Human'&&patch.path==='/research/-'&&(patch.value as {id?:string})?.id==='cloister-seal')&&!(patch.target==='Creature.Amalgam'&&patch.path==='/loadout/slots/-'&&(patch.value as {items?:string[]})?.items?.some(id=>CLOISTER_DOCUMENTS.includes(id as typeof CLOISTER_DOCUMENTS[number]))))}));const oldLoad=loadMods(packages,[]);expect(oldLoad.report.errors).toEqual([]);const old=oldLoad.db,{db}=loadDb(),s=newGame(old,{seed:'old-ward-boss'}),w={db:old,s},boss=createCreature(w,'Creature.Amalgam',{x:1,y:1});s.creatures.push(boss);const before=structuredClone(boss),next=s.nextId
  const loaded={db,s:deserialize(serialize(s))};expect(applyContentTransition(loaded)).toBeNull();expect(loaded.s.creatures.find(c=>c.id===boss.id)).toEqual(before);expect(loaded.s.nextId).toBe(next);expect(loaded.s.creatures.find(c=>c.id===boss.id)!.bag.some(it=>CLOISTER_DOCUMENTS.includes(it.def as typeof CLOISTER_DOCUMENTS[number]))).toBe(false)
 })
})
