"use client";

import type { Instructor, Course } from "@/lib/types";
import { allCohorts } from "@/lib/types";
import { computeScores } from "@/lib/analysis-engine";
import { getOrderedCohorts } from "@/lib/cohort-order";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart3 } from "lucide-react";

interface TabQualityOverviewProps {
  instructor: Instructor;
  course: Course | null;
  platformName: string;
}

export function TabQualityOverview({ instructor, course, platformName }: TabQualityOverviewProps) {
  const visibleCohorts = course ? course.cohorts : allCohorts(instructor);
  const ordered = getOrderedCohorts(platformName, instructor.name, course?.name || "", visibleCohorts);
  const rows = ordered.map((c) => {
    const scores = computeScores(c.postResponses);
    const preN = c.preResponses.length;
    const postN = c.postResponses.length;
    const totalStudents = c.totalStudents || 0;
    const postPreRate = preN > 0 ? Math.round((postN / preN) * 100) : 0;
    const overallRate = totalStudents > 0 ? Math.round((postN / totalStudents) * 100) : null;
    return {
      label: c.label,
      preN,
      postN,
      totalStudents,
      postPreRate,
      overallRate,
      ps1: scores.ps1Avg,
      ps2: scores.ps2Avg,
      recRate: scores.recRate,
    };
  });

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        <span className="text-[16px] font-extrabold">전체 요약</span>
      </div>
      <p className="text-[13px] text-muted-foreground">
        기수별로 만족도·응답률을 한눈에 보고, 다음 기수 개선 포인트를 메모해두세요.
      </p>

      {/* 기수별 요약 테이블 */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left py-2.5 px-3 font-semibold">기수</th>
                <th className="text-right py-2.5 px-3 font-semibold">사전</th>
                <th className="text-right py-2.5 px-3 font-semibold">후기</th>
                <th className="text-right py-2.5 px-3 font-semibold" title="수강생 수 기준">전체 응답률</th>
                <th className="text-right py-2.5 px-3 font-semibold">
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <span className="cursor-help border-b border-dotted border-muted-foreground">커리큘럼</span>
                    </TooltipTrigger>
                    <TooltipContent>후기 설문의 커리큘럼 만족도 평균 점수 (10점 만점)</TooltipContent>
                  </Tooltip>
                </th>
                <th className="text-right py-2.5 px-3 font-semibold">
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <span className="cursor-help border-b border-dotted border-muted-foreground">피드백</span>
                    </TooltipTrigger>
                    <TooltipContent>후기 설문의 강사 피드백 만족도 평균 점수 (10점 만점)</TooltipContent>
                  </Tooltip>
                </th>
                <th className="text-right py-2.5 px-3 font-semibold">추천률</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 px-3 font-medium">{r.label}</td>
                  <td className="text-right py-2 px-3 text-muted-foreground">{r.preN}명</td>
                  <td className="text-right py-2 px-3 text-muted-foreground">{r.postN}명</td>
                  <td className="text-right py-2 px-3" title={r.totalStudents > 0 ? `후기 ${r.postN}명 / 수강생 ${r.totalStudents}명` : "수강생 수 입력 시 표시"}>
                    {r.overallRate != null ? `${r.overallRate}%` : (r.postPreRate > 0 ? `${r.postPreRate}%(후기/사전)` : "—")}
                  </td>
                  <td className="text-right py-2 px-3">
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{r.ps1 > 0 ? r.ps1.toFixed(1) : "—"}</span>
                      </TooltipTrigger>
                      <TooltipContent>후기 설문의 커리큘럼 만족도 평균 점수 (10점 만점)</TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="text-right py-2 px-3">
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">{r.ps2 > 0 ? r.ps2.toFixed(1) : "—"}</span>
                      </TooltipTrigger>
                      <TooltipContent>후기 설문의 강사 피드백 만족도 평균 점수 (10점 만점)</TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="text-right py-2 px-3">{r.recRate > 0 ? `${r.recRate}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
