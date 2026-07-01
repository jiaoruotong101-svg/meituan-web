"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { CityProgress } from "@/app/api/cities/route";

const STATUS_META: Record<
  CityProgress["status"],
  { label: string; cls: string; dot: string }
> = {
  completed: {
    label: "已完成",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  running: {
    label: "进行中",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    dot: "bg-amber-500 animate-pulse",
  },
  pending: {
    label: "待继续",
    cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  planned: {
    label: "未开始",
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    dot: "bg-rose-400",
  },
};

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

export function CitiesTab({ cities }: { cities: CityProgress[] | null }) {
  const summary = useMemo(() => {
    if (!cities) return null;
    const total = cities.reduce((s, c) => s + c.crawled, 0);
    const completed = cities.filter((c) => c.status === "completed").length;
    const running = cities.filter((c) => c.status === "running").length;
    const planned = cities.filter((c) => c.status === "planned").length;
    const overall = Math.round((total / (cities.length * 200)) * 1000) / 10;
    return { total, completed, running, planned, overall };
  }, [cities]);

  if (!cities || !summary) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="累计爬取" value={`${summary.total} 家`} accent="text-emerald-700 dark:text-emerald-400" />
        <SummaryStat label="已完成城市" value={`${summary.completed} / ${cities.length}`} accent="text-teal-700 dark:text-teal-400" />
        <SummaryStat label="进行中" value={`${summary.running}`} accent="text-amber-700 dark:text-amber-400" />
        <SummaryStat label="整体进度" value={`${summary.overall}%`} accent="text-foreground" />
      </div>

      <Card className="p-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">15 城爬取进度明细</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[600px] overflow-y-auto rounded-md border border-border custom-scrollbar">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-24">城市</TableHead>
                  <TableHead className="w-20 text-right">目标</TableHead>
                  <TableHead className="w-20 text-right">已爬</TableHead>
                  <TableHead className="min-w-[180px]">完成度</TableHead>
                  <TableHead className="w-24">状态</TableHead>
                  <TableHead className="w-28 text-right">最近爬取</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cities.map((c) => {
                  const meta = STATUS_META[c.status];
                  return (
                    <TableRow key={c.city}>
                      <TableCell className="font-medium text-foreground">
                        {c.city}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {c.target}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {c.crawled}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={c.percent}
                            className="h-2 flex-1 bg-emerald-100/40 dark:bg-emerald-950/40"
                          />
                          <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                            {c.percent}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`gap-1.5 ${meta.cls}`}
                        >
                          <span className={`size-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {fmtTime(c.lastCrawlTime)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${accent}`}>
        {value}
      </div>
    </Card>
  );
}
