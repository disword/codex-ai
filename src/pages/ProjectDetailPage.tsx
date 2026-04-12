import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useProjectStore } from "@/stores/projectStore";
import { useTaskStore } from "@/stores/taskStore";
import { useEmployeeStore } from "@/stores/employeeStore";
import { select } from "@/lib/database";
import type { Employee } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { getStatusLabel, getStatusColor, getPriorityLabel, formatDate } from "@/lib/utils";

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { projects, updateProject, deleteProject } = useProjectStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { fetchEmployees } = useEmployeeStore();
  const [projectEmployees, setProjectEmployees] = useState<Employee[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRepoPath, setEditRepoPath] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [saving, setSaving] = useState(false);

  const project = projects.find((p) => p.id === id);

  useEffect(() => {
    if (id) {
      fetchTasks(id);
      fetchEmployees();
      loadProjectEmployees(id);
    }
  }, [id, fetchTasks, fetchEmployees]);

  const loadProjectEmployees = async (projectId: string) => {
    try {
      const rows = await select<Employee>(
        `SELECT e.* FROM employees e 
         INNER JOIN project_employees pe ON e.id = pe.employee_id 
         WHERE pe.project_id = $1`,
        [projectId]
      );
      setProjectEmployees(rows);
    } catch (e) {
      console.error("Failed to load project employees:", e);
    }
  };

  useEffect(() => {
    if (project) {
      setEditName(project.name);
      setEditDesc(project.description ?? "");
      setEditRepoPath(project.repo_path ?? "");
      setEditStatus(project.status);
    }
  }, [project]);

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">项目不存在</p>
        <Link to="/projects" className="text-primary hover:underline">
          返回项目列表
        </Link>
      </div>
    );
  }

  const handleEdit = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await updateProject(project.id, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        repo_path: editRepoPath.trim() || null,
        status: editStatus,
      });
      setShowEdit(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteProject(project.id);
  };

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === "todo"),
    in_progress: tasks.filter((t) => t.status === "in_progress"),
    review: tasks.filter((t) => t.status === "review"),
    completed: tasks.filter((t) => t.status === "completed"),
    blocked: tasks.filter((t) => t.status === "blocked"),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/projects" className="p-1 hover:bg-accent rounded">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{project.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={project.status === "active" ? "default" : "secondary"}>
              {getStatusLabel(project.status)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              创建于 {formatDate(project.created_at)}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
          <Edit2 className="h-3.5 w-3.5 mr-1" />
          编辑
        </Button>
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          删除
        </Button>
      </div>

      {/* Description */}
      {project.description && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">{project.description}</p>
        </Card>
      )}

      {/* Task Stats */}
      <div className="grid grid-cols-5 gap-3">
        {Object.entries(tasksByStatus).map(([status, items]) => (
          <Card key={status} className="p-3 text-center">
            <div className={`w-2 h-2 rounded-full mx-auto mb-1 ${getStatusColor(status)}`} />
            <div className="text-lg font-bold">{items.length}</div>
            <div className="text-xs text-muted-foreground">{getStatusLabel(status)}</div>
          </Card>
        ))}
      </div>

      {/* Task List */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">任务列表</h3>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">暂无任务</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-accent/50 text-sm"
              >
                <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor(task.status)}`} />
                <span className="flex-1 font-medium truncate">{task.title}</span>
                <span className="text-xs text-muted-foreground">
                  {getPriorityLabel(task.priority)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Team Members */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">团队成员</h3>
        {projectEmployees.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">暂无成员</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {projectEmployees.map((emp) => (
              <div
                key={emp.id}
                className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full text-sm"
              >
                <div className={`w-2 h-2 rounded-full ${getStatusColor(emp.status)}`} />
                <span>{emp.name}</span>
                <span className="text-xs text-muted-foreground">{emp.role}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>编辑项目</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">名称</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">描述</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full mt-1 text-sm border border-input rounded-md p-2 bg-background min-h-[60px] resize-y"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">仓库路径</label>
              <Input
                value={editRepoPath}
                onChange={(e) => setEditRepoPath(e.target.value)}
                placeholder="/path/to/repo（可选）"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">状态</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full mt-1 text-sm border border-input rounded-md px-2 py-1.5 bg-background"
              >
                <option value="active">活跃</option>
                <option value="archived">归档</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEdit(false)}>
                取消
              </Button>
              <Button onClick={handleEdit} disabled={!editName.trim() || saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
