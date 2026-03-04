"use client";

import { useState, useEffect, useMemo } from "react";
import type { SurveyResponse } from "@/lib/types";
import {
  computeDemographics,
  computeScores,
  getSatisfactionItems,
  collectExtraQuestions,
} from "@/lib/analysis-engine";
import {
  SummaryCard,
  ChartCard,
  DonutChart,
  HBarChart,
  RecDonut,
  ListBar,
  toChartData,
  toChartDataWithDefaults,
  toGenderData,
  AGE_GROUPS,
  pinItems,
} from "@/components/tab-overview";
import { RingScore } from "@/components/ring-score";
import { ErrorBoundary } from "@/components/error-boundary";
import { FIELD_LABELS, FIELD_ORDER } from "@/lib/feedback-utils";
import { Loader2, User, ChevronDown, ChevronUp, Download, Check, Star } from "lucide-react";

interface ShareInstructorViewProps {
  token: string;
  title: string;
  filters: {
    platform?: string | null;
    instructor?: string | null;
    cohort?: string | null;
    course?: string | null;
  };
}

interface ShareComment {
  id: string;
  original_text: string;
  sentiment: "positive" | "negative" | "neutral" | null;
  source_field: string;
}

interface InstructorPhoto {
  photo: string;
  photoPosition: string;
}

// 감정별 정렬 순서
const SENTIMENT_ORDER: Record<string, number> = { positive: 0, negative: 1, neutral: 2 };

function sentimentSort(a: ShareComment, b: ShareComment): number {
  const ao = SENTIMENT_ORDER[a.sentiment || "neutral"] ?? 2;
  const bo = SENTIMENT_ORDER[b.sentiment || "neutral"] ?? 2;
  return ao - bo;
}

// 사전/후기 분류
const PRE_SOURCE_FIELDS = new Set(["selectReason", "hopePlatform", "hopeInstructor", "prevExperience", "prevCourse", "expectedBenefit"]);

function shortLabel(field: string): string {
  return (FIELD_LABELS[field] || field).replace(/\s*\((사전|후기) 설문\)\s*$/, "");
}

const SECTION_THEME = {
  blue: {
    sectionBorder: "border-blue-200/60",
    sectionBg: "bg-blue-50/30",
    titleText: "text-blue-700",
    titleBorder: "border-blue-400/50",
    cardBorder: "border-blue-100",
    headerBg: "bg-blue-100/80",
    headerBorderB: "border-blue-200",
    headerText: "text-blue-900",
    countText: "text-blue-600",
    tocPill: "bg-blue-100/90 text-blue-800 border-blue-200 hover:bg-blue-200/90",
  },
  emerald: {
    sectionBorder: "border-emerald-200/60",
    sectionBg: "bg-emerald-50/30",
    titleText: "text-emerald-700",
    titleBorder: "border-emerald-400/50",
    cardBorder: "border-emerald-100",
    headerBg: "bg-emerald-100/80",
    headerBorderB: "border-emerald-200",
    headerText: "text-emerald-900",
    countText: "text-emerald-600",
    tocPill: "bg-emerald-100/90 text-emerald-800 border-emerald-200 hover:bg-emerald-200/90",
  },
} as const;

