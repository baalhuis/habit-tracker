'use client'

import { useEffect, useState } from 'react'
import { HabitWithStreak } from '@/lib/types'
import { getHabitsWithStreaks, addHabit, deleteHabit, toggleCompletion } from '@/lib/habits'

export default function Home() {
  const [habits, setHabits] = useState<HabitWithStreak[]>([])
  const [newHabitName, setNewHabitName] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      setError(null)
      const data = await getHabitsWithStreaks()
      setHabits(data)
    } catch (e) {
      setError('Failed to load habits. Check your Supabase configuration.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newHabitName.trim()
    if (!name) return
    setAdding(true)
    try {
      await addHabit(name)
      setNewHabitName('')
      await load()
    } catch (e) {
      setError('Failed to add habit.')
      console.error(e)
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteHabit(id)
      setHabits(prev => prev.filter(h => h.id !== id))
    } catch (e) {
      setError('Failed to delete habit.')
      console.error(e)
    }
  }

  async function handleToggle(habit: HabitWithStreak) {
    setHabits(prev =>
      prev.map(h =>
        h.id === habit.id
          ? {
              ...h,
              completedToday: !h.completedToday,
              currentStreak: !h.completedToday
                ? h.currentStreak + 1
                : Math.max(0, h.currentStreak - 1),
            }
          : h
      )
    )
    try {
      await toggleCompletion(habit.id, habit.completedToday)
      await load()
    } catch (e) {
      setError('Failed to update habit.')
      await load()
      console.error(e)
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Habit Tracker</h1>
          <p className="mt-1 text-gray-500">{today}</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleAdd} className="mb-8 flex gap-2">
          <input
            type="text"
            value={newHabitName}
            onChange={e => setNewHabitName(e.target.value)}
            placeholder="Add a new habit…"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={adding}
          />
          <button
            type="submit"
            disabled={adding || !newHabitName.trim()}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading…</div>
        ) : habits.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No habits yet. Add one above to get started.
          </div>
        ) : (
          <ul className="space-y-3">
            {habits.map(habit => (
              <li
                key={habit.id}
                className="flex items-center gap-4 rounded-xl bg-white border border-gray-200 px-4 py-4 shadow-sm"
              >
                <button
                  onClick={() => handleToggle(habit)}
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    habit.completedToday
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'border-gray-300 hover:border-indigo-400'
                  }`}
                  aria-label={habit.completedToday ? 'Mark incomplete' : 'Mark complete'}
                >
                  {habit.completedToday && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <span
                  className={`flex-1 text-sm font-medium ${
                    habit.completedToday ? 'text-gray-400 line-through' : 'text-gray-900'
                  }`}
                >
                  {habit.name}
                </span>

                {habit.currentStreak > 0 && (
                  <span className="flex items-center gap-1 text-sm text-orange-500 font-medium">
                    🔥 {habit.currentStreak}
                  </span>
                )}

                <button
                  onClick={() => handleDelete(habit.id)}
                  className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                  aria-label="Delete habit"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        {!loading && habits.length > 0 && (
          <p className="mt-6 text-center text-sm text-gray-400">
            {habits.filter(h => h.completedToday).length} / {habits.length} completed today
          </p>
        )}
      </div>
    </main>
  )
}
