/// <reference types="vitest/config" />
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
  test: {
    // The extraction Lambda lives at the repository root, next to `infra/`,
    // because it is deployed rather than bundled into the page. It shares the
    // wire contract in `src/extract/` with the browser, so it is tested by the
    // same run: `cd app && npm test` is the one command, as it is everywhere
    // else in this repository.
    include: ['src/**/*.test.{ts,tsx}', '../lambda/**/*.test.ts'],
  },
})
