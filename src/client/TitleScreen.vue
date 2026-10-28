<script setup lang="ts">
import {t,defText} from './locale'
import { computed, onMounted, ref, watch } from 'vue'
import { openDefinitionInspector } from './definition-inspector-ui'
import ModOrderControl from './ModOrderControl.vue'
import ModImportControl from './ModImportControl.vue'
import SeedShareControl from './SeedShareControl.vue'
import ChroniclePanel from './ui/ChroniclePanel.vue'
import ContentChangeReview from './ContentChangeReview.vue'
import {reviewSeedShare} from '../core/seed-share'
import {modInstallation,packagesRevision} from './mod-catalog'
import { preferences, preferencesOpen } from './preferences'
import CharacterPortrait from './ui/CharacterPortrait.vue'
import {PREVIEW_VERSION} from './build-version'
import { IMPRINT_MODE, newGame, player, economyDef, STAT_LABEL, type BackgroundDef, type Stats, type SaveModeDef } from '../core'
import { checkpointSummaries, beginCheckpointLoad, pendingCheckpoint, createSeedCode, startSharedSeed, inspectDb, chronicle, continueImprint, imprintMods, reviewImprintMods, pendingContentReview, cancelContentReview, hasImprint, saveError, packages, randomSeed, starting, startNew } from './store'

const seed = ref(randomSeed())
const compactStats:Record<string,string> = {'근력':'STR','민첩':'AGI','활력':'VIT','지각':'PER','의지':'WIL'}
const publicBase = import.meta.env.BASE_URL
const titleArtVisible = ref(true)
const titleArtUrl = new URL('art/direction-v303/monastery-title.png', new URL(publicBase, document.baseURI)).href
const bg = ref<string>('')
const storyteller=ref('')
const saveMode=ref(IMPRINT_MODE)
const saveModes=computed(()=>selectedDb.value.all<SaveModeDef>('SaveMode'))
const selectedSaveMode=computed(()=>saveModes.value.find(m=>m.id===saveMode.value))
const savedCheckpoints=ref<Awaited<ReturnType<typeof checkpointSummaries>>>([])
let checkpointListGeneration=0
async function refreshCheckpoints(){const ticket=++checkpointListGeneration,rows=await checkpointSummaries(saveModes.value.filter(m=>m.manual!=='none'));if(ticket===checkpointListGeneration)savedCheckpoints.value=rows}
const storyProfiles=computed(()=>loadErrors.value.length?[]:selectedDb.value.event('Event.ReaverPatrol').director?.profiles??[])
const err = ref<string | null>(null)
const mods = ref<string[]>([])
const optionalMods = computed(()=>{void packagesRevision.value;return packages.filter((p) => p.manifest.id !== 'core')})
const modNames=computed(()=>Object.fromEntries(optionalMods.value.map(p=>[p.manifest.id,p.manifest.name])))
const imprint = ref(false)
const imprintSelectionOpen=ref(false),imprintSelection=ref<string[]>([]),savedImprintMods=ref<string[]>([])
const unavailableImprintMods=computed(()=>savedImprintMods.value.filter(id=>!optionalMods.value.some(p=>p.manifest.id===id)))
watch(()=>imprintSelection.value.join('\n'),()=>cancelContentReview())
const loading = ref(true)
onMounted(async () => { try{await modInstallation.initialize()}catch(error){err.value=(error as Error).message}finally{imprint.value = await hasImprint();await refreshCheckpoints(); loading.value = false} })
const chron = ref(chronicle())

