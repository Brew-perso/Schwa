import { create } from 'zustand'
import { useEffect, useState } from 'react'
import type { Course, Target } from './types'
import { loadCourse, loadTarget } from './loader'

interface CourseStore { course: Course | null; error: string | null; load: () => Promise<void> }

export const useCourseStore = create<CourseStore>((set, get) => ({
  course: null,
  error: null,
  load: async () => {
    if (get().course) return
    try { set({ course: await loadCourse() }) } catch (e) { set({ error: String(e) }) }
  },
}))

export function useCourse() {
  const { course, load } = useCourseStore()
  useEffect(() => { void load() }, [load])
  return course
}

export function useTarget(id: string | undefined) {
  const [t, setT] = useState<Target | null>(null)
  useEffect(() => {
    let alive = true
    setT(null)
    if (id) loadTarget(id).then((x) => { if (alive) setT(x) }).catch(() => {})
    return () => { alive = false }
  }, [id])
  return t
}
