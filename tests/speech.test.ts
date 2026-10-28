import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest'
import {nextTick} from 'vue'
import {preferences} from '../src/client/preferences'
import {speakText,speechStatus,speechSupported,stopSpeech,spokenChunks,visibleReadingText} from '../src/client/speech'
class Utterance {lang='';rate=1;voice:unknown;onend?:()=>void;onerror?:()=>void;constructor(public text:string){}}
let spoken:Utterance[],cancel:ReturnType<typeof vi.fn>
beforeEach(async()=>{spoken=[];cancel=vi.fn();vi.stubGlobal('window',{speechSynthesis:{cancel,getVoices:()=>[{lang:'en-US'},{lang:'ko-KR'}],speak:(u:Utterance)=>spoken.push(u)}});vi.stubGlobal('SpeechSynthesisUtterance',Utterance);preferences.speechEnabled=true;preferences.speechRate=1;await nextTick()})
afterEach(async()=>{preferences.speechEnabled=false;preferences.language='ko';await nextTick();vi.unstubAllGlobals()})
describe('명시적으로 요청한 화면 문구의 음성 API 연결',()=>{
 it('한국어 음성/현재 속도로 요청한 문구만 보낸다',()=>{preferences.speechRate=1.4;expect(speakText('표시된 기록.')).toBe(true);expect(spoken).toHaveLength(1);expect(spoken[0]).toMatchObject({text:'표시된 기록.',lang:'ko-KR',rate:1.4,voice:{lang:'ko-KR'}})})
 it('영어 표시에는 영어 음성을 쓰고 번역되지 않은 한국어 기록은 보존한다',async()=>{preferences.language='en';await nextTick();speakText('Read the visible log.');expect(spoken.at(-1)).toMatchObject({text:'Read the visible log.',lang:'en-US',voice:{lang:'en-US'}});speakText('기존 한국어 기록');expect(spoken.at(-1)).toMatchObject({text:'기존 한국어 기록',lang:'ko-KR',voice:{lang:'ko-KR'}})})
 it('언어를 바꾸면 이전 언어의 진행 중 읽기를 취소한다',async()=>{speakText('기존 한국어 기록');const old=spoken[0],n=cancel.mock.calls.length;preferences.language='en';await nextTick();expect(cancel.mock.calls.length).toBe(n+1);old.onend?.();expect(speechStatus.value).toBe('읽기를 멈췄다')})
 it('설정이 꺼져 있으면 새 음성 요청을 만들지 않는다',()=>{preferences.speechEnabled=false;expect(speakText('표시된 기록')).toBe(false);expect(spoken).toEqual([])})
 it('미지원 브라우저에서 예외 대신 실제 지원 상태를 알려 준다',()=>{vi.stubGlobal('window',{});expect(speechSupported()).toBe(false);expect(speakText('표시된 기록')).toBe(false);expect(speechStatus.value).toContain('지원하지 않는다');expect(()=>stopSpeech()).not.toThrow()})
 it('새 요청 전에 이전 음성 큐를 취소하고 현재 마지막 조각만 완료 표시한다',()=>{speakText('첫 요청');const old=spoken[0];speakText('새 요청');expect(cancel).toHaveBeenCalledTimes(2);old.onend?.();expect(speechStatus.value).toContain('읽는 중');spoken[1].onend?.();expect(speechStatus.value).toBe('읽기를 마쳤다')})
 it('중단 후 과거 완료/실패 콜백이 상태를 덮지 않는다',()=>{speakText('첫 요청');stopSpeech();spoken[0].onend?.();spoken[0].onerror?.();expect(speechStatus.value).toBe('읽기를 멈췄다')})
 it('읽기 지원을 끄면 진행 중 음성도 취소한다',async()=>{speakText('첫 요청');const n=cancel.mock.calls.length;preferences.speechEnabled=false;await nextTick();expect(cancel.mock.calls.length).toBe(n+1);expect(speechStatus.value).toBe('읽기를 멈췄다')})
 it('실패한 조각이 있으면 마지막 완료가 성공으로 바꾸지 않는다',()=>{speakText('가'.repeat(400));spoken[0].onerror?.();spoken.at(-1)!.onend?.();expect(speechStatus.value).toContain('마치지 못했다')})
 it('빈 문구는 이전 요청을 불필요하게 지우거나 새 음성을 만들지 않는다',()=>{expect(speakText(' \n\t ')).toBe(false);expect(spoken).toHaveLength(0);expect(cancel).not.toHaveBeenCalled()})
 it('긴 문구는 총3000자/각220자 이내의 유한 조각으로 제한한다',()=>{const chunks=spokenChunks('기록 '.repeat(2000));expect(chunks.length).toBeLessThanOrEqual(15);expect(chunks.every(c=>c.length<=220&&c.trim())).toBe(true);expect(chunks.join('').length).toBeLessThanOrEqual(3000)})
 it('현재 표시된 툴팁을 우선하고 숨긴 정보는 읽지 않는다',()=>{
  vi.stubGlobal('getComputedStyle',(e:{hidden?:boolean})=>({visibility:e.hidden?'hidden':'visible'}))
  const element=(text:string,shown=true,hidden=false)=>({innerText:text,getClientRects:()=>shown?[{}]:[],hidden})
  const rows:Record<string,unknown[]>={'[data-testid="tooltip"]':[element('숨긴 비밀',false),element('현재 표시된 툴팁')],'[data-testid="hover"]':[element('커서 정보')],'[data-testid="log"]':[element('기록')]},root={querySelectorAll:(s:string)=>rows[s]??[]}as unknown as ParentNode
  expect(visibleReadingText(root)).toBe('현재 표시된 툴팁');rows['[data-testid="tooltip"]']=[element('가린 정보',true,true)];expect(visibleReadingText(root)).toBe('커서 정보');rows['[data-testid="hover"]']=[];expect(visibleReadingText(root)).toBe('기록');rows['[data-testid="log"]']=[];expect(visibleReadingText(root)).toBe('')
 })
})
