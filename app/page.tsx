'use client'

import { useEffect, useState, useCallback } from 'react'
import { Frequency, HabitWithStreak } from '@/lib/types'
import { getHabitsWithStreaks, addHabit, deleteHabit, toggleCompletion, updateHabit } from '@/lib/habits'
import CalendarView from '@/app/components/CalendarView'

type Tab = 'today' | 'calendar'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ORDER_KEY = 'habit-order-v1'

const EMOJIS = [
  '💧','🏃','💪','🧘','📚','😴','🥗','💊','🚴','🎯',
  '🌟','🧠','🎨','💻','📝','🌿','🧹','🎵','☀️','🌙',
  '🍎','🥤','🚿','🏊','📖','✏️','🎸','🐕','🏋️','🎯',
]

function EmojiPicker({ value, onChange }: { value: string; onChange: (e: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center text-lg hover:border-indigo-400 transition-colors"
        aria-label="Pick emoji"
      >
        {value || <span className="text-gray-300 text-sm select-none">😊</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-11 left-0 z-20 bg-white rounded-xl border border-gray-200 shadow-lg p-2 grid grid-cols-6 gap-1 w-52">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="col-span-6 text-xs text-gray-400 hover:text-gray-600 py-0.5"
            >
              clear
            </button>
            {EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                onClick={() => { onChange(e); setOpen(false) }}
                className={`w-8 h-8 text-base rounded flex items-center justify-center transition-colors ${value === e ? 'bg-indigo-100' : 'hover:bg-gray-100'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

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

function loadOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveOrder(ids: string[]) {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids))
  } catch {}
}

function applyOrder(habits: HabitWithStreak[], order: string[]): HabitWithStreak[] {
  if (order.length === 0) return habits
  const map = new Map(habits.map(h => [h.id, h]))
  const ordered: HabitWithStreak[] = []
  for (const id of order) {
    const h = map.get(id)
    if (h) { ordered.push(h); map.delete(id) }
  }
  // Append any new habits not yet in the saved order (e.g. just added)
  for (const h of map.values()) ordered.push(h)
  return ordered
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  if (total === 0) return null
  const pct = Math.round((done / total) * 100)
  const allDone = done === total

  return (
    <div className="mb-6">
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm font-medium text-gray-700">Today</span>
        <span data-testid="progress-counter" className={`text-sm font-semibold ${allDone ? 'text-green-600' : 'text-gray-500'}`}>
          {done}/{total}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-green-500' : 'bg-indigo-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('today')
  const [habits, setHabits] = useState<HabitWithStreak[]>([])
  const [order, setOrder] = useState<string[]>([])
  const [newHabitName, setNewHabitName] = useState('')
  const [frequency, setFrequency] = useState<Frequency>({ type: 'daily' })
  const [emoji, setEmoji] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmoji, setEditEmoji] = useState('')
  const [editFrequency, setEditFrequency] = useState<Frequency>({ type: 'daily' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setOrder(loadOrder())
    load()
  }, [])

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
      await addHabit(name, frequency, emoji)
      setNewHabitName('')
      setFrequency({ type: 'daily' })
      setEmoji('')
      await load()
    } catch (e) {
      setError('Failed to add habit.')
      console.error(e)
    } finally {
      setAdding(false)
    }
  }

  function startEdit(habit: HabitWithStreak) {
    setEditingId(habit.id)
    setEditName(habit.name)
    setEditEmoji(habit.emoji ?? '')
    setEditFrequency(habit.frequency)
  }

  async function handleSave(habitId: string) {
    const name = editName.trim()
    if (!name) return
    setSaving(true)
    try {
      await updateHabit(habitId, name, editEmoji, editFrequency)
      setEditingId(null)
      await load()
    } catch (e) {
      setError('Failed to update habit.')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteHabit(id)
      const newOrder = order.filter(oid => oid !== id)
      setOrder(newOrder)
      saveOrder(newOrder)
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

  const moveHabit = useCallback((id: string, dir: -1 | 1) => {
    setHabits(prev => {
      const sorted = applyOrder(prev, order.length ? order : prev.map(h => h.id))
      const idx = sorted.findIndex(h => h.id === id)
      const target = idx + dir
      if (target < 0 || target >= sorted.length) return prev
      const next = [...sorted]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      const newOrder = next.map(h => h.id)
      setOrder(newOrder)
      saveOrder(newOrder)
      return prev // habits state unchanged; order drives display
    })
  }, [order])

  const orderedHabits = applyOrder(habits, order.length ? order : habits.map(h => h.id))
  const scheduledToday = orderedHabits.filter(h => h.isScheduledToday)
  const completedToday = scheduledToday.filter(h => h.completedToday)
  const allDone = scheduledToday.length > 0 && completedToday.length === scheduledToday.length

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg lg:max-w-6xl mx-auto px-4 pt-6 pb-10 sm:pt-12 sm:pb-16">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Habit Tracker</h1>
          <p className="mt-1 text-gray-500">{today}</p>
        </div>

        {/* Tab navigation — hidden on lg (both panels always visible there) */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 mb-6 lg:hidden">
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

        {/* Two-column layout on lg+; single column with tabs below */}
        <div className="lg:flex lg:gap-8 lg:items-start">

        {/* ── TODAY PANEL ────────────────────────────────────────────── */}
        <div data-testid="today-panel" className={`lg:flex-1 lg:min-w-0 ${tab === 'calendar' ? 'hidden lg:block' : ''}`}>

        <h2 className="hidden lg:block text-lg font-semibold text-gray-700 mb-4">Today</h2>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && scheduledToday.length > 0 && (
          <ProgressBar done={completedToday.length} total={scheduledToday.length} />
        )}

        <form onSubmit={handleAdd} className="mb-8 rounded-xl bg-white border border-gray-200 px-4 py-4 shadow-sm">
          <div className="flex gap-2">
            <EmojiPicker value={emoji} onChange={setEmoji} />
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
          <>
            {allDone && (
              <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-4 text-center">
                <p className="text-2xl mb-1">🎉</p>
                <p className="text-sm font-semibold text-green-800">All done for today!</p>
                <p className="text-xs text-green-600 mt-0.5">Great work. See you tomorrow.</p>
              </div>
            )}
            <ul className="space-y-3">
              {orderedHabits.map((habit, idx) => (
                <li key={habit.id} className="rounded-xl bg-white border border-gray-200 px-4 py-4 shadow-sm">
                  {editingId === habit.id ? (
                    // ── Inline edit form ──────────────────────────────────────
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <EmojiPicker value={editEmoji} onChange={setEditEmoji} />
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          autoFocus
                          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          aria-label="Edit habit name"
                        />
                      </div>
                      <FrequencyPicker value={editFrequency} onChange={setEditFrequency} />
                      <div className="flex gap-2 justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSave(habit.id)}
                          disabled={saving || !editName.trim()}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // ── Normal display ────────────────────────────────────────
                    <div className="flex items-center gap-3">
                      {/* Reorder buttons */}
                      <div className="flex flex-col flex-shrink-0 -my-1">
                        <button
                          type="button"
                          onClick={() => moveHabit(habit.id, -1)}
                          disabled={idx === 0}
                          className="p-1.5 text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                          aria-label="Move up"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveHabit(habit.id, 1)}
                          disabled={idx === orderedHabits.length - 1}
                          className="p-1.5 text-gray-300 hover:text-gray-500 disabled:opacity-20 transition-colors"
                          aria-label="Move down"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      <button
                        onClick={() => handleToggle(habit)}
                        className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                          habit.completedToday
                            ? 'bg-indigo-600 border-indigo-600'
                            : habit.isScheduledToday
                              ? 'border-gray-300 hover:border-indigo-400'
                              : 'border-gray-200 hover:border-gray-300'
                        }`}
                        aria-label={habit.completedToday ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {habit.completedToday && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {habit.emoji && <span className="text-base leading-none">{habit.emoji}</span>}
                          <span className={`text-sm font-medium ${habit.completedToday ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {habit.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-400">{frequencyLabel(habit.frequency)}</span>
                          {habit.completionRate30d > 0 && (
                            <span className="text-xs text-gray-400">
                              · {Math.round(habit.completionRate30d * 100)}% last 30d
                            </span>
                          )}
                          {/* Streak shown inline on small screens */}
                          {habit.currentStreak > 0 && (
                            <span className="text-xs text-orange-500 font-medium sm:hidden">
                              🔥 {habit.currentStreak}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        {habit.frequency.type === 'times_per_week' && (
                          <span className="text-xs text-indigo-500 font-medium">
                            {habit.weeklyCompleted}/{habit.frequency.times}w
                          </span>
                        )}
                        {/* Streak shown on right only on sm+ screens */}
                        <div className="hidden sm:flex flex-col items-end">
                          {habit.currentStreak > 0 && (
                            <span data-testid="streak" className="text-sm text-orange-500 font-medium">🔥 {habit.currentStreak}</span>
                          )}
                          {habit.longestStreak > habit.currentStreak && habit.longestStreak > 0 && (
                            <span className="text-xs text-gray-400">best {habit.longestStreak}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => startEdit(habit)}
                          className="p-2 -m-1 text-gray-300 hover:text-indigo-400 transition-colors"
                          aria-label="Edit habit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(habit.id)}
                          className="p-2 -m-1 text-gray-300 hover:text-red-400 transition-colors"
                          aria-label="Delete habit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        </div>{/* end today panel */}

        {/* ── CALENDAR PANEL ─────────────────────────────────────────── */}
        <div data-testid="calendar-panel" className={`lg:w-[520px] lg:flex-shrink-0 ${tab === 'today' ? 'hidden lg:block' : ''}`}>
          {/* Section heading visible only on lg+ */}
          <h2 className="hidden lg:block text-lg font-semibold text-gray-700 mb-4">Calendar</h2>
          <CalendarView habits={habits} />
        </div>

        </div>{/* end two-column wrapper */}
      </div>
    </main>
  )
}
