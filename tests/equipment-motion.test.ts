import {it,expect} from 'vitest'
import {db} from './helpers'
import {equipmentSpec,attackStyle,attackDuration,heldPose} from '../src/client/render/equipment-motion'
import {advanceWalk,createWalkMotion,observeWalk,walkPosition} from '../src/client/render/walk-motion'
it('normal walking takes720ms for two tiles and alternates foot contacts without accelerated backlog',()=>{
 const m=createWalkMotion({x:0,y:0});observeWalk(m,{x:2,y:0},[{from:{x:0,y:0},to:{x:1,y:0}},{from:{x:1,y:0},to:{x:2,y:0}}])
 for(let i=0;i<6;i++)advanceWalk(m,60)
 expect(walkPosition(m).x).toBeCloseTo(1);expect(m.stride).toBeCloseTo(1)
 for(let i=0;i<6;i++)advanceWalk(m,60)
 expect(walkPosition(m).x).toBeCloseTo(2);expect(m.stride%2).toBeCloseTo(0)
 const queued=createWalkMotion({x:0,y:0});observeWalk(queued,{x:20,y:0},Array.from({length:20},(_,i)=>({from:{x:i,y:0},to:{x:i+1,y:0}})))
 for(let i=0;i<6;i++)advanceWalk(queued,60)
 expect(walkPosition(queued).x).toBeLessThanOrEqual(1.21)
})
it('selects different stabbing, cutting and heavy attack choreography from actual definitions',()=>{
 const knife=equipmentSpec(db.item('Item.RustyKnife')),axe=equipmentSpec(db.item('Item.Hatchet')),sword=equipmentSpec(db.item('Item.Greatsword'))
 expect(attackStyle('blade','stab',knife)).toBe('thrust');expect(attackStyle('blade','cut',knife)).toBe('slash');expect(attackStyle('axe','cut',axe)).toBe('chop')
 expect(attackDuration('chop',axe)).toBeGreaterThan(attackDuration('thrust',knife));expect(attackDuration('slash',sword)).toBeGreaterThan(attackDuration('slash',knife));expect(sword.twoHanded).toBe(true)
})
it('keeps the handle at the wrist through a contact hold and mirrors the direction of the swing',()=>{
 const item=equipmentSpec(db.item('Item.RebarSpear')),base={item,slot:0 as const,mode:'attack',stride:0,moving:false,crouched:false,wrist:[8,-20]as const}
 const action={style:'thrust'as const,slot:0 as const,weapon:item,direction:'right'as const,vector:{x:1,y:0}}
 const strike=heldPose({...base,direction:'right',phase:.45,action}),hold=heldPose({...base,direction:'right',phase:.5,action})
 expect(strike).toEqual(hold);expect(strike.x).toBe(13);expect(strike.angle).toBeCloseTo(0)
 const left=heldPose({...base,wrist:[-8,-20],direction:'left',phase:.45,action:{...action,direction:'left',vector:{x:-1,y:0}}})
 expect(left.x).toBe(-13);expect(Math.cos(left.angle)).toBeCloseTo(-1);expect(Math.sin(left.angle)).toBeCloseTo(0)
})
it('returns gear to its carried angle and keeps a torch steady while the other hand fires',()=>{
 const item=equipmentSpec(db.item('Item.Bow')),torch=equipmentSpec(db.item('Item.Torch')),base={item,slot:0 as const,direction:'up'as const,stride:0,moving:false,crouched:false}
 const carried=heldPose({...base,mode:'idle',phase:0})
 const action={style:'slash'as const,slot:0 as const,weapon:item,direction:'up'as const,vector:{x:0,y:-1}}
 for(const phase of[0,1])expect(heldPose({...base,mode:'attack',phase,action})).toEqual(carried)
 const off={...base,item:torch,slot:1 as const}
 expect(heldPose({...off,mode:'shoot',phase:.45,action:{...action,style:'shoot'}})).toEqual(heldPose({...off,mode:'idle',phase:0}))
})
