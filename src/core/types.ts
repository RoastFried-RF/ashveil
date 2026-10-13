import type { Pos } from './geom'
import type { RngState } from './rng'

// ───────────── Def (콘텐츠 데이터, JSON) ─────────────

export interface DefBase {
  defType: string
  id: string
  parent?: string
  abstract?: boolean
  label?: string
  description?: string
  /** 로더가 채움: 이 Def를 마지막으로 정의/수정한 모드 */
  _mod?: string
}

export type DamageType = 'cut' | 'stab' | 'blunt' | 'bite' | 'burn'
export type ArmorCategory = 'sharp' | 'blunt' | 'heat'
export type Capacity = 'consciousness' | 'moving' | 'manipulation' | 'sight' | 'hearing' | 'breathing' | 'bloodPumping'
export type Height = 'low' | 'mid' | 'high'

export interface BodyPartDef {
  id: string
  label: string
  parent?: string
  hp: number
  /** 부모 부위 면적 중 이 부위가 차지하는 비율 (루트는 1) */
  coverage: number
  height: Height
  internal?: boolean
  vital?: boolean
  /** 파괴되면 24시간 뒤 사망 (간) */
  delayedDeath?: boolean
  bone?: boolean
  artery?: boolean
  bleedMult?: number
  painMult?: number
  /** 지혈대 단위 (팔/다리) */
  limb?: string
  /** 방어구 커버 그룹 */
  groups: string[]
  /** 6부위 영역 (없으면 부모를 따름) */
  region?: Region
  capacities?: Partial<Record<Capacity, number>>
}

export interface BodyDef extends DefBase {
  defType: 'Body'
  bloodMl: number
  parts: BodyPartDef[]
}

export interface WoundDef extends DefBase {
  defType: 'Wound'
  label: string
  /** 심각도(hp 피해) 1당 턴당 출혈 ml */
  bleedPerSeverity: number
  painPerSeverity: number
  infectionChance: number
  /** 하루 치유량 (hp) */
  healPerDay: number
  scarChance: number
  /** 비동맥 상처의 턴당 출혈 감소 배율 (안정 시) */
  clotPerTurn: number
  /** 외부에서 보이는가 (내출혈 = false) */
  visible?: boolean
}

export interface AttackDef {
  label: string
  damageType: DamageType
  damage: number
  armorPen: number
  tu: number
  stamina: number
  skill: string
  reach?: number
  bleedMult?: number
  fractureMult?: number
  stunChance?: number
  noise?: number
  /** 이 능력치가 0이면 공격 불가 (예: 턱 파괴 시 물기 불가) */
  requiresCapacity?: Capacity
  /** 무기 정확도 (공격치 기본값) */
  accuracy?: number
}

export type Slot = 'head' | 'chest' | 'hands' | 'feet' | 'belt' | 'back' | 'neck' | 'ring1' | 'ring2' | 'main' | 'off'
export const SLOTS: Slot[] = ['head', 'chest', 'hands', 'feet', 'belt', 'back', 'neck', 'ring1', 'ring2', 'main', 'off']
export type Region = 'head' | 'torso' | 'larm' | 'rarm' | 'lleg' | 'rleg'
export const REGIONS: Region[] = ['head', 'torso', 'larm', 'rarm', 'lleg', 'rleg']

export interface RangedDef {
  range: number
  ammo: string
}

