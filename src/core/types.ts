import type { Pos } from './geom'
import type { RngState } from './rng'

// ───────────── Def (콘텐츠 데이터, JSON) ─────────────

export interface DefBase {
  defType: string
  id: string
  parent?: string
  abstract?: boolean
  /** 같은 ID를 의도적으로 전체 교체할 때만 명시한다. */
  override?: boolean
  label?: string
  description?: string
  /** 로더가 채움: 이 Def를 마지막으로 정의/수정한 모드 */
  _mod?: string
}

export interface SaveModeDef extends DefBase {
  defType: 'SaveMode'
  label: string
  description: string
  manual: 'none' | 'shelter' | 'free'
  anchorDistance: number
  restoreAfterDeath: boolean
  achievements: boolean
}

export type DamageType = 'cut' | 'stab' | 'blunt' | 'bite' | 'burn' | 'gunshot'
export type ArmorCategory = 'sharp' | 'blunt' | 'heat'
export const CAPACITIES=['consciousness','moving','manipulation','sight','hearing','breathing','bloodPumping','tool','peck','flight','signal','claw','bite']as const
export type Capacity=typeof CAPACITIES[number]
export type Height = 'low' | 'mid' | 'high'

export interface BodyPartDef {
  /** Actual exposed joint armor, when different from the enclosing chassis. */
  armor?:Partial<Record<ArmorCategory,number>>
  id: string
  label: string
  parent?: string
  hp: number
  /** 외부 커버리지 ‰ (외부 부위만, 몸 전체 합 1000 · 07 §2.3) */
  coverage?: number
  /** 큰 사지를 절단했을 때 절단면을 남길 몸통 부위 */
  stumpParent?: string
  /** 내부 분배 가중 (부모가 관통됐을 때 · 02 §2.2) */
  weight?: number
  height?: Height
  internal?: boolean
  vital?: boolean
  /** 파괴되면 24시간 뒤 사망 (간) */
  delayedDeath?: boolean
  /** 뼈 강도 = 골절 임계 (02 §2.1) */
  bone?: number
  /** 동맥 출혈 ml/턴 (02 §2.1: 경동맥 250 · 대퇴 150 …) */
  artery?: number
  /** 혈관계수 (02 §5) */
  vessel?: number
  /** 통증계수 (02 §5) */
  pain?: number
  /** 내출혈 장기계수 (02 §8) */
  organ?: number
  /** 장기 관통 판정의 빗나감 가중 (흉부 40 · 복부 15) */
  organMiss?: number
  /** 이 부위 피격 중 자식(손가락·발가락)으로 넘어가는 % */
  childShare?: number
  /** 관통 시 추가 오염 (장 80) */
  contam?: number
  /** 지혈대 단위 (그 팔·다리의 상완·대퇴) */
  limb?: string
  side?: 'l' | 'r'
  /** 힘줄 판정 부위 (손·전완·발) */
  tendon?: boolean
  /** 0이 되면 떨어져 나가는 부위 (손가락·손·발·귀·코) */
  detach?: boolean
  digit?: boolean
  /** 사족 다리 */
  qleg?: boolean
  /** 방어구 덮음 태그 (13 §6.2) */
  groups: string[]
  region: Region
  capacities?: Partial<Record<string, number>>
}

export interface BodyDef extends DefBase {
  waterBreathing?:boolean
  defType: 'Body'
  bloodMl: number
  kind?: 'humanoid' | 'quadruped' | 'amalgam' | 'mechanical' | 'invertebrate' | 'bird'
  mechanical?: MechanicalRules
  parts: BodyPartDef[]
}

export interface MechanicalRules {
  errorLoop: {damage:number;checkTurns:number;chance:number;turns:number}
  salvage: {item:string;count:number;chance:number}[]
  core: string
  powerCell: string
  coolingLoop: string
  chassis: string
  toolHead: string
  coolantMl: number
  leakPerSeverity: number
  cooling: number
  ambientThreshold: number
  ambientDivisor: number
  protectiveHeat: number
  shutdownHeat: number
  shutdownChance: number
  shutdownTurns: [number, number]
  coreDamage: number
  shortChance: number
  moveHeat: number
  attackHeat: number
  weldHeat: number
  actionPower: number
  idlePower: number
  retreatPower: number
  patch: { item: string; turns: number }
  coolant: { item: string; ml: number; turns: number }
  repair: { item: string; severity: number; turns: number; tool: string }
  cell: { item: string; power: number; turns: number }
}

export interface MachineState {
  errorChecked?:number
  errorLoop?:{until:number;action:MachineLoopAction}
  lastAction?:MachineLoopAction
  attacks?:number
  components?: ItemInst[]
  cargo?: number[]
  alert?: number
  coolant: number
  heat: number
  power: number
  shutdownUntil: number
}
export type MachineOperation = 'patch' | 'coolant' | 'repair' | 'cell'
export type MachineLoopAction={type:'wait'}|{type:'move';dir:number}|{type:'attack';target:number;mode?:string}

export interface WoundDef extends DefBase {
  handContact?: boolean
  defType: 'Wound'
  label: string
  /** sev 1당 턴당 출혈 ml (02 §5) */
  bleedPerSeverity: number
  painPerSeverity: number
  /** 생성 시 기본 오염 0~100 */
  contamination: number
  /** 하루 치유량 (sev) */
  healPerDay: number
  scarChance: number
  suturable?: boolean
  /** 외부에서 보이는가 (내출혈 = false) */
  visible?: boolean
}

export interface AttackDef {
  /** Actual owner anatomy must function; never selects a missing tool. */
  requiresParts?:string[]
  /** Chemical injury shares heat armor routing but keeps its actual wound type. */
  woundDef?:string
  /** 실제 공격의 부위 선호. 능력 가중과 곱하며 부위 선택 규칙을 우회하지 않는다. */
  partWeights?:Partial<Record<Region|'neck',number>>
  /** 부위 자체의 실제 기능을 선호한다. 작은 부위도 강제 명중하지 않는다. */
  partCapacityWeights?:Record<string,number>
  prey?:{unconscious:true;capacity:string;faceCover?:boolean}
  armorDamage?: number
  targetHeat?: number
  requiresLit?: boolean
  /** 공격 방식 id: slash 베기 · stab 찌르기 · blunt 타격 */
  id?: string
  label: string
  damageType: DamageType
  /** 기본 피해 (07 §7.1) */
  damage: number
  /** 관통 0~100 (07 §2.4) */
  pen: number
  /** 기력 (07 §6) */
  energy: number
  /** 무기 계열 (15 §7): blade·axe·blunt·spear·archery·unarmed */
  family: string
  /** 무기 정확도 (공격치 기본값) */
  accuracy: number
  reach?: number
  /** 출혈 배율 (07 §7.1) */
  bleedMult?: number
  noise?: number
  /** 이 능력치가 0이면 공격 불가 (예: 턱 파괴 시 물기 불가) */
  requiresCapacity?: Capacity
  /** 머리 기절 판정에 D + 이 값 (둔기 4) */
  stunD?: number
  /** 짧은 날: 잠든·기절 대상 첫 타 ×2 (07 §2.8) */
  shortBlade?: boolean
  /** 방패 내구 피해 배율 (손도끼 2) */
  shieldDamage?: number
  /** 맨손 등 밀치기 보정 (07 §7.2) */
  shove?: number
  /** 생성 상처 오염 가산 (녹 +10, 02 §10.1) */
  contam?: number
}

export type Slot = 'head' | 'chest' | 'lining' | 'hands' | 'feet' | 'belt' | 'back' | 'neck' | 'ring1' | 'ring2' | 'main' | 'off'
export const SLOTS: Slot[] = ['head', 'chest', 'lining', 'hands', 'feet', 'belt', 'back', 'neck', 'ring1', 'ring2', 'main', 'off']
export type Region = 'head' | 'torso' | 'larm' | 'rarm' | 'lleg' | 'rleg'
export const REGIONS: Region[] = ['head', 'torso', 'larm', 'rarm', 'lleg', 'rleg']

export interface RangedDef {
  firearm?: { powder?: string; oil: string; misfire: number; foulingPerShot: number; jamThreshold: number; jamPerPoint: number; wetThreshold: number; wetMultiplier: number; cleanTurns: number; unjamTurns: number; moraleShock: number }
  magazine?: { capacity: number; mode: 'round' | 'clip'; alternatives: string[] }
  reloadTurns?: number
  /** 최대 사거리 */
  range: number
  /** 유효 사거리 (초과 1칸당 −3, 07 §2.1) */
  effective?: number
  ammo: string
}

export type MaterialCategory = 'Stone' | 'Metal' | 'Relic' | 'Bone' | 'Wood' | 'Leather' | 'Fabric'
export interface MaterialDef extends DefBase {
  defType: 'Material'
  label: string
  category: MaterialCategory
  density: number
  sharpness: number
  hardness: number
  toughness: number
  insulation: number
  wetLoss: number
  corrosionResist: number
  flammability: number
  valuePerKg: number
  craftable?: boolean
  station?: string
  recoveryItem?: string
}
export type Stuff = Record<string, string | { material: string; massG: number }[]>
export type MaterialSelection=Record<string,{uid:number;grams:number}[]>
export interface MaterialBinding {uid:number;def:string;material:string;unitGrams:number;usedGrams:number}
export interface MaterialPlan {bindings:MaterialBinding[];stuff:Stuff}

export interface ItemDef extends DefBase {
  purifier?:{radius:number;attack:AttackDef}
  neurotoxin?:{turns:[number,number]}
  camouflageCoating?:{durationTurns:number;sightMult:number;washAt:number;tint:number}
  compWorker?:string
  respirator?:{filter:string;chargeTurns:number;protection:number;wetAbove:number;wetProtection:number;refillTurns:number}
  defType: 'Item'
  prosthetic?: string
  relic?: boolean
  unknownLabel?: string
  unknownDescription?: string
  label: string
  sprite: string
  /** 원본 그림의 손잡이/축. 표현 전용이며 사거리·피해·게임 시간을 바꾸지 않는다. */
  heldSprite?: {grip:[number,number];axisDegrees:number;length:number;restDegrees?:number;tipFraction?:number}
  category: 'weapon' | 'apparel' | 'shield' | 'medical' | 'food' | 'drink' | 'drug' | 'tool' | 'ammo' | 'misc'
  weight: number
  /** 배낭 격자 크기 [가로, 세로] */
  size: [number, number]
  /** 물품 내부 격자. 가방을 다른 가방에 넣을 수 없다. */
  storage?: [number, number]
  /** 허리띠의 소모품 주머니. 착용 완료 후 바로 접근한다. */
  pocket?: [number, number]
  /** 등 슬롯의 화살 전용 격자. 착용을 마쳤을 때만 탄약에 접근한다. */
  quiver?: {size:[number,number];ammo:string[]}
  /** 재비에 실제 노출된 화살 깃의 명중 감점. */
  fletching?: {hitPenalty:number}
  stackable?: boolean
  /** 읽을 수 있다 (쪽지 → 소문, 06 §7.0) */
  readable?: boolean
  book?: { interactions?:string[]; note?:string; pages: number; mastery: 'medicine' | 'survival'; amount: number; unlocks?: string[]; identify?: string[]; literacyMin?: number; literacyTo?: number; selfStudy?: boolean; bestiary?: string[] }
  cooking?: { result: string; turns: number }
  toolTags?: string[]
  material?: string
  /** 원재료 한 조각의 실제 질량. 소지 무게 제한에는 쓰지 않는다. */
  rawMaterial?:{material:string;grams:number}
  rawFragment?:boolean
  saltGrams?:number
  watercraft?:WatercraftConfig
  stuffSlots?: { id: string; accepts: MaterialCategory[]; volumeCm3: number; primary?: boolean; ref: string }[]
  stuffDefaults?: Stuff
  massFixedG?: number
  durabilityBase?: number
  repair?: { material: string; unitsPer10: number; turns: number; attr: keyof Stats; tools?: string[]; appraisalRequired?: boolean; station?:string; relicRisk?:{base:number;min:number;max:number} }
  salvage?: { material: string; count: number; turns: number; attr: keyof Stats; tools?: string[] }
  place?: string
  maxStack?: number
  value?: number
  /** 장착 슬롯 (반지는 'ring') */
  slot?: Exclude<Slot, 'ring1' | 'ring2'> | 'ring'
  /** 장착 시 능력치·특성형 수정치 */
  mods?: Partial<Record<string, number>>
  /** 날 상태 시작값 % (녹슨 칼 60) */
  edgeStart?: number
  /** 공격 방식들 (07 §14 attacks[]). 첫 번째가 기본 */
  attacks?: AttackDef[]
  /** 무기 막기치 / 받아넘기기치 (07 §7.1) */
  weapon?: { block: number; parry: number }
  ranged?: RangedDef
  /** 실제 화약 회분. 젖음은 각 인스턴스에 보존한다. */
  powder?: boolean
  cartridge?: { misfire: number; fouling: number; spent: string }
  /** 실제 물품 한 개를 던지는 공격. 탄약·장비 슬롯을 새로 만들지 않는다. */
  throwable?: { range: number; effective: number; attack: AttackDef }
  twoHanded?: boolean
  apparel?: {
    liningHost?: boolean
    liner?: boolean
    eyeProtection?: boolean
    faceCover?:boolean
    /** 판정 순서: 큰 값이 바깥 (망토 2 → 몸·머리·장갑·장화 1) */
    layer: number
    /** 덮는 세부 부위 태그 (13 §6.2) */
    groups: string[]
    insulation: number
    /** 젖음 100%일 때 잃는 단열 % (03 §7.1 · 13 §6.2) */
    wetLoss?: number
    /** 아래층으로 스미는 비를 막는 % */
    waterproofPct?: number
    /** 최외곽 몸통 장비의 방풍 0~1 */
    windproof?: number
    /** 날 / 타격 / 열 방어 0~100 (13 §6.2) */
    armor: Partial<Record<ArmorCategory, number>>
    noise?: number
    waterproof?: boolean
    durability: number
  }
  /** 방패: 막기치, 흡수량(넘친 피해는 방패 든 팔로), 밀치기 보정 (07 §2.2·§7.2) */
  shield?: { block: number; absorb: number; shove?: number }
  brew?:{result:string;bottles:string[];mlPerLeaf:number;turns:number}
  fragile?:{dropChance:number;result:string;waterMult?:number;beddingMult?:number;noise?:number}
  openFoodLabel?:string
  openFood?:{result:string;turns:number;tools:string[]}
  food?: { plainThought?:string; rawDisease?:{def:string;chance:number}; sprouts?:{at:number;risk:number}; warm?:{gain:number;coolTurns:number;maxBodyTemp:number}; servings?:number;emptyVessel?:string; scentRadius?:number; freshHours?: number; cooked?: boolean; kcal: number; protein?: number; thirst?: number; dryTurns?: number; vitamin?: number; water?: number; raw?: boolean; scent?: number; needsTool?: string; /** 날것 식중독 % (기본 25) */ poison?: number }
  drink?: { freshHours?:number;emptyVessel?:string; water: number; kcal?: number; protein?: number; vitamin?: number; dirty?: boolean; alcohol?: number; quality?: WaterQuality }
  waterVessel?:{capacityMl:number;clean:string;dirty:string}
  medical?: {
    kind: 'bandage' | 'tourniquet' | 'splint' | 'disinfect' | 'suture'
    /** 처치 품질 Q 도구 항 (02 §12.1: 옷 찢은 천 −10 · 깨끗한 붕대 0) */
    tool?: number
    /** 더러운 붕대: 오염 +10 */
    dirty?: boolean
    /** 세척 배율 (술 0.4 · 깨끗한 물 0.75) */
    washMult?: number
  }
  drug?: { effect: string; durationTurns: number; def?: string }
  /** 미확인 그룹 (예: 'pill') — 시드별로 외형이 섞임 */
  unidentified?: string
  light?: { radius: number; fuelTurns: number; warmth?: number; openFlame?: boolean }
  /** 등불 연료 보충량 (턴) */
  refuel?: number
  /** 착/탈 턴 수 (13 §6.1). 없으면 1/1 */
  equipTurns?: [number, number]
  /** 둔중: 회피치에서 뺀다 (13 §6.2) */
  bulk?: number
  uses?: number
}

