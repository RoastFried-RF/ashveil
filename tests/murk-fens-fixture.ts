import { fieldDeviceFixture } from './field-devices-fixture'
import { playerAct } from '../src/core/game'
import { syncRegionalWeather } from '../src/core/environment'
import { updatePlayerVision } from '../src/core/fov'
import { addToBag, makeItem } from '../src/core/items'
export function murkFensFixture(){
 const d=fieldDeviceFixture(),{w,p,s,m}=d,site=m.sites.find(s=>s.id==='Region.MurkFens')!
 m.currentRegion=undefined;m.position={...site.cell};s.creatures=[p];s.maps={};s.offCreatures={};s.sources=[]
 const error=playerAct(w,{type:'enterRegion'});if(error)throw Error(error)
 p.pos={x:29,y:25};p.activity=undefined;p.bag=[];p.nextAct=s.time;p.needs.bodyTemp=37
 const salt=makeItem(w,'Item.Salt',2);addToBag(w,p,salt)
 s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};syncRegionalWeather(w,true)
 for(const c of s.creatures)if(w.db.creature(c.def).parasite){c.needs.bodyTemp=20;c.asleep=false;c.unconscious=false}
 updatePlayerVision(w,p)
 return{...d,site,salt,leeches:s.creatures.filter(c=>!!w.db.creature(c.def).parasite)}
}
