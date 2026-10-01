import { defineConfig } from 'vitest/config'

/**
 * One Vitest run covers every workspace package.
 * Projects resolve their own tests/<dir>; none of them need a DOM or network,
 * so CI stays hermetic (tracker lists are NOT required to run tests —
 * list-dependent code is tested against committed fixtures).
 */
export default defineConfig({
  test: {
    projects: ['packages/shared', 'lists', 'scanner', 'web', 'worker']
  }
})
