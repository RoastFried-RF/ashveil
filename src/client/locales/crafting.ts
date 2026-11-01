import type{RecipeDef}from'../../core/types'
import{translate,type Language}from'./message'
import{translateRecipeMaterialSlot}from'./content'

/** Core issue templates only; dynamic material labels keep the Def/slot/source guard. */
export function translateCraftingIssue(error:string|null|undefined,recipe:Pick<RecipeDef,'id'|'materialInputs'|'boiledMeal'>|undefined,language:Language):string{
 if(!error)return''
 if(language!=='en')return error
 for(const slot of recipe?.materialInputs??[]){
  const source=slot.label??slot.slot,label=translateRecipeMaterialSlot(recipe!.id,slot,language)
  if(error===source+': 고른 실제 원재료와 질량을 다시 확인해야 한다')return translate('{0}: 고른 실제 원재료와 질량을 다시 확인해야 한다',language,label)
  const prefix=source+': 실제 원재료가 ',suffix='g 부족하다'
  if(error.startsWith(prefix)&&error.endsWith(suffix)){const amount=error.slice(prefix.length,-suffix.length);if(/^\d+$/.test(amount))return translate('{0}: 실제 원재료가 {1}g 부족하다',language,label,amount)}
 }
 const ml=recipe?.boiledMeal?.waterMl
 if(ml!==undefined&&error==='원래 물병에 실제 물'+ml+'ml가 필요하다')return translate('원래 물병에 실제 물{0}ml가 필요하다',language,ml)
 return translate(error,language)
}
