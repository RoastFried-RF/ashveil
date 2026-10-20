<script setup lang="ts">
import {computed,ref} from 'vue'
import {reviewSeedShare} from '../core/seed-share'
import {packages,packagesRevision} from './mod-catalog'
const props=defineProps<{disabled?:boolean;createCode:()=>string}>()
const emit=defineEmits<{apply:[code:string]}>()
const output=ref(''),input=ref(''),error=ref(''),copied=ref(false),reviewed=ref('')
const review=computed(()=>{void packagesRevision.value;if(!reviewed.value)return null;try{return reviewSeedShare(reviewed.value,packages)}catch{return null}})
function create(){error.value='';copied.value=false;try{output.value=props.createCode()}catch(e){error.value=(e as Error).message}}
function inspect(){error.value='';reviewed.value='';try{reviewSeedShare(input.value,packages);reviewed.value=input.value}catch(e){error.value=(e as Error).message}}
async function copy(){error.value='';try{await navigator.clipboard.writeText(output.value);copied.value=true}catch{error.value='클립보드를 사용할 수 없습니다. 아래 공유 문자열을 직접 복사하세요.'}}
function apply(){if(!review.value?.canApply)return;emit('apply',reviewed.value);reviewed.value=''}
</script>

<template>
  <details class="df df-celtic space-y-2 text-xs" data-testid="seed-share">
    <summary class="cursor-pointer font-title text-base text-amber-100">시드 공유</summary>
    <p>같은 생성 선택·모드 버전과 원문을 사용하는 새 세계를 공유합니다. 현재 진행을 전달하려면 각인이 필요합니다.</p>
    <button class="dbtn" data-testid="seed-share-create" :disabled="props.disabled" @click="create">현재 생성 선택의 공유 문자열 만들기</button>
    <template v-if="output">
      <label class="block space-y-1"><span>공유 문자열 · 해당 시드의 은퇴 인물이 있으면 이름과 이야기 기록을 함께 포함합니다.</span><textarea v-model="output" readonly rows="3" class="w-full break-all rounded border border-ash-600 bg-ash-800 p-2 font-mono text-[10px]" data-testid="seed-share-output" /></label>
      <button class="dbtn" data-testid="seed-share-copy" :disabled="props.disabled" @click="copy">{{ copied?'복사했습니다':'공유 문자열 복사' }}</button>
    </template>
    <label class="block space-y-1"><span>전달받은 공유 문자열</span><textarea v-model="input" rows="3" class="w-full rounded border border-ash-600 bg-ash-800 p-2 font-mono text-[10px]" data-testid="seed-share-input" :disabled="props.disabled" @input="reviewed=''" /></label>
    <button class="dbtn" data-testid="seed-share-review" :disabled="props.disabled||!input.trim()" @click="inspect">공유 구성 검토</button>
    <p v-if="error" role="alert" class="break-all text-red-300" data-testid="seed-share-error">{{ error }}</p>
    <section v-if="review" class="space-y-2 border border-amber-800 p-3" data-testid="seed-share-review-result">
      <p>시드: {{ review.shared.seed }} · 배경: {{ review.shared.background??'시드가 정함' }} · 재굴림: {{ review.shared.characterRoll }}회 · 사건 흐름: {{ review.shared.storyteller??'기존 고정 장소 규칙' }}</p>
      <p>게임 {{ review.shared.gameVersion }} · 은퇴 인물 기록 {{ review.shared.legacyResidents.length }}명</p>
      <p v-for="mod in review.shared.mods" :key="mod.id" class="break-all">{{ mod.id }} · {{ mod.version }}<span class="block font-mono text-[10px]">{{ mod.hash }}</span></p>
      <p class="break-all font-mono text-[10px]">{{ review.shared.loadHash }}</p>
      <p v-for="message in review.errors" :key="message" class="text-red-300">{{ message }}</p>
      <p v-for="message in review.warnings" :key="message" class="text-amber-200">{{ message }}</p>
      <p v-if="review.canApply">현재 설치된 내용과 같습니다. 선택을 적용한 뒤 ‘고원으로 들어선다’를 누르면 새 세계를 시작합니다.</p>
      <div class="flex gap-2"><button class="dbtn-gold" data-testid="seed-share-apply" :disabled="props.disabled||!review.canApply" @click="apply">생성 선택에 적용</button><button class="dbtn" :disabled="props.disabled" @click="reviewed=''">닫기</button></div>
    </section>
  </details>
</template>
