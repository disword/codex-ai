import { useLocation } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useProjectStore } from "@/stores/projectStore";

const pageTitles: Record<string, string> = {
  "/": "仪表盘",
  "/projects": "项目管理",
  "/kanban": "任务看板",
  "/employees": "员工管理",
  "/settings": "系统设置",
};

function getThemePreference(): boolean {
  const stored = localStorage.getItem("theme");
  if (stored) return stored === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function Header() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "AI员工协作系统";
  const { projects, currentProject, setCurrentProject, fetchProjects } = useProjectStore();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    const isDark = getThemePreference();
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-background">
      <h1 className="text-lg font-semibold">{title}</h1>

      <div className="flex items-center gap-4">
        {projects.length > 0 && (
          <select
            value={currentProject?.id ?? ""}
            onChange={(e) => {
              const p = projects.find((proj) => proj.id === e.target.value);
              setCurrentProject(p ?? null);
            }}
            className="text-sm border border-input rounded-md px-2 py-1 bg-background"
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={toggleTheme}
          className="p-2 rounded-md hover:bg-accent transition-colors"
          title={dark ? "切换亮色模式" : "切换暗色模式"}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}
