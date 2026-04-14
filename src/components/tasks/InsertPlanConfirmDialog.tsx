import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InsertPlanConfirmDialogProps {
  open: boolean;
  taskTitle: string;
  inserting?: boolean;
  onOpenChange: (open: boolean) => void;
  onAppend: () => Promise<void> | void;
  onReplace: () => Promise<void> | void;
}

export function InsertPlanConfirmDialog({
  open,
  taskTitle,
  inserting = false,
  onOpenChange,
  onAppend,
  onReplace,
}: InsertPlanConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={!inserting}>
        <DialogHeader>
          <DialogTitle>插入 AI 计划</DialogTitle>
          <DialogDescription>
            任务“{taskTitle}”已有详情内容。请选择是将 AI 计划追加到末尾，还是直接替换现有详情。
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={inserting}
          >
            取消
          </Button>
          <Button
            type="button"
            variant="default"
            onClick={() => void onAppend()}
            disabled={inserting}
          >
            {inserting ? "处理中..." : "追加到末尾"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void onReplace()}
            disabled={inserting}
          >
            替换详情
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
