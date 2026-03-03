"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  classifyMode?: boolean;
}

const TOTAL_STUDENTS_KEY = (platform: string, instructor: string, cohortLabel: string | null) =>
  `total-students-${platform}-${instructor}-${cohortLabel ?? "all"}`;

export function InstructorHero({ platformName, instructor, course, cohort, onUpdateCohort, readOnly, classifyMode }: InstructorHeroProps) {
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

  // 기수별 스케줄 저장 (전체 테이블용)
  const saveScheduleForCohort = (targetCohort: Cohort, updates: { pm?: string; startDate?: string; endDate?: string }) => {
    const ownerCourse = (instructor.courses || []).find(c => (c.cohorts || []).some(co => co.id === targetCohort.id));
    fetch("/api/update-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform: platformName,
        instructor: instructor.name,
        course: ownerCourse?.name || "",
        cohort: targetCohort.label,
        ...updates,
      }),
    })
      .then(r => r.json())
      .then(d => { if (!d.ok) throw new Error(d.error); })
      .catch(err => {
        console.error("스케줄 저장 실패:", err);
        toast.error("서버 저장 실패");
      });
  };

  const origRef = useRef<Record<string, string>>({});

  // 설문 없음 토글 로딩 상태
  const [togglingCells, setTogglingCells] = useState<Set<string>>(new Set());

  const toggleSurveyMark = useCallback(async (
    targetCohort: Cohort,
    surveyType: "사전" | "후기",
  ) => {
    if (!onUpdateCohort) return;

    const isSurveyExists = surveyType === "사전" ? targetCohort.hasPreSurvey : targetCohort.hasPostSurvey;
    const responseCount = surveyType === "사전"
      ? (targetCohort.preResponses.length || (targetCohort.preCount || 0))
      : (targetCohort.postResponses.length || (targetCohort.postCount || 0));

    // 실제 응답이 있으면 토글 불가
    if (responseCount > 0) return;

    const cellKey = `${targetCohort.id}-${surveyType}`;
    setTogglingCells(prev => new Set(prev).add(cellKey));

    try {
      const ownerCourse = (instructor.courses || []).find(c => (c.cohorts || []).some(co => co.id === targetCohort.id));
      const payload = {
        platform: platformName,
        instructor: instructor.name,
        course: ownerCourse?.name || "",
        cohort: targetCohort.label,
        surveyType,
      };

      if (isSurveyExists) {
        // 플레이스홀더 삭제 → 회색으로 복원
        const res = await fetch("/api/mark-no-data", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const updated = { ...targetCohort };
        if (surveyType === "사전") updated.hasPreSurvey = false;
        else updated.hasPostSurvey = false;
        onUpdateCohort(updated);
        toast.success(`${targetCohort.label} ${surveyType} → 미등록으로 복원`);
      } else {
        // 플레이스홀더 생성 → 노란 "없음"으로 전환
        const res = await fetch("/api/mark-no-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        const updated = { ...targetCohort };
        if (surveyType === "사전") updated.hasPreSurvey = true;
        else updated.hasPostSurvey = true;
        onUpdateCohort(updated);
        toast.success(`${targetCohort.label} ${surveyType} → "없음" 표시`);
      }
    } catch (err) {
      console.error("설문 표시 토글 실패:", err);
      toast.error("설문 표시 변경 실패");
    } finally {
      setTogglingCells(prev => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    }
  }, [instructor, platformName, onUpdateCohort]);

  // 현재 보여줄 기수 목록: course가 선택되면 해당 course의 기수, 아니면 전체 (숫자 정렬)
  const visibleCohorts = useMemo(() => {
    const cohorts = course ? (course.cohorts || []) : allCohorts(instructor);
    return [...cohorts].sort((a, b) => {
      const numA = parseInt((a.label || "").replace(/\D/g, "")) || 0;
      const numB = parseInt((b.label || "").replace(/\D/g, "")) || 0;
      return numA - numB;
    });
  }, [course, instructor]);

  // 기수 → 소속 강의명 매핑 (전체 보기에서 강의명 구분용)
  const cohortCourseMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of (instructor.courses || [])) {
      for (const co of (c.cohorts || [])) {
        map.set(co.id, c.name);
      }
    }
    return map;
  }, [instructor]);
  const showCourseInTable = !course && (instructor.courses || []).length > 1;

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
    ? (Array.isArray(cohort.preResponses) ? cohort.preResponses : [])
    : visibleCohorts.flatMap((c) => Array.isArray(c.preResponses) ? c.preResponses : []);
  const postResponses = cohort
    ? (Array.isArray(cohort.postResponses) ? cohort.postResponses : [])
    : visibleCohorts.flatMap((c) => Array.isArray(c.postResponses) ? c.postResponses : []);

  const scores = computeScores(postResponses);
  const currentPM = cohort?.pm || visibleCohorts[0]?.pm || "-";
  const hasData = preResponses.length > 0 || postResponses.length > 0;
  const [photoOpen, setPhotoOpen] = useState(false);

  // 브레드크럼: 강사 · 강의명(2개+ 시) · 기수
  const courses = instructor.courses || [];
  const showCourseName = course && courses.length > 1;

  // 브레드크럼 인라인 편집 (classify 모드) — 강의별 개별 편집 지원
  const [editingCourseIdx, setEditingCourseIdx] = useState<number | null>(null);
  const [editingCategory, setEditingCategory] = useState(false);
  const [breadcrumbDraft, setBreadcrumbDraft] = useState("");
  const hasCourses = courses.length > 0;

  const commitCourseRename = (idx: number) => {
    setEditingCourseIdx(null);
    const trimmed = breadcrumbDraft.trim();
    const oldName = courses[idx]?.name || "";
    if (trimmed === oldName) return;
    fetch("/api/rename-course", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: platformName, instructor: instructor.name, oldCourse: oldName, newCourse: trimmed }),
    })
      .then(r => r.json())
      .then(d => { if (!d) throw new Error(); toast.success("강의명 저장 완료"); })
      .catch(() => toast.error("강의명 저장 실패"));
  };

  const commitCategory = () => {
    setEditingCategory(false);
    const trimmed = breadcrumbDraft.trim();
    if (trimmed === (instructor.category || "")) return;
    const payload = { photo: instructor.photo || "", photoPosition: instructor.photoPosition || "center 2%", category: trimmed };
    try { localStorage.setItem(`instructor-photo-${platformName}-${instructor.name}`, JSON.stringify(payload)); } catch {}
    fetch("/api/app-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "instructor_photo", platform: platformName, instructor: instructor.name, ...payload }),
    })
      .then(r => r.json())
      .then(d => { if (!d.ok) throw new Error(); toast.success("카테고리 저장 완료"); })
      .catch(() => toast.error("카테고리 저장 실패"));
  };

  return (
    <div className="bg-card rounded-xl border p-4 px-5 mb-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-[12px] font-extrabold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            {platformName} ·{" "}
            {hasCourses ? (
              courses.map((c, idx) => (
                <span key={idx}>
                  {idx > 0 && <span className="mx-0.5">·</span>}
                  {classifyMode && editingCourseIdx === idx ? (
                    <input
                      autoFocus
                      value={breadcrumbDraft}
                      onChange={(e) => setBreadcrumbDraft(e.target.value)}
                      onBlur={() => commitCourseRename(idx)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitCourseRename(idx); if (e.key === "Escape") setEditingCourseIdx(null); }}
                      className="py-0 px-1.5 rounded border text-[12px] font-extrabold bg-card text-foreground w-[140px]"
                    />
                  ) : (
                    <span
                      className={classifyMode ? "cursor-pointer hover:text-primary transition-colors" : ""}
                      onClick={() => {
                        if (!classifyMode) return;
                        setBreadcrumbDraft(c.name || "");
                        setEditingCourseIdx(idx);
                      }}
                      title={classifyMode ? "클릭하여 강의명 수정" : undefined}
                    >
                      {c.name}
                      {classifyMode && <Pencil className="w-2.5 h-2.5 inline ml-0.5 opacity-40" />}
                    </span>
                  )}
                </span>
              ))
            ) : (
              classifyMode && editingCategory ? (
                <input
                  autoFocus
                  value={breadcrumbDraft}
                  onChange={(e) => setBreadcrumbDraft(e.target.value)}
                  onBlur={commitCategory}
                  onKeyDown={(e) => { if (e.key === "Enter") commitCategory(); if (e.key === "Escape") setEditingCategory(false); }}
                  className="py-0 px-1.5 rounded border text-[12px] font-extrabold bg-card text-foreground w-[200px]"
                />
              ) : (
                <span
                  className={classifyMode ? "cursor-pointer hover:text-primary transition-colors" : ""}
                  onClick={() => {
                    if (!classifyMode) return;
                    setBreadcrumbDraft(instructor.category || "");
                    setEditingCategory(true);
                  }}
                  title={classifyMode ? "클릭하여 수정" : undefined}
                >
                  {instructor.category || "-"}
                  {classifyMode && <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-40" />}
                </span>
              )
            )}
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
                {showCourseName && <>· {course.name} </>}
                · {!cohort ? "전체" : String(cohort.label || "")}
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
                  <span className="font-bold text-foreground">{String(currentPM)}</span>
                  {canEdit && <Pencil className="w-2.5 h-2.5 text-muted-foreground/60" />}
                </span>
              )}

              {/* 정규 강의 기간 태그 — 편집 가능 */}
              {(cohort.date || canEdit) && (
                canEdit && (editingStart || editingEnd) ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted/70 text-[11px]">
                    <span className="text-muted-foreground font-medium">정규 강의 기간</span>
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
                      setEditingEnd(true);
                    }}
                  >
                    <span className="text-muted-foreground font-medium">정규 강의 기간</span>
                    {cohort.date ? (
                      <span className="font-bold text-foreground">
                        {(cohort.date || "").slice(2).replace(/-/g, ".")} ~ {(cohort.endDate || "").slice(2).replace(/-/g, ".")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">미설정</span>
                    )}
                    {canEdit && <Pencil className="w-2.5 h-2.5 text-muted-foreground/60" />}
                  </span>
                )
              )}

              {/* 수강생 태그 — classify 전용 */}
              {classifyMode && onUpdateCohort && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted/70 text-[11px]">
                  <span className="text-muted-foreground font-medium">수강생</span>
                  <input
                    type="number"
                    min={0}
                    value={totalInput}
                    onChange={(e) => {
                      setTotalInput(e.target.value);
                      const n = parseInt(e.target.value, 10);
                      if (cohort && !isNaN(n) && n >= 0 && onUpdateCohort)
                        onUpdateCohort({ ...cohort, totalStudents: n });
                    }}
                    className="w-14 py-0 px-1 rounded border text-[11px] font-bold bg-card text-foreground"
                    placeholder="0"
                  />
                  <span className="text-muted-foreground font-medium">명</span>
                </span>
              )}
            </div>
          )}
        </div>

        {hasData && !classifyMode && (
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
                    <div className="cursor-help" title="후기 설문 '이 강의를 지인분들께 추천하실 것 같으신가요?' 문항에서 긍정 응답을 한 비율입니다.">
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

        {hasData && classifyMode && (
          <div className="text-[13px] text-muted-foreground leading-relaxed text-right shrink-0">
            {!cohort && <div className="font-semibold text-foreground mb-0.5">{visibleCohorts.length}개 기수</div>}
            <div>
              사전 <strong className="text-foreground">{preResponses.length}</strong>명
              {" · "}후기 <strong className="text-foreground">{postResponses.length}</strong>명
            </div>
          </div>
        )}
      </div>

      {/* Classify 전체 기수 관리 테이블 */}
      {classifyMode && !cohort && onUpdateCohort && visibleCohorts.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[11px] text-muted-foreground font-bold border-b">
                {showCourseInTable && <th className="py-1.5 px-1.5 text-left">강의</th>}
                <th className="py-1.5 px-1.5 text-left">기수</th>
                <th className="py-1.5 px-1.5 text-left">PM</th>
                <th className="py-1.5 px-1.5 text-left">시작일</th>
                <th className="py-1.5 px-1.5 text-left">종료일</th>
                <th className="py-1.5 px-1.5 text-left">수강생</th>
                <th className="py-1.5 px-1.5 text-center">사전</th>
                <th className="py-1.5 px-1.5 text-center">후기</th>
              </tr>
            </thead>
            <tbody>
              {visibleCohorts.map(c => (
                <tr key={c.id} className="border-b last:border-0">
                  {showCourseInTable && (
                    <td className="py-1 px-1.5 text-[11px] text-muted-foreground max-w-[120px] truncate" title={cohortCourseMap.get(c.id) || ""}>
                      {cohortCourseMap.get(c.id) || ""}
                    </td>
                  )}
                  <td className="py-1 px-1.5 font-semibold">{String(c.label || "")}</td>
                  <td className="py-1 px-1">
                    <input
                      value={c.pm || ""}
                      onFocus={e => { origRef.current[`${c.id}-pm`] = e.target.value; }}
                      onChange={e => onUpdateCohort({ ...c, pm: e.target.value })}
                      onBlur={e => {
                        if (e.target.value !== (origRef.current[`${c.id}-pm`] ?? ""))
                          saveScheduleForCohort(c, { pm: e.target.value });
                      }}
                      className="w-16 py-0.5 px-1.5 rounded border text-[12px] bg-card"
                      placeholder="-"
                    />
                  </td>
                  <td className="py-1 px-1">
                    <input
                      type="date"
                      value={c.date || ""}
                      onFocus={e => { origRef.current[`${c.id}-date`] = e.target.value; }}
                      onChange={e => onUpdateCohort({ ...c, date: e.target.value })}
                      onBlur={e => {
                        if (e.target.value !== (origRef.current[`${c.id}-date`] ?? ""))
                          saveScheduleForCohort(c, { startDate: e.target.value });
                      }}
                      className="py-0.5 px-1 rounded border text-[11px] bg-card"
                    />
                  </td>
                  <td className="py-1 px-1">
                    <input
                      type="date"
                      value={c.endDate || ""}
                      onFocus={e => { origRef.current[`${c.id}-end`] = e.target.value; }}
                      onChange={e => onUpdateCohort({ ...c, endDate: e.target.value })}
                      onBlur={e => {
                        if (e.target.value !== (origRef.current[`${c.id}-end`] ?? ""))
                          saveScheduleForCohort(c, { endDate: e.target.value });
                      }}
                      className="py-0.5 px-1 rounded border text-[11px] bg-card"
                    />
                  </td>
                  <td className="py-1 px-1">
                    <input
                      type="number"
                      min={0}
                      value={c.totalStudents > 0 ? c.totalStudents : ""}
                      onChange={e => {
                        const n = parseInt(e.target.value, 10);
                        onUpdateCohort({ ...c, totalStudents: isNaN(n) ? 0 : n });
                      }}
                      className="w-14 py-0.5 px-1.5 rounded border text-[12px] bg-card"
                      placeholder="0"
                    />
                  </td>
                  {/* 사전 설문 셀 */}
                  {(() => {
                    const preCount = Number(Array.isArray(c.preResponses) ? c.preResponses.length : 0) || Number(c.preCount || 0);
                    const hasReal = preCount > 0;
                    const isNoData = c.hasPreSurvey && !hasReal;
                    const isToggling = togglingCells.has(`${c.id}-사전`);
                    return (
                      <td className={`py-1 px-1.5 text-center ${hasReal ? "text-muted-foreground" : isNoData ? "text-amber-500" : "text-muted-foreground/40"}`}>
                        {hasReal ? (
                          String(preCount)
                        ) : (
                          <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isNoData}
                              disabled={isToggling}
                              onChange={() => toggleSurveyMark(c, "사전")}
                              className="accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px]">{isToggling ? "…" : isNoData ? "없음" : ""}</span>
                          </label>
                        )}
                      </td>
                    );
                  })()}
                  {/* 후기 설문 셀 */}
                  {(() => {
                    const postCount = Number(Array.isArray(c.postResponses) ? c.postResponses.length : 0) || Number(c.postCount || 0);
                    const hasReal = postCount > 0;
                    const isNoData = c.hasPostSurvey && !hasReal;
                    const isToggling = togglingCells.has(`${c.id}-후기`);
                    return (
                      <td className={`py-1 px-1.5 text-center ${hasReal ? "text-muted-foreground" : isNoData ? "text-amber-500" : "text-muted-foreground/40"}`}>
                        {hasReal ? (
                          String(postCount)
                        ) : (
                          <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isNoData}
                              disabled={isToggling}
                              onChange={() => toggleSurveyMark(c, "후기")}
                              className="accent-amber-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="text-[11px]">{isToggling ? "…" : isNoData ? "없음" : ""}</span>
                          </label>
                        )}
                      </td>
                    );
                  })()}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
