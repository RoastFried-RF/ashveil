import type{DefDatabase}from'./defs'
import type{GameState,ItemInst,ItemDef}from'./types'
export const MISSING_ITEM='Item.MissingPlaceholder'
type ItemEntry={item:ItemInst;path:string}
/** 실제 저장 구조의 인스턴스만 찾고 스크립트/지식/보고서/보관 스냅샷은 물품으로 세지 않는다. */
export function stateItemEntries(s:GameState):ItemEntry[]{
 const result:ItemEntry[]=[],seen=new WeakSet<object>()
 const walk=(value:unknown,path:string)=>{
  if(!value||typeof value!=='object'||seen.has(value))return
  seen.add(value)
  if(!Array.isArray(value)){
   const row=value as Record<string,unknown>
   if(Number.isSafeInteger(row.uid)&&typeof row.def==='string'&&Number.isSafeInteger(row.count)){result.push({item:value as ItemInst,path});walk(row.contents,path+'/contents');walk(row.loadedRound,path+'/loadedRound');walk(row.loadedCartridges,path+'/loadedCartridges');return}
  }
  for(const[key,entry]of Object.entries(value)){
   if(key==='inputs'&&path.endsWith('/processing'))continue
   if(!path&&['scriptState','contentMods','contentAdoptedAt','gameVersion','defSchemaVersion','contentDefinitions','contentItemShapes','contentRecipeContracts','contentChanges','log','knowledge','over'].includes(key))continue
   walk(entry,path+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1'))
  }
 }
 walk(s,'');return result
}
export const validRecordedItemShape=(v:unknown):v is {size:[number,number];maxStack:number;label:string;storage?:[number,number]}=>{
 if(!v||typeof v!=='object')return false
 const x=v as {size?:unknown;maxStack?:unknown;label?:unknown;storage?:unknown}
 return Array.isArray(x.size)&&x.size.length===2&&x.size.every(n=>Number.isSafeInteger(n)&&n>0&&n<=100)&&Number.isSafeInteger(x.maxStack)&&Number(x.maxStack)>0&&typeof x.label==='string'&&(x.storage===undefined||Array.isArray(x.storage)&&x.storage.length===2&&x.storage.every(n=>Number.isSafeInteger(n)&&n>0&&n<=20))
}
export function missingItemReferences(s:GameState,ids:Set<string>){
 const refs:string[]=[],seen=new WeakSet<object>(),entries=stateItemEntries(s),items=new Set(entries.map(e=>e.item as object)),uids=new Set(entries.filter(e=>ids.has(e.item.missingItem?.def??e.item.def)).map(e=>e.item.uid))
 const walk=(value:unknown,path:string)=>{
  if(!value||typeof value!=='object'||seen.has(value))return
  seen.add(value)
  for(const[key,entry]of Object.entries(value)){
   if(!path&&['scriptState','contentMods','contentAdoptedAt','gameVersion','defSchemaVersion','contentDefinitions','contentItemShapes','contentRecipeContracts','contentChanges','log','knowledge','over'].includes(key)||key==='missingItem')continue
   const next=path+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1')
   if(typeof entry==='string'&&ids.has(entry)&&!(items.has(value)&&key==='def')||typeof entry==='number'&&uids.has(entry)&&!items.has(value)&&(key==='uid'||key.endsWith('Uid')))refs.push(next)
   else walk(entry,next)
  }
 }
 walk(s,'');return refs
}
export function validMissingItemRecord(it:ItemInst):boolean{const record=it.missingItem;return!!record&&it.def===MISSING_ITEM&&validRecordedItemShape(record)&&!!record.original&&!record.original.missingItem&&record.original.def===record.def&&record.original.uid===it.uid&&record.original.count===it.count}
export function restoreMissingItem(it:ItemInst,def=it.missingItem!.def){const original=structuredClone(it.missingItem!.original),position={uid:it.uid,count:it.count,gx:it.gx,gy:it.gy,rot:it.rot,...(it.contents?{contents:it.contents}:{})};for(const key of Object.keys(it))delete(it as unknown as Record<string,unknown>)[key];Object.assign(it,original,position,{def})}
/** 기록된 크기 변경은 막고, 기록이 없으면 현재 실물 배치만 검사한다. 과거 용량/헤더는 채우지 않는다. */
function storageShapeChanged(s:GameState,it:ItemInst,current:ItemDef,db:DefDatabase):boolean{
 if(it.loadedCartridges){
  const rd=current.ranged,mag=rd?.magazine
  if(!rd?.firearm||!mag||it.loadedCartridges.length>mag.capacity||it.loadedCartridges.some(i=>![rd.ammo,...mag.alternatives].includes(i.missingItem?.def??i.def)))return true
 }
 if(!it.contents)return false
 const recorded=s.contentItemShapes?.[it.def]?.storage,size=current.storage??current.pocket??current.quiver?.size
 if(recorded!==undefined&&JSON.stringify(recorded)!==JSON.stringify(size))return true
 if(!it.contents.length)return false
 if(!size)return true
 const occupied=new Set<number>()
 for(const child of it.contents){
  const childDef=db.tryGet(child.def),shape=child.missingItem?.size??s.contentItemShapes?.[child.def]?.size??(childDef?.defType==='Item'?childDef.size:undefined)
  if(!shape||!Number.isSafeInteger(child.gx)||!Number.isSafeInteger(child.gy))return true
  const[width,height]=child.rot?[shape[1],shape[0]]:shape,x=child.gx!,y=child.gy!
  if(x<0||y<0||x+width>size[0]||y+height>size[1])return true
  for(let yy=y;yy<y+height;yy++)for(let xx=x;xx<x+width;xx++){const cell=yy*size[0]+xx;if(occupied.has(cell))return true;occupied.add(cell)}
 }
 return false
}
export function missingItemPlan(s:GameState,db:DefDatabase){
 const convert:ItemEntry[]=[],restore:ItemEntry[]=[],errors:string[]=[]
 for(const entry of stateItemEntries(s)){
  const it=entry.item,record=it.missingItem
  if(!Number.isSafeInteger(it.uid)||it.uid<=0||!Number.isSafeInteger(it.count)||it.count<=0){errors.push(entry.path+': 물품 UID/개수 기록이 올바르지 않다');continue}
  if(record){
   if(!validMissingItemRecord(it)){errors.push(entry.path+': 원래 물품 보관 기록이 올바르지 않다');continue}
   const original=db.tryGet(record.def)
   if(original&&original.defType!=='Item'){errors.push(entry.path+': 보관한 원래 물품 정의의 종류가 바뀌었다');continue}
   if(original?.defType==='Item'){
    if(original.size[0]!==record.size[0]||original.size[1]!==record.size[1])errors.push(entry.path+': 돌아온 정의의 칸 크기가 원래 기록과 다르다')
    else if(it.contents&&JSON.stringify(original.storage??original.pocket??original.quiver?.size)!==JSON.stringify(record.storage))errors.push(entry.path+': 돌아온 가방의 내부 격자 크기가 원래 기록과 다르다')
    else restore.push(entry)
   }
   if(!original&&(/\/body\/prosthetics\//.test(entry.path)||entry.path.endsWith('/vessel/hull')))errors.push(entry.path+': 설치된 의수족/선체는 원래 정의를 복원해야 한다')
   continue
  }
  if(it.def===MISSING_ITEM){errors.push(entry.path+': 원래 물품 기록 없는 보관물은 사용할 수 없다');continue}
  const current=db.tryGet(it.def)
  if(current?.defType==='Item'){if(storageShapeChanged(s,it,current,db))errors.push(entry.path+(it.loadedCartridges?': 기록된 탄창의 용량이나 탄약이 현재 정의와 다르거나 확인할 수 없다':': 기록된 가방의 내부 격자 크기가 현재 정의와 다르거나 확인할 수 없다'));continue}
  if(current){errors.push(entry.path+': 물품 정의의 종류가 바뀌었다');continue}
  const shapes=s.contentItemShapes,shape=shapes&&Object.hasOwn(shapes,it.def)?shapes[it.def]:undefined
  if(s.contentDefinitions?.[it.def]!=='Item'||!validRecordedItemShape(shape)){errors.push(entry.path+': 없어진 물품의 원래 칸 크기/정의 기록이 없다');continue}
  if(!db.has(MISSING_ITEM)){errors.push('현재 구성에 보관물 정의가 없다');continue}
  if(/\/body\/prosthetics\//.test(entry.path)||entry.path.endsWith('/vessel/hull')){errors.push(entry.path+': 설치된 의수족/선체는 원래 정의를 복원해야 한다');continue}
  convert.push(entry)
 }
 const ids=new Set([...convert.map(e=>e.item.def),...stateItemEntries(s).flatMap(e=>e.item.missingItem&&!db.has(e.item.missingItem.def)?[e.item.missingItem.def]:[])])
 errors.push(...missingItemReferences(s,ids).map(path=>path+': 물품 외 참조의 복구가 필요하다'))
 return{convert,restore,errors}
}
/** 승인된 후보 사본에서만 호출한다. UID/개수/배치/원래 상태/시간/난수는 새로 만들지 않는다. */
export function applyMissingItems(s:GameState,db:DefDatabase):string|null{
 const plan=missingItemPlan(s,db)
 if(plan.errors.length)return plan.errors.join('\n')
 for(const{item:it}of plan.convert){const def=it.def,shape=s.contentItemShapes![def],original=structuredClone(it);it.def=MISSING_ITEM;it.missingItem={def,size:[...shape.size],maxStack:shape.maxStack,label:shape.label,...(shape.storage?{storage:[...shape.storage]}:{}),original}}
 for(const{item:it}of plan.restore)restoreMissingItem(it)
 return null
}
