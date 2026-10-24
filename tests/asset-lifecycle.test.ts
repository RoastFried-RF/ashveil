import {expect,it} from 'vitest'
import {AssetLifecycle} from '../src/client/render/asset-lifecycle'
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r});return{promise,resolve}}
it('loads new sources before replacing sprites, then releases only old unused originals',async()=>{
 const events:string[]=[],owner={},assets=new AssetLifecycle<string>({load:async url=>{events.push('load:'+url);return url},unload:async url=>{events.push('unload:'+url)}})
 await assets.use(owner,['common','old'],()=>events.push('draw:old'))
 await assets.use(owner,['common','new'],sources=>{expect(sources.has('old')).toBe(true);expect(sources.has('new')).toBe(true);events.push('draw:new')})
 expect(events).toEqual(['load:common','load:old','draw:old','load:new','draw:new','unload:old'])
})
it('an old deferred request cannot draw over the latest scene or leak its unneeded images',async()=>{
 const wait=deferred<string>(),started=deferred<void>(),draws:string[]=[],released:string[]=[],owner={}
 const assets=new AssetLifecycle<string>({load:async url=>{if(url==='old'){started.resolve();return wait.promise}return url},unload:async url=>{released.push(url)}})
 const old=assets.use(owner,['old'],()=>draws.push('old'));await started.promise
 const next=assets.use(owner,['new'],()=>draws.push('new'));wait.resolve('old')
 expect(await old).toBe(false);expect(await next).toBe(true);expect(draws).toEqual(['new']);expect(released).toEqual(['old'])
})
it('late unmount of a former owner cannot release the replacement scene',async()=>{
 const released:string[]=[],first={},second={},assets=new AssetLifecycle<string>({load:async u=>u,unload:async u=>{released.push(u)}})
 await assets.use(first,['common'],()=>{});await assets.use(second,['common','new'],()=>{})
 await assets.release(first,()=>{throw Error('stale owner must not clear textures')});expect(released).toEqual([])
 let cleared=false;await assets.release(second,()=>{cleared=true});expect(cleared).toBe(true);expect(released.sort()).toEqual(['common','new'])
})
it('a canceled load is accounted for and released before a fresh owner begins using its sources',async()=>{
 const wait=deferred<string>(),started=deferred<void>(),events:string[]=[],oldOwner={},newOwner={}
 const assets=new AssetLifecycle<string>({load:async u=>{events.push('load:'+u);if(u==='old'){started.resolve();return wait.promise}return u},unload:async u=>{events.push('unload:'+u)}})
 const old=assets.use(oldOwner,['old'],()=>events.push('draw:old'));await started.promise
 const stop=assets.release(oldOwner,()=>events.push('clear:old')),next=assets.use(newOwner,['new'],()=>events.push('draw:new'));wait.resolve('old');expect(await old).toBe(false);await stop;expect(await next).toBe(true)
 expect(events).toEqual(['load:old','clear:old','unload:old','load:new','draw:new'])
})
it('a partial load failure preserves the last usable scene and reuses successful sources on real retry',async()=>{
 const events:string[]=[],owner={};let failing=true
 const assets=new AssetLifecycle<string>({load:async u=>{events.push('load:'+u);if(u==='bad'&&failing)throw Error('declared temporary failure');return u},unload:async u=>{events.push('unload:'+u)}})
 await assets.use(owner,['old'],()=>events.push('draw:old'))
 await expect(assets.use(owner,['good','bad'],()=>events.push('draw:bad'))).rejects.toThrow();expect(events).not.toContain('unload:old')
 failing=false;await assets.use(owner,['good','bad'],()=>events.push('draw:new'))
 expect(events).toEqual(['load:old','draw:old','load:good','load:bad','load:bad','draw:new','unload:old'])
})
