import {describe,it,expect} from 'vitest'
import {playerAct} from '../src/core/game'
import {serialize} from '../src/core/save'
import {diplomacyDef,factionDef,reputationBand} from '../src/core/diplomacy'
import {economyDef,tradeQuote} from '../src/core/economy'
import {firstImpressionReply} from '../src/core/first-impression-state'
import {displaySocietyMoney,displayFirstReply,displayHeardRelation} from '../src/client/locales/society-care'
import {translateDef,translateReputationBand} from '../src/client/locales/content'
import catalog from '../src/client/locales/en-society-care.json'
import {retirementFixture} from './retirement-fixture'
import {firstImpressionsFixture} from './first-impressions-fixture'

describe('society display uses actual quotes, public definitions and heard records',()=>{
 it('reads original money, faction and reputation without changing any saved world field',()=>{
  const {w,p,keeper}=retirementFixture(),before=serialize(w.s),q=tradeQuote(w,p,keeper,[],[]),money=economyDef(w),d=diplomacyDef(w),band=reputationBand(w,keeper.faction)
  expect(q.error).toBeNull();expect(money.currency).toBe('표')
  expect(displaySocietyMoney(money,p.money!,'en')).toBe('5000 scrip')
  expect(displaySocietyMoney(money,p.money!,'ko')).toBe('5000표')
  expect(translateReputationBand(d,band,'en')).toBe('Friendly')
  expect(translateReputationBand(d,band,'ko')).toBe(band.label)
  const faction=factionDef(w,keeper.faction)!;expect(translateDef(faction,'label','en')).toBe('Scrap guild')
  expect(serialize(w.s)).toBe(before)
 })
 it('preserves changed or foreign denomination, band and faction text including literal placeholders',()=>{
  const {w,keeper}=retirementFixture(),before=serialize(w.s),money=economyDef(w),d=diplomacyDef(w),band=reputationBand(w,keeper.faction),literal='원래 {0} $& <문자>'
  expect(displaySocietyMoney({...money,id:'Economy.Foreign',currency:literal},'3{1}','en')).toBe('3{1}'+literal)
  expect(displaySocietyMoney({...money,currency:literal},2,'en')).toBe('2'+literal)
  expect(displaySocietyMoney(money,literal,'en')).toBe(literal+' scrip')
  expect(displaySocietyMoney({...money,currency:'전'},1,'en')).toBe('1 coin')
  const foreign={...d,id:'Diplomacy.Foreign'};Object.defineProperty(foreign,'bands',{get(){throw Error('foreign private configuration must not be inspected')}})
  expect(translateReputationBand(foreign,band,'en')).toBe(band.label)
  const changed={...band,label:literal};expect(translateReputationBand({...d,bands:d.bands.map(b=>b.min===band.min?changed:b)},changed,'en')).toBe(literal)
  expect(translateReputationBand(d,{...band,min:band.min+1},'en')).toBe(band.label)
  expect(translateDef({...factionDef(w,keeper.faction)!,label:literal},'label','en')).toBe(literal)
  expect(serialize(w.s)).toBe(before)
 })
 for(const attitude of ['wary','warm','neutral']as const)it(attitude+': formats declared heard memory states only when the actual Core reply matches',()=>{
  const {w,p,trader}=firstImpressionsFixture();expect(playerAct(w,{type:'talk',target:trader.id})).toBeNull()
  const memory=trader.firstImpressions?.[p.id];expect(memory?.heard).toBe(true);memory!.attitude=attitude
  for(const rumor of[false,true]){
   memory!.terms=memory!.terms.filter(t=>t.kind!=='rumor');if(rumor)memory!.terms.push({kind:'rumor',value:-1})
   const source=firstImpressionReply(w,trader,p),before=serialize(w.s);expect(source).toBeTruthy()
   expect(displayFirstReply(source,memory,'en')).not.toMatch(/[가-힣]/)
   expect(displayFirstReply(source,memory,'ko')).toBe(source)
   expect(displayFirstReply(source,{...memory!,heard:false},'en')).toBe(source)
   expect(displayFirstReply('과거 원문 {0} $&',memory,'en')).toBe('과거 원문 {0} $&')
   expect(serialize(w.s)).toBe(before)
  }
 })
 it('keeps heard-relation thresholds and reviewed message placeholders',()=>{
  for(const[value,label]of[[-50,'Hostile'],[-49,'Wary'],[-20,'Wary'],[-19,'Neutral'],[19,'Neutral'],[20,'Friendly'],[49,'Friendly'],[50,'Allied']]as const)expect(displayHeardRelation(value,'en')).toBe(label)
  expect(displayHeardRelation(-20,'ko')).toBe('경계')
  const slots=(s:string)=>[...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort()
  for(const[source,target]of Object.entries(catalog)){expect(target.trim()).not.toBe('');expect(slots(target),source).toEqual(slots(source))}
 })
})
