/** Serialized ownership prevents an old load or unmount from freeing a newer scene's assets. */
export class AssetLifecycle<T>{
 private generation=0
 private owner:object|undefined
 private tail:Promise<unknown>=Promise.resolve()
 private resources=new Map<string,T>()
 constructor(private backend:{load(url:string):Promise<T>;unload(url:string):Promise<void>}){}
 private enqueue<R>(work:()=>Promise<R>):Promise<R>{const result=this.tail.then(work);this.tail=result.catch(()=>{});return result}
 use(owner:object,urls:readonly string[],apply:(resources:ReadonlyMap<string,T>)=>void):Promise<boolean>{
  const ticket=++this.generation;this.owner=owner;const desired=new Set(urls)
  return this.enqueue(async()=>{
   if(ticket!==this.generation)return false
   const missing=[...desired].filter(url=>!this.resources.has(url))
   const loaded=await Promise.allSettled(missing.map(async url=>{const resource=await this.backend.load(url);this.resources.set(url,resource)}))
   if(ticket!==this.generation)return false
   if(loaded.some(row=>row.status==='rejected'))throw Error('이미지를 불러오지 못했다')
   // The caller removes old sprites before their source images are released.
   apply(this.resources)
   const obsolete=[...this.resources.keys()].filter(url=>!desired.has(url))
   for(const url of obsolete)this.resources.delete(url)
   await Promise.allSettled(obsolete.map(url=>this.backend.unload(url)))
   return ticket===this.generation
  })
 }
 release(owner:object,beforeRelease:()=>void):Promise<void>{
  if(this.owner!==owner)return Promise.resolve()
  ++this.generation;this.owner=undefined
  return this.enqueue(async()=>{beforeRelease();const urls=[...this.resources.keys()];this.resources.clear();await Promise.allSettled(urls.map(url=>this.backend.unload(url)))})
 }
}
