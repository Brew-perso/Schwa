import { inject } from '@vercel/analytics'
import { useSettings } from './settings'

let started = false

/**
 * Anonymous audience statistics (Vercel Web Analytics): page views only — no cookie, no durable identifier,
 * no custom event, nothing about recordings or answers. The route itself tells which target and step are used
 * (/target/b1-th/produce). Started only once settings are loaded, so an opted-out learner never sends a single view.
 */
export function startAnalytics() {
  if (started) return
  started = true
  inject({
    mode: import.meta.env.PROD ? 'production' : 'development',
    beforeSend: (event) => {
      if (useSettings.getState().s.consent.stats === false) return null
      const url = new URL(event.url)
      url.search = ''
      url.hash = ''
      return { ...event, url: url.toString() }
    },
  })
}
