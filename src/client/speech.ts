// 읽기 지원은 화면에 이미 표시한 텍스트만 사용한다. 자동 재생·게임 상태 조회가 없다.
import {ref,watch} from 'vue'
import {preferences} from './preferences'
export const speechStatus=ref('')
let generation=0
export function speechSupported(){return typeof window!=='undefined'&&!!window.speechSynthesis&&typeof window.speechSynthesis.speak==='function'&&typeof window.speechSynthesis.cancel==='function'&&typeof window.speechSynthesis.getVoices==='function'&&typeof SpeechSynthesisUtterance==='function'}
export function stopSpeech(){generation++;if(speechSupported())window.speechSynthesis.cancel();speechStatus.value='읽기를 멈췄다'}
export function spokenChunks(text:string):string[]{
 const clean=text.replace(/[\t ]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,3000),out:string[]=[]
 let left=clean
 while(left){let cut=Math.min(220,left.length);if(cut<left.length){const end=Math.max(left.lastIndexOf('. ',cut),left.lastIndexOf('。',cut),left.lastIndexOf('\n',cut));if(end>80)cut=end+1}const part=left.slice(0,cut).trim();if(part)out.push(part);left=left.slice(cut).trim()}
 return out
}
export function speakText(text:string):boolean{
 if(!preferences.speechEnabled){speechStatus.value='설정에서 읽기 지원을 켜야 한다';return false}
 if(!speechSupported()){speechStatus.value='이 브라우저에서는 음성 읽기를 지원하지 않는다';return false}
 const chunks=spokenChunks(text);if(!chunks.length){speechStatus.value='읽을 문구가 없다';return false}
 const synth=window.speechSynthesis,voice=synth.getVoices().find(v=>v.lang.toLowerCase().startsWith('ko'))
 const current=++generation;let failed=false
 synth.cancel();speechStatus.value='화면의 문구를 읽는 중'
 for(let i=0;i<chunks.length;i++){
  const utterance=new SpeechSynthesisUtterance(chunks[i]);utterance.lang='ko-KR';utterance.rate=preferences.speechRate;if(voice)utterance.voice=voice
  utterance.onerror=()=>{if(current===generation){failed=true;speechStatus.value='음성 읽기를 마치지 못했다'}}
  if(i===chunks.length-1)utterance.onend=()=>{if(current===generation&&!failed)speechStatus.value='읽기를 마쳤다'}
  synth.speak(utterance)
 }
 return true
}
const visible=(element:HTMLElement)=>element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden'
export function visibleReadingText(root:ParentNode=document):string{
 for(const selector of ['[data-testid="tooltip"]','[data-testid="hover"]','[data-testid="log"]']){
  const element=[...root.querySelectorAll<HTMLElement>(selector)].find(visible)
  if(element?.innerText.trim())return element.innerText.trim().slice(-3000)
 }
 return''
}
export function readVisibleText(){return speakText(visibleReadingText())}
watch(()=>preferences.speechEnabled,enabled=>{if(!enabled)stopSpeech()})
