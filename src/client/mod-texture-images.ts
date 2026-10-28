import {decodeTexture} from '../core/mod-textures'

/** 설치 검토에서 브라우저 디코더로 압축 픽셀까지 확인한다. 세계/화면에는 적용하지 않는다. */
export async function inspectModTextureImages(textures:Readonly<Record<string,string>>):Promise<void>{
 for(const[key,source]of Object.entries(textures)){
  let image:ImageBitmap|undefined
  try{
   image=await createImageBitmap(new Blob([new Uint8Array(decodeTexture(source)).buffer],{type:'image/png'}))
   if(image.width!==16||image.height!==16)throw Error('16×16 이미지가 아니다')
  }catch(error){throw Error(key+': PNG 픽셀을 읽을 수 없다 · '+(error as Error).message,{cause:error})}finally{image?.close()}
 }
}
