"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { StatsResponse } from "@/lib/dashboard";

const cityChartConfig = {
  count: { label: "酒店数量", color: "var(--chart-1)" },
} satisfies ChartConfig;

const trendChartConfig = {
  count: { label: "当日爬取", color: "var(--chart-2)" },
} satisfies ChartConfig;

const priceChartConfig = {
  count: { label: "酒店数", color: "var(--chart-3)" },
} satisfies ChartConfig;

const PRICE_COLORS = [
  "var(--chart-2)",
  "var(--chart-1)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function OverviewTab({ stats }: { stats: StatsResponse | null }) {
  if (!stats) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  const cityData = stats.cityCounts
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Bar chart: per-city counts */}
      <Card className="p-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">各城市酒店数量</CardTitle>
          <CardDescription>累计入库酒店数（按城市分布）</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {cityData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ChartContainer
              config={cityChartConfig}
              className="aspect-[16/9] w-full"
            >
              <BarChart data={cityData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="city"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={36}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]}>
                  {cityData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? "var(--chart-1)" : "var(--chart-1)"}
                      fillOpacity={1 - (i % 4) * 0.15}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Line chart: 7-day trend */}
      <Card className="p-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">近 7 天爬取趋势</CardTitle>
          <CardDescription>每日新增酒店数据量</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ChartContainer
            config={trendChartConfig}
            className="aspect-[16/9] w-full"
          >
            <LineChart
              data={stats.dailyTrend}
              margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={36}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--color-count)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "var(--color-count)" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Pie chart: price distribution */}
      <Card className="p-0 lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">价格区间分布</CardTitle>
          <CardDescription>
            全量酒店按现价划分的分布占比（单位：元）
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ChartContainer
            config={priceChartConfig}
            className="aspect-[16/7] w-full"
          >
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={stats.priceDistribution}
                dataKey="count"
                nameKey="range"
                innerRadius="50%"
                outerRadius="80%"
                paddingAngle={2}
              >
                {stats.priceDistribution.map((_, i) => (
                  <Cell key={i} fill={PRICE_COLORS[i % PRICE_COLORS.length]} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="range" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="grid aspect-[16/9] place-items-center text-sm text-muted-foreground">
      暂无数据
    </div>
  );
}