const creationRoll = ref<0 | 1>(0)
const sharedCode=ref<string|null>(null)
let applyingSharedCode=false
const sharedReview=computed(()=>{void packagesRevision.value;return sharedCode.value?reviewSeedShare(sharedCode.value,packages):null})
const sharedErrors=computed(()=>sharedReview.value?.errors??[])
const fallbackSeed = randomSeed()
const selectedLoad = computed(() => {void packagesRevision.value;return inspectDb(mods.value)})
const selectedDb = computed(() => selectedLoad.value.db)
const loadErrors = computed(() => selectedLoad.value.report.errors)
const backgrounds = computed(() => selectedDb.value.all<BackgroundDef>('Background'))
watch(()=>saveModes.value.map(m=>m.id).join('\n'),()=>{void refreshCheckpoints()})
watch([seed, bg, () => mods.value.join(',')], () => { if(!applyingSharedCode){creationRoll.value = 0;sharedCode.value=null} },{flush:'sync'})
watch([storyteller,creationRoll,saveMode],()=>{if(!applyingSharedCode)sharedCode.value=null},{flush:'sync'})
const preview = computed(() => {
  try {
    if(loadErrors.value.length)return null
    const db = selectedDb.value
    const s = newGame(db, {scriptPreview:true, seed: sharedReview.value?.shared.seed??(seed.value.trim() || fallbackSeed), background: bg.value || undefined, characterRoll: creationRoll.value,saveMode:saveMode.value })
    const pl = player({ db, s })
    return { pl, currency: economyDef({ db, s }).currency, background: db.background(pl.background!).label, traits: pl.traits.map((id) => db.trait(id)), stats: (Object.keys(STAT_LABEL) as (keyof Stats)[]).map((key) => ({ label: STAT_LABEL[key], value: pl.stats[key] })) }
  } catch { return null }
})

async function start() {
  err.value = null
  try { if(sharedCode.value)await startSharedSeed(sharedCode.value);else await startNew(seed.value.trim() || fallbackSeed, bg.value || undefined, mods.value, creationRoll.value,storyteller.value||undefined,saveMode.value) }
  catch(e){err.value=(e as Error).message}
}
function shareCurrent(){if(sharedCode.value)return sharedCode.value;return createSeedCode(seed.value.trim()||fallbackSeed,bg.value||undefined,mods.value,creationRoll.value,storyteller.value||undefined,saveMode.value)}
function applyShared(code:string){
 try{const review=reviewSeedShare(code,packages);if(review.errors.length)throw Error(review.errors.join('\n'));const s=review.shared;applyingSharedCode=true;seed.value=s.seed;bg.value=s.background??'';mods.value=s.mods.filter(mod=>mod.id!=='core').map(mod=>mod.id);storyteller.value=s.storyteller??'';saveMode.value=s.saveMode??IMPRINT_MODE;creationRoll.value=s.characterRoll;sharedCode.value=code;err.value=null}catch(error){err.value=(error as Error).message}finally{applyingSharedCode=false}
}
async function openImprintSelection(){
 loading.value=true;err.value=null;cancelContentReview()
 try{savedImprintMods.value=await imprintMods();imprintSelection.value=savedImprintMods.value.filter(id=>optionalMods.value.some(p=>p.manifest.id===id));imprintSelectionOpen.value=true}catch(error){err.value=(error as Error).message}finally{loading.value=false}
}
async function reviewSelection(){loading.value=true;err.value=await reviewImprintMods(imprintSelection.value);loading.value=false}
async function cont(token?:string) {
  loading.value = true
  err.value = await continueImprint(token)
  imprint.value = await hasImprint()
  loading.value = false
}
</script>

