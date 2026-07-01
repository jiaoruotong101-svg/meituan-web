"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, MapPin } from "lucide-react";
import type { ScheduleDay } from "@/app/api/schedule/route";

const STATUS_BADGE: Record<
  ScheduleDay["cities"][number]["status"],
  { label: string; cls: string; bar: string }
> = {
  completed: {
    label: "已完成",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  running: {
    label: "进行中",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  pending: {
    label: "待继续",
    cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    bar: "bg-slate-400",
  },
  planned: {
    label: "未开始",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    bar: "bg-rose-400",
  },
};

export function ScheduleTab({ days }: { days: ScheduleDay[] | null }) {
  if (!days) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="size-4 text-emerald-600 dark:text-emerald-400" />
          共 7 天排期，覆盖 15 个目标城市，每日目标 200 家。
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {days.map((d) => (
          <Card key={d.day} className="p-4">
            <CardHeader className="flex flex-row items-center justify-between gap-2 px-0 pb-3">
              <CardTitle className="text-sm font-semibold">
                Day {d.day}
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              >
                {d.cities.length} 城
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-0">
              {d.cities.map((c) => {
                const meta = STATUS_BADGE[c.status];
                return (
                  <div
                    key={c.city}
                    className="rounded-lg border border-border bg-background/60 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <MapPin className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        {c.city}
                      </div>
                      <Badge variant="outline" className={`gap-1 ${meta.cls}`}>
                        <span className={`size-1.5 rounded-full ${meta.bar}`} />
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {c.crawled} / {c.target} 家
                      </span>
                      <span className="tabular-nums">{c.percent}%</span>
                    </div>
                    <Progress
                      value={c.percent}
                      className={`h-1.5 ${meta.bar}`}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
