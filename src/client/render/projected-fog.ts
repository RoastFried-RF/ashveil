import type { Sprite, Texture } from 'pixi.js'

// 보이는 물체의 픽셀만 그 발밑 조도로 처리한다. 땅/개체를 새로 그리거나 시야를 늘리지 않는다.
const silhouettes=new WeakMap<Texture,HTMLCanvasElement>()
function silhouette(texture:Texture){
 let canvas=silhouettes.get(texture)
 if(!canvas){
  const frame=texture.frame;canvas=document.createElement('canvas');canvas.width=frame.width;canvas.height=frame.height
  const ctx=canvas.getContext('2d')!;ctx.drawImage(texture.source.resource as CanvasImageSource,frame.x,frame.y,frame.width,frame.height,0,0,frame.width,frame.height)
  ctx.globalCompositeOperation='source-in';ctx.fillStyle='#040408';ctx.fillRect(0,0,canvas.width,canvas.height);silhouettes.set(texture,canvas)
 }
 return canvas
}
export function projectVisibleFog(ctx:CanvasRenderingContext2D,sprite:Sprite,baseAlpha:number){
 const mask=silhouette(sprite.texture)
 ctx.save();ctx.translate(sprite.x,sprite.y);ctx.scale(sprite.scale.x,sprite.scale.y);ctx.imageSmoothingEnabled=false
 const x=-sprite.anchor.x*mask.width,y=-sprite.anchor.y*mask.height
 ctx.globalCompositeOperation='destination-out';ctx.drawImage(mask,x,y)
 // 기존 안개*(1-실루엣)+발밑 안개*실루엣. source-over는 가장자리 안개를 두 번 지운다.
 ctx.globalCompositeOperation='lighter';ctx.globalAlpha=baseAlpha;ctx.drawImage(mask,x,y)
 ctx.restore()
}
