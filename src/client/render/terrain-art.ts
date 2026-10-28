import type {TerrainDef} from '../../core/types'

export const mapIconKeys=['grass0','grass1','grass2','grassdirt0','grassdirt1','grassdirt2','dirt0','dirt1','dirt2','mud0','mud1','mud2','mud3','ash0','ash1','ash2','ash3','water_shallow','water_deep','blood0','blood1','blood2','blood3','blood_pool','murk_leech','deck0','deck1','deck2']

// Display choices only. These keys never change terrain, stocks or growth.
const objects:Record<string,string|readonly[string,string]>={
 'Terrain.Rubble':'complete_rubble',
 'Terrain.BoatFrame':'complete_boat_frame',
 'Terrain.StairsUp':'complete_stairs_up',
 'Terrain.SpireLadderDown':'complete_ladder_down',
 'Terrain.FieldMat':'av386_field_mat',
 'Terrain.Bedroll':'av386_bedroll',
 'Terrain.StrawBed':'av386_straw_bed',
 'Terrain.Bed':'av386_bed',
 'Terrain.GoodBed':'av386_good_bed',
 'Terrain.LeakingConduit':'complete_leaking_conduit',
 'Terrain.Barricade':'complete_barricade',
 'Terrain.ResidentDepot':'complete_resident_depot',
 'Terrain.Altar':['complete_altar_closed','complete_altar_open'],
 'Terrain.ShadePlot':'complete_crop_shade',
 'Terrain.CabbagePlot':'complete_crop_cabbage',
 'Terrain.PotatoPlot':'complete_crop_potato',
 'Terrain.TurnipPlot':'complete_crop_turnip',
 'Terrain.WhitecapPlot':'complete_crop_whitecap',
}
const stations:Record<string,string>={forge:'complete_forge',workbench:'complete_workbench',loom:'complete_loom',tanning:'complete_tanning_vat',artisan:'complete_artisan',saltwork:'complete_saltwork'}
const devices:Record<string,string>={
 'FieldDevice.TowerSensor':'complete_tower_sensor',
 'FieldDevice.ReceiverConduit':'complete_receiver_conduit',
 'FieldDevice.SpireConsole':'complete_spire_console',
 'FieldDevice.ZeroVaultSeal':'complete_zero_vault_seal',
}
export const terrainArtFrames=[...new Set([...Object.values(objects).flat(),...Object.values(stations),...Object.values(devices),'complete_well','complete_campfire_cold','complete_beacon','complete_wall_crack','complete_wall_sealed','complete_bed_plain','complete_bed_insulated','complete_bed_scorched','complete_sarcophagus_open','av_soil_residue_v315'])]

// Source resolution never enlarges a placed bed beyond its original one-tile display.
const beddingBounds:Record<string,readonly[number,number]>={
 'Terrain.FieldMat':[16,16],'Terrain.Bedroll':[16,16],'Terrain.StrawBed':[16,16],
 'Terrain.Bed':[16,16],'Terrain.GoodBed':[16,16],
}
export function beddingArtLayout(terrain:TerrainDef,width:number,height:number){
 const bounds=beddingBounds[terrain.id];if(!bounds||width<=0||height<=0)return
 const scale=Math.min(bounds[0]/width,bounds[1]/height)
 return{scale,x:(bounds[0]-width*scale)/2,y:(bounds[1]-height*scale)/2}
}

export function groundObjectArt(terrain:TerrainDef,searched=false):string|undefined{
 if(terrain.residentWell)return 'complete_well'
 if(terrain.device&&devices[terrain.device])return devices[terrain.device]
 const value=objects[terrain.id]
 if(value)return typeof value==='string'?value:value[searched?1:0]
 if(terrain.station)return stations[terrain.station.id]??'complete_workbench'
 if(terrain.bedding)return terrain.bedding.insulation?'complete_bed_insulated':'complete_bed_plain'
}
export function isGroundCrop(terrain:TerrainDef){return terrain.id in objects&&!!terrain.gather&&!!terrain.visual}
