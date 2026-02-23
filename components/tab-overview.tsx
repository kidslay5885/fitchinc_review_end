"use client";

import type { Instructor, Cohort, SurveyResponse } from "@/lib/types";
import { computeDemographics, getTopStats } from "@/lib/analysis-engine";
import { StatCard } from "./stat-card";
import { BarChart } from "./bar-chart";

interface TabOverviewProps {
  instructor: Instructor;
  cohort: Cohort | null;
}

export function TabOverview({ instructor, cohort }: TabOverviewProps) {
  const preResponses = cohort
    ? cohort.preResponses
    : instructor.cohorts.flatMap((c) => c.preResponses);

  if (preResponses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="text-[30px] opacity-25 mb-2">📊</div>
        <div className="text-[14px] font-bold">데이터가 없습니다</div>
        <div className="text-[13px] mt-1">사전 설문 파일을 업로드하면 인구통계가 표시됩니다</div>
      </div>
    );
  }

  const stats = computeDemographics(preResponses);
  const topStats = getTopStats(preResponses);

  const sortedEntries = (obj: Record<string, number>) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));

  return (
    <div className="grid gap-4">
      {/* Top stat cards */}
      {topStats.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {topStats.map((s, i) => (
            <StatCard key={i} label={s.label} desc={s.desc} num={s.num} src={s.src} />
          ))}
        </div>
      )}

      {/* Demographics charts */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <div className="text-[14px] font-bold mb-3">성별</div>
          <BarChart
            data={sortedEntries(stats.gender)}
            color="#8B5CF6"
            suffix="명"
          />
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-[14px] font-bold mb-3">연령대</div>
          <BarChart
            data={sortedEntries(stats.age)}
            color="#3451B2"
            suffix="명"
          />
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-[14px] font-bold mb-3">직업</div>
          <BarChart
            data={sortedEntries(stats.job)}
            color="#1A8754"
            suffix="명"
          />
        </div>
      </div>

      {/* Computer & Goal */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="text-[14px] font-bold">컴퓨터 활용도</div>
            <span className="text-[12px] text-muted-foreground">
              평균 <strong className="text-foreground">{stats.computer.avg}</strong>/10
            </span>
          </div>
          <div className="flex items-end gap-1 h-[60px]">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((k) => {
              const v = stats.computer.distribution[k] || 0;
              const maxVal = Math.max(...Object.values(stats.computer.distribution), 1);
              return (
                <div key={k} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground">{v || ""}</span>
                  <div
                    className="w-full rounded-sm"
                    style={{
                      height: Math.max((v / maxVal) * 46, 2),
                      background: k <= 4 ? "#C13838" : k <= 6 ? "#B45309" : "#1A8754",
                      opacity: 0.6,
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">{k}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-card rounded-xl border p-4">
          <div className="text-[14px] font-bold mb-3">목표 수익</div>
          <BarChart
            data={sortedEntries(stats.goal)}
            color="#1A8754"
            suffix="명"
          />
        </div>
      </div>
    </div>
  );
}
