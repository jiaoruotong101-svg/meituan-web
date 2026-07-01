"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Network,
  ShieldAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Alert = {
  id: string;
  type: string;
  message: string;
  city: string | null;
  resolved: boolean;
  createdAt: string;
};

const TYPE_META: Record<string, { label: string; icon: LucideIcon; cls: string }> = {
  captcha: {
    label: "验证码拦截",
    icon: ShieldAlert,
    cls: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  },
  rate_limit: {
    label: "接口限流",
    icon: Ban,
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  error: {
    label: "运行异常",
    icon: AlertTriangle,
    cls: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  network: {
    label: "网络异常",
    icon: Network,
    cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
};

function fmtTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function relTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60_000) return "刚刚";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
    return `${Math.floor(diff / 86400_000)} 天前`;
  } catch {
    return "";
  }
}

export function AlertsTab() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { alerts: Alert[] };
      setAlerts(json.alerts ?? []);
    } catch {
      toast({
        title: "加载失败",
        description: "无法获取告警列表",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleResolveAll = async () => {
    setResolving(true);
    try {
      const res = await fetch("/api/alerts/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { updated: number };
      toast({
        title: "已处理",
        description: `成功标记 ${json.updated} 条告警为已处理`,
      });
      fetchAlerts();
    } catch {
      toast({
        title: "操作失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setResolving(false);
    }
  };

  const handleResolveOne = async (id: string) => {
    try {
      const res = await fetch("/api/alerts/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "已处理", description: "告警已标记为已处理" });
      fetchAlerts();
    } catch {
      toast({
        title: "操作失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    }
  };

  const unresolved = alerts.filter((a) => !a.resolved);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">
              告警总览
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              共 {alerts.length} 条告警 ·{" "}
              <span className="text-rose-600 dark:text-rose-400">
                {unresolved.length} 条未处理
              </span>
            </div>
          </div>
          <Button
            onClick={handleResolveAll}
            disabled={unresolved.length === 0 || resolving}
            variant="default"
            size="sm"
            className="bg-emerald-600 text-emerald-50 hover:bg-emerald-700"
          >
            <CheckCircle2 className="size-4" />
            {resolving ? "处理中..." : "标记全部已处理"}
          </Button>
        </div>
      </Card>

      <Card className="p-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">告警列表</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="grid h-32 place-items-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : alerts.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="max-h-[600px] space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {alerts.map((a) => {
                const meta = TYPE_META[a.type] ?? TYPE_META.error;
                const Icon = meta.icon;
                return (
                  <li
                    key={a.id}
                    className={`flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start ${
                      a.resolved
                        ? "border-border bg-muted/30 opacity-70"
                        : "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20"
                    }`}
                  >
                    <div
                      className={`grid size-9 shrink-0 place-items-center rounded-lg ${meta.cls}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={meta.cls}>
                          {meta.label}
                        </Badge>
                        {a.city && (
                          <Badge variant="outline" className="gap-1">
                            <Network className="size-3" />
                            {a.city}
                          </Badge>
                        )}
                        {a.resolved ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            <CheckCircle2 className="size-3" />
                            已处理
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300"
                          >
                            未处理
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-foreground">{a.message}</p>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        <span title={fmtTime(a.createdAt)}>
                          {fmtTime(a.createdAt)} ({relTime(a.createdAt)})
                        </span>
                      </div>
                    </div>
                    {!a.resolved && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResolveOne(a.id)}
                        className="shrink-0"
                      >
                        标记已处理
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid h-64 place-items-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 className="size-7" />
        </div>
        <div>
          <div className="text-base font-medium text-foreground">暂无告警</div>
          <div className="mt-1 text-xs text-muted-foreground">
            系统运行正常，所有告警均已处理
          </div>
        </div>
      </div>
    </div>
  );
}
