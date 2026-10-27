/** Public diagnostic entry: the actual HumanView, atlas and static resolved Def catalog. */
import { Application, Container, Graphics } from 'pixi.js'
import { HumanView } from '../../src/client/render/human-view'
import { loadAtlas, releaseAtlas, atlasStats } from '../../src/client/render/atlas'
import { humanDirections, humanVisibleOwners, humanSpecFrameKeys, type HumanDirection, type HumanSpec } from '../../src/client/render/human-spec'
import {WALK_STEP_MS} from '../../src/client/render/walk-motion'
import { motionDurations, type MotionName } from '../../src/client/render/character-motion'
import type { HumanSurface, HumanClothingState } from '../../src/client/render/human-state'
import type { Slot } from '../../src/core/types'
import {humanArt,humanArtFor,humanModels} from '../../src/client/render/human-art'

export interface HumanPreviewGarment {
  id: string; label: string; slot: Slot; sprite: string
  apparel: { layer: number; groups: string[]; liningHost: boolean; liner: boolean }
  coveredOwners: string[]; sourceKinds: string[]
}
export interface HumanPreviewCatalog {
  format: 1; revision: number; specId: string; disclosure: string
  sourceHashes: { spec: string; manifest: string; renderer: string }
  frameKeys: string[]
  body: { id: string; label: string; kind: 'humanoid'; parts: { id: string; label: string; parent: string | null; groups: string[]; internal: boolean; coverage?: number; stumpParent?: string }[] }
  garments: HumanPreviewGarment[]
  prosthetics: { id: string; label: string; item: string; itemLabel: string; sprite: string; targets: string[]; efficiency: number; grip: boolean | null; sourceFrame: string; authoredViews: 1 }[]
  liningCandidates: string[]
  presets: { id: string; label: string; garments: string[]; lining?: string }[]
  limits: string[]
}

const element = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id)
  if (!node) throw Error('Missing human-preview control: ' + id)
  return node as T
}
const select = (id: string) => element<HTMLSelectElement>(id)
const input = (id: string) => element<HTMLInputElement>(id)
const value = (id: string) => select(id).value
const checked = (id: string) => input(id).checked
const finiteValue = (id: string) => { const n = Number(input(id).value); return Number.isFinite(n) ? n : 0 }
const option = (id: string, label: string) => { const node = document.createElement('option'); node.value = id; node.textContent = label; return node }
let spec:HumanSpec = humanArt
const modes: readonly [MotionName, string][] = [
  ['idle', '대기'], ['walk', '걷기'], ['attack', '공격'], ['block', '막기'], ['work', '작업'], ['use', '사용'], ['shoot', '사격'], ['throw', '투척'], ['crouchDown', '웅크리기'], ['crouchWalk', '웅크려 걷기'], ['stand', '일어서기'], ['hurt', '피격 반응'], ['fall', '넘어짐'], ['sleep', '수면'], ['rise', '몸 일으키기'], ['interact', '상호작용'],
]
const directions: Record<HumanDirection, readonly [number, number]> = { down: [0, 1], left: [-1, 0], right: [1, 0], up: [0, -1] }
const atlasOwner = {}, errors: string[] = [], selected = new Set<string>()
let catalog: HumanPreviewCatalog | null = null, surface: HumanSurface | null = null, app: Application | null = null
let views: HumanView[] = [], scenes: { root: Container; content: Container; floor: Graphics; guides: Graphics; mask: Graphics }[] = []
let ready = false, playing = true, phase = 0, phaseMs = 0, stride = 0, root: [number, number] = [0, 0]
let frames = 0, resetReason = 'initial', pendingInstant = true, last: number | null = null, raf = 0, lastDetailsAt = 0
let warnings: string[] = []
let resize: ResizeObserver | null = null
let frameLoop: ((now: number) => void) | null = null

// The source/build entry lives two levels below the site root (tools/art or artbook/human).
// Set base only after the Vite module has loaded: its ESM imports remain module-relative.
// loadAtlas's BASE_URL='./' then resolves the same registered assets from the site root.
const siteRoot = new URL('../../', location.href)
const base = document.createElement('base'); base.href = siteRoot.href; document.head.prepend(base)
element<HTMLAnchorElement>('game-link').href = siteRoot.href
element<HTMLAnchorElement>('art-link').href = new URL('artbook/', siteRoot).href

