import {terrainFireFixture} from './terrain-fire-fixture'
import {perform,openContainer} from '../src/core/actions'
import {makeItem,gridAdd} from '../src/core/items'
import {tileAt} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export function storageFireFixture(chance:number|null=1,seed='storage-fire-proof'){
 const d=terrainFireFixture(chance,seed),{w,s,p}=d,pos=d.treePos,tile=d.tree
 tile.t='Terrain.KtFloor';delete tile.cont;d.second.t='Terrain.Earth';p.pos={x:pos.x,y:pos.y+1}
 const chest=d.add('Item.StorageChest');if(!perform(w,p,{type:'place',uid:chest.uid,dir:0}).ok)throw Error('원래 보관함 설치')
 openContainer(w,p,pos);const stash=tile.cont!,water=makeItem(w,'Item.DirtyWaterBottle'),pill=makeItem(w,'Item.PillWhite',2),wood=makeItem(w,'Item.Wood',2),sack=makeItem(w,'Item.Sack')
 water.uses=1.5;water.water={pathogen:70,ash:20,salinity:35,source:'초기 보관한300ml'};pill.pillAge={potency:73,spoiled:true};sack.contents=[];const nested=makeItem(w,'Item.Cloth',2),[sw,sh]=w.db.item(sack.def).storage!;if(gridAdd(w,{items:sack.contents,w:sw,h:sh},nested)!==0)throw Error('원래 자루 내부 배치')
 for(const item of[water,pill,wood,sack])if(gridAdd(w,{items:stash.items,w:12,h:8},item)!==0)throw Error('실제 보관 물품 배치')
 const ground=makeItem(w,'Item.Wood');tile.items.push(ground)
 s.loot=undefined;invalidateLights(w);updatePlayerVision(w,p)
 return{...d,pos,tile,chest,stash,water,pill,storedWood:wood,sack,nested,ground}
}
/** 배포 기본0.02불씨·원래실물의 유한 장면. 숲2타일은 원본 검토용 초기배치다. */
export function storageFireNativeFixture(burning=false){
 const d=storageFireFixture(null,'terrain-fire-proof-1'),at=d.s.time
 d.tile.searched=false;d.stash.opened=false
 tileAt(d.w,{x:d.pos.x+3,y:d.pos.y}).t='Terrain.PineTree';tileAt(d.w,{x:d.pos.x+5,y:d.pos.y}).t='Terrain.Tree';d.s.map.name='원래 목제 보관함·유한 화재·수목 원본 검증실'
 if(burning){d.ignite();for(const dir of[3,3])d.act({type:'move',dir});d.act({type:'rest',turns:200});if(!d.tile.terrainFire)throw Error('배포 기본 불씨의 실제 보관함 발화');for(const dir of[7,7])d.act({type:'move',dir})}
 d.s.fx=[];invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const spareChest=burning?d.add('Item.StorageChest'):undefined
 return{...d,spareChest,initialCorePreparationTU:d.s.time-at}
}
