"use client";

import React, { useState, useMemo } from "react";
import type { Instructor, Cohort, SurveyResponse } from "@/lib/types";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

interface TabRawResponsesProps {
  instructor: Instructor;
  cohort: Cohort | null;
}

export function TabRawResponses({ instructor, cohort }: TabRawResponsesProps) {
  const [viewMode, setViewMode] = useState<"pre" | "post">("pre");
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("전체");
  const [filterAge, setFilterAge] = useState("전체");
  const [filterJob, setFilterJob] = useState("전체");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const preResponses = cohort
    ? cohort.preResponses
    : instructor.cohorts.flatMap((c) => c.preResponses);
  const postResponses = cohort
    ? cohort.postResponses
    : instructor.cohorts.flatMap((c) => c.postResponses);

  const responses = viewMode === "pre" ? preResponses : postResponses;

  const genders = useMemo(
    () => ["전체", ...new Set(preResponses.map((r) => r.gender).filter(Boolean))],
    [preResponses]
  );
  const ages = useMemo(
    () => ["전체", ...new Set(preResponses.map((r) => r.age).filter(Boolean))],
    [preResponses]
  );
  const jobs = useMemo(
    () => ["전체", ...new Set(preResponses.map((r) => r.job).filter(Boolean))],
    [preResponses]
  );

  const filtered = useMemo(() => {
    return responses.filter((r) => {
      if (search) {
        const s = search.toLowerCase();
        const searchable = [
          r.name,
          r.hopePlatform,
          r.hopeInstructor,
          r.pFree,
          r.goal,
        ]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(s)) return false;
      }
      if (filterGender !== "전체" && r.gender !== filterGender) return false;
      if (filterAge !== "전체" && r.age !== filterAge) return false;
      if (filterJob !== "전체" && r.job !== filterJob) return false;
      return true;
    });
  }, [responses, search, filterGender, filterAge, filterJob]);

  if (preResponses.length === 0 && postResponses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="text-[30px] opacity-25 mb-2">📋</div>
        <div className="text-[14px] font-bold">응답 데이터가 없습니다</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3.5">
      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5 border">
          {(["pre", "post"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`py-1.5 px-3.5 rounded-md text-[12px] transition-colors ${
                viewMode === m
                  ? "bg-card font-bold text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "pre" ? "사전" : "후기"}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[120px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="검색..."
            className="w-full py-1.5 pl-8 pr-3 rounded-lg border text-[13px] bg-card"
          />
        </div>

        <div className="flex gap-0.5 bg-muted rounded-md p-0.5">
          {genders.map((g) => (
            <button
              key={g}
              onClick={() => setFilterGender(g)}
              className={`px-2.5 py-1 rounded text-[11px] ${
                g === filterGender ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {ages.length > 1 && (
          <select
            value={filterAge}
            onChange={(e) => setFilterAge(e.target.value)}
            className="py-1 px-2 rounded-md border text-[11px] bg-muted"
          >
            {ages.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        )}

        {jobs.length > 1 && (
          <select
            value={filterJob}
            onChange={(e) => setFilterJob(e.target.value)}
            className="py-1 px-2 rounded-md border text-[11px] bg-muted"
          >
            {jobs.map((j) => (
              <option key={j}>{j}</option>
            ))}
          </select>
        )}

        <span className="text-[12px] text-muted-foreground">{filtered.length}명</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-muted text-muted-foreground text-[11px] font-bold">
                <th className="py-2.5 px-3 text-left">이름</th>
                {viewMode === "pre" ? (
                  <>
                    <th className="py-2.5 px-3 text-center">성별</th>
                    <th className="py-2.5 px-3 text-center">연령</th>
                    <th className="py-2.5 px-3 text-center">직업</th>
                    <th className="py-2.5 px-3 text-center">PC</th>
                    <th className="py-2.5 px-3">목표수익</th>
                  </>
                ) : (
                  <>
                    <th className="py-2.5 px-3 text-center">커리큘럼</th>
                    <th className="py-2.5 px-3 text-center">피드백</th>
                    <th className="py-2.5 px-3">추천</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isExpanded = expandedRow === r.id;
                // Find matching pre/post response
                const matchedPre = preResponses.find((p) => p.name === r.name);
                const matchedPost = postResponses.find((p) => p.name === r.name);

                return (
                  <React.Fragment key={r.id}>
                    <tr
                      onClick={() => setExpandedRow(isExpanded ? null : r.id)}
                      className={`cursor-pointer border-b transition-colors ${
                        isExpanded ? "bg-primary/5" : "hover:bg-accent"
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold">{r.name}</td>
                      {viewMode === "pre" ? (
                        <>
                          <td className="py-2.5 px-3 text-center">{r.gender}</td>
                          <td className="py-2.5 px-3 text-center">{r.age}</td>
                          <td className="py-2.5 px-3 text-center">{r.job}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`font-bold ${
                                r.computer <= 4
                                  ? "text-red-600"
                                  : r.computer <= 6
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                              }`}
                            >
                              {r.computer}
                            </span>
                            /10
                          </td>
                          <td className="py-2.5 px-3">{r.goal}</td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`font-bold ${
                                r.ps1 >= 10 ? "text-emerald-600" : "text-primary"
                              }`}
                            >
                              {r.ps1}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`font-bold ${
                                r.ps2 >= 10 ? "text-emerald-600" : "text-primary"
                              }`}
                            >
                              {r.ps2}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[12px] text-muted-foreground">
                            {r.pRec}
                          </td>
                        </>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={viewMode === "pre" ? 6 : 4} className="p-0 border-b">
                          <div className="grid grid-cols-2 border-t-2 border-t-primary">
                            {/* Pre section */}
                            <div className="p-4 border-r">
                              <div className="text-[12px] font-bold text-primary mb-2.5">
                                📋 사전 설문
                              </div>
                              {matchedPre ? (
                                <>
                                  {[
                                    ["유입경로", matchedPre.channel],
                                    ["투자시간", matchedPre.hours],
                                    ["목표수익", matchedPre.goal],
                                  ].map(([l, v]) => (
                                    <div key={l} className="mb-1.5">
                                      <span className="text-[11px] text-muted-foreground block mb-0.5">
                                        {l}
                                      </span>
                                      <span className="text-[13px]">{v || "-"}</span>
                                    </div>
                                  ))}
                                  {matchedPre.hopePlatform && (
                                    <div className="mt-2">
                                      <span className="text-[11px] text-muted-foreground block mb-1">
                                        플랫폼에 바라는 점
                                      </span>
                                      <div className="text-[13px] bg-muted p-2.5 rounded-lg leading-relaxed whitespace-pre-wrap">
                                        {matchedPre.hopePlatform}
                                      </div>
                                    </div>
                                  )}
                                  {matchedPre.hopeInstructor && (
                                    <div className="mt-2">
                                      <span className="text-[11px] text-muted-foreground block mb-1">
                                        강사에게 바라는 점
                                      </span>
                                      <div className="text-[13px] bg-muted p-2.5 rounded-lg leading-relaxed whitespace-pre-wrap">
                                        {matchedPre.hopeInstructor}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-[12px] text-muted-foreground">
                                  사전 설문 데이터 없음
                                </div>
                              )}
                            </div>
                            {/* Post section */}
                            <div className="p-4">
                              <div className="text-[12px] font-bold text-emerald-600 mb-2.5">
                                ⭐ 후기 설문
                              </div>
                              {matchedPost ? (
                                <>
                                  <div className="flex gap-4 mb-2.5">
                                    <div>
                                      커리큘럼{" "}
                                      <strong className="text-[16px]">{matchedPost.ps1}</strong>/10
                                    </div>
                                    <div>
                                      피드백{" "}
                                      <strong className="text-[16px]">{matchedPost.ps2}</strong>/10
                                    </div>
                                  </div>
                                  {matchedPost.pFmt && (
                                    <div className="mb-1.5">
                                      <span className="text-[11px] text-muted-foreground">
                                        선호방식
                                      </span>{" "}
                                      <span className="text-[13px]">{matchedPost.pFmt}</span>
                                    </div>
                                  )}
                                  {matchedPost.pFree && (
                                    <div className="mt-2">
                                      <span className="text-[11px] text-muted-foreground block mb-1">
                                        자유 의견
                                      </span>
                                      <div className="text-[13px] bg-muted p-2.5 rounded-lg leading-relaxed whitespace-pre-wrap">
                                        {matchedPost.pFree}
                                      </div>
                                    </div>
                                  )}
                                  {matchedPost.pRec && (
                                    <div className="mt-2">
                                      <span className="text-[11px] text-muted-foreground block mb-1">
                                        추천의향
                                      </span>
                                      <div className="text-[13px] bg-muted p-2.5 rounded-lg leading-relaxed whitespace-pre-wrap">
                                        {matchedPost.pRec}
                                      </div>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-[12px] text-muted-foreground">
                                  후기 설문 데이터 없음
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
