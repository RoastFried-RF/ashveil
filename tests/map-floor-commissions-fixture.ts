import {mapCommissionsFixture} from './map-commissions-fixture'
import {initialMapReport} from './cartography-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {mapSurveyOffers,isMapSurvey} from '../src/core/map-commissions'
import {playerAct} from '../src/core/game'
import {updatePlayerVision} from '../src/core/fov'
export function mapFloorCommissionsFixture(){
 const d=mapCommissionsFixture(),report=makeItem(d.w,'Item.Note');report.note=initialMapReport('crypt2');report.note.regionId='Region.GreyCloister'
 if(addToBag(d.w,d.p,report))throw Error('original floor report bag')
 const floorOffer=()=>mapSurveyOffers(d.w,d.p,d.trader).find(o=>o.region==='Region.GreyCloister'&&o.mapId==='crypt2')
 return{...d,report,floorOffer}
}
export type MapFloorPhase='unread'|'read'|'accepted'|'pending'
export function mapFloorCommissionsNativeFixture(phase:MapFloorPhase){
 const d=mapFloorCommissionsFixture(),initialTime=d.s.time,initialBank=d.market.money,initialMoney=d.p.money!
 if(phase!=='unread')d.act({type:'read',uid:d.report.uid})
 let contractId:string|undefined,reward:number|undefined
 if(phase==='accepted'||phase==='pending'){const o=d.floorOffer();if(!o)throw Error('known original floor offer');d.act({type:'mapSurveyAccept',target:d.trader.id,offer:o.id,expectedReward:o.reward});contractId=d.s.overworld!.contracts!.filter(isMapSurvey).at(-1)!.id;reward=o.reward}
 if(phase==='pending'){const e=playerAct(d.w,{type:'rest',turns:20},2);if(e)throw Error(e)}
 updatePlayerVision(d.w,d.p)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialBank,initialMoney,reportUid:d.report.uid,contractId,reward,pending:phase==='pending',targetRegion:'Region.GreyCloister',targetMap:'crypt2',originalDocument:structuredClone(d.report.note!.mapDocument)}}
}
