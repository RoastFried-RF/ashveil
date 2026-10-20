import {combatManeuver} from './maneuvers'
import {canSearchContainer,containerLocked,startContainerPry,containerPryStep} from './container-locks'
import {obtainResidentCropSupply} from './resident-crop-supplies'
import {mergeFood} from './food-merge'
import {offerResidentProduce} from './resident-produce'
import {recordResidentPlanting,forgetResidentPlot,giveResidentSeed} from './resident-cultivation'
import {equipmentSnapshot,runEquipmentWorkers} from './script-item'
import {runItemConsumptionWorker} from './script-item'
import {startNpcCare} from './npc-care'
import {acceptExcavation,deliverExcavation,startExcavation,excavationStep} from './excavation-contracts'
import {acceptEscort,reportEscort,visitEscort} from './escort-contracts'
import {converseNpcs} from './npc-social'
import {acceptPatrolContract,reportPatrolContract,visitPatrolContract} from './patrol-contracts'
import {startRansom,startPrisonerExchange,ransomStep} from './ransom'
import {planNpcAbduction,finishNpcAbduction,observeAbductionTarget} from './npc-abduction'
import {acceptRescue,reportRescue,rescueRemainsQuote,surveyRescueRemains} from './rescue-contracts'
import {player} from './ctx'
import {assignCompanionRecovery,collectRecoveryCargo,companionRecoveryFetch,companionRecoveryReturn,companionRecoverySearchError,stopCompanionRecovery} from './companion-recovery'
import {acceptRecovery,deliverRecovery} from './recovery-contracts'
import {acceptSourceContract,reportSourceContract,surveySourceContract} from './source-contracts'
import {acceptBounty,questionBounty,reportBounty,surveyBounty} from './bounty-contracts'
import {plantCultivation,waterCultivation,cropStarterError,cultivationSubstrateQuote,refreshCultivationSubstrate} from './cultivation'
import {buyNpcWorldMap} from './npc-world-cartography'
import {commandCompanionWorldMap} from './companion-world-cartography'
import {readMerchantMap} from './merchant-map-reading'
import {acceptWorldMapSurvey,deliverWorldMapSurvey} from './world-map-commissions'
import {startWorldMapDrawing,cancelWorldMapDrawing,worldMapDrawingStep} from './world-cartography'
import {postRumor} from './rumor-network'
import {surveyWorld} from './world-observations'
import {buyNpcMap} from './npc-cartography'
import {requestMerchantMap} from './npc-map-shop-supplies'
import {extinguishTerrainFire} from './terrain-fire'
import {acceptMapSurvey,deliverMapSurvey} from './map-commissions'
import {startMapDrawing,cancelMapDrawing,mapDrawingStep} from './map-writing'
import {commandCompanionMap,type CompanionMapOperation} from './companion-cartography'
import {appraisePill} from './merchant-appraisal'
import {learnTorchRetreat} from './animal-fear'
import {fatigueBand} from './fatigue-state'
import {cancelBoil} from './boil-state'
import {prepareUnheatedMeal} from './unheated-meal'
import {stageCooking,takeCooking} from './cooking'
import {cookingRules,foodKcal} from './cooking-state'
import {dropFragile} from './fragile'
import {exposeDisease} from './conditions'
import {diseaseStream} from './disease-state'
import {gatherSignature,gatherSeasonError,gatherFireError} from './gather-state'
import {warmMealGain} from './boiled-meal'
import {startBrew,brewStep,cancelBrew} from './brewing'
import {startNeedles,needlesStep} from './pines'
import {startOpenFood,openFoodStep} from './open-food'
import {foodServings,consumeFoodServing} from './food-vessels'
import {startMaskRefill,maskRefillStep} from './air'
import {diseaseEatMultiplier} from './disease-state'
import {refloatBoat} from './boat-flood'
import {worldRaidLoot} from './world-raids'
import { startWaterRescue, waterRescueStep } from './aquatic'
import { beaconWorkStep, readBeacon, startBeaconFuel, startBeaconSignal } from './beacons'
import { attachParasites, startParasiteRemoval, parasiteRemovalStep } from './parasites'
import { boatRepairQuote, watercraft } from './marine-state'
import { clamp } from './ctx'
import { cancelFieldDevice, fieldDeviceStep, startFieldDevice } from './field-devices'
import { evidenceStep, startEvidence } from './evidence'
import { retire } from './retirement'
import { towerSoilFertility } from './tower-consequences'
import { witnessPropertyCrime } from './diplomacy'
import { machineAction, machineProtecting, machineReady, machineRules } from './machine-state'
import { machineCareStep, machineHaul, startMachineCare } from './machines'
import { gearSwapQuote, gearSwapStep, startGearSwap } from './gear-swap'
import { ageLooseGear, gearForPickup } from './gear-weather'
import { clothingBaseTurns, clothingPeer, clothingPairPresent, clothingRemoveSlots, finishClothingProgress } from './lining-state'
import { recordCampfirePlacement, startFireWork, fireWorkStep, extinguishCampfire } from './campfire'
import { assignBaseBed, baseBedQuote, recordBaseBedPlacement } from './base-rest'
import { fillBaseWater, takeBaseWaterBottle, treatBaseWater } from './base-water'
import { baseLogisticsDef, basePickup, startBaseGather } from './base-logistics'
import { baseTaskActive } from './base-camp-state'
import { lootBaseRaid } from './base-defense'
import { assignBaseTask, claimBaseStep, openBaseStore, startBaseCraft, startClaimBase, transferBase } from './base-camp'
import { startStruggle, struggleStep } from './prisoner-escape'
import { letGoEscort, requestEscortYield } from './prisoner-escort'
import { inviteRecruit, recruitmentInviteStep, recruitmentStep, requestRecruitment } from './recruitment'
import { captivityGuard, feedPrisoner, wakePrisoner } from './prisoner-care'
import { prisonerStep, startPrisonerAction } from './prisoners'
import { commandCompanion, dismissCompanion, giveCompanion, hireCompanion, partyTransitionError, regionPartyTransitionError, payCompanion } from './companions'
import { acceptInvestigation, reportInvestigation, surveyInvestigation } from './investigation'
import { acceptSupply, cancelSupply, deliverSupply } from './contracts'
import { corpseMoneyQuote, takeCorpseMoney } from './corpse-money'
import { furniturePackStep, recordBeddingPlacement, startFurniturePack } from './bedding-move'
import { startWarmth, warmthStep } from './resident-warmth'
import { lessonStep, requestLesson } from './teaching'
import { takeResidentFuel } from './resident-purification'
import {acquireResidentVessel} from './resident-vessels'
import { buyClinicSupplies } from './clinic-supply'
import { takeResidentRation } from './resident-provisions'
import { recordResidentUse } from './world-simulation'
import { residentBedError, residentWakeTarget } from './resident-rest'
import { dirtyHands, finishHandWash, handHygieneDef, washHandsError } from './hand-hygiene'
import { drinkVolume, spendDrinkVolume } from './wash-water'
import { innBedAt, innSleepError, rentInnBed } from './inn'
import {rememberLifeEvent} from './life-memories'
import { finishClinicalDose } from './clinical-drugs'
import { finishDiagnostic, requestClinic, type ClinicRequest } from './clinic'
import { channelTurns, hostileAware, multiTurnFactor } from './action-time'
export { channelTurns, hostileAware, multiTurnFactor } from './action-time'
import { startTreatment, startProcedure, finishTreat, externalTreatmentError, interruptTreat, recordTreatmentProgress, releasePatient } from './treatment'
export { canTreat, treatQuality, interruptTreat } from './treatment'
import { dissectionError, finishDissection, startDissection } from './bestiary'
import { bestiaryDef, bestiaryEntry, knownCreatureName } from './bestiary-state'
import { finishTaste, identifyPill, startTaste, usePill } from './knowledge'
import { knowledgeDef, readingPageTurns } from './knowledge-state'
export { applyPillEffect } from './knowledge'
import { alcoholStage } from './drug-state'
import { administerDrug, finishTopical, startTopical } from './pharmacology'
import { bargain, exchange, talk, type TradeLine } from './economy'
import { hostile } from './diplomacy'
export { hostile } from './diplomacy'
import { eatSnow, finishClimateAction, nearbyIce, startSnow } from './climate'
import { climateDef, rainAcidity } from './climate-state'
import { boatLaunchQuote, launchBoat, startTravel, travelStep } from './journey'
import { appraiseRelic, prostheticStep, startProsthetic } from './prosthetics'
import { prostheticIceSlip, prostheticNoise } from './prosthetic-state'
import { drinkContaminants, fillWaterBottle, nearbyWater, startWaterTreatment, waterStep } from './water'
import { pourWater } from './water-transfer'
import { waterQuality, waterSafetyDef, salineWaterLoss, suitableDrink } from './water-state'
import { finishWash, foodPoison, washSupply } from './food-safety'
import { foodFreshness, foodSafetyDef, freshnessBand } from './food-state'
// 행동 실행. 플레이어와 NPC가 같은 함수를 쓴다 (규칙 대칭성).
// 기본: 이동·공격 = 1턴(100TU). 치료·수색·수면 등은 여러 턴.

