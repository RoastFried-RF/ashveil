import {ArticulatedGait,project,pinMatrix,type Point,type RigPose,type RigLeg} from '../../../src/client/render/articulated-gait'
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T
const canvas=$<HTMLCanvasElement>('stage'),ctx=canvas.getContext('2d')!
const image=new Image();image.src='sower-front-rig-components-v1.png';await image.decode()
const crops={body:[108,49,574,586],upper:[896,156,201,476],lower:[303,681,172,523],foot:[762,924,397,258]} as const
const pins={upper:[{x:99,y:82},{x:89,y:407}],lower:[{x:55,y:83},{x:72,y:451}]} as const
let rig=new ArticulatedGait(),root:Point={x:0,y:0},pose=rig.pose(),playing=false,speed=1,heading:Point={x:0,y:1},last:number|undefined,frames=0
const snapshots:unknown[]=[]
function apply(seconds:number){
 const dx=heading.x*10*speed*seconds,dy=heading.y*10*speed*seconds
 root={x:root.x+dx,y:root.y+dy};pose=rig.update(root,seconds);frames++
}
$('play').addEventListener('click',()=>{playing=!playing;$('play').textContent=playing?'정지 후 접지':'이동 재개'})
$('step').addEventListener('click',()=>{playing=false;$('play').textContent='이동 재개';apply(.1);draw()})
$('reset').addEventListener('click',()=>{playing=false;root={x:0,y:0};rig=new ArticulatedGait(root,heading);pose=rig.pose();frames=0;$('play').textContent='이동 재개';draw()})
$<HTMLSelectElement>('heading').addEventListener('change',event=>{const n=Number((event.target as HTMLSelectElement).value);heading=[{x:0,y:1},{x:Math.SQRT1_2,y:Math.SQRT1_2},{x:1,y:0},{x:-Math.SQRT1_2,y:Math.SQRT1_2},{x:0,y:-1}][n]})
$<HTMLSelectElement>('speed').addEventListener('change',event=>speed=Number((event.target as HTMLSelectElement).value))
$('capture').addEventListener('click',()=>{snapshots.push(observe());$('captures').textContent=String(snapshots.length)})
function observe(){return{frontOnly:true,procedural:true,authoredRegions:4,authoredWalkFrames:0,playing,frames,heading:{...heading},speed,pose:structuredClone(pose),sourceSha256:'01c034f0dc67699cabc91b55798013446ddbb4fb281fbbdbcb452faa4153dff2',releaseApproved:false}}
Object.defineProperty(window,'observe_sower_rig',{value:()=>structuredClone(observe()),writable:false,configurable:false})
function fragment(part:keyof typeof crops){const [sx,sy,sw,sh]=crops[part];ctx.drawImage(image,sx,sy,sw,sh,0,0,sw,sh)}
function link(part:'upper'|'lower',a:Point,b:Point){
 const matrix=pinMatrix(pins[part][0],pins[part][1],a,b,part==='upper'?.033:.028)
 ctx.save();ctx.transform(matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f);fragment(part);ctx.restore()
}
function leg(leg:RigLeg){
 const hip=project(leg.hip),knee=project(leg.knee),ankle=project(leg.ankle)
 // Foot stays level; the missing underside is not manufactured by a warp.
 ctx.save();ctx.translate(ankle.x-182*.03,ankle.y-87*.03);ctx.scale(.03,.03);fragment('foot');ctx.restore()
 link('lower',knee,ankle);link('upper',hip,knee)
}
function model(p:RigPose){
 for(const l of p.legs.filter(l=>l.far))leg(l)
 const body=project(p.body);ctx.save();ctx.translate(body.x-287*.07,body.y-379*.07);ctx.scale(.07,.07);fragment('body');ctx.restore()
 for(const l of p.legs.filter(l=>!l.far))leg(l)
}
function scene(scale:number,x:number,y:number,debug:boolean){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);const center=project({...root,z:0});ctx.translate(-center.x,-center.y)
 ctx.lineWidth=.25;ctx.strokeStyle='#4b493d';ctx.beginPath()
 const startX=Math.floor((root.x-120)/16)*16,startY=Math.floor((root.y-120)/16)*16
 for(let v=startX;v<root.x+120;v+=16){const a=project({x:v,y:root.y-120,z:0}),b=project({x:v,y:root.y+120,z:0});ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)}
 for(let v=startY;v<root.y+120;v+=16){const a=project({x:root.x-120,y:v,z:0}),b=project({x:root.x+120,y:v,z:0});ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y)}ctx.stroke()
 for(const l of pose.legs){const foot=project({...l.sole,z:0});ctx.fillStyle=l.contact?'#070906aa':'#07090655';ctx.beginPath();ctx.ellipse(foot.x,foot.y-1,5.2,1.8,0,0,Math.PI*2);ctx.fill()}
 model(pose)
 if(debug){
  for(const l of pose.legs){const h=project(l.hip),k=project(l.knee),a=project(l.ankle),s=project(l.sole);ctx.strokeStyle=l.unreachable?'#ff5555':l.contact?'#8cd9ae':'#f7d078';ctx.lineWidth=.35;ctx.beginPath();ctx.moveTo(h.x,h.y);ctx.lineTo(k.x,k.y);ctx.lineTo(a.x,a.y);ctx.stroke();ctx.beginPath();ctx.arc(s.x,s.y,.75,0,Math.PI*2);ctx.stroke()}
 }
 ctx.restore()
}
function draw(){
 ctx.imageSmoothingEnabled=false;ctx.fillStyle='#242720';ctx.fillRect(0,0,canvas.width,canvas.height)
 scene(4,510,370,$<HTMLInputElement>('joints').checked)
 ctx.save();ctx.beginPath();ctx.rect(16,16,180,180);ctx.clip();ctx.fillStyle='#30342b';ctx.fillRect(16,16,180,180);scene(1,106,135,false);ctx.restore()
 ctx.fillStyle='#d0ccb5';ctx.font='14px sans-serif';ctx.fillText('원래 크기 · 1×',28,38);ctx.fillText('동일 원화 · 4× / 정면 고정',360,36)
 const unreachable=pose.legs.filter(l=>l.unreachable).map(l=>l.id)
 $('stat').textContent=`이동 ${pose.distance.toFixed(2)} · 회복 ${pose.swing??'없음'} · 지지 ${pose.legs.filter(l=>l.contact).length}/4 · 관절 오차 ${Math.max(...pose.legs.map(l=>l.error)).toFixed(4)} · 지지 여유 ${pose.supportMargin.toFixed(2)} · 도달 불가 ${unreachable.join(',')||'없음'}`
 canvas.dataset.frame=String(frames);canvas.dataset.swing=pose.swing??'none';canvas.dataset.contacts=String(pose.legs.filter(l=>l.contact).length);canvas.dataset.errors=String(unreachable.length)
}
function loop(now:number){const dt=last===undefined?0:Math.max(0,Math.min(.05,(now-last)/1000));last=now;if(playing)apply(dt);else pose=rig.update(root,dt);draw();requestAnimationFrame(loop)}
requestAnimationFrame(loop)
