// New original crop silhouettes. Every path authored here; no image inputs.
import {writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
const root=fileURLToPath(new URL('./',import.meta.url))
const c={ink:'#2f332b',soil:'#403c31',earth:'#514b3b',clod:'#625845',edge:'#75684e',leaf:'#586851',green:'#78866a',young:'#8a9879',vein:'#a5aa88',darkLeaf:'#3e4e43',straw:'#9a8b60',grain:'#bbab79',grainDark:'#716442',bark:'#4a4133',wood:'#7b6d50',split:'#33382e',cap:'#babaa5',capLight:'#d3cfb6',gill:'#7a7d6d',stem:'#a7a691'}
const p=(d,fill,opacity=1)=>`<path d="${d}" fill="${fill}" opacity="${opacity}"/>`
const l=(d,stroke,width=1)=>`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="square" stroke-linejoin="miter"/>`
const g=(body,x=0,y=0)=>`<g transform="translate(${x} ${y})">${body}</g>`
function bed(){return p('M7 57l8-4 7 1 4-2 8 2 6-2 8 3 8 1 3 3-8 1-5 2-8-1-7 2-9-2-7 1-7-2z',c.ink,.45)+p('M9 56l7-2 7 2 5-2 8 2 6-2 9 3 5 1-7 2-10-1-7 2-10-2-7 1-7-2z',c.soil)+p('M12 56l7-1 5 2-10 1zM29 56l6 1 6-2 8 3-9-1-5 2-7-1z',c.earth)+l('M13 59l5-1 5 1m13 1 5-2 6 1',c.clod)+p('M9 57l2-1 2 1-3 1zM47 55l3 1-1 1-3-1z',c.edge,.7)}
function unknown(kind){return bed()+l(kind==='oat'?'M19 56v-5l2 3m15 3 1-6 2 3':'M22 56l3-4 3 3m9 1 2-4 3 3',c.clod,2)}
function sprout(x,y,shape){return g(p(shape,c.darkLeaf)+p('M0 2l-3-7 2 1 3 5 2-8 2-2-2 10-2 3z',c.green)+l('M0 3l1-6',c.vein),x,y)}
function oatSeed(){return bed()+p('M17 57l-3-10 1-7 2 4 1 7 3-9 2-2-1 8-3 9zM34 57l-2-12 1-9 2 5 1 10 4-8 2-1-2 8-4 8zM48 58l-2-8 1-7 2 7 3-5 2-1-2 8z',c.darkLeaf)+l('M17 55l-1-11m19 12-1-15m14 15v-8m-30 6 3-7m14 6 4-6',c.green)}
function oatLeaves(heading){return bed()+p(heading?'M18 58l-1-18-4-11 2-1 4 11 1 17zM22 57l1-30 2-8 1 1-1 25 5-13 2-1-5 18zM34 58l-2-20-3-10 2-1 4 11 1 18zM38 57l1-39 2-11 1 1-1 32 6-13 2-1-7 24zM48 58l1-16 5-18 2-2-2 13-3 21zM16 57l-5-8-4-5 2-1 5 5 4 8zM43 58l4-9 8-5 2-1-5 6-6 9z':'M18 58l-1-13-3-8 2-1 4 13 1 7zM22 57l1-23 2-8 1 2-2 23 5-10 2-1-5 13zM35 57l-2-16-3-8 2-1 4 13 2 11zM38 57l1-25 2-9 1 1-1 23 5-9 3-1-6 13zM49 58l1-13 4-12 2-1-3 20z',c.darkLeaf)+l(heading?'M18 56l-1-17-2-7m8 22 1-27m10 28-1-17-2-7m8 23 1-35m9 36 3-16m-34 17-7-9m33 10 9-10':'M19 56l-2-12m6 11 1-20m11 21-2-14m6 13 1-21m10 22 3-15',c.leaf)+l(heading?'M24 42V23m16 11 1-20m-6 34-1-9m17 4 3-14':'M24 46l1-14m15 13 1-14',c.green)}
function oatHeads(ripe){let body=oatLeaves(true);body+=l(ripe?'M24 29l-2-15-5-3m6 8-8 3m25 3 1-15 5-3m-5 9 7 3m3 17 5-11 1 1':'M24 29l-1-17-3-5m3 9-5 1m22 8 1-17 4-4m-4 8 6 1m4 23 4-15 2-1',ripe?c.straw:c.leaf,1);const heads=ripe?[[15,14],[12,23],[25,28],[44,10],[47,21],[35,25],[55,28]]:[[18,8],[16,18],[25,24],[43,5],[46,15],[36,22],[55,22]];for(const[x,y]of heads){body+=g(p(ripe?'M0 0l2 3 0 5-2 3-2-3 0-5z':'M0 0l1 2 1 4-2 2-1-3z',ripe?c.grainDark:c.darkLeaf)+l(ripe?'M0 2l1 3-1 3':'M0 2v3',ripe?c.grain:c.green),x,y)}return body}
const shadeShapes=[
 ['M30 57C23 56 15 56 10 51l7 0-3-3 7 1-1-4c6 2 9 5 11 10z','M15 51l13 5'],
 ['M31 55c-5-6-10-13-9-21l3 4 0-6 5 6 2-4c3 8 3 14 1 20z','M25 38l7 14'],
 ['M33 54c0-10 2-19 8-25l0 6 4-4-1 8 4-1c-2 9-6 14-12 17z','M40 34l-5 19'],
 ['M35 56c7-7 13-11 22-11l-3 4 6 0-6 5 2 2c-8 4-15 4-20 2z','M53 49l-15 7'],
 ['M31 59c-7 3-15 3-21-1l6-1-2-2 8 1 7 1z','M17 58l12 0'],
 ['M32 55c-2-10-1-18 3-24l2 5 2-3 2 8 3-1c0 7-4 12-9 15z','M35 36l-2 17'],
 ['M35 58c4-6 10-9 17-9l-2 4 6 0-6 5-9 3z','M49 53l-11 5']
]
function shade(stage){if(!stage)return unknown('shade');let body=bed();if(stage===1)return body+p('M30 57c-7-1-11-4-11-8 6-1 11 2 13 6 4-6 8-8 13-7-1 5-6 9-12 10z',c.darkLeaf)+l('M23 51l8 5m3 0 7-5',c.green);const ids=stage===2?[0,1,3,4]:stage===3?[0,1,2,3,4,5]:[0,1,2,3,4,5,6];for(const[i,index]of ids.entries()){const[shape,vein]=shadeShapes[index];body+=p(shape,i%2?c.darkLeaf:c.leaf)+l(vein,i%2?c.green:c.young)}if(stage===4)body+=p('M27 56l4-5 6 1 4 6-4 4-7-1z',c.clod)+p('M29 55l3-2 5 1 2 4-5 2-4-1z',c.wood)+l('M31 55l5 1m-3-3 1 6',c.edge)+p('M18 58l-8-1 3-2 8 2zM43 59l9-3 5 1-9 4z',c.earth);return body}
function wood(){return bed()+p('M9 51l5-4 10 2 12-2 13 3 7 4-1 7-9 2-17-3-12 2-9-5z',c.ink)+p('M11 52l7-2 11 2 9-2 12 3 3 4-6 3-13-2-14 1-9-3z',c.bark)+p('M14 50l6-1 10 3 7-3 11 3-2 3-15-1-10 2-8-2z',c.wood)+p('M49 52l5 2 1 6-5 1-3-3z',c.clod)+l('M15 54l9 2 7-2 13 2m-28 1 5 1m8-5 6-2 8 2m-21-2 2 2m25 2 3 3',c.split)+l('M51 55l1 3-2 1',c.edge)}
function cap(x,y,size,tilt=0){return g(l(`M0 9l${tilt} -9`,c.ink,4)+l(`M0 8l${tilt} -9`,c.stem,2)+p(`M${-size} 0l2-${Math.max(2,Math.floor(size/2))} ${size-2}-3 ${size-1} 1 4 4 0 3-5 2-${size+1}-1z`,c.ink)+p(`M${-size+1}-1l3-${Math.max(2,Math.floor(size/2)-1)} ${size-3}-2 ${size-1} 1 3 3-3 2-${size+1}-1z`,c.cap)+l(`M${-size+2}-2l${Math.max(2,Math.floor(size/2))}-3 ${Math.max(2,Math.floor(size/2))} 0`,c.capLight)+l(`M${-size+2} 1l${size-1} 1 ${size-1}-1`,c.gill),x,y)}
function fungus(stage){let body=wood();if(stage===0)return body;if(stage===1)return body+l('M19 50l5 1 3-2 4 3 7-2m-6 3 2 3',c.gill)+p('M20 50h2v2h-2zM34 51h2v2h-2zM43 54h2v1h-2z',c.cap);if(stage===2)return body+cap(20,48,3)+cap(31,45,4,1)+cap(43,50,3,-1);if(stage===3)return body+cap(19,45,7,1)+cap(34,39,9,-1)+cap(46,47,6);return body+cap(17,46,7,-1)+cap(28,35,12,1)+cap(45,41,10,-1)+cap(36,49,6)+l('M17 53l4 1m16-1 6 1',c.gill)}
// Three distinct vegetable families, authored from simple leaf/root structures.
function vegetable(kind,stage){
 let body=bed();if(!stage)return body+l('M20 56l3-2m14 2 4-1',c.clod,2)
 if(stage===1)return body+sprout(24,54,'M0 3l-7-5 1-4 5 2 2 4 4-5 4 0-3 5z')+sprout(41,55,'M0 3l-6-4 0-4 5 1 2 5 3-6 4 1-2 4z')
 if(kind==='potato'){
  const top=stage===2?37:27
  for(const x of [21,42]){body+=l(`M${x} 57V${top}`,c.leaf,2);for(let n=0;n<(stage===2?2:3);n++){const y=top+n*7;body+=g(p('M0 2l-8-5-4 1 2 6 8 2zM0 3l7-6 4 1-1 5-8 3z',n%2?c.leaf:c.darkLeaf)+l('M-9 0l9 4 8-4',c.green),x,y)}if(stage===3)body+=g(p('M0-3l2 2 3 0-1 3 1 3-3-1-3 1 0-3-2-2 3-1z',c.cap)+p('M-1 0h2v2h-2z',c.grain),x,top-2)}
  if(stage===4)body+=p('M13 58l3-3 5 1 2 3-5 2zM38 59l4-3 6 1 1 3-6 1z',c.wood)+l('M16 57h2m25 1h2',c.edge)
 }else if(kind==='cabbage'){
  for(const x of [22,43])body+=g(p(stage===2?'M0 4l-11-6-1-5 6-1 5 6 2-8 5-2 5 6-4 8 7-3 4 4-7 7z':'M-4 7l-10-6-1-7 5-3 6 4 2-9 7-2 6 5-1 8 5-2 5 5-5 8-8 3z',c.darkLeaf)+l('M-10-4l9 9 6-14m-6 14 13-3',c.green)+(stage>=3?p(stage===4?'M-6-2l4-7 8-1 6 5 0 9-6 5-8-2-5-4z':'M-4 0l3-6 5-1 5 5-2 7-6 1z',stage===4?c.young:c.leaf)+l(stage===4?'M-4 0l5-6 5 3-5 4 4 4m-4-4-5 3':'M-2 0l4-3 2 6',c.vein):''),x,stage===2?51:48)
 }else{
  for(const x of [21,43]){body+=g(p(stage===2?'M0 5l-8-9-2-6 4-1 6 8-1-11 4-3 3 7-3 12 7-6 5 0-3 5-8 7z':'M0 5l-9-11-2-9 4-2 6 9-1-14 4-5 3 8-3 15 9-10 5 1-4 8-9 11z',c.darkLeaf)+l(stage===2?'M-7-8l7 11 3-14m-3 14 10-8':'M-8-13l8 15 3-22m-3 22 12-13',c.green),x,stage===2?50:47);if(stage===4)body+=g(p('M-6 0l4-4 7 1 3 4-3 6-4 4-1-3-5-3z',c.cap)+p('M-5-1l4-3 5 1 2 2-5 2z',c.gill)+l('M-3 3l5 1m-1 4v3',c.stem),x,54)}
 }
 return body
}
const frames=[],tiles=[]
const families=[['oat',['unknown','seedling','leaf','heading','ripe'],[unknown('oat'),oatSeed(),oatLeaves(false),oatHeads(false),oatHeads(true)]],['shade',['unknown','seedling','leaf','heading','ripe'],[0,1,2,3,4].map(shade)],['whitecap',['unknown','inoculated','pins','young','ripe'],[0,1,2,3,4].map(fungus)]]
for(const kind of ['cabbage','potato','turnip'])families.push([kind,['unknown','seedling','leaf','heading','ripe'],[0,1,2,3,4].map(stage=>vegetable(kind,stage))])
for(let row=0;row<families.length;row++){const[kind,names,bodies]=families[row];for(let col=0;col<5;col++){const id=`av_crop_${kind}_${names[col]}`;tiles.push(`<g id="${id}" transform="translate(${col*64} ${row*64})">${bodies[col]}</g>`);frames.push({id,rect:[col*64,row*64,64,64],worldHeight:16,anchor:[.5,1]})}}
const spent=wood()+p('M15 53l7-3 4 2-5 2-3 2zM37 51l7 2 3 4-6-2z',c.split)+l('M26 54v-5m1 1 2 1m8 6 1-4',c.gill)
tiles.push(`<g id="av_crop_whitecap_spent" transform="translate(0 384)">${spent}</g>`);frames.push({id:'av_crop_whitecap_spent',rect:[0,384,64,64],worldHeight:16,anchor:[.5,1]})
writeFileSync(root+'crops.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="448" viewBox="0 0 320 448" shape-rendering="crispEdges"><title>ASHVEIL original crop stages</title><desc>Independent authored silhouettes, no image inputs, transparent background.</desc>${tiles.join('\n')}</svg>\n`)
writeFileSync(root+'frames.json',JSON.stringify(frames,null,2)+'\n')
