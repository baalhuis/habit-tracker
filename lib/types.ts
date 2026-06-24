export type Frequency =
  | { type: 'daily' }
  | { type: 'specific_days'; days: number[] } // 0=Sun, 1=Mon, ..., 6=Sat
  | { type: 'times_per_week'; times: number }

export type Habit = {
  id: string
  name: string
  emoji: string
  frequency: Frequency
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
  isScheduledToday: boolean
  currentStreak: number
  longestStreak: number
  weeklyCompleted: number
}
