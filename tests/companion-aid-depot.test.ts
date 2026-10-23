import {it,expect} from 'vitest'
import {baseFixture,finishBase} from './base-camp-fixture'
import {activityStep,perform} from '../src/core/actions'
import {startClaimBase,transferBase} from '../src/core/base-camp'
import {addWound} from '../src/core/body'
import {addToBag,makeItem} from '../src/core/items'
import {tileAt} from '../src/core/ctx'
import {invalidateLights} from '../src/core/fov'
import {companionAidDecision,companionAidSupplyQuote,planCompanionAidSupply,setCompanionAid,setCompanionAidDepot,takeCompanionAidSupply} from '../src/core/companion-aid'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {SAVE_VERSION} from '../src/core/game'
function fixture(){const d=baseFixture(),{w,p,worker}=d;w.s.map.kind='dungeon';w.s.map.ambient=1;w.s.map.lights=[];invalidateLights(w);startClaimBase(w,p,d.store);finishBase(w,p);const item=makeItem(w,'Item.Bandage',2);addToBag(w,p,item);transferBase(w,p,'put',item.uid);const wound=addWound(w,p,{def:'Wound.Cut',part:'LeftForearm',severity:3,contam:0,source:'명시한 초기 상처'}).wound;setCompanionAid(w,worker,'firstAid');return{...d,item,wound}}
it('depot use requires separate permission and read-only planning before moving one actual source unit',()=>{
 const d=fixture(),{w,p,worker,item,wound}=d;let hash=stateHash(w.s);expect(companionAidSupplyQuote(w,worker,p).error).not.toBeNull();expect(stateHash(w.s)).toBe(hash);expect(worker.companion!.aid!.suppliesFromBase).toBeUndefined()
 expect(setCompanionAidDepot(w,worker,true)).toBeNull();p.activity={kind:'rest',remaining:200,total:200,label:'동료 처치를 기다리는 휴식'};hash=stateHash(w.s);const quote=companionAidSupplyQuote(w,worker,p);expect(quote.error).toBeNull();expect(quote.plan).toMatchObject({patient:p.id,woundId:wound.id,materialUid:item.uid,item:item.def,phase:'take'});expect(stateHash(w.s)).toBe(hash)
 expect(planCompanionAidSupply(w,worker,p)).toBeNull();expect(item.count).toBe(2);expect(worker.bag).toEqual([]);const copy={db:w.db,s:deserialize(serialize(w.s))},other=copy.s.creatures.find(c=>c.id===worker.id)!
 const next=w.s.nextId;expect(takeCompanionAidSupply(w,worker,item.uid)).toBeNull();expect(item.count).toBe(1);expect(worker.bag[0]).toMatchObject({uid:next,def:item.def,count:1});expect(w.s.nextId).toBe(next+1)
 expect(takeCompanionAidSupply(copy,other,item.uid)).toBeNull();expect(stateHash(copy.s)).toBe(stateHash(w.s))
 expect(companionAidDecision(w,worker)?.action).toEqual({type:'autoCompanionAid',target:p.id});expect(perform(w,worker,{type:'autoCompanionAid',target:p.id}).ok).toBe(true);expect(wound.bandage).toBeUndefined();for(let n=0;worker.activity&&n<30;n++)activityStep(w,worker)
 expect(wound.bandage).toBeDefined();expect(worker.bag.some(i=>i.def==='Item.Bandage')).toBe(false);expect(tileAt(w,d.store).cont!.items.find(i=>i.uid===item.uid)!.count).toBe(1)
})
it('rejects changed reserved stock and revoked permission atomically without replacing the UID',()=>{
 const d=fixture(),{w,p,worker,item}=d;setCompanionAidDepot(w,worker,true);planCompanionAidSupply(w,worker,p);item.dirty=true;let hash=stateHash(w.s);expect(takeCompanionAidSupply(w,worker,item.uid)).not.toBeNull();expect(stateHash(w.s)).toBe(hash);item.dirty=false
 expect(setCompanionAidDepot(w,worker,false)).toBeNull();hash=stateHash(w.s);expect(takeCompanionAidSupply(w,worker,item.uid)).not.toBeNull();expect(stateHash(w.s)).toBe(hash);expect(worker.bag).toEqual([])
})
it('old209 aid records keep their original fields and gain no depot authorization',()=>{
 const d=fixture(),old=JSON.parse(serialize(d.s));old.version=209;const next=deserialize(JSON.stringify(old));expect(next).toEqual({...old,version:SAVE_VERSION});expect(next.creatures.find(c=>c.id===d.worker.id)!.companion!.aid!.suppliesFromBase).toBeUndefined()
})
