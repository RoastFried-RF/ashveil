// 브라우저가 보낸 실제 keydown만 통과시킨다. 타이머로 새 행동을 만들지 않는다.
export interface KeyRepeatSettings {keyRepeatMode:'system'|'limited'|'once';keyRepeatDelay:number;keyRepeatInterval:number}
export class KeyRepeatGate {
 private held=new Map<string,{start:number;last:number}>()
 clear(){this.held.clear()}
 release(code:string){this.held.delete(code)}
 accept(input:{code:string;repeat:boolean},at:number,settings:KeyRepeatSettings){
  if(!Number.isFinite(at)||at<0||!input.code)return false
  if(!input.repeat){this.held.set(input.code,{start:at,last:at});return true}
  const held=this.held.get(input.code)
  if(!held||at<held.last)return false
  if(settings.keyRepeatMode==='once')return false
  if(settings.keyRepeatMode==='limited'&&(at-held.start<settings.keyRepeatDelay||at-held.last<settings.keyRepeatInterval))return false
  held.last=at;return true
 }
}
