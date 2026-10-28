import type {Sprite,Texture} from 'pixi.js'
import type {Pos} from '../../core/geom'

const alpha=new WeakMap<Texture,Uint8ClampedArray|null>()
/** Read the displayed frame's alpha, so transparent atlas padding never captures a click. */
export function spritePixelHit(sprite:Sprite,screen:Pos):boolean{
 if(!sprite.visible||sprite.alpha<=0)return false
 const texture=sprite.texture,frame=texture.frame,local=sprite.toLocal(screen)
 const x=Math.floor(local.x+sprite.anchor.x*frame.width),y=Math.floor(local.y+sprite.anchor.y*frame.height)
 if(x<0||y<0||x>=frame.width||y>=frame.height)return false
 let pixels=alpha.get(texture)
 if(pixels===undefined){
  try{
   const canvas=document.createElement('canvas');canvas.width=frame.width;canvas.height=frame.height
   const ctx=canvas.getContext('2d',{willReadFrequently:true})!
   ctx.drawImage(texture.source.resource as CanvasImageSource,frame.x,frame.y,frame.width,frame.height,0,0,frame.width,frame.height)
   pixels=ctx.getImageData(0,0,frame.width,frame.height).data;alpha.set(texture,pixels)
  }catch{alpha.set(texture,null);return false}
 }
 return !!pixels&&pixels[(y*frame.width+x)*4+3]>=32
}
