import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Task } from "@/lib/types";
import { getPriorityLabel, getPriorityColor, formatDate } from "@/lib/utils";
import { GripVertical, Clock, FolderKanban, Play } from "lucide-react";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { useProjectStore } from "@/stores/projectStore";
import { useEmployeeStore } from "@/stores/employeeStore";
import { useTaskStore } from "@/stores/taskStore";
import { startCodex, stopCodex } from "@/lib/codex";

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
}

export function TaskCard({ task, isOverlay }: TaskCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const projects = useProjectStore((s) => s.projects);
  const projectName = projects.find((p) => p.id === task.project_id)?.name;
  const projectRepoPath = projects.find((p) => p.id === task.project_id)?.repo_path;
  const codexProcesses = useEmployeeStore((s) => s.codexProcesses);
  const updateEmployeeStatus = useEmployeeStore((s) => s.updateEmployeeStatus);
  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);

  const isRunning = task.assignee_id
    ? codexProcesses[task.assignee_id]?.running ?? false
    : false;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", status: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.assignee_id) return;
    try {
      await updateEmployeeStatus(task.assignee_id, "busy");
      await updateTaskStatus(task.id, "in_progress");
      const desc = task.title + (task.description ? `\n${task.description}` : "");
      await startCodex(task.assignee_id, desc, projectRepoPath ?? undefined);
    } catch (err) {
      console.error("Failed to start codex:", err);
      await updateEmployeeStatus(task.assignee_id, "error");
    }
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.assignee_id) return;
    try {
      await stopCodex(task.assignee_id);
      await updateEmployeeStatus(task.assignee_id, "offline");
    } catch (err) {
      console.error("Failed to stop codex:", err);
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`bg-card rounded-md border border-border p-3 group ${
          isDragging
            ? "opacity-50 shadow-lg"
            : "hover:shadow-sm cursor-pointer"
        } transition-shadow`}
        onClick={() => !isDragging && setShowDetail(true)}
        {...attributes}
      >
        <div className="flex items-start gap-2">
          <button
            className="mt-0.5 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{task.title}</p>
            {task.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={`text-xs font-medium ${getPriorityColor(
                  task.priority
                )}`}
              >
                {getPriorityLabel(task.priority)}
              </span>
              {task.complexity && (
                <span className="text-xs text-muted-foreground">
                  复杂度: {task.complexity}/10
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
              <div className="flex flex-col gap-0.5">
                {projectName && (
                  <span className="flex items-center gap-0.5">
                    <FolderKanban className="h-3 w-3" />
                    {projectName}
                  </span>
                )}
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {formatDate(task.created_at)}
                </span>
              </div>
              {task.assignee_id && (
                <span className="inline-block w-3.5 h-3.5 rounded-full bg-primary/10 text-primary text-[8px] leading-[14px] text-center self-start">
                  {task.assignee_id[0]}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* Run/Stop Codex */}
        {!isOverlay && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
            {task.assignee_id ? (
              isRunning ? (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  停止
                </button>
              ) : (
                <button
                  onClick={handleRun}
                  className="flex items-center gap-1 px-2 py-0.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  <Play className="h-3 w-3" />
                  运行
                </button>
              )
            ) : (
              <span className="text-xs text-muted-foreground/50" title="请先指派员工">
                <Play className="h-3 w-3 inline mr-0.5" />
                未指派
              </span>
            )}
          </div>
        )}
      </div>
      {!isOverlay && (
        <TaskDetailDialog
          task={task}
          open={showDetail}
          onOpenChange={setShowDetail}
        />
      )}
    </>
  );
}
