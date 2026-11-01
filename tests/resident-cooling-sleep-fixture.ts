import{pilgrimFieldsFixture}from'./pilgrim-fields-fixture'
import{allItems,itemDef,unequip}from'../src/core/items'
import{invalidateLights,updatePlayerVision}from'../src/core/fov'
import type{Slot}from'../src/core/types'

export function residentCoolingSleepFixture(mode:'fatigue'|'debt'='debt'){
 const d=pilgrimFieldsFixture(),originalNeeds=structuredClone(d.c.needs),originalPos={...d.c.pos}
 d.c.pos={x:30,y:25};d.c.needs.bodyTemp=38.2;d.c.needs.fatigue=mode==='fatigue'?85:0;d.c.needs.sleepDebt=mode==='debt'?2:0;d.s.wind={x:0,y:0}
 const originalApparel=allItems(d.c).filter(i=>itemDef(d.w,i).apparel).map(i=>({uid:i.uid,def:i.def}))
 // Declared initial observer outfit; original garments remain in the actual bag with valid positions.
 for(const slot of Object.keys(d.p.equip)as Slot[]){const it=d.p.equip[slot];if(it&&itemDef(d.w,it).apparel){const error=unequip(d.w,d.p,slot);if(error)throw Error(error)}}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p);d.s.fx=[]
 return{...d,originalApparel,proof:{...d.proof,mode,originalNeeds,originalPos,declaredCourtyardPosition:{...d.c.pos},declaredWarmBody:38.2,declaredFatigue:d.c.needs.fatigue,declaredSleepDebt:d.c.needs.sleepDebt,declaredWind:{...d.s.wind},declaredObserverOriginalGarmentsInBag:true,originalApparel,originalBeds:structuredClone(d.s.map.residentBeds),noNaturalEarlierHeatOrSleepDebtClaim:true,noPostTitleBodyClockRngOrResourceInjection:true}}
}
