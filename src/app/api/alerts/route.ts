import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const alerts = await db.crawlAlert.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(
    { alerts, total: alerts.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
