// Original animals, machinery and living fusion. Integer SVG geometry, no raster input.
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const here=fileURLToPath(new URL('.',import.meta.url)),root=fileURLToPath(new URL('../../../',import.meta.url)),out=root+'public/sprites/original/direction-v319/'
mkdirSync(out,{recursive:true})
const p={ink:'#252527',deep:'#383938',fur:'#73766d',furLight:'#a0a28f',furShade:'#51574e',earth:'#756655',earthLight:'#a28b6d',earthShade:'#51473e',skin:'#aa917b',skinLight:'#c7b095',skinShade:'#725c52',linen:'#a89c81',linenShade:'#746f5e',cloth:'#5e6260',iron:'#636e70',ironLight:'#9ba4a0',ironShade:'#3d474a',rust:'#805e47',brass:'#a28b5c',moss:'#626856',mossLight:'#8c9478',gill:'#454d43'}
const r=(x,y,w,h,c)=>`<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" fill="${c}"/>`
const poly=(points,c)=>`<polygon points="${points.map(p=>p.map(Math.round).join(',')).join(' ')}" fill="${c}"/>`
const line=(points,c,width=1)=>`<polyline points="${points.map(p=>p.map(Math.round).join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="${width}" stroke-linejoin="miter"/>`
const ellipse=(x,y,rx,ry,c)=>`<ellipse cx="${Math.round(x)}" cy="${Math.round(y)}" rx="${Math.round(rx)}" ry="${Math.round(ry)}" fill="${c}"/>`
const bone=(points,c,width=4)=>line(points,p.ink,width+2)+line(points,c,width)
const mirror=(body,width,d)=>d==='right'?`<g transform="translate(${width} 0) scale(-1 1)">${body}</g>`:body
function hound(d,phase,attack,alpha){
 const gait=[0,3,5,0,-3,-5][phase],bite=attack<0?0:[0,2,5,1][attack],front=d==='down',back=d==='up'
 let a=''
 if(front||back){
  a+=poly([[39,28],[45,24],[53,24],[60,30],[62,45],[56,53],[40,53],[34,43]],p.ink)+poly([[40,29],[48,26],[56,29],[58,44],[53,50],[41,49],[38,42]],p.furShade)
  a+=poly([[42,28],[48,26],[53,30],[53,42],[48,49],[41,44]],p.fur)
  for(const s of [-1,1]){const x=48+s*9,shift=s*gait;a+=bone([[x,43],[x-s,51],[x+shift/3,58-Math.max(0,shift/2)]],p.furShade,5)+r(x+shift/3-3,58-Math.max(0,shift/2),6,2,p.deep)+r(x+shift/3-2,57-Math.max(0,shift/2),3,1,p.furLight)}
  if(back){a+=bone([[48,39],[52,49],[51,59]],p.furShade,4)+poly([[37,31],[39,23],[43,29],[53,28],[58,23],[59,34],[54,41],[44,41]],p.fur)+line([[41,31],[45,35],[53,34]],p.furLight,2)}
  else{
   a+=poly([[35,31],[37,21],[43,25],[52,25],[58,21],[60,33],[57,42],[52,47],[43,47],[38,42]],p.ink)+poly([[38,31],[39,24],[44,28],[51,27],[57,24],[57,36],[53,43],[44,44],[40,39]],p.fur)
   a+=poly([[42,35],[47,37],[53,35],[54,43+bite],[49,48+bite],[44,44+bite]],p.furLight)+r(45,43+bite,6,3,p.deep)+r(41,33,3,2,p.deep)+r(54,33,2,2,p.deep)+r(42,32,2,1,p.earthLight)+r(53,32,2,1,p.earthLight)
   if(bite)a+=r(44,43,8,bite,p.ink)+r(45,44,2,1,p.linen)+r(50,44,2,1,p.linen)
  }
  for(const[x,y,w,h]of [[39,32,2,3],[55,38,2,2],[42,47,2,3],[48,29,2,3]])a+=r(x,y,w,h,p.furLight)
 }else{
  // Far legs precede the ribcage; hocks and separate toe clusters articulate the gait.
  for(const[x,s]of [[35,1],[65,-1]]){const shift=s*gait;a+=bone([[x,39],[x+3,48],[x+shift,57-Math.max(0,shift/2)]],p.furShade,4)+r(x+shift-4,57-Math.max(0,shift/2),6,2,p.deep)}
  a+=poly([[27,28],[35,23],[49,25],[60,27],[69,25],[76,30],[76,42],[66,48],[50,47],[41,45],[33,42],[26,38]],p.ink)
  a+=poly([[29,29],[37,25],[48,27],[62,30],[69,28],[73,31],[73,40],[65,45],[52,43],[44,40],[34,40],[28,36]],p.furShade)
  a+=poly([[31,28],[38,25],[47,28],[61,31],[70,29],[70,35],[62,36],[47,34],[37,35],[30,33]],p.fur)
  a+=bone([[73,34],[81,40],[86,50],[82,47],[78,42]],p.furShade,4)+line([[77,38],[82,43],[84,47]],p.fur,2)
  for(const[x,s]of [[34,-1],[65,1]]){const shift=s*gait;a+=bone([[x,40],[x+(x<50?-3:5),49],[x+shift,59-Math.max(0,shift/2)]],p.fur,5)+poly([[x+shift-4,57-Math.max(0,shift/2)],[x+shift+2,57-Math.max(0,shift/2)],[x+shift+2,60-Math.max(0,shift/2)],[x+shift-5,60-Math.max(0,shift/2)]],p.ink)+r(x+shift-3,57-Math.max(0,shift/2),4,1,p.furLight)}
  a+=poly([[29,26],[32,19],[29,17],[24,22],[17,25],[14,31],[7-bite,35],[8-bite,40],[18,42],[24,39],[32,35]],p.ink)
  a+=poly([[28,25],[29,20],[24,24],[18,27],[17,33],[10-bite,36],[10-bite,39],[19,39],[24,35],[29,33]],p.fur)
  a+=poly([[20,33],[26,34],[22,38],[15,40],[10-bite,39],[10-bite,37]],p.furLight)+r(8-bite,35,4,3,p.deep)+r(19,29,3,2,p.deep)+r(18,28,3,1,p.furLight)+r(25,24,2,3,p.earthShade)
  if(bite)a+=r(12-bite,38,11,bite,p.ink)+r(15-bite,38,2,2,p.linen)+line([[14-bite,41+bite],[23,39+bite]],p.furShade,2)
  for(const[x,y,w,h]of [[29,29,2,3],[34,27,3,1],[40,29,3,1],[48,31,4,1],[57,32,3,1],[65,31,2,2],[39,37,2,3],[54,40,3,1],[68,38,2,3],[31,44,2,2]])a+=r(x,y,w,h,p.furLight)
  for(const[x,y]of [[37,32],[45,31],[59,35],[65,37],[51,39],[38,41]])a+=r(x,y,2,1,p.furShade)
  if(alpha)a+=poly([[28,25],[33,18],[36,22],[41,22],[39,26],[44,28],[40,31],[43,35],[37,36],[39,41],[34,39],[32,44],[28,40],[26,34]],p.furShade)+line([[32,25],[34,22],[36,25],[34,29],[37,33]],p.furLight,2)+r(29,31,2,4,p.skinShade)
 }
 return mirror(a,96,d)
}
function rat(d,phase,attack){
 const gait=[0,2,3,0,-2,-3][phase],bite=attack<0?0:[0,1,3,0][attack],vertical=d==='up'||d==='down'
 let a=''
 if(vertical){
  a+=bone([[32,25],[36,30],[34,37]],p.skinShade,2)+ellipse(32,24,9,10,p.ink)+ellipse(32,23,7,8,p.earthShade)+ellipse(31,21,5,6,p.earth)
  if(d==='down')a+=ellipse(27,16,4,4,p.ink)+ellipse(37,16,4,4,p.ink)+ellipse(27,16,2,2,p.skinShade)+ellipse(37,16,2,2,p.skinShade)+poly([[26,22],[38,22],[35,30],[32,33+bite],[28,29]],p.earth)+r(31,31+bite,3,2,p.skinShade)+r(27,24,2,1,p.deep)+r(36,24,2,1,p.deep)
  else a+=ellipse(32,17,6,5,p.earthShade)+r(29,14,2,2,p.earthLight)
  for(const s of [-1,1])a+=r(32+s*8,32+s*gait/2,4,2,p.skinShade)
 }else{
  a+=bone([[43,27],[53,26],[58,31],[56,36],[48,37]],p.skinShade,2)+ellipse(33,25,15,10,p.ink)+ellipse(32,24,13,8,p.earthShade)+ellipse(29,22,10,6,p.earth)
  a+=poly([[22,21],[16,22],[12-bite,27],[7-bite,29],[9-bite,32],[17,33],[23,30]],p.ink)+poly([[21,23],[16,24],[13-bite,28],[9-bite,29],[11-bite,31],[18,31],[22,28]],p.earth)
  a+=ellipse(21,20,5,5,p.ink)+ellipse(21,20,3,3,p.skinShade)+r(20,18,2,2,p.skin)+r(13,26,2,1,p.deep)+r(7-bite,29,2,2,p.skinShade)+r(10-bite,31,2,2,p.linen)
  for(const[x,s]of [[23,1],[40,-1]])a+=bone([[x,29],[x+s*gait,35]],p.earthShade,3)+r(x+s*gait-3,35,5,2,p.skinShade)
  for(const[x,y]of [[26,19],[32,19],[38,21],[29,24],[39,25],[24,28],[35,29]])a+=r(x,y,2,1,p.earthLight)
  a+=line([[11,29],[4,27]],p.earthLight)+line([[12,30],[4,32]],p.earthLight)
 }
 return mirror(a,64,d)
}
function leech(d,phase,attack){
 const bend=[0,1,2,0,-1,-2][phase],vertical=d==='up'||d==='down';let a=''
 if(vertical){for(let i=0;i<8;i++){const y=7+i*3,x=24+Math.round((i<4?1:-1)*bend);a+=ellipse(x,y,5-(i===0||i===7?1:0),3,p.ink)+r(x-3,y-1,6,2,i%2?p.moss:p.gill)+r(x-2,y-1,2,1,p.mossLight)}a+=ellipse(24-bend,d==='down'?29:7,3,2,p.gill)}
 else{for(let i=0;i<11;i++){const x=8+i*3,y=21+[-1,0,1,1,0,-1,-1,0,1,2,1][i]+Math.round((i<5?1:-1)*bend),width=[2,3,3,4,4,4,4,3,3,2,2][i];a+=ellipse(x,y,3,width,p.ink)+ellipse(x,y,2,width-1,i%2?p.moss:p.gill)+r(x-1,y-width+1,i%3?1:2,1,p.mossLight)}a+=ellipse(8,20+bend,3,3,p.gill)+ellipse(8,20+bend,1,2,p.deep)}
 if(attack===2)a+=ellipse(vertical?24:8,vertical?(d==='down'?29:7):21+bend,3,2,p.skinShade)
 return mirror(a,48,d)
}
function drone(d,phase,attack,inert){
 const gait=inert?0:[0,3,5,0,-3,-5][phase],side=d==='left'||d==='right',reach=attack<0?0:[0,8,16,3][attack];let a=''
 for(const s of [-1,1])for(let i=0;i<3;i++){
  const x=48+s*(16+(side?2:0)),y=43+i*10,shift=(i%2?1:-1)*gait*s
  const knee=[x+s*(inert?6:13),y+8+shift],foot=[x+s*(inert?8:19),inert?78:82+i*3-Math.max(0,shift)]
  a+=bone([[x,y],knee,foot],p.ironShade,5)+line([[x,y-1],[knee[0],knee[1]-1]],p.iron,2)+r(knee[0]-3,knee[1]-3,6,6,p.ink)+r(knee[0]-1,knee[1]-2,3,3,p.brass)+r(foot[0]-3,foot[1]-1,7,2,p.ironShade)
 }
 a+=poly([[29,37],[39,28],[59,29],[70,41],[68,64],[58,74],[37,72],[27,59]],p.ink)+poly([[32,39],[41,31],[57,32],[66,42],[64,61],[56,68],[38,67],[31,57]],p.ironShade)+poly([[34,39],[43,33],[56,34],[63,42],[61,48],[36,47]],p.iron)
 a+=line([[36,38],[44,34],[55,35]],p.ironLight,2)+line([[34,51],[58,52],[61,59]],p.deep,2)
 for(let i=0;i<5;i++)a+=r(39+i*4,56,2,9,p.deep)+r(39+i*4,56,1,5,p.iron)
 for(const[x,y]of [[33,45],[62,44],[36,63],[59,65]])a+=r(x,y,3,3,p.brass)+r(x,y,1,1,p.ironLight)
 a+=r(42,39,14,6,p.deep)+r(44,40,10,2,inert?p.ironShade:p.brass)+r(31,53,4,6,p.rust)+r(57,34,3,3,p.rust)+r(49,69,5,2,p.rust)
 const handX=side?(d==='left'?17-reach:79+reach):48,handY=d==='up'?22-reach/2:69+reach/2
 a+=bone([[side?(d==='left'?31:65):48,side?51:62],[handX,handY]],p.iron,5)+r(handX-4,handY-4,8,8,p.ironShade)+line([[handX-5,handY-2],[handX-8,handY+4]],p.ironLight,2)+line([[handX+4,handY-2],[handX+7,handY+4]],p.iron,2)
 if(d==='up')a+=poly([[36,42],[43,38],[60,40],[62,50],[56,56],[39,54]],p.ironShade)+line([[40,43],[56,44]],p.iron)
 return a
}
function face(x,y,d,n){
 let a=poly([[x-6,y+2],[x-3,y-1],[x+4,y],[x+7,y+6],[x+4,y+15],[x,y+18],[x-5,y+13],[x-7,y+7]],p.ink)
 a+=poly([[x-4,y+3],[x-1,y],[x+3,y+2],[x+5,y+7],[x+2,y+14],[x-1,y+16],[x-4,y+11]],d==='up'?p.earthShade:p.skinShade)
 if(d!=='up')a+=poly([[x-3,y+3],[x+1,y+2],[x+3,y+6],[x+2,y+12],[x-1,y+14],[x-3,y+10]],p.skin)+r(x-4,y+6,3,2,p.deep)+r(x+2,y+6,2,2,p.deep)+line([[x,y+6],[x,y+11],[x+2,y+11]],p.skinLight)+r(x-2,y+13,3,1,p.skinShade)
 a+=line([[x-5,y+3],[x-3,y],[x+3,y+1]],n===1?p.earthLight:p.deep,2)
 return a
}
function amalgam(d,phase,attack){
 const sway=[0,2,3,0,-2,-3][phase],reach=attack<0?0:[0,6,14,2][attack];let a=''
 for(const[x,s]of [[47,-1],[113,1],[61,-1],[99,1]])a+=bone([[x,60],[x+s*(15+reach),85],[x+s*(23+reach),118-Math.abs(sway)]],p.skinShade,8)+line([[x-2,64],[x+s*14-2,86],[x+s*22-2,115-Math.abs(sway)]],p.skin,3)+r(x+s*(23+reach)-4,115-Math.abs(sway),9,9,p.skinShade)
 a+=poly([[48,55],[65,41],[91,43],[113,55],[123,79],[121,106],[137,119],[126,126],[101,123],[87,126],[65,122],[43,126],[29,120],[41,105],[38,82]],p.ink)
 a+=poly([[51,57],[67,45],[88,47],[108,57],[117,80],[112,106],[127,118],[104,118],[85,122],[64,117],[42,122],[46,104],[44,83]],p.cloth)
 a+=poly([[55,60],[68,54],[72,66],[69,94],[60,112],[48,116],[52,98],[48,81]],p.linenShade)+poly([[84,50],[100,57],[105,74],[100,99],[106,116],[91,119],[86,97],[89,74]],p.linenShade)
 a+=line([[57,65],[62,77],[57,95],[54,111]],p.linen,3)+line([[96,62],[99,77],[94,97],[98,111]],p.linen,2)+line([[73,52],[80,72],[77,103],[83,118]],p.deep,4)
 for(const[x,y]of [[53,79],[60,101],[92,80],[98,106],[71,117],[111,113]])a+=r(x,y,4,2,p.deep)+r(x+1,y-1,2,1,p.linenShade)
 a+=poly([[49,58],[58,49],[70,50],[76,61],[68,70],[57,66]],p.linenShade)+poly([[72,51],[80,45],[90,47],[99,59],[93,69],[81,66]],p.skinShade)+poly([[99,59],[108,54],[117,57],[122,71],[111,76]],p.cloth)
 a+=line([[56,55],[63,58],[68,55]],p.linen,2)+line([[80,51],[85,54],[91,52]],p.skin,2)+line([[105,60],[112,64],[116,61]],p.linenShade,2)
 a+=bone([[64,55],[60+sway,50]],p.skinShade,6)+bone([[84,51],[83-sway,47]],p.skinShade,7)+bone([[108,61],[109+sway,56]],p.skinShade,6)
 a+=face(59+sway,34,d,0)+face(83-sway,29,d,1)+face(110+sway,39,d,2)
 for(const[x,y,s]of [[28,118,-1],[43,124,-1],[132,123,1],[149,112,1]]){a+=r(x-4,y-4,8,6,p.skinShade)+r(x-3,y-4,4,3,p.skin);for(let i=0;i<3;i++)a+=r(x-4+i*3,y+1+s*(i%2),2,4,p.skinShade)}
 if(d==='up')a+=poly([[50,59],[70,48],[101,54],[111,70],[100,99],[88,120],[71,114],[62,89]],p.cloth)+line([[67,57],[72,80],[68,101]],p.linenShade,2)
 return a
}
const designs={
 ash_hound:{w:96,h:64,scale:.5,head:23,shadow:[12,3],draw:(d,p,a)=>hound(d,p,a,false),description:'Lean ash-coated feral canine; long ribcage, bent hocks, narrow muzzle and individual fur clusters.'},
 ash_hound_alpha:{w:96,h:64,scale:.5,head:25,shadow:[14,3],draw:(d,p,a)=>hound(d,p,a,true),description:'Heavier canine with angular ruff, wider shoulder and neck scar; distinct from the smaller pack member.'},
 burrow_rat:{w:64,h:40,scale:.5,head:13,shadow:[7,1.5],draw:rat,description:'Low long-bodied rodent with folded ears, projecting snout, claw clusters and articulated bare tail.'},
 murk_leech:{w:48,h:32,scale:.5,head:8,shadow:[5,1],draw:leech,description:'Eyeless segmented marsh annelid with end sucker and longitudinal contraction.'},
 tender_drone:{w:112,h:104,scale:.25,head:23,shadow:[8,2],draw:(d,p,a)=>`<g transform="translate(8 8)">${drone(d,p,a,false)}</g>`,description:'Six articulated tool legs, overlapping iron plates, screw heads, cooling slots and two-jaw service tool.'},
 tender_drone_inert:{w:112,h:104,scale:.25,head:23,shadow:[8,2],inert:true,draw:(d,p,a)=>`<g transform="translate(8 8)">${drone(d,p,a,true)}</g>`,description:'Same original service machine, folded legs and dark inactive aperture.'},
 amalgam:{w:160,h:128,scale:.5,head:50,shadow:[22,4],draw:amalgam,description:'Living failed-treatment fusion: three distinct weary human faces, four long arms, joined torsos and dragging worn linen; no skeletal undead anatomy.'},
}
const dirs=['down','left','right','up'],fragment={sheets:{},frames:{},chars:{}},contact=[]
for(const[role,design]of Object.entries(designs)){
 const groups=[],cols=12,fw=design.w,fh=design.h,sheet='av319_'+role
 for(const[row,d]of dirs.entries())for(let col=0;col<cols;col++){
  const kind=col<6?'walk':col<8?'idle':'attack',idx=col<6?col:col<8?col-6:col-8,phase=col<6?col:0
  const key=`av319_${role}_${kind}_${d}${idx}`;fragment.frames[key]=[sheet,col*fw,row*fh,fw,fh]
  groups.push(`<g transform="translate(${col*fw} ${row*fh})">${design.draw(d,phase,col>=8?idx:-1)}</g>`)
 }
 writeFileSync(here+sheet+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${fw*cols}" height="${fh*4}" shape-rendering="crispEdges">${groups.join('\n')}</svg>`)
 execFileSync('inkscape',[here+sheet+'.svg','--export-type=png','--export-filename='+out+sheet+'.png'],{stdio:'pipe'})
 fragment.sheets[sheet]='sprites/original/direction-v319/'+sheet+'.png'
 const anchor=[.5,role==='amalgam'?126/fh:role.includes('drone')?100/fh:role.includes('hound')?60/fh:(fh-2)/fh],ch={walk:{},idle:{},attack:{},anchor,attackAnchor:anchor,renderScale:design.scale,headOffset:design.head,shadow:design.shadow,healthBarWidth:role==='amalgam'?28:role.includes('hound')?20:14}
 for(const d of dirs){ch.walk[d]=Array.from({length:design.inert?1:6},(_,i)=>`av319_${role}_walk_${d}${i}`);ch.idle[d]=Array.from({length:design.inert?1:2},(_,i)=>`av319_${role}_idle_${d}${i}`);ch.attack[d]=Array.from({length:4},(_,i)=>`av319_${role}_attack_${d}${i}`)}
 if(design.inert)delete ch.attack
 fragment.chars[role]=ch
 const index=contact.length;contact.push(`<g transform="translate(${(index%3)*220+20} ${Math.floor(index/3)*170+10})">${design.draw('left',0,-1)}<text x="80" y="150" fill="#c1b9a8" text-anchor="middle" font-size="11">${role}</text></g>`)
}
writeFileSync(here+'actors.fragment.json',JSON.stringify(fragment,null,2)+'\n')
writeFileSync(here+'actors-provenance.json',JSON.stringify({version:319,license:'CC0-1.0',source:'draw-actors.mjs',imageInput:false,referenceInventory:'../../research/stoneshard-v319/',designs:Object.fromEntries(Object.entries(designs).map(([key,d])=>[key,{width:d.w,height:d.h,renderScale:d.scale,description:d.description}]))},null,2)+'\n')
writeFileSync(here+'actors-contact.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="660" height="510" shape-rendering="crispEdges"><rect width="660" height="510" fill="#323436"/>${contact.join('')}</svg>`)
execFileSync('inkscape',[here+'actors-contact.svg','--export-type=png','--export-dpi=192','--export-filename='+here+'actors-contact.png'],{stdio:'pipe'})
if(process.argv.includes('--install')){const m=JSON.parse(readFileSync(root+'src/client/sprites.json','utf8'));for(const group of Object.keys(fragment))Object.assign(m[group],fragment[group]);writeFileSync(root+'src/client/sprites.json',JSON.stringify(m,null,2)+'\n')}
console.log(JSON.stringify({designs:7,sheets:7,frames:Object.keys(fragment.frames).length,installed:process.argv.includes('--install')}))
