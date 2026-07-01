"use client";

import { Hotel, MapPin, CheckCircle, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

type StatItem = {
  label: string;
  value: number | string;
  sub: string;
  icon: LucideIcon;
  accent: string; // tailwind classes for icon background
  ring: string; // border accent
};

export function StatsCards({
  totalHotels,
  todayAdded,
  completedCities,
  plannedCities,
  activeAlerts,
}: {
  totalHotels: number;
  todayAdded: number;
  completedCities: number;
  plannedCities: number;
  activeAlerts: number;
}) {
  const items: StatItem[] = [
    {
      label: "已爬取酒店总数",
      value: totalHotels.toLocaleString(),
      sub: "全平台累计去重记录",
      icon: Hotel,
      accent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
      ring: "border-emerald-200/60 dark:border-emerald-900/40",
    },
    {
      label: "今日新增",
      value: todayAdded.toLocaleString(),
      sub: "今日 00:00 至今入库",
      icon: MapPin,
      accent: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      ring: "border-amber-200/60 dark:border-amber-900/40",
    },
    {
      label: "已完成城市",
      value: `${completedCities} / ${plannedCities}`,
      sub: `目标 200 家 / 城市`,
      icon: CheckCircle,
      accent: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
      ring: "border-teal-200/60 dark:border-teal-900/40",
    },
    {
      label: "活跃告警",
      value: activeAlerts.toLocaleString(),
      sub: activeAlerts > 0 ? "需立即关注处理" : "暂无未处理告警",
      icon: AlertTriangle,
      accent:
        activeAlerts > 0
          ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      ring:
        activeAlerts > 0
          ? "border-rose-200/60 dark:border-rose-900/40"
          : "border-slate-200/60 dark:border-slate-800/40",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Card
            key={it.label}
            className={`gap-0 overflow-hidden p-4 sm:p-6 ${it.ring}`}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">
                {it.label}
              </CardTitle>
              <div className={`grid size-9 place-items-center rounded-lg ${it.accent}`}>
                <Icon className="size-4 sm:size-5" />
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <div className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {it.value}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{it.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
