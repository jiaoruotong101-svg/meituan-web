/**
 * Defensive helpers for reading CrawlSession rows that may have been
 * written either by Prisma (Unix-millisecond INTEGER columns) or by the
 * parallel Python crawler (ISO-8601 TEXT columns).
 *
 * Using $queryRaw with CAST(... AS TEXT) lets us bypass Prisma's strict
 * DateTime conversion and parse the values ourselves.
 */
import { db } from "@/lib/db";

export type RawCrawlSession = {
  id: string;
  city: string;
  startedAt: Date;
  endedAt: Date | null;
  hotelCount: number;
  targetCount: number;
  status: string;
  errorMsg: string | null;
  checkinDate: string | null;
  checkoutDate: string | null;
};

type RawRow = {
  id: string;
  city: string;
  startedAt: string | number | null;
  endedAt: string | number | null;
  hotelCount: number | bigint;
  targetCount: number | bigint;
  status: string;
  errorMsg: string | null;
  checkinDate: string | null;
  checkoutDate: string | null;
};

function toDate(v: string | number | null): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    // Prisma stores DateTime as Unix milliseconds in SQLite
    return new Date(v);
  }
  // Text - could be ISO 8601 or Unix millis as string
  const asNum = Number(v);
  if (!Number.isNaN(asNum) && /^\d+$/.test(v)) {
    return new Date(asNum);
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNum(v: number | bigint): number {
  return typeof v === "bigint" ? Number(v) : v;
}

export async function fetchAllCrawlSessions(): Promise<RawCrawlSession[]> {
  const rows = (await db.$queryRaw`
    SELECT
      id,
      city,
      CAST(startedAt AS TEXT) AS startedAt,
      CAST(endedAt AS TEXT)   AS endedAt,
      hotelCount,
      targetCount,
      status,
      errorMsg,
      checkinDate,
      checkoutDate
    FROM CrawlSession
    ORDER BY startedAt DESC
  `) as RawRow[];

  return rows.map((r) => ({
    id: r.id,
    city: r.city,
    startedAt: toDate(r.startedAt) ?? new Date(0),
    endedAt: toDate(r.endedAt),
    hotelCount: toNum(r.hotelCount),
    targetCount: toNum(r.targetCount),
    status: r.status,
    errorMsg: r.errorMsg,
    checkinDate: r.checkinDate,
    checkoutDate: r.checkoutDate,
  }));
}
