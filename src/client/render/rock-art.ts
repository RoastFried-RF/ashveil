import layouts from './rock-art.json'

/** Display-only choice from the existing coordinate hash; no gameplay RNG or collision changes. */
export function rockArt(sprites:readonly string[]|undefined,hash:number){
 const sprite=sprites?.length?sprites[(hash>>>0)%sprites.length]!:'rock'
 const row=layouts.find(row=>row.sprite===sprite)
 return row?{sprite,anchor:row.anchor as [number,number],scale:row.scale}:{sprite,anchor:[.5,.9] as [number,number],scale:.45}
}
