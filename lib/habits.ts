import { supabase } from './supabase'
import { Frequency, Habit, HabitWithStreak } from './types'

export function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d
}

function calcDailyStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const sorted = [...dates].sort().reverse()
  const today = toLocalDateString(new Date())
  const yesterday = toLocalDateString(new Date(Date.now() - 86400000))
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0
  let streak = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00')
    const curr = new Date(sorted[i] + 'T00:00:00')
    if ((prev.getTime() - curr.getTime()) / 86400000 === 1) streak++
    else break
  }
  return streak
}

function calcSpecificDaysStreak(dates: string[], scheduledDays: number[]): number {
  if (dates.length === 0 || scheduledDays.length === 0) return 0
  const dateSet = new Set(dates)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Walk back from today finding scheduled days and checking completions
  let streak = 0
  let d = new Date(today)
  let checkedScheduledDays = 0

  // Walk back up to 365 days
  for (let i = 0; i < 365; i++) {
    if (scheduledDays.includes(d.getDay())) {
      checkedScheduledDays++
      // For the first scheduled day found, only count if it was today (otherwise we skip today if not yet done)
      if (checkedScheduledDays === 1 && toLocalDateString(d) === toLocalDateString(new Date()) && !dateSet.has(toLocalDateString(d))) {
        // Today is scheduled but not yet done — skip it, don't break streak
        d.setDate(d.getDate() - 1)
        continue
      }
      if (dateSet.has(toLocalDateString(d))) {
        streak++
      } else {
        break
      }
    }
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function calcTimesPerWeekStreak(dates: string[], times: number): number {
  if (dates.length === 0) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = 0
  let weekStart = getMonday(today)
  const maxWeeks = 52

  for (let i = 0; i < maxWeeks; i++) {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const count = dates.filter(d => {
      const date = new Date(d + 'T00:00:00')
      return date >= weekStart && date < weekEnd
    }).length

    if (count >= times) {
      streak++
    } else if (i === 0) {
      // Current week not complete yet — don't break, check last week
    } else {
      break
    }

    weekStart = new Date(weekStart)
    weekStart.setDate(weekStart.getDate() - 7)
  }

  return streak
}

function getWeeklyCompleted(dates: string[]): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekStart = getMonday(today)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)
  return dates.filter(d => {
    const date = new Date(d + 'T00:00:00')
    return date >= weekStart && date < weekEnd
  }).length
}

function calcStreak(dates: string[], frequency: Frequency): number {
  switch (frequency.type) {
    case 'daily': return calcDailyStreak(dates)
    case 'specific_days': return calcSpecificDaysStreak(dates, frequency.days)
    case 'times_per_week': return calcTimesPerWeekStreak(dates, frequency.times)
  }
}

function calcDailyLongest(dates: string[]): number {
  if (dates.length === 0) return 0
  const sorted = [...dates].sort()
  let longest = 1, current = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = (new Date(sorted[i] + 'T00:00:00').getTime() - new Date(sorted[i - 1] + 'T00:00:00').getTime()) / 86400000
    if (diff === 1) { current++; if (current > longest) longest = current }
    else current = 1
  }
  return longest
}

function calcSpecificDaysLongest(dates: string[], scheduledDays: number[]): number {
  if (dates.length === 0 || scheduledDays.length === 0) return 0
  const dateSet = new Set(dates)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayStr = toLocalDateString(today)
  const start = new Date([...dates].sort()[0] + 'T00:00:00')
  let longest = 0, current = 0
  const d = new Date(start)
  while (d <= today) {
    if (scheduledDays.includes(d.getDay())) {
      const ds = toLocalDateString(d)
      if (dateSet.has(ds)) { current++; if (current > longest) longest = current }
      else if (ds !== todayStr) current = 0
    }
    d.setDate(d.getDate() + 1)
  }
  return longest
}

