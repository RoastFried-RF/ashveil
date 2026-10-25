import {defineConfig} from 'vite'
import {resolve} from 'node:path'
export default defineConfig({root:resolve('tools/art/swarm-preview-v370'),base:'./',publicDir:false,build:{outDir:resolve('public/artbook/swarm'),emptyOutDir:true}})
