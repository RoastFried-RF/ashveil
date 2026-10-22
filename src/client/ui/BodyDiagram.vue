<script setup lang="ts">
// Original ink anatomy, drawn as six separate observable regions.
import {useId} from 'vue'
import {REGION_LABEL,STATE_LABEL,type Region} from '../../core'
import {hideTip} from '../ui'
const props=defineProps<{states:Partial<Record<Region,number>>;mini?:boolean}>()
const emit=defineEmits<{region:[event:MouseEvent,region:Region]}>()
const id=useId().replace(/[^a-zA-Z0-9_-]/g,'')
const tone=['#a99b80','#c1a363','#c67f53','#b85f49','#704135']
const state=(region:Region)=>props.states[region]??0
const parts:{region:Region;shape:string;detail:string}[]=[
 {region:'rleg',shape:'M23 58 31 59 30 76 28 86 28 102 25 106H17V103L21 100 20 85 21 74Z',detail:'M25 65 24 78 25 85M22 87 24 97M21 102H26'},
 {region:'lleg',shape:'M33 59 41 58 43 74 44 85 43 100 47 103V106H39L36 102 36 86 34 76Z',detail:'M39 65 40 78 39 85M42 87 40 97M38 102H43'},
 {region:'rarm',shape:'M20 30 23 36 20 49 17 58 16 71 12 74 10 70 11 58 14 49 15 36Z',detail:'M18 36 17 47 15 52M14 59 13 68M12 70V72'},
 {region:'larm',shape:'M44 30 49 36 50 49 53 58 54 70 52 74 48 71 47 58 44 49 41 36Z',detail:'M46 36 47 47 49 52M50 59 51 68M52 70V72'},
 {region:'torso',shape:'M27 26 31 28H33L37 26 45 31 42 43 39 51 41 60 36 64H28L23 60 25 51 22 43 19 31Z',detail:'M25 32 30 34 32 31 34 34 39 32M25 38 30 40M34 40 39 38M26 44 30 46M34 46 38 44M32 37V51M27 53 32 57 37 53M27 59 31 61M33 61 37 59'},
 {region:'head',shape:'M27 8 31 6H34L38 9 39 15 37 22 35 25V28L32 30 29 28V25L26 22 25 15Z',detail:'M28 11 32 9 36 11M28 15H30M34 15H36M32 15 31 19H33M29 22 32 23 35 22'},
]
const patterns=['','dots','diagonal','grid','cross']
</script>

<template>
  <svg viewBox="0 0 64 112" fill="none" class="body-diagram" :class="{'is-mini':mini}" :aria-hidden="mini?true:undefined" :role="mini?undefined:'img'" :aria-label="mini?undefined:'여섯 부위의 신체 상태'">
    <defs>
      <pattern :id="id+'-dots'" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="#19191b" /></pattern>
      <pattern :id="id+'-diagonal'" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M-1 1 1-1M0 5 5 0M4 6 6 4" stroke="#19191b" stroke-width=".8" /></pattern>
      <pattern :id="id+'-grid'" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 4V0H4" stroke="#19191b" stroke-width=".8" /></pattern>
      <pattern :id="id+'-cross'" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 0 5 5M5 0 0 5" stroke="#dfbf97" stroke-width=".8" /></pattern>
    </defs>
    <path d="M32 2V110M6 30H58M6 62H58M6 3H13M51 3H58M6 109H13M51 109H58" stroke="#927a53" stroke-width=".5" opacity=".3" />
    <path d="M6 39H9M6 46H8M6 53H9M6 70H9M6 77H8M6 84H9M55 39H58M56 46H58M55 53H58M55 70H58M56 77H58M55 84H58" stroke="#a08b67" stroke-width=".5" opacity=".5" />
    <g v-for="part in parts" :key="part.region" class="body-region" :data-body-region="part.region" :data-state="state(part.region)" @mouseenter="emit('region',$event,part.region)" @mouseleave="hideTip">
      <title>{{ REGION_LABEL[part.region] }}: {{ STATE_LABEL[state(part.region)] }}</title>
      <path :d="part.shape" :fill="tone[state(part.region)]" stroke="#d0bea0" stroke-width=".65" stroke-linejoin="round" />
      <path :d="part.detail" stroke="#302a23" stroke-width=".75" stroke-linejoin="round" opacity=".8" pointer-events="none" />
      <path v-if="state(part.region)>0" :d="part.shape" :fill="`url(#${id}-${patterns[state(part.region)]})`" opacity=".75" pointer-events="none" />
    </g>
  </svg>
</template>

<style scoped>
.body-diagram { display: block; width: 100%; height: 100%; }
.body-region { cursor: help; }
.body-region:hover > path { stroke: #fff0c9; }
.body-diagram.is-mini .body-region > path { stroke-width: 1; }
</style>
