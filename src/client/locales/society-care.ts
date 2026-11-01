import type {FirstImpression} from '../../core/types'
import {translate,type Language,type MessageValue} from './message'
type MoneyDef={id:string;currency:string}
/** Exact configured denomination; foreign labels and values remain literal. */
export function displaySocietyMoney(def:MoneyDef,value:MessageValue,language:Language):string{
 if(def.id==='Economy.Hearth'){
  if(def.currency==='표')return translate('{0}표',language,value)
  if(def.currency==='전')return language==='en'&&value===1?translate('1전',language):translate('{0}전',language,value)
 }
 return String(value)+def.currency
}
const replies={wary:'처음 만났을 때 경계하는 기색을 보였다.',warm:'처음 만났을 때 반갑게 맞아 주었다.',neutral:'처음 만났을 때 담담하게 인사를 주고받았다.'}
const rumor=' 이곳에 전해진 당신의 소식을 이미 들은 눈치다.'
/** Only the actual heard memory and exact Core reply supply the presentation. */
export function displayFirstReply(source:string|undefined,memory:FirstImpression|undefined,language:Language):string{
 if(!source||!memory?.heard||!Object.hasOwn(replies,memory.attitude))return source??''
 const base=replies[memory.attitude],suffix=memory.terms.some(t=>t.kind==='rumor')?rumor:''
 return source===base+suffix?translate(base,language)+(suffix?translate(suffix,language):''):source
}

/** Uses only the relation value that was actually heard, never current world relations. */
export function displayHeardRelation(value:number,language:Language):string{
 const row=value>=50?['동맹','Allied']:value>=20?['우호','Friendly']:value>-20?['중립','Neutral']:value>-50?['경계','Wary']:['적대','Hostile']
 return row[language==='en'?1:0]
}