function resetViews(reason: string, initial = false) {
  resetReason = reason
  pendingInstant = true
  last = null
  if (initial) { root = [0, 0]; phase = 0; phaseMs = 0; stride = 0; input('phase').value = '0' }
  for (const view of views) view.reset()
}

function descendant(owner: string, ancestor: string): boolean {
  if (!catalog || !ancestor) return false
  const visited = new Set<string>()
  let part: string | null = owner
  while (part && !visited.has(part)) {
    if (part === ancestor) return true
    visited.add(part)
    part = catalog.body.parts.find(p => p.id === part)?.parent ?? null
  }
  return false
}

function rebuildSurface() {
  if (!catalog) return
  warnings = []
  const missing = value('missing'), missingRoots=[missing,...[...select('missing-extra').selectedOptions].map(option=>option.value)].filter(Boolean),replacement = catalog.prosthetics.find(p => p.id === value('replacement'))
  const installRoot = value('replacement-root'), invalidMount = !!replacement && missingRoots.some(root=>root!==installRoot&&descendant(installRoot,root))
  if (invalidMount) warnings.push('선택한 의수족 설치 뿌리의 상위가 결손입니다. 이 합성 조합에서는 의수족을 표시하지 않습니다.')
  const parts: HumanSurface['parts'] = {}, durability = finiteValue('durability'), damage = finiteValue('damage') / 100
  for (const id of humanVisibleOwners) {
    const replaced = !!replacement && !invalidMount && descendant(id, installRoot)
    const lost = missingRoots.some(root=>descendant(id,root)) || replaced
    parts[id] = { id, flesh: !lost, present: !lost || replaced, damage, efficiency: replaced ? checked('replacement-zero') ? 0 : replacement!.efficiency : lost ? 0 : 1,
      ...(replaced ? { replacement: { root: installRoot, def: replacement!.id, uid: 900001, sprite: replacement!.sprite, durability, efficiency: checked('replacement-zero') ? 0 : replacement!.efficiency } } : {}) }
  }
  const clothing: HumanClothingState[] = [], accessories: HumanSurface['accessories'] = []
  const conditionTarget = value('condition-target'), progress = value('progress')
  const add = (garment: HumanPreviewGarment, slot: Slot, uid: number) => {
    const applies = conditionTarget === '*' || conditionTarget === garment.id
    const half = applies && (checked('half') || progress !== ''), wear = applies ? durability : 100
    const covered = garment.coveredOwners.filter(owner => parts[owner]?.present)
    clothing.push({ uid, def: garment.id, slot, layer: slot === 'lining' ? 0 : garment.apparel.layer, groups: [...garment.apparel.groups], parts: covered, durability: Object.fromEntries(covered.map(owner => [owner, wear])), half,
      ...(applies && progress ? { progress: { kind: progress as 'equip' | 'unequip', left: 50, total: 100 } } : {}) })
    if (!garment.apparel.groups.length && !half) accessories.push({ uid, def: garment.id, slot, sprite: garment.sprite, durability: wear })
  }
  catalog.garments.forEach((garment, index) => { if (selected.has(garment.id)) add(garment, garment.slot, 100001 + index) })
  const lining = catalog.garments.find(g => g.id === value('lining'))
  if (lining) {
    const host = catalog.garments.find(g => selected.has(g.id) && g.slot === 'chest')
    if (host?.apparel.liningHost && lining.apparel.liner) add(lining, 'lining', 200001)
    else { select('lining').value = ''; warnings.push('안감이 선택됐지만 실제 안감 수용 겉옷이 없어 표시하지 않았습니다.') }
  }
  clothing.sort((a, b) => a.layer - b.layer || a.slot.localeCompare(b.slot) || a.uid - b.uid)
  surface = { body: catalog.body.id, parts, clothing, accessories }
  for (const view of views) view.sync(surface)
  element('notice').textContent = warnings.join(' ')
}

