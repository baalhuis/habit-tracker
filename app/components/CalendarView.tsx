'use client'

import { useState, useEffect } from 'react'
import { Frequency, HabitWithStreak } from '@/lib/types'
import { getCompletionsForRange, toggleCompletion, toLocalDateString } from '@/lib/habits'

type CalendarMode = 'week' | 'month'

const DAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAY_3    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── Date helpers ────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isToday(date: Date): boolean {
  return toLocalDateString(date) === toLocalDateString(new Date())
}

function isPast(date: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date < today
}

function isScheduledOn(date: Date, frequency: Frequency): boolean {
  switch (frequency.type) {
    case 'daily': return true
    case 'specific_days': return frequency.days.includes(date.getDay())
    case 'times_per_week': return true
  }
}

// Returns weeks (rows) of dates for the month grid, Mon-first, null = padding day
function getMonthWeeks(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const startPad = first.getDay() === 0 ? 6 : first.getDay() - 1
  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = Array(startPad).fill(null)
  for (let d = 1; d <= last.getDate(); d++) {
    week.push(new Date(year, month, d))
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

// ── Cell ─────────────────────────────────────────────────────────────────────

function Cell({ date, habit, completions, onToggle, size = 'md' }: {
  date: Date
  habit: HabitWithStreak
  completions: Set<string>
  onToggle: (habitId: string, date: string, wasCompleted: boolean) => void
  size?: 'sm' | 'md'
}) {
  const dateStr  = toLocalDateString(date)
  const done     = completions.has(dateStr)
  const scheduled = isScheduledOn(date, habit.frequency)
  const today    = isToday(date)
  const future   = !isToday(date) && !isPast(date)

  const dim = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7'

  return (
    <button
      onClick={() => !future && onToggle(habit.id, dateStr, done)}
      disabled={future}
      aria-label={`${done ? 'Unmark' : 'Mark'} ${habit.name} on ${dateStr}`}
      className={[
        dim,
        'rounded-full flex items-center justify-center transition-colors mx-auto',
        future       ? 'cursor-default opacity-20' :
        done         ? 'bg-indigo-600 hover:bg-indigo-700' :
        !scheduled   ? 'opacity-15 cursor-default' :
        today        ? 'border-2 border-indigo-400 hover:bg-indigo-50' :
                       'border border-gray-300 hover:border-indigo-400 hover:bg-gray-50',
      ].join(' ')}
    >
      {done && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}

// ── Weekly view ───────────────────────────────────────────────────────────────

function WeeklyView({ habits, weekStart, completions, onToggle }: {
  habits: HabitWithStreak[]
  weekStart: Date
  completions: Record<string, Set<string>>
  onToggle: (habitId: string, date: string, wasCompleted: boolean) => void
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px]">
        <thead>
          <tr>
            <th className="text-left py-2 pr-2 font-medium text-sm text-gray-500 w-28 sm:w-40">Habit</th>
            {days.map(day => (
              <th key={day.toISOString()} className="text-center py-2 px-1 w-10">
                <div className={`text-xs font-medium ${isToday(day) ? 'text-indigo-600' : 'text-gray-500'}`}>
                  {DAY_3[day.getDay()]}
                </div>
                <div className={`text-sm font-semibold ${isToday(day) ? 'text-indigo-600' : 'text-gray-900'}`}>
                  {day.getDate()}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {habits.map(habit => (
            <tr key={habit.id} className="hover:bg-gray-50">
              <td className="py-3 pr-2 text-sm text-gray-700 font-medium truncate max-w-[110px] sm:max-w-[160px]">
                {habit.name}
              </td>
              {days.map(day => (
                <td key={day.toISOString()} className={`text-center py-2 px-1 ${isToday(day) ? 'bg-indigo-50/50' : ''}`}>
                  <Cell
                    date={day}
                    habit={habit}
                    completions={completions[habit.id] ?? new Set()}
                    onToggle={onToggle}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Monthly mini calendar for one habit ──────────────────────────────────────

function HabitMonthCalendar({ habit, year, month, completions, onToggle }: {
  habit: HabitWithStreak
  year: number
  month: number
  completions: Set<string>
  onToggle: (habitId: string, date: string, wasCompleted: boolean) => void
}) {
  const weeks = getMonthWeeks(year, month)

  return (
    <div className="rounded-xl bg-white border border-gray-200 px-4 py-4 shadow-sm">
      <div className="mb-3">
        <span className="text-sm font-medium text-gray-900">{habit.name}</span>
        <span className="ml-2 text-xs text-gray-400">
          {habit.frequency.type === 'daily' ? 'Daily' :
           habit.frequency.type === 'times_per_week' ? `${habit.frequency.times}× per week` :
           habit.frequency.days.map(d => DAY_3[d]).join(', ')}
        </span>
      </div>
      <table className="w-full">
        <thead>
          <tr>
            {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
              <th key={d} className="text-center text-xs text-gray-400 font-medium pb-1 w-8">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((day, di) => (
                <td key={di} className="text-center py-0.5">
                  <div className="text-[10px] text-gray-300 text-center mb-0.5">
                    {day ? day.getDate() : ''}
                  </div>
                  <div className="relative w-6 h-6 mx-auto">
                    {day && isToday(day) && (
                      <span className="absolute inset-0 rounded-full ring-2 ring-offset-1 ring-indigo-400 pointer-events-none" />
                    )}
                    {day ? (
                      <Cell
                        date={day}
                        habit={habit}
                        completions={completions}
                        onToggle={onToggle}
                        size="sm"
                      />
                    ) : <div className="w-6 h-6" />}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main CalendarView ─────────────────────────────────────────────────────────

export default function CalendarView({ habits }: { habits: HabitWithStreak[] }) {
  const [mode, setMode]           = useState<CalendarMode>('week')
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [monthDate, setMonthDate] = useState(() => new Date())
  const [completions, setCompletions] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    if (habits.length === 0) return
    let from: string, to: string
    if (mode === 'week') {
      from = toLocalDateString(weekStart)
      to   = toLocalDateString(addDays(weekStart, 6))
    } else {
      const y = monthDate.getFullYear(), m = monthDate.getMonth()
      from = toLocalDateString(new Date(y, m, 1))
      to   = toLocalDateString(new Date(y, m + 1, 0))
    }
    setLoading(true)
    getCompletionsForRange(habits.map(h => h.id), from, to)
      .then(setCompletions)
      .finally(() => setLoading(false))
  }, [mode, weekStart, monthDate, habits])

  async function handleToggle(habitId: string, dateStr: string, wasCompleted: boolean) {
    setCompletions(prev => {
      const updated = new Set(prev[habitId] ?? [])
      wasCompleted ? updated.delete(dateStr) : updated.add(dateStr)
      return { ...prev, [habitId]: updated }
    })
    try {
      await toggleCompletion(habitId, wasCompleted, dateStr)
    } catch {
      // Revert optimistic update
      setCompletions(prev => {
        const updated = new Set(prev[habitId] ?? [])
        wasCompleted ? updated.add(dateStr) : updated.delete(dateStr)
        return { ...prev, [habitId]: updated }
      })
    }
  }

  function navigate(dir: -1 | 1) {
    if (mode === 'week') {
      setWeekStart(d => addDays(d, dir * 7))
    } else {
      setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + dir, 1))
    }
  }

  const weekEnd = addDays(weekStart, 6)
  const label = mode === 'week'
    ? `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
    : `${MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}`

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(['week', 'month'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
                mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="Previous"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700 w-44 text-center">{label}</span>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
            aria-label="Next"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {habits.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Add some habits to see them here.</div>
      ) : loading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : mode === 'week' ? (
        <div className="rounded-xl bg-white border border-gray-200 px-4 py-4 shadow-sm">
          <WeeklyView
            habits={habits}
            weekStart={weekStart}
            completions={completions}
            onToggle={handleToggle}
          />
          <p className="mt-2 text-center text-xs text-gray-300 sm:hidden">← scroll →</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {habits.map(habit => (
            <HabitMonthCalendar
              key={habit.id}
              habit={habit}
              year={monthDate.getFullYear()}
              month={monthDate.getMonth()}
              completions={completions[habit.id] ?? new Set()}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
