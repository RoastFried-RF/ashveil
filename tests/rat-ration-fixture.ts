import{perform}from'../src/core/actions'
import{killCreature}from'../src/core/combat'
import{createCreature}from'../src/core/creatures'
import{tileAt}from'../src/core/ctx'
import{clinicalDiseaseFixture}from'./clinical-diseases-fixture'
export function ratFoodFixture(seed='actual-rat-food'){
 const d=clinicalDiseaseFixture(seed);d.p.background=undefined;d.p.traits=[];d.p.skills={};d.p.needs.kcal=0;d.p.needs.vitamin=0;d.p.needs.waterDeficit=1000
 const rat=createCreature(d.w,'Creature.BurrowRat',{x:21,y:20});rat.bag=[];rat.equip={};d.s.creatures.push(rat);killCreature(d.w,rat,'실제 원본 굴쥐 사망')
 const meat=tileAt(d.w,rat.pos).items.find(i=>i.def==='Item.RawRatMeat')!;if(!meat)throw Error('actual original rat food drop')
 const move=perform(d.w,d.p,{type:'move',dir:2});if(!move.ok||!perform(d.w,d.p,{type:'pickup',uid:meat.uid}).ok)throw Error('original meat actual ground pickup')
 return{...d,rat,meat:d.p.bag.find(i=>i.uid===meat.uid)!}
}
export function rationFixture(tool=true){
 const d=clinicalDiseaseFixture('actual-ration-pack');d.p.background=undefined;d.p.traits=[];d.p.skills={};d.p.needs.kcal=0;d.p.needs.vitamin=0
 const pack=d.add('Item.RationPack'),blade=tool?d.add('Item.HuntingKnife'):undefined;pack.quality=2;pack.durability=81
 return{...d,pack,blade}
}

export async function ratFoodNativeFixture(raw=false){
 const[{syncRegionalWeather},{updatePlayerVision}]=await Promise.all([import('../src/core/environment'),import('../src/core/fov')])
 const d=ratFoodFixture(raw?'actual-raw-rat-food-2':'actual-rat-food');d.s.storyteller.budget=-1e9;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p);return d
}
export async function rationNativeFixture(pending=false,tool=true){
 const[{syncRegionalWeather},{updatePlayerVision},{playerAct}]=await Promise.all([import('../src/core/environment'),import('../src/core/fov'),import('../src/core/game')])
 const d=rationFixture(tool);d.s.storyteller.budget=-1e9;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p)
 if(pending){const settle=playerAct(d.w,{type:'wait'});if(settle)throw Error(settle);const error=playerAct(d.w,{type:'consume',uid:d.pack.uid},1);if(error||!d.s.simulationPending||d.p.activity?.kind!=='openFood')throw Error('actual pending original ration')}
 return d
}
