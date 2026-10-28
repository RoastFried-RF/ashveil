<script setup lang="ts">
import {t} from './locale'
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import {world,simulating,contentReloading,pendingLiveContentReview,reviewLiveContent,applyLiveContent,cancelLiveContentReview} from './store'
import {packages,packagesRevision} from './mod-catalog'
import ModImportControl from './ModImportControl.vue'
import ModOrderControl from './ModOrderControl.vue'
import ContentChangeReview from './ContentChangeReview.vue'
const selected=ref(world.value?.db.loadedMods.filter(id=>id!=='core')??[]),error=ref(''),message=ref('')
const available=computed(()=>{void packagesRevision.value;return packages.filter(pkg=>pkg.manifest.id!=='core')})
const unavailable=computed(()=>selected.value.filter(id=>!available.value.some(pkg=>pkg.manifest.id===id)))
const names=computed(()=>Object.fromEntries(available.value.map(pkg=>[pkg.manifest.id,pkg.manifest.name])))
watch(()=>selected.value.join('\n'),()=>{cancelLiveContentReview();message.value=''}, {flush:'sync'})
function review(){message.value='';error.value=reviewLiveContent(selected.value)??''}
async function apply(token:string){error.value=await applyLiveContent(token)??'';if(!error.value)message.value='현재 세계에 검토한 콘텐츠를 적용했습니다.'}
onBeforeUnmount(()=>cancelLiveContentReview())
</script>

<template>
  <details class="border-y border-ash-600 py-2 text-xs" data-testid="live-content-reload">
    <summary class="cursor-pointer font-title">{{ t('플레이 중 모드 검토·적용') }}</summary>
    <p class="my-2">{{ t('수정한 모드를 설치하고 현재 세계에 적용할 구성을 검토합니다. 현재 턴·몸·물품을 보존하며, 사라진 콘텐츠의 처리는 검토 화면에서 확인하세요.') }}</p>
    <ModImportControl :disabled="simulating||contentReloading" @changed="cancelLiveContentReview()" />
    <div class="my-2 max-h-48 space-y-1 overflow-y-auto"><label v-for="pkg in available" :key="pkg.manifest.id" class="flex items-center gap-2"><input v-model="selected" type="checkbox" :value="pkg.manifest.id" :data-testid="`live-mod-${pkg.manifest.id}`" :disabled="simulating||contentReloading" /><span>{{ pkg.manifest.name }} · {{ pkg.manifest.version }}</span></label></div>
    <label v-for="id in unavailable" :key="id" class="my-2 flex items-center gap-2 text-amber-200"><input v-model="selected" type="checkbox" :value="id" :data-testid="`live-missing-mod-${id}`" :disabled="simulating||contentReloading" /><span>{{ t('{0} · 설치되지 않음 · 선택을 해제하면 제거 구성을 검토합니다.',id) }}</span></label>
    <ModOrderControl v-model="selected" :names="names" :disabled="simulating||contentReloading" prefix="live" />
    <button class="dbtn" data-testid="live-content-review" :disabled="simulating||contentReloading" @click="review">{{ t('현재 세계로 변경 검토') }}</button>
    <ContentChangeReview :review="pendingLiveContentReview" :loading="contentReloading" @accept="apply" @cancel="cancelLiveContentReview();error=''" />
    <p v-if="error" class="my-2 whitespace-pre-wrap text-red-300" role="alert" data-testid="live-content-error">{{ t(error) }}</p>
    <p v-if="message" class="my-2 text-moss-300" role="status" data-testid="live-content-message">{{ t(message) }}</p>
  </details>
</template>
