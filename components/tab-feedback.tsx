"use client";

import { useState, useEffect } from "react";
import type { Instructor, Cohort } from "@/lib/types";
import { computeScores, computeDemographics } from "@/lib/analysis-engine";
import { loadAnalysis } from "@/lib/storage";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface TabFeedbackProps {
  instructor: Instructor;
  cohort: Cohort | null;
}

export function TabFeedback({ instructor, cohort }: TabFeedbackProps) {
  const [fbTone, setFbTone] = useState<"suggest" | "opinion">("suggest");
  const [fbPM, setFbPM] = useState("");
  const [fbText, setFbText] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generated, setGenerated] = useState(false);

  const cohorts = cohort ? [cohort] : instructor.cohorts;
  const preResponses = cohorts.flatMap((c) => c.preResponses);
  const postResponses = cohorts.flatMap((c) => c.postResponses);
  const scores = computeScores(postResponses);
  const cacheKey = cohort?.id || `inst_${instructor.id}`;

  // Auto-set PM name
  useEffect(() => {
    const pm = cohort?.pm || instructor.cohorts[0]?.pm || "";
    if (pm && !fbPM) setFbPM(pm);
  }, [cohort, instructor]);

  const generateFeedback = async () => {
    setLoading(true);
    try {
      const analysis = loadAnalysis(cacheKey);
      const demographics = computeDemographics(preResponses);

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorName: instructor.name,
          cohortLabel: cohort?.label || "전체",
          pmName: fbPM,
          tone: fbTone,
          scores: {
            ps1Avg: scores.ps1Avg,
            ps2Avg: scores.ps2Avg,
            recRate: scores.recRate,
            preCount: preResponses.length,
            postCount: postResponses.length,
          },
          analysis,
          demographics: {
            topGoal: Object.entries(demographics.goal).sort((a, b) => b[1] - a[1])[0],
            computerAvg: demographics.computer.avg,
          },
        }),
      });

      if (!res.ok) throw new Error("생성 실패");
      const data = await res.json();
      setFbText(data.feedback);
      setGenerated(true);
      toast.success("피드백이 생성되었습니다");
    } catch (err) {
      toast.error("피드백 생성에 실패했습니다. API 키를 확인하세요.");
    } finally {
      setLoading(false);
    }
  };

  const copyFb = () => {
    navigator.clipboard?.writeText(fbText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (postResponses.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <div className="text-[30px] opacity-25 mb-2">💬</div>
        <div className="text-[14px] font-bold">후기 데이터가 필요합니다</div>
        <div className="text-[13px] mt-1">
          후기 설문 업로드 후 AI 분석을 먼저 실행해주세요
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3.5">
      {/* Controls */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[13px] font-bold text-muted-foreground">유형</span>
        {[
          { id: "suggest" as const, label: "제안형", desc: "~해보시는 건 어떨까요?" },
          { id: "opinion" as const, label: "의견형", desc: "~어떻게 생각하세요?" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFbTone(t.id)}
            className={`py-1.5 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors ${
              fbTone === t.id
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            <div>{t.label}</div>
            <div className="text-[10px] font-normal text-muted-foreground mt-0.5">{t.desc}</div>
          </button>
        ))}

        <div className="border-l pl-3 flex items-center gap-1.5">
          <span className="text-[12px] text-muted-foreground">담당PM:</span>
          <input
            value={fbPM}
            onChange={(e) => setFbPM(e.target.value)}
            placeholder="이름"
            className="py-1 px-2.5 rounded-md border text-[13px] w-[90px] bg-card"
          />
        </div>

        <div className="flex-1" />

        <button
          onClick={generateFeedback}
          disabled={loading}
          className="py-2 px-4 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {loading ? "생성 중..." : generated ? "재생성" : "AI 생성"}
        </button>
      </div>

      {generated && (
        <div className="py-2 px-3 rounded-lg bg-emerald-50 text-[12px] text-emerald-700">
          ✅ 피드백이 생성되었습니다
        </div>
      )}

      {/* Feedback text */}
      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="flex justify-between items-center px-4 py-3 border-b">
          <span className="text-[14px] font-bold">강사 피드백 초안</span>
          <div className="flex items-center gap-2">
            {fbText && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold">
                초안
              </span>
            )}
            {fbText && (
              <button
                onClick={copyFb}
                className="py-1 px-3 rounded-md border text-[12px] font-semibold flex items-center gap-1 text-muted-foreground hover:bg-accent transition-colors"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-600" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copied ? "복사됨" : "복사"}
              </button>
            )}
          </div>
        </div>
        <div className="p-4">
          <textarea
            value={fbText}
            onChange={(e) => setFbText(e.target.value)}
            placeholder="AI 생성 버튼을 눌러 피드백을 생성하세요..."
            className="w-full min-h-[380px] p-4 rounded-lg border bg-muted text-[14px] leading-loose font-inherit resize-y text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}
