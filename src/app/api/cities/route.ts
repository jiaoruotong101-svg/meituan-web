import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLANNED_CITIES, CITY_TARGET } from "@/lib/dashboard";
import { fetchAllCrawlSessions } from "@/lib/crawl-session";

export const dynamic = "force-dynamic";

export type CityProgress = {
  city: string;
  target: number;
  crawled: number;
  percent: number;
  status: "completed" | "running" | "pending" | "planned";
  lastCrawlTime: string | null;
  sessionStatus?: string | null;
};

export async function GET() {
  // Aggregate hotel counts per city (Hotel rows are written by Prisma so
  // _max on crawlTime is safe; this returns ISO 8601 TEXT for crawlTime)
  const grouped = await db.hotel.groupBy({
    by: ["city"],
    _count: { hotelId: true },
    _max: { crawlTime: true },
  });
  const hotelStats = new Map<
    string,
    { count: number; lastCrawl: Date | null }
  >();
  for (const g of grouped) {
    hotelStats.set(g.city, {
      count: g._count.hotelId,
      lastCrawl: g._max.crawlTime ?? null,
    });
  }

  // Latest session per city - use defensive raw reader because CrawlSession
  // rows may be written by either Prisma (INTEGER millis) or the parallel
  // Python crawler (ISO 8601 TEXT).
  const sessions = await fetchAllCrawlSessions();
  const latestSession = new Map<(typeof sessions)[number]>();
  for (const s of sessions) {
    if (!latestSession.has(s.city)) latestSession.set(s.city, s);
  }

  const cities: CityProgress[] = PLANNED_CITIES.map((city) => {
    const stat = hotelStats.get(city);
    const crawled = stat?.count ?? 0;
    const percent = Math.min(
      100,
      Math.round((crawled / CITY_TARGET) * 1000) / 10,
    );
    const session = latestSession.get(city);
    let status: CityProgress["status"] = "planned";
    if (crawled >= CITY_TARGET) status = "completed";
    else if (session?.status === "running") status = "running";
    else if (crawled > 0) status = "pending";

    return {
      city,
      target: CITY_TARGET,
      crawled,
      percent,
      status,
      lastCrawlTime: stat?.lastCrawl ? stat.lastCrawl.toISOString() : null,
      sessionStatus: session?.status ?? null,
    };
  });

  return NextResponse.json(
    { cities, target: CITY_TARGET },
    { headers: { "Cache-Control": "no-store" } },
  );
}
