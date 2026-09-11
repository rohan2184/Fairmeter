import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Stated rather than left to the default, because it is a deployment contract, not a
  // preference: the build emits absolute URLs (/assets/…, /favicon.svg), and the status
  // pages link to "/". The site must therefore be served from the root of its domain.
  // Hosting it under a sub-path — an S3 prefix, a /app/ route — 404s every asset until
  // this value matches that prefix. See infra/README.md (D-15).
  base: '/',
  plugins: [react()],
})