export interface ParasiteConfig {
  hostKinds: NonNullable<BodyDef['kind']>[]
  parts: string[]
  attachChance: number
  mlPerTurn: number
  maxFedMl: number
  maxOnHost: number
  saltItem: string
  saltCount: number
  saltTurns: number
  manualTurns: number
  wound: string
  severity: number
  disease: string
  diseaseChance: number
}
export interface ParasiteAttachment {creature:Creature;part:string;attachedAt:number;fedMl:number}
export interface WildlifeRules {
  kind:'timidHerbivore'|'stubbornForager'|'scavengerBird'|'territorialBear'
  den?:{territoryRadius:number;warningRadius:number;warningTurns:number;hungryLeash:number;hungryBelow:number;springSeason:string;springDays:number;hibernateSeason:string;wakeSlowTurns:number;fleeBloodLoss:number;lureFoodIds:string[]}
  browse?:boolean
  browseCount?:number
  drinkMl?:number
  carrionFoods?:string[]
  scavenging?:{followRadius:number;memoryTurns:number;circleRadius:number;fleeRadius:number;split:{source:string;piece:string;pieces:number}}
  foodIds:string[]
  threatRadius:number
  forageRadius:number
  homeRadius:number
  eatBelow:number
  drinkAbove:number
  wanderChance:number
  sleepAt:number
  rut?:{season:string;chance:number;memoryTurns:number}
  mud?:{terrains:string[];sharp:number;blunt:number;washTurns:number}
}
export interface SowerRules {
 route:Pos[];waitAtWaypointTurns:number;seedItem:string;seedEveryMoves:number;pushDistance:number
 signalPart:string;callRadius:number;callTurns:number
 spray:{item:string;radius:number;turns:number;concentration:number;cooldown:number}
}
export interface SowerState {
 assault?:{serial:number;at:number;seen?:{id:number;pos:Pos}};alarmAttack?:number
 rule:string;routeIndex:number;moves:number;seedsSpent:number;resumeAt:number;alarmWound:number
 lastSeed?:{uid:number;at:number;pos:Pos};lastSpray?:{uid:number;at:number};nextSprayAt?:number
}
export interface ToxinCoating {sourceUid:number;sourceDef:string;turns:[number,number]}
export interface LocalParalysis {sourceUid:number;sourceDef:string;woundId:number;parts:string[];region:Region;appliedAt:number;until:number}
export interface CrawlerRules {
 segments:{body:string;ganglion:string;legs:[string,string]}[]
 head:string;glands:[string,string];venomItem:string;dosesPerGland:number
 venomAttack:string;coilAbility:string;prey:string[];foodIds:string[];huntBelowKcal:number;eatBelowKcal:number;drinkAboveMl:number;drinkMl:number;smokeKinds:string[];smokeRadius:number
 ceiling:{dropRadius:number;inspectRadius:number;awarenessTurns:number;ambushHit:number;reclimbTurns:number}
 harvest:{plateItem:string;legItem:string;meatItem:string;meatCount:number}
}
export interface CrawlerState {
 rule:string;mode:'floor'|'ceiling';nextClimbAt:number;observedBy:Record<string,number>
 glands:{part:string;uid:number;initialDoses:number;spentDoses:number;lostDoses:number;harvestedDoses:number;item?:ItemInst}[]
 lastDrop?:{at:number;target:number;aware:boolean};lastBite?:{at:number;target:number;woundId:number;sourceUid:number}
 harvestLost?:{plates:number;legs:number;meat:number}
}
export interface CullerRules {
 protectedRect:[number,number,number,number];leashTiles:number;memoryTurns:number;minimumWeightKg:number;activationAlert:number
 attacksBeforeCooling:number;coolingTurns:[number,number];retreatDamage:number
 tools:{left:string;right:string};drives:string[]
 components:{part:string;item:string}[]
 spray:{part:string;item:string;radius:number;tu:number;attack:AttackDef}
 net:{part:string;item:string;range:number;turns:number;strength:number;tu:number}
 weaknesses:{waterMl:number;shortChance:number;shutdownTurns:number;bellItem:string;bellFaction:string;machineBellChance:number;bellRadius:number;bellChance:number;coolingBellChance:number;bellTurns:[number,number]}
}
export interface CullerState {
 rule:string;attacks:number;coolUntil:number;returning:boolean;tracked?:{id:number;pos:Pos;at:number}
 components:{uid:number;part:string;def:string;initial:number;spent:number;lost:number;unit:'count'|'uses'}[]
 lastAttack?:{at:number;kind:string;target:number};lastWater?:{at:number;uid:number;ml:number;shorted:boolean}
}
export interface CreatureDef extends DefBase {
  culler?:CullerRules
  crawler?:CrawlerRules
  sower?:SowerRules
  survey?:{antenna:string;reportTurns:number;reportCooldown:number;keepDistance:[number,number];watchRect:[number,number,number,number];patrol:Pos[];flashRadius:number;flashTurns:number;flashSightMult:number;flashCooldown:number}
  wildlife?:WildlifeRules
  flight?:{height:number;takeoffEnergy:number;moveEnergy:number;maxTurns:number;minCapacity:number;fallDamage:number;noise:number}
  considerationWorker?:string
  ageRange?:[number,number]
  meatDrop?:{item:string;count:number}
  parasite?:ParasiteConfig
  temperatureLimits?:{min:number;max:number;dormantBelow:number}

  naturalAttacks?: AttackDef[]
  dormantChar?: string
  teacher?: string
  literacy?: number
  clinic?: string
  inn?: string
  traits?: string[]
  defType: 'Creature'
  fireFear?: {radius:number;torchPenalty:number;memoryPenalty:number;memoryTurns:number;avoidRadius:number;packRadius:number;maxMemories:number}
  fearFamily?: string
  label: string
  sprite?: string | string[]
  body: string
  faction: string
  sizeClass: 'tiny' | 'small' | 'medium' | 'large' | 'huge'
  moveTU: number
  bloodMult?: number
  metabolicScale?: number
  hpMult?: number
  /** 모피 등 자연 단열 */
  insulation?: number
  fixedBodyTemp?: number
  diseaseImmune?: string[]
  damageTaken?: Partial<Record<DamageType, number>>
  contactDisease?: { id: string; chance: number; grabbedMult?: number }
  biteDisease?:{id:string;chance:number;prevention?:{turns:number;chanceMult:number};carrier?:{chance:number;transmission:number;label:string}}
  stats: Stats
  skills: Record<string, number>
  naturalAttack?: AttackDef
  ai: 'player' | 'packHunter' | 'raider' | 'skittish' | 'guard' | 'boss' | 'civilian'
  morale: number
  lightThreshold: number
  sightRange: number
  /** 구간별 지각 보너스와 어둠의 고정 거리 감소. 없으면 기존 종의 시야 규칙을 유지한다. */
  vision?: { maxRange: number; perceptionStep: number; perceptionBonus: number; darkPenalty: number }
  scentSense?: number
  loadout?: { slots: { items: string[]; chance?: number; count?: [number, number] }[] }
  hunger?: [number, number]
  bestiary?: string[]
  /** 처치 경험치 */
  xp?: number
  /** 스프라이트 manifest 캐릭터 키 (여러 개면 무작위) */
  char?: string | string[]
  /** 저장된 sprite를 바꾸지 않는 표시용 캐릭터 별칭. 한 단계만 적용한다. */
  characterAliases?: Record<string, string>
  /** 배치 시 잠들어 있을 확률 */
  sleepChance?: number
  /** 화면 표시 배율 (보스 등) */
  scale?: number
  /** 기본 HP (없으면 활력 공식) */
  hpBase?: number
  /** 회피 보정 */
  evasion?: number
  /** 특성형 수정치 (고통 둔감 등) */
  mods?: Partial<Record<string, number>>
  /** 맞으면 주변에 뿌리는 효과 (포자 등) */
  onHit?: { effect: string; radius: number; turns: number; chance: number }
  /** 시체 배낭 격자 (13 §8.1: 약탈자 8×4 · 그늘 사람 4×3 …) */
  bagSize?: [number, number]
  /** 체중 kg (밀치기 체급, 07 §7.2) */
  weightKg?: number
  /** 자연 방어: 털·가죽·껍질 (07 §2.4 마지막 층) */
  naturalArmor?: Partial<Record<ArmorCategory, number>>
  /** 사기 판정을 하지 않는 종 (07 §8) */
  noMorale?: boolean
  /** 청각 보정 (07 §9.1) */
  hearing?: number
  /** 후각 배율 (07 §9.2: 인간 1/2 · 그늘 사람 1 · 포자 인간 0 · 융합체 2) */
  smell?: number
  /** 어둠 시야: [어둠, 칠흑] 명중 감점 (그늘 사람 −5 · −15, bestiary §17) */
  darkSight?: [number, number]
  /** 보유 능력 (15 §15) */
  abilities?: string[]
  /** 능력치 흔들림 범위 (약탈자만, H) */
  statRange?: Partial<Record<keyof Stats, [number, number]>>
  /** 든 무기 계열에 따라 받는 능력 (약탈자 근접: 도끼 → 쪼개기, 둔기 → 밀쳐내기) */
  weaponAbilities?: Record<string, string[]>
  /** 무리 우두머리 (사망 시 같은 무리 사기 −30) */
  leader?: boolean
  /** 빛을 싫어함: 광원 반경 안에서 사기 −10 (그늘 사람) */
  lightAverse?: boolean
  /** 광원 반경 안 사기 감소 (기본 10, 그늘 사람 25 — CANON D35) */
  lightMorale?: number
  /** 무리 절반을 잃으면 도주 (그늘 사람) */
  packFlee?: boolean
  /** 물 냄새에 끌리고 물을 주면 진정할 수 있다 (말라붙은 자) */
  thirsty?: boolean
  /** 맞아서 HP가 줄면 포자 구름 (포자 인간) */
  sporeOnHit?: { radius: number; turns: number; conc: number }
  /** 등 뒤가 없다 (융합체: 모든 방향이 정면) */
  noBack?: boolean
  /** 이 부위 묶음이 모두 파괴되면 죽는다 (융합체: 머리 셋, 심장 셋) */
  deathAllOf?: string[][]
}

export interface Stats { str: number; agi: number; per: number; vit: number; wil: number }

export interface BeaconConfig {network:string;literacyMin:number;fuel:string;fuelTurns:number;maxFuelTurns:number;igniteTurns:number;sendTurns:number;turnsPerCell:number;speed:number;rangeCells:number;height:number;radius:number}
export interface BeaconAddress {site:string;map:string;pos:Pos;uid:number}
export interface BeaconReceipt {key:string;rumor:Rumor;from:string;receivedAt:number}
export interface BeaconState {uid:number;fuelUntil:number;inbox:BeaconReceipt[]}
export interface SignalPacket {key:string;rumor:Rumor;from:BeaconAddress;to:BeaconAddress;sentAt:number;lastAt:number;progress:number;total:number;signature:string;toSignature:string;deliveredAt?:number;failed?:string}
export interface CropRule { maxLight?:number; needsSoil?:boolean; substrate?:{item:string;cycles:number;turns:number}; minLight:number; minTemp:number; maxTemp:number; waterMl:number; maxSalinity:number; rainMlPerHour:number }
export interface CultivationState {origin?:{terrain:string;at:number};dormantAt?:number;remainingCycles?:number;ownerId?:number;irrigation?:{ml:number;pathogenMl:number;ash:number};evaporationCarry?:number; terrain:string; signature:string; seedUid:number; growth:number; waterUnits:number; lastAt:number }
/** 실제 지상 이탈 시점의 지역 날씨. 정산용 복사본에서만 난수를 진행한다. */
export interface SurfaceCultivationState {at:number;cell:Pos;weather:Weather;until:number;wind:Pos;rng:RngState;loadHash:string;signature:string}
export interface LockPickingRule {turns:number;wear:number;noise:number;toolTag:string;base:number;min:number;max:number;agility:number;quality:number}
export interface TerrainDef extends DefBase {
  clearing?:{tools:string[];turns:number;result:string;edgeLoss:number;noise:number}
  lock?:{turns:number;wear:number;noise:number;tools:string[];picking?:LockPickingRule}
  cultivation?:CropRule
  combustion?:{family:string;burnTurns:number;burnedAs:string}
  needles?:{item:string;count:number;turns:number;regrowTurns:number}
  beacon?:BeaconConfig
  lootCrime?:PropertyCrimeRule
  sealed?:boolean
  device?:string
  visual?:{sprite:string;scale:number;tint?:number}
  soil?:boolean
  keyItem?:string
  openAs?:string
  closeAs?:string
  residentWell?: boolean
  residentDepot?: boolean
  defType: 'Terrain'
  station?: { id: string; bonus: number }
  bedding?: { quality: number; insulation: number; portable?: boolean }
  gather?: { item: string; count: number; turns: number; regrowTurns: number; seasons?:string[]; soilDependent?:boolean }
  label: string
  sprites: string[]
  /** 계단 */
  stairs?: 'down' | 'up'
  /** 벽 렌더링 계열 */
  wall?: boolean
  wallMark?:'crack'|'sealedCrack'
  /** 바닥 렌더링 계열 */
  floor?: 'kt' | 'cd' | 'earth' | 'deck'
  passable: boolean
  opaque: boolean
  moveMult: number
  /** 비틀거림 가산 % (01 §5.3) */
  icy?: boolean
  stumble?: number
  waterSource?: string
  water?: 'shallow' | 'deep'
  door?: 'open' | 'closed'
  container?: string // LootTable id
  /** 뒤진 뒤 다시 차는 일수 (버섯 무리 2일, D36) */
  regrowDays?: number
  /** 단차 (07 §5: 돌무더기·계단·제단·석관 위 = 1) */
  elevation?: number
  /** 이 칸 뒤에 선 대상을 원거리로 쏠 때 감점 (07 §2.1: 반 엄폐 15 · 전 엄폐 30) */
  cover?: number
  /** 보관함 격자 [가로, 세로] (13: 야영지 보관함 12×8) */
  /** 루팅 격자 [가로, 세로] · 여는 턴 · 소음 (13 §8.1) */
  lootGrid?: [number, number]
  openTurns?: number
  openNoise?: number
  noiseMult?: number
}

export interface LootTableDef extends DefBase {
  defType: 'LootTable'
  rolls: [number, number]
  entries: { item: string; weight: number; count?: [number, number] }[]
}

export interface TraitDef extends DefBase {
  defType: 'Trait'
  label: string
  description: string
  conflicts?: string[]
  mods?: Partial<Record<string, number>>
  weight?: number
  /** 현재 귀로 듣는 정비음. 반경은 지역 칸, towerRadius는 월드 셀이다. */
  resonance?: { faction: string; radius: number; towerRadius: number }
  /** 사회의 초기 평판을 만들 때만 더한다. 이미 기록한 평판은 바꾸지 않는다. */
  initialReputation?: Partial<Record<string, number>>
}

export interface BackgroundDef extends DefBase {
  homeland?: {biomes?:string[];river?:boolean}
  startMoney?: number
  defType: 'Background'
  label: string
  description: string
  stats?: Partial<Stats>
  statMode?: 'absolute' | 'delta'
  ageRange?: [number, number]
  /** 구형 데이터 호환. 시작 숙달은 mastery를 쓴다 (D23) */
  skills?: Record<string, number>
  passions?: Record<string, 1 | 2>
  /** 시작 숙달 단계 (15 §9.1) */
  mastery?: Partial<Record<'medicine' | 'survival', number>>
  /** 시작 능력 포인트 가산 (몰락한 길드 상인 +1) */
  bonusAbilityPoints?: number
  /** 능력 효율 보정 (15 §9.1: 탈영 경비병 창 액티브 기력 −2 …) */
  mods?: Partial<Record<string, number>>
  literacy?: number
  literate: boolean
  startItems: string[]
  startAbilities?: string[]
  traitWeights?: Record<string, number>
  startQuality?: Record<string, number>
  immuneDiseases?: string[]
  startScars?: { part: string; severity: number; source: string }[]
  recipeCategories?: RecipeDef['category'][]
  startingRumors?: number
  startingMap?: string
}

export type ClinicKind = 'diagnose' | 'bandage' | 'disinfect' | 'tourniquet' | 'splint' | 'suture' | 'ligate' | 'tendon' | 'amputate' | 'extract' | 'reduce'
export interface InnDef extends DefBase {
  defType: 'Inn'
  label: string
  terrain: string
  beds: number
  fee: number
  leaseTurns: number
}
export interface ExpeditionEnding {
 id:string;label:string;summary:string;epitaph:string;notes:string[]
 revealNotes?:string[];revealBooks?:string[];region?:string
 disclosure?:string;tower?:{id:string;stopped:boolean}
}
export interface RetirementDef extends DefBase {endings?:ExpeditionEnding[];defType:'Retirement';label:string;dailyLivingCost:number;longLeaseDays:number;minHousingDays:number;youngAge:number;oldAge:number;youngYears:number;middleYears:number;oldYears:number;friendly:number;legendRenown:number;disabilityFactor:number;disabilityParts:string[];resident:string;maxLegacy:number}
export interface LegacyResident {key:string;seed:string;site:string;name:string;age:number;tales:string[];id?:number;heard?:boolean}
export interface RetirementRecord {kind:'peaceful'|'wounded'|'legend';site:string;keeper:number;bed:string;paid:number;estate:number;legacy:LegacyResident}
export interface HandHygieneDef extends DefBase {
  defType: 'HandHygiene'
  label: string
  waterMl: number
  washTurns: number
  cleanTurns: number
  washedBonus: number
  dirtyPenalty: number
  dirtyContam: number
}
export interface NpcRestDef extends DefBase {
  defType: 'NpcRest'
  label: string
  terrain: string
  radius: number
  sleepAt: number
  debtAt: number
  wakeAt: number
  retryTurns: number
  prepareKcal?: number
  prepareWaterDeficit?: number
}
export interface ResidentProvisionDef extends DefBase {
  defType: 'ResidentProvision'
  label: string
  terrain: string
  radius: number
  food: string
  minimumKcal: number
  targetKcal: number
  requestBelowKcal: number
  dailyFoodUnits: number
  retryTurns: number
  cooking?: { recipes:string[]; roles:CreatureDef['ai'][]; homeRadius:number; prepareBelowKcal:number; reserveWaterMl:number; reserveMoney:number; maxUnitPrice:number; retryTurns:number }
}
export interface ResidentWaterDef extends DefBase {
  defType: 'ResidentWater'
  label: string
  terrain: string
  radius: number
  thirstAt: number
  handWash: boolean
  hygiene?: { washAt: number; minBodyTemp: number; bedding: boolean; vesselMaxPrice?: number }
  retryTurns: number
}
export interface ResidentPurificationDef extends DefBase {
  defType: 'ResidentPurification'
  label: string
  fireTerrain: string
  fuelTarget: number
  dailyFuelUnits: number
  retryTurns: number
}
export interface TeacherDef extends DefBase {
  defType: 'Teacher'
  label: string
  days: number
  lessonTurns: number
  fee: number
  literacyMin: number
}
export interface ResidentWarmthDef extends DefBase {
  defType: 'ResidentWarmth'
  label: string
  fireTerrain: string
  seekAt: number
  target: number
  turns: number
  retryTurns: number
}
export interface BeddingMoveDef extends DefBase {
  defType: 'BeddingMove'
  label: string
  items: string[]
  defaultFloor: string
  packTurns: number
  coldAt: number
  warmRadius: number
  approachRadius: number
  retryTurns: number
}
export interface ClinicDef extends DefBase {
  defType: 'Clinic'
  label: string
  doctor: string
  restock?: { retryTurns: number; targets: { item: string; minimum: number; target: number; maxPrice: number; equivalents?: string[]; uses?: boolean }[] }
  doseTurns: number
  prescriptions: { item: string; mastery: number; fee: number }[]
  examination: { turns: number; mastery: number; quality: number; pulseMastery: number; abdomenMastery: number; reportLimit: number }
  fees: Record<ClinicKind, number>
  supplies: { item: string; count: number; appraisal?: 0 | 1 | 2 }[]
}

export interface SurgeryDef extends DefBase {
  defType: 'Surgery'
  label: string
  kind: 'suture' | 'ligate' | 'tendon'
  mastery: number
  turns: number
  perSeverity: number
  supply: string
  count: number
  toolTag: string
  toolBonus: number
  bleedMult: number
  healMult: number
  scarMult: number
  tearBelowQ: number
  tearChance: number
}

