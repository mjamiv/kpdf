/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/kpdf/',
  plugins: [react()],
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.claude/worktrees/**',
      '**/e2e/**',
    ],
  },
})
