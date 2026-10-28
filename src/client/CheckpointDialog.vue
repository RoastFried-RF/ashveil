<script setup lang="ts">
import {t,defText} from './locale'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { packagesRevision } from './mod-catalog'
import { packages, pendingCheckpoint, pendingContentReview, checkpointBusy, checkpointError, cancelCheckpoint, cancelContentReview, confirmCheckpoint, reviewCheckpoint } from './store'
import ContentChangeReview from './ContentChangeReview.vue'
import ModOrderControl from './ModOrderControl.vue'
const selection=ref([...(pendingCheckpoint.value?.mods??[])])
watch(()=>pendingCheckpoint.value?.raw,()=>{selection.value=[...(pendingCheckpoint.value?.mods??[])]},{immediate:true,flush:'sync'})
const optional=computed(()=>{void packagesRevision.value;return packages.filter(p=>p.manifest.id!=='core')})
const names=computed(()=>Object.fromEntries(optional.value.map(p=>[p.manifest.id,p.manifest.name])))
const previous=document.activeElement as HTMLElement|null
onMounted(async()=>{await nextTick();document.querySelector<HTMLElement>('[data-testid="checkpoint-dialog"] button')?.focus()})
onBeforeUnmount(()=>previous?.focus())
</script>
<template>
  <div class="fixed inset-0 z-[8000] flex items-start justify-center overflow-y-auto bg-black/85 p-4" role="dialog" aria-modal="true" :aria-label="t('저장 지점 복원')" data-testid="checkpoint-dialog">
    <section class="df df-gold my-auto w-full max-w-2xl space-y-3 text-xs leading-6">
      <div class="flex items-center justify-between"><h2 class="font-title text-xl text-amber-100">{{ t('{0} 저장 지점 복원',pendingCheckpoint?defText({id:pendingCheckpoint.mode,label:pendingCheckpoint.label}):'') }}</h2><button class="dbtn" data-testid="checkpoint-close" @click="cancelCheckpoint">{{ t("닫기 (Esc)") }}</button></div>
      <p v-if="pendingCheckpoint?.raw" data-testid="checkpoint-summary">{{ t("{0} · 시드 {1} · {2}턴" ,pendingCheckpoint.name,pendingCheckpoint.seed,pendingCheckpoint.turn) }}</p>
      <p class="text-amber-200">{{ t("복원하면 현재 원정을 이 저장 지점으로 되돌리고 자동 기록을 덮어쓴다. 저장 지점 자체는 남는다. 확인 전에는 현재 원정을 바꾸지 않는다.") }}</p>
      <p v-if="checkpointBusy" role="status">{{ t("기록을 확인하는 중…") }}</p>
      <p v-if="checkpointError" class="text-red-300" role="alert" data-testid="checkpoint-error">{{ t(checkpointError) }}</p>
      <details v-if="pendingCheckpoint?.raw" class="border-y border-ash-600 py-2">
        <summary>{{ t("복원에 사용할 콘텐츠 모드") }}</summary>
        <p>{{ t("설치되지 않은 모드를 제외하거나 구성을 바꾼 뒤 다시 검토할 수 있다.") }}</p>
        <label v-for="pkg in optional" :key="pkg.manifest.id" class="flex gap-2"><input v-model="selection" type="checkbox" :value="pkg.manifest.id" :disabled="checkpointBusy" @change="cancelContentReview()" />{{ pkg.manifest.name }}</label>
        <ModOrderControl v-model="selection" :names="names" :disabled="checkpointBusy" prefix="checkpoint" @update:model-value="cancelContentReview()" />
        <button class="dbtn" data-testid="checkpoint-review-mods" :disabled="checkpointBusy" @click="reviewCheckpoint(selection.filter(id=>optional.some(p=>p.manifest.id===id)))">{{ t("선택한 구성 다시 검토") }}</button>
      </details>
      <ContentChangeReview :review="pendingContentReview" :loading="checkpointBusy" @cancel="cancelCheckpoint" @accept="confirmCheckpoint" />
    </section>
  </div>
</template>
