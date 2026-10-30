import {describe,expect,it} from 'vitest'
import {loadMods,type PatchOp} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'

describe('food exposure rules require explicit finite references and doses',()=>{
 it('rejects absent fields, invalid intervals and non-food/non-book references',()=>{
  const changes:PatchOp[]=[
   ...['food','disease','servings','durationDays','minIntervalTurns','maxGapTurns','lungDose','riskMult'].map(field=>({op:'remove' as const,target:'FoodSafety.Human',path:'/exposureTraining/0/'+field})),
   {op:'replace',target:'FoodSafety.Human',path:'/exposureTraining/0/food',value:'Item.Bowl'},
   {op:'replace',target:'FoodSafety.Human',path:'/exposureTraining/0/disease',value:'Item.Ashcake'},
   {op:'replace',target:'FoodSafety.Human',path:'/exposureTraining/0/knowledgeBook',value:'Item.Oats'},
   {op:'replace',target:'FoodSafety.Human',path:'/exposureTraining/0/knowledgeBook',value:''},
   {op:'replace',target:'FoodSafety.Human',path:'/exposureTraining/0/riskMult',value:0},
   {op:'replace',target:'FoodSafety.Human',path:'/exposureTraining/0/servings',value:1.5},
   {op:'replace',target:'FoodSafety.Human',path:'/exposureTraining/0/maxGapTurns',value:100},
  ]
  for(const change of changes){
   const result=loadMods([...readPackages(),{manifest:{id:'invalid-food-rule',name:'규칙 경계 검사',version:'1'},defs:[],patches:[change]}],['invalid-food-rule'])
   expect(result.report.errors.some(error=>error.includes('exposureTraining')||error.includes('FoodSafety.Human')),JSON.stringify(change)).toBe(true)
  }
 })
})
