export type Priority = "high" | "medium" | "low" | "none";

export interface Subtask {
  id: string;
  todo_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
}

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  due_date?: string | null;
  priority: Priority;
  notes?: string | null;
  list_id?: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  subtasks?: Subtask[];
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface TodoTag {
  todo_id: string;
  tag_id: string;
}

export interface List {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  theme_preference: "light" | "dark";
  created_at: string;
  updated_at: string;
}

export type ScheduleType = "interval" | "weekly";

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  schedule_type: ScheduleType;
  schedule_days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat (for weekly)
  schedule_interval: number; // every X days (for interval, 1=daily, 2=every other day, etc.)
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  completed_date: string; // YYYY-MM-DD
  created_at: string;
}

export interface HabitWithStatus extends Habit {
  completedToday: boolean;
  streak: number;
}

export interface GoogleTokens {
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scopes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarSyncRecord {
  id: string;
  todo_id: string;
  user_id: string;
  google_event_id: string;
  synced_at: string;
}
