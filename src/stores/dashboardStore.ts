import { create } from "zustand";
import { select } from "@/lib/database";
import type { ActivityLog } from "@/lib/types";

interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  tasksByStatus: Record<string, number>;
  totalEmployees: number;
  onlineEmployees: number;
  completionRate: number;
}

interface ActivityPageResult {
  items: ActivityLog[];
  total: number;
}

interface DashboardStore {
  stats: DashboardStats | null;
  recentActivities: ActivityLog[];
  loading: boolean;
  fetchStats: (projectId?: string) => Promise<void>;
  fetchRecentActivities: (limit?: number, projectId?: string) => Promise<void>;
  fetchActivitiesPage: (page?: number, pageSize?: number, projectId?: string) => Promise<ActivityPageResult>;
}

const ACTIVITY_SELECT = `SELECT a.*, e.name as employee_name
  FROM activity_logs a
  LEFT JOIN employees e ON a.employee_id = e.id`;
const ACTIVITY_ORDER = " ORDER BY a.created_at DESC, a.id DESC";

async function selectActivities(limit: number, offset = 0, projectId?: string): Promise<ActivityLog[]> {
  if (projectId) {
    return select<ActivityLog>(
      `${ACTIVITY_SELECT}
       WHERE a.project_id = $3${ACTIVITY_ORDER}
       LIMIT $1 OFFSET $2`,
      [limit, offset, projectId],
    );
  }

  return select<ActivityLog>(
    `${ACTIVITY_SELECT}${ACTIVITY_ORDER}
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
}

async function selectActivityTotal(projectId?: string): Promise<number> {
  const rows = projectId
    ? await select<{ count: number }>(
        "SELECT COUNT(*) as count FROM activity_logs WHERE project_id = $1",
        [projectId],
      )
    : await select<{ count: number }>("SELECT COUNT(*) as count FROM activity_logs");

  return rows[0]?.count ?? 0;
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
      const activities = await selectActivities(limit, 0, projectId);
      set({ recentActivities: activities });
    } catch (e) {
      console.error("Failed to fetch activities:", e);
      set({ recentActivities: [] });
    }
  },

  fetchActivitiesPage: async (page = 1, pageSize = 20, projectId) => {
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, pageSize);
    const offset = (safePage - 1) * safePageSize;
    const [items, total] = await Promise.all([
      selectActivities(safePageSize, offset, projectId),
      selectActivityTotal(projectId),
    ]);

    return { items, total };
  },
}));
