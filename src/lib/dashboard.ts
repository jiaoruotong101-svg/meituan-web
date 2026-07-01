/**
 * Shared types and helpers for the hotel crawler dashboard API.
 */
import type { Hotel } from "@prisma/client";

export type HotelWithParsed = Omit<Hotel, "hotelType" | "tags" | "promotions" | "facilities" | "nearbyPois"> & {
  hotelType: string[];
  tags: string[];
  promotions: string[];
  facilities: string[];
  nearbyPois: string[];
};

export function parseHotel(h: Hotel): HotelWithParsed {
  return {
    ...h,
    hotelType: safeJsonArray(h.hotelType),
    tags: safeJsonArray(h.tags),
    promotions: safeJsonArray(h.promotions),
    facilities: safeJsonArray(h.facilities),
    nearbyPois: safeJsonArray(h.nearbyPois),
  };
}

function safeJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export type StatsResponse = {
  totalHotels: number;
  todayAdded: number;
  completedCities: number;
  plannedCities: number;
  activeAlerts: number;
  cityCounts: Array<{ city: string; count: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
  priceDistribution: Array<{ range: string; count: number }>;
};

export const PLANNED_CITIES = [
  "北京", "上海", "广州", "深圳", "成都",
  "重庆", "杭州", "南京", "武汉", "西安",
  "天津", "苏州", "长沙", "厦门", "青岛",
];

export const CITY_TARGET = 200;

export const SCHEDULE: Array<{ day: number; cities: string[] }> = [
  { day: 1, cities: ["北京"] },
  { day: 2, cities: ["上海"] },
  { day: 3, cities: ["广州", "深圳"] },
  { day: 4, cities: ["成都", "重庆"] },
  { day: 5, cities: ["杭州", "南京"] },
  { day: 6, cities: ["武汉", "西安"] },
  { day: 7, cities: ["天津", "苏州", "长沙", "厦门", "青岛"] },
];
