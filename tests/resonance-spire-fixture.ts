import {playerAct,resonanceState,serialize} from '../src/core'
import {spireFixture} from './spire-fixture'

/** 실제 Core로 관로/첨탑 수리와 송신까지 준비한 유한 초기 장면. */
export function resonanceSpireFixture(){
 const d=spireFixture(),{w,p,device,pos}=d
 p.traits=['Trait.ResonantHearing']
 const birth=w.s.log.find(e=>e.text.startsWith('당신은 ')&&e.text.includes('특성:'))
 if(birth)birth.text=`당신은 ${p.name}, ${w.db.background(p.background!).label}. 특성: ${p.traits.map(id=>w.db.trait(id).label).join(', ')}.`
 const prepared=[]
 for(const operation of ['repair','transmit']){
  const before=w.s.time,error=playerAct(w,{type:'deviceWork',pos,uid:device.uid,operation},300000)
  if(error||!device.completed.includes(operation))throw Error('유한 초기 첨탑 작업 실패: '+operation+'/'+error)
  prepared.push({operation,tu:w.s.time-before})
 }
 if(!resonanceState(w,p).tower)throw Error('원래 가동 중인 탑의 고음이 없는 장면')
 const proof={declaredInitial:true,seed:w.s.seed,playerId:p.id,trait:[...p.traits],map:w.s.map.id,worldCell:w.s.map.worldCell,originalDeviceUid:device.uid,originalPlateUid:d.plate.uid,prepared,energy:device.energy,completed:[...device.completed],initialBytes:serialize(w.s).length,limits:'Existing finite spire fixture and original objects; real Core repair/transmit before Title load. Native test must perform the120-turn stop command itself. No postload body/time/RNG/state edits.'}
 return{...d,proof}
}
