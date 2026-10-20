import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {tileAt} from '../src/core/ctx'
export function fixedBeddingFixture(wetness=0){
 const d=clinicalDiseaseFixture('actual-fixed-bedding',false),bed=tileAt(d.w,d.p.pos);bed.t='Terrain.Bed';bed.roof=true;delete bed.placed;delete bed.beddingWetness
 if(wetness)bed.beddingWetness=wetness
 d.s.map.lights=[];d.p.background=undefined;d.p.skills={};d.p.needs.wetness=0;d.p.needs.skinWetness={head:0,torso:0,arms:0,legs:0,hands:0,feet:0}
 return{...d,bed}
}

export async function fixedBeddingNativeFixture(pending=false){
 const [{updatePlayerVision},{playerAct}]=await Promise.all([import('../src/core/fov'),import('../src/core/game')])
 const d=fixedBeddingFixture(100);d.s.storyteller.budget=-1e9;d.s.map.residentBeds=[{owner:d.p.id,terrain:d.bed.t,pos:{...d.p.pos}}];d.p.facing=6;updatePlayerVision(d.w,d.p)
 if(pending){const settle=playerAct(d.w,{type:'wait'});if(settle)throw Error(settle);const error=playerAct(d.w,{type:'rest',turns:200},1);if(error||!d.s.simulationPending)throw Error('actual pending same fixed-bed contact')}
 return d
}
