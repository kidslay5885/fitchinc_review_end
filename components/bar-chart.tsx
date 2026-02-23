"use client";

import { cn } from "@/lib/utils";

interface BarChartProps {
  data: { label: string; value: number }[];
  color?: string;
  suffix?: string;
  maxOverride?: number;
}

export function BarChart({ data, color = "#3451B2", suffix = "", maxOverride }: BarChartProps) {
  const max = maxOverride || Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex flex-col gap-1.5">
      {data.map((item) => {
        const pct = Math.max((item.value / max) * 100, 1.5);
        return (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground w-[120px] shrink-0 text-right truncate">
              {item.label}
            </span>
            <div className="flex-1 h-[7px] bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-400"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <span className="text-[13px] font-semibold w-[44px] text-right">
              {item.value}
              {suffix}
            </span>
          </div>
        );
      })}
    </div>
  );
}