export interface ItemDef extends DefBase {
  defType: 'Item'
  label: string
  sprite: string
  category: 'weapon' | 'apparel' | 'shield' | 'medical' | 'food' | 'drink' | 'drug' | 'tool' | 'ammo' | 'misc'
  weight: number
  /** 배낭 격자 크기 [가로, 세로] */
  size: [number, number]
  stackable?: boolean
  maxStack?: number
  value?: number
  /** 장착 슬롯 (반지는 'ring') */
  slot?: Exclude<Slot, 'ring1' | 'ring2'> | 'ring'
  /** 장착 시 능력치·특성형 수정치 */
  mods?: Partial<Record<string, number>>
  attack?: AttackDef
  ranged?: RangedDef
  twoHanded?: boolean
  apparel?: {
    layer: number // 0 내의, 1 중간, 2 외투, 3 갑옷, 4 겉망토
    groups: string[]
    insulation: number
    armor: Partial<Record<ArmorCategory, number>>
    noise?: number
    waterproof?: boolean
    durability: number
  }
  shield?: { block: number; stamina: number; armor: number }
  food?: { kcal: number; vitamin?: number; water?: number; raw?: boolean; scent?: number; needsTool?: string }
  drink?: { water: number; dirty?: boolean; alcohol?: number }
  medical?: {
    kind: 'bandage' | 'tourniquet' | 'splint' | 'disinfect'
    bleedMult?: number
    arterialBleedMult?: number
    infectionMult?: number
    tu: number
    quality?: number
  }
  drug?: { effect: string; durationTurns: number }
  /** 미확인 그룹 (예: 'pill') — 시드별로 외형이 섞임 */
  unidentified?: string
  light?: { radius: number; fuelTurns: number }
  /** 등불 연료 보충량 (턴) */
  refuel?: number
  /** 착/탈 턴 수 (13 §6.1). 없으면 1/1 */
  equipTurns?: [number, number]
  /** 둔중: 회피치에서 뺀다 (13 §6.2) */
  bulk?: number
  uses?: number
}

export interface CreatureDef extends DefBase {
  defType: 'Creature'
  label: string
  sprite?: string | string[]
  body: string
  faction: string
  sizeClass: 'tiny' | 'small' | 'medium' | 'large'
  moveTU: number
  bloodMult?: number
  hpMult?: number
  /** 모피 등 자연 단열 */
  insulation?: number
  stats: Stats
  skills: Record<string, number>
  naturalAttack?: AttackDef
  ai: 'player' | 'packHunter' | 'raider' | 'skittish' | 'guard' | 'boss'
  morale: number
  lightThreshold: number
  sightRange: number
  scentSense?: number
  loadout?: { slots: { items: string[]; chance?: number; count?: [number, number] }[] }
  hunger?: [number, number]
  bestiary?: string[]
  /** 처치 경험치 */
  xp?: number
  /** 스프라이트 manifest 캐릭터 키 (여러 개면 무작위) */
  char?: string | string[]
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
}

export interface Stats { str: number; agi: number; per: number; vit: number; wil: number }

export interface TerrainDef extends DefBase {
  defType: 'Terrain'
  label: string
  sprites: string[]
  /** 계단 */
  stairs?: 'down' | 'up'
  /** 벽 렌더링 계열 */
  wall?: boolean
  /** 바닥 렌더링 계열 */
  floor?: 'kt' | 'cd' | 'earth'
  passable: boolean
  opaque: boolean
  moveMult: number
  /** 비틀거림 가산 % (01 §5.3) */
  stumble?: number
  water?: 'shallow' | 'deep'
  door?: 'open' | 'closed'
  container?: string // LootTable id
  /** 보관함 격자 [가로, 세로] (13: 야영지 보관함 12×8) */
  stash?: [number, number]
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
}

export interface BackgroundDef extends DefBase {
  defType: 'Background'
  label: string
  description: string
  stats?: Partial<Stats>
  skills: Record<string, number>
  passions?: Record<string, 1 | 2>
  /** 시작 숙달 단계 (15 §9.1) */
  mastery?: Partial<Record<'medicine' | 'survival', number>>
  /** 시작 능력 포인트 가산 (몰락한 길드 상인 +1) */
  bonusAbilityPoints?: number
  literate: boolean
  startItems: string[]
  startAbilities?: string[]
  traitWeights?: Record<string, number>
}

export interface ThoughtDef extends DefBase {
  defType: 'Thought'
  label: string
  mood: number
  durationTurns: number
  stack?: number
}