function selectedConditionOptions() {
  const control = select('condition-target'), previous = control.value
  control.replaceChildren(option('*', '선택 의복 전체'))
  for (const garment of catalog!.garments) if (selected.has(garment.id) || value('lining') === garment.id) control.append(option(garment.id, garment.label))
  control.value = [...control.options].some(option => option.value === previous) ? previous : '*'
}

function applyPreset() {
  const preset = catalog!.presets.find(p => p.id === value('preset'))
  if (!preset) return
  selected.clear()
  for (const id of preset.garments) selected.add(id)
  for (const control of element('garments').querySelectorAll<HTMLInputElement>('input')) control.checked = selected.has(control.value)
  select('lining').value = preset.lining ?? ''
  selectedConditionOptions()
  rebuildSurface()
  resetViews('outfit preset')
}

function replacementOptions() {
  const replacement = catalog!.prosthetics.find(p => p.id === value('replacement')), control = select('replacement-root')
  control.replaceChildren()
  control.disabled = !replacement
  if (replacement) for (const id of replacement.targets) control.append(option(id, catalog!.body.parts.find(p => p.id === id)?.label + ' · ' + id))
}

function populateHeads(){const labels:Record<string,string>={worker:'주민',healer:'치료사',trader:'상인',guard:'경비',reaver:'약탈자',shade0:'짧은 머리',shade1:'묶은 머리',shade2:'땋은 머리',shade_chief:'우두머리',priest:'늙은 사제',spore0:'짧은 머리 감염자',spore1:'긴 머리 감염자'};select('head').replaceChildren(option('','기본 얼굴'));for(const role of Object.keys(spec.heads??{}))select('head').append(option(role,labels[role]??role))}
function replaceViews(reason:string){views=views.map((view,index)=>{view.destroy();const next=new HumanView(spec,value('head')||undefined);scenes[index].content.addChild(next.root);next.sync(surface??undefined);return next});resetViews(reason);draw()}
function populate() {
  const data = catalog!
  element('disclosure').textContent = data.disclosure
  populateHeads()
  for (const [id, label] of modes) select('motion').append(option(id, label))
  for (const preset of data.presets) select('preset').append(option(preset.id, preset.label))
  select('preset').append(option('custom', '개별 선택'))
  for (const id of data.liningCandidates) select('lining').append(option(id, data.garments.find(g => g.id === id)!.label))
  for (const owner of humanVisibleOwners)for(const id of['missing','missing-extra'])select(id).append(option(owner, (data.body.parts.find(p => p.id === owner)?.label ?? owner) + ' · ' + owner))
  for (const replacement of data.prosthetics) select('replacement').append(option(replacement.id, replacement.label))
  for (const garment of data.garments) {
    const label = document.createElement('label'), box = document.createElement('input'), text = document.createElement('span'), detail = document.createElement('small')
    box.type = 'checkbox'; box.value = garment.id; box.dataset.garment = garment.id
    text.textContent = garment.label
    detail.textContent = `${garment.slot} · 겹 ${garment.apparel.layer} · ${garment.coveredOwners.length}부위 · ${garment.id}`
    text.append(detail); label.append(box, text); element('garments').append(label)
    box.addEventListener('change', () => {
      if (box.checked) {
        for (const peer of data.garments) if (peer.slot === garment.slot) selected.delete(peer.id)
        selected.add(garment.id)
      } else selected.delete(garment.id)
      for (const peer of element('garments').querySelectorAll<HTMLInputElement>('input')) peer.checked = selected.has(peer.value)
      select('preset').value = 'custom'
      selectedConditionOptions(); rebuildSurface(); resetViews('individual garment')
    })
  }
  for (const text of data.limits) { const p = document.createElement('p'); p.textContent = text; element('limits').append(p) }
  const hashes = document.createElement('p'); hashes.textContent = '등록 spec: ' + data.specId + ' · 원문 frame key ' + data.frameKeys.length + '개 · export spec SHA256 ' + data.sourceHashes.spec
  element('limits').append(hashes)
}

