"use client";

import React, { useState, useMemo } from "react";
import type { Instructor, Cohort, SurveyResponse } from "@/lib/types";
import { computeDemographics, computeScores, getTopStats, getSatisfactionItems } from "@/lib/analysis-engine";
import { StatCard } from "./stat-card";
import { BarChart } from "./bar-chart";
import { RingScore } from "./ring-score";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

interface TabDataProps {
  instructor: Instructor;
  cohort: Cohort | null;
}

export function TabData({ instructor, cohort }: TabDataProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<"pre" | "post">("pre");
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("전체");
  const [filterAge, setFilterAge] = useState("전체");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const preResponses = cohort
    ? cohort.preResponses
    : instructor.cohorts.flatMap((c) => c.preResponses);
  const postResponses = cohort
    ? cohort.postResponses
    : instructor.cohorts.flatMap((c) => c.postResponses);

  const toggle = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const hasData = preResponses.length > 0 || postResponses.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="text-[30px] opacity-25 mb-2">📊</div>
        <div className="text-[14px] font-bold">데이터가 없습니다</div>
        <div className="text-[13px] mt-1">설문 파일을 업로드하면 데이터가 표시됩니다</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {/* Section: 인구통계 */}
      {preResponses.length > 0 && (
        <CollapsibleSection
          title="인구통계"
          icon="📊"
          isOpen={!!openSections["demo"]}
          onToggle={() => toggle("demo")}
          badge={`${preResponses.length}명 응답`}
        >
          <DemographicsContent responses={preResponses} />
        </CollapsibleSection>
      )}

      {/* Section: 만족도 점수 */}
      {postResponses.length > 0 && (
        <CollapsibleSection
          title="만족도 점수"
          icon="⭐"
          isOpen={!!openSections["scores"]}
          onToggle={() => toggle("scores")}
          badge={`${postResponses.length}명 응답`}
        >
          <ScoresContent responses={postResponses} preCount={preResponses.length} />
        </CollapsibleSection>
      )}

      {/* Section: 응답 원본 */}
      <CollapsibleSection
        title="응답 원본 테이블"
        icon="📋"
        isOpen={!!openSections["raw"]}
        onToggle={() => toggle("raw")}
        badge={`${preResponses.length + postResponses.length}건`}
      >
        <RawResponsesContent
          preResponses={preResponses}
          postResponses={postResponses}
          viewMode={viewMode}
          setViewMode={setViewMode}
          search={search}
          setSearch={setSearch}
          filterGender={filterGender}
          setFilterGender={setFilterGender}
          filterAge={filterAge}
          setFilterAge={setFilterAge}
          expandedRow={expandedRow}
          setExpandedRow={setExpandedRow}
        />
      </CollapsibleSection>
    </div>
  );
}

// ---- Collapsible Section ----

