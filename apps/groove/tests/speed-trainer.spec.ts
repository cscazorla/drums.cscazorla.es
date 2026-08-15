import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSpeedTrainerStore } from '@/stores/speedTrainer'

describe('speed trainer', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('does nothing while disabled', () => {
    const s = useSpeedTrainerStore()
    expect(s.tempoAfterLoops(4, 90)).toBeNull()
  })

  it('raises the tempo only on the Nth loop', () => {
    const s = useSpeedTrainerStore()
    s.setEnabled(true)
    s.setEveryLoops(2)
    s.setStepBpm(5)
    s.setTargetBpm(140)

    expect(s.tempoAfterLoops(1, 90)).toBeNull()
    expect(s.tempoAfterLoops(2, 90)).toBe(95)
    expect(s.tempoAfterLoops(3, 95)).toBeNull()
    expect(s.tempoAfterLoops(4, 95)).toBe(100)
  })

  it('stops at the target and never overshoots it', () => {
    const s = useSpeedTrainerStore()
    s.setEnabled(true)
    s.setEveryLoops(1)
    s.setStepBpm(20)
    s.setTargetBpm(100)

    expect(s.tempoAfterLoops(1, 90)).toBe(100) // clamped, not 110
    expect(s.tempoAfterLoops(2, 100)).toBeNull() // already there
    expect(s.tempoAfterLoops(3, 130)).toBeNull() // above target, leave it alone
  })

  it('ignores loop zero, so pressing play does not immediately jump', () => {
    const s = useSpeedTrainerStore()
    s.setEnabled(true)
    s.setEveryLoops(1)
    expect(s.tempoAfterLoops(0, 90)).toBeNull()
  })

  it('clamps nonsense input instead of trusting it', () => {
    const s = useSpeedTrainerStore()
    s.setEveryLoops(0)
    s.setStepBpm(999)
    s.setTargetBpm(5)
    expect(s.everyLoops).toBe(1)
    expect(s.stepBpm).toBe(40)
    expect(s.targetBpm).toBe(40)
  })
})
