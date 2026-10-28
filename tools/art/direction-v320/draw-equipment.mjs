// ASHVEIL original apparel, trinkets and field tools. No raster input or tracing.
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
const here=fileURLToPath(new URL('.',import.meta.url)),root=fileURLToPath(new URL('../../../',import.meta.url)),out=root+'public/sprites/original/direction-v320/'
mkdirSync(out,{recursive:true})
const items=JSON.parse(readFileSync(here+'equipment-definitions.json','utf8'))
const p={ink:'#232527',deep:'#393d3c',iron:'#74807e',steel:'#a8b1a7',edge:'#c7cebb',rust:'#855c43',wood:'#765c40',grain:'#a48960',woodDark:'#4c3f30',leather:'#766047',leatherLight:'#ab8b61',leatherDark:'#4e4032',linen:'#b2a589',linenLight:'#d1c3a0',linenDark:'#7f7763',wool:'#817d6a',woolLight:'#aaa28a',woolDark:'#565b50',ash:'#657174',ashLight:'#8b9793',ashDark:'#414d52',brass:'#a38a55',brassDark:'#675b3d',bone:'#c9b894',boneDark:'#938061',paper:'#b7ab8c',blue:'#677e86'}
const r=(x,y,w,h,c)=>`<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" fill="${c}"/>`
const poly=(points,c)=>`<polygon points="${points.map(p=>p.map(Math.round).join(',')).join(' ')}" fill="${c}"/>`
const line=(points,c,width=1)=>`<polyline points="${points.map(p=>p.map(Math.round).join(',')).join(' ')}" fill="none" stroke="${c}" stroke-width="${width}" stroke-linejoin="miter"/>`
const ellipse=(x,y,rx,ry,c)=>`<ellipse cx="${Math.round(x)}" cy="${Math.round(y)}" rx="${Math.round(rx)}" ry="${Math.round(ry)}" fill="${c}"/>`
const woods=(x,y,w,h)=>r(x,y,w,h,p.ink)+r(x+1,y+1,w-2,h-2,p.wood)+line([[x+2,y+3],[x+3,y+h/2],[x+2,y+h-3]],p.grain)+r(x+w-2,y+2,1,h-4,p.woodDark)
function seam(x,y,w,color=p.linenLight){let a='';for(let i=0;i<w;i+=4)a+=r(x+i,y,2,1,color);return a}
function coil(cx,cy,rx,ry,color=p.linen){return ellipse(cx,cy,rx+1,ry+1,p.ink)+ellipse(cx,cy,rx,ry,color)+ellipse(cx,cy,rx-2,ry-2,p.ink)+ellipse(cx,cy,rx-3,ry-3,color)+ellipse(cx,cy,rx-5,ry-5,p.ink)}
const cloths={
 Hood:['hood','ash'],AshMask:['mask','linen'],LeatherCoat:['coat','leather'],LeatherApron:['apron','leather'],OilclothCloak:['cloak','ash'],OiledRaincoat:['raincoat','ash'],RagShirt:['shirt','linen'],PaddedJacket:['padded','wool'],ScrapMail:['mail','rust'],ScrapHelmet:['helmet','rust'],Boots:['boots','leather'],Gloves:['gloves','leather'],LeatherBelt:['belt','leather'],CustomShirt:['shirt','ash'],CustomMail:['mail','iron'],CustomCoat:['coat','leather'],IronMail:['mail','iron'],SteelMail:['mail','steel'],WoolShirt:['shirt','wool'],WolfCoat:['furcoat','wool'],WoolGloves:['gloves','wool'],OilclothShirt:['shirt','ash'],Quiver:['quiver','leather'],
}
const colors={ash:[p.ash,p.ashLight,p.ashDark],linen:[p.linen,p.linenLight,p.linenDark],leather:[p.leather,p.leatherLight,p.leatherDark],wool:[p.wool,p.woolLight,p.woolDark],rust:[p.iron,p.steel,p.rust],iron:[p.iron,p.steel,p.deep],steel:[p.steel,p.edge,p.iron]}
function cloth(item,w,h){
 const id=item.id.split('.')[1],[shape,material]=cloths[id],c=w/2,[mid,light,dark]=colors[material];let a=''
 if(shape==='mask')return line([[3,8],[8,12],[4,19]],dark,2)+line([[21,8],[16,12],[20,19]],dark,2)+poly([[6,8],[18,8],[20,13],[16,19],[8,18],[4,13]],p.ink)+poly([[7,10],[17,10],[18,13],[15,17],[9,16],[6,13]],mid)+line([[8,12],[16,12],[8,14],[15,15]],light)
 if(shape==='hood')return poly([[5,h-3],[7,10],[15,4],[29,3],[39,9],[43,h-3],[33,h-1],[25,h-5],[18,h-2]],p.ink)+poly([[8,h-4],[10,11],[17,6],[28,5],[36,11],[40,h-5],[33,h-3],[26,h-8],[18,h-5]],mid)+poly([[17,9],[28,8],[34,14],[32,h-4],[25,h-7],[18,h-5],[14,14]],dark)+line([[12,12],[18,7],[27,6],[34,11]],light)+seam(11,h-4,8)+seam(33,h-5,5)
 if(shape==='belt')return poly([[4,8],[32,7],[44,11],[44,17],[34,18],[4,16]],p.ink)+poly([[5,10],[32,9],[42,12],[42,15],[33,16],[5,14]],mid)+line([[6,10],[31,9]],light)+r(20,7,10,12,p.ink)+r(21,8,8,10,p.brass)+r(23,10,4,6,dark)+line([[25,9],[25,14]],p.brassDark)+r(7,12,1,1,p.ink)+r(12,12,1,1,p.ink)+r(16,12,1,1,p.ink)+line([[34,10],[40,13],[34,14]],light)
 if(shape==='helmet'){
  a+=poly([[8,27],[10,14],[17,7],[29,6],[37,14],[40,27],[42,31],[39,35],[9,35],[6,32]],p.ink)+poly([[11,27],[13,15],[19,10],[28,9],[34,15],[37,27]],mid)+poly([[13,25],[15,15],[20,11],[22,11],[20,26]],light)+r(8,28,32,5,dark)+r(9,29,28,1,light)+r(23,8,3,19,dark)+r(24,9,1,16,p.iron)+poly([[12,34],[15,34],[15,40],[11,41]],dark)+poly([[32,34],[35,34],[36,41],[32,40]],mid)
  for(const[x,y]of [[13,30],[23,30],[35,30],[25,17]])a+=r(x,y,2,2,p.brassDark)+r(x,y,1,1,light)
  return a+r(31,17,3,4,p.rust)+r(16,24,3,2,p.rust)+line([[29,12],[33,16]],p.deep)
 }
 if(shape==='boots'){
  for(const[x,y]of [[7,7],[25,4]]){
   a+=poly([[x,y],[x+12,y],[x+11,y+22],[x+16,y+27],[x+15,y+32],[x-2,y+32],[x-3,y+28],[x+1,y+22]],p.ink)+poly([[x+2,y+2],[x+10,y+2],[x+9,y+23],[x+13,y+27],[x+12,y+29],[x,y+29],[x-1,y+27],[x+3,y+22]],mid)+r(x+1,y+2,10,3,dark)+line([[x+4,y+7],[x+4,y+21],[x+8,y+26]],light)+r(x-1,y+30,15,2,dark)+seam(x+1,y+28,10,light)
   for(let yy=y+8;yy<y+21;yy+=4)a+=line([[x+6,yy],[x+9,yy+2],[x+6,yy+3]],dark)
  }return a
 }
 if(shape==='gloves'){
  for(const[x,y]of [[2,4],[8,22]]){a+=poly([[x,y+8],[x+1,y+1],[x+3,y],[x+4,y+5],[x+5,y],[x+7,y],[x+8,y+5],[x+9,y+2],[x+11,y+3],[x+11,y+12],[x+14,y+11],[x+15,y+14],[x+11,y+18],[x+10,y+22],[x+1,y+21]],p.ink)+poly([[x+2,y+8],[x+3,y+5],[x+5,y+8],[x+6,y+3],[x+8,y+8],[x+9,y+6],[x+9,y+14],[x+12,y+13],[x+10,y+17],[x+8,y+20],[x+3,y+19]],mid)+line([[x+4,y+9],[x+4,y+15]],light)+r(x+2,y+18,8,3,dark)+seam(x+3,y+18,5,light)}return a
 }
 if(shape==='quiver'){
  a+=line([[13,8],[36,15],[36,38],[29,40]],dark,3)+poly([[12,10],[29,7],[36,35],[30,43],[21,44]],p.ink)+poly([[15,12],[27,10],[33,35],[29,40],[23,41]],mid)+line([[17,14],[24,37],[29,38]],light)+line([[29,14],[32,34]],dark,2)+ellipse(21,10,9,4,dark)+ellipse(21,9,7,2,p.ink)
  for(const[x,y]of [[17,2],[22,3],[27,1]])a+=line([[x,y+1],[x+3,16]],p.grain)+poly([[x-2,y],[x,y-1],[x+2,y+4],[x+1,y+7],[x-1,y+4]],p.linen)+r(x,y+5,2,2,dark)
  return a+seam(24,37,7,light)
 }
 if(shape==='cloak'||shape==='raincoat'){
  a+=poly([[c-6,4],[c+5,4],[c+10,13],[w-5,h-9],[w-12,h-4],[c+3,h-7],[c-6,h-3],[5,h-9],[c-11,15]],p.ink)+poly([[c-5,7],[c+4,6],[c+8,15],[w-9,h-10],[c+2,h-10],[c-5,h-6],[9,h-11],[c-8,16]],mid)+poly([[c-5,8],[c+3,7],[c+6,13],[c+3,20],[c-5,19],[c-8,14]],dark)+line([[c-6,9],[c-4,7],[c+3,7],[c+6,12]],light)
  a+=line([[c-8,21],[c-11,h-11]],light)+line([[c+7,21],[c+13,h-12]],dark,2)+line([[c,21],[c+1,h-9]],dark)+seam(12,h-10,10)+seam(c+7,h-11,12)
  if(shape==='raincoat')a+=line([[13,21],[19,23],[19,29],[12,27],[13,21]],dark)+line([[30,21],[36,20],[37,26],[30,27]],dark)+r(c,24,2,2,p.brass)+r(c,31,2,2,p.brass)
  return a
 }
 const long=['coat','furcoat','mail','apron','padded'].includes(shape),bottom=h-6,neck=6,bodyLeft=12,bodyRight=w-12,sleeveEnd=long?32:27
 const outline=[[c-7,neck],[c-10,neck+3],[10,neck+5],[3,22],[5,sleeveEnd],[11,sleeveEnd+1],[14,25],[bodyLeft,bottom],[c-3,bottom+1],[c,bottom-3],[c+3,bottom+1],[bodyRight,bottom],[bodyRight-2,25],[w-11,sleeveEnd+1],[w-5,sleeveEnd],[w-3,22],[w-10,neck+5],[c+10,neck+3],[c+7,neck]]
 a+=poly(outline,p.ink)+poly([[c-6,8],[c-9,11],[12,13],[6,23],[7,sleeveEnd-2],[10,sleeveEnd-2],[15,21],[15,bottom-2],[c-3,bottom-2],[c,bottom-6],[c+4,bottom-2],[w-15,bottom-2],[w-15,21],[w-10,sleeveEnd-2],[w-7,sleeveEnd-2],[w-6,23],[w-12,13],[c+9,11],[c+6,8]],mid)
 a+=poly([[c-6,7],[c-4,12],[c+3,12],[c+6,7]],dark)+line([[c-7,9],[c-5,14],[c+4,14],[c+7,9]],light)+line([[15,24],[16,bottom-4]],dark,2)+line([[w-17,23],[w-16,bottom-5]],light)+seam(16,bottom-2,w-30,light)+line([[7,sleeveEnd-3],[11,sleeveEnd-3]],dark,2)+line([[w-11,sleeveEnd-3],[w-7,sleeveEnd-3]],dark,2)
 if(shape==='mail'){
  // Individually staggered iron links and open dark interstices; no flat grey fill.
  for(let y=18;y<bottom-4;y+=4)for(let x=17+(y%8?0:2);x<w-16;x+=5)a+=line([[x,y],[x,y+2],[x+2,y+3],[x+3,y+1]],dark)+line([[x+1,y],[x+3,y]],light)
  for(const[x,y]of [[8,23],[w-11,22],[18,bottom-8]])a+=r(x,y,2,2,light)
  a+=r(15,bottom-5,w-30,3,dark)+seam(17,bottom-4,w-34,light)
  if(id==='ScrapMail')for(const[x,y]of [[17,25],[28,32],[22,49],[31,56]])a+=r(x,y,4,3,p.rust)+r(x+1,y,1,1,p.grain)
  if(id==='CustomMail')a+=poly([[18,29],[27,27],[31,42],[20,44]],p.iron)+line([[20,30],[26,29],[28,39]],p.steel)+r(21,32,2,2,p.brass)+r(27,39,2,2,p.brass)
 }else if(shape==='padded'){
  for(let y=19;y<bottom-5;y+=7)a+=line([[16,y],[c,y+3],[w-16,y]],dark)+line([[17,y+1],[c,y+4],[w-17,y+1]],light)
  a+=r(c-1,16,3,bottom-20,dark)
 }else if(shape==='apron'){
  a+=poly([[17,20],[30,20],[29,32],[34,bottom-1],[13,bottom-1],[18,31]],dark)+poly([[19,22],[28,22],[27,34],[31,bottom-3],[16,bottom-3],[20,33]],mid)+line([[21,23],[21,bottom-5]],light)+r(21,37,8,9,dark)+seam(22,38,6,light)+seam(17,bottom-3,13,light)
 }else{
  a+=line([[c,16],[c-1,bottom-5]],dark)
  for(let y=20;y<Math.min(bottom-5,45);y+=7)a+=r(c+2,y,2,2,p.brassDark)+r(c+2,y,1,1,light)
  for(const[x,y]of [[18,23],[w-20,27],[19,bottom-12],[w-19,bottom-8]])a+=line([[x,y],[x+1,y+4],[x+3,y+5]],light)
  if(material==='wool')for(let y=18;y<bottom-3;y+=5)for(let x=17;x<w-16;x+=6)a+=r(x,y,2,1,dark)+r(x+1,y+2,2,1,light)
  if(shape==='coat'||shape==='furcoat')a+=line([[c-6,9],[c-3,24],[c-7,29]],light,2)+line([[c+6,10],[c+3,23],[c+7,28]],dark,2)+r(15,35,8,8,dark)+seam(16,36,6,light)
  if(shape==='furcoat')for(const[x,y]of [[14,12],[18,10],[28,10],[32,12],[15,44],[31,51],[17,58]])a+=poly([[x,y],[x+3,y+1],[x+2,y+4],[x+4,y+5],[x,y+6],[x-1,y+3]],p.woolLight)+r(x+1,y+1,1,2,p.woolDark)
  if(id==='RagShirt')a+=poly([[15,33],[19,32],[20,36],[17,38],[15,36]],p.ink)+r(28,22,5,6,dark)+seam(28,22,5)+line([[29,24],[32,27]],light)+r(20,bottom-2,2,3,p.ink)
  if(id==='CustomShirt'||id==='CustomCoat')a+=r(26,bottom-15,7,7,dark)+seam(27,bottom-14,5,light)+line([[27,bottom-12],[31,bottom-10]],light)
  if(id==='OilclothShirt')a+=line([[16,17],[18,19],[18,26]],p.ashLight)+line([[30,32],[30,37],[32,38]],p.ashLight)
 }
 return a
}
function tool(item,w,h){
 const id=item.id.split('.')[1],cx=w/2;let a=''
 if(id==='BoneCharm')return line([[4,4],[3,10],[12,20],[21,9],[20,3]],p.leatherDark)+poly([[10,5],[15,5],[16,8],[14,10],[16,16],[14,19],[11,18],[11,11],[8,9]],p.ink)+poly([[11,6],[14,6],[14,8],[12,10],[14,16],[13,17],[12,16],[12,10],[10,8]],p.bone)+r(12,7,1,2,p.boneDark)
 if(id==='SealRing')return ellipse(12,14,7,7,p.ink)+ellipse(12,14,5,5,p.rust)+ellipse(12,14,3,3,p.ink)+poly([[9,5],[15,4],[19,8],[18,12],[10,14],[6,10]],p.ink)+poly([[10,6],[14,6],[17,8],[16,11],[10,12],[8,10]],p.iron)+line([[11,7],[14,8],[11,10]],p.deep)+r(9,7,2,1,p.steel)
 if(['FieldMat','Bedroll','StrawBed','Bed','GoodBed'].includes(id)){
  const bed=id==='Bed'||id==='GoodBed',straw=id==='StrawBed'||id==='FieldMat'
  if(bed){a+=woods(6,8,4,h-10)+woods(w-10,8,4,h-10)+woods(7,10,w-14,8)+woods(7,h-15,w-14,6);for(let y=23;y<h-17;y+=6)a+=woods(10,y,w-20,4)}
  a+=poly([[11,bed?17:8],[w-10,bed?17:7],[w-8,h-15],[10,h-13],[7,23]],p.ink)+poly([[12,bed?19:10],[w-12,bed?19:9],[w-11,h-17],[12,h-16],[10,23]],straw?p.woolDark:p.linenDark)
  if(straw){for(let y=12;y<h-15;y+=6)for(let x=13;x<w-12;x+=6)a+=line([[x,y],[x+2,y+4]],p.grain)+r(x+1,y,1,2,p.linen);a+=line([[13,13],[11,h-17]],p.woodDark)+line([[w-14,12],[w-12,h-18]],p.woodDark)}
  else{a+=poly([[14,28],[w-14,27],[w-12,h-19],[14,h-18]],id==='GoodBed'?p.ash:p.wool)+line([[17,30],[17,h-22]],id==='GoodBed'?p.ashLight:p.woolLight)+line([[w-17,31],[w-16,h-22]],p.deep)+seam(15,h-19,w-29);a+=r(13,bed?19:12,w-26,12,p.ink)+r(14,bed?20:13,w-28,9,p.linen)+r(16,bed?21:14,w-34,2,p.linenLight)}
  if(id==='Bedroll')a+=r(9,h-18,w-18,5,p.leatherDark)+r(12,h-19,4,8,p.leather)+r(w-18,h-20,4,8,p.leather)+r(w-19,h-18,6,4,p.brassDark)
  if(id==='GoodBed')a+=woods(6,3,4,15)+woods(w-10,3,4,15)+line([[11,10],[w-11,10]],p.grain,2)
  return a
 }
 if(id==='Needle')return line([[6,21],[17,4]],p.ink,3)+line([[7,20],[17,4]],p.steel)+ellipse(17,4,2,3,p.iron)+ellipse(17,4,1,2,p.ink)+line([[18,5],[21,9],[20,14],[16,16],[13,13]],p.linenDark)
 if(id==='Tongs')return line([[5,43],[7,29],[12,23],[18,9],[15,4]],p.ink,4)+line([[19,43],[17,29],[12,23],[6,9],[9,4]],p.ink,4)+line([[5,42],[8,29],[13,22],[18,9],[15,5]],p.iron,2)+line([[19,42],[16,29],[11,23],[6,9],[9,5]],p.iron,2)+r(11,22,3,3,p.brass)+r(11,22,1,1,p.steel)
 if(id==='StoneHammer'||id==='IronHammer'){
  a+=woods(cx-2,15,5,h-19)+r(cx-3,h-18,7,12,p.leatherDark)+seam(cx-2,h-15,5,p.leatherLight)
  if(id==='StoneHammer')a+=poly([[3,8],[6,4],[18,5],[22,10],[19,19],[6,18],[2,14]],p.ink)+poly([[5,9],[8,6],[17,7],[19,11],[17,16],[7,15],[4,13]],p.deep)+poly([[8,7],[16,8],[17,10],[7,11]],p.iron)+line([[10,6],[15,18],[10,16],[14,8]],p.linen,2)
  else a+=poly([[2,8],[8,5],[20,7],[22,12],[19,17],[5,17],[2,14]],p.ink)+poly([[4,9],[9,7],[19,9],[19,14],[6,15],[4,13]],p.iron)+line([[5,9],[9,8],[18,9]],p.steel)+r(9,10,4,4,p.deep)+r(18,11,3,5,p.rust)
  return a
 }
 if(id.endsWith('Kit')&&id!=='CoracleKit'){
  a+=poly([[6,20],[12,14],[35,15],[43,23],[42,41],[7,42],[4,36]],p.ink)+poly([[8,22],[14,17],[34,18],[40,24],[39,38],[9,39],[7,35]],p.leatherDark)+line([[10,24],[36,24],[37,37]],p.leather)+r(7,31,34,4,p.leather)+r(19,29,9,8,p.brassDark)+r(21,31,5,4,p.ink)+seam(10,38,26,p.leatherLight)
  if(id==='WorkbenchKit')a+=woods(11,9,26,7)+woods(16,5,4,22)+poly([[23,10],[35,10],[38,15],[23,15]],p.iron)+line([[24,11],[34,11]],p.steel)
  if(id==='ForgeKit')a+=poly([[9,8],[24,8],[26,4],[39,5],[35,13],[28,16],[29,21],[16,21],[18,16],[12,14]],p.ink)+poly([[11,10],[24,10],[27,7],[36,7],[32,12],[25,14],[25,18],[19,18],[20,14],[14,13]],p.iron)+line([[13,10],[25,10],[28,7],[34,7]],p.steel)+r(17,18,13,3,p.deep)
  if(id==='LoomKit')a+=woods(11,3,4,24)+woods(33,3,4,24)+woods(13,5,22,4)+woods(13,21,22,4)+line([[18,9],[18,21],[22,9],[22,21],[26,9],[26,21],[30,9],[30,21]],p.linen)+r(16,15,17,2,p.woodDark)
  if(id==='TanningVatKit')a+=ellipse(24,14,15,10,p.ink)+poly([[10,13],[38,13],[35,29],[13,29]],p.woodDark)+ellipse(24,12,13,7,p.wood)+ellipse(24,12,10,5,p.deep)+line([[14,19],[34,19]],p.iron,2)+line([[17,24],[31,24]],p.iron,2)+r(17,15,1,11,p.grain)+r(30,16,1,11,p.grain)
  if(id==='ArtisanKit')a+=woods(12,6,23,6)+line([[17,11],[19,25]],p.iron,2)+line([[30,10],[24,24]],p.steel,2)+ellipse(20,25,4,4,p.deep)+ellipse(25,25,4,4,p.deep)+r(17,24,2,2,p.iron)+r(24,24,2,2,p.iron)
  return a
 }
 if(id==='GunOil'||id==='LampOil')return r(9,3,7,4,p.ink)+r(10,4,5,2,p.brassDark)+poly([[8,7],[17,7],[20,11],[20,20],[5,20],[5,11]],p.ink)+poly([[9,8],[16,8],[18,12],[18,18],[7,18],[7,12]],id==='GunOil'?p.iron:p.wood)+r(8,12,9,5,p.paper)+r(11,13,3,2,id==='GunOil'?p.deep:p.rust)+line([[7,11],[7,16]],p.steel)
 if(id==='SharpeningStone')return poly([[3,9],[15,5],[21,9],[21,16],[9,20],[3,16]],p.ink)+poly([[5,10],[15,7],[19,10],[9,14]],p.iron)+poly([[5,12],[9,16],[19,12],[19,15],[9,18],[5,15]],p.deep)+line([[7,10],[15,8]],p.steel)+line([[10,11],[16,9]],p.deep)
 if(id==='BowString')return coil(11,12,8,8)+line([[10,6],[15,9],[13,16],[8,18],[5,16]],p.linenDark)+line([[14,7],[21,5],[22,8],[19,9]],p.linenDark)+line([[9,18],[9,22],[6,22],[6,19]],p.linenDark)
 if(id==='Lantern'){
  a+=line([[7,10],[7,5],[10,2],[15,2],[18,5],[18,10]],p.ink,3)+line([[8,10],[8,5],[11,3],[14,3],[17,5],[17,10]],p.iron)+poly([[7,9],[18,9],[21,15],[20,37],[23,42],[20,45],[4,45],[2,42],[5,37],[4,15]],p.ink)+poly([[7,17],[18,17],[17,35],[7,35]],p.ashDark)+poly([[8,18],[11,18],[10,33],[8,33]],p.ashLight)+r(11,31,4,4,p.leatherDark)+r(12,28,2,5,p.linenDark)+line([[6,16],[6,37],[18,37],[18,16]],p.iron,2)+r(4,12,17,4,p.iron)+r(6,11,13,1,p.steel)+r(5,38,15,5,p.iron)+r(6,39,4,1,p.steel)+r(19,34,3,4,p.brassDark)
  return a // Unlit source: actual game light state remains separate.
 }
 if(id==='Lockpick')return woods(3,31,5,12)+woods(15,29,5,14)+line([[5,33],[5,10],[10,5],[13,5]],p.ink,3)+line([[6,32],[6,11],[10,6],[13,6]],p.steel)+line([[17,32],[17,15],[21,15]],p.ink,3)+line([[18,31],[18,16],[21,16]],p.iron)+r(4,36,3,1,p.leatherDark)+r(16,34,3,1,p.leatherDark)
 if(id==='PowerCell')return r(6,5,13,17,p.ink)+r(8,2,3,4,p.iron)+r(15,2,3,4,p.brass)+r(7,6,11,15,p.ashDark)+r(8,7,3,12,p.iron)+r(12,8,4,8,p.deep)+r(13,9,2,3,p.brassDark)+r(12,17,4,2,p.paper)+r(14,18,1,1,p.deep)+r(16,12,2,2,p.rust)
 if(id==='ClothFilter')return poly([[4,5],[19,3],[22,18],[15,21],[3,19]],p.ink)+poly([[5,7],[18,5],[20,17],[15,19],[5,17]],p.linenDark)+poly([[7,8],[16,7],[18,16],[7,16]],p.linen)+seam(7,8,9,p.linenLight)+line([[9,9],[9,14],[12,10],[12,14],[15,10],[15,14]],p.linenDark)+line([[8,16],[16,17]],p.leatherDark)
 if(id==='CharcoalFilter'){
  a+=ellipse(cx,10,9,5,p.ink)+poly([[4,11],[20,11],[19,39],[16,43],[7,43],[4,38]],p.ink)+poly([[6,12],[18,12],[17,38],[15,41],[9,41],[6,37]],p.woodDark)+r(5,16,14,3,p.iron)+r(6,33,12,3,p.iron)+ellipse(cx,10,7,3,p.leatherDark)+r(8,8,3,3,p.ink)+r(13,9,3,2,p.deep)+r(7,21,10,8,p.linenDark)+r(8,22,7,2,p.grain)+r(8,26,2,2,p.deep)+r(13,25,2,2,p.ink)+r(10,39,4,7,p.iron)+r(10,44,4,2,p.ink)
  return a
 }
 if(id==='WaterPill')return poly([[5,4],[18,4],[21,8],[19,21],[4,20],[3,9]],p.ink)+poly([[6,6],[17,6],[19,9],[17,19],[6,18],[5,10]],p.iron)+r(7,7,9,2,p.paper)+ellipse(9,13,3,3,p.deep)+ellipse(9,12,2,2,p.linenLight)+ellipse(15,15,3,3,p.deep)+ellipse(15,14,2,2,p.linen)+line([[7,17],[16,18]],p.steel)
 if(id==='CoracleKit'){
  a+=poly([[10,20],[21,10],[48,8],[61,19],[65,51],[55,61],[23,64],[9,51]],p.ink)+poly([[13,22],[23,13],[47,11],[58,21],[61,49],[53,57],[24,60],[13,49]],p.leatherDark)+poly([[19,22],[27,17],[44,16],[53,24],[55,45],[48,53],[28,55],[19,46]],p.leather)+line([[16,25],[26,18],[43,15],[55,24]],p.leatherLight)+line([[23,54],[47,52],[55,44]],p.leatherLight)+woods(20,19,4,38)+woods(46,17,4,37)+r(12,31,47,5,p.linenDark)+r(14,33,43,1,p.linenLight)+r(33,26,8,14,p.ink)+r(34,28,6,10,p.brassDark)+r(36,30,2,6,p.leatherDark)+seam(23,55,24,p.leatherLight)
  return a
 }
 throw Error('No original equipment design for '+id)
}
const sheet='av320_equipment',fragment={sheets:{[sheet]:'sprites/original/direction-v320/equipment.png'},frames:{}},groups=[],rows=[]
for(const[index,item]of items.entries()){
 const w=item.size[0]*24,h=item.size[1]*24,x=index%10*80+4,y=Math.floor(index/10)*88+4
 if(w>72||h>72)throw Error('Review larger equipment layout '+item.id)
 groups.push(`<g id="${item.id}" transform="translate(${x} ${y})">${cloths[item.id.split('.')[1]]?cloth(item,w,h):tool(item,w,h)}</g>`)
 fragment.frames[item.sprite]=[sheet,x,y,w,h];rows.push({id:item.id,label:item.label,frame:item.sprite,width:w,height:h,grid:item.size,design:cloths[item.id.split('.')[1]]??['field-tool','authored-specific-geometry']})
}
writeFileSync(here+'equipment.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${Math.ceil(items.length/10)*88}" shape-rendering="crispEdges">${groups.join('\n')}</svg>\n`)
execFileSync('inkscape',[here+'equipment.svg','--export-type=png','--export-filename='+out+'equipment.png'],{stdio:'pipe'})
writeFileSync(here+'equipment.fragment.json',JSON.stringify(fragment,null,2)+'\n')
writeFileSync(here+'provenance.json',JSON.stringify({version:320,license:'CC0-1.0',source:'draw-equipment.mjs',imageInput:false,referenceStudy:'../../research/stoneshard-v319/',method:'Original explicit SVG geometry, integer pixel clusters, rasterized by Inkscape. Grid proportions from actual ASHVEIL definitions.',materialChoices:'Staggered open chain links, mended cloth seams, short wool fibers, worn leather edges, bent iron and strapped field kits. Lantern remains unlit in its base icon.',items:rows},null,2)+'\n')
if(process.argv.includes('--install')){const m=JSON.parse(readFileSync(root+'src/client/sprites.json','utf8'));Object.assign(m.sheets,fragment.sheets);Object.assign(m.frames,fragment.frames);writeFileSync(root+'src/client/sprites.json',JSON.stringify(m,null,2)+'\n')}
console.log(JSON.stringify({items:items.length,sheets:1,installed:process.argv.includes('--install')}))
