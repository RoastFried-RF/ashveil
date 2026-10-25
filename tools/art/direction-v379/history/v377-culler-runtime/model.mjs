// Dedicated six-drive / two-tool FRONT-plane prototype. No game or Core imports.
export const LEG_IDS=['RF','RM','RH','LF','LM','LH'];
export const TRIPODS=[['RF','LM','RH'],['LF','RM','LH']];
export const TOOL_IDS=['right','left'];
const copy=x=>structuredClone(x),smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)},mix=(a,b,t)=>a+(b-a)*t;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const rest={RF:{x:-36,y:12},RM:{x:-42,y:-12},RH:{x:-31,y:-34},LF:{x:36,y:12},LM:{x:42,y:-12},LH:{x:31,y:-34}};
export function solve2D(a,b,upper,lower,side){
 const dx=b.x-a.x,dy=b.y-a.y,requested=Math.hypot(dx,dy),d=Math.max(Math.abs(upper-lower)+1e-7,Math.min(upper+lower-1e-7,requested));
 const ux=requested>1e-9?dx/requested:0,uy=requested>1e-9?dy/requested:1,along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
 const normals=[{x:-uy,y:ux},{x:uy,y:-ux}],normal=normals.reduce((a,b)=>a.x*side>b.x*side?a:b);
 const knee={x:a.x+ux*along+normal.x*height,y:a.y+uy*along+normal.y*height},end={x:a.x+ux*d,y:a.y+uy*d};
 return{hip:copy(a),knee,ankle:end,requestedAnkle:copy(b),reachError:distance(end,b),upperLength:distance(a,knee),lowerLength:distance(knee,end)};
}
export function uniformPinMatrix(sourceA,sourceB,targetA,targetB,flipX=false){
 const flip=flipX?-1:1,sx=sourceB.x-sourceA.x,sy=sourceB.y-sourceA.y,dx=targetB.x-targetA.x,dy=targetB.y-targetA.y,scale=Math.hypot(dx,dy)/Math.hypot(sx,sy),angle=Math.atan2(dy,dx)-Math.atan2(sy,sx*flip),co=Math.cos(angle),si=Math.sin(angle);
 const a=co*scale*flip,b=si*scale*flip,c=-si*scale,d=co*scale;
 return{a,b,c,d,e:targetA.x-a*sourceA.x-c*sourceA.y,f:targetA.y-b*sourceA.x-d*sourceA.y,scale,flipX};
}
export function transformPoint(m,p){return{x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f}}
export function hull(points){const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),half=list=>{const h=[];for(const p of list){while(h.length>1&&cross(h.at(-2),h.at(-1),p)<=0)h.pop();h.push(p)}return h};return sorted.length<3?sorted:[...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)]}
function margin(points,p){const h=hull(points);if(h.length<3)return null;return Math.min(...h.map((a,i)=>{const b=h[(i+1)%h.length];return((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x))/(Math.hypot(b.x-a.x,b.y-a.y)||1)}))}
const angles={guard:[2.94,1.18],windup:[3.75,2.30],contact:[2.10,.20],follow:[1.15,.45]};
const phases=[['windup',.28],['contact',.12],['follow',.24],['recover',.36]];
export class CullerModel{
 constructor(contract){this.contract=contract;this.owner=0;this.reset()}
 reset(){
  this.owner++;this.root={x:0,y:0};this.distance=0;this.clock=0;this.wallClock=0;this.speed=1;this.walking=false;this.queuedDistance=0;this.swing=null;this.nextTripod=0;this.zeroMoveClock=0;this.hurt=0;this.dead=false;this.deathProgress=0;this.events=[];this.tools=Object.fromEntries(TOOL_IDS.map(id=>[id,{id,state:'guard',at:0,angles:[...angles.guard],from:[...angles.guard]}]));
  this.feet=Object.fromEntries(LEG_IDS.map(id=>[id,{...rest[id],lift:0,contact:true}]));this.metrics={maxReachError:0,maxLengthError:0,maxContinuousContactSlip:0,minProjectedSupportMargin:Infinity,phaseEntries:[],instantResets:0,updates:0};this.previousContact=null;this.event('reset',{owner:this.owner});
 }
 event(type,data={}){this.events.push({type,clock:this.clock,distance:this.distance,...data});if(this.events.length>500)this.events.shift()}
 instantReset(reason){this.owner++;this.feet=Object.fromEntries(LEG_IDS.map(id=>[id,{x:this.root.x+rest[id].x,y:this.root.y+rest[id].y,lift:0,contact:true}]));this.swing=null;this.previousContact=null;this.metrics.instantResets++;this.event('instant-reset',{reason,owner:this.owner})}
 setSpeed(speed){if(![0,.5,1,2].includes(speed))throw Error('Unsupported speed');this.speed=speed;if(speed===0){this.instantReset('animation0 suppresses interpolation');for(const tool of Object.values(this.tools)){if(tool.state!=='guard')this.event('instant-tool-finish',{tool:tool.id,from:tool.state});Object.assign(tool,{state:'guard',angles:[...angles.guard],at:0})}}this.event('speed',{speed})}
 toggleWalk(){if(this.dead)return;this.walking=!this.walking;if(!this.walking){this.queuedDistance=0;this.stopMotion()}this.event(this.walking?'walk-start':'walk-stop')}
 stop(){this.walking=false;this.queuedDistance=0;this.stopMotion();this.event('walk-stop')}
 step(){if(this.dead)return;if(this.speed===0){this.root.y+=12;this.distance+=12;this.instantReset('one DOM step at animation0')}else this.queuedDistance=Math.min(24,this.queuedDistance+12);this.event('step-input')}
 stopMotion(){
  if(!this.swing||this.swing.kind==='settle')return;
  const group=this.swing.ids,start=Object.fromEntries(group.map(id=>[id,copy(this.feet[id])])),end=Object.fromEntries(group.map(id=>[id,{x:this.root.x+rest[id].x,y:this.root.y+rest[id].y+3}]));
  this.swing={kind:'settle',ids:group,start,end,progress:0};this.event('settle-start',{ids:group});
 }
 startTool(id){
  if(this.dead||this.hurt>0)return false;this.stop();
  if(this.speed===0){this.event('instant-tool-phases',{tool:id,phases:['windup','contact','follow','recover','guard']});this.tools[id].state='guard';this.tools[id].angles=[...angles.guard];return true}
  const t=this.tools[id];Object.assign(t,{state:'supportWait',at:0,from:[...t.angles]});this.event('tool-support-wait',{tool:id});return true;
 }
 recoverTool(t,reason){if(t.state==='guard')return;t.from=[...t.angles];t.state='interruptedRecover';t.at=0;this.event('tool-interrupted',{tool:t.id,reason})}
 cancel(){for(const t of Object.values(this.tools))this.recoverTool(t,'cancel-button');this.event('cancel-input')}
 hit(){if(this.dead)return;this.stop();this.hurt=.30;for(const t of Object.values(this.tools))this.recoverTool(t,'hurt');this.event('hurt-input')}
 die(){if(this.dead)return;this.stop();this.dead=true;this.deathProgress=0;for(const t of Object.values(this.tools)){t.from=[...t.angles];t.state='dead';t.at=0}if(this.speed===0)this.deathProgress=1;this.event('death-input')}
 updateTools(dt){
  for(const t of Object.values(this.tools)){
   if(t.state==='guard')continue;
   if(t.state==='dead'){const p=smooth(this.deathProgress);t.angles=t.from.map((v,i)=>mix(v,[2.30,-1.05][i],p));continue}
   if(t.state==='supportWait'){if(LEG_IDS.every(id=>this.feet[id].contact)&&!this.swing){t.state='windup';t.at=0;t.from=[...t.angles];this.event('tool-phase',{tool:t.id,phase:'windup'});this.metrics.phaseEntries.push(`${t.id}:windup`)}continue}
   t.at+=dt;
   if(t.state==='interruptedRecover'){const p=smooth(t.at/.32);t.angles=t.from.map((v,i)=>mix(v,angles.guard[i],p));if(t.at>=.32){t.state='guard';t.angles=[...angles.guard];this.event('tool-phase',{tool:t.id,phase:'guard'})}continue}
   const index=phases.findIndex(([name])=>name===t.state),duration=phases[index][1],target=t.state==='recover'?angles.guard:angles[t.state],p=smooth(t.at/(t.state==='contact'?.05:duration));t.angles=t.from.map((v,i)=>mix(v,target[i],p));
   if(t.at>=duration){t.angles=[...target];if(index===phases.length-1){t.state='guard';t.at=0;this.event('tool-phase',{tool:t.id,phase:'guard'})}else{t.state=phases[index+1][0];t.from=[...target];t.at=0;this.event('tool-phase',{tool:t.id,phase:t.state});this.metrics.phaseEntries.push(`${t.id}:${t.state}`)}}
  }
 }
 updateGait(travel,dt,moving){
  if(!this.swing&&moving&&travel>0){const ids=TRIPODS[this.nextTripod];this.nextTripod=(this.nextTripod+1)%TRIPODS.length;this.swing={kind:'distance',ids:[...ids],start:Object.fromEntries(ids.map(id=>[id,copy(this.feet[id])])),end:Object.fromEntries(ids.map(id=>[id,{x:this.root.x+rest[id].x,y:this.root.y+rest[id].y+12}])),at:this.distance,progress:0};this.event('tripod-swing',{ids})}
  if(this.swing&&!moving&&this.swing.kind==='distance')this.stopMotion();
  const s=this.swing;if(!s)return;
  if(s.kind==='distance')s.progress=Math.min(1,(this.distance-s.at)/6);else s.progress=Math.min(1,s.progress+dt/.30);
  const p=s.progress,f=s.kind==='distance'?smooth((p-.12)/.76):smooth(p);
  for(const id of s.ids){const start=s.start[id],end=s.end[id],lift=s.kind==='distance'?2.5*Math.sin(Math.PI*f):(start.lift??0)*(1-f)+1.0*Math.sin(Math.PI*p);this.feet[id]={x:mix(start.x,end.x,f),y:mix(start.y,end.y,f),lift,contact:s.kind==='distance'?(p<=.12||p>=.88):p===0||p===1}}
  if(p>=1){for(const id of s.ids)this.feet[id]={...s.end[id],lift:0,contact:true};this.event(s.kind==='settle'?'settle-end':'tripod-plant',{ids:s.ids});this.swing=null}
 }
 advance(wallSeconds){
  const wall=Math.min(.25,Math.max(0,wallSeconds));this.wallClock+=wall;
  if(this.speed===0){if(this.walking&&!this.dead){this.zeroMoveClock+=wall;if(this.zeroMoveClock>=.6){this.zeroMoveClock-=.6;this.root.y+=6;this.distance+=6;this.instantReset('continuous discrete movement at animation0')}}this.observe();return}
  const total=wall*this.speed,count=Math.max(1,Math.ceil(total/.015));
  for(let i=0;i<count;i++){
   const dt=total/count;this.clock+=dt;this.hurt=Math.max(0,this.hurt-dt);if(this.dead)this.deathProgress=Math.min(1,this.deathProgress+dt/.65);
   const moving=!this.dead&&this.hurt===0&&Object.values(this.tools).every(t=>t.state==='guard')&&(this.walking||this.queuedDistance>0),travel=moving?Math.min(10*dt,this.walking?Infinity:this.queuedDistance):0;
   this.root.y+=travel;this.distance+=travel;if(!this.walking)this.queuedDistance=Math.max(0,this.queuedDistance-travel);this.updateGait(travel,dt,moving&&travel>0);this.updateTools(dt);this.observe();
  }
 }
 pose(){
  const c=this.contract,deathShift=12*smooth(this.deathProgress),hurtShift=this.hurt>0?Math.sin(this.hurt*65)*1.8:0,body={x:this.root.x+hurtShift,y:this.root.y-45+deathShift};
  const attachment=source=>({x:body.x+(source[0]-325)*.18,y:body.y+(source[1]-300)*.18});
  const legs=LEG_IDS.map(id=>{const f=this.feet[id],ankle={x:f.x+.2925,y:f.y-f.lift-6.12},hip=attachment(c.assumedGraphicAttachmentSource[id]),solved=solve2D(hip,ankle,25,27,id.startsWith('R')?-1:1);return{id,ground:{x:f.x,y:f.y},sole:{x:f.x,y:f.y-f.lift},lift:f.lift,contact:f.contact,far:id.endsWith('H')||id.endsWith('M'),...solved}});
  const tools=TOOL_IDS.map(id=>{const t=this.tools[id],shoulder=attachment(c.assumedToolAttachmentSource[id]),flip=id==='left'?-1:1,[upperAngle,bladeAngle]=t.angles,elbow={x:shoulder.x+flip*18*Math.cos(upperAngle),y:shoulder.y+18*Math.sin(upperAngle)},length=Math.hypot(22,354)*.075,tip={x:elbow.x+flip*length*Math.cos(bladeAngle),y:elbow.y+length*Math.sin(bladeAngle)};return{id,state:t.state,angles:[...t.angles],shoulder,elbow,tip,flipX:id==='left'}});
  const contact=legs.filter(l=>l.contact).map(l=>l.ground),projectedCom={x:this.root.x,y:this.root.y-12};return{root:copy(this.root),body,legs,tools,contactHull:hull(contact),projectedCom,projectedSupportMargin:margin(contact,projectedCom),bodySourcePivot:{x:325,y:300},bodyScale:.18,deathShift,hurtShift};
 }
 observe(){
  const p=this.pose();this.metrics.updates++;
  for(const leg of p.legs){this.metrics.maxReachError=Math.max(this.metrics.maxReachError,leg.reachError);this.metrics.maxLengthError=Math.max(this.metrics.maxLengthError,Math.abs(leg.upperLength-25),Math.abs(leg.lowerLength-27));if(leg.contact&&this.previousContact?.owner===this.owner&&this.previousContact.feet[leg.id]?.contact)this.metrics.maxContinuousContactSlip=Math.max(this.metrics.maxContinuousContactSlip,distance(leg.ground,this.previousContact.feet[leg.id]));}
  this.previousContact={owner:this.owner,feet:copy(this.feet)};if(p.projectedSupportMargin!==null)this.metrics.minProjectedSupportMargin=Math.min(this.metrics.minProjectedSupportMargin,p.projectedSupportMargin);
 }
 inspect(){const p=this.pose();return{prototypeOnly:true,limited2DProjectedPlane:true,owner:this.owner,clock:this.clock,wallClock:this.wallClock,speed:this.speed,distance:this.distance,walking:this.walking,queuedDistance:this.queuedDistance,swing:copy(this.swing),hurt:this.hurt,dead:this.dead,deathProgress:this.deathProgress,sourceRegions:6,displayParts:23,phaseStates:Object.fromEntries(p.tools.map(t=>[t.id,t.state])),metrics:copy(this.metrics),pose:p,events:copy(this.events),notApproved:{physical3D:true,oppositeFace:true,innerCuttingEdge:true,fullGameActivation:true,acid:true,net:true,repair:true,release:true}}}
}
