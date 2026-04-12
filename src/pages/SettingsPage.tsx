import { useState, useEffect } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

type ThemeMode = "light" | "dark" | "system";

function getThemePreference(): ThemeMode {
  const stored = localStorage.getItem("theme-mode");
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function applyTheme(mode: ThemeMode) {
  let isDark: boolean;
  if (mode === "system") {
    isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } else {
    isDark = mode === "dark";
  }
  document.documentElement.classList.toggle("dark", isDark);
  localStorage.setItem("theme", isDark ? "dark" : "light");
}

export function SettingsPage() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getThemePreference);

  useEffect(() => {
    applyTheme(themeMode);
    localStorage.setItem("theme-mode", themeMode);
  }, [themeMode]);

  const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "亮色", icon: Sun },
    { value: "dark", label: "暗色", icon: Moon },
    { value: "system", label: "跟随系统", icon: Monitor },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-lg font-semibold">系统设置</h2>

      <div className="bg-card rounded-lg border border-border p-4 space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-1">主题模式</h3>
          <p className="text-xs text-muted-foreground mb-3">选择应用的显示主题</p>
          <div className="flex gap-2">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setThemeMode(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  themeMode === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input hover:bg-accent"
                }`}
              >
                <opt.icon className="h-4 w-4" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium">Codex CLI</h3>
              <p className="text-xs text-muted-foreground">
                AI员工后端引擎，需要系统已安装 codex 命令
              </p>
            </div>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
              未连接
            </span>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <div>
            <h3 className="text-sm font-medium">数据存储</h3>
            <p className="text-xs text-muted-foreground">
              所有数据存储在本地 SQLite 数据库中，无需网络连接
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-medium mb-2">键盘快捷键</h3>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>跳转到看板</span>
              <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">⌘N</kbd>
            </div>
            <div className="flex justify-between">
              <span>跳转到员工</span>
              <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">⌘E</kbd>
            </div>
            <div className="flex justify-between">
              <span>跳转到仪表盘</span>
              <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">⌘D</kbd>
            </div>
            <div className="flex justify-between">
              <span>跳转到项目</span>
              <kbd className="px-1.5 py-0.5 bg-secondary rounded text-[10px]">⌘P</kbd>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium mb-2">关于</h3>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>AI员工协作系统 v0.1.0</p>
          <p>基于 Tauri 2.0 + React 19 + SQLite</p>
          <p>技术栈：TypeScript, TailwindCSS, shadcn/ui, Zustand, @dnd-kit</p>
        </div>
      </div>
    </div>
  );
}
