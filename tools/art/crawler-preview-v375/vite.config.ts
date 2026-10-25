import {defineConfig} from 'vite'
import {resolve} from 'node:path'
export default defineConfig({root:resolve('tools/art/crawler-preview-v375'),base:'./',publicDir:false,build:{outDir:resolve('public/artbook/crawler'),emptyOutDir:true}})
