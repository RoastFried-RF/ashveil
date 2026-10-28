// Original ground studies, revision2. All polygons and layouts authored here.
// No source images, sampled palettes, copied pixels, filters or random noise.
import {writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
const target=fileURLToPath(new URL('./ground.svg',import.meta.url))
const c={base:'#484b3d',shade:'#3d4236',moss:'#50533f',leaf:'#5a5c44',dry:'#69634b',earth:'#514b40',rut:'#443f36',grit:'#62594a'}
const p=(d,fill,opacity=1)=>`<path d="${d}" fill="${fill}" opacity="${opacity}"/>`
const broad=[
 ['M-4 6l12-8 16 5 8 10-9 9-17-2-10-6z','M37 32l13-6 17 7 4 16-14 5-11-7-13-3z','M5 47l13-9 13 3 9 13-6 14-24-4z'],
 ['M-5 37l14-7 13 7 3 15-12 8-17-6z','M24 2l12-6 15 8 3 14-11 8-17-9z','M42 47l13-7 14 3 1 17-20 8-12-9z'],
 ['M-4-3l19 3 7 11-8 12-18-4z','M24 25l12-8 16 4 8 13-10 14-19-3-11-10z','M7 52l12-8 14 7 5 16-32 1z'],
]
const clusters=[
 [[-1,24,1.1,13],[11,9,.8,-19],[22,19,1.3,31],[48,7,.9,-9],[57,30,1.1,-27],[37,38,.75,18],[15,51,1.3,-11],[49,59,.9,25],[31,62,.7,-28]],
 [[6,3,.9,-5],[28,10,1.2,19],[53,19,.7,-38],[17,32,1.1,-14],[37,44,1.3,26],[62,51,1,-15],[9,58,.8,33],[42,63,.6,-20]],
 [[15,0,1,7],[6,18,1.2,-22],[37,13,.8,38],[56,7,1.1,-14],[25,36,.9,24],[48,40,1.4,-22],[10,55,.75,-3],[38,59,1.1,29]],
]
const scuffs=[
 ['M-3 28l10-3 8 2 5 7-5 7-12-1-6-5z','M29 46l11-5 10 3 5 8-7 5-12-1z','M44-2l9 2 6 7-5 8-9-3-7-5z'],
 ['M8 18l12-7 9 2 3 7-9 7-11-2z','M40 32l12-5 15 6v14l-17-3-9-6z','M-4 54l13-5 8 5-2 10-18 3z'],
 ['M16-4l15 6 2 9-8 5-12-6z','M4 32l13-7 13 4 2 9-13 7-13-5z','M38 50l14-8 11 5 5 10-10 8-14-4z'],
]
const pebbles=[
 [[7,16],[35,8],[48,31],[25,45],[61,56],[4,62]],
 [[14,7],[47,2],[60,34],[29,25],[18,51],[44,58]],
 [[4,5],[21,23],[51,19],[38,39],[61,59],[24,54]],
]
const seams=[
 ['M1 43l7-3 8 1 5-4 3 1-4 5-8 1-7 3z','M33 17l5-3 8 2 9-4 4 2-11 5-9-2-5 3z'],
 ['M-2 19l11 2 6-3 4 1-5 5-9 1-7-2z','M28 49l9-3 7 2 10-4 5 2-13 5-8-1-6 3z'],
 ['M9 12l8 2 8-4 5 1-6 5-10 1-7-2z','M20 45l10-5 10 3 8-1 7 3-12 1-12-2-8 4z'],
]
function tuft([x,y,s,r],dry=false){
 return `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})">`+
 p('M-6 2l3-3 7 1 4 3-5 2-7-1z',c.shade,.5)+
 p('M-2 2l-3-6 1-3 4 8 2 2z',dry?c.dry:c.moss,.66)+
 p('M0 3l1-8 3-4-1 7-1 4z',dry?c.grit:c.leaf,.6)+
 p('M1 3l4-5 4-1-4 4-3 2z',dry?c.dry:c.moss,.48)+
 p('M-4 2l-3-2 4 1 3 2z',c.leaf,.45)+'</g>'
}
function grain(col){return pebbles[col].map(([x,y],i)=>p(`M${x} ${y}l${i%2?3:2}-1 2 1-1 2-3-1z`,c.grit,.22)).join('')}
const tiles=[]
for(let row=0;row<3;row++)for(let col=0;col<3;col++){
 let v=`<rect width="64" height="64" fill="${c.base}"/>`
 v+=broad[col].map((d,i)=>p(d,i%2?c.moss:c.shade,.16)).join('')
 if(row===2)v+=`<rect width="64" height="64" fill="${c.earth}" opacity=".65"/>`
 if(row>0)v+=scuffs[col].map(d=>p(d,c.earth,row===1?.52:.3)).join('')
 if(row===2)v+=seams[col].map(d=>p(d,c.rut,.35)).join('')
 if(row<2)v+=clusters[col].map((s,i)=>row===1&&i%3===1?'':tuft(s,row===1)).join('')
 else v+=tuft(clusters[col][col],true)
 v+=grain(col)
 tiles.push(`<g id="${['grass','grassdirt','dirt'][row]}${col}" transform="translate(${col*64} ${row*64})"><g clip-path="url(#tile)">${v}</g></g>`)
}
writeFileSync(target,`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><defs><clipPath id="tile"><rect width="64" height="64"/></clipPath></defs>${tiles.join('\n')}</svg>\n`)
