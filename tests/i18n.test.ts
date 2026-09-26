import { describe, it, expect } from 'vitest'
import { reg } from '../src/i18n'

describe('reg', () => {
  it('resolves the register and applies French non-breaking spaces', () => {
    expect(reg('[Écoutez|Écoute] « heat » : bien ?', 'tu')).toBe('Écoute «\u00a0heat\u00a0»\u00a0: bien\u00a0?')
    expect(reg('[Écoutez|Écoute] le modèle.', 'vous')).toBe('Écoutez le modèle.')
  })
})
