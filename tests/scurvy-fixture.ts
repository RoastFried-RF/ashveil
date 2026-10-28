import {addWound} from '../src/core/body'
import {completeHealing} from '../src/core/recovery'
import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
export function scurvyFixture(){
 const d=clinicalDiseaseFixture('actual-old-scurvy-scars')
 const originalWounds=[]
 for(const [part,source]of[['LeftForearm','옛 칼상처'],['RightShin','옛 낙상'],['Chest','옛 파편상']]){
  const result=addWound(d.w,d.p,{def:'Wound.Cut',part,severity:3,source})
  result.wound.scar=true;result.wound.healed=result.wound.severity;d.p.hp-=result.damage;originalWounds.push(result.wound.id);completeHealing(d.w,d.p)
 }
 if(d.p.body.scars?.length!==3||d.p.body.wounds.length)throw Error('actual original healed scars')
 return{...d,originalWounds}
}
