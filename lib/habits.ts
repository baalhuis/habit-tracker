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
      weeklyCompleted: getWeeklyCompleted(habitDates),
    }
  })
}

export async function addHabit(name: string, frequency: Frequency = { type: 'daily' }): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .insert({ name, frequency })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteHabit(id: string): Promise<void> {
  const { error } = await supabase.from('habits').delete().eq('id', id)
  if (error) throw error
}

export async function toggleCompletion(habitId: string, completedToday: boolean): Promise<void> {
  const today = toLocalDateString(new Date())
  if (completedToday) {
    const { error } = await supabase
      .from('completions')
      .delete()
      .eq('habit_id', habitId)
      .eq('completed_date', today)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('completions')
      .insert({ habit_id: habitId, completed_date: today })
    if (error) throw error
  }
}
