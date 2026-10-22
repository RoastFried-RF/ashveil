import {describe,it,expect} from 'vitest'
import {COMMANDS,commandKeys,leftHandBindings,rightHandBindings,resolveGameKey,normalizeBindings,type KeyInput} from '../src/client/keybindings'
import {directionOf,repeatableCommand} from '../src/client/input-context'
const input=(chord:string):KeyInput=>({code:chord.split('+').at(-1)!,key:'Unidentified',ctrlKey:chord.includes('Ctrl+'),altKey:chord.includes('Alt+'),shiftKey:chord.includes('Shift+'),metaKey:false})
describe('전수 게임 키 경로',()=>{
 for(const[label,bindings]of[['기본',{}],['왼손',leftHandBindings()],['오른손',rightHandBindings()]]as const)it(`${label}: 모든 명령과 별칭은 다른 명령에 빼앗기지 않는다`,()=>{
  expect(normalizeBindings(bindings)).toEqual(bindings)
  for(const[id]of COMMANDS)for(const chord of commandKeys(bindings,id))expect(resolveGameKey(input(chord),bindings)?.command,`${label}/${id}/${chord}`).toBe(id)
 })
 it('운영체제의 누른 채 반복은 8방향/대기만 허용한다',()=>{const allowed=COMMANDS.filter(([id])=>repeatableCommand(id)).map(([id])=>id);expect(allowed).toEqual(['north','northEast','east','southEast','south','southWest','west','northWest','wait']);for(let i=0;i<8;i++)expect(directionOf(COMMANDS[i][0])).toBe(i)})
 it('기본 n/Shift+n의 이동·주민 창 문맥을 분리하고 명시한 예전 개인 배치는 보존한다',()=>{
  expect(resolveGameKey(input('KeyN'),{})?.command).toBe('southEast');expect(resolveGameKey(input('Shift+KeyN'),{})?.command).toBe('society')
  const old={southEast:['Numpad3'],society:['KeyN','Shift+KeyN']}as const,bindings=normalizeBindings(old)
  expect(bindings).toEqual(old);expect(resolveGameKey(input('KeyN'),bindings)?.command).toBe('society')
 })
})
