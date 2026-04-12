import { useState } from "react";
import type { Employee } from "@/lib/types";
import { useEmployeeStore } from "@/stores/employeeStore";
import { EmployeeStatusBadge } from "./EmployeeStatusBadge";
import { CodexControls } from "@/components/codex/CodexControls";
import { CodexTerminal } from "@/components/codex/CodexTerminal";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Trash2, Terminal, ChevronDown } from "lucide-react";

interface EmployeeCardProps {
  employee: Employee;
  taskCount?: number;
}

const MAX_TASKS = 5;

export function EmployeeCard({ employee, taskCount = 0 }: EmployeeCardProps) {
  const deleteEmployee = useEmployeeStore((s) => s.deleteEmployee);
  const updateEmployeeStatus = useEmployeeStore((s) => s.updateEmployeeStatus);
  const stopCodex = useEmployeeStore((s) => s.clearCodexOutput);
  const [showTerminal, setShowTerminal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const workload = Math.min((taskCount / MAX_TASKS) * 100, 100);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await updateEmployeeStatus(employee.id, "offline");
    stopCodex(employee.id);
    await deleteEmployee(employee.id);
  };

  const roleLabels: Record<string, string> = {
    developer: "开发者",
    reviewer: "审查员",
    tester: "测试员",
    coordinator: "协调员",
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
            {employee.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{employee.name}</div>
            <div className="text-xs text-muted-foreground">
              {roleLabels[employee.role] ?? employee.role}
              {employee.specialization && ` · ${employee.specialization}`}
            </div>
          </div>
          <EmployeeStatusBadge status={employee.status} />
        </div>

        {/* Workload */}
        {taskCount > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>工作负载</span>
              <span>{taskCount}/{MAX_TASKS}</span>
            </div>
            <Progress value={workload} className="h-1.5" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 pb-3">
        <CodexControls employeeId={employee.id} employeeStatus={employee.status} />
      </div>

      {/* Terminal toggle */}
      <Collapsible open={showTerminal} onOpenChange={setShowTerminal}>
        <CollapsibleTrigger className="w-full flex items-center justify-center gap-1.5 px-4 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors border-t border-border">
          <Terminal className="h-3 w-3" />
          {showTerminal ? "收起日志" : "查看日志"}
          <ChevronDown className={`h-3 w-3 transition-transform ${showTerminal ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-3 pb-3">
            <CodexTerminal employeeId={employee.id} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Delete button */}
      <div className="px-4 pb-3 flex justify-end">
        <button
          onClick={handleDelete}
          className={`p-1 transition-colors ${
            confirmDelete
              ? "text-destructive"
              : "text-muted-foreground hover:text-destructive"
          }`}
          title={confirmDelete ? "再次点击确认删除" : "删除员工"}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
