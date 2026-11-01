/** Presentation only. Never translates names, mutates Defs or rewrites saved logs. */
import english from './en.json'
import itemDetails from './en-item-details.json'
import itemExtra from './en-item-extra.json'
import foodTraining from './en-food-training.json'
import cultivation from './en-cultivation.json'
import campCraft from './en-camp-craft.json'
import fieldCamp from './en-field-camp.json'
import fieldWork from './en-field-work.json'
import baseCamp from './en-base-camp.json'
import residentCamp from './en-resident-camp.json'

export type Language = 'ko' | 'en'
export type MessageValue = string | number
const messages: Readonly<Record<string, string>> = {...english,...itemDetails,...itemExtra,...foodTraining,...cultivation,...campCraft,...fieldCamp,...fieldWork,...residentCamp,...baseCamp}
const singularMessages:Readonly<Record<string,{index:number;message:string}>>={
  ' [{0}회]':{index:0,message:' [{0} use]'},
  '침구 사용 허락 ({0}턴)':{index:0,message:'Allow bedding use ({0} turn)'},
  '사용 허가 해제 ({0}턴)':{index:0,message:'Release bedding permission ({0} turn)'},
  '{0} {1}회 남음':{index:1,message:'{0} · {1} batch remaining'},
  '{0} · {1}회':{index:1,message:'{0} · {1} batch'}
}

export function translate(source: string, language: Language, ...values: MessageValue[]): string {
  const singular=language==='en'&&Object.hasOwn(singularMessages,source)?singularMessages[source]:undefined
  const message = singular&&values[singular.index]===1?singular.message:language === 'en' && Object.hasOwn(messages, source) ? messages[source] : source
  // Replace once: braces, HTML and dollar signs inside values remain literal data.
  return message.replace(/\{(\d+)\}/g, (token, index: string) => Object.hasOwn(values, index) ? String(values[Number(index)]) : token)
}
