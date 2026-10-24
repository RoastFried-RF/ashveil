/** Presentation clocks only. No world time, resources, RNG or action rules. */
export const motionNames=['idle','walk','flight','attack','block','hurt','crouchDown','crouchWalk','stand','work','wallow','use','fall','rise','sleep','shoot','throw','interact']as const
export type MotionName=typeof motionNames[number]
export type ActionPose=Exclude<MotionName,'idle'|'walk'|'flight'|'crouchWalk'|'fall'|'sleep'>
export const motionDurations:Record<MotionName,number>={idle:3200,walk:720,flight:400,attack:480,block:300,hurt:320,crouchDown:240,crouchWalk:1000,stand:240,work:1000,wallow:2400,use:850,fall:520,rise:600,sleep:3600,shoot:500,throw:500,interact:460}
const priority:Record<ActionPose,number>={attack:3,block:5,hurt:6,crouchDown:2,stand:2,work:1,wallow:1,use:2,rise:4,shoot:3,throw:3,interact:2}
export const posePriority=(kind:ActionPose)=>priority[kind]
export interface PoseCue {machineTask?:'sow'|'spray'|'alarm';kind:ActionPose;elapsed:number;prop?:string;duration?:number;equipment?:import('./equipment-motion').EquipmentAction}
export const poseDuration=(cue:PoseCue)=>cue.duration??motionDurations[cue.kind]
export interface PoseClock {current:PoseCue|null;queue:PoseCue[]}
export const createPoseClock=():PoseClock=>({current:null,queue:[]})
export function clearPoses(clock:PoseClock){clock.current=null;clock.queue=[]}
export function requestPose(clock:PoseClock,kind:ActionPose,prop?:string,options?:Pick<PoseCue,'duration'|'equipment'|'machineTask'>){
 const cue:PoseCue={kind,elapsed:0,prop,...options},active=clock.current
 if(!active){clock.current=cue;return}
 if(kind==='stand'&&active.kind==='crouchDown'||kind==='crouchDown'&&active.kind==='stand'){
  clock.current={kind,elapsed:Math.max(0,motionDurations[kind]*(1-active.elapsed/motionDurations[active.kind])-1e-6),prop};clock.queue=[];return
 }
 // Physical reactions interrupt a swing; stale work never resumes after damage.
 if(priority[kind]>priority[active.kind]){clock.current=cue;clock.queue=[];return}
 if(priority[kind]<priority[active.kind])return
 if(kind==='work'&&active.kind==='work'&&options?.machineTask!==active.machineTask&&(options?.machineTask||active.machineTask)){clock.current=cue;clock.queue=[];return}
 if(kind==='work'||kind==='wallow'||kind==='use'||kind==='interact'){
  if(kind!==active.kind){clock.current=cue;clock.queue=[]}
  return
 }
 if(clock.queue.length<2)clock.queue.push(cue)
}
export function advancePose(clock:PoseClock,dt:number,instant=false){
 if(instant){clearPoses(clock);return}
 let remaining=Math.max(0,Math.min(96,dt))
 while(clock.current&&remaining>0){
  const cue=clock.current,part=Math.min(remaining,poseDuration(cue)-cue.elapsed)
  cue.elapsed+=part;remaining-=part
  if(cue.elapsed>=poseDuration(cue))clock.current=clock.queue.shift()??null
 }
}
export function poseFrame(count:number,phase:number,loop=false){
 if(count<=1)return 0
 const normalized=loop?((phase%1)+1)%1:Math.max(0,Math.min(1,phase))
 return Math.min(count-1,Math.floor(normalized*count))
}
