/** Actual third-floor plan and generated boss loadout; a declared isolated INITIAL corpse, bright light and trained reader. */
import {makeWorld} from './helpers'
import {generateDungeon} from '../src/core/mapgen'
import {createCreature} from '../src/core/creatures'
import {killCreature} from '../src/core/combat'
import {player,terrainAt} from '../src/core/ctx'
import {DIRS} from '../src/core/geom'
import {makeItem,addToBag} from '../src/core/items'
import {updatePlayerVision} from '../src/core/fov'
export const CLOISTER_DOCUMENTS=['Item.AbbotFinalRecord','Item.AmalgamCapsuleRemnant']as const
export function cloisterEvidenceFixture(){
 const w=makeWorld('cloister-evidence-v399'),s=w.s,p=player(w),gen=generateDungeon(w,3),spawn=gen.spawns.find(sp=>sp.def==='Creature.Amalgam');if(!spawn)throw Error('Actual third-floor boss spawn missing')
 s.map=gen.map;s.maps[s.map.id]=s.map;s.map.ambient=1;s.creatures=[p];const pos=DIRS.map(v=>({x:spawn.pos.x+v.x,y:spawn.pos.y+v.y})).find(pos=>terrainAt(w,pos).passable);if(!pos)throw Error('No actual adjacent floor')
 p.pos=pos;p.bag=[];p.literacy=2;p.literate=true;p.booksRead=[];p.literacyBooks=[];p.misreadBooks=[];p.bestiary={};s.knowledge.bestiary={};p.skills={survival:60,medicine:0};p.stats.per=12;p.equip.main=makeItem(w,'Item.RustyKnife');if(p.equip.off?.lit)p.equip.off.lit=false
 const boss=createCreature(w,spawn.def,spawn.pos);s.creatures.push(boss);killCreature(w,boss,'선언된 초기 사체');const documents=CLOISTER_DOCUMENTS.map(id=>{const it=boss.bag.find(it=>it.def===id);if(!it)throw Error('Generated original document missing: '+id);return it});const mycology=makeItem(w,'Item.SettlementMycologyRecords');addToBag(w,p,mycology);s.rng['world.knowledge']=[0,0,0,1];s.fx=[];updatePlayerVision(w,p)
 return{w,s,p,boss,documents,mycology,proof:{actualThirdFloorPlan:true,actualGeneratedBossLoadout:true,isolatedInitialCorpse:true,initialBrightAmbient:1,initialLiteracy:2,initialSurvival:60,initialKnowledgeRNG:[0,0,0,1],postTitleWorldWrites:false}}
}
