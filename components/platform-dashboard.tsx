"use client";

import type { Platform } from "@/lib/types";
import { autoStatus, statusBg, cohortAvgScore } from "@/lib/types";
import { aggregateInstructor, computeScores } from "@/lib/analysis-engine";
import { User } from "lucide-react";

interface PlatformDashboardProps {
  platform: Platform;
  onSelectInstructor: (id: string) => void;
}

export function PlatformDashboard({ platform, onSelectInstructor }: PlatformDashboardProps) {
  const totalSurvey = platform.instructors.reduce(
    (a, i) => a + i.cohorts.reduce((b, c) => b + c.preResponses.length, 0),
    0
  );

  const doneCohorts = platform.instructors
    .flatMap((i) => i.cohorts)
    .filter((c) => c.postResponses.length > 0);

  const allScores = doneCohorts.map((c) => cohortAvgScore(c)).filter((s) => s > 0);
  const avg = allScores.length > 0 ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1) : "-";

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/3 to-purple-500/2 rounded-[14px] border p-6 mb-5">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-[22px] font-extrabold">{platform.name}</div>
            <div className="text-[13px] text-muted-foreground mt-1">
              강사 {platform.instructors.length}명 · 설문 참여 {totalSurvey}명 · 설문 완료{" "}
              {doneCohorts.length}기수
            </div>
          </div>
          <div className="text-center px-5 py-2.5 bg-card rounded-[10px] border">
            <div className="text-[11px] font-bold text-muted-foreground mb-0.5">강의 만족도 평균</div>
            <div className="text-[28px] font-extrabold leading-none">
              <span className={Number(avg) >= 9 ? "text-emerald-600" : "text-primary"}>{avg}</span>
              <span className="text-[13px] font-normal text-muted-foreground">/10</span>
            </div>
          </div>
        </div>
      </div>

      {/* Instructor grid */}
      <div className="text-[13px] font-bold text-muted-foreground mb-3">강사 목록</div>
      {platform.instructors.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="text-[30px] opacity-25 mb-2">📭</div>
          <div className="text-[14px] font-bold">아직 강사가 없습니다</div>
          <div className="text-[13px] mt-1">파일을 업로드하면 자동으로 추가됩니다</div>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3.5">
          {platform.instructors.map((inst) => {
            const { totalPre, avgScore } = aggregateInstructor(inst.cohorts);
            const last = inst.cohorts[inst.cohorts.length - 1];
            const lastStatus = last ? autoStatus(last) : "준비중";
            const ia = avgScore > 0 ? avgScore.toFixed(1) : "-";

            return (
              <div
                key={inst.id}
                onClick={() => onSelectInstructor(inst.id)}
                className="bg-card rounded-xl border p-5 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3.5 mb-3.5">
                  <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {inst.photo ? (
                      <img src={inst.photo} alt={inst.name} className="w-full h-full object-cover" style={{ objectPosition: inst.photoPosition || "center center" }} />
                    ) : (
                      <User className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-[15px] font-bold">{inst.name}</div>
                    <div className="text-[12px] text-muted-foreground">{inst.category}</div>
                  </div>
                  {ia !== "-" && (
                    <div className="text-center">
                      <div
                        className={`text-[20px] font-extrabold ${
                          Number(ia) >= 9 ? "text-emerald-600" : "text-primary"
                        }`}
                      >
                        {ia}
                      </div>
                      <div className="text-[10px] text-muted-foreground">만족도</div>
                    </div>
                  )}
                </div>
                <div className="flex gap-5 mb-3 pb-3 border-b">
                  <div>
                    <span className="text-[16px] font-bold">{inst.cohorts.length}</span>
                    <span className="text-[12px] text-muted-foreground">기</span>
                  </div>
                  <div>
                    <span className="text-[16px] font-bold">{totalPre}</span>
                    <span className="text-[12px] text-muted-foreground">명 참여</span>
                  </div>
                </div>
                {last && (
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${statusBg(lastStatus)}`}
                    >
                      {last.label} {lastStatus}
                    </span>
                    {last.pm && (
                      <span className="text-[11px] text-muted-foreground">담당PM {last.pm}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
