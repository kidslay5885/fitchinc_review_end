"use client";

import { useState, useMemo, useEffect } from "react";
import type { Instructor, Cohort, SurveyResponse } from "@/lib/types";
import { FIELD_LABELS } from "@/lib/feedback-utils";
import { getOrderedCohorts } from "@/lib/cohort-order";
import { computeScores } from "@/lib/analysis-engine";
import { Info, BarChart3 } from "lucide-react";

const PRE_FIELDS = ["hopePlatform", "hopeInstructor"] as const;
const POST_FIELD_LABELS: Record<string, string> = {
  pFree: "자유 의견",
  pSat: "만족스러웠던 점",
  pFmt: "선호 방식",
  pRec: "추천 의향",
  lowScoreReason: "커리큘럼 불만족 사유",
  lowFeedbackRequest: "피드백 개선 요청",
};
const POST_FIELDS = ["pFree", "pSat", "pFmt", "pRec", "lowScoreReason", "lowFeedbackRequest"] as const;

function getResponseText(r: SurveyResponse, key: string): string {
  const v = (r as Record<string, unknown>)[key];
  if (v == null) return "";
  const s = String(v).trim();
  return s.length > 0 ? s : "";
}

function slug(id: string): string {
  return id.replace(/\s+/g, "-").replace(/[^\w가-힣-]/g, "");
}

interface TabWholeProps {
  instructor: Instructor;
  platformName: string;
  selectedCohort: Cohort | null;
  /** 전체 보기에서 강의 품질 탭으로 이동할 때 호출 (선택) */
  onGoToQuality?: () => void;
}

/** 목차 한 항목: id + 표시 라벨 */
type TocEntry = { id: string; label: string };

