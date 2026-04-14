import { create } from "zustand";
import { select } from "@/lib/database";

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  tasksByStatus: Record<string, number>;
  totalEmployees: number;
  onlineEmployees: number;
  completionRate: number;
}

interface Activity {
  id: string;
  employee_id: string | null;
  action: string;
  details: string | null;
  task_id: string | null;
  project_id: string | null;
  created_at: string;
  employee_name?: string;
}

interface DashboardStore {
  stats: DashboardStats | null;
  recentActivities: Activity[];
  loading: boolean;
  fetchStats: (projectId?: string) => Promise<void>;
  fetchRecentActivities: (limit?: number, projectId?: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  stats: null,
  recentActivities: [],
  loading: false,

  fetchStats: async (projectId) => {
    set({ loading: true });
    try {
      const selectedProject = projectId
        ? await select<{ id: string; status: string }>("SELECT id, status FROM projects WHERE id = $1 LIMIT 1", [projectId])
        : [];
      const activeProjects = projectId
        ? [{ count: selectedProject[0]?.status === "active" ? 1 : 0 }]
        : await select<{ count: number }>("SELECT COUNT(*) as count FROM projects WHERE status = 'active'");
      const allProjects = projectId
        ? [{ count: selectedProject.length }]
        : await select<{ count: number }>("SELECT COUNT(*) as count FROM projects");
      const tasks = projectId
        ? await select<{ status: string; count: number }>(
            "SELECT status, COUNT(*) as count FROM tasks WHERE project_id = $1 GROUP BY status",
            [projectId]
          )
        : await select<{ status: string; count: number }>("SELECT status, COUNT(*) as count FROM tasks GROUP BY status");
      const employees = projectId
        ? await select<{ count: number }>("SELECT COUNT(*) as count FROM employees WHERE project_id = $1", [projectId])
        : await select<{ count: number }>("SELECT COUNT(*) as count FROM employees");
      const onlineEmployees = projectId
        ? await select<{ count: number }>(
            "SELECT COUNT(*) as count FROM employees WHERE project_id = $1 AND status IN ('online', 'busy')",
            [projectId]
          )
        : await select<{ count: number }>("SELECT COUNT(*) as count FROM employees WHERE status IN ('online', 'busy')");

      const tasksByStatus: Record<string, number> = {};
      let total = 0;
      let completed = 0;
      for (const row of tasks) {
        tasksByStatus[row.status] = row.count;
        total += row.count;
        if (row.status === "completed") completed += row.count;
      }

      set({
        stats: {
          totalProjects: allProjects[0]?.count ?? 0,
          activeProjects: activeProjects[0]?.count ?? 0,
          totalTasks: total,
          tasksByStatus,
          totalEmployees: employees[0]?.count ?? 0,
          onlineEmployees: onlineEmployees[0]?.count ?? 0,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        },
        loading: false,
      });
    } catch (e) {
      console.error("Failed to fetch dashboard stats:", e);
      set({ loading: false });
    }
  },

  fetchRecentActivities: async (limit = 20, projectId) => {
    try {
      const activities = projectId
        ? await select<Activity>(
            `SELECT a.*, e.name as employee_name
             FROM activity_logs a
             LEFT JOIN employees e ON a.employee_id = e.id
             WHERE a.project_id = $2
             ORDER BY a.created_at DESC LIMIT $1`,
            [limit, projectId]
          )
        : await select<Activity>(
            `SELECT a.*, e.name as employee_name
             FROM activity_logs a
             LEFT JOIN employees e ON a.employee_id = e.id
             ORDER BY a.created_at DESC LIMIT $1`,
            [limit]
          );
      set({ recentActivities: activities });
    } catch (e) {
      console.error("Failed to fetch activities:", e);
    }
  },
}));