export type WaterTreatment = 'boil' | 'cloth' | 'charcoal' | 'settle' | 'pill'
export interface WaterQuality { pathogen: number; ash: number; source?: string; /** Dissolved salt, grams per litre. Absence means fresh water. */ salinity?: number }
export interface ProstheticDef extends DefBase {
  defType: 'Prosthetic'
  label: string
  item: string
  targets: string[]
  efficiency: number
  structureHp: number
  installTurns: number
  removeTurns: number
  serviceTurns: number
  medicine: number
  tool?: string
  noise?: number
  iceSlipMult?: number
  maintenanceTurns?: number
  maintenanceItem?: string
  overdueMult?: number
  powerTurns?: number
  powerItem?: string
  coldThreshold?: number
  coldMult?: number
  grip?: boolean
  twoHandSupport?: number
  attack?: AttackDef
  firstImpression?: number
  appraisalRequired?: boolean
  whispers?: { thought: string; everyTurns: number }
}
export interface ProstheticState {
  def: string
  item: ItemInst
  installedAt: number
  servicedAt: number
  whisperAt?: number
  powerUntil?: number
}
export type ProstheticOperation = 'install' | 'remove' | 'service' | 'charge'

export interface AquaticRules {bulkThreshold:number;checkTurns:number;sinkChance:number;energyPerTurn:number;breathTurns:number;hypoxiaFatalTurns:number;recoverPerTurn:number;minMoving:number;minBreathing:number;rescueTurns:number;criticalAir:number}
export interface AquaticState {enteredAt:number;submerged:boolean;air:number;hypoxia:number;checkedAt?:number}
export interface WaterSafetyDef extends DefBase {
  batchMl?:number
  snowDepthPerL?:number
  inhalation?:{label:string;weather:Partial<Record<Weather,number>>;caps:{dose:number;cap:number}[];coughTurns:number;coughNoise:number}
  aquatic?:AquaticRules
  defType: 'WaterSafety'
  sources: Record<string, WaterQuality>
  treatments: Record<WaterTreatment, { turns: number; pathogenMult: number; ashMult: number; tool?: string; fuel?: string }>
  saltFlushMlPerGram?: number
  maxDrinkingSalinity?: number
  exposureMl: number
  pathogenRisk: number
  ashDivisor: number
  ashDaily: number
  nauseaAt: number
  nauseaAbsorption: number
  kidneyAt: number
  kidneyDamage: number
  kidneys: string[]
  corpsePathogen: number
  rainAcidity: number
  snowCoolingPer100: number
  riskBands: { at: number; label: string }[]
  disease: string
  dysenteryAbsorption: number
}

export interface FoodSafetyDef extends DefBase {
  defType: 'FoodSafety'
  exposureTraining?: FoodExposureRule[]
  cooking?:{temperature:number;neglectTurns:number;burnChance:number;masteryReduction:number;burnKcal:number;burnMood:number;thought:string;capacity:number}
  temperature: { max: number; mult: number }[]
  sealedMult: number
  wetMult: number
  leftoverMult: number
  thawedMult: number
  staleAt: number
  spoiledAt: number
  staleRisk: number
  spoiledRisk: number
  rottenRisk: number
  staleMood: number
  rottenScent: number
  dirtyHandsAt: number
  dirtyHandsRisk: number
  filthyAt: number
  dirtyWound: number
  filthyWound: number
  poisonHours: [number, number]
  vomits: [number, number]
  vomitWater: number
  washWater: number
  washTurns: number
  washGain: number
  bathCooling: number
  liceRisk: number
  liceSleepMult: number
}

/** Snapshot of the actual food course; later content edits do not erase lung injury. */
export interface FoodExposureRule {
  food:string
  disease:string
  servings:number
  durationDays:number
  minIntervalTurns:number
  maxGapTurns:number
  lungDose:number
  riskMult:number
  knowledgeBook?:string
}
export interface FoodExposureRecord {
  rule:FoodExposureRule
  doseCount:number
  course?:{receipts:{uid:number;at:number}[]}
  completedAt?:number
}

export interface NutritionBand {
  deficit: number
  label: string
  str: number
  energy: number
  immunity: number
  healing: number
  consciousness: number
  thought?: string
  shivering: boolean
  turns: number
  stumble: number
  heatShift: number
}
export interface NutritionDef extends DefBase {
  leanDiet?:{windowTurns:number;proteinKcalPerGram:number;proteinFraction:number;absorption:number;waterPerDay:number}
  defType: 'Nutrition'
  kcalPerDay: number
  waterPerDay: number
  activity: Record<'sleep' | 'rest' | 'idle' | 'walk' | 'work' | 'combat', number>
  bulkPerPoint: number
  coldKcal: number
  shiveringKcal: number
  woundKcalPerDay: number
  feverKcalMult: number
  hotThreshold: number
  hotWaterPerDegreeDay: number
  sweatThreshold: number
  sweatWaterPerHour: number
  feverWaterPerDay: number
  dysenteryWaterPerDay: number
  burnWaterPerSeverityDay: number
  maxKcal: number
  overfullTurns: number
  maxDrink: number
  excessDrinkMult: number
  proteinDaily: number
  proteinPerGram: number
  lowProtein: number
  criticalProtein: number
  lowProteinMult: number
  vitaminDaily: number
  lowVitamin: number
  lowVitaminRecovery: number
  hygieneDaily: number
  starvationRisk: number
  scurvyDaily: number
  scurvyRecovery: number
  scurvyRisk: number
  scurvyGumBloodDay: number
  scurvyBleedMult: number
  hunger: NutritionBand[]
  thirst: NutritionBand[]
}

export interface ProcedureDef extends DefBase {
  defType: 'Procedure'
  label: string
  kind: 'amputate' | 'extract' | 'reduce'
  turns: number
  blade: boolean
  toolBonus: number
  painSpike: number
  stumpFraction?: number
  prostheticThreshold?: number
  prostheticBonus?: number
  bloodPerSeverity?: number
  failureSeverity?: number
}

export interface InfectionStage {
  at: number
  label: string
  pain: number
  targetTemp: number
  consciousness: number
  sleep: number
  healing: boolean
  metabolicFever: boolean
}
export interface RecoveryDef extends DefBase {
  infectionStages?: InfectionStage[]
  defType: 'Recovery'
  scarPainMult: number
  largeScarFraction: number
  largeScarCap: number
  contractureCap: number
  chronicChance: number
  chronicPain: number
  coldThreshold: number
  coldBonus: number
  rainBonus: number
  wakeBonus: number
  wakeTurns: number
  nerveLossPerHour: number
  nerveFrostbiteMult: number
  tendonPermanentTurns: number
  foreignPain: number
  foreignContam: number
  arrowBleedMult: number
  arrowMovePain: number
  brokenHeadChance: number
  dislocationCap: number
  dislocationPain: number
  dislocationChance: number
  dislocationSeverity: number
  concussionEvery: number
  concussionCap: number
  forgetfulChance: number
  forgetfulTrait: string
}

export interface PermanentLossRule {stat:keyof Stats;chance:number}
export interface GrowthDef extends DefBase {
  permanentLoss?:{starvation:{stage:number;turns:number;rule:PermanentLossRule};diseases:Record<string,PermanentLossRule>;brain?:{maxInjuryHp:number;stats:(keyof Stats)[]}}
  defType: 'Growth'
  yearDays: number
  ageBands: { min: number; mods?: Partial<Record<string, number>>; regenOffset: number; masteryMult: number; willBonus: number; statLoss: number; jointPain: number; senses: number }[]
}

export interface FatigueDef extends DefBase {
  defType: 'Fatigue'
  label: string
  debtAbove: number
  stages: { label: string; minRest: number; multiTurn: number; consciousness: number; wake: number; deepMinutes: number; stumble: number }[]
}

export type NpcStressKind='hurt'|'nearDeath'|'allyDeath'|'leaderDeath'|'killedHuman'|'treated'
export interface NpcPsycheDef extends DefBase {defType:'NpcPsyche';label:string;thoughtScale:number;acuteMult:number;historyLimit:number;events:Record<NpcStressKind,number>}

export interface ThoughtRange {
  metric: 'bodyTemp' | 'innerWetness' | 'painStage' | 'rest' | 'sleepDebt' | 'hygiene' | 'bloodLoss' | 'knownInfection' | 'woundInfection' | 'fever' | 'tourniquetHours' | 'frostbiteGrade' | 'restFireDistance' | 'ashExposure' | 'lightLevel' | 'adjacentThreats' | 'latentBiteAche' | 'machineResonance' | 'towerResonance'
  min?: number
  max?: number
  minExclusive?: boolean
  maxInclusive?: boolean
}
export interface ThoughtDef extends DefBase {
  /** OR 대안 중 하나의 모든 범위가 참인 동안. 과거 사건을 저장하지 않는다. */
  condition?: { any: ThoughtRange[][] }
  lifeEvent?: 'wash' | 'warmMeal' | 'talk' | 'innSleep' | 'treatment' | 'relicRepair' | 'companionDeath' | 'plagueNews' | 'corpseSearch' | 'discovery' | 'goodTrade' | 'victory' | 'seenBlood' | 'limbLoss' | 'fingerLoss' | 'scar' | 'overeat' | 'hangover' | 'tradeDeception' | 'welcome' | 'insult' | 'expelled' | 'ownRumor' | 'interaction'
  minEventQuality?: number
  eventBackground?: string
  eventDisease?: string
  minEventTradeGain?: number
  minEventThreatRatio?: number
  eventRoomTypes?: string[]
  homeLandscape?: boolean
  sleepEvent?: 'quality' | 'ground' | 'wet'
  minSleepQuality?: number
  minSleepWetness?: number
  traitMoodKey?: string
  faceEvent?: {groups:string[];mood:number;traitMoodKey?:string}
  eventOpinion?:boolean
  conditionMoodKey?: string
  corpseOdor?: {radius:number;minAgeTurns:number;traitMoodKey?:string}
  heardSound?: { faction: string; bodyKind: NonNullable<BodyDef['kind']>; recentTurns: number; traitMoodKey?: string }
  isolation?: { graceTurns: number; stepTurns: number; maxSteps: number; traitMultiplier?: string }
  hallucination?:{debtHours:number;checkTurns:number;chance:number;range:number;lifetimeTurns:number}
  defType: 'Thought'
  label: string
  mood: number
  durationTurns: number
  stack?: number
  stackMult?: number
  decay?: 'constant' | 'linear' | 'step'
  steps?: { afterTurns: number; mult: number }[]
  replaceGroup?: string
}

export interface TraumaDef extends DefBase {
  defType: 'Trauma'
  label: string
  kind: 'species' | 'fire' | 'water' | 'dark' | 'blood'
  mood: number
  stressPer10: number
  hit: number
  morale: number
  overcome: { victory: number; finishing: number; flee: number; breakdown: number; fireDay: number; crossing: number; darkHour: number; treatment: number }
  positive: { trait: string; hit: number; morale: number; yieldMult: number }
}

export interface Trauma {
  def: string
  target?: string
  overcome: number
  active?: boolean
  visible?: number[]
  seenTargets?: number[]
  encounters?: Record<number, { broken: boolean; done: boolean; qualifies?: boolean; distance?: number }>
  darkSince?: number
  lastStressTurn?: number
  lastFireDay?: number
  waterEntry?: Pos
  waterLast?: Pos
  seenWounds?: number[]
  treatedWounds?: number[]
}

export interface StoryPersona {key:string;label:string;description:string;incomePercent:number;restHours:number;target:[number,number][];recovery:'hold'|'ignore'|'press';spendPercent:[number,number]}
export interface StoryFameRule {weeklyDecay:number;awards:{key:string;creatures?:string[];source?:boolean;amount:number}[]}
export interface StoryDirectorRule {search?:{maxMembers:number;sourceRadius:number};unitCosts?:Record<string,number>;tension?:{calmPerHour:number;safeSleepPerHour:number;recentThreatTurns:number;campRadius:number;maxRoomCells:number};fame?:StoryFameRule;incomePerHour:number;capHours:number;graceHours:number;gracePercent:number;enhanceCost:number;chanceBoost:number;profiles:StoryPersona[]}
export interface StoryDirectorState {lastPurchase?:{kind:'patrol'|'search';at:number;mapId:string;region?:string;cost:number;extraId?:number};fame?:{value:number;lastDecayAt:number;credited:string[]};persona:string;startedAt:number;lastAt:number;budgetTenths:number;incomeCarry:number;tension:number;decayCarry:number;wounds:number[];threats:number[];bloodAlert:boolean;breakdownAlert:boolean;lastMajorAt?:number}
export interface CampEventOrigin {kind:'camp';faction:string;waypoint:string;minMembers:number}
export type PlaceEventOrigin=CampEventOrigin|{kind:'population';source:'@roomPopulation'}|{kind:'party';event:string}
export interface PlaceEventBehavior {kind:'patrol'|'search';chance:number;leader:string;leaderChance:number;route:string[];waitTurns:number}
export interface PlaceEventRule extends PlaceEventBehavior {origin:CampEventOrigin;count:[number,number]}
export interface PlaceEventDef extends DefBase {
  worker?:string
  category?:'Threat'|'Consequence'
  origin?:PlaceEventOrigin
  composition?:{fromPopulation:true;count?:[number,number]}
  traces?:string[]
  place?:PlaceEventBehavior
  director?:StoryDirectorRule
  defType: 'PlaceEvent'
  label: string
  cost: number
  weight: number
  hint?: string
  minDay?: number
  cooldownTurns?: number
  nightWeight?: number
}

/** 기존 TypeScript 호출의 호환 이름. 구형JSON Event는 로더에서 거절한다. */
export type EventDef=PlaceEventDef

export interface PillEffectDef extends DefBase {
  identifyDifficulty?: number
  noticeable?: 'always' | 'pain' | 'infection' | 'never'
  drug?: string
  defType: 'PillEffect'
  label: string
  description: string
  effect: string
  durationTurns: number
}

export interface SkillDef extends DefBase {
  defType: 'Skill'
  label: string
}

export interface PopulationRates { beta: number; gamma: number; mu: number }
export interface DiseaseDef extends DefBase {
  fatalAfterTurns?:number
  latentScarPain?:number
  gradualFever?:boolean
  clinical?: {pain?:number;manipulation?:number;eatingMult?:number;breathingPerProgress?:number;seizure?:{hourChance:number;stunTurns:number;fractureChance:number;severity:number}}
  immunePerDay?:number
  antibioticResponse?:number
  coldExposure?:{below:number;chance:number}
  lyingExposure?:{part:string;turns:number;chance:number}
  woundExposure?:{wounds:string[];contamination:number;severityFraction:number;terrain:string[];addedContamination:number;checkTurns:number;chance:number}
  population?: PopulationRates
  defType: 'Disease'
  label: string
  incubationDays: [number, number]
  perDay: number
  fever: number
  coughNoise?: number
  effect?: string
  permanentImmunity?: boolean
  symptom?: string
  sporeChance?: number
}

export interface WatercraftConfig {
  sinking?:{stormWear:Partial<Record<Weather,number>>;leakWear:number;frameTerrain:string;frames:[number,number][]}
  seats:number
  turnsPerCell:number
  wearPerHour:number
  launchTurns:number
  minDurability:number
  deckTerrain:string
  waterTerrain:string
  cargoTerrain:string
  cargoPos:[number,number]
  deck:[number,number,number,number]
  anchor:[number,number]
  weather:Partial<Record<Weather,number>>
  repair:{item:string;count:number;turns:number;restore:number}
}
export interface VesselState {hull:ItemInst;owner:number;crew:number[];floodedAt?:number;refloatedAt?:number}
export interface CookingBatch {item:ItemInst;fireUid:number;pos:Pos;crafter:number;source:string;result:string;signature:string;progress:number;total:number;lastAt:number;hotReadyTurns:number;readyAt?:number;mastery:number;qualityBase:number}
export interface CraftBatch {
 id:number;recipe:string;readyAt:number;pos:Pos;quality:number;crafter:number;foodWater?:ItemInst['foodWater'];freshness?:number;foodQ?:number;contaminantAsh?:number;foodThawed?:boolean;foodWet?:boolean;foodLeftover?:boolean;foodBurnt?:boolean;stuff?:Stuff
 processing?:{method:'smoke'|'dry'|'ferment';progress:number;total:number;lastAt:number;signature:string;vessel?:ItemInst;inputs:{uid:number;def:string;count:number}[];fire?:{pos:Pos;uid:number}}
}
export interface RecipeDef extends DefBase {
  /** 같은 원래 탄피와 실제 화약 젖음을 완성 실탄에 보존한다. */
  cartridgeReload?: { case: string; powder: string }
  interaction?:InteractionEvent
  defType: 'Recipe'
  label: string
  category: 'medical' | 'cooking' | 'woodwork' | 'smithing' | 'textile' | 'survival'
  primaryAttr: keyof Stats
  mastery?: 'medicine' | 'survival'
  basic?: boolean
  minAttr?: Partial<Stats>
  tools?: string[]
  stations?: string[]
  workTurns: number
  waterTreatment?: WaterTreatment
  boiledMeal?:{waterMl:number;vessel:string;unheated?:string}
  evaporation?: { ml:number; salinity:number }
  preservation?:{method:'smoke'|'dry'|'ferment';fastWind:number;fastRate:number;vessel?:string}
  passiveTurns?: number
  inputs: { item: string; count: number }[]
  materialInputs?:{slot:string;label?:string;grams:number;accepts?:MaterialCategory[];materials?:string[]}[]
  output: { item: string; count: number }
  noise?: number
  smell?: number
}

export interface WorkJob {
  baseOrder?:number
  kind: 'craft' | 'repair' | 'salvage'
  recipe?: string
  target?: number
  progress: number
  total: number
  inputs: { uid: number; def: string; count: number }[]
  materialPlan?:MaterialPlan
  mealPlan?:{bottleUid:number;bottleDef:string;ml:number;uses:number;quality:WaterQuality;vesselUid:number;fireUid:number;firePos:Pos;signature:string}
  fluidPlan?:{uid:number;def:string;uses:number;ml:number;quality:WaterQuality;signature:string}
  repairResult?: { restore: number; max: number; field: boolean; score?: number; failureChance?:number }
}

export interface BreakDef extends DefBase {
  defType: 'Break'
  label: string
  tier: 'minor' | 'moderate' | 'extreme'
  kind: 'irritable' | 'binge' | 'mutter' | 'cry' | 'drink' | 'lie' | 'flee' | 'wander' | 'organize' | 'drop' | 'drugs' | 'fast' | 'berserk' | 'catatonia' | 'selfharm' | 'breakgear' | 'despair' | 'voices'
  turns: [number, number]
  weight: number
  requires?: 'food' | 'alcohol' | 'drug'
  traitWeights?: Record<string, number>
  startQuality?: Record<string, number>
  immuneDiseases?: string[]
  startScars?: { part: string; severity: number; source: string }[]
  recipeCategories?: RecipeDef['category'][]
  startingRumors?: number
  startingMap?: string
}

