import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SCHEDULE, CITY_TARGET } from "@/lib/dashboard";
import { fetchAllCrawlSessions } from "@/lib/crawl-session";

export const dynamic = "force-dynamic";

export type ScheduleDay = {
  day: number;
  cities: Array<{
    city: string;
    target: number;
    crawled: number;
    percent: number;
    status: "completed" | "running" | "pending" | "planned";
    sessionStatus: string | null;
  }>;
};

export async function GET() {
  const grouped = await db.hotel.groupBy({
    by: ["city"],
    _count: { hotelId: true },
  });
  const hotelCounts = new Map<string, number>();
  for (const g of grouped) hotelCounts.set(g.city, g._count.hotelId);

  // Use defensive reader for the same reason as /api/cities
  const sessions = await fetchAllCrawlSessions();
  const latestSession = new Map<(typeof sessions)[number]>();
  for (const s of sessions) {
    if (!latestSession.has(s.city)) latestSession.set(s.city, s);
  }

  const days: ScheduleDay[] = SCHEDULE.map((d) => ({
    day: d.day,
    cities: d.cities.map((city) => {
      const crawled = hotelCounts.get(city) ?? 0;
      const percent = Math.min(
        100,
        Math.round((crawled / CITY_TARGET) * 1000) / 10,
      );
      const session = latestSession.get(city);
      let status: ScheduleDay["cities"][number]["status"] = "planned";
      if (crawled >= CITY_TARGET) status = "completed";
      else if (session?.status === "running") status = "running";
      else if (crawled > 0) status = "pending";
      return {
        city,
        target: CITY_TARGET,
        crawled,
        percent,
        status,
        sessionStatus: session?.status ?? null,
      };
    }),
  }));

  return NextResponse.json(
    { days },
    { headers: { "Cache-Control": "no-store" } },
  );
}
