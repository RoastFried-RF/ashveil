<script setup lang="ts">
import {t, keyLabel} from '../locale'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { COMMANDS, bindingError, bindingText, commandLabel, keyChord, leftHandBindings, rightHandBindings, type Command } from '../keybindings'
import { bindingCapture as capture, preferences as p } from '../preferences'
const error=ref('')
function begin(command:Command){capture.value=command;error.value=''}
function onKey(e:KeyboardEvent){
  if(!capture.value)return
  e.preventDefault();e.stopImmediatePropagation()
  if(e.key==='Escape'){capture.value=null;error.value='';return}
  if(['Shift','Control','Alt','Meta'].includes(e.key)||e.repeat)return
  if(e.metaKey){error.value='운영체제 키 대신 다른 키를 눌러야 한다';return}
  const chord=keyChord(e),why=bindingError(p.keyBindings,capture.value,chord)
  if(why){error.value=why;return}
  p.keyBindings={...p.keyBindings,[capture.value]:[chord]};capture.value=null;error.value=''
}
function preset(side:'left'|'right'|'default'){capture.value=null;error.value='';p.keyBindings=side==='left'?leftHandBindings():side==='right'?rightHandBindings():{}}
onMounted(()=>window.addEventListener('keydown',onKey,true))
onBeforeUnmount(()=>{capture.value=null;window.removeEventListener('keydown',onKey,true)})
</script>
<template>
  <details class="border-y border-ash-600 py-2" data-testid="keybinding-settings">
    <summary class="cursor-pointer font-title">{{ t("키 배정·한 손 조작") }}</summary>
    <p class="my-2 text-xs text-ash-400">{{ t("‘변경’을 누르고 새 키를 누른다. Ctrl·Alt·Shift 조합을 쓸 수 있다. Esc는 배정 취소, F3는 설정, 조준 중 Tab·Enter는 대상 선택·확정이다.") }}</p>
    <div class="my-2 flex gap-2"><button class="dbtn" data-testid="key-preset-left" @click="preset('left')">{{ t("왼손 배치") }}</button><button class="dbtn" data-testid="key-preset-right" @click="preset('right')">{{ t("오른손 배치") }}</button><button class="dbtn" data-testid="key-preset-default" @click="preset('default')">{{ t("기본 키 복원") }}</button></div>
    <p class="my-2 text-xs text-ash-400">{{ t("왼손 배치: QWE/ASD/ZXC로8방향·가운데 대기, R줍기·F수색·T휴식·G수면. 창은 기능키에 배정한다. 방향에 Ctrl을 더하면 제자리 회전, Shift를 더하면 밀치기다.") }}</p>
    <p class="my-2 text-xs text-ash-400">{{ t("오른손 배치: IOP/KL;/,./로8방향·L대기, U줍기·J수색·H휴식·N수면. 계단은 Enter, 창은 기능키다. 설정에서 어느 키든 다시 바꿀 수 있다.") }}</p>
    <p v-if="capture" class="my-2 text-amber-200" data-testid="key-capture">{{ t('{0}에 쓸 키를 누른다 (Esc 취소).', t(commandLabel(capture))) }}</p>
    <p v-if="error" class="my-2 text-red-300" role="status" data-testid="key-error">{{ error }}</p>
    <div class="max-h-[35vh] space-y-1 overflow-y-auto" data-testid="keybinding-list">
      <div v-for="[id,label] in COMMANDS" :key="id" class="flex items-center gap-1 border-b border-ash-700 py-1 text-xs">
        <span class="w-28 shrink-0">{{ t(label) }}</span><span class="flex-1" :data-testid="`key-label-${id}`">{{ keyLabel(bindingText(p.keyBindings,id)) }}</span>
        <button class="dbtn" :data-testid="`key-change-${id}`" :aria-label="t('{0} 키 변경', t(label))" @click="begin(id)">{{ t("변경") }}</button>
        <button class="dbtn" :aria-label="t('{0} 키 해제', t(label))" @click="capture=null;error='';p.keyBindings={...p.keyBindings,[id]:[]}">{{ t("해제") }}</button>
      </div>
    </div>
  </details>
</template>
