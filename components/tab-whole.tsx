"use client";

import { useState } from "react";
import type { Instructor, Cohort, SurveyResponse } from "@/lib/types";
import { FIELD_LABELS } from "@/lib/feedback-utils";

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

interface TabWholeProps {
  instructor: Instructor;
  platformName?: string;
  selectedCohort?: Cohort | null;
}

export function TabWhole({ instructor }: TabWholeProps) {
  const [cohortFilter, setCohortFilter] = useState<string>("all");

  const cohorts = instructor.cohorts.filter((c) => c.preResponses.length > 0 || c.postResponses.length > 0);
  const currentCohorts = cohortFilter === "all" ? cohorts : cohorts.filter((c) => c.label === cohortFilter);

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-[16px] font-extrabold">전체 설문 결과</h2>
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

      {currentCohorts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-[14px]">
          설문 데이터가 없습니다. 사전·후기 설문 파일을 업로드하면 여기에 목차별로 표시됩니다.
        </div>
      ) : (
        <div className="grid gap-8">
          {/* 사전 설문 */}
          <section>
            <h3 className="text-[15px] font-bold border-b pb-2 mb-4 text-primary">사전 설문</h3>
            <div className="grid gap-6">
              {cohortFilter === "all"
                ? cohorts.map((cohort) => (
                    <div key={cohort.id} className="rounded-xl border bg-card p-4">
                      <div className="text-[13px] font-bold text-muted-foreground mb-3">{cohort.label}</div>
                      {PRE_FIELDS.map((field) => {
                        const label = FIELD_LABELS[field] || field;
                        const items = cohort.preResponses
                          .map((r) => ({ name: r.name, text: getResponseText(r, field) }))
                          .filter((x) => x.text.length > 2);
                        if (items.length === 0) return null;
                        return (
                          <div key={field} className="mb-4 last:mb-0">
                            <div className="text-[13px] font-semibold text-foreground/90 mb-2">{label}</div>
                            <ul className="space-y-1.5">
                              {items.map((item, i) => (
                                <li key={i} className="text-[13px] pl-2 border-l-2 border-muted">
                                  <span className="font-medium text-foreground/80">{item.name}:</span>{" "}
                                  <span className="text-muted-foreground">{item.text}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  ))
                : currentCohorts.map((cohort) => (
                    <div key={cohort.id} className="rounded-xl border bg-card p-4">
                      {PRE_FIELDS.map((field) => {
                        const label = FIELD_LABELS[field] || field;
                        const items = cohort.preResponses
                          .map((r) => ({ name: r.name, text: getResponseText(r, field) }))
                          .filter((x) => x.text.length > 2);
                        if (items.length === 0) return null;
                        return (
                          <div key={field} className="mb-4 last:mb-0">
                            <div className="text-[13px] font-semibold text-foreground/90 mb-2">{label}</div>
                            <ul className="space-y-1.5">
                              {items.map((item, i) => (
                                <li key={i} className="text-[13px] pl-2 border-l-2 border-muted">
                                  <span className="font-medium text-foreground/80">{item.name}:</span>{" "}
                                  <span className="text-muted-foreground">{item.text}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  ))}
            </div>
          </section>

          {/* 후기 설문 */}
          <section>
            <h3 className="text-[15px] font-bold border-b pb-2 mb-4 text-primary">후기 설문</h3>
            <div className="grid gap-6">
              {cohortFilter === "all"
                ? cohorts.map((cohort) => (
                    <div key={cohort.id} className="rounded-xl border bg-card p-4">
                      <div className="text-[13px] font-bold text-muted-foreground mb-3">{cohort.label}</div>
                      {POST_FIELDS.map((field) => {
                        const label = POST_FIELD_LABELS[field] || FIELD_LABELS[field] || field;
                        const items = cohort.postResponses
                          .map((r) => ({ name: r.name, text: getResponseText(r, field) }))
                          .filter((x) => x.text.length > 2);
                        if (items.length === 0) return null;
                        return (
                          <div key={field} className="mb-4 last:mb-0">
                            <div className="text-[13px] font-semibold text-foreground/90 mb-2">{label}</div>
                            <ul className="space-y-1.5">
                              {items.map((item, i) => (
                                <li key={i} className="text-[13px] pl-2 border-l-2 border-muted">
                                  <span className="font-medium text-foreground/80">{item.name}:</span>{" "}
                                  <span className="text-muted-foreground">{item.text}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  ))
                : currentCohorts.map((cohort) => (
                    <div key={cohort.id} className="rounded-xl border bg-card p-4">
                      {POST_FIELDS.map((field) => {
                        const label = POST_FIELD_LABELS[field] || FIELD_LABELS[field] || field;
                        const items = cohort.postResponses
                          .map((r) => ({ name: r.name, text: getResponseText(r, field) }))
                          .filter((x) => x.text.length > 2);
                        if (items.length === 0) return null;
                        return (
                          <div key={field} className="mb-4 last:mb-0">
                            <div className="text-[13px] font-semibold text-foreground/90 mb-2">{label}</div>
                            <ul className="space-y-1.5">
                              {items.map((item, i) => (
                                <li key={i} className="text-[13px] pl-2 border-l-2 border-muted">
                                  <span className="font-medium text-foreground/80">{item.name}:</span>{" "}
                                  <span className="text-muted-foreground">{item.text}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