export interface EventDef extends DefBase {
  defType: 'Event'
  label: string
  cost: number
  weight: number
  spawn?: { creature: string; count: [number, number] }[]
  hint?: string
  minDay?: number
  cooldownTurns?: number
  nightWeight?: number
}

export interface PillEffectDef extends DefBase {
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

export interface AbilityAttackMods {
  hitBonus?: number
  damageMult?: number
  bleedMult?: number
  arterialBonus?: number
  armorPenBonus?: number
  armorDamage?: number
  fractureMult?: number
  stunBonus?: number
  partWeights?: Partial<Record<Region | 'neck', number>>
  aoe?: 'adjacent' | 'line2'
  knockback?: number
  knockdownChance?: number
  tu?: number
}

export interface AbilityDef extends DefBase {
  defType: 'Ability'
  label: string
  description: string
  tree: string
  tier: number
  kind: 'active' | 'passive' | 'toggle'
  energy?: number
  cooldown?: number
  requires?: string[]
  /** 요구 무기 계열 (attack.skill) */
  weapon?: string
  target?: 'enemy' | 'self'
  attack?: AbilityAttackMods
  stance?: { effect: string; turns: number; magnitude?: number }
  self?: { energyPct?: number; painRelief?: number; turns?: number }
  mods?: Partial<Record<string, number>>
  icon: string
}

export type AnyDef =
  | BodyDef | WoundDef | ItemDef | CreatureDef | TerrainDef | LootTableDef | TraitDef
  | BackgroundDef | ThoughtDef | EventDef | PillEffectDef | SkillDef | AbilityDef

// ───────────── 런타임 상태 (직렬화 가능) ─────────────

export interface ItemInst {
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
  durability?: number
  fuel?: number
  lit?: boolean
  uses?: number
  dirty?: boolean
}

export interface Wound {
  id: number
  def: string
  part: string
  severity: number
  healed: number
  bleed: number
  arterial: boolean
  internal: boolean
  fracture: boolean
  bandage?: { quality: 'dirty' | 'clean'; infectionMult: number; bleedMult: number; arterialMult: number }
  splinted?: boolean
  cauterized?: boolean
  disinfected?: boolean
  infection?: { progress: number; immunity: number }
  infectionChecked?: boolean
  ageTurns: number
  source: string
  scar?: boolean
}

export interface BodyState {
  def: string
  blood: number
  bloodMax: number
  /** 부위별 최대 hp (hpMult 반영) */
  maxHp: Record<string, number>
  missing: string[]
  wounds: Wound[]
  tourniquets: Record<string, number> // limb -> 적용 시각(turn)
  pressing?: number // 압박 중인 wound id (이번 턴)
}

export interface Needs {
  kcal: number
  water: number
  vitamin: number
  fatigue: number
  bodyTemp: number
  wetness: number
  stamina: number
  stress: number
}

export interface Effect { kind: string; untilTurn: number; magnitude?: number }

export interface Thought { def: string; untilTurn: number; count: number }

export interface Activity {
  kind: 'rest' | 'sleep' | 'search' | 'examine' | 'press' | 'equip' | 'unequip'
  remaining: number
  slot?: Slot
  target?: Pos
  uid?: number
  woundId?: number
  label: string
  /** 중단 판정용: 시작 시점에 보이던 적, 상처 수 */
  seenHostiles?: number[]
  woundCount?: number
  /** 진행한 턴 수 */
  elapsed?: number
}

export interface AiState {
  mode: 'idle' | 'wander' | 'hunt' | 'investigate' | 'flee' | 'eat' | 'surrender' | 'guard' | 'return' | 'patrol'
  target?: number
  dest?: Pos
  lastSeen?: Pos
  path?: Pos[]
  hunger: number
  morale: number
  alertTurn?: number
  /** 순찰 경로 (경유지 순서) · 현재 지점 · 대기 끝 턴 */
  route?: Pos[]
  routeIdx?: number
  waitUntil?: number
}

export interface Creature {
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
  skills: Record<string, number>
  passions: Record<string, number>
  /** 숙달 카운트 기록 (같은 대상 1회, 시간당 3회) */
  masteryLog?: { keys: string[]; hour: number; inHour: Record<string, number> }
  traits: string[]
  background?: string
  needs: Needs
  effects: Effect[]
  thoughts: Thought[]
  /** 배낭(격자) */
  bag: ItemInst[]
  /** 장착 중 */
  equip: Partial<Record<Slot, ItemInst>>
  /** 빠른 슬롯 10칸 */
  hotbar: (HotbarRef | null)[]
  hp: number
  level: number
  xp: number
  statPoints: number
  abilityPoints: number
  abilities: string[]
  cooldowns: Record<string, number>
  sneaking?: boolean
  asleep?: boolean
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
  /** 이번 턴에 공격/방어로 스태미나를 썼는가 */
  exerted: boolean
  lastAttacker?: string
  killedBy?: string
  deathCause?: string
  deathTurn?: number
  history: HistoryEvent[]
  literate?: boolean
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

export type HotbarRef = { kind: 'ability'; id: string } | { kind: 'item'; def: string }

export interface Tile {
  t: string // terrain def id
  v: number // sprite variant
  roof: boolean
  blood: number
  items: ItemInst[]
  searched?: boolean
  seen?: boolean
  /** 용기(상자·항아리·석관) 내용물 */
  cont?: { items: ItemInst[]; opened: boolean; kind: string }
  /** 방 번호 */
  room?: number
  /** 바닥 장식 (이끼 등) */
  deco?: string
  /** 오염(최심부) */
  taint?: number
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
export interface PopSource { id: string; label: string; species: string; count: number; cap: number; regenDays: number; floors: string[]; lastRegenDay: number; needsAlive?: string }
export interface MapLight { pos: Pos; radius: number; kind: string }

export interface MapState {
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
  props: MapProp[]
  lights: MapLight[]
  /** 장소 사건 경유지 (14 §10: 약탈자 야영지·숲 개울·수도원 입구) */
  waypoints?: Record<string, Pos>
}

export type Weather = 'clear' | 'overcast' | 'ashrain'

export interface LogEntry {
  turn: number
  kind: 'info' | 'combat' | 'warn' | 'danger' | 'flavor' | 'good'
  text: string
  detail?: string[]
}

export interface Knowledge {
  /** 외형 -> 효과 def id (시드별 섞임, 비밀) */
  pillMap: Record<string, string>
  /** 플레이어가 아는 외형 -> 효과 */
  pillKnown: Record<string, string>
  bestiary: Record<string, { seen: number; fought: number; killed: number; dissected?: number }>
}

export interface StorytellerState {
  budget: number
  lastEventTurn: number
  pending?: { event: string; atTurn: number }
  history: { turn: number; event: string }[]
}

export interface GameState {
  version: number
  seed: string
  mods: string[]
  time: number // TU
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
  knowledge: Knowledge
  over?: { kind: 'death' | 'escape'; turn: number; report: DeathReport }
  visible: number[] // 이번 턴 플레이어가 보는 타일 인덱스
  noiseEvents: { pos: Pos; radius: number; source: number; turn: number }[]
  /** 화면 연출용 이벤트 (렌더러가 소비) */
  fx: FxEvent[]
  /** 거주 인구 공급원 (14 §9.4) */
  sources?: PopSource[]
  /** 열려 있는 루팅 대상 */
  loot?: { pos: Pos; kind: 'cont' | 'floor' }
}

export type FxEvent =
  | { k: 'dmg'; id: number; v: number; crit?: boolean; text?: string; turn: number }
  | { k: 'miss' | 'block' | 'parry' | 'deflect'; id: number; turn: number }
  | { k: 'status'; id: number; text: string; color: string; turn: number }
  | { k: 'attack'; id: number; target: number; turn: number }
  | { k: 'move'; id: number; from: Pos; to: Pos; turn: number }
  | { k: 'death'; id: number; turn: number }
  | { k: 'level'; id: number; turn: number }

export interface DeathReport {
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
