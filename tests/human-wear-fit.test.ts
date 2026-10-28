import{it,expect}from'vitest'
import{hAt,hPin,hTransform,hWearBreadth,hpLength,hpSub}from'../src/client/render/human-model'
import{humanModels}from'../src/client/render/human-art'
import{humanDirections,type HumanSource}from'../src/client/render/human-spec'
it('fits the projected skin breadth independently of garment length and rotates with the actual body',()=>{
 const garment:HumanSource={frame:'garment',a:[50,10],b:[50,110],breadth:80},body:HumanSource={frame:'skin',a:[0,0],b:[0,100],breadth:30}
 for(const angle of[0,.7,Math.PI/2]){const bodyMatrix=hAt([0,0],[21,-13],.052,angle),width=hWearBreadth(garment,body,bodyMatrix,body.a,body.b)!;expect(width*80).toBeCloseTo(30*.052*1.12,10)
  for(const length of[3,8]){const matrix=hPin(garment,[0,0],[0,length],width),a=hTransform(matrix,[10,60]),b=hTransform(matrix,[90,60]);expect(hpLength(hpSub(a,b))).toBeCloseTo(1.7472,10)}
 }
})
it('uses the actual palm width and keeps old unfitted optional sources on their previous fallback',()=>{
 const source:HumanSource={frame:'g',a:[0,0],b:[0,10],breadth:50},body:HumanSource={frame:'b',a:[0,0],b:[0,10],breadth:20,palmBreadth:35},matrix=hAt([0,0],[0,0],.05)
 expect(hWearBreadth(source,body,matrix,body.a,body.b,true)!*50).toBeCloseTo(35*.05*1.12);expect(hWearBreadth({...source,breadth:undefined},body,matrix,body.a,body.b)).toBeUndefined()
})
it('registers a distal skin endpoint beyond the actual grip for every source, so gloves cover fingers rather than ending at the held-item grip',()=>{
 for(const spec of Object.values(humanModels))for(const direction of humanDirections)for(const side of['left','right']as const){const s=spec.base[direction].forearm[side],axis=hpSub(s.b,s.wrist),tip=hpSub(s.handTip!,s.wrist);expect(s.palmBreadth).toBeGreaterThan(0);expect(tip[0]*axis[0]+tip[1]*axis[1]).toBeGreaterThan(axis[0]**2+axis[1]**2)}
})
