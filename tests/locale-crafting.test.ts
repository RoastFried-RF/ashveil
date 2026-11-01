import{describe,it,expect}from'vitest'
import{db}from'./helpers'
import{translateDef,translateRecipeMaterialSlot}from'../src/client/locales/content'
import{translateCraftingIssue}from'../src/client/locales/crafting'
import{translate}from'../src/client/locales/message'
import catalog from'../src/client/locales/en-camp-craft.json'
import type{RecipeDef}from'../src/core/types'

describe('reviewed crafting labels, issues and original-source boundaries',()=>{
 it('covers every compiled core recipe label and material slot without changing any Def',()=>{
  const recipes=db.all<RecipeDef>('Recipe'),before=JSON.stringify(recipes);expect(recipes.length).toBeGreaterThan(100)
  for(const recipe of recipes){expect(translateDef(recipe,'label','ko')).toBe(recipe.label);expect(translateDef(recipe,'label','en'),recipe.id).not.toMatch(/[가-힣]/)
   for(const slot of recipe.materialInputs??[]){expect(translateRecipeMaterialSlot(recipe.id,slot,'ko')).toBe(slot.label??slot.slot);expect(translateRecipeMaterialSlot(recipe.id,slot,'en'),recipe.id+'/'+slot.slot).not.toMatch(/[가-힣]/)}
  }expect(JSON.stringify(recipes)).toBe(before)
 })
 it('retains foreign recipes and edited labels even when their source resembles a reviewed recipe',()=>{
  const r=db.get<RecipeDef>('Recipe.CustomKnife');expect(translateDef({...r,id:'mod.foreign'},'label','en')).toBe(r.label);expect(translateDef({...r,label:r.label+' 변경'},'label','en')).toBe(r.label+' 변경')
  const slot=r.materialInputs![0];expect(translateRecipeMaterialSlot('mod.foreign',slot,'en')).toBe(slot.label);expect(translateRecipeMaterialSlot(r.id,{...slot,label:'모드의 새 재료 이름'},'en')).toBe('모드의 새 재료 이름')
 })
 it('translates only a matching recipe slot and numeric shortfall, preserving the actual amount',()=>{
  const r=db.get<RecipeDef>('Recipe.CustomKnife'),slot=r.materialInputs![0],error=(slot.label??slot.slot)+': 실제 원재료가 400g 부족하다'
  expect(translateCraftingIssue(error,r,'ko')).toBe(error);expect(translateCraftingIssue(error,r,'en')).toBe('Blade: 400 g of raw material still required')
  expect(translateCraftingIssue(error,undefined,'en')).toBe(error);expect(translateCraftingIssue((slot.label??slot.slot)+': 실제 원재료가 많은g 부족하다',r,'en')).toContain('많은g')
  expect(translateCraftingIssue('이름 없는 인물의 새 모드 판정',r,'en')).toBe('이름 없는 인물의 새 모드 판정')
 })
 it('preserves literal foreign material labels while translating the matched core issue template',()=>{
  const r=db.get<RecipeDef>('Recipe.CustomKnife'),slot={...r.materialInputs![0],label:'{0} 새 재료 $&'},changed={...r,materialInputs:[slot]}
  expect(translateCraftingIssue(slot.label+': 실제 원재료가 25g 부족하다',changed,'en')).toBe(slot.label+': 25 g of raw material still required')
 })
 it('formats only the actual recipe water volume and preserves an unrelated mismatch',()=>{
  const r=db.get<RecipeDef>('Recipe.Oatmeal'),ml=r.boiledMeal!.waterMl,error='원래 물병에 실제 물'+ml+'ml가 필요하다'
  expect(translateCraftingIssue(error,r,'en')).toBe('The original bottle needs '+ml+' ml of actual water');expect(translateCraftingIssue('원래 물병에 실제 물99999ml가 필요하다',r,'en')).toContain('99999ml가')
 })
 it('keeps each reviewed message placeholder and states permanent repair/salvage consequences',()=>{
  const parts=(s:string)=>[...s.matchAll(/\{\d+\}/g)].map(m=>m[0]).sort()
  for(const[source,target]of Object.entries(catalog)){expect(target.trim(),source).not.toBe('');expect(parts(target),source).toEqual(parts(source))}
  const warning=translate('수리마다 최대 내구가 영구 감소한다. 현장 수리는 최대의 60%까지만 회복한다. 분해하면 물건은 사라진다.','en');expect(warning).toMatch(/permanently/);expect(warning).toContain('60%');expect(warning).toContain('Salvaging destroys the item')
 })
})
