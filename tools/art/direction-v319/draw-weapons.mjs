// Original vertical inventory drawings, informed by shape/scale study, no image input.
import {readFileSync,writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
const here=fileURLToPath(new URL('.',import.meta.url)),root=fileURLToPath(new URL('../../../',import.meta.url)),items=JSON.parse(readFileSync(here+'weapon-definitions.json','utf8'))
const p={ink:'#242529',dark:'#3c4447',iron:'#717f82',steel:'#a8b7b5',edge:'#d3d8c7',rust:'#80583f',rustLight:'#ab7750',wood:'#745338',grain:'#a58358',woodShade:'#49392c',leather:'#504034',wrap:'#a49b80',wrapShade:'#746b58',brass:'#a28a53',brassDark:'#665437',bone:'#bfaf8a',boneShade:'#897855',red:'#86594c',paper:'#c8b996'}
const r=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`
const poly=(pts,c)=>`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="${c}"/>`
const line=(pts,c,w=1)=>`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" stroke="${c}" stroke-width="${w}" fill="none"/>`
const ellipse=(x,y,rx,ry,c)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}"/>`
function shaft(x,top,bottom,width=4,metal=false){let s=r(x,top,width,bottom-top,p.ink)+r(x+1,top+1,width-2,bottom-top-2,metal?p.iron:p.wood)+r(x+1,top+3,1,bottom-top-6,metal?p.steel:p.grain);for(let y=top+8;y<bottom-3;y+=13)s+=r(x+2,y,1,3,metal?p.dark:p.woodShade);return s}
function grip(x,y,w,h){let s=r(x,y,w,h,p.ink)+r(x+1,y+1,w-2,h-2,p.leather);for(let yy=y+2;yy<y+h-1;yy+=4)s+=line([[x+1,yy],[x+w-2,yy+1]],p.wrapShade);return s+r(x+1,y+1,1,h-2,p.grain)}
function draw(item,w,h){
 const id=item.id.split('.')[1],cx=Math.floor(w/2);let s=''
 if(['RustyKnife','HuntingKnife','CustomKnife','SteelKnife','BoneKnife'].includes(id)){
  const bone=id==='BoneKnife',rust=id==='RustyKnife',point=5,guard=h-20
  s+=poly([[cx-2,point],[cx+5,point+6],[cx+5,guard-4],[cx+3,guard],[cx-3,guard],[cx-4,point+10]],p.ink)
  s+=poly([[cx-1,point+3],[cx+3,point+8],[cx+3,guard-4],[cx+1,guard-2],[cx-2,guard-2],[cx-2,point+10]],bone?p.boneShade:p.iron)
  s+=line([[cx,point+5],[cx+2,point+8],[cx+2,guard-4]],bone?p.bone:p.edge)+line([[cx-2,point+11],[cx-2,guard-3]],bone?p.bone:p.steel)
  if(rust)for(const[x,y]of [[cx-1,13],[cx+1,18],[cx-1,23]])s+=r(x,y,2,2,p.rust)+r(x+1,y-1,1,1,p.rustLight)
  if(id==='SteelKnife')s+=r(cx,12,1,guard-16,p.dark)
  if(bone)s+=poly([[cx-1,15],[cx+1,17],[cx,22],[cx+2,24],[cx+1,27],[cx-1,26]],p.bone)+r(cx-2,18,1,3,p.woodShade)
  s+=r(cx-6,guard,12,3,p.dark)+r(cx-5,guard,9,1,bone?p.boneShade:p.steel)+grip(cx-3,guard+3,7,14)+r(cx-2,h-5,6,2,p.iron)
 }else if(id==='Machete'||id==='Greatsword'){
  const guard=h-26,big=id==='Greatsword',left=cx-(big?7:5),right=cx+(big?7:7)
  s+=poly([[left+2,4],[right-3,7],[right,15],[right-1,guard-8],[cx+2,guard],[left,guard-1],[left,14]],p.ink)+poly([[left+3,7],[right-4,10],[right-2,16],[right-3,guard-8],[cx+1,guard-3],[left+2,guard-3],[left+2,14]],p.iron)
  s+=line([[left+3,9],[left+2,22],[left+2,guard-5]],p.edge,2)+line([[cx+2,16],[cx+2,guard-9]],p.dark)
  for(const[x,y]of [[cx+3,23],[cx,39],[cx+2,53]])if(y<guard-3)s+=r(x,y,2,3,p.rust)+r(x-1,y+1,1,2,p.rustLight)
  s+=r(cx-(big?12:7),guard,big?24:15,4,p.dark)+r(cx-(big?11:6),guard+1,big?22:13,1,p.steel)+grip(cx-4,guard+4,9,big?18:16)+r(cx-4,h-5,10,3,p.dark)+r(cx-2,h-5,5,1,p.steel)
 }else if(['Hatchet','CustomHatchet','SteelHatchet','FlintHatchet','AlloyHatchet'].includes(id)){
  const stone=id==='FlintHatchet',alloy=id==='AlloyHatchet'
  s+=shaft(cx-2,10,h-4,5)+grip(cx-3,h-17,7,12)
  s+=poly([[cx-5,9],[cx+7,6],[w-5,9],[w-7,17],[w-5,23],[cx+7,21],[cx-5,17]],p.ink)
  if(stone){s+=poly([[cx-3,11],[cx+6,8],[w-8,10],[w-10,14],[w-8,19],[cx+7,18],[cx+1,16]],p.dark)+poly([[cx+1,10],[cx+7,9],[w-10,11],[cx+8,14]],p.iron)+line([[cx+6,17],[w-9,18],[w-8,20]],p.steel)+line([[cx-3,10],[cx+3,20],[cx-3,17],[cx+3,12]],p.wrap,2)}
  else{s+=poly([[cx-3,11],[cx+8,8],[w-8,10],[w-10,17],[w-8,20],[cx+8,19],[cx-3,16]],alloy?p.dark:p.iron)+line([[w-8,10],[w-10,16],[w-8,20]],p.edge,2)+r(cx+1,12,3,4,p.dark)+r(cx+1,12,1,1,p.steel);if(alloy)s+=r(cx+7,11,5,2,p.steel)+r(cx+6,16,6,2,p.iron);if(id==='Hatchet')s+=r(cx+7,11,3,3,p.rust)+r(cx+4,16,2,2,p.rustLight)}
 }else if(['RebarSpear','Javelin','Pole'].includes(id)){
  const metal=id==='RebarSpear';s+=shaft(cx-2,19,h-4,5,metal)+grip(cx-3,Math.floor(h*.58),7,18)
  if(id==='Pole')s+=poly([[cx-5,5],[cx+3,4],[cx+7,10],[cx+6,22],[cx-5,22]],p.ink)+poly([[cx-3,7],[cx+2,6],[cx+4,11],[cx+3,20],[cx-3,19]],p.wood)+line([[cx-1,8],[cx+1,12],[cx,18]],p.grain)
  else{s+=poly([[cx,3],[cx+5,13],[cx+2,25],[cx-3,25],[cx-5,14]],p.ink)+poly([[cx,6],[cx+3,14],[cx+1,23],[cx-2,22],[cx-3,14]],p.iron)+line([[cx,7],[cx,21]],p.edge)+r(cx-4,24,8,6,p.wrapShade)+line([[cx-3,25],[cx+3,27],[cx-3,28]],p.wrap);if(metal)for(let y=32;y<h-10;y+=7)s+=line([[cx-2,y],[cx+2,y+2]],p.dark)}
 }else if(['PipeClub','AlloyClub'].includes(id)){
  s+=shaft(cx-3,7,h-4,7,true)+grip(cx-4,h-22,9,17)+ellipse(cx,7,6,4,p.ink)+ellipse(cx,6,4,2,p.iron)+ellipse(cx,6,2,1,p.dark)
  for(const[x,y]of [[cx+1,15],[cx-1,24],[cx+1,36]])s+=r(x,y,2,3,id==='PipeClub'?p.rust:p.dark)
  if(id==='AlloyClub')s+=r(cx-5,13,10,3,p.dark)+r(cx-5,13,9,1,p.steel)+r(cx-5,27,10,3,p.dark)
 }else if(id==='Bow'){
  const y=Math.floor(h/2);s+=line([[14,5],[23,12],[30,24],[32,y],[29,h-24],[22,h-12],[14,h-5]],p.ink,5)+line([[14,6],[22,13],[28,25],[30,y],[27,h-25],[21,h-13],[14,h-6]],p.wood,3)+line([[15,7],[21,13],[27,26]],p.grain)+line([[14,6],[16,y],[14,h-6]],p.wrap)+grip(27,y-6,7,13)+r(14,5,2,4,p.leather)+r(14,h-9,2,4,p.leather)
 }else if(id==='LightCrossbow'){
  s+=shaft(cx-4,9,h-6,9)+poly([[cx-7,h-23],[cx+4,h-26],[cx+4,h-8],[cx-5,h-4],[cx-9,h-7]],p.woodShade)+line([[4,19],[12,15],[cx,22],[w-12,15],[w-4,19]],p.ink,6)+line([[5,19],[12,17],[cx,24],[w-12,17],[w-5,19]],p.wood,3)+line([[5,19],[cx,34],[w-5,19]],p.wrap)+r(cx-2,11,4,32,p.dark)+r(cx-1,12,1,26,p.steel)+r(cx-6,h-25,13,4,p.iron)+r(cx+5,h-22,3,7,p.dark)+r(cx-5,h-13,4,1,p.grain)
 }else if(['FlintlockMusket','BoltRifle'].includes(id)){
  const long=h-27;s+=poly([[cx-5,27],[cx+3,27],[cx+4,long],[cx+9,h-7],[cx+5,h-3],[cx-9,h-6],[cx-5,long-5]],p.ink)+poly([[cx-3,29],[cx+1,29],[cx+2,long],[cx+6,h-8],[cx+4,h-6],[cx-6,h-8],[cx-3,long-3]],p.woodShade)
  s+=r(cx-2,5,6,long-2,p.dark)+r(cx-1,5,2,long-7,p.iron)+r(cx,7,1,long-12,p.steel)+r(cx-4,25,9,3,p.iron)+r(cx-4,long-12,9,3,p.dark)+line([[cx-4,h-19],[cx+4,h-10]],p.grain)+r(cx+4,long-4,6,2,p.dark)+r(cx+8,long-3,2,7,p.dark)+r(cx+4,long+4,5,2,p.dark)
  if(id==='FlintlockMusket')s+=poly([[cx+4,long-12],[cx+8,long-13],[cx+10,long-17],[cx+8,long-20],[cx+6,long-18],[cx+7,long-15],[cx+3,long-14]],p.iron)+r(cx+8,long-20,3,2,p.boneShade)
  else s+=r(cx-3,long-19,8,14,p.iron)+line([[cx+3,long-17],[cx+10,long-15],[cx+11,long-11]],p.dark,2)+r(cx+10,long-12,3,3,p.iron)
 }else if(id==='Revolver'){
  s+=poly([[10,17],[16,12],[39,12],[42,16],[40,21],[28,22],[27,28],[31,39],[25,44],[15,40],[17,29],[11,26]],p.ink)+r(22,14,18,5,p.iron)+r(23,14,16,1,p.steel)+r(37,12,2,3,p.dark)+ellipse(21,23,8,7,p.dark)+ellipse(21,22,6,5,p.iron)+r(19,19,2,2,p.dark)+r(24,20,2,2,p.dark)+r(20,24,2,2,p.dark)+poly([[20,28],[25,28],[28,38],[25,41],[18,38]],p.wood)+line([[21,30],[25,38]],p.grain)+r(25,27,7,2,p.dark)+r(30,28,2,5,p.dark)+r(26,33,5,2,p.dark)
 }else if(id==='ScrapBuckler'){
  s+=ellipse(cx,24,20,20,p.ink)+ellipse(cx,23,18,18,p.dark)+poly([[10,10],[24,7],[37,13],[36,28],[29,39],[13,36],[7,22]],p.iron)+poly([[10,12],[23,9],[22,24],[11,33],[9,23]],p.rust)+line([[12,10],[24,8],[36,14]],p.steel,2)+line([[13,35],[29,38],[36,28]],p.dark,2)+ellipse(cx,24,8,8,p.dark)+ellipse(cx-1,22,6,6,p.iron)+ellipse(cx-2,20,3,2,p.steel)
  for(const[x,y]of [[24,8],[39,24],[24,39],[8,24]])s+=r(x-1,y-1,3,3,p.dark)+r(x,y-1,1,1,p.steel)
 }else if(id==='Torch'){
  s+=shaft(cx-2,22,h-4,5)+grip(cx-3,42,7,13)+poly([[cx-6,8],[cx+4,6],[cx+7,15],[cx+4,29],[cx-5,28],[cx-7,17]],p.ink)+poly([[cx-4,10],[cx+3,8],[cx+4,17],[cx+2,26],[cx-3,25],[cx-5,17]],p.wrapShade)+line([[cx-4,12],[cx+3,15],[cx-4,19],[cx+3,22]],p.wrap,2)+r(cx-3,8,5,4,p.dark)+r(cx-4,25,8,3,p.leather)
 }else if(id==='Arrow'||id==='Bolt'){
  for(let i=0;i<3;i++){const x=6+i*6,top=4+i%2*3,bottom=h-5-i%2*2;s+=shaft(x,top+7,bottom,2)+poly([[x,top],[x+3,top+7],[x-2,top+7]],p.iron)+line([[x,top+1],[x+1,top+5]],p.steel)+poly([[x-2,bottom-10],[x,bottom-12],[x+2,bottom-8],[x+2,bottom-3],[x,bottom-5],[x-2,bottom-3]],id==='Arrow'?p.wrap:p.iron)}
 }else if(id==='LeadBall'){
  s+=ellipse(12,13,8,8,p.ink)+ellipse(11,12,6,6,p.iron)+ellipse(9,9,3,2,p.steel)+r(14,15,3,2,p.dark)+r(10,18,3,1,p.dark)
 }else if(id==='BlackPowderCharge'){
  s+=poly([[7,4],[15,3],[18,7],[18,19],[15,22],[7,21],[4,17],[5,8]],p.ink)+poly([[8,5],[14,4],[16,8],[16,18],[14,20],[8,19],[6,16],[7,8]],p.paper)+line([[8,6],[14,8],[9,10],[8,18]],p.wrapShade)+r(10,12,5,3,p.dark)+r(11,13,2,1,p.iron)
 }else if(id==='FactoryCartridge'||id==='ReclaimedCartridge'){
  const used=id==='ReclaimedCartridge';s+=r(8,7,8,14,p.ink)+poly([[9,8],[9,5],[12,2],[15,5],[15,8]],used?p.iron:p.steel)+r(9,9,6,11,used?p.brassDark:p.brass)+r(10,10,1,9,p.paper)+r(7,20,10,2,p.brassDark)+r(8,20,8,1,p.brass);if(used)s+=r(13,12,2,3,p.dark)+r(10,17,2,1,p.rust)
 }else throw Error('Unassigned weapon/ammo design: '+item.id)
 return s
}
const sheet='av319_weapons',fragment={sheets:{[sheet]:'sprites/original/direction-v319/weapons.png'},frames:{}},groups=[],rows=[]
for(const[index,item]of items.entries()){
 const w=item.size[0]*24,h=item.size[1]*24,x=(index%10)*64+8,y=Math.floor(index/10)*112+8
 if(w>48||h>96)throw Error('Review new large inventory drawing '+item.id)
 groups.push(`<g id="${item.id}" transform="translate(${x} ${y})">${draw(item,w,h)}</g>`);fragment.frames[item.sprite]=[sheet,x,y,w,h];rows.push({id:item.id,label:item.label,frame:item.sprite,width:w,height:h,grid:item.size})
}
writeFileSync(here+'weapons.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="${Math.ceil(items.length/10)*112}" shape-rendering="crispEdges">${groups.join('\n')}</svg>`)
execFileSync('inkscape',[here+'weapons.svg','--export-type=png','--export-filename='+root+'public/sprites/original/direction-v319/weapons.png'],{stdio:'pipe'})
writeFileSync(here+'weapons.fragment.json',JSON.stringify(fragment,null,2)+'\n');writeFileSync(here+'weapons-provenance.json',JSON.stringify({version:319,source:'draw-weapons.mjs',license:'CC0-1.0',imageInput:false,referenceInventory:'../../research/stoneshard-v319/',intent:'Inventory proportions follow each actual Item grid; all geometry and palette authored here. Torch drawing is an unlit wrapped tool; actual lit indicators remain state-driven.',items:rows},null,2)+'\n')
if(process.argv.includes('--install')){const m=JSON.parse(readFileSync(root+'src/client/sprites.json','utf8'));Object.assign(m.sheets,fragment.sheets);Object.assign(m.frames,fragment.frames);writeFileSync(root+'src/client/sprites.json',JSON.stringify(m,null,2)+'\n')}
console.log(JSON.stringify({items:items.length,sheets:1,installed:process.argv.includes('--install')}))
