import {stateItemEntries} from './missing-items'
import type {GameState,ItemInst} from './types'

/** 저장 구조만 검사한다. 현재 Def의 격자 변경은 구성 검토에서 검사한다. */
export function storedItemStateError(s:GameState):string|null{
 const entries=stateItemEntries(s),counts=new Map<number,number>()
 for(const{item}of entries)counts.set(item.uid,(counts.get(item.uid)??0)+1)
 for(const{item,path}of entries){
  if(item.contents===undefined)continue
  if(!Array.isArray(item.contents)||item.count!==1)return path+': 가방 내부 물품 기록이 올바르지 않다'
  for(const child of item.contents as ItemInst[]){
   if(!child||typeof child!=='object'||!Number.isSafeInteger(child.uid)||child.uid<=0||typeof child.def!=='string'||!Number.isSafeInteger(child.count)||child.count<=0||child.contents!==undefined||counts.get(child.uid)!==1)return path+': 내부 물품의 UID/개수 또는 가방 중첩 기록이 올바르지 않다'
   if(!Number.isSafeInteger(child.gx)||!Number.isSafeInteger(child.gy)||child.gx!<0||child.gy!<0)return path+': 내부 물품의 칸 배치 기록이 올바르지 않다'
  }
 }
 return null
}
