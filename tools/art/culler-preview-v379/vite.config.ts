import {defineConfig} from 'vite'
import {resolve} from 'node:path'
export default defineConfig({root:resolve('tools/art/culler-preview-v379'),base:'./',publicDir:false,build:{outDir:resolve('public/artbook/culler'),emptyOutDir:true}})
