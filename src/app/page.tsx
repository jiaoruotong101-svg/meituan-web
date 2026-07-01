"use client";

import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Bell,
  MapPinned,
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardFooter } from "@/components/dashboard/dashboard-footer";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { OverviewTab } from "@/components/dashboard/overview-tab";
import { CitiesTab } from "@/components/dashboard/cities-tab";
import { HotelsTab } from "@/components/dashboard/hotels-tab";
import { ScheduleTab } from "@/components/dashboard/schedule-tab";
import { AlertsTab } from "@/components/dashboard/alerts-tab";
import { useToast } from "@/hooks/use-toast";
import type { StatsResponse } from "@/lib/dashboard";
import type { CityProgress } from "@/app/api/cities/route";
import type { ScheduleDay } from "@/app/api/schedule/route";

export default function Home() {
  const { toast } = useToast();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [cities, setCities] = useState<CityProgress[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleDay[] | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Fetch stats (drives header + StatsCards + Overview tab)
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as StatsResponse;
      setStats(json);
    } catch {
      toast({
        title: "加载失败",
        description: "无法获取看板统计数据",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Fetch city progress (Cities tab)
  const fetchCities = useCallback(async () => {
    try {
      const res = await fetch("/api/cities", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { cities: CityProgress[] };
      setCities(json.cities);
    } catch {
      toast({
        title: "加载失败",
        description: "无法获取城市进度",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Fetch schedule (Schedule tab)
  const fetchSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { days: ScheduleDay[] };
      setSchedule(json.days);
    } catch {
      toast({
        title: "加载失败",
        description: "无法获取排期数据",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Initial load - fetch stats and cities (so header + stats work)
  useEffect(() => {
    fetchStats();
    fetchCities();
  }, [fetchStats, fetchCities]);

  // Lazy-load schedule when tab activated
  useEffect(() => {
    if (activeTab === "schedule" && !schedule) {
      fetchSchedule();
    }
  }, [activeTab, schedule, fetchSchedule]);

  // Auto-refresh stats every 30s
  useEffect(() => {
    const t = setInterval(() => fetchStats(), 30_000);
    return () => clearInterval(t);
  }, [fetchStats]);

  const handleExport = async () => {
    try {
      const res = await fetch("/api/export/csv");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.download = match ? match[1] : `hotels_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "导出成功",
        description: "全量酒店数据 CSV 已开始下载",
      });
    } catch {
      toast({
        title: "导出失败",
        description: "CSV 导出失败，请稍后重试",
        variant: "destructive",
      });
    }
  };

  const cityOptions = (cities ?? []).map((c) => ({ value: c.city, label: c.city }));
  const activeAlerts = stats?.activeAlerts ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader activeAlerts={activeAlerts} onExport={handleExport} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 sm:py-6">
        {/* Stats */}
        <StatsCards
          totalHotels={stats?.totalHotels ?? 0}
          todayAdded={stats?.todayAdded ?? 0}
          completedCities={stats?.completedCities ?? 0}
          plannedCities={stats?.plannedCities ?? 15}
          activeAlerts={activeAlerts}
        />

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-6"
        >
          <div className="overflow-x-auto pb-1">
            <TabsList className="h-auto w-fit bg-muted/60 p-1">
              <TabsTrigger value="overview" className="gap-1.5">
                <BarChart3 className="size-4" />
                概览
              </TabsTrigger>
              <TabsTrigger value="cities" className="gap-1.5">
                <MapPinned className="size-4" />
                城市进度
              </TabsTrigger>
              <TabsTrigger value="hotels" className="gap-1.5">
                <Building2 className="size-4" />
                酒店数据
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-1.5">
                <CalendarDays className="size-4" />
                排期
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-1.5">
                <Bell className="size-4" />
                告警
                {activeAlerts > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white">
                    {activeAlerts}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab stats={stats} />
          </TabsContent>

          <TabsContent value="cities" className="mt-4">
            <CitiesTab cities={cities} />
          </TabsContent>

          <TabsContent value="hotels" className="mt-4">
            <HotelsTab cityOptions={cityOptions} />
          </TabsContent>

          <TabsContent value="schedule" className="mt-4">
            <ScheduleTab days={schedule} />
          </TabsContent>

          <TabsContent value="alerts" className="mt-4">
            <AlertsTab />
          </TabsContent>
        </Tabs>
      </main>

      <DashboardFooter />
    </div>
  );
}
