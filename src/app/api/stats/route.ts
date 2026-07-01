import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PLANNED_CITIES, CITY_TARGET, type StatsResponse } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 3600_000);

  // Total hotels
  const totalHotels = await db.hotel.count();

  // Today's additions
  const todayAdded = await db.hotel.count({
    where: { crawlTime: { gte: todayStart } },
  });

  // Active alerts
  const activeAlerts = await db.crawlAlert.count({
    where: { resolved: false },
  });

  // Per-city counts
  const cityCountsRaw = await db.hotel.groupBy({
    by: ["city"],
    _count: { hotelId: true },
  });
  const cityCountsMap = new Map<string, number>();
  for (const row of cityCountsRaw) {
    cityCountsMap.set(row.city, row._count.hotelId);
  }
  const cityCounts = PLANNED_CITIES.map((city) => ({
    city,
    count: cityCountsMap.get(city) ?? 0,
  })).filter((c) => c.count > 0 || PLANNED_CITIES.includes(c.city));

  // Completed cities: distinct city with >= 200 hotels
  const completedCities = PLANNED_CITIES.filter(
    (c) => (cityCountsMap.get(c) ?? 0) >= CITY_TARGET,
  ).length;

  // Daily trend (last 7 days)
  const recentHotels = await db.hotel.findMany({
    where: { crawlTime: { gte: sevenDaysAgo } },
    select: { crawlTime: true },
  });
  const trendMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 3600_000);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    trendMap.set(key, 0);
  }
  for (const h of recentHotels) {
    const key = `${h.crawlTime.getMonth() + 1}/${h.crawlTime.getDate()}`;
    if (trendMap.has(key)) {
      trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
    }
  }
  const dailyTrend = Array.from(trendMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));

  // Price distribution
  const allHotels = await db.hotel.findMany({
    select: { currentPrice: true },
  });
  const priceDistribution = [
    { range: "0-100", count: 0 },
    { range: "100-300", count: 0 },
    { range: "300-600", count: 0 },
    { range: "600+", count: 0 },
  ];
  for (const h of allHotels) {
    const p = h.currentPrice;
    if (p < 100) priceDistribution[0].count++;
    else if (p < 300) priceDistribution[1].count++;
    else if (p < 600) priceDistribution[2].count++;
    else priceDistribution[3].count++;
  }

  const payload: StatsResponse = {
    totalHotels,
    todayAdded,
    completedCities,
    plannedCities: PLANNED_CITIES.length,
    activeAlerts,
    cityCounts,
    dailyTrend,
    priceDistribution,
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
