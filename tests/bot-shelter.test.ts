import { describe, expect, it } from 'vitest'
import { botDecide } from '../src/core/bot'
import { botShelterAction } from '../src/core/bot-shelter'
import { tileAt, TURNS_PER_HOUR } from '../src/core/ctx'
import { invalidateLights, updatePlayerVision } from '../src/core/fov'
import { playerAct } from '../src/core/game'
import { DIRS } from '../src/core/geom'
import { serialize, stateHash, deserialize } from '../src/core/save'
import { projectThermalState, temperatureDelta } from '../src/core/thermal'
import { thermalFixture } from './thermal-fixture'

describe('불가의 실제 열수지를 따르는 봇',()=>{
  it('불 곁에서도 쉬면 식는 몸은 기존 몸 풀기를 실제 수행하고 열량·시간을 쓴다',()=>{
    const{w,p}=thermalFixture(),temp=p.needs.bodyTemp,kcal=p.needs.kcal,time=w.s.time
    expect(temperatureDelta(p,projectThermalState(w,p,'rest'))).toBeLessThan(0)
    expect(botDecide(w)).toEqual({type:'warmByFire'})
    expect(playerAct(w,botDecide(w))).toBeNull()
    expect(p.needs.bodyTemp).toBeGreaterThan(temp)
    expect(p.needs.kcal).toBeLessThan(kcal)
    expect(w.s.time).toBeGreaterThan(time)
    expect(p.bag).toEqual([])
  })
  it('휴식으로 실제 회복되면 몸 풀기 대신 쉬며 판단만으로 몸이나 난수를 바꾸지 않는다',()=>{
    const{w,p}=thermalFixture();tileAt(w,p.pos).roof=true;w.s.time=8*TURNS_PER_HOUR*100
    const hash=stateHash(w.s)
    expect(botShelterAction(w,()=>false)).toEqual({type:'rest',turns:60})
    expect(stateHash(w.s)).toBe(hash)
  })
  it('강풍 속의 불로 부족하면 알려진 지붕으로 실제 한 걸음씩 이동한다',()=>{
    const{w,p}=thermalFixture();w.s.wind={x:4,y:0}
    tileAt(w,{x:20,y:19}).roof=true
    expect(temperatureDelta(p,projectThermalState(w,p,'work'))).toBeLessThan(0)
    const action=botDecide(w);expect(action).toEqual({type:'move',dir:0})
    expect(playerAct(w,action)).toBeNull()
    expect(p.pos).toEqual({x:20,y:19})
    expect(botDecide(w)).toEqual({type:'warmByFire'})
  })
  it('보이지 않고 탐색하지 않은 지붕과 꺼진 불을 피난처로 미리 읽지 않는다',()=>{
    const{w,p,fire}=thermalFixture();w.s.wind={x:4,y:0}
    for(const tile of w.s.map.tiles)tile.seen=false
    const hidden={x:26,y:20};tileAt(w,hidden).roof=true
    for(let y=17;y<=25;y++)tileAt(w,{x:23,y}).t='Terrain.KtWall'
    w.s.map.lights.push({pos:hidden,radius:8,kind:'campfire',off:true})
    invalidateLights(w);updatePlayerVision(w,p)
    const initial=serialize(w.s),before=botShelterAction(w,()=>false)
    tileAt(w,hidden).roof=false;w.s.map.lights=[fire];invalidateLights(w)
    expect(botShelterAction(w,()=>false)).toEqual(before)
    expect(before).toEqual({type:'warmByFire'})
    expect(serialize(deserialize(initial))).toBe(initial)
  })
  it('기억한 지붕이라도 막힌 길·물·피해야 할 방으로 걷지 않는다',()=>{
    for(const blocked of ['wall','water','avoid']){
      const{w,p}=thermalFixture();w.s.wind={x:4,y:0}
      const roof={x:26,y:20};tileAt(w,roof).roof=true
      if(blocked==='wall')for(let y=17;y<=25;y++)tileAt(w,{x:23,y}).t='Terrain.KtWall'
      if(blocked==='water')for(let y=17;y<=25;y++)tileAt(w,{x:23,y}).t='Terrain.ShallowWater'
      const action=botShelterAction(w,pos=>blocked==='avoid'&&pos.x>=23)
      expect(action).toEqual({type:'warmByFire'})
      expect(p.pos).toEqual({x:20,y:20})
    }
  })
  it('꺼진 설치 모닥불을 무료로 다시 켜려는 toggleFire 반복을 하지 않는다',()=>{
    const{w,fire}=thermalFixture();Object.assign(fire,{off:true,sourceUid:123456,fuelUntil:0})
    expect(botDecide(w).type).not.toBe('toggleFire')
  })
  it('적이 붙으면 보온보다 실제 전투 판단을 먼저 한다',async()=>{
    const{w,p}=thermalFixture();const{createCreature}=await import('../src/core/creatures')
    const foe=createCreature(w,'Creature.Reaver',{x:20,y:19});foe.ai.mode='hunt';w.s.creatures.push(foe)
    const action=botDecide(w);expect(action.type).not.toBe('warmByFire');expect(action.type).not.toBe('rest')
    if(action.type==='move'){const d=DIRS[action.dir];expect(d.x||d.y).not.toBe(0)}
    expect(p.needs.bodyTemp).toBe(35.8)
  })
})