function bind() {
  select('head').addEventListener('change',()=>replaceViews('head role'))
  select('body').addEventListener('change',()=>{spec=humanArtFor(value('body'));populateHeads();replaceViews('body model')})
  element('play').addEventListener('click', () => { playing = !playing; last = null; element('play').textContent = playing ? '표현 정지' : '표현 재생' })
  element('step').addEventListener('click', () => { playing = false; element('play').textContent = '표현 재생'; advance(100 * Number(value('speed'))); draw() })
  element('reset').addEventListener('click', () => { resetViews('manual reset', true); draw() })
  select('preset').addEventListener('change', () => { applyPreset(); draw() })
  select('direction').addEventListener('change', () => { resetViews('direction'); draw() })
  select('motion').addEventListener('change', () => { resetViews('motion', true); draw() })
  select('speed').addEventListener('change', () => { resetViews('speed'); draw() })
  input('instant').addEventListener('change', () => { resetViews('instant display'); draw() })
  input('phase').addEventListener('input', () => {
    playing = false; element('play').textContent = '표현 재생'
    phase = finiteValue('phase') / 1000; phaseMs = phase * motionDurations[value('motion') as MotionName]
    resetViews('manual pose phase'); draw()
  })
  select('replacement').addEventListener('change', () => { replacementOptions(); rebuildSurface(); resetViews('prosthetic source'); draw() })
  for (const id of ['lining', 'condition-target', 'durability', 'half', 'progress', 'damage', 'missing','missing-extra', 'replacement-root', 'replacement-zero']) {
    element(id).addEventListener(id === 'durability' || id === 'damage' ? 'input' : 'change', () => { selectedConditionOptions(); rebuildSurface(); resetViews('synthetic surface'); draw() })
  }
  for (const id of ['scale', 'guides', 'targets', 'left-x', 'left-y', 'right-x', 'right-y']) element(id).addEventListener('change', () => draw())
  document.addEventListener('visibilitychange', () => { last = null; if (!document.hidden) resetViews('visible reentry') })
}

function advance(dtMs: number) {
  const mode = value('motion') as MotionName
  phaseMs += dtMs
  const duration = motionDurations[mode]
  phase = checked('loop') ? phaseMs % duration / duration : Math.min(1, phaseMs / duration)
  if (!checked('loop') && phase === 1) { playing = false; element('play').textContent = '표현 재생' }
  if (mode === 'walk' || mode === 'crouchWalk') {
    const forward = directions[value('direction') as HumanDirection], distance = dtMs * 16 / (mode === 'walk' ? WALK_STEP_MS : motionDurations.crouchWalk/2)
    root = [root[0] + forward[0] * distance, root[1] + forward[1] * distance]
    stride += distance / 16
  }
  input('phase').value = String(Math.round(phase * 1000))
  draw(dtMs)
}

