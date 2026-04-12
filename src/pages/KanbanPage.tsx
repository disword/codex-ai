import { useEffect, useState } from "react";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { useTaskStore } from "@/stores/taskStore";
import { useProjectStore } from "@/stores/projectStore";
import { Plus } from "lucide-react";

export function KanbanPage() {
  const { fetchTasks } = useTaskStore();
  const { projects, fetchProjects } = useProjectStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  useEffect(() => {
    fetchProjects();
    fetchTasks();
  }, [fetchProjects, fetchTasks]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">看板</h2>
          <select
            value={selectedProjectId ?? ""}
            onChange={(e) => {
              const val = e.target.value || undefined;
              setSelectedProjectId(val);
              fetchTasks(val);
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
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          新建任务
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <KanbanBoard projectId={selectedProjectId} />
      </div>
      <CreateTaskDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        projectId={selectedProjectId}
      />
    </div>
  );
}
