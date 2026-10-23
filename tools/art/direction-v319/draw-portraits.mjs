// Original pixel portraits. Face planes/creases are authored geometry, no photo/image input.
import {readFileSync,writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
const here=fileURLToPath(new URL('.',import.meta.url)),root=fileURLToPath(new URL('../../../',import.meta.url)),designs=JSON.parse(readFileSync(here+'provenance.json','utf8')).designs
const p={ink:'#242428',dark:'#3b3534',skin:'#b59b81',skinLight:'#d3bda0',skinMid:'#c2a88c',cheek:'#a1826b',skinShade:'#7d6256',deepSkin:'#624c45',hair:'#43362f',hairLight:'#72604a',grey:'#aaa18c',linen:'#b6a88b',linenShade:'#847b68',iron:'#6e7e80',ironDark:'#414e52',ironLight:'#a7b3ad',leather:'#68503a',leatherLight:'#937452',brass:'#a98e59'}
const r=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`
const poly=(pts,c)=>`<polygon points="${pts.map(p=>p.join(',')).join(' ')}" fill="${c}"/>`
const line=(pts,c,w=1)=>`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}"/>`
const faces={
 original_wanderer_hero:{temple:0,jaw:1,eye:-1,nose:1,mouth:0,stubble:true},hero:{temple:-1,jaw:-1,eye:0,nose:-1,mouth:1},
 resident_worker:{temple:-1,jaw:-2,eye:0,nose:0,mouth:0,skin:'#b49b7c'},resident_healer:{temple:1,jaw:1,eye:-1,nose:0,mouth:-1,skin:'#c1aa8c'},
 resident_guard:{temple:-1,jaw:-2,eye:1,nose:1,mouth:1,stubble:true},resident_trader:{temple:-1,jaw:-1,eye:0,nose:0,mouth:1,beard:true},
 reaver0:{temple:-1,jaw:-1,eye:1,nose:-1,mouth:0,beard:true},reaver1:{temple:0,jaw:1,eye:0,nose:1,mouth:1,skin:'#a58d76'},
 complete_reaver_chief:{temple:-1,jaw:-2,eye:1,nose:1,mouth:2,beard:true},complete_reaver_archer:{temple:1,jaw:1,eye:0,nose:-1,mouth:0},
 shade0:{temple:1,jaw:1,eye:1,nose:0,mouth:1},shade1:{temple:0,jaw:0,eye:0,nose:1,mouth:1,stubble:true},shade2:{temple:1,jaw:2,eye:1,nose:0,mouth:2},shade3:{temple:0,jaw:1,eye:-1,nose:-1,mouth:0},shade_chief:{temple:0,jaw:0,eye:1,nose:1,mouth:1,beard:true},
 withered:{temple:1,jaw:2,eye:2,nose:0,mouth:2},withered_priest:{temple:0,jaw:1,eye:1,nose:1,mouth:1,stubble:true},spore0:{temple:1,jaw:0,eye:1,nose:-1,mouth:1},spore1:{temple:0,jaw:1,eye:0,nose:1,mouth:2},
}
function portrait(role,c){
 const face=faces[role];if(!face)throw Error('Portrait anatomy not assigned '+role)
 const old=c.head==='grey'||c.head==='receding'||c.ill,broad=c.broad?2:0,thin=c.thin||c.small?2:0,left=18-broad+thin+face.temple,right=48+broad-thin-face.temple,chinLeft=28+face.jaw,chinRight=37-face.jaw,skin=face.skin??(c.ill?'#a39980':p.skin),light=c.ill?'#c0b395':p.skinLight
 let a=r(0,0,64,80,'#29292b')+poly([[0,70],[14,61],[22,58],[46,59],[58,67],[64,78],[64,80],[0,80]],p.ink)+poly([[2,71],[16,64],[24,60],[44,61],[57,68],[62,80],[2,80]],c.dark)
 a+=poly([[6,71],[17,65],[26,63],[31,80],[5,80]],c.cloth)+poly([[42,63],[54,69],[58,80],[43,80],[37,67]],c.cloth)+line([[8,71],[17,66],[24,65]],c.light,2)+line([[51,69],[54,79]],c.light)
 a+=poly([[24,50],[42,50],[44,63],[36,70],[26,64]],p.deepSkin)+poly([[26,52],[37,54],[38,64],[33,67],[27,62]],p.skinShade)+r(28,57,5,6,skin)
 a+=poly([[left,23],[left+3,15],[26,11],[38,12],[right-3,18],[right,30],[right-1,43],[44,52],[chinRight,59],[chinLeft,60],[21,55],[left-2,44],[left-3,32]],p.ink)
 a+=poly([[left+1,24],[left+4,17],[27,13],[37,14],[right-4,20],[right-2,31],[right-3,43],[42,51],[chinRight-1,56],[chinLeft,57],[23,52],[left,42],[left-1,32]],p.skinShade)
 a+=poly([[left+3,23],[26,16],[34,15],[40,20],[42,31],[40,43],[37,51],[32,55],[26,53],[22,46],[left+1,35]],skin)
 a+=poly([[23,24],[28,18],[33,17],[36,21],[35,30],[29,32],[23,30]],p.skinMid)+poly([[22,35],[28,35],[31,40],[28,46],[23,44],[20,39]],p.cheek)+poly([[25,35],[28,34],[30,39],[27,42],[23,40]],p.skinMid)
 a+=poly([[39,27],[44,29],[45,39],[41,46],[39,51],[35,54],[36,48],[40,42],[40,34]],p.deepSkin)
 a+=poly([[15,32],[19,30],[21,34],[20,43],[18,46],[15,41]],p.skinShade)+r(16,34,2,6,p.cheek)+r(17,34,1,3,skin)
 // Brow, eye sockets and small light planes establish the tired adult expression.
 a+=`<g transform="translate(0 ${face.eye})">`+poly([[23,29],[27,28],[31,30],[31,32],[24,31]],p.hair)+poly([[37,29],[42,29],[45,32],[38,32]],p.hair)+r(24,33,6,2,p.deepSkin)+r(38,33,5,2,p.deepSkin)+r(25,33,3,1,p.linenShade)+r(39,33,2,1,p.linenShade)+r(27,33,2,2,p.ink)+r(40,33,2,2,p.ink)+r(24,36,5,1,p.skinShade)+r(38,36,5,1,p.deepSkin)+'</g>'
 a+=`<g transform="translate(${face.nose} 0)">`+poly([[34,31],[36,32],[36,38],[39,42],[37,44],[33,43],[34,39]],p.cheek)+line([[34,33],[34,39],[36,42]],light)+r(36,43,3,1,p.deepSkin)+r(32,43,2,1,p.skinShade)+r(34,41,2,1,p.skinMid)+'</g>'
 a+=`<g transform="translate(0 ${face.mouth})">`+line([[28,48],[31,47],[35,48],[38,47]],p.deepSkin)+r(30,49,6,1,p.cheek)+r(31,51,4,1,p.skinMid)+r(29,54,5,1,p.skinShade)+r(32,54,2,1,light)+'</g>'
 a+=r(22,25,2,1,light)+r(25,23,3,1,light)+r(31,21,2,1,light)+r(23,38,2,1,light)+r(28,40,1,1,light)+r(30,36,1,2,p.cheek)+r(41,39,1,3,p.skinShade)
 if(old){
  for(const[x,y,w]of [[24,24,5],[25,26,4],[23,37,4],[23,45,3],[40,37,3],[39,45,2],[26,51,2]])a+=r(x,y,w,1,p.skinShade)
  a+=line([[27,44],[25,47],[26,50]],p.skinShade)+line([[39,44],[41,48],[39,51]],p.deepSkin)+r(23,41,1,2,p.skinShade)
 }
 const hair=c.head==='grey'?p.grey:p.hair
 if(c.head!=='bald')a+=poly([[15,30],[15,23],[19,14],[25,9],[36,9],[44,14],[48,24],[47,33],[44,29],[42,19],[34,15],[28,16],[24,21],[18,24],[18,31]],hair)+line([[19,20],[23,14],[28,12],[36,12]],c.head==='grey'?p.linenShade:p.hairLight)
 if(c.head==='receding')a+=poly([[24,13],[31,11],[38,13],[40,18],[36,18],[31,16],[25,19]],skin)+r(28,13,6,1,p.skinMid)
 if(c.head==='lank')a+=poly([[16,25],[20,23],[19,45],[22,54],[16,51],[13,39]],p.hair)+poly([[44,20],[48,25],[49,53],[44,48],[44,37]],p.hair)+line([[16,30],[16,43],[18,49]],p.hairLight)
 if(c.head==='knot')a+=poly([[36,9],[38,3],[44,3],[48,7],[46,12],[40,14]],p.hair)+line([[40,5],[44,5],[46,8]],p.hairLight)
 if(c.head==='grey')for(const[x,y,w,h]of [[22,47,2,4],[25,50,2,4],[28,52,3,4],[34,53,3,3],[39,49,2,4]])a+=r(x,y,w,h,p.grey)
 if(c.head==='wrap')a+=poly([[13,24],[16,14],[24,7],[38,7],[46,13],[50,24],[46,29],[42,22],[34,16],[25,17],[20,24]],p.linenShade)+line([[17,18],[24,11],[36,10],[45,17]],p.linen,3)+line([[20,23],[27,18],[36,18],[42,22]],p.linen)+poly([[44,26],[49,25],[51,55],[46,59],[46,42]],p.linenShade)+line([[48,33],[49,51]],p.linen)
 if(c.head==='helmet')a+=poly([[10,27],[13,16],[22,7],[36,6],[46,14],[51,27],[51,31],[11,31]],p.ink)+poly([[14,25],[16,17],[24,10],[35,9],[43,16],[47,26]],p.ironDark)+poly([[17,23],[19,16],[25,11],[32,10],[34,24]],p.iron)+line([[20,16],[26,11],[31,11]],p.ironLight,2)+r(12,27,37,3,p.leather)+line([[14,27],[46,27]],p.iron)+r(31,10,2,16,p.ironDark)+r(38,19,3,2,p.iron)+r(20,21,3,2,p.ironDark)
 if(c.head==='hood')a+=poly([[8,33],[12,17],[22,6],[34,4],[46,11],[55,27],[54,58],[45,66],[44,54],[47,40],[44,24],[36,17],[27,17],[19,25],[16,42],[20,55],[20,63],[11,55]],c.dark)+line([[12,25],[18,14],[27,8],[36,8],[45,16],[50,28]],c.light,2)+line([[15,31],[12,44],[16,56]],c.cloth,2)+line([[48,30],[50,45],[47,58]],c.cloth)+r(15,22,2,2,c.cloth)+r(44,15,2,1,c.light)
 if(face.stubble||face.beard){
  for(const[x,y,w,h]of (face.beard?[[22,46,2,5],[24,50,3,5],[28,53,4,4],[33,54,3,4],[38,50,3,4],[41,46,2,4]]:[[23,48,1,2],[26,51,2,2],[29,54,2,1],[35,53,1,2],[40,48,1,2]]))a+=r(x,y,w,h,face.beard?p.hair:p.skinShade)
  if(face.beard)a+=r(25,51,1,2,p.hairLight)+r(29,54,2,1,p.hairLight)+r(38,51,1,2,p.hairLight)
 }
 if(c.fungus===1)a+=poly([[44,45],[48,43],[51,46],[50,49],[45,49]],p.linenShade)+r(46,44,3,1,p.linen)
 if(c.scar)a+=line([[39,35],[37,38],[38,41]],'#8e5c4f')
 if(c.scarf)a+=poly([[20,59],[29,64],[40,63],[46,58],[48,66],[39,73],[28,71],[20,65]],p.linenShade)+line([[22,61],[30,67],[39,67],[45,62]],p.linen,2)+poly([[40,70],[47,66],[50,80],[41,80]],p.linenShade)+line([[43,72],[46,78]],p.linen)
 else if(c.lapels)a+=poly([[20,61],[28,66],[31,78],[19,70]],p.linenShade)+poly([[43,60],[36,68],[35,78],[49,69]],c.light)
 if(c.apron)a+=poly([[19,70],[27,72],[31,80],[18,80]],p.linenShade)+r(21,75,5,1,p.linen)
 if(c.armour)a+=poly([[5,70],[15,64],[20,68],[17,76],[6,78]],p.leather)+line([[6,70],[14,66],[18,69]],p.leatherLight)+r(8,72,2,2,p.brass)+r(15,71,2,2,p.brass)
 if(c.bag||c.sash)a+=poly([[10,67],[13,65],[45,80],[37,80]],p.leather)+line([[13,67],[39,79]],p.leatherLight)+r(25,73,3,2,p.brass)
 if(c.fungus)a+=poly([[47,68],[50,64],[57,65],[61,69],[60,72],[52,73]],p.linenShade)+line([[50,66],[56,66],[59,69]],p.linen)+poly([[48,74],[54,71],[61,74],[63,78],[56,79]],p.linenShade)+r(53,73,4,1,p.linen)
 return a
}
const sheet='av319_portraits',fragment={sheets:{[sheet]:'sprites/original/direction-v319/portraits.png'},frames:{}},portraits={},groups=[]
for(const[index,[role,design]]of Object.entries(designs).entries()){
 const x=index%5*64,y=Math.floor(index/5)*80,key='av319_portrait_'+role
 groups.push(`<g transform="translate(${x} ${y})">${portrait(role,design)}</g>`);fragment.frames[key]=[sheet,x,y,64,80];portraits[role]=key
}
portraits.player=portraits.original_wanderer_hero;portraits.reaver2=portraits.complete_reaver_chief
writeFileSync(here+'portraits.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" shape-rendering="crispEdges">${groups.join('\n')}</svg>`)
execFileSync('inkscape',[here+'portraits.svg','--export-type=png','--export-filename='+root+'public/sprites/original/direction-v319/portraits.png'],{stdio:'pipe'})
writeFileSync(here+'portraits.fragment.json',JSON.stringify({...fragment,portraits},null,2)+'\n');writeFileSync(here+'portraits-provenance.json',JSON.stringify({version:319,source:'draw-portraits.mjs',license:'CC0-1.0',imageInput:false,designs:19,width:64,height:80,roleBindings:portraits,referenceInventory:'../../research/stoneshard-v319/',method:'Original authored face planes, brow/eyes/nose/jaw, wrinkles, hair, headwear and occupation clothing. No traced face or sampled source pixels.'},null,2)+'\n')
if(process.argv.includes('--install')){const m=JSON.parse(readFileSync(root+'src/client/sprites.json','utf8'));Object.assign(m.sheets,fragment.sheets);Object.assign(m.frames,fragment.frames);for(const[role,key]of Object.entries(portraits))m.chars[role].portrait=key;writeFileSync(root+'src/client/sprites.json',JSON.stringify(m,null,2)+'\n')}
console.log(JSON.stringify({portraits:19,bindings:Object.keys(portraits).length,installed:process.argv.includes('--install')}))
