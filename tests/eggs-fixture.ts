import{loadMods}from'../src/core/defs'
import{readPackages}from'../tools/loadContent'
import{clinicalDiseaseFixture}from'./clinical-diseases-fixture'
export function eggFixture(chance?:number,count=3,seed='actual-fragile-eggs'){
 const d=clinicalDiseaseFixture(seed);d.p.background=undefined;d.p.traits=[];d.p.skills={};d.p.needs.kcal=0;d.p.needs.vitamin=0;d.p.needs.waterDeficit=1000
 if(chance!==undefined){const id='actual.egg.drop';const loaded=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'Item.Egg',path:'/fragile/dropChance',value:chance}]}],[id]);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));d.w.db=loaded.db}
 const egg=d.add('Item.Egg',count);egg.quality=2;egg.durability=81
 return{...d,egg}
}

export async function eggNativeFixture(){
 const [{syncRegionalWeather},{updatePlayerVision}]=await Promise.all([import('../src/core/environment'),import('../src/core/fov')])
 const d=eggFixture(undefined,3,'actual-default-egg-impact-0');d.s.storyteller.budget=-1e9;syncRegionalWeather(d.w,true);updatePlayerVision(d.w,d.p);return d
}
