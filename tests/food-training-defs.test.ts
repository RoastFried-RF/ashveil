import {describe,expect,it} from 'vitest'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {recordBiteRisk,biteRiskTick} from '../src/core/bite-disease'
import {addWound} from '../src/core/body'
import {createCreature} from '../src/core/creatures'
import {diseaseStream} from '../src/core/disease-state'
import {turnOf,TURNS_PER_DAY} from '../src/core/ctx'
const packages=readPackages()
const patched=(patches:ReturnType<typeof readPackages>[number]['patches'])=>{const loaded=loadMods(packages.map(p=>p.manifest.id==='core'?{...p,patches:[...p.patches,...patches]}:p),['core']);expect(loaded.report.errors).toEqual([]);return loaded.db}
describe('dietary exposure content contracts and original bite snapshots',()=>{
 for(const[field,value]of[['servings',0],['intervalTurns',0],['courseTurns',1],['maxGapTurns',1],['riskMultiplier',1.1],['lungAsh',-1],['item','Item.Bowl'],['research',{thread:'missing',step:'missing'}]]as const)it('rejects invalid '+field,()=>{
  const loaded=loadMods(packages.map(p=>p.manifest.id==='core'?{...p,patches:[...p.patches,{op:'replace',target:'Disease.GreyFever',path:'/foodTraining/'+field,value}]}:p),['core'])
  expect(loaded.report.errors.join('\n')).toMatch(/foodTraining/)
 })
 it('binds new bite risk at the exposure time; later meals never rewrite an existing wound roll',()=>{
  const db=patched([{op:'replace',target:'Creature.BurrowRat',path:'/biteDisease',value:{id:'Disease.GreyFever',chance:1,prevention:{turns:10,chanceMult:.5}}}]),d=clinicalDiseaseFixture('food-bite-snapshot',false,db),attacker=createCreature(d.w,'Creature.BurrowRat',{x:21,y:20}),at=31*TURNS_PER_DAY
  d.s.time=at*100;d.p.immuneDiseases=[];d.p.body.foodTraining={'Disease.GreyFever':{firstAt:0,lastAt:29*TURNS_PER_DAY,servings:30,ashPhase:0,lungAsh:10,lastItemUid:123}}
  const wound=addWound(d.w,d.p,{def:'Wound.Bite',part:'LeftForearm',severity:1,source:'declared original bite'}).wound
  d.s.rng[diseaseStream('bite.pending.'+d.p.id)]=[0,0,0,1]
  recordBiteRisk(d.w,d.p,attacker,wound);const risk=d.p.biteRisks?.[0];expect(risk).toBeTruthy();expect(risk!.chance).toBe(.7)
  const stored=JSON.stringify(risk);delete d.p.body.foodTraining;expect(JSON.stringify(risk)).toBe(stored);d.s.time=(turnOf(d.w)+11)*100;biteRiskTick(d.w,d.p);expect(d.p.diseases?.find(x=>x.def==='Disease.GreyFever')?.source?.wound).toBe(wound.id)
 })
})
