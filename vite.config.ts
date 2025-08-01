import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
// This simple configuration allows Vite to automatically find and use
// your postcss.config.cjs and tailwind.config.js files, which is the correct setup.
export default defineConfig({
  plugins: [react()],
})
