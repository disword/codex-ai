import { create } from "zustand";
import { select, execute } from "@/lib/database";
import type { Task, Subtask, Comment, TaskStatus } from "@/lib/types";
import { logActivity } from "@/lib/utils";

interface TaskStore {
  tasks: Task[];
  subtasks: Record<string, Subtask[]>;
  comments: Record<string, Comment[]>;
  loading: boolean;
  fetchTasks: (projectId?: string) => Promise<void>;
  fetchSubtasks: (taskId: string) => Promise<void>;
  fetchComments: (taskId: string) => Promise<void>;
  createTask: (data: { title: string; description?: string; priority?: string; project_id: string; assignee_id?: string }) => Promise<void>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  updateTask: (id: string, updates: Partial<Pick<Task, "title" | "description" | "priority" | "status" | "assignee_id" | "complexity" | "ai_suggestion">>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addSubtask: (taskId: string, title: string) => Promise<void>;
  toggleSubtask: (subtaskId: string, status: string) => Promise<void>;
  deleteSubtask: (subtaskId: string) => Promise<void>;
  addComment: (taskId: string, content: string, employeeId?: string, isAiGenerated?: boolean) => Promise<void>;
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  subtasks: {},
  comments: {},
  loading: false,

  fetchTasks: async (projectId) => {
    set({ loading: true });
    try {
      const tasks = projectId
        ? await select<Task>("SELECT * FROM tasks WHERE project_id = $1 ORDER BY updated_at DESC", [projectId])
        : await select<Task>("SELECT * FROM tasks ORDER BY updated_at DESC");
      set({ tasks, loading: false });
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
      set({ loading: false });
    }
  },

  fetchSubtasks: async (taskId) => {
    const subtasks = await select<Subtask>("SELECT * FROM subtasks WHERE task_id = $1 ORDER BY sort_order", [taskId]);
    set((state) => ({ subtasks: { ...state.subtasks, [taskId]: subtasks } }));
  },

  fetchComments: async (taskId) => {
    const comments = await select<Comment>("SELECT * FROM comments WHERE task_id = $1 ORDER BY created_at", [taskId]);
    set((state) => ({ comments: { ...state.comments, [taskId]: comments } }));
  },

  createTask: async (data) => {
    const id = crypto.randomUUID();
    await execute(
      "INSERT INTO tasks (id, title, description, priority, project_id, assignee_id) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, data.title, data.description ?? null, data.priority ?? "medium", data.project_id, data.assignee_id ?? null]
    );
    await logActivity("task_created", data.title, undefined, id, data.project_id);
    await get().fetchTasks(data.project_id);
  },

  updateTaskStatus: async (id, status) => {
    const task = get().tasks.find((t) => t.id === id);
    await execute("UPDATE tasks SET status = $1 WHERE id = $2", [status, id]);
    await logActivity("task_status_changed", `${task?.title} -> ${status}`, undefined, id, task?.project_id);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
  },

  updateTask: async (id, updates) => {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${idx}`);
      values.push(value);
      idx++;
    }
    values.push(id);
    await execute(`UPDATE tasks SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    await get().fetchTasks();
  },

  deleteTask: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    await execute("DELETE FROM tasks WHERE id = $1", [id]);
    await logActivity("task_deleted", task?.title ?? id, undefined, id, task?.project_id);
    await get().fetchTasks();
  },

  addSubtask: async (taskId, title) => {
    const id = crypto.randomUUID();
    await execute(
      "INSERT INTO subtasks (id, task_id, title, sort_order) VALUES ($1, $2, $3, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM subtasks WHERE task_id = $4))",
      [id, taskId, title, taskId]
    );
    await get().fetchSubtasks(taskId);
  },

  toggleSubtask: async (subtaskId, status) => {
    await execute("UPDATE subtasks SET status = $1 WHERE id = $2", [status, subtaskId]);
    const entries = Object.entries(get().subtasks);
    for (const [taskId, subs] of entries) {
      if (subs.some((s) => s.id === subtaskId)) {
        await get().fetchSubtasks(taskId);
        break;
      }
    }
  },

  deleteSubtask: async (subtaskId) => {
    const entries = Object.entries(get().subtasks);
    let taskId = "";
    for (const [tid, subs] of entries) {
      if (subs.some((s) => s.id === subtaskId)) {
        taskId = tid;
        break;
      }
    }
    await execute("DELETE FROM subtasks WHERE id = $1", [subtaskId]);
    if (taskId) await get().fetchSubtasks(taskId);
  },

  addComment: async (taskId, content, employeeId, isAiGenerated = false) => {
    const id = crypto.randomUUID();
    await execute(
      "INSERT INTO comments (id, task_id, employee_id, content, is_ai_generated) VALUES ($1, $2, $3, $4, $5)",
      [id, taskId, employeeId ?? null, content, isAiGenerated ? 1 : 0]
    );
    await get().fetchComments(taskId);
  },

  moveTask: (taskId, newStatus) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    }));
  },
}));
