import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // host: true → también accesible desde celulares en la misma red WiFi
  server: { port: 5173, open: true, host: true },
})
