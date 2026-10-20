import { fieldDeviceFixture } from './field-devices-fixture'
import { fieldDeviceAt } from '../src/core/field-devices'
import { addToBag, makeItem } from '../src/core/items'
import { studyBook } from '../src/core/skills'
import { playerAct } from '../src/core/game'
import { updatePlayerVision } from '../src/core/fov'
export function spireFixture(ground=true){
 const d=fieldDeviceFixture(),{w,p,s}=d
 p.pos={x:34,y:17};updatePlayerVision(w,p)
 const conduit=fieldDeviceAt(w,d.receiver)!
 if(ground){const error=playerAct(w,{type:'deviceWork',pos:d.receiver,uid:conduit.uid,operation:'restore'});if(error)throw Error(error);if(!conduit.completed.includes('restore'))throw Error('초기 지상 관로의 실제 정비가 중단되었다')}
 const half=makeItem(w,'Item.ChimneyHalfManual'),plate=makeItem(w,'Item.CorporateCodePlate'),scrap=makeItem(w,'Item.IronScrap'),battery=makeItem(w,'Item.LowPowerCell')
 for(const item of [half,plate,scrap,battery])addToBag(w,p,item)
 for(const item of [half,plate])studyBook(w,p,item.def,true)
 p.equip.main=makeItem(w,'Item.Torch');p.equip.main.lit=true
 p.pos={x:32,y:20};const error=playerAct(w,{type:'stairs'});if(error)throw Error(error)
 p.pos={x:11,y:9};s.weather='clear';s.weatherUntil=1e12;updatePlayerVision(w,p)
 const pos={x:12,y:8},device=fieldDeviceAt(w,pos)!
 return {...d,conduit,half,plate,scrap,battery,pos,device}
}
