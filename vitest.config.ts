import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [process.env.npm_lifecycle_event === 'test:integration'
      ? 'tests/integration/**/*.test.ts'
      : 'tests/unit/**/*.test.ts']
  }
})