function CollapsibleSection({
  title,
  icon,
  isOpen,
  onToggle,
  badge,
  children,
}: {
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3.5 px-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[14px]">{icon}</span>
          <span className="text-[14px] font-bold">{title}</span>
          {badge && (
            <span className="text-[11px] text-muted-foreground font-normal">
              ({badge})
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && <div className="p-4 pt-0 border-t">{children}</div>}
    </div>
  );
}

// ---- Demographics ----

function DemographicsContent({ responses }: { responses: SurveyResponse[] }) {
  const stats = computeDemographics(responses);
  const topStats = getTopStats(responses);

  const sortedEntries = (obj: Record<string, number>) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));

  return (
    <div className="grid gap-4 pt-4">
      {topStats.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {topStats.map((s, i) => (
            <StatCard key={i} label={s.label} desc={s.desc} num={s.num} src={s.src} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="text-[14px] font-bold mb-3">성별</div>
          <BarChart data={sortedEntries(stats.gender)} color="#8B5CF6" suffix="명" />
        </div>
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="text-[14px] font-bold mb-3">연령대</div>
          <BarChart data={sortedEntries(stats.age)} color="#3451B2" suffix="명" />
        </div>
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="text-[14px] font-bold mb-3">직업</div>
          <BarChart data={sortedEntries(stats.job)} color="#1A8754" suffix="명" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <div className="text-[14px] font-bold">컴퓨터 활용도</div>
            <span className="text-[12px] text-muted-foreground">
              평균 <strong className="text-foreground">{stats.computer.avg}</strong>/10
            </span>
          </div>
          <div className="flex items-end gap-1 h-[60px]">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((k) => {
              const v = stats.computer.distribution[k] || 0;
              const maxVal = Math.max(...Object.values(stats.computer.distribution), 1);
              return (
                <div key={k} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-muted-foreground">{v || ""}</span>
                  <div
                    className="w-full rounded-sm"
                    style={{
                      height: Math.max((v / maxVal) * 46, 2),
                      background: k <= 4 ? "#C13838" : k <= 6 ? "#B45309" : "#1A8754",
                      opacity: 0.6,
                    }}
                  />
                  <span className="text-[10px] text-muted-foreground">{k}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-muted/50 rounded-xl p-4">
          <div className="text-[14px] font-bold mb-3">목표 수익</div>
          <BarChart data={sortedEntries(stats.goal)} color="#1A8754" suffix="명" />
        </div>
      </div>
    </div>
  );
}

// ---- Scores ----

function ScoresContent({
  responses,
  preCount,
}: {
  responses: SurveyResponse[];
  preCount: number;
}) {
  const scores = computeScores(responses);
  const satItems = getSatisfactionItems(responses);

  return (
    <div className="grid grid-cols-2 gap-4 pt-4">
      {satItems.length > 0 && (
        <div className="bg-muted/50 rounded-xl p-4 border-t-[3px] border-t-emerald-500">
          <div className="text-[14px] font-bold mb-3">만족도 항목</div>
          {satItems.map((item, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 border-b last:border-0">
              <span className="text-[13px]">{item.label}</span>
              <span className="text-[13px] font-bold text-emerald-600">
                {item.pct}% ({item.count}명)
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-muted/50 rounded-xl p-4">
        <div className="text-[14px] font-bold mb-3">만족도 점수</div>
        <div className="flex flex-col gap-3.5">
          {[
            { q: "커리큘럼", s: scores.ps1Avg },
            { q: "강사 피드백", s: scores.ps2Avg },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <RingScore score={item.s} size={46} />
              <div>
                <div className="text-[13px] font-semibold">{item.q}</div>
                <div className="text-[12px] text-muted-foreground">{item.s}/10</div>
              </div>
            </div>
          ))}
          {scores.recRate > 0 && (
            <div className="mt-2 py-2.5 px-3 bg-background rounded-lg text-[13px] text-muted-foreground">
              추천률 <strong className="text-emerald-600">{scores.recRate}%</strong> (
              {responses.filter((r) => /네|넵|추천|강추|할|싶/i.test(r.pRec)).length}/
              {responses.length}명)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Raw Responses ----

function RawResponsesContent({
  preResponses,
  postResponses,
  viewMode,
  setViewMode,
  search,
  setSearch,
  filterGender,
  setFilterGender,
  filterAge,
  setFilterAge,
  expandedRow,
  setExpandedRow,
}: {
  preResponses: SurveyResponse[];
  postResponses: SurveyResponse[];
  viewMode: "pre" | "post";
  setViewMode: (v: "pre" | "post") => void;
  search: string;
  setSearch: (v: string) => void;
  filterGender: string;
  setFilterGender: (v: string) => void;
  filterAge: string;
  setFilterAge: (v: string) => void;
  expandedRow: string | null;
  setExpandedRow: (v: string | null) => void;
}) {
  const responses = viewMode === "pre" ? preResponses : postResponses;

  const genders = useMemo(
    () => ["전체", ...new Set(preResponses.map((r) => r.gender).filter(Boolean))],
    [preResponses]
  );
  const ages = useMemo(
    () => ["전체", ...new Set(preResponses.map((r) => r.age).filter(Boolean))],
    [preResponses]
  );

  const filtered = useMemo(() => {
    return responses.filter((r) => {
      if (search) {
        const s = search.toLowerCase();
        const searchable = [r.name, r.hopePlatform, r.hopeInstructor, r.pFree, r.goal]
          .join(" ")
          .toLowerCase();
        if (!searchable.includes(s)) return false;
      }
      if (filterGender !== "전체" && r.gender !== filterGender) return false;
      if (filterAge !== "전체" && r.age !== filterAge) return false;
      return true;
    });
  }, [responses, search, filterGender, filterAge]);

  return (
    <div className="grid gap-3 pt-4">
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
                g === filterGender
                  ? "bg-primary text-primary-foreground font-bold"
                  : "text-muted-foreground"
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