<template>
  <div class="title-screen">
    <header class="title-hero">
      <img v-if="titleArtVisible" class="title-hero-art" :src="titleArtUrl" alt="" fetchpriority="high" data-testid="title-art" @error="titleArtVisible = false" />
      <div class="title-topline">
        <span>{{ t("하스 · 회색 고원") }}</span>
        <label class="flex items-center gap-2 text-xs">Language / 언어<select v-model="preferences.language" class="bg-ash-900 p-1" aria-label="Language / 언어" data-testid="title-language"><option value="ko">한국어</option><option value="en">English (preview)</option></select></label>
        <button class="dbtn" @click="preferencesOpen = true">{{ t("화면·접근성 설정") }} <kbd>F3</kbd></button>
      </div>
      <h1 class="font-title title-wordmark">ASHVEIL</h1>
      <p class="font-title title-subtitle">{{ t("재의 장막 아래, 당신의 흔적을 남겨라.") }}</p>
      <p v-if="preferences.language==='en'" class="mt-2 text-xs text-ash-300" data-testid="locale-preview-note">English preview: some game text is still in Korean.</p>
      <p class="title-intro">{{ t("잿빛 수도원과 잊힌 납골당. 상처와 굶주림을 견디며 길을 고른다.") }}<br />{{ t("한 번의 삶, 한 사람의 기록.") }}</p>
    </header>

    <main class="title-main">
      <p v-if="saveError" class="mb-4 rounded border border-blood-700 bg-ash-900 p-3 text-xs text-red-300" role="alert">{{ saveError }}</p>
      <section v-if="imprint" class="df df-celtic title-continue">
        <div>
          <h2 class="font-title text-lg font-bold text-[#e5d4a8]">{{ t("아직 끝나지 않은 여정") }}</h2>
          <p class="mt-1 text-xs text-ash-300">{{ t("각인된 떠돌이가 있다. 새로 시작하면 이 각인을 덮어쓴다.") }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="dbtn-gold !min-h-9 !px-4" data-testid="continue" :disabled="loading" @click="cont()">{{ t("각인 불러오기") }} <span aria-hidden="true">→</span></button>
          <button class="dbtn" data-testid="imprint-mods-open" :disabled="loading" @click="openImprintSelection">{{ t("각인 모드 구성 검토") }}</button>
        </div>
      </section>

      <section v-if="imprintSelectionOpen" class="df df-celtic mb-4 space-y-3 text-xs" data-testid="imprint-mod-selection">
        <h2 class="font-title text-base text-amber-100">{{ t("기존 각인에 사용할 모드") }}</h2>
        <p class="text-ash-300">{{ t("core는 항상 사용한다. 선택한 구성은 먼저 검토하며 실제 계속 전까지 각인을 바꾸지 않는다.") }}</p>
        <p v-if="unavailableImprintMods.length" class="text-amber-200" data-testid="imprint-mods-unavailable">{{ t("현재 설치되지 않은 원래 모드:") }} {{ unavailableImprintMods.join(', ') }}</p>
        <div class="max-h-64 space-y-1 overflow-y-auto">
          <label v-for="m in optionalMods" :key="m.manifest.id" class="flex items-center gap-2 rounded border border-ash-700 p-2"><input v-model="imprintSelection" type="checkbox" :value="m.manifest.id" :data-testid="`imprint-mod-${m.manifest.id}`" :disabled="loading" /><span>{{ m.manifest.name }} · {{ m.manifest.version }}<span v-if="(m.manifest.scripts?.stage??0)>=1" class="ml-2 text-amber-200">{{ t("스크립트 포함") }}</span></span></label>
        </div>
        <ModOrderControl v-model="imprintSelection" :names="modNames" :disabled="loading" prefix="imprint" />
        <div class="flex gap-2"><button class="dbtn-gold" data-testid="imprint-mods-review" :disabled="loading" @click="reviewSelection">{{ t("선택한 구성 검토") }}</button><button class="dbtn" :disabled="loading" @click="imprintSelectionOpen=false;cancelContentReview()">{{ t("닫기") }}</button></div>
      </section>

      <ContentChangeReview :review="pendingCheckpoint?null:pendingContentReview" :loading="loading" @cancel="cancelContentReview();err=null" @accept="cont" />

      <section v-if="savedCheckpoints.length" class="df df-celtic mb-4 space-y-2 text-xs" data-testid="title-checkpoints">
        <h2 class="font-title text-base text-amber-100">{{ t("남겨 둔 저장 지점") }}</h2>
        <p>{{ t("원정에서 직접 저장한 표석·탐구 기록을 불러온다. 현재 자동 기록은 복원 확인 후 덮어쓴다.") }}</p>
        <div class="space-y-2"><div v-for="mode in savedCheckpoints" :key="mode.id" class="flex flex-wrap items-center gap-2"><button class="dbtn" :data-testid="`title-checkpoint-${mode.id}`" :disabled="loading||starting" @click="beginCheckpointLoad(mode.id)">{{ defText(mode) }} {{ t("저장 지점 불러오기") }}</button><span class="text-ash-400">{{ mode.summary.kind==='record'?t('{0} · 시드 {1} · {2}턴',mode.summary.name,mode.summary.seed,mode.summary.turn):t(mode.summary.text) }}</span></div></div>
      </section>
      <section class="df df-celtic title-creation">
        <header class="title-section-heading">
          <h2 class="font-title">{{ t("새 떠돌이") }}</h2>
          <span class="title-eyebrow">{{ t("여정의 시작") }}</span>
        </header>
        <div class="title-creation-grid">
          <div class="space-y-4">
            <label class="block">
              <span class="title-field-label">{{ t("세계의 시드") }}</span>
              <div class="flex gap-2">
                <input v-model="seed" data-testid="seed" class="min-w-0 w-full px-3 py-2 font-mono text-sm" />
                <button class="dbtn shrink-0" @click="seed = randomSeed()">{{ t("무작위") }}</button>
              </div>
              <p class="title-field-note">{{ t("같은 시드와 콘텐츠, 같은 선택은 같은 세계로 이어진다.") }}</p>
            </label>
            <label class="block">
              <span class="title-field-label">{{ t("사건 흐름") }}</span>
              <select v-model="storyteller" data-testid="story-persona" class="w-full p-2 text-xs"><option value="">{{ t("기존 고정 장소 규칙") }}</option><option v-for="p in storyProfiles" :key="p.key" :value="p.key">{{ t(p.label) }}</option></select>
              <p class="title-field-note">{{ t(storyProfiles.find(p=>p.key===storyteller)?.description??'장소의 기존 순찰 규칙을 따른다.') }} {{ t("적은 실제 출발지 인원에서만 움직인다.") }}</p>
            </label>
            <label class="block">
              <span class="title-field-label">{{ t("저장 방식") }}</span>
              <select v-model="saveMode" data-testid="save-mode" class="w-full p-2 text-xs"><option v-for="mode in saveModes" :key="mode.id" :value="mode.id">{{ defText(mode) }}{{ t(mode.achievements?' · 기본':' · 업적 없음') }}</option></select>
              <p class="title-field-note" data-testid="save-mode-description">{{ selectedSaveMode?defText(selectedSaveMode,'description'):'' }} {{ t("원정 중에는 방식을 바꿀 수 없다.") }}</p>
            </label>
            <div>
              <span class="title-field-label">{{ t("지나온 삶") }}</span>
              <div class="title-backgrounds">
                <button class="title-background" :class="{ 'is-active': bg === '' }" :aria-pressed="bg === ''" @click="bg = ''">
                  <div class="title-background-name">{{ t("무작위") }}</div>
                  <div class="title-background-description">{{ t("과거는 시드에 맡긴다.") }}</div>
                </button>
                <button v-for="b in backgrounds" :key="b.id" class="title-background" :class="{ 'is-active': bg === b.id }" :aria-pressed="bg === b.id" @click="bg = b.id">
                  <div class="title-background-name">{{ t(b.label) }} <span v-if="!b.literate" class="ml-1 text-[10px] font-normal text-ash-400">{{ t("문맹") }}</span></div>
                  <div class="title-background-description">{{ t(b.description) }}</div>
                </button>
              </div>
            </div>
          </div>

          <aside class="title-passport">
            <div v-if="preview" data-testid="creation-preview">
              <div class="title-passport-top">
                <div class="title-portrait">
                  <CharacterPortrait name="original_wanderer_hero" fill />
                </div>
                <div class="min-w-0">
                  <p class="title-eyebrow mb-2">{{ t("떠돌이의 각인") }}</p>
                  <h3 class="font-title text-xl font-bold text-[#eee0ba]">{{ preview.pl.name }}</h3>
                  <p class="mt-2 text-xs text-ash-300">{{ t('{0}세 · {1}', preview.pl.age?.years??'', t(preview.background)) }}</p>
                </div>
              </div>
              <div class="title-passport-body">
                <div class="title-stat-grid"><div v-for="s in preview.stats" :key="s.label" class="title-stat"><span :title="t(s.label)">{{ preferences.language==='en'?(compactStats[s.label]??t(s.label)):s.label }} {{ s.value }}</span></div></div>
                <div class="flex flex-wrap gap-1.5"><span v-for="trait in preview.traits" :key="trait.id" class="title-trait text-amber-200" :title="t(trait.description)">{{ t(trait.label) }}</span></div>
                <p v-if="preview.pl.money" class="mt-3 text-xs text-ash-200">{{ t('소지금 {0}{1}', preview.pl.money, t(preview.currency)) }}</p>
                <p class="title-field-note">{{ t("기본 능력치 합50 · 배경 보정 포함") }}<br />{{ t("특성에 마우스를 올리면 효과가 보인다.") }}</p>
                <button class="dbtn mt-3 w-full !text-[11px]" data-testid="reroll" :disabled="creationRoll === 1" @click="creationRoll = 1">{{ t(creationRoll ? '재굴림 사용함' : '특성 다시 굴리기 (1회)') }}</button>
              </div>
            </div>
            <p v-else class="p-4 text-xs leading-6 text-red-300">{{ t("선택한 모드와 배경으로 떠돌이를 생성할 수 없다.") }}</p>
            <div class="title-start-panel border-t border-ash-700 p-4">
              <p class="text-xs leading-6 text-ash-300">{{ t(selectedSaveMode?.manual==='none'?'각인은 하나. 행동은 자동 기록되며, 죽으면 삭제된다.':'현재 원정은 자동 기록된다. 복원할 지점은 F3 설정에서 직접 저장해야 한다.') }}</p>
              <button class="dbtn-gold title-start" data-testid="start" :disabled="!preview || loading || starting || !!loadErrors.length || !!sharedErrors.length" @click="start">{{ t(starting?'준비 중…':'고원으로 들어선다') }} <span v-if="!starting" class="ml-2" aria-hidden="true">→</span></button>
              <p v-if="err" class="mt-3 text-xs leading-5 text-blood-300" role="alert">{{ err }}</p>
              <div v-if="loadErrors.length" role="alert" class="mt-3 rounded border border-blood-700 p-2 text-xs text-blood-300" data-testid="mod-errors">
                <p>{{ t("모드 오류를 해결하거나 해당 모드를 꺼야 시작할 수 있다.") }}</p>
                <ul class="mt-2 list-disc pl-4"><li v-for="(message,index) in loadErrors" :key="index">{{ message }}</li></ul>
              </div>
              <p v-if="sharedCode" class="mt-3 text-xs leading-5 text-amber-200" data-testid="seed-share-active">{{ t('공유한 생성 선택을 적용했습니다. 은퇴 인물 기록 {0}명도 공유한 초기 기록을 사용합니다.', sharedReview?.shared.legacyResidents.length??0) }}</p>
              <p v-for="message in sharedErrors" :key="message" class="mt-2 text-xs text-red-300">{{ message }}</p>
            </div>
          </aside>
        </div>

        <div class="title-mods space-y-3">
          <div v-if="optionalMods.length" class="space-y-2 text-xs">
            <div class="flex items-center justify-between gap-2"><span class="title-field-label !mb-0">{{ t("콘텐츠 모드") }}</span><span class="text-[10px] text-ash-400">{{ t('core는 항상 사용 · {0}개 선택', mods.length) }}</span></div>
            <div class="title-mod-list">
              <label v-for="m in optionalMods" :key="m.manifest.id" class="flex items-start gap-2 rounded border p-2">
                <input v-model="mods" type="checkbox" :value="m.manifest.id" :data-testid="`new-mod-${m.manifest.id}`" class="mt-0.5" />
                <span>
                  <span class="text-ash-100">{{ m.manifest.name }}</span>
                  <span v-if="(m.manifest.scripts?.stage??0)>=1" class="ml-1 rounded border border-amber-800 px-1 text-[10px] text-amber-200">{{ t("스크립트 포함") }}</span>
                  <span class="ml-1 text-ash-400">{{ m.manifest.version }}</span>
                  <span class="mt-1 block leading-5 text-ash-300">{{ m.manifest.description }}</span>
                </span>
              </label>
            </div>
          </div>
          <ModOrderControl v-model="mods" :names="modNames" :disabled="loading||starting" prefix="new" />
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p v-if="!loadErrors.length" class="min-w-0 break-all font-mono text-[10px] text-ash-400" data-testid="title-load-hash">{{ t("콘텐츠 로드 해시:") }} {{ selectedDb.loadHash }}</p>
            <button class="dbtn" data-testid="open-definition-inspector" @click="openDefinitionInspector(mods)">{{ t("모드 제작 · Def 조회") }}</button>
          </div>
        </div>
      </section>

      <div class="title-tools">
        <SeedShareControl :disabled="loading||starting" :create-code="shareCurrent" @apply="applyShared" />
        <ModImportControl :disabled="loading||starting" @changed="cancelContentReview()" />
      </div>

      <ChroniclePanel :entries="chron" />

      <footer class="title-footer">
        ASHVEIL · v{{ PREVIEW_VERSION }} {{ t("· 잿빛 숲") }}<br />
        <a class="underline" :href="`${publicBase}artbook/`" target="_blank" rel="noopener">{{ t("캐릭터·물품 원화 도감") }}</a><br />
        <a class="underline" :href="`${publicBase}artbook/motion/`" target="_blank" rel="noopener">{{ t("캐릭터 동작 전후 비교") }}</a> · <a class="underline" :href="`${publicBase}artbook/comparison/`" target="_blank" rel="noopener">{{ t("인물·지형 비교") }}</a><br />
        <a class="underline" :href="`${publicBase}artbook/medical/`" target="_blank" rel="noopener">{{ t("처치 자세·손·도구 검토") }}</a><br />
        {{ t("글꼴: 고운바탕 ·") }} <a class="underline" :href="`${publicBase}fonts/gowun-batang-OFL.txt`" target="_blank" rel="noopener">SIL Open Font License 1.1</a><br />
        {{ t("보존 자료 출처:") }} <a class="underline" href="https://pingupollas.itch.io/knowledge-temple" target="_blank" rel="noopener">Knowledge Temple</a> · <a class="underline" href="https://pingupollas.itch.io/crawling-depths" target="_blank" rel="noopener">Crawling Depths</a> by pingupollas · <a class="underline" href="https://arex-v.itch.io/damp-dungeons" target="_blank" rel="noopener">Damp Dungeons</a> by arex-v · <a class="underline" href="https://kaishido.itch.io/dark-world" target="_blank" rel="noopener">Dark World</a> by kaishido · <a class="underline" href="https://0x72.itch.io/dungeontileset-ii" target="_blank" rel="noopener">Dungeon Tileset II</a> by 0x72 · <a class="underline" href="https://hypnobius.itch.io/dark-ages-ui" target="_blank" rel="noopener">Dark Ages UI</a> by hypnobius · DCSS 32×32 (CC0)<br />{{ t("인물과 장소가 이어가는 생존 이야기") }}
      </footer>
    </main>
  </div>
</template>

<style scoped>
.title-topline { flex-wrap:wrap; }
/* 짧은 데스크톱 화면은 첫 화면 안에서 생성 결과와 시작을 함께 읽는다. */
@media (min-width: 901px) and (max-height: 850px) {
  .title-hero { min-height: clamp(224px, calc(100dvh - 524px), 280px); padding-top: 18px; padding-bottom: 18px; }
  .title-wordmark { margin-top: 18px; font-size: 70px; line-height: 1; }
  .title-subtitle { margin-top: 8px; font-size: 14px; line-height: 1.4; }
  .title-intro { margin-top: 8px; font-size: 11px; line-height: 1.6; }
  .title-hero-art { object-position: right 52%; }
  .title-section-heading { padding-bottom: 11px; }
  .title-creation-grid { margin-top: 14px; }
  .title-passport-top { gap: 12px; padding: 12px; }
  .title-portrait { width: 66px; height: 80px; }
  .title-passport-body, .title-start-panel { padding: 12px; }
  .title-start { margin-top: 12px; }
}
</style>