export function TabWhole({ instructor, platformName, selectedCohort, onGoToQuality }: TabWholeProps) {
  const cohortsWithData = instructor.cohorts.filter((c) => c.preResponses.length > 0 || c.postResponses.length > 0);
  const orderedCohorts = useMemo(
    () => getOrderedCohorts(platformName, instructor.name, cohortsWithData),
    [platformName, instructor.name, cohortsWithData]
  );
  // 전체 보기 탭 내 로컬 필터. 다중 선택 가능(1기+2기 등). 빈 Set = 전체, 전부 선택 시에도 전체로 간주.
  const [viewCohortLabels, setViewCohortLabels] = useState<Set<string>>(new Set());
  useEffect(() => {
    setViewCohortLabels(selectedCohort?.label ? new Set([selectedCohort.label]) : new Set());
  }, [selectedCohort?.label]);
  const isEffectivelyAll =
    viewCohortLabels.size === 0 || viewCohortLabels.size === orderedCohorts.length;
  const currentCohorts =
    isEffectivelyAll
      ? orderedCohorts
      : orderedCohorts.filter((c) => viewCohortLabels.has(c.label));
  const showAll = isEffectivelyAll;
  const safeCohorts = currentCohorts.length > 0 ? currentCohorts : orderedCohorts;

  const tocEntries = useMemo((): TocEntry[] => {
    if (showAll && orderedCohorts.length > 1) {
      return orderedCohorts.map((c) => ({
        id: `cohort-${slug(c.label)}`,
        label: c.label,
      }));
    }
    const out: TocEntry[] = [];
    for (const cohort of safeCohorts) {
      for (const field of PRE_FIELDS) {
        const items = cohort.preResponses
          .map((r) => getResponseText(r, field))
          .filter((s) => s.length > 2);
        if (items.length === 0) continue;
        const label = FIELD_LABELS[field] || field;
        out.push({ id: `pre-${slug(cohort.label)}-${field}`, label: `사전 · ${label}` });
      }
      for (const field of POST_FIELDS) {
        const items = cohort.postResponses
          .map((r) => getResponseText(r, field))
          .filter((s) => s.length > 2);
        if (items.length === 0) continue;
        const label = POST_FIELD_LABELS[field] || FIELD_LABELS[field] || field;
        out.push({ id: `post-${slug(cohort.label)}-${field}`, label: `후기 · ${label}` });
      }
    }
    return out;
  }, [showAll, safeCohorts, orderedCohorts]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-[18px] font-extrabold">전체 설문 결과</h2>
      </div>

      {/* 전체일 때: 강의 품질 요약 + 강의 품질 탭으로 이동 (아이디어: 전체 보기 = 전체 + 강의 품질만 강조) */}
      {showAll && orderedCohorts.length > 0 && (() => {
        const rows = orderedCohorts.map((c) => {
          const s = computeScores(c.postResponses);
          return { label: c.label, ps1: s.ps1Avg, ps2: s.ps2Avg, recRate: s.recRate };
        });
        const withData = rows.filter((r) => r.ps1 > 0 || r.ps2 > 0);
        const avg = withData.length > 0
          ? (withData.reduce((a, r) => a + (r.ps1 + r.ps2) / 2, 0) / withData.length).toFixed(1)
          : null;
        return (
          <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span className="text-[14px] font-bold">강의 품질 요약</span>
              {avg != null && (
                <span className="text-[13px] text-muted-foreground">
                  기수 {orderedCohorts.length}개 · 만족도 평균 <strong className="text-foreground">{avg}</strong>/10
                </span>
              )}
            </div>
            {onGoToQuality && (
              <button
                type="button"
                onClick={onGoToQuality}
                className="py-1.5 px-3 rounded-lg text-[13px] font-semibold bg-muted hover:bg-muted/80 text-foreground"
              >
                📊 강의 품질 탭에서 자세히 보기
              </button>
            )}
          </div>
        );
      })()}

      {/* 보기 선택: 기수 다중 선택 가능. 전체 보기 = 빈 선택, 전부 선택 시 자동으로 전체와 동일 */}
      {orderedCohorts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-muted-foreground mr-1">보기:</span>
          <button
            type="button"
            onClick={() => setViewCohortLabels(new Set())}
            className={`py-2 px-4 rounded-lg text-[14px] font-semibold transition-colors ${
              showAll ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            전체 보기
          </button>
          {orderedCohorts.map((c) => {
            const isSelected = viewCohortLabels.has(c.label);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  const next = new Set(viewCohortLabels);
                  if (next.has(c.label)) {
                    next.delete(c.label);
                  } else {
                    next.add(c.label);
                    if (next.size === orderedCohorts.length) {
                      setViewCohortLabels(new Set());
                      return;
                    }
                  }
                  setViewCohortLabels(next);
                }}
                className={`py-2 px-4 rounded-lg text-[14px] font-semibold transition-colors ${
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 설문 문항 기준 설명 */}
      <div className="rounded-lg border bg-muted/40 p-4 flex gap-3">
        <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-[13px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">설문 문항 기준:</span> 업로드한 엑셀의 열 이름과 동일한 항목만 여기 목차로 표시됩니다. 목차를 클릭하여 전체 항목을 편하게 확인할 수 있습니다.
        </div>
      </div>

      {safeCohorts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-[14px]">
          설문 데이터가 없습니다. 사전·후기 설문 파일을 업로드하면 여기에 목차별로 표시됩니다.
        </div>
      ) : (
        <>
          {/* 목차 (사전/후기 버튼 없음, 심플하게) */}
          {tocEntries.length > 0 && (
            <nav className="sticky top-2 z-10 rounded-xl border bg-card/95 backdrop-blur p-3 shadow-sm">
              <div className="text-[12px] font-semibold text-muted-foreground mb-2 px-1">
                {showAll && orderedCohorts.length > 1 ? "기수별로 이동" : "목차 (클릭하면 해당 문항으로 이동)"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tocEntries.map((e) => {
                  const isPre = e.label.startsWith("사전");
                  const isCohort = showAll && orderedCohorts.length > 1 && orderedCohorts.some((c) => c.label === e.label);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => scrollTo(e.id)}
                      className={`py-1.5 px-2.5 rounded-md text-[13px] font-medium border transition-colors ${
                        isCohort
                          ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
                          : isPre
                            ? "bg-blue-100/90 text-blue-800 border-blue-200 hover:bg-blue-200/90"
                            : "bg-emerald-100/90 text-emerald-800 border-emerald-200 hover:bg-emerald-200/90"
                      }`}
                    >
                      {e.label}
                    </button>
                  );
                })}
              </div>
            </nav>
          )}

          <div className="grid gap-10">
            {/* 사전 설문 */}
            <section id="section-pre" className="rounded-xl border border-blue-200/60 bg-blue-50/30 p-4 sm:p-5 scroll-mt-24">
              <h3 className="text-[17px] font-bold border-b-2 border-blue-400/50 pb-2 mb-5 text-blue-700">사전 설문</h3>
              <div className="grid gap-8">
                {safeCohorts.map((cohort) => (
                  <div
                    key={cohort.id}
                    id={showAll && orderedCohorts.length > 1 ? `cohort-${slug(cohort.label)}` : undefined}
                    className="rounded-xl border bg-card overflow-hidden border-blue-100 scroll-mt-[6rem]"
                  >
                    {showAll && orderedCohorts.length > 1 && (
                      <div className="px-4 py-2.5 bg-blue-100/60 text-[14px] font-bold text-foreground border-b border-blue-100">
                        {cohort.label}
                      </div>
                    )}
                    <div className="p-4 space-y-6">
                      {PRE_FIELDS.map((field) => {
                        const label = FIELD_LABELS[field] || field;
                        const items = cohort.preResponses
                          .map((r) => ({ name: r.name, text: getResponseText(r, field) }))
                          .filter((x) => x.text.length > 2);
                        const sectionId = `pre-${slug(cohort.label)}-${field}`;
                        if (items.length === 0) return null;
                        return (
                          <div key={field} id={sectionId} className="scroll-mt-[6rem] pt-1">
                            <div className="py-2.5 px-3 mb-2 rounded-lg bg-blue-100/80 border-l-4 border-blue-500 text-[15px] font-bold text-blue-900">
                              {label}
                            </div>
                            <ul className="space-y-2 pl-1">
                              {items.map((item, i) => (
                                <li key={i} className="text-[14px] pl-3 border-l-2 border-muted">
                                  <span className="font-medium text-foreground/90">{item.name}:</span>{" "}
                                  <span className="text-muted-foreground">{item.text}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 후기 설문 */}
            <section id="section-post" className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-4 sm:p-5 scroll-mt-24">
              <h3 className="text-[17px] font-bold border-b-2 border-emerald-400/50 pb-2 mb-5 text-emerald-700">후기 설문</h3>
              <div className="grid gap-8">
                {safeCohorts.map((cohort) => (
                  <div key={cohort.id} className="rounded-xl border bg-card overflow-hidden border-emerald-100">
                    {showAll && orderedCohorts.length > 1 && (
                      <div className="px-4 py-2.5 bg-emerald-100/60 text-[14px] font-bold text-foreground border-b border-emerald-100">
                        {cohort.label}
                      </div>
                    )}
                    <div className="p-4 space-y-6">
                      {POST_FIELDS.map((field) => {
                        const label = POST_FIELD_LABELS[field] || FIELD_LABELS[field] || field;
                        const items = cohort.postResponses
                          .map((r) => ({ name: r.name, text: getResponseText(r, field) }))
                          .filter((x) => x.text.length > 2);
                        const sectionId = `post-${slug(cohort.label)}-${field}`;
                        if (items.length === 0) return null;
                        return (
                          <div key={field} id={sectionId} className="scroll-mt-[6rem] pt-1">
                            <div className="py-2.5 px-3 mb-2 rounded-lg bg-emerald-100/80 border-l-4 border-emerald-500 text-[15px] font-bold text-emerald-900">
                              {label}
                            </div>
                            <ul className="space-y-2 pl-1">
                              {items.map((item, i) => (
                                <li key={i} className="text-[14px] pl-3 border-l-2 border-muted">
                                  <span className="font-medium text-foreground/90">{item.name}:</span>{" "}
                                  <span className="text-muted-foreground">{item.text}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}

    </div>
  );
}
