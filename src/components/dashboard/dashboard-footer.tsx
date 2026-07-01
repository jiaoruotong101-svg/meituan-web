export function DashboardFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card/40">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <div>
          学术研究用途 · 数据采集遵循低频访问原则 · © 2025
        </div>
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          <span>Next.js 16 · Prisma · SQLite · recharts</span>
        </div>
      </div>
    </footer>
  );
}