/** 07 §5의 기본 낮은 자세. 수치는 콘텐츠에서 읽는다. */
export interface PostureDef extends DefBase {
  defType:'Posture'
  label:string
  movementTurns:number
  meleeHit:number
  rangedTargetHit:number
  noiseMult:number
}

/** 기본 전투 행동의 정본 확률과 수정 가능한 비용. */
export interface ManeuverDef extends DefBase {
  defType:'Maneuver'
  noise:number
  kind:'trip'|'disarm'
  label:string
  energy:number
  turns:number
  base:number
  min:number
  max:number
  differenceMultiplier:number
  weaponBonus:Partial<Record<string,number>>
  shortBladeBonus:number
  twoHandedBonus:number
  quadrupedBalance:number
}

export interface AbilityAttackMods {
  fromAbove?:boolean
  /** 명중 가산 (조준 사격 +25) */
  hitBonus?: number
  damageMult?: number
  /** 상처 출혈 항 배율 (깊게 베기 ×2) */
  bleedMult?: number
  /** 동맥 확률 가산 %p (깊게 베기 +15) */
  arterialBonus?: number
  /** 관통 가산 (0~100 척도: 급소 찌르기 +20, 쪼개기 +25) */
  penBonus?: number
  /** 맞은 방어구 내구 추가 손실 %p (쪼개기 10) */
  armorDamage?: number
  /** 골절 확률 배율 */
  fractureMult?: number
  /** 기절 확률 가산 %p (머리 강타 +40) */
  stunBonus?: number
  partWeights?: Partial<Record<Region | 'neck', number>>
  aoe?: 'adjacent' | 'line2'
  knockback?: number
  knockdownChance?: number
  /** 조준형 (야행성: 조명 감점 절반) */
  aimed?: boolean
}

export interface AbilityDef extends DefBase {
  requiresCapacity?:Capacity
  defType: 'Ability'
  label: string
  description: string
  tree: string
  tier: number
  kind: 'active' | 'passive' | 'toggle'
  energy?: number
  cooldown?: number
  requires?: string[]
  /** 요구 무기 계열 (주무기 attacks[].family). 패시브는 그 계열로 싸울 때만 (15 §7) */
  weapon?: string
  /** 요구 공격 방식 (깊게 베기 = slash, 급소 찌르기 = stab) */
  attackMode?: string
  /** 채널 턴 수 (조준 사격 2) */
  channel?: number
  /** 달려들기: 직선 N칸 이동 후 근접 공격 */
  lunge?: number
  /** 휩쓸기: 연속 N칸 */
  sweep?: number
  /** 포자 분출 */
  burst?: { radius: number; turns: number; conc: number }
  /** 붙잡기 */
  grab?: boolean
  target?: 'enemy' | 'self'
  attack?: AbilityAttackMods
  stance?: { effect: string; turns: number; magnitude?: number }
  self?: { energyPct?: number; painRelief?: number; turns?: number }
  mods?: Partial<Record<string, number>>
  icon: string
}

export type WeatherGroup = 'clear' | 'cloud' | 'rain' | 'storm' | 'snow'
export interface SeasonDef extends DefBase {
  defType: 'Season'
  label: string
  order: number
  lengthDays: number
  sunrise: number
  sunset: number
  phaseDay: number
  phase: number
}
export interface WeatherDef extends DefBase {
  defType: 'Weather'
  label: string
  weather: Weather
  group: WeatherGroup
  selectionWeight: number
  temperature: number
  diurnalMult: number
  daylightBonus: number
  nightLight: number
  precipitation: 'none' | 'rain' | 'snow' | 'fog'
  wetPerTen: number
  noise: number
  scentMult: number
  sightFlat: number
  sightMult: number
  windBonus: number
  corrosionMult: number
  eyeSightMult?: number
  windScentMult?: number
  thought?: string
}
export interface ClimateDef extends DefBase {
  defType: 'Climate'
  startDay: number
  amplitude: number
  veilAmplitude: number
  eruptionAmount: number
  eruptionDecay: number
  sunTransitionDays: number
  diurnal: [number, number][]
  weatherRows: Record<WeatherGroup, Record<WeatherGroup, number>>
  snowPerHour: number
  snowMeltPerDegreeHour: number
  freezeBelow: number
  snowIceAt: number
  iceStumble: number
  iceHoleTurns: number
  breakIceTurns: number
  snowCollectTurns: number
  towerStop?: {radiusKm:number;veilTarget:number;sunBonus:number;neighborRadiusKm:number;neighborBoost:number;soilDelayYears:number;soilCollapseYears:number;soilCommodities:Commodity[];hostileFaction:string}
}

export interface WorldGenDef extends DefBase {
  territory?:{maxCost:number;roadCost:number;landCost:number;riverCost:number;riseMetersPerCost:number}
  cropIrrigationTransfer?:{pathogenFraction:number;ashFraction:number}
  cropEvaporationMlPerHour?:number
  cropUprootTurns?:number
  /** 활성 지상 토양 밭의 남은 물 이동. 기존 작물에 흡수된 오염은 옮기지 않는다. */
  cropSoilDiffusion?:{everyTurns:number;maxMlPerEdge:number}
  mapWorkers?:{surface?:string;dungeon?:string}
  forage?:{sourceTerrain:string;terrain:string;chance:number}
  pines?:{sourceTerrain:string;terrain:string;chance:number}
  defType: 'WorldGen'
  width: number
  height: number
  cellKm: number
  seaLevel: number
  heightMax: number
  smoothPasses: number
  rainScale: number
  towers: [number, number]
  towerOutput: [number, number]
  towerRadius: [number, number]
  towerDormancy: number
  roadHours: number
  offRoadHours: number
  travelBleedMax: number
  settlementSpacing: number
  settlementCount: number
  startRegion: string
}
export interface BiomeDef extends DefBase {
  defType: 'Biome'
  label: string
  priority: number
  conditions: { altitude?: [number, number]; temperature?: [number, number]; rain?: [number, number]; veil?: [number, number]; coast?: number; river?: boolean }
  worldTravelMult: number
  windBonus?: number
  color: string
  resources: { wood: number; herbs: number; ore: number; game: number }
}
export interface RegionSiteDef extends DefBase {
  /** 기존 지형/도로/정착지 추첨이 끝난 뒤 붙이는 후속 지역. */
  extension?: {biome:string;population?:number;footAccess?:boolean;coast?:boolean;generation?:number;altitude?:[number,number];near?:{site:string;maxCells:number}}
  layout?: string
  defType: 'RegionSite'
  label: string
  description: string
  cell: [number, number]
  kind: 'cloister' | 'tower' | 'settlement' | 'ruin' | 'pass' | 'mine' | 'conduit'
  faction?: string
  altitude?: number
  river?: boolean
  guards?: { def: string; count: number }[]
  tower?: { output: number; radius: number }
  facilities?: boolean
}

/** 명시된 지역의 실제 지도. 모든 배치·산물은 최초 생성 뒤 각인으로 보존한다. */
export interface RegionLayoutDef extends DefBase {
  genWorker?:string
  fog?:{sightMult:number;color:number;opacity:number}
  dock?:[number,number]
  residentRest?:boolean
  legacyObjects?:{key:string;pos:[number,number];terrain:string;from:string[]}[]
  lights?:{pos:[number,number];radius:number;kind:string}[]
  swarms?:{def:string;pos:[number,number]}[]
  defType:'RegionLayout'
  label:string
  mapId:string
  kind:'surface'|'dungeon'
  depth:number
  width:number
  height:number
  fill:string
  ambient:number
  daylightMult?:number
  start:[number,number]
  exits:[number,number][]
  scatter:{terrain:string;chance:number}[]
  clear:{x:number;y:number;w:number;h:number;terrain:string;roof?:boolean}[]
  buildings:{x:number;y:number;w:number;h:number;wall:string;floor:string;door:[number,number];doorTerrain:string;name:string;roof:boolean}[]
  objects:{pos:[number,number];terrain:string;items?:{item:string;count:number}[]}[]
  spawns:{creature:string;pos:[number,number];home:[number,number];room?:number;settlementResident?:boolean}[]
  links:{pos:[number,number];to:string;at:[number,number]}[]
  submaps?:{mapId:string;layout:string}[]
}

export interface PropertyCrimeRule {faction:string;delta:number;reason:string;provoke?:boolean}
export interface FieldDeviceOperation {
  id:string;label:string;turns:number;requires:string[];materials:{item:string;count:number}[]
  tool?:string;waterMl?:number;books?:string[]
  hold?:string[]
  devices?:{map:string;def:string;operation:string}[]
  outdoorsCalm?:boolean
  energyCost?:number
  noise?:{radius:number;intervalTurns:number}
  crime?:PropertyCrimeRule
  effect?:{tiles?:{pos:[number,number];from:string;to:string}[];towerOutput?:{tower:string;value:number};stopTower?:string;sealSource?:{region:string;source:string};selfTerrain?:string;energy?:number;note?:{key:string;title:string;text:string}}
}
export interface FieldDeviceDef extends DefBase {defType:'FieldDevice';label:string;description:string;placement?:{region:string;mapId:string;source:string;wall:string;floor:string;terrain:string;waypoint:string};operations:FieldDeviceOperation[]}
export interface FieldDeviceWork {
  signature:string
  owner:number;operation:string;total:number;progress:number;toolUid?:number
  supplies:{uid:number;def:string;count:number}[];water?:{uid:number;def:string;ml:number}
  held?:{uid:number;def:string}[]
}
export interface FieldDeviceState {uid:number;def:string;completed:string[];installed:ItemInst[];waterUsed:number;energy?:number;work?:FieldDeviceWork}

