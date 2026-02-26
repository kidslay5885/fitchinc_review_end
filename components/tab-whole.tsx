"use client";

import { useState, useMemo, useEffect } from "react";
import type { Instructor, Course, Cohort, SurveyResponse } from "@/lib/types";
import { allCohorts } from "@/lib/types";
import { FIELD_LABELS } from "@/lib/feedback-utils";
import { getOrderedCohorts } from "@/lib/cohort-order";
import { computeScores } from "@/lib/analysis-engine";
import { extractFromRawData, RAW_DATA_PATTERNS } from "@/lib/analysis-engine";
import { Info, BarChart3 } from "lucide-react";

const PRE_FIELDS = ["hopePlatform", "hopeInstructor"] as const;

// rawData에서 추출할 사전 설문 필드 (텍스트형)
const RAW_PRE_FIELDS = [
  { key: "selectReason", label: "강사님 강의를 선택하신 이유", pattern: RAW_DATA_PATTERNS.selectReason },
  { key: "expectedBenefit", label: "이번 강의 혜택 중 가장 기대되는 혜택", pattern: RAW_DATA_PATTERNS.expectedBenefit },
] as const;

// rawData에서 추출할 후기 설문 필드 (텍스트형)
const RAW_POST_FIELDS = [
  { key: "satOther", label: "기타 만족 사유", pattern: RAW_DATA_PATTERNS.satOther },
] as const;
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
  course: Course | null;
  platformName: string;
  selectedCohort: Cohort | null;
  /** 전체 보기에서 강의 품질 탭으로 이동할 때 호출 (선택) */
  onGoToQuality?: () => void;
}

/** 목차 한 항목: id + 표시 라벨 */
type TocEntry = { id: string; label: string };

