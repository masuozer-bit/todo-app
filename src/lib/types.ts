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
