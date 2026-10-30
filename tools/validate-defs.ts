// Def 검증 CLI: pnpm validate-defs [modId...]
import { loadDb } from './loadContent'

const enabled = process.argv.slice(2)
const { db, report } = loadDb(enabled)
if(!report.errors.length&&db.scriptSources.length){try{const{attachQuickJSScripts}=await import('../src/scripting/attach');await attachQuickJSScripts(db)}catch(e){report.errors.push((e as Error).message)}}
console.log(`로드 순서: ${report.order.join(' → ')}`)
console.log(`Def ${['AshDeposit','Swarm','SaveMode','Posture','Maneuver','Cartography','Interaction','NpcPsyche', 'Body', 'Wound', 'Item', 'Creature', 'Terrain', 'LootTable', 'Trait', 'Background', 'Thought', 'Fatigue', 'PlaceEvent', 'PillEffect', 'Skill', 'Ability', 'Disease', 'Break', 'Recipe', 'Material', 'Trauma', 'Growth', 'Recovery', 'Surgery', 'Procedure', 'Nutrition', 'FoodSafety', 'WaterSafety', 'Prosthetic', 'WorldGen', 'Biome', 'RegionSite', 'RegionLayout', 'FieldDevice', 'Evidence', 'Retirement', 'Kinship', 'Season', 'Weather', 'Climate', 'Faction', 'Diplomacy', 'Economy', 'TraderStock', 'WorldSimulation', 'Drug', 'Pharmacology', 'Knowledge', 'Bestiary', 'BestiaryEntry', 'Clinic', 'Inn', 'HandHygiene', 'NpcRest', 'ResidentProvision', 'ResidentWater', 'ResidentPurification', 'Teacher', 'ResidentWarmth', 'BeddingMove', 'SupplyContract', 'NpcSocial', 'NpcCare', 'ResidentCultivation', 'NpcIdentity', 'NpcSocialReport', 'PatrolContract', 'EscortContract', 'ExcavationContract', 'RescueContract', 'RescueRemains', 'NpcAbduction', 'Ransom', 'PrisonerExchange', 'RecoveryContract', 'SourceContract', 'BountyContract', 'Investigation', 'FactionRelations', 'ColdConfusion', 'Companion', 'CompanionBond', 'Prisoner', 'PrisonerCare', 'PrisonerEscort', 'Recruitment', 'Rescue', 'NpcCustody', 'BaseCamp', 'BaseDefense', 'BaseLogistics', 'BaseWater', 'BaseRest', 'Campfire', 'BeddingContact', 'GearWeather', 'MaterialCrafting'].map((t) => `${t} ${db.all(t).length}`).join(' · ')}`)
console.log(`패치 적용 ${report.patched}건`)
for (const wn of report.warnings) console.log(`경고: ${wn}`)
for (const e of report.errors) console.log(`오류: ${e}`)
if (report.errors.length) process.exit(1)
console.log('OK')
