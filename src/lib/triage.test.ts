/// <reference types="vitest" />

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('./llm', () => ({
  generateHindi: vi.fn(),
}))

import { generateHindi } from './llm'
import { processTriage } from './triage'

beforeEach(() => {
  (generateHindi as unknown as any).mockReset()
})

describe('processTriage', () => {
  it('asks for next missing field when only name is present', async () => {
    const currentMeta = { name: 'Asha' }
    ;(generateHindi as unknown as any).mockResolvedValue(JSON.stringify({ name: 'Asha' }))

    const res = await processTriage(currentMeta as any, '')
    expect(res.done).toBe(false)
    expect(res.meta.name).toBe('Asha')
    // first missing is birth_date
    expect(res.followUpQuestion).toBeDefined()
    expect(res.followUpQuestion?.includes('birth_date')).toBeTruthy()
  })

  it('completes when model returns all fields', async () => {
    const all = {
      name: 'Ravi',
      birth_date: '1990-05-01',
      birth_time: '08:30',
      place: 'Mumbai, India',
      question: 'What does my chart say?'
    }
    ;(generateHindi as unknown as any).mockResolvedValue(JSON.stringify(all))

    const res = await processTriage({}, 'Here are my details')
    expect(res.done).toBe(true)
    expect(res.meta).toMatchObject(all)
  })

  it('handles plain-text follow-up by asking for first missing field', async () => {
    const currentMeta = { name: 'Sita', birth_date: '1985-01-01' }
    ;(generateHindi as unknown as any).mockResolvedValue('Can you share your birth_time?')

    const res = await processTriage(currentMeta as any, 'Follow up')
    expect(res.done).toBe(false)
    // first missing in TRIAGE_FIELDS after name,birth_date is birth_time
    expect(res.followUpQuestion).toBeDefined()
    expect(res.followUpQuestion?.includes('birth_time')).toBeTruthy()
  })
})
