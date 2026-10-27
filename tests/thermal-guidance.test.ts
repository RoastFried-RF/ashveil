import { describe, expect, it } from 'vitest'
import { tileAt, turnOf, TURNS_PER_HOUR } from '../src/core/ctx'
import { serialize, stateHash } from '../src/core/save'
import { projectThermalState, thermalState } from '../src/core/thermal'
import { thermalGuidance } from '../src/client/thermal-guidance'
import { computeBanners } from '../src/client/warnings'
import { thermalFixture } from './thermal-fixture'

describe('현재 조건의 체온 안내',()=>{
  it('휴식 냉각과 몸 풀기 회복을 구분하고 조회는 전체 세계를 보존한다',()=>{
    const{w,p}=thermalFixture(),hash=stateHash(w.s),raw=serialize(w.s)
    const g=thermalGuidance(w)
    expect(g.rest).toBeLessThan(0);expect(g.warm).toBeGreaterThan(0)
    expect(g.notice).toBe('불 곁에서도 체온 하락')
    expect(g.advice).toContain('몸 풀기');expect(g.format(g.rest)).toContain('−')
    expect(computeBanners(w).some(b=>b.p===2&&b.text.includes('불 곁에서도'))).toBe(true)
    expect(stateHash(w.s)).toBe(hash);expect(serialize(w.s)).toBe(raw)
    expect(p.needs.thermal).toBeUndefined()
  })
  it('걸어서 데워지는 중이라도 멈추면 식는다는 것을 별도로 알린다',()=>{
    const{w,p}=thermalFixture();w.s.time=8*TURNS_PER_HOUR*100;p.needs.bodyTemp=36.6;p.movedTurn=turnOf(w)
    const g=thermalGuidance(w)
    expect(g.current).toBeGreaterThan(0);expect(g.rest).toBeLessThan(0)
    expect(g.notice).toBe('멈추면 체온 하락')
  })
  it('직전 건조·전투·걷기 보정을 휴식에 이월하지 않는다',()=>{
    const{w,p}=thermalFixture();p.movedTurn=turnOf(w);p.exerted=true;p.activity={kind:'dry',remaining:20,label:'말리기'}
    const raw=serialize(w.s),projection=projectThermalState(w,p,'rest')
    expect(projection.activity).toBe('rest')
    expect(projection.feels).toBe(thermalState(w,p).feels+2)
    expect(serialize(w.s)).toBe(raw)
  })
  it('잠잘 때만 실제 침구의 단열을 더하고 젖은 침구는 그대로 반영한다',()=>{
    const{w,p}=thermalFixture();tileAt(w,p.pos).t='Terrain.Bedroll'
    const rest=projectThermalState(w,p,'rest'),sleep=projectThermalState(w,p,'sleep')
    expect(sleep.insulation).toBeGreaterThan(rest.insulation)
    expect(sleep.activity).toBe('sleep');expect(p.asleep).toBe(false)
    tileAt(w,p.pos).beddingWetness=100
    expect(projectThermalState(w,p,'sleep').insulation).toBeLessThan(sleep.insulation)
  })
  it('불이 꺼졌거나 움직일 수 없는 몸에게 몸 풀기 회복을 권하지 않는다',()=>{
    for(const kind of ['off','body']){
      const{w,p,fire}=thermalFixture();if(kind==='off')Object.assign(fire,{off:true});else p.unconscious=true
      const g=thermalGuidance(w);expect(g.warm).toBeUndefined();expect(g.warmError).toBeTruthy()
      expect(g.advice).not.toContain('몸 풀기를 하면')
    }
  })
  it('깊은 물에서 떠 있기 위한 작업 대사를 휴식·수면 예상치에서도 빼지 않는다',()=>{
    const{w,p}=thermalFixture();tileAt(w,p.pos).t='Terrain.DeepFenWater'
    p.activity={kind:'rest',remaining:20,label:'휴식'}
    const actual=thermalState(w,p),raw=serialize(w.s)
    for(const activity of ['rest','sleep','work']as const){
      const projected=projectThermalState(w,p,activity)
      expect(projected.activity).toBe('work');expect(projected.low).toBe(actual.low)
    }
    expect(serialize(w.s)).toBe(raw)
  })
  it('높은 체온의 정상 회복을 추위로 경고하지 않으며 위독 경고가 앞선다',()=>{
    const{w,p}=thermalFixture();tileAt(w,p.pos).roof=true;p.needs.bodyTemp=37.5
    expect(thermalGuidance(w).notice).toBeUndefined()
    p.needs.bodyTemp=31
    expect(computeBanners(w)[0]).toMatchObject({p:0,text:'체온 31.0°C'})
    expect(computeBanners(w).filter(b=>b.text.includes('체온'))).toHaveLength(1)
  })
})