export function ShareInstructorView({ token, title, filters }: ShareInstructorViewProps) {
  const [preResponses, setPreResponses] = useState<SurveyResponse[]>([]);
  const [postResponses, setPostResponses] = useState<SurveyResponse[]>([]);
  const [comments, setComments] = useState<ShareComment[]>([]);
  const [instructorPhoto, setInstructorPhoto] = useState<InstructorPhoto | null>(null);
  const [cohorts, setCohorts] = useState<string[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [sentimentFilter, setSentimentFilter] = useState<"all" | "positive" | "negative" | "neutral">("all");
  const [viewMode, setViewMode] = useState<"default" | "starred" | "confirmed">("default");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/share/data?token=${token}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "데이터 로드 실패");
        }
        const data = await res.json();
        setPreResponses(data.preResponses || []);
        setPostResponses(data.postResponses || []);
        setComments(data.comments || []);
        setInstructorPhoto(data.instructorPhoto || null);
        setCohorts(data.cohorts || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "데이터 로드 실패");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const allResponses = useMemo(
    () => [...preResponses, ...postResponses],
    [preResponses, postResponses],
  );

  const demographics = useMemo(() => computeDemographics(allResponses), [allResponses]);
  const scores = useMemo(() => computeScores(postResponses), [postResponses]);
  const satItems = useMemo(() => getSatisfactionItems(postResponses), [postResponses]);
  const extraPreQuestions = useMemo(() => collectExtraQuestions(preResponses), [preResponses]);
  const extraPostQuestions = useMemo(() => collectExtraQuestions(postResponses), [postResponses]);

  // 선호 강의 방식
  const fmtData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of postResponses) {
      const fmt = typeof r.pFmt === "string" ? r.pFmt : String(r.pFmt ?? "");
      if (!fmt) continue;
      for (const p of fmt.split("|").map((s) => s.trim())) {
        if (p) counts[p] = (counts[p] || 0) + 1;
      }
    }
    return toChartData(counts);
  }, [postResponses]);

  // 댓글: 문항(source_field)별 그룹핑 + 각 그룹 내 감정 정렬
  const allGroups = useMemo(() => {
    const groups: Record<string, ShareComment[]> = {};
    for (const c of comments) {
      if (c.source_field === "hopePlatform") continue; // 플랫폼 피드백 제외
      const key = c.source_field || "_unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    const entries = Object.entries(groups).sort(([a], [b]) => {
      const ai = FIELD_ORDER.indexOf(a);
      const bi = FIELD_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return entries.map(([field, items]) => ({
      field,
      label: shortLabel(field),
      items: [...items].sort(sentimentSort),
    }));
  }, [comments]);

  // 사전/후기 분리 + 감정 필터 + 보기 모드 적용
  const applyFilters = (groups: typeof allGroups) => {
    let result = groups;
    if (sentimentFilter !== "all") {
      const match = (s: string | null) => sentimentFilter === "neutral" ? (s === "neutral" || s === null) : s === sentimentFilter;
      result = result.map((g) => ({ ...g, items: g.items.filter((c) => match(c.sentiment)) }));
    }
    if (viewMode === "default") {
      result = result.map((g) => ({ ...g, items: g.items.filter((c) => !confirmedIds.has(c.id)) }));
    } else if (viewMode === "starred") {
      result = result.map((g) => ({ ...g, items: g.items.filter((c) => starredIds.has(c.id)) }));
    } else if (viewMode === "confirmed") {
      result = result.map((g) => ({ ...g, items: g.items.filter((c) => confirmedIds.has(c.id)) }));
    }
    return result.filter((g) => g.items.length > 0);
  };

  const preGroups = useMemo(
    () => applyFilters(allGroups.filter((g) => PRE_SOURCE_FIELDS.has(g.field))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allGroups, sentimentFilter, viewMode, confirmedIds, starredIds],
  );

  const postGroups = useMemo(
    () => applyFilters(allGroups.filter((g) => !PRE_SOURCE_FIELDS.has(g.field))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allGroups, sentimentFilter, viewMode, confirmedIds, starredIds],
  );

  // 감정별 카운트
  const sentimentCounts = useMemo(() => ({
    total: comments.length,
    positive: comments.filter((c) => c.sentiment === "positive").length,
    negative: comments.filter((c) => c.sentiment === "negative").length,
    neutral: comments.filter((c) => c.sentiment === "neutral" || c.sentiment === null).length,
  }), [comments]);

  const toggleCollapse = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleConfirm = (id: string) => {
    setConfirmedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // 별표 시 자동으로 확인 처리
    setConfirmedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const downloadExcel = (items: ShareComment[], filename: string) => {
    const SENT_LABEL: Record<string, string> = { positive: "긍정", negative: "개선", neutral: "기타" };
    const header = "항목\t감정\t내용\n";
    const rows = items.map((c) =>
      `${FIELD_LABELS[c.source_field] || c.source_field}\t${SENT_LABEL[c.sentiment || "neutral"] || "기타"}\t${c.original_text.replace(/\t/g, " ").replace(/\n/g, " ")}`
    ).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + header + rows], { type: "text/tab-separated-values;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // chart data
  const gender = useMemo(() => toGenderData(demographics.gender), [demographics.gender]);
  const ageData = useMemo(() => toChartDataWithDefaults(demographics.age, AGE_GROUPS), [demographics.age]);
  const jobData = useMemo(() => pinItems(toChartData(demographics.job), { bottom: ["기타"] }), [demographics.job]);
  const hoursData = useMemo(() => toChartData(demographics.hours), [demographics.hours]);
  const channelData = useMemo(() => toChartData(demographics.channel), [demographics.channel]);
  const expectedBenefitData = useMemo(
    () => pinItems(toChartData(demographics.expectedBenefit), { bottom: ["기타"] }),
    [demographics.expectedBenefit],
  );
  const prevCourseData = useMemo(() => toChartData(demographics.prevCourse), [demographics.prevCourse]);
  const satData = useMemo(() => satItems.map((s) => ({ name: s.label, value: s.count })), [satItems]);
  const computerData = useMemo(
    () =>
      Object.entries(demographics.computer.distribution)
        .map(([score, count]) => ({ name: `${score}점`, value: count }))
        .sort((a, b) => parseInt(a.name) - parseInt(b.name)),
    [demographics.computer.distribution],
  );

  // 기수 필터 사용 여부: filter_cohort가 없을 때(전체)만 드롭다운 표시
  const showCohortFilter = !filters.cohort && cohorts.length > 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <div className="text-sm text-muted-foreground">데이터를 불러오는 중입니다...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-bold mb-2">오류가 발생했습니다</div>
          <div className="text-sm text-muted-foreground">{error}</div>
        </div>
      </div>
    );
  }

  const noData = preResponses.length === 0 && postResponses.length === 0;

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <header className="py-4 px-4 sm:px-6 border-b bg-card sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto flex items-center gap-2.5">
          <img src="/fitchnic-logo.png" alt="핏크닉" className="h-[22px] w-auto" />
          <span className="text-sm font-extrabold">클래스 인사이트</span>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* 강사 프로필 + 제목 */}
        <div className="flex items-center gap-4 mb-3">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-border/50">
            {instructorPhoto?.photo ? (
              <img
                src={instructorPhoto.photo}
                alt={filters.instructor || "강사"}
                className="w-full h-full object-contain"
                style={{ objectPosition: instructorPhoto.photoPosition || "center 2%" }}
              />
            ) : (
              <User className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold">{title}</h1>
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              {filters.platform && (
                <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {filters.platform}
                </span>
              )}
              {filters.instructor && (
                <span className="px-2.5 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-semibold border border-orange-200">
                  {filters.instructor}
                </span>
              )}
              {filters.course && (
                <span className="px-2.5 py-1 rounded-full bg-muted text-xs font-medium">
                  {filters.course}
                </span>
              )}
              {filters.cohort && (
                <span className="px-2.5 py-1 rounded-full bg-muted text-xs font-medium">
                  {filters.cohort}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 기수 필터 드롭다운 (전체 기수 링크일 때만) */}
        {showCohortFilter && (
          <div className="mb-6 mt-2">
            <div className="relative inline-flex items-center">
              <select
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
                className="appearance-none py-1.5 pl-3 pr-8 rounded-lg border text-[13px] bg-card font-medium cursor-pointer"
              >
                <option value="all">전체 기수</option>
                {cohorts.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 pointer-events-none text-muted-foreground" />
            </div>
          </div>
        )}

        {/* 기수 필터 미사용 시 마진 */}
        {!showCohortFilter && <div className="mb-6" />}

        {noData && comments.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <div className="text-lg font-bold mb-1">표시할 데이터가 없습니다</div>
            <div className="text-sm">아직 설문 응답이 등록되지 않았습니다.</div>
          </div>
        )}

        {/* 요약 카드 */}
        {!noData && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <SummaryCard label="사전 응답 수" value={`${preResponses.length}명`} tip="강의 시작 전 사전 설문에 참여한 총 응답자 수입니다." />
              <SummaryCard label="후기 응답 수" value={`${postResponses.length}명`} tip="강의 종료 후 후기 설문에 참여한 총 응답자 수입니다." />
              <SummaryCard
                label="만족도 점수"
                value={
                  scores.ps1Avg > 0 || scores.ps2Avg > 0
                    ? `${((scores.ps1Avg + scores.ps2Avg) / (scores.ps1Avg > 0 && scores.ps2Avg > 0 ? 2 : 1)).toFixed(1)}`
                    : "-"
                }
                sub="10점 만점"
                tip="후기 설문의 '커리큘럼 만족도'와 '피드백 만족도' 점수를 10점 만점으로 환산한 평균값입니다. 아래 '커리큘럼 / 피드백 만족도' 차트에서 각 항목의 세부 점수를 확인할 수 있습니다."
              />
              <SummaryCard
                label="추천률"
                value={postResponses.length > 0 ? `${scores.recRate}%` : "-"}
                tip="후기 설문 '이 강의를 지인분들께 추천하실 것 같으신가요?' 문항에서 긍정 응답('네', '예' 등)을 한 비율입니다. 아래 '지인 추천 의향' 차트에서 세부 분포를 확인할 수 있습니다."
              />
            </div>

            {/* 차트 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 mb-6 sm:mb-8">
              <ErrorBoundary name="성별">
                <ChartCard title="성별" empty={gender.data.length === 0}>
                  <DonutChart data={gender.data} colors={gender.colors} />
                </ChartCard>
              </ErrorBoundary>

              <ErrorBoundary name="연령대">
                <ChartCard title="연령대" empty={ageData.length === 0}>
                  <HBarChart data={ageData} />
                </ChartCard>
              </ErrorBoundary>

              <ErrorBoundary name="직업">
                <ChartCard title="현재 하고 계신 일" empty={jobData.length === 0}>
                  <HBarChart data={jobData} />
                </ChartCard>
              </ErrorBoundary>

              <ErrorBoundary name="부업시간">
                <ChartCard title="부업에 투자할 수 있는 시간" empty={hoursData.length === 0}>
                  <HBarChart data={hoursData} />
                </ChartCard>
              </ErrorBoundary>

              <ErrorBoundary name="컴퓨터활용">
                <ChartCard
                  title={`컴퓨터 활용 능력${demographics.computer.avg > 0 ? ` (평균 ${demographics.computer.avg}점)` : ""}`}
                  empty={computerData.length === 0}
                >
                  <HBarChart data={computerData} />
                </ChartCard>
              </ErrorBoundary>

              <ErrorBoundary name="유입경로">
                <ChartCard title="알게 되신 경로" empty={channelData.length === 0}>
                  <HBarChart data={channelData} />
                </ChartCard>
              </ErrorBoundary>

              <ErrorBoundary name="수강이력">
                <ChartCard title="핏크닉 다른 정규강의 수강 이력" empty={prevCourseData.length === 0}>
                  <DonutChart data={prevCourseData} colors={["#3451B2", "#889096"]} />
                </ChartCard>
              </ErrorBoundary>

              <ErrorBoundary name="기대혜택">
                <ChartCard title="가장 기대되는 혜택" empty={expectedBenefitData.length === 0}>
                  <ListBar data={expectedBenefitData} hidePercent largeText />
                </ChartCard>
              </ErrorBoundary>

              <ErrorBoundary name="만족사항">
                <ChartCard title="수강 과정 중 만족스러웠던 점" empty={satData.length === 0}>
                  <HBarChart data={satData} />
                </ChartCard>
              </ErrorBoundary>

              <ErrorBoundary name="선호방식">
                <ChartCard title="선호하는 강의 방식" empty={fmtData.length === 0}>
                  <ListBar data={fmtData} hidePercent largeText />
                </ChartCard>
              </ErrorBoundary>

              <ErrorBoundary name="커리큘럼만족도">
                <ChartCard title="커리큘럼 / 피드백 만족도" empty={postResponses.length === 0}>
                  <div className="flex items-center justify-center gap-8 py-4">
                    <RingScore score={scores.ps1Avg} size={80} label="커리큘럼" excluded={scores.ps1Excluded} />
                    <RingScore score={scores.ps2Avg} size={80} label="피드백" excluded={scores.ps2Excluded} />
                  </div>
                </ChartCard>
              </ErrorBoundary>

              <ErrorBoundary name="추천의향">
                <ChartCard title="지인 추천 의향" empty={postResponses.length === 0}>
                  <RecDonut postResponses={postResponses} />
                </ChartCard>
              </ErrorBoundary>

              {/* 동적 사전 설문 질문 */}
              {extraPreQuestions.map((eq, i) => (
                <ErrorBoundary key={`pre-${i}`} name={`사전동적-${i}`}>
                  <ChartCard title={eq.question}>
                    <ListBar data={toChartData(eq.summary)} hidePercent largeText />
                  </ChartCard>
                </ErrorBoundary>
              ))}

              {/* 동적 후기 설문 질문 */}
              {extraPostQuestions.map((eq, i) => (
                <ErrorBoundary key={`post-${i}`} name={`후기동적-${i}`}>
                  <ChartCard title={eq.question}>
                    <ListBar data={toChartData(eq.summary)} hidePercent largeText />
                  </ChartCard>
                </ErrorBoundary>
              ))}
            </div>
          </>
        )}

        {/* 수강생 피드백 섹션 */}
        {comments.length > 0 && (
          <div className="border-t pt-6 sm:pt-8">
            {/* 제목 + 다운로드 */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <h2 className="text-xl font-extrabold">수강생 피드백</h2>
              <button
                type="button"
                onClick={() => {
                  const target = viewMode === "starred"
                    ? comments.filter((c) => starredIds.has(c.id))
                    : comments;
                  downloadExcel(target, `${filters.instructor || "피드백"}_수강생피드백`);
                }}
                className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                {viewMode === "starred" ? `중요 ${starredIds.size}건 다운로드` : "전체 다운로드"}
              </button>
            </div>

            {/* 목차 + 필터 (sticky) */}
            <nav className="sticky top-[57px] z-[5] rounded-xl border bg-card/95 backdrop-blur p-3 shadow-sm mb-5">
              {/* 보기 모드 + 감정 필터 */}
              <div className="flex items-center gap-3 mb-2.5 pb-2.5 border-b flex-wrap">
                {/* 보기 모드 탭 */}
                <div className="flex items-center gap-1 border rounded-lg p-0.5 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setViewMode("default")}
                    className={`py-1 px-2.5 rounded-md text-[12px] font-semibold transition-colors ${
                      viewMode === "default" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    미확인
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("starred")}
                    className={`py-1 px-2.5 rounded-md text-[12px] font-semibold transition-colors flex items-center gap-1 ${
                      viewMode === "starred" ? "bg-card text-amber-600 shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Star className={`w-3 h-3 ${viewMode === "starred" ? "fill-amber-400" : ""}`} />
                    중요{starredIds.size > 0 ? ` ${starredIds.size}` : ""}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("confirmed")}
                    className={`py-1 px-2.5 rounded-md text-[12px] font-semibold transition-colors flex items-center gap-1 ${
                      viewMode === "confirmed" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Check className="w-3 h-3" />
                    확인됨{confirmedIds.size > 0 ? ` ${confirmedIds.size}` : ""}
                  </button>
                </div>

                {/* 감정 필터 */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground mr-0.5">감정</span>
                  {([
                    ["all", "전체", sentimentCounts.total, "bg-muted/80 text-foreground border-border hover:bg-muted", "ring-1 ring-primary bg-primary/10 border-primary text-primary"],
                    ["positive", "긍정", sentimentCounts.positive, "bg-emerald-50/80 text-emerald-700 border-emerald-200 hover:bg-emerald-100", "ring-1 ring-emerald-500 bg-emerald-100 border-emerald-400 text-emerald-800"],
                    ["negative", "개선", sentimentCounts.negative, "bg-red-50/80 text-red-700 border-red-200 hover:bg-red-100", "ring-1 ring-red-500 bg-red-100 border-red-400 text-red-800"],
                    ["neutral", "기타", sentimentCounts.neutral, "bg-gray-50/80 text-gray-600 border-gray-200 hover:bg-gray-100", "ring-1 ring-gray-400 bg-gray-100 border-gray-400 text-gray-700"],
                  ] as const).map(([key, label, count, normalCls, activeCls]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSentimentFilter(sentimentFilter === key ? "all" : key)}
                      className={`py-1 px-2 rounded-md text-[12px] font-semibold border transition-colors ${sentimentFilter === key ? activeCls : normalCls}`}
                    >
                      {label} {count}
                    </button>
                  ))}
                </div>
              </div>

              {/* 항목 목차 */}
              <div className="text-[11px] font-semibold text-muted-foreground mb-2 px-0.5">
                목차 (클릭하면 이동)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preGroups.map(({ field, label, items }) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => document.getElementById(`fb-${field}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className={`py-1.5 px-2.5 rounded-md text-[13px] font-medium border transition-colors ${SECTION_THEME.blue.tocPill}`}
                  >
                    {label}
                    <span className="ml-1 text-[11px] opacity-70">{items.length}</span>
                  </button>
                ))}
                {postGroups.map(({ field, label, items }) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => document.getElementById(`fb-${field}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                    className={`py-1.5 px-2.5 rounded-md text-[13px] font-medium border transition-colors ${SECTION_THEME.emerald.tocPill}`}
                  >
                    {label}
                    <span className="ml-1 text-[11px] opacity-70">{items.length}</span>
                  </button>
                ))}
              </div>
            </nav>

            {/* 필터 결과 없음 */}
            {preGroups.length === 0 && postGroups.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-[14px]">
                {viewMode === "starred" ? "중요한 피드백이 없습니다." : viewMode === "confirmed" ? "확인한 피드백이 없습니다." : "해당 조건의 피드백이 없습니다."}
              </div>
            )}

            <div className="grid gap-8">
              {/* 사전 설문 피드백 (Blue) */}
              {preGroups.length > 0 && (
                <section className="rounded-xl border border-blue-200/60 bg-blue-50/30 p-4 sm:p-5 scroll-mt-24">
                  <h3 className="text-[16px] font-bold text-blue-700 mb-4 pb-2 border-b border-blue-400/50">
                    사전 설문 피드백
                  </h3>
                  <div className="grid gap-6">
                    {preGroups.map(({ field, label, items }) => {
                      const t = SECTION_THEME.blue;
                      const sectionKey = `field-${field}`;
                      const isCollapsed = collapsedSections.has(sectionKey);
                      return (
                        <div key={field} id={`fb-${field}`} className={`rounded-xl border bg-card overflow-hidden ${t.cardBorder} scroll-mt-[6rem]`}>
                          <button
                            type="button"
                            onClick={() => toggleCollapse(sectionKey)}
                            className={`w-full py-2.5 px-4 ${t.headerBg} border-b ${t.headerBorderB} text-left flex items-center gap-2 hover:opacity-90 transition-opacity`}
                          >
                            {isCollapsed ? <ChevronDown className="w-4 h-4 text-blue-600 shrink-0" /> : <ChevronUp className="w-4 h-4 text-blue-600 shrink-0" />}
                            <span className={`text-[15px] font-bold ${t.headerText} flex-1`}>{label}</span>
                            <span className={`text-[12px] font-medium ${t.countText}`}>{items.length}건</span>
                          </button>
                          {!isCollapsed && (
                            <div className="divide-y divide-muted/30">
                              {items.map((c) => {
                                const sentDot = c.sentiment === "positive" ? "bg-emerald-500" : c.sentiment === "negative" ? "bg-red-400" : "bg-gray-300";
                                const isStarred = starredIds.has(c.id);
                                return (
                                  <div key={c.id} className={`flex items-start gap-2.5 py-3.5 px-4 transition-colors ${isStarred ? "bg-amber-50/40" : ""}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${sentDot} mt-[9px] shrink-0`} />
                                    <span className="text-[15px] text-foreground/85 leading-[1.75] flex-1">{c.original_text}</span>
                                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                      <button type="button" onClick={() => toggleStar(c.id)} className="p-1 rounded hover:bg-muted/50 transition-colors">
                                        <Star className={`w-4 h-4 transition-colors ${isStarred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25 hover:text-muted-foreground/50"}`} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleConfirm(c.id)}
                                        className="py-1 px-2.5 rounded-md text-[11px] font-semibold border border-muted text-muted-foreground/60 hover:border-foreground/30 hover:text-foreground transition-colors"
                                      >
                                        확인
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 후기 설문 피드백 (Emerald) */}
              {postGroups.length > 0 && (
                <section className="rounded-xl border border-emerald-200/60 bg-emerald-50/30 p-4 sm:p-5 scroll-mt-24">
                  <h3 className="text-[16px] font-bold text-emerald-700 mb-4 pb-2 border-b border-emerald-400/50">
                    후기 설문 피드백
                  </h3>
                  <div className="grid gap-6">
                    {postGroups.map(({ field, label, items }) => {
                      const t = SECTION_THEME.emerald;
                      const sectionKey = `field-${field}`;
                      const isCollapsed = collapsedSections.has(sectionKey);
                      return (
                        <div key={field} id={`fb-${field}`} className={`rounded-xl border bg-card overflow-hidden ${t.cardBorder} scroll-mt-[6rem]`}>
                          <button
                            type="button"
                            onClick={() => toggleCollapse(sectionKey)}
                            className={`w-full py-2.5 px-4 ${t.headerBg} border-b ${t.headerBorderB} text-left flex items-center gap-2 hover:opacity-90 transition-opacity`}
                          >
                            {isCollapsed ? <ChevronDown className="w-4 h-4 text-emerald-600 shrink-0" /> : <ChevronUp className="w-4 h-4 text-emerald-600 shrink-0" />}
                            <span className={`text-[15px] font-bold ${t.headerText} flex-1`}>{label}</span>
                            <span className={`text-[12px] font-medium ${t.countText}`}>{items.length}건</span>
                          </button>
                          {!isCollapsed && (
                            <div className="divide-y divide-muted/30">
                              {items.map((c) => {
                                const sentDot = c.sentiment === "positive" ? "bg-emerald-500" : c.sentiment === "negative" ? "bg-red-400" : "bg-gray-300";
                                const isStarred = starredIds.has(c.id);
                                return (
                                  <div key={c.id} className={`flex items-start gap-2.5 py-3.5 px-4 transition-colors ${isStarred ? "bg-amber-50/40" : ""}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${sentDot} mt-[9px] shrink-0`} />
                                    <span className="text-[15px] text-foreground/85 leading-[1.75] flex-1">{c.original_text}</span>
                                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                      <button type="button" onClick={() => toggleStar(c.id)} className="p-1 rounded hover:bg-muted/50 transition-colors">
                                        <Star className={`w-4 h-4 transition-colors ${isStarred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25 hover:text-muted-foreground/50"}`} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => toggleConfirm(c.id)}
                                        className="py-1 px-2.5 rounded-md text-[11px] font-semibold border border-muted text-muted-foreground/60 hover:border-foreground/30 hover:text-foreground transition-colors"
                                      >
                                        확인
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {/* 푸터 */}
        <footer className="mt-10 sm:mt-12 pt-4 border-t text-center text-xs text-muted-foreground">
          Powered by 핏크닉 클래스 인사이트
        </footer>
      </div>
    </div>
  );
}
