import {Application,Assets,Container,Graphics,Rectangle,Texture} from 'pixi.js'
import {CullerView,type CullerPartState,type CullerPresentation} from '../../../src/client/render/culler-view'
import {cullerDriveIds,cullerPartIds,cullerSpecFrameKeys,type CullerDir,type CullerSpec} from '../../../src/client/render/culler-spec'
import {advanceWalk,createWalkMotion,observeWalk,walking,walkPosition,resetWalk} from '../../../src/client/render/walk-motion'
import manifest from '../direction-v379/sprites.fragment.json'
import frontUrl from '../../../public/sprites/original/direction-v379/culler-front-parts-v1.png?url'
import leftUrl from '../../../public/sprites/original/direction-v379/culler-left-parts-v1.png?url'
import rightUrl from '../../../public/sprites/original/direction-v379/culler-right-parts-v1.png?url'
import backUrl from '../../../public/sprites/original/direction-v379/culler-back-parts-v1.png?url'
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T,input=<T extends HTMLInputElement|HTMLSelectElement>(id:string)=>$(id) as T
const app=new Application();await app.init({width:1200,height:650,background:0x272d28,antialias:false,preference:'webgl'});$('stage').appendChild(app.canvas)
const urls={av379_culler_front_source:frontUrl,av379_culler_left_source:leftUrl,av379_culler_right_source:rightUrl,av379_culler_back_source:backUrl},sources:Record<string,Texture>={}
for(const [key,url]of Object.entries(urls)){sources[key]=await Assets.load<Texture>(url);sources[key].source.scaleMode='nearest'}
const spec=manifest.chars.av379_culler.culler as unknown as CullerSpec,frames=manifest.frames as unknown as Record<string,[string,number,number,number,number]>,textures:Record<string,Texture>={}
for(const key of cullerSpecFrameKeys(spec)){const r=frames[key];textures[key]=new Texture({source:sources[r[0]].source,frame:new Rectangle(r[1],r[2],r[3],r[4])})}
const scene=new Container(),grid=new Graphics(),view=new CullerView({spec,textures});scene.addChild(grid,view.root);app.stage.addChild(scene)
for(const id of cullerPartIds)input<HTMLSelectElement>('part').add(new Option(id,id))
let logical={x:8,y:8},direction:CullerDir='down',speed=1,running=false,action='idle',attackMode='',age=0,flash=0,zoom=4,framesSeen=0,wasProne=false,wasDead=false,lastPointer:{point:{x:number;y:number};hit:boolean}|null=null
let suppliedRoot={x:136,y:142},lastState:CullerPresentation|null=null;const motion=createWalkMotion(logical)
const cardinal:Record<CullerDir,{x:number;y:number}>={down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0},up:{x:0,y:-1}}
function step(){if(walking(motion)||input<HTMLInputElement>('dead').checked||input<HTMLInputElement>('prone').checked)return;const from={...logical},v=cardinal[direction],diagonal=Number(input<HTMLSelectElement>('diagonal').value),to={x:from.x+v.x,y:from.y+(v.x?diagonal:v.y)};logical=to;observeWalk(motion,to,[{from,to}])}
function cue(kind:string,mode=''){action=kind;attackMode=mode;age=0;running=false;$('go').textContent='연속 이동'}
function reset(){logical={x:8,y:8};resetWalk(motion,logical);view.reset();running=false;direction='down';input<HTMLSelectElement>('direction').value=direction;action='idle';age=0;flash=0;attackMode='';for(const id of ['dead','prone','cooling','fog',...cullerDriveIds.map(id=>'missing-'+id)])input<HTMLInputElement>(id).checked=false;input<HTMLSelectElement>('damage').value='none';input<HTMLSelectElement>('diagonal').value='0';wasProne=false;wasDead=false;$('go').textContent='연속 이동'}
$('go').onclick=()=>{running=true;$('go').textContent='이동 중'};$('stop').onclick=()=>{running=false;$('go').textContent='연속 이동'};$('step').onclick=step;$('reset').onclick=reset
for(const [id,mode]of Object.entries({left:'cullerLeftScythe',right:'cullerRightScythe',acid:'cullerAcid',net:'cullerNet'}))$(id).onclick=()=>cue('attack',mode)
$('cancel').onclick=()=>cue('idle');$('hurt').onclick=()=>{cue('hurt');flash=1}
input<HTMLSelectElement>('direction').onchange=e=>direction=(e.target as HTMLSelectElement).value as CullerDir
input<HTMLSelectElement>('speed').onchange=e=>speed=Number((e.target as HTMLSelectElement).value)
input<HTMLSelectElement>('zoom').onchange=e=>zoom=Number((e.target as HTMLSelectElement).value)
app.ticker.add(t=>{
 const dt=Math.max(0,Math.min(48,t.deltaMS))*speed,dead=input<HTMLInputElement>('dead').checked,prone=input<HTMLInputElement>('prone').checked
 for(const id of ['left','right','acid','net'])$<HTMLButtonElement>(id).disabled=dead||prone||input<HTMLInputElement>('cooling').checked
 for(const id of ['go','step'])$<HTMLButtonElement>(id).disabled=dead||prone
 $<HTMLButtonElement>('hurt').disabled=dead
 if(dead!==wasDead||prone!==wasProne){cue(dead||prone?'fall':'rise');wasDead=dead;wasProne=prone}
 if(dt>0){if(running&&!walking(motion))step();advanceWalk(motion,dt,false,800);age+=dt;flash=Math.max(0,flash-dt/220);if(!dead&&!prone&&age>({attack:1000,hurt:360,rise:650}[action]??Infinity)){action='idle';attackMode=''}}
 const p=walkPosition(motion);suppliedRoot={x:p.x*16+8,y:p.y*16+14};view.root.position.set(suppliedRoot.x,suppliedRoot.y)
 const parts:Record<string,CullerPartState>=Object.fromEntries(cullerPartIds.map(id=>[id,{missing:false,damage:0,efficiency:1}]))
 for(const id of cullerDriveIds)if(input<HTMLInputElement>('missing-'+id).checked)parts[id]={missing:true,damage:1,efficiency:0}
 const id=input<HTMLSelectElement>('part').value,damage=input<HTMLSelectElement>('damage').value
 if(damage==='damaged')parts[id]={missing:false,damage:.6,efficiency:.4};else if(damage==='disabled')parts[id]={missing:false,damage:1,efficiency:0};else if(damage==='missing')parts[id]={missing:true,damage:1,efficiency:0}
 for(const side of ['Left','Right'])if(parts[side+'ScytheArm'].missing)parts[side+'ScytheBlade']={missing:true,damage:1,efficiency:0}
 const state:CullerPresentation={direction,alive:!dead,prone,cooling:input<HTMLInputElement>('cooling').checked,action,phase:action==='idle'?0:Math.min(1,age/(action==='attack'?1000:action==='hurt'?360:650)),attackMode,attackVector:cardinal[direction],attackDistance:attackMode==='cullerAcid'?2:attackMode==='cullerNet'?3:1,flash,tint:0xffffff,parts};lastState=state;view.update(suppliedRoot,state,dt)
 const fog=input<HTMLInputElement>('fog').checked
 if(fog){const rects=[];for(let y=Math.floor(p.y)-8;y<=Math.floor(p.y)+8;y++)for(let x=Math.floor(p.x)-8;x<=Math.floor(p.x)+8;x++)if(x>=Math.floor(p.x)&&!(x===Math.floor(p.x)+1&&y===Math.floor(p.y)-1))rects.push({x:x*16-suppliedRoot.x,y:y*16-suppliedRoot.y,w:16,h:16});view.setClip(rects)}else view.setClip(null)
 scene.scale.set(zoom);scene.position.set(650-suppliedRoot.x*zoom,460-suppliedRoot.y*zoom);grid.clear()
 for(let x=Math.floor(p.x)-12;x<=Math.floor(p.x)+12;x++)for(let y=Math.floor(p.y)-12;y<=Math.floor(p.y)+6;y++)grid.rect(x*16,y*16,16,16).fill({color:(x+y)%2?0x293029:0x30372f}).stroke({color:0x625f48,width:.12})
 if(fog){grid.rect((Math.floor(p.x)-8)*16,(Math.floor(p.y)-8)*16,8*16,17*16).fill(0x101510);grid.rect((Math.floor(p.x)+1)*16,(Math.floor(p.y)-1)*16,16,16).fill(0x5a5a49)}
 const audit=view.inspect();$('stat').textContent=`구동 ${audit?.pose.legs.filter(l=>!parts[l.id].missing).length??0}/6 · 접지 ${audit?.pose.legs.filter(l=>l.contact).length??0} · ${direction} · ${speed}×${state.cooling?' · 냉각 중':''} · 독립 원문4장/24영역`;$('audit').textContent=JSON.stringify({suppliedRoot,logical,speed,running,display:audit},null,2)
 app.canvas.dataset.ready='true';framesSeen++
})
app.canvas.addEventListener('pointermove',e=>{const r=app.canvas.getBoundingClientRect(),point={x:(e.clientX-r.left)*app.screen.width/r.width,y:(e.clientY-r.top)*app.screen.height/r.height};lastPointer={point,hit:view.hit(point)};app.canvas.style.cursor=lastPointer.hit?'pointer':'default'})
Object.defineProperty(window,'observe_culler_preview',{value:()=>structuredClone({display:view.inspect(),suppliedRoot,logical,direction,speed,running,moving:walking(motion),state:lastState,framesSeen,lastPointer,sourcesDestroyed:Object.values(sources).some(t=>t.destroyed||t.source.destroyed)})})
window.addEventListener('pagehide',()=>{app.ticker.stop();view.destroy();app.destroy(true,{children:true});for(const t of Object.values(textures))t.destroy(false);for(const url of Object.values(urls))void Assets.unload(url)},{once:true})
