import {expect,it} from 'vitest'
import {activityStep} from '../src/core/actions'
import {addWound} from '../src/core/body'
import {companionClinicalQuote,requestCompanionClinical} from '../src/core/companion-clinical'
import {invalidateLights} from '../src/core/fov'
import {addToBag,makeItem} from '../src/core/items'
import {stateHash} from '../src/core/save'
import {medicalPresentation} from '../src/client/render/medical-presentation'
import {activityMotion} from '../src/client/render/action-presentation'
import gripData from '../src/client/render/medical-grips.json'
import sprites from '../src/client/sprites.json'
import {baseFixture} from './base-camp-fixture'
function fixture(){
 const d=baseFixture(),{w,p,worker}=d;w.s.map.kind='dungeon';w.s.map.ambient=1;w.s.map.lights=[];invalidateLights(w);worker.skills.medicine=50;worker.facing=4
 const needle=makeItem(w,'Item.Needle'),thread=makeItem(w,'Item.Thread',3);addToBag(w,worker,needle);addToBag(w,worker,thread)
 const wound=addWound(w,p,{def:'Wound.Cut',part:'LeftForearm',severity:3,contam:0,source:'선언한 초기 상처'}).wound,request={kind:'suture',woundId:wound.id} as const,q=companionClinicalQuote(w,worker,request)
 expect(q.error).toBeNull();expect(requestCompanionClinical(w,worker,request,q.signature)).toBeNull();return{...d,needle,thread,wound}
}
it('continuous work binds the original needle/thread without spending or advancing the world',()=>{
 const {w,worker,needle,thread}=fixture(),before=stateHash(w.s),view=medicalPresentation(w,worker)!
 expect(view.kind).toBe('needle');expect(view.props.map(p=>p.uid)).toEqual([needle.uid,thread.uid]);expect(view.props.map(p=>p.arm)).toEqual(['main','off']);expect(view.cycle).toBeGreaterThan(1000);expect(activityMotion(worker.activity)).toBe('work');expect(stateHash(w.s)).toBe(before)
})
it('a real work turn faces the original patient; a lost UID never becomes a replacement prop',()=>{
 const {w,worker,needle}=fixture();expect(worker.facing).toBe(4);activityStep(w,worker);expect(worker.facing).toBe(0)
 worker.bag.splice(worker.bag.findIndex(i=>i.uid===needle.uid),1);addToBag(w,worker,makeItem(w,'Item.Needle'));const before=stateHash(w.s);expect(medicalPresentation(w,worker)).toBeNull();expect(stateHash(w.s)).toBe(before)
})
it('the chosen intact hand is used and an absent opposite hand gains no held spool',()=>{
 const {w,worker}=fixture();worker.body.missing.push('RightHand');const before=stateHash(w.s),view=medicalPresentation(w,worker)!
 expect(view.props).toHaveLength(1);expect(view.props[0].arm).toBe('off');expect(stateHash(w.s)).toBe(before);worker.unconscious=true;expect(medicalPresentation(w,worker)).toBeNull()
})
it('reviewed work grips exist in the original crops and keep hidden hands explicitly absent',()=>{
 const frames=sprites.frames as unknown as Record<string,[string,number,number,number,number]>,grips=gripData.frames as Record<string,{main:{point:number[];color:number}|null;off:{point:number[];color:number}|null}>
 expect(Object.keys(grips)).toHaveLength(128);let hidden=0
 for(const[key,row]of Object.entries(grips)){const rect=frames[key];expect(rect).toBeDefined();for(const hand of[row.main,row.off]){if(!hand){hidden++;continue}expect(hand.point).toHaveLength(2);expect(hand.point[0]).toBeGreaterThanOrEqual(0);expect(hand.point[0]).toBeLessThan(rect[3]);expect(hand.point[1]).toBeGreaterThanOrEqual(0);expect(hand.point[1]).toBeLessThan(rect[4])}}
 expect(hidden).toBe(59)
})
