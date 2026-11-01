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
import expeditionRecords from './en-expedition-records.json'
import societyCare from './en-society-care.json'
import clinicalCare from './en-clinical-care.json'

export type Language = 'ko' | 'en'
export type MessageValue = string | number
const messages: Readonly<Record<string, string>> = {...english,...itemDetails,...itemExtra,...foodTraining,...cultivation,...campCraft,...fieldCamp,...fieldWork,...residentCamp,...baseCamp,...expeditionRecords,...societyCare,...clinicalCare}
const singularMessages:Readonly<Record<string,{index:number;message:string}>>={
  ' [{0}회]':{index:0,message:' [{0} use]'},
  '침구 사용 허락 ({0}턴)':{index:0,message:'Allow bedding use ({0} turn)'},
  '사용 허가 해제 ({0}턴)':{index:0,message:'Release bedding permission ({0} turn)'},
  '{0} {1}회 남음':{index:1,message:'{0} · {1} batch remaining'},
  '{0} · {1}회':{index:1,message:'{0} · {1} batch'},
  "{0}분":{index:0,message:"{0} minute"},
  "{0}턴":{index:0,message:"{0} turn"},
  "{0}개":{index:0,message:"{0} item"},
  "{0}회분":{index:0,message:"{0} dose"},
  "{0} · 재고 {1}회분":{index:1,message:"{0} · {1} dose in stock"},
  "{0} · {1}회분 · 1회 투약 확인":{index:1,message:"{0} · {1} dose · Review 1 dose"},
  "붕대 재료 {0}회분":{index:0,message:"Bandaging supplies: {0} dose"},
  "규격 1회분 · 지속 {0}분":{index:0,message:"1 standard dose · Lasts {0} minute"},
  "예상 Q {0} · {1}턴":{index:1,message:"Estimated Q {0} · {1} turn"},
  "{0} · {1} · 대기 포함 약 {2}턴 · {3}":{index:2,message:"{0} · {1} · About {2} turn including waiting · {3}"},
  "{0} · {1} · 대기 포함 약{2}턴{3}":{index:2,message:"{0} · {1} · About {2} turn including waiting{3}"},
  "다음 {0} · {1} · {2}턴 뒤":{index:2,message:"Next: {0} · {1} · In {2} turn"},
  "약 {0}턴 · 출혈과 시간은 계속 흐른다. 실제 처치 품질과 약효는 매 단계의 상태를 따른다.":{index:0,message:"About {0} turn. Bleeding and time continue. Actual quality and drug effects depend on conditions at each step."}
}

export function translate(source: string, language: Language, ...values: MessageValue[]): string {
  const singular=language==='en'&&Object.hasOwn(singularMessages,source)?singularMessages[source]:undefined
  const message = singular&&values[singular.index]===1?singular.message:language === 'en' && Object.hasOwn(messages, source) ? messages[source] : source
  // Replace once: braces, HTML and dollar signs inside values remain literal data.
  return message.replace(/\{(\d+)\}/g, (token, index: string) => Object.hasOwn(values, index) ? String(values[Number(index)]) : token)
}
