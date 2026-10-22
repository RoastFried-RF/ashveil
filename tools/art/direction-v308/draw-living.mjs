// New original vector drawing. No input image is opened or altered.
import {writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
const here=fileURLToPath(new URL('.',import.meta.url))
const parts=[]
const svg=s=>parts.push(s)
const path=(d,fill,stroke,width=1,opacity=1)=>svg(`<path d="${d}" fill="${fill??'none'}"${stroke?` stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`:''} opacity="${opacity}"/>`)
const n=(seed,index)=>{let a=seed+index*997;a=Math.imul(a^a>>>16,0x7feb352d);a=Math.imul(a^a>>>15,0x846ca68b);return((a^a>>>16)>>>0)/4294967296}
const wood=['#302a25','#493c30','#66523e','#867255','#a38b65']
svg('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="bark"><stop stop-color="#a38b65"/><stop offset=".35" stop-color="#6d5842"/><stop offset=".72" stop-color="#42372d"/><stop offset="1" stop-color="#292723"/></linearGradient><linearGradient id="needle" x2=".8" y2="1"><stop stop-color="#69715a"/><stop offset=".35" stop-color="#49533d"/><stop offset=".72" stop-color="#303e2e"/><stop offset="1" stop-color="#232d25"/></linearGradient><linearGradient id="blackleaf" x2=".7" y2="1"><stop stop-color="#55534d"/><stop offset=".3" stop-color="#3c3c37"/><stop offset=".72" stop-color="#292b29"/><stop offset="1" stop-color="#1e2120"/></linearGradient></defs>')

function rootFan(cx,cy,seed){
 for(let i=0;i<9;i++){
  const side=i<4?-1:1,length=23+n(seed,i)*59,start=cx+(n(seed,i+10)-.5)*22,end=cx+side*length,ey=cy+3+n(seed,i+20)*8
  path(`M${start} ${cy-40} Q${cx+side*18} ${cy-4} ${end} ${ey} Q${cx+side*39} ${cy+8} ${cx+side*8} ${cy+2}Z`,'url(#bark)','#292622',2)
  path(`M${start-2} ${cy-30} Q${cx+side*15} ${cy-2} ${end-side*5} ${ey-1}`,null,'#a28a64',1.6,.65)
 }
}
function bark(cx,bottom,top,lean,seed){
 for(let i=0;i<22;i++){
  const yy=top+n(seed,i)*(bottom-top),xx=cx+(n(seed,i+40)-.5)*19+(bottom-yy)/(bottom-top)*lean
  path(`M${xx} ${yy} q-6 12 -2 25 t-2 20`,null,wood[i%wood.length],1.3+i%3,.8)
 }
 for(const [dx,y,rx,ry] of [[-5,bottom-87,5,10],[4,bottom-178,4,8],[-2,bottom-244,3,7]]){
  svg(`<ellipse cx="${cx+dx+lean*(bottom-y)/(bottom-top)}" cy="${y}" rx="${rx}" ry="${ry}" fill="#2b2823" stroke="#8e7756" stroke-width="2"/>`)
 }
}
function needles(x,y,span,seed,side){
 const tip=x+side*span
 path(`M${x} ${y-8} Q${x+side*span*.42} ${y+5} ${tip} ${y+21}`,null,'#3f372a',5)
 // Individually angled needle sprays, with an uneven outer bough contour.
 for(let i=0;i<12;i++){
  const u=(i+.35)/12,px=x+side*span*u,py=y+21*u+(n(seed,i)-.5)*10,reach=14+19*(1-u)+n(seed,i+20)*9
  const colors=['#2b382b','#3c4833','#4d583e','#60694d']
  const teeth=[]
  for(let tooth=0;tooth<7;tooth++){
   const xx=px+side*(tooth*5-8),yy=py+4-tooth*1.2,h=reach*(.5+n(seed,i*13+tooth+400)*.5)
   teeth.push([xx,yy],[xx+side*9,yy-h])
  }
  teeth.push([px+side*26,py+6],[px-side*12,py+11])
  path('M'+teeth.map(p=>p.join(' ')).join(' L')+'Z',colors[i%4])
  for(let k=0;k<6;k++){
   const xx=px+side*k*3-6*side,yy=py-k*.7
   path(`M${xx} ${yy+5} l${side*(8+n(seed,i*7+k)*8)} ${-10-k%3*2}`,null,colors[(i+k+2)%4],1.7,.8)
  }
 }
}
function pine(offset,lean,seed){
 svg(`<g transform="translate(${offset} 0)">`)
 rootFan(255,475,seed)
 const stem=`M241 476 C249 386 251 319 ${253+lean*.6} 229 Q${254+lean} 135 ${255+lean} 65 Q${263+lean} 163 ${270+lean*.6} 265 C270 361 261 413 272 476Z`
 path(stem,'url(#bark)','#292622',2)
 svg(`<clipPath id="pine-stem-${seed}"><path d="${stem}"/></clipPath><g clip-path="url(#pine-stem-${seed})">`);bark(255,468,148,lean,seed);svg('</g>')
 const tiers=seed===7?[[129,30],[177,60],[224,83],[276,111],[326,135],[373,153]]:[[144,34],[193,53],[241,80],[293,103],[343,126],[390,132]]
 for(let i=0;i<tiers.length;i++){
  const [y,span]=tiers[i],cx=255+lean*(475-y)/410
  needles(cx,y,span*(.8+n(seed,i)*.27),seed+i*31,-1)
  needles(cx+6,y-10,span*(.7+n(seed,i+10)*.37),seed+i*31+19,1)
  if(i%2===0)path(`M${cx+2} ${y+4} q17 -6 30 -23 l7 -2`,null,'#8d7651',3)
 }
 // Sparse leading needles and exposed old bark are deliberately separate shapes.
 needles(255+lean,99,19,seed+93,-1);needles(255+lean,87,17,seed+96,1)
 svg('</g>')
}
function leafMass(cx,cy,rx,ry,seed){
 const points=[]
 for(let i=0;i<40;i++){
  const a=i*Math.PI*2/40,k=.70+n(seed,i)*.30
  points.push([cx+Math.cos(a)*rx*k,cy+Math.sin(a)*ry*k])
 }
 path('M'+points.map(p=>p.map(v=>v.toFixed(2)).join(' ')).join(' L')+'Z','url(#blackleaf)','#282c27',1.5)
 for(let i=0;i<105;i++){
  const x=cx+(n(seed,i+40)-.5)*rx*1.4,y=cy+(n(seed,i+180)-.5)*ry*1.3,s=3+n(seed,i+300)*8
  path(`M${x-s} ${y+2} q${s*.5} ${-s} ${s} ${-s*.5} q${s} ${-s*.25} ${s*1.7} ${s*.7} l-${s*.7} 2 -${s*.4} -1 -${s*.7} 2Z`,['#262c28','#383d35','#4c5044','#5c5c4f'][i%4],null,0,.7)
 }
}
function blackwood(offset,lean,seed){
 svg(`<g transform="translate(${offset} 512)">`)
 const stem=seed===41?'M227 476 Q250 436 242 384 Q225 346 249 305 Q273 269 264 207 L276 197 Q292 278 268 321 Q255 350 270 388 Q265 443 288 479Z':'M223 479 Q256 446 251 398 Q249 343 274 307 Q292 275 304 233 L315 228 Q311 286 297 326 Q276 364 281 405 Q272 449 296 480Z'
 rootFan(259,475,seed)
 const branches=seed===41?[
  ['M253 365 Q207 323 171 290 Q144 269 110 259',22],['M255 326 Q300 301 337 264 Q367 243 399 231',22],['M266 286 Q228 244 211 207 Q187 182 160 161',16],['M269 260 Q299 230 310 181 Q328 154 352 135',15],['M253 379 Q303 365 346 338 L389 318',16]
 ]:[
  ['M269 365 Q213 351 178 311 Q141 292 108 283',22],['M282 325 Q328 290 353 254 Q378 232 409 227',20],['M287 304 Q260 248 222 213 Q204 185 176 174',17],['M307 259 Q337 225 338 189 Q348 162 376 145',13],['M265 388 Q316 375 354 350 L397 326',15]
 ]
 for(const [d,width] of branches){path(d,null,'#292722',width+4);path(d,null,'url(#bark)',width);path(d,null,'#97805b',2,.8)}
 const masses=seed===41?[[119,247,57,33],[168,176,57,39],[202,217,48,31],[281,143,55,40],[347,153,63,37],[385,225,60,36],[338,271,53,29],[389,314,56,31],[187,298,51,28]]:[[116,269,57,34],[178,184,58,38],[231,226,45,31],[303,153,51,36],[372,161,58,37],[396,222,55,33],[352,270,44,28],[387,324,48,32],[173,318,43,28]]
 for(let i=0;i<masses.length;i++)leafMass(...masses[i],seed+i*17)
 path(stem,'url(#bark)','#292722',2)
 svg(`<clipPath id="black-stem-${seed}"><path d="${stem}"/></clipPath><g clip-path="url(#black-stem-${seed})">`);bark(260,470,259,lean,seed);svg('</g>')
 path(seed===41?'M247 417 Q239 387 250 374 Q265 382 260 408Z':'M269 422 Q260 398 269 384 Q282 396 278 416Z','#242521','#987d55',2)
 svg('</g>')
}
pine(0,-11,7);pine(512,24,19);blackwood(0,-7,41);blackwood(512,23,67)
svg('</svg>')
writeFileSync(here+'living-trees.svg',parts.join('\n'))
console.log('Authored original SVG: four living trees, no source image input')
