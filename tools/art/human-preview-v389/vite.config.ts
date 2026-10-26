import {defineConfig} from 'vite'
import {resolve} from 'node:path'
export default defineConfig({root:resolve('tools/art/human-preview-v389'),base:'./',publicDir:false,build:{outDir:resolve('public/artbook/human'),emptyOutDir:true}})
