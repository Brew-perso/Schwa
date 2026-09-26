import type { Course, Target } from './types'

let coursePromise: Promise<Course> | null = null
const targetCache = new Map<string, Promise<Target>>()

export function loadCourse(): Promise<Course> {
  if (!coursePromise) {
    coursePromise = fetch('/content/course.json').then((r) => {
      if (!r.ok) throw new Error('course.json ' + r.status)
      return r.json()
    })
  }
  return coursePromise
}

export function loadTarget(id: string): Promise<Target> {
  let p = targetCache.get(id)
  if (!p) {
    p = fetch(`/content/targets/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(id + ' ' + r.status)
      return r.json()
    })
    targetCache.set(id, p)
  }
  return p
}

export function audioUrl(key: string) {
  return `/audio/${key}.mp3`
}
