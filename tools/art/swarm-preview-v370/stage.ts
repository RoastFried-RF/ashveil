import {Application,Assets,Container,Graphics,Texture,Rectangle} from 'pixi.js'
import {SwarmView,type SwarmArt} from '../../../src/client/render/swarm-view'
import fragment from '../direction-v370/sprites.fragment.json'
import url from '../../../public/sprites/original/direction-v370/ashmoth-flight-four-poses-v1.png?url'
import type {SwarmState} from '../../../src/core/types'
import type {World} from '../../../src/core/ctx'
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T
const app=new Application();await app.init({width:900,height:500,background:0x272a22,antialias:false,preference:'webgl'});$('stage').appendChild(app.canvas)
const source=await Assets.load<Texture>(url);source.source.scaleMode='nearest'
const clip=fragment.anims.av370_ashmoth_flight,textures:Record<string,Texture>={}
for(const key of clip.frames){const r=fragment.frames[key as keyof typeof fragment.frames];textures[key]=new Texture({source:source.source,frame:new Rectangle(r[1] as number,r[2] as number,r[3] as number,r[4] as number)})}
const art:SwarmArt={...clip,textures,anchors:Object.fromEntries(Object.entries(clip.anchors).map(([key,p])=>[key,[p[0],p[1]] as [number,number]]))},state:SwarmState={uid:1,def:'Swarm.Ashmoth',rule:'isolated-visual-only',origin:{x:8,y:8},pos:{x:8,y:8},members:1000,initialMembers:1000,captured:0,burned:0,cohesion:100,nextMoveAt:0,lastTick:0}
const w={s:{map:{w:24,h:24,tiles:Array.from({length:576},()=>({t:'earth'}))}},db:{terrain:()=>({wall:false})}} as unknown as World,visible=new Set(Array.from({length:576},(_,i)=>i))
const scene=new Container(),grid=new Graphics(),view=new SwarmView(state,art);app.stage.addChild(scene);scene.addChild(grid,view.root);scene.scale.set(5);let time=0,step=0,moving=false,speed=1,direction=1
$('play').onclick=()=>{moving=!moving;$('play').textContent=moving?'이동 멈춤':'표현 이동'}
$('reset').onclick=()=>{state.pos={x:8,y:8};moving=false;step=0;view.sync(w,state,new Set());view.sync(w,state,visible);$('play').textContent='표현 이동'}
$<HTMLInputElement>('cohesion').oninput=e=>{state.cohesion=Number((e.target as HTMLInputElement).value);view.sync(w,state,visible)}
$<HTMLSelectElement>('speed').onchange=e=>speed=Number((e.target as HTMLSelectElement).value)
view.sync(w,state,visible)
app.ticker.add(t=>{const dt=Math.max(0,Math.min(48,t.deltaMS))*speed;time+=dt;if(moving&&speed&&time-step>800){step=time;if(state.pos.x>=11)direction=-1;if(state.pos.x<=6)direction=1;state.pos={x:state.pos.x+direction,y:8};view.sync(w,state,visible)}view.update(w,dt,visible,speed===0);const p=view.inspect().center;scene.position.set(450-(p.x*16+8)*5,270-(p.y*16+14-22)*5);grid.clear();for(let n=0;n<=24;n++){grid.moveTo(n*16,0).lineTo(n*16,384).moveTo(0,n*16).lineTo(384,n*16)}grid.stroke({color:0x55533f,width:.2});$('stat').textContent=`대표 나방 ${view.inspect().representativeSprites} · 집결 ${state.cohesion}% · 원본 1장/4포즈/등 시점1개 · 회전·분산은 실시간 표현`;app.canvas.dataset.ready='true'})
Object.defineProperty(window,'observe_swarm_preview',{value:()=>structuredClone({...view.inspect(),speed,moving,cohesion:state.cohesion,sourceDestroyed:source.destroyed||source.source.destroyed})})
window.addEventListener('pagehide',()=>{app.ticker.stop();view.destroy();app.destroy(true,{children:true});for(const texture of Object.values(textures))texture.destroy(false);void Assets.unload(url)},{once:true})
