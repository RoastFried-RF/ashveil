// 물리 키 코드를 사용하므로 한글 입력 상태에서도 같은 위치의 게임 키가 동작한다.
export const COMMANDS = [
  ['north','북쪽','ArrowUp',['ArrowUp','KeyK','Numpad8']],['northEast','북동쪽','u',['KeyU','Numpad9']],
  ['east','동쪽','ArrowRight',['ArrowRight','KeyL','Numpad6']],['southEast','남동쪽','n',['KeyN','Numpad3']],
  ['south','남쪽','ArrowDown',['ArrowDown','KeyJ','Numpad2']],['southWest','남서쪽','b',['KeyB','Numpad1']],
  ['west','서쪽','ArrowLeft',['ArrowLeft','KeyH','Numpad4']],['northWest','북서쪽','y',['KeyY','Numpad7']],
  ['wait','한 턴 대기','.',['Period','Space','Shift+Space','Numpad5']],['pickup','줍기','g',['KeyG','Comma']],
  ['search','시체·용기 수색','s',['KeyS']],['lootAll','모두 가져가기','e',['KeyE']],
  ['rest','10분 휴식','r',['KeyR']],['restHour','1시간 휴식','R',['Shift+KeyR']],['sleep','잠자기','z',['KeyZ','Shift+KeyZ']],
  ['shove','밀치기 방향 선택','p',['KeyP']],['closeDoor','문 닫을 방향 선택','o',['KeyO']],
  ['trip','넘어뜨리기 대상 선택','P',['Shift+KeyP']],['disarm','무장해제 대상 선택','O',['Shift+KeyO']],
  ['crouch','웅크림·서기 전환','Crouch',['Alt+KeyC']],
  ['reaction','방어 반응 전환','v',['KeyV','Shift+KeyV']],['attackMode','공격 방식 전환','q',['KeyQ','Shift+KeyQ']],
  ['inspect','상세 정보 전환','x',['KeyX','Shift+KeyX']],['interact','물 주기·모닥불','w',['KeyW']],
  ['dry','옷 말리기','d',['KeyD']],['stairs','계단 사용','Enter',['Enter','NumpadEnter','Shift+Period','Shift+Comma']],
  ['shoot','사격 조준·확정','f',['KeyF']],['light','등불 켜기·끄기','t',['KeyT']],
  ['character','캐릭터 창','c',['KeyC','Shift+KeyC']],['inventory','소지품 창','i',['KeyI','Shift+KeyI']],
  ['abilities','능력 창','K',['Shift+KeyK']],['body','신체 창','B',['Shift+KeyB']],['journal','일지','J',['Shift+KeyJ']],
  ['map','지도','m',['KeyM','Shift+KeyM']],['craft','제작·정비','F2',['F2']],['society','주민·세력','n',['Shift+KeyN']],
  ['log','기록 크게','L',['Shift+KeyL']],['help','조작법','?',['Shift+Slash']],['sortBag','배낭 자동 정렬','s',['Ctrl+KeyS']],
  ['readAloud','현재 툴팁·기록 읽기','ReadAloud',['Alt+KeyR']],['stopReading','음성 읽기 멈춤','StopReading',['Alt+KeyS']],
  ['hotbar1','빠른 칸 1','1',['Digit1']],['hotbar2','빠른 칸 2','2',['Digit2']],['hotbar3','빠른 칸 3','3',['Digit3']],
  ['hotbar4','빠른 칸 4','4',['Digit4']],['hotbar5','빠른 칸 5','5',['Digit5']],['hotbar6','빠른 칸 6','6',['Digit6']],
  ['hotbar7','빠른 칸 7','7',['Digit7']],['hotbar8','빠른 칸 8','8',['Digit8']],['hotbar9','빠른 칸 9','9',['Digit9']],['hotbar0','빠른 칸 10','0',['Digit0']],
] as const
export type Command=(typeof COMMANDS)[number][0]
export type KeyBindings=Partial<Record<Command,string[]>>
export interface KeyInput {code:string;key:string;ctrlKey:boolean;altKey:boolean;shiftKey:boolean;metaKey:boolean}
const directions=new Set<Command>(COMMANDS.slice(0,8).map((row)=>row[0]))
export const commandLabel=(id:Command)=>COMMANDS.find((row)=>row[0]===id)![1]
export function commandKeys(bindings:KeyBindings,id:Command):readonly string[]{return bindings[id]??COMMANDS.find((row)=>row[0]===id)![3]}
export function keyChord(e:KeyInput):string{
  return `${e.ctrlKey?'Ctrl+':''}${e.altKey?'Alt+':''}${e.shiftKey?'Shift+':''}${e.code}`
}
const CODE=/^(Key[A-Z]|Digit[0-9]|Numpad(?:[0-9]|Enter)|Arrow(?:Up|Down|Left|Right)|F(?:[1-9]|1[0-2])|Space|Period|Comma|Slash|Backslash|Semicolon|Quote|BracketLeft|BracketRight|Backquote|Minus|Equal|Home|End|PageUp|PageDown|Delete|Insert|Backspace|Enter)$/
export function validChord(value:unknown):value is string{
  if(typeof value!=='string')return false
  const parts=value.split('+'),code=parts.pop()!
  return CODE.test(code)&&parts.every((p,i)=>['Ctrl','Alt','Shift'].includes(p)&&parts.indexOf(p)===i)&&parts.join('+')===['Ctrl','Alt','Shift'].filter((p)=>parts.includes(p)).join('+')
}
/** 설정·확정 키는 유지하고 브라우저의 기본 단축키와 충돌하지 않게 한다. */
export function chordError(chord:string,command:Command):string|null{
  if(!validChord(chord))return '배정할 수 있는 키를 눌러야 한다'
  if(chord.split('+').at(-1)==='F3'||chord.split('+').at(-1)?.endsWith('Enter')&&command!=='stairs'||/^Alt\+(F4|ArrowLeft|ArrowRight)$/.test(chord)||/^Ctrl\+(?:Key[LWTNRPOFDU]|Digit[0-9])$/.test(chord)||chord==='Ctrl+KeyS'&&command!=='sortBag')return '설정·확정 또는 브라우저에서 쓰는 키다'
  return null
}
export function bindingError(bindings:KeyBindings,command:Command,chord:string):string|null{
  const error=chordError(chord,command);if(error)return error
  const owner=COMMANDS.find(([id])=>id!==command&&commandKeys(bindings,id).includes(chord))
  return owner?`${owner[1]}에 이미 배정된 키다`:null
}
export function normalizeBindings(raw:unknown):KeyBindings{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return {}
  const source=raw as Record<string,unknown>,out:KeyBindings={}
  for(const[id]of COMMANDS){const value=source[id];if(Array.isArray(value)&&value.length<=8&&value.every((v)=>typeof v==='string'&&!chordError(v,id)))out[id]=[...new Set(value)]}
  // 손상된 중복은 기본 배치로 돌아간다. 기본 키를 없앤 정상 재배정은 보존한다.
  const owned=new Set<string>()
  for(const[id]of COMMANDS)for(const chord of commandKeys(out,id)){if(owned.has(chord))return {};owned.add(chord)}
  return out
}
export interface ResolvedKey {command:Command;key:string;code:string;ctrlKey:boolean;shiftKey:boolean;metaKey:boolean;altKey:boolean}
export function resolveGameKey(e:KeyInput,bindings:KeyBindings):ResolvedKey|null{
  if(e.metaKey||!e.code)return null
  const chord=keyChord(e)
  let row=COMMANDS.find(([id])=>commandKeys(bindings,id).includes(chord)),extraCtrl=false,extraShift=false
  if(!row){
    // 방향에 추가한 Ctrl/Shift만 방향 전환/밀치기로 쓴다. 배정 자체에 든 수식 키는 소비한다.
    let specificity=-1
    for(const candidate of COMMANDS){if(!directions.has(candidate[0]))continue
      for(const bind of commandKeys(bindings,candidate[0])){
        const parts=bind.split('+'),code=parts.pop()!,ctrl=parts.includes('Ctrl'),shift=parts.includes('Shift'),alt=parts.includes('Alt')
        if(code!==e.code||alt!==e.altKey||ctrl&&!e.ctrlKey||shift&&!e.shiftKey)continue
        const score=Number(ctrl)+Number(shift)+Number(alt)
        if(score>specificity){specificity=score;row=candidate;extraCtrl=e.ctrlKey&&!ctrl;extraShift=e.shiftKey&&!shift}
      }
    }
  }
  if(!row)return null
  let key:string=row[2],code:string=key
  if(directions.has(row[0])){
    const index=COMMANDS.indexOf(row),canonical=['ArrowUp','Numpad9','ArrowRight','Numpad3','ArrowDown','Numpad1','ArrowLeft','Numpad7'][index]
    key=canonical;code=canonical
  }else if(row[0]==='wait'&&e.code==='Space')key=' '
  return{command:row[0],key,code,ctrlKey:row[0]==='sortBag'||extraCtrl,shiftKey:extraShift,metaKey:false,altKey:false}
}
export function bindingText(bindings:KeyBindings,command:Command):string{return commandKeys(bindings,command).map(chordLabel).join(' / ')||'미배정'}
export function chordLabel(chord:string):string{
  return chord.replace(/Key([A-Z])/g,'$1').replace(/Digit([0-9])/g,'$1').replace(/Numpad([0-9])/g,'숫자패드 $1').replace('NumpadEnter','숫자패드 Enter').replace('ArrowUp','↑').replace('ArrowRight','→').replace('ArrowDown','↓').replace('ArrowLeft','←').replace('Space','공백').replace('Period','.').replace('Comma',',').replace('Slash','/').replace('Semicolon',';')
}
function oneHandBindings(chosen:Partial<Record<Command,string>>):KeyBindings{
  const out:KeyBindings=Object.fromEntries(COMMANDS.map(([id,,,keys])=>[id,[...keys]])),used=new Set(Object.values(chosen))
  for(const[id]of COMMANDS)out[id]=out[id]!.filter((key)=>!used.has(key))
  for(const[id,key]of Object.entries(chosen)as[Command,string][])out[id]=[key]
  return out
}
export function leftHandBindings():KeyBindings{return oneHandBindings({north:'KeyW',northEast:'KeyE',east:'KeyD',southEast:'KeyC',south:'KeyX',southWest:'KeyZ',west:'KeyA',northWest:'KeyQ',wait:'KeyS',lootAll:'Alt+KeyE',pickup:'KeyR',search:'KeyF',rest:'KeyT',restHour:'Shift+KeyT',sleep:'KeyG',trip:'Alt+KeyB',disarm:'Alt+KeyG',shove:'KeyV',closeDoor:'KeyB',interact:'Alt+KeyW',reaction:'Alt+KeyV',attackMode:'Alt+KeyQ',inspect:'Alt+KeyX',dry:'Alt+KeyD',shoot:'Alt+KeyF',light:'Alt+KeyT',character:'F1',inventory:'F4',abilities:'F5',body:'F6',journal:'F7',map:'F8',society:'F9',help:'F10'})}
export function rightHandBindings():KeyBindings{return oneHandBindings({north:'KeyO',northEast:'KeyP',east:'Semicolon',southEast:'Slash',south:'Period',southWest:'Comma',west:'KeyK',northWest:'KeyI',wait:'KeyL',pickup:'KeyU',search:'KeyJ',rest:'KeyH',restHour:'Shift+KeyH',sleep:'KeyN',trip:'Alt+KeyY',disarm:'Alt+KeyM',shove:'KeyY',closeDoor:'KeyM',interact:'Alt+KeyO',reaction:'Alt+KeyP',attackMode:'Alt+KeyK',inspect:'Alt+KeyL',dry:'Alt+Semicolon',stairs:'Enter',shoot:'Alt+KeyJ',light:'Alt+KeyU',character:'F1',inventory:'F4',abilities:'F5',body:'F6',journal:'F7',map:'F8',society:'F9',help:'F10'})}

export const primaryBindingText=(bindings:KeyBindings,command:Command)=>{const key=commandKeys(bindings,command)[0];return key?chordLabel(key):'미배정'}
