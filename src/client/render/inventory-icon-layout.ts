/** Display-only orientation of an unchanged source frame inside explicit bag dimensions. */
export const glaiveInventoryArt={
 sprite:'av380_culler_glaive',
 sourceSHA256:'b389c1be22914533bff7536ae62b2c1604ca407e879a19494721e703a3f1452d',
 frame:[1030,498,495,487] as const,
 angleDegrees:-40.47523152716581,
 // Rotated pixel-square extents of every alpha>=16 pixel, including small residues.
 occupiedBounds:[275.2671407297992,-282.93486211490347,422.60707268933476,355.707217853161] as const,
 padding:2,
 // At32x184: no alpha>=16 clipping; viewport cuts4450 alpha1 fringe pixels,
 // 4379 fully and71 partly. The unchanged whole PNG is not alpha1-clean.
} as const

interface SourceFrame {x:number;y:number;w:number;h:number}
export interface InventoryIconLayout {
 matrix:readonly[number,number,number,number,number,number]
 transform:string
}
export function inventoryIconLayout(name:string,width:number|undefined,height:number|undefined,frame:SourceFrame|undefined):InventoryIconLayout|undefined{
 if(name!==glaiveInventoryArt.sprite||width===undefined||height===undefined||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<width*2.5||!frame)return
 const [x,y,w,h]=glaiveInventoryArt.frame
 if(frame.x!==x||frame.y!==y||frame.w!==w||frame.h!==h)return
 const [left,top,right,bottom]=glaiveInventoryArt.occupiedBounds,pad=glaiveInventoryArt.padding
 const boundWidth=right-left+pad*2,boundHeight=bottom-top+pad*2
 const scale=Math.min(width/boundWidth,height/boundHeight),angle=glaiveInventoryArt.angleDegrees*Math.PI/180
 const cos=Math.cos(angle)*scale,sin=Math.sin(angle)*scale
 const matrix:[number,number,number,number,number,number]=[cos,sin,-sin,cos,
  (width-boundWidth*scale)/2-(left-pad)*scale,
  (height-boundHeight*scale)/2-(top-pad)*scale]
 return{matrix,transform:`matrix(${matrix.join(',')})`}
}
