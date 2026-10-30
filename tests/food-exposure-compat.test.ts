import {describe,expect,it} from 'vitest'
import {loadMods,type ModPackage} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {newGame} from '../src/core/game'
import {player,turnOf} from '../src/core/ctx'
import {consumeFor} from '../src/core/actions'
import {addToBag,makeItem} from '../src/core/items'
import {serialize,deserialize} from '../src/core/save'
import {itemRenamePlan,applyItemRenames} from '../src/core/item-renames'
import {statusRenamePlan,applyStatusRenames} from '../src/core/status-renames'
import {missingItemPlan,applyMissingItems} from '../src/core/missing-items'
import {missingStatusPlan,applyMissingStatuses} from '../src/core/missing-statuses'
import {foodExposureLungDose,foodExposureRules} from '../src/core/food-exposure-state'

const oldFood='Test.Food.Old',newFood='Test.Food.New',oldDisease='Test.Fever.Old',newDisease='Test.Fever.New'
function content(renamed=false,riskMult=.7){
 const food=renamed?newFood:oldFood,disease=renamed?newDisease:oldDisease
 const mod:ModPackage={manifest:{id:'food-history-test',name:'유한 음식 장부 검사',version:renamed?'2':'1'},defs:[
  {defType:'Item',id:food,parent:'Item.Ashcake',label:'기록된 시험 음식'},
  {defType:'Disease',id:disease,parent:'Disease.GreyFever',label:'기록된 시험 열병'},
 ],patches:[{op:'add',target:'FoodSafety.Human',path:'/exposureTraining/-',value:{food,disease,servings:30,durationDays:30,minIntervalTurns:28800,maxGapTurns:57600,lungDose:10,riskMult,knowledgeBook:'Item.SettlementMycologyRecords'}}],
 ...(renamed?{renames:{[oldFood]:newFood,[oldDisease]:newDisease}}:{})}
 const result=loadMods([...readPackages(),mod],['food-history-test'])
 expect(result.report.errors).toEqual([]);return result.db
}
function setup(){
 const db=content(),w={db,s:newGame(db,{seed:'actual-food-history',background:'Bg.Deserter'})},c=player(w)
 c.bag=[];c.needs.hygiene=100;c.hands={kind:'washed',at:turnOf(w)}
 const food=makeItem(w,oldFood);expect(addToBag(w,c,food)).toBe(0)
 expect(consumeFor(w,c,c,food.uid).ok).toBe(true)
 expect(food.def).toBe('Item.Bowl');expect(c.foodExposureTraining?.[0].doseCount).toBe(1)
 return {w,c,food}
}
describe('food physiology survives reviewed content changes',()=>{
 it('explicit renames retain the dose and receipt while moving the rule and active last-meal identity',()=>{
  const {w,c}=setup(),db=content(true),before=serialize(w.s),expected=JSON.parse(before)
  expect(itemRenamePlan(w.s,db).errors).toEqual([]);expect(statusRenamePlan(w.s,db).errors).toEqual([])
  expect(serialize(w.s)).toBe(before)
  expected.creatures.find((person:{id:number})=>person.id===c.id).foodExposureTraining[0].rule.food=newFood
  expected.creatures.find((person:{id:number})=>person.id===c.id).foodExposureTraining[0].rule.disease=newDisease
  // Existing item migration also moves the still-active last diet meal reference.
  expected.creatures.find((person:{id:number})=>person.id===c.id).needs.lastDietMeal.def=newFood
  expect(applyItemRenames(w.s,db)).toBeNull();expect(applyStatusRenames(w.s,db)).toBeNull()
  expect(JSON.parse(serialize(w.s))).toEqual(expected)
  expect(foodExposureLungDose(c)).toBeCloseTo(1/3)
  expect(serialize(deserialize(serialize(w.s)))).toBe(serialize(w.s))
 })
 it('removing consumed food and its disease keeps the actual historical injury and receipt',()=>{
  const {w,c}=setup(),result=loadMods(readPackages(),[]),db=result.db,before=serialize(w.s)
  expect(result.report.errors).toEqual([])
  expect(missingItemPlan(w.s,db).errors).toEqual([]);expect(missingStatusPlan(w.s,db).errors).toEqual([])
  expect(serialize(w.s)).toBe(before)
  expect(applyMissingItems(w.s,db)).toBeNull();expect(applyMissingStatuses({db,s:w.s})).toBeNull()
  expect(serialize(w.s)).toBe(before);expect(foodExposureLungDose(c)).toBeCloseTo(1/3)
 })
 it('a new content rule starts its own course without rewriting an old consumed dose',()=>{
  const {w,c}=setup(),old=structuredClone(c.foodExposureTraining![0]),db=content(false,.5)
  w.db=db;expect(foodExposureRules(w).find(r=>r.food===oldFood)?.riskMult).toBe(.5)
  const meal=makeItem(w,oldFood);expect(addToBag(w,c,meal)).toBe(0);expect(consumeFor(w,c,c,meal.uid).ok).toBe(true)
  expect(c.foodExposureTraining).toHaveLength(2);expect(c.foodExposureTraining![0]).toEqual(old)
  expect(c.foodExposureTraining![1].rule.riskMult).toBe(.5);expect(c.foodExposureTraining![1].doseCount).toBe(1)
  expect(foodExposureLungDose(c)).toBeCloseTo(2/3)
 })
})