/** 세력·상점 기본값은 P4/P5 확정 전 데이터 설정이다. */
export interface FactionDef extends DefBase {
  unlock?:string
  merchant?:string
  healer?:string
  defType: 'Faction'
  label: string
  key: string
  territorial: boolean
  playerStart: number
  relations: Record<string, number>
  trader?: string
  guard?: string
  resident?: string
}
export interface DiplomacyDef extends DefBase {
  defType: 'Diplomacy'
  bands: { min: number; label: string; price: number; trade: boolean; attack: boolean }[]
  attackLoss: number
  murderLoss: number
  witnessDaysPerCell: number
  witnessMinDays: number
  witnessMaxDays: number
  background: Record<string, Record<string, number>>
}
export interface EconomyDef extends DefBase {
  socialReplies?:{welcomeAt:number;expelAt:number}
  firstImpressions?:{villagerFactions:string[];filthyBelow:number;filthyPenalty:number;faceGroups:string[];faceScarPenalty:number;hagglePerPoint:number;warmAt:number;waryBelow:number}
  defType: 'Economy'
  currency: string
  sellMult: number
  buyMult: number
  guildRelicBuyMult: number
  regionMin: number
  regionMax: number
  restockDays: number
  haggleBase: number
  haggleMax: number
  haggleStep: number
  irritationAt: number
  irritationPrice: number
  refusalAt: number
  refusalTurns: number
}
export interface TraderStockDef extends DefBase {
  initialAdditions?:{id:string;items:{item:string;count:number}[]}[]
  defType: 'TraderStock'
  label: string
  money: number
  bargaining: number
  entries: { item: string; target: number; dailyProduction: number; dailyConsumption: number }[]
}
export interface RumorSubject {id:number;name:string;seed:string}
export interface ReputationEvent {
  subject?:RumorSubject
  regionId?:string
  evidenceKey?:string
  propertyKey?:string
  kinKey?:string
  target: number
  id: number
  faction: string
  delta: number
  reason: string
  turn: number
  arrives: number
  witnesses: number[]
  applied: boolean
}
export type FactionIncidentKind='raid'|'caravan'|'commonEnemy'|'release'|'execution'|'grudge'
export interface RecruitmentDef extends DefBase {
 defType:'Recruitment';label:string;conversationTurns:number;days:number;careKcal:number;careWater:number;minMorale:number;probationDays:number;inviteTurns:number
}
export interface RecruitmentProgress {employer:number;days:number[];willing?:number;hurtAt?:number;profile?:string}
export interface BeddingContactDef extends DefBase {defType:'BeddingContact';label:string;exchangePerHour:number;lice?:{hostBodies:string[];checkTurns:number;contactChance:number;surviveTurns:number;washTurns:number;washWaterMl:number};fire?:{checkTurns:number;sparkChance:number;flammabilityDivisor:number;dryBelow:number;burnTurns:number;damageEvery:number;damage:number;waterMl:number;light:number;defaultFloor:string;materials:Record<string,string>;burnMultipliers:Record<string,number>}}
export interface GearWeatherDef extends DefBase {defType:'GearWeather';label:string;intervalTurns:number;looseBody:string;dryPerTen:number;fireDryPerTen:number;fireRadius:number}
export interface MaterialCraftingDef extends DefBase {defType:'MaterialCrafting';label:string;fragment:string}
export interface CampfireDef extends DefBase {wildfire?:{checkTurns:number;sparkChance:number;spreadRadius:number;damageEvery:number;damage:number;damageRadius:number;waterMl:number;waterProtectionTurns:number;rainExtinguishChance:number;light:number};defType:'Campfire';label:string;terrain:string;kit:string;fuel:string;fuelTurns:number;maxFuelTurns:number;igniteTurns:number;stokeTurns:number;wetAt:number;wetMultiplier:number;radius:number;workerTarget:number}
export interface GearSwapState {slot:Slot;mapId:string;phase:'remove'|'wear';old:{slot:Slot;uid:number}[];dropped:{uid:number;pos:Pos}[];removeFull:number;retained?:{slot:Slot;uid:number}}
export interface BaseRestDef extends DefBase {defType:'BaseRest';label:string;assignTurns:number;prepareKcal:number;prepareWater:number;warmBelow:number;debtAt:number}
export interface BaseWaterDef extends DefBase {defType:'BaseWater';label:string;unitMl:number;maxAsh:number;methods:WaterTreatment[]}
export interface BaseLogisticsDef extends DefBase {defType:'BaseLogistics';label:string;pickupTurns:number;minFreshness:number;cultivation?:{doseMl:number;waterBelowMl:number;reserveWaterMl:number}}
export interface BaseDefenseDef extends DefBase {defType:'BaseDefense';label:string;faction:string;sourceWaypoint:string;firstDelayTurns:number;intervalTurns:number;planningTurns:number;timeoutTurns:number;chance:number;minMembers:number;maxMembers:number;sourceRadius:number;noticeRadius:number;lootStacks:number}
export interface BaseRaid {id:number;started:number;ended?:number;retreatAt?:number;phase:'active'|'repelled'|'looted'|'withdrawn';detected?:boolean;attackers:number[];visited:number[];disengaged:number[];stolen:{by:number;uid:number;def:string;count:number}[]}
export interface BaseCampDef extends DefBase {queueLimit?:number;defType:'BaseCamp';label:string;storeTerrain:string;claimTurns:number;radius:number;maxBatches:number}
export interface BaseTaskRequest {kind:'craft'|'craftStock'|'guard'|'haul'|'gather'|'water'|'fire';recipe?:string;batches?:number;item?:string;firePos?:Pos}
export interface BaseTask {id:number;kind:'craft'|'guard'|'haul'|'gather'|'water'|'fire';craftTarget?:number;firePos?:Pos;fireUid?:number;fireTarget?:number;recipe?:string;item?:string;targetStock?:number;waterTarget?:number;waterBottle?:number;remaining:number}
export interface BaseCampState {queues?:Record<number,BaseTask[]>;beds?:Record<number,{tenant:number;pos:Pos;preparedAfterWake?:number}>;raidHeard?:{id:number;at:number;phase:'sighted'|'repelled'|'stolen'};raidIntel?:{by:number;faction:string;at:number;reportedAt?:number};nextRaid?:number;raid?:BaseRaid;owner:number;at:number;store:Pos;storeUid?:number;tasks:Record<number,BaseTask>}
export interface PrisonerExchangeDef extends DefBase {defType:'PrisonerExchange';label:string;turns:number}
export interface RansomDef extends DefBase {defType:'Ransom';label:string;price:number;turns:number}
export interface NpcAbductionDef extends DefBase {defType:'NpcAbduction';label:string;roles:string[];approachRange:number;homeRadius:number;minKcal:number;maxWaterDeficit:number;maxFatigue:number}
export interface NpcCustodyDef extends DefBase {defType:'NpcCustody';label:string;roles:CreatureDef['ai'][];ropeRecipe:string;careBelowKcal:number;drinkAbove:number;minFreshness:number}
export interface RescueDef extends DefBase {defType:'Rescue';label:string;mercyTurns:number;restTurns:number;bond:number}
export interface RescueRecord {by:number;captor:number;faction:string;at:number;until:number;restUntil?:number;acknowledged?:boolean;reportDue?:boolean;rewardedBy:number[];care?:Record<number,{day:number;kcal:number;water:number}>}
export interface PrisonerEscortDef extends DefBase {
 defType:'PrisonerEscort';label:string;escortTurns:number;holdTurns:number;leashRadius:number
}
export interface PrisonerCareDef extends DefBase {
 defType:'PrisonerCare';label:string;sleepAt:number;wakeAt:number;wakeTurns:number;awakeTurns:number
 guardRadius:number;struggleTurns:number;escapeChance:number;ropeWear:number
}
export type PrisonerOperation='bind'|'release'|'interrogate'|'execute'|'escort'|'hold'
export interface PrisonerDef extends DefBase {
  defType:'Prisoner';label:string;rope:string;bindTurns:number;releaseTurns:number;interrogateTurns:number;executeTurns:number
  releaseReputation:number;executeReputation:number;mercyTurns:number;exaggerationChance:number;exaggerationMult:number;rumorLow:number;rumorHigh:number
}
export interface Captivity {
 captor:number;faction:string;at:number;rope:ItemInst;awakeUntil?:number
 surrendered?:boolean
 anklesFree?:boolean;escort?:boolean;lastCaptor?:Pos;yieldTo?:Pos
 care?:Record<number,{day:number;kcal:number;water:number}>
}
export interface CompanionBondDef extends DefBase {
  defType:'CompanionBond';label:string;initial:number;min:number;max:number;leaveAt:number
  periodTurns:number;range:number;together:number;sharedTrait:number;positivePerDay:number
  wage:number;arrears:number;betrayal:number;moraleDivisor:number;moraleCap:number
  personalities:string[];conflicts:{a:string;b:string;delta:number}[]
}
export interface CompanionBond {
  score:number;together:number;lastTick:number;day:number;positiveToday:number
  events:{turn:number;kind:'firstImpression'|'together'|'conflict'|'wage'|'arrears'|'betrayal'|'rescue';delta:number;text:string}[]
  heard?:{turn:number;attitude:'trust'|'neutral'|'uneasy'|'leaving'}
}
export type CompanionAidMode='off'|'firstAid'|'rescue'
export interface CompanionAidRule {supplyMemoryTurns?:number;range:number;rallyRadius:number;dragTurns:number;dragEnergy:number;dragBleedMax:number;minMedicine:number;minBleed:number;washContam:number;washAfterTurns:number;minBodyTemp:number;maxBodyTemp:number}
export interface CompanionDef extends DefBase {
  careSchedule?:{maxDelayTurns:number;maxSpanTurns:number;maxLateTurns:number;choicesTurns:number[]}
  carePlanMaxSteps?:number
  clinical?:string
  aid?:CompanionAidRule
  defType:'Companion';label:string;hireFee:number;dailyWage:number;maxMembers:number;minReputation:number
  followDistance:number;joinRadius:number;arrivalRadius:number;defendRadius:number
  eatBelow:number;drinkAbove:number;sleepAt:number;wakeAt:number
}
export type CompanionOrder='follow'|'hold'|'defend'
export interface CompanionCareStep {
  waitTurns?:number
  request:{kind:Exclude<ClinicKind|'dose','amputate'>;patient:number;uid?:number;woundId?:number;part?:string}
  label:string;turns:number;quality:number|null;lines:string[]
  bindings:{uid?:{uid:number;def:string};tool?:{uid:number;def:string};supplies:NonNullable<Activity['supplies']>}
}
export interface CompanionCarePlan {
  uid:number;patient:number;map:string;region?:string;startedAt:number;updatedAt:number
  status:'running'|'waiting'|'paused'|'complete';cursor:number;steps:CompanionCareStep[];reason?:string
  dueAt?:number;scheduleRule?:string
}
export interface CompanionContract {
  carePlan?:CompanionCarePlan
  aid?:{mode:CompanionAidMode;suppliesFromBase?:boolean;supply?:{patient:number;woundId:number;kind:string;pos:Pos;map:string;region?:string;seenAt:number;storeUid:number;materialUid:number;item:string;phase:'take'|'returning'};anchor:{pos:Pos;map:string;region?:string}}
  trialUntil?:number
  bond?:CompanionBond
  employer:number;originSite?:string;originMap:string;originHome?:Pos
  status:'employed'|'unpaid'|'dismissed'|'employerDead'|'betrayed'|'left';order:CompanionOrder
  hiredAt:number;paidUntil:number;lastLeader:Pos;anchor:Pos
}
export interface ColdConfusionDef extends DefBase {
  defType:'ColdConfusion';label:string;temperature:number;consciousness:number;intervalTurns:number;chance:number
  slots:('back'|'chest')[]
}
export interface FactionRelationsDef extends DefBase {
  defType:'FactionRelations';label:string;returnPerDay:number
  events:Record<FactionIncidentKind,{delta:number;baseline:number}>
}
export interface FactionRelationState {value:number;baseline:number;day:number}
export interface FactionRelationEvent {key:string;from:string;to:string;kind:FactionIncidentKind;turn:number;witnesses:number[];site?:string}
export interface SocietyState {
  unlocks?:string[]
  disclosures?:{rule:string;site?:string;turn:number;source:number;witnesses:number[];reformers:number[]}[]
  relations?:Record<string,Record<string,FactionRelationState>>
  relationEvents?:FactionRelationEvent[]
  relationKnowledge?:Record<string,{day:number;values:Record<string,number>}>
  reputation: Record<string, number>
  events: ReputationEvent[]
  nextEvent: number
}
export interface KinshipDef extends DefBase {
  defType:'Kinship';label:string;faction:string;underground:string[];chiefs:string[];sites:string[]
  delayDays:number;killLoss:number;chiefLoss:number;peaceReward:number;torchLoss:number;trust:number;avoidRadius:number
}
export interface EvidenceDef extends DefBase {defType:'Evidence';label:string;description:string;sourceFaction:string;reformFaction:string;unlock:string;books:string[];hold:string[];turns:number;radius:number;reformChance:number;traitChance:Record<string,number>;loyalLoss:number}
export interface KinshipMemory {
  rule:string;group:string;contact:boolean;subject?:RumorSubject;regionId?:string;kills:{key:string;target:number;chief:boolean;subject?:RumorSubject;regionId?:string}[]
  returning?:boolean;dispatched?:number
}
export interface SupplyContractDef extends DefBase {
  defType: 'SupplyContract'
  label: string
  refreshDays: number
  deadlineDays: number
  baseReward: number
  threatReward: number
  wealthMult: number
  freshness: number
  durability: number
  reputation: number
  requests: {key:string;label:string;item:string;count:number;threat:number}[]
}
export interface ContractLedger {
  id:string;label:string;reward:number;reputation:number
  site:string;faction:string;issuer:string;accepted:number;deadline:number;escrow:number
  status:'active'|'completed'|'cancelled'|'expired';closed?:number
}
export interface SupplyContract extends ContractLedger {
  kind?:'supply'
  template:string;item:string;count:number;deadlineTurns:number;freshness:number;durability:number
}
export interface InvestigationDef extends DefBase {
  defType:'Investigation'
  label:string;refreshDays:number;deadlineBufferDays:number;baseReward:number;distanceReward:number
  threatReward:number;threatPerDepth:number;wealthMult:number;reputation:number
}
export interface InvestigationContract extends ContractLedger {
  kind:'investigate';rumor:string;region:string;mapId:string;roomIdx:number;roomName:string
  rect:{x:number;y:number;w:number;h:number};distance:number;travelHours:number
  proof?:{turn:number;result:'confirmed'|'disproved';observedRoom?:string}
}
export interface BountyContractDef extends DefBase {
  defType:'BountyContract';label:string;refreshDays:number;deadlineBufferDays:number
  baseReward:number;distanceReward:number;threatReward:number;wealthMult:number;reputation:number
  targets:{key:string;label:string;region:string;mapId:string;source:string;waypoint:string;threat:number;allegation?:{faction:string;chance:number}}[]
}
export interface BountyContractRecord extends ContractLedger {
  kind:'eliminate';template:string;region:string;mapId:string;source:string;distance:number
  /** 실제 원래 명단. 숨은 인원 수나 위치를 화면에 공개하지 않는다. */
  targets:number[]
  evidence:{id:number;at:number;kind:'kill'|'foundDead';mapId:string;region?:string;observed?:boolean}[]
  claimedFaction?:string
  testimony?:{id:number;name:string;faction:string;at:number;region:string;mapId:string}
  outcome?:'killed'|'alreadyDead'|'contradicted'
}
export interface RescueRemainsDef extends DefBase {defType:'RescueRemains';label:string;surveyTurns:number;minDurability:number}
export interface RescueContractDef extends DefBase {defType:'RescueContract';label:string;refreshDays:number;deadlineBufferDays:number;baseReward:number;distanceReward:number;threatReward:number;threat:number;wealthMult:number;reputation:number}
export interface RescueContractRecord extends ContractLedger {kind:'rescue';witness?:{at:number;fromId:number;fromName:string;kind?:'interrogation'};relic?:{at:number;uid:number;def:string};relicRecipient?:{at:number;uid:number;def:string};person:number;name:string;region:string;mapId:string;mapName:string;pos:Pos;ropeUid:number;observedAt:number;distance:number;proof?:{at:number;by:number;ropeUid:number};returned?:{at:number;person:number;region:string;mapId:string}}
export interface RecoveryContractDef extends DefBase {defType:'RecoveryContract';label:string;refreshDays:number;deadlineBufferDays:number;baseReward:number;distanceReward:number;threatReward:number;wealthMult:number;reputation:number;minDurability:number;targets:{key:string;label:string;region:string;mapId:string;pos:[number,number];terrain:string;item:string;threat:number}[]}
export interface RecoveryContractRecord extends ContractLedger {kind:'recover';template:string;region:string;mapId:string;pos:Pos;terrain:string;item:string;itemUid:number;observedAt:number;distance:number;minDurability:number;recipient?:{at:number;uid:number;def:string}}
export interface NpcCareDef extends DefBase {defType:'NpcCare';bondBonus?:number;label:string;enabled:boolean;sourceRules:string;minBond:number;minMedicine:number;minBleed:number;minKcal:number;maxWaterDeficit:number;maxFatigue:number;minBodyTemp:number;maxBodyTemp:number;witnessRange:number;historyLimit:number}
export interface ResidentCultivationDef extends DefBase {defType:'ResidentCultivation';preparation?:{factions:string[];recipe:string;reserveMoney:number;maxUnitPrice:number;retryTurns:number};surplus?:{reserveKcal:number;retryTurns:number;maxUnits:number};label:string;enabled:boolean;roles:CreatureDef['ai'][];homeRadius:number;doseMl:number;waterBelowMl:number;reserveWaterMl:number;minKcal:number;maxWaterDeficit:number;maxFatigue:number;minBodyTemp:number;maxBodyTemp:number}
export interface NpcCareRecord {at:number;by:number;patient:number;woundId:number;materialUid:number;quality:number}
export interface NpcIdentityDef extends DefBase {defType:'NpcIdentity';label:string;enabled:boolean;bodies:string[];names:string[];format:string}
export interface NpcIdentity {site:string;role:string;givenName:string;name:string;bornAt:number;introducedAt?:number}
export interface NpcSocialReportDef extends DefBase {defType:'NpcSocialReport';label:string;sourceRules:string;positiveAt:number;negativeAt:number;maxPeople:number}
export interface NpcRelationshipReport {at:number;source:number;fromName:string;people:{person:number;name:string;observedAt:number;attitude:'friendly'|'familiar'|'strained';lastKind:'talk'|'clash'|'care'}[]}
export interface NpcSocialDef extends DefBase {defType:'NpcSocial';label:string;enabled:boolean;roles:CreatureDef['ai'][];intervalTurns:number;range:number;witnessRange:number;minKcal:number;maxWaterDeficit:number;maxFatigue:number;minBodyTemp:number;maxBodyTemp:number;baseDelta:number;sharedTraitBonus:number;gainPerDay:number;lossPerDay:number;min:number;max:number;minSpeakScore:number;personalityRules:string;historyLimit:number}
export interface NpcTie {name:string;score:number;since:number;lastAt:number;day:number;gained:number;lost:number;events:{at:number;kind:'talk'|'clash'|'care';delta:number;mapId:string;region?:string}[]}
export interface ExcavationContractDef extends DefBase {defType:'ExcavationContract';label:string;refreshDays:number;deadlineBufferDays:number;baseReward:number;distanceReward:number;threatReward:number;wealthMult:number;reputation:number;workTurns:number;tool:string;minDurability:number;targets:{key:string;label:string;region:string;mapId:string;layout:string;pos:[number,number];terrain:string;item:string;threat:number}[]}
export interface ExcavationContractRecord extends ContractLedger {kind:'excavate';template:string;region:string;mapId:string;pos:Pos;terrain:string;item:string;distance:number;minDurability:number;work?:{toolUid:number;toolDef:string;signature:string;rule:string;progress:number;total:number};proof?:{at:number;by:number;result:'found'|'empty';uid?:number};recipient?:{at:number;uid:number;def:string}}
export interface EscortContractDef extends DefBase {defType:'EscortContract';label:string;routeRules:string;refreshDays:number;deadlineDays:number;baseReward:number;reputation:number;followDistance:number;maxFollowDistance:number}
export interface EscortContractRecord extends ContractLedger {kind:'escort';template:string;region:string;mapId:string;passenger:number;passengerName:string;points:{label:string;pos:Pos}[];visits:{at:number;by:number;passenger:number;index:number;playerPos:Pos;passengerPos:Pos}[]}
export interface PatrolContractDef extends DefBase {defType:'PatrolContract';label:string;refreshDays:number;deadlineDays:number;baseReward:number;threatReward:number;wealthMult:number;reputation:number;routes:{key:string;label:string;region:string;mapId:string;anchor:{pos:[number,number];terrain:string};threat:number;points:{label:string;pos:[number,number]}[]}[]}
export interface PatrolContractRecord extends ContractLedger {kind:'patrol';template:string;region:string;mapId:string;points:{label:string;pos:Pos}[];visits:{at:number;by:number;index:number;pos:Pos}[]}
export interface SourceContractDef extends DefBase {defType:'SourceContract';label:string;refreshDays:number;deadlineBufferDays:number;baseReward:number;distanceReward:number;threatReward:number;wealthMult:number;reputation:number;targets:{key:string;label:string;region:string;mapId:string;source:string;waypoint:string;device:string;operation:string;threat:number}[]}
export interface SourceContractRecord extends ContractLedger {kind:'sealSource';template:string;region:string;mapId:string;source:string;device:string;deviceUid:number;operation:string;pos:Pos;distance:number;proof?:{at:number;by:number;deviceUid:number;result:'sealed'|'alreadyClosed'}}
export interface MapSurveyContract extends ContractLedger {worldSurvey?:{center:Pos;radius:number};worldRecipient?:{paperUid:number;at:number;document:WorldMapDocument};kind:'surveyMap';region:string;mapId:string;distance:number;minReliability:number;minFeatures:number;recipient?:{paperUid:number;at:number;document:MapDocument}}
export type ContractRecord=ExcavationContractRecord|EscortContractRecord|PatrolContractRecord|SupplyContract|InvestigationContract|MapSurveyContract|BountyContractRecord|SourceContractRecord|RecoveryContractRecord|RescueContractRecord
export interface SettlementMarket {
  adoptedStockAdditions?:string[]
  mobile?:boolean
  worldCell?:Pos
  site: string
  stockDef: string
  items: ItemInst[]
  money: number
  day: number
  nextRestock: number
  haggle?: { day: number; rounds: number; successes: number; irritation: number; refusedUntil: number }
}

export type Commodity = 'Food' | 'Fuel' | 'Metal' | 'Medicine' | 'Ammo' | 'Salt'
export interface RoadRaidRules {source:string;faction:string;waypoint:string;containerTerrain:string;sourceRadius:number;territoryCells:number;firstDay:number;minMembers:number;maxMembers:number;hostileAt:number;chancePerMember:number;guardReduction:number}
export interface WorldRaid {id:string;source:string;target:string;leader:number;members:number[];homes:CaravanHome[];position:Pos;route:Pos[];index:number;phase:'departing'|'outbound'|'patrolling'|'engaged'|'returning'|'arriving'|'completed'|'dispersed';actors?:Creature[];deployed?:boolean;nextMove:number;departed:number;leftAt?:number;encounteredCell?:Pos;pausedTurns?:number;patrolUntil?:number;strength:number;stolen:{by:number;uid:number;def:string;count:number}[];cash?:number;robbedAt?:number;checkedDay?:number;targetCargo?:number[];lastSeen?:Pos;searchStep?:Record<number,number>;looted?:number[];delivered?:number[];returned?:number}
export interface CaravanRules {encounterStopTurns:number;intervalDays:number;feePerCell:number;wallet:number;maxGuards:number;grid:[number,number];maxUnits:number;items:string[]}
export interface CaravanHome {id:number;pos:Pos;home?:Pos;room?:number;mapId?:string;traderSite?:string;residentSite?:string}
export interface CaravanState {robbedBy?:string;id:string;origin:string;destination:string;leader:number;members:number[];homes:CaravanHome[];market:string;position:Pos;route:Pos[];index:number;nextMove:number;phase:'departing'|'outbound'|'returning'|'arriving'|'completed'|'raided';actors?:Creature[];deployed?:boolean;pausedTurns?:number;encounteredCell?:Pos;stopUntil?:number;leftAt?:number;noticedAt?:number;lost?:number[];departure:number;arrival?:number;returned?:number;item:string;quantity:number;predictedProfit:number;fee:number;capital:number;paid:number}
export interface WorldSimulationDef extends DefBase {
  nutritionKcalPerFoodUnit?:number
  seasonalProduction?:{factions:string[];seasons:Record<string,Partial<Record<Commodity,number>>>}
  rumors?:RumorNetworkRules
  roadRaids?:RoadRaidRules
  caravans?:CaravanRules
  defType: 'WorldSimulation'
  factionStock?: Record<string, Partial<Record<Commodity, number>>>
  factionProduction?: Record<string, Partial<Record<Commodity, number>>>
  referencePopulation: number
  defaultPopulation: Record<string, number>
  stock: Partial<Record<Commodity, number>>
  stockTarget: Partial<Record<Commodity, number>>
  production: Partial<Record<Commodity, number>>
  consumption: Partial<Record<Commodity, number>>
  items: Record<string, { commodity: Commodity; units: number }>
  disease: { def: string; quarantineAt: number; travelMult: number; medicineMult: number; contacts: number; transmission: number }
}
export interface PopulationState {
  total: number
  S: number
  I: number
  R: number
  deaths: number
  infectionCarry: number
  recoveryCarry: number
  deathCarry: number
}
export interface WorldSettlement {
  /** 실제 새 정산에서 공개한 배급 공고의 마지막 상태. 구형 이력을 소급하지 않는다. */
  supplyNotice?: { day: number; unmet: boolean }
  /** 마지막 완료일의 실제 공동 소비 정산. 과거 미기록 날짜는 소급하지 않는다. */
  lastSupply?: { day: number; population: number; commodities: Partial<Record<Commodity, SettlementSupplyLine>> }
  residentDeaths?: number[]
  residentConsumption?: { day: number; units: Partial<Record<Commodity, number>> }
  site: string
  population: PopulationState
  reserve: Partial<Record<Commodity, number>>
  target: Partial<Record<Commodity, number>>
  production: Partial<Record<Commodity, number>>
  consumptionCarry: Partial<Record<Commodity, number>>
  quarantined: boolean
  changes: { day: number; kind: 'quarantine' | 'reopen'; applied: boolean;publicAnnounced?:boolean }[]
  playerEntryDay?: number
}
export interface SettlementSupplyLine {
  produced: number
  requested: number
  supplied: number
  unmet: number
  residentUsed: number
}
export type RumorDistortion='count'|'place'|'faction'|'when'
export interface RumorNetworkRules {landRoutes?:boolean;publicNames?:boolean;firstImpressionCap?:number;publicOutbreaks?:boolean;publicFoodSupply?:boolean;cellsPerDay:number;chatterDays:[number,number];accuracyLoss:[number,number];minAccuracy:number;maxAgeDays:number;neighbors:number;countMultiplier:number;distortionWeights:[number,number,number,number,number];suspicionPerPer:number;factions:string[]}
export interface RumorPacket {key:string;from:string;to:string;due:number;rumor:Rumor}
export interface RumorNetworkState {towns:Record<string,Rumor[]>;pending:RumorPacket[];seen:Record<string,number>;sent:Record<string,number>}
export interface WorldSimulationState { nextItemId?: number; marketDay: number; day: number; settlements: Record<string, WorldSettlement> }

