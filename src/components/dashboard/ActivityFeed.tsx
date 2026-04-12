import { useEffect, useCallback } from "react";
import { useDashboardStore } from "@/stores/dashboardStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Activity, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";

export function ActivityFeed() {
  const { recentActivities, fetchRecentActivities } = useDashboardStore();

  useEffect(() => {
    fetchRecentActivities(30);
  }, [fetchRecentActivities]);

  const refresh = useCallback(() => {
    fetchRecentActivities(30);
  }, [fetchRecentActivities]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <Card className="p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">最近活动</h3>
        </div>
        <button
          onClick={refresh}
          className="p-1 rounded hover:bg-accent transition-colors"
          title="刷新"
        >
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {recentActivities.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-8">
          暂无活动记录
        </div>
      ) : (
        <ScrollArea className="flex-1 max-h-[400px]">
          <div className="space-y-2 pr-3">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 text-sm py-2 border-b border-border/50 last:border-0"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{activity.action}</span>
                    {activity.employee_name && (
                      <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                        {activity.employee_name}
                      </span>
                    )}
                  </div>
                  {activity.details && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {activity.details}
                    </p>
                  )}
                  <span className="text-[10px] text-muted-foreground/70 mt-0.5 block">
                    {formatDate(activity.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}
