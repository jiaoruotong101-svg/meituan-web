import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const CSV_HEADERS = [
  "hotelId",
  "name",
  "city",
  "hotelType",
  "starLevel",
  "score",
  "scoreLabel",
  "currentPrice",
  "originalPrice",
  "consumptionCount",
  "commentCount",
  "address",
  "locationDesc",
  "openYear",
  "decorateYear",
  "facilities",
  "tags",
  "promotions",
  "nearbyPois",
  "bookingStatus",
  "lowStockAlert",
  "searchKeyword",
  "checkinDate",
  "checkoutDate",
  "crawlTime",
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city") || "";

  const where: Record<string, unknown> = {};
  if (city && city !== "all") where.city = city;

  const hotels = await db.hotel.findMany({
    where,
    orderBy: [{ city: "asc" }, { currentPrice: "asc" }],
    take: 5000,
  });

  const rows: string[] = [CSV_HEADERS.join(",")];
  for (const h of hotels) {
    rows.push(
      [
        h.hotelId,
        h.name,
        h.city,
        h.hotelType,
        h.starLevel ?? "",
        h.score ?? "",
        h.scoreLabel ?? "",
        h.currentPrice,
        h.originalPrice ?? "",
        h.consumptionCount ?? "",
        h.commentCount,
        h.address ?? "",
        h.locationDesc ?? "",
        h.openYear ?? "",
        h.decorateYear ?? "",
        h.facilities,
        h.tags,
        h.promotions,
        h.nearbyPois,
        h.bookingStatus ?? "",
        h.lowStockAlert ?? "",
        h.searchKeyword ?? "",
        h.checkinDate ?? "",
        h.checkoutDate ?? "",
        h.crawlTime.toISOString(),
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const csv = "\uFEFF" + rows.join("\r\n");
  const filename = `hotels_${city === "all" || !city ? "all" : city}_${Date.now()}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