export type DrugFamily = 'analgesic' | 'alcohol' | 'stimulant'
export interface DrugDef extends DefBase {
  thought?: string
  curesDisease?:string
  defType: 'Drug'
  label: string
  durationTurns: number
  family?: DrugFamily
  pain: number
  consciousness: number
  breathing: number
  sleep: number
  fatigue: number
  reaction: number
  bleedMult: number
  tolerance: number
  addiction: number
  antibiotic?: number
  reboundFatigue?: number
  coldAwareness?: number
  heatLossMult?: number
  wakeThreshold?: number
  febrileCooling?: number
  emptyNausea?: number
  dysenteryRisk?: number
  constipation?: boolean
  external?: boolean
  applyTurns?: number
  irritation?: number
  water?: number
  forceSleep?: boolean
  fillEnergy?: boolean
  stress?: number
}
export interface PharmacologyDef extends DefBase {
  alcoholMoods?: number[]
  withdrawalMoods?: number[]
  defType: 'Pharmacology'
  families: Record<DrugFamily, { decay: number; withdrawalTurns: number }>
  withdrawalStageTurns: number
  withdrawalMood: number
  withdrawalPain: number
  severeAnalgesicPain: number
  withdrawalManipulation: number
  withdrawalSleep: number
  recoveryTurns: number
  abstinentChance: number
  overdoseAt: number
  overdoseBreathing: number
  overdoseCheckTurns: number
  overdoseFaintChance: number
  deliriumCheckTurns: number
  deliriumFaintChance: number
  nauseaTurns: number
  constipationTurns: number
}
export interface DrugDose { def: string; until: number; potency: number; amount?: number; source?: string; sourceKnown?: boolean }
export interface DrugState {
  active: DrugDose[]
  tolerance: Partial<Record<DrugFamily, number>>
  lastDose: Partial<Record<DrugFamily, number>>
  addicted: DrugFamily[]
  recovered?: DrugFamily[]
  toleranceAt: number
  revision: number
  lastChecks?: { overdose?: number; delirium?: number }
}

export type InteractionEvent='waterBoil'|'waterCloth'|'waterCharcoal'|'waterSettle'|'waterPill'|'beddingIgnites'|'beddingExtinguished'|'foodSalted'|'foodSmoked'|'foodDried'|'foodFermented'
export interface InteractionDef extends DefBase {defType:'Interaction';label:string;category:string;event:InteractionEvent;formula:string;waterTreatment?:WaterTreatment}
export interface InteractionDiscovery {id:string;at:number;method:'experience'|'witness'|'book'|'rumor';source:string;map:string;region?:string}

export interface CartographyDef extends DefBase {worldScouting?:{radius:number;maxCells:number};worldPrices?:{basePrice:number;pricePerCell:number};worldCommission?:{radius:number;minCells:number;reward:number};worldWriting?:{maxCells:number;maxError:number};fraud?:{factions:string[];chance:number;facilityCount:[number,number];labels:string[];reliability:number};independent?:{worldMaps?:boolean;readMarketMaps?:boolean;shopSupplies?:boolean;minFeatures:number;basePrice:number;pricePerFeature:number};defType:'Cartography';label:string;noteReliability:number;noteError:number;writing?:{paper:string;ink:string;turns:number;minLiteracy:number;baseReliability:number;perMastery:number;baseError:number;errorEvery:number;minManipulation:number};commission?:{refreshDays:number;deadlineBufferDays:number;baseReward:number;distanceReward:number;depthReward?:number;minReliability:number;minFeatures:number;reputation:number}}
export interface WorldMapDocument {surveyedAt?:number;commission?:string;title:string;author:string;worldSeed:string;w:number;h:number;writtenAt:number;reliability:number;error:number;cartographer:{id:number;name:string;seed:string};cells:{x:number;y:number;seenAt:number;cell:WorldObservation['cell']}[]}
export interface MapDocument {landmarks?:{x:number;y:number;kind:'water';label:string}[];title:string;author:string;mapId:string;kind:'surface'|'dungeon';depth:number;w:number;h:number;writtenAt:number;reliability:number;error:number;cartographer?:{id:number;name:string;seed:string};commission?:string;surveyedAt?:number;stairs?:{x:number;y:number;label:string}[];rooms:{roomIndex?:number;type?:string;name:string;x:number;y:number;w:number;h:number}[]}

export interface ResearchStep {id:string;label:string;text:string;books?:string[];notes?:string[];dissections?:string[];disclosure?:string}
export interface ResearchThread {id:string;label:string;steps:ResearchStep[]}
export interface KnowledgeDef extends DefBase {
  research?:ResearchThread[]
  pillAging?: { minPotency: number; maxPotency: number; spoilChance: number; spoiledEffect: string; spoiledAmount: number; noticePer: number }
  appraisal?:{feeRate:number;honesty:number;relationPerPoint:number;factionHonesty:Record<string,number>}
  defType: 'Knowledge'
  examineTurns: number
  tasteTurns: number
  tasteFraction: number
  tasteBonus: number
  baseChance: number
  chancePerPoint: number
  minChance: number
  maxChance: number
  masteryScore: number
  defaultDifficulty: number
  noticeablePain: number
  pageTurns: number
  literacySpeed: number[]
  misreadChance: number
  literacyBooks: number
}
export interface PillBelief {
  belief?: string
  confidence: 'unknown' | 'likely' | 'certain'
  ruledOut: string[]
  evidence: { turn: number; method: 'use' | 'taste' | 'examine' | 'book' | 'merchant'; text: string }[]
}
export interface BestiaryDef extends DefBase {
  defType: 'Bestiary'
  observeTurns: number
  encounterCount: number
  encounterGap: number
  fightClearTurns: number
  rangeWidth: [number,number]
  perRange: number
  keenRange: number
  dissectTurns: number
  dissectBase: number
  dissectMastery: number
  dissectPer: number
  dissectMin: number
  dissectMax: number
  autoDissectAfter: number
  failedYield: number
  toolBonus: number[]
  tabooThought: string
  tabooLoss: number
}
export interface BestiaryEntryDef extends DefBase {
  defType: 'BestiaryEntry'
  label: string
  creatures: string[]
  kind: 'animal' | 'human' | 'unavailable' | 'machine' | 'swarm'
  difficulty: number
  silhouette: string
  yields: { item: string; count: number }[]
  facts: string[]
}
export interface BestiaryRecord {
  swarmExposureAt?:number
  seen: number
  fought: number
  killed: number
  dissected?: number
  specimen?: { def: string; blood: number; maxHp: Record<string,number> }
  observeTurns?: number
  encounters?: number
  lastSeen?: number
  observedAt?: number
  survived?: boolean
  literature?: string[]
  fights?: { id: number; map: string; lastTurn: number }[]
}
export type AnyDef =
  | SwarmDef
  | SaveModeDef
  | PostureDef
  | ManeuverDef
  | NpcCareDef | ResidentCultivationDef | ExcavationContractDef | EscortContractDef | NpcIdentityDef | NpcSocialReportDef | NpcSocialDef | PatrolContractDef | PrisonerExchangeDef | RansomDef | NpcAbductionDef | RescueRemainsDef | RescueContractDef | RecoveryContractDef | SourceContractDef | CartographyDef | InteractionDef | NpcPsycheDef | RegionLayoutDef | KinshipDef | FieldDeviceDef | EvidenceDef | RetirementDef
  | BodyDef | WoundDef | ItemDef | CreatureDef | TerrainDef | LootTableDef | TraitDef
  | BackgroundDef | FatigueDef | ThoughtDef | EventDef | PillEffectDef | SkillDef | AbilityDef | DiseaseDef | BreakDef | RecipeDef | MaterialDef | TraumaDef | GrowthDef | RecoveryDef | SurgeryDef | ProcedureDef | NutritionDef | FoodSafetyDef | WaterSafetyDef | ProstheticDef | WorldGenDef | BiomeDef | RegionSiteDef | SeasonDef | WeatherDef | ClimateDef | FactionDef | DiplomacyDef | EconomyDef | TraderStockDef | WorldSimulationDef | DrugDef | PharmacologyDef | KnowledgeDef | BestiaryDef | BestiaryEntryDef | ClinicDef | InnDef | HandHygieneDef | NpcRestDef | ResidentProvisionDef | ResidentWaterDef | ResidentPurificationDef | TeacherDef | ResidentWarmthDef | BeddingMoveDef | SupplyContractDef | BountyContractDef | InvestigationDef | FactionRelationsDef | ColdConfusionDef | CompanionDef | CompanionBondDef | PrisonerDef | PrisonerCareDef | PrisonerEscortDef | RecruitmentDef | RescueDef | NpcCustodyDef | BaseCampDef | BaseDefenseDef | BaseLogisticsDef | BaseWaterDef | BaseRestDef | CampfireDef | BeddingContactDef | GearWeatherDef | MaterialCraftingDef

// ───────────── 런타임 상태 (직렬화 가능) ─────────────

export interface ItemInst {
  toxin?:ToxinCoating
  loadedAmmoToxin?:ToxinCoating
  /** 실제 내부 물품. 능력치와 격자 크기는 Def에서 읽는다. */
  contents?: ItemInst[]
  /** 원래 인스턴스 상태만 보관한다. Def의 전투/음식 수치를 복사하지 않는다. */
  missingItem?:{def:string;size:[number,number];maxStack:number;label:string;storage?:[number,number];original:ItemInst}
  beddingLice?:BeddingLice
  beddingScorch?:number
  stuff?: Stuff
  uid: number
  def: string
  count: number
  /** 배낭 격자 위치 */
  gx?: number
  gy?: number
  /** 90° 돌려 놓았는가 (13 §3, CANON D16) */
  rot?: boolean
  /** 입다가 끊겨 반쯤 걸친 상태: 방어·단열 50% (13 §6.1) */
  half?: boolean
  dressProgress?:{kind:'equip'|'unequip';left:number;total?:number}
  /** 품질 0 조악 · 1 보통(기본) · 2 좋음 · 3 뛰어남 · 4 명품 · 5 전설 (08 §4) */
  quality?: number
  /** 내구 % 0~100 (08 §5) */
  durability?: number
  maxDurability?: number
  edgeWear?: number
  bowMoisture?: number
  bowBroken?: boolean
  bowUnstrung?: boolean
  elasticity?: number
  waxedUntil?: number
  oiledUntil?: number
  corrosion?: number
  rust?: number
  partDurability?: Record<string, number>
  partCorrosion?: Record<string, number>
  partRust?: Record<string, number>
  /** 날 상태 % 0~100 (08 §5) */
  edge?: number
  fuel?: number
  lit?: boolean
  /** 일부만 남은 알약. 분수 정제는 count1이며 더미에 합치지 않는다. */
  pillRemaining?: number
  /** 같은 발굴 더미의 효력0~100%와 변질. 필드 없는 과거 정제는 기존100% 효과를 보존한다. */
  pillAge?: { potency: number; spoiled: boolean }
  uses?: number
  dirty?: boolean
  readPages?: number
  readProgress?: number
  lostPages?: number
  cookProgress?: number
  foodBurnt?: boolean
  foodWater?:{quality:WaterQuality;ml:number}
  cropHarvest?:{owner:number;seedUid:number;def:string;terrain:string;map:string;region:string;at:number}
  foodQ?: number
  brokenRelic?: boolean
  appraisal?: 0 | 1 | 2
  maintenanceRemaining?: number
  powerRemaining?: number
  water?: WaterQuality
  waterSettlesAt?: number
  waterFrozen?: boolean
  loadedAmmo?: string
  loadedAmmoFletching?: boolean
  /** 장전으로 옮긴 실제 한 발. 두 실물의 UID/상태를 그대로 저장한다. */
  loadedRound?: { ball: ItemInst; powder: ItemInst }
  /** 탄창에 옮긴 실제 실탄. 배열 앞의 한 발부터 사용한다. */
  loadedCartridges?: ItemInst[]
  powderWetness?: number
  firearmFouling?: number
  firearmJammed?: boolean
  fletchingDamaged?: boolean
  freshness?: number
  /** Per piece ash exposure carried from actual processed ingredients. */
  contaminantAsh?:number
  foodVesselDef?:string
  foodHeatedAt?:number
  foodSaltGrams?:number
  foodAgedAt?: number
  /** 장비가 마지막으로 실제 환경 노출을 정산한 게임 턴 */
  gearAgedAt?: number
  /** 원래 한 조각보다 작아진 실제 원재료 조각의 질량. count는 같은 크기 조각 수다. */
  rawGrams?:number
  rawMaterial?:string
  foodFrozen?: boolean
  foodThawed?: boolean
  foodWet?: boolean
  foodLeftover?: boolean
  foodSealed?: boolean
  /** 영역별 젖음 %. 긴 코트도 물에 잠긴 다리 부분만 젖는다 */
  wetness?: Partial<Record<ThermalRegion, number>>
  /** 쪽지 내용 (06 §7.0) */
  note?: Rumor
}

export type FractureGrade = 'hairline' | 'simple' | 'compound'

export interface Wound {
  /** 현재 실제 출혈을 이미 본 인물. 출혈이 멎은 실제 턴에 지운다. */
  bloodSeenBy?: number[]
  patched?: boolean
  id: number
  def: string
  part: string
  /** 정수 피해 D (02 §4) */
  severity: number
  healed: number
  /** 상처 출혈 ml/턴 (응고 대상) */
  bleed: number
  /** 동맥 출혈 ml/턴 (자연 응고 없음, 02 §6) */
  artery?: number
  arterial: boolean
  internal: boolean
  /** 골절: 등급과 치유 진행 0~1 (02 §9) */
  fracture?: { grade: FractureGrade; progress: number }
  splint?: { quality: number; half?: boolean }
  /** 붕대: 처치 품질 Q, 감은 시각, 응급 처치 보너스 (02 §6 · 15 §6.6) */
  bandage?: { quality: number; at: number; dirty?: boolean; firstAid?: number }
  /** 힘줄 절단 (효율 상한 0.5) */
  tendon?: boolean
  tendonAt?: number
  diseaseRisk?:{def:string;checked?:boolean}[]
  foreign?: { kind: 'arrow' | 'fragment' | 'bullet'; ammo?: string; fletchingDamaged?:boolean; contam: number; pain: number }
  dislocated?: boolean
  stumpLimb?: string
  biteCareUntil?:number
  mergedIds?:number[]
  cauterizedAt?:number
  cauterized?: boolean
  /** 오염 0~100 (02 §10.1) */
  contam: number
  infection?: { progress: number; immunity: number; sepsis?: number }
  infectionChecked?: boolean
  ageTurns: number
  source: string
  /** 상처를 낸 개체 id (사망 원인 기여, 15 §3) */
  sourceId?: number
  scar?: boolean
  topicalDrug?: { def: string; until: number }
  suture?: { def: string; quality: number; at: number }
  ligated?: boolean
  washedAt?: number
  thawed?: boolean
}

export interface BodyState {
  brainRecovery?:{part:string;wound:number;at:number;lowestHp:number}[]
  inhaledAsh?:number
  machine?: MachineState
  def: string
  blood: number
  bloodMax: number
  /** 부위별 최대 hp (hpMult 반영) */
  maxHp: Record<string, number>
  missing: string[]
  wounds: Wound[]
  scars?: { part: string; severity: number; cap: number; burn: boolean; at: number; source: string }[]
  chronicPain?: string[]
  damagedTendons?: string[]
  tendonSince?: Record<string, number>
  amputationQuality?: Record<string, number>
  concussionEvents?: number[]
  concussionCap?: number
  prosthetics?: Record<string, ProstheticState>
  organDamage?: Record<string, number>
  nerveDamage?: Record<string, number>
  nerveClock?: Record<string, { since: number; applied: number }>
  /** 지혈대: 그 팔·다리의 상완/대퇴 id → 감은 시각(turn) */
  tourniquets: Record<string, number>
  pressing?: number // 압박 중인 wound id (이번 턴)
}

export type ThermalRegion = 'torso' | 'arms' | 'legs' | 'head' | 'hands' | 'feet'

export interface Needs {
  starvationEpisode?:{since:number;lastAt:number;rolledAt?:number}
  /** 칼로리 균형 B:0기준, 양수 잉여·음수 결손 (03 §3) */
  kcal: number
  /** 수분 결손 D(ml):0충분, 소비하면 증가한다 */
  waterDeficit: number
  dietHistory?:{at:number;kcal:number;proteinKcal:number}[]
  lastDietMeal?:{at:number;kcal:number;proteinKcal:number;uid?:number;def?:string}
  protein: number
  vitamin: number
  hygiene: number
  nutritionDay: number
  kcalRemainder: number
  waterRemainder: number
  scurvy: number
  ash?: number
  waterExposure?: { ml: number; pathogenMl: number }
  lastMealKcal?: number
  poisoning?: { until: number; vomitAt: number[] }
  nutritionFatal?: '아사' | '괴혈병'
  fatigue: number
  bodyTemp: number
  wetness: number
  /** 기본 옷·맨살의 영역별 젖음. 없으면 옛 세이브의 wetness에서 초기화 */
  skinWetness?: Partial<Record<ThermalRegion, number>>
  /** 10분 체온 틱 사이의 노출 누적. 저장 후에도 남은 시간을 유지한다 */
  thermal?: { turns: number; delta: number }
  energy: number
  stress: number
  sleepDebt?: number
}

export interface Effect { kind: string; untilTurn: number; magnitude?: number; sourceUid?:number; sourceId?:number; sourceDef?:string }

export interface Thought { def: string; untilTurn: number; count: number; events?: { at: number; untilTurn: number; mood?: number }[] }

export interface Activity {
  /** Explicit one-off companion consultation, bound to the original clinical policy. */
  companionClinical?:string
  companionCarePlan?:number
  brushCut?:{map:string;region?:string;toolUid:number;signature:string}
  containerPry?:{map:string;region?:string;terrain:string;toolUid:number;signature:string;method?:'pick'}
  npcCare?:{provider:number;patient:number;woundId:number;materialUid:number;startedAt:number}

  excavation?:{contract:string;progress:number;mapId:string;region:string}

