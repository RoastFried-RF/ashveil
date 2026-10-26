/** Static, resolved Def catalog for the public HumanView diagnostic. Creates no World. */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { loadDb } from '../loadContent'
import {humanArt} from '../../src/client/render/human-art'
import { humanOwners, humanSpecFrameKeys, type HumanSpec } from '../../src/client/render/human-spec'
import type { ItemDef, ProstheticDef } from '../../src/core/types'
import type { HumanPreviewCatalog } from './human-preview-v389'

const args = process.argv.slice(2), check = args.includes('--check')
if (args.some(arg => arg.startsWith('--') && arg !== '--check')) throw Error('Supported option: --check')
const output = args.find(arg => !arg.startsWith('--')) ?? 'public/artbook/human/catalog.json'
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const spec:HumanSpec = humanArt, specText=JSON.stringify(spec)
const manifestText = readFileSync('src/client/sprites.json', 'utf8')
const manifest = JSON.parse(manifestText) as { frames: Record<string, unknown>; sheets: Record<string, string> }
const { db, report } = loadDb()
if (report.errors.length) throw Error(report.errors.join('\n'))
const body = db.body('Body.Humanoid'), bodyIds = new Set(body.parts.map(part => part.id))
if (body.kind !== 'humanoid' || humanOwners.some(owner => !bodyIds.has(owner))) throw Error('HumanView/body ownership mismatch')
const frameKeys = humanSpecFrameKeys(spec)
for (const key of frameKeys) if (!manifest.frames[key]) throw Error('Unregistered HumanView source frame: ' + key)
const garments = Object.keys(spec.wardrobe).map(id => {
  const def = db.item(id), apparel = def.apparel
  if (!def.slot || def.slot === 'ring' || !apparel) throw Error('Expected actual apparel slot: ' + id)
  return {
    id, label: def.label, slot: def.slot, sprite: def.sprite,
    apparel: { layer: apparel.layer, groups: [...apparel.groups], liningHost: !!apparel.liningHost, liner: !!apparel.liner },
    coveredOwners: humanOwners.filter(owner => apparel.groups.includes(body.parts.find(part => part.id === owner)!.groups[0])),
    sourceKinds: Object.values(spec.wardrobe[id]).filter((value): value is string => typeof value === 'string'),
  }
})
if (garments.length !== 25) throw Error('Review the public garment inventory count: ' + garments.length)
const prosthetics = Object.keys(spec.replacements).map(id => {
  const def = db.get<ProstheticDef>(id), item = db.item(def.item)
  if (def.targets.some(target => !bodyIds.has(target))) throw Error('Unknown prosthetic installation root: ' + id)
  return { id, label: def.label, item: item.id, itemLabel: item.label, sprite: item.sprite, targets: [...def.targets], efficiency: def.efficiency, grip: def.grip ?? null, sourceFrame: spec.replacements[id].frame, authoredViews: 1 as const }
})
if (prosthetics.length !== 6) throw Error('Review the public prosthetic inventory count: ' + prosthetics.length)
const preset = (id: string, label: string, ids: string[], lining?: string) => {
  const selected = ids.map(id => { const garment = garments.find(g => g.id === id); if (!garment) throw Error('Unknown outfit garment: ' + id); return garment })
  if (new Set(selected.map(g => g.slot)).size !== selected.length) throw Error('Conflicting actual outfit slots: ' + id)
  if (lining && (!selected.some(g => g.slot === 'chest' && g.apparel.liningHost) || !garments.find(g => g.id === lining)?.apparel.liner)) throw Error('Invalid actual lining host/liner: ' + id)
  return { id, label, garments: ids, ...(lining ? { lining } : {}) }
}
const catalog: HumanPreviewCatalog = {
  format: 1, revision: 389, specId: spec.id,
  disclosure: '진단용 합성 인체·UID·착용 상태입니다. 실제 게임의 저장·물품·장착·행동·시간·난수를 만들거나 바꾸지 않습니다. 같은 HumanView와 등록 원본을 표시하며 새로운 동작 원화나 전체 세계 검증을 뜻하지 않습니다.',
  sourceHashes: { spec: hash(specText), manifest: hash(manifestText), renderer: hash(readFileSync('src/client/render/human-view.ts', 'utf8')) },
  frameKeys,
  body: { id: body.id, label: body.label ?? body.id, kind: body.kind, parts: body.parts.map(part => ({ id: part.id, label: part.label, parent: part.parent ?? null, groups: [...part.groups], internal: !!part.internal, ...(part.coverage === undefined ? {} : { coverage: part.coverage }), ...(part.stumpParent ? { stumpParent: part.stumpParent } : {}) })) },
  garments, prosthetics,
  liningCandidates: db.all<ItemDef>('Item').filter(item => spec.wardrobe[item.id] && item.apparel?.liner).map(item => item.id),
  presets: [
    preset('base', '기본 내의만', []),
    preset('traveler', '여행 외투 · 안감', ['Item.Hood', 'Item.LeatherCoat', 'Item.Gloves', 'Item.Boots', 'Item.LeatherBelt'], 'Item.RagShirt'),
    preset('guard', '철제 장비', ['Item.ScrapHelmet', 'Item.IronMail', 'Item.Gloves', 'Item.Boots']),
    preset('rain', '비옷과 셔츠', ['Item.Hood', 'Item.OilclothShirt', 'Item.OiledRaincoat', 'Item.Boots']),
    preset('worker', '가죽 앞치마', ['Item.LeatherApron', 'Item.Gloves', 'Item.Boots']),
    preset('scout', '외투와 화살통', ['Item.Hood', 'Item.LeatherCoat', 'Item.Quiver', 'Item.Boots']),
  ],
  limits: [
    '의복 덮임은 실제 Body 부위의 첫 번째 groups 태그와 resolved Item.apparel.groups를 비교한다.',
    '안감은 실제 liningHost/liner 조건을 확인하고 표시 layer0을 사용한다. 방어·보온 판정은 실행하지 않는다.',
    '의수족6종은 기존 단일 물체 원본을 공유한다. 네 방향의 새 착용 원화가 아니다.',
    '표시되는 조건·효율0·반착용·결손은 조작 가능한 합성 surface이며 실제 Core 변화가 아니다.',
    '관절·접지·grip 값은 화면 기하 진단이다. 실제3D 균형·충돌·전투 유효성을 보증하지 않는다.',
  ],
}
const text = JSON.stringify(catalog, null, 2) + '\n'
if (check) {
  if (!existsSync(output) || readFileSync(output, 'utf8') !== text) throw Error('Human preview catalog differs: ' + output)
} else {
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, text)
}
console.log(JSON.stringify({ output, check, body: body.id, bodyParts: body.parts.length, garments: garments.length, prosthetics: prosthetics.length, sourceFrames: frameKeys.length, worldCreated: false, originalPngsModified: false }))
