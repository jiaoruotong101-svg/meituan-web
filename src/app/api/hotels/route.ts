import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseHotel, type HotelWithParsed } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "";
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "default";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.max(
    1,
    Math.min(100, parseInt(searchParams.get("pageSize") || "20", 10)),
  );

  const where: Record<string, unknown> = {};
  if (city && city !== "all") where.city = city;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { address: { contains: search } },
      { locationDesc: { contains: search } },
    ];
  }

  const orderBy: Record<string, "asc" | "desc"> = (() => {
    switch (sort) {
      case "price_asc":
        return { currentPrice: "asc" };
      case "price_desc":
        return { currentPrice: "desc" };
      case "score_desc":
        return { score: "desc" };
      case "time_desc":
        return { crawlTime: "desc" };
      default:
        return { crawlTime: "desc" };
    }
  })();

  const [total, rawHotels] = await Promise.all([
    db.hotel.count({ where }),
    db.hotel.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const hotels: HotelWithParsed[] = rawHotels.map(parseHotel);

  return NextResponse.json(
    {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      hotels,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
