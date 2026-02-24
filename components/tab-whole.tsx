"use client";

import { useState, useMemo } from "react";
import type { Instructor, Cohort, SurveyResponse } from "@/lib/types";
import { FIELD_LABELS } from "@/lib/feedback-utils";
import { Info } from "lucide-react";

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
  platformName?: string;
  selectedCohort?: Cohort | null;
}

/** 목차 한 항목: id + 표시 라벨 */
type TocEntry = { id: string; label: string };

export function TabWhole({ instructor }: TabWholeProps) {
  const [cohortFilter, setCohortFilter] = useState<string>("all");

  const cohorts = instructor.cohorts.filter((c) => c.preResponses.length > 0 || c.postResponses.length > 0);
  const currentCohorts = cohortFilter === "all" ? cohorts : cohorts.filter((c) => c.label === cohortFilter);

  const tocEntries = useMemo((): TocEntry[] => {
    const out: TocEntry[] = [];
    const showCohortInToc = cohortFilter === "all" && currentCohorts.length > 1;
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
  }, [cohortFilter, currentCohorts]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-[18px] font-extrabold">전체 설문 결과</h2>
        {cohorts.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">기수</span>
            <select
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              className="py-1.5 px-3 rounded-lg border text-[14px] bg-card"
            >
              <option value="all">전체 기수</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.label}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 설문 문항 기준 설명 */}
      <div className="rounded-lg border bg-muted/40 p-4 flex gap-3">
        <Info className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-[13px] text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground">설문 문항 기준:</span> 사전 설문 2문항(플랫폼에 바라는 점, 강사에게 바라는 점), 후기 설문 6문항(자유 의견, 만족스러웠던 점, 선호 방식, 추천 의향, 커리큘럼 불만족 사유, 피드백 개선 요청)은 네이버 폼 설문지의 질문 항목과 1:1로 매핑되어 있습니다. 업로드한 엑셀의 열 이름과 동일한 항목만 여기 목차로 표시됩니다.
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
                {tocEntries.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => scrollTo(e.id)}
                    className="py-1.5 px-2.5 rounded-md text-[13px] font-medium bg-muted/80 hover:bg-muted text-foreground border border-transparent hover:border-border transition-colors"
                  >
                    {e.label}
                  </button>
                ))}
              </div>
            </nav>
          )}

          <div className="grid gap-10">
            {/* 사전 설문 */}
            <section>
              <h3 className="text-[17px] font-bold border-b-2 border-primary/30 pb-2 mb-5 text-primary">사전 설문</h3>
              <div className="grid gap-8">
                {currentCohorts.map((cohort) => (
                  <div key={cohort.id} className="rounded-xl border bg-card overflow-hidden">
                    {cohortFilter === "all" && cohorts.length > 1 && (
                      <div className="px-4 py-2.5 bg-muted/60 text-[14px] font-bold text-foreground border-b">
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
                          <div key={field} id={sectionId} className="scroll-mt-24">
                            <div className="sticky top-20 z-[1] py-2 -mx-1 px-3 -mt-1 mb-2 rounded-lg bg-primary/10 border-l-4 border-primary text-[15px] font-bold text-foreground">
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
            <section>
              <h3 className="text-[17px] font-bold border-b-2 border-primary/30 pb-2 mb-5 text-primary">후기 설문</h3>
              <div className="grid gap-8">
                {currentCohorts.map((cohort) => (
                  <div key={cohort.id} className="rounded-xl border bg-card overflow-hidden">
                    {cohortFilter === "all" && cohorts.length > 1 && (
                      <div className="px-4 py-2.5 bg-muted/60 text-[14px] font-bold text-foreground border-b">
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
                          <div key={field} id={sectionId} className="scroll-mt-24">
                            <div className="sticky top-20 z-[1] py-2 -mx-1 px-3 -mt-1 mb-2 rounded-lg bg-primary/10 border-l-4 border-primary text-[15px] font-bold text-foreground">
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
