import {newGame,playerAct} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {ensureSociety} from '../src/core/diplomacy'
import {marketFor} from '../src/core/economy'
import {updatePlayerVision} from '../src/core/fov'
import {db} from './helpers'
const template=newGame(db,{seed:'retirement-home',background:'Bg.GuildMerchant',overworld:true})
export function retirementFixture(){
 const w:World={db,s:structuredClone(template)},s=w.s,p=player(w),m=s.overworld!,site=m.sites.find(site=>site.kind==='settlement'&&site.faction==='guild')!
 p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.age=undefined;p.traits=[];p.effects=[];p.traumas=[];p.body.wounds=[];p.body.missing=[];p.money=5000;p.nextAct=s.time;p.body.blood=p.body.bloodMax
 Object.assign(p.needs,{kcal:3000,waterDeficit:0,fatigue:10,sleepDebt:0,bodyTemp:37,stress:0})
 m.currentRegion=undefined;m.position={...site.cell};s.creatures=[p];s.maps={};s.offCreatures={};s.sources=[];s.map={id:'surface',name:'길드 갈림길 앞 길목',kind:'surface',depth:0,ambient:1,w:16,h:12,tiles:Array.from({length:192},()=>({t:'Terrain.Earth',v:0,roof:false,blood:0,items:[]})),exits:[],links:[],rooms:[],props:[],lights:[]};p.pos={x:8,y:6}
 const error=playerAct(w,{type:'enterRegion'});if(error)throw Error(error)
 const keeper=s.creatures.find(c=>c.traderSite===site.id)!,market=marketFor(w,keeper)!,bed=s.map.innBeds!.find(bed=>bed.keeper===keeper.id)!
 for(const c of s.creatures.filter(c=>c.id!==p.id)){c.asleep=false;c.unconscious=false;c.needs.fatigue=10;c.nextAct=s.time+1000}
 ensureSociety(w)!.reputation.guild=20;p.pos={x:keeper.pos.x-1,y:keeper.pos.y};s.weather='clear';s.weatherUntil=1e12;updatePlayerVision(w,p)
 return{w,s,p,m,site,keeper,market,bed}
}
