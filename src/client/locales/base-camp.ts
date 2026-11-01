import{baseOrderLabel,baseOrderProblem}from'../../core/base-camp'
import{baseCraftStock}from'../../core/base-camp-state'
import{campfireAt,fireTurnsLeft}from'../../core/campfire'
import{findItem,itemDef}from'../../core/items'
import type{World}from'../../core/ctx'
import type{BaseTask,Creature,ItemDef,RecipeDef}from'../../core/types'
import{translate,type Language}from'./message'
import{translateDef}from'./content'
import{translateCraftingIssue}from'./crafting'

/** A task's Def ID is not item-instance appraisal knowledge. */
const itemName=(def:ItemDef,language:Language,identified=false)=>def.relic&&!identified?def.unknownLabel?translateDef(def,'unknownLabel',language):translate('미확인 유물',language):translateDef(def,'label',language)
const recipeName=(w:World,id:string,language:Language)=>{const r=w.db.tryGet<RecipeDef>(id);return r?translateDef(r,'label',language):translate('사라진 제작법',language)}

/** Current structured task fields only; labels are presentation, never action payloads. */
export function displayBaseTaskSummary(w:World,task:BaseTask|undefined,language:Language):string{
 if(task?.kind==='guard')return translate('거점 방어',language)
 if(task?.kind==='fire')return translate('실제 모닥불 관리',language)
 if(task?.recipe)return translate(task.craftTarget!==undefined?'{0} 최소{1}개 유지':'{0} {1}회 남음',language,recipeName(w,task.recipe,language),task.craftTarget??task.remaining)
 if(task?.kind==='water')return translate('식수 {0}ml 보충 남음',language,task.remaining)
 if(task?.item){const d=w.db.tryGet<ItemDef>(task.item),name=d?itemName(d,language):translate('사라진 물품',language);return translate(task.kind==='haul'?'{0} {1}개 운반 남음':'{0} {1}개 채집 남음',language,name,task.remaining)}
 return translate('배정 없음',language)
}

/** Guard the original Core sentence so future or foreign formats remain literal. */
export function translateBaseOrderLabel(w:World,task:BaseTask,language:Language):string{
 const source=baseOrderLabel(w,task)
 if(language!=='en')return source
 if(task.kind==='craft'){
  const r=task.recipe&&w.db.tryGet<RecipeDef>(task.recipe),name=r?r.label:'사라진 제작법',amount=task.craftTarget??task.remaining
  const expected=name+' · '+(task.craftTarget!==undefined?'최소'+amount+'개 유지':amount+'회')
  if(source===expected)return translate(task.craftTarget!==undefined?'{0} · 최소{1}개 유지':'{0} · {1}회',language,r?translateDef(r,'label',language):translate(name,language),amount)
 }
 if(task.kind==='water'&&source===`식수 ${task.waterTarget??0}ml 유지`)return translate('식수 {0}ml 유지',language,task.waterTarget??0)
 if(task.kind==='haul'||task.kind==='gather'){
  const d=task.item&&w.db.tryGet<ItemDef>(task.item),name=d?d.label:'사라진 물품',amount=task.targetStock??0
  if(source===`${name} · ${amount}개 ${task.kind==='haul'?'운반':'채집'}`)return translate(task.kind==='haul'?'{0} · {1}개 운반':'{0} · {1}개 채집',language,d?itemName(d,language):translate(name,language),amount)
 }
 return translate(source,language)
}

/** Only actual task/progress/stock/heat and matching Core source can supply numbers. */
export function translateBaseTaskStatus(w:World,c:Creature,source:string,language:Language):string{
 if(language!=='en')return source
 const task=w.s.map.baseCamp?.tasks[c.id]
 if(!task)return translate(source,language)
 if(baseOrderProblem(w,task))return translate(source,language)
 if((task.kind==='haul'||task.kind==='gather')&&task.item){const d=w.db.tryGet<ItemDef>(task.item);if(d?.defType==='Item'&&source===`${d.label} 목표${task.targetStock}개까지 ${task.remaining}개가 더 필요하다`)return translate('{0} 목표{1}개까지 {2}개가 더 필요하다',language,itemName(d,language),task.targetStock??0,task.remaining)}
 if(task.kind==='water'&&source===`병원체 없는 식수 목표${task.waterTarget}ml까지 ${task.remaining}ml가 더 필요하다. 물병·수원·정수 도구/연료를 확인하자.`)return translate('병원체 없는 식수 목표{0}ml까지 {1}ml가 더 필요하다. 물병·수원·정수 도구/연료를 확인하자.',language,task.waterTarget??0,task.remaining)
 if(task.kind==='fire'){
  if(c.activity?.kind==='fire'&&source===`실제 불 관리 ${c.activity.remaining}턴 남음`)return translate('실제 불 관리 {0}턴 남음',language,c.activity.remaining)
  const fire=task.firePos&&campfireAt(w,task.firePos)
  if(fire&&fire.uid===task.fireUid){const minutes=Math.floor(fireTurnsLeft(w,task.firePos!)/20);if(source===`연료 약${minutes}분 남음`)return translate('연료 약{0}분 남음',language,minutes)}
 }
 if(task.kind==='craft'){
  if(c.activity?.kind==='craft'&&source===`작업 중 ${c.workJob?.progress??0}/${c.workJob?.total??0}턴`)return translate('작업 중 {0}/{1}턴',language,c.workJob?.progress??0,c.workJob?.total??0)
  const stock=baseCraftStock(w,c)
  if(stock&&!stock.error&&source===`최소 재고${stock.target}개를 채웠다. 꺼내 쓰면 다시 생산한다`)return translate('최소 재고{0}개를 채웠다. 꺼내 쓰면 다시 생산한다',language,stock.target)
  const recipe=task.recipe&&w.db.tryGet<RecipeDef>(task.recipe)
  if(recipe){for(const row of recipe.inputs){const d=w.db.item(row.item);if(c.bag.filter(i=>i.def===d.id).reduce((n,i)=>n+i.count,0)<row.count&&source===d.label+' 재료를 기다린다')return translate('{0} 재료를 기다린다',language,itemName(d,language))}return translateCraftingIssue(source,recipe,language)}
 }
 return translate(source,language)
}

/** The UI already checks sight. Only the actual held UID's current swap label is formatted. */
export function translateBaseGearActivity(w:World,c:Creature,language:Language):string{
 const activity=c.activity
 if(activity?.kind!=='gearSwap')return activity?.label??''
 const incoming=activity.uid!==undefined?findItem(c,activity.uid):undefined
 if(incoming){const d=itemDef(w,incoming);if(activity.label===d.label+' 입기')return translate('{0} 입기',language,itemName(d,language,(incoming.appraisal??0)>=2))}
 return translate(activity.label,language)
}
