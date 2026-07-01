"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  Download,
  MapPin,
  Search,
  Star,
} from "lucide-react";
import type { HotelWithParsed } from "@/lib/dashboard";
import { useToast } from "@/hooks/use-toast";

type HotelsResponse = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hotels: HotelWithParsed[];
};

type CityOption = { value: string; label: string };

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: "default", label: "默认（最近爬取）" },
  { value: "price_asc", label: "价格 从低到高" },
  { value: "price_desc", label: "价格 从高到低" },
  { value: "score_desc", label: "评分 从高到低" },
  { value: "time_desc", label: "爬取时间 最新" },
];

export function HotelsTab({ cityOptions }: { cityOptions: CityOption[] }) {
  const { toast } = useToast();
  const [city, setCity] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [sort, setSort] = useState<string>("default");
  const [page, setPage] = useState<number>(1);
  const [data, setData] = useState<HotelsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset page on filter changes
  useEffect(() => {
    setPage(1);
  }, [city, sort]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (city && city !== "all") params.set("city", city);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("sort", sort);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await fetch(`/api/hotels?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("fetch failed");
      const json = (await res.json()) as HotelsResponse;
      setData(json);
    } catch {
      toast({
        title: "加载失败",
        description: "无法获取酒店数据，请稍后重试",
        variant: "destructive",
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [city, debouncedSearch, sort, page, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (city && city !== "all") params.set("city", city);
      const res = await fetch(`/api/export/csv?${params.toString()}`);
      if (!res.ok) throw new Error("export failed");
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
        description: `已导出 ${city === "all" ? "全部" : city} 的酒店数据`,
      });
    } catch {
      toast({
        title: "导出失败",
        description: "CSV 导出失败，请稍后重试",
        variant: "destructive",
      });
    }
  };

  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? 1;
  const total = data?.total ?? 0;
  const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(total, currentPage * PAGE_SIZE);

  const pageItems = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, "…", totalPages];
    if (currentPage >= totalPages - 3)
      return [1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "…", currentPage - 1, currentPage, currentPage + 1, "…", totalPages];
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-4">
      {/* Filter toolbar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="w-full sm:w-40">
                <MapPin className="size-4 opacity-50" />
                <SelectValue placeholder="全部城市" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部城市</SelectItem>
                {cityOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索酒店名、地址、位置..."
                className="pl-9"
              />
            </div>

            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950"
          >
            <Download className="size-4" />
            导出 CSV
          </Button>
        </div>
      </Card>

      {/* Hotels table */}
      <Card className="p-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">
            酒店数据明细
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              共 {total.toLocaleString()} 条 · 第 {start}-{end} 条
            </span>
          </CardTitle>
          {loading && (
            <span className="text-xs text-muted-foreground">加载中...</span>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="max-h-[600px] overflow-auto rounded-md border border-border custom-scrollbar">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead className="min-w-[180px]">酒店名</TableHead>
                  <TableHead className="w-16">城市</TableHead>
                  <TableHead className="w-32">类型</TableHead>
                  <TableHead className="w-16 text-right">评分</TableHead>
                  <TableHead className="w-20 text-right">现价</TableHead>
                  <TableHead className="w-20 text-right">原价</TableHead>
                  <TableHead className="w-24">消费量</TableHead>
                  <TableHead className="min-w-[140px]">位置</TableHead>
                  <TableHead className="w-28 text-right">爬取时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.hotels.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      没有符合条件的酒店数据
                    </TableCell>
                  </TableRow>
                )}
                {data?.hotels.map((h) => {
                  const open = expandedId === h.hotelId;
                  return (
                    <ExpandableRow
                      key={h.hotelId}
                      hotel={h}
                      open={open}
                      onToggle={() => setExpandedId(open ? null : h.hotelId)}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="text-xs text-muted-foreground">
              第 {currentPage} / {totalPages} 页 · 每页 {PAGE_SIZE} 条
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage(1)}
              >
                首页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                上一页
              </Button>
              {pageItems.map((p, i) =>
                p === "…" ? (
                  <span key={`e${i}`} className="px-2 text-sm text-muted-foreground">
                    …
                  </span>
                ) : (
                  <Button
                    key={p}
                    variant={p === currentPage ? "default" : "outline"}
                    size="sm"
                    className={
                      p === currentPage
                        ? "bg-emerald-600 text-emerald-50 hover:bg-emerald-700"
                        : ""
                    }
                    onClick={() => setPage(p as number)}
                  >
                    {p}
                  </Button>
                ),
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                下一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                末页
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ExpandableRow({
  hotel,
  open,
  onToggle,
}: {
  hotel: HotelWithParsed;
  open: boolean;
  onToggle: () => void;
}) {
  const fmtTime = (d: Date | string) => {
    const date = typeof d === "string" ? new Date(d) : d;
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30"
        onClick={onToggle}
      >
        <TableCell className="text-muted-foreground">
          {open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </TableCell>
        <TableCell className="font-medium text-foreground">
          <div className="flex flex-col gap-0.5">
            <span className="line-clamp-1">{hotel.name}</span>
            {hotel.lowStockAlert && (
              <span className="text-xs text-rose-600 dark:text-rose-400">
                {hotel.lowStockAlert}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">{hotel.city}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {hotel.hotelType.slice(0, 2).map((t) => (
              <Badge
                key={t}
                variant="secondary"
                className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                {t}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell className="text-right">
          <div className="inline-flex items-center gap-1 font-medium tabular-nums">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            {hotel.score?.toFixed(1) ?? "—"}
          </div>
          {hotel.scoreLabel && (
            <div className="text-xs text-muted-foreground">{hotel.scoreLabel}</div>
          )}
        </TableCell>
        <TableCell className="text-right">
          <span className="font-semibold text-rose-600 tabular-nums dark:text-rose-400">
            ¥{hotel.currentPrice}
          </span>
        </TableCell>
        <TableCell className="text-right text-muted-foreground line-through tabular-nums">
          {hotel.originalPrice ? `¥${hotel.originalPrice}` : "—"}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {hotel.consumptionCount ?? "—"}
        </TableCell>
        <TableCell className="max-w-[200px]">
          <span className="line-clamp-1 text-xs text-muted-foreground">
            {hotel.locationDesc ?? hotel.address ?? "—"}
          </span>
        </TableCell>
        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
          {fmtTime(hotel.crawlTime)}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell />
          <TableCell colSpan={9}>
            <div className="grid gap-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="详细地址" value={hotel.address ?? "—"} />
              <DetailItem label="开业 / 装修" value={`${hotel.openYear ?? "—"} · ${hotel.decorateYear ?? "—"}`} />
              <DetailItem label="星级" value={hotel.starLevel ?? "—"} />
              <DetailItem label="评论数" value={`${hotel.commentCount.toLocaleString()} 条`} />
              <DetailItem label="图片数" value={`${hotel.imageCount} 张`} />
              <DetailItem label="预订状态" value={hotel.bookingStatus ?? "—"} />
              <DetailItem label="入住日期" value={`${hotel.checkinDate ?? "—"} → ${hotel.checkoutDate ?? "—"}`} />
              <DetailItem label="搜索关键词" value={hotel.searchKeyword ?? "—"} />
              <DetailItem label="评价语" value={hotel.reviewQuote ?? "—"} />

              <div className="sm:col-span-2 lg:col-span-3">
                <div className="mb-1 text-xs font-medium text-muted-foreground">设施</div>
                <div className="flex flex-wrap gap-1.5">
                  {hotel.facilities.length > 0 ? (
                    hotel.facilities.map((f) => (
                      <Badge
                        key={f}
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        {f}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">无</span>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <div className="mb-1 text-xs font-medium text-muted-foreground">促销</div>
                <div className="flex flex-wrap gap-1.5">
                  {hotel.promotions.length > 0 ? (
                    hotel.promotions.map((p) => (
                      <Badge
                        key={p}
                        variant="outline"
                        className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                      >
                        {p}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">无</span>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <div className="mb-1 text-xs font-medium text-muted-foreground">附近 POI</div>
                <div className="flex flex-wrap gap-1.5">
                  {hotel.nearbyPois.length > 0 ? (
                    hotel.nearbyPois.map((p) => (
                      <Badge
                        key={p}
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                      >
                        <MapPin className="size-3" />
                        {p}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">无</span>
                  )}
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm text-foreground">{value}</div>
    </div>
  );
}