export function TabWhole({ instructor, course, platformName, selectedCohort, onGoToQuality }: TabWholeProps) {
  const visibleCohorts = course ? course.cohorts : allCohorts(instructor);
  const cohortsWithData = visibleCohorts.filter((c) => c.preResponses.length > 0 || c.postResponses.length > 0);
  const orderedCohorts = useMemo(
    () => getOrderedCohorts(platformName, instructor.name, course?.name || "", cohortsWithData),
    [platformName, instructor.name, course?.name, cohortsWithData]
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
    const out: TocEntry[] = [];
    for (const field of PRE_FIELDS) {
      const hasData = safeCohorts.some((c) =>
        c.preResponses.some((r) => getResponseText(r, field).length > 2)
      );
      if (!hasData) continue;
      const label = FIELD_LABELS[field] || field;
      out.push({ id: `pre-${field}`, label: `사전 · ${label}` });
    }
    // rawData 기반 사전 필드
    for (const rf of RAW_PRE_FIELDS) {
      const hasData = safeCohorts.some((c) =>
        c.preResponses.some((r) => r.rawData && extractFromRawData(r.rawData, rf.pattern).trim().length > 2)
      );
      if (!hasData) continue;
      out.push({ id: `pre-${rf.key}`, label: `사전 · ${rf.label}` });
    }
    for (const field of POST_FIELDS) {
      const hasData = safeCohorts.some((c) =>
        c.postResponses.some((r) => getResponseText(r, field).length > 2)
      );
      if (!hasData) continue;
      const label = POST_FIELD_LABELS[field] || FIELD_LABELS[field] || field;
      out.push({ id: `post-${field}`, label: `후기 · ${label}` });
    }
    // rawData 기반 후기 필드
    for (const rf of RAW_POST_FIELDS) {
      const hasData = safeCohorts.some((c) =>
        c.postResponses.some((r) => r.rawData && extractFromRawData(r.rawData, rf.pattern).trim().length > 2)
      );
      if (!hasData) continue;
      out.push({ id: `post-${rf.key}`, label: `후기 · ${rf.label}` });
    }
    return out;
  }, [safeCohorts]);

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
              <span className="text-[14px] font-bold">전체 요약</span>
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
                📊 전체 요약 탭에서 자세히 보기
              </button>
            )}
          </div>
        );
      })()}

      {/* 보기 선택: 기수 다중 선택 가능. 전체 보기 = 빈 선택, 전부 선택 시 자동으로 전체와 동일 */}
      {!selectedCohort && orderedCohorts.length > 1 && (
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
                목차 (클릭하면 해당 문항으로 이동)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tocEntries.map((e) => {
                  const isPre = e.label.startsWith("사전");
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => scrollTo(e.id)}
                      className={`py-1.5 px-2.5 rounded-md text-[13px] font-medium border transition-colors ${
                        isPre
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
                {PRE_FIELDS.map((field) => {
                  const label = FIELD_LABELS[field] || field;
                  const cohortsWithField = safeCohorts.filter((c) =>
                    c.preResponses.some((r) => getResponseText(r, field).length > 2)
                  );
                  if (cohortsWithField.length === 0) return null;
                  return (
                    <div key={field} id={`pre-${field}`} className="rounded-xl border bg-card overflow-hidden border-blue-100 scroll-mt-[6rem]">
                      <div className="py-2.5 px-4 rounded-t-lg bg-blue-100/80 border-b border-blue-200 text-[15px] font-bold text-blue-900">
                        {label}
                      </div>
                      <div className="p-4 space-y-5">
                        {cohortsWithField.map((cohort) => {
                          const items = cohort.preResponses
                            .map((r) => ({ name: r.name, text: getResponseText(r, field) }))
                            .filter((x) => x.text.length > 2);
                          return (
                            <div key={cohort.id}>
                              {safeCohorts.length > 1 && (
                                <div className="text-[13px] font-bold text-blue-700 mb-2 pl-1 pb-1 border-b border-blue-100">
                                  {cohort.label}
                                </div>
                              )}
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
                  );
                })}

                {/* rawData 기반 사전 설문 필드 */}
                {RAW_PRE_FIELDS.map((rf) => {
                  const cohortsWithField = safeCohorts.filter((c) =>
                    c.preResponses.some((r) => r.rawData && extractFromRawData(r.rawData, rf.pattern).trim().length > 2)
                  );
                  if (cohortsWithField.length === 0) return null;
                  return (
                    <div key={rf.key} id={`pre-${rf.key}`} className="rounded-xl border bg-card overflow-hidden border-blue-100 scroll-mt-[6rem]">
                      <div className="py-2.5 px-4 rounded-t-lg bg-blue-100/80 border-b border-blue-200 text-[15px] font-bold text-blue-900">
                        {rf.label}
                      </div>
                      <div className="p-4 space-y-5">
                        {cohortsWithField.map((cohort) => {
                          const items = cohort.preResponses
                            .map((r) => ({
                              name: r.name,
                              text: r.rawData ? extractFromRawData(r.rawData, rf.pattern).trim() : "",
                            }))
                            .filter((x) => x.text.length > 2);
                          return (
                            <div key={cohort.id}>
                              {safeCohorts.length > 1 && (
                                <div className="text-[13px] font-bold text-blue-700 mb-2 pl-1 pb-1 border-b border-blue-100">
                                  {cohort.label}
                                </div>
                              )}
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
                  );
                })}
              </div>
            </section>

            {/* 후기 설문 */}
            <section id="section-post" className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-4 sm:p-5 scroll-mt-24">
              <h3 className="text-[17px] font-bold border-b-2 border-emerald-400/50 pb-2 mb-5 text-emerald-700">후기 설문</h3>
              <div className="grid gap-8">
                {POST_FIELDS.map((field) => {
                  const label = POST_FIELD_LABELS[field] || FIELD_LABELS[field] || field;
                  const cohortsWithField = safeCohorts.filter((c) =>
                    c.postResponses.some((r) => getResponseText(r, field).length > 2)
                  );
                  if (cohortsWithField.length === 0) return null;
                  return (
                    <div key={field} id={`post-${field}`} className="rounded-xl border bg-card overflow-hidden border-emerald-100 scroll-mt-[6rem]">
                      <div className="py-2.5 px-4 rounded-t-lg bg-emerald-100/80 border-b border-emerald-200 text-[15px] font-bold text-emerald-900">
                        {label}
                      </div>
                      <div className="p-4 space-y-5">
                        {cohortsWithField.map((cohort) => {
                          const items = cohort.postResponses
                            .map((r) => ({ name: r.name, text: getResponseText(r, field) }))
                            .filter((x) => x.text.length > 2);
                          return (
                            <div key={cohort.id}>
                              {safeCohorts.length > 1 && (
                                <div className="text-[13px] font-bold text-emerald-700 mb-2 pl-1 pb-1 border-b border-emerald-100">
                                  {cohort.label}
                                </div>
                              )}
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
                  );
                })}

                {/* rawData 기반 후기 설문 필드 */}
                {RAW_POST_FIELDS.map((rf) => {
                  const cohortsWithField = safeCohorts.filter((c) =>
                    c.postResponses.some((r) => r.rawData && extractFromRawData(r.rawData, rf.pattern).trim().length > 2)
                  );
                  if (cohortsWithField.length === 0) return null;
                  return (
                    <div key={rf.key} id={`post-${rf.key}`} className="rounded-xl border bg-card overflow-hidden border-emerald-100 scroll-mt-[6rem]">
                      <div className="py-2.5 px-4 rounded-t-lg bg-emerald-100/80 border-b border-emerald-200 text-[15px] font-bold text-emerald-900">
                        {rf.label}
                      </div>
                      <div className="p-4 space-y-5">
                        {cohortsWithField.map((cohort) => {
                          const items = cohort.postResponses
                            .map((r) => ({
                              name: r.name,
                              text: r.rawData ? extractFromRawData(r.rawData, rf.pattern).trim() : "",
                            }))
                            .filter((x) => x.text.length > 2);
                          return (
                            <div key={cohort.id}>
                              {safeCohorts.length > 1 && (
                                <div className="text-[13px] font-bold text-emerald-700 mb-2 pl-1 pb-1 border-b border-emerald-100">
                                  {cohort.label}
                                </div>
                              )}
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
                  );
                })}
              </div>
            </section>
          </div>
        </>
      )}

    </div>
  );
}
