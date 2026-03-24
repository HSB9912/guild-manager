import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { copyFileSync, writeFileSync } from 'fs'

// GitHub Pages SPA: copy index.html → 404.html + add .nojekyll
function githubPagesSpa(): Plugin {
  return {
    name: 'github-pages-spa',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist')
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
      writeFileSync(resolve(outDir, '.nojekyll'), '')
    },
  }
}

export default defineConfig({
  base: '/guild-manager/',
  plugins: [react(), tailwindcss(), githubPagesSpa()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
