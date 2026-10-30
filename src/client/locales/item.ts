/** Matches the core's public item name, using only the viewer's existing beliefs. */
import {itemDef,itemLabel,pillBelief,rawStock,type ItemDef,type ItemInst,type World} from '../../core'
import {preferences} from '../preferences'
import {defText,t} from '../locale'

/** No instance means no appraisal knowledge; never expose a relic's identified name. */
export function displayItemDefLabel(def:ItemDef):string {
  return def.relic?(def.unknownLabel?defText(def,'unknownLabel'):t('미확인 유물')):defText(def)
}

export function displayItemLabel(w:World,it:ItemInst):string {
  if(preferences.language==='ko'||it.missingItem)return itemLabel(w,it)
  const def=itemDef(w,it)
  let label=def.relic&&(it.appraisal??0)<2
    ? def.unknownLabel?defText(def,'unknownLabel'):t('미확인 유물')
    :defText(def)
  const raw=def.rawFragment&&(!def.relic||(it.appraisal??0)>=2)&&rawStock(w,it)
  if(raw)label=t('{0} 조각',defText(raw.material))
  if(def.drink&&!def.drink.alcohol&&(it.uses??1)>0&&(it.water?.salinity??def.drink.quality?.salinity??0)>0)label+=t(' (소금물)')
  if(def.unidentified){
    const belief=pillBelief(w,it.def)
    label+=belief?.belief?t(' ({0}{1})',defText(w.db.pill(belief.belief)),belief.confidence==='likely'?t(' 추정'):''):t(' (미확인)')
  }
  if(it.pillRemaining!==undefined)label+=t(' [{0}/4정]',Math.round(it.pillRemaining*4))
  if(def.rawFragment)label+=` [${it.rawGrams??0}g]`
  if(it.toxin)label+=t(' (마비독)')
  if(it.fletchingDamaged)label+=t(' (깃 손상)')
  if(it.count>1)label+=` ×${it.count}`
  if(it.uses!==undefined)label+=it.uses===1?t(' [1회]'):t(' [{0}회]',it.uses)
  if(def.light&&it.lit)label+=t(' (켜짐)')
  return label
}
