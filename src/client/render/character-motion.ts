/** Presentation clocks only. No world time, resources, RNG or action rules. */
export const motionNames=['idle','walk','attack','block','hurt','crouchDown','crouchWalk','stand','work','use','fall','rise','sleep','shoot','throw','interact']as const
export type MotionName=typeof motionNames[number]
export type ActionPose=Exclude<MotionName,'idle'|'walk'|'crouchWalk'|'fall'|'sleep'>
export const motionDurations:Record<MotionName,number>={idle:1300,walk:300,attack:280,block:220,hurt:240,crouchDown:180,crouchWalk:300,stand:180,work:700,use:650,fall:420,rise:360,sleep:2400,shoot:340,throw:340,interact:380}
const priority:Record<ActionPose,number>={attack:3,block:5,hurt:6,crouchDown:2,stand:2,work:1,use:2,rise:4,shoot:3,throw:3,interact:2}
export interface PoseCue {kind:ActionPose;elapsed:number;prop?:string}
export interface PoseClock {current:PoseCue|null;queue:PoseCue[]}
export const createPoseClock=():PoseClock=>({current:null,queue:[]})
export function clearPoses(clock:PoseClock){clock.current=null;clock.queue=[]}
export function requestPose(clock:PoseClock,kind:ActionPose,prop?:string){
 const cue:PoseCue={kind,elapsed:0,prop},active=clock.current
 if(!active){clock.current=cue;return}
 if(kind==='stand'&&active.kind==='crouchDown'||kind==='crouchDown'&&active.kind==='stand'){
  clock.current={kind,elapsed:Math.max(0,motionDurations[kind]*(1-active.elapsed/motionDurations[active.kind])-1e-6),prop};clock.queue=[];return
 }
 // Physical reactions interrupt a swing; stale work never resumes after damage.
 if(priority[kind]>priority[active.kind]){clock.current=cue;clock.queue=[];return}
 if(priority[kind]<priority[active.kind])return
 if(kind==='work'||kind==='use'||kind==='interact'){
  if(kind!==active.kind){clock.current=cue;clock.queue=[]}
  return
 }
 if(clock.queue.length<2)clock.queue.push(cue)
}
export function advancePose(clock:PoseClock,dt:number,instant=false){
 if(instant){clearPoses(clock);return}
 let remaining=Math.max(0,Math.min(96,dt))
 while(clock.current&&remaining>0){
  const cue=clock.current,part=Math.min(remaining,motionDurations[cue.kind]-cue.elapsed)
  cue.elapsed+=part;remaining-=part
  if(cue.elapsed>=motionDurations[cue.kind])clock.current=clock.queue.shift()??null
 }
}
export function poseFrame(count:number,phase:number,loop=false){
 if(count<=1)return 0
 const normalized=loop?((phase%1)+1)%1:Math.max(0,Math.min(1,phase))
 return Math.min(count-1,Math.floor(normalized*count))
}
