import{it,expect}from'vitest'
import{readFileSync}from'node:fs'
import{createHash}from'node:crypto'
import{glaiveInventoryArt as art,inventoryIconLayout}from'../src/client/render/inventory-icon-layout'
const frame={x:1030,y:498,w:495,h:487}
const point=(m:readonly number[],x:number,y:number)=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]
it('leaves square/size-only equipment, other items and mismatched source crops on their existing path',()=>{
 expect(inventoryIconLayout(art.sprite,undefined,undefined,frame)).toBeUndefined()
 expect(inventoryIconLayout(art.sprite,32,32,frame)).toBeUndefined()
 expect(inventoryIconLayout(art.sprite,184,32,frame)).toBeUndefined()
 expect(inventoryIconLayout(art.sprite,32,undefined,frame)).toBeUndefined()
 expect(inventoryIconLayout(art.sprite,0,184,frame)).toBeUndefined()
 expect(inventoryIconLayout(art.sprite,NaN,184,frame)).toBeUndefined()
 expect(inventoryIconLayout('av380_culler_scythe_blade',32,184,frame)).toBeUndefined()
 expect(inventoryIconLayout(art.sprite,32,184,{...frame,x:1031})).toBeUndefined()
})
it('turns the two observed shaft points into a vertical long icon without changing their source',()=>{
 const layout=inventoryIconLayout(art.sprite,32,184,frame)!,a=point(layout.matrix,24,462),b=point(layout.matrix,280,162)
 expect(a[0]).toBeCloseTo(b[0],10);expect(b[1]).toBeLessThan(a[1]-80)
 const [left,top,right,bottom]=art.occupiedBounds,scale=Math.hypot(layout.matrix[0],layout.matrix[1])
 expect((bottom-top)*scale).toBeGreaterThan(130);expect((right-left)*scale).toBeLessThan(32)
 expect(layout.transform).toMatch(/^matrix\(/)
})
it('keeps all four measured alpha16 pixel-square extrema inside representative portrait bag boxes',()=>{
 const extrema=[[332,35],[488,77],[463,24],[11,476]]
 for(const[w,h]of[[32,184],[70,450],[16,60]]){
  const layout=inventoryIconLayout(art.sprite,w,h,frame)!
  for(const[x,y]of extrema)for(const[dx,dy]of[[0,0],[1,0],[0,1],[1,1]]){
   const q=point(layout.matrix,x+dx,y+dy)
   expect(q[0]).toBeGreaterThanOrEqual(0);expect(q[0]).toBeLessThanOrEqual(w)
   expect(q[1]).toBeGreaterThanOrEqual(0);expect(q[1]).toBeLessThanOrEqual(h)
  }
 }
})
it('pins measured geometry to the existing original bytes and frame rather than accepting a replacement crop silently',()=>{
 const manifest=JSON.parse(readFileSync('src/client/sprites.json','utf8')),source=manifest.frames[art.sprite]
 expect(source.slice(1)).toEqual([...art.frame])
 const bytes=readFileSync('public/'+manifest.sheets[source[0]])
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(art.sourceSHA256)
})
