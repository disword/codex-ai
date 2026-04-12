import { getStatusColor, getStatusLabel, cn } from "@/lib/utils";

interface EmployeeStatusBadgeProps {
  status: string;
  className?: string;
}

export function EmployeeStatusBadge({ status, className }: EmployeeStatusBadgeProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
      <span className="text-xs text-muted-foreground">{getStatusLabel(status)}</span>
    </span>
  );
}
