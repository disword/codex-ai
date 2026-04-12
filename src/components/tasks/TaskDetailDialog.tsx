import { useState, useEffect, useRef } from "react";
import type { Task, TaskStatus } from "@/lib/types";
import { TASK_STATUSES, PRIORITIES } from "@/lib/types";
import { useTaskStore } from "@/stores/taskStore";
import { useEmployeeStore } from "@/stores/employeeStore";
import { useProjectStore } from "@/stores/projectStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Sparkles, Loader2, Play, Square, Eraser } from "lucide-react";
import { aiSuggestAssignee, aiAnalyzeComplexity, aiGenerateComment, startCodex, stopCodex } from "@/lib/codex";
import { SubtaskList } from "./SubtaskList";
import { CommentList } from "./CommentList";

interface TaskDetailDialogProps {
  task: Task;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
}: TaskDetailDialogProps) {
  const { updateTask, deleteTask, addComment, updateTaskStatus } = useTaskStore();
  const { employees, fetchEmployees, codexProcesses, updateEmployeeStatus, clearCodexOutput } = useEmployeeStore();
  const projects = useProjectStore((s) => s.projects);
  const projectRepoPath = projects.find((p) => p.id === task.project_id)?.repo_path;
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState(task.status);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? "");
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [codexLoading, setCodexLoading] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  const codexProcess = assigneeId ? codexProcesses[assigneeId] : undefined;
  const isRunning = codexProcess?.running ?? false;
  const output = codexProcess?.output ?? [];

  useEffect(() => {
    if (open) {
      fetchEmployees();
      setTitle(task.title);
      setDescription(task.description ?? "");
      setPriority(task.priority);
      setStatus(task.status);
      setAssigneeId(task.assignee_id ?? "");
      setAiResult(null);
    }
  }, [open, task]);

  useEffect(() => {
    terminalRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output.length]);

  const handleSave = async (field: string, value: string) => {
    if (field === "title" && value.trim()) {
      await updateTask(task.id, { title: value.trim() });
    } else if (field === "description") {
      await updateTask(task.id, { description: value || null });
    } else if (field === "priority") {
      await updateTask(task.id, { priority: value });
    } else if (field === "status") {
      await useTaskStore.getState().updateTaskStatus(task.id, value as TaskStatus);
    } else if (field === "assignee_id") {
      await updateTask(task.id, { assignee_id: value || null });
    }
  };

  const handleDelete = async () => {
    await deleteTask(task.id);
    onOpenChange(false);
  };

  const handleRunCodex = async () => {
    if (!assigneeId) return;
    setCodexLoading(true);
    try {
      await updateEmployeeStatus(assigneeId, "busy");
      await updateTaskStatus(task.id, "in_progress");
      setStatus("in_progress");
      const desc = title + (description ? `\n${description}` : "");
      await startCodex(assigneeId, desc, projectRepoPath ?? undefined);
    } catch (err) {
      console.error("Failed to start codex:", err);
      await updateEmployeeStatus(assigneeId, "error");
    } finally {
      setCodexLoading(false);
    }
  };

  const handleStopCodex = async () => {
    if (!assigneeId) return;
    setCodexLoading(true);
    try {
      await stopCodex(assigneeId);
      await updateEmployeeStatus(assigneeId, "offline");
    } catch (err) {
      console.error("Failed to stop codex:", err);
    } finally {
      setCodexLoading(false);
    }
  };

  const handleAiSuggest = async () => {
    setAiLoading("assignee");
    setAiResult(null);
    try {
      const employeeList = employees
        .map((e) => `${e.id}: ${e.name} (${e.role}, ${e.specialization ?? "general"})`)
        .join("; ");
      const desc = task.description ?? task.title;
      const result = await aiSuggestAssignee(desc, employeeList);
      setAiResult(result);
      await updateTask(task.id, { ai_suggestion: result });
    } catch (e) {
      setAiResult(`AI建议失败: ${e}`);
    } finally {
      setAiLoading(null);
    }
  };

  const handleAiComplexity = async () => {
    setAiLoading("complexity");
    setAiResult(null);
    try {
      const desc = task.description ?? task.title;
      const result = await aiAnalyzeComplexity(desc);
      setAiResult(result);
      const match = result.match(/(\d+)/);
      if (match) {
        await updateTask(task.id, { complexity: parseInt(match[1], 10) });
      }
    } catch (e) {
      setAiResult(`复杂度分析失败: ${e}`);
    } finally {
      setAiLoading(null);
    }
  };

  const handleAiComment = async () => {
    setAiLoading("comment");
    try {
      const result = await aiGenerateComment(
        task.title,
        task.description ?? "",
        `Status: ${task.status}, Priority: ${task.priority}`
      );
      await addComment(task.id, result, undefined, true);
    } catch (e) {
      console.error("AI comment failed:", e);
    } finally {
      setAiLoading(null);
    }
  };

  function getLineColor(line: string): string {
    if (line.startsWith("[ERROR]")) return "text-red-400";
    if (line.startsWith("[EXIT]")) return "text-yellow-400";
    return "text-green-400";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">任务详情</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleSave("title", title)}
            className="text-lg font-semibold border-none px-0 focus-visible:ring-0"
            placeholder="任务标题"
          />

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">状态</span>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  handleSave("status", e.target.value);
                }}
                className="text-xs border border-input rounded px-1.5 py-0.5 bg-background"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">优先级</span>
              <select
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  handleSave("priority", e.target.value);
                }}
                className="text-xs border border-input rounded px-1.5 py-0.5 bg-background"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">指派</span>
              <select
                value={assigneeId}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  handleSave("assignee_id", e.target.value);
                }}
                className="text-xs border border-input rounded px-1.5 py-0.5 bg-background max-w-[140px]"
              >
                <option value="">未指派</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Delete */}
            <button
              onClick={handleDelete}
              className="ml-auto p-1 text-muted-foreground hover:text-destructive transition-colors"
              title="删除任务"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Codex Run Controls */}
          <div className="flex items-center gap-2">
            {assigneeId ? (
              isRunning ? (
                <button
                  onClick={handleStopCodex}
                  disabled={codexLoading}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {codexLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                  停止运行
                </button>
              ) : (
                <button
                  onClick={handleRunCodex}
                  disabled={codexLoading}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {codexLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                  运行 Codex
                </button>
              )
            ) : (
              <span className="text-xs text-muted-foreground">请先指派员工以运行 Codex</span>
            )}
            {isRunning && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                运行中
              </span>
            )}
          </div>

          {/* Codex Terminal Output */}
          {(isRunning || output.length > 0) && assigneeId && (
            <div>
              <div className="flex items-center justify-between px-2 py-1 bg-black/80 rounded-t border-b border-zinc-800">
                <span className="text-xs text-zinc-500 font-mono">Codex 终端</span>
                <button
                  onClick={() => clearCodexOutput(assigneeId)}
                  className="p-0.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="清空日志"
                >
                  <Eraser className="h-3 w-3" />
                </button>
              </div>
              <ScrollArea className="h-40 bg-black rounded-b">
                <div className="p-2 font-mono text-xs space-y-0.5">
                  {output.length === 0 ? (
                    <div className="text-zinc-600">等待输出...</div>
                  ) : (
                    output.map((line, i) => (
                      <div key={i} className={`whitespace-pre-wrap ${getLineColor(line)}`}>
                        {line}
                      </div>
                    ))
                  )}
                  <div ref={terminalRef} />
                </div>
              </ScrollArea>
            </div>
          )}

          {/* AI Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleAiSuggest}
              disabled={aiLoading !== null}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {aiLoading === "assignee" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              AI建议指派
            </button>
            <button
              onClick={handleAiComplexity}
              disabled={aiLoading !== null}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {aiLoading === "complexity" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              复杂度分析
            </button>
            <button
              onClick={handleAiComment}
              disabled={aiLoading !== null}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {aiLoading === "comment" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              AI生成评论
            </button>
          </div>

          {/* AI Result */}
          {aiResult && (
            <div className="bg-primary/5 rounded-md p-3 text-xs text-muted-foreground">
              <span className="font-medium text-primary">AI 结果: </span>
              {aiResult}
            </div>
          )}

          {/* AI Suggestion (persisted) */}
          {task.ai_suggestion && !aiResult && (
            <div className="bg-primary/5 rounded-md p-3 text-xs text-muted-foreground">
              <span className="font-medium text-primary">AI 建议: </span>
              {task.ai_suggestion}
            </div>
          )}

          <Separator />

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => handleSave("description", description)}
              className="w-full mt-1 text-sm border border-input rounded-md p-2 bg-background min-h-[80px] resize-y"
              placeholder="添加任务描述..."
            />
          </div>

          <Separator />

          {/* Subtasks */}
          <SubtaskList taskId={task.id} />

          <Separator />

          {/* Comments */}
          <CommentList taskId={task.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
