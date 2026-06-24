export type Habit = {
  id: string
  name: string
  created_at: string
}

export type Completion = {
  id: string
  habit_id: string
  completed_date: string
  created_at: string
}

export type HabitWithStreak = Habit & {
  completedToday: boolean
  currentStreak: number
}
