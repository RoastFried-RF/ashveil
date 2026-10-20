import {introduceNpcIdentity} from './npc-identity'
import {hearNpcRelationships} from './npc-relations'
import {hearPrisonerSightings} from './prisoner-witnesses'
import {hearScoutWorld} from './world-scouting'
import {hearNameRumors} from './name-rumors'
import {worldMapMarketValue} from './world-map-prices'
import {hearMapRumors} from './map-rumors'
import {hearScoutRooms} from './scout-room-rumors'
import {hearTownRumors} from './rumor-network'
import {socialReply} from './social-replies'
import {hearOutbreakRumors} from './outbreak-rumors'
import {recordConversation} from './social-state'
import {rememberMeeting} from './first-impressions'
import {rememberLifeEvent} from './life-memories'
import {firstImpressionRules,firstImpressionScore} from './first-impression-state'
import { mobileCargoLayout } from './caravan-state'
import {hearLegacyResident} from './legacy-residents'
import { hearCompanionBond } from './companion-bonds'
import { acknowledgeRescue } from './prisoners'
import { settlementPriceFactor, withdrawForMarket, worldSimulationDef, worldSimulationTick } from './world-simulation'
// 정착지의 실제 재고, 가격·흥정·물물교환. 실패한 거래는 어떤 상태도 바꾸지 않는다.
import { clamp, log, player, rng, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { capacity } from './body'
import { cheb } from './geom'
import { hasLos } from './fov'
import { hearFactionRelations, hostile, reputation, reputationBand } from './diplomacy'
import { addToBag, itemDef, makeItem, qualityInfo, storedItems } from './items'
import { primaryMaterial } from './materials'
import { effectiveStat, traitAdd } from './traits'
import type { Creature, EconomyDef, ItemInst, SettlementMarket, TraderStockDef, WorldSite } from './types'

/** 전역 물품은 로컬 생물/상처의 생성 순서를 소비하지 않는다. 안전 정수 범위의 별도 UID 공간이다. */
export const WORLD_STOCK_ID_START = 1_099_511_627_776
export function makeMarketItem(w: World, def: string, count: number, atTurn = turnOf(w)): ItemInst {
  const simulation = w.s.overworld?.simulation
  const local = { db: w.db, s: { ...w.s, time: atTurn * 100, nextId: simulation ? simulation.nextItemId ?? WORLD_STOCK_ID_START : w.s.nextId } }
  const item = makeItem(local, def, count)
  if (simulation) simulation.nextItemId = local.s.nextId
  else w.s.nextId = local.s.nextId
  return item
}
export interface TradeLine { uid: number; count: number }
export const economyDef = (w: World) => w.db.get<EconomyDef>('Economy.Hearth')
const dayOf = (w: World) => Math.floor(turnOf(w) / TURNS_PER_DAY)
export const marketFor = (w: World, c: Creature) => c.traderSite ? w.s.overworld?.markets?.[c.traderSite] : undefined
export function createMarket(w: World, site: WorldSite, stockId: string): SettlementMarket {
  const markets = w.s.overworld!.markets ??= {}
  if (markets[site.id]) return markets[site.id]
  const stock = w.db.get<TraderStockDef>(stockId), day = dayOf(w)
  return markets[site.id] = { site: site.id, stockDef: stockId, items: stock.entries.flatMap((e) => { const count = withdrawForMarket(w, site.id, e.item, e.target); return count ? [makeMarketItem(w, e.item, count)] : [] }), money: stock.money, day, nextRestock: day + economyDef(w).restockDays }
}
export function tradeAccess(w: World, c: Creature, trader: Creature): string | null {
  if (!c.alive || c.unconscious || capacity(w, c, 'consciousness') < .5) return '의식이 또렷해야 이야기할 수 있다'
  if (!trader.alive || trader.unconscious || trader.asleep) return '상대가 대답할 수 없다'
  if (trader.activity?.kind === 'teach' || c.activity?.kind === 'lessonWait') return '수업을 마친 뒤 거래할 수 있다'
  if (c.id === trader.id || cheb(c.pos, trader.pos) > 1 || !hasLos(w, c.pos, trader.pos)) return '상대 곁으로 다가가야 한다'
  if (hostile(w, c, trader)) return '적대하는 상대와는 거래할 수 없다'
  if (c.breakdown?.kind === 'irritable' || trader.breakdown?.kind === 'irritable') return '짜증이 가라앉을 때까지 대화할 수 없다'
  const market = marketFor(w, trader)
  if (!market) return '물건을 파는 사람이 아니다'
  if (c.id === w.s.playerId && !reputationBand(w, trader.faction).trade) return '이 세력은 거래를 거부한다'
  if (c.id === w.s.playerId && (market.haggle?.refusedUntil ?? 0) > turnOf(w)) return '상인이 내일까지 거래를 거절한다'
  return null
}
export function talk(w: World, c: Creature, target: Creature): string | null {
  if (!c.alive||c.asleep||c.unconscious||!target.alive||target.unconscious||target.asleep||capacity(w,c,'consciousness')<.5||capacity(w,target,'consciousness')<.5) return '의식이 또렷한 두 사람이 깨어 있어야 이야기할 수 있다'
  if (cheb(c.pos, target.pos) > 1 || !hasLos(w, c.pos, target.pos)) return '상대 곁으로 다가가야 한다'
  if (hostile(w, c, target)) return '상대가 말을 들으려 하지 않는다'
  recordConversation(w,c,target)
  if(socialReply(w,c,target)==='dismissed')return null
  rememberMeeting(w,c,target)
  introduceNpcIdentity(w,c,target)
  rememberLifeEvent(w,c,'talk');rememberLifeEvent(w,target,'talk')
  hearOutbreakRumors(w,c,target)
  hearNameRumors(w,c,target)
  hearMapRumors(w,c,target)
  hearPrisonerSightings(w,c,target)
  hearScoutRooms(w,c,target)
  hearScoutWorld(w,c,target)
  hearTownRumors(w,c,target)
  target.met = true
  hearNpcRelationships(w,c,target)
  const remembered=hearLegacyResident(w,target,c)
  acknowledgeRescue(w,c,target)
  if(c.id===w.s.playerId){hearFactionRelations(w,target);hearCompanionBond(w,target)}
  log(w, 'info', `${target.name}과(와) 이야기를 나눴다. ${remembered?'직접 겪은 옛 원정을 들려준다.':marketFor(w, target) ? '쓸 만한 물건이 있으면 장부를 보자고 한다.' : '길의 소식은 시장 사람들에게 물어보라고 한다.'}`)
  return null
}
export function stockCount(market: SettlementMarket, def: string): number { return market.items.filter((it) => it.def === def).reduce((n, it) => n + it.count, 0) }
export function regionalPrice(w: World, market: SettlementMarket, def: string): number {
  const d = economyDef(w), target = w.db.get<TraderStockDef>(market.stockDef).entries.find((e) => e.item === def)?.target
  const regional = settlementPriceFactor(w, market.site, def)
  return regional !== undefined ? clamp(regional, d.regionMin, d.regionMax) : target ? clamp(Math.sqrt(target / Math.max(1, stockCount(market, def))), d.regionMin, d.regionMax) : 1
}
export function tradePrice(w: World, c: Creature, trader: Creature, it: ItemInst, buy: boolean, ignoreHaggle=false): number {
  const d = itemDef(w, it), market = marketFor(w, trader), e = economyDef(w)
  if (!market) return 0
  const base = w.db.item(it.def), material = primaryMaterial(w, it), reference = base.stuffSlots?.find((s) => s.primary)?.ref
  const ref = reference ? w.db.get<import('./types').MaterialDef>(reference).valuePerKg : material?.valuePerKg
  const materialMult = material && ref ? material.valuePerKg / ref : 1
  const condition = (30 + 70 * clamp(it.durability ?? 100, 0, 100) / 100) / 100
  const fresh = (d.food||d.drink?.freshHours) ? clamp((it.freshness ?? 100) / 100, 0, 1) : 1
  const uses = d.uses ? clamp((it.uses ?? d.uses) / d.uses, 0, 1) : 1
  const rep = c.id === w.s.playerId ? reputationBand(w, trader.faction).price : 1
  const h = c.id === w.s.playerId ? market.haggle : undefined, successes = !ignoreHaggle&&h?.day === dayOf(w) ? h.successes : 0
  const haggleMult = buy ? 1 - successes * e.haggleStep : 1 + successes * e.haggleStep
  const irritation = h && h.day === dayOf(w) && h.irritation >= e.irritationAt ? (buy ? e.irritationPrice : 1 / e.irritationPrice) : 1
  const spread = buy ? e.sellMult : trader.faction === 'guild' && d.relic ? e.guildRelicBuyMult : e.buyMult
  const value = (worldMapMarketValue(w,it) ?? d.value ?? 0) * (it.pillRemaining ?? 1) * materialMult * qualityInfo(it).value * condition * fresh * uses * regionalPrice(w, market, it.def) * (buy ? rep : 1 / rep) * haggleMult * irritation * spread
  return Math.max(buy ? 1 : 0, buy ? Math.ceil(value - 1e-9) : Math.floor(value + 1e-9))+(it.contents??[]).reduce((sum,child)=>sum+tradePrice(w,c,trader,child,buy,ignoreHaggle)*child.count,0)
}
export function tradeQuote(w: World, c: Creature, trader: Creature, buy: TradeLine[], sell: TradeLine[]): { error: string | null; buy: number; sell: number; balance: number } {
  const result = { error: tradeAccess(w, c, trader), buy: 0, sell: 0, balance: 0 }
  if (result.error) return result
  const market = marketFor(w, trader)!, seen = new Set<number>()
  for (const [lines, source, buying] of [[buy, market.items, true], [sell, c.bag, false]] as const) for (const line of lines) {
    const it = source.find((i) => i.uid === line.uid)
    if (!it || !Number.isSafeInteger(line.count) || line.count <= 0 || line.count > it.count || seen.has(line.uid)) { result.error = '거래할 물건과 수량을 다시 확인해야 한다'; return result }
    if(storedItems([it]).some(child=>child.missingItem||child.def==='Item.MissingPlaceholder')){result.error='보관물은 거래할 수 없다';return result}
    seen.add(line.uid)
    const value = tradePrice(w, c, trader, it, buying) * line.count
    if (buying) result.buy += value; else result.sell += value
  }
  result.balance = result.buy - result.sell
  if (!Number.isSafeInteger(result.balance)) result.error = '거래 금액이 너무 크다'
  return result
}
/** 배낭·UID까지 별도 상태로 계산한 뒤 한 번에 반영한다. 판매 공간을 구매에 쓸 수 있다. */
export function exchange(w: World, c: Creature, trader: Creature, buy: TradeLine[], sell: TradeLine[], expectedBalance?: number): string | null {
  const quote = tradeQuote(w, c, trader, buy, sell)
  if (quote.error) return quote.error
  if (!buy.length && !sell.length) return '거래할 물건을 골라야 한다'
  if (expectedBalance !== undefined && expectedBalance !== quote.balance) return '가격이 바뀌었다. 거래 내용을 다시 확인해야 한다'
  const market = marketFor(w, trader)!
  if ((c.money ?? 0) < quote.balance) return `${economyDef(w).currency}가 부족하다`
  if (market.money < -quote.balance) return '상인에게 지급할 돈이 부족하다'
  const tradeGain=buy.reduce((n,line)=>n+(tradePrice(w,c,trader,market.items.find(i=>i.uid===line.uid)!,true,true)-tradePrice(w,c,trader,market.items.find(i=>i.uid===line.uid)!,true))*line.count,0)+sell.reduce((n,line)=>n+(tradePrice(w,c,trader,c.bag.find(i=>i.uid===line.uid)!,false)-tradePrice(w,c,trader,c.bag.find(i=>i.uid===line.uid)!,false,true))*line.count,0)
  const bag = structuredClone(c.bag), items = structuredClone(market.items), copy = { ...c, bag }
  const local = { db: w.db, s: { ...w.s, nextId: w.s.nextId } }
  function take(source: ItemInst[], line: TradeLine) {
    const it = source.find((i) => i.uid === line.uid)!, piece = { ...it, count: line.count }
    if (line.count === it.count) source.splice(source.indexOf(it), 1)
    else { it.count -= line.count; piece.uid = local.s.nextId++ }
    delete piece.gx; delete piece.gy; delete piece.rot; delete piece.waterSettlesAt
    return piece
  }
  for (const line of sell) items.push(take(bag, line))
  for (const line of buy) if (addToBag(local, copy, take(items, line)) > 0) return '구매할 물건이 배낭에 들어가지 않는다'
  const cargoLayout=mobileCargoLayout(w,market,items);if(cargoLayout.error)return cargoLayout.error
  for(const pos of cargoLayout.positions){const i=items.find(i=>i.uid===pos.uid)!;i.gx=pos.x;i.gy=pos.y;i.rot=pos.rot||undefined}
  c.bag = bag; c.money = (c.money ?? 0) - quote.balance
  market.items = items; market.money += quote.balance; w.s.nextId = local.s.nextId
  rememberLifeEvent(w,c,'goodTrade',{tradeGain})
  rememberMeeting(w,c,trader)
  if (c.id === w.s.playerId) log(w, 'good', `${trader.name}과(와) 거래했다. 구매 ${quote.buy}, 판매 ${quote.sell}${economyDef(w).currency}.`)
  return null
}
export function bargainChance(w: World, c: Creature, trader: Creature): number {
  const market = marketFor(w, trader)
  if (!market) return 0
  const score = (effectiveStat(w, c, 'per') - 10) * 2 + effectiveStat(w, c, 'wil') - 10 + traitAdd(w, c, 'bargain')
  return clamp(economyDef(w).haggleBase + score + firstImpressionScore(w,c,trader)*(firstImpressionRules(w)?.hagglePerPoint??0) - w.db.get<TraderStockDef>(market.stockDef).bargaining + Math.floor(reputation(w, trader.faction) / 5), 5, 90)
}
export function bargain(w: World, c: Creature, trader: Creature): string | null {
  const error = tradeAccess(w, c, trader)
  if (error) return error
  const m = marketFor(w, trader)!, e = economyDef(w), day = dayOf(w)
  const h = m.haggle?.day === day ? m.haggle : { day, rounds: 0, successes: 0, irritation: 0, refusedUntil: 0 }
  if (h.rounds >= e.haggleMax) return '오늘의 흥정은 끝났다'
  rememberMeeting(w,c,trader)
  m.haggle = h; h.rounds++
  if (rng(w, 'story').chance(bargainChance(w, c, trader) / 100)) { h.successes++; log(w, 'good', `${trader.name}이(가) 값을 조금 양보했다.`) }
  else { h.irritation++; if (h.irritation >= e.refusalAt) h.refusedUntil = turnOf(w) + e.refusalTurns; log(w, 'warn', `${trader.name}의 표정이 굳었다. ${h.irritation >= e.refusalAt ? '내일까지 거래하지 않겠다고 한다.' : '흥정이 통하지 않았다.'}`) }
  return null
}
/** 일 단위 생산·소비와 3일마다의 재입고. 판매한 물건은 재고에 남는다. */
export function economyTick(w: World, atDay?: number) {
  const simulation = w.s.overworld?.simulation
  if (simulation && atDay === undefined) { worldSimulationTick(w); return }
  const markets = w.s.overworld?.markets
  if (!markets) return
  const day = atDay ?? dayOf(w)
  if (simulation && simulation.marketDay >= day) return
  if (simulation) simulation.marketDay = day
  for (const m of Object.values(markets)) {
    if(m.mobile)continue
    const stock = w.db.get<TraderStockDef>(m.stockDef)
    while (m.day < day) {
      m.day++
      for (const e of stock.entries) {
        if (simulation && worldSimulationDef(w).items[e.item]) continue
        let left = e.dailyConsumption
        for (const it of m.items.filter((i) => i.def === e.item)) { const used = Math.min(left, it.count); it.count -= used; left -= used }
        m.items = m.items.filter((i) => i.count > 0)
        const add = Math.max(0, Math.min(e.dailyProduction, e.target * 2 - stockCount(m, e.item)))
        if (add) m.items.push(makeMarketItem(w, e.item, add, m.day * TURNS_PER_DAY))
      }
      if (m.day >= m.nextRestock) {
        if (simulation) for (const e of stock.entries) if (worldSimulationDef(w).items[e.item]) {
          const count = withdrawForMarket(w, m.site, e.item, Math.max(0, e.target - stockCount(m, e.item)))
          if (count) m.items.push(makeMarketItem(w, e.item, count, m.day * TURNS_PER_DAY))
        }
        const escrow=(w.s.overworld?.contracts??[]).filter((r)=>r.site===m.site&&r.status==='active').reduce((n,r)=>n+r.escrow,0)
        m.money = Math.max(m.money, stock.money-escrow); m.nextRestock += economyDef(w).restockDays }
    }
  }
}
export function nearbyPeople(w: World): Creature[] {
  const p = player(w)
  return w.s.creatures.filter((c) => c.id !== p.id && c.alive && cheb(c.pos, p.pos) <= 1 && !hostile(w, p, c))
}
