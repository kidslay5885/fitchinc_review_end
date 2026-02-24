"use client";

import { useState, useMemo, useEffect } from "react";
import type { Instructor, Cohort, SurveyResponse } from "@/lib/types";
import { FIELD_LABELS } from "@/lib/feedback-utils";
import { getOrderedCohorts, setCohortOrder } from "@/lib/cohort-order";
import { Info, GripVertical, ChevronUp, ChevronDown, X } from "lucide-react";

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
  onSelectCohort: (cohortId: string | null) => void;
}

/** 목차 한 항목: id + 표시 라벨 */
type TocEntry = { id: string; label: string };

export function TabWhole({ instructor, platformName, selectedCohort, onSelectCohort }: TabWholeProps) {
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderKey, setOrderKey] = useState(0);

  const cohortsWithData = instructor.cohorts.filter((c) => c.preResponses.length > 0 || c.postResponses.length > 0);
  const orderedCohorts = useMemo(
    () => getOrderedCohorts(platformName, instructor.name, cohortsWithData),
    [platformName, instructor.name, cohortsWithData, orderKey]
  );
  const currentCohorts = selectedCohort ? [selectedCohort] : orderedCohorts;
  const showAll = !selectedCohort;

  const tocEntries = useMemo((): TocEntry[] => {
    const out: TocEntry[] = [];
    const showCohortInToc = showAll && currentCohorts.length > 1;
    for (const cohort of currentCohorts) {
      const prefix = showCohortInToc ? `${cohort.label} · ` : "";
      for (const field of PRE_FIELDS) {
        const items = cohort.preResponses
          .map((r) => getResponseText(r, field))
          .filter((s) => s.length > 2);
        if (items.length === 0) continue;
        const label = FIELD_LABELS[field] || field;
        const sectionId = `pre-${slug(cohort.label)}-${field}`;
        out.push({ id: sectionId, label: `${prefix}사전 · ${label}` });
      }
      for (const field of POST_FIELDS) {
        const items = cohort.postResponses
          .map((r) => getResponseText(r, field))
          .filter((s) => s.length > 2);
        if (items.length === 0) continue;
        const label = POST_FIELD_LABELS[field] || FIELD_LABELS[field] || field;
        const sectionId = `post-${slug(cohort.label)}-${field}`;
        out.push({ id: sectionId, label: `${prefix}후기 · ${label}` });
      }
    }
    return out;
  }, [showAll, currentCohorts]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  };

  const handleSaveOrder = (labels: string[]) => {
    setCohortOrder(platformName, instructor.name, labels);
    setOrderKey((k) => k + 1);
    setOrderModalOpen(false);
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-[18px] font-extrabold">전체 설문 결과</h2>
      </div>

      {/* 기수 선택: 목차 바로 위, 버튼 형태로 눈에 띄게 */}
      {orderedCohorts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-semibold text-muted-foreground mr-1">보기:</span>
          <button
            type="button"
            onClick={() => onSelectCohort(null)}
            className={`py-2 px-4 rounded-lg text-[14px] font-semibold transition-colors ${
              showAll ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            전체 보기
          </button>
          {orderedCohorts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCohort(c.id)}
              className={`py-2 px-4 rounded-lg text-[14px] font-semibold transition-colors ${
                selectedCohort?.id === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {c.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOrderModalOpen(true)}
            className="py-2 px-3 rounded-lg text-[13px] text-muted-foreground hover:bg-muted border border-dashed"
          >
            기수 순서 변경
          </button>
        </div>
      )}

      {/* 설문 문항 기준 설명 */}
      <div className="rounded-lg border bg-muted/40 p-4 flex gap-3">
        <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-[13px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">설문 문항 기준:</span> 업로드한 엑셀의 열 이름과 동일한 항목만 여기 목차로 표시됩니다. 목차를 클릭하여 전체 항목을 편하게 확인할 수 있습니다.
        </div>
      </div>

      {currentCohorts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-[14px]">
          설문 데이터가 없습니다. 사전·후기 설문 파일을 업로드하면 여기에 목차별로 표시됩니다.
        </div>
      ) : (
        <>
          {/* 목차: 클릭 시 해당 문항으로 스크롤 */}
          {tocEntries.length > 0 && (
            <nav className="sticky top-2 z-10 rounded-xl border bg-card/95 backdrop-blur p-3 shadow-sm">
              <div className="text-[12px] font-semibold text-muted-foreground mb-2 px-1">목차 (클릭하면 해당 문항으로 이동)</div>
              <div className="flex flex-wrap gap-1.5">
                {tocEntries.map((e) => {
                  const isPre = e.label.includes("사전");
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
            <section className="rounded-xl border border-blue-200/60 bg-blue-50/30 p-4 sm:p-5">
              <h3 className="text-[17px] font-bold border-b-2 border-blue-400/50 pb-2 mb-5 text-blue-700">사전 설문</h3>
              <div className="grid gap-8">
                {currentCohorts.map((cohort) => (
                  <div key={cohort.id} className="rounded-xl border bg-card overflow-hidden border-blue-100">
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
            <section className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-4 sm:p-5">
              <h3 className="text-[17px] font-bold border-b-2 border-emerald-400/50 pb-2 mb-5 text-emerald-700">후기 설문</h3>
              <div className="grid gap-8">
                {currentCohorts.map((cohort) => (
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

      {/* 기수 순서 변경 모달 */}
      {orderModalOpen && (
        <OrderModal
          labels={orderedCohorts.map((c) => c.label)}
          onSave={handleSaveOrder}
          onClose={() => setOrderModalOpen(false)}
        />
      )}
    </div>
  );
}

function OrderModal({
  labels,
  onSave,
  onClose,
}: {
  labels: string[];
  onSave: (labels: string[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<string[]>(labels);
  useEffect(() => {
    setList(labels);
  }, [labels]);

  const move = (index: number, delta: number) => {
    const next = [...list];
    const j = index + delta;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setList(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-xl border shadow-xl p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="text-[15px] font-bold">기수 순서 변경</span>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[13px] text-muted-foreground mb-3">위아래로 이동해 원하는 순서로 맞추세요.</p>
        <ul className="space-y-1 mb-4">
          {list.map((label, i) => (
            <li
              key={label}
              className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50 border"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 font-medium">{label}</span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="p-1 rounded hover:bg-muted disabled:opacity-30"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === list.length - 1}
                className="p-1 rounded hover:bg-muted disabled:opacity-30"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3 rounded-lg border text-[13px] font-medium"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onSave(list)}
            className="py-1.5 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
}
