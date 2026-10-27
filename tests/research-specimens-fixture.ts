/** Finite natural market and fresh adjacent carcass; trained observer and initial knowledge RNG are explicit. */
import {blackwoodFixture} from './blackwood-fixture'
import {createCreature} from '../src/core/creatures'
import {creatureAt,terrainAt,turnOf} from '../src/core/ctx'
import {DIRS} from '../src/core/geom'
import {makeItem,addToBag} from '../src/core/items'
import {updatePlayerVision} from '../src/core/fov'
import {marketFor,tradeQuote} from '../src/core/economy'
import {playerAct} from '../src/core/game'
import {studyBook} from '../src/core/skills'
import {startDissection} from '../src/core/bestiary'
import {finishBase} from './base-camp-fixture'
export function specimenFixture(kind:'rat'|'hound'='rat',success=true,alpha=false){
 const d=blackwoodFixture(),{w,p}=d,s=w.s,trader=s.creatures.find(c=>c.traderSite===d.site.id)!,market=marketFor(w,trader)!
 const free=(x:number,y:number)=>x>0&&y>0&&x<s.map.w-1&&y<s.map.h-1&&terrainAt(w,{x,y}).passable&&!creatureAt(w,{x,y})
 const step=DIRS.find(v=>free(trader.pos.x+v.x,trader.pos.y+v.y));if(!step)throw Error('No finite position beside original merchant')
 p.pos={x:trader.pos.x+step.x,y:trader.pos.y+step.y};p.literacy=2;p.literate=true;p.booksRead=[];p.literacyBooks=[];p.misreadBooks=[];p.bestiary={};s.knowledge.bestiary={};p.skills={survival:30,medicine:0};p.stats.per=12
 const knife=makeItem(w,'Item.RustyKnife');addToBag(w,p,knife);p.equip.main=makeItem(w,'Item.Torch');p.equip.main.lit=false;s.map.ambient=1
 for(const [slot,def]of[['chest','Item.LeatherCoat'],['lining','Item.WoolShirt'],['head','Item.Hood'],['feet','Item.Boots']]as const)p.equip[slot]=makeItem(w,def)
 const at=DIRS.map(v=>({x:p.pos.x+v.x,y:p.pos.y+v.y})).find(v=>free(v.x,v.y));if(!at)throw Error('No finite adjacent carcass cell')
 const corpse=createCreature(w,kind==='rat'?'Creature.BurrowRat':alpha?'Creature.AshHoundAlpha':'Creature.AshHound',at);corpse.alive=false;corpse.deathTurn=turnOf(w);s.creatures.push(corpse)
 s.rng['world.knowledge']=[success?0:0xfe00_0000,0,0,1];s.fx=[];updatePlayerVision(w,p)
 const bookDef=kind==='rat'?'Item.SettlementMycologyRecords':'Item.LivestockAdaptationRecords',book=market.items.find(i=>i.def===bookDef);if(!book)throw Error('Actual finite new document missing')
 return{...d,s,trader,market,corpse,knife,book,kind,thread:kind==='rat'?'ash-fever':'adaptation',step:kind==='rat'?'rat-specimen':'hound-specimen',proof:{finiteInitialPosition:true,initialBrightAmbient:1,carriedFlame:false,originalMerchantID:trader.id,originalDocumentUID:book.uid,initialFreshCarcass:corpse.id,initialKnowledgeRNG:s.rng['world.knowledge'].slice(),initialSkills:{...p.skills}}}
}
export function buySpecimenBook(d:ReturnType<typeof specimenFixture>){const q=tradeQuote(d.w,d.p,d.trader,[{uid:d.book.uid,count:1}],[]);if(q.error)throw Error(q.error);const error=playerAct(d.w,{type:'trade',target:d.trader.id,buy:[{uid:d.book.uid,count:1}],sell:[],expectedBalance:q.balance});if(error)throw Error(error);return q}
export function readSpecimenBook(d:ReturnType<typeof specimenFixture>){const error=playerAct(d.w,{type:'read',uid:d.book.uid});if(error)throw Error(error);if(!d.p.booksRead?.includes(d.book.def))throw Error('Actual document reading did not finish')}
/** Focused gate fixtures use the same learning/work completion functions without a town-wide scheduler run. */
export function learnSpecimenBook(d:ReturnType<typeof specimenFixture>){studyBook(d.w,d.p,d.book.def,true)}
export function completeSpecimenDissection(d:ReturnType<typeof specimenFixture>){const error=startDissection(d.w,d.p,d.corpse.id,200);if(error)throw Error(error);finishBase(d.w,d.p)}