function draw(dtMs = 0) {
  if (!ready || !app || !surface) return
  const zoom=Number(value('scale')),stage=element('stage'),stageHeight=zoom>4?40*zoom+96:300;stage.style.height=stageHeight+'px'
  if(app.screen.width!==stage.clientWidth||app.screen.height!==stageHeight)app.renderer.resize(stage.clientWidth,stageHeight)
  const direction = value('direction') as HumanDirection, mode = value('motion') as MotionName
  const moving = mode === 'walk' || mode === 'crouchWalk'
  const prone = mode === 'fall' || mode === 'sleep' || mode === 'rise' && phase < 1
  const fall = mode === 'fall' ? phase : mode === 'sleep' ? 1 : mode === 'rise' ? 1 - phase : 0
  const all = value('scale') === 'all', width = app.screen.width, height = app.screen.height, native = [1, 2, 4]
  const labels: string[] = []
  views.forEach((view, index) => {
    view.prepare({ direction, root, mode, phase, stride, moving, crouched: mode === 'crouchWalk', prone, alive: true, fall, dtMs, instant: pendingInstant || checked('instant'), tint: 0xffffff, alpha: 1, unknown: false })
    if (checked('targets')) for (const side of ['left', 'right'] as const) if (view.usable(side)) view.handTarget(side, [finiteValue(side + '-x'), finiteValue(side + '-y')])
    view.render()
    const scene = scenes[index], scale = zoom>4?zoom:native[index]
    scene.root.visible = all || (zoom>4?index===2:zoom===scale)
    if (!scene.root.visible) return
    const span = all ? width / 3 : width, start = all ? index * span : 0
    scene.root.position.set(start, 0)
    scene.mask.clear().rect(0, 0, span, height).fill(0xffffff)
    scene.content.position.set(span / 2, height - 48)
    scene.content.scale.set(scale)
    const floor = scene.floor.clear(), radius = span / scale / 2 + 16
    for (let x = Math.floor((root[0] - radius) / 16) * 16; x <= root[0] + radius; x += 16) floor.moveTo(x - root[0], -height / scale).lineTo(x - root[0], 48 / scale)
    for (let y = Math.floor((root[1] - height / scale) / 16) * 16; y <= root[1] + 48 / scale; y += 16) floor.moveTo(-radius, y - root[1]).lineTo(radius, y - root[1])
    floor.stroke({ color: 0x3f4737, width: 1 / scale, alpha: .6 })
    const guide = scene.guides.clear()
    if (checked('guides')) {
      guide.moveTo(-4, 0).lineTo(4, 0).moveTo(0, -2).lineTo(0, 2).stroke({ color: 0xb6b887, width: .4 })
      for (const side of ['left', 'right'] as const) {
        const grip = view.grip(side)
        guide.circle(grip[0], grip[1], .5).fill(0x91c4a4)
        if (checked('targets')) guide.circle(finiteValue(side + '-x'), finiteValue(side + '-y'), .6).stroke({ color: 0xe2bf72, width: .25 })
      }
    }
    labels.push(`동일 등록 원본 · ${scale}×`)
  })
  pendingInstant = false
  const labelsNode = element('scale-labels')
  if (labelsNode.dataset.mode !== value('scale')) {
    labelsNode.dataset.mode = value('scale'); labelsNode.replaceChildren(...labels.map(text => { const span = document.createElement('span'); span.textContent = text; return span }))
  }
  frames++
  app.render()
  const observed = views[0].inspect(), gait = observed?.gait
  element('status').textContent = `합성 ${catalog!.garments.length}의복 / ${catalog!.prosthetics.length}의수족 · ${modes.find(m => m[0] === mode)?.[1]} ${(phase * 100).toFixed(0)}% · 뿌리 ${root.map(n => n.toFixed(2)).join(', ')} · 접지 ${gait?.supportContacts ?? 0}/2 · 연속 접지 오차 ${(gait?.maxStanceDrift ?? 0).toFixed(4)}px · 팔 도달 잔차 ${(observed?.maxArmReachError ?? 0).toFixed(3)}px`
  element('phase-value').textContent = `${(phase * 100).toFixed(0)}%`
  element('durability-value').textContent = `${finiteValue('durability')}%`
  element('damage-value').textContent = `${finiteValue('damage')}%`
  const canvas = app.canvas
  canvas.dataset.ready = 'true'; canvas.dataset.direction = direction; canvas.dataset.motion = mode; canvas.dataset.frame = String(frames)
  if (performance.now() - lastDetailsAt > 200 || dtMs === 0) {
    element('inspection').textContent = JSON.stringify(observe(), null, 2)
    lastDetailsAt = performance.now()
  }
}

