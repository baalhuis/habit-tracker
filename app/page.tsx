'use client'

import { useEffect, useState } from 'react'
import { Frequency, HabitWithStreak } from '@/lib/types'
import { getHabitsWithStreaks, addHabit, deleteHabit, toggleCompletion } from '@/lib/habits'
import CalendarView from '@/app/components/CalendarView'

type Tab = 'today' | 'calendar'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function frequencyLabel(f: Frequency): string {
  switch (f.type) {
    case 'daily': return 'Daily'
    case 'specific_days':
      if (f.days.length === 0) return 'No days set'
      if (f.days.length === 7) return 'Daily'
      return f.days.map(d => DAY_FULL[d]).join(', ')
    case 'times_per_week':
      return `${f.times}× per week`
  }
}

function FrequencyPicker({ value, onChange }: { value: Frequency; onChange: (f: Frequency) => void }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        {(['daily', 'specific_days', 'times_per_week'] as const).map(type => (
          <button
            key={type}
            type="button"
            onClick={() => {
              if (type === 'daily') onChange({ type: 'daily' })
              else if (type === 'specific_days') onChange({ type: 'specific_days', days: [1, 2, 3, 4, 5] })
              else onChange({ type: 'times_per_week', times: 3 })
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              value.type === type
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {type === 'daily' ? 'Daily' : type === 'specific_days' ? 'Specific days' : 'X per week'}
          </button>
        ))}
      </div>

      {value.type === 'specific_days' && (
        <div className="flex gap-1.5 justify-center">
          {DAY_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                const days = value.days.includes(i)
                  ? value.days.filter(d => d !== i)
                  : [...value.days, i].sort()
                onChange({ type: 'specific_days', days })
              }}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                value.days.includes(i)
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {value.type === 'times_per_week' && (
        <div className="flex gap-1.5 justify-center">
          {[1, 2, 3, 4, 5, 6, 7].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ type: 'times_per_week', times: n })}
              className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
                value.times === n
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('today')
  const [habits, setHabits] = useState<HabitWithStreak[]>([])
  const [newHabitName, setNewHabitName] = useState('')
  const [frequency, setFrequency] = useState<Frequency>({ type: 'daily' })
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    try {
      setError(null)
      setHabits(await getHabitsWithStreaks())
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
    if (frequency.type === 'specific_days' && frequency.days.length === 0) {
      setError('Please select at least one day.')
      return
    }
    setAdding(true)
    try {
      await addHabit(name, frequency)
      setNewHabitName('')
      setFrequency({ type: 'daily' })
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
    setHabits(prev => prev.map(h =>
      h.id === habit.id
        ? { ...h, completedToday: !h.completedToday, currentStreak: !h.completedToday ? h.currentStreak + 1 : Math.max(0, h.currentStreak - 1) }
        : h
    ))
    try {
      await toggleCompletion(habit.id, habit.completedToday)
      await load()
    } catch (e) {
      setError('Failed to update habit.')
      await load()
      console.error(e)
    }
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Habit Tracker</h1>
          <p className="mt-1 text-gray-500">{today}</p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 mb-6">
          {(['today', 'calendar'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'today' ? 'Today' : 'Calendar'}
            </button>
          ))}
        </div>

        {tab === 'calendar' ? (
          <CalendarView habits={habits} />
        ) : (<>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleAdd} className="mb-8 rounded-xl bg-white border border-gray-200 px-4 py-4 shadow-sm">
          <div className="flex gap-2">
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
          </div>
          <FrequencyPicker value={frequency} onChange={setFrequency} />
        </form>

        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading…</div>
        ) : habits.length === 0 ? (
          <div className="text-center text-gray-400 py-12">No habits yet. Add one above to get started.</div>
        ) : (
          <ul className="space-y-3">
            {habits.map(habit => (
              <li key={habit.id} className="rounded-xl bg-white border border-gray-200 px-4 py-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleToggle(habit)}
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      habit.completedToday
                        ? 'bg-indigo-600 border-indigo-600'
                        : habit.isScheduledToday
                          ? 'border-gray-300 hover:border-indigo-400'
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                    aria-label={habit.completedToday ? 'Mark incomplete' : 'Mark complete'}
                  >
                    {habit.completedToday && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${habit.completedToday ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {habit.name}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">{frequencyLabel(habit.frequency)}</span>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {habit.frequency.type === 'times_per_week' && (
                      <span className="text-xs text-indigo-500 font-medium">
                        {habit.weeklyCompleted}/{habit.frequency.times}w
                      </span>
                    )}
                    {habit.currentStreak > 0 && (
                      <span className="text-sm text-orange-500 font-medium">🔥 {habit.currentStreak}</span>
                    )}
                    <button
                      onClick={() => handleDelete(habit.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors"
                      aria-label="Delete habit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && habits.length > 0 && (
          <p className="mt-6 text-center text-sm text-gray-400">
            {habits.filter(h => h.completedToday).length} / {habits.length} completed today
          </p>
        )}
        </>)}
      </div>
    </main>
  )
}
