import { describe, expect, it } from 'vitest'
import { applyPatch, loadMods, type ModPackage } from '../src/core/defs'
import { readPackages } from '../tools/loadContent'

const pkg = (id: string, defs: unknown[], patches: unknown[] = [], extra: object = {}): ModPackage =>
  ({ manifest: { id, name: id, version: '1', ...extra }, defs: defs as never, patches: patches as never })

describe('Def 로더', () => {
  it('덜 익은 죽 모드도 같은 원래 그릇/물량/끓임 결과와400턴을 지켜야 한다',()=>{
    const {report}=loadMods([...readPackages(),pkg('bad.unheated',[],[
      {op:'replace',target:'Item.UnheatedOatmealBowl',path:'/food/water',value:1000},
      {op:'replace',target:'Item.UnheatedOatmealBowl',path:'/cooking/turns',value:1},
      {op:'replace',target:'Item.UnheatedOatmealBowl',path:'/food/emptyVessel',value:'Item.EmptyTin'}
    ])]);expect(report.errors.some(e=>e.includes('boiledMeal.unheated'))).toBe(true)
  })
  it('없는 미완성 그릇이나 단백/비타민 복제를 거절한다',()=>{
    for(const patch of[{op:'replace',target:'Recipe.Oatmeal',path:'/boiledMeal/unheated',value:'Item.Absent'},{op:'replace',target:'Item.UnheatedOatmealBowl',path:'/food/protein',value:100}]){
      const {report}=loadMods([...readPackages(),pkg('bad.unheated.ref',[],[patch])]);expect(report.errors.some(e=>e.includes('boiledMeal.unheated')||e.includes('Item.Absent'))).toBe(true)
    }
  })
  it('모닥불 조리 모드의 간격/한도/탐 확률/영양/맛과 사고 참조를 검증한다',()=>{
    const {report}=loadMods([...readPackages(),pkg('bad.cooking',[],[
      {op:'replace',target:'FoodSafety.Human',path:'/cooking/neglectTurns',value:0},
      {op:'replace',target:'FoodSafety.Human',path:'/cooking/capacity',value:1.5},
      {op:'replace',target:'FoodSafety.Human',path:'/cooking/burnChance',value:2},
      {op:'replace',target:'FoodSafety.Human',path:'/cooking/masteryReduction',value:-1},
      {op:'replace',target:'FoodSafety.Human',path:'/cooking/burnKcal',value:2},
      {op:'replace',target:'FoodSafety.Human',path:'/cooking/burnMood',value:4},
      {op:'replace',target:'FoodSafety.Human',path:'/cooking/thought',value:'Thought.Absent'}
    ])]);for(const word of['cooking.neglectTurns','cooking.capacity','cooking.burnChance','cooking.masteryReduction','cooking.burnKcal','cooking.burnMood','Thought.Absent'])expect(report.errors.some(e=>e.includes(word)),word).toBe(true)
  })
  it('잘못되거나 비어 있는 조리 정책은 거절한다',()=>{
    for(const value of[null,[],{},'bad']){const {report}=loadMods([...readPackages(),pkg('bad.cooking.shape',[],[{op:'replace',target:'FoodSafety.Human',path:'/cooking',value}])]);expect(report.errors.some(e=>e.includes('cooking'))).toBe(true)}
  })
  it('파손 모드는 원래 칸/쌓임/영양과 확률 범위를 보존해야 한다',()=>{
    const {report}=loadMods([...readPackages(),pkg('bad.fragile',[],[
      {op:'replace',target:'Item.Egg',path:'/fragile/dropChance',value:2},
      {op:'replace',target:'Item.Egg',path:'/fragile/waterMult',value:-1},
      {op:'replace',target:'Item.Egg',path:'/fragile/noise',value:2.5},
      {op:'replace',target:'Item.CrackedEgg',path:'/maxStack',value:1},
      {op:'replace',target:'Item.CrackedEgg',path:'/food/kcal',value:160},
      {op:'remove',target:'Item.CrackedEgg',path:'/food/freshHours'}
    ])]);for(const word of['fragile.dropChance','fragile.waterMult','fragile.noise','fragile 원래 칸/수량','fragile 실제 원래 음식','fragile 부패하는'])expect(report.errors.some(e=>e.includes(word)),word).toBe(true)
  })
  it('잘못된 파손 구조/없는 결과/자기 변환은 거절한다',()=>{
    for(const value of[null,{},[],'bad',{dropChance:.3,result:'Item.Absent'},{dropChance:.3,result:'Item.Egg'}]){
      const {report}=loadMods([...readPackages(),pkg('bad.fragile.shape',[],[{op:'replace',target:'Item.Egg',path:'/fragile',value}])]);expect(report.errors.some(e=>e.includes('fragile')||e.includes('Item.Absent'))).toBe(true)
    }
  })
  it('원래 사망 고기·생식 질병의 실제 참조와 수치를 검증한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.rat.food',[],[
      {op:'replace',target:'Creature.BurrowRat',path:'/meatDrop/item',value:'Item.Absent'},
      {op:'replace',target:'Creature.BurrowRat',path:'/meatDrop/count',value:-1},
      {op:'replace',target:'Item.RawRatMeat',path:'/food/rawDisease/def',value:'Disease.Absent'},
      {op:'replace',target:'Item.RawRatMeat',path:'/food/rawDisease/chance',value:2}
    ])]);for(const key of['Item.Absent','meatDrop.count','Disease.Absent','food.rawDisease.chance'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)
  })
  it('사망 고기/생식 노출의 잘못된 중첩 설정을 예외 없이 보고한다',()=>{
    for(const value of[null,{},[],'bad'])for(const [target,path]of[['Creature.BurrowRat','/meatDrop'],['Item.RawRatMeat','/food/rawDisease']]){
      const{db,report}=loadMods([...readPackages(),pkg('bad.rat.shape',[],[{op:'replace',target:target!,path:path!,value}])])
      if(value===null&&target==='Item.RawRatMeat'){expect(report.errors).toEqual([]);expect(db.item(target).food).not.toHaveProperty('rawDisease')}
      else expect(report.errors.some(e=>e.includes(path!.split('/').at(-1)!))).toBe(true)
    }
  })
  it('실제 계절 채집·원래 지형 보존과 싹 위험 수치를 검증한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.plants',[],[
      {op:'replace',target:'Terrain.AshBerryBush',path:'/gather/seasons',value:['Season.Absent']},
      {op:'replace',target:'WorldGen.Hearth',path:'/forage/chance',value:2},
      {op:'replace',target:'WorldGen.Hearth',path:'/forage/sourceTerrain',value:'Terrain.Tree'},
      {op:'replace',target:'Item.RawPotato',path:'/food/sprouts/risk',value:101}
    ])]);for(const key of['Season.Absent','forage.chance','forage 원래 지형','food.sprouts.risk'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)
  })
  it('계절 채집/새 덤불/싹의 잘못된 중첩 설정을 예외 없이 보고한다',()=>{
    for(const value of[null,{},[],'bad'])for(const [target,path]of[['Terrain.AshBerryBush','/gather/seasons'],['WorldGen.Hearth','/forage'],['Item.RawPotato','/food/sprouts']]){
      const{db,report}=loadMods([...readPackages(),pkg('bad.plants.shape',[],[{op:'replace',target:target!,path:path!,value}])])
      if(value===null&&target==='Terrain.AshBerryBush'){expect(db.terrain(target).gather).not.toHaveProperty('seasons');expect(report.errors.some(e=>e.includes('forage'))).toBe(true)}
      else expect(report.errors.some(e=>e.includes(path!.split('/').at(-1)!))).toBe(true)
    }
  })
  it('죽의 실제 그릇·물량과 보온 수치 참조를 검증한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.meal',[],[
      {op:'replace',target:'Recipe.Oatmeal',path:'/boiledMeal/waterMl',value:0},
      {op:'replace',target:'Recipe.Oatmeal',path:'/boiledMeal/vessel',value:'Item.Absent'},
      {op:'replace',target:'Item.OatmealBowl',path:'/food/warm/gain',value:-1}
    ])]);for(const key of['boiledMeal.waterMl','Item.Absent','food.warm.gain'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)
  })
  it('죽 조리/보온의 잘못된 중첩 설정은 예외 없이 보고한다',()=>{
    for(const value of[null,{},[],'bad'])for(const [target,path]of[['Recipe.Oatmeal','/boiledMeal'],['Item.OatmealBowl','/food/warm']]){
      const{report}=loadMods([...readPackages(),pkg('bad.meal.shape',[],[{op:'replace',target:target!,path:path!,value}])]);expect(report.errors.some(e=>e.includes(path!.split('/').at(-1)!))).toBe(true)
    }
  })
  it('실제 차/물병의 용량·양·솔잎과 소나무 참조를 검증한다',()=>{
    const {report}=loadMods([...readPackages(),pkg('bad.tea',[],[
      {op:'replace',target:'Item.PineNeedles',path:'/brew/mlPerLeaf',value:0},
      {op:'replace',target:'Item.PineNeedles',path:'/brew/bottles',value:['Item.Absent']},
      {op:'replace',target:'Item.PineTeaBottle',path:'/drink/freshHours',value:0},
      {op:'replace',target:'Terrain.PineTree',path:'/needles/count',value:0},
      {op:'replace',target:'WorldGen.Hearth',path:'/pines/chance',value:2}
    ])]);for(const key of['brew.mlPerLeaf','Item.Absent','drink.freshHours','needles.count','pines.chance'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)
  })
  it('차·채집·소나무의 잘못된 중첩 설정을 예외 없이 보고한다',()=>{
    for(const value of[null,{},[],'bad'])for(const [target,path]of[['Item.PineNeedles','/brew'],['Terrain.PineTree','/needles'],['WorldGen.Hearth','/pines']]){
      const{db,report}=loadMods([...readPackages(),pkg('bad.tea.shape',[],[{op:'replace',target:target!,path:path!,value}])])
      if(value===null&&target==='Terrain.PineTree'){expect(db.terrain(target)).not.toHaveProperty('needles');expect(report.errors.some(e=>e.includes('pines'))).toBe(true)}
      else expect(report.errors.some(e=>e.includes(path!.slice(1)))).toBe(true)
    }
  })
  it('실제 밀봉 음식의 개봉 시간·도구와 같은 용기 결과를 검증한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.open.food',[],[
      {op:'replace',target:'Item.CannedMeat',path:'/openFood/turns',value:0},
      {op:'replace',target:'Item.CannedMeat',path:'/openFood/tools',value:['Item.Absent']},
      {op:'replace',target:'Item.CannedMeat',path:'/openFood/result',value:'Item.CannedMeat'},
    ])]);for(const key of['openFood.turns','Item.Absent','openFood 실제 음식'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)
  })
  it('개봉 규칙의 잘못된 중첩 설정과 없는 도구 목록을 보고한다',()=>{
    for(const value of[null,{},[],'bad']){const{report}=loadMods([...readPackages(),pkg('bad.open.shape',[],[{op:'replace',target:'Item.CannedMeat',path:'/openFood',value}])]);expect(report.errors.some(e=>e.includes('openFood'))).toBe(true)}
  })
  it('실제 발효의 원래 용기·한 개 수량·회분·반환 용기를 검증한다',()=>{
    const {report}=loadMods([...readPackages(),pkg('bad.ferment',[],[
      {op:'replace',target:'Recipe.FermentCabbage',path:'/preservation/vessel',value:'Item.Stone'},
      {op:'replace',target:'Recipe.FermentCabbage',path:'/output/count',value:2},
      {op:'replace',target:'Item.PickledCabbageJar',path:'/food/servings',value:0},
      {op:'replace',target:'Item.PickledCabbageJar',path:'/food/emptyVessel',value:'Item.Jerky'},
    ])]);for(const key of['원래 용기/회분','food.servings','food.emptyVessel'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)
  })
  it('음식 용기는 없는 반환 품목·다른 칸·음식 자기 반환·중복 원본 재료를 거부한다',()=>{
    for(const patch of[
      {op:'replace',target:'Item.PickledCabbageJar',path:'/food/emptyVessel',value:'Item.Absent'},
      {op:'replace',target:'Item.CeramicJar',path:'/size',value:[1,1]},
      {op:'replace',target:'Recipe.FermentCabbage',path:'/inputs',value:[{item:'Item.Cabbage',count:5},{item:'Item.Salt',count:1},{item:'Item.CeramicJar',count:1},{item:'Item.CeramicJar',count:1}]},
    ]){const{report}=loadMods([...readPackages(),pkg('bad.vessel.shape',[],[patch])]);expect(report.errors.length).toBeGreaterThan(0)}
  })
  it('음식 가공의 실제 기간·바람/진행 배율·입력/결과와 냄새 반경을 검증한다',()=>{
    const {report}=loadMods([...readPackages(),pkg('bad.preservation',[],[
      {op:'replace',target:'Recipe.SmokeMeat',path:'/passiveTurns',value:0},
      {op:'replace',target:'Recipe.SmokeMeat',path:'/preservation/fastRate',value:Infinity},
      {op:'replace',target:'Recipe.DryMeat',path:'/preservation/fastWind',value:0},
      {op:'replace',target:'Recipe.DryMeat',path:'/output/item',value:'Item.Stone'},
      {op:'replace',target:'Item.SmokedMeat',path:'/food/scentRadius',value:-1},
    ])]);for(const key of['가공 기간','fastRate','fastWind','음식 입력/결과','scentRadius'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)
  })
  it('음식 가공의 잘못된 중첩 설정을 보고하고 로더를 중단하지 않는다',()=>{
    for(const value of[null,{},[],'bad']){const{report}=loadMods([...readPackages(),pkg('bad.preservation.shape',[],[{op:'replace',target:'Recipe.SmokeMeat',path:'/preservation',value}])]);expect(report.errors.some(e=>e.includes('preservation'))).toBe(true)}
  })
  it('첫 만남의 실제 문턱·감점·태도와 세력/신체 부위 참조를 검증한다',()=>{
    const {report}=loadMods([...readPackages(),pkg('bad.first',[],[
      {op:'replace',target:'Economy.Hearth',path:'/firstImpressions/filthyBelow',value:NaN},
      {op:'replace',target:'Economy.Hearth',path:'/firstImpressions/filthyPenalty',value:1},
      {op:'replace',target:'Economy.Hearth',path:'/firstImpressions/faceScarPenalty',value:-101},
      {op:'replace',target:'Economy.Hearth',path:'/firstImpressions/hagglePerPoint',value:Infinity},
      {op:'replace',target:'Economy.Hearth',path:'/firstImpressions/warmAt',value:-10},
      {op:'replace',target:'Economy.Hearth',path:'/firstImpressions/villagerFactions',value:['absent']},
      {op:'replace',target:'Economy.Hearth',path:'/firstImpressions/faceGroups',value:['absent']},
    ])]);for(const key of['filthyBelow','filthyPenalty','faceScarPenalty','hagglePerPoint','태도 문턱','villagerFactions','faceGroups'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)
  })
  it('첫 인상의 잘못된 중첩 설정은 로더를 중단하지 않고 보고한다',()=>{
    for(const value of[null,{},[],'bad']){const{report}=loadMods([...readPackages(),pkg('bad.first.shape',[],[{op:'replace',target:'Economy.Hearth',path:'/firstImpressions',value}])]);expect(report.errors.some(e=>e.includes('firstImpressions'))).toBe(true)}
  })
  it('수면 박탈 환청의 실제 문턱·주기·확률·범위·유효 시간을 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.hallucination',[],[
   {op:'replace',target:'Thought.Hallucination',path:'/hallucination/debtHours',value:NaN},
   {op:'replace',target:'Thought.Hallucination',path:'/hallucination/checkTurns',value:0},
   {op:'replace',target:'Thought.Hallucination',path:'/hallucination/chance',value:2},
   {op:'replace',target:'Thought.Hallucination',path:'/hallucination/range',value:100},
   {op:'replace',target:'Thought.Hallucination',path:'/hallucination/lifetimeTurns',value:Infinity},
  ])]);for(const key of['debtHours','checkTurns','chance','range','lifetimeTurns'])expect(report.errors.some(e=>e.includes('hallucination.'+key)),key).toBe(true)})
  it('환청의 잘못된 중첩 설정은 보고하고 중단하지 않는다',()=>{for(const value of[null,{},[],'bad']){const{report}=loadMods([...readPackages(),pkg('bad.hallucination.shape',[],[{op:'replace',target:'Thought.Hallucination',path:'/hallucination',value}])]);expect(report.errors.some(e=>e.includes('hallucination 구조 오류'))).toBe(true)}})

  it('살코기 식단의 실제 기간·단백 비중/흡수·수분 손실 수치를 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.diet',[],[
   {op:'replace',target:'Nutrition.Human',path:'/leanDiet/windowTurns',value:0},
   {op:'replace',target:'Nutrition.Human',path:'/leanDiet/proteinKcalPerGram',value:NaN},
   {op:'replace',target:'Nutrition.Human',path:'/leanDiet/proteinFraction',value:2},
   {op:'replace',target:'Nutrition.Human',path:'/leanDiet/absorption',value:-1},
   {op:'replace',target:'Nutrition.Human',path:'/leanDiet/waterPerDay',value:Infinity},
  ])]);for(const key of['windowTurns','proteinKcalPerGram','proteinFraction','absorption','waterPerDay'])expect(report.errors.some(e=>e.includes('leanDiet.'+key)),key).toBe(true)})
  it('살코기 식단의 잘못된 중첩 설정은 보고하고 중단하지 않는다',()=>{for(const value of[null,{},[],'bad']){const{report}=loadMods([...readPackages(),pkg('bad.diet.shape',[],[{op:'replace',target:'Nutrition.Human',path:'/leanDiet',value}])]);expect(report.errors.some(e=>e.includes('leanDiet 구조 오류'))).toBe(true)}})

  it('거품병의 실제 잠복/사망 시계·예방/거품 개체 확률을 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.foam',[],[
   {op:'replace',target:'Disease.FoamSickness',path:'/fatalAfterTurns',value:0},
   {op:'replace',target:'Disease.FoamSickness',path:'/latentScarPain',value:-1},
   {op:'replace',target:'Creature.AshHound',path:'/biteDisease/prevention/turns',value:NaN},
   {op:'replace',target:'Creature.AshHound',path:'/biteDisease/prevention/chanceMult',value:2},
   {op:'replace',target:'Creature.AshHound',path:'/biteDisease/carrier/transmission',value:2},
  ])]);for(const key of['fatalAfterTurns','latentScarPain','prevention.turns','prevention.chanceMult','carrier.transmission'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('잘못된 물림 예방/거품 개체 중첩 설정은 보고하고 중단하지 않는다',()=>{for(const[path,value]of[['/biteDisease/prevention',null],['/biteDisease/carrier',null],['/biteDisease/prevention',{}],['/biteDisease/prevention',[]],['/biteDisease/carrier',{}],['/biteDisease/carrier','bad']]as const){const{report}=loadMods([...readPackages(),pkg('bad.foam.shape',[],[{op:'replace',target:'Creature.AshHound',path,value}])]);expect(report.errors.some(e=>e.includes('구조 오류'))).toBe(true)}})

  it('흡입 재와 실제 방진 면포의 수치·유한 여과 재료를 검증한다',()=>{const {report}=loadMods([...readPackages(),pkg('bad.air',[],[
   {op:'replace',target:'WaterSafety.Human',path:'/inhalation/weather/ashgale',value:-1},
   {op:'replace',target:'WaterSafety.Human',path:'/inhalation/caps',value:[{dose:300,cap:.8},{dose:120,cap:.95}]},
   {op:'replace',target:'Item.AshMask',path:'/respirator/protection',value:2},
   {op:'replace',target:'Item.AshMask',path:'/respirator/filter',value:'Item.Absent'},
   {op:'replace',target:'Item.AshMask',path:'/respirator/chargeTurns',value:Infinity},
  ])]);for(const key of['inhalation.weather','inhalation.caps','respirator.protection','Item.Absent','respirator.chargeTurns'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('흡입/방진의 잘못된 중첩 설정은 거부하고 상속된 선택 규칙의null삭제를 구별한다',()=>{
    for(const [target,path,value]of[['WaterSafety.Human','/inhalation',null],['WaterSafety.Human','/inhalation',{}],['WaterSafety.Human','/inhalation/caps',[{}]],['Item.AshMask','/respirator',null],['Item.AshMask','/respirator',[]]]as const){
      const {db,report}=loadMods([...readPackages(),pkg('bad.air.shape',[],[{op:'replace',target,path,value}])])
      if(value===null&&target==='Item.AshMask'){expect(report.errors).toEqual([]);expect(db.item(target)).not.toHaveProperty('respirator')}
      else expect(report.errors.some(e=>e.includes('구조 오류'))).toBe(true)
    }
  })

  it('실제 질병 노출/기능 손실·혈청 참조와 물림 확률을 검증한다',()=>{const {report}=loadMods([...readPackages(),pkg('bad.clinical',[],[
   {op:'replace',target:'Disease.Tetanus',path:'/clinical/manipulation',value:2},
   {op:'replace',target:'Disease.Pneumonia',path:'/clinical/breathingPerProgress',value:-1},
   {op:'replace',target:'Disease.Tetanus',path:'/woundExposure/chance',value:NaN},
   {op:'replace',target:'Disease.Tetanus',path:'/woundExposure/terrain',value:['Terrain.Absent']},
   {op:'replace',target:'Creature.BurrowRat',path:'/biteDisease/chance',value:2},
   {op:'replace',target:'Drug.TetanusSerum',path:'/curesDisease',value:'Disease.Absent'},
  ])]);for(const key of['clinical.manipulation','clinical.breathingPerProgress','woundExposure.chance','Terrain.Absent','biteDisease.chance','Disease.Absent'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('잘못된 질병의 중첩 설정은 로더를 중단하지 않고 거부한다',()=>{for(const [target,path,value] of [['Disease.Pneumonia','/coldExposure',[]],['Disease.Pneumonia','/lyingExposure',{}],['Disease.Tetanus','/clinical/seizure','bad'],['Disease.Tetanus','/woundExposure',{}],['Creature.BurrowRat','/biteDisease',[]]] as const){const {report}=loadMods([...readPackages(),pkg('bad.clinical.shape',[],[{op:'replace',target,path,value}])]);expect(report.errors.some(e=>e.includes('구조 오류')||e.includes('노출 목록'))).toBe(true)}})

  it('선체 침수의 실제 지지대/해수와 마모·정원/갑판 좌표를 검증한다',()=>{const {report}=loadMods([...readPackages(),pkg('bad.flood',[],[
    {op:'replace',target:'Item.CoracleKit',path:'/watercraft/sinking/leakWear',value:-1},
    {op:'replace',target:'Item.CoracleKit',path:'/watercraft/sinking/stormWear/ashgale',value:NaN},
    {op:'replace',target:'Item.CoracleKit',path:'/watercraft/sinking/frameTerrain',value:'Terrain.ShallowWater'},
    {op:'replace',target:'Item.CoracleKit',path:'/watercraft/sinking/frames',value:[[0,0],[0,0],[100,0],[1,1],[2,2]]},
  ])]);for(const key of ['sinking.leakWear','sinking.stormWear','sinking.frameTerrain','sinking.frames'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('선체 침수의 잘못된 설정/지지대 좌표 구조는 로더 중단 없이 거부한다',()=>{for(const value of [[],{},'bad',{stormWear:[],frames:null},{stormWear:{},frames:['bad',[1.5,0]],frameTerrain:'Terrain.Absent'}]){const {report}=loadMods([...readPackages(),pkg('bad.flood.shape',[],[{op:'replace',target:'Item.CoracleKit',path:'/watercraft/sinking',value}])]);expect(report.errors.some(e=>e.includes('sinking')||e.includes('Terrain.Absent'))).toBe(true)}})

  it('실제 순찰의 원래 야영지/상자·세력과 거리/인원/강탈 확률 한도를 검증한다',()=>{const {report}=loadMods([...readPackages(),pkg('bad.roadRaid',[],[
    {op:'replace',target:'WorldSimulation.Hearth',path:'/roadRaids/source',value:'Region.Absent'},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/roadRaids/faction',value:'absent'},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/roadRaids/containerTerrain',value:'Terrain.Earth'},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/roadRaids/territoryCells',value:20},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/roadRaids/minMembers',value:7},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/roadRaids/chancePerMember',value:2},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/roadRaids/guardReduction',value:-1},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/roadRaids/waypoint',value:''},
  ])]);for(const key of ['Region.Absent','roadRaids.faction','실제 상자','roadRaids.territoryCells','roadRaids.minMembers','roadRaids.chancePerMember','roadRaids.guardReduction','roadRaids.waypoint'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('순찰의 잘못된 설정 구조와 누락 수치를 로더 중단 없이 거부한다',()=>{for(const value of [[],{},'bad',{firstDay:NaN,minMembers:4,maxMembers:2}]){const {report}=loadMods([...readPackages(),pkg('bad.roadRaid.shape',[],[{op:'replace',target:'WorldSimulation.Hearth',path:'/roadRaids',value}])]);expect(report.errors.some(e=>e.includes('roadRaids'))).toBe(true)}})

  it('교역단의 실제 화물 격자·간격/자본·호위 한도와 생산/소비 품목을 검증한다',()=>{const {report}=loadMods([...readPackages(),pkg('bad.caravan',[],[
    {op:'replace',target:'WorldSimulation.Hearth',path:'/caravans/intervalDays',value:0},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/caravans/encounterStopTurns',value:0},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/caravans/feePerCell',value:1.5},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/caravans/wallet',value:NaN},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/caravans/maxGuards',value:5},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/caravans/grid',value:[0,4]},
    {op:'replace',target:'WorldSimulation.Hearth',path:'/caravans/items',value:['Item.Absent','Item.Needle']},
  ])]);for(const key of ['caravans.encounterStopTurns','caravans.intervalDays','caravans.feePerCell','caravans.wallet','caravans.maxGuards','caravans.grid','Item.Absent','생산/소비'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('교역단의 누락/잘못된 설정 구조도 로더 중단 없이 거부한다',()=>{for(const value of [[],{},'bad',{items:'salt',grid:null}]){const {report}=loadMods([...readPackages(),pkg('bad.caravan.shape',[],[{op:'replace',target:'WorldSimulation.Hearth',path:'/caravans',value}])]);expect(report.errors.some(e=>e.includes('caravans'))).toBe(true)}})

  it('깊은 물의 실제 호흡/산소 부족·둔중/구조 경계와 수중 호흡 설정을 검증한다',()=>{const {report}=loadMods([...readPackages(),pkg('bad.aquatic',[],[
    {op:'replace',target:'WaterSafety.Human',path:'/aquatic/breathTurns',value:0},
    {op:'replace',target:'WaterSafety.Human',path:'/aquatic/sinkChance',value:2},
    {op:'replace',target:'WaterSafety.Human',path:'/aquatic/rescueTurns',value:0},
    {op:'replace',target:'Body.Worm',path:'/waterBreathing',value:'yes'},
  ])]);for(const key of ['aquatic.breathTurns','aquatic.sinkChance','aquatic.rescueTurns','waterBreathing'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('누락/잘못된 수영 규정과 숨 경고 경계는 로더 중단 없이 거부한다',()=>{for(const value of [[],{},'bad',{breathTurns:20,criticalAir:20}]){const {report}=loadMods([...readPackages(),pkg('bad.aquatic.shape',[],[{op:'replace',target:'WaterSafety.Human',path:'/aquatic',value}])]);expect(report.errors.some(e=>e.includes('aquatic'))).toBe(true)}})

  it('봉화의 실제 가연 연료·전송 속도/반경과 인근 선행 지역을 검증한다',()=>{const {report}=loadMods([...readPackages(),pkg('bad.beacon',[],[
    {op:'replace',target:'Terrain.CoastalBeacon',path:'/beacon/fuel',value:'Item.WaterBottle'},
    {op:'replace',target:'Terrain.CoastalBeacon',path:'/beacon/speed',value:0},
    {op:'replace',target:'Terrain.CoastalBeacon',path:'/beacon/radius',value:50},
    {op:'replace',target:'Terrain.CoastalBeacon',path:'/beacon/fuelTurns',value:100000},
    {op:'replace',target:'Region.SaltrimRelay',path:'/extension/near',value:{site:'Region.SaltrimRelay',maxCells:0}},
  ])]);for(const key of ['beacon.fuel','beacon.speed','beacon.radius','연료 한도','extension.near'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('잘못된 봉화 설정 구조와 미등록 인근 지역을 로더 중단 없이 거부한다',()=>{for(const value of [[],{},'bad']){const {report}=loadMods([...readPackages(),pkg('bad.beacon.shape',[],[{op:'replace',target:'Terrain.CoastalBeacon',path:'/beacon',value},{op:'replace',target:'Region.SaltrimRelay',path:'/extension/near/site',value:'Region.Absent'}])]);expect(report.errors.some(e=>e.includes('beacon'))).toBe(true);expect(report.errors.some(e=>e.includes('Region.Absent'))).toBe(true)}})

  it('기생 개체의 신체/소금/질병과 실제 안개·저지대 범위를 검증한다',()=>{const {report}=loadMods([...readPackages(),pkg('bad.parasites',[],[
    {op:'replace',target:'Creature.MurkLeech',path:'/parasite/mlPerTurn',value:0},
    {op:'replace',target:'Creature.MurkLeech',path:'/parasite/parts',value:['MissingPart']},
    {op:'replace',target:'Creature.MurkLeech',path:'/parasite/saltItem',value:'Item.Wood'},
    {op:'replace',target:'Creature.MurkLeech',path:'/parasite/disease',value:'Disease.Absent'},
    {op:'replace',target:'Creature.MurkLeech',path:'/temperatureLimits/min',value:50},
    {op:'replace',target:'RegionLayout.MurkFens',path:'/fog/sightMult',value:0},
    {op:'replace',target:'Region.MurkFens',path:'/extension/altitude',value:[400,0]},
  ])]);for(const key of ['mlPerTurn','parts','saltItem','Disease.Absent','temperatureLimits','fog.sightMult','extension.altitude'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('잘못된 기생 개체 구조도 로더 중단 없이 거부한다',()=>{for(const value of [[],{hostKinds:[],parts:[],saltItem:'Item.Missing'}, {hostKinds:{},parts:['LeftShin'],saltItem:'Item.Salt'}]){const {report}=loadMods([...readPackages(),pkg('bad.parasite.shape',[],[{op:'replace',target:'Creature.MurkLeech',path:'/parasite',value}])]);expect(report.errors.length).toBeGreaterThan(0)}})

  it('선체의 정원/갑판·선원 자리/현물 수리와 실제 부두 좌표를 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.boat',[],[{op:'replace',target:'Item.CoracleKit',path:'/watercraft/seats',value:0},{op:'replace',target:'Item.CoracleKit',path:'/watercraft/deck',value:[6,4,100,5]},{op:'replace',target:'Item.CoracleKit',path:'/watercraft/repair/item',value:'Item.Missing'},{op:'replace',target:'Item.CoracleKit',path:'/watercraft/cargoPos',value:[-1,6]},{op:'replace',target:'RegionLayout.SaltrimHarbor',path:'/dock',value:[200,21]}])]);for(const key of ['seats','갑판','Item.Missing','cargoPos','dock'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('잘못된 선박 설정 구조를 로더 중단 없이 거부한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.boat.shape',[],[{op:'replace',target:'Item.CoracleKit',path:'/watercraft/repair',value:[]},{op:'replace',target:'Item.CoracleKit',path:'/watercraft/deck',value:'deck'}])]);expect(report.errors.some(e=>e.includes('watercraft 구조'))).toBe(true)})
  it('소금 생산의 실제 물량/염도와 결과 질량 불일치를 거부한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.evaporate',[],[{op:'replace',target:'Recipe.EvaporateSeaSalt',path:'/evaporation/ml',value:0},{op:'replace',target:'Item.Salt',path:'/saltGrams',value:70}])]);for(const key of ['evaporation','질량 불일치'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('증발과 수동 가공을 섞거나 실제 물을 개수 재료로 중복 소비하는 제작법은 거부한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.evaporate.dual',[],[{op:'add',target:'Recipe.EvaporateSeaSalt',path:'/passiveTurns',value:100},{op:'replace',target:'Recipe.EvaporateSeaSalt',path:'/inputs',value:[{item:'Item.WaterBottle',count:1}]}])]);expect(report.errors.some(e=>e.includes('별도 예약'))).toBe(true)})
  it('해수 염도와 수분 손실/식수 문턱의 잘못된 수치를 거부한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.salt',[],[{op:'replace',target:'WaterSafety.Human',path:'/sources/sea/salinity',value:-1},{op:'replace',target:'WaterSafety.Human',path:'/saltFlushMlPerGram',value:-1},{op:'replace',target:'WaterSafety.Human',path:'/maxDrinkingSalinity',value:-1}])]);for(const key of ['sources.sea.salinity','saltFlushMlPerGram','maxDrinkingSalinity'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('은퇴의 생활비/거처·나이 구간/할인과 실제 시민 신체·종 참조를 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.retirement',[],[{op:'replace',target:'Retirement.Hearth',path:'/dailyLivingCost',value:0},{op:'replace',target:'Retirement.Hearth',path:'/minHousingDays',value:3650},{op:'replace',target:'Retirement.Hearth',path:'/youngAge',value:80},{op:'replace',target:'Retirement.Hearth',path:'/disabilityFactor',value:2},{op:'replace',target:'Retirement.Hearth',path:'/disabilityParts',value:['NoLimb']},{op:'replace',target:'Retirement.Hearth',path:'/resident',value:'Creature.Missing'}])]);for(const key of ['dailyLivingCost','은퇴 기간/나이','disabilityFactor','신체 참조','Creature.Missing'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('여러 생애를 복제하는 무제한 유산·잘못된 문턱/빈 신체 배열은 거부한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.retirement.bounds',[],[{op:'replace',target:'Retirement.Hearth',path:'/maxLegacy',value:100},{op:'replace',target:'Retirement.Hearth',path:'/friendly',value:101},{op:'replace',target:'Retirement.Hearth',path:'/disabilityParts',value:[]}])]);for(const key of ['maxLegacy','friendly','disabilityParts'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('공개 증거의 실제 세력/책·현물/성향과 시간·확률 참조를 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.evidence',[],[{op:'replace',target:'Evidence.Calvis',path:'/sourceFaction',value:'absent'},{op:'replace',target:'Evidence.Calvis',path:'/books',value:['Item.Cloth']},{op:'replace',target:'Evidence.Calvis',path:'/hold',value:['Item.Missing']},{op:'replace',target:'Evidence.Calvis',path:'/radius',value:99},{op:'replace',target:'Evidence.Calvis',path:'/reformChance',value:101},{op:'add',target:'Evidence.Calvis',path:'/traitChance/Trait.Missing',value:102},{op:'replace',target:'Faction.guardReform',path:'/unlock',value:'unknown'}])]);for(const key of ['세력/unlock','books','Item.Missing','radius','reformChance','Trait.Missing','traitChance','unlock'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('공개 증거의 빈/잘못된 배열과 성향 확률 사전 모양을 거부한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.evidence.shape',[],[{op:'replace',target:'Evidence.Calvis',path:'/books',value:'Item.CalvisJournal'},{op:'replace',target:'Evidence.Calvis',path:'/hold',value:[]},{op:'replace',target:'Evidence.Calvis',path:'/traitChance',value:[]}])]);for(const key of ['books 배열','hold 배열','traitChance 사전'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('첨탑의 실제 증표/선행 설비/전력과 장기 기후 설정 오류를 거부한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.spire',[],[{op:'replace',target:'FieldDevice.SpireConsole',path:'/operations/1/hold',value:['Item.Missing']},{op:'replace',target:'FieldDevice.SpireConsole',path:'/operations/0/devices/0/operation',value:'missing'},{op:'replace',target:'FieldDevice.SpireConsole',path:'/operations/1/energyCost',value:-1},{op:'replace',target:'FieldDevice.SpireConsole',path:'/operations/0/outdoorsCalm',value:'yes'},{op:'replace',target:'Climate.Hearth',path:'/towerStop/radiusKm',value:0},{op:'replace',target:'Climate.Hearth',path:'/towerStop/soilCollapseYears',value:0},{op:'replace',target:'Climate.Hearth',path:'/towerStop/soilCommodities',value:['Missing']},{op:'replace',target:'Climate.Hearth',path:'/towerStop/hostileFaction',value:'missing'}])]);for(const key of ['Item.Missing','devices','energyCost','outdoorsCalm','radiusKm','soilCollapseYears','soilCommodities','hostileFaction'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('설비 사이의 선행 작업 순환과 소모 부품으로 겹친 증표를 거부한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.spire.cycle',[],[{op:'add',target:'FieldDevice.ReceiverConduit',path:'/operations/0/devices',value:[{map:'chimney-roof',def:'FieldDevice.SpireConsole',operation:'repair'}]},{op:'add',target:'FieldDevice.SpireConsole',path:'/operations/0/hold',value:['Item.LowPowerCell']}])]);expect(report.errors.some(e=>e.includes('설비 사이 선행 작업 순환'))).toBe(true);expect(report.errors.some(e=>e.includes('소모 부품'))).toBe(true)})
  it('증표와 선행 설비는 실제 배열이어야 하며 잘못된 모드가 로더를 중단하지 않는다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.spire.shape',[],[{op:'replace',target:'FieldDevice.SpireConsole',path:'/operations/1/hold',value:'Item.CorporateCodePlate'},{op:'replace',target:'FieldDevice.SpireConsole',path:'/operations/0/devices',value:'FieldDevice.ReceiverConduit'}])]);expect(report.errors.some(e=>e.includes('hold 배열'))).toBe(true);expect(report.errors.some(e=>e.includes('devices 배열'))).toBe(true)})
  it('금고의 봉인/목격 규칙·소음·지형 연결과 실제 정착지 주민 표시를 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.vault.rules',[],[{op:'replace',target:'FieldDevice.ZeroVaultSeal',path:'/operations/0/noise/intervalTurns',value:0},{op:'replace',target:'FieldDevice.ZeroVaultSeal',path:'/operations/0/crime/faction',value:'absent'},{op:'replace',target:'FieldDevice.ZeroVaultSeal',path:'/operations/0/crime/delta',value:1},{op:'replace',target:'FieldDevice.ZeroVaultSeal',path:'/operations/0/effect/tiles/0/pos',value:[999,10]},{op:'replace',target:'FieldDevice.ZeroVaultSeal',path:'/operations/0/effect/tiles/0/to',value:'Terrain.Missing'},{op:'add',target:'Terrain.ZeroVaultSealedDoor',path:'/door',value:'open'},{op:'replace',target:'Terrain.ZeroVaultChest',path:'/lootCrime/faction',value:'missing'},{op:'replace',target:'RegionLayout.ZeroVault',path:'/spawns/0/settlementResident',value:'yes'}])]);for(const key of ['noise.intervalTurns','crime.faction','crime.delta','effect.tiles.pos','Terrain.Missing','sealed','lootCrime','settlementResident'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('설비가 같은 지형 칸을 두 번 바꾸는 정의를 거부한다',()=>{const tile={pos:[16,10],from:'Terrain.ZeroVaultSealedDoor',to:'Terrain.ZeroVaultDoorOpen'},{report}=loadMods([...readPackages(),pkg('bad.vault.tiles',[],[{op:'replace',target:'FieldDevice.ZeroVaultSeal',path:'/operations/0/effect/tiles',value:[tile,tile]}])]);expect(report.errors.some(e=>e.includes('effect.tiles.pos 중복'))).toBe(true)})
  it('연결 계단의 실제 목적 지도/도착 좌표와 하위 지도 이름을 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.vault.links',[],[{op:'replace',target:'RegionLayout.PostThreeService',path:'/links/0/to',value:'missing-map'},{op:'replace',target:'RegionLayout.ZeroVault',path:'/links/0/at',value:[999,999]},{op:'replace',target:'RegionLayout.PostThreeService',path:'/submaps/0/mapId',value:'wrong-map'}])]);for(const key of ['link.to','link.at','submap.mapId'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('실제 설비의 물품/책/도구/탑 참조·작업/물 수량·광원 좌표를 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.fielddevice',[],[{op:'replace',target:'FieldDevice.TowerSensor',path:'/operations/0/turns',value:0},{op:'replace',target:'FieldDevice.TowerSensor',path:'/operations/0/materials/0/item',value:'Item.Missing'},{op:'replace',target:'FieldDevice.TowerSensor',path:'/operations/0/waterMl',value:-1},{op:'replace',target:'FieldDevice.TowerSensor',path:'/operations/0/books',value:['Item.Cloth']},{op:'replace',target:'FieldDevice.TowerSensor',path:'/operations/0/effect/towerOutput/tower',value:'Region.Missing'},{op:'replace',target:'FieldDevice.ReceiverConduit',path:'/operations/0/tool',value:'unknown-tool'},{op:'replace',target:'Terrain.TowerSensor',path:'/device',value:'FieldDevice.Missing'},{op:'replace',target:'RegionLayout.ChimneyService',path:'/lights/0/pos',value:[999,999]}])]);for(const key of ['turns','Item.Missing','waterMl','books','Region.Missing','tool','FieldDevice.Missing','light'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('설비 작업 선행 조건의 누락/자기 참조와 순환을 거부한다',()=>{for(const requires of [['clean'],['missing']]){const{report}=loadMods([...readPackages(),pkg('bad.devicecycle',[],[{op:'replace',target:'FieldDevice.TowerSensor',path:'/operations/0/requires',value:requires}])]);expect(report.errors.some(e=>e.includes('requires'))).toBe(true)}})
  it('친족 관계의 실제 종/마을·증인 지연·신뢰/빛 수치의 참조와 범위를 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.kinship',[],[{op:'replace',target:'Kinship.Shadefolk',path:'/underground',value:['Creature.Missing']},{op:'replace',target:'Kinship.Shadefolk',path:'/sites',value:['Region.Missing']},{op:'replace',target:'Kinship.Shadefolk',path:'/faction',value:'absent'},{op:'replace',target:'Kinship.Shadefolk',path:'/delayDays',value:0},{op:'replace',target:'Kinship.Shadefolk',path:'/torchLoss',value:1},{op:'replace',target:'Kinship.Shadefolk',path:'/trust',value:101}])]);for(const key of ['Creature.Missing','Region.Missing','chiefs','faction','delayDays','torchLoss','trust'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('후속 지역 배치/실제 지도 좌표·부품 참조·잠금 연결을 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.regionlayout',[],[{op:'replace',target:'Region.ShadeGrove',path:'/extension/biome',value:'Biome.Missing'},{op:'replace',target:'RegionLayout.Blackwood',path:'/width',value:2},{op:'replace',target:'RegionLayout.SeedVault',path:'/objects/0/pos',value:[100,100]},{op:'replace',target:'Terrain.SeedVaultDoor',path:'/keyItem',value:'Item.Missing'},{op:'replace',target:'Faction.shadefolk',path:'/healer',value:'Creature.Missing'},{op:'replace',target:'Terrain.BlackwoodTree',path:'/visual/scale',value:0}])]);for(const key of ['Biome.Missing','width','지도 좌표','Item.Missing','Creature.Missing','visual'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})

  it('기계형의 실제 부위/현물 부품과 열·누출·오류 루프 설정을 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.machine',[],[{op:'replace',target:'Body.Mechanical',path:'/mechanical/core',value:'missing'},{op:'replace',target:'Body.Mechanical',path:'/mechanical/coolantMl',value:0},{op:'replace',target:'Body.Mechanical',path:'/mechanical/patch/item',value:'Item.Missing'},{op:'replace',target:'Body.Mechanical',path:'/mechanical/shutdownChance',value:2},{op:'replace',target:'Body.Mechanical',path:'/mechanical/errorLoop/turns',value:0},{op:'replace',target:'Body.Mechanical',path:'/mechanical/salvage/0/count',value:0}])]);for(const key of ['core','coolantMl','Item.Missing','shutdownChance','errorLoop.turns','salvage.count'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})

  it('원재료 단위와 조각·회수 참조·실제 재질 슬롯의 질량 범위를 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.materialcraft',[],[{op:'replace',target:'Item.IronIngot',path:'/rawMaterial/grams',value:0},{op:'replace',target:'Item.Wood',path:'/rawMaterial/material',value:'Material.Absent'},{op:'replace',target:'Material.Steel',path:'/recoveryItem',value:'Item.Cloth'},{op:'replace',target:'MaterialCrafting.Hearth',path:'/fragment',value:'Item.Wood'},{op:'replace',target:'Recipe.CustomKnife',path:'/materialInputs/0/slot',value:'missing'},{op:'replace',target:'Recipe.CustomMail',path:'/materialInputs/0/grams',value:-1},{op:'replace',target:'Recipe.CustomShirt',path:'/materialInputs/0/accepts',value:['Metal']}])]);for(const key of ['rawMaterial','Material.Absent','recoveryItem','fragment','슬롯','grams','accepts'])expect(report.errors.some(e=>e.includes(key)),key).toBe(true)})
  it('장비 노출의 정산 간격·건조율·불 거리와 실제 신체 참조를 검증한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.gearweather',[],[{op:'replace',target:'GearWeather.Hearth',path:'/intervalTurns',value:0},{op:'replace',target:'GearWeather.Hearth',path:'/dryPerTen',value:-1},{op:'replace',target:'GearWeather.Hearth',path:'/fireDryPerTen',value:NaN},{op:'replace',target:'GearWeather.Hearth',path:'/fireRadius',value:7},{op:'replace',target:'GearWeather.Hearth',path:'/looseBody',value:'Body.Absent'}])]);for(const key of ['intervalTurns','dryPerTen','fireDryPerTen','fireRadius','Body.Absent'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)})
  it('안감과 안감 칸은 실제 몸 의복의 boolean 설정이어야 한다',()=>{const{report}=loadMods([...readPackages(),pkg('bad.lining',[],[{op:'replace',target:'Item.RagShirt',path:'/slot',value:'head'},{op:'replace',target:'Item.ScrapMail',path:'/apparel/liningHost',value:'yes'}])]);expect(report.errors.some((e)=>e.includes('liner'))).toBe(true);expect(report.errors.some((e)=>e.includes('liningHost'))).toBe(true)})
  it('침구 접촉의 시간당 젖음 교환율은 유한한 비음수 설정이어야 한다',()=>{for(const value of [-1,NaN,11]){const{report}=loadMods([...readPackages(),pkg('bad.contact',[],[{op:'replace',target:'BeddingContact.Hearth',path:'/exchangePerHour',value}])]);expect(report.errors.some((e)=>e.includes('exchangePerHour'))).toBe(true)}})
  it('실제 불의 꾸러미/연료·점화 노동/젖음 배율과 연료 목표 범위를 검증한다',()=>{
   const{report}=loadMods([...readPackages(),pkg('bad.fire',[],[
    {op:'replace',target:'Campfire.Hearth',path:'/kit',value:'Item.Wood'},
    {op:'replace',target:'Campfire.Hearth',path:'/fuel',value:'Item.Absent'},
    {op:'replace',target:'Campfire.Hearth',path:'/fuelTurns',value:0},
    {op:'replace',target:'Campfire.Hearth',path:'/igniteTurns',value:0},
    {op:'replace',target:'Campfire.Hearth',path:'/wetMultiplier',value:0},
    {op:'replace',target:'Campfire.Hearth',path:'/workerTarget',value:100000},
   ])]);for(const key of ['kit','Item.Absent','fuelTurns','igniteTurns','wetMultiplier','workerTarget'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })
  it('침구 배정 시간·식사/물/보온/수면 부족 한도와 실제 병 용량 일관성을 검증한다',()=>{
   const {report}=loadMods([...readPackages(),pkg('bad.baserest',[],[
    {op:'replace',target:'BaseRest.Hearth',path:'/assignTurns',value:0},
    {op:'replace',target:'BaseRest.Hearth',path:'/prepareKcal',value:-1},
    {op:'replace',target:'BaseRest.Hearth',path:'/prepareWater',value:1001},
    {op:'replace',target:'BaseRest.Hearth',path:'/warmBelow',value:34},
    {op:'replace',target:'BaseRest.Hearth',path:'/debtAt',value:0},
    {op:'replace',target:'Item.DirtyWaterBottle',path:'/uses',value:3},
   ])]);for(const key of ['assignTurns','prepareKcal','prepareWater','warmBelow','debtAt','물병 급수 전후 용량'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })
  it('거점 식수 목표의 단위/재 한도·실제 능동 정수 방식을 검증한다',()=>{
   const{report}=loadMods([...readPackages(),pkg('bad.basewater',[],[
    {op:'replace',target:'BaseWater.Hearth',path:'/unitMl',value:0},
    {op:'replace',target:'BaseWater.Hearth',path:'/maxAsh',value:-1},
    {op:'replace',target:'BaseWater.Hearth',path:'/methods',value:['settle','settle']},
   ])]);for(const key of ['unitMl','maxAsh','methods'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })

  it('거점 운반 시간과 작업자 식량 신선도 한도를 검증한다',()=>{
   const{report}=loadMods([...readPackages(),pkg('bad.logistics',[],[
    {op:'replace',target:'BaseLogistics.Hearth',path:'/pickupTurns',value:0},
    {op:'replace',target:'BaseLogistics.Hearth',path:'/minFreshness',value:101},
   ])]);for(const key of ['pickupTurns','minFreshness'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })

  it('실제 거점 습격의 세력/준비 시간·확률/병력·운반 한도를 검증한다',()=>{
   const{report}=loadMods([...readPackages(),pkg('bad.defense',[],[
    {op:'replace',target:'BaseDefense.Hearth',path:'/faction',value:'missing'},
    {op:'replace',target:'BaseDefense.Hearth',path:'/sourceWaypoint',value:''},
    {op:'replace',target:'BaseDefense.Hearth',path:'/firstDelayTurns',value:0},
    {op:'replace',target:'BaseDefense.Hearth',path:'/planningTurns',value:NaN},
    {op:'replace',target:'BaseDefense.Hearth',path:'/chance',value:2},
    {op:'replace',target:'BaseDefense.Hearth',path:'/minMembers',value:4},
    {op:'replace',target:'BaseDefense.Hearth',path:'/maxMembers',value:2},
    {op:'replace',target:'BaseDefense.Hearth',path:'/lootStacks',value:0},
   ])]);for(const key of ['faction','sourceWaypoint','firstDelayTurns','planningTurns','chance','병력 범위','lootStacks'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })

  it('거점은 실제 빈 저장고와 유효한 정비/범위/작업 횟수를 요구한다',()=>{
   const{report}=loadMods([...readPackages(),pkg('bad.base',[],[
    {op:'replace',target:'BaseCamp.Hearth',path:'/storeTerrain',value:'Terrain.Chest'},
    {op:'replace',target:'BaseCamp.Hearth',path:'/claimTurns',value:NaN},
    {op:'replace',target:'BaseCamp.Hearth',path:'/radius',value:13},
    {op:'replace',target:'BaseCamp.Hearth',path:'/maxBatches',value:0},
   ])]);for(const key of ['빈 저장고','claimTurns','radius','maxBatches'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })

  it('현지 포로 관리의 제작법/역할·급식 임계를 검증한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.custody',[],[
      {op:'replace',target:'NpcCustody.Hearth',path:'/ropeRecipe',value:'Recipe.NotFound'},
      {op:'replace',target:'NpcCustody.Hearth',path:'/roles',value:['guard','guard']},
      {op:'replace',target:'NpcCustody.Hearth',path:'/careBelowKcal',value:-1},
      {op:'replace',target:'NpcCustody.Hearth',path:'/drinkAbove',value:0},
      {op:'replace',target:'NpcCustody.Hearth',path:'/minFreshness',value:NaN},
    ])]);for(const key of ['Recipe.NotFound','roles','careBelowKcal','drinkAbove','minFreshness'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
    const other=loadMods([...readPackages(),pkg('bad.custody.output',[],[{op:'replace',target:'NpcCustody.Hearth',path:'/ropeRecipe',value:'Recipe.Bandage'}])]);expect(other.report.errors.some((e)=>e.includes('실제 밧줄'))).toBe(true)
  })

  it('구조 보호/휴식 시간과 실제 관계 보상 범위를 검증한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.rescue',[],[
      {op:'replace',target:'Rescue.Hearth',path:'/mercyTurns',value:0},
      {op:'replace',target:'Rescue.Hearth',path:'/restTurns',value:NaN},
      {op:'replace',target:'Rescue.Hearth',path:'/bond',value:100},
    ])]);for(const key of ['mercyTurns','restTurns','bond'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })
  it('포로 대화의 실제 시간/다른 날짜·급식·불안·시험 기간 범위를 검증한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.recruitment',[],[
      {op:'replace',target:'Recruitment.Hearth',path:'/conversationTurns',value:0},
      {op:'replace',target:'Recruitment.Hearth',path:'/days',value:0},
      {op:'replace',target:'Recruitment.Hearth',path:'/careKcal',value:NaN},
      {op:'replace',target:'Recruitment.Hearth',path:'/careWater',value:0},
      {op:'replace',target:'Recruitment.Hearth',path:'/minMorale',value:-1},
      {op:'replace',target:'Recruitment.Hearth',path:'/probationDays',value:0},
    ])]);for(const key of ['conversationTurns','days','careKcal','careWater','minMorale','probationDays'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })
  it('포로 호송의 실제 준비/재포박 시간과 밧줄 거리 범위를 검증한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.escort',[],[
      {op:'replace',target:'PrisonerEscort.Hearth',path:'/escortTurns',value:0},
      {op:'replace',target:'PrisonerEscort.Hearth',path:'/holdTurns',value:NaN},
      {op:'replace',target:'PrisonerEscort.Hearth',path:'/leashRadius',value:10},
    ])]);for(const key of ['escortTurns','holdTurns','leashRadius'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })
  it('포로 돌봄의 수면 순서·감시 거리·작업 시간·탈출 확률과 밧줄 마모 범위를 검증한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.prisoner-care',[],[
      {op:'replace',target:'PrisonerCare.Hearth',path:'/wakeAt',value:90},
      {op:'replace',target:'PrisonerCare.Hearth',path:'/guardRadius',value:0},
      {op:'replace',target:'PrisonerCare.Hearth',path:'/struggleTurns',value:0},
      {op:'replace',target:'PrisonerCare.Hearth',path:'/escapeChance',value:2},
      {op:'replace',target:'PrisonerCare.Hearth',path:'/ropeWear',value:0},
    ])])
    for(const key of ['수면 임계','guardRadius','struggleTurns','escapeChance','ropeWear'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
    const bad=loadMods([...readPackages(),pkg('bad.prisoner-finite',[],[{op:'replace',target:'PrisonerCare.Hearth',path:'/escapeChance',value:null}])]);expect(bad.report.errors.some((e)=>e.includes('escapeChance'))).toBe(true)
  })
  it('항복 처리의 실제 밧줄 참조·행동 시간/평판·소문 오차 범위를 검증한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.prisoner',[],[
      {op:'replace',target:'Prisoner.Hearth',path:'/rope',value:'Item.NoRope'},
      {op:'replace',target:'Prisoner.Hearth',path:'/bindTurns',value:0},
      {op:'replace',target:'Prisoner.Hearth',path:'/releaseReputation',value:100},
      {op:'replace',target:'Prisoner.Hearth',path:'/exaggerationChance',value:2},
      {op:'replace',target:'Prisoner.Hearth',path:'/rumorLow',value:2},
    ])])
    for(const key of ['Item.NoRope','bindTurns','releaseReputation','exaggerationChance','rumorLow'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })
  it('동료 관계 범위/종료와 성향 참조/충돌 데이터의 오류를 거부한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.bond',[],[
      {op:'replace',target:'CompanionBond.Hearth',path:'/initial',value:-30},
      {op:'replace',target:'CompanionBond.Hearth',path:'/periodTurns',value:0},
      {op:'replace',target:'CompanionBond.Hearth',path:'/personalities',value:['Trait.Missing','Trait.Missing']},
      {op:'replace',target:'CompanionBond.Hearth',path:'/conflicts',value:[{a:'Trait.Pious',b:'Trait.Pious',delta:1}]},
    ])])
    for(const key of ['종료 임계','periodTurns','personalities','Trait.Missing','conflicts'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })
  it('동료 고용의 현금/거리/수면 임계와 상한을 검증한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.companion',[],[
      {op:'replace',target:'Companion.Hearth',path:'/hireFee',value:0},
      {op:'replace',target:'Companion.Hearth',path:'/dailyWage',value:-1},
      {op:'replace',target:'Companion.Hearth',path:'/maxMembers',value:0},
      {op:'replace',target:'Companion.Hearth',path:'/followDistance',value:4},
      {op:'replace',target:'Companion.Hearth',path:'/joinRadius',value:1},
      {op:'replace',target:'Companion.Hearth',path:'/wakeAt',value:90},
    ])])
    for(const key of ['hireFee','dailyWage','maxMembers','동행 거리/수면'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })
  it('저체온 혼란의 온도/의식·간격/확률과 외투 칸을 검증한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.cold',[],[
      {op:'replace',target:'ColdConfusion.Human',path:'/temperature',value:20},
      {op:'replace',target:'ColdConfusion.Human',path:'/consciousness',value:2},
      {op:'replace',target:'ColdConfusion.Human',path:'/intervalTurns',value:0},
      {op:'replace',target:'ColdConfusion.Human',path:'/chance',value:2},
      {op:'replace',target:'ColdConfusion.Human',path:'/slots',value:['head','back','back']},
    ])])
    for(const key of ['temperature','consciousness','intervalTurns','chance','slots'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })

  it('세력 관계의 일일 복귀량·없는 사건 및 관계/기저 범위를 거부한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.faction-relations',[],[
      {op:'replace',target:'FactionRelations.Hearth',path:'/returnPerDay',value:-1},
      {op:'replace',target:'FactionRelations.Hearth',path:'/events/raid/delta',value:-101},
      {op:'replace',target:'FactionRelations.Hearth',path:'/events/grudge/baseline',value:-101},
      {op:'remove',target:'FactionRelations.Hearth',path:'/events/release'},
    ])])
    for(const key of ['returnPerDay','raid.delta','grudge.baseline','events.release'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })

  it('현장 조사 계약의 기간/보수/거리·위협/부 배율 범위를 거부한다',()=>{
    const{report}=loadMods([...readPackages(),pkg('bad.investigation',[],[
      {op:'replace',target:'Investigation.Hearth',path:'/refreshDays',value:0},
      {op:'replace',target:'Investigation.Hearth',path:'/deadlineBufferDays',value:-1},
      {op:'replace',target:'Investigation.Hearth',path:'/distanceReward',value:-1},
      {op:'replace',target:'Investigation.Hearth',path:'/threatPerDepth',value:-1},
      {op:'replace',target:'Investigation.Hearth',path:'/wealthMult',value:2},
    ])])
    for(const key of ['refreshDays','deadlineBufferDays','distanceReward','threatPerDepth','wealthMult'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })

  it('조달 계약의 없는/비적합 물품과 수량/기간/보수/중복 키를 거부한다',()=>{
    const {report}=loadMods([...readPackages(),pkg('bad.contracts',[],[
      {op:'replace',target:'SupplyContract.Hearth',path:'/refreshDays',value:0},
      {op:'replace',target:'SupplyContract.Hearth',path:'/baseReward',value:-1},
      {op:'replace',target:'SupplyContract.Hearth',path:'/wealthMult',value:2},
      {op:'replace',target:'SupplyContract.Hearth',path:'/requests',value:[{key:'same',label:'오류',item:'Item.Absent',count:0,threat:-1},{key:'same',label:'물병',item:'Item.WaterBottle',count:1,threat:0}]},
    ])])
    for(const key of ['refreshDays','baseReward','wealthMult','Item.Absent','requests.count','requests.threat','중복','물품'])expect(report.errors.some((e)=>e.includes(key))).toBe(true)
  })

  it('침구 이동의 없는/휴대 물품·잘못된 바닥·시간/반경을 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.bedding-move', [], [
      { op: 'replace', target: 'BeddingMove.Hearth', path: '/items', value: ['Item.Bedroll','Item.Absent'] },
      { op: 'replace', target: 'BeddingMove.Hearth', path: '/defaultFloor', value: 'Terrain.ShallowWater' },
      { op: 'replace', target: 'BeddingMove.Hearth', path: '/packTurns', value: 0 },
      { op: 'replace', target: 'BeddingMove.Hearth', path: '/approachRadius', value: 1 },
    ])])
    for (const field of ['items','Item.Absent','defaultFloor','packTurns','approachRadius']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('주민 보온의 없는 화덕·온도 순서/시간 및 수면 준비 범위를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.warmth', [], [
      { op: 'replace', target: 'ResidentWarmth.Hearth', path: '/fireTerrain', value: 'Terrain.Absent' },
      { op: 'replace', target: 'ResidentWarmth.Hearth', path: '/target', value: 35 },
      { op: 'replace', target: 'ResidentWarmth.Hearth', path: '/turns', value: 0 },
      { op: 'replace', target: 'NpcRest.Hearth', path: '/prepareKcal', value: -1 },
      { op: 'replace', target: 'NpcRest.Hearth', path: '/prepareWaterDeficit', value: -1 },
    ])])
    for (const field of ['Terrain.Absent','target','turns','prepareKcal','prepareWaterDeficit']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('교사의 잘못된 날짜·시간/비용·문해·없는 과정 참조를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.teacher', [], [
      { op: 'replace', target: 'Teacher.Hearth', path: '/days', value: 0 },
      { op: 'replace', target: 'Teacher.Hearth', path: '/lessonTurns', value: -1 },
      { op: 'replace', target: 'Teacher.Hearth', path: '/fee', value: -1 },
      { op: 'replace', target: 'Teacher.Hearth', path: '/literacyMin', value: 4 },
      { op: 'replace', target: 'Creature.SettlementTrader', path: '/teacher', value: 'Teacher.Absent' },
      { op: 'replace', target: 'Creature.SettlementTrader', path: '/literacy', value: 9 },
    ])])
    for (const field of ['days','lessonTurns','fee','literacyMin','Teacher.Absent','literacy']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('주민 정수의 없는 화덕·수량·한도·재시도 및 연료 대응 오류를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.purification', [], [
      { op: 'replace', target: 'ResidentPurification.Hearth', path: '/fireTerrain', value: 'Terrain.Absent' },
      { op: 'replace', target: 'ResidentPurification.Hearth', path: '/fuelTarget', value: 0 },
      { op: 'replace', target: 'ResidentPurification.Hearth', path: '/dailyFuelUnits', value: .1 },
      { op: 'replace', target: 'ResidentPurification.Hearth', path: '/retryTurns', value: 0 },
    ])])
    for (const field of ['Terrain.Absent','fuelTarget','하루 한도','retryTurns']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('주민 급수의 없는 수원/지형·재시도·손 씻기 정책 오류를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.water-resident', [], [
      { op: 'replace', target: 'ResidentWater.Hearth', path: '/terrain', value: 'Terrain.Earth' },
      { op: 'replace', target: 'ResidentWater.Hearth', path: '/retryTurns', value: 0 },
      { op: 'replace', target: 'ResidentWater.Hearth', path: '/handWash', value: 'always' },
    ])])
    for (const field of ['terrain','retryTurns','handWash']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('주민 배급의 잘못된 음식/창고·음수 한도·수량 순서를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.provision', [], [
      { op: 'replace', target: 'ResidentProvision.Hearth', path: '/food', value: 'Item.Thread' },
      { op: 'replace', target: 'ResidentProvision.Hearth', path: '/terrain', value: 'Terrain.Earth' },
      { op: 'replace', target: 'ResidentProvision.Hearth', path: '/dailyFoodUnits', value: -1 },
      { op: 'replace', target: 'ResidentProvision.Hearth', path: '/minimumKcal', value: 2000 },
    ])])
    for (const field of ['food','terrain','dailyFoodUnits','minimumKcal']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('주민 휴식의 휴대 침구·깨는 문턱/취침 문턱 순서·재시도 범위를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.rest', [], [
      { op: 'replace', target: 'NpcRest.Hearth', path: '/terrain', value: 'Terrain.Bedroll' },
      { op: 'replace', target: 'NpcRest.Hearth', path: '/wakeAt', value: 90 },
      { op: 'replace', target: 'NpcRest.Hearth', path: '/retryTurns', value: 0 },
    ])])
    for (const field of ['terrain','wakeAt','retryTurns']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('손 위생의 음수 물·0턴·보정 방향 오류를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.hands', [], [
      { op: 'replace', target: 'HandHygiene.Human', path: '/waterMl', value: -1 },
      { op: 'replace', target: 'HandHygiene.Human', path: '/washTurns', value: 0 },
      { op: 'replace', target: 'HandHygiene.Human', path: '/dirtyPenalty', value: 5 },
    ])])
    for (const field of ['waterMl','washTurns','dirtyPenalty']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('여관의 잘못된 침구·비용·침대 수·기한·참조를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.inn', [], [
      { op: 'replace', target: 'Inn.Hearth', path: '/terrain', value: 'Terrain.Earth' },
      { op: 'replace', target: 'Inn.Hearth', path: '/fee', value: -1 },
      { op: 'replace', target: 'Inn.Hearth', path: '/beds', value: 0 },
      { op: 'replace', target: 'Inn.Hearth', path: '/leaseTurns', value: 0 },
      { op: 'replace', target: 'Creature.SettlementTrader', path: '/inn', value: 'Inn.Absent' },
    ])])
    for (const field of ['terrain','fee','beds','leaseTurns','Inn.Absent']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('코어 콘텐츠는 오류 없이 로드된다', () => {
    const { report } = loadMods(readPackages())
    expect(report.errors).toEqual([])
  })
  it('진료 모드의 음수 비용·빈 물품·없는 의사/특성을 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.clinic', [], [
      { op: 'replace', target: 'Clinic.Hearth', path: '/fees/suture', value: -1 },
      { op: 'replace', target: 'Clinic.Hearth', path: '/doctor', value: 'Creature.Absent' },
      { op: 'replace', target: 'Clinic.Hearth', path: '/supplies', value: [{ item: 'Item.Absent', count: 0 }] },
      { op: 'replace', target: 'Creature.SettlementDoctor', path: '/clinic', value: 'Clinic.Absent' },
      { op: 'replace', target: 'Creature.SettlementDoctor', path: '/traits', value: ['Trait.Absent'] },
    ])])
    for (const field of ['fees.suture', 'Creature.Absent', 'Item.Absent', 'supplies.count', 'Clinic.Absent', 'Trait.Absent']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('진찰 모드의 누락된 요금·검사시간·숙달·품질·기록한도를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.examination', [], [
      { op: 'remove', target: 'Clinic.Hearth', path: '/fees/diagnose' },
      { op: 'replace', target: 'Clinic.Hearth', path: '/examination/turns', value: 0 },
      { op: 'replace', target: 'Clinic.Hearth', path: '/examination/pulseMastery', value: 6 },
      { op: 'replace', target: 'Clinic.Hearth', path: '/examination/quality', value: 101 },
      { op: 'replace', target: 'Clinic.Hearth', path: '/examination/reportLimit', value: 0 },
    ])])
    for (const field of ['fees.diagnose', 'examination.turns', 'examination.pulseMastery', 'examination.quality', 'examination.reportLimit']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('처방 모드의 음식/미확인정제·음수비용·과한숙달·중복약·잘못된 감정을 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.prescriptions', [], [
      { op: 'replace', target: 'Clinic.Hearth', path: '/doseTurns', value: 0 },
      { op: 'replace', target: 'Clinic.Hearth', path: '/prescriptions', value: [
        { item: 'Item.Hardtack', mastery: 0, fee: 1 }, { item: 'Item.PillWhite', mastery: 1, fee: 1 },
        { item: 'Item.PoppyTincture', mastery: 6, fee: -1 }, { item: 'Item.PoppyTincture', mastery: 2 },
      ] },
      { op: 'replace', target: 'Clinic.Hearth', path: '/supplies', value: [{ item: 'Item.PurificationAmpoule', count: 1, appraisal: 3 }] },
    ])])
    for (const field of ['doseTurns', 'Item.Hardtack', 'Item.PillWhite', 'prescriptions.mastery', 'prescriptions.fee', 'prescriptions.item 중복', 'supplies.appraisal']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('재보급의 재시도시간/수량 구간/가격/대체 물품 참조를 검증한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.clinic-supply', [], [
      { op: 'replace', target: 'Clinic.Hearth', path: '/restock', value: { retryTurns: 0, targets: [{ item: 'Item.Bandage', minimum: 6, target: 5, maxPrice: -1, equivalents: ['Item.Absent'] }] } },
    ])])
    for (const field of ['restock.retryTurns', 'minimum/target', 'restock.maxPrice', 'Item.Absent']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('재보급을 정의하지 않은 구형 Clinic 모드도 기존 진료 계약으로 읽는다', () => {
    const { report } = loadMods([...readPackages(), pkg('legacy.clinic', [], [{ op: 'remove', target: 'Clinic.Hearth', path: '/restock' }])])
    expect(report.errors).toEqual([])
  })
  it('도감 모드의 잘못된 종·수율·범위·도구·문헌 참조를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.bestiary', [], [
      { op: 'replace', target: 'Bestiary.Human', path: '/failedYield', value: 2 },
      { op: 'replace', target: 'Bestiary.Human', path: '/dissectTurns', value: 0 },
      { op: 'replace', target: 'Bestiary.Human', path: '/toolBonus', value: [0] },
      { op: 'replace', target: 'BestiaryEntry.Hound', path: '/creatures', value: ['Creature.Absent'] },
      { op: 'replace', target: 'BestiaryEntry.Rat', path: '/yields', value: [{ item: 'Item.Absent', count: 0 }] },
      { op: 'replace', target: 'Item.HighlandBestiary', path: '/book/bestiary', value: ['BestiaryEntry.Absent'] },
    ])])
    for (const field of ['failedYield', 'dissectTurns', 'toolBonus', 'Creature.Absent', 'Item.Absent', 'yields.count', 'BestiaryEntry.Absent']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('지식 모드의 뒤집힌 확률·시음량·책 참조·문해를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.knowledge', [], [
      { op: 'replace', target: 'Knowledge.Human', path: '/minChance', value: 99 },
      { op: 'replace', target: 'Knowledge.Human', path: '/tasteFraction', value: 0 },
      { op: 'replace', target: 'Knowledge.Human', path: '/examineTurns', value: 0 },
      { op: 'replace', target: 'Pill.Sedative', path: '/identifyDifficulty', value: -1 },
      { op: 'replace', target: 'Pill.Sedative', path: '/drug', value: 'Drug.BitterMoss' },
      { op: 'replace', target: 'Item.PioneerPharmacopoeia', path: '/book/identify', value: ['Pill.Absent'] },
      { op: 'replace', target: 'Item.PioneerDictionary', path: '/book/literacyMin', value: 4 },
    ])])
    for (const field of ['확률 구간', 'tasteFraction', 'examineTurns', 'identifyDifficulty', '외용약', 'Pill.Absent', 'book.literacyMin']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('약물 모드의 잘못된 참조·계열·확률·외용 시간·금단 간격을 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.drugs', [], [
      { op: 'replace', target: 'Drug.PoppyTincture', path: '/family', value: 'absent' },
      { op: 'replace', target: 'Drug.PoppyTincture', path: '/addiction', value: 2 },
      { op: 'replace', target: 'Drug.BitterMoss', path: '/applyTurns', value: 0 },
      { op: 'replace', target: 'Pharmacology.Human', path: '/families/alcohol/withdrawalTurns', value: 0 },
      { op: 'replace', target: 'Pharmacology.Human', path: '/overdoseFaintChance', value: 2 },
      { op: 'replace', target: 'Item.Painkiller', path: '/drug/def', value: 'Drug.Absent' },
    ])])
    for (const field of ['약물 계열', 'addiction', 'applyTurns', 'alcohol.withdrawalTurns', 'overdoseFaintChance', 'Drug.Absent']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('제작 모드의 잘못된 재료·시간·회수량을 오류로 보고한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.craft', [], [
      { op: 'replace', target: 'Recipe.Bandage', path: '/workTurns', value: 0 },
      { op: 'add', target: 'Recipe.Bandage', path: '/passiveTurns', value: -1 },
      { op: 'replace', target: 'Recipe.Bandage', path: '/inputs', value: [{ item: 'Item.Missing', count: 0 }] },
      { op: 'replace', target: 'Item.RustyKnife', path: '/repair/unitsPer10', value: 0 },
      { op: 'replace', target: 'Terrain.Tree', path: '/gather/regrowTurns', value: 0 },
    ])])
    for (const field of ['workTurns', 'passiveTurns', 'Item.Missing', 'inputs.count', 'repair.unitsPer10', 'gather.regrowTurns']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('정신 모드의 감쇠·중첩·트라우마 점수·변환 참조 오류를 보고한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.psyche', [], [
      { op: 'add', target: 'Thought.NearDeath', path: '/stackMult', value: 2 },
      { op: 'replace', target: 'Thought.NearDeath', path: '/steps', value: [{ afterTurns: -1, mult: 1 }] },
      { op: 'replace', target: 'Trauma.Species', path: '/overcome/flee', value: 10 },
      { op: 'replace', target: 'Trauma.Species', path: '/positive/trait', value: 'Trait.Missing' },
    ])])
    for (const field of ['stackMult', 'steps.afterTurns', 'overcome.flee', 'Trait.Missing']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('생성 모드의 합이 다른 보정·범위를 벗어난 능력치·달력을 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.growth', [], [
      { op: 'replace', target: 'Bg.Hunter', path: '/stats', value: { per: 3 } },
      { op: 'replace', target: 'Growth.Human', path: '/yearDays', value: 0 },
      { op: 'replace', target: 'Growth.Human', path: '/ageBands/0/masteryMult', value: 0 },
    ])])
    for (const field of ['stats.per', '보정 합', 'yearDays', 'masteryMult']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('배경/장전 모드의 잘못된 면역·흉터·시작 품질·지도·장전 시간을 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.background', [], [
      { op: 'replace', target: 'Bg.FeverOrphan', path: '/immuneDiseases', value: ['Disease.Missing'] },
      { op: 'replace', target: 'Bg.EscapedSlave', path: '/startScars', value: [{ part: 'Absent', severity: 0, source: '검증' }] },
      { op: 'replace', target: 'Bg.GuildMerchant', path: '/startQuality', value: { 'Item.PaddedJacket': 6 } },
      { op: 'replace', target: 'Bg.GuardArchivist', path: '/startingMap', value: 'Item.RustyKnife' },
      { op: 'replace', target: 'Item.LightCrossbow', path: '/ranged/reloadTurns', value: 0 },
    ])])
    for (const field of ['Disease.Missing', '시작 흉터', 'startScars.severity', 'startQuality', '시작 지도', 'ranged.reloadTurns']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('영양 모드는 잘못된 소모·위험 확률·중복 구간·사고 참조를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.nutrition', [], [
      { op: 'replace', target: 'Nutrition.Human', path: '/activity/combat', value: 0 },
      { op: 'replace', target: 'Nutrition.Human', path: '/starvationRisk', value: 2 },
      { op: 'replace', target: 'Nutrition.Human', path: '/hunger/1/deficit', value: 0 },
      { op: 'replace', target: 'Nutrition.Human', path: '/thirst/1/thought', value: 'Thought.Missing' },
    ])])
    for (const field of ['activity.combat', 'starvationRisk', '구간은 중복 없이', 'Thought.Missing']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('식품 모드는 뒤집힌 시간·온도·신선도 구간과 잘못된 위험을 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.food', [], [
      { op: 'replace', target: 'FoodSafety.Human', path: '/poisonHours', value: [36, 12] },
      { op: 'replace', target: 'FoodSafety.Human', path: '/temperature', value: [{ max: 5, mult: 1 }, { max: 0, mult: 0 }] },
      { op: 'replace', target: 'FoodSafety.Human', path: '/spoiledAt', value: 70 },
      { op: 'replace', target: 'FoodSafety.Human', path: '/liceRisk', value: 2 },
      { op: 'replace', target: 'Item.RawMeat', path: '/food/freshHours', value: 0 },
    ])])
    for (const field of ['poisonHours', 'temperature', 'freshness', 'liceRisk', 'food.freshHours']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('물 모드는 잘못된 오염·도구·노출 단위·질병 참조를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.water', [], [
      { op: 'replace', target: 'WaterSafety.Human', path: '/exposureMl', value: 0 },
      { op: 'replace', target: 'WaterSafety.Human', path: '/sources/stream/pathogen', value: 101 },
      { op: 'replace', target: 'WaterSafety.Human', path: '/treatments/boil/turns', value: 0 },
      { op: 'replace', target: 'WaterSafety.Human', path: '/treatments/cloth/tool', value: 'Item.Absent' },
      { op: 'replace', target: 'WaterSafety.Human', path: '/disease', value: 'Disease.Absent' },
    ])])
    for (const field of ['exposureMl', 'sources.stream.pathogen', 'treatments.boil.turns', 'Item.Absent', 'Disease.Absent']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('의수족 모드는 잘못된 부위·효율·전원셀·짝 아이템 참조를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.prosthetic', [], [
      { op: 'replace', target: 'Prosthetic.PegLeg', path: '/targets', value: ['MissingLeg'] },
      { op: 'replace', target: 'Prosthetic.PegLeg', path: '/efficiency', value: 2 },
      { op: 'replace', target: 'Prosthetic.PioneerArm', path: '/powerItem', value: 'Item.Absent' },
      { op: 'replace', target: 'Item.GlassEye', path: '/prosthetic', value: 'Prosthetic.PegLeg' },
    ])])
    for (const field of ['targets', 'efficiency', 'Item.Absent', 'prosthetic 참조']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('반복 외상 모드는 잘못된 간격·의식 상한·획득 확률·특성 참조를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.head', [], [
      { op: 'replace', target: 'Recovery.Wounds', path: '/concussionEvery', value: 0 },
      { op: 'replace', target: 'Recovery.Wounds', path: '/concussionCap', value: 2 },
      { op: 'replace', target: 'Recovery.Wounds', path: '/forgetfulChance', value: 2 },
      { op: 'replace', target: 'Recovery.Wounds', path: '/forgetfulTrait', value: 'Trait.Absent' },
    ])])
    for (const field of ['concussionEvery', 'concussionCap', 'forgetfulChance', 'Trait.Absent']) expect(report.errors.some((e) => e.includes(field))).toBe(true)
  })
  it('월드 모드의 범위·좌표 중복·경로 비용·거주자 참조를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.world', [], [
      { op: 'replace', target: 'WorldGen.Hearth', path: '/width', value: 1000 },
      { op: 'replace', target: 'Biome.Greymoor', path: '/worldTravelMult', value: 0 },
      { op: 'replace', target: 'Region.ChimneySeven', path: '/cell', value: [24, 76] },
      { op: 'replace', target: 'Region.BlackMouth', path: '/guards', value: [{ def: 'Creature.Absent', count: 1 }] },
    ])])
    for (const word of ['width', 'worldTravelMult', '좌표 중복', 'Creature.Absent']) expect(report.errors.some((e) => e.includes(word))).toBe(true)
  })
  it('기후 모드의 계절·날씨 키·가중치·시각 오류를 로드 단계에서 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.climate', [], [
      { op:'replace',target:'Season.Winter',path:'/lengthDays',value:0 },
      { op:'replace',target:'Weather.Ashgale',path:'/weather',value:'ashrain' },
      { op:'replace',target:'Weather.Ashrain',path:'/scentMult',value:2 },
      { op:'replace',target:'Climate.Hearth',path:'/diurnal',value:[[14,4],[5,-4]] },
      { op:'remove',target:'Climate.Hearth',path:'/weatherRows/snow' },
    ])])
    for(const word of ['lengthDays','날씨 키 중복','scentMult','일교차','그룹 snow']) expect(report.errors.some((e)=>e.includes(word))).toBe(true)
  })
  it('세력·가격 모드의 잘못된 참조·평판 구간·매입/판매·재고 수량을 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.society', [], [
      { op: 'add', target: 'Faction.guild', path: '/relations/phantom', value: 101 },
      { op: 'replace', target: 'Faction.guild', path: '/trader', value: 'Stock.Missing' },
      { op: 'replace', target: 'Diplomacy.Hearth', path: '/bands/1/min', value: -100 },
      { op: 'replace', target: 'Economy.Hearth', path: '/buyMult', value: 9 },
      { op: 'replace', target: 'Stock.guild', path: '/entries/0/target', value: 0 },
      { op: 'replace', target: 'Bg.GuildMerchant', path: '/startMoney', value: -1 },
    ])])
    for (const id of ['Faction.guild', 'Diplomacy.Hearth', 'Economy.Hearth', 'Stock.guild', 'Bg.GuildMerchant']) expect(report.errors.some((e) => e.includes(id))).toBe(true)
  })
  it('월드 인구 모드의 전파 계수·단위·세력 저장고 오류를 거부한다', () => {
    const { report } = loadMods([...readPackages(), pkg('bad.population', [], [
      { op: 'replace', target: 'Disease.GreyFever', path: '/population/gamma', value: 1000 },
      { op: 'replace', target: 'WorldSimulation.Hearth', path: '/items/Item.Bandage/units', value: 0 },
      { op: 'replace', target: 'WorldSimulation.Hearth', path: '/disease/travelMult', value: 2 },
      { op: 'add', target: 'WorldSimulation.Hearth', path: '/factionStock/phantom', value: { Food: -1 } },
    ])])
    for (const id of ['Disease.GreyFever', 'WorldSimulation.Hearth']) expect(report.errors.some((e) => e.includes(id))).toBe(true)
  })
  it('샘플 모드: 패치가 상속 전에 적용되어 자식에게 전파된다', () => {
    const { db, report } = loadMods(readPackages(), ['sample.grim'])
    expect(report.errors).toEqual([])
    expect(db.wound('Wound.Cut').bleedPerSeverity).toBe(2.3)
    expect(db.item('Item.SawMachete').weight).toBe(db.item('Item.Machete').weight) // 상속
    expect(db.loot('Loot.Chest').entries.some((e) => e.item === 'Item.SawMachete')).toBe(true)
  })
  it('상속: 부모 필드 병합, abstract 제외', () => {
    const { db } = loadMods([pkg('core', [
      { defType: 'Skill', id: 'A', abstract: true, label: 'a', description: 'base' },
      { defType: 'Skill', id: 'B', parent: 'A', label: 'b' },
    ])])
    expect(db.has('A')).toBe(false)
    expect(db.get('B').description).toBe('base')
  })
  it('순환 상속·없는 의존성은 오류로 보고', () => {
    const { report } = loadMods([
      pkg('core', [{ defType: 'Skill', id: 'A', parent: 'B', label: 'a' }, { defType: 'Skill', id: 'B', parent: 'A', label: 'b' }]),
      pkg('m', [], [], { dependencies: ['nope'] }),
    ], ['m'])
    expect(report.errors.some((e) => e.includes('순환 상속'))).toBe(true)
    expect(report.errors.some((e) => e.includes('nope'))).toBe(true)
  })
  it('패치 연산 add/replace/remove/merge', () => {
    const d: Record<string, unknown> = { a: { b: [1, 2] }, c: 1 }
    expect(applyPatch(d, { op: 'add', target: 'x', path: '/a/b/-', value: 3 })).toBeNull()
    expect(applyPatch(d, { op: 'replace', target: 'x', path: '/c', value: 9 })).toBeNull()
    expect(applyPatch(d, { op: 'merge', target: 'x', path: '/a', value: { z: true } })).toBeNull()
    expect(applyPatch(d, { op: 'remove', target: 'x', path: '/a/b/0' })).toBeNull()
    expect(d).toEqual({ a: { b: [2, 3], z: true }, c: 9 })
    expect(applyPatch(d, { op: 'replace', target: 'x', path: '/nope', value: 1 })).not.toBeNull()
  })
  it('ifModLoaded 조건부 패치', () => {
    const { db } = loadMods([
      pkg('core', [{ defType: 'Skill', id: 'S', label: 'x' }]),
      pkg('m', [], [{ op: 'replace', target: 'S', path: '/label', value: 'y', ifModLoaded: 'other' }]),
    ], ['m'])
    expect(db.get('S').label).toBe('x')
  })
})
