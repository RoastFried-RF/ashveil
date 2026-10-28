<script setup lang="ts">
import { computed, ref } from 'vue'
import {t,defText} from './locale'
import { checkpointQuote, currentSaveMode } from '../core'
import { world, version, screen, simulating, checkpointBusy, saveCheckpoint, beginCheckpointLoad, checkpointError } from './store'
defineProps<{ended?:boolean}>()
const mode=computed(()=>{void version.value;return world.value?currentSaveMode(world.value):null})
const quote=computed(()=>{void version.value;return world.value?checkpointQuote(world.value):null})
const confirmSave=ref(false),message=ref('')
async function save(){confirmSave.value=false;message.value=await saveCheckpoint()??'저장 지점을 남겼다. 이 기록은 사망 후에도 남는다.'}
</script>
<template>
  <section v-if="screen==='game'&&mode" class="space-y-2 border-y border-ash-600 py-3 text-xs leading-5" data-testid="checkpoint-controls">
    <h3 class="font-title text-base text-amber-100">{{ t('저장 방식 · {0}',defText(mode)) }}</h3>
    <p>{{ defText(mode,'description') }}</p>
    <template v-if="mode.manual!=='none'">
      <p>{{ t('방식마다 저장 지점은 하나다. 처음에는 직접 저장해야 한다. 자동 기록은 현재 원정을 이어가며, 사망하면 사라진다. 업적은 기록하지 않는다.') }}</p>
      <p v-if="!ended&&quote?.error" class="text-ash-400" data-testid="checkpoint-unavailable">{{ t(quote.error) }}</p>
      <div class="flex flex-wrap gap-2">
        <button v-if="!ended" class="dbtn" data-testid="checkpoint-save" :disabled="!!quote?.error||simulating||checkpointBusy" @click="confirmSave=true;message=''">{{ t('저장 지점 남기기') }}</button>
        <button class="dbtn" data-testid="checkpoint-load" :disabled="simulating||checkpointBusy" @click="beginCheckpointLoad(mode.id)">{{ t('마지막 저장 지점 불러오기') }}</button>
      </div>
      <div v-if="confirmSave" class="space-y-2 border border-amber-800 p-2" data-testid="checkpoint-save-confirm">
        <p>{{ t('{0} 방식의 기존 저장 지점을 현재 원정으로 덮어쓴다.',defText(mode)) }}</p>
        <button class="dbtn-gold mr-2" data-testid="checkpoint-save-accept" :disabled="simulating||checkpointBusy||!!quote?.error" @click="save">{{ t('현재 원정 저장') }}</button><button class="dbtn" @click="confirmSave=false">{{ t('취소') }}</button>
      </div>
      <p v-if="message" role="status" data-testid="checkpoint-save-status">{{ t(message) }}</p>
      <p v-if="checkpointError" role="alert" class="text-red-300">{{ t(checkpointError) }}</p>
    </template>
  </section>
</template>
