// Original people revision319: finer authored fabric/face clusters after the complete wiki inventory and visual taxonomy study. No image input or tracing.
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
const here=fileURLToPath(new URL('.',import.meta.url)),root=fileURLToPath(new URL('../../../',import.meta.url))
const output=root+'public/sprites/original/direction-v319/'
mkdirSync(output,{recursive:true})
const dirs=['down','left','right','up']
const palette={ink:'#201f21',deep:'#333135',seam:'#423c38',skin:'#b9a28a',cheek:'#967c69',skinShade:'#715a51',skinLight:'#d1bea1',hair:'#39312d',grey:'#aaa28f',iron:'#727a7a',ironLight:'#a0a6a0',ironDark:'#424b50',brass:'#a18a60',linen:'#b3a58b',linenShade:'#847b68',leather:'#69513c',leatherLight:'#8a7051',boot:'#3c3430',bootLight:'#635247',fungus:'#ac9a7c',gill:'#746451'}
const designs={
 original_wanderer_hero:{cloth:'#5f6970',light:'#84908e',dark:'#414b53',head:'hood',coat:49,cape:true,scarf:true,bag:true,description:'Narrow ash-blue cowl, layered shoulder mantle, mended travelling coat, linen scarf and map satchel.'},
 hero:{cloth:'#6e665a',light:'#988a73',dark:'#4e4943',head:'grey',coat:50,cape:true,bag:true,description:'Older traveller, exposed grey temples, uneven shoulder blanket and patched long wool coat.'},
 resident_worker:{cloth:'#6a6654',light:'#979077',dark:'#4b493e',head:'crop',coat:43,apron:true,rolled:true,patch:true,description:'Cropped hair, rolled sleeves, full linen apron, knee repair and work pouch.'},
 resident_healer:{cloth:'#858477',light:'#b2ae97',dark:'#5b6059',head:'wrap',coat:48,apron:true,cloths:true,bag:true,description:'Narrow linen headwrap, asymmetric clean apron and folded cloths at the belt.'},
 resident_guard:{cloth:'#626469',light:'#8a8c88',dark:'#41454c',head:'hood',coat:50,quilt:true,armour:true,description:'Open cowl, long quilted coat, leather shoulder reinforcement and braced boots.'},
 resident_trader:{cloth:'#715f51',light:'#9a8369',dark:'#4e413c',head:'receding',coat:49,lapels:true,bag:true,description:'Receding hair, folded high collar, overlapping waistcoat, document case and separate belt pockets.'},
 reaver0:{cloth:'#6f5c4c',light:'#9b8063',dark:'#4c4039',head:'helmet',coat:42,armour:true,rolled:true,scar:true,description:'Broad iron cap, riveted scrap vest, exposed scarred forearms and heavy boots.'},
 reaver1:{cloth:'#71665a',light:'#998d75',dark:'#4d453e',head:'bald',coat:44,sash:true,rolled:true,scar:true,description:'Shaved head, one torn sleeve, diagonal leather binding and wrapped calves.'},
 complete_reaver_chief:{cloth:'#68615b',light:'#988c78',dark:'#454147',head:'helmet',coat:51,armour:true,cape:true,broad:true,description:'Broad layered scrap shoulders, split heavy coat, battered iron cap and reinforced belt.'},
 complete_reaver_archer:{cloth:'#62664f',light:'#909275',dark:'#434b3e',head:'hood',coat:44,cape:true,quiver:true,description:'Narrow cowl, short side cape, sloping quiver and separate articulated knees.'},
 shade0:{cloth:'#766f60',light:'#a09780',dark:'#514b42',head:'bald',coat:43,small:true,ill:true,torn:true,description:'Small adult with lowered bald face, torn work smock, long forearms and bent knees.'},
 shade1:{cloth:'#6c665f',light:'#958c79',dark:'#48433f',head:'crop',coat:44,small:true,ill:true,lapels:true,bag:true,description:'Small adult with side-parted hair, open short vest, bound shins and a low satchel.'},
 shade2:{cloth:'#696d65',light:'#949989',dark:'#454b45',head:'lank',coat:46,small:true,ill:true,sash:true,torn:true,description:'Small adult with lank hair, hanging sleeve, long hands and diagonal chest wrap.'},
 shade3:{cloth:'#7c6d59',light:'#a59476',dark:'#554a3e',head:'knot',coat:44,small:true,ill:true,apron:true,rolled:true,description:'Small adult with tied hair, sleeveless shoulder wrap and rag apron.'},
 shade_chief:{cloth:'#6c675e',light:'#9c927c',dark:'#494640',head:'receding',coat:48,small:true,ill:true,lapels:true,cloths:true,description:'Small adult leader with a high rough collar, overlapping short coat and bandaged forearm.'},
 withered:{cloth:'#7a7365',light:'#a49b84',dark:'#555044',head:'bald',coat:42,ill:true,thin:true,rolled:true,torn:true,description:'Living fever patient, narrow chest under a fallen sleeve, lowered face and flexed shins.'},
 withered_priest:{cloth:'#77716b',light:'#a59b87',dark:'#514b49',head:'bald',coat:56,ill:true,thin:true,stole:true,description:'Living fever patient in a long worn vestment, rope stole and carefully mended hem.'},
 spore0:{cloth:'#787664',light:'#a49e80',dark:'#535344',head:'lank',coat:48,ill:true,fungus:1,torn:true,description:'Infected living pilgrim with dry shelf growth on one shoulder and forearm, torn long shirt.'},
 spore1:{cloth:'#71685b',light:'#9c8d73',dark:'#4c453e',head:'hood',coat:45,ill:true,fungus:2,cape:true,description:'Infected living pilgrim with asymmetric back growth, folded hood and sparse calf crust.'},
}
const rect=(x,y,w,h,fill)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`
const poly=(points,fill)=>`<polygon points="${points.map(p=>p.join(',')).join(' ')}" fill="${fill}"/>`
const line=(points,color,width=1)=>`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="miter"/>`
function limb(points,color,width=5){return line(points,palette.ink,width+2)+line(points,color,width)+line(points.map(([x,y])=>[x-1,y]),palette.linenShade,1)}
function person(role,d,phase=0,idle=0,attack=-1){
 const c=designs[role],p=palette,side=d==='left'||d==='right',back=d==='up',sign=d==='left'?-1:1
 const swing=[0,2,3,0,-2,-3][phase],lift=[0,1,3,0,1,3][phase]
 const thin=c.thin?2:0,broad=c.broad?2:0,shoulder=11-thin+broad
 let a=''
 // Legs are drawn separately: planted soles remain at y62; the other foot lifts.
 for(const i of side?[1,0]:[0,1]){
  const s=i?1:-1,x=24+(side?s*2:s*5),travel=side?s*swing:s*Math.round(swing/2),footY=62-(s*swing>0?lift:0)
  const kneeX=x+travel,footX=x+(side?travel*2:travel),kneeY=51+(c.ill?1:0)
  a+=limb([[x,40],[kneeX,kneeY],[footX,footY-4]],c.ill?p.skinShade:c.dark,5-thin)
  a+=rect(footX-3,footY-6,6,5,p.boot)+rect(footX-3+(side?sign:0),footY-2,7,2,p.ink)
  a+=rect(footX-2,footY-5,3,1,p.bootLight)+rect(footX-2,footY-3,4,1,p.leather)
  if(c.patch&&i===0)a+=rect(kneeX-2,kneeY-2,4,5,p.linenShade)+line([[kneeX-1,kneeY-2],[kneeX-1,kneeY+2]],p.linen)
  if(c.sash||c.small)a+=line([[footX-2,55],[footX+2,56],[footX-2,58],[footX+2,59]],p.linenShade)
 }
 if(c.cape)a+=poly([[24-shoulder-1,23],[24+shoulder,24],[36+(side?sign*2:0),48],[28,46],[19,50],[11,46]],c.dark)+line([[17,29],[16,44],[20,47]],c.cloth)
 if(c.quiver){a+=poly([[28,23],[33,22],[39,43],[34,45]],p.leather);for(let i=0;i<3;i++)a+=line([[29+i*2,27],[26+i*2,13]],p.grey)+poly([[26+i*2,13],[24+i*2,12],[25+i*2,16]],p.linenShade)}
 const bottom=c.coat,bodyLeft=side?17:24-shoulder,bodyRight=side?31:24+shoulder
 a+=poly([[bodyLeft,25],[20,21],[28,21],[bodyRight,26],[bodyRight-2,38],[bodyRight+1,bottom-1],[27,bottom+1],[24,bottom-3],[21,bottom],[bodyLeft-1,bottom-1],[bodyLeft+2,36]],p.ink)
 a+=poly([[bodyLeft+2,26],[21,23],[27,23],[bodyRight-2,27],[bodyRight-4,37],[bodyRight-1,bottom-2],[27,bottom-1],[25,bottom-5],[22,bottom-1],[bodyLeft+1,bottom-2],[bodyLeft+4,36]],c.cloth)
 a+=poly([[bodyLeft+2,28],[bodyLeft+5,26],[21,37],[21,bottom-2],[bodyLeft+1,bottom-3],[bodyLeft+4,36]],c.dark)
 a+=line([[26,25],[27,36],[28,bottom-3]],c.light)+line([[bodyRight-4,29],[bodyRight-5,35],[bodyRight-3,41]],c.light)
 if(back)a+=line([[24,25],[23,34],[24,bottom-2]],c.dark)+line([[19,29],[24,31],[29,29]],c.light)
 else{
  a+=line([[23,26],[22,35],[23,bottom-4]],p.seam)
  for(let y=29;y<38;y+=4)a+=rect(24,y,1,1,p.brass)
 }
 // Small authored cloth clusters follow folds, not a uniform noise/dither filter.
 const foldShade=c.apron?p.linenShade:c.dark,foldLight=c.apron?p.linen:c.light
 for(const[x,y,w,h]of (side?[[19,31,1,3],[27,34,1,4],[20,bottom-6,2,1]]:back?[[18,29,1,4],[27,32,2,1],[20,36,1,3],[29,bottom-6,1,3]]:[[18,30,1,3],[28,31,2,1],[20,34,1,2],[27,35,1,3],[17,bottom-5,2,1],[29,bottom-4,1,2]]))a+=rect(x,y,w,h,foldShade)
 for(const[x,y]of [[bodyLeft+3,28],[bodyRight-4,32],[bodyLeft+4,bottom-3],[27,bottom-2]])a+=rect(x,y,1,1,foldLight)
 if(!c.apron&&!c.armour)a+=line([[19,bottom-4],[20,bottom-3],[22,bottom-3]],c.light)+rect(20,32,1,1,p.seam)+rect(21,33,1,1,c.light)
 if(c.quilt)for(let y=28;y<bottom-2;y+=5)a+=line([[bodyLeft+3,y],[24,y+2],[bodyRight-3,y]],c.dark)
 if(c.apron){a+=poly([[20,28],[27,28],[29,37],[31,bottom+1],[23,bottom+2],[17,bottom],[19,37]],p.linenShade)+poly([[21,29],[26,29],[26,38],[28,bottom],[19,bottom-1],[21,38]],p.linen)+line([[22,32],[22,bottom-3]],c.light)+rect(22,36,4,4,p.linenShade)+line([[23,36],[23,39]],p.linen)}
 if(c.lapels&&!back)a+=poly([[19,23],[23,25],[22,34],[17,26]],p.linenShade)+poly([[27,23],[25,28],[27,34],[31,26]],c.light)
 if(c.sash)a+=poly([[15,25],[18,23],[33,37],[30,39]],p.leather)+line([[17,25],[31,37]],p.leatherLight)
 if(c.stole)a+=line([[20,23],[18,29],[20,49]],p.linenShade,3)+line([[28,23],[30,29],[28,51]],p.linen,2)+rect(27,47,3,5,p.leather)
 if(c.armour){a+=poly([[bodyLeft,25],[20,23],[22,29],[17,31],[bodyLeft-1,29]],p.leather)+poly([[28,24],[bodyRight+1,26],[bodyRight+1,30],[29,30]],p.ironDark)+line([[29,25],[bodyRight,27]],p.iron);for(let x=17;x<33;x+=4)a+=rect(x,30,1,1,p.ironLight)}
 // Waist binding, buckle, pouches and repairs use discrete material highlights.
 a+=rect(bodyLeft+3,37,bodyRight-bodyLeft-5,3,p.leather)+rect(23,37,3,3,p.brass)+rect(24,38,1,1,p.deep)
 a+=rect(bodyLeft+3,39,4,6,p.leather)+rect(bodyLeft+3,39,4,1,p.leatherLight)+rect(bodyLeft+4,42,1,1,p.brass)
 if(c.bag){a+=line([[18,24],[31,40]],p.leather,2)+poly([[29,39],[36,38],[37,47],[30,48],[28,45]],p.ink)+rect(30,40,5,6,p.leather)+rect(30,40,6,2,p.leatherLight)+rect(32,43,1,2,p.brass)}
 if(c.cloths)a+=rect(28,39,5,7,p.linenShade)+rect(29,39,3,6,p.linen)+line([[29,41],[32,41]],p.grey)
 for(const [x,y]of [[18,bottom-4],[30,bottom-6]])a+=line([[x,y],[x+2,y+1],[x+2,y+3]],c.dark)+rect(x+1,y,1,1,c.light)
 if(c.torn)a+=poly([[18,bottom-2],[20,bottom-5],[22,bottom],[26,bottom-3],[27,bottom+2]],p.deep)
 // Upper arms and forearms counter-swing; attack frames describe unarmed/held-gear poses.
 for(const i of side?[1,0]:back?[0,1]:[1,0]){
  const s=i?1:-1,ax=side?24+s*4:24+s*shoulder,ay=27+(idle&&i===0?1:0)
  let ex=ax+s*2,ey=35+swing*s,hx=ex-s,hy=43+swing*s
  if(side){ex=ax-sign*s*swing;hx=ex+sign*2;hy=43+s*swing}
  if(attack>=0){const reach=[-2,8,12,2][attack],raise=[-6,-12,-2,0][attack];ex=ax+(side?sign*reach:s*2);hx=ex+(side?sign*3:s*2);ey=34+raise;hy=40+raise+(side?0:Math.round(reach*(back?-.7:.6)))}
  a+=limb([[ax,ay],[ex,ey],[hx,hy-2]],c.cloth,4-thin)
  if(c.rolled)a+=line([[ex,ey],[hx,hy-2]],p.skinShade,4)+line([[ex-1,ey],[hx-1,hy-3]],p.skin,2)+rect(ex-2,ey-1,4,2,p.linenShade)
  a+=rect(hx-2,hy-2,4,4,p.skinShade)+rect(hx-2,hy-2,3,2,p.skin)+rect(hx-1,hy+1,2,1,p.cheek)
  if(c.scar&&i===0)a+=line([[ex-1,ey+1],[ex+1,ey+3]],'#9e7462')
 }
 if(c.cape)a+=poly([[13,24],[21,21],[29,22],[35,27],[30,30],[22,26],[16,32],[12,29]],c.dark)+line([[14,25],[21,23],[28,24],[32,27]],c.light)
 if(c.scar&&!back)a+=line([[27,30],[29,31]],p.skinShade)
 // A fully authored face: brow, eye sockets, nose, cheek, jaw and ear, not a flat dot.
 const headY=c.ill?9:7
 a+=rect(22,19,4,5,p.skinShade)+rect(22,20,3,3,p.skin)
 a+=poly([[19,headY+1],[22,headY-1],[27,headY],[30,headY+4],[29,headY+10],[26,headY+14],[22,headY+13],[19,headY+9],[18,headY+4]],p.ink)
 a+=poly([[20,headY+2],[23,headY],[27,headY+1],[28,headY+5],[27,headY+11],[24,headY+13],[21,headY+10],[20,headY+6]],back?p.hair:p.skinShade)
 if(!back){
  if(side){const fx=24+sign*3;a+=poly([[23,headY+1],[26,headY+2],[fx,headY+5],[fx+sign*2,headY+7],[fx,headY+8],[26,headY+11],[23,headY+11],[22,headY+5]],p.skin)+rect(fx-sign,headY+5,2,1,p.deep)+rect(fx,headY+7,2,1,p.skinLight)+rect(23-sign*2,headY+7,2,3,p.cheek)+line([[24,headY+10],[26,headY+10]],p.skinShade)}
  else{a+=poly([[21,headY+2],[25,headY+1],[27,headY+3],[27,headY+8],[25,headY+11],[22,headY+10],[21,headY+7]],p.skin)+rect(21,headY+4,2,1,p.hair)+rect(25,headY+4,2,1,p.hair)+rect(21,headY+5,2,1,p.deep)+rect(26,headY+5,1,1,p.deep)+line([[24,headY+5],[24,headY+8],[25,headY+8]],p.skinLight)+rect(21,headY+8,2,2,p.cheek)+rect(23,headY+10,3,1,p.skinShade)+rect(24,headY+11,2,1,p.skinLight)}
 }
 const hair=c.head==='grey'?p.grey:p.hair
 if(c.head!=='bald')a+=poly([[19,headY+4],[20,headY],[23,headY-1],[28,headY],[29,headY+4],[27,headY+3],[25,headY+1],[21,headY+2]],hair)+line([[20,headY+1],[24,headY],[27,headY+1]],c.head==='grey'?p.linenShade:p.leather)
 if(c.head==='receding')a+=rect(22,headY,4,3,p.skinShade)+rect(23,headY,3,2,p.skin)
 if(c.head==='lank')a+=poly([[19,headY+2],[21,headY+1],[20,headY+14],[18,headY+11]],p.hair)+poly([[28,headY+2],[30,headY+4],[30,headY+15],[27,headY+11]],p.hair)
 if(c.head==='knot')a+=rect(25,headY-4,4,4,p.hair)+rect(26,headY-4,2,1,p.leather)
 if(c.head==='wrap')a+=poly([[18,headY+3],[20,headY-1],[27,headY-1],[30,headY+3],[28,headY+4],[24,headY+1],[20,headY+4]],p.linenShade)+line([[20,headY],[26,headY],[29,headY+3]],p.linen,2)+rect(28,headY+9,2,7,p.linenShade)
 if(c.head==='helmet')a+=poly([[17,headY+4],[18,headY],[23,headY-3],[28,headY-2],[31,headY+3],[31,headY+5],[17,headY+5]],p.ironDark)+poly([[19,headY+2],[21,headY-1],[26,headY-2],[29,headY+2]],p.iron)+line([[21,headY-1],[25,headY-2]],p.ironLight)+rect(18,headY+4,12,1,p.leather)+rect(24,headY-2,1,5,p.ironDark)
 if(c.head==='hood'){
  a+=poly([[16,headY+4],[18,headY-1],[23,headY-4],[28,headY-2],[32,headY+4],[31,headY+15],[27,headY+17],[29,headY+10],[28,headY+3],[24,headY],[20,headY+3],[19,headY+10],[21,headY+15],[17,headY+13]],c.dark)+line([[18,headY+1],[23,headY-2],[28,headY],[30,headY+5]],c.light)+line([[18,headY+5],[18,headY+10],[20,headY+14]],c.cloth)
  if(back)a+=poly([[19,headY+2],[24,headY-1],[29,headY+3],[29,headY+12],[25,headY+16],[20,headY+13]],c.cloth)+line([[23,headY+2],[24,headY+10],[26,headY+13]],c.dark)
 }
 if(c.scar&&!back)a+=line([[26,headY+6],[25,headY+8]],'#855f53')
 if(!back){
  const cheekX=side?24+sign:25
  a+=rect(cheekX,headY+8,1,1,p.skinLight)+rect(cheekX-sign,headY+9,1,1,p.cheek)
  if(c.head==='grey'||c.head==='receding'||c.ill)a+=rect(22,headY+3,1,1,p.cheek)+rect(26,headY+7,1,1,p.skinShade)
  if(c.head==='crop'||c.head==='grey')a+=rect(21,headY+1,1,1,p.leather)+rect(26,headY,1,1,p.leather)
 }
 if(c.scarf)a+=poly([[18,22],[23,23],[29,22],[29,25],[24,27],[19,25]],p.linenShade)+line([[20,23],[24,25],[28,23]],p.linen)+poly([[27,25],[30,26],[29,34],[26,32]],p.linenShade)+rect(28,28,1,4,p.linen)
 if(c.fungus){const x=c.fungus===1?12:31;for(const [dx,y,w]of [[0,26,8],[3,29,6],[-1,33,5]])a+=poly([[x+dx,y],[x+dx+2,y-2],[x+dx+w-2,y-1],[x+dx+w,y+1],[x+dx+1,y+2]],p.gill)+rect(x+dx+1,y-1,w-2,2,p.fungus)+rect(x+dx+2,y-2,2,1,p.linenShade)}
 return c.small?`<g transform="translate(5 14) scale(.8 .78)">${a}</g>`:a
}
const fragment={sheets:{},frames:{},chars:{}}
const contacts=[]
for(const role of Object.keys(designs)){
 for(const attack of [false,true]){
  const fw=attack?64:48,fh=attack?80:64,cols=attack?4:8,sheet=`av319_${role}${attack?'_attack':''}`,groups=[]
  for(const [row,d]of dirs.entries())for(let col=0;col<cols;col++){
   const kind=attack?'attack':col<6?'walk':'idle',phase=attack?0:col<6?col:0,idx=attack?col:col<6?col:col-6
   const key=`av319_${role}_${kind}_${d}${idx}`
   fragment.frames[key]=[sheet,col*fw,row*fh,fw,fh]
   groups.push(`<g id="${key}" transform="translate(${col*fw+(attack?8:0)} ${row*fh+(attack?16:0)})">${person(role,d,phase,col===7?1:0,attack?col:-1)}</g>`)
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${fw*cols}" height="${fh*4}" viewBox="0 0 ${fw*cols} ${fh*4}" shape-rendering="crispEdges">${groups.join('\n')}</svg>\n`
  writeFileSync(here+sheet+'.svg',svg)
  execFileSync('inkscape',[here+sheet+'.svg','--export-type=png','--export-filename='+output+sheet+'.png'],{stdio:'pipe'})
  fragment.sheets[sheet]='sprites/original/direction-v319/'+sheet+'.png'
 }
 const ch={walk:{},idle:{},attack:{},anchor:[.5,.96875],attackAnchor:[.5,.975],renderScale:.5,heldItems:true,headOffset:designs[role].small?25:31}
 for(const d of dirs){ch.walk[d]=Array.from({length:6},(_,i)=>`av319_${role}_walk_${d}${i}`);ch.idle[d]=Array.from({length:2},(_,i)=>`av319_${role}_idle_${d}${i}`);ch.attack[d]=Array.from({length:4},(_,i)=>`av319_${role}_attack_${d}${i}`)}
 fragment.chars[role]=ch
 contacts.push(`<g transform="translate(${(contacts.length%5)*82+16} ${Math.floor(contacts.length/5)*94+5})">${person(role,'down')}<text x="24" y="76" text-anchor="middle" font-size="6" fill="#b6ac97">${role.replace('original_wanderer_hero','wanderer').replace('complete_reaver_','').replace('resident_','')}</text></g>`)
}
fragment.chars.player=structuredClone(fragment.chars.original_wanderer_hero)
fragment.chars.reaver2=structuredClone(fragment.chars.complete_reaver_chief)
writeFileSync(here+'people.fragment.json',JSON.stringify(fragment,null,2)+'\n')
writeFileSync(here+'provenance.json',JSON.stringify({version:319,license:'CC0-1.0',source:'draw-people.mjs',referenceStudy:'../../research/stoneshard-v319/',imageInput:false,method:'Original integer SVG silhouettes, anatomy and material details; rasterized by Inkscape.',designs,logicalSizeUnchanged:true,walkFramesPerDirection:6,idleFramesPerDirection:2,attackFramesPerDirection:4},null,2)+'\n')
writeFileSync(here+'contact.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="410" height="376" viewBox="0 0 410 376" shape-rendering="crispEdges"><rect width="410" height="376" fill="#343536"/>${contacts.join('')}</svg>`)
execFileSync('inkscape',[here+'contact.svg','--export-type=png','--export-filename='+here+'contact.png','--export-dpi=288'],{stdio:'pipe'})
if(process.argv.includes('--install')){
 const manifest=JSON.parse(readFileSync(root+'src/client/sprites.json','utf8'))
 for(const group of Object.keys(fragment))Object.assign(manifest[group],fragment[group])
 writeFileSync(root+'src/client/sprites.json',JSON.stringify(manifest,null,2)+'\n')
}
console.log(JSON.stringify({people:Object.keys(designs).length,registrations:Object.keys(fragment.chars).length,sheets:Object.keys(fragment.sheets).length,frames:Object.keys(fragment.frames).length,installed:process.argv.includes('--install')}))
