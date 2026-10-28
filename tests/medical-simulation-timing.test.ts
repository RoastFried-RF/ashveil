import {expect,it} from 'vitest'
import {medicalSimulationTiming} from '../src/client/medical-simulation-timing'
import {companionCarePlanQuote} from '../src/core/companion-care-plan'
import {playerAct,runUntilInput} from '../src/core/game'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {carePlanFixture} from './companion-care-plan-fixture'
it('paces observed clinical channels without changing state and keeps instant mode available',()=>{
 const {w,worker}=carePlanFixture();worker.activity={kind:'diagnose',remaining:10,patientId:w.s.playerId,label:'진찰'};const before=stateHash(w.s)
 expect(medicalSimulationTiming(w,1)).toEqual({untilTU:w.s.time+100,delayMs:140});expect(medicalSimulationTiming(w,2).delayMs).toBe(70);expect(medicalSimulationTiming(w,0)).toEqual({untilTU:undefined,delayMs:0});expect(stateHash(w.s)).toBe(before)
})
it('does not expose hidden NPC medical work through pacing',()=>{
 const {w,worker}=carePlanFixture();worker.activity={kind:'diagnose',remaining:10,label:'진찰'};w.s.visible=[];const before=stateHash(w.s);expect(medicalSimulationTiming(w,1)).toEqual({untilTU:undefined,delayMs:0});expect(stateHash(w.s)).toBe(before)
})
it('reaches the exact unsliced whole world while showing a scheduled medical channel between TU boundaries',()=>{
 const f=carePlanFixture(),requests=[{...f.requests[1]!,afterTurns:20}],q=companionCarePlanQuote(f.w,f.worker,requests),copy={db:f.w.db,s:deserialize(serialize(f.s))}
 const action={type:'companionCarePlan' as const,target:f.worker.id,requests,expected:q.signature}
 expect(playerAct(f.w,action)).toBeNull();expect(playerAct(copy,action,200,medicalSimulationTiming(copy,1,true).untilTU)).toBeNull();while(copy.s.simulationPending)runUntilInput(copy,200,medicalSimulationTiming(copy,1).untilTU)
 expect(playerAct(f.w,{type:'rest',turns:200})).toBeNull();expect(playerAct(copy,{type:'rest',turns:200},200,medicalSimulationTiming(copy,1).untilTU)).toBeNull()
 let observed=false,count=0;while(copy.s.simulationPending&&count++<1000){observed||=copy.s.creatures.some(c=>c.activity?.kind==='dose');runUntilInput(copy,200,medicalSimulationTiming(copy,1).untilTU)}
 expect(observed).toBe(true);expect(copy.s.simulationPending).toBeUndefined();expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(f.s)));expect(stateHash(copy.s)).toBe(stateHash(f.s))
})
