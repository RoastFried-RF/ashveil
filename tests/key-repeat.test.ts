import {describe,it,expect} from 'vitest'
import {KeyRepeatGate,type KeyRepeatSettings} from '../src/client/key-repeat'
const settings=(mode:KeyRepeatSettings['keyRepeatMode']='limited'):KeyRepeatSettings=>({keyRepeatMode:mode,keyRepeatDelay:500,keyRepeatInterval:125})
const key=(repeat=false,code='ArrowRight')=>({code,repeat})
describe('실제 브라우저 키 반복 제한',()=>{
 it('기본 방식은 실제 최초 입력/반복만 그대로 통과시킨다',()=>{const g=new KeyRepeatGate();expect(g.accept(key(),0,settings('system'))).toBe(true);expect(g.accept(key(true),1,settings('system'))).toBe(true);expect(g.accept(key(true),2,settings('system'))).toBe(true)})
 it('한 번 모드는 누른 채 반복되지 않고 실제 해제 후 다시 실행된다',()=>{const g=new KeyRepeatGate();expect(g.accept(key(),10,settings('once'))).toBe(true);expect(g.accept(key(true),2000,settings('once'))).toBe(false);g.release('ArrowRight');expect(g.accept(key(true),3000,settings('once'))).toBe(false);expect(g.accept(key(),3001,settings('once'))).toBe(true)})
 it('최초 지연과 각 반복 간격의 경계에 정확히 한 번씩 통과시킨다',()=>{const g=new KeyRepeatGate();expect(g.accept(key(),100,settings())).toBe(true);expect(g.accept(key(true),599,settings())).toBe(false);expect(g.accept(key(true),600,settings())).toBe(true);expect(g.accept(key(true),724,settings())).toBe(false);expect(g.accept(key(true),725,settings())).toBe(true);expect(g.accept(key(true),726,settings())).toBe(false)})
 it('키가 들어오지 않은 시간에는 밀린 행동을 만들지 않는다',()=>{const g=new KeyRepeatGate();g.accept(key(),0,settings());expect(g.accept(key(true),10000,settings())).toBe(true);expect(g.accept(key(true),10001,settings())).toBe(false)})
 it('다른 키는 별도의 최초 입력과 반복 시계를 사용한다',()=>{const g=new KeyRepeatGate();g.accept(key(),0,settings());expect(g.accept(key(false,'KeyG'),400,settings())).toBe(true);expect(g.accept(key(true),500,settings())).toBe(true);expect(g.accept(key(true,'KeyG'),899,settings())).toBe(false);expect(g.accept(key(true,'KeyG'),900,settings())).toBe(true)})
 it('포커스/설정 전환으로 초기화하면 누른 채 돌아온 반복이 행동하지 않는다',()=>{const g=new KeyRepeatGate();g.accept(key(),0,settings());g.clear();expect(g.accept(key(true),1000,settings())).toBe(false);expect(g.accept(key(),1001,settings())).toBe(true)})
 it('빠른 누름/해제는 지연 옵션과 관계없이 각각 실행한다',()=>{const g=new KeyRepeatGate();for(let i=0;i<10;i++){expect(g.accept(key(),i,settings())).toBe(true);g.release('ArrowRight')}})
 it('늦은/손상된 이벤트 시각은 반복 기준을 훼손하지 않는다',()=>{const g=new KeyRepeatGate();g.accept(key(),100,settings());expect(g.accept(key(true),99,settings())).toBe(false);expect(g.accept(key(true),NaN,settings())).toBe(false);expect(g.accept(key(true),Infinity,settings())).toBe(false);expect(g.accept(key(true),600,settings())).toBe(true)})
 it('지연0에서도 최소 반복 간격을 적용한다',()=>{const g=new KeyRepeatGate(),p={...settings(),keyRepeatDelay:0};g.accept(key(),0,p);expect(g.accept(key(true),124,p)).toBe(false);expect(g.accept(key(true),125,p)).toBe(true)})
 it('한 키를 해제해도 다른 키의 누른 상태를 지우지 않는다',()=>{const g=new KeyRepeatGate();g.accept(key(),0,settings());g.accept(key(false,'KeyG'),0,settings());g.release('ArrowRight');expect(g.accept(key(true),500,settings())).toBe(false);expect(g.accept(key(true,'KeyG'),500,settings())).toBe(true)})
})
