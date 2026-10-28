<script setup lang="ts">
import {t} from './locale'
import type {contentChangeReview} from '../core/content-compatibility'
defineProps<{review:(ReturnType<typeof contentChangeReview>&{token:string;selectedMods:string[]})|null;loading:boolean}>()
const emit=defineEmits<{accept:[token:string];cancel:[]}>()
</script>
<template>
  <section v-if="review" class="df df-celtic space-y-2 text-xs" data-testid="content-change-review">
    <h2 class="font-title text-base text-amber-100">{{ t(review.status==='same'?'동일한 각인 구성 검토':'각인 콘텐츠 변경 검토') }}</h2>
    <p>{{ t(review.status==='same'?'선택한 구성은 기록된 구성과 같다.':'기록된 구성과 선택한 내용이 다르다. 같은 Def ID의 수치 변경은 현재 정의를 따른다.') }} {{ t('기존 세계는 새로 만들지 않는다.') }}</p>
    <p class="break-all font-mono text-[10px]">{{ t("기록: {0}" ,review.recorded) }}</p><p class="break-all font-mono text-[10px]">{{ t("현재: {0}" ,review.current) }}</p>
    <p v-if="review.selectedMods.length" data-testid="imprint-final-mod-order">{{ t("선택한 최종 적용 순서: {0}" ,review.selectedMods.join(' → ')) }}</p>
    <p v-for="mod in review.changedMods" :key="mod.id" class="break-all text-amber-200">{{ t("내용 변경: {0} · {1} → {2}" ,mod.id,mod.fromVersion,mod.toVersion) }}<span class="block font-mono text-[10px]">{{ mod.fromHash }} → {{ mod.toHash }}</span></p>
    <p v-if="!review.hasModRecord" class="text-ash-400">{{ t("구형 각인에는 개별 모드 버전/해시 기록이 없다.") }}</p>
    <p v-if="review.removedMods.length">{{ t("제거할 모드: {0}" ,review.removedMods.join(', ')) }}</p><p v-if="review.addedMods.length">{{ t("추가할 모드: {0}" ,review.addedMods.join(', ')) }}</p>
    <p v-if="!review.hasRecord" class="text-red-300">{{ t("이 각인에는 원래 정의 목록이 없다. 원래 구성으로 복원해 불러온 뒤 다시 저장해야 한다.") }}</p>
    <template v-else><p>{{ t("사라졌거나 종류가 바뀐 정의 {0}개 · 새 정의 {1}개" ,review.missing.length,review.added.length) }}</p><ul v-if="review.missing.length" class="max-h-40 overflow-auto text-red-300"><li v-for="d in review.missing" :key="d.id">{{ d.id }} · {{ d.type }}</li></ul></template>
    <p v-if="review.renamed.length">{{ t("원래 ID를 이행할 물품 {0}더미" ,review.renameItems) }}</p><p v-for="rename in review.renamed" :key="rename.from" class="break-all text-amber-200">{{ rename.from }} → {{ rename.to }}</p>
    <section v-if="review.renamedRecipes.length" class="my-2 border border-ash-700 p-2" data-testid="recipe-renames-review">
      <p>{{ t("제작법 ID 이행: 배운 지식 {0} · 착수 작업 {1} · 가공 배치 {2} · 거점 지시 {3} · 대기 지시 {4}개." ,review.renameRecipeRecords.known,review.renameRecipeRecords.jobs,review.renameRecipeRecords.batches,review.renameRecipeRecords.orders,review.renameRecipeRecords.queued) }}</p>
      <p>{{ t("착수한 작업은 기록된 재료·출력·노동·가공 규칙이 같을 때만 이어 간다. 물품UID·개수·품질·진행·시간·난수는 보존한다.") }}</p>
      <p v-for="rename in review.renamedRecipes" :key="rename.from" class="break-all text-amber-200">{{ rename.from }} → {{ rename.to }}</p>
    </section>
    <section v-if="review.renamedBodies.length" data-testid="body-renames-review">
      <p>{{ t("같은 기록으로 ID를 이행할 몸 {0}개. 부위 ID·혈액·HP·상처·절단·의수족·전원을 새로 만들지 않는다." ,review.renameBodyRecords) }}</p>
      <p v-for="rename in review.renamedBodies" :key="rename.from" class="break-all text-amber-200">{{ rename.from }} → {{ rename.to }}</p>
    </section>
    <section v-if="Object.values(review.removedCreatures).some(Boolean)" data-testid="missing-creatures-review">
      <p>{{ t("사라진 생물 {0}개체와 방 배치 참조 {1}개, AI 대상 {2}개를 제거합니다. 소지품도 함께 사라집니다." ,review.removedCreatures.actors,review.removedCreatures.residents,review.removedCreatures.targets) }}</p>
      <p>{{ t("사망·전리품·경험치를 만들지 않고 공급원 인원과 과거 기록을 보존합니다. 사라진 종의 공급원은 원본 모드를 복원할 때까지 배치와 인원 정산을 멈춥니다.") }}</p>
    </section>
    <section v-if="review.renamedCreatures.length" data-testid="creature-renames-review">
      <p>{{ t("같은 개체 ID 이행: 인물/생물 {0} · 공급원 참조 {1} · 저장된 방 배치 참조 {2} · 지식 {3} · 표본 {4}개." ,review.renameCreatureRecords.actors,review.renameCreatureRecords.population,review.renameCreatureRecords.residents,review.renameCreatureRecords.knowledge,review.renameCreatureRecords.specimens) }}</p>
      <p>{{ t("실제 몸·개체 번호·인구 수·현재 지식/공포 진행·시간·난수를 보존한다. 다른 몸 종류나 겹치는 기록은 별도 이행이 필요하다.") }}</p>
      <p v-for="rename in review.renamedCreatures" :key="rename.from" class="break-all text-amber-200">{{ rename.from }} → {{ rename.to }}</p>
    </section>
    <section v-if="review.renamedEvents.length" data-testid="event-renames-review">
      <p>{{ t("같은 기록으로 ID를 이행할 사건: 장소 예약 {0} · 스크립트 대기 {1} · 완료 콜백 {2}개. 원래 시각·위치·배우·과거 사건은 보존한다." ,review.renameEventRecords.scheduled,review.renameEventRecords.queued,review.renameEventRecords.callbacks) }}</p>
      <p v-for="rename in review.renamedEvents" :key="rename.from" class="break-all text-amber-200">{{ rename.from }} → {{ rename.to }}</p>
    </section>
    <section v-if="Object.values(review.removedEvents).some(Boolean)" class="my-2 border border-amber-800 p-2" data-testid="missing-events-review">
      <p>{{ t("사라진 사건의 장소 예약 {0} · 스크립트 대기 {1} · 완료 콜백 {2}개를 폐기한다. 이미 출발한 인물·공급원·과거 사건 기록은 보존한다." ,review.removedEvents.scheduled,review.removedEvents.queued,review.removedEvents.callbacks) }}</p>
    </section>
    <section v-if="review.renamedStatuses.length" data-testid="status-renames-review">
      <p>{{ t("같은 기록으로 ID를 이행할 상태·현재 면역/노출 {0}개. 상처 번호·현재 진행·남은 시간·영구 손상은 보존한다." ,review.renameStatusRecords) }}</p>
      <p v-for="rename in review.renamedStatuses" :key="rename.from" class="break-all text-amber-200">{{ rename.type }}: {{ rename.from }} → {{ rename.to }}</p>
    </section>
    <section v-if="review.scriptChanges.removed.length||review.scriptChanges.added.length" class="my-2 border border-amber-800 p-2" data-testid="script-content-review">
      <p v-if="review.scriptChanges.removed.length">{{ t("제거한 스크립트 모드: {0}. 지속 데이터 {1} · 대기 사건 {2} · 완료 콜백 {3}개를 폐기한다." ,review.scriptChanges.removed.join(', '),review.scriptChanges.states,review.scriptChanges.queuedEvents,review.scriptChanges.callbacks) }}</p>
      <p v-if="review.scriptChanges.added.length">{{ t("새 스크립트 모드: {0}. 과거 실행 없이 새 지속 데이터로 시작한다." ,review.scriptChanges.added.join(', ')) }}</p>
    </section>
    <section v-if="!review.recoveryErrors.length&&Object.values(review.removedStatuses).some(Boolean)" class="my-2 border border-amber-800 p-2" data-testid="missing-statuses-review">
      <p>{{ t("없어진 정의의 상처 {0} · 질병 {1} · 생각 {2} · 특성 {3}개를 제거한다." ,review.removedStatuses.wounds,review.removedStatuses.diseases,review.removedStatuses.thoughts,review.removedStatuses.traits) }}</p>
      <p>{{ t("정신붕괴 {0} · 공포 {1} · 붕괴 대기 {2} · 동반 울음 {3}개를 제거한다. 자연 회복/극복 보상은 주지 않는다." ,review.removedStatuses.breakdowns,review.removedStatuses.traumas,review.removedStatuses.pendingBreakdowns,review.removedStatuses.crying) }}</p>
      <p>{{ t("감염 위험 {0} · 보균 표시 {1}개를 제거한다. 현재 상처 피해·상태 효과는 사라지며 혈액·영구 손상·과거 기록은 보존한다." ,review.removedStatuses.risks,review.removedStatuses.carriers) }}</p>
    </section>
    <p v-if="!review.recoveryErrors.length&&(review.convertItems||review.restoreItems)">{{ t("원래 크기로 보관할 물품 {0}더미 · 같은 원본으로 복원할 물품 {1}더미" ,review.convertItems,review.restoreItems) }}</p>
    <p v-for="(error,index) in review.recoveryErrors" :key="index" class="break-all text-red-300">{{ t(error) }}</p>
    <p v-if="review.canContinue&&review.status==='changed'">{{ t("계속하면 변경을 각인·연대기에 기록하고 이 떠돌이의 업적을 비활성화한다.") }}</p>
    <p v-else-if="review.hasRecord&&!review.canContinue" class="text-ash-400">{{ t("삭제된 정의의 복구를 먼저 해야 한다. 현재 각인은 바꾸지 않는다.") }}</p>
    <div class="flex gap-2"><button class="dbtn" data-testid="content-change-cancel" :disabled="loading" @click="emit('cancel')">{{ t("취소") }}</button><button v-if="review.canContinue" class="dbtn-gold" data-testid="content-change-accept" :disabled="loading" @click="emit('accept',review.token)">{{ t("이 구성으로 계속") }}</button></div>
  </section>
</template>
