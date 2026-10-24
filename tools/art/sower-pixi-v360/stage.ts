import {prepareModels,imageUrls,type Facing} from './models'
import {Application,Assets,Container,Graphics} from 'pixi.js'
import {ArticulatedGait,project} from '../../../src/client/render/articulated-gait'
import {ArticulatedRigView} from '../../../src/client/render/articulated-rig-view'
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T
const app=new Application();await app.init({width:1000,height:560,antialias:false,resolution:1,background:0x272a22,preference:'webgl'})
$('stage').appendChild(app.canvas)
const {models,images}=await prepareModels();let facing:Facing='front',model=models.front
const stage=new Container(),grid=new Graphics(),shadow=new Graphics();app.stage.addChild(stage);stage.position.set(510,390);stage.scale.set(4);stage.addChild(grid,shadow)
let rig=new ArticulatedGait({x:0,y:0},{x:0,y:1},model.layout),root={x:0,y:0},pose=rig.pose(),view=new ArticulatedRigView(model.art),heading={x:0,y:1},playing=false,speed=1,replacements=0,frames=0,pendingWork=false,workSeconds=-1,workIndex=-1
stage.addChild(view.root)
function replace(){view.destroy();view=new ArticulatedRigView(model.art);stage.addChild(view.root);view.update(pose);replacements++}
$('play').onclick=()=>{playing=!playing;if(playing){pendingWork=false;workSeconds=-1;workIndex=-1;view.setChassis(model.idle)}$('play').textContent=playing?'정지 후 접지':'이동 재개'}
$('replace').onclick=()=>{pendingWork=false;workSeconds=-1;workIndex=-1;replace()}
$('work').onclick=()=>{if(!model.work.length)return;playing=false;$('play').textContent='이동 재개';pendingWork=true}
$('reset').onclick=()=>{playing=false;pendingWork=false;workSeconds=-1;workIndex=-1;root={x:0,y:0};rig=new ArticulatedGait(root,heading,model.layout);pose=rig.pose();replace();$('play').textContent='이동 재개'}
$('facing').addEventListener('change',event=>{facing=(event.target as HTMLSelectElement).value as Facing;model=models[facing];($('work') as HTMLButtonElement).disabled=!model.work.length;($('reset') as HTMLButtonElement).click()})
$<HTMLSelectElement>('direction').onchange=e=>heading=[{x:0,y:1},{x:Math.SQRT1_2,y:Math.SQRT1_2},{x:-1,y:0},{x:0,y:-1},{x:1,y:0}][Number((e.target as HTMLSelectElement).value)]
$<HTMLSelectElement>('speed').onchange=e=>speed=Number((e.target as HTMLSelectElement).value)
Object.defineProperty(window,'observe_pixi_rig',{value:()=>structuredClone({pose,facing,playing,speed,heading,frames,replacements,pendingWork,workSeconds,workIndex,renderer:app.renderer.type,borrowedTextureDestroyed:Object.values(images).some(t=>t.destroyed),sourceDestroyed:Object.values(images).some(t=>t.source.destroyed),view:view.inspect(),walkPartRegions:16,workChassisRegions:14,totalSourceRegions:30,sourcePngs:8,authoredWalkFrames:0,activeGame:false})})
app.ticker.add(ticker=>{
 const dt=Math.max(0,Math.min(.05,ticker.deltaMS/1000));if(playing)root={x:root.x+heading.x*10*speed*dt,y:root.y+heading.y*10*speed*dt};pose=rig.update(root,dt);frames++
 if(pendingWork&&!pose.swing){pendingWork=false;workSeconds=0}
 if(workSeconds>=0){workSeconds+=dt;const index=Math.floor(workSeconds/.35);if(index>=model.work.length){workSeconds=-1;workIndex=-1;view.setChassis(model.idle)}else if(index!==workIndex){workIndex=index;view.setChassis(model.work[index])}}
 view.update(pose,pose.root,dt)
 grid.clear();const center=project({...root,z:0});for(let n=-100;n<=100;n+=16){const x=n-(root.x%16),y=(n-(root.y%16))*Math.SQRT1_2;grid.moveTo(x,-100).lineTo(x,100).moveTo(-120,y).lineTo(120,y)}grid.stroke({color:0x5b5846,width:.25})
 shadow.clear();for(const leg of pose.legs){const p=project({...leg.sole,z:0});shadow.ellipse(p.x-center.x,p.y-center.y-1,5.2,1.8).fill({color:0,alpha:leg.contact?.5:.25})}
 $('stat').textContent=`표시 ${frames} · 보행4부품·작업4차체/3기능상태 · 이동 ${pose.distance.toFixed(2)} · 지지 ${pose.legs.filter(l=>l.contact).length}/4 · 관절 오차 ${Math.max(...pose.legs.map(l=>l.error)).toFixed(5)} · 지지 여유 ${pose.supportMargin.toFixed(2)} · 재생성 ${replacements}`
 app.canvas.dataset.ready='true';app.canvas.dataset.contacts=String(pose.legs.filter(l=>l.contact).length)
})
window.addEventListener('pagehide',()=>{app.ticker.stop();view.destroy();for(const texture of Object.values(models).flatMap(m=>m.allTextures))texture.destroy(false);app.destroy(true,{children:true});for(const url of Object.values(imageUrls))void Assets.unload(url)},{once:true})