  ransom?:{exchange?:{person:number;ropeUid:number;pos:Pos};payer:number;holder:number;person:number;ropeUid:number;price:number;mapId:string;region?:string;payerPos:Pos;holderPos:Pos;personPos:Pos}
  recoveryContract?:string
  cookQualityBase?:number
  brew?:{leafUid:number;leaves:{uid:number;def:string;count:number}[];sourceDef:string;ml:number;quality:WaterQuality;signature:string;fireUid:number;firePos:Pos}
  gatherRule?:string
  animalForage?:boolean
  needleRule?:string
  foodMealTarget?:number
  foodOpening?:{toolUid:number;def:string;signature:string;eatTarget?:number}
  maskSignature?:string
  maskUses?:number
  waterRescue?:{target:number;from:Pos;to:Pos;provider:Pos}
  beaconWork?:{kind:'fuel'|'send';source:BeaconAddress;signature:string;fuelUid?:number;to?:BeaconAddress;toSignature?:string;rumor?:Rumor}
  parasiteRemoval?:{host:number;parasite:number;method:'salt'|'manual';saltUid?:number;signature:string}
  vesselRepairSignature?:string
  deviceUid?:number
  deviceDef?:string
  deviceOperation?:string
  deviceMap?:string
  deviceProgress?:number
  machineOperation?: MachineOperation
  machineId?: number
  machinePart?: string
  baseOrder?:number
  recruiterId?:number
  recruitmentProfile?:string
  recruitAt?:number
  recruitDay?:number
  gearWork?:number
  gearPairUid?:number
  gearSwap?:GearSwapState
  dropAfter?:boolean
  furniture?: { terrain: string; item: string; base: string; uid?: number; owner?: number }
  teacherId?: number
  learnerId?: number
  lessonAt?: number
  lessonDay?: number
  course?: string
  /** 타인 처치: 도구/숙달은 활동 주인, 몸은 patientId. 대기 활동은 healerId를 참조한다. */
  ammoToxin?:ToxinCoating
  patientId?: number
  healerId?: number
  /** 실제로 진행한 마지막 부목 작업의 품질. 중단 뒤 이미 묶인 부분에 적용한다. */
  lastTreatQuality?: number
  supplies?: { uid: number; def: string; count: number; uses?: number }[]
  drugSleep?: boolean
  prostheticDef?: string
  prostheticOperation?: ProstheticOperation
  waterTreatment?: WaterTreatment
  waterBatches?:number
  waterTools?:{uid:number;count:number}[]
  waterCollectCapacity?:number
  waterSignature?:string
  waterUses?: number
  waterQuality?: WaterQuality
  care?: 'wax' | 'oil' | 'sharpen' | 'string' | 'unstring'
  firearmCare?: 'clean' | 'unjam'
  reloadUnitTurns?: number
  prisonerOperation?:PrisonerOperation
  prisonerId?:number
  fireUid?:number
  fireHot?:boolean
  beddingWash?:{map:string;terrain:string;uid?:number}
  companionAid?:boolean
  aidOrigin?:{actor:Pos;patient:Pos}
  surveyTarget?:number
  surveyRule?:string
  seasonalSleep?:{season:string;startedAt:number}
  kind: 'survey' | 'rescueDrag' | 'clearBrush' | 'magazineReload' | 'firearmCare' | 'pryContainer' | 'excavate' | 'ransom' | 'ransomWait' | 'washBedding' | 'brewTea' | 'gatherNeedles' | 'foodMeal' | 'openFood' | 'respirator' | 'waterRescue' | 'beaconWork' | 'parasiteRemoval' | 'boatCare' | 'discloseEvidence' | 'deviceWork' | 'machineCare' | 'gearSwap' | 'fire' | 'claimBase' | 'recruitInvite' | 'recruit' | 'recruitWait' | 'struggle' | 'prisoner' | 'pray' | 'rest' | 'sleep' | 'search' | 'examine' | 'press' | 'equip' | 'unequip' | 'treat' | 'aim' | 'strip' | 'read' | 'cook' | 'dry' | 'drawMap' | 'drawWorldMap' | 'craft' | 'repair' | 'salvage' | 'gather' | 'gearCare' | 'reload' | 'wash' | 'water' | 'prosthetic' | 'travel' | 'breakIce' | 'collectSnow' | 'medicate' | 'taste' | 'dissect' | 'careWait' | 'diagnose' | 'dose' | 'washHands' | 'teach' | 'lessonWait' | 'warm' | 'packFurniture'
  evidence?:{rule:string;signature:string;target:number;map:string;held:{uid:number;def:string}[]}
  remaining: number
  /** 시작 때 정한 전체 턴 */
  total?: number
  /** 처치 종류 */
  treat?: 'bandage' | 'tourniquet' | 'splint' | 'disinfect' | 'cauterize' | 'suture' | 'ligate' | 'tendon' | 'amputate' | 'extract' | 'reduce'
  limb?: string
  /** 채널 능력 id (조준 사격) */
  abilityId?: string
  slot?: Slot
  target?: Pos
  uid?: number
  woundId?: number
  toolUid?: number
  label: string
  /** 중단 판정용: 시작 시점에 보이던 적, 상처 수 */
  seenHostiles?: number[]
  woundCount?: number
  /** 수면: 잠들 때 피로, 굶주림·갈증 단계, 젖음 · 깨운 이유 (01 §8) */
  wakeFatigue?: number
  sleep0?: { fatigue: number; debt?: number; hunger: number; thirst: number; wet: number }
  wokeBy?: string
  /** 자동 모드 중단 판정 스냅샷 (01 §6.2) */
  snap?: import('./autostop').AutoSnap
  /** 진행한 턴 수 */
  elapsed?: number
}

export interface FirstImpression {at:number;score:number;terms:{kind:'modifier'|'hygiene'|'scar'|'prosthetic'|'rumor';value:number}[];attitude:'warm'|'neutral'|'wary';heard?:boolean}

export interface AiState {
  placeEvent?:string
  mode: 'idle' | 'wander' | 'hunt' | 'investigate' | 'flee' | 'eat' | 'surrender' | 'guard' | 'return' | 'patrol' | 'calm'
  /** 사기 사건 (07 §8): 값 · 시각 · 감쇠 방식 */
  mev?: { v: number; t: number; k: 'half30' | 'fixed' | 't20' | 't30' }[]
  /** 궁지: 도주가 결정됐지만 도망칠 수 없다 (명중 +5, 반응 안 함) */
  cornered?: boolean
  /** 마지막 사기 판정 턴 */
  moraleCheck?: number
  target?: number
  dest?: Pos
  lastSeen?: Pos
  path?: Pos[]
  hunger: number
  morale: number
  alertTurn?: number
  /** 장소 사건 임무: 경보(흔적을 보고 귀환) · 수색(흔적 지점 → 보관함) */
  task?: { kind: 'alarm' | 'search' | 'baseRaid'; pos: Pos; stash?: Pos;raidId?:number }
  /** 도주로 시야에서 사라진 턴 (30턴 미귀환 = 도주시킴 경험치, 15 §3) */
  goneSince?: number
  /** 잠든 포자 인간 곁에 머문 턴 */
  nearTurns?: number
  /** 순찰 경로 (경유지 순서) · 현재 지점 · 대기 끝 턴 */
  route?: Pos[]
  routeIdx?: number
  waitUntil?: number
}

export interface MedicalReport {
  at: number
  examinerId: number
  examiner: string
  mastery: number
  quality: number
  findings: string[]
}

export interface Creature {
  foodExposureTraining?:FoodExposureRecord[]
  cullerState?:CullerState
  crawlerState?:CrawlerState
  paralysis?:LocalParalysis[]
  camouflage?:{sourceUid:number;sourceDef:string;appliedAt:number;until:number;sightMult:number;washAt:number;tint:number}
  carcassStock?:Record<string,{remaining:number;original:number;at:number;freshness?:number;foodFrozen?:boolean;foodThawed?:boolean;foodWet?:boolean;foodLeftover?:boolean;foodSealed?:boolean}>
  sowerState?:SowerState
  surveyState?:{call?:{source:number;at:number;expiresAt:number;pos:Pos};target?:number;progress:number;lastObservedAt?:number;nextReportAt:number;flashAt?:number;patrolIndex:number;lastInterrupted?:{at:number;progress:number;target:number}}
  flight?:{startedAt:number;landAt:number;origin:Pos}
  wildlifeState?:{denWarning?:{actor:number;progress:number;at:number};wakeSlowUntil?:number;threatId?:number;lastThreatAt?:number;rutAggressive?:boolean;mudRainRemaining?:number;interest?:{id:number;pos:Pos;at:number;alive:boolean;unconscious:boolean}}
  npcCareHistory?:NpcCareRecord[]
  npcIdentity?:NpcIdentity
  roadRaid?:string
  caravan?:string
  aquatic?:AquaticState
  parasites?:ParasiteAttachment[]
  parasiteMealMl?:number
  fieldNotes?:{key:string;title:string;text:string;turn:number;deviceUid:number;site?:string}[]
  kinship?:KinshipMemory
  captivity?:Captivity
  recruitment?:RecruitmentProgress
  rescue?:RescueRecord
  leading?:{target:number;uid:number;hand:'Left'|'Right'}
  mercy?:{by:number;faction:string;until:number;rewardedBy:number[]}
  prisonerRumor?:Rumor
  prisonerHeardBy?:number[]
  permanentChanges?:{at:number;stat:keyof Stats;before:number;after:number;reason:string;source:string}[]
  knownInteractions?:InteractionDiscovery[]
  knownRumors?:Rumor[]
  npcSocialAfter?:number
  npcTies?:Record<number,NpcTie>
  prisonerSightings?:Record<number,PrisonerSighting>
  abduction?:{target:number;ropeUid:number;boundRopeUid?:number;started:number;region?:string;mapId:string;home:Pos;lastSeen:Pos}
  companionRecovery?:{id:string;itemUid:number;item:string;region:string;mapId:string;pos:Pos;terrain:string;assignedAt:number;phase:'outbound'|'returning'|'failed';reason?:string}
  recoveryCargo?:{id:string;uid:number;item:string}
  companion?: CompanionContract
  coldConfusion?:{checked:number;pending?:{slot:Slot;uid:number;at:number}}
  residentWaterAfter?: number
  residentHygieneAfter?: number
  residentHygieneBed?: { map: string; pos: Pos; terrain: string; uid?: number; sourceAt: number }
  residentPurifyAfter?: number
  residentWarming?: boolean
  residentBedMoveAfter?: number
  residentBedTarget?: Pos
  residentWarmAfter?: number
  residentFuel?: { day: number; units: number }
  residentConsumption?: { day: number; units: Partial<Record<Commodity, number>> }
  residentRation?: { day: number; units: number }
  residentSupplyAfter?: number
  residentCookingSupplyAfter?: number
  residentCookingFire?: {map:string;region:string;pos:Pos;uid:number}
  welcomedActors?:number[]
  expulsion?:{site:string;faction:string;by:number;at:number;leftAt?:number}
  residentPlot?:{pos:Pos;seedUid:number;terrain:string;map:string;region:string}
  residentSite?: string
  residentOriginFaction?:string
  evidenceHeard?:Record<string,{turn:number;source:number;choice:'reform'|'loyal';proofUids:number[]}>
  residentRestAfter?: number
  residentCultivationSupplyAfter?:number
  residentProduceAfter?:number
  residentReturning?: boolean
  hands?: { kind: 'washed' | 'dirty'; at: number }
  medicalReports?: MedicalReport[]
  clinicSite?: string
  clinicSupplyAfter?: number
  bestiary?: Record<string, BestiaryRecord>
  drugs?: DrugState
  money?: number
  traderSite?: string
  met?: boolean
  attackedBy?: number[]
  needWarnings?: Record<string, number>
  id: number
  def: string
  name: string
  sprite: string
  pos: Pos
  facing: number
  faction: string
  nextAct: number
  alive: boolean
  unconscious: boolean
  body: BodyState
  stats: Stats
  /** 숙달 성공 횟수 (medicine·survival) */
  masteryFloor?: Partial<Record<'medicine' | 'survival', number>>
  skills: Record<string, number>
  passions: Record<string, number>
  /** 숙달 카운트 기록 (같은 대상 1회, 시간당 3회) */
  masteryLog?: { keys: string[]; hour: number; inHour: Record<string, number> }
  bookMastery?: Partial<Record<'medicine' | 'survival', number>>
  booksRead?: string[]
  literacyBooks?: string[]
  literacyLessons?: { course: string; days: number[]; teacher: string; at: number }
  misreadBooks?: string[]
  literacy?: number
  traits: string[]
  age?: { years: number; nextBirthday: number; masteryMult: number; jointPain?: boolean; senses?: boolean }
  creationRoll?: 0 | 1
  background?: string
  beddingContact?:{map:string;pos:Pos;terrain:string;uid?:number;sourceAt:number;lastAt:number;turns:number}
  beddingLying?:{map:string;pos:Pos;until:number}
  boilJob?:{batches?:number;fuels?:{uid:number;count:number}[];tools?:{uid:number;count:number}[];uid:number;remaining:number;total:number;sourceDef:string;uses:number;quality:WaterQuality;signature:string;fuelUid?:number;toolUid?:number;heat:{map:string;pos?:Pos;sourceUid?:number;kind?:MapLight['kind'];terrain?:string;held?:number}}
  brewJob?:{uid:number;remaining:number;total:number;brew:NonNullable<Activity['brew']>}
  fieldMaps?:NpcMapMemory[]
  worldScouting?:{seed:string;w:number;h:number;cells:Record<number,WorldObservation>}
  worldMapDrawingJob?:{paperUid:number;inkUid:number;inkCount:number;remaining:number;total:number;signature:string;draft:WorldMapDocument}
  mapDrawingJob?: {paperUid:number;inkUid:number;inkCount:number;remaining:number;total:number;signature:string;region?:string;draft:MapDocument}
  workJob?: WorkJob
  recipes?: string[]
  needs: Needs
  effects: Effect[]
  thoughts: Thought[]
  traumas?: Trauma[]
  nearDeath?: boolean
  firstHumanKill?: boolean
  fearlessAgainst?: string[]
  meatYieldCarry?: Record<string, number>
  /** 배낭(격자) */
  bag: ItemInst[]
  /** 장착 중 */
  equip: Partial<Record<Slot, ItemInst>>
  /** 빠른 슬롯 10칸 */
  hotbar: (HotbarRef | null)[]
  /** 선택한 실제 탄약의 종류/깃 상태. 소진 후 다른 상태로 자동 교체하지 않는다. */
  ammoPreference?: {def:string;fletchingDamaged:boolean;toxin?:boolean}
  hp: number
  level: number
  xp: number
  statPoints: number
  abilityPoints: number
  abilities: string[]
  cooldowns: Record<string, number>
  crouching?: boolean
  sneaking?: boolean
  asleep?: boolean
  /** 실제 횃불 도주에서 배운 상대만. 조회로 과거 학습을 만들지 않는다. */
  animalFear?: {actor:number;until:number}[]
  /** 처음 실제 교전에서 본 전력. 과거 교전은 이 기록 없이 추정하지 않는다. */
  playerEngagement?: {actor:number;at:number;threat:number;ownThreat:number}
  /** 실제로 깨어서 들은 소리만. 위치/원격 개체 정보는 저장하지 않는다. */
  heardThoughts?: {def:string;until:number}[]
  /** 일반 인간NPC의 실제 사건 요약. 전체 사고/과거 사건을 채우지 않는다. */
  npcPsyche?: {history:{at:number;kind:NpcStressKind|'thought';delta:number;source?:number;thought?:string}[];pending?:string;nearDeath?:boolean}
  /** 실제 경과 관찰 시작과 양쪽이 성공한 마지막 대화. 과거를 소급하지 않는다. */
  socialObservation?: { since: number; lastTalk?: number }
  /** 실제 수면 턴에서만 축적하며 모든 기상 경로에서 한 번 소비한다. */
  sleepObservation?: { turns: number; qualityMicros: number; ground: boolean; maxInnerWetness: number }
  /** 깊은 잠 (각성 임계 8, 14 §7.2) */
  deepSleep?: boolean
  home?: Pos
  /** 지연 사망 장기가 멎은 시각 */
  organFailAt?: Record<string, number>
  /** 거주하는 방 번호 (재점거 판정, 14 §9.3) */
  room?: number
  mapId?: string
  ai: AiState
  activity?: Activity
  /** 이번 턴에 공격/방어로 기력을 썼는가 */
  exerted: boolean
  /** 몸 상태 시계: 쇼크·기절·통증 지속 (02 §6.3·§7) */
  cond?: { shock?: boolean; shockOkSince?: number; painHighSince?: number; faintUntil?: number }
  frostbite?: Record<string, { exposure: number; grade: number; frozen: boolean; wound?: number }>
  biteCarrier?:string
  biteRisks?:{def:string;wound:number;part:string;attacker:number;at:number;deadline:number;roll:number;chance:number;mult:number;incubatesUntil:number;washedAt?:number;mitigated?:boolean}[]
  phantomSound?:{map:string;pos:Pos;at:number;until:number}
  hallucinationChecked?:{map:string;at:number}
  firstImpressions?:Record<number,FirstImpression>
  diseaseExposure?:{cold?:string[];lying?:Record<string,number>}
  diseases?: { def: string; incubatesUntil: number; progress: number; immunity: number; onsetNotified?:boolean; source?:{kind:string;turn:number;creature?:number;wound?:number;part?:string;itemUid?:number;foodDef?:string} }[]
  immuneDiseases?: string[]
  lastThreatAt?: number
  breakdown?: { def: string; kind: BreakDef['kind']; until: number; remaining: number; hp: number; dest?: Pos; insultedActors?:number[] }
  goodMoodSince?: number
  lastElationRoll?: number
  lastSafe?: { map: string; pos: Pos }
  psycheWatch?: { lowHp: boolean; blood: boolean; afraid: boolean; severe?: boolean }
  /** 같은 턴 안의 반응 횟수 (07 §2.2 연속 반응 피로) */
  reactions?: { turn: number; n: number }
  /** 반응 정책 (07 §2.2) */
  reactPolicy?: 'block' | 'parry' | 'none'
  /** 고른 공격 방식 id (베기/찌르기) */
  attackMode?: string
  /** 마지막으로 이동한 턴 (원거리 '대상 이동 중' −5) */
  movedTurn?: number
  /** 자유 행동을 쓴 턴 (01 §3.4, 턴당 1회) */
  freeActTurn?: number
  /** 잠기운 끝 턴 (01 §8.3) */
  drowsyUntil?: number
  lastWokeAt?: number
  /** 냄새 누적 (07 §9.2) */
  scent?: number
  scentCarry?: number
  /** 이번 턴에 대기했는가 (기력 회복 ×2) */
  rested?: boolean
  /** 자기 몸을 살핀 턴 (01 §4.1) */
  examinedAt?: number
  /** 소작 인두 가열 진행 (보존, 01 §7) */
  heat?: { done: number; at: number }
  lastAttacker?: string
  killedBy?: string
  deathCause?: string
  deathTurn?: number
  history: HistoryEvent[]
  literate?: boolean
  /** 시체를 처음 뒤졌는가 (13 §8.1: 첫 수색 2턴) */
  dissected?: { success: boolean; yieldMult: number; by: number; at: number }
  searched?: boolean
  /** 이 개체로 경험치를 이미 줬는가 (처치·항복·도주 중 한 번만) */
  xpAwarded?: boolean
  /** 재점거로 들어온 개체 (경험치 ×0.5, 14 §9.3) */
  reoccupied?: boolean
  /** 위기 극복 감시 (15 §3) */
  crisis?: CrisisWatch
}