function calcTimesPerWeekLongest(dates: string[], times: number): number {
  if (dates.length === 0) return 0
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const thisWeek = getMonday(today)
  const start = getMonday(new Date([...dates].sort()[0] + 'T00:00:00'))
  let longest = 0, current = 0
  let weekStart = new Date(start)
  while (weekStart <= thisWeek) {
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7)
    const count = dates.filter(d => { const dt = new Date(d + 'T00:00:00'); return dt >= weekStart && dt < weekEnd }).length
    if (count >= times) { current++; if (current > longest) longest = current }
    else if (weekStart.getTime() !== thisWeek.getTime()) current = 0
    weekStart = new Date(weekStart); weekStart.setDate(weekStart.getDate() + 7)
  }
  return longest
}

function calcLongestStreak(dates: string[], frequency: Frequency): number {
  switch (frequency.type) {
    case 'daily': return calcDailyLongest(dates)
    case 'specific_days': return calcSpecificDaysLongest(dates, frequency.days)
    case 'times_per_week': return calcTimesPerWeekLongest(dates, frequency.times)
  }
}

function isScheduledToday(frequency: Frequency): boolean {
  const todayDay = new Date().getDay()
  switch (frequency.type) {
    case 'daily': return true
    case 'specific_days': return frequency.days.includes(todayDay)
    case 'times_per_week': return true
  }
}

export async function getHabitsWithStreaks(): Promise<HabitWithStreak[]> {
  const { data: habits, error: habitsError } = await supabase
    .from('habits')
    .select('*')
    .order('created_at', { ascending: true })

  if (habitsError) throw habitsError
  if (!habits || habits.length === 0) return []

  const { data: completions, error: completionsError } = await supabase
    .from('completions')
    .select('*')
    .in('habit_id', habits.map((h: Habit) => h.id))

  if (completionsError) throw completionsError

  const today = toLocalDateString(new Date())

  return habits.map((habit: Habit) => {
    const habitDates = (completions ?? [])
      .filter((c: { habit_id: string }) => c.habit_id === habit.id)
      .map((c: { completed_date: string }) => c.completed_date)

    const frequency: Frequency = (habit.frequency as Frequency) ?? { type: 'daily' }

    return {
      ...habit,
      frequency,
      completedToday: habitDates.includes(today),
      isScheduledToday: isScheduledToday(frequency),
      currentStreak: calcStreak(habitDates, frequency),
      longestStreak: calcLongestStreak(habitDates, frequency),
      weeklyCompleted: getWeeklyCompleted(habitDates),
    }
  })
}

export async function addHabit(name: string, frequency: Frequency = { type: 'daily' }, emoji = ''): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .insert({ name, frequency, emoji })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateHabit(id: string, name: string, emoji: string, frequency: Frequency): Promise<void> {
  const { error } = await supabase.from('habits').update({ name, emoji, frequency }).eq('id', id)
  if (error) throw error
}

export async function deleteHabit(id: string): Promise<void> {
  const { error } = await supabase.from('habits').delete().eq('id', id)
  if (error) throw error
}

export async function toggleCompletion(habitId: string, completedOnDate: boolean, date?: string): Promise<void> {
  const targetDate = date ?? toLocalDateString(new Date())
  if (completedOnDate) {
    const { error } = await supabase
      .from('completions')
      .delete()
      .eq('habit_id', habitId)
      .eq('completed_date', targetDate)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('completions')
      .insert({ habit_id: habitId, completed_date: targetDate })
    if (error) throw error
  }
}

export async function getCompletionsForRange(
  habitIds: string[],
  from: string,
  to: string
): Promise<Record<string, Set<string>>> {
  if (habitIds.length === 0) return {}
  const { data, error } = await supabase
    .from('completions')
    .select('habit_id, completed_date')
    .in('habit_id', habitIds)
    .gte('completed_date', from)
    .lte('completed_date', to)
  if (error) throw error
  const result: Record<string, Set<string>> = {}
  for (const row of (data ?? [])) {
    if (!result[row.habit_id]) result[row.habit_id] = new Set()
    result[row.habit_id].add(row.completed_date)
  }
  return result
}