function observe() {
  return {
    diagnosticOnly: true, syntheticUIDs: true, coreWorldCreated: false, wholeStateEvidence: false, ready, errors: [...errors],
    spec: spec.id, catalogRevision: catalog?.revision ?? null, exportedSourceHashes: catalog?.sourceHashes ?? null,
    catalog: catalog ? { body: catalog.body, garments: catalog.garments, prosthetics: catalog.prosthetics, liningCandidates: catalog.liningCandidates } : null,
    controls: { body:value('body'),playing, speed: Number(value('speed')), direction: value('direction'), head:value('head'), mode: value('motion'), phase, stride, root: [...root], scale: value('scale'), selected: [...selected], lining: value('lining'), missing: value('missing'), missingExtra:[...select('missing-extra').selectedOptions].map(option=>option.value), replacement: value('replacement'), replacementRoot: value('replacement-root'), half: checked('half'), progress: value('progress'), durability: finiteValue('durability'), damage: finiteValue('damage'), replacementZero: checked('replacement-zero'), handTargets: checked('targets'), instant: checked('instant') },
    frames, resetReason, warnings: [...warnings], surface, atlas: atlasStats(), views: views.map(view => view.inspect()),
    sourceFramesAreNotAuthoredActionFrames: true,
  }
}
Object.defineProperty(window, 'inspect_human_preview', { value: () => structuredClone(observe()), writable: false, configurable: false })

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  errors.push(message); playing = false
  element('status').textContent = '인체 진단 화면을 준비하지 못했습니다: ' + message
  element('status').classList.add('error')
}

async function start() {
  for (const control of document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button,input,select')) control.disabled = true
  const response = await fetch(new URL('artbook/human/catalog.json', siteRoot))
  if (!response.ok) throw Error('정의 목록이 없습니다. export-human-preview-v389.ts를 빌드 전에 실행해야 합니다. HTTP' + response.status)
  catalog = await response.json() as HumanPreviewCatalog
  const actualKeys = [...new Set(Object.values(humanModels).flatMap(humanSpecFrameKeys))]
  if (catalog.format !== 1 || catalog.specId !== spec.id || catalog.garments.length !== 25 || catalog.prosthetics.length !== 6 || [...actualKeys].sort().join('\n') !== [...catalog.frameKeys].sort().join('\n') || humanDirections.length !== 4) throw Error('현재 HumanView와 내보낸 정의 목록이 다릅니다.')
  populate()
  await loadAtlas(actualKeys, [], atlasOwner)
  app = new Application()
  const stage = element('stage'); stage.style.height = '300px'; stage.style.aspectRatio = 'auto'
  await app.init({ width: stage.clientWidth, height: 300, background: 0x20241c, antialias: false, resolution: 1, autoDensity: false, autoStart: false })
  stage.append(app.canvas)
  const params=new URLSearchParams(location.search),model=params.get('body');if(model&&humanModels[model]){select('body').value=model;spec=humanArtFor(model);populateHeads()}const requestedHead=params.get('head');if(requestedHead&&spec.heads?.[requestedHead])select('head').value=requestedHead
  views = [1, 2, 4].map(() => new HumanView(spec,value('head')||undefined))
  scenes = views.map(view => {
    const root = new Container(), content = new Container(), floor = new Graphics(), guides = new Graphics(), mask = new Graphics()
    content.addChild(floor, view.root, guides); root.addChild(content, mask); root.mask = mask; app!.stage.addChild(root)
    return { root, content, floor, guides, mask }
  })
  for (const control of document.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>('button,input,select')) control.disabled = false
  replacementOptions(); applyPreset(); bind()
  ready = true; draw()
  resize = new ResizeObserver(() => { if (app) { app.renderer.resize(stage.clientWidth, stage.clientHeight); draw() } })
  resize.observe(stage)
  frameLoop = (now: number) => {
    try {
      const dt = last === null ? 0 : Math.min(96, Math.max(0, now - last)); last = now
      if (!document.hidden && playing && Number(value('speed')) > 0) advance(dt * Number(value('speed')))
      else draw()
      raf = requestAnimationFrame(frameLoop!)
    } catch (error) { fail(error) }
  }
  raf = requestAnimationFrame(frameLoop)
}

window.addEventListener('pagehide', event => {
  cancelAnimationFrame(raf); last = null
  if (event.persisted) return
  resize?.disconnect()
  for (const view of views) view.destroy()
  views = []
  app?.destroy(true, { children: true, texture: false, textureSource: false }); app = null
  frameLoop = null
  void releaseAtlas(atlasOwner)
})
window.addEventListener('pageshow', event => {
  if (event.persisted && ready && frameLoop) { resetViews('history reentry'); raf = requestAnimationFrame(frameLoop) }
})
void start().catch(fail)
