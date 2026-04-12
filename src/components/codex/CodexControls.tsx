import { useState } from "react";
import { startCodex, stopCodex, restartCodex } from "@/lib/codex";
import { useEmployeeStore } from "@/stores/employeeStore";
import { Play, Square, RotateCw, Loader2 } from "lucide-react";

interface CodexControlsProps {
  employeeId: string;
  employeeStatus: string;
}

export function CodexControls({ employeeId, employeeStatus }: CodexControlsProps) {
  const updateEmployeeStatus = useEmployeeStore((s) => s.updateEmployeeStatus);
  const [taskDescription, setTaskDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const isRunning = employeeStatus === "online" || employeeStatus === "busy";

  const handleStart = async () => {
    if (!taskDescription.trim()) {
      setShowInput(true);
      return;
    }
    setLoading(true);
    try {
      await updateEmployeeStatus(employeeId, "online");
      await startCodex(employeeId, taskDescription.trim());
      setTaskDescription("");
      setShowInput(false);
    } catch (e) {
      console.error("Failed to start codex:", e);
      await updateEmployeeStatus(employeeId, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await stopCodex(employeeId);
    } catch (e) {
      console.error("Failed to stop codex:", e);
    }
    await updateEmployeeStatus(employeeId, "offline");
    setLoading(false);
  };

  const handleRestart = async () => {
    if (!taskDescription.trim()) {
      setShowInput(true);
      return;
    }
    setLoading(true);
    try {
      await restartCodex(employeeId, taskDescription.trim());
      setTaskDescription("");
      setShowInput(false);
    } catch (e) {
      console.error("Failed to restart codex:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      {showInput && !isRunning && (
        <div className="flex gap-1">
          <input
            type="text"
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
            placeholder="输入任务描述..."
            className="flex-1 px-2 py-1 text-xs border border-input rounded bg-background"
            autoFocus
          />
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            启动
          </button>
        ) : (
          <>
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
              停止
            </button>
            <button
              onClick={handleRestart}
              disabled={loading}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 transition-colors"
            >
              <RotateCw className="h-3 w-3" />
              重启
            </button>
          </>
        )}

        {isRunning && (
          <input
            type="text"
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRestart()}
            placeholder="新任务描述（重启用）"
            className="flex-1 px-2 py-1 text-xs border border-input rounded bg-background ml-1"
          />
        )}
      </div>
    </div>
  );
}
