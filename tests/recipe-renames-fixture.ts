import {readPackages} from '../tools/loadContent'
import {loadMods} from '../src/core/defs'
import {newGame} from '../src/core/game'
import {player,type World} from '../src/core/ctx'
import {createCreature} from '../src/core/creatures'
import {enlistRecruit} from '../src/core/companions'
import {addToBag,makeItem} from '../src/core/items'
import {startCraft} from '../src/core/crafting'
import type {RecipeDef} from '../src/core/types'
export const oldRecipeId='SampleMigration.Recipe.OldBandage',newRecipeId='SampleMigration.Recipe.RenamedBandage'
export function recipeRenamesFixture(changed=false){
 const packages=readPackages(),current=loadMods(packages,['sample-recipe-renames']),oldPackages=readPackages(),pkg=oldPackages.find(p=>p.manifest.id==='sample-recipe-renames')!;pkg.manifest.version='0.9.0';delete pkg.renames
 const def=pkg.defs.find(d=>d.id===newRecipeId)! as RecipeDef;def.id=oldRecipeId;if(changed)def.workTurns=7
 const loaded=loadMods(oldPackages,['sample-recipe-renames']);if(loaded.report.errors.length||current.report.errors.length)throw Error([...loaded.report.errors,...current.report.errors].join('\n'))
 const w:World={db:loaded.db,s:newGame(loaded.db,{seed:'recipe-contract-renames',overworld:true})},s=w.s,p=player(w);s.creatures=[p];s.storyteller.budget=-1e9;p.pos={x:20,y:20};p.stats={str:10,agi:10,per:10,vit:10,wil:10};p.recipes=[oldRecipeId];p.bag=[];p.equip={};p.traumas=[];p.effects=[];p.traits=[];p.background=undefined;p.age=undefined;p.body.wounds=[];p.body.missing=[];p.body.blood=p.body.bloodMax;p.asleep=false;p.unconscious=false;p.activity=undefined;p.nextAct=s.time
 Object.assign(p.needs,{kcal:1000,waterDeficit:0,protein:100,vitamin:100,hygiene:100,fatigue:10,sleepDebt:0,bodyTemp:37,wetness:0,stress:0})
 s.map.kind='dungeon';s.map.depth=3;s.map.name='제작법 이행 유한 초기 방';s.map.ambient=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[]
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.KtFloor',roof:true,seen:true,items:[],deco:undefined,room:undefined,blood:0})
 const cloth=makeItem(w,'Item.Cloth',4);if(addToBag(w,p,cloth))throw Error('실제 천을 넣을 공간이 없다')
 const start=startCraft(w,p,oldRecipeId,1);if(start)throw Error(start);p.workJob!.progress=1;p.activity=undefined
 const worker=createCreature(w,'Creature.SettlementGuard',{x:20,y:21});worker.faction='coalition';worker.bag=[];worker.equip={};s.creatures.push(worker);enlistRecruit(w,worker,1);worker.companion!.order='defend'
 const store={x:21,y:20},chest=makeItem(w,'Item.StorageChest'),tile=s.map.tiles[store.y*s.map.w+store.x];tile.t='Terrain.Stash';tile.placed={item:chest,base:'Terrain.KtFloor'};tile.cont={items:[],opened:true,kind:'Terrain.Stash'}
 s.map.baseCamp={owner:p.id,at:Math.floor(s.time/100),store,storeUid:chest.uid,tasks:{[worker.id]:{id:s.nextId++,kind:'craft',recipe:oldRecipeId,remaining:1}},queues:{[worker.id]:[{id:s.nextId++,kind:'craft',recipe:oldRecipeId,remaining:2}]}}
 return{w,s,p,worker,cloth,current:current.db,packages,oldPackages}
}
