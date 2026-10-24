import {defineConfig} from 'vite'
import {resolve} from 'node:path'
export default defineConfig({root:resolve('tools/art/sower-pixi-v360'),base:'./',publicDir:false,build:{outDir:'/workspace/.ashveil-planned/v360-sower-pixi/site',emptyOutDir:true}})
