// Isolated2D display assumptions. No Core types/state or physical3D reconstruction.
export const CFG=Object.freeze({bodyScale:.05,headScale:.05,pitch:11.2,firstOffset:6.35,tailOffset:9.9,upper:8.5,lower:8.25,outreach:11.8,stride:14,swingTravel:3.6,settleSeconds:.30,maxCurve:.095,maxSwing:8,baseSpeed:16,maxSubstep:.10});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),mul=(a,n)=>({x:a.x*n,y:a.y*n});
export const len=v=>Math.hypot(v.x,v.y),dist=(a,b)=>len(sub(a,b));
const lerp=(a,b,t)=>add(mul(a,1-t),mul(b,t));
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};
const norm=v=>mul(v,1/(len(v)||1));
export const deltaAngle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export const forward=a=>({x:Math.cos(a),y:Math.sin(a)});
export const right=a=>({x:-Math.sin(a),y:Math.cos(a)});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
export function solveTwoLink(hip,foot,u,l,back){
  const v=sub(foot,hip),requested=len(v),axis=requested>1e-9?mul(v,1/requested):{x:1,y:0};
  const d=Math.max(Math.abs(u-l)+1e-7,Math.min(u+l-1e-7,requested));
  const along=(u*u-l*l+d*d)/(2*d),h=Math.sqrt(Math.max(0,u*u-along*along));
  let normal={x:-axis.y,y:axis.x};if(dot(normal,back)<0)normal=mul(normal,-1);
  const knee=add(hip,add(mul(axis,along),mul(normal,h))),end=add(hip,mul(axis,d));
  return {hip,knee,end,error:dist(end,foot),requestedDistance:requested,unreachable:Math.abs(requested-d)>1e-5};
}
// Both source points map exactly; mirrored display reverses perpendicular direction only.
export function pinMatrix(a,b,A,B,mirror=false){
  const sv=sub(b,a),tv=sub(B,A),sl=len(sv),tl=len(tv),u=mul(sv,1/sl),v={x:-u.y,y:u.x},t=mul(tv,1/(tl||1)),n={x:-t.y,y:t.x};
  const scale=tl/sl,sign=mirror?-1:1;
  const m={a:scale*(t.x*u.x+sign*n.x*v.x),b:scale*(t.y*u.x+sign*n.y*v.x),c:scale*(t.x*u.y+sign*n.x*v.y),d:scale*(t.y*u.y+sign*n.y*v.y)};
  m.e=A.x-m.a*a.x-m.c*a.y;m.f=A.y-m.b*a.x-m.d*a.y;return m;
}
export const applyMatrix=(m,p)=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f});
export function bodyMatrix(pivot,target,heading,scale){const R=right(heading),F=forward(heading);const m={a:R.x*scale,b:R.y*scale,c:-F.x*scale,d:-F.y*scale};m.e=target.x-m.a*pivot.x-m.c*pivot.y;m.f=target.y-m.b*pivot.x-m.d*pivot.y;return m;}
export class CrawlerRig{
  constructor(){
    this.root={x:0,y:0};this.heading=0;this.distance=0;this.time=0;this.owner='crawler-v374-'+crypto.randomUUID();this.trail=[];this.events=[];
    for(let s=-180;s<=0;s+=.5)this.trail.push({s,x:s,y:0});
    this.legs=[];this.metrics={steps:0,maxReachError:0,maxStanceDrift:0,minStance:16,maxSwing:0,maxLinkLengthError:0};
    const bodies=this.bodies();
    for(let i=0;i<8;i++)for(const side of [-1,1]){
      const name=side===-1?'Left':'Right',phase=(i*2+(side===-1?0:9))%16,nextLift=phase*CFG.stride/16;
      const base=this.nominal(bodies[i],side),lead=nextLift-(CFG.stride-CFG.swingTravel)/2;
      const anchor=add(base,mul(forward(bodies[i].heading),lead));
      this.legs.push({id:`Segment${i+1}${name}Leg`,ownerId:bodies[i].id,index:i,side,phase,nextLift,anchor,foot:{...anchor},epoch:0,swing:null});
    }
  }
  sample(s){
    const a=this.trail;if(s<=a[0].s)return {x:a[0].x+(s-a[0].s),y:a[0].y};
    if(s>=this.distance)return {...this.root};
    let lo=0,hi=a.length-1;while(hi-lo>1){let m=(lo+hi)>>1;if(a[m].s>s)hi=m;else lo=m;}
    return lerp(a[lo],a[hi],(s-a[lo].s)/(a[hi].s-a[lo].s));
  }
  bodies(){
    return Array.from({length:8},(_,i)=>{
      const offset=CFG.firstOffset+(i<7?i*CFG.pitch:6*CFG.pitch+CFG.tailOffset),s=this.distance-offset;
      const p=this.sample(s),before=this.sample(s-2.2),after=this.sample(s+2.2);
      const heading=Math.atan2(after.y-before.y,after.x-before.x);
      return {id:i===7?'TailSegment8':`Segment${i+1}`,index:i+1,source:i===7?'tailPlate':'middlePlate',position:p,heading,arcOffset:offset};
    });
  }
  hip(body,side){const half=body.index===8?102*CFG.bodyScale:134*CFG.bodyScale;return add(body.position,mul(right(body.heading),side*half));}
  nominal(body,side){return add(this.hip(body,side),mul(right(body.heading),side*CFG.outreach));}
  beginSwing(leg,body){
    const F=forward(body.heading),lead=(CFG.stride-CFG.swingTravel)/2+CFG.swingTravel;
    leg.swing={start:{...leg.foot},end:add(this.nominal(body,leg.side),mul(F,lead)),at:this.distance,progress:0};
    leg.nextLift=this.distance+CFG.stride;
    this.events.push({type:'lift',id:leg.id,distance:this.distance,time:this.time,anchor:{...leg.anchor}});
  }
  update(seconds,running,desired,speed){
    const dt=Math.max(0,Math.min(seconds,.075))*speed;if(dt===0)return;
    const travel=running?CFG.baseSpeed*dt:0,steps=Math.max(1,Math.ceil(travel/CFG.maxSubstep));
    for(let j=0;j<steps;j++){
      const ds=travel/steps,dsTime=dt/steps;this.time+=dsTime;
      if(ds>0){const turn=deltaAngle(this.heading,desired),limit=CFG.maxCurve*ds;this.heading+=Math.max(-limit,Math.min(limit,turn));this.root=add(this.root,mul(forward(this.heading),ds));this.distance+=ds;this.trail.push({s:this.distance,...this.root});while(this.trail.length>2&&this.trail[1].s<this.distance-180)this.trail.shift();}
      const bodies=this.bodies();let swinging=this.legs.filter(l=>l.swing).length;
      const pending=this.legs.filter(l=>!l.swing).map(l=>{const body=bodies[l.index],hip=this.hip(body,l.side);return {l,body,d:dist(hip,l.anchor),due:this.distance>=l.nextLift};}).sort((a,b)=>b.d-a.d);
      if(ds>0)for(const p of pending){
        const urgent=p.d>CFG.upper+CFG.lower-2.6;
        if((p.due||urgent)&&swinging<CFG.maxSwing){this.beginSwing(p.l,p.body);swinging++;}
      }
      for(const leg of this.legs){
        if(leg.swing){const s=leg.swing;s.progress=Math.min(1,s.progress+(ds>0?ds/CFG.swingTravel:dsTime/CFG.settleSeconds));const t=smooth(s.progress),p=lerp(s.start,s.end,t);
          // Overhead recovery arc only, no claimed3D foot lift/underside.
          const out=mul(right(bodies[leg.index].heading),leg.side*1.2*Math.sin(Math.PI*t));leg.foot=add(p,out);
          if(s.progress>=1){leg.foot={...s.end};leg.anchor={...s.end};leg.epoch++;leg.swing=null;this.metrics.steps++;this.events.push({type:'plant',id:leg.id,epoch:leg.epoch,distance:this.distance,time:this.time,anchor:{...leg.anchor}});}
        }else{leg.foot={...leg.anchor};}
      }
      const pose=this.pose();this.metrics.maxReachError=Math.max(this.metrics.maxReachError,...pose.legs.map(l=>l.error));this.metrics.maxStanceDrift=Math.max(this.metrics.maxStanceDrift,...pose.legs.filter(l=>l.contact).map(l=>dist(l.end,l.anchor)));this.metrics.minStance=Math.min(this.metrics.minStance,pose.legs.filter(l=>l.contact).length);this.metrics.maxSwing=Math.max(this.metrics.maxSwing,pose.legs.filter(l=>!l.contact).length);this.metrics.maxLinkLengthError=Math.max(this.metrics.maxLinkLengthError,...pose.legs.flatMap(l=>[Math.abs(dist(l.hip,l.knee)-CFG.upper),Math.abs(dist(l.knee,l.end)-CFG.lower)]));
    }
    if(this.events.length>240)this.events.splice(0,this.events.length-240);
  }
  pose(){
    const bodies=this.bodies();return {root:{...this.root},heading:this.heading,distance:this.distance,time:this.time,bodies,legs:this.legs.map(l=>{const body=bodies[l.index],hip=this.hip(body,l.side);return {...l,anchor:{...l.anchor},foot:{...l.foot},contact:!l.swing,swingProgress:l.swing?.progress??null,...solveTwoLink(hip,l.foot,CFG.upper,CFG.lower,mul(forward(body.heading),-1))};})};
  }
}
