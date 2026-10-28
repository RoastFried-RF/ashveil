<script setup lang="ts">
import {t} from './locale'
import {computed,ref,watch} from 'vue'
import {modFromArchive,modFromFiles,type ModFile} from './mod-archive'
import {modInstallation,packagesRevision} from './mod-catalog'
import type {ModInstallReview} from './mod-installation'
const props=defineProps<{disabled?:boolean}>()
const emit=defineEmits<{changed:[]}>()
const review=ref<ModInstallReview|null>(null),error=ref(''),busy=ref(false),message=ref(''),removing=ref(''),messageName=ref('')
const installed=computed(()=>{void packagesRevision.value;return modInstallation.installed()})
watch(packagesRevision,()=>{review.value=null;removing.value='';emit('changed')})
function cancel(){modInstallation.cancel();review.value=null;removing.value=''}
async function select(event:Event,folder:boolean){
 const input=event.target as HTMLInputElement,files=[...(input.files??[])];if(!files.length)return
 busy.value=true;error.value='';message.value='';cancel()
 try{
  if(files.length>512)throw Error('모드 파일은 512개 이하여야 한다')
  if(files.reduce((sum,file)=>sum+file.size,0)>8*1024*1024)throw Error('모드 파일은 8MiB 이하여야 한다')
  let imported
  if(folder){const entries:ModFile[]=[];for(const file of files)entries.push({path:file.webkitRelativePath||file.name,bytes:new Uint8Array(await file.arrayBuffer())});imported=modFromFiles(entries)}
  else{if(files.length!==1)throw Error('배포 파일 하나를 선택해야 한다');imported=await modFromArchive(new Uint8Array(await files[0].arrayBuffer()))}
  review.value=await modInstallation.review(imported)
 }catch(e){error.value=(e as Error).message}finally{input.value='';busy.value=false}
}
async function install(){if(!review.value)return;busy.value=true;error.value='';try{const name=review.value.name;await modInstallation.install(review.value.token);review.value=null;messageName.value=name;message.value='{0} 설치 완료. 아래 목록에서 사용할 모드를 선택하세요.'}catch(e){error.value=(e as Error).message}finally{busy.value=false}}
async function remove(){busy.value=true;error.value='';try{await modInstallation.remove(removing.value);removing.value='';message.value='가져온 모드 파일을 제거했습니다. 기본 제공 모드는 원래 내용으로 돌아갑니다.'}catch(e){error.value=(e as Error).message}finally{busy.value=false}}
async function reload(){busy.value=true;error.value='';cancel();try{await modInstallation.reload();message.value='설치된 모드 목록을 다시 읽었습니다.'}catch(e){error.value=(e as Error).message}finally{busy.value=false}}
</script>

<template>
  <section class="df df-celtic space-y-3 text-xs" data-testid="mod-import">
    <h2 class="font-title text-base text-amber-100">{{ t("모드 가져오기") }}</h2>
    <p class="text-ash-300">{{ t("ZIP · tar.gz 배포 파일 또는 모드 폴더를 이 브라우저에 설치합니다. 설치 후 아래에서 사용할 모드를 선택하세요.") }}</p>
    <div class="flex flex-wrap gap-3">
      <label class="space-y-1"><span class="block">{{ t("배포 파일") }}</span><input data-testid="mod-import-archive" type="file" accept=".zip,.gz,.tgz" :disabled="props.disabled||busy" @change="select($event,false)" /></label>
      <label class="space-y-1"><span class="block">{{ t("모드 폴더") }}</span><input data-testid="mod-import-folder" type="file" webkitdirectory multiple :disabled="props.disabled||busy" @change="select($event,true)" /></label>
    </div>
    <p v-if="busy" role="status">{{ t("모드 파일을 확인하고 있습니다…") }}</p>
    <button class="dbtn" data-testid="mod-import-reload" :disabled="busy||props.disabled" @click="reload">{{ t("설치 목록 다시 읽기") }}</button>
    <p v-if="error" class="whitespace-pre-wrap break-all text-red-300" role="alert" data-testid="mod-import-error">{{ t(error) }}</p>
    <p v-if="message" class="text-moss-300" role="status" data-testid="mod-import-message">{{ t(message,messageName) }}</p>
    <section v-if="review" class="space-y-2 border border-amber-800 p-3" data-testid="mod-import-review">
      <p class="text-amber-100">{{ review.name }} · {{ review.id }} · {{ review.version }}</p>
      <p>{{ t("{0} · {1}파일 · {2}바이트",review.format,review.files,review.bytes) }}</p>
      <p v-if="review.textures" class="text-moss-300">{{ t("16×16 원본 PNG {0}개 포함",review.textures) }}</p>
      <p v-if="review.previousVersion" class="text-amber-200">{{ t("기존 {0} → {1} 교체",review.previousVersion,review.version) }}</p>
      <p v-if="review.scripts" class="text-amber-200">{{ t("스크립트 포함 · 격리 실행기 검사 완료") }}</p>
      <p>{{ t("검증한 필수 모드 순서: {0}",review.loadedMods.join(' → ')) }}</p>
      <p v-if="review.previousHash" class="break-all font-mono text-[10px]">{{ t("기존: {0}",review.previousHash) }}</p>
      <p class="break-all font-mono text-[10px]" data-testid="mod-import-hash">{{ t("설치: {0}",review.hash) }}</p>
      <p v-for="warning in review.warnings" :key="warning" class="text-amber-200">{{ t(warning) }}</p>
      <p>{{ t("설치하면 사용 가능한 모드 목록에 추가됩니다. 기존 각인에는 ‘각인 모드 구성 검토’에서 적용하세요.") }}</p>
      <div class="flex gap-2"><button class="dbtn-gold" data-testid="mod-import-install" :disabled="busy||props.disabled" @click="install">{{ t("이 모드 설치") }}</button><button class="dbtn" data-testid="mod-import-cancel" :disabled="busy" @click="cancel">{{ t("취소") }}</button></div>
    </section>
    <div v-for="row in installed" :key="row.id" class="flex items-center gap-2" :data-testid="`installed-mod-${row.id}`"><span>{{ row.id }} · {{ row.format }}</span><button class="dbtn" :disabled="busy||props.disabled" @click="cancel();removing=row.id">{{ t("설치 파일 제거") }}</button></div>
    <div v-if="removing" class="space-y-2 border border-amber-800 p-2" data-testid="mod-import-remove-review"><p>{{ t("{0}의 가져온 파일을 제거합니다. 이 모드를 사용한 각인은 다음 불러오기에서 구성을 검토해야 합니다.",removing) }}</p><button class="dbtn" data-testid="mod-import-remove" :disabled="busy||props.disabled" @click="remove">{{ t("제거") }}</button><button class="dbtn ml-2" :disabled="busy" @click="cancel">{{ t("취소") }}</button></div>
  </section>
</template>
