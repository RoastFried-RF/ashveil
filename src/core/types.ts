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
  bone?: boolean
  artery?: boolean
  bleedMult?: number
  painMult?: number
  /** 지혈대 단위 (팔/다리) */
  limb?: string
  /** 방어구 커버 그룹 */
  groups: string[]
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
}

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
  stackable?: boolean
  value?: number
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
  uses?: number
}

export interface CreatureDef extends DefBase {
  defType: 'Creature'
  label: string
  sprite: string | string[]
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
  ai: 'player' | 'packHunter' | 'raider' | 'skittish'
  morale: number
  lightThreshold: number
  sightRange: number
  scentSense?: number
  loadout?: { slots: { items: string[]; chance?: number }[] }
  hunger?: [number, number]
  bestiary?: string[]
}

export interface Stats { str: number; agi: number; per: number; vit: number; wil: number }

export interface TerrainDef extends DefBase {
  defType: 'Terrain'
  label: string
  sprites: string[]
  passable: boolean
  opaque: boolean
  moveMult: number
  water?: 'shallow' | 'deep'
  door?: 'open' | 'closed'
  container?: string // LootTable id
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
  literate: boolean
  startItems: string[]
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

export type AnyDef =
  | BodyDef | WoundDef | ItemDef | CreatureDef | TerrainDef | LootTableDef | TraitDef
  | BackgroundDef | ThoughtDef | EventDef | PillEffectDef | SkillDef

// ───────────── 런타임 상태 (직렬화 가능) ─────────────

export interface ItemInst {
  uid: number
  def: string
  count: number
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
  kind: 'rest' | 'sleep' | 'search' | 'examine' | 'press'
  remaining: number
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
  mode: 'idle' | 'wander' | 'hunt' | 'investigate' | 'flee' | 'eat' | 'surrender'
  target?: number
  dest?: Pos
  lastSeen?: Pos
  path?: Pos[]
  hunger: number
  morale: number
  alertTurn?: number
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
  skills: Record<string, number> // xp
  passions: Record<string, number>
  traits: string[]
  background?: string
  needs: Needs
  effects: Effect[]
  thoughts: Thought[]
  inventory: ItemInst[]
  equipment: { main?: number; off?: number; apparel: number[] }
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
}

export interface HistoryEvent { turn: number; kind: string; text: string }

export interface Tile {
  t: string // terrain def id
  v: number // sprite variant
  roof: boolean
  blood: number
  items: ItemInst[]
  searched?: boolean
  seen?: boolean
}

export interface MapState {
  w: number
  h: number
  tiles: Tile[]
  exits: Pos[]
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
  map: MapState
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
}

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
