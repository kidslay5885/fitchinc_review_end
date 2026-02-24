"use client";

import { useState, useEffect } from "react";
import type { Instructor, Cohort } from "@/lib/types";
import { computeScores } from "@/lib/analysis-engine";
import { RingScore } from "./ring-score";
import { User, X } from "lucide-react";

interface InstructorHeroProps {
  platformName: string;
  instructor: Instructor;
  cohort: Cohort | null;
  onUpdateCohort?: (cohort: Cohort) => void;
}

const TOTAL_STUDENTS_KEY = (platform: string, instructor: string, cohortLabel: string | null) =>
  `total-students-${platform}-${instructor}-${cohortLabel ?? "all"}`;

export function InstructorHero({ platformName, instructor, cohort, onUpdateCohort }: InstructorHeroProps) {
  const [totalInput, setTotalInput] = useState("");
  const storageKey = TOTAL_STUDENTS_KEY(platformName, instructor.name, cohort?.label ?? null);

  useEffect(() => {
    if (cohort) {
      setTotalInput(cohort.totalStudents ? String(cohort.totalStudents) : "");
      return;
    }
    // 전체 보기: 기수별 수강생 합으로 자동 반영, 없으면 localStorage
    const sum = instructor.cohorts.reduce((a, c) => a + (c.totalStudents || 0), 0);
    if (sum > 0) {
      setTotalInput(String(sum));
      return;
    }
    if (typeof window === "undefined") return;
    const v = localStorage.getItem(storageKey);
    setTotalInput(v && /^\d+$/.test(v) ? v : "");
  }, [cohort?.id, cohort?.totalStudents, cohort, storageKey, instructor.cohorts]);

  // Aggregate responses
  const preResponses = cohort
    ? cohort.preResponses
    : instructor.cohorts.flatMap((c) => c.preResponses);
  const postResponses = cohort
    ? cohort.postResponses
    : instructor.cohorts.flatMap((c) => c.postResponses);

  const scores = computeScores(postResponses);
  const currentPM = cohort?.pm || instructor.cohorts[0]?.pm || "-";
  const hasData = preResponses.length > 0 || postResponses.length > 0;
  const [photoOpen, setPhotoOpen] = useState(false);

  return (
    <div className="bg-card rounded-xl border p-4 px-5 mb-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            {platformName} · {instructor.category}
          </div>
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => instructor.photo && setPhotoOpen(true)}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-border/50 ${instructor.photo ? "cursor-pointer hover:ring-primary/50 transition-shadow" : ""}`}
            >
              {instructor.photo ? (
                <img src={instructor.photo} alt={instructor.name} className="w-full h-full object-contain" style={{ objectPosition: instructor.photoPosition || "center top" }} />
              ) : (
                <User className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
              )}
            </button>
            <div className="text-[22px] font-extrabold">
              {instructor.name}{" "}
              <span className="font-normal text-muted-foreground text-[16px]">
                · {!cohort ? "전체" : cohort.label}
              </span>
            </div>
          </div>
          <div className="text-[13px] text-muted-foreground mt-1.5">
            담당PM {currentPM}
            {cohort && cohort.date ? ` · ${cohort.date} ~ ${cohort.endDate}` : ""}
          </div>
        </div>

        {hasData && (
          <div className="flex gap-5 items-center">
            {postResponses.length > 0 && (
              <>
                <div className="flex gap-2 items-center">
                  <RingScore score={scores.ps1Avg} label="커리큘럼" max={10} excluded={scores.ps1Excluded} />
                  <RingScore score={scores.ps2Avg} label="피드백" max={10} excluded={scores.ps2Excluded} />
                </div>
                <div className="border-l pl-4 text-[14px] text-muted-foreground leading-relaxed space-y-0.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="text-muted-foreground shrink-0">전체 수강생</label>
                    <input
                      type="number"
                      min={0}
                      value={totalInput}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTotalInput(v);
                        const n = parseInt(v, 10);
                        if (cohort && onUpdateCohort && !isNaN(n) && n >= 0)
                          onUpdateCohort({ ...cohort, totalStudents: n });
                        if (!cohort && typeof window !== "undefined" && !isNaN(n) && n >= 0)
                          localStorage.setItem(storageKey, String(n));
                      }}
                      onBlur={() => {
                        const n = parseInt(totalInput, 10);
                        if (cohort && (isNaN(n) || n < 0)) setTotalInput(cohort.totalStudents ? String(cohort.totalStudents) : "");
                        if (!cohort && (isNaN(n) || n < 0)) {
                          const sum = instructor.cohorts.reduce((a, c) => a + (c.totalStudents || 0), 0);
                          setTotalInput(sum > 0 ? String(sum) : (typeof window !== "undefined" ? localStorage.getItem(storageKey) || "" : ""));
                        }
                      }}
                      placeholder="명"
                      className="w-16 py-0.5 px-1.5 rounded border text-[13px] bg-card text-foreground"
                    />
                    <span className="text-muted-foreground">명</span>
                  </div>
                  {(() => {
                    const total = parseInt(totalInput, 10) || 0;
                    const prePct = total > 0 ? Math.round((preResponses.length / total) * 100) : 0;
                    const postPct = total > 0 ? Math.round((postResponses.length / total) * 100) : 0;
                    return total > 0 ? (
                      <div className="text-[12px] text-muted-foreground mb-0.5">
                        참여 비율 사전 <strong className="text-foreground">{prePct}%</strong>
                        {" · "}
                        후기 <strong className="text-foreground">{postPct}%</strong>
                      </div>
                    ) : null;
                  })()}
                  <div>
                    사전 설문 <strong className="text-foreground">{preResponses.length}</strong>명
                  </div>
                  <div>
                    후기 설문{" "}
                    <strong className={postResponses.length < preResponses.length / 3 ? "text-amber-600" : "text-foreground"}>
                      {postResponses.length}
                    </strong>
                    명
                  </div>
                  {scores.recRate > 0 && (
                    <div title="후기 설문의 추천 의향 문항(pRec) 응답 기준">
                      추천률 <strong className="text-emerald-600">{scores.recRate}%</strong>
                      <span className="text-[11px] text-muted-foreground/90 ml-1">(후기 설문 추천 의향 문항 기준)</span>
                    </div>
                  )}
                </div>
              </>
            )}
            {postResponses.length === 0 && preResponses.length > 0 && (
              <div className="text-[13px] text-muted-foreground">
                사전 설문 <strong className="text-foreground">{preResponses.length}</strong>명 응답
              </div>
            )}
          </div>
        )}
      </div>

      {photoOpen && instructor.photo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPhotoOpen(false)}
          role="dialog"
          aria-label="강사 사진 확대"
        >
          <button
            type="button"
            onClick={() => setPhotoOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={instructor.photo}
            alt={instructor.name}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
