import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { id?: string; all?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (body.all) {
    const result = await db.crawlAlert.updateMany({
      where: { resolved: false },
      data: { resolved: true },
    });
    return NextResponse.json({
      ok: true,
      updated: result.count,
      action: "resolved_all",
    });
  }

  if (!body.id) {
    return NextResponse.json(
      { ok: false, error: "id is required (or pass all=true)" },
      { status: 400 },
    );
  }

  const updated = await db.crawlAlert.update({
    where: { id: body.id },
    data: { resolved: true },
  });
  return NextResponse.json({ ok: true, alert: updated, action: "resolved_one" });
}
