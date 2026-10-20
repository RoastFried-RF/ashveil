import {stateActors} from './missing-statuses'
import {stateItemEntries} from './missing-items'
import type {GameState,ItemInst} from './types'

/** 저장 구조만 검사한다. 현재 Def의 격자 변경은 구성 검토에서 검사한다. */
export function storedItemStateError(s:GameState):string|null{
 for(const c of stateActors(s)){
  const preference=c.ammoPreference
  if(preference!==undefined&&(!preference||typeof preference!=='object'||typeof preference.def!=='string'||typeof preference.fletchingDamaged!=='boolean'))return '탄약 선택 기록이 올바르지 않다'
  if((c.hotbar??[]).some(ref=>ref?.kind==='item'&&ref.fletchingDamaged!==undefined&&typeof ref.fletchingDamaged!=='boolean'))return '빠른 슬롯의 탄약 상태 기록이 올바르지 않다'
  if(c.body.wounds.some(wd=>wd.foreign?.fletchingDamaged!==undefined&&(typeof wd.foreign.fletchingDamaged!=='boolean'||wd.foreign.kind!=='arrow')))return '박힌 화살의 깃 상태 기록이 올바르지 않다'
 }
 const entries=stateItemEntries(s),counts=new Map<number,number>()
 for(const{item}of entries)counts.set(item.uid,(counts.get(item.uid)??0)+1)
 for(const{item,path}of entries){
  if(item.powderWetness!==undefined&&(!Number.isFinite(item.powderWetness)||item.powderWetness<0||item.powderWetness>100)||item.firearmFouling!==undefined&&(!Number.isSafeInteger(item.firearmFouling)||item.firearmFouling<0||item.firearmFouling>100)||item.firearmJammed!==undefined&&typeof item.firearmJammed!=='boolean')return path+': 화약 젖음/총열 오염/걸림 기록이 올바르지 않다'
  if(item.loadedRound!==undefined){
   const round=item.loadedRound
   if(!round||typeof round!=='object'||item.count!==1||!round.ball||!round.powder||item.loadedAmmo!==round.ball.def)return path+': 장전된 두 실물 기록이 올바르지 않다'
   for(const child of [round.ball,round.powder])if(!Number.isSafeInteger(child.uid)||child.uid<=0||typeof child.def!=='string'||child.count!==1||child.contents!==undefined||child.loadedRound!==undefined||child.loadedCartridges!==undefined||counts.get(child.uid)!==1)return path+': 장전된 탄/화약의 UID/개수 기록이 올바르지 않다'
  }
  if(item.loadedCartridges!==undefined){
   const rounds=item.loadedCartridges
   if(!Array.isArray(rounds)||!rounds.length||rounds.length>20||item.count!==1||item.loadedRound!==undefined||item.loadedAmmo!==rounds[0]?.def)return path+': 탄창의 실제 실탄 기록이 올바르지 않다'
   for(const child of rounds)if(!child||typeof child!=='object'||!Number.isSafeInteger(child.uid)||child.uid<=0||typeof child.def!=='string'||child.count!==1||child.contents!==undefined||child.loadedRound!==undefined||child.loadedCartridges!==undefined||counts.get(child.uid)!==1)return path+': 탄창 실탄의 UID/개수 기록이 올바르지 않다'
  }
  if((item.fletchingDamaged!==undefined&&typeof item.fletchingDamaged!=='boolean')||(item.loadedAmmoFletching!==undefined&&typeof item.loadedAmmoFletching!=='boolean')||(item.loadedAmmoFletching&&!item.loadedAmmo))return path+': 탄약 깃 상태 기록이 올바르지 않다'
  if(item.contents===undefined)continue
  if(!Array.isArray(item.contents)||item.count!==1)return path+': 가방 내부 물품 기록이 올바르지 않다'
  for(const child of item.contents as ItemInst[]){
   if(!child||typeof child!=='object'||!Number.isSafeInteger(child.uid)||child.uid<=0||typeof child.def!=='string'||!Number.isSafeInteger(child.count)||child.count<=0||child.contents!==undefined||counts.get(child.uid)!==1)return path+': 내부 물품의 UID/개수 또는 가방 중첩 기록이 올바르지 않다'
   if(!Number.isSafeInteger(child.gx)||!Number.isSafeInteger(child.gy)||child.gx!<0||child.gy!<0)return path+': 내부 물품의 칸 배치 기록이 올바르지 않다'
  }
 }
 return null
}
