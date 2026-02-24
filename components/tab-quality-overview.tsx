"use client";

import { useState, useEffect, useRef } from "react";
import type { Instructor } from "@/lib/types";
import { computeScores } from "@/lib/analysis-engine";
import { FileText, BarChart3 } from "lucide-react";

interface TabQualityOverviewProps {
  instructor: Instructor;
  platformName: string;
}

export function TabQualityOverview({ instructor, platformName }: TabQualityOverviewProps) {
  const memoKey = `memo-quality-${platformName}-${instructor.name}`;
  const [memo, setMemo] = useState("");
  const memoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setMemo(localStorage.getItem(memoKey) || "");
  }, [memoKey]);
  const handleMemoChange = (value: string) => {
    setMemo(value);
    if (memoSaveRef.current) clearTimeout(memoSaveRef.current);
    memoSaveRef.current = setTimeout(() => {
      if (typeof window !== "undefined") localStorage.setItem(memoKey, value);
    }, 400);
  };

  const rows = instructor.cohorts.map((c) => {
    const scores = computeScores(c.postResponses);
    const preN = c.preResponses.length;
    const postN = c.postResponses.length;
    const responseRate = preN > 0 ? Math.round((postN / preN) * 100) : 0;
    return {
      label: c.label,
      preN,
      postN,
      responseRate,
      ps1: scores.ps1Avg,
      ps2: scores.ps2Avg,
      recRate: scores.recRate,
    };
  });

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" />
        <span className="text-[16px] font-extrabold">강의 품질 요약</span>
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
                <th className="text-right py-2.5 px-3 font-semibold">응답률</th>
                <th className="text-right py-2.5 px-3 font-semibold">커리큘럼</th>
                <th className="text-right py-2.5 px-3 font-semibold">피드백</th>
                <th className="text-right py-2.5 px-3 font-semibold">추천률</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 px-3 font-medium">{r.label}</td>
                  <td className="text-right py-2 px-3 text-muted-foreground">{r.preN}명</td>
                  <td className="text-right py-2 px-3 text-muted-foreground">{r.postN}명</td>
                  <td className="text-right py-2 px-3">{r.responseRate}%</td>
                  <td className="text-right py-2 px-3">{r.ps1 > 0 ? r.ps1.toFixed(1) : "—"}</td>
                  <td className="text-right py-2 px-3">{r.ps2 > 0 ? r.ps2.toFixed(1) : "—"}</td>
                  <td className="text-right py-2 px-3">{r.recRate > 0 ? `${r.recRate}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 메모: 다음 기수 개선 포인트 등 */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-[13px] font-semibold">메모</span>
          <span className="text-[11px] text-muted-foreground">(자동 저장)</span>
        </div>
        <textarea
          value={memo}
          onChange={(e) => handleMemoChange(e.target.value)}
          placeholder="다음 기수 개선 포인트, 반복 불만 대응 계획, 강의 품질 관련 메모 등"
          className="w-full min-h-[80px] py-2 px-3 rounded-lg border text-[13px] bg-background resize-y"
          rows={4}
        />
      </div>
    </div>
  );
}
