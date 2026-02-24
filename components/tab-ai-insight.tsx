"use client";

import { useState, useEffect, useMemo } from "react";
import type { Instructor, Cohort, AnalysisResult } from "@/lib/types";
import { computeScores } from "@/lib/analysis-engine";
import { RingScore } from "./ring-score";
import { Loader2, RefreshCw, AlertTriangle, Flame, ThumbsUp, Lightbulb } from "lucide-react";
import { toast } from "sonner";

interface TabAIInsightProps {
  instructor: Instructor;
  cohort: Cohort | null;
  platformName: string;
}

interface RiskSignal {
  label: string;
  detail: string;
  severity: "high" | "medium";
}

export function TabAIInsight({ instructor, cohort, platformName }: TabAIInsightProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const cohortLabel = cohort?.label || null;

  // 로컬 점수 계산
  const scores = useMemo(() => {
    const postResponses = cohort
      ? cohort.postResponses
      : instructor.cohorts.flatMap((c) => c.postResponses);
    return computeScores(postResponses);
  }, [instructor, cohort]);

  const preCount = useMemo(() => {
    return cohort
      ? cohort.preResponses.length
      : instructor.cohorts.reduce((a, c) => a + c.preResponses.length, 0);
  }, [instructor, cohort]);

  const postCount = useMemo(() => {
    return cohort
      ? cohort.postResponses.length
      : instructor.cohorts.reduce((a, c) => a + c.postResponses.length, 0);
  }, [instructor, cohort]);

  // 리스크 시그널 계산
  const risks = useMemo((): RiskSignal[] => {
    const signals: RiskSignal[] = [];

    // 후기 응답률
    if (preCount > 0) {
      const responseRate = Math.round((postCount / preCount) * 100);
      if (responseRate < 50) {
        signals.push({
          label: "낮은 후기 응답률",
          detail: `후기 응답률 ${responseRate}% (${postCount}/${preCount}명)`,
          severity: responseRate < 30 ? "high" : "medium",
        });
      }
    }

    // 낮은 점수
    if (postCount > 0) {
      if (scores.ps1Avg > 0 && scores.ps1Avg < 3.5) {
        signals.push({
          label: "커리큘럼 만족도 낮음",
          detail: `커리큘럼 점수 ${scores.ps1Avg}/5`,
          severity: scores.ps1Avg < 3 ? "high" : "medium",
        });
      }
      if (scores.ps2Avg > 0 && scores.ps2Avg < 3.5) {
        signals.push({
          label: "피드백 만족도 낮음",
          detail: `피드백 점수 ${scores.ps2Avg}/5`,
          severity: scores.ps2Avg < 3 ? "high" : "medium",
        });
      }
    }

    // 동일 테마 불만 3건+
    if (analysis?.complaints) {
      for (const c of analysis.complaints) {
        if (c.count >= 3) {
          signals.push({
            label: `"${c.theme}" 불만 반복`,
            detail: `${c.count}건 반복`,
            severity: c.count >= 5 ? "high" : "medium",
          });
        }
      }
    }

    return signals;
  }, [scores, preCount, postCount, analysis]);

  // 캐시 확인
  useEffect(() => {
    loadCache();
  }, [platformName, instructor.name, cohortLabel]);

  const loadCache = async () => {
    try {
      const params = new URLSearchParams({
        platform: platformName,
        instructor: instructor.name,
      });
      if (cohortLabel) params.set("cohort", cohortLabel);

      const res = await fetch(`/api/analyze-themes?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && (data.complaints || data.suggestions || data.strengths)) {
        setAnalysis(data);
        setLoaded(true);
      }
    } catch {
      // 캐시 없으면 무시
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const postResponses = cohort
        ? cohort.postResponses
        : instructor.cohorts.flatMap((c) => c.postResponses);
      const preResponses = cohort
        ? cohort.preResponses
        : instructor.cohorts.flatMap((c) => c.preResponses);

      const freeTexts = postResponses
        .filter((r) => r.pFree && r.pFree.trim().length > 4)
        .map((r) => ({ name: r.name, text: r.pFree }));

      const hopeTexts = [
        ...preResponses
          .filter((r) => r.hopePlatform && r.hopePlatform.trim().length > 4)
          .map((r) => ({ name: r.name, text: r.hopePlatform })),
        ...preResponses
          .filter((r) => r.hopeInstructor && r.hopeInstructor.trim().length > 4)
          .map((r) => ({ name: r.name, text: r.hopeInstructor })),
      ];

      const res = await fetch("/api/analyze-themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorName: instructor.name,
          freeTexts,
          hopeTexts,
          platform: platformName,
          instructor: instructor.name,
          cohort: cohortLabel,
        }),
      });

      if (!res.ok) throw new Error();
      const data: AnalysisResult = await res.json();
      setAnalysis(data);
      setLoaded(true);
      toast.success("AI 분석 완료");
    } catch {
      toast.error("AI 분석 실패");
    } finally {
      setLoading(false);
    }
  };

  const hasScores = postCount > 0;

  return (
    <div className="grid gap-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <span className="text-[16px] font-extrabold">AI 인사이트</span>
        </div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="py-1.5 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {loading ? "분석 중..." : "분석 요청"}
        </button>
      </div>

      {/* 요약 통계 */}
      {hasScores && (
        <div className="bg-card rounded-xl border p-5">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex gap-3 items-center">
              <RingScore score={scores.ps1Avg} label="커리큘럼" />
              <RingScore score={scores.ps2Avg} label="피드백" />
            </div>
            <div className="border-l pl-5 grid gap-1 text-[14px]">
              {scores.recRate > 0 && (
                <div title="후기 설문의 추천 의향 문항(pRec) 응답 기준">
                  추천률{" "}
                  <strong className={scores.recRate >= 80 ? "text-emerald-600" : "text-amber-600"}>
                    {scores.recRate}%
                  </strong>
                  <span className="text-[11px] text-muted-foreground ml-1">(후기 설문 추천 의향 문항 기준)</span>
                </div>
              )}
              <div className="text-muted-foreground">
                응답률{" "}
                <strong className="text-foreground">
                  {preCount > 0 ? Math.round((postCount / preCount) * 100) : 0}%
                </strong>{" "}
                ({postCount}/{preCount}명)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 리스크 시그널 */}
      {risks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-[14px] font-bold text-amber-800">리스크 시그널</span>
          </div>
          <ul className="grid gap-1.5">
            {risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px]">
                <span
                  className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                    r.severity === "high" ? "bg-red-500" : "bg-amber-500"
                  }`}
                />
                <span className="text-amber-900">
                  {r.detail}
                  {r.severity === "high" && (
                    <span className="text-red-600 font-bold ml-1">— 주의</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI 분석 결과 */}
      {!loaded && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          <Lightbulb className="w-8 h-8 opacity-20 mx-auto mb-3" />
          <div className="text-[14px] font-bold">AI 분석 결과가 없습니다</div>
          <div className="text-[13px] mt-1">
            &quot;분석 요청&quot; 버튼을 눌러 AI 인사이트를 생성하세요
          </div>
        </div>
      )}

      {loading && !loaded && (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
          <div className="text-[13px] text-muted-foreground">AI가 분석 중입니다...</div>
        </div>
      )}

      {analysis && (
        <div className="grid gap-4">
          {/* 핵심 테마 (불만/개선) */}
          {analysis.complaints.length > 0 && (
            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Flame className="w-4 h-4 text-red-500" />
                <span className="text-[15px] font-bold">핵심 테마 (불만/개선)</span>
              </div>
              <div className="grid gap-3">
                {analysis.complaints.map((c, i) => (
                  <div key={i} className="border-l-2 border-red-200 pl-3">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[14px] font-bold">{c.theme}</span>
                      <span className="text-[12px] text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded">
                        {c.count}건
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground">{c.detail}</p>
                    {c.who.length > 0 && (
                      <p className="text-[12px] text-muted-foreground/70 mt-0.5">
                        {c.who.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 강점 */}
          {analysis.strengths.length > 0 && (
            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <ThumbsUp className="w-4 h-4 text-emerald-500" />
                <span className="text-[15px] font-bold">강점</span>
              </div>
              <div className="grid gap-3">
                {analysis.strengths.map((s, i) => (
                  <div key={i} className="border-l-2 border-emerald-200 pl-3">
                    <div className="text-[14px] font-bold mb-1">{s.title}</div>
                    {s.responses.slice(0, 2).map((r, j) => (
                      <div key={j} className="text-[13px] text-muted-foreground">
                        &quot;{r.text}&quot;{" "}
                        <span className="text-muted-foreground/60">— {r.name}</span>
                      </div>
                    ))}
                    {s.responses.length > 2 && (
                      <div className="text-[12px] text-muted-foreground/50">
                        외 {s.responses.length - 2}건
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 개선 제안 */}
          {analysis.suggestions.length > 0 && (
            <div className="bg-card rounded-xl border p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span className="text-[15px] font-bold">개선 제안</span>
              </div>
              <div className="grid gap-2">
                {analysis.suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-[14px]">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <div>
                      <span className="font-semibold text-foreground/70">{s.from}:</span>{" "}
                      <span className="text-muted-foreground">&quot;{s.text}&quot;</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 분석 결과가 모두 비어있을 때 */}
          {analysis.complaints.length === 0 &&
            analysis.strengths.length === 0 &&
            analysis.suggestions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-[13px]">
                분석할 수 있는 데이터가 충분하지 않습니다
              </div>
            )}
        </div>
      )}
    </div>
  );
}
