import {Application,Assets,Container,Graphics,Rectangle,type Texture} from 'pixi.js'
import {Texture as PixiTexture} from 'pixi.js'
import {CrawlerView,type CrawlerPartState,type CrawlerPresentation} from '../../../src/client/render/crawler-view'
import {crawlerBodyId,crawlerLegId,crawlerPartIds,type CrawlerSpec} from '../../../src/client/render/crawler-spec'
import {advanceWalk,createWalkMotion,observeWalk,walking,walkPosition,resetWalk} from '../../../src/client/render/walk-motion'
import manifest from '../../../src/client/sprites.json'
import sourceUrl from '../../../public/sprites/original/direction-v375/crawler-parts-v372.png?url'
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T
const app=new Application();await app.init({width:1100,height:510,background:0x292b23,antialias:false,preference:'webgl'});$('stage').appendChild(app.canvas)
const source=await Assets.load<Texture>(sourceUrl);source.source.scaleMode='nearest'
const spec=manifest.chars.av375_conduit_crawler.crawler as CrawlerSpec,textures:Record<string,Texture>={},frames=manifest.frames as unknown as Record<string,[string,number,number,number,number]>
for(const part of Object.values(spec.art)){const r=frames[part.frame];textures[part.frame]=new PixiTexture({source:source.source,frame:new Rectangle(r[1],r[2],r[3],r[4])})}
const scene=new Container(),grid=new Graphics(),view=new CrawlerView({spec,textures});scene.addChild(grid,view.root);app.stage.addChild(scene)
let speed=1,running=false,heading=0,mode:'floor'|'ceiling'='floor',action='idle',age=0,flash=0,zoom=5,framesSeen=0,lastPointer:{point:{x:number;y:number};hit:boolean}|null=null
let logical={x:8,y:8},suppliedRoot={x:136,y:142};const motion=createWalkMotion(logical)
const input=<T extends HTMLInputElement|HTMLSelectElement>(id:string)=>$(id) as T
function step(){if(walking(motion))return;const from={...logical},to={x:from.x+Math.round(Math.cos(heading)),y:from.y+Math.round(Math.sin(heading))};logical=to;observeWalk(motion,to,[{from,to}])}
function reset(){logical={x:8,y:8};resetWalk(motion,logical);view.reset();running=false;heading=0;action='idle';age=0;flash=0;for(const id of ['leg-missing','leg-damage','dead','fog'])input<HTMLInputElement>(id).checked=false;input<HTMLSelectElement>('segment-missing').value='';mode='floor';input<HTMLSelectElement>('mode').value=mode;$('go').textContent='연속 이동'}
$('go').onclick=()=>{running=true;$('go').textContent='이동 중'};$('step').onclick=step;$('stop').onclick=()=>{running=false;$('go').textContent='연속 이동'}
$('east').onclick=()=>heading=0;$('diagonal').onclick=()=>heading=Math.PI/4;$('turn').onclick=()=>heading-=Math.PI/2
$('attack').onclick=()=>{action='attack';age=0};$('hurt').onclick=()=>{action='hurt';age=0;flash=1}
$('reset').onclick=reset
input<HTMLSelectElement>('speed').onchange=e=>speed=Number((e.target as HTMLSelectElement).value)
input<HTMLSelectElement>('mode').onchange=e=>mode=(e.target as HTMLSelectElement).value as typeof mode
input<HTMLSelectElement>('zoom').onchange=e=>zoom=Number((e.target as HTMLSelectElement).value)
let lastState:CrawlerPresentation|null=null
app.ticker.add(t=>{
 const dt=Math.max(0,Math.min(48,t.deltaMS))*speed,dead=input<HTMLInputElement>('dead').checked
 if(dt>0){if(running&&!dead&&!walking(motion))step();advanceWalk(motion,dt,false,450);age+=dt;flash=Math.max(0,flash-dt/220);if(age>({attack:650,hurt:360}[action]??Infinity))action='idle'}
 const p=walkPosition(motion);suppliedRoot={x:p.x*16+8,y:p.y*16+14};view.root.position.set(suppliedRoot.x,suppliedRoot.y)
 const parts:Record<string,CrawlerPartState>=Object.fromEntries(crawlerPartIds.map(id=>[id,{missing:false,damage:0}]))
 if(input<HTMLInputElement>('leg-missing').checked)parts.Segment1LeftLeg.missing=true
 if(input<HTMLInputElement>('leg-damage').checked)parts.Segment1RightLeg.damage=1
 const missing=input<HTMLSelectElement>('segment-missing').value
 if(missing)for(let i=missing==='Segment4'?3:7;i<8;i++){parts[crawlerBodyId(i)].missing=true;for(const side of [-1,1])parts[crawlerLegId(i,side)].missing=true}
 const dx=motion.to.x-motion.from.x,dy=motion.to.y-motion.from.y,facing=walking(motion)?Math.atan2(dy,dx):heading
 const state:CrawlerPresentation={heading:facing,mode,alive:!dead,prone:false,action:dead?'fall':action,phase:dead?1:action==='idle'?0:Math.min(1,age/(action==='attack'?650:360)),attack:{x:Math.cos(heading),y:Math.sin(heading)},flash,tint:0xffffff,parts};lastState=state
 view.update(suppliedRoot,state,dt)
 const fog=input<HTMLInputElement>('fog').checked
 if(fog){const rects=[];for(let y=Math.floor(p.y)-5;y<=Math.floor(p.y)+5;y++)for(let x=Math.floor(p.x)-5;x<=Math.floor(p.x)+5;x++)if(x>=Math.floor(p.x)-1&&!(x===Math.floor(p.x)+1&&y===Math.floor(p.y)))rects.push({x:x*16-suppliedRoot.x,y:y*16-suppliedRoot.y,w:16,h:16});view.setClip(rects)}else view.setClip(null)
 scene.scale.set(zoom);scene.position.set(680-suppliedRoot.x*zoom,255-suppliedRoot.y*zoom)
 grid.clear();for(let x=Math.floor(p.x)-9;x<=Math.floor(p.x)+5;x++)for(let y=Math.floor(p.y)-4;y<=Math.floor(p.y)+4;y++){grid.rect(x*16,y*16,16,16).fill({color:(x+y)%2?0x292c23:0x303126});grid.rect(x*16,y*16,16,16).stroke({color:0x605b43,width:.12})}
 if(fog){grid.rect(Math.floor(p.x)*16-6*16,(Math.floor(p.y)-4)*16,5*16,9*16).fill(0x10120f);grid.rect((Math.floor(p.x)+1)*16,Math.floor(p.y)*16,16,16).fill(0x555144)}
 const audit=view.inspect();$('stat').textContent=`몸판 ${audit?.body.filter(b=>b.visible).length??0}/8 · 다리 ${audit?.legs.filter(l=>l.visible).length??0}/16 · ${mode==='ceiling'?'천장 대기':'바닥'} · ${speed}× · 원문1장/6영역 · 동일 게임 렌더러`
 $('audit').textContent=JSON.stringify({suppliedRoot,logical,speed,running,pose:audit},null,2);app.canvas.dataset.ready='true';framesSeen++
})
app.canvas.addEventListener('pointermove',e=>{const rect=app.canvas.getBoundingClientRect(),point={x:(e.clientX-rect.left)*app.screen.width/rect.width,y:(e.clientY-rect.top)*app.screen.height/rect.height};lastPointer={point,hit:view.hit(point)};app.canvas.style.cursor=lastPointer.hit?'pointer':'default'})
Object.defineProperty(window,'observe_crawler_preview',{value:()=>structuredClone({pose:view.inspect(),suppliedRoot,logical,speed,running,moving:walking(motion),heading,state:lastState,framesSeen,lastPointer,sourceDestroyed:source.destroyed||source.source.destroyed})})
window.addEventListener('pagehide',()=>{app.ticker.stop();view.destroy();app.destroy(true,{children:true});for(const texture of Object.values(textures))texture.destroy(false);void Assets.unload(sourceUrl)},{once:true})