export interface CrisisWatch {
  /** 종류 → 마지막으로 보상한 게임일 */
  last: Record<string, number>
  arterial: number[]
  bleeding: boolean
  wasUnconscious: boolean
  wokeAt?: number
  infectionWon?: boolean
}

export interface HistoryEvent { turn: number; kind: string; text: string }

export type HotbarRef = { kind: 'ability'; id: string } | { kind: 'item'; def: string; fletchingDamaged?:boolean }

export interface BeddingLice {source:number;at:number;until:number}
export interface Tile {
  gatherStock?:{signature:string;remaining:number;regrowAt?:number;seedUid?:number;season?:string}
  /** 실제 새 지도 생성 때만 잠근다. 구형 상자를 소급해 잠그지 않는다. */
  locked?:boolean
  cultivation?:CultivationState
  cropResidue?:{terrain:string;dose:NonNullable<CultivationState['irrigation']>}
  combustionRemaining?:{family:string;remaining:number;total:number;placedUid?:number}
  terrainFire?:{id:number;sourceUid:number;family:string;startedAt:number;lastAt:number;remaining:number;total:number;placedUid?:number}
  fireWetUntil?:number
  observed?:{terrain:string;at:number;gatherAvailable?:boolean;device?:{uid:number;def:string;completed:string[]};contents?:{at:number;terrain:string;items:{uid:number;def:string;count:number}[]}}
  beddingLice?:BeddingLice
  beacon?:BeaconState
  device?:FieldDeviceState
  icy?: boolean
  snow?: number
  iceHoleUntil?: number
  t: string // terrain def id
  v: number // sprite variant
  roof: boolean
  blood: number
  beddingWetness?:number
  beddingScorch?:number
  beddingFire?:{id:number;sourceUid:number;terrain:string;beddingUid?:number;startedAt:number;lastAt:number}
  needleGatherAt?:number
  gatherAt?: number
  placed?: { base: string; item: ItemInst; owner?: number }
  items: ItemInst[]
  searched?: boolean
  /** 다시 자라는 시각(턴) — 이 시각이 지나면 다시 뒤질 수 있다 */
  regrowAt?: number
  seen?: boolean
  /** 용기(상자·항아리·석관) 내용물 */
  cont?: { items: ItemInst[]; opened: boolean; kind: string }
  /** 방 번호 */
  room?: number
  /** 바닥 장식 (이끼 등) */
  deco?: string
  /** 오염(최심부) */
  taint?: number
  /** 포자 구름: 끝나는 턴과 농도 (07 §11) */
  spores?: { until: number; conc: number }
}

export interface MapProp { kind: string; x: number; y: number; w: number; h: number; anim?: string; blocks?: boolean; scale?: number }
export interface MapLink { pos: Pos; to: string; toPos: Pos; label: string }
export interface MapRoom {
  x: number; y: number; w: number; h: number; type: string; discovered: boolean; name: string
  /** 원래 거주 편성 (종 id 목록) */
  residents?: string[]
  /** 정리된 시각(턴). 다시 차면 지운다 */
  clearedAt?: number
}

/** 거주 인구 공급원 (14 §9.4) */
export interface PopSource { id: string; label: string; species: string; count: number; cap: number; regenDays: number; floors: string[]; lastRegenDay: number; needsAlive?: string; deployed?: boolean;members?:number[];faction?:string;kind?:'residents';closed?:{at:number;by:number;mapId:string;deviceUid:number} }
export interface MapLight { pos: Pos; radius: number; kind: string; off?: boolean; sourceUid?:number; fuelUntil?:number;beddingFireId?:number;beddingSparkAt?:number;terrainFireId?:number;terrainSparkAt?:number }

export interface GardenAlertState {bellSignals?:number;level:number;events:{at:number;source:number;target?:number;sourcePos:Pos;targetPos?:Pos;level:number;kind?:'attack'}[]}
/** A finite environmental colony; never a fabricated anatomical creature. */
export interface SwarmDef extends DefBase {
 defType:'Swarm';label:string;sprite:string;members:number;moveTU:number
 attractionRadiusMult:number;coverRadius:number;sightMult:number;activeDaylightMax:number
 disperseTurns:[number,number];ashPerTurn:number;coughEvery:number;minCoughDose:number;snuffChance:number;snuffItems:string[]
 burnKinds:string[];burnMembersPerTurn:number;captureMembers:number;captureTool:string;bodyItem:string;studyTU:number
 facts:string[]
}
export interface SwarmState {
 uid:number;def:string;rule:string;origin:Pos;pos:Pos;initialMembers:number;members:number;captured:number;burned:number
 cohesion:number;nextMoveAt:number;lastTick:number;lostLightAt?:number;disperseAt?:number
}
export interface MapState {
  swarms?:SwarmState[]
  gardenAlert?:GardenAlertState
  fog?:{sightMult:number;color:number;opacity:number}
  vessel?:VesselState
  layoutUpgrades?:string[]
  kinshipDeaths?:{key:string;group:string;target:number}[]
  kinshipVisit?:number
  kinshipLightReported?:boolean
  layout?:string
  daylightMult?:number
  baseCamp?:BaseCampState
  residentWaterInitialized?: boolean
  residentPurificationInitialized?: boolean
  residentWarmthInitialized?: boolean
  residentHearth?: { site: string; terrain: string; pos: Pos }
  residentWell?: { site: string; terrain: string; pos: Pos }
  residentProvisionInitialized?: boolean
  residentDepot?: { site: string; terrain: string; pos: Pos }
  residentRestInitialized?: boolean
  residentBeds?: { owner: number; terrain: string; pos: Pos; base?: string; packedUid?: number }[]
  quarantine?: boolean
  settlementInitialized?: boolean
  clinicInitialized?: boolean
  innInitialized?: boolean
  innBeds?: { id: string; keeper: number; terrain: string; pos: Pos; lease?: { tenant: number; until: number } }[]
  worldCell?: Pos
  leftAt?: number
  surfaceCultivation?: SurfaceCultivationState
  batches?: CraftBatch[]
  cooking?:CookingBatch[]
  /** 다음 포자 만료 시각: 동적 시야·광원 캐시 무효화 */
  sporesExpire?: number
  id: string
  name: string
  kind: 'surface' | 'dungeon'
  depth: number
  /** 기본 밝기 (던전은 어둡다) */
  ambient: number
  w: number
  h: number
  tiles: Tile[]
  exits: Pos[]
  links: MapLink[]
  rooms: MapRoom[]
  /** 이 층 서가에서 아래층 방 위치 쪽지가 이미 나왔는가 (14 §5.1) */
  noteGiven?: boolean
  props: MapProp[]
  lights: MapLight[]
  /** 장소 사건 경유지 (14 §10: 약탈자 야영지·숲 개울·수도원 입구) */
  waypoints?: Record<string, Pos>
}

export type Weather = 'clear' | 'overcast' | 'ashrain' | 'deepOvercast' | 'ashstorm' | 'ashsnow' | 'ashgale' | 'frostfog'

export interface LogEntry {
  turn: number
  kind: 'info' | 'combat' | 'warn' | 'danger' | 'flavor' | 'good'
  text: string
  detail?: string[]
}

/** 소문 (06 §7.1 축약): 출처 단계 hop 0 목격자 · 1 전해 들음 · 2+ 떠도는 말 */
export interface NpcMapMemory {
 landmarks?:{x:number;y:number;kind:'water';terrain:string;label:string;seenAt:number}[]
 region?:string;mapId:string;name:string;kind:MapState['kind'];depth:number;w:number;h:number
 rooms:(MapDocument['rooms'][number]&{seenAt:number})[]
 stairs:{x:number;y:number;terrain:string;label:string;seenAt:number}[]
}
export interface Rumor {
  worldReport?:{worldSeed:string;w:number;h:number;pos:Pos;at:number;cell:WorldObservation['cell']}
  stair?:{x:number;y:number;terrain:string;label:string}
  claims?:{what:string;count?:number;place?:{cell:Pos;label:string};faction?:string;when?:string}
  relay?:{root:string;origin:string;accuracy:number;distortions:RumorDistortion[];suspected?:RumorDistortion}
  worldMapDocument?:WorldMapDocument
  mapDocument?:MapDocument
  mapDepth?:number
  regionId?: string
  id: string
  kind: 'room' | 'stairs' | 'boss' | 'supply' | 'outbreak' | 'reputation' | 'interaction' | 'map'
  /** 출처가 전한 질병/작성일. 현재의 실제 유행 수치는 아니다. */
  outbreak?: {disease:string;day:number}
  interactions?:string[]
  reputation?:{subject:RumorSubject;event:number;delta:number}
  text: string
  source: string
  hop: number
  /** 작성 시점(턴) · 얻은 시점(턴) */
  writtenAt: number
  foundAt: number
  mapId?: string
  roomIdx?: number
  roomName?: string
  mapW?: number
  mapH?: number
  rect?: { x: number; y: number; w: number; h: number }
}

export interface AppraisalReceipt {item:number;merchant:number;appearance:string;belief:string;paid:number;at:number;lastAt:number;refutedAt?:number}
export interface PrisonerSighting {heard?:{at:number;fromId:number;fromName:string;kind?:'interrogation'};id:number;name:string;faction?:string;firstSeen:number;at:number;region?:string;regionLabel?:string;mapId:string;mapName:string;pos:Pos;state:'bound'|'held'|'free'|'dead';lastCapture?:{ropeUid:number;seenAt:number}}
export interface Knowledge {
  npcRelations?:Record<number,NpcRelationshipReport>
  prisonerSightings?:Record<number,PrisonerSighting>
  interactions?:InteractionDiscovery[]
  appraisalReceipts?:AppraisalReceipt[]
  /** 외형 -> 효과 def id (시드별 섞임, 비밀) */
  pillMap: Record<string, string>
  /** 플레이어가 아는 외형 -> 효과 */
  pillKnown: Record<string, string>
  pillBeliefs?: Record<string, PillBelief>
  bestiary: Record<string, BestiaryRecord>
  rumors?: Rumor[]
}

export interface StorytellerState {
  director?:StoryDirectorState
  budget: number
  lastEventTurn: number
  /** 수색대 출발 예정 (10 §3 #2): 순찰이 흔적을 보고 돌아온 1시간 뒤 */
  search?: { at: number; pos: Pos }
  pending?: { event: string; atTurn: number }
  history: { turn: number; event: string }[]
}

export interface WorldCell {
  /** 새 월드의 초기 육로 영향권. 구형 세계에는 소급하지 않는다. */
  territory?:string
  altitude: number
  rain: number
  temperature: number
  veil: number
  biome: string
  sea: boolean
  river?: boolean
  lake?: boolean
  road?: boolean
  oldRoad?: boolean
  resources: { wood: number; herbs: number; ore: number; game: number; scrap: number }
}
export interface WorldObservation {at:number;source:'initial'|'arrival'|'survey';cell:Pick<WorldCell,'altitude'|'temperature'|'veil'|'biome'|'sea'|'road'|'oldRoad'|'river'|'lake'|'territory'>}
export interface WorldTower { id: string; cell: Pos; output: number; radius: number; history?: { turn: number; output: number }[]; shutdown?:TowerShutdown }
export interface TowerShutdown {turn:number;seasonTurns:number;startOutput:number;radius:number;veilTarget:number;sunBonus:number;soilDelayTurns:number;soilCollapseTurns:number;neighborBoosts:{id:string;amount:number}[]}
export interface WorldSite { id: string; label: string; description: string; cell: Pos; kind: RegionSiteDef['kind']; faction?: string; population?: number; facilities?: boolean }
export interface RegionScene {
  map: MapState
  maps: Record<string, MapState>
  creatures: Creature[]
  offCreatures: Record<string, Creature[]>
  sources: PopSource[]
  storyteller: StorytellerState
  noiseEvents: GameState['noiseEvents']
}
export interface WorldTravel {
  mode?:'boat'
  vesselUid?:number
  segmentCosts?:number[]
  party?: number[]
  destination: Pos
  route: Pos[]
  segmentRemaining: number
  segmentTotal: number
  totalRemaining: number
}
export interface OverworldState {
  gardenAlerts?:Record<string,GardenAlertState>
  roadRaids?:WorldRaid[]
  roadRaidDay?:number
  nextRoadRaid?:number
  caravans?:CaravanState[]
  caravanChecks?:Record<string,number>
  nextCaravan?:number
  signals?:SignalPacket[]
  legacyResidents?:LegacyResident[]
  contracts?: ContractRecord[]
  simulation?: WorldSimulationState
  rumorNetwork?:RumorNetworkState
  society?: SocietyState
  markets?: Record<string, SettlementMarket>
  def: string
  w: number
  h: number
  cells: WorldCell[]
  towers: WorldTower[]
  sites: WorldSite[]
  position: Pos
  currentRegion?: string
  visited: string[]
  seen: number[]
  worldObservations?:Record<number,WorldObservation>
  scenes: Record<string, RegionScene>
  travel?: WorldTravel
  climateInitialized?: boolean
  weatherCells?: Record<string, { weather: Weather; until: number; wind: Pos }>
  climateRevision?: number
  surges?: { tower: string; amount: number; day: number; turn?: number }[]
}

export interface GameState {
  /** 새 원정에서 선택한 저장 방식. 과거 각인의 부재는 기본 각인 방식이다. */
  saveMode?: string
  gameVersion?:string
  defSchemaVersion?:number
  contentMods?:{id:string;version:string;hash:string}[]
  contentAdoptedAt?:{turn:number;hash:string}
  /** 실제 새 게임이 사용한 콘텐츠 구성. 구형 각인의 과거 구성은 소급하지 않는다. */
  loadHash?:string
  /** 해시가 기록된 실제 구성의 Def ID/종류. 삭제 복구는 별도 정책을 거친다. */
  contentDefinitions?:Record<string,string>
  contentItemShapes?:Record<string,{size:[number,number];maxStack:number;label:string;storage?:[number,number]}>
  /** Exact recorded mechanical recipe rules; never inferred from a different configuration. */
  contentRecipeContracts?:Record<string,string>
  contentChanges?:{turn:number;from:string;to:string}[]
  achievementsDisabled?:boolean
  scriptState?:import('./script-contracts').ScriptState
  overworld?: OverworldState
  version: number
  seed: string
  mods: string[]
  time: number // TU
  /** 클라이언트가 턴 계산을 분할했을 때 입력 대기점 전까지 진행 중 */
  simulationPending?: boolean
  rng: Record<string, RngState>
  /** 현재 지도 */
  map: MapState
  /** 현재가 아닌 지도들 (정지 상태) */
  maps: Record<string, MapState>
  /** 현재 지도 밖에 있는 생물들 */
  offCreatures: Record<string, Creature[]>
  /** 현재 지도의 생물 */
  creatures: Creature[]
  playerId: number
  nextId: number
  log: LogEntry[]
  weather: Weather
  weatherUntil: number
  wind: Pos
  storyteller: StorytellerState
  /** 헤드리스 봇 기억 (밸런스 측정용, 세이브와 함께 직렬화해 결정론 유지) */
  bot?: { avoid: string[]; retreats: number; lastRetreat?: number; lootAt?: string; lastStairs?: number; lastHp?: number; hurtAt?: number; standAt?: number }
  knowledge: Knowledge
  over?: { kind: 'death' | 'escape' | 'retire'; turn: number; report: DeathReport;retirement?:RetirementRecord }
  visible: number[] // 이번 턴 플레이어가 보는 타일 인덱스
  noiseEvents: { pos: Pos; radius: number; source: number; turn: number }[]
  /** 자동 모드가 마지막으로 위협에 끊긴 턴 (01 §6.2 이력 현상) */
  autoStopTurn?: number
  /** 자동 이동 설정. 피해 중단은 항상 켜져 있다 */
  autoIgnored?: number[]
  hygieneEnabled?: boolean
  autoSmells?: boolean
  autoThreat?: number
  /** 화면 연출용 이벤트 (렌더러가 소비) */
  fx: FxEvent[]
  /** 거주 인구 공급원 (14 §9.4) */
  sources?: PopSource[]
  /** 열려 있는 루팅 대상 */
  loot?: { pos: Pos; kind: 'cont' | 'floor' | 'corpse' | 'bag'; id?: number }
}

export type FxEvent =
  | { k: 'dmg'; id: number; v: number; crit?: boolean; text?: string; turn: number }
  | { k: 'miss' | 'block' | 'parry' | 'deflect'; id: number; turn: number }
  | { k: 'status'; id: number; text: string; color: string; turn: number }
  | { k: 'attack'; id: number; target: number; turn: number; ranged?:boolean;throwing?:boolean;mode?:string;prop?:{uid:number;def:string} }
  | { k: 'move'; id: number; from: Pos; to: Pos; turn: number }
  | { k: 'death'; id: number; turn: number }
  | { k: 'level'; id: number; turn: number }
  | { k: 'xp'; id: number; v: number; turn: number }

export type DiscoveryKind='bestiary'|'identification'|'recipe'|'book'|'map'|'fieldNote'|'rumor'|'interaction'
export interface DiscoveryArchive {format:1;at:number;records:{kind:DiscoveryKind;id:string;title:string;details:string[]}[];omitted:number}
export interface DeathReport {
  /** Historical display only. Never installed into a new character's knowledge. */
  discoveries?:DiscoveryArchive
  title: string
  name: string
  background: string
  traits: string[]
  cause: string
  chain: string[]
  vitals: string[]
  stats: string[]
  daysSurvived: number
  epitaph: string
}
