import {rightHandBindings} from '../src/client/keybindings'
import { describe, expect, it } from 'vitest'
import { COMMANDS, bindingError, bindingText, chordError, commandKeys, keyChord, leftHandBindings, normalizeBindings, resolveGameKey, type KeyBindings, type KeyInput } from '../src/client/keybindings'
import { DEFAULT_PREFERENCES, normalizePreferences } from '../src/client/preferences'
const input=(code:string,mods:Partial<KeyInput>={}):KeyInput=>({code,key:code,ctrlKey:false,shiftKey:false,altKey:false,metaKey:false,...mods})
describe('키 배정과 실제 게임 키 변환',()=>{
  it('기본 모든 명령/별칭은 자기 동작으로 연결되고 서로 키를 빼앗지 않는다',()=>{
    const used=new Set<string>()
    for(const[id,,,keys]of COMMANDS)for(const chord of keys){expect(used.has(chord)).toBe(false);used.add(chord);const parts=chord.split('+'),code=parts.pop()!;expect(resolveGameKey(input(code,{ctrlKey:parts.includes('Ctrl'),altKey:parts.includes('Alt'),shiftKey:parts.includes('Shift')}),{})?.command).toBe(id)}
  })
  it('한글/대문자/넘패드 잠금의 키 이름이 달라도 물리 코드로8방향을 구별한다',()=>{
    expect(resolveGameKey(input('KeyK',{key:'ㅏ'}),{})?.key).toBe('ArrowUp');expect(resolveGameKey(input('KeyK',{key:'K'}),{})?.command).toBe('north');expect(resolveGameKey(input('Numpad3',{key:'PageDown'}),{})?.command).toBe('southEast');expect(resolveGameKey(input('KeyN'),{})?.command).toBe('society')
  })
  it('재배정한 키만 작동하며 제거한 기본 별칭은 다른 게임 행동으로 새지 않는다',()=>{
    const bindings:KeyBindings={inventory:['F11'],east:['Backslash']};expect(resolveGameKey(input('F11'),bindings)?.key).toBe('i');for(const code of ['KeyI','ArrowRight','KeyL','Numpad6'])expect(resolveGameKey(input(code),bindings)).toBeNull();expect(resolveGameKey(input('Backslash'),bindings)?.key).toBe('ArrowRight');expect(resolveGameKey(input('KeyI',{shiftKey:true}),bindings)).toBeNull()
  })
  it('방향에 추가한Ctrl/Shift는 회전/밀치기지만 배정 자체의 수식 키는 소비한다',()=>{
    expect(resolveGameKey(input('ArrowUp',{ctrlKey:true}),{})).toMatchObject({command:'north',ctrlKey:true,shiftKey:false});expect(resolveGameKey(input('Numpad3',{shiftKey:true}),{})).toMatchObject({command:'southEast',ctrlKey:false,shiftKey:true});expect(resolveGameKey(input('KeyK',{shiftKey:true}),{})?.command).toBe('abilities')
    const custom:KeyBindings={north:['Alt+KeyA'],west:[],interact:['Shift+KeyW']};expect(resolveGameKey(input('KeyA',{altKey:true}),custom)).toMatchObject({command:'north',shiftKey:false,ctrlKey:false});expect(resolveGameKey(input('KeyA',{altKey:true,ctrlKey:true}),custom)).toMatchObject({command:'north',ctrlKey:true});expect(resolveGameKey(input('KeyW',{shiftKey:true}),custom)?.command).toBe('interact')
    const shifted:KeyBindings={north:['Shift+KeyW']};expect(resolveGameKey(input('KeyW',{shiftKey:true}),shifted)).toMatchObject({command:'north',shiftKey:false});expect(resolveGameKey(input('KeyW',{shiftKey:true,ctrlKey:true}),shifted)).toMatchObject({command:'north',shiftKey:false,ctrlKey:true})
  })
  it('왼손 프리셋은QWE/ASD/ZXC 8방향·대기와 창/수색/휴식·루팅을 모두 배정한다',()=>{
    const bindings=leftHandBindings();expect(normalizeBindings(bindings)).toEqual(bindings);for(const[code,command]of[['KeyQ','northWest'],['KeyW','north'],['KeyE','northEast'],['KeyA','west'],['KeyS','wait'],['KeyD','east'],['KeyZ','southWest'],['KeyX','south'],['KeyC','southEast'],['KeyF','search'],['KeyT','rest'],['KeyG','sleep'],['F4','inventory']])expect(resolveGameKey(input(code),bindings)?.command).toBe(command)
    expect(resolveGameKey(input('KeyE',{altKey:true}),bindings)?.command).toBe('lootAll');for(const[id]of COMMANDS)expect(commandKeys(bindings,id).length).toBeGreaterThan(0)
  })
  it('중복/예약 키는 구체적인 원인을 알리고 해제 후에는 같은 키를 배정한다',()=>{
    expect(bindingError({},'inventory','KeyH')).toContain('서쪽');expect(bindingError({west:[]},'inventory','KeyH')).toBeNull();expect(bindingError({},'inventory','F11')).toBeNull();expect(chordError('F3','inventory')).toBeTruthy();expect(chordError('Shift+F3','inventory')).toBeTruthy();expect(chordError('Enter','inventory')).toBeTruthy();expect(chordError('Ctrl+KeyS','inventory')).toBeTruthy();expect(chordError('Ctrl+KeyL','inventory')).toBeTruthy();expect(chordError('Ctrl+KeyS','sortBag')).toBeNull()
  })
  it('손상된 저장의 임의 필드/문자열과 중복을 거르고 정상 해제/이전은 보존한다',()=>{
    for(const raw of [null,[],3,'bad'])expect(normalizeBindings(raw)).toEqual({});expect(normalizeBindings({inventory:['<script>'],unknown:['KeyA']})).toEqual({});expect(normalizeBindings({inventory:['F11','F11'],search:[]})).toEqual({inventory:['F11'],search:[]});expect(normalizeBindings({inventory:['KeyH']})).toEqual({});expect(normalizeBindings({west:[],inventory:['KeyH']})).toEqual({west:[],inventory:['KeyH']});expect(normalizeBindings({inventory:['Ctrl+Shift+Ctrl+KeyA']})).toEqual({})
  })
  it('화면 설정과 키 배정은 각인과 별개로 JSON 왕복하고 기본값의 배열을 공유하지 않는다',()=>{
    const raw={keyBindings:{inventory:['F11'],search:[]},logFontSize:20},p=normalizePreferences(raw),copy=normalizePreferences(JSON.parse(JSON.stringify(p)));expect(copy).toEqual(p);copy.keyBindings.inventory!.push('F12');expect(p.keyBindings.inventory).toEqual(['F11']);expect(DEFAULT_PREFERENCES.keyBindings).toEqual({});expect(normalizePreferences({}).keyBindings).toEqual({})
  })
  it('표시 문구는 실제 배정·해제를 반영하며 공백의 루팅 문맥과 정렬 수식 키를 보존한다',()=>{
    expect(bindingText({inventory:['F11']},'inventory')).toBe('F11');expect(bindingText({search:[]},'search')).toBe('미배정');expect(resolveGameKey(input('Space'),{})?.key).toBe(' ');expect(resolveGameKey(input('KeyS',{ctrlKey:true}),{})).toMatchObject({command:'sortBag',key:'s',ctrlKey:true});expect(keyChord(input('KeyA',{ctrlKey:true,altKey:true,shiftKey:true}))).toBe('Ctrl+Alt+Shift+KeyA')
  })
  it('운영체제 수식 키·미배정 키는 게임 명령을 발생시키지 않는다',()=>{
    expect(resolveGameKey(input('KeyI',{metaKey:true}),{})).toBeNull();expect(resolveGameKey(input('F12'),{})).toBeNull();expect(resolveGameKey(input('KeyP',{altKey:true}),{})).toBeNull();expect(resolveGameKey(input('KeyR'),{rest:[]})).toBeNull()
  })
  it('오른손 배치는 중복 없이 복원되고 음성/정렬 명령을 보존한다',()=>{
    const p=rightHandBindings();expect(normalizeBindings(p)).toEqual(p);expect(resolveGameKey(input('KeyR',{altKey:true}),p)?.command).toBe('readAloud');expect(resolveGameKey(input('KeyS',{altKey:true}),p)?.command).toBe('stopReading');expect(resolveGameKey(input('KeyS',{ctrlKey:true}),p)?.command).toBe('sortBag')
  })
  it('오른손의 물리8방향은 실제 방향으로 변환된다',()=>{
    const p=rightHandBindings(),codes=['KeyO','KeyP','Semicolon','Slash','Period','Comma','KeyK','KeyI'],commands=['north','northEast','east','southEast','south','southWest','west','northWest']
    codes.forEach((code,i)=>expect(resolveGameKey(input(code),p)?.command).toBe(commands[i]))
  })
  it('오른손 쉼표/마침표의 추가 수식 키는 계단 대신 방향 회전/밀치기다',()=>{
    const p=rightHandBindings();for(const code of ['Period','Comma']){expect(resolveGameKey(input(code,{ctrlKey:true}),p)).toMatchObject({ctrlKey:true});expect(resolveGameKey(input(code,{shiftKey:true}),p)).toMatchObject({shiftKey:true});expect(resolveGameKey(input(code,{shiftKey:true}),p)?.command).not.toBe('stairs')}expect(resolveGameKey(input('Enter'),p)?.command).toBe('stairs')
  })
  it('오른손 L대기/F4소지품은 기본 배치로 돌아가면 원래 명령을 쓴다',()=>{
    expect(resolveGameKey(input('KeyL'),rightHandBindings())?.command).toBe('wait');expect(resolveGameKey(input('F4'),rightHandBindings())?.command).toBe('inventory');expect(resolveGameKey(input('KeyL'),{})?.command).toBe('east');expect(resolveGameKey(input('KeyI'),{})?.command).toBe('inventory')
  })

})