import { hydrate, nourish } from './nutrition'
import { thirstBand } from './nutrition-state'
import { abilityStrike, escapeChance, recoverArrow, spearWallReact, useAbility } from './abilities'
import {
  bloodLoss, capacity, painStage, painTotal, part, regionPenalties, tryPart,
} from './body'
import { canReach, fx, resolveAttack, pushBack, shoveChance, rangedRange } from './combat'
import { creatureAt, creatureById, fixJosa, inBounds, log, rng, terrainAt, tileAt, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { cheb, DIRS, dirIndex, eq, type Pos } from './geom'
import { canSee, hasLos, invalidateLights, lightLevel } from './fov'
import {
  allItems, addToBag, addToInventory, equip, equipError, findItem, findSpot, gridAdd, gridFits, gridSpot, hasBlade, itemDef, itemLabel, makeItem, meleeWield, moveInBag,
  itemStorage, supplyItems, canStack, hasQuality, mergeInto, removeOne, removeStack, splitInBag, unequip, unequipError, wield, type Grid,
} from './items'
import { addThought } from './thoughts'
import { traumaHandleFire, traumaMove } from './trauma'
import { diagonalBlocked } from './path'
import { emitNoise } from './perception'
import {noteReadError, readNote, writeNote } from './rumors'
import { ignoreThreat } from './autostop'
import { learnAbility, spendStat } from './progression'
import { masteryStage, practice, studyBook } from './skills'
import type { Surgery } from './surgery'
import { canHeatBlade, strainProjectiles, treatmentArm, type Procedure } from './medical'
import { attemptFirearm, firearmAmmo, firearmCareStep, firearmShock, magazineReloadStep, startFirearmCare } from './firearms'
import { finishReload, projectileFletching, projectileReady, spendProjectile, startReload } from './ranged'
import { throwAtCreature } from './throwing'
import { bowProblem } from './gear-state'
import { bowStringBreaks, gearCareStep, startGearCare, type GearCare } from './gear-care'
import { beddingMapKey,packBedding } from './camping'
import {isWaterVessel,waterCapacity,waterVessel,waterVesselForm} from './water-vessels'
import {putOutBeddingFire} from './bedding-fire'
import {startBeddingWash,beddingWashStep} from './bedding-lice'
import { cookingQualityBase,collectBatch, finishGather, startCraft, startGather, startMaintenance, workStep } from './crafting'
import { fireWarmth } from './thermal'
import { addEffect, traitAdd, traitMul, traitOverride } from './traits'
import type { Creature, HotbarRef, ItemInst, Slot, Stats, WaterTreatment, ProstheticOperation, MaterialSelection } from './types'

export type Action =
  | {type:'worldRaidLoot'}
  | {type:'rescueWater';target:number}
  | {type:'beaconFuel';pos:Pos;uid:number;fuelUid:number}
  | {type:'beaconSend';pos:Pos;uid:number;to:import('./types').BeaconAddress;rumorKey:string}
  | {type:'beaconRead';pos:Pos;uid:number}
  | {type:'retire';target:number;expectedSavings?:number}
  | {type:'discloseEvidence';target:number;rule:string}
  | {type:'deviceWork';pos:Pos;uid:number;operation:string}
  | {type:'deviceCancel';pos:Pos;uid:number}
  | {type:'machineHaul';target?:number;uid?:number}
  | {type:'machineCare';target:number;operation:import('./types').MachineOperation;uid:number;woundId?:number;part?:string}
  | {type:'fireWork';pos:Pos;uid:number;baseOrder?:number}
  | {type:'extinguishFire';pos:Pos}
  | {type:'baseBed';pos:Pos;target?:number}
  | {type:'baseWaterTake';uid:number}
  | {type:'baseWaterFill';uid:number;pos:Pos}
  | {type:'baseWaterTreat';uid:number;method:WaterTreatment}
  | {type:'basePickup';uid:number}
  | {type:'baseGather';pos:Pos}
  | {type:'baseRaidLoot'}
  | {type:'claimBase';pos:Pos}
  | {type:'baseOpen'}
  | {type:'baseAssign';target:number;kind:'craft'|'guard'|'haul'|'gather'|'water'|'fire'|'cancel';recipe?:string;batches?:number;item?:string;firePos?:Pos}
  | {type:'baseTransfer';direction:'take'|'put';uid:number;count?:number}
  | {type:'baseCraft'}
  | { type:'recruitPrisoner';target:number }
  | { type:'inviteRecruit';target:number }
  | { type:'dropLeash' }
  | { type:'struggle' }
  | { type: 'clinicSupply'; target: number }
  | { type: 'rentBed'; target: number; bed: string; expectedFee?: number;periods?:number }
  | { type: 'washHands' }
  | { type:'residentCropSupply';target:number }
  | { type:'residentProduce';target:number }
  | { type:'giveResidentSeed';target:number;uid:number }
  | { type: 'residentPlotCheck' }
  | { type: 'residentRation' }
  | { type: 'residentFuel' }
  | { type:'residentVessel';target:number }
  | { type: 'warmByFire' }
  | { type: 'lesson'; target: number; expectedFee?: number }
  | { type: 'clinic'; target: number; request: ClinicRequest; expectedFee?: number }
  | { type: 'dissect'; target: number }
  | { type: 'taste'; uid: number }
  | { type: 'medicate'; uid: number; woundId: number }
  | { type: 'talk'; target: number }
  | { type: 'bargain'; target: number }
  | { type:'bountyAccept';target:number;offer:string;expectedReward?:number }
  | { type:'bountyReport';target:number;contract:string;expectedReward?:number }
  | { type:'bountySurvey';contract:string }
  | {type:'companionRecoveryAssign';target:number;contract:string}
  | {type:'companionRecoveryStop';target:number}
  | {type:'companionRecoveryCollect';target:number}
  | {type:'companionRecoveryFetch'}
  | {type:'companionRecoveryReturn'}
  | {type:'prisonerExchange';holder:number;person:number;given:number;receivedRope?:number;givenRope?:number}
  | {type:'ransom';holder:number;person:number;expectedPrice?:number}
  | {type:'npcAbductionPlan';target:number}
  | {type:'npcAbductionObserve';target:number}
  | {type:'npcAbductionEnd'}
  | {type:'rescueContractRemains';contract:string}
  | {type:'rescueContractAccept';target:number;offer:string;expectedReward?:number}
  | {type:'rescueContractReport';target:number;contract:string;expectedReward?:number}
  | {type:'recoveryAccept';target:number;offer:string;expectedReward?:number}
  | {type:'recoveryDeliver';target:number;contract:string;expectedReward?:number}
  | {type:'npcSocialTalk';target:number}
  | {type:'npcCare';target:number}
  | {type:'patrolContractAccept';target:number;offer:string;expectedReward?:number}
  | {type:'patrolContractReport';target:number;contract:string;expectedReward?:number}
  | {type:'patrolContractVisit';contract:string}
  | {type:'escortContractAccept';target:number;offer:string;expectedReward?:number}
  | {type:'escortContractReport';target:number;contract:string;expectedReward?:number}
  | {type:'escortContractVisit';contract:string}
  | {type:'excavationAccept';target:number;offer:string;expectedReward?:number}
  | {type:'excavationDeliver';target:number;contract:string;expectedReward?:number}
  | {type:'excavationWork';contract:string}
  | {type:'sourceContractAccept';target:number;offer:string;expectedReward?:number}
  | {type:'sourceContractReport';target:number;contract:string;expectedReward?:number}
  | {type:'sourceContractSurvey';contract:string}
  | {type:'bountyQuestion';target:number;contract:string}
  | { type:'investigationAccept';target:number;offer:string;expectedReward?:number }
  | { type:'investigationSurvey';contract:string }
  | { type:'investigationReport';target:number;contract:string;expectedReward?:number }
  | {type:'mapSurveyAccept';target:number;offer:string;expectedReward?:number}
  | {type:'mapSurveyDeliver';target:number;contract:string;paperUid:number;expectedReward?:number}
  | { type: 'contractAccept'; target:number; offer:string; expectedReward?:number }
  | { type: 'contractDeliver'; target:number; contract:string; lines:TradeLine[]; expectedReward?:number }
  | { type: 'contractCancel'; target:number; contract:string }
  | { type: 'trade'; target: number; buy: TradeLine[]; sell: TradeLine[]; expectedBalance?: number }
  | { type: 'travel'; target: Pos }
  | { type:'launchBoat';uid?:number }
  | { type:'removeParasite';parasite:number;method:'salt'|'manual';host?:number;saltUid?:number }
  | { type:'repairBoat' }
  | { type: 'enterRegion' }
  | { type:'feedPrisoner';target:number;uid:number }
  | { type:'wakePrisoner';target:number }
  | { type:'prisoner';target:number;operation:import('./types').PrisonerOperation;ropeUid?:number }
  | { type:'hireCompanion';target:number }
  | { type:'payCompanion';target:number }
  | { type:'dismissCompanion';target:number }
  | { type:'commandCompanion';target:number;order:import('./types').CompanionOrder }
  | { type:'giveCompanion';target:number;uid:number }
  | {type:'drawMap';paperUid:number;inkUid:number}
  | {type:'drawWorldMap';paperUid:number;inkUid:number}
  | {type:'buyNpcWorldMap';target:number;uid:number;expectedPrice?:number}
  | {type:'companionWorldMap';target:number;operation:'start'|'stop'|'cancel'|'collect';paperUid?:number;inkUid?:number}
  | {type:'worldMapSurveyAccept';target:number;offer:string;expectedReward?:number}
  | {type:'worldMapSurveyDeliver';target:number;contract:string;paperUid:number;expectedReward?:number}
  | {type:'cancelWorldMapDrawing'}
  | {type:'cancelMapDrawing'}
  | {type:'companionMap';target:number;operation:CompanionMapOperation;paperUid?:number;inkUid?:number}
  | {type:'postRumor';target:number;rumorId:string}
  | {type:'buyNpcMap';target:number;uid:number;expectedPrice:number}
  | {type:'requestMerchantMap';target:number}
  | {type:'surveyWorld'}
  | { type: 'stopActivity' }
  | { type: 'ignoreThreat'; target: number }
  | { type: 'smellWarnings'; enabled: boolean }
  | { type: 'move'; dir: number }
  | {type:'merchantIdentify';target:number;uid:number;expectedFee?:number}
  | { type: 'attack'; target: number;mode?:string }
  | { type: 'shoot'; target: number }
  | { type: 'firearmCare'; uid: number; operation: 'clean' | 'unjam' }
  | { type: 'reload'; uid: number }
  | { type:'refreshCropSubstrate';pos:Pos;uid:number }
  | { type: 'waterCrop'; pos:Pos; uid:number; ml:number }
  | { type: 'wait' }
  | { type: 'pray' }
  | { type: 'rest'; turns: number }
  | { type: 'sleep' }
  | { type: 'pickup'; uid?: number }
  | { type: 'drop'; uid: number }
  | { type: 'equip'; uid: number; slot?: Slot }
  | { type: 'unequip'; slot: Slot; dropAfter?:boolean; expectedUid?:number }
  | { type: 'moveItem'; uid: number; gx: number; gy: number; rot?: boolean }
  | { type: 'read'; uid: number }
  | {type:'readMarketMap';uid:number}
  | { type: 'cancelBoil' }
  | { type: 'cancelBrew' }
  | { type: 'prepareUnheatedMeal';id:string }
  | { type: 'stageCooking';uid:number;pos:Pos }
  | { type: 'takeCooking';uid:number }
  | { type: 'cook'; uid: number }
  | { type: 'dry' }
  | { type: 'craft'; id: string; materials?:MaterialSelection }
  | { type: 'repair' | 'salvage'; uid: number }
  | { type: 'cancelWork' }
  | { type: 'collectCraft'; id: number }
  | { type: 'gather'; pos: Pos }
  | { type: 'place'; uid: number; dir: number }
  | { type: 'packBedding'; pos: Pos }
  | {type:'putOutTerrainFire';pos:Pos}
  | {type:'putOutBeddingFire';pos:Pos}
  | {type:'washBedding';pos:Pos}
  | { type: 'packFurniture'; pos: Pos }
  | { type: 'gearCare'; uid: number; care: GearCare }
  | { type: 'splitItem'; uid: number; n: number; gx: number; gy: number; rot?: boolean }
  | { type: 'mergeItem'; uid: number; into: number; n?: number; freshnessApproval?:string }
  | { type: 'search'; includeEmpty?: boolean; pos?:Pos }
  | {type:'pryContainer';pos:Pos}
  | {type:'refillMask';uid:number;filterUid:number}
  | { type: 'lootTake'; uid: number }
  | { type: 'openBag'; uid: number }
  | { type: 'lootMoney'; target: number; expectedAmount?: number }
  | { type: 'lootAll' }
  | { type: 'lootPut'; uid: number; gx?: number; gy?: number; rot?: boolean }
  | { type: 'lootMove'; uid: number; gx: number; gy: number; rot?: boolean }
  | { type: 'lootClose' }
  | { type: 'procedure'; procedure: Procedure; woundId?: number; part?: string }
  | { type: 'treat'; uid: number; woundId?: number; limb?: string; procedure?: Surgery }
  | { type: 'consume'; uid: number }
  | {type:'openFood';uid:number}
  | {type:'gatherNeedles';pos:Pos}
  | {type:'brewTea';uid:number;leafUid?:number}
  | { type: 'press'; woundId: number }
  | { type: 'cauterize'; woundId: number }
  | { type: 'removeTourniquet'; limb: string }
  | { type: 'toggleLight'; uid: number }
  | { type: 'examine'; uid: number }
  | { type: 'drinkHere'; pos?: Pos }
  | { type: 'wash' }
  | { type: 'prosthetic'; operation: ProstheticOperation; part: string; uid?: number }
  | { type: 'waterTreatment'; uid: number; method: WaterTreatment }
  | { type: 'collectRain'; uid: number }
  | { type: 'collectSnow'; uid: number }
  | { type: 'eatSnow' }
  | { type: 'breakIce' }
  | { type: 'hygiene'; enabled: boolean }
  | { type: 'fillBottle'; uid: number; pos?: Pos }
  | { type: 'pourWater'; uid: number; targetUid: number; ml: number }
  | { type: 'throw'; uid: number; target: Pos }
  | { type: 'throwAttack'; uid: number; target: number }
  | { type: 'eatFloor' }
  | { type: 'stairs' }
  | { type: 'ability'; id: string; target?: number }
  | { type: 'spendStat'; stat: keyof Stats }
  | { type: 'learn'; id: string }
  | {type:'selectAmmo';uid:number}
  | {type:'clearAmmo'}
  | { type: 'hotbar'; index: number; ref: HotbarRef | null }
  | { type: 'leave' }
  | { type: 'shove'; dir: number }
  | { type: 'trip'|'disarm'; target:number }
  | { type: 'face'; dir: number }
  | { type: 'examineSelf' }
  | { type: 'closeDoor'; dir: number }
  | { type: 'attackMode' }
  | { type: 'toggleFire' }
  | { type: 'giveWater'; target: number }
  | { type: 'sortBag' }
  | { type: 'reactPolicy'; policy?: 'block' | 'parry' | 'none' }

export interface ActResult { ok: boolean; tu: number; msg?: string }

const FAIL = (msg: string): ActResult => ({ ok: false, tu: 0, msg })
const FREE: ActResult = { ok: true, tu: 0 }

function isPl(c: Creature) { return c.faction === 'player' }

/** 이동 = 1턴(01 §4). 잠행 2턴, 양다리 불구면 기어가기 2턴 */
export function moveTU(w: World, c: Creature, to: Pos): number {
  if(terrainAt(w,to).water==='deep'&&(!tileAt(w,to).icy||(tileAt(w,to).iceHoleUntil??0)>turnOf(w)))return 200
  if (regionPenalties(w, c).crawl) return 200
  return c.sneaking ? 200 : 100
}

/** 비틀거림% = clamp(0, 60, 왼다리 + 오른다리 + 지형 + 몸) (01 §5.2) */
export function stumbleChance(w: World, c: Creature, to: Pos): number {
  if(terrainAt(w,to).water==='deep'&&(!tileAt(w,to).icy||(tileAt(w,to).iceHoleUntil??0)>turnOf(w)))return 0
  if(machineRules(w,c))return Math.min(60,(1-capacity(w,c,'moving'))*30+(machineProtecting(w,c)?10:0)+(terrainAt(w,to).stumble??0))
  const pen = regionPenalties(w, c)
  if (pen.crawl) return 0
  // 포자 인간: 뿌리 내린 다리 고유 비틀거림 +10 (bestiary §18)
  let p = pen.stumble + (terrainAt(w, to).stumble ?? 0) + traitAdd(w, c, 'stumble')
  if (terrainAt(w, to).water === 'shallow' || terrainAt(w, to).id.includes('Mud')) p += traitAdd(w, c, 'waterStumble')
  if (tileAt(w, to).taint) p += 5 // 포자 바닥
  if (tileAt(w, to).blood > 20) p += 5
  const loss = bloodLoss(c)
  if (loss >= 0.3) p += 10
  else if (loss >= 0.15) p += 5
  if (painStage(painTotal(w, c)) >= 4) p += 5
  p += alcoholStage(w, c) * 5
  const cons = capacity(w, c, 'consciousness')
  if (cons < 0.5) p += 10
  if ((c.drowsyUntil ?? 0) > turnOf(w)) p += 5
  p += thirstBand(w, c).stumble
  p += fatigueBand(w,c).stumble
  p += c.needs.bodyTemp < 34 ? 15 : c.needs.bodyTemp < 35 ? 10 : 0
  if (p > 0) p += traitAdd(w, c, 'stumbleIfPositive')
  if (tileAt(w, to).icy && w.s.overworld) p += climateDef(w).iceStumble
  if (terrainAt(w, to).icy || tileAt(w, to).icy) p *= prostheticIceSlip(w, c)
  return Math.max(0, Math.min(60, Math.round(p)))
}

/** 주변의 아직 열지 않은 용기 */
export function adjacentContainer(w: World, c: Creature, includeOpened = false): Pos | undefined {
  for (const d of [{ x: 0, y: 0 }, ...DIRS]) {
    const p = { x: c.pos.x + d.x, y: c.pos.y + d.y }
    if (!inBounds(w, p)) continue
    if (terrainAt(w, p).container && (includeOpened || containerFresh(w, p))) return p
  }
  return undefined
}

/** 아직 안 뒤졌거나, 뒤진 뒤 다시 자랐다 (버섯 무리, D36) */
export function containerFresh(w: World, p: Pos): boolean {
  const t = tileAt(w, p)
  return !t.searched || (t.regrowAt !== undefined && turnOf(w) >= t.regrowAt)
}

function sleepingBlocked(w: World, c: Creature): string | null {
  for (const o of w.s.creatures) {
    if (o.alive && !o.asleep && !captivityGuard(w,c,o) && hostile(w, c, o) && o.ai.mode !== 'surrender' && cheb(o.pos, c.pos) <= 8 && hasLos(w, c.pos, o.pos)) return '적이 가까이 있다'
  }
  return null
}

/** 수색 기본 턴: 생존 숙달 −5%/단계(최대 −25%) (15 §9.3) */
export function searchBase(w: World, c: Creature, base: number): number {
  return Math.max(1, Math.ceil(base * (1 - 0.05 * masteryStage(w, c, 'survival')) - 1e-9))
}

/** 자동 정렬 순서 (13 §9): 범주 → 칸 수 내림차순 → 긴 변 → defId */
const CAT_ORDER = ['weapon', 'shield', 'apparel', 'medical', 'drug', 'food', 'drink', 'tool', 'ammo', 'misc']
export function sortForPacking(w: World, items: ItemInst[]): ItemInst[] {
  const key = (i: ItemInst) => {
    const d = itemDef(w, i)
    const [a, b] = d.size ?? [1, 1]
    return [CAT_ORDER.indexOf(d.category), -(a * b), -Math.max(a, b)]
  }
  return items.sort((x, y) => {
    const kx = key(x), ky = key(y)
    for (let i = 0; i < 3; i++) if (kx[i] !== ky[i]) return kx[i] - ky[i]
    return x.def < y.def ? -1 : x.def > y.def ? 1 : x.uid - y.uid
  })
}

/** 용기를 열어 내용물을 정한다 (전리품 표는 처음 열 때 한 번) */
export function openContainer(w: World, c: Creature, p: Pos) {
  if(containerLocked(w,p))return
  const t = tileAt(w, p)
  const terr = terrainAt(w, p)
  t.searched = true
  if (terr.regrowDays) t.regrowAt = turnOf(w) + terr.regrowDays * TURNS_PER_DAY
  if (!t.cont) {
    t.cont = { items: [], opened: true, kind: terr.id }
    const [gw, gh] = terr.lootGrid ?? [6, 4]
    const g: Grid = { items: t.cont.items, w: gw, h: gh }
    const loot = terr.container ? rollLoot(w, terr.container) : []
    // 서가 쪽지 하나는 반드시 아래층 방 위치 단서 (14 §5.1)
    if (terr.id === 'Terrain.Shelf' && w.s.map.kind === 'dungeon' && !w.s.map.noteGiven && w.s.map.depth < 3 && !loot.some((i) => i.def === 'Item.Note')) loot.push(makeItem(w, 'Item.Note'))
    for (const it of loot) if (itemDef(w, it).readable) writeNote(w, it, w.s.map, terr.id)
    for (const it of sortForPacking(w, loot)) gridAdd(w, g, it)
  }
  if(!t.cont.opened)for(const it of t.cont.items)ageLooseGear(w,it,p,true)
  t.cont.opened = true
  if (isPl(c)) w.s.loot = { pos: p, kind: 'cont' }
}

/** 주변 시체. 기본은 소지품만 검사하고, 수색 UI는 해부할 빈 사체도 연다. */
export function adjacentCorpse(w: World, c: Creature, unsearchedOnly = false, includeEmpty = false): Creature | undefined {
  return w.s.creatures.find((o) => !o.alive && o.id !== c.id && cheb(o.pos, c.pos) <= 1 && hasLos(w,c.pos,o.pos) && !diagonalBlocked(w,c.pos,o.pos.x-c.pos.x,o.pos.y-c.pos.y) && (!unsearchedOnly || !o.searched)
    && ((Number.isSafeInteger(o.money)&&(o.money??0)>0) || o.bag.length > 0 || Object.values(o.equip).some(Boolean) || includeEmpty && !o.dissected && !!bestiaryEntry(w,o.def)))
}

/** 현재 루팅 대상의 격자 (상자·석관·서가·보관함·시체 배낭). 바닥은 null */
export function lootGrid(w: World): Grid | null {
  const l = w.s.loot
  if (!l) return null
  if(l.kind==='bag'){
    const c=player(w),it=c.bag.find(it=>it.uid===l.id)??(c.equip.belt?.uid===l.id?c.equip.belt:undefined)??(c.equip.back?.uid===l.id?c.equip.back:undefined)
    const def=it&&!it.missingItem?itemDef(w,it):undefined,size=def&&(def.storage||(c.equip.belt===it||c.equip.back===it)&&!it!.half&&(it!.durability??100)>0?itemStorage(def):undefined)
    return it&&size&&it.contents?{items:it.contents,w:size[0],h:size[1]}:null
  }
  if (l.kind === 'corpse') {
    const o = w.s.creatures.find((x) => x.id === l.id)
    if (!o) return null
    const [gw, gh] = w.db.creature(o.def).bagSize ?? [4, 3]
    return { items: o.bag, w: gw, h: gh }
  }
  if (l.kind !== 'cont') return null
  if(containerLocked(w,l.pos))return null
  const t = tileAt(w, l.pos)
  const [gw, gh] = terrainAt(w, l.pos).lootGrid ?? [6, 4]
  t.cont ??= { items: [], opened: true, kind: terrainAt(w, l.pos).id }
  return { items: t.cont.items, w: gw, h: gh }
}
function witnessedLoot(w:World,c:Creature,uid:number){
  const target=w.s.loot
  if(target?.kind!=='cont')return false
  const rule=terrainAt(w,target.pos).lootCrime
  return !!rule&&witnessPropertyCrime(w,c,target.pos,`container:${w.s.overworld?.currentRegion??'local'}:${w.s.map.id}:${target.pos.x},${target.pos.y}`,uid,rule)
}

/** 시체의 장착 장비 (벗기기 = 그 장비 탈 턴) */
export function lootEquip(w: World): Creature | undefined {
  const l = w.s.loot
  return l?.kind === 'corpse' ? w.s.creatures.find((x) => x.id === l.id) : undefined
}

/** 현재 루팅 대상의 아이템 목록 */
export function lootItems(w: World): ItemInst[] | null {
  const l = w.s.loot
  if (!l) return null
  if (l.kind === 'floor') return tileAt(w, l.pos).items
  const g = lootGrid(w)
  if (!g) return null
  const o = lootEquip(w)
  return o ? [...g.items, ...Object.values(o.equip).filter((i): i is ItemInst => !!i)] : g.items
}

/** 루팅 대상에서 아이템 하나 꺼내기 (시체 장비면 벗긴다) */
function lootRemove(w: World, uid: number): ItemInst | undefined {
  const g = lootGrid(w)
  const l = w.s.loot
  if (l?.kind === 'floor') {
    const t = tileAt(w, l.pos)
    const it = t.items.find((i) => i.uid === uid)
    if (it) t.items = t.items.filter((i) => i !== it)
    return it
  }
  if (!g) return undefined
  const i = g.items.findIndex((x) => x.uid === uid)
  if (i >= 0) return g.items.splice(i, 1)[0]
  const o = lootEquip(w)
  if (o) for (const k of Object.keys(o.equip) as Slot[]) if (o.equip[k]?.uid === uid) { const it = o.equip[k]!; delete o.equip[k]; return it }
  return undefined
}

export function perform(w: World, c: Creature, a: Action): ActResult {
  if(!['drop','moveItem','lootPut','lootTake','lootMove'].includes(a.type)&&Object.entries(a).some(([key,value])=>(key==='uid'||key.endsWith('Uid'))&&typeof value==='number'&&!!findItem(c,value)?.missingItem))return FAIL('원래 정의를 복원해야 이 물품을 사용할 수 있다')
  const turn = turnOf(w)
  const r = rng(w, 'ai')
  if(machineRules(w,c)&&!machineReady(w,c)&&a.type!=='wait')return FAIL('전원이 없거나 셧다운 중이다')
  if(c.captivity&&!['wait','rest','sleep','stopActivity','struggle',...(c.captivity.anklesFree?['move']:[])].includes(a.type))return FAIL('포박되어 움직이거나 손을 쓸 수 없다')
  if (c.breakdown?.kind === 'catatonia' && a.type !== 'wait') return FAIL('몸이 굳어 움직일 수 없다. (정신붕괴: 긴장증)')
  if (c.breakdown?.kind === 'lie' && a.type === 'move') return FAIL('몸을 일으키고 싶지 않다. (정신붕괴: 드러눕기)')
  switch (a.type) {
    case 'mapSurveyAccept':{const trader=creatureById(w,a.target),error=trader?acceptMapSurvey(w,c,trader,a.offer,a.expectedReward):'상인을 찾을 수 없다';return error?FAIL(error):{ok:true,tu:100}}
    case 'mapSurveyDeliver':{const trader=creatureById(w,a.target),error=trader?deliverMapSurvey(w,c,trader,a.contract,a.paperUid,a.expectedReward):'상인을 찾을 수 없다';return error?FAIL(error):{ok:true,tu:100}}
    case 'worldRaidLoot': {const error=worldRaidLoot(w,c);return error?FAIL(error):{ok:true,tu:100}}
    case 'retire':{const keeper=creatureById(w,a.target);const error=keeper?retire(w,c,keeper,a.expectedSavings):'여관 주인을 찾을 수 없다';return error?FAIL(error):FREE}
    case 'discloseEvidence':{const error=startEvidence(w,c,a.target,a.rule);return error?FAIL(error):FREE}
    case 'deviceWork':{const error=startFieldDevice(w,c,a.pos,a.uid,a.operation);return error?FAIL(error):FREE}
    case 'deviceCancel':{const error=cancelFieldDevice(w,c,a.pos,a.uid);return error?FAIL(error):FREE}
    case 'machineHaul':{const error=machineHaul(w,c,a.target,a.uid);return error?FAIL(error):{ok:true,tu:100}}
    case 'machineCare':{const error=startMachineCare(w,c,a.target,a.operation,a.uid,a.woundId,a.part);return error?FAIL(error):FREE}
    case 'recruitPrisoner':case 'inviteRecruit': {const target=creatureById(w,a.target);const error=target?(a.type==='recruitPrisoner'?requestRecruitment(w,c,target):inviteRecruit(w,c,target)):'상대가 이곳에 없다';return error?FAIL(error):FREE}
    case 'dropLeash': {const error=letGoEscort(w,c);return error?FAIL(error):{ok:true,tu:100}}
    case 'struggle': {const error=startStruggle(w,c);return error?FAIL(error):FREE}
    case 'fireWork': {const error=startFireWork(w,c,a.pos,a.uid,a.baseOrder);return error?FAIL(error):FREE}
    case 'washBedding': {const error=startBeddingWash(w,c,a.pos);return error?FAIL(error):FREE}
    case 'putOutTerrainFire':{const error=extinguishTerrainFire(w,c,a.pos);return error?FAIL(error):{ok:true,tu:100}}
    case 'putOutBeddingFire': {const error=putOutBeddingFire(w,c,a.pos);return error?FAIL(error):{ok:true,tu:100}}
    case 'extinguishFire': {const error=extinguishCampfire(w,c,a.pos);return error?FAIL(error):{ok:true,tu:100}}
    case 'baseBed': {if(c.id!==w.s.playerId)return FAIL('직접 침구를 배정해야 한다');const tenant=a.target===undefined?undefined:creatureById(w,a.target);if(a.target!==undefined&&!tenant)return FAIL('곁의 동료가 없다');const q=baseBedQuote(w,a.pos,tenant),error=assignBaseBed(w,a.pos,tenant);return error?FAIL(error):{ok:true,tu:q.turns*100}}
    case 'baseWaterTake': {const error=takeBaseWaterBottle(w,c,a.uid);return error?FAIL(error):{ok:true,tu:100}}
    case 'baseWaterFill': {const error=fillBaseWater(w,c,a.uid,a.pos);return error?FAIL(error):{ok:true,tu:150}}
    case 'baseWaterTreat': {const error=treatBaseWater(w,c,a.uid,a.method);return error?FAIL(error):FREE}
    case 'basePickup': {const error=basePickup(w,c,a.uid);return error?FAIL(error):{ok:true,tu:baseLogisticsDef(w).pickupTurns*100}}
    case 'baseGather': {const error=startBaseGather(w,c,a.pos);return error?FAIL(error):FREE}
    case 'baseRaidLoot': {const error=lootBaseRaid(w,c);return error?FAIL(error):{ok:true,tu:100}}
    case 'claimBase': {const error=startClaimBase(w,c,a.pos);return error?FAIL(error):FREE}
    case 'baseOpen': {const error=openBaseStore(w,c);return error?FAIL(error):FREE}
    case 'baseTransfer': {const error=transferBase(w,c,a.direction,a.uid,a.count);return error?FAIL(error):{ok:true,tu:100}}
    case 'baseCraft': {const error=startBaseCraft(w,c);return error?FAIL(error):FREE}
    case 'baseAssign': {if(c.id!==w.s.playerId)return FAIL('직접 동료에게 지시해야 한다');const target=creatureById(w,a.target);const error=target?assignBaseTask(w,target,a.kind,a.recipe,a.batches,a.item,a.firePos):'곁의 동료가 없다';return error?FAIL(error):{ok:true,tu:100}}
    case 'feedPrisoner':case 'wakePrisoner':{const target=w.s.creatures.find((c)=>c.id===a.target);if(!target)return FAIL('돌볼 상대가 없다');return a.type==='feedPrisoner'?feedPrisoner(w,c,target,a.uid):wakePrisoner(w,c,target)}
    case 'prisoner': {const target=w.s.creatures.find((c)=>c.id===a.target);const error=target?startPrisonerAction(w,c,target,a.operation,a.ropeUid):'대상이 이곳에 없다';return error?FAIL(error):FREE}
    case 'warmByFire': {
      const error = startWarmth(w,c)
      return error ? FAIL(error) : FREE
    }
    case 'lesson': {
      const teacher = creatureById(w, a.target)
      if (!teacher) return FAIL('교사가 없다')
      const error = requestLesson(w, c, teacher, a.expectedFee)
      return error ? FAIL(error) : FREE
    }
    case 'residentVessel': {const target=w.s.creatures.find(c=>c.id===a.target);const error=target?acquireResidentVessel(w,c,target):'용기를 구할 상인이 없다';return error?FAIL(error):{ok:true,tu:100}}
    case 'residentFuel': {
      const error = takeResidentFuel(w, c)
      return error ? FAIL(error) : { ok: true, tu: 100 }
    }
    case 'residentCropSupply':{const target=creatureById(w,a.target);const error=target?obtainResidentCropSupply(w,c,target):'재배 재료를 구할 실제 상인이 곁에 없다';return error?FAIL(error):{ok:true,tu:100}}
    case 'residentProduce':{const target=creatureById(w,a.target);const error=target?offerResidentProduce(w,c,target):'수확물을 옮길 상인이 곁에 없다';return error?FAIL(error):{ok:true,tu:100}}
    case 'giveResidentSeed':{const target=creatureById(w,a.target);const error=target?giveResidentSeed(w,c,target,a.uid):'종자를 받을 주민이 곁에 없다';return error?FAIL(error):{ok:true,tu:100}}
    case 'residentPlotCheck':{const error=forgetResidentPlot(w,c);return error?FAIL(error):{ok:true,tu:100}}
    case 'residentRation': {
      const error = takeResidentRation(w, c)
      return error ? FAIL(error) : { ok: true, tu: 100 }
    }
    case 'clinicSupply': {
      if (c.id === w.s.playerId) return FAIL('의사의 재보급 행동이다')
      const trader = creatureById(w, a.target)
      if (trader) buyClinicSupplies(w, c, trader)
      return { ok: true, tu: 100 }
    }
    case 'rentBed': {
      const keeper = creatureById(w, a.target)
      if (!keeper) return FAIL('침대 주인을 찾을 수 없다')
      const err = rentInnBed(w, c, keeper, a.bed, a.expectedFee,a.periods)
      return err ? FAIL(err) : { ok: true, tu: 100 }
    }
    case 'clinic': {
      const doctor = creatureById(w, a.target)
      if (!doctor) return FAIL('진료할 사람이 없다')
      const error = requestClinic(w, c, doctor, a.request, a.expectedFee)
      return error ? FAIL(error) : FREE
    }
    case 'bountyQuestion':{const target=creatureById(w,a.target),error=target?questionBounty(w,c,target,a.contract):'당사자를 찾을 수 없다';return error?FAIL(error):{ok:true,tu:100}}
    case 'companionRecoveryAssign':
    case 'companionRecoveryStop':
    case 'companionRecoveryCollect':{if(c!==player(w))return FAIL('내 동료에게만 지시할 수 있다');const target=creatureById(w,a.target);if(!target)return FAIL('동료가 곁에 없다');const error=a.type==='companionRecoveryAssign'?assignCompanionRecovery(w,target,a.contract):a.type==='companionRecoveryStop'?stopCompanionRecovery(w,target):collectRecoveryCargo(w,target);return error?FAIL(error):{ok:true,tu:100}}
    case 'companionRecoveryFetch':{const error=companionRecoveryFetch(w,c);return error?FAIL(error):{ok:true,tu:c.activity?0:100}}
    case 'companionRecoveryReturn':{const error=companionRecoveryReturn(w,c);return error?FAIL(error):{ok:true,tu:100}}
    case 'prisonerExchange':{const error=startPrisonerExchange(w,c,a.holder,a.person,a.given,a.receivedRope,a.givenRope);return error?FAIL(error):FREE}
    case 'ransom':{const error=startRansom(w,c,a.holder,a.person,a.expectedPrice);return error?FAIL(error):FREE}
    case 'npcAbductionPlan':{const error=planNpcAbduction(w,c,a.target);return error?FAIL(error):{ok:true,tu:100}}
    case 'npcAbductionObserve':{const error=observeAbductionTarget(w,c,a.target);return error?FAIL(error):{ok:true,tu:100}}
    case 'npcAbductionEnd':{const error=finishNpcAbduction(w,c);return error?FAIL(error):{ok:true,tu:100}}
    case 'rescueContractRemains':{const q=rescueRemainsQuote(w,c,a.contract);if(q.error)return FAIL(q.error);const error=surveyRescueRemains(w,c,a.contract);return error?FAIL(error):{ok:true,tu:q.turns!*100}}
    case 'rescueContractAccept':
    case 'rescueContractReport':{const target=creatureById(w,a.target);if(!target)return FAIL('구조 의뢰 장부를 가진 사람이 없다');const error=a.type==='rescueContractAccept'?acceptRescue(w,c,target,a.offer,a.expectedReward):reportRescue(w,c,target,a.contract,a.expectedReward);return error?FAIL(error):{ok:true,tu:100}}
    case 'recoveryAccept':
    case 'recoveryDeliver':{const target=creatureById(w,a.target);if(!target)return FAIL('회수 의뢰 장부를 가진 사람이 없다');const error=a.type==='recoveryAccept'?acceptRecovery(w,c,target,a.offer,a.expectedReward):deliverRecovery(w,c,target,a.contract,a.expectedReward);return error?FAIL(error):{ok:true,tu:100}}
    case 'excavationWork':{const error=startExcavation(w,c,a.contract);return error?FAIL(error):FREE}
    case 'excavationAccept':
    case 'excavationDeliver':{const target=creatureById(w,a.target);if(!target)return FAIL('발굴 의뢰인이 곁에 없다');const error=a.type==='excavationAccept'?acceptExcavation(w,c,target,a.offer,a.expectedReward):deliverExcavation(w,c,target,a.contract,a.expectedReward);return error?FAIL(error):{ok:true,tu:100}}
    case 'escortContractVisit':{const error=visitEscort(w,c,a.contract);return error?FAIL(error):{ok:true,tu:100}}
    case 'escortContractAccept':
    case 'escortContractReport':{const target=creatureById(w,a.target);if(!target)return FAIL('함께 걸을 의뢰인이 곁에 없다');const error=a.type==='escortContractAccept'?acceptEscort(w,c,target,a.offer,a.expectedReward):reportEscort(w,c,target,a.contract,a.expectedReward);return error?FAIL(error):{ok:true,tu:100}}
    case 'patrolContractVisit':{const error=visitPatrolContract(w,c,a.contract);return error?FAIL(error):{ok:true,tu:100}}
    case 'patrolContractAccept':
    case 'patrolContractReport':{const target=creatureById(w,a.target);if(!target)return FAIL('순찰 장부를 가진 사람이 없다');const error=a.type==='patrolContractAccept'?acceptPatrolContract(w,c,target,a.offer,a.expectedReward):reportPatrolContract(w,c,target,a.contract,a.expectedReward);return error?FAIL(error):{ok:true,tu:100}}
    case 'sourceContractSurvey':{const error=surveySourceContract(w,c,a.contract);return error?FAIL(error):{ok:true,tu:100}}
    case 'sourceContractAccept':
    case 'sourceContractReport':{const target=creatureById(w,a.target);if(!target)return FAIL('봉쇄 의뢰 장부를 가진 사람이 없다');const error=a.type==='sourceContractAccept'?acceptSourceContract(w,c,target,a.offer,a.expectedReward):reportSourceContract(w,c,target,a.contract,a.expectedReward);return error?FAIL(error):{ok:true,tu:100}}
    case 'bountySurvey': {const error=surveyBounty(w,c,a.contract);return error?FAIL(error):{ok:true,tu:100}}
    case 'bountyAccept':
    case 'bountyReport': {
      const target=creatureById(w,a.target);if(!target)return FAIL('토벌 계약 장부를 가진 사람이 없다')
      const error=a.type==='bountyAccept'?acceptBounty(w,c,target,a.offer,a.expectedReward):reportBounty(w,c,target,a.contract,a.expectedReward)
      return error?FAIL(error):{ok:true,tu:100}
    }
    case 'investigationSurvey': {
      const error=surveyInvestigation(w,c,a.contract)
      return error?FAIL(error):{ok:true,tu:100}
    }
    case 'investigationAccept':
    case 'investigationReport': {
      const target=creatureById(w,a.target)
      if(!target)return FAIL('조사 계약 장부를 가진 사람이 없다')
      const error=a.type==='investigationAccept'?acceptInvestigation(w,c,target,a.offer,a.expectedReward):reportInvestigation(w,c,target,a.contract,a.expectedReward)
      return error?FAIL(error):{ok:true,tu:100}
    }
    case 'contractAccept':
    case 'contractDeliver':
    case 'contractCancel': {
      const target=creatureById(w,a.target)
      if(!target)return FAIL('계약 장부를 가진 사람이 없다')
      const error=a.type==='contractAccept'?acceptSupply(w,c,target,a.offer,a.expectedReward):a.type==='contractDeliver'?deliverSupply(w,c,target,a.contract,a.lines,a.expectedReward):cancelSupply(w,c,target,a.contract)
      return error?FAIL(error):{ok:true,tu:100}
    }
    case 'merchantIdentify': {const target=creatureById(w,a.target);if(!target)return FAIL('상대가 여기에 없다');const error=appraisePill(w,c,target,a.uid,a.expectedFee);return error?FAIL(error):{ok:true,tu:100}}
    case 'npcCare':{const target=creatureById(w,a.target);if(!target)return FAIL('돌볼 이웃이 곁에 없다');const error=startNpcCare(w,c,target);return error?FAIL(error):FREE}
    case 'npcSocialTalk':{const target=creatureById(w,a.target);if(!target)return FAIL('대화 상대가 여기에 없다');const error=converseNpcs(w,c,target);return error?FAIL(error):{ok:true,tu:100}}
    case 'talk':
    case 'bargain':
    case 'trade': {
      const target = creatureById(w, a.target)
      if (!target) return FAIL('상대가 여기에 없다')
      const error = a.type === 'talk' ? talk(w, c, target) : a.type === 'bargain' ? bargain(w, c, target) : exchange(w, c, target, a.buy, a.sell, a.expectedBalance)
      return error ? FAIL(error) : { ok: true, tu: 100 }
    }
    case 'medicate': {
      const error = startTopical(w, c, a.uid, a.woundId, multiTurnFactor(w, c))
      return error ? FAIL(error) : { ok: true, tu: 0 }
    }
    case 'ignoreThreat': {
      const err = ignoreThreat(w, a.target)
      return err ? FAIL(err) : FREE
    }
    case 'smellWarnings':
      w.s.autoSmells = a.enabled
      return FREE
    case 'wait':
      c.rested = true
      return { ok: true, tu: 100 }

    case 'move': {
      const d = DIRS[a.dir]
      if (!d) return FAIL('방향 오류')
      const to = { x: c.pos.x + d.x, y: c.pos.y + d.y }
      if (!inBounds(w, to)) return FAIL(isPl(c) ? '더 갈 수 없다.' : '경계')
      const other = creatureAt(w, to)
      if (other) {
        if(c.leading?.target===other.id){const error=requestEscortYield(w,c,other);return error?FAIL(error):{ok:true,tu:100}}
        if (hostile(w, c, other) && other.ai.mode !== 'surrender') return perform(w, c, { type: 'attack', target: other.id })
        if (other.ai.mode === 'surrender' && isPl(c)) return FAIL(`${knownCreatureName(w,other)}은(는) 항복했다.`)
        return FAIL('길이 막혔다')
      }
      // 붙잡힘: 이동은 탈출 시도 (근력·민첩 대결)
      const held = c.effects.find((e) => e.kind === 'grabbed' && e.untilTurn > turn)
      if (held) {
        const g = creatureById(w, held.magnitude)
        if (g && g.alive && !g.unconscious && cheb(g.pos, c.pos) <= 1) {
          const ch = escapeChance(w, c, g)
          if (!r.chance(ch / 100)) {
            if (isPl(c)) log(w, 'warn', `${knownCreatureName(w,g)}에게 붙잡혀 빠져나가지 못했다. (탈출 ${ch}%)`)
            return { ok: true, tu: 100 }
          }
          if (isPl(c)) log(w, 'info', `${knownCreatureName(w,g)}의 손아귀를 뿌리쳤다.`)
        }
        c.effects = c.effects.filter((e) => e !== held)
      }
      const terr = terrainAt(w, to)
      if(machineRules(w,c)&&terr.water)return FAIL('기계는 물에 들어가지 않는다')
      if(machineRules(w,c)&&capacity(w,c,'moving')<=0)return FAIL('구동부가 작동하지 않는다')
      if (terr.water === 'deep' && c.traumas?.some((t) => t.def === 'Trauma.Water')) return FAIL('물 공포 때문에 깊은 물에 들어갈 수 없다')
      if (terr.door === 'closed') {
        if(terr.sealed)return FAIL('기계적으로 봉인된 문이다. 곁의 봉인 기구를 살펴야 한다')
        if(terr.keyItem&&!allItems(c).some(i=>i.def===terr.keyItem&&i.count>0))return FAIL(fixJosa(`${w.db.item(terr.keyItem).label}이(가) 필요하다`))
        tileAt(w, to).t = terr.openAs??'Terrain.DoorOpen'
        invalidateLights(w)
        emitNoise(w, to, c.sneaking ? 2 : 4, c.id)
        if (isPl(c)) log(w, 'info', '문을 열었다. 녹슨 경첩이 삐걱인다.')
        c.facing = a.dir
        return { ok: true, tu: 100 }
      }
      if (!terr.passable) return FAIL(`${terr.label}에 막혔다`)
      if (diagonalBlocked(w, c.pos, d.x, d.y)) return FAIL('모서리에 끼어 지나갈 수 없다')
      // 비틀거림 (01 §5.2): 다리 상태 + 지형 + 몸, 상한 60%. 양다리 불구면 기어간다(2턴, 판정 없음)
      const sp = stumbleChance(w, c, to)
      if (sp > 0 && r.chance(sp / 100)) {
        fx(w, { k: 'status', id: c.id, text: '휘청', color: '#e0b070', turn })
        if (isPl(c)) log(w, 'warn', `발이 꺾여 휘청였다. (비틀거림 ${sp}%)`)
        return { ok: true, tu: 100 }
      }
      const tu = moveTU(w, c, to)
      const from = { ...c.pos }
      c.pos = to
      learnTorchRetreat(w,c,from)
      attachParasites(w,c)
      machineAction(w,c,'move')
      traumaMove(w, c, from)
      c.facing = a.dir
      c.movedTurn = turn
      strainProjectiles(w, c)
      fx(w, { k: 'move', id: c.id, from, to, turn })
      // 걷기 소음: 맨몸 2와 입은 옷 중 가장 큰 값 하나 (13 §6.2)
      let noise = machineRules(w,c)?6:2
      for (const it of Object.values(c.equip)) if (it) noise = Math.max(noise, itemDef(w, it).apparel?.noise ?? 0)
      noise += prostheticNoise(w, c)
      noise *= terr.noiseMult ?? 1
      noise *= traitMul(w, c, 'noiseMult') * (c.sneaking ? 0.3 : 1)
      if (noise >= 2.5) emitNoise(w, to, Math.round(noise), c.id)
      worsenFractures(w, c, 'leg')
      spearWallReact(w, c)
      if (isPl(c)) {
        const t = tileAt(w, to)
        if (t.items.length) log(w, 'info', `여기에: ${t.items.map((i) => itemLabel(w, i)).join(', ')} (G 줍기 · 클릭으로 루팅 창)`)
        if (terr.stairs) log(w, 'info', terr.stairs === 'down' ? '내려가는 계단이다. (> 내려가기)' : '올라가는 계단이다. (< 올라가기)')
        w.s.loot = undefined
      }
      return { ok: true, tu }
    }

    case 'attack': {
      const t = creatureById(w, a.target)
      if (!t || !t.alive) return FAIL('대상이 없다')
      const wl = meleeWield(w, c,a.mode)
      if (!wl) return FAIL('두 팔을 다 쓸 수 없다')
      if (!canReach(w, c, t)) return FAIL('닿지 않는다')
      if (wl.atk.requiresCapacity && capacity(w, c, wl.atk.requiresCapacity) < 0.1) return FAIL('공격할 수 없는 상태다')
      if (c.needs.energy < wl.atk.energy && isPl(c)) log(w, 'warn', '기력이 바닥났다. 공격이 무디다.')
      if (t.ai.mode === 'surrender' && isPl(c)) c.history.push({ turn, kind: 'execute', text: `항복한 ${knownCreatureName(w,t)}을(를) 공격` })
      resolveAttack(w, c, t,{mode:a.mode})
      worsenFractures(w, c, wl.arm === 'larm' ? 'larm' : 'rarm')
      if(wl.twoHanded)worsenFractures(w,c,wl.arm==='larm'?'rarm':'larm')
      return { ok: true, tu: 100 }
    }

    case 'firearmCare': { const err=startFirearmCare(w,c,a.uid,a.operation,multiTurnFactor(w,c)); return err?FAIL(err):FREE }
    case 'reload': { const err = startReload(w, c, a.uid, multiTurnFactor(w, c)); return err ? FAIL(err) : FREE }

    case 'shoot': {
      const main = c.equip.main
      if (main) { const err = bowProblem(main, itemDef(w, main)); if (err) return FAIL(err) }
      const t = creatureById(w, a.target)
      const wl = wield(w, c)
      const mw = wl?.item
      if (!mw || !itemDef(w, mw).ranged) return FAIL(c.equip.main && itemDef(w, c.equip.main).ranged ? '활을 쥘 팔을 쓸 수 없다' : '원거리 무기가 없다')
      if (!t || !t.alive) return FAIL('대상이 없다')
      const rd = itemDef(w, mw).ranged!
      if (cheb(c.pos, t.pos) > rangedRange(w, c, t)) return FAIL('사거리 밖이다')
      if (!hasLos(w, c.pos, t.pos)) return FAIL('시야가 막혔다')
      if (!projectileReady(w, c, mw)) {
        if (rd.reloadTurns) { const err = startReload(w, c, mw.uid, multiTurnFactor(w, c)); return err ? FAIL(err) : FREE }
        return FAIL('화살이 없다')
      }
      if (capacity(w, c, 'manipulation') < 0.5) return FAIL('손이 성치 않아 시위를 당길 수 없다')
      if(rd.firearm){
        if(!canSee(w,c,t.pos)||(isPl(c)&&!w.s.visible.includes(t.pos.y*w.s.map.w+t.pos.x)))return FAIL('대상이 보이지 않는다')
        const result=attemptFirearm(w,c,mw)
        if(result==='fired'){resolveAttack(w,c,t,{ranged:true});firearmShock(w,c,mw)}
        worsenFractures(w,c,'rarm');if(itemDef(w,mw).twoHanded)worsenFractures(w,c,'larm')
        return {ok:true,tu:100}
      }
      if (bowStringBreaks(w, c)) return { ok: true, tu: 100 }
      const projectileDamaged=projectileFletching(w,c,mw)
      spendProjectile(w, c, mw)
      const res = resolveAttack(w, c, t, { ranged: true,projectileDamaged })
      recoverArrow(w, c, t, res.hit, res.woundId,projectileDamaged)
      return { ok: true, tu: 100 }
    }

    case 'trip':
    case 'disarm': {
      const result=combatManeuver(w,c,a.type,a.target)
      if(result.error)return FAIL(result.error)
      worsenFractures(w,c,result.arm!)
      if(result.twoHanded)worsenFractures(w,c,result.arm==='larm'?'rarm':'larm')
      if(a.type==='trip')worsenFractures(w,c,'leg')
      return {ok:true,tu:result.tu!}
    }

    case 'shove': {
      // 밀치기 (07 §7.2): 1턴, 기력 10. 성공하면 1칸, 벽이면 타격 5 + 넘어짐 25%
      const d = DIRS[a.dir]
      const t = d ? creatureAt(w, { x: c.pos.x + d.x, y: c.pos.y + d.y }) : undefined
      if (!t || !t.alive) return FAIL('밀칠 상대가 없다')
      if (c.needs.energy < 10) return FAIL('기력이 부족하다')
      c.needs.energy -= 10
      c.exerted = true
      c.facing = a.dir
      const ch = shoveChance(w, c, t)
      const roll = rng(w, 'combat').int(0, 99)
      const ok = roll < ch && w.db.creature(t.def).sizeClass !== 'huge'
      if (isPl(c) || isPl(t)) log(w, 'combat', `${isPl(c) ? '당신' : knownCreatureName(w,c)}이(가) ${isPl(t) ? '당신' : knownCreatureName(w,t)}을(를) 밀쳤다 — ${ok ? '밀려났다' : '버텼다'}.`, [`밀치기 ${ch}% (roll ${roll})`])
      t.ai.alertTurn = turn
      if (ok) pushBack(w, c, t, 1)
      return { ok: true, tu: 100 }
    }

    case 'face':
      c.facing = a.dir
      return { ok: true, tu: 100 }

    case 'examineSelf':
      // 자기 몸 살피기 (01 §4.1): 상처 상세·동맥·내출혈 징후 공개
      c.examinedAt = turn
      if (isPl(c)) log(w, 'info', '옷을 걷고 몸을 살핀다. (상처 창에 동맥·내출혈 징후가 표시된다)')
      return { ok: true, tu: 100 }

    case 'closeDoor': {
      const d = DIRS[a.dir]
      const p = d && { x: c.pos.x + d.x, y: c.pos.y + d.y }
      if (!p || !inBounds(w, p) || terrainAt(w, p).door !== 'open') return FAIL('닫을 문이 없다')
      if (creatureAt(w, p) || tileAt(w, p).items.length) return FAIL('문틀이 막혀 있다')
      tileAt(w, p).t = terrainAt(w,p).closeAs??'Terrain.DoorClosed'
      invalidateLights(w)
      emitNoise(w, p, c.sneaking ? 2 : 4, c.id)
      if (isPl(c)) log(w, 'info', '문을 닫았다.')
      return { ok: true, tu: 100 }
    }

    case 'sortBag': {
      // 자동 정렬 (13 §9): 쌓임 합치기 → 범주·칸 수·긴 변·defId 순 → 행 우선 첫 빈자리, 하나라도 안 들어가면 취소
      const before = c.bag.map((i) => ({ ...i }))
      const items = c.bag.filter((i) => i.gx !== undefined)
      const loose = c.bag.filter((i) => i.gx === undefined)
      c.bag = []
      let failed = false
      for (const it of sortForPacking(w, items.map((i) => ({ ...i, gx: undefined, gy: undefined, rot: undefined })))) {
        if (addToBag(w, c, it) > 0) { failed = true; break }
      }
      if (failed) {
        c.bag = before
        return FAIL('정렬하면 들어가지 않는다')
      }
      c.bag.push(...loose)
      return FREE
    }

    case 'reactPolicy': {
      const order: ('block' | 'parry' | 'none')[] = ['block', 'parry', 'none']
      c.reactPolicy = a.policy ?? order[(order.indexOf(c.reactPolicy ?? 'block') + 1) % 3]
      if (isPl(c)) log(w, 'info', `반응 정책: ${{ block: '막기 우선', parry: '받아넘기기 우선', none: '반응 안 함' }[c.reactPolicy]}`)
      return FREE
    }

    case 'giveWater': {
      // 말라붙은 자에게 물 주기: 1턴, 물 200ml → 30% 진정 (bestiary §19 L3)
      const t = creatureById(w, a.target)
      if (!t || !t.alive || cheb(t.pos, c.pos) > 1 || !w.db.creature(t.def).thirsty) return FAIL('물을 줄 상대가 없다')
      const bottle = c.bag.find((i) => itemDef(w, i).drink && !itemDef(w, i).drink!.alcohol && drinkVolume(w, i) >= 200 && !i.waterFrozen && suitableDrink(w, i))
      if (!bottle) return FAIL('줄 물이 없다')
      spendDrinkVolume(w, bottle, 200)
      if (r.chance(0.3)) {
        hydrate(w, t, 200, salineWaterLoss(w, waterQuality(w, bottle), 200))
        drinkContaminants(w, t, waterQuality(w, bottle), 200)
        t.ai.mode = 'calm'
        t.ai.target = undefined
        addThought(w, c, 'Thought.SharedWater')
        fx(w, { k: 'status', id: t.id, text: '진정', color: '#a0d0e0', turn })
        if (isPl(c)) log(w, 'good', `${knownCreatureName(w,t)}이(가) 물을 받아 마시고는 그 자리에 주저앉는다. 더는 덤비지 않는다.`)
      } else if (isPl(c)) log(w, 'info', `${knownCreatureName(w,t)}은(는) 물을 쏟아 버리고 다시 손을 뻗는다.`)
      return { ok: true, tu: 100 }
    }

    case 'pray': {
      if (!traitAdd(w, c, 'prayerRelief') && c.background !== 'Bg.Excommunicate') return FAIL('기도할 뜻이 서지 않는다')
      c.activity = { kind: 'pray', remaining: 200, total: 200, label: '장막에 기도' }
      return { ok: true, tu: 0 }
    }

    case 'toggleFire': {
      // 모닥불 끄기·켜기 1턴 (10 §3.3: 내려가기 전에 불을 끄면 위험 0)
      const L = w.s.map.lights.find((x) => x.kind === 'campfire' && cheb(x.pos, c.pos) <= 1)
      if (!L) return FAIL('곁에 모닥불이 없다')
      if(L.sourceUid!==undefined){const error=extinguishCampfire(w,c,L.pos);return error?FAIL(`${error}. F2에서 실제 땔감으로 점화해야 한다`):{ok:true,tu:100}}
      L.off = !L.off
      if (!L.off) traumaHandleFire(w, c)
      invalidateLights(w)
      if (isPl(c)) log(w, 'info', L.off ? '모닥불을 흙으로 덮어 껐다. 연기도 불빛도 없다.' : '모닥불에 다시 불을 붙였다. 따뜻하지만 멀리서 보인다.')
      return { ok: true, tu: 100 }
    }

    case 'attackMode': {
      // 공격 방식 바꾸기 (베기 ↔ 찌르기) = 자유 행동
      const wl = wield(w, c)
      const list = wl?.item ? itemDef(w, wl.item).attacks ?? [] : []
      if (list.length < 2) return FAIL('이 무기는 공격 방식이 하나뿐이다')
      if (c.freeActTurn === turn) return FAIL('자유 행동은 턴당 한 번')
      c.freeActTurn = turn
      const i = list.findIndex((x) => x.id === wl!.atk.id)
      c.attackMode = list[(i + 1) % list.length].id
      if (isPl(c)) log(w, 'info', `공격 방식: ${list[(i + 1) % list.length].label}`)
      return FREE
    }

    case 'ability': return useAbility(w, c, a.id, a.target)

    case 'rest':
      c.activity = { kind: 'rest', remaining: a.turns, label: '휴식' }
      return { ok: true, tu: 0 }

    case 'sleep': {
      const rental = innSleepError(w, c) ?? residentBedError(w, c)
      if (rental) return FAIL(rental)
      const why = sleepingBlocked(w, c)
      if (why) return FAIL(`잠들 수 없다: ${why}`)
      if (c.needs.fatigue < 15 && !(c.needs.sleepDebt ?? 0)) return FAIL('졸리지 않다')
      if (painStage(painTotal(w, c)) >= 5) return FAIL('너무 아파 잠들 수 없다')
      if (c.needs.bodyTemp < 35) return FAIL('너무 추워 잠들 수 없다. 몸부터 녹여야 한다')
      delete c.sleepObservation
      c.activity = { kind: 'sleep', remaining: 9600, label: '수면' }
      c.activity.woundCount = c.body.wounds.length
      const target = residentWakeTarget(w, c)
      if (target !== undefined) c.activity.wakeFatigue = target
      c.asleep = true
      if (isPl(c)) log(w, 'info', '눈을 감는다…')
      return { ok: true, tu: 0 }
    }

    case 'pickup': {
      const t = tileAt(w, c.pos)
      if (!t.items.length) return FAIL('주울 것이 없다')
      const items = a.uid !== undefined ? t.items.filter((i) => i.uid === a.uid) : [...t.items]
      const got: string[] = []
      let full = false
      for (const it of items) {
        const label = itemLabel(w, it)
        const left = addToBag(w, c, gearForPickup(w,it,c.pos))
        if (left === 0) { t.items = t.items.filter((i) => i.uid !== it.uid); got.push(label) }
        else { full = true; it.count = left }
      }
      if (isPl(c)) {
        if (got.length) log(w, 'info', `주웠다: ${got.join(', ')}`)
        if (full) log(w, 'warn', '배낭에 자리가 없다. 정리하거나 버려야 한다.')
      }
      return got.length ? { ok: true, tu: hostileAware(w, c) ? 100 : 0 } : FAIL('배낭에 자리가 없다')
    }

    case 'drop': {
      const slot=(Object.keys(c.equip)as Slot[]).find((slot)=>c.equip[slot]?.uid===a.uid)
      if(slot&&itemDef(w,c.equip[slot]!).apparel)return perform(w,c,{type:'unequip',slot,dropAfter:true})
      // 떨구기 = 자유 행동 (0턴, 턴당 1회)
      if (c.freeActTurn === turn) return FAIL('자유 행동은 턴당 한 번')
      const it = removeStack(c, a.uid)
      if (!it) return FAIL('없다')
      if(w.s.loot?.kind==='bag'&&w.s.loot.id===it.uid)w.s.loot=undefined
      c.freeActTurn = turn
      dropFragile(w,c,it,c.pos)
      tileAt(w, c.pos).items.push(it)
      return FREE
    }

    case 'equip': {
      const it = findItem(c, a.uid)
      if (!it) return FAIL('없다')
      const def = itemDef(w, it)
      if (def.light && !def.slot) return perform(w, c, { type: 'toggleLight', uid: a.uid })
      const equipmentError=equipError(w,c,a.uid,a.slot)
      if(equipmentError)return FAIL(equipmentError)
      if(gearSwapQuote(w,c,a.uid,a.slot).needed){const error=startGearSwap(w,c,a.uid,a.slot);return error?FAIL(error):FREE}
      // 착용 턴 (13 §6.1). 반쯤 걸친 옷은 남은 절반만
      const base = remainingGearWork(w,c,it,'equip',a.slot),gearPairUid=clothingPeer(w,c,it,a.slot)?.uid
      const turns = channelTurns(w,c,base)
      if(turns===null)return FAIL('몸 상태로는 장비를 입을 수 없다')
      if (turns <= 1) {
        const before=equipmentSnapshot(c),err = equip(w, c, a.uid, a.slot,false)
        if (err) return FAIL(err)
        finishClothingProgress(c,it,gearPairUid)
        runEquipmentWorkers(w,c,before)
        if (isPl(c)) log(w, 'info', `${def.label}을(를) ${def.apparel ? '입었다' : '들었다'}.`)
        return { ok: true, tu: 100 }
      }
      c.activity = { kind: 'equip', remaining: turns, total:turns, gearWork:base, gearPairUid, uid: a.uid, slot: a.slot, label: `${def.label} 입기` }
      return { ok: true, tu: 0 }
    }

    case 'unequip': {
      const it = c.equip[a.slot]
      if (!it) return FAIL('비어 있다')
      if(a.expectedUid!==undefined&&a.expectedUid!==it.uid)return FAIL('입고 있던 장비가 달라졌다')
      const def = itemDef(w, it)
      const base=remainingGearWork(w,c,it,'unequip',a.slot),gearPairUid=clothingPeer(w,c,it,a.slot)?.uid
      if(gearPairUid!==undefined&&!a.dropAfter){const error=unequipError(w,c,a.slot);if(error)return FAIL(error)}
      const turns = channelTurns(w,c,base)
      if(turns===null)return FAIL('몸 상태로는 장비를 벗을 수 없다')
      if (turns <= 1) {
        const err = finishUnequip(w,c,a.slot,it.uid,a.dropAfter)
        if (err) return FAIL(err)
        it.half = undefined;it.dressProgress=undefined
        return { ok: true, tu: 100 }
      }
      c.activity = { kind: 'unequip', remaining: turns, total:turns, gearWork:base, gearPairUid, dropAfter:a.dropAfter, woundCount:c.body.wounds.length, slot: a.slot, uid: it.uid, label: `${def.label} 벗기` }
      return { ok: true, tu: 0 }
    }

    case 'moveItem':
      return moveInBag(w, c, a.uid, a.gx, a.gy, a.rot) ? FREE : FAIL('그 자리에 들어가지 않는다')

    case 'readMarketMap':{const error=readMerchantMap(w,c,a.uid);return error?FAIL(error):{ok:true,tu:100}}
    case 'read': {
      // 쪽지 읽기 1턴 (06 §7.0): 소문 게시판에 오른다
      const it = findItem(c, a.uid)
      if (!it || !itemDef(w, it).readable) return FAIL('읽을 것이 없다')
      const book = itemDef(w, it).book
      if (book) {
        const literacy = c.literacy ?? (c.literate ? 2 : 0)
        if (literacy === 0 && !book.selfStudy) return FAIL('글을 읽을 수 없다')
        if (literacy < (book.literacyMin ?? 1) && !book.selfStudy) return FAIL('이 책을 읽기에는 문해가 부족하다')
        if (lightLevel(w, c.pos) >= 2) return FAIL('너무 어두워 읽을 수 없다')
        if (c.booksRead?.includes(it.def)) return FAIL('이미 읽은 책이다')
        if (!it.lostPages && Math.max(0, ...Object.values(it.wetness ?? {})) >= 50) {
          it.lostPages = Math.ceil((book.pages - (it.lostPages ?? 0) - (it.readPages ?? 0)) * 0.2)
          log(w, 'warn', `${it.lostPages}쪽의 글씨가 물에 번졌다.`)
        }
        const pageTurns = readingPageTurns(w,c)
        c.activity = { kind: 'read', remaining: Math.max(1, (book.pages - (it.lostPages ?? 0) - (it.readPages ?? 0)) * pageTurns - (it.readProgress ?? 0)), uid: it.uid, label: `${itemDef(w, it).label} 읽기` }
        return FREE
      }
      if (!it.note) return FAIL('글씨가 번져 알아볼 수 없다')
      const error=noteReadError(w,c,it);if(error)return FAIL(error)
      readNote(w, c, it)
      return { ok: true, tu: 100 }
    }

    case 'hygiene':
      w.s.hygieneEnabled = a.enabled
      if (!a.enabled) for (const target of [...w.s.creatures, ...Object.values(w.s.offCreatures).flat()]) { target.needs.hygiene = 70; target.effects = target.effects.filter((e) => e.kind !== 'lice') }
      return FREE
    case 'washHands': {
      const error = washHandsError(w, c)
      if (error) return FAIL(error)
      const n = channelTurns(w, c, handHygieneDef(w).washTurns)
      if (n === null) return FAIL('몸 상태 때문에 손을 씻을 수 없다')
      c.activity = { kind: 'washHands', remaining: n, total: n, label: '손 씻기' }
      return FREE
    }
    case 'wash': {
      if (!washSupply(w, c).available) return FAIL('물가에 서거나 씻을 물2L가 필요하다')
      const n = channelTurns(w, c, foodSafetyDef(w).washTurns)
      if (n === null) return FAIL('몸 상태 때문에 씻을 수 없다')
      c.activity = { kind: 'wash', remaining: n, total: n, label: '몸 씻기' }
      return FREE
    }

    case 'cancelBoil': cancelBoil(c);return FREE
    case 'cancelBrew': cancelBrew(c);return FREE
    case 'prepareUnheatedMeal': {const error=prepareUnheatedMeal(w,c,a.id);return error?FAIL(error):{ok:true,tu:100}}
    case 'stageCooking': {const error=stageCooking(w,c,a.uid,a.pos);return error?FAIL(error):{ok:true,tu:100}}
    case 'takeCooking': {const error=takeCooking(w,c,a.uid);return error?FAIL(error):{ok:true,tu:100}}
    case 'cook': {
      const it = findItem(c, a.uid)
      const recipe = it && itemDef(w, it).cooking
      if (!it || !recipe) return FAIL('조리할 재료가 없다')
      if(itemDef(w,it).food?.emptyVessel)return FAIL('그릇은 실제 모닥불에 올려 끓여야 한다')
      if (fireWarmth(w, c) < 15) return FAIL('불에서 2칸 안으로 가야 한다')
      c.activity = { kind: 'cook', remaining: Math.max(1, recipe.turns - (it.cookProgress ?? 0)), uid: it.uid, label: '요리',cookQualityBase:cookingQualityBase(w,c) }
      return FREE
    }
    case 'worldMapSurveyAccept':{if(c.id!==w.s.playerId)return FAIL('내 정찰 계약만 맡을 수 있다');const target=creatureById(w,a.target);if(!target)return FAIL('상인이 없다');const error=acceptWorldMapSurvey(w,c,target,a.offer,a.expectedReward);return error?FAIL(error):{ok:true,tu:100}}
    case 'worldMapSurveyDeliver':{if(c.id!==w.s.playerId)return FAIL('내 정찰 지도만 납품할 수 있다');const target=creatureById(w,a.target);if(!target)return FAIL('상인이 없다');const error=deliverWorldMapSurvey(w,c,target,a.contract,a.paperUid,a.expectedReward);return error?FAIL(error):{ok:true,tu:100}}
    case 'companionWorldMap':{if(c.id!==w.s.playerId)return FAIL('내 동료에게 직접 부탁해야 한다');const target=creatureById(w,a.target);if(!target)return FAIL('동료가 없다');const error=commandCompanionWorldMap(w,target,a.operation,a.paperUid,a.inkUid);return error?FAIL(error):{ok:true,tu:100}}
    case 'buyNpcWorldMap':{const target=creatureById(w,a.target);if(!target)return FAIL('상대가 없다');const error=buyNpcWorldMap(w,c,target,a.uid,a.expectedPrice);return error?FAIL(error):{ok:true,tu:100}}
    case 'drawWorldMap':{const error=startWorldMapDrawing(w,c,a.paperUid,a.inkUid,multiTurnFactor(w,c));return error?FAIL(error):FREE}
    case 'cancelWorldMapDrawing':{if(c.id!==w.s.playerId)return FAIL('내 지도 작업만 취소할 수 있다');const error=cancelWorldMapDrawing(c);return error?FAIL(error):FREE}
    case 'drawMap':{const error=startMapDrawing(w,c,a.paperUid,a.inkUid,multiTurnFactor(w,c));return error?FAIL(error):FREE}
    case 'cancelMapDrawing':{const error=cancelMapDrawing(c);return error?FAIL(error):FREE}
    case 'postRumor':{if(c.id!==w.s.playerId)return FAIL('직접 소식을 전해야 한다');const target=creatureById(w,a.target),error=target?postRumor(w,c,target,a.rumorId):'곁에 주민이 없다';return error?FAIL(error):{ok:true,tu:100}}
    case 'buyNpcMap':{if(c.id!==w.s.playerId)return FAIL('직접 지도를 사야 한다');const target=creatureById(w,a.target),error=target?buyNpcMap(w,c,target,a.uid,a.expectedPrice):'곁에 사람이 없다';return error?FAIL(error):{ok:true,tu:100}}
    case 'requestMerchantMap':{if(c.id!==w.s.playerId)return FAIL('직접 상인에게 부탁해야 한다');const target=creatureById(w,a.target),error=target?requestMerchantMap(w,c,target):'곁에 상인이 없다';return error?FAIL(error):{ok:true,tu:100}}
    case 'surveyWorld':{if(c.id!==w.s.playerId)return FAIL('직접 주변을 살펴야 한다');const error=surveyWorld(w);return error?FAIL(error):{ok:true,tu:100}}
    case 'companionMap':{if(c.id!==w.s.playerId)return FAIL('동료에게 부탁하는 행동이다');const target=creatureById(w,a.target),error=target?commandCompanionMap(w,target,a.operation,a.paperUid,a.inkUid):'곁에 동료가 없다';return error?FAIL(error):{ok:true,tu:100}}
    case 'craft': {
      const err = startCraft(w, c, a.id, multiTurnFactor(w, c),a.materials)
      return err ? FAIL(err) : FREE
    }
    case 'repair': case 'salvage': {
      const err = startMaintenance(w, c, a.type, a.uid, multiTurnFactor(w, c))
      return err ? FAIL(err) : FREE
    }
    case 'collectCraft': {
      const err = collectBatch(w, c, a.id)
      return err ? FAIL(err) : { ok: true, tu: 100 }
    }
    case 'cancelWork':
      if (c.activity && ['craft', 'repair', 'salvage'].includes(c.activity.kind)) c.activity = undefined
      c.workJob = undefined
      return FREE
    case 'gather': {
      const err = startGather(w, c, a.pos, multiTurnFactor(w, c, { dexterous: false }))
      return err ? FAIL(err) : FREE
    }
    case 'refillMask':{const error=startMaskRefill(w,c,a.uid,a.filterUid);return error?FAIL(error):FREE}
    case 'gearCare': {
      const err = startGearCare(w, c, a.uid, a.care, multiTurnFactor(w, c))
      return err ? FAIL(err) : FREE
    }
    case 'packFurniture': {
      const error=startFurniturePack(w,c,a.pos)
      return error?FAIL(error):FREE
    }
    case 'packBedding': {
      const err = packBedding(w, c, a.pos)
      return err ? FAIL(err) : { ok: true, tu: 100 }
    }
    case 'refreshCropSubstrate':{const q=cultivationSubstrateQuote(w,c,a.pos,a.uid);if(q.error)return FAIL(q.error);const error=refreshCultivationSubstrate(w,c,a.pos,a.uid);return error?FAIL(error):{ok:true,tu:q.rule!.turns*100}}
    case 'waterCrop':{const error=waterCultivation(w,c,a.pos,a.uid,a.ml);return error?FAIL(error):{ok:true,tu:100}}
    case 'place': {
      if(capacity(w,c,'manipulation')<.2)return FAIL('설치할 손을 쓸 수 없다')
      const it = findItem(c, a.uid), def = it && itemDef(w, it), dir = DIRS[a.dir]
      if (!it || !def?.place || !dir) return FAIL('설치할 물건이 없다')
      const p = { x: c.pos.x + dir.x, y: c.pos.y + dir.y }
      if (!inBounds(w, p) || !hasLos(w,c.pos,p) || diagonalBlocked(w,c.pos,dir.x,dir.y) || !terrainAt(w, p).passable || terrainAt(w, p).water || terrainAt(w, p).stairs || terrainAt(w, p).container || terrainAt(w, p).station || terrainAt(w, p).bedding || tileAt(w, p).placed || creatureAt(w, p) || tileAt(w, p).items.length) return FAIL('비어 있는 땅에 설치해야 한다')
      const destination=w.db.terrain(def.place),planted=destination.gather
      if(planted&&(destination.cultivation?.needsSoil!==false&&!terrainAt(w,p).soil||terrainAt(w,p).gather))return FAIL('비어 있는 흙에 심어야 한다')
      if(destination.cultivation){const error=cropStarterError(w,it);if(error)return FAIL(error)}
      const fertility=planted?.soilDependent?towerSoilFertility(w):1
      if(fertility<=0)return FAIL('탑의 살포가 멈춘 뒤 토양이 고갈되어 종자가 자랄 수 없다')
      const tile = tileAt(w, p),baseTerrain=tile.t
      if (w.db.terrain(def.place).bedding||w.db.terrain(def.place).container) tile.placed = { base: tile.t, item: { ...it, count: 1, gx: undefined, gy: undefined, rot: undefined }, owner: w.db.terrain(def.place).bedding?.portable ? undefined : c.id }
      tile.t = def.place
      if(planted&&!plantCultivation(w,p,it.uid,c.id,it))tile.gatherAt=turn+Math.ceil(planted.regrowTurns/fertility)
      recordCampfirePlacement(w,c,it,p,baseTerrain)
      recordBeddingPlacement(w,c,it.uid,p)
      recordBaseBedPlacement(w,it.uid,p)
      removeOne(w, c, it.uid)
      if(tile.cultivation)recordResidentPlanting(w,c,p,it.uid)
      invalidateLights(w)
      if(isPl(c))log(w, 'info', planted&&tile.cultivation?`${w.db.terrain(def.place).label}에 종자를 심었다. 작물에 맞는 실제 빛·기온과 물이 있어야 자란다.`:planted?`${w.db.terrain(def.place).label}에 종자를 심었다. 수확까지 ${Math.ceil(planted.regrowTurns/fertility/1200)}시간이 걸린다.`:`${w.db.terrain(def.place).label}을(를) 설치했다.`)
      return { ok: true, tu: 100 }
    }
    case 'dry':
      if (fireWarmth(w, c) < 15) return FAIL('불에서 2칸 안으로 가야 한다')
      c.activity = { kind: 'dry', remaining: 200, label: '옷 말리기' }
      return FREE

    case 'splitItem':
      return splitInBag(w, c, a.uid, a.n, a.gx, a.gy, a.rot) ? FREE : FAIL('나눌 수 없다')

    case 'mergeItem': {
      const from = c.bag.find((i) => i.uid === a.uid), to = c.bag.find((i) => i.uid === a.into)
      if (!from || !to) return FAIL('없다')
      if(itemDef(w,from).food?.freshHours&&from.def===to.def){const error=mergeFood(w,c,a.uid,a.into,a.n,a.freshnessApproval);return error?FAIL(error):FREE}
      if (!canStack(from, to)) return FAIL(from.def === to.def ? '상태가 달라 쌓이지 않는다' : '같은 것만 쌓인다')
      return mergeInto(w, c.bag, from, to, a.n) > 0 ? FREE : FAIL('더 쌓을 수 없다')
    }

    case 'dissect': {
      const error=dissectionError(w,c,a.target);if(error)return FAIL(error)
      const turns=channelTurns(w,c,bestiaryDef(w).dissectTurns);if(turns===null)return FAIL('손을 쓸 수 없다')
      const err=startDissection(w,c,a.target,turns);return err?FAIL(err):FREE
    }
    case 'pryContainer': {const error=startContainerPry(w,c,a.pos);return error?FAIL(error):FREE}
    case 'search': {
      if(a.pos&&(!inBounds(w,a.pos)||cheb(c.pos,a.pos)>1||!hasLos(w,c.pos,a.pos)||!canSee(w,c,a.pos)||diagonalBlocked(w,c.pos,a.pos.x-c.pos.x,a.pos.y-c.pos.y)||!terrainAt(w,a.pos).container))return FAIL('보이는 상자 곁에서 수색해야 한다')
      // 시체 먼저 (첫 수색 2턴, 소음 2), 그다음 아직 안 뒤진 용기 → 이미 연 용기 (13 §8.1)
      // 안 뒤진 시체 먼저 (이웃에 시체가 여럿이면 이미 뒤진 것만 계속 여는 일이 없게)
      const corpse = a.pos?undefined:adjacentCorpse(w, c, true, a.includeEmpty) ?? adjacentCorpse(w, c, false, a.includeEmpty)
      const adjacent=adjacentContainer(w,c)
      if (corpse && (!adjacent||!canSearchContainer(w,c,adjacent))) {
        if (corpse.searched) { w.s.loot = { pos: { ...corpse.pos }, kind: 'corpse', id: corpse.id }; return FREE }
        const n = channelTurns(w, c, searchBase(w, c, 2), { dexterous: false })
        if (n === null) return FAIL('손이 말을 듣지 않는다')
        c.activity = { kind: 'search', remaining: n, total: n, target: { ...corpse.pos }, uid: corpse.id, label: `${knownCreatureName(w,corpse)}의 시체 뒤지기` }
        return { ok: true, tu: 0 }
      }
      const p = a.pos??adjacentContainer(w, c) ?? adjacentContainer(w, c, true)
      if (!p) return FAIL('뒤질 만한 것이 없다')
      if(containerLocked(w,p)){const error=startContainerPry(w,c,p);return error?FAIL(error):FREE}
      const t = tileAt(w, p)
      // 다시 자랐으면 새로 뒤진다 (남은 것은 썩어 흙이 됐다)
      if (t.searched && t.regrowAt !== undefined && turnOf(w) >= t.regrowAt) { t.searched = false; t.cont = undefined; t.regrowAt = undefined }
      const terr = terrainAt(w, p)
      if (t.searched && t.cont) {
        w.s.loot = { pos: p, kind: 'cont' }
        return FREE
      }
      if ((terr.openTurns ?? 1) === 0) {
        openContainer(w, c, p)
        return FREE
      }
      const n = channelTurns(w, c, searchBase(w, c, terr.openTurns ?? 1), { dexterous: false })
      if (n === null) return FAIL('손이 말을 듣지 않는다')
      c.activity = { kind: 'search', remaining: n, total: n, target: p, label: `${terr.label} 열기` }
      return { ok: true, tu: 0 }
    }

    case 'lootMoney': {
      const error=takeCorpseMoney(w,c,a.target,a.expectedAmount)
      return error?FAIL(error):{ok:true,tu:hostileAware(w,c)?100:0}
    }
    case 'openBag': {
      if(c.id!==w.s.playerId)return FAIL('자신의 배낭에서만 가방을 열 수 있다')
      const it=c.bag.find(it=>it.uid===a.uid)??(c.equip.belt?.uid===a.uid?c.equip.belt:undefined)??(c.equip.back?.uid===a.uid?c.equip.back:undefined)
      if(!it||it.missingItem||!itemStorage(itemDef(w,it)))return FAIL('열 수 있는 가방이 없다')
      if(itemDef(w,it).pocket&&(it!==c.equip.belt||it.half||(it.durability??100)<=0))return FAIL('허리띠를 온전히 착용해야 주머니를 쓸 수 있다')
      if(itemDef(w,it).quiver&&(it!==c.equip.back||it.half||(it.durability??100)<=0))return FAIL('화살통을 온전히 착용해야 안을 쓸 수 있다')
      it.contents??=[]
      w.s.loot={kind:'bag',id:it.uid,pos:{...c.pos}}
      return FREE
    }
    case 'lootTake': {
      const list = lootItems(w)
      const it = list?.find((i) => i.uid === a.uid)
      if (!list || !it) return FAIL('없다')
      // 시체가 입은 장비는 벗기는 데 그 장비의 탈 턴이 든다 (13 §8.1)
      const o = lootEquip(w)
      if (o && Object.values(o.equip).some((e) => e?.uid === it.uid)) {
        if (!findSpot(w, c, itemDef(w, it))) return FAIL('배낭에 자리가 없다')
        const n = channelTurns(w, c, itemDef(w, it).equipTurns?.[1] ?? 1, { equip: true })
        if (n === null) return FAIL('손이 말을 듣지 않는다')
        c.activity = { kind: 'strip', remaining: n, total: n, uid: it.uid, label: `${itemDef(w, it).label} 벗겨 내기` }
        return { ok: true, tu: 0 }
      }
      const taken=w.s.loot?.kind==='corpse'||w.s.loot?.kind==='bag'?structuredClone(it):gearForPickup(w,it,w.s.loot!.pos,w.s.loot?.kind==='cont'&&!tileAt(w,w.s.loot.pos).cont?.opened)
      const left = addToBag(w, c, { ...taken, gx: undefined, gy: undefined, rot: undefined })
      if (left === it.count) return FAIL('배낭에 자리가 없다')
      const observed=witnessedLoot(w,c,it.uid)
      if (left === 0) lootRemove(w, it.uid)
      else it.count = left
      // 꺼내기·옮기기 0턴, 적이 나를 알아챈 동안은 1회당 1턴 (13 §8.3)
      return { ok: true, tu: hostileAware(w, c)||observed ? 100 : 0 }
    }

    case 'lootAll': {
      // 모두 가져가기 = 자동 정렬 순서로 들어가는 것만, 장착 장비는 빼고 (13 §8.2)
      const g = lootGrid(w)
      const list = g ? g.items : w.s.loot?.kind === 'floor' ? tileAt(w, w.s.loot.pos).items : null
      const coins=corpseMoneyQuote(w,c)
      if ((!list || !list.length) && (coins.error || !coins.amount)) return FAIL('가져갈 것이 없다')
      let took = 0,observed=false
      for (const it of sortForPacking(w, [...(list??[])])) {
        const taken=w.s.loot?.kind==='corpse'||w.s.loot?.kind==='bag'?structuredClone(it):gearForPickup(w,it,w.s.loot!.pos,w.s.loot?.kind==='cont'&&!tileAt(w,w.s.loot.pos).cont?.opened)
        const left = addToBag(w, c, { ...taken, gx: undefined, gy: undefined, rot: undefined })
        if(left<it.count){took++;observed=witnessedLoot(w,c,it.uid)||observed}
        if (left === 0) { lootRemove(w, it.uid) }
        else it.count = left
      }
      if(!coins.error&&coins.amount&&!takeCorpseMoney(w,c,coins.id!,coins.amount))took++
      if (!took) return FAIL('배낭에 자리가 없다')
      const remaining=g?.items??(w.s.loot?.kind==='floor'?tileAt(w,w.s.loot.pos).items:[])
      if (remaining.length && isPl(c)) log(w, 'warn', '배낭이 가득 차 다 가져가지 못했다.')
      return { ok: true, tu: hostileAware(w, c)||observed ? 100 : 0 }
    }

    case 'lootPut': {
      if(Object.values(c.equip).some((it)=>it?.uid===a.uid&&itemDef(w,it).apparel))return FAIL('입은 장비를 먼저 벗어야 한다')
      if(w.s.loot?.kind==='cont'&&containerLocked(w,w.s.loot.pos))return FAIL('잠긴 상자에는 넣을 수 없다')
      const g = lootGrid(w)
      const held = findItem(c, a.uid)
      if (!held) return FAIL('없다')
      if(w.s.loot?.kind==='bag'){
        if(!g)return FAIL('열었던 가방이 배낭에 없다')
        if(held.uid===w.s.loot.id||held.contents||itemStorage(itemDef(w,held)))return FAIL('가방 안에 가방을 넣을 수 없다')
        if(held.lit)return FAIL('불을 끈 뒤 가방에 넣어야 한다')
        const back=c.equip.back
        if(back&&back.uid===w.s.loot.id){const quiver=itemDef(w,back).quiver;if(quiver&&!quiver.ammo.includes(held.missingItem?.def??held.def))return FAIL('화살통에는 지정된 화살만 넣을 수 있다')}
        const belt=c.equip.belt
        if(belt&&belt.uid===w.s.loot.id&&itemDef(w,belt).pocket){const d=itemDef(w,held);if(!d.food&&!d.drink&&!d.drug&&!d.medical&&!d.unidentified&&!d.refuel&&!w.db.all<import('./types').ItemDef>('Item').some(def=>def.ranged?.firearm?.oil===held.def))return FAIL('허리 주머니에는 소모품만 넣을 수 있다')}
      }
      if (w.s.loot?.kind === 'floor' || !g) {
        if (!w.s.loot) return FAIL('넣을 곳이 없다')
        const it = removeStack(c, a.uid)!
        dropFragile(w,c,it,w.s.loot.pos)
        tileAt(w, w.s.loot.pos).items.push(it)
        return FREE
      }
      const def = itemDef(w, held)
      const rot = a.rot ?? false
      if (a.gx !== undefined && a.gy !== undefined) {
        if (!gridFits(w, g, def, a.gx, a.gy, undefined, rot)) return FAIL('그 자리에 들어가지 않는다')
        const it = removeStack(c, a.uid)!
        Object.assign(it, { gx: a.gx, gy: a.gy, rot: rot || undefined })
        g.items.push(it)
        return FREE
      }
      if (!gridSpot(w, g, def)) return FAIL('자리가 없다')
      const it = removeStack(c, a.uid)!
      gridAdd(w, g, { ...it, gx: undefined, gy: undefined })
      return FREE
    }

    case 'lootMove': {
      const g = lootGrid(w)
      const it = g?.items.find((i) => i.uid === a.uid)
      if (!g || !it) return FAIL('없다')
      const r0 = a.rot ?? !!it.rot
      if (!gridFits(w, g, itemDef(w, it), a.gx, a.gy, it.uid, r0)) return FAIL('그 자리에 들어가지 않는다')
      Object.assign(it, { gx: a.gx, gy: a.gy, rot: r0 || undefined })
      return FREE
    }

    case 'lootClose':
      w.s.loot = undefined
      return FREE

    case 'procedure': return startProcedure(w, c, a.procedure, a.woundId, a.part)
    case 'treat': return startTreatment(w, c, a.uid, a.woundId, a.limb, a.procedure)

    case 'consume': return consume(w, c, a.uid)
    case 'brewTea': {const error=startBrew(w,c,a.uid,a.leafUid);return error?FAIL(error):FREE}
    case 'gatherNeedles': {const error=startNeedles(w,c,a.pos);return error?FAIL(error):FREE}
    case 'openFood': {const error=startOpenFood(w,c,a.uid);return error?FAIL(error):FREE}

    case 'press': {
      const wd = c.body.wounds.find((x) => x.id === a.woundId)
      if (!wd) return FAIL('상처가 없다')
      if (wd.internal) return FAIL('몸속 출혈은 누를 수 없다')
      if (capacity(w, c, 'manipulation') < 0.2) return FAIL('손을 쓸 수 없다')
      // 손 압박: 1턴 행동, 유지하는 동안 매 턴 (02 §12.2)
      if (wd.bleed > 0 || wd.artery) dirtyHands(w, c)
      c.body.pressing = wd.id
      c.activity = { kind: 'press', remaining: 20, woundId: wd.id, label: '상처 압박' }
      return { ok: true, tu: 100 }
    }

    case 'cauterize': {
      if (c.traumas?.some((t) => t.def === 'Trauma.Fire')) return FAIL('불 공포 때문에 자기 상처를 지질 수 없다')
      const wd = c.body.wounds.find((x) => x.id === a.woundId)
      if (!wd) return FAIL('상처가 없다')
      if (!canHeatBlade(w, c)) return FAIL('쓸 수 있는 칼날과 불이 필요하다 (켜진 등불이나 곁의 화로)')
      if (wd.internal) return FAIL('몸속 출혈은 지질 수 없다')
      // 인두 가열 20턴(보존, 1분에 25% 식음) + 시술 1턴 (01 §4.2)
      const heat = c.heat && turn - c.heat.at < 20 + 20 ? c.heat.done : 0
      const n = channelTurns(w, c, 20 - heat, { arm: treatmentArm(w, c, wd.part) })
      if (n === null) return FAIL('손이 말을 듣지 않아 할 수 없다')
      c.activity = { kind: 'treat', remaining: n + 1, woundId: wd.id, label: '칼날 달구기 → 소작', treat: 'cauterize', total: n + 1 }
      return { ok: true, tu: 0 }
    }

    case 'removeTourniquet': {
      if (c.body.tourniquets[a.limb] === undefined) return FAIL('지혈대가 없다')
      delete c.body.tourniquets[a.limb]
      if (c.body.nerveClock) delete c.body.nerveClock[a.limb]
      addToInventory(w, c, makeItem(w, 'Item.Tourniquet'))
      // 재관류 통증 +10 (02 §12.2)
      addEffect(c, 'reperfusion', turn + 30)
      if (isPl(c)) log(w, 'info', '지혈대를 풀었다. 피가 다시 돌며 욱신거린다.')
      return { ok: true, tu: 100 }
    }

    case 'toggleLight': {
      const it = findItem(c, a.uid)
      if (!it || !itemDef(w, it).light) return FAIL('켤 수 없다')
      if (!it.lit && (it.fuel ?? 0) <= 0) return FAIL('기름이 없다')
      it.lit = !it.lit
      if (it.lit && (itemDef(w, it).light?.warmth ?? 0) > 0) traumaHandleFire(w, c)
      invalidateLights(w)
      if (isPl(c)) log(w, 'info', it.lit ? '등불을 켰다. 주변이 밝아졌다. 멀리서도 보일 것이다.' : '등불을 껐다. 어둠이 내려앉는다.')
      return { ok: true, tu: 100 }
    }

    case 'taste': { const err = startTaste(w,c,a.uid); return err ? FAIL(err) : FREE }
    case 'examine': {
      const it = findItem(c, a.uid)
      if (!it) return FAIL('없다')
      const def = itemDef(w, it)
      if (def.relic) {
        if ((it.appraisal ?? 0) >= 2) return FAIL('이미 기능을 감정했다')
        c.activity = { kind: 'examine', remaining: 30, uid: it.uid, label: '유물 감정' }
        return FREE
      }
      if (!def.unidentified) return FAIL('살펴볼 필요가 없다')
      if (w.s.knowledge.pillKnown[it.def]) return FAIL('이미 아는 약이다')
      c.activity = { kind: 'examine', remaining: knowledgeDef(w).examineTurns, uid: it.uid, label: `${def.label} 감별` }
      return { ok: true, tu: 0 }
    }

    case 'drinkHere': {
      if (capacity(w, c, 'manipulation') < .2) return FAIL('물을 뜰 손을 쓸 수 없다')
      const source = nearbyWater(w, c, a.pos)
      if (!source) return FAIL('물이 없다')
      hydrate(w, c, 300, salineWaterLoss(w, source.quality, 300)); drinkContaminants(w, c, source.quality, 300)
      if (isPl(c)) log(w, 'info', `${source.quality.source ?? '물'}을(를) 손으로 떠 마셨다.`)
      return { ok: true, tu: 200 }
    }
    case 'eatSnow': { const error = eatSnow(w, c); return error ? FAIL(error) : { ok: true, tu: 100 } }
    case 'collectSnow': { const error = startSnow(w, c, a.uid); return error ? FAIL(error) : FREE }
    case 'breakIce': {
      const target = nearbyIce(w, c)
      if (!target || !w.s.overworld) return FAIL('깰 얼음이 없다')
      c.activity = { kind: 'breakIce', label: '얼음 깨기', remaining: climateDef(w).breakIceTurns, target }
      return FREE
    }
    case 'collectRain': {
      const it = findItem(c, a.uid)
      if (!it || !isWaterVessel(w,it)||it.count!==1) return FAIL('담을 실제 물 용기가 없다')
      if (!['ashrain', 'ashstorm'].includes(w.s.weather) || w.s.map.kind !== 'surface' || tileAt(w, c.pos).roof) return FAIL('지붕 없는 재비 속에서만 빗물을 받을 수 있다')
      const d = waterSafetyDef(w), q = d.sources.rain
      const ml=waterCapacity(w,it),unit=itemDef(w,it).drink!.water,form=waterVessel(w,it)!.dirty
      it.water = { ...q, ash: q.ash * (1 + rainAcidity(w) / 5) }; it.def=form;it.uses=ml/unit;delete it.waterSettlesAt;delete it.waterFrozen
      if (isPl(c)) log(w, 'info', '재비 빗물을 받았다. 끓여도 재 오염은 남는다.')
      return { ok: true, tu: 200 }
    }
    case 'prosthetic': {
      const factor = multiTurnFactor(w, c, { arm: treatmentArm(w, c, a.part) })
      if (!Number.isFinite(factor) || factor > 4) return FAIL('몸 상태 때문에 의수족을 처치할 수 없다')
      const err = startProsthetic(w, c, a.operation, a.part, a.uid, factor)
      return err ? FAIL(err) : FREE
    }
    case 'waterTreatment': {
      const factor = multiTurnFactor(w, c)
      if (!Number.isFinite(factor) || factor > 4) return FAIL('몸 상태 때문에 정수할 수 없다')
      const err = startWaterTreatment(w, c, a.uid, a.method, factor)
      return err ? FAIL(err) : { ok: true, tu: a.method === 'settle' ? 100 : 0 }
    }
    case 'pourWater': {const error=pourWater(w,c,a.uid,a.targetUid,a.ml);return error?FAIL(error):{ok:true,tu:100}}
    case 'fillBottle': {const error=fillWaterBottle(w,c,a.uid,a.pos);return error?FAIL(error):{ok:true,tu:150}}

    case 'throwAttack': {
      const result = throwAtCreature(w, c, a.uid, a.target)
      if(result.error)return FAIL(result.error)
      worsenFractures(w,c,result.arm!)
      if(result.twoHanded)worsenFractures(w,c,result.arm==='larm'?'rarm':'larm')
      return { ok: true, tu: 100 }
    }
    case 'throw': {
      const it = removeOne(w, c, a.uid)
      if (!it) return FAIL('없다')
      if (cheb(c.pos, a.target) > 6 || !hasLos(w, c.pos, a.target)) {
        addToInventory(w, c, it)
        return FAIL('너무 멀거나 보이지 않는다')
      }
      const t = inBounds(w, a.target) && terrainAt(w, a.target).passable ? a.target : c.pos
      tileAt(w, t).items.push(it)
      emitNoise(w, t, 3, c.id)
      if (isPl(c)) log(w, 'info', `${itemDef(w, it).label}을(를) 던졌다.`)
      return { ok: true, tu: 100 }
    }

    case 'eatFloor': {
      const t = tileAt(w, c.pos)
      const food = t.items.find((i) => itemDef(w, i).food?.raw)
      if (!food) return FAIL('먹을 것이 없다')
      if (food.count > 1) food.count--
      else t.items = t.items.filter((i) => i !== food)
      c.ai.hunger = Math.max(0, c.ai.hunger - 0.35)
      c.ai.morale = Math.min(w.db.creature(c.def).morale, c.ai.morale + 10)
      return { ok: true, tu: 400 }
    }

    case 'giveCompanion': {
      if(c.id!==w.s.playerId)return FAIL('고용주만 물품을 건넬 수 있다')
      const target=w.s.creatures.find((o)=>o.id===a.target)
      const error=target?giveCompanion(w,target,a.uid):'곁에 사람이 없다'
      return error?FAIL(error):{ok:true,tu:100}
    }
    case 'hireCompanion': case 'payCompanion': case 'dismissCompanion': case 'commandCompanion': {
      if(c.id!==w.s.playerId)return FAIL('고용주만 동료와 합의할 수 있다')
      const target=w.s.creatures.find((o)=>o.id===a.target)
      if(!target)return FAIL('곁에 사람이 없다')
      const error=a.type==='hireCompanion'?hireCompanion(w,target):a.type==='payCompanion'?payCompanion(w,target):a.type==='dismissCompanion'?dismissCompanion(w,target):commandCompanion(w,target,a.order)
      return error?FAIL(error):{ok:true,tu:100}
    }
    case 'stairs': {
      const terr = terrainAt(w, c.pos)
      if (!terr.stairs) return FAIL('계단 위에 있어야 한다')
      const link = w.s.map.links.find((l) => eq(l.pos, c.pos))
      if (!link) return FAIL('막혀 있다')
      const partyError=partyTransitionError(w,link.to)
      if(partyError)return FAIL(partyError)
      return { ok: true, tu: 100, msg: 'stairs' }
    }

    case 'spendStat': {
      const err = spendStat(c, a.stat)
      return err ? FAIL(err) : FREE
    }

    case 'learn': {
      const err = learnAbility(w, c, a.id)
      return err ? FAIL(err) : FREE
    }

    case 'selectAmmo': {
      const ammo=findItem(c,a.uid)
      if(!ammo||!supplyItems(c).includes(ammo)||itemDef(w,ammo).category!=='ammo'||ammo.missingItem||ammo.count<1)return FAIL('선택할 실제 탄약이 없다')
      const weapon=c.equip.main,rd=weapon&&itemDef(w,weapon).ranged
      if(rd&&rd.ammo!==ammo.def&&!(weapon&&firearmAmmo(w,weapon,ammo)))return FAIL('현재 원거리 무기에 맞지 않는 탄약이다')
      if(weapon?.loadedAmmo&&!!weapon.loadedAmmoFletching!==!!ammo.fletchingDamaged)return FAIL('이미 장전된 탄약의 깃 상태는 선택으로 바꿀 수 없다')
      const preference={def:ammo.def,fletchingDamaged:!!ammo.fletchingDamaged}
      if(c.ammoPreference?.def!==preference.def||c.ammoPreference.fletchingDamaged!==preference.fletchingDamaged){c.ammoPreference=preference;if(isPl(c))log(w,'info',`다음 사격 탄약: ${itemLabel(w,ammo)}.`)}
      return FREE
    }

    case 'clearAmmo': {delete c.ammoPreference;return FREE}

    case 'hotbar': {
      if(a.ref?.kind==='item'&&a.ref.fletchingDamaged!==undefined&&typeof a.ref.fletchingDamaged!=='boolean')return FAIL('탄약 상태 선택이 올바르지 않다')
      if (a.index < 0 || a.index >= c.hotbar.length) return FAIL('칸 오류')
      c.hotbar[a.index] = a.ref
      return FREE
    }

    case 'stopActivity': return FAIL('중단할 행동이 없다')
    case 'launchBoat': {const q=boatLaunchQuote(w,c,a.uid);if(q.error)return FAIL(q.error);const error=launchBoat(w,c,a.uid);return error?FAIL(error):{ok:true,tu:q.turns*100}}
    case 'rescueWater': {const error=startWaterRescue(w,c,a.target);return error?FAIL(error):FREE}
    case 'beaconFuel': {const error=startBeaconFuel(w,c,a.pos,a.uid,a.fuelUid);return error?FAIL(error):FREE}
    case 'beaconSend': {const error=startBeaconSignal(w,c,a.pos,a.uid,a.to,a.rumorKey);return error?FAIL(error):FREE}
    case 'beaconRead': {const error=readBeacon(w,c,a.pos,a.uid);return error?FAIL(error):{ok:true,tu:100}}
    case 'removeParasite': {const error=startParasiteRemoval(w,c,a.parasite,a.method,a.host,a.saltUid);return error?FAIL(error):FREE}
    case 'repairBoat': {if(c.id!==w.s.playerId)return FAIL('실제 선주가 선체를 확인해야 한다');const q=boatRepairQuote(w);if(q.error)return FAIL(q.error);const need=q.need!,bindings:{uid:number;def:string;count:number}[]=[];let left=need.count;for(const it of c.bag.filter(i=>i.def===need.item)){const take=Math.min(left,it.count);if(take){bindings.push({uid:it.uid,def:it.def,count:take});left-=take}if(!left)break}c.activity={kind:'boatCare',vesselRepairSignature:JSON.stringify(need),label:'선체 기우기',uid:w.s.map.vessel!.hull.uid,remaining:q.turns,total:q.turns,supplies:bindings};return FREE}
    case 'travel': { const err = startTravel(w, c, a.target); return err ? FAIL(err) : FREE }
    case 'enterRegion': {
      const m = w.s.overworld
      if (!m || m.currentRegion) return FAIL('이미 지역 안이다')
      if (!m.sites.some((site) => eq(site.cell, m.position))) return FAIL('이곳에는 들어갈 지역이 없다')
      if (m.travel && m.travel.segmentRemaining < m.travel.segmentTotal) return FAIL('이동 중인 칸을 먼저 지나야 한다')
      const partyError=regionPartyTransitionError(w,'site')
      if(partyError)return FAIL(partyError)
      return { ok: true, tu: 0, msg: 'enterRegion' }
    }
    case 'leave': {
      if (w.s.overworld && !w.s.overworld.currentRegion) return FAIL('이미 바깥길이다. 지도(M)에서 갈 곳을 고를 수 있다.')
      if (!w.s.map.exits.some((e) => eq(e, c.pos))) return FAIL('여기서는 떠날 수 없다. 남쪽 길 끝으로 가야 한다.')
      const partyError=regionPartyTransitionError(w,'road')
      if(partyError)return FAIL(partyError)
      return { ok: true, tu: 100, msg: 'leave' }
    }
  }
}

/** 부목 없는 골절에 하중: 금→단순 3%, 단순→복합 2%, 통증 +5 (02 §9) */
function worsenFractures(w: World, c: Creature, where: 'leg' | 'larm' | 'rarm') {
  const r = rng(w, 'body')
  for (const wd of c.body.wounds) {
    if (!wd.fracture || wd.splint || wd.fracture.progress >= 1) continue
    const reg = tryPart(w, c, wd.part)?.region
    if (where === 'leg' ? reg !== 'lleg' && reg !== 'rleg' : reg !== where) continue
    const g = wd.fracture.grade
    if (g === 'hairline' && r.int(0, 99) < 3) wd.fracture.grade = 'simple'
    else if (g === 'simple' && r.int(0, 99) < 2) { wd.fracture.grade = 'compound'; wd.bleed += wd.severity; wd.contam = Math.min(100, wd.contam + 30) }
    else continue
    if (isPl(c)) log(w, 'warn', `부러진 ${part(w, c, wd.part).label}에 힘을 싣자 뼈가 더 어긋난다. 부목이 필요하다.`)
  }
}

function consume(w:World,c:Creature,uid:number):ActResult{return consumeFor(w,c,c,uid)}
/** 먹이는 쪽의 실제 물품/손과 먹는 쪽의 몸을 분리한다. 자기 섭취도 같은 경로다. */
export function consumeFor(w:World,provider:Creature,c:Creature,uid:number):ActResult{
 const item=findItem(provider,uid),def=item&&itemDef(w,item),ref=def?.compWorker
 if(!item||!def||!ref)return consumeForCore(w,provider,c,uid)
 const before={count:item.count,uses:def.food?.servings?foodServings(w,item):item.uses??(def.drink?1:0),ml:!def.food&&def.drink?drinkVolume(w,item):0},result=consumeForCore(w,provider,c,uid)
 if(result.ok){
  const remaining=findItem(provider,uid)
  const uses=def.food?.servings?(remaining?.def===def.id?foodServings(w,remaining):0):remaining?.uses??0
  const countConsumed=Math.max(0,before.count-(remaining?.count??0))
  const usesConsumed=Math.max(0,Math.round((before.uses-uses)*1e6)/1e6)
  const mlConsumed=before.ml>0?Math.max(0,before.ml-(remaining?drinkVolume(w,remaining):0)):0
  if(countConsumed>0||usesConsumed>0||mlConsumed>0)runItemConsumptionWorker(w,ref,provider,c,{uid,item:def.id,countConsumed,usesConsumed,mlConsumed})
 }
 return result
}
function consumeForCore(w:World,provider:Creature,c:Creature,uid:number):ActResult{
  if(machineRules(w,c))return FAIL('기계에는 음식·식수·약을 먹일 수 없다')
  const it = findItem(provider, uid)
  if (!it) return FAIL('없다')
  if (it.waterFrozen) return FAIL('눈이나 얼음은 불에서 녹여야 한다')
  const def = itemDef(w, it)
  const turn = turnOf(w)
  if(provider!==c){
    if(!provider.alive||!c.alive||provider.asleep||c.asleep||provider.unconscious||c.unconscious||capacity(w,provider,'consciousness')<.5||capacity(w,c,'consciousness')<.5)return FAIL('깨어서 삼킬 수 있어야 한다')
    if(!w.s.creatures.includes(provider)||!w.s.creatures.includes(c)||cheb(provider.pos,c.pos)>1||!hasLos(w,provider.pos,c.pos)||!canSee(w,provider,c.pos)||diagonalBlocked(w,provider.pos,c.pos.x-provider.pos.x,c.pos.y-provider.pos.y))return FAIL('먹일 사람이 보이는 곁이어야 한다')
    if(capacity(w,provider,'manipulation')<.2||!supplyItems(provider).some((i)=>i.uid===uid))return FAIL('배낭의 물품을 건넬 손을 쓸 수 없다')
    if(!def.food&&(!def.drink||def.drink.alcohol))return FAIL('음식이나 술이 아닌 식수만 먹일 수 있다')
  }
  if (def.food && c.breakdown?.kind === 'fast') return FAIL('먹고 싶지 않다. (정신붕괴: 단식)')
  if(def.openFood){const error=startOpenFood(w,provider,uid,c.id);return error?FAIL(error):FREE}
  if (def.food) {
    // 일반 음식 한 회분. 밀봉 용기의 실제 개봉은 위의 별도 채널을 거친다.
    let tu=def.food.needsTool==='blade'?200:100
    if(def.food.needsTool==='blade'&&!hasBlade(w,provider))return FAIL('사용할 수 있는 칼이 필요하다')
    if (capacity(w, provider, 'manipulation') < 0.2) return FAIL('손을 쓸 수 없다')
    if(foodServings(w,it)<1)return FAIL('남아 있는 음식이 없다')
    if(it.foodWater)drinkContaminants(w,c,{...it.foodWater.quality,ash:0},it.foodWater.ml)
    nourish(w, c, foodKcal(w,it), def.food.protein, def.food.vitamin,{uid:it.uid,def:it.def})
    hydrate(w, c, def.food.water ?? 0, (def.food.thirst ?? 0)+(it.foodSaltGrams??0)*waterSafetyDef(w).saltFlushMlPerGram!)
    if(it.contaminantAsh)c.needs.ash=clamp(Math.round(((c.needs.ash??0)+it.contaminantAsh)*10000)/10000,0,100)
    if (def.food.dryTurns && !supplyItems(provider).some((i) => drinkVolume(w, i) >= 100 && !itemDef(w, i).drink?.alcohol && !i.waterFrozen && suitableDrink(w, i))) tu *= def.food.dryTurns
    if(it.foodBurnt&&cookingRules(w)){const d=cookingRules(w)!;addThought(w,c,d.thought,d.burnMood*traitMul(w,c,'tasteMoodMult'))}
    else if (def.food.raw) {
      addThought(w, c, 'Thought.AteRaw')
    } else {
      if ((it.foodQ ?? (it.quality !== undefined && it.quality >= 2 ? 45 : 25)) >= (traitOverride(w, c, 'fineMealQ') ?? 45)) addThought(w, c, 'Thought.FineMeal')
      else {if(def.food.plainThought)addThought(w,c,def.food.plainThought,w.db.thought(def.food.plainThought).mood*traitMul(w,c,'tasteMoodMult'));if(def.food.kcal>=500)addThought(w,c,'Thought.AteGood')}
    }
    const freshness=freshnessBand(w,it)
    if(freshness==='spoiled'||freshness==='rotten')addThought(w,c,'Thought.SpoiledFood',w.db.thought('Thought.SpoiledFood').mood*traitMul(w,c,'tasteMoodMult'))
    else if(freshness==='stale'&&traitOverride(w,c,'rawMood')!==0&&!traitOverride(w,c,'foodPoisonImmune'))addThought(w,c,'Thought.StaleFood',foodSafetyDef(w).staleMood*traitMul(w,c,'tasteMoodMult'))
    const heat=warmMealGain(w,it);if(heat>0){rememberLifeEvent(w,c,'warmMeal');if(c.needs.bodyTemp<def.food.warm!.maxBodyTemp)c.needs.bodyTemp=Math.min(def.food.warm!.maxBodyTemp,c.needs.bodyTemp+heat)}
    if(def.food.raw&&def.food.rawDisease&&def.food.rawDisease.chance>0)exposeDisease(w,c,def.food.rawDisease.def,def.food.rawDisease.chance,{kind:'실제 날고기 섭취',turn,itemUid:it.uid,foodDef:it.def},diseaseStream('food.'+c.id))
    const poisoned = foodPoison(w, c, it,provider)
    if (!poisoned && c.needs.kcal > 0) addThought(w, c, 'Thought.Fed')
    recordResidentUse(w, c, it.def, 1)
    consumeFoodServing(w,provider,it)
    if (isPl(c)) {
      log(w, 'info', `${def.label}을(를) 먹었다.`)
      c.history.push({ turn, kind: 'meal', text: def.label })
    }
    return { ok: true, tu:Math.ceil(tu*diseaseEatMultiplier(w,c)) }
  }
  if (def.drink) {
    if ((it.uses ?? 1) <= 0) return FAIL('비어 있다')
    const ml=def.drink.emptyVessel?Math.min(drinkVolume(w,it),def.drink.water):Math.round(def.drink.water*Math.min(1,it.uses??1)),dose=def.drink.emptyVessel?ml/def.drink.water:Math.min(1,it.uses??1)
    hydrate(w, c, ml, def.drink.alcohol ? 100 * dose : salineWaterLoss(w, waterQuality(w, it), ml))
    nourish(w, c, (def.drink.kcal ?? 0) * dose, (def.drink.protein ?? 0) * dose, (def.drink.vitamin ?? 0) * dose,{uid:it.uid,def:it.def})
    if (!def.drink.alcohol) drinkContaminants(w, c, waterQuality(w, it), ml)
    delete it.waterSettlesAt
    if (def.drink.alcohol) {
      const error = administerDrug(w, c, def.drug?.def ?? 'Drug.Alcohol', def.id)
      if (error) return FAIL(error)
      c.effects = c.effects.filter((e) => e.kind !== 'withdrawal')
    }
    if(def.drink.freshHours)foodPoison(w,c,it,provider)
    if(def.drink.emptyVessel)spendDrinkVolume(w,it,ml)
    else it.uses = Math.round(((it.uses ?? 1) - dose) * 1e6) / 1e6
    if (it.uses! <= 0) {
      if (def.drink.emptyVessel || isWaterVessel(w,it)) {
        if(def.drink.emptyVessel)it.def=def.drink.emptyVessel
        else waterVesselForm(w,it)
        it.uses = 0
        delete it.water
        if (isPl(c)) log(w, 'info', '병이 비었다. 물가에서 다시 채울 수 있다.')
      } else removeOne(w, provider, uid)
    }
    if (isPl(c)) log(w, 'info', `${def.label}을(를) 마셨다.${def.drink.alcohol ? ' 목이 타고 통증이 무뎌진다.' : ''}`)
    return { ok: true, tu: 100 }
  }
  if(provider!==c)return FAIL('먹일 수 없는 물품이다')
  if (def.drug) {
    const doseLabel = itemLabel(w, { ...it, count: 1 })
    if (def.drug.def) { const error = administerDrug(w, c, def.drug.def, def.id, 1, undefined, !def.relic || (it.appraisal ?? 0) >= 2); if (error) return FAIL(error) }
    else addEffect(c, def.drug.effect, turn + def.drug.durationTurns)
    removeOne(w, provider, uid)
    if (isPl(c)) log(w, 'info', `${doseLabel}을(를) 사용했다.`)
    fx(w, { k: 'status', id: c.id, text: doseLabel, color: '#a0d0a0', turn })
    return { ok: true, tu: 100 }
  }
  if (def.refuel) {
    // 손·허리에 든 등불도 (배낭 속만 찾던 버그)
    const lamp = [...Object.values(c.equip), ...c.bag].find((i): i is ItemInst => !!i && !!itemDef(w, i).light)
    if (!lamp) return FAIL('기름을 부을 등불이 없다')
    lamp.fuel = Math.min(itemDef(w, lamp).light!.fuelTurns, (lamp.fuel ?? 0) + def.refuel)
    removeOne(w, provider, uid)
    if (isPl(c)) log(w, 'info', '등불에 기름을 부었다.')
    return { ok: true, tu: 100 }
  }
  if (def.unidentified) {
    const error = usePill(w,c,it)
    if (error) return FAIL(error)
    return { ok: true, tu: 100 }
  }
  return FAIL('먹거나 마실 수 없다')
}

/** 활동(장시간 행동) 한 턴 진행. 반환: 완료 여부 */
function remainingGearWork(w:World,c:Creature,it:ItemInst,kind:'equip'|'unequip',target?:Slot):number{
  const base=clothingBaseTurns(w,c,it,kind,target),worn=Object.values(c.equip).some((i)=>i?.uid===it.uid)
  if(!it.half||!worn)return base
  const progress=it.dressProgress
  if(!progress||!Number.isFinite(progress.left)||progress.left<0)return base/2
  const original=progress.total??clothingBaseTurns(w,c,it,progress.kind,target)
  if(progress.left>original)return base/2
  return progress.kind===kind?(base===original?progress.left:progress.left*base/Math.max(original,1e-9)):base*(1-progress.left/Math.max(original,1e-9))
}

function finishUnequip(w:World,c:Creature,slot:Slot,uid:number|undefined,dropAfter=false):string|null{
  const it=c.equip[slot]
  if(!it||it.uid!==uid)return '벗으려던 장비가 달라졌다'
  if(!dropAfter)return unequip(w,c,slot)
  const before=equipmentSnapshot(c)
  for(const s of clothingRemoveSlots(c,slot)){const item=c.equip[s]!;delete c.equip[s];item.half=undefined;item.dressProgress=undefined;delete item.gx;delete item.gy;delete item.rot;tileAt(w,c.pos).items.push(item)}
  runEquipmentWorkers(w,c,before)
  if(isPl(c))log(w,'info',`${itemDef(w,it).label}을(를) 벗어 바닥에 놓았다.`)
  return null
}

export function activityStep(w: World, c: Creature): boolean {
  const act = c.activity
  if (!act) return true
  if(act.kind==='gearSwap')return gearSwapStep(w,c)
  if(!clothingPairPresent(w,c,act)){c.activity=undefined;return true}
  const error = externalTreatmentError(w, c, act)
  if (error) { if (act.patientId === w.s.playerId) log(w, 'warn', `진료 중단: ${error}.`); interruptTreat(w, c); c.activity = undefined; return true }
  recordTreatmentProgress(w, c, act)
  if((act.kind==='rest'||act.kind==='sleep')&&terrainAt(w,c.pos).bedding)c.beddingLying={map:beddingMapKey(w),pos:{...c.pos},until:turnOf(w)+1}
  act.remaining--
  act.elapsed = (act.elapsed ?? 0) + 1
  if(act.kind==='sleep'&&c.alive&&c.asleep&&!act.wokeBy){const bed=innBedAt(w,c.pos);if(bed?.lease?.tenant===c.id&&bed.lease.until>turnOf(w))rememberLifeEvent(w,c,'innSleep')}
  if (act.kind === 'examine') {
    const relic = findItem(c, act.uid ?? -1)
    if (relic && itemDef(w, relic).relic) {
      if (act.remaining <= 0) { appraiseRelic(w, c, relic); c.activity = undefined; return true }
      return false
    }
  }
  switch (act.kind) {
    case 'magazineReload':return magazineReloadStep(w,c)
    case 'firearmCare':return firearmCareStep(w,c)
    case 'pryContainer':return containerPryStep(w,c)
    case 'ransom':
    case 'ransomWait':return ransomStep(w,c)
    case 'brewTea':return brewStep(w,c)
    case 'gatherNeedles':return needlesStep(w,c)
    case 'openFood':{
      const result=openFoodStep(w,c)
      if(result.done&&result.uid!==undefined&&result.eatTarget!==undefined){
        c.activity={kind:'foodMeal',remaining:1,total:1,label:result.eatTarget===c.id?'딴 음식 먹기':'딴 음식 건네 먹이기',uid:result.uid,foodMealTarget:result.eatTarget,snap:act.snap,woundCount:c.body.wounds.length}
        return false
      }
      return result.done
    }
    case 'foodMeal':{
      if(act.remaining>0)return false
      c.activity=undefined
      const target=w.s.creatures.find(o=>o.id===act.foodMealTarget)
      const eaten=target&&c.alive&&!c.asleep&&!c.unconscious&&capacity(w,c,'consciousness')>=.5?consumeFor(w,c,target,act.uid!):FAIL('먹일 사람이 깨어서 곁에 있어야 한다')
      if(!eaten.ok&&c.id===w.s.playerId)log(w,'warn','용기는 열었지만 먹지 못했다: '+(eaten.msg??'상태를 확인해야 한다'))
      return true
    }
    case 'discloseEvidence':return evidenceStep(w,c)
    case 'deviceWork':return fieldDeviceStep(w,c)
    case 'machineCare':return machineCareStep(w,c)
    case 'claimBase':return claimBaseStep(w,c)
    case 'recruit':case 'recruitWait':return recruitmentStep(w,c)
    case 'recruitInvite':return recruitmentInviteStep(w,c)
    case 'struggle':return struggleStep(w,c)
    case 'prisoner':return prisonerStep(w,c)
    case 'washBedding': return beddingWashStep(w,c)
    case 'packFurniture': return furniturePackStep(w,c)
    case 'fire': return fireWorkStep(w,c)
    case 'warm': return warmthStep(w,c)
    case 'teach': case 'lessonWait': return lessonStep(w, c)
    case 'breakIce': case 'collectSnow': if (act.remaining <= 0) finishClimateAction(w, c); break
    case 'travel': return travelStep(w, c)
    case 'prosthetic':
      return prostheticStep(w, c)
    case 'respirator':return maskRefillStep(w,c)
    case 'waterRescue':return waterRescueStep(w,c)
    case 'beaconWork':return beaconWorkStep(w,c)
    case 'parasiteRemoval':return parasiteRemovalStep(w,c)
    case 'boatCare': {
      const vessel=w.s.map.vessel,d=watercraft(w),parts=act.supplies??[]
      if(!vessel||c.id!==vessel.owner||boatRepairQuote(w).error||vessel.hull.uid!==act.uid||!d||JSON.stringify(d.repair)!==act.vesselRepairSignature||parts.reduce((n,i)=>n+i.count,0)!==d.repair.count||parts.some(row=>!c.bag.some(i=>i.uid===row.uid&&i.def===row.def&&i.count>=row.count))){c.activity=undefined;return true}
      if(act.remaining<=0){for(const row of parts){const i=c.bag.find(i=>i.uid===row.uid)!;i.count-=row.count}c.bag=c.bag.filter(i=>i.count>0);vessel.hull.durability=Math.min(vessel.hull.maxDurability??100,(vessel.hull.durability??100)+d.repair.restore);refloatBoat(w);log(w,'good','같은 선체에 실제 재료를 대어 기웠다.')}
      break
    }
    case 'water':
      if(act.baseOrder!==undefined&&!baseTaskActive(w,c,act.baseOrder)){c.activity=undefined;return true}
      return waterStep(w, c)
    case 'gearCare':
      return gearCareStep(w, c)
    case 'drawWorldMap':return worldMapDrawingStep(w,c)
    case 'drawMap':return mapDrawingStep(w,c)
    case 'craft': case 'repair': case 'salvage':
      return workStep(w, c)
    case 'pray':
      if (act.remaining <= 0) {
        c.needs.stress = Math.max(0, c.needs.stress - traitAdd(w, c, 'prayerRelief'))
        if ((c.background === 'Bg.Excommunicate'||traitAdd(w,c,'prayerRelief')>0) && ['ashrain', 'ashstorm'].includes(w.s.weather) && !tileAt(w, c.pos).roof) addThought(w, c, 'Thought.Prayed')
        log(w, 'info', '기도를 마쳤다. 잠시 숨을 고른다.')
      }
      break
    case 'gather':
      if(act.target&&gatherFireError(w,act.target)){c.activity=undefined;if(isPl(c))log(w,'warn','채집 중단: 재료가 불에 타고 있다.');return true}
      if(act.gatherRule&&act.target&&(act.gatherRule!==gatherSignature(w,act.target)||gatherSeasonError(w,terrainAt(w,act.target)))){c.activity=undefined;if(isPl(c))log(w,'warn','채집 중단: 원래 덤불이나 실제 계절이 달라졌다.');return true}
      if(act.baseOrder!==undefined&&!baseTaskActive(w,c,act.baseOrder)){c.activity=undefined;return true}
      if (act.target && cheb(c.pos, act.target) <= 1 && terrainAt(w, act.target).gather) dirtyHands(w, c)
      if (act.remaining <= 0) finishGather(w, c)
      break
    case 'dry':
      if (fireWarmth(w, c) < 15) { c.activity = undefined; return true }
      break
    case 'cook': {
      const it = findItem(c, act.uid ?? -1), recipe = it && itemDef(w, it).cooking
      if (!it || !recipe || fireWarmth(w, c) < 15) { c.activity = undefined; return true }
      it.cookProgress = (it.cookProgress ?? 0) + 1
      if (act.remaining <= 0) {
        const out = makeItem(w, recipe.result)
        if(itemDef(w,out).food)out.foodQ=clamp((act.cookQualityBase??cookingQualityBase(w,c))+rng(w,('cooking.'+it.uid)as import('./rng').RngStream).int(0,30)-15,0,100)
        if(it.contaminantAsh)out.contaminantAsh=it.contaminantAsh
        if (itemDef(w, out).food) { out.freshness = foodFreshness(it); out.foodThawed = it.foodThawed || it.foodFrozen || undefined; out.foodWet = it.foodWet; out.foodLeftover = it.foodLeftover;out.foodBurnt=it.foodBurnt }
        removeOne(w, c, it.uid)
        it.cookProgress = undefined
        if (addToBag(w, c, out)) tileAt(w, c.pos).items.push(out)
        practice(w, c, 'survival', `cook:${it.uid}`)
        log(w, 'good', `${itemDef(w, out).label}을(를) 만들었다.`)
      }
      break
    }
    case 'read': {
      const it = findItem(c, act.uid ?? -1), book = it && itemDef(w, it).book
      if (!it || !book || lightLevel(w, c.pos) >= 2) { c.activity = undefined; return true }
      const pageTurns = readingPageTurns(w,c)
      it.readProgress = (it.readProgress ?? 0) + 1
      if (it.readProgress >= pageTurns) { it.readProgress = 0; it.readPages = (it.readPages ?? 0) + 1 }
      act.remaining = Math.max(0, (book.pages - (it.lostPages ?? 0) - (it.readPages ?? 0)) * pageTurns - (it.readProgress ?? 0))
      if ((it.readPages ?? 0) >= book.pages - (it.lostPages ?? 0)) studyBook(w, c, it.def, true, (book.pages - (it.lostPages ?? 0)) / book.pages)
      break
    }
    case 'press': {
      const wd = c.body.wounds.find((x) => x.id === act.woundId)
      if (!wd || (wd.bleed <= 0 && !wd.artery)) { c.activity = undefined; return true }
      c.body.pressing = wd.id
      break
    }
    case 'washHands':
      if (act.remaining <= 0) finishHandWash(w, c)
      break
    case 'wash':
      if (act.remaining <= 0) finishWash(w, c)
      break
    case 'medicate':
      if (act.remaining <= 0) finishTopical(w, c, act)
      break
    case 'reload':
      if (act.remaining <= 0) finishReload(w, c, act)
      break
    case 'careWait': {
      const healer = creatureById(w, act.healerId)
      if (healer?.activity?.patientId === c.id) {
        const error = externalTreatmentError(w, healer, healer.activity)
        if (error) { log(w, 'warn', `진료 중단: ${error}.`); interruptTreat(w, healer); healer.activity = undefined; c.activity = undefined; return true }
        act.remaining = Math.max(1, act.remaining); return false }
      c.activity = undefined
      return true
    }
    case 'dose':
    case 'diagnose':
    case 'treat': {
      if (act.treat === 'cauterize' && act.remaining === 1 && isPl(c)) log(w, 'info', '칼날이 벌겋게 달았다.')
      if (act.remaining <= 0) { if (act.kind === 'dose') finishClinicalDose(w, c, act); else if (act.kind === 'diagnose') finishDiagnostic(w, c, act); else finishTreat(w, c, act); releasePatient(w, c, act, true) }
      break
    }
    case 'aim':
      // 조준 사격 2턴째: 대상이 시야에 없으면 취소, 기력 절반 환급 (15 §17)
      if (act.remaining <= 0) {
        const t = creatureById(w, act.uid)
        const d = act.abilityId ? w.db.ability(act.abilityId) : undefined
        const rd = c.equip.main ? itemDef(w, c.equip.main).ranged : undefined
        if (!t || !t.alive || !d || !rd || cheb(c.pos, t.pos) > rangedRange(w, c, t) || !hasLos(w, c.pos, t.pos)) {
          if (d) c.needs.energy += Math.floor((d.energy ?? 0) / 2)
          if (isPl(c)) log(w, 'info', '겨누던 대상을 놓쳤다.')
        } else {
          c.facing = dirIndex(t.pos.x - c.pos.x, t.pos.y - c.pos.y)
          abilityStrike(w, c, t, d, true)
        }
      }
      break
    case 'excavate': return excavationStep(w,c)
    case 'search':
      if(act.recoveryContract){const error=companionRecoverySearchError(w,c,act);if(error){if(canSee(w,player(w),c.pos))log(w,'warn',`${c.name}의 회수 수색 중단: ${error}.`);c.activity=undefined;return true}}
      if (act.remaining <= 0 && act.target) {
        // 시체 첫 수색 (소음 2)
        const corpse = act.uid !== undefined ? w.s.creatures.find((o) => o.id === act.uid && !o.alive) : undefined
        if(act.uid!==undefined&&(!corpse||corpse.pos.x!==act.target.x||corpse.pos.y!==act.target.y||cheb(c.pos,corpse.pos)>1||!hasLos(w,c.pos,corpse.pos)||diagonalBlocked(w,c.pos,corpse.pos.x-c.pos.x,corpse.pos.y-c.pos.y))){
          if(isPl(c))log(w,'warn','시체 수색을 중단했다. 원래 시체 곁에서 계속해야 한다.')
          break
        }
        if (corpse) {
          if(!corpse.searched)rememberLifeEvent(w,c,'corpseSearch')
          corpse.searched = true
          emitNoise(w, c.pos, 2, c.id)
          practice(w, c, 'survival', `corpse:${corpse.id}`)
          if (isPl(c)) w.s.loot = { pos: { ...corpse.pos }, kind: 'corpse', id: corpse.id }
          break
        }
        const t = tileAt(w, act.target)
        const terr = terrainAt(w, act.target)
        if(containerLocked(w,act.target)){if(isPl(c))log(w,'warn','잠긴 상자는 먼저 잠금쇠를 열어야 한다.');break}
        openContainer(w, c, act.target)
        practice(w, c, 'survival', `search:${act.target.x},${act.target.y}`)
        emitNoise(w, c.pos, terr.openNoise ?? 2, c.id)
        const n = t.cont?.items.length ?? 0
        fx(w, { k: 'status', id: c.id, text: n ? '발견!' : '빈 통', color: n ? '#e0c060' : '#a0a0a0', turn: turnOf(w) })
        if (isPl(c) && t.cont) log(w, n ? 'good' : 'info', n ? `${terr.label}에서 찾았다: ${t.cont.items.map((i) => itemLabel(w, i)).join(', ')}` : '아무것도 없다. 누군가 먼저 다녀갔다.')
      }
      break
    case 'strip':
      if (act.remaining <= 0 && act.uid !== undefined) {
        const list = lootItems(w)
        const it = list?.find((i) => i.uid === act.uid)
        if (it && addToBag(w, c, { ...it, gx: undefined, gy: undefined, rot: undefined, half: undefined }) === 0) {
          lootRemove(w, it.uid)
          if (isPl(c)) log(w, 'info', `${itemDef(w, it).label}을(를) 벗겨 냈다.`)
        } else if (isPl(c)) log(w, 'warn', '벗겨 내지 못했다. (배낭에 자리가 없다)')
      }
      break
    case 'equip':
      if (act.remaining <= 0 && act.uid !== undefined) {
        const it = findItem(c, act.uid)
        const before=equipmentSnapshot(c),err = it ? equip(w, c, act.uid, act.slot,false) : '없다'
        if (it && !err) {
          finishClothingProgress(c,it,act.gearPairUid)
          runEquipmentWorkers(w,c,before)
          if (isPl(c)) log(w, 'info', `${itemDef(w, it).label}을(를) 다 입었다.`)
        } else if (isPl(c)) log(w, 'warn', `입지 못했다: ${err}`)
      }
      break
    case 'unequip':
      if (act.remaining <= 0 && act.slot) {
        const it = c.equip[act.slot]
        const err = finishUnequip(w,c,act.slot,act.uid,act.dropAfter)
        if (it && !err) {it.half = undefined;it.dressProgress=undefined}
        if (err && isPl(c)) log(w, 'warn', `벗지 못했다: ${err}`)
      }
      break
    case 'dissect': {
      const error=dissectionError(w,c,act.uid??-1,act.toolUid)
      if(error){if(isPl(c))log(w,'warn',`해부 중단: ${error}`);c.activity=undefined;return true}
      dirtyHands(w,c)
      if(act.remaining<=0){const err=finishDissection(w,c,act);if(err&&isPl(c))log(w,'warn',err);if(!err)dirtyHands(w,c)}
      break
    }
    case 'taste':
      if (act.remaining <= 0 && act.uid !== undefined) {
        const err = finishTaste(w,c,act.uid)
        if (err && isPl(c)) log(w,'warn',err)
        if (c.activity !== act) return false
      }
      break
    case 'examine':
      if (act.remaining <= 0 && act.uid !== undefined) {
        const it = findItem(c,act.uid)
        if (it && itemDef(w,it).unidentified === 'pill') identifyPill(w,c,it.def)
      }
      break
  }
  if (act.remaining <= 0) {
    if (act.kind === 'sleep' && isPl(c)) log(w, 'info', '잠에서 깼다.')
    c.activity = undefined
    return true
  }
  return false
}

export function rollLoot(w: World, tableId: string): ItemInst[] {
  const r = rng(w, 'loot')
  const tbl = w.db.loot(tableId)
  const n = r.int(tbl.rolls[0], tbl.rolls[1])
  const out: ItemInst[] = []
  for (let i = 0; i < n; i++) {
    const e = r.weighted(tbl.entries, (x) => x.weight)
    if (!e) continue
    const count = e.count ? r.int(e.count[0], e.count[1]) : 1
    const it = makeItem(w, e.item, count)
    // 품질 (08 §4, 프로토타입은 조악·보통·좋음만 드롭): 25 / 60 / 15 %
    if (hasQuality(w.db.item(e.item))) { const q = r.int(0, 99); it.quality = q < 25 ? 0 : q < 85 ? 1 : 2 }
    out.push(it)
  }
  return out
}
