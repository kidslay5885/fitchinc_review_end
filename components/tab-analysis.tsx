"use client";

import { useState, useEffect } from "react";
import type { Instructor, Cohort, AnalysisResult } from "@/lib/types";
import { computeScores, getSatisfactionItems } from "@/lib/analysis-engine";
import { loadAnalysis, saveAnalysis } from "@/lib/storage";
import { RingScore } from "./ring-score";
import { Loader2, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

interface TabAnalysisProps {
  instructor: Instructor;
  cohort: Cohort | null;
}

export function TabAnalysis({ instructor, cohort }: TabAnalysisProps) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedStrengths, setExpandedStrengths] = useState<Record<number, boolean>>({});

  const cohorts = cohort ? [cohort] : instructor.cohorts;
  const postResponses = cohorts.flatMap((c) => c.postResponses);
  const preResponses = cohorts.flatMap((c) => c.preResponses);
  const scores = computeScores(postResponses);
  const satItems = getSatisfactionItems(postResponses);

  // Determine cache key
  const cacheKey = cohort?.id || `inst_${instructor.id}`;

  useEffect(() => {
    const cached = loadAnalysis(cacheKey);
    if (cached) setAnalysis(cached);
  }, [cacheKey]);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const freeTexts = postResponses
        .filter((r) => r.pFree && r.pFree.trim() !== "." && r.pFree.trim().length > 2)
        .map((r) => ({ name: r.name, text: r.pFree }));

      const hopeTexts = preResponses
        .filter((r) => r.hopePlatform && r.hopePlatform.trim().length > 5)
        .map((r) => ({ name: r.name, text: r.hopePlatform }));

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorName: instructor.name,
          freeTexts,
          hopeTexts,
        }),
      });

      if (!res.ok) throw new Error("분석 실패");
      const data: AnalysisResult = await res.json();
      setAnalysis(data);
      saveAnalysis(cacheKey, data);
      toast.success("AI 분석 완료");
    } catch (err) {
      toast.error("AI 분석에 실패했습니다. API 키를 확인하세요.");
    } finally {
      setLoading(false);
    }
  };

  if (postResponses.length === 0 && preResponses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="text-[30px] opacity-25 mb-2">🔍</div>
        <div className="text-[14px] font-bold">분석할 데이터가 없습니다</div>
        <div className="text-[13px] mt-1">후기 설문 파일을 업로드하면 AI 분석이 가능합니다</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Scores & satisfaction */}
      <div className="grid grid-cols-2 gap-4">
        {/* Strengths / satisfaction items */}
        {satItems.length > 0 && (
          <div className="bg-card rounded-xl border p-4 border-t-[3px] border-t-emerald-500">
            <div className="text-[14px] font-bold mb-3">💪 만족도 항목</div>
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
        {/* Scores */}
        {postResponses.length > 0 && (
          <div className="bg-card rounded-xl border p-4">
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
                <div className="mt-2 py-2.5 px-3 bg-muted rounded-lg text-[13px] text-muted-foreground">
                  추천률 <strong className="text-emerald-600">{scores.recRate}%</strong> (
                  {postResponses.filter((r) => /네|넵|추천|강추|할|싶/i.test(r.pRec)).length}/
                  {postResponses.length}명)
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis button */}
      <div className="flex items-center gap-3">
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="py-2 px-4 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {loading ? "분석 중..." : analysis ? "재분석" : "AI 분석 시작"}
        </button>
        {analysis && (
          <span className="text-[12px] text-muted-foreground">
            불만 {analysis.complaints.length}건 · 제안 {analysis.suggestions.length}건 · 긍정{" "}
            {analysis.strengths.length}건
          </span>
        )}
      </div>

      {/* AI Results */}
      {analysis && (
        <>
          {/* Strengths */}
          {analysis.strengths.length > 0 && (
            <div className="bg-card rounded-xl border p-4 border-t-[3px] border-t-emerald-500">
              <div className="text-[14px] font-bold mb-3">💪 수강생 긍정 평가</div>
              {analysis.strengths.map((s, si) => (
                <div key={si} className={si < analysis.strengths.length - 1 ? "mb-3.5" : ""}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[13px] font-bold">{s.title}</span>
                    <button
                      onClick={() =>
                        setExpandedStrengths((p) => ({ ...p, [si]: !p[si] }))
                      }
                      className="text-primary text-[12px] font-semibold flex items-center gap-1"
                    >
                      {expandedStrengths[si] ? "접기" : "더보기"}
                      {expandedStrengths[si] ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  {expandedStrengths[si] && (
                    <div className="bg-muted rounded-lg p-3">
                      {s.responses.map((r, ri) => (
                        <div
                          key={ri}
                          className={`py-1.5 ${
                            ri < s.responses.length - 1 ? "border-b" : ""
                          }`}
                        >
                          <div className="text-[11px] font-bold text-primary mb-0.5">
                            {r.name}
                          </div>
                          <div className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {r.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Complaints */}
          {analysis.complaints.length > 0 && (
            <div className="bg-card rounded-xl border p-4 border-t-[3px] border-t-red-500">
              <div className="flex justify-between items-center mb-3">
                <div className="text-[14px] font-bold">🚨 공통 불만사항</div>
                <span className="text-[11px] text-muted-foreground">AI 자동 분류</span>
              </div>
              {analysis.complaints.map((c, i) => (
                <div
                  key={i}
                  className={`py-3 ${i < analysis.complaints.length - 1 ? "border-b" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[14px] font-bold">{c.theme}</span>
                    {c.count >= 2 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 font-bold">
                        {c.count}건 반복
                      </span>
                    )}
                  </div>
                  <div className="text-[13px] text-muted-foreground mb-1">{c.detail}</div>
                  <div className="text-[11px] text-muted-foreground">— {c.who.join(", ")}</div>
                </div>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {analysis.suggestions.length > 0 && (
            <div className="bg-card rounded-xl border p-4 border-t-[3px] border-t-primary">
              <div className="text-[14px] font-bold mb-3">💡 수강생 제안</div>
              {analysis.suggestions.map((s, i) => (
                <div
                  key={i}
                  className={`py-2.5 ${i < analysis.suggestions.length - 1 ? "border-b" : ""}`}
                >
                  <div className="text-[13px] text-muted-foreground">{s.text}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">— {s.from}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
