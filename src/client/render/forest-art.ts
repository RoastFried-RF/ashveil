import variants from './forest-art.json'

export const forestArtFrames=variants.map(row=>row.sprite)
export interface TreeArt {sprite:string;anchor:readonly[number,number];scale?:number;worldHeight?:number;flip:boolean;tint:number}

/** 좌표 해시만 읽는 표현 선택. 현재 등록 고사목과 과거 폴백/모드 우선순위를 구분한다. */
export function treeArt(sprites:readonly string[]|undefined,hash:number):TreeArt{
 const currentDefault=sprites?.length===1&&sprites[0]==='original_dead_tree'
 const custom=!currentDefault&&sprites?.[0]&&sprites[0]!=='tree_dead'
 if(custom||!currentDefault&&hash%4===0)return{sprite:custom?sprites![hash%sprites!.length]:'tree',anchor:[.5,.96],scale:.42,flip:hash%2===0,tint:0x9a9a92}
 const row=variants[(hash>>>2)%variants.length]!
 return{sprite:row.sprite,anchor:row.anchor as [number,number],worldHeight:row.worldHeight,flip:false,tint:0xffffff}
}
