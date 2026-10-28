import { saltrimFixture } from './saltrim-fixture'
import { beaconFuelQuote, knownBeaconPosts, startBeaconFuel } from '../src/core/beacons'
import { playerAct } from '../src/core/game'
import { finishBase } from './base-camp-fixture'
import { addToBag, makeItem } from '../src/core/items'
import { updatePlayerVision } from '../src/core/fov'
import { syncRegionalWeather } from '../src/core/environment'
export function beaconsFixture(){
 const d=saltrimFixture(),{w,p,s,m}=d
 p.pos={x:18,y:21};const source=knownBeaconPosts(w).find(b=>b.address.site===d.site.id)!
 if(!source)throw Error('source')
 // Visit the actual generated second coast; leave/reentry parks original maps/UIDs.
 const relay=m.sites.find(s=>s.id==='Region.SaltrimRelay')!;p.pos={...s.map.exits[0]};const left=playerAct(w,{type:'leave'});if(left)throw Error(left);m.position={...relay.cell}
 const error=playerAct(w,{type:'enterRegion'});if(error)throw Error(error)
 p.pos={x:18,y:21};p.bag=[];p.traits=[];p.effects=[];p.activity=undefined;p.nextAct=s.time;p.needs.bodyTemp=37;s.weather='clear';s.weatherUntil=1e12;syncRegionalWeather(w,true)
 const wood=makeItem(w,'Item.Wood',3);addToBag(w,p,wood);const rumor={id:'beacon-fixture-note',kind:'supply' as const,regionId:d.site.id,text:'직접 읽은 해안 장부: 소금창고를 확인했다.',source:'읽은 원본 장부',hop:0,writtenAt:20000,foundAt:21000};s.knowledge.rumors=[rumor]
 updatePlayerVision(w,p)
 const from=knownBeaconPosts(w).find(b=>b.address.site===relay.id)!,to=knownBeaconPosts(w).find(b=>b.address.site===d.site.id)!
 const localFuel=(post:typeof from)=>{const local={db:w.db,s:{...s,map:post.map,creatures:[p],overworld:{...m,currentRegion:post.address.site}}},old={...p.pos};p.pos={x:post.address.pos.x,y:post.address.pos.y+1};updatePlayerVision(local,p);const q=beaconFuelQuote(local,p,post.address.pos,post.address.uid,wood.uid);if(q.error)throw Error(q.error);if(startBeaconFuel(local,p,post.address.pos,post.address.uid,wood.uid))throw Error('ignite');finishBase(local,p);p.pos=old}
 localFuel(to);localFuel(from);updatePlayerVision(w,p)
 return{...d,relay,from,to,wood,rumor,localFuel}
}
