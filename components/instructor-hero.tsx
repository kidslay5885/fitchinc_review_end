"use client";

import { useState, useEffect, useRef } from "react";
import type { Instructor, Cohort, Course } from "@/lib/types";
import { allCohorts } from "@/lib/types";
import { computeScores } from "@/lib/analysis-engine";
import { RingScore } from "./ring-score";
import { User, X, Pencil } from "lucide-react";
import { toast } from "sonner";

interface InstructorHeroProps {
  platformName: string;
  instructor: Instructor;
  course: Course | null;
  cohort: Cohort | null;
  onUpdateCohort?: (cohort: Cohort) => void;
  readOnly?: boolean;
}

const TOTAL_STUDENTS_KEY = (platform: string, instructor: string, cohortLabel: string | null) =>
  `total-students-${platform}-${instructor}-${cohortLabel ?? "all"}`;

export function InstructorHero({ platformName, instructor, course, cohort, onUpdateCohort, readOnly }: InstructorHeroProps) {
  const [totalInput, setTotalInput] = useState("");
  const storageKey = TOTAL_STUDENTS_KEY(platformName, instructor.name, cohort?.label ?? null);

  // 인라인 편집 상태 (분류작업 모드 전용)
  const [editingPM, setEditingPM] = useState(false);
  const [pmDraft, setPmDraft] = useState("");
  const [editingStart, setEditingStart] = useState(false);
  const [startDraft, setStartDraft] = useState("");
  const [editingEnd, setEditingEnd] = useState(false);
  const [endDraft, setEndDraft] = useState("");
  const pmRef = useRef<HTMLInputElement>(null);

  const canEdit = !readOnly && !!cohort && !!onUpdateCohort;

  // 서버에 스케줄 변경 전송
  const saveScheduleToServer = (updates: { pm?: string; startDate?: string; endDate?: string }) => {
    const courseName = course?.name || "";
    fetch("/api/update-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: platformName,
        instructor: instructor.name,
        course: courseName,
        cohort: cohort?.label,
        ...updates,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error);
      })
      .catch((err) => {
        console.error("스케줄 저장 실패:", err);
        toast.error("서버 저장 실패");
      });
  };

  const commitPM = () => {
    const trimmed = pmDraft.trim();
    setEditingPM(false);
    if (!cohort || !onUpdateCohort || trimmed === (cohort.pm || "")) return;
    onUpdateCohort({ ...cohort, pm: trimmed });
    saveScheduleToServer({ pm: trimmed });
  };

  const commitStart = () => {
    setEditingStart(false);
    if (!cohort || !onUpdateCohort || startDraft === (cohort.date || "")) return;
    onUpdateCohort({ ...cohort, date: startDraft });
    saveScheduleToServer({ startDate: startDraft });
  };

  const commitEnd = () => {
    setEditingEnd(false);
    if (!cohort || !onUpdateCohort || endDraft === (cohort.endDate || "")) return;
    onUpdateCohort({ ...cohort, endDate: endDraft });
    saveScheduleToServer({ endDate: endDraft });
  };

  // 현재 보여줄 기수 목록: course가 선택되면 해당 course의 기수, 아니면 전체
  const visibleCohorts = course ? course.cohorts : allCohorts(instructor);

  useEffect(() => {
    if (cohort) {
      setTotalInput(cohort.totalStudents ? String(cohort.totalStudents) : "");
      return;
    }
    // 전체 보기: 기수별 수강생 합으로 자동 반영, 없으면 localStorage
    const sum = visibleCohorts.reduce((a, c) => a + (c.totalStudents || 0), 0);
    if (sum > 0) {
      setTotalInput(String(sum));
      return;
    }
    if (typeof window === "undefined") return;
    const v = localStorage.getItem(storageKey);
    setTotalInput(v && /^\d+$/.test(v) ? v : "");
  }, [cohort?.id, cohort?.totalStudents, cohort, storageKey, visibleCohorts]);

  // Aggregate responses
  const preResponses = cohort
    ? cohort.preResponses
    : visibleCohorts.flatMap((c) => c.preResponses);
  const postResponses = cohort
    ? cohort.postResponses
    : visibleCohorts.flatMap((c) => c.postResponses);

  const scores = computeScores(postResponses);
  const currentPM = cohort?.pm || visibleCohorts[0]?.pm || "-";
  const hasData = preResponses.length > 0 || postResponses.length > 0;
  const [photoOpen, setPhotoOpen] = useState(false);

  // 브레드크럼: 강사 · 강의명(2개+ 시) · 기수
  const showCourseName = course && instructor.courses.length > 1;

  return (
    <div className="bg-card rounded-xl border p-4 px-5 mb-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            {platformName} · {instructor.courses.length > 0
              ? instructor.courses.map((c) => c.name || "기본 과정").join(" · ")
              : instructor.category || "-"}
          </div>
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => instructor.photo && setPhotoOpen(true)}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-border/50 ${instructor.photo ? "cursor-pointer hover:ring-primary/50 transition-shadow" : ""}`}
            >
              {instructor.photo ? (
                <img src={instructor.photo} alt={instructor.name} className="w-full h-full object-contain" style={{ objectPosition: instructor.photoPosition || "center 2%" }} />
              ) : (
                <User className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
              )}
            </button>
            <div className="text-[22px] font-extrabold">
              {instructor.name}{" "}
              <span className="font-normal text-muted-foreground text-[16px]">
                {showCourseName && <>· {course.name || "기본 과정"} </>}
                · {!cohort ? "전체" : cohort.label}
              </span>
            </div>
          </div>
          {cohort && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* PM 태그 — 편집 가능 */}
              {canEdit && editingPM ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted/70 text-[11px]">
                  <span className="text-muted-foreground font-medium">PM</span>
                  <input
                    ref={pmRef}
                    autoFocus
                    value={pmDraft}
                    onChange={(e) => setPmDraft(e.target.value)}
                    onBlur={commitPM}
                    onKeyDown={(e) => { if (e.key === "Enter") commitPM(); if (e.key === "Escape") setEditingPM(false); }}
                    className="w-20 py-0 px-1 rounded border text-[11px] font-bold bg-card text-foreground"
                  />
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/70 text-[11px] ${canEdit ? "cursor-pointer hover:bg-muted transition-colors" : ""}`}
                  onClick={() => {
                    if (!canEdit) return;
                    setPmDraft(currentPM === "-" ? "" : currentPM);
                    setEditingPM(true);
                  }}
                >
                  <span className="text-muted-foreground font-medium">PM</span>
                  <span className="font-bold text-foreground">{currentPM}</span>
                  {canEdit && <Pencil className="w-2.5 h-2.5 text-muted-foreground/60" />}
                </span>
              )}

              {/* 강의 시청 기간 태그 — 편집 가능 */}
              {(cohort.date || canEdit) && (
                canEdit && (editingStart || editingEnd) ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted/70 text-[11px]">
                    <span className="text-muted-foreground font-medium">강의 시청 기간</span>
                    <input
                      type="date"
                      autoFocus={editingStart}
                      value={startDraft}
                      onChange={(e) => setStartDraft(e.target.value)}
                      onBlur={commitStart}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditingStart(false); }}
                      className="py-0 px-1 rounded border text-[11px] font-bold bg-card text-foreground"
                    />
                    <span className="text-muted-foreground">~</span>
                    <input
                      type="date"
                      autoFocus={editingEnd}
                      value={endDraft}
                      onChange={(e) => setEndDraft(e.target.value)}
                      onBlur={commitEnd}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditingEnd(false); }}
                      className="py-0 px-1 rounded border text-[11px] font-bold bg-card text-foreground"
                    />
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/70 text-[11px] ${canEdit ? "cursor-pointer hover:bg-muted transition-colors" : ""}`}
                    onClick={() => {
                      if (!canEdit) return;
                      setStartDraft(cohort.date || "");
                      setEndDraft(cohort.endDate || "");
                      setEditingStart(true);
                    }}
                  >
                    <span className="text-muted-foreground font-medium">강의 시청 기간</span>
                    {cohort.date ? (
                      <span className="font-bold text-foreground">
                        {cohort.date.replace(/-/g, ".")} ~ {cohort.endDate.replace(/-/g, ".")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">미설정</span>
                    )}
                    {canEdit && <Pencil className="w-2.5 h-2.5 text-muted-foreground/60" />}
                  </span>
                )
              )}
            </div>
          )}
        </div>

        {hasData && (
          <div className="flex gap-5 items-center">
            {postResponses.length > 0 && (
              <>
                <div className="flex gap-2 items-center">
                  <RingScore score={scores.ps1Avg} label="커리큘럼" max={10} excluded={scores.ps1Excluded} title="후기 설문의 '커리큘럼 만족도' 점수를 10점 만점으로 환산한 평균값입니다." />
                  <RingScore score={scores.ps2Avg} label="피드백" max={10} excluded={scores.ps2Excluded} title="후기 설문의 '피드백 만족도' 점수를 10점 만점으로 환산한 평균값입니다." />
                </div>
                <div className="border-l pl-4 text-[14px] text-muted-foreground leading-relaxed space-y-0.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <label className="text-muted-foreground shrink-0">전체 수강생</label>
                    {readOnly ? (
                      <span className="text-[13px] font-semibold text-foreground">{totalInput || "-"}</span>
                    ) : (
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
                            const sum = visibleCohorts.reduce((a, c) => a + (c.totalStudents || 0), 0);
                            setTotalInput(sum > 0 ? String(sum) : (typeof window !== "undefined" ? localStorage.getItem(storageKey) || "" : ""));
                          }
                        }}
                        placeholder="명"
                        className="w-16 py-0.5 px-1.5 rounded border text-[13px] bg-card text-foreground"
                      />
                    )}
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
                    <div title="후기 설문 '이 강의를 지인분들께 추천하실 것 같으신가요?' 문항에서 긍정 응답을 한 비율입니다.">
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
