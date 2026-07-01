"use client";

import { useEffect, useState } from "react";
import { Activity, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function DashboardHeader({
  activeAlerts,
  onExport,
}: {
  activeAlerts: number;
  onExport: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = now
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    : "----/--/--";
  const timeStr = now
    ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
    : "--:--:--";

  const hasAlert = activeAlerts > 0;

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-30">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:py-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-emerald-600 text-emerald-50 shadow-sm">
            <Activity className="size-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-foreground sm:text-xl md:text-2xl">
              美团酒店爬虫监控看板
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              学术研究用 · 数据采集进度可视化
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex flex-col rounded-lg border border-border bg-background px-3 py-1.5 text-right">
            <span className="text-xs text-muted-foreground">当前时间</span>
            <span className="font-mono text-sm font-medium tabular-nums text-foreground">
              {dateStr} {timeStr}
            </span>
          </div>

          <Badge
            variant="outline"
            className={`gap-1.5 px-3 py-1.5 text-sm font-medium ${
              hasAlert
                ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
            }`}
          >
            <span
              className={`size-2.5 rounded-full ${
                hasAlert
                  ? "bg-rose-500 animate-pulse"
                  : "bg-emerald-500"
              }`}
            />
            {hasAlert ? `${activeAlerts} 条告警` : "系统正常"}
          </Badge>

          <Button
            onClick={onExport}
            variant="default"
            size="sm"
            className="bg-emerald-600 text-emerald-50 hover:bg-emerald-700"
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">导出 CSV</span>
            <span className="sm:hidden">CSV</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
