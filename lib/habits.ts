import { supabase } from './supabase'
import { Habit, HabitWithStreak } from './types'

function toLocalDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function calcStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0

  const sorted = [...completedDates].sort().reverse()
  const today = toLocalDateString(new Date())
  const yesterday = toLocalDateString(new Date(Date.now() - 86400000))

  if (sorted[0] !== today && sorted[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00')
    const curr = new Date(sorted[i] + 'T00:00:00')
    const diff = (prev.getTime() - curr.getTime()) / 86400000
    if (diff === 1) streak++
    else break
  }
  return streak
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
    const habitCompletions = (completions ?? []).filter(
      (c: { habit_id: string; completed_date: string }) => c.habit_id === habit.id
    )
    const dates = habitCompletions.map((c: { completed_date: string }) => c.completed_date)
    return {
      ...habit,
      completedToday: dates.includes(today),
      currentStreak: calcStreak(dates),
    }
  })
}

export async function addHabit(name: string): Promise<Habit> {
  const { data, error } = await supabase
    .from('habits')
    .insert({ name })
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
